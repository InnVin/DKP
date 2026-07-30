import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { captureRef } from "react-native-view-shot";

import { AppButton } from "@/components/app-button";
import { ContractPreview } from "@/components/contract-preview";
import { FieldInput } from "@/components/field-input";
import { ScreenLoading } from "@/components/screen-state";
import { SwipeView } from "@/components/swipe-view";
import { generateContractFiles, printPdf, shareGeneratedFile } from "@/lib/contract-files";
import {
  getDeal,
  listDocuments,
  listGeneratedFiles,
  moveDealToTrash,
  removeDocument,
  saveDeal,
  updateDocumentStatus,
} from "@/lib/database";
import {
  deleteLocalFile,
  pickDocumentPhotos,
  rotateDocument,
  takeDocumentPhoto,
} from "@/lib/document-files";
import { recognizeDocuments } from "@/lib/openrouter-ocr";
import { secureSettings } from "@/lib/secure-settings";
import { syncDealFiles } from "@/lib/yandex-disk";
import { useAppColors } from "@/theme/use-app-colors";
import {
  DealData,
  DealDocument,
  DealField,
  DealRecord,
  DocumentType,
  FieldCandidate,
  GeneratedFile,
  documentLabels,
  requiredFields,
} from "@/types/deal";

type Step = "documents" | "seller" | "buyer" | "vehicle" | "review";

const steps: { key: Step; label: string }[] = [
  { key: "documents", label: "Документы" },
  { key: "seller", label: "Продавец" },
  { key: "buyer", label: "Покупатель" },
  { key: "vehicle", label: "Автомобиль" },
  { key: "review", label: "Проверка" },
];

type FieldDefinition = {
  field: DealField;
  label: string;
  multiline?: boolean;
  keyboardType?: "default" | "numeric" | "phone-pad" | "decimal-pad";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
};

const contractFields: FieldDefinition[] = [
  { field: "contract_number", label: "№ договора", keyboardType: "numeric" },
  { field: "contract_date", label: "Дата договора" },
  { field: "contract_place", label: "Место составления" },
  { field: "price", label: "Стоимость, руб.", keyboardType: "decimal-pad" },
];

const sellerFields: FieldDefinition[] = [
  { field: "seller_full_name", label: "ФИО" },
  { field: "seller_birth_date", label: "Дата рождения" },
  { field: "seller_phone", label: "Телефон", keyboardType: "phone-pad" },
  { field: "seller_passport", label: "Паспорт", autoCapitalize: "characters" },
  { field: "seller_passport_issue_date", label: "Дата выдачи" },
  { field: "seller_passport_issued_by", label: "Кем выдан", multiline: true },
  { field: "seller_address", label: "Адрес", multiline: true },
];

const buyerFields: FieldDefinition[] = [
  { field: "buyer_full_name", label: "ФИО" },
  { field: "buyer_birth_date", label: "Дата рождения" },
  { field: "buyer_phone", label: "Телефон", keyboardType: "phone-pad" },
  { field: "buyer_passport", label: "Паспорт", autoCapitalize: "characters" },
  { field: "buyer_passport_issue_date", label: "Дата выдачи" },
  { field: "buyer_passport_issued_by", label: "Кем выдан", multiline: true },
  { field: "buyer_address", label: "Адрес", multiline: true },
];

const vehicleFields: FieldDefinition[] = [
  { field: "vehicle_make_model", label: "Марка и модель", autoCapitalize: "characters" },
  { field: "vehicle_type", label: "Категория ТС", autoCapitalize: "characters" },
  { field: "vehicle_year", label: "Год выпуска", keyboardType: "numeric" },
  { field: "vin", label: "VIN", autoCapitalize: "characters" },
  { field: "body_number", label: "Номер кузова", autoCapitalize: "characters" },
  { field: "chassis_number", label: "Номер шасси", autoCapitalize: "characters" },
  { field: "color", label: "Цвет" },
  { field: "registration_plate", label: "Госномер", autoCapitalize: "characters" },
  { field: "pts_series_number", label: "ПТС", autoCapitalize: "characters" },
  { field: "sts_series_number", label: "СТС", autoCapitalize: "characters" },
];

