import {
  AuthRequestConfig,
  DiscoveryDocument,
  ResponseType,
  exchangeCodeAsync,
  makeRedirectUri,
  useAuthRequest,
} from "expo-auth-session";
import { Stack } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import { AppButton } from "@/components/app-button";
import { secureSettings } from "@/lib/secure-settings";
import { useAppColors } from "@/theme/use-app-colors";

const discovery: DiscoveryDocument = {
  authorizationEndpoint: "https://oauth.yandex.ru/authorize",
  tokenEndpoint: "https://oauth.yandex.ru/token",
};

function SettingField({
  label,
  value,
  onChangeText,
  secureTextEntry = false,
  hint,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  secureTextEntry?: boolean;
  hint?: string;
}) {
  const colors = useAppColors();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700" }}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry}
        autoCapitalize="none"
        autoCorrect={false}
        style={{
          minHeight: 52,
          paddingHorizontal: 14,
          borderRadius: 12,
          borderCurve: "continuous",
          borderWidth: 1,
          borderColor: colors.outline,
          backgroundColor: colors.surface,
          color: colors.text,
          fontSize: 16,
        }}
      />
      {hint ? (
        <Text selectable style={{ color: colors.muted, fontSize: 12, lineHeight: 17 }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export default function SettingsScreen() {
  const colors = useAppColors();
  const [openRouterKey, setOpenRouterKey] = useState("");
  const [clientId, setClientId] = useState("");
  const [yandexConnected, setYandexConnected] = useState(false);
  const [pin, setPin] = useState("");
  const [hasPin, setHasPin] = useState(false);
  const [biometrics, setBiometrics] = useState(true);
  const [deletePhotos, setDeletePhotos] = useState(false);
  const [saving, setSaving] = useState(false);

  const redirectUri = useMemo(() => makeRedirectUri({ scheme: "autodogovor" }), []);
  const authConfig: AuthRequestConfig = {
    clientId: clientId || "not-configured",
    responseType: ResponseType.Code,
    redirectUri,
    usePKCE: true,
  };
  const [request, response, promptAsync] = useAuthRequest(authConfig, discovery);

  useEffect(() => {
    void Promise.all([
      secureSettings.getOpenRouterKey(),
      secureSettings.getYandexClientId(),
      secureSettings.getYandexToken(),
      secureSettings.hasPin(),
      secureSettings.getBiometricsEnabled(),
      secureSettings.getDeletePhotos(),
    ]).then(([key, savedClientId, token, pinExists, bio, removePhotos]) => {
      setOpenRouterKey(key ?? "");
      setClientId(savedClientId ?? "");
      setYandexConnected(Boolean(token));
      setHasPin(pinExists);
      setBiometrics(bio);
      setDeletePhotos(removePhotos);
    });
  }, []);

  useEffect(() => {
    if (response?.type !== "success" || !response.params.code || !request?.codeVerifier) return;
    void exchangeCodeAsync(
      {
        clientId,
        code: response.params.code,
        redirectUri,
        extraParams: { code_verifier: request.codeVerifier },
      },
      discovery,
    )
      .then(async (token) => {
        await secureSettings.setYandexToken(token.accessToken);
        setYandexConnected(true);
        Alert.alert("Готово", "Яндекс Диск подключён.");
      })
      .catch(() =>
        Alert.alert(
          "Не удалось подключить",
          "Проверьте Client ID, разрешение Яндекс Диска и адрес возврата приложения.",
        ),
      );
  }, [clientId, redirectUri, request?.codeVerifier, response]);

  const save = async () => {
    setSaving(true);
    try {
      await Promise.all([
        secureSettings.setOpenRouterKey(openRouterKey),
        secureSettings.setYandexClientId(clientId),
        secureSettings.setBiometricsEnabled(biometrics),
        secureSettings.setDeletePhotos(deletePhotos),
      ]);
      if (pin) {
        if (!/^\d{4,8}$/.test(pin)) throw new Error("PIN должен содержать от 4 до 8 цифр.");
        await secureSettings.setPin(pin);
        setHasPin(true);
        setPin("");
      }
      Alert.alert("Сохранено", "Настройки защищённо сохранены на телефоне.");
    } catch (error) {
      Alert.alert("Ошибка", error instanceof Error ? error.message : "Настройки не сохранены.");
    } finally {
      setSaving(false);
    }
  };

  const connectYandex = async () => {
    if (!clientId.trim()) {
      Alert.alert("Нужен Client ID", "Введите идентификатор приложения из кабинета Яндекс OAuth.");
      return;
    }
    await secureSettings.setYandexClientId(clientId);
    await promptAsync();
  };

  const disconnectYandex = async () => {
    await secureSettings.setYandexToken("");
    setYandexConnected(false);
  };

  return (
    <>
      <Stack.Title>Настройки</Stack.Title>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 22 }}
        >
          <View style={{ gap: 14 }}>
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: "800" }}>Распознавание</Text>
            <SettingField
              label="Ключ OpenRouter"
              value={openRouterKey}
              onChangeText={setOpenRouterKey}
              secureTextEntry
              hint="Хранится только в защищённом хранилище телефона. Модель: Qwen3 VL 32B."
            />
          </View>

          <View style={{ height: 1, backgroundColor: colors.outline }} />

          <View style={{ gap: 14 }}>
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: "800" }}>Яндекс Диск</Text>
            <SettingField
              label="Client ID Яндекс OAuth"
              value={clientId}
              onChangeText={setClientId}
              hint={`Адрес возврата: ${redirectUri}. Права приложения: запись на Яндекс Диск.`}
            />
            <AppButton
              title={yandexConnected ? "Яндекс Диск подключён" : "Подключить Яндекс Диск"}
              variant={yandexConnected ? "tonal" : "outlined"}
              onPress={connectYandex}
              disabled={!request || yandexConnected}
            />
            {yandexConnected ? (
              <AppButton title="Отключить Яндекс Диск" variant="danger" onPress={disconnectYandex} />
            ) : null}
          </View>

          <View style={{ height: 1, backgroundColor: colors.outline }} />

          <View style={{ gap: 14 }}>
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: "800" }}>Защита</Text>
            <SettingField
              label={hasPin ? "Новый PIN-код" : "Установить PIN-код"}
              value={pin}
              onChangeText={(value) => setPin(value.replace(/\D/g, "").slice(0, 8))}
              secureTextEntry
              hint="От 4 до 8 цифр. После двух минут бездействия приложение блокируется."
            />
            {hasPin ? (
              <AppButton
                title="Удалить PIN-код"
                variant="danger"
                onPress={() =>
                  Alert.alert("Удалить защиту?", "Архив будет открываться без PIN-кода.", [
                    { text: "Отмена", style: "cancel" },
                    {
                      text: "Удалить",
                      style: "destructive",
                      onPress: () =>
                        void secureSettings.clearPin().then(() => {
                          setHasPin(false);
                          setPin("");
                        }),
                    },
                  ])
                }
              />
            ) : null}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>Биометрия</Text>
                <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 18 }}>
                  Использовать отпечаток или распознавание лица.
                </Text>
              </View>
              <Switch value={biometrics} onValueChange={setBiometrics} />
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: "600" }}>
                  Удалять исходные фото
                </Text>
                <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 18 }}>
                  После успешного создания и отправки договора.
                </Text>
              </View>
              <Switch value={deletePhotos} onValueChange={setDeletePhotos} />
            </View>
          </View>

          <AppButton title="Сохранить настройки" onPress={save} loading={saving} />
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
