import { fetch } from "expo/fetch";
import * as Linking from "expo-linking";
import * as LocalAuthentication from "expo-local-authentication";
import { Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  AppState,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView, WebViewMessageEvent } from "react-native-webview";

import { AppButton } from "@/components/app-button";
import { ScreenLoading } from "@/components/screen-state";
import {
  isTrustedHybridNavigation,
  normalizeHybridServerUrl,
} from "@/lib/hybrid-server";
import { secureSettings } from "@/lib/secure-settings";
import { useAppColors } from "@/theme/use-app-colors";

const HYBRID_VERSION = "1.0.5.1";
const BRIDGE_VERSION = 1;

interface BridgeMessage {
  version: number;
  type: string;
  requestId?: string;
  payload?: Record<string, unknown>;
}

export default function HybridScreen() {
  const colors = useAppColors();
  const router = useRouter();
  const webViewRef = useRef<WebView>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [serverUrl, setServerUrl] = useState("");
  const [draftUrl, setDraftUrl] = useState("");
  const [editingAddress, setEditingAddress] = useState(false);
  const [checking, setChecking] = useState(false);
  const [formError, setFormError] = useState("");
  const [webError, setWebError] = useState("");
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    void secureSettings.getHybridServerUrl().then(savedUrl => {
      const initialUrl = savedUrl || process.env.EXPO_PUBLIC_AUTODOGOVOR_WEB_URL || "";
      setServerUrl(initialUrl);
      setDraftUrl(initialUrl);
      setEditingAddress(!initialUrl);
      setLoadingSettings(false);
    });
  }, []);

  const postToWeb = useCallback((type: string, payload: Record<string, unknown> = {}, requestId?: string) => {
    webViewRef.current?.postMessage(
      JSON.stringify({
        version: BRIDGE_VERSION,
        type,
        requestId,
        payload,
      }),
    );
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", state => {
      postToWeb("native.visibility", { active: state === "active" });
    });
    return () => subscription.remove();
  }, [postToWeb]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!canGoBack || editingAddress) return false;
      webViewRef.current?.goBack();
      return true;
    });
    return () => subscription.remove();
  }, [canGoBack, editingAddress]);

  const sendCapabilities = useCallback(
    (requestId?: string) => {
      postToWeb(
        "native.capabilities",
        {
          appVersion: HYBRID_VERSION,
          biometricUnlock: true,
          secureStore: true,
          nativeArchive: true,
          nativeCamera: false,
          backgroundQueue: false,
          secretsExposedToWeb: false,
        },
        requestId,
      );
    },
    [postToWeb],
  );

  const handleBridgeMessage = useCallback(
    async (event: WebViewMessageEvent) => {
      let message: BridgeMessage;
      try {
        message = JSON.parse(event.nativeEvent.data) as BridgeMessage;
      } catch {
        return;
      }
      if (message.version !== BRIDGE_VERSION || typeof message.type !== "string") return;

      if (message.type === "bridge.ready") {
        sendCapabilities(message.requestId);
        return;
      }
      if (message.type === "navigation.native") {
        router.replace("/archive");
        return;
      }
      if (message.type === "settings.native") {
        router.push("/settings");
        return;
      }
      if (message.type === "profile.native") {
        router.push("/settings/profile");
        return;
      }
      if (message.type === "files.native") {
        router.push("/archive/files");
        return;
      }
      if (message.type === "admin.native") {
        router.push("/settings/admin");
        return;
      }
      if (message.type === "app.reload") {
        webViewRef.current?.reload();
        return;
      }
      if (message.type === "auth.biometric") {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: "Подтвердите действие в АвтоДоговоре",
          cancelLabel: "Отмена",
          biometricsSecurityLevel: "strong",
        });
        postToWeb("auth.biometric.result", { success: result.success }, message.requestId);
      }
    },
    [postToWeb, router, sendCapabilities],
  );

  const persistServerUrl = useCallback(async (normalizedUrl: string) => {
    await secureSettings.setHybridServerUrl(normalizedUrl);
    setServerUrl(normalizedUrl);
    setDraftUrl(normalizedUrl);
    setWebError("");
    setEditingAddress(false);
  }, []);

  const saveAddress = async () => {
    setChecking(true);
    setFormError("");
    let normalizedUrl = "";
    try {
      normalizedUrl = normalizeHybridServerUrl(draftUrl);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      try {
        const response = await fetch(`${normalizedUrl}/api/health`, {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Сервер ответил с кодом ${response.status}.`);
        const health = (await response.json()) as { status?: string };
        if (health.status !== "ok") throw new Error("Сервер не подтвердил готовность.");
      } finally {
        clearTimeout(timeout);
      }
      await persistServerUrl(normalizedUrl);
    } catch (error) {
      const message =
        error instanceof Error && error.name === "AbortError"
          ? "Сервер не ответил за 20 секунд."
          : error instanceof Error
            ? error.message
            : "Не удалось проверить сервер.";
      setFormError(message);
      if (normalizedUrl) {
        Alert.alert(
          "Сервер пока недоступен",
          `${message}\n\nМожно сохранить адрес и подключиться позже.`,
          [
            { text: "Исправить", style: "cancel" },
            {
              text: "Сохранить адрес",
              onPress: () => void persistServerUrl(normalizedUrl),
            },
          ],
        );
      }
    } finally {
      setChecking(false);
    }
  };

  if (loadingSettings) {
    return <ScreenLoading label="Открываем гибридную версию…" />;
  }

  if (editingAddress || !serverUrl) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ flex: 1 }}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                flexGrow: 1,
                justifyContent: "center",
                width: "100%",
                maxWidth: 520,
                alignSelf: "center",
                padding: 20,
                gap: 18,
              }}
            >
              <View style={{ gap: 8 }}>
                <Text style={{ color: colors.text, fontSize: 28, fontWeight: "800" }}>
                  АвтоДоговор 1.0.5.1
                </Text>
                <Text selectable style={{ color: colors.muted, fontSize: 15, lineHeight: 22 }}>
                  Укажите адрес веб-приложения. Внешний сервер должен работать через HTTPS.
                  Для проверки в локальной сети разрешены адреса компьютера вида
                  http://192.168.x.x:8765.
                </Text>
              </View>

              <View style={{ gap: 7 }}>
                <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700" }}>
                  Адрес сервера
                </Text>
                <TextInput
                  accessibilityLabel="Адрес веб-приложения"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  placeholder="https://app.example.ru"
                  placeholderTextColor={colors.muted}
                  value={draftUrl}
                  onChangeText={setDraftUrl}
                  style={{
                    minHeight: 56,
                    paddingHorizontal: 15,
                    borderWidth: 1,
                    borderColor: formError ? colors.error : colors.outline,
                    borderRadius: 14,
                    borderCurve: "continuous",
                    color: colors.text,
                    backgroundColor: colors.surface,
                    fontSize: 16,
                  }}
                />
                {formError ? (
                  <Text selectable style={{ color: colors.error, lineHeight: 20 }}>
                    {formError}
                  </Text>
                ) : null}
              </View>

              <AppButton
                title="Проверить и открыть"
                loading={checking}
                onPress={() => void saveAddress()}
              />
              {serverUrl ? (
                <AppButton
                  title="Отмена"
                  variant="outlined"
                  onPress={() => {
                    setDraftUrl(serverUrl);
                    setFormError("");
                    setEditingAddress(false);
                  }}
                />
              ) : null}
              <AppButton
                title="Открыть нативный офлайн-режим"
                variant="tonal"
                onPress={() => router.replace("/archive")}
              />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={["top", "bottom", "left", "right"]} style={{ flex: 1, backgroundColor: colors.surface }}>
        {webError ? (
          <View style={{ flex: 1, justifyContent: "center", padding: 22, gap: 14 }}>
            <Text style={{ color: colors.text, fontSize: 22, fontWeight: "800", textAlign: "center" }}>
              Не удалось открыть веб-версию
            </Text>
            <Text selectable style={{ color: colors.muted, lineHeight: 21, textAlign: "center" }}>
              {webError}
            </Text>
            <AppButton
              title="Повторить подключение"
              onPress={() => {
                setWebError("");
              }}
            />
            <AppButton title="Изменить адрес" variant="outlined" onPress={() => setEditingAddress(true)} />
            <AppButton
              title="Открыть нативный офлайн-режим"
              variant="tonal"
              onPress={() => router.replace("/archive")}
            />
          </View>
        ) : (
          <WebView
            ref={webViewRef}
            source={{ uri: serverUrl }}
            style={{ flex: 1, backgroundColor: colors.background }}
            applicationNameForUserAgent={`АвтоДоговор/${HYBRID_VERSION}`}
            originWhitelist={["https://*", "http://*"]}
            onShouldStartLoadWithRequest={request => {
              if (isTrustedHybridNavigation(request.url, serverUrl)) return true;
              try {
                const protocol = new URL(request.url).protocol;
                if (["https:", "mailto:", "tel:"].includes(protocol)) {
                  void Linking.openURL(request.url);
                }
              } catch {
                // Недоверенный или повреждённый адрес просто блокируется.
              }
              return false;
            }}
            injectedJavaScriptBeforeContentLoaded={`
              window.__AUTODOGOVOR_HYBRID__ = Object.freeze({
                version: "${HYBRID_VERSION}",
                platform: "${Platform.OS}"
              });
              true;
            `}
            onMessage={event => void handleBridgeMessage(event)}
            onLoadEnd={() => {
              sendCapabilities();
            }}
            onNavigationStateChange={state => setCanGoBack(state.canGoBack)}
            onError={event => {
              setWebError(event.nativeEvent.description || "Проверьте адрес сервера и подключение.");
            }}
            onHttpError={event => {
              if (event.nativeEvent.statusCode >= 500) {
                setWebError(`Сервер ответил с ошибкой ${event.nativeEvent.statusCode}.`);
              }
            }}
            startInLoadingState
            renderLoading={() => <ScreenLoading label="Загружаем веб-приложение…" />}
            javaScriptEnabled
            domStorageEnabled
            cacheEnabled
            allowsBackForwardNavigationGestures
            pullToRefreshEnabled
            setSupportMultipleWindows={false}
            thirdPartyCookiesEnabled={false}
            sharedCookiesEnabled={false}
            allowFileAccess={false}
            allowFileAccessFromFileURLs={false}
            allowUniversalAccessFromFileURLs={false}
            geolocationEnabled={false}
            mediaPlaybackRequiresUserAction
            mixedContentMode="never"
            textZoom={100}
          />
        )}
      </SafeAreaView>
    </>
  );
}
