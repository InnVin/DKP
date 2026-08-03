import { useRouter } from "expo-router";
import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAppColors } from "@/theme/use-app-colors";

const menuItems = [
  { label: "Архив", href: "/archive" },
  { label: "Новый ДКП", href: "/new" },
  { label: "Файлы", href: "/archive/files" },
  { label: "Профиль", href: "/settings/profile" },
  { label: "Настройки", href: "/settings" },
  { label: "Админка", href: "/settings/admin" },
] as const;

export function AppMenuButton() {
  const colors = useAppColors();
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  const open = (href: (typeof menuItems)[number]["href"]) => {
    setVisible(false);
    router.navigate(href);
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Открыть левое меню"
        hitSlop={10}
        onPress={() => setVisible(true)}
        style={({ pressed }) => ({
          width: 44,
          height: 44,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 12,
          backgroundColor: pressed ? colors.surfaceVariant : "transparent",
        })}
      >
        <View style={{ width: 20, gap: 4 }}>
          <View style={{ height: 2, borderRadius: 2, backgroundColor: colors.text }} />
          <View style={{ height: 2, borderRadius: 2, backgroundColor: colors.text }} />
          <View style={{ height: 2, borderRadius: 2, backgroundColor: colors.text }} />
        </View>
      </Pressable>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setVisible(false)}
      >
        <View style={{ flex: 1, flexDirection: "row" }}>
          <SafeAreaView
            edges={["top", "bottom", "left"]}
            style={{
              width: "82%",
              maxWidth: 340,
              backgroundColor: colors.surface,
              borderRightWidth: 1,
              borderRightColor: colors.outline,
            }}
          >
            <ScrollView contentContainerStyle={{ padding: 18, gap: 8 }}>
              <View style={{ paddingHorizontal: 10, paddingBottom: 14, gap: 4 }}>
                <Text style={{ color: colors.text, fontSize: 24, fontWeight: "800" }}>
                  АвтоДоговор
                </Text>
                <Text style={{ color: colors.muted, fontSize: 13 }}>Версия 1.0.5.1</Text>
              </View>
              {menuItems.map((item) => (
                <Pressable
                  key={item.href}
                  accessibilityRole="button"
                  onPress={() => open(item.href)}
                  style={({ pressed }) => ({
                    minHeight: 52,
                    paddingHorizontal: 14,
                    justifyContent: "center",
                    borderRadius: 14,
                    borderCurve: "continuous",
                    backgroundColor: pressed ? colors.surfaceVariant : "transparent",
                  })}
                >
                  <Text style={{ color: colors.text, fontSize: 17, fontWeight: "600" }}>
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </SafeAreaView>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Закрыть меню"
            onPress={() => setVisible(false)}
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.42)" }}
          />
        </View>
      </Modal>
    </>
  );
}
