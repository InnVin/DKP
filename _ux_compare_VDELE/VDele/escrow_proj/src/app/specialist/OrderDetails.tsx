import React, { useMemo } from "react";
import { useNavigate, useParams } from "react-router";
import { MobileLayout } from "../components/vdele/MobileLayout";
import { Card } from "../components/vdele/Card";
import { Badge } from "../components/vdele/Badge";
import { Button } from "../components/vdele/Button";
import { OrderTimeline } from "../components/vdele/OrderTimeline";
import { EscrowBanner } from "../components/vdele/EscrowBanner";
import { MilestoneProgressBar } from "../components/vdele/MilestoneProgressBar";
import { MilestoneCard } from "../components/vdele/MilestoneCard";
import { useAppStore } from "../store/AppStore";
import { getAllowedActions } from "../stateMachine";
import { MapPin, Calendar, Phone } from "lucide-react";
import { formatCurrencyRub, formatDateTime } from "../copy";

const DEMO_PROVIDER_ID = "prov1";

export default function SpecialistOrderDetails() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { orders, actions } = useAppStore();

  const order = orders.find((o) => o.id === orderId);
  const allowed = useMemo(() => (order ? getAllowedActions(order, "specialist") : []), [order]);
  const isTurnkey = order?.isTurnkey && (order.milestones?.length ?? 0) > 1;

  if (!order) {
    return (
      <MobileLayout title="Заказ" onBack={() => navigate("/specialist")}>
        <div className="p-6 text-center text-gray-500">Заказ не найден</div>
      </MobileLayout>
    );
  }

  const handleAction = (key: string) => {
    if (key === "ACCEPT") actions.acceptOrder(order.id, DEMO_PROVIDER_ID);
    if (key === "START") actions.startOrder(order.id);
    if (key === "SUBMIT") actions.submitOrder(order.id);
  };

  return (
    <MobileLayout
      title="Заказ"
      onBack={() => navigate("/specialist")}
      headerVariant="dark"
      bottomBar={
        allowed.filter(a => !a.milestoneId).length > 0 && !isTurnkey ? (
          <div className="flex gap-2">
            {allowed.filter(a => !a.milestoneId).map((a) => (
              <Button key={a.key} variant={a.variant === "primary" ? "primary" : "secondary"} className="flex-1" onClick={() => handleAction(a.key)}>{a.label}</Button>
            ))}
          </div>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {/* Header */}
        <div className="px-4 pt-2">
          <Card variant="dark" className="p-4">
            <p className="text-white/60 text-xs">{order.id}</p>
            <h2 className="text-lg font-bold text-white mt-1">{order.serviceName}</h2>
            <p className="text-xl font-bold text-[#2DD4BF] mt-1">{formatCurrencyRub(order.totalAmount)}</p>
            <div className="flex items-center gap-2 mt-3 text-white/70 text-sm">
              <MapPin className="w-4 h-4" /><span>{order.address}</span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-white/70 text-sm">
              <Calendar className="w-4 h-4" /><span>{formatDateTime(order.scheduledDate)}</span>
            </div>
          </Card>
        </div>

        <div className="px-4"><EscrowBanner status={order.escrowStatus} /></div>

        {/* Turnkey milestone view */}
        {isTurnkey && (
          <div className="px-4 space-y-3">
            <MilestoneProgressBar milestones={order.milestones} />
            <h3 className="text-base font-semibold text-gray-900 pt-1">Мои этапы</h3>
            {order.milestones.map((ms) => (
              <MilestoneCard
                key={ms.id}
                milestone={ms}
                policy={order.policy}
                role="specialist"
                onStart={() => actions.startMilestone(order.id, ms.id)}
                onSubmit={() => actions.submitMilestone(order.id, ms.id)}
                onToggleCheck={(checkId) => actions.toggleChecklist(order.id, ms.id, checkId, "specialist")}
              />
            ))}
          </div>
        )}

        {/* Simple order timeline */}
        {!isTurnkey && (
          <div className="px-4">
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Ход заказа</h3>
              <OrderTimeline order={order} />
            </Card>
          </div>
        )}

        <div className="h-4" />
      </div>
    </MobileLayout>
  );
}
