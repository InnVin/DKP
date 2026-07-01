import React, { useMemo, useState } from "react";
import { AdminLayout } from "./AdminLayout";
import { Card } from "../components/vdele/Card";
import { useAppStore } from "../store/AppStore";

export default function AdminOrders() {
  const { orders } = useAppStore();
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return orders;
    return orders.filter((o) => o.id.toLowerCase().includes(qq) || o.serviceName.toLowerCase().includes(qq) || o.address.toLowerCase().includes(qq));
  }, [orders, q]);

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Заказы</h1>
          <p className="text-gray-600 mt-1">Мониторинг статусов и escrow</p>
        </div>

        <Card className="p-5 mb-6">
          <input
            className="w-full h-[44px] px-4 rounded-[14px] border border-gray-200"
            placeholder="Поиск: id / услуга / адрес"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </Card>

        <Card className="p-0 overflow-hidden">
          <div className="grid grid-cols-12 px-5 py-3 bg-gray-50 text-xs font-semibold text-gray-600">
            <div className="col-span-3">Order</div>
            <div className="col-span-3">Service</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">Escrow</div>
            <div className="col-span-2 text-right">Amount</div>
          </div>

          <div className="divide-y divide-gray-100">
            {filtered.map((o) => (
              <div key={o.id} className="grid grid-cols-12 px-5 py-4 text-sm">
                <div className="col-span-3">
                  <div className="font-semibold text-gray-900">{o.id}</div>
                  <div className="text-xs text-gray-500 mt-1">{new Date(o.createdAt).toLocaleString("ru-RU")}</div>
                </div>
                <div className="col-span-3">
                  <div className="text-gray-900">{o.serviceName}</div>
                  <div className="text-xs text-gray-500 mt-1 truncate">{o.address}</div>
                </div>
                <div className="col-span-2">
                  <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">{o.status}</span>
                </div>
                <div className="col-span-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    o.escrowStatus === "HELD" ? "bg-[#14B8A6]/10 text-[#0F766E]" :
                    o.escrowStatus === "FROZEN" ? "bg-red-500/10 text-red-600" :
                    "bg-gray-100 text-gray-700"
                  }`}>
                    {o.escrowStatus}
                  </span>
                </div>
                <div className="col-span-2 text-right font-semibold text-gray-900">
                  {o.totalAmount.toLocaleString("ru-RU")} ₽
                </div>
              </div>
            ))}
            {filtered.length === 0 && <div className="p-6 text-gray-600">Ничего не найдено</div>}
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
}
