import { fetch } from "expo/fetch";
import * as Linking from "expo-linking";
import * as LocalAuthentication from "expo-local-authentication";
import { Stack, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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

const HYBRID_VERSION = "1.0.3";
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
  const [pageLoading, setPageLoading] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [bridgeReady, setBridgeReady] = useState(false);

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
        setBridgeReady(true);
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
    setBridgeReady(false);
    setEditingAddress(false);
  }, []);

  const saveAddress = async () => {
    setChecking(true);
    setFormError("");
    let normalizedUrl = "";
    try {
      normalizedUrl = normalizeHybridServerUrl(draftUrl);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
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
          ? "Сервер не ответил за 8 секунд."
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
                  АвтоДоговор 1.0.3
                </Text>
                <Text selectable style={{ color: colors.muted, fontSize: 15, lineHeight: 22 }}>
                  Укажите адрес веб-приложения. Внешний сервер должен работать через HTTPS.
                  Для проверки в локальной сети разрешены адреса компьютера вида
                  http://192.168.x.x:8000.
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
      <SafeAreaView edges={["top", "left", "right"]} style={{ flex: 1, backgroundColor: colors.surface }}>
        <View
          style={{
            paddingHorizontal: 10,
            paddingVertical: 7,
            gap: 7,
            borderBottomWidth: 1,
            borderBottomColor: colors.outline,
            backgroundColor: colors.surface,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View
              style={{
                width: 9,
                height: 9,
                borderRadius: 5,
                backgroundColor: webError ? colors.error : bridgeReady ? colors.success : colors.warning,
              }}
            />
            <Text
              numberOfLines={1}
              style={{ flex: 1, minWidth: 0, color: colors.text, fontSize: 14, fontWeight: "700" }}
            >
              {webError ? "Сервер недоступен" : bridgeReady ? "АвтоДоговор онлайн" : "Подключение…"}
            </Text>
            {pageLoading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
          </View>
          <View style={{ flexDirection: "row", gap: 7 }}>
            <ToolbarButton
              title="Назад"
              disabled={!canGoBack}
              onPress={() => webViewRef.current?.goBack()}
            />
            <ToolbarButton title="Обновить" onPress={() => webViewRef.current?.reload()} />
            <ToolbarButton title="Адрес" onPress={() => setEditingAddress(true)} />
            <ToolbarButton title="Офлайн" onPress={() => router.replace("/archive")} />
          </View>
        </View>

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
                setBridgeReady(false);
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
            onLoadStart={() => setPageLoading(true)}
            onLoadEnd={() => {
              setPageLoading(false);
              sendCapabilities();
            }}
            onNavigationStateChange={state => setCanGoBack(state.canGoBack)}
            onError={event => {
              setPageLoading(false);
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

function ToolbarButton({
  title,
  onPress,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const colors = useAppColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minWidth: 0,
        minHeight: 48,
        paddingHorizontal: 5,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 12,
        borderCurve: "continuous",
        backgroundColor: pressed ? colors.surfaceVariant : "transparent",
        opacity: disabled ? 0.35 : 1,
      })}
    >
      <Text
        numberOfLines={2}
        adjustsFontSizeToFit
        style={{ color: colors.primary, fontSize: 13, fontWeight: "700", textAlign: "center" }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