const documentTypes: DocumentType[] = [
  "seller_passport",
  "buyer_passport",
  "vehicle_docs",
  "old_contract",
  "other",
];

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : "Неизвестная ошибка.";
}

export function DealEditor({ dealId }: { dealId: number }) {
  const colors = useAppColors();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const columns = width >= 760 ? 2 : 1;
  const previewRef = useRef<View>(null);
  const [record, setRecord] = useState<DealRecord | null>(null);
  const [data, setData] = useState<DealData | null>(null);
  const [documents, setDocuments] = useState<DealDocument[]>([]);
  const [generated, setGenerated] = useState<GeneratedFile[]>([]);
  const [step, setStep] = useState<Step>("documents");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [noticeKind, setNoticeKind] = useState<"info" | "success" | "error">("info");

  const showNotice = (message: string, kind: "info" | "success" | "error" = "info") => {
    setNotice(message);
    setNoticeKind(kind);
  };

  const reloadDocuments = async () => setDocuments(await listDocuments(dealId));
  const reloadGenerated = async () => setGenerated(await listGeneratedFiles(dealId));

  useEffect(() => {
    void Promise.all([getDeal(dealId), listDocuments(dealId), listGeneratedFiles(dealId)]).then(
      ([deal, docs, files]) => {
        setRecord(deal);
        setData(deal?.data ?? null);
        setDocuments(docs);
        setGenerated(files);
      },
    );
  }, [dealId]);

  useEffect(() => {
    if (!data || !record) return;
    const timer = setTimeout(() => {
      void saveDeal(dealId, data, record.fieldMeta, record.conflicts);
    }, 500);
    return () => clearTimeout(timer);
  }, [data, dealId, record]);

  const groupedDocuments = useMemo(
    () =>
      Object.fromEntries(
        documentTypes.map((type) => [type, documents.filter((document) => document.documentType === type)]),
      ) as Record<DocumentType, DealDocument[]>,
    [documents],
  );

  if (!data || !record) return <ScreenLoading label="Открываем карточку…" />;

  const setField = (field: DealField, value: string) => {
    setData((current) => (current ? { ...current, [field]: value } : current));
    setRecord((current) => {
      if (!current) return current;
      const meta = { ...current.fieldMeta, [field]: { confidence: 1, source: "manual" as const } };
      const conflicts = { ...current.conflicts };
      delete conflicts[field];
      return { ...current, fieldMeta: meta, conflicts };
    });
  };

  const chooseCandidate = (field: DealField, candidate: FieldCandidate) => {
    setField(field, candidate.value);
  };

  const fieldWarning = (field: DealField) => {
    if (record.conflicts[field]?.length) return "Есть разные варианты. Выберите значение ниже.";
    const confidence = record.fieldMeta[field]?.confidence;
    if (typeof confidence === "number" && confidence < 0.75) {
      return `Низкая уверенность распознавания: ${Math.round(confidence * 100)}%. Проверьте поле.`;
    }
    return undefined;
  };

  const renderFields = (definitions: FieldDefinition[]) => (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
      {definitions.map((definition) => {
        const candidates = record.conflicts[definition.field] ?? [];
        return (
          <View
            key={definition.field}
            style={{
              width: columns === 2 ? "48%" : "100%",
              minWidth: 0,
              gap: 8,
            }}
          >
            <FieldInput
              label={definition.label}
              value={data[definition.field]}
              onChangeText={(value) => setField(definition.field, value)}
              multiline={definition.multiline}
              keyboardType={definition.keyboardType}
              autoCapitalize={definition.autoCapitalize}
              warning={fieldWarning(definition.field)}
            />
            {candidates.length ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {candidates.map((candidate, index) => (
                  <Pressable
                    key={`${candidate.value}-${index}`}
                    onPress={() => chooseCandidate(definition.field, candidate)}
                    style={({ pressed }) => ({
                      minHeight: 44,
                      maxWidth: "100%",
                      paddingHorizontal: 12,
                      paddingVertical: 9,
                      justifyContent: "center",
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: colors.warning,
                      backgroundColor: pressed ? colors.surfaceVariant : colors.surface,
                    })}
                  >
                    <Text selectable style={{ color: colors.text, fontSize: 14 }} numberOfLines={3}>
                      {candidate.value} · {Math.round(candidate.confidence * 100)}%
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );

  const addPhotos = async (type: DocumentType, source: "camera" | "gallery") => {
    setBusy(`add-${type}`);
    setNotice("");
    try {
      if (source === "camera") await takeDocumentPhoto(dealId, type);
      else await pickDocumentPhotos(dealId, type);
      await reloadDocuments();
    } catch (error) {
      showNotice(messageOf(error), "error");
    } finally {
      setBusy("");
    }
  };

  const removePhoto = (document: DealDocument) => {
    Alert.alert("Удалить фотографию?", "Фото будет удалено только с этого телефона.", [
      { text: "Отмена", style: "cancel" },
      {
        text: "Удалить",
        style: "destructive",
        onPress: () =>
          void (async () => {
            deleteLocalFile(document.localUri);
            await removeDocument(document.id);
            await reloadDocuments();
          })(),
      },
    ]);
  };

  const recognize = async (type: DocumentType, targetFields?: DealField[]) => {
    const docs = groupedDocuments[type];
    if (!docs.length) {
      Alert.alert("Нет фотографий", `Добавьте ${documentLabels[type].toLocaleLowerCase("ru")}.`);
      return;
    }
    setBusy(`ocr-${type}`);
    showNotice("Подготовка документов…");
    try {
      await Promise.all(docs.map((document) => updateDocumentStatus(document.id, "processing")));
      showNotice("Распознавание через OpenRouter…");
      const result = await recognizeDocuments(docs, type, targetFields);
      const nextData = { ...data, ...result.fields };
      const nextMeta = { ...record.fieldMeta, ...result.fieldMeta };
      const nextConflicts = { ...record.conflicts, ...result.conflicts };
      setData(nextData);
      setRecord({ ...record, data: nextData, fieldMeta: nextMeta, conflicts: nextConflicts });
      await saveDeal(dealId, nextData, nextMeta, nextConflicts);
      await Promise.all(docs.map((document) => updateDocumentStatus(document.id, "done")));
      showNotice(
        Object.keys(result.conflicts).length
          ? "Распознавание завершено. Проверьте спорные значения."
          : "Распознавание завершено. Проверьте заполненные поля.",
        Object.keys(result.conflicts).length ? "error" : "success",
      );
    } catch (error) {
      await Promise.all(docs.map((document) => updateDocumentStatus(document.id, "queued")));
      showNotice(messageOf(error), "error");
    } finally {
      await reloadDocuments();
      setBusy("");
    }
  };

  const generate = async () => {
    setBusy("generate");
    showNotice("Формируем Excel, PDF и JPG…");
    try {
      await saveDeal(dealId, data, record.fieldMeta, record.conflicts);
      const jpg = previewRef.current
        ? await captureRef(previewRef, {
            format: "jpg",
            quality: 0.95,
            result: "tmpfile",
            width: 1240,
            height: 1754,
          })
        : undefined;
      await generateContractFiles(dealId, data, jpg);
      await reloadGenerated();
      showNotice("Файлы сохранены на телефоне.", "success");
      let uploadedToDisk = false;
      try {
        const sync = await syncDealFiles(dealId, data);
        uploadedToDisk = !sync.skipped && sync.uploaded > 0;
        if (uploadedToDisk) showNotice(`Готово. На Яндекс Диск загружено файлов: ${sync.uploaded}.`, "success");
      } catch (error) {
        showNotice(`${messageOf(error)} Файлы сохранены на телефоне.`, "error");
      }
      if (uploadedToDisk && (await secureSettings.getDeletePhotos())) {
        for (const document of documents) {
          deleteLocalFile(document.localUri);
          await removeDocument(document.id);
        }
        await reloadDocuments();
      }
    } catch (error) {
      Alert.alert("Не удалось создать договор", messageOf(error));
      showNotice(messageOf(error), "error");
    } finally {
      setBusy("");
    }
  };

  const retrySync = async () => {
    setBusy("sync");
    try {
      const result = await syncDealFiles(dealId, data);
      await reloadGenerated();
      showNotice(
        result.skipped ? "Подключите Яндекс Диск или проверьте интернет." : "Файлы загружены на Яндекс Диск.",
        result.skipped ? "error" : "success",
      );
    } catch (error) {
      showNotice(messageOf(error), "error");
    } finally {
      setBusy("");
    }
  };

  const deleteDeal = () => {
    Alert.alert("Переместить ДКП в корзину?", "Сделку можно будет восстановить.", [
      { text: "Отмена", style: "cancel" },
      {
        text: "В корзину",
        style: "destructive",
        onPress: () =>
          void moveDealToTrash(dealId).then(() => router.replace("/archive")),
      },
    ]);
  };

  const stepIndex = steps.findIndex((item) => item.key === step);
  const nextStep = async (direction: -1 | 1) => {
    await saveDeal(dealId, data, record.fieldMeta, record.conflicts);
    setStep(steps[Math.max(0, Math.min(steps.length - 1, stepIndex + direction))].key);
  };

  const renderDocuments = () => (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 6 }}>
        <Text style={{ color: colors.text, fontSize: 23, fontWeight: "800" }}>Загрузите документы</Text>
      </View>
      {documentTypes.map((type) => {
        const docs = groupedDocuments[type];
        return (
          <View
            key={type}
            style={{
              gap: 12,
              padding: 16,
              borderRadius: 18,
              borderCurve: "continuous",
              borderWidth: 1,
              borderColor: colors.outline,
              backgroundColor: colors.surface,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Text style={{ flex: 1, color: colors.text, fontSize: 17, fontWeight: "700" }}>
                {documentLabels[type]}
              </Text>
              <Text style={{ color: colors.muted, fontVariant: ["tabular-nums"] }}>{docs.length}</Text>
            </View>
            {docs.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                {docs.map((document) => (
                  <View key={document.id} style={{ width: 138, gap: 7 }}>
                    <Image
                      source={{ uri: document.localUri }}
                      contentFit="cover"
                      cachePolicy="none"
                      style={{ width: 138, height: 104, borderRadius: 12, backgroundColor: colors.surfaceVariant }}
                    />
                    <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12 }}>
                      {document.ocrStatus === "done"
                        ? "Распознано"
                        : document.ocrStatus === "queued"
                          ? "В очереди"
                          : "На телефоне"}
                    </Text>
                    <View style={{ flexDirection: "row", gap: 6 }}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Повернуть фотографию"
                        onPress={() =>
                          void rotateDocument(document.localUri).then(() =>
                            setDocuments((current) => [...current]),
                          )
                        }
                        style={{ minHeight: 44, flex: 1, justifyContent: "center" }}
                      >
                        <Text style={{ color: colors.primary, fontSize: 13, fontWeight: "700" }}>Повернуть</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Удалить фотографию"
                        onPress={() => removePhoto(document)}
                        style={{ minHeight: 44, justifyContent: "center" }}
                      >
                        <Text style={{ color: colors.error, fontSize: 13, fontWeight: "700" }}>Удалить</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </ScrollView>
            ) : null}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <AppButton
                title="Сфотографировать"
                variant="outlined"
                onPress={() => addPhotos(type, "camera")}
                disabled={Boolean(busy)}
                style={{ flex: 1, minWidth: 150 }}
              />
              <AppButton
                title="Выбрать фото"
                variant="outlined"
                onPress={() => addPhotos(type, "gallery")}
                disabled={Boolean(busy)}
                style={{ flex: 1, minWidth: 140 }}
              />
              {type !== "other" && docs.length ? (
                <AppButton
                  title="Распознать"
                  variant="tonal"
                  onPress={() => recognize(type)}
                  loading={busy === `ocr-${type}`}
                  disabled={Boolean(busy) && busy !== `ocr-${type}`}
                  style={{ width: "100%" }}
                />
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );

  const renderReview = () => {
    const missing = requiredFields.filter((field) => !data[field]?.trim());
    return (
      <View style={{ gap: 18 }}>
        <View style={{ gap: 6 }}>
          <Text style={{ color: colors.text, fontSize: 23, fontWeight: "800" }}>Проверка и файлы</Text>
          <Text selectable style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>
            Особенно внимательно проверьте VIN, номера документов, ФИО и стоимость.
          </Text>
        </View>
        {renderFields(contractFields)}
        <View
          style={{
            padding: 16,
            gap: 8,
            borderRadius: 16,
            borderCurve: "continuous",
            backgroundColor: missing.length ? colors.surfaceVariant : colors.primaryContainer,
          }}
        >
          <Text style={{ color: missing.length ? colors.text : "#003733", fontWeight: "800" }}>
            {missing.length ? `Не заполнено обязательных полей: ${missing.length}` : "Основные поля заполнены"}
          </Text>
          {missing.length ? (
            <Text selectable style={{ color: colors.muted, lineHeight: 20 }}>
              Вы можете создать черновик, но перед подписанием заполните пропуски.
            </Text>
          ) : null}
        </View>
        <AppButton
          title="Создать Excel, PDF и JPG"
          onPress={generate}
          loading={busy === "generate"}
          disabled={Boolean(busy) && busy !== "generate"}
        />
        {generated.length ? (
          <View style={{ gap: 10 }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "800" }}>Готовые файлы</Text>
            {generated.map((file) => (
              <View
                key={file.id}
                style={{
                  padding: 14,
                  gap: 10,
                  borderRadius: 14,
                  borderCurve: "continuous",
                  borderWidth: 1,
                  borderColor: colors.outline,
                  backgroundColor: colors.surface,
                }}
              >
                <Text selectable numberOfLines={3} style={{ color: colors.text, fontWeight: "700" }}>
                  {file.name}
                </Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>
                  {file.syncStatus === "uploaded"
                    ? "Загружено на Яндекс Диск"
                    : file.syncStatus === "error"
                      ? "Нужна повторная отправка"
                      : "Сохранено на телефоне"}
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  <AppButton
                    title="Отправить"
                    variant="outlined"
                    onPress={() =>
                      void shareGeneratedFile(file.localUri, file.name).catch((error) =>
                        Alert.alert("Ошибка", messageOf(error)),
                      )
                    }
                    style={{ flex: 1, minWidth: 120 }}
                  />
                  {file.kind === "pdf" ? (
                    <AppButton
                      title="Печать"
                      variant="outlined"
                      onPress={() =>
                        void printPdf(file.localUri).catch((error) =>
                          Alert.alert("Ошибка", messageOf(error)),
                        )
                      }
                      style={{ flex: 1, minWidth: 120 }}
                    />
                  ) : null}
                </View>
              </View>
            ))}
            <AppButton
              title="Повторить отправку на Яндекс Диск"
              variant="tonal"
              onPress={retrySync}
              loading={busy === "sync"}
            />
          </View>
        ) : null}
        <AppButton title="Переместить ДКП в корзину" variant="danger" onPress={deleteDeal} />
      </View>
    );
  };

  const currentContent =
    step === "documents"
      ? renderDocuments()
      : step === "seller"
        ? (
            <View style={{ gap: 18 }}>
              <Text style={{ color: colors.text, fontSize: 23, fontWeight: "800" }}>Договор и продавец</Text>
              {renderFields(contractFields)}
              {renderFields(sellerFields)}
              {groupedDocuments.seller_passport.length ? (
                <AppButton
                  title="Распознать паспорт продавца заново"
                  variant="tonal"
                  onPress={() => recognize("seller_passport")}
                  loading={busy === "ocr-seller_passport"}
                />
              ) : null}
              <FieldInput
                label="Заметки по продавцу"
                value={data.seller_notes}
                onChangeText={(value) => setField("seller_notes", value)}
                multiline
              />
            </View>
          )
        : step === "buyer"
          ? (
              <View style={{ gap: 18 }}>
                <Text style={{ color: colors.text, fontSize: 23, fontWeight: "800" }}>Покупатель</Text>
                {renderFields(buyerFields)}
                {groupedDocuments.buyer_passport.length ? (
                  <AppButton
                    title="Распознать паспорт покупателя заново"
                    variant="tonal"
                    onPress={() => recognize("buyer_passport")}
                    loading={busy === "ocr-buyer_passport"}
                  />
                ) : null}
                <FieldInput
                  label="Заметки по покупателю"
                  value={data.buyer_notes}
                  onChangeText={(value) => setField("buyer_notes", value)}
                  multiline
                />
              </View>
            )
          : step === "vehicle"
            ? (
                <View style={{ gap: 18 }}>
                  <Text style={{ color: colors.text, fontSize: 23, fontWeight: "800" }}>Автомобиль</Text>
                  {renderFields(vehicleFields)}
                  {groupedDocuments.vehicle_docs.length ? (
                    <AppButton
                      title="Распознать ПТС и СТС заново"
                      variant="tonal"
                      onPress={() => recognize("vehicle_docs")}
                      loading={busy === "ocr-vehicle_docs"}
                    />
                  ) : null}
                  <FieldInput
                    label="Заметки по автомобилю"
                    value={data.vehicle_notes}
                    onChangeText={(value) => setField("vehicle_notes", value)}
                    multiline
                  />
                </View>
              )
            : renderReview();

  return (
    <SwipeView
      onSwipeLeft={() =>
        stepIndex < steps.length - 1 ? void nextStep(1) : router.navigate("/profile")
      }
      onSwipeRight={() => (stepIndex > 0 ? void nextStep(-1) : router.navigate("/archive"))}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, backgroundColor: colors.background }}
      >
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 18 }}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {steps.map((item, index) => {
            const selected = item.key === step;
            return (
              <Pressable
                key={item.key}
                onPress={() => setStep(item.key)}
                style={({ pressed }) => ({
                  minHeight: 48,
                  paddingHorizontal: 14,
                  borderRadius: 14,
                  borderCurve: "continuous",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 7,
                  backgroundColor: selected ? colors.primary : pressed ? colors.surfaceVariant : colors.surface,
                  borderWidth: 1,
                  borderColor: selected ? colors.primary : colors.outline,
                })}
              >
                <Text style={{ color: selected ? colors.onPrimary : colors.muted, fontWeight: "800" }}>
                  {index + 1}
                </Text>
                <Text style={{ color: selected ? colors.onPrimary : colors.text, fontWeight: "700" }}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {notice ? (
          <View
            style={{
              padding: 13,
              borderRadius: 13,
              borderCurve: "continuous",
              borderWidth: noticeKind === "error" ? 1 : 0,
              borderColor: noticeKind === "error" ? colors.error : "transparent",
              backgroundColor:
                noticeKind === "error"
                  ? `${colors.error}18`
                  : noticeKind === "success"
                    ? colors.primaryContainer
                    : colors.surfaceVariant,
            }}
          >
            <Text
              selectable
              style={{
                color: noticeKind === "error" ? colors.error : colors.text,
                lineHeight: 20,
                fontWeight: noticeKind === "error" ? "700" : "400",
              }}
            >
              {notice}
            </Text>
            {noticeKind === "error" && notice.toLocaleLowerCase("ru").includes("openrouter") ? (
              <AppButton
                title="Открыть настройки"
                variant="danger"
                onPress={() => router.navigate("/settings")}
                style={{ marginTop: 10 }}
              />
            ) : null}
          </View>
        ) : null}

        {currentContent}

        <View style={{ flexDirection: "row", gap: 10 }}>
          {stepIndex > 0 ? (
            <AppButton
              title="Назад"
              variant="outlined"
              onPress={() => nextStep(-1)}
              style={{ flex: 1 }}
            />
          ) : null}
          {stepIndex < steps.length - 1 ? (
            <AppButton title="Далее" onPress={() => nextStep(1)} style={{ flex: 1 }} />
          ) : null}
        </View>
      </ScrollView>

      <View pointerEvents="none" style={{ position: "absolute", left: -1600, top: 0 }}>
        <ContractPreview ref={previewRef} data={data} />
      </View>
      </KeyboardAvoidingView>
    </SwipeView>
  );
}
