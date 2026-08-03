import { Stack } from "expo-router/stack";

import { AppMenuButton } from "@/components/app-menu-button";
import { useAppColors } from "@/theme/use-app-colors";

export default function NewDealLayout() {
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
      <Stack.Screen name="index" options={{ title: "Новый ДКП" }} />
      <Stack.Screen
        name="deal/[id]"
        options={{
          title: "ДКП",
          headerBackVisible: false,
          headerLeft: () => <AppMenuButton />,
        }}
      />
    </Stack>
  );
}
