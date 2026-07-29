import { File } from "expo-file-system";
import * as Network from "expo-network";

import {
  listGeneratedFiles,
  setDealSyncStatus,
  setGeneratedSyncStatus,
} from "@/lib/database";
import { secureSettings } from "@/lib/secure-settings";
import { DealData } from "@/types/deal";

const API = "https://cloud-api.yandex.net/v1/disk";

async function request(path: string, options: RequestInit = {}) {
  const token = await secureSettings.getYandexToken();
  if (!token) throw new Error("Яндекс Диск не подключён.");
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Authorization: `OAuth ${token}`,
      ...options.headers,
    },
  });
  return response;
}

async function ensureDirectory(path: string) {
  const response = await request(`/resources?path=${encodeURIComponent(path)}`, { method: "PUT" });
  if (!response.ok && response.status !== 409) {
    throw new Error(`Яндекс Диск: не удалось создать папку (${response.status}).`);
  }
}

async function ensureDirectoryTree(path: string) {
  const parts = path.split("/").filter(Boolean);
  let current = "";
  for (const part of parts) {
    current += `/${part}`;
    await ensureDirectory(current);
  }
}

async function upload(localUri: string, remotePath: string) {
  const linkResponse = await request(
    `/resources/upload?path=${encodeURIComponent(remotePath)}&overwrite=true`,
  );
  if (!linkResponse.ok) {
    throw new Error(`Яндекс Диск: не удалось получить адрес загрузки (${linkResponse.status}).`);
  }
  const { href } = await linkResponse.json();
  const file = new File(localUri);
  const uploadResponse = await fetch(String(href), {
    method: "PUT",
    body: await file.arrayBuffer(),
  });
  if (!uploadResponse.ok) {
    throw new Error(`Яндекс Диск: загрузка не выполнена (${uploadResponse.status}).`);
  }
}

export async function syncDealFiles(dealId: number, data: DealData) {
  const token = await secureSettings.getYandexToken();
  if (!token) return { uploaded: 0, skipped: true };
  const network = await Network.getNetworkStateAsync();
  if (!network.isConnected) {
    await setDealSyncStatus(dealId, "pending");
    return { uploaded: 0, skipped: true };
  }
  const year = (data.contract_date.match(/\d{4}/)?.[0] || String(new Date().getFullYear())).slice(0, 4);
  const number = (data.contract_number || String(dealId)).replace(/[\\/:*?"<>|]/g, "_");
  const folder = `/АвтоДоговор/${year}/${number}`;
  const files = await listGeneratedFiles(dealId);
  await setDealSyncStatus(dealId, "pending");
  try {
    await ensureDirectoryTree(folder);
    for (const file of files) {
      const remotePath = `${folder}/${file.name}`;
      await upload(file.localUri, remotePath);
      await setGeneratedSyncStatus(file.id, "uploaded", remotePath);
    }
    await setDealSyncStatus(dealId, "uploaded");
    return { uploaded: files.length, skipped: false };
  } catch (error) {
    await setDealSyncStatus(dealId, "error");
    for (const file of files) {
      if (file.syncStatus !== "uploaded") await setGeneratedSyncStatus(file.id, "error");
    }
    throw error;
  }
}

export async function deleteDealRemoteFiles(dealId: number) {
  const token = await secureSettings.getYandexToken();
  if (!token) return;
  const files = await listGeneratedFiles(dealId);
  const remotePaths = files.map((file) => file.remotePath).filter(Boolean);
  for (const remotePath of remotePaths) {
    const response = await request(
      `/resources?path=${encodeURIComponent(remotePath)}&permanently=false`,
      { method: "DELETE" },
    );
    if (!response.ok && response.status !== 202 && response.status !== 204 && response.status !== 404) {
      throw new Error(`Яндекс Диск: файл не удалён (${response.status}).`);
    }
  }
}
