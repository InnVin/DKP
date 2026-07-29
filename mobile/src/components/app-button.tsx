import { ActivityIndicator, Pressable, Text, ViewStyle } from "react-native";

import { useAppColors } from "@/theme/use-app-colors";

type Variant = "filled" | "tonal" | "outlined" | "danger";

interface AppButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

export function AppButton({
  title,
  onPress,
  variant = "filled",
  disabled = false,
  loading = false,
  style,
}: AppButtonProps) {
  const colors = useAppColors();
  const palette = {
    filled: { background: colors.primary, text: colors.onPrimary, border: colors.primary },
    tonal: {
      background: colors.primaryContainer,
      text: "#003733",
      border: colors.primaryContainer,
    },
    outlined: { background: "transparent", text: colors.primary, border: colors.outline },
    danger: { background: "transparent", text: colors.error, border: colors.error },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: 48,
          paddingHorizontal: 18,
          borderRadius: 14,
          borderCurve: "continuous",
          borderWidth: 1,
          borderColor: palette.border,
          backgroundColor: palette.background,
          alignItems: "center",
          justifyContent: "center",
          opacity: disabled ? 0.45 : pressed ? 0.76 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.text} />
      ) : (
        <Text
          numberOfLines={2}
          adjustsFontSizeToFit
          style={{ color: palette.text, fontSize: 15, fontWeight: "700", textAlign: "center" }}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}
