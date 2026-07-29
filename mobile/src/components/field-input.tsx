import { Text, TextInput, View } from "react-native";

import { useAppColors } from "@/theme/use-app-colors";

interface FieldInputProps {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  multiline?: boolean;
  keyboardType?: "default" | "numeric" | "phone-pad" | "decimal-pad";
  warning?: string;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
}

export function FieldInput({
  label,
  value,
  onChangeText,
  multiline = false,
  keyboardType = "default",
  warning,
  autoCapitalize = "sentences",
}: FieldInputProps) {
  const colors = useAppColors();
  return (
    <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
      <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600" }}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        textAlignVertical={multiline ? "top" : "center"}
        selectionColor={colors.primary}
        placeholderTextColor={colors.muted}
        style={{
          minHeight: multiline ? 92 : 52,
          maxHeight: multiline ? 160 : 60,
          paddingHorizontal: 14,
          paddingVertical: multiline ? 12 : 8,
          borderRadius: 12,
          borderCurve: "continuous",
          borderWidth: warning ? 2 : 1,
          borderColor: warning ? colors.warning : colors.outline,
          backgroundColor: colors.surface,
          color: colors.text,
          fontSize: 16,
        }}
      />
      {warning ? (
        <Text selectable style={{ color: colors.warning, fontSize: 12, lineHeight: 17 }}>
          {warning}
        </Text>
      ) : null}
    </View>
  );
}
