import React, { useMemo, useState } from "react";
import { AdminLayout } from "./AdminLayout";
import { Card } from "../components/vdele/Card";
import { useAppStore } from "../store/AppStore";
import { formatDateTime, formatCurrencyRub, DISPUTE_STATUS_LABEL, DISPUTE_CATEGORY_LABEL } from "../copy";
import { AlertTriangle, Clock, ArrowUpRight, Camera, MessageSquare, ChevronRight } from "lucide-react";

export default function AdminDisputes() {
  const { disputes, orders, actions } = useAppStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const rank = (s: string) => s === "OPEN" ? 0 : s === "UNDER_REVIEW" ? 1 : s === "ESCALATED" ? 2 : 10;
    return [...disputes].sort((a, b) => rank(a.status) - rank(b.status));
  }, [disputes]);

  const selected = sorted.find((d) => d.id === selectedId);
  const order = selected ? orders.find((o) => o.id === selected.orderId) : undefined;

  // SLA
  const slaDeadline = selected?.slaDeadline ? Date.parse(selected.slaDeadline) : null;
  const slaLeft = slaDeadline && selected?.status !== "CLOSED" ? Math.max(0, slaDeadline - Date.now()) : null;
  const slaBreached = slaDeadline !== null && selected?.status !== "CLOSED" && Date.now() > slaDeadline;
  const slaHours = slaLeft ? Math.floor(slaLeft / 3600000) : 0;

  return (
    <AdminLayout>
      <div className="flex h-full">
        {/* Sidebar — dispute list */}
        <div className="w-80 border-r border-gray-200 overflow-y-auto bg-gray-50">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Споры</h2>
            <p className="text-sm text-gray-500">{disputes.filter(d => d.status === "OPEN" || d.status === "UNDER_REVIEW").length} открытых</p>
          </div>
          {sorted.map((d) => {
            const o = orders.find((x) => x.id === d.orderId);
            const isOver = d.slaDeadline && d.status !== "CLOSED" && Date.now() > Date.parse(d.slaDeadline);
            return (
              <button key={d.id} onClick={() => setSelectedId(d.id)} className={`w-full text-left p-4 border-b border-gray-100 hover:bg-white transition ${selectedId === d.id ? "bg-white shadow-sm" : ""}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2 h-2 rounded-full ${d.status === "OPEN" ? "bg-red-500" : d.status === "ESCALATED" ? "bg-amber-500 animate-pulse" : d.status === "CLOSED" ? "bg-gray-400" : "bg-blue-500"}`} />
                  <span className="text-xs font-medium text-gray-500">{d.id}</span>
                  {isOver && <AlertTriangle className="w-3 h-3 text-red-500 ml-auto" />}
                </div>
                <p className="font-medium text-sm text-gray-900 truncate">{d.reason}</p>
                <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                  <span>{DISPUTE_CATEGORY_LABEL[d.category] ?? d.category}</span>
                  <span>•</span>
                  <span>{o?.serviceName ?? d.orderId}</span>
                </div>
                {d.evidence.length > 0 && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                    <Camera className="w-3 h-3" />{d.evidence.filter(e => e.type === "photo").length} фото
                    <MessageSquare className="w-3 h-3 ml-2" />{d.evidence.filter(e => e.type === "text").length} сообщ.
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Main — detail */}
        <div className="flex-1 overflow-y-auto p-6">
          {!selected ? (
            <div className="flex items-center justify-center h-full text-gray-400">Выберите спор из списка</div>
          ) : (
            <div className="max-w-2xl space-y-6">
              {/* Header */}
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-gray-900">{selected.reason}</h2>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${selected.status === "OPEN" ? "bg-red-50 text-red-700" : selected.status === "ESCALATED" ? "bg-amber-50 text-amber-700" : selected.status === "CLOSED" ? "bg-gray-100 text-gray-600" : "bg-blue-50 text-blue-700"}`}>
                    {DISPUTE_STATUS_LABEL[selected.status] ?? selected.status}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1">{selected.description}</p>
                <div className="flex gap-4 mt-2 text-xs text-gray-500">
                  <span>Открыт: {formatDateTime(selected.openedAt)}</span>
                  <span>Заказ: {selected.orderId}</span>
                  {selected.milestoneId && <span>Этап: {selected.milestoneId}</span>}
                </div>
              </div>

              {/* SLA tracker */}
              {selected.status !== "CLOSED" && (
                <Card className={`p-4 ${slaBreached ? "border-red-200 bg-red-50" : "border-gray-100"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700 flex items-center gap-2"><Clock className="w-4 h-4" /> SLA</span>
                    <span className={`text-sm font-semibold ${slaBreached ? "text-red-600" : "text-gray-900"}`}>
                      {slaBreached ? "ПРОСРОЧЕНО" : `${slaHours}ч осталось`}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${slaBreached ? "bg-red-500 w-full" : "bg-teal-500"}`}
                      style={{ width: slaBreached ? "100%" : `${Math.max(5, 100 - (slaHours / 48) * 100)}%` }} />
                  </div>
                </Card>
              )}

              {/* Evidence */}
              {selected.evidence.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Доказательства</h3>
                  <div className="grid grid-cols-3 gap-3">
                    {selected.evidence.map((ev) => (
                      <div key={ev.id} className="rounded-xl border border-gray-200 p-3">
                        {ev.type === "photo" ? (
                          <div className="w-full h-20 rounded-lg bg-gray-100 flex items-center justify-center"><Camera className="w-5 h-5 text-gray-400" /></div>
                        ) : (
                          <p className="text-xs text-gray-700">{ev.text}</p>
                        )}
                        <p className="text-[10px] text-gray-400 mt-1">{ev.uploadedBy} • {formatDateTime(ev.uploadedAt)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Order info */}
              {order && (
                <Card className="p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Заказ</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-gray-500">Услуга:</span> <span className="font-medium">{order.serviceName}</span></div>
                    <div><span className="text-gray-500">Сумма:</span> <span className="font-medium">{formatCurrencyRub(order.totalAmount)}</span></div>
                    <div><span className="text-gray-500">Статус:</span> <span className="font-medium">{order.status}</span></div>
                    <div><span className="text-gray-500">Escrow:</span> <span className="font-medium">{order.escrowStatus}</span></div>
                  </div>
                </Card>
              )}

              {/* Resolution actions */}
              {selected.status !== "CLOSED" && order && (
                <Card className="p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Решение</h3>
                  <div className="flex gap-3">
                    <button onClick={() => actions.resolveDispute(selected.id, { type: "release", summary: "Выплата специалисту" })}
                      className="flex-1 py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700">
                      Выплатить
                    </button>
                    <button onClick={() => actions.resolveDispute(selected.id, { type: "refund", summary: "Возврат заказчику" })}
                      className="flex-1 py-3 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600">
                      Возврат
                    </button>
                    <button onClick={() => {
                      const half = Math.floor(order.totalAmount / 2);
                      actions.resolveDispute(selected.id, { type: "split", customerAmount: half, providerAmount: order.totalAmount - half, summary: "Split 50/50" });
                    }}
                      className="flex-1 py-3 rounded-xl bg-gray-800 text-white text-sm font-semibold hover:bg-gray-900">
                      Split 50/50
                    </button>
                  </div>
                  {selected.status !== "ESCALATED" && (
                    <button onClick={() => actions.escalateDispute(selected.id)}
                      className="w-full mt-3 py-2 rounded-xl border border-amber-300 text-amber-700 text-sm font-medium flex items-center justify-center gap-2 hover:bg-amber-50">
                      <ArrowUpRight className="w-4 h-4" /> Эскалировать
                    </button>
                  )}
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
