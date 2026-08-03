import { NativeTabs } from "expo-router/unstable-native-tabs";

import { useAppColors } from "@/theme/use-app-colors";

export default function TabsLayout() {
  const colors = useAppColors();
  return (
    <NativeTabs labelVisibilityMode="labeled" tintColor={colors.primary}>
      <NativeTabs.Trigger name="archive">
        <NativeTabs.Trigger.Icon sf="archivebox" md="inventory_2" />
        <NativeTabs.Trigger.Label>Архив</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="new">
        <NativeTabs.Trigger.Icon sf="plus.circle.fill" md="add_circle" />
        <NativeTabs.Trigger.Label>Новый ДКП</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon sf="gearshape" md="settings" />
        <NativeTabs.Trigger.Label>Настройки</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
