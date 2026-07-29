import { Stack } from "expo-router/stack";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { ScreenLoading } from "@/components/screen-state";
import { initializeDatabase } from "@/lib/database";
import { AppLock } from "@/security/app-lock";
import { useAppColors } from "@/theme/use-app-colors";

export default function RootLayout() {
  const colors = useAppColors();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void initializeDatabase()
      .then(() => setReady(true))
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Не удалось открыть архив."));
  }, []);

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenLoading label={error} />
      </View>
    );
  }
  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <ScreenLoading label="Подготавливаем архив…" />
      </View>
    );
  }

  return (
    <AppLock>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: colors.background },
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          headerBackButtonDisplayMode: "minimal",
        }}
      >
        <Stack.Screen name="hybrid" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </AppLock>
  );
}
