import { Stack, useLocalSearchParams } from "expo-router";

import { DealEditor } from "@/screens/deal-editor";

export default function DealScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const dealId = Number(params.id);
  return (
    <>
      <Stack.Title>ДКП</Stack.Title>
      <DealEditor dealId={dealId} />
    </>
  );
}
