import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from "react-native";

import { AppButton } from "@/components/app-button";
import { SwipeView } from "@/components/swipe-view";
import { secureSettings } from "@/lib/secure-settings";
import { useAppColors } from "@/theme/use-app-colors";

function ProfileField({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
}) {
  const colors = useAppColors();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.text, fontWeight: "700" }}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
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
    </View>
  );
}

export default function ProfileScreen() {
  const colors = useAppColors();
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [organization, setOrganization] = useState("");
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);

  useEffect(() => {
    void Promise.all([
      secureSettings.getProfileName(),
      secureSettings.getProfilePhone(),
      secureSettings.getProfileOrganization(),
    ])
      .then(([storedName, storedPhone, storedOrganization]) => {
        setName(storedName ?? "");
        setPhone(storedPhone ?? "");
        setOrganization(storedOrganization ?? "");
      })
      .catch((reason) =>
        setNotice({
          text: reason instanceof Error ? reason.message : "Не удалось открыть профиль.",
          error: true,
        }),
      );
  }, []);

  const save = async () => {
    setNotice(null);
    try {
      await Promise.all([
        secureSettings.setProfileName(name),
        secureSettings.setProfilePhone(phone),
        secureSettings.setProfileOrganization(organization),
      ]);
      setNotice({ text: "Профиль сохранён.", error: false });
    } catch (reason) {
      setNotice({
        text: reason instanceof Error ? reason.message : "Не удалось сохранить профиль.",
        error: true,
      });
    }
  };

  return (
    <SwipeView
      onSwipeLeft={() => router.navigate("/settings")}
      onSwipeRight={() => router.navigate("/new")}
    >
      <Stack.Title>Профиль</Stack.Title>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 16 }}
        >
          <Text selectable style={{ color: colors.muted, lineHeight: 20 }}>
            Профиль хранится только на этом телефоне. Регистрация и передача данных на сервер не требуются.
          </Text>
          <ProfileField label="ФИО" value={name} onChangeText={setName} />
          <ProfileField label="Телефон" value={phone} onChangeText={setPhone} />
          <ProfileField label="Организация" value={organization} onChangeText={setOrganization} />
          {notice ? (
            <View
              style={{
                padding: 13,
                borderRadius: 13,
                borderCurve: "continuous",
                borderWidth: notice.error ? 1 : 0,
                borderColor: notice.error ? colors.error : "transparent",
                backgroundColor: notice.error ? `${colors.error}18` : colors.primaryContainer,
              }}
            >
              <Text
                selectable
                style={{
                  color: notice.error ? colors.error : "#003733",
                  fontWeight: "700",
                }}
              >
                {notice.text}
              </Text>
            </View>
          ) : null}
          <AppButton title="Сохранить профиль" onPress={() => void save()} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SwipeView>
  );
}
