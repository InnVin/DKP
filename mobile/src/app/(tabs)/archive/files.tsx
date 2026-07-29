import { Stack, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, FlatList, Text, View } from "react-native";

import { AppButton } from "@/components/app-button";
import { EmptyState } from "@/components/screen-state";
import { SwipeView } from "@/components/swipe-view";
import { shareGeneratedFile } from "@/lib/contract-files";
import { listAllGeneratedFiles } from "@/lib/database";
import { useAppColors } from "@/theme/use-app-colors";
import { GeneratedFile } from "@/types/deal";

export default function FilesScreen() {
  const colors = useAppColors();
  const router = useRouter();
  const [files, setFiles] = useState<GeneratedFile[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setFiles(await listAllGeneratedFiles());
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <SwipeView
      onSwipeLeft={() => router.navigate("/new")}
      onSwipeRight={() => router.navigate("/archive")}
    >
      <Stack.Title>Файлы</Stack.Title>
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        data={files}
        keyExtractor={(item) => String(item.id)}
        refreshing={loading}
        onRefresh={load}
        contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 10 }}
        ListHeaderComponent={
          <Text selectable style={{ color: colors.muted, lineHeight: 20, paddingBottom: 6 }}>
            Здесь находятся готовые Excel, PDF и JPG из всех договоров.
          </Text>
        }
        ListEmptyComponent={
          <EmptyState
            title="Готовых файлов пока нет"
            text="Создайте договор и сформируйте файлы на этапе «Проверка»."
          />
        }
        renderItem={({ item }) => (
          <View
            style={{
              padding: 16,
              gap: 10,
              borderRadius: 16,
              borderCurve: "continuous",
              borderWidth: 1,
              borderColor: colors.outline,
              backgroundColor: colors.surface,
            }}
          >
            <Text selectable numberOfLines={3} style={{ color: colors.text, fontWeight: "700" }}>
              {item.name}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 13 }}>
              Договор № {item.dealId} · {item.kind.toUpperCase()}
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <AppButton
                title="Открыть договор"
                variant="outlined"
                onPress={() => router.push(`/new/deal/${item.dealId}`)}
                style={{ flex: 1 }}
              />
              <AppButton
                title="Открыть / отправить"
                onPress={() =>
                  void shareGeneratedFile(item.localUri, item.name).catch((error) =>
                    Alert.alert(
                      "Не удалось открыть файл",
                      error instanceof Error ? error.message : "Неизвестная ошибка.",
                    ),
                  )
                }
                style={{ flex: 1 }}
              />
            </View>
          </View>
        )}
      />
    </SwipeView>
  );
}
