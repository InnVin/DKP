import { forwardRef } from "react";
import { Text, View } from "react-native";

import { DealData } from "@/types/deal";

export const ContractPreview = forwardRef<View, { data: DealData }>(({ data }, ref) => {
  const row = (label: string, value: string) => (
    <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#B8C0C6" }}>
      <Text style={{ width: 270, padding: 12, fontSize: 22, fontWeight: "700", color: "#111" }}>
        {label}
      </Text>
      <Text selectable style={{ flex: 1, padding: 12, fontSize: 22, color: "#111" }}>
        {value || "________________"}
      </Text>
    </View>
  );
  return (
    <View
      ref={ref}
      collapsable={false}
      style={{
        width: 1240,
        minHeight: 1754,
        padding: 72,
        gap: 16,
        backgroundColor: "#FFFFFF",
      }}
    >
      <Text
        style={{ color: "#111", fontSize: 32, lineHeight: 40, fontWeight: "800", textAlign: "center" }}
      >
        ДОГОВОР КУПЛИ-ПРОДАЖИ АВТОМОБИЛЯ № {data.contract_number}
      </Text>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: "#111", fontSize: 22 }}>г. {data.contract_place}</Text>
        <Text style={{ color: "#111", fontSize: 22 }}>{data.contract_date}</Text>
      </View>
      <Text style={{ color: "#111", fontSize: 23, fontWeight: "800", paddingTop: 12 }}>ПРОДАВЕЦ</Text>
      {row("ФИО", data.seller_full_name)}
      {row("Паспорт", data.seller_passport)}
      {row("Кем и когда выдан", `${data.seller_passport_issued_by}, ${data.seller_passport_issue_date}`)}
      {row("Адрес", data.seller_address)}
      <Text style={{ color: "#111", fontSize: 23, fontWeight: "800", paddingTop: 12 }}>ПОКУПАТЕЛЬ</Text>
      {row("ФИО", data.buyer_full_name)}
      {row("Паспорт", data.buyer_passport)}
      {row("Кем и когда выдан", `${data.buyer_passport_issued_by}, ${data.buyer_passport_issue_date}`)}
      {row("Адрес", data.buyer_address)}
      <Text style={{ color: "#111", fontSize: 23, fontWeight: "800", paddingTop: 12 }}>АВТОМОБИЛЬ</Text>
      {row("Марка и модель", data.vehicle_make_model)}
      {row("Год / категория", `${data.vehicle_year} / ${data.vehicle_type}`)}
      {row("VIN", data.vin)}
      {row("Кузов / шасси", `${data.body_number} / ${data.chassis_number}`)}
      {row("Цвет / госномер", `${data.color} / ${data.registration_plate}`)}
      {row("ПТС / СТС", `${data.pts_series_number} / ${data.sts_series_number}`)}
      <Text style={{ color: "#111", fontSize: 24, lineHeight: 34, paddingTop: 12 }}>
        Стоимость автомобиля: {data.price || "________________"} рублей. Стороны проверили сведения,
        получили автомобиль, документы и по одному экземпляру договора.
      </Text>
      <View style={{ flexDirection: "row", gap: 80, paddingTop: 76 }}>
        <Text style={{ flex: 1, color: "#111", fontSize: 21, borderTopWidth: 1, paddingTop: 8 }}>
          Продавец
        </Text>
        <Text style={{ flex: 1, color: "#111", fontSize: 21, borderTopWidth: 1, paddingTop: 8 }}>
          Покупатель
        </Text>
      </View>
    </View>
  );
});

ContractPreview.displayName = "ContractPreview";
