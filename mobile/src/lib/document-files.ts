import { Directory, File, Paths } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

import { addDocument } from "@/lib/database";
import { DocumentType } from "@/types/deal";

function documentDirectory(dealId: number) {
  const directory = new Directory(Paths.document, "deals", String(dealId), "documents");
  directory.create({ idempotent: true, intermediates: true });
  return directory;
}

async function compressAndStore(uri: string, dealId: number) {
  const context = ImageManipulator.manipulate(uri);
  context.resize({ width: 1800 });
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({
    compress: 0.86,
    format: SaveFormat.JPEG,
  });
  const name = `document-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const target = new File(documentDirectory(dealId), name);
  await new File(saved.uri).copy(target);
  return { uri: target.uri, name };
}

async function persistAssets(
  assets: ImagePicker.ImagePickerAsset[],
  dealId: number,
  type: DocumentType,
) {
  const ids: number[] = [];
  for (const asset of assets) {
    const stored = await compressAndStore(asset.uri, dealId);
    ids.push(
      await addDocument(
        dealId,
        type,
        stored.uri,
        asset.fileName || stored.name,
        "image/jpeg",
      ),
    );
  }
  return ids;
}

export async function takeDocumentPhoto(dealId: number, type: DocumentType) {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Разрешите приложению доступ к камере в настройках Android.");
  }
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    cameraType: ImagePicker.CameraType.back,
    quality: 0.92,
    exif: false,
  });
  if (result.canceled) return [];
  return persistAssets(result.assets, dealId, type);
}

export async function pickDocumentPhotos(dealId: number, type: DocumentType) {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: true,
    selectionLimit: 8,
    orderedSelection: true,
    quality: 0.92,
  });
  if (result.canceled) return [];
  return persistAssets(result.assets, dealId, type);
}

export async function rotateDocument(uri: string, degrees = 90) {
  const context = ImageManipulator.manipulate(uri);
  context.rotate(degrees);
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ compress: 0.9, format: SaveFormat.JPEG });
  await new File(saved.uri).copy(new File(uri), { overwrite: true });
}

export function deleteLocalFile(uri: string) {
  const file = new File(uri);
  if (file.exists) file.delete();
}
