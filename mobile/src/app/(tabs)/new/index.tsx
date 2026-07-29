import { Stack, useRouter } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";

import { ScreenLoading } from "@/components/screen-state";
import { createDeal } from "@/lib/database";

export default function NewDealScreen() {
  const router = useRouter();
  useEffect(() => {
    void createDeal().then((id) => router.replace(`/new/deal/${id}`));
  }, [router]);
  return (
    <>
      <Stack.Title>Новый ДКП</Stack.Title>
      <View style={{ flex: 1 }}>
        <ScreenLoading label="Создаём карточку…" />
      </View>
    </>
  );
}
