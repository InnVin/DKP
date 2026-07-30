import { ActivityIndicator, Text, View } from "react-native";

import { useAppColors } from "@/theme/use-app-colors";

export function ScreenLoading({
  label = "Загрузка…",
  error = false,
}: {
  label?: string;
  error?: boolean;
}) {
  const colors = useAppColors();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
      {error ? null : <ActivityIndicator color={colors.primary} />}
      <View
        style={
          error
            ? {
                maxWidth: 420,
                padding: 14,
                borderRadius: 14,
                borderCurve: "continuous",
                borderWidth: 1,
                borderColor: colors.error,
                backgroundColor: `${colors.error}18`,
              }
            : undefined
        }
      >
        <Text
          selectable={error}
          style={{
            color: error ? colors.error : colors.muted,
            fontWeight: error ? "700" : "400",
            textAlign: "center",
          }}
        >
          {label}
        </Text>
      </View>
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
