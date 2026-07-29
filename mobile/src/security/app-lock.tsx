import * as LocalAuthentication from "expo-local-authentication";
import { ReactNode, useCallback, useEffect, useState } from "react";
import {
  AppState,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  View,
} from "react-native";

import { AppButton } from "@/components/app-button";
import { ScreenLoading } from "@/components/screen-state";
import { secureSettings } from "@/lib/secure-settings";
import { useAppColors } from "@/theme/use-app-colors";

const AUTO_LOCK_MS = 2 * 60 * 1000;

export function AppLock({ children }: { children: ReactNode }) {
  const colors = useAppColors();
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [backgroundAt, setBackgroundAt] = useState<number | null>(null);

  const unlockWithBiometrics = useCallback(async () => {
    const [enabled, hardware, enrolled] = await Promise.all([
      secureSettings.getBiometricsEnabled(),
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    if (!enabled || !hardware || !enrolled) return false;
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Открыть АвтоДоговор",
      cancelLabel: "Ввести PIN",
      fallbackLabel: "Использовать PIN",
      biometricsSecurityLevel: "strong",
    });
    if (result.success) {
      setLocked(false);
      setPin("");
      setError("");
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    void (async () => {
      const hasPin = await secureSettings.hasPin();
      setLocked(hasPin);
      setLoading(false);
      if (hasPin) await unlockWithBiometrics();
    })();
  }, [unlockWithBiometrics]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "background" || state === "inactive") setBackgroundAt(Date.now());
      if (state === "active" && backgroundAt && Date.now() - backgroundAt >= AUTO_LOCK_MS) {
        void secureSettings.hasPin().then(async (hasPin) => {
          if (hasPin) {
            setLocked(true);
            await unlockWithBiometrics();
          }
        });
      }
    });
    return () => subscription.remove();
  }, [backgroundAt, unlockWithBiometrics]);

  if (loading) return <ScreenLoading label="Открываем защищённый архив…" />;
  if (!locked) return children;

  const verify = async () => {
    if (await secureSettings.verifyPin(pin)) {
      setLocked(false);
      setPin("");
      setError("");
    } else {
      setError("Неверный PIN-код.");
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{
        flex: 1,
        padding: 24,
        justifyContent: "center",
        backgroundColor: colors.background,
      }}
    >
      <View style={{ gap: 18, maxWidth: 420, width: "100%", alignSelf: "center" }}>
        <Text style={{ color: colors.text, fontSize: 28, fontWeight: "800" }}>АвтоДоговор</Text>
        <Text selectable style={{ color: colors.muted, fontSize: 15, lineHeight: 22 }}>
          Архив содержит персональные данные. Введите PIN-код или используйте биометрию.
        </Text>
        <TextInput
          accessibilityLabel="PIN-код"
          value={pin}
          onChangeText={(value) => setPin(value.replace(/\D/g, "").slice(0, 8))}
          keyboardType="number-pad"
          secureTextEntry
          autoFocus
          style={{
            height: 56,
            paddingHorizontal: 16,
            borderRadius: 14,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: error ? colors.error : colors.outline,
            backgroundColor: colors.surface,
            color: colors.text,
            fontSize: 22,
            letterSpacing: 6,
          }}
          onSubmitEditing={verify}
        />
        {error ? <Text style={{ color: colors.error }}>{error}</Text> : null}
        <AppButton title="Открыть" onPress={verify} disabled={pin.length < 4} />
        <AppButton title="Использовать биометрию" variant="outlined" onPress={unlockWithBiometrics} />
      </View>
    </KeyboardAvoidingView>
  );
}
