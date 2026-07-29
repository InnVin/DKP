import Constants from "expo-constants";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, Text, View } from "react-native";

import { AppButton } from "@/components/app-button";
import { SwipeView } from "@/components/swipe-view";
import { listAllGeneratedFiles, listDeals, listDeletedDeals } from "@/lib/database";
import { useAppColors } from "@/theme/use-app-colors";

export default function AdminScreen() {
  const colors = useAppColors();
  const router = useRouter();
  const [stats, setStats] = useState({ deals: 0, trash: 0, files: 0 });

  useFocusEffect(
    useCallback(() => {
      void Promise.all([listDeals(), listDeletedDeals(), listAllGeneratedFiles()]).then(
        ([deals, trash, files]) =>
          setStats({ deals: deals.length, trash: trash.length, files: files.length }),
      );
    }, []),
  );

  const rows = [
    ["Версия приложения", Constants.expoConfig?.version ?? "1.0.1"],
    ["Договоров в архиве", String(stats.deals)],
    ["Договоров в корзине", String(stats.trash)],
    ["Готовых файлов", String(stats.files)],
    ["Хранилище", "Локальное, SQLite"],
  ];

  return (
    <SwipeView onSwipeRight={() => router.navigate("/settings")}>
      <Stack.Title>Админка</Stack.Title>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 16 }}
      >
        <Text selectable style={{ color: colors.muted, lineHeight: 20 }}>
          Служебная информация и быстрый доступ к управлению локальными данными.
        </Text>
        <View
          style={{
            borderRadius: 16,
            borderCurve: "continuous",
            borderWidth: 1,
            borderColor: colors.outline,
            backgroundColor: colors.surface,
            overflow: "hidden",
          }}
        >
          {rows.map(([label, value], index) => (
            <View
              key={label}
              style={{
                minHeight: 52,
                paddingHorizontal: 14,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                borderTopWidth: index ? 1 : 0,
                borderTopColor: colors.outline,
              }}
            >
              <Text style={{ flex: 1, color: colors.muted }}>{label}</Text>
              <Text selectable style={{ color: colors.text, fontWeight: "700" }}>
                {value}
              </Text>
            </View>
          ))}
        </View>
        <AppButton title="Открыть архив" onPress={() => router.navigate("/archive")} />
        <AppButton
          title="Открыть файлы"
          variant="outlined"
          onPress={() => router.navigate("/archive/files")}
        />
        <AppButton
          title="Открыть настройки"
          variant="outlined"
          onPress={() => router.navigate("/settings")}
        />
      </ScrollView>
    </SwipeView>
  );
}
