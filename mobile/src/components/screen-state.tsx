import { ActivityIndicator, Text, View } from "react-native";

import { useAppColors } from "@/theme/use-app-colors";

export function ScreenLoading({ label = "Загрузка…" }: { label?: string }) {
  const colors = useAppColors();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
      <ActivityIndicator color={colors.primary} />
      <Text style={{ color: colors.muted }}>{label}</Text>
    </View>
  );
}

export function EmptyState({ title, text }: { title: string; text: string }) {
  const colors = useAppColors();
  return (
    <View
      style={{
        padding: 28,
        alignItems: "center",
        gap: 8,
        borderRadius: 18,
        borderCurve: "continuous",
        backgroundColor: colors.surfaceVariant,
      }}
    >
      <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700", textAlign: "center" }}>
        {title}
      </Text>
      <Text
        selectable
        style={{ color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: "center" }}
      >
        {text}
      </Text>
    </View>
  );
}
