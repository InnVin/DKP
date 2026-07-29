import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

const keys = {
  openRouter: "openrouter_api_key",
  yandexToken: "yandex_disk_token",
  yandexClientId: "yandex_client_id",
  pinHash: "app_pin_hash",
  biometrics: "biometrics_enabled",
  deletePhotos: "delete_photos_after_export",
} as const;

export const secureSettings = {
  getOpenRouterKey: () => SecureStore.getItemAsync(keys.openRouter),
  setOpenRouterKey: (value: string) =>
    value
      ? SecureStore.setItemAsync(keys.openRouter, value.trim())
      : SecureStore.deleteItemAsync(keys.openRouter),
  getYandexToken: () => SecureStore.getItemAsync(keys.yandexToken),
  setYandexToken: (value: string) =>
    value
      ? SecureStore.setItemAsync(keys.yandexToken, value.trim())
      : SecureStore.deleteItemAsync(keys.yandexToken),
  getYandexClientId: () => SecureStore.getItemAsync(keys.yandexClientId),
  setYandexClientId: (value: string) =>
    value
      ? SecureStore.setItemAsync(keys.yandexClientId, value.trim())
      : SecureStore.deleteItemAsync(keys.yandexClientId),
  hasPin: async () => Boolean(await SecureStore.getItemAsync(keys.pinHash)),
  setPin: async (pin: string) => {
    const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin);
    await SecureStore.setItemAsync(keys.pinHash, hash);
  },
  clearPin: () => SecureStore.deleteItemAsync(keys.pinHash),
  verifyPin: async (pin: string) => {
    const stored = await SecureStore.getItemAsync(keys.pinHash);
    if (!stored) return true;
    const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin);
    return stored === hash;
  },
  getBiometricsEnabled: async () =>
    (await SecureStore.getItemAsync(keys.biometrics)) !== "false",
  setBiometricsEnabled: (enabled: boolean) =>
    SecureStore.setItemAsync(keys.biometrics, String(enabled)),
  getDeletePhotos: async () =>
    (await SecureStore.getItemAsync(keys.deletePhotos)) === "true",
  setDeletePhotos: (enabled: boolean) =>
    SecureStore.setItemAsync(keys.deletePhotos, String(enabled)),
};
