import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Card } from "../components/vdele/Card";
import { Badge } from "../components/vdele/Badge";
import { Input } from "../components/vdele/Input";
import { OrderMiniTimeline } from "../components/vdele/OrderMiniTimeline";
import { useAppStore } from "../store/AppStore";
import { formatCurrencyRub, formatDateTime } from "../copy";

export default function CustomerOrders() {
  const navigate = useNavigate();
  const { orders } = useAppStore();
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return orders;
    return orders.filter((o) => o.serviceName.toLowerCase().includes(qq) || o.id.toLowerCase().includes(qq));
  }, [orders, q]);

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Заказы</h1>
        <p className="text-gray-600">История и текущие работы</p>
      </div>

      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по заказам" />

      <div className="space-y-3">
        {filtered.map((o) => (
          <Card
            key={o.id}
            className="p-4 cursor-pointer hover:shadow-[0_8px_22px_rgba(0,0,0,0.06)] transition"
            onClick={() => navigate(`/customer/orders/${o.id}`)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-gray-900 truncate">{o.serviceName}</div>
                <div className="text-sm text-gray-600 mt-1 truncate">{o.address}</div>
                <div className="text-xs text-gray-500 mt-1">{formatDateTime(o.scheduledDate)}</div>
                <OrderMiniTimeline order={o} />
                {o.isTurnkey && o.milestones.length > 1 && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                    <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-[#14B8A6] to-[#0F766E]" style={{ width: `${Math.round((o.milestones.filter(m => ["RELEASED","APPROVED"].includes(m.status)).length / o.milestones.length) * 100)}%` }} />
                    </div>
                    <span>{o.milestones.filter(m => ["RELEASED","APPROVED"].includes(m.status)).length}/{o.milestones.length} этапов</span>
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge type={`order-${o.status.toLowerCase()}` as any} />
                <div className="font-semibold text-gray-900">{formatCurrencyRub(o.totalAmount)}</div>
              </div>
            </div>
          </Card>
        ))}

        {filtered.length === 0 && <Card className="p-6 text-center text-gray-600">Ничего не найдено</Card>}
      </div>
    </div>
  );
}
