import { Stack } from "expo-router/stack";

import { AppMenuButton } from "@/components/app-menu-button";
import { useAppColors } from "@/theme/use-app-colors";

export default function ProfileLayout() {
  const colors = useAppColors();
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: colors.background },
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerBackButtonDisplayMode: "minimal",
        headerLeft: () => <AppMenuButton />,
      }}
    >
      <Stack.Screen name="index" options={{ title: "Профиль" }} />
    </Stack>
  );
}
