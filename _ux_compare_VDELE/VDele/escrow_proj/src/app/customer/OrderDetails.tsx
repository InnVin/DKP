import React, { useMemo, useState } from "react";
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
import { MapPin, Calendar, Phone, MessageCircle, AlertCircle, Clock, Shield, FileText } from "lucide-react";
import { formatCurrencyRub, formatDateTime, formatCountdown, ORDER_STATUS_LABEL } from "../copy";

export default function OrderDetails() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { orders, actions } = useAppStore();

  const order = orders.find((o) => o.id === orderId);

  const [confirmAction, setConfirmAction] = useState<null | { key: string; title: string; body: string; onConfirm: () => void }>(null);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState("Работа выполнена некачественно");
  const [disputeDesc, setDisputeDesc] = useState("");
  const [autoLeft, setAutoLeft] = useState<number | null>(null);

  React.useEffect(() => {
    if (order?.status === "SUBMITTED" && order.autoReleaseDate) {
      const tick = () => setAutoLeft(Date.parse(order.autoReleaseDate!) - Date.now());
      tick();
      const id = setInterval(tick, 1000);
      return () => clearInterval(id);
    }
  }, [order?.status, order?.autoReleaseDate]);

  const allowed = useMemo(() => (order ? getAllowedActions(order, "customer") : []), [order]);

  if (!order) {
    return (
      <MobileLayout title="Заказ" onBack={() => navigate("/customer/orders")}>
        <div className="p-6 text-center text-gray-500">Заказ не найден</div>
      </MobileLayout>
    );
  }

  const isTurnkey = order.isTurnkey && order.milestones.length > 1;

  const handleAction = (key: string) => {
    if (key === "FUND") actions.fundOrder(order.id);
    if (key === "CANCEL") actions.cancelOrder(order.id);
    if (key === "CONFIRM") actions.confirmOrder(order.id);
    if (key === "OPEN_DISPUTE") setDisputeOpen(true);
    if (key === "LEAVE_REVIEW") navigate(`/customer/review/${order.id}`);
    if (key === "CONTACT_SUPPORT") { /* TODO */ }
  };

  return (
    <MobileLayout
      title={`Заказ`}
      onBack={() => navigate("/customer/orders")}
      headerVariant="dark"
      bottomBar={
        allowed.filter(a => !a.milestoneId).length > 0 ? (
          <div className="flex gap-2">
            {allowed.filter(a => !a.milestoneId).map((a) => (
              <Button
                key={a.key}
                variant={a.variant === "primary" ? "primary" : a.variant === "danger" ? "secondary" : "secondary"}
                className="flex-1"
                onClick={() => {
                  if (a.requiresConfirmation && a.confirmation) {
                    setConfirmAction({ key: a.key, ...a.confirmation, onConfirm: () => { handleAction(a.key); setConfirmAction(null); } });
                  } else {
                    handleAction(a.key);
                  }
                }}
              >
                {a.label}
              </Button>
            ))}
          </div>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {/* Header card */}
        <div className="px-4 pt-2">
          <Card variant="dark" className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-white/60 text-xs">{order.id}</p>
                <h2 className="text-lg font-bold text-white mt-1">{order.serviceName}</h2>
                <p className="text-2xl font-bold text-[#2DD4BF] mt-1">{formatCurrencyRub(order.totalAmount)}</p>
              </div>
              <Badge type={`order-${order.status.toLowerCase()}` as any} />
            </div>
            {order.provider && (
              <div className="flex items-center gap-3 mt-4 pt-3 border-t border-white/10">
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white font-bold text-sm">
                  {order.provider.name.charAt(0)}
                </div>
                <div>
                  <p className="text-white font-medium text-sm">{order.provider.name}</p>
                  <p className="text-white/60 text-xs">⭐ {order.provider.rating} • {order.provider.reviewCount} отзывов</p>
                </div>
                {order.contactsRevealed && (
                  <a href="#" className="ml-auto p-2 rounded-xl bg-white/10"><Phone className="w-4 h-4 text-teal-400" /></a>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* Escrow banner */}
        <div className="px-4">
          <EscrowBanner status={order.escrowStatus} />
        </div>

        {/* Auto-release countdown */}
        {order.status === "SUBMITTED" && autoLeft !== null && autoLeft > 0 && !isTurnkey && (
          <div className="px-4">
            <div className="flex items-center gap-2 p-3 rounded-2xl bg-amber-50 border border-amber-100">
              <Clock className="w-4 h-4 text-amber-600" />
              <span className="text-sm text-amber-700">Автовыплата через <strong>{formatCountdown(autoLeft)}</strong></span>
            </div>
          </div>
        )}

        {/* ═══ TURNKEY: Milestone view ═══ */}
        {isTurnkey && (
          <div className="px-4 space-y-3">
            <MilestoneProgressBar milestones={order.milestones} />

            <h3 className="text-base font-semibold text-gray-900 pt-2">Этапы работ</h3>
            {order.milestones.map((ms) => (
              <MilestoneCard
                key={ms.id}
                milestone={ms}
                policy={order.policy}
                role="customer"
                onFund={() => actions.fundMilestone(order.id, ms.id)}
                onApprove={() => actions.approveMilestone(order.id, ms.id)}
                onDispute={() => actions.disputeMilestone(order.id, ms.id, "Проблема с этапом", "Описание проблемы")}
                onToggleCheck={(checkId) => actions.toggleChecklist(order.id, ms.id, checkId, "customer")}
              />
            ))}

            {/* Change orders */}
            {order.changeOrders.filter(co => co.status === "PROPOSED").length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-violet-500" /> Предложения по изменению
                </h3>
                {order.changeOrders.filter(co => co.status === "PROPOSED").map((co) => (
                  <div key={co.id} className="p-3 rounded-2xl border border-violet-200 bg-violet-50">
                    <p className="text-sm text-gray-800">{co.changes.reason}</p>
                    {co.changes.priceAdjustment && (
                      <p className="text-sm font-medium text-violet-700 mt-1">
                        {co.changes.priceAdjustment > 0 ? "+" : ""}{formatCurrencyRub(co.changes.priceAdjustment)}
                      </p>
                    )}
                    <div className="flex gap-2 mt-2">
                      <button onClick={() => actions.approveChange(order.id, co.id)} className="flex-1 py-2 rounded-xl bg-violet-600 text-white text-sm font-medium">Согласиться</button>
                      <button onClick={() => actions.rejectChange(order.id, co.id)} className="py-2 px-4 rounded-xl border border-violet-200 text-violet-600 text-sm">Отклонить</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ SIMPLE ORDER: Timeline view ═══ */}
        {!isTurnkey && (
          <>
            {/* Info cards */}
            <div className="px-4 grid grid-cols-2 gap-3">
              <Card className="p-3">
                <div className="flex items-center gap-2 text-gray-500 mb-1"><MapPin className="w-4 h-4" /><span className="text-xs">Адрес</span></div>
                <p className="text-sm font-medium text-gray-900">{order.address}</p>
              </Card>
              <Card className="p-3">
                <div className="flex items-center gap-2 text-gray-500 mb-1"><Calendar className="w-4 h-4" /><span className="text-xs">Дата</span></div>
                <p className="text-sm font-medium text-gray-900">{formatDateTime(order.scheduledDate)}</p>
              </Card>
            </div>

            {/* Price breakdown */}
            <div className="px-4">
              <Card className="p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Стоимость</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-600">Базовая цена</span><span>{formatCurrencyRub(order.breakdown.basePrice)}</span></div>
                  {order.breakdown.options.map((o, i) => (
                    <div key={i} className="flex justify-between"><span className="text-gray-600">{o.name}</span><span>+{formatCurrencyRub(o.amount)}</span></div>
                  ))}
                  <div className="flex justify-between"><span className="text-gray-600">Комиссия платформы</span><span>{formatCurrencyRub(order.breakdown.platformFee)}</span></div>
                  <div className="pt-2 border-t border-gray-100 flex justify-between font-semibold">
                    <span>Итого</span><span className="text-teal-600">{formatCurrencyRub(order.totalAmount)}</span>
                  </div>
                </div>
              </Card>
            </div>

            {/* Timeline */}
            <div className="px-4">
              <Card className="p-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Ход заказа</h3>
                <OrderTimeline order={order} />
              </Card>
            </div>
          </>
        )}

        {/* Escrow shield info */}
        <div className="px-4">
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-teal-50/50 border border-teal-100">
            <Shield className="w-5 h-5 text-teal-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-gray-700">
              <p className="font-medium text-gray-900 mb-1">Безопасная сделка</p>
              <p>Оплата удерживается до подтверждения. Отмена: {order.policy.cancelWindowMinutes} мин. Спор: {order.policy.disputeWindowHours} ч. Автовыплата: {order.policy.autoReleaseHours} ч.</p>
            </div>
          </div>
        </div>

        <div className="h-4" />
      </div>

      {/* Confirm modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => setConfirmAction(null)}>
          <div className="w-full max-w-md bg-white rounded-t-3xl p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900">{confirmAction.title}</h3>
            <p className="text-sm text-gray-600 mt-2">{confirmAction.body}</p>
            <div className="flex gap-3 mt-6">
              <Button variant="secondary" className="flex-1" onClick={() => setConfirmAction(null)}>Отмена</Button>
              <Button variant="primary" className="flex-1" onClick={confirmAction.onConfirm}>{confirmAction.key === "CANCEL" ? "Отменить заказ" : "Подтвердить"}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Dispute modal */}
      {disputeOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={() => setDisputeOpen(false)}>
          <div className="w-full max-w-md bg-white rounded-t-3xl p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2"><AlertCircle className="w-5 h-5 text-red-500" /> Открыть спор</h3>
            <div className="mt-4 space-y-3">
              <select value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} className="w-full p-3 rounded-xl border border-gray-200 text-sm">
                <option>Работа выполнена некачественно</option>
                <option>Работа не завершена</option>
                <option>Специалист не пришёл</option>
                <option>Повреждение имущества</option>
                <option>Другое</option>
              </select>
              <textarea value={disputeDesc} onChange={(e) => setDisputeDesc(e.target.value)} placeholder="Опишите проблему..." className="w-full p-3 rounded-xl border border-gray-200 text-sm h-24 resize-none" />
            </div>
            <div className="flex gap-3 mt-4">
              <Button variant="secondary" className="flex-1" onClick={() => setDisputeOpen(false)}>Отмена</Button>
              <button className="flex-1 py-3 rounded-xl bg-red-500 text-white font-semibold text-sm" onClick={() => { actions.openDispute(order.id, disputeReason, disputeDesc || "—"); setDisputeOpen(false); }}>Отправить</button>
            </div>
          </div>
        </div>
      )}
    </MobileLayout>
  );
}
