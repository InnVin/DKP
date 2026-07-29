import { Link, Stack, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, FlatList, Pressable, Text, TextInput, View } from "react-native";

import { AppButton } from "@/components/app-button";
import { SwipeView } from "@/components/swipe-view";
import { EmptyState } from "@/components/screen-state";
import {
  createDeal,
  deleteDealPermanently,
  listDeals,
  listDeletedDeals,
  listDocuments,
  listGeneratedFiles,
  restoreDeal,
} from "@/lib/database";
import { deleteLocalFile } from "@/lib/document-files";
import { deleteDealRemoteFiles } from "@/lib/yandex-disk";
import { useAppColors } from "@/theme/use-app-colors";
import { DealRecord, requiredFields } from "@/types/deal";

function completion(deal: DealRecord) {
  const filled = requiredFields.filter((field) => Boolean(deal.data[field]?.trim())).length;
  return Math.round((filled / requiredFields.length) * 100);
}

export default function ArchiveScreen() {
  const colors = useAppColors();
  const router = useRouter();
  const [deals, setDeals] = useState<DealRecord[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [trash, setTrash] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDeals(trash ? await listDeletedDeals(query) : await listDeals(query));
    } finally {
      setLoading(false);
    }
  }, [query, trash]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const create = async () => {
    const id = await createDeal();
    router.push(`/new/deal/${id}`);
  };

  const erase = async (id: number, removeFromDisk: boolean) => {
    if (removeFromDisk) await deleteDealRemoteFiles(id);
    const [documents, files] = await Promise.all([listDocuments(id), listGeneratedFiles(id)]);
    documents.forEach((document) => deleteLocalFile(document.localUri));
    files.forEach((file) => deleteLocalFile(file.localUri));
    await deleteDealPermanently(id);
    await load();
  };

  const confirmErase = (item: DealRecord) => {
    Alert.alert(
      "Удалить ДКП навсегда?",
      "Выберите, что делать с готовыми файлами на Яндекс Диске.",
      [
        { text: "Отмена", style: "cancel" },
        {
          text: "Оставить на Диске",
          style: "destructive",
          onPress: () => void erase(item.id, false),
        },
        {
          text: "Удалить везде",
          style: "destructive",
          onPress: () =>
            void erase(item.id, true).catch((error) =>
              Alert.alert("Не удалось удалить", error instanceof Error ? error.message : "Ошибка удаления."),
            ),
        },
      ],
    );
  };

  return (
    <SwipeView onSwipeLeft={() => router.navigate("/new")}>
      <Stack.Title>Архив ДКП</Stack.Title>
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        data={deals}
        keyExtractor={(item) => String(item.id)}
        refreshing={loading}
        onRefresh={load}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 10 }}
        ListHeaderComponent={
          <View style={{ gap: 14, paddingBottom: 8 }}>
            <TextInput
              accessibilityLabel="Поиск в архиве"
              placeholder="VIN, госномер, ФИО или № договора"
              placeholderTextColor={colors.muted}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={load}
              returnKeyType="search"
              style={{
                minHeight: 52,
                paddingHorizontal: 16,
                borderRadius: 16,
                borderCurve: "continuous",
                borderWidth: 1,
                borderColor: colors.outline,
                backgroundColor: colors.surface,
                color: colors.text,
                fontSize: 16,
              }}
            />
            {trash ? null : <AppButton title="Создать новый ДКП" onPress={create} />}
            <AppButton
              title={trash ? "Вернуться в архив" : "Открыть корзину"}
              variant="outlined"
              onPress={() => setTrash((value) => !value)}
            />
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title={query ? "Ничего не найдено" : trash ? "Корзина пуста" : "Архив пока пуст"}
            text={
              query
                ? "Измените запрос или очистите строку поиска."
                : trash
                  ? "Удалённые сделки будут отображаться здесь."
                : "Создайте первую сделку и добавьте фотографии документов."
            }
          />
        }
        renderItem={({ item }) => {
          const percent = completion(item);
          const title =
            item.data.vehicle_make_model ||
            item.data.seller_full_name ||
            `Договор № ${item.data.contract_number || item.id}`;
          const card = (
            <Pressable
              disabled={trash}
              style={({ pressed }) => ({
                minHeight: 92,
                padding: 16,
                gap: 8,
                borderRadius: 18,
                borderCurve: "continuous",
                backgroundColor: pressed ? colors.surfaceVariant : colors.surface,
                borderWidth: 1,
                borderColor: colors.outline,
              })}
            >
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                  <Text
                    numberOfLines={2}
                    style={{ color: colors.text, fontSize: 17, fontWeight: "700" }}
                  >
                    {title}
                  </Text>
                  <Text
                    numberOfLines={2}
                    style={{ color: colors.muted, fontSize: 14, lineHeight: 19 }}
                  >
                    № {item.data.contract_number || "—"} · {item.data.contract_date || "Без даты"}
                    {item.data.registration_plate ? ` · ${item.data.registration_plate}` : ""}
                  </Text>
                </View>
                <Text
                  style={{
                    color: percent === 100 ? colors.success : colors.primary,
                    fontVariant: ["tabular-nums"],
                    fontWeight: "800",
                  }}
                >
                  {percent}%
                </Text>
              </View>
              <View style={{ height: 5, borderRadius: 99, backgroundColor: colors.surfaceVariant }}>
                <View
                  style={{
                    width: `${percent}%`,
                    height: 5,
                    borderRadius: 99,
                    backgroundColor: percent === 100 ? colors.success : colors.primary,
                  }}
                />
              </View>
              {trash ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  <AppButton
                    title="Восстановить"
                    variant="tonal"
                    onPress={() => void restoreDeal(item.id).then(load)}
                    style={{ flex: 1, minWidth: 120 }}
                  />
                  <AppButton
                    title="Удалить навсегда"
                    variant="danger"
                    onPress={() => confirmErase(item)}
                    style={{ flex: 1, minWidth: 150 }}
                  />
                </View>
              ) : (
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {item.syncStatus === "uploaded"
                    ? "Загружено на Яндекс Диск"
                    : item.syncStatus === "error"
                      ? "Нужна повторная отправка"
                      : "Сохранено на телефоне"}
                </Text>
              )}
            </Pressable>
          );
          return trash ? (
            card
          ) : (
            <Link href={`/new/deal/${item.id}`} asChild>
              {card}
            </Link>
          );
        }}
      />
    </SwipeView>
  );
}
