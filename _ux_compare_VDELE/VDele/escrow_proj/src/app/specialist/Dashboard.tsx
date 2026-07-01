import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Card } from "../components/vdele/Card";
import { Badge } from "../components/vdele/Badge";
import { Calendar, Star } from "lucide-react";
import { useAppStore } from "../store/AppStore";
import { OrderMiniTimeline } from "../components/vdele/OrderMiniTimeline";
import { formatCurrencyRub, formatDateTime } from "../copy";

type TabType = "available" | "active" | "completed";

const DEMO_PROVIDER_ID = "prov1";

export default function SpecialistDashboard() {
  const navigate = useNavigate();
  const { orders } = useAppStore();
  const [activeTab, setActiveTab] = useState<TabType>("available");

  const { availableOrders, activeOrders, completedOrders } = useMemo(() => {
    const available = orders.filter((o) => o.status === "FUNDED");
    const active = orders.filter(
      (o) => ["ASSIGNED", "IN_PROGRESS", "SUBMITTED", "DISPUTED"].includes(o.status) && o.providerId === DEMO_PROVIDER_ID
    );
    const completed = orders.filter((o) => o.status === "COMPLETED" && o.providerId === DEMO_PROVIDER_ID);
    return { availableOrders: available, activeOrders: active, completedOrders: completed };
  }, [orders]);

  const tabs: { id: TabType; label: string; count: number }[] = [
    { id: "available", label: "Доступные", count: availableOrders.length },
    { id: "active", label: "Активные", count: activeOrders.length },
    { id: "completed", label: "Завершённые", count: completedOrders.length },
  ];

  const list = activeTab === "available" ? availableOrders : activeTab === "active" ? activeOrders : completedOrders;

  return (
    <div className="p-4 space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Заказы</h1>
        <p className="text-gray-600">Принимайте и выполняйте работы</p>
      </div>

      <div className="flex gap-2 bg-white p-2 rounded-[18px] border border-gray-100">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 rounded-[14px] text-sm font-medium transition ${
              activeTab === tab.id
                ? "bg-[#14B8A6] text-white shadow-[0_6px_18px_rgba(20,184,166,0.25)]"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            {tab.label} <span className="opacity-80">({tab.count})</span>
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {list.map((order) => (
          <Card
            key={order.id}
            className="p-4 cursor-pointer hover:shadow-[0_8px_22px_rgba(0,0,0,0.06)] transition"
            onClick={() => navigate(`/specialist/orders/${order.id}`)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-gray-900 truncate">{order.serviceName}</div>
                <div className="text-sm text-gray-600 mt-1 truncate">{order.address}</div>
                <div className="text-sm text-gray-600 flex items-center gap-2 mt-2">
                  <Calendar className="w-4 h-4" />
                  {formatDateTime(order.scheduledDate)}
                </div>
                <OrderMiniTimeline order={order} />
                {order.isTurnkey && order.milestones.length > 1 && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                    <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-[#14B8A6] to-[#0F766E]" style={{ width: `${Math.round((order.milestones.filter(m => ["RELEASED","APPROVED"].includes(m.status)).length / order.milestones.length) * 100)}%` }} />
                    </div>
                    <span>{order.milestones.filter(m => ["RELEASED","APPROVED"].includes(m.status)).length}/{order.milestones.length} этапов</span>
                  </div>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                <Badge type={`order-${order.status.toLowerCase()}` as any} />
                <div className="text-right">
                  <div className="font-semibold text-gray-900">{formatCurrencyRub(order.totalAmount)}</div>
                  {order.provider && (
                    <div className="text-xs text-gray-500 flex items-center justify-end gap-1 mt-1">
                      <Star className="w-3 h-3" /> {order.provider.rating}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ))}

        {list.length === 0 && <Card className="p-6 text-center text-gray-600">Нет заказов в этом разделе</Card>}
      </div>
    </div>
  );
}
