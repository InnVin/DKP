import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { ScreenLoading } from "@/components/screen-state";
import { createDeal } from "@/lib/database";

export default function NewDealScreen() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    void createDeal()
      .then((id) => router.replace(`/new/deal/${id}`))
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : "Не удалось создать новый ДКП."),
      );
  }, [router]);
  return (
    <>
      <Stack.Title>Новый ДКП</Stack.Title>
      <View style={{ flex: 1 }}>
        <ScreenLoading label={error || "Создаём карточку…"} error={Boolean(error)} />
      </View>
    </>
  );
}
