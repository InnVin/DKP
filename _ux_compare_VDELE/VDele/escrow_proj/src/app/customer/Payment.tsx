import React, { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { MobileLayout } from "../components/vdele/MobileLayout";
import { Card } from "../components/vdele/Card";
import { Button } from "../components/vdele/Button";
import { CheckCircle2, CreditCard, Shield, Lock } from "lucide-react";
import { useAppStore } from "../store/AppStore";
import type { Service, MilestoneTemplate, Milestone } from "../types";
import { formatCurrencyRub } from "../copy";

type PaymentState = {
  service: Service;
  selectedOptions: Record<string, any>;
  address: string;
  city?: string;
  date: string;
  pricing: {
    basePrice: number;
    options: { name: string; amount: number }[];
    platformFee: number;
    total: number;
  };
  providerId: string;
  isTurnkey?: boolean;
  milestoneTemplates?: MilestoneTemplate[];
};

function genOrderId(): string {
  const y = new Date().getFullYear();
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `ORD-${y}-${rand}`;
}

export default function Payment() {
  const navigate = useNavigate();
  const location = useLocation();
  const { providers, actions } = useAppStore();
  const state = location.state as PaymentState | undefined;

  const provider = useMemo(() => {
    if (!state) return undefined;
    return providers.find((p) => p.id === state.providerId);
  }, [providers, state]);

  const [method, setMethod] = useState<"card">("card");
  const [agree, setAgree] = useState(true);
  const [loading, setLoading] = useState(false);

  if (!state || !provider) {
    return (
      <MobileLayout title="Оплата" onBack={() => navigate(-1)}>
        <div className="p-6 text-center text-gray-600">Нет данных для оплаты</div>
      </MobileLayout>
    );
  }

  const policy = state.service.policy;

  const pay = async () => {
    if (!agree) return;
    setLoading(true);
    // demo delay
    await new Promise((r) => setTimeout(r, 650));

    const orderId = genOrderId();
    const isTurnkey = state.isTurnkey ?? false;
    const providerPayout = state.pricing.total - state.pricing.platformFee;

    // Build milestones from templates if turnkey
    const milestones: Milestone[] = isTurnkey && state.milestoneTemplates?.length
      ? state.milestoneTemplates.map((t, i) => ({
          id: `${orderId}-ms-${i + 1}`,
          orderId,
          seq: i + 1,
          name: t.name,
          description: t.description,
          percent: t.percentSuggested,
          amount: Math.round(providerPayout * t.percentSuggested),
          status: "NOT_FUNDED" as const,
          dependsOnPrevious: true,
          createdAt: new Date().toISOString(),
          photos: [],
          checklist: t.checklistTemplate.map((label, ci) => ({
            id: `${orderId}-ms-${i + 1}-cl-${ci}`,
            label,
            checked: false,
          })),
        }))
      : [];

    actions.createOrder({
      id: orderId,
      customerId: "c1",
      providerId: provider.id,
      provider,
      serviceId: state.service.id,
      serviceName: state.service.name,
      totalAmount: state.pricing.total,
      breakdown: {
        basePrice: state.pricing.basePrice,
        options: state.pricing.options,
        platformFee: state.pricing.platformFee,
      },
      address: state.address,
      city: state.city ?? "Якутск",
      scheduledDate: state.date,
      policy,
      isTurnkey,
      milestones,
    } as any);

    actions.fundOrder(orderId);
    // In this flow user chooses a specialist first: auto-assign instantly.
    actions.acceptOrder(orderId, provider.id);

    setLoading(false);
    navigate(`/customer/orders/${orderId}`);
  };

  return (
    <MobileLayout
      title="Оплата"
      onBack={() => navigate(-1)}
      headerVariant="dark"
      bottomBar={
        <Button
          variant="primary"
          className="w-full"
          onClick={pay}
          disabled={!agree || loading}
        >
          {loading ? "Оплата…" : `Оплатить ${formatCurrencyRub(state.pricing.total)}`}
        </Button>
      }
    >
      <div className="p-4 space-y-4">
        <Card className="p-4 bg-gradient-to-b from-[#0B1220] to-[#111827] text-white border border-white/10">
          <div className="text-white/70 text-sm">К оплате</div>
          <div className="text-2xl font-bold mt-1 text-[#2DD4BF]">{formatCurrencyRub(state.pricing.total)}</div>
          <div className="mt-3 flex items-center gap-2 text-sm text-white/70">
            <Shield className="w-4 h-4" />
            <span>Escrow: средства удерживаются до подтверждения</span>
          </div>
        </Card>

        <Card className="p-4">
          <div className="font-semibold text-gray-900 mb-3">Способ оплаты</div>
          <button
            className={`w-full text-left p-4 rounded-[18px] border transition-all ${
              method === "card" ? "border-[#14B8A6] bg-[#14B8A6]/5" : "border-gray-200"
            }`}
            onClick={() => setMethod("card")}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CreditCard className="w-5 h-5 text-[#0F766E]" />
                <div>
                  <div className="font-medium text-gray-900">Банковская карта</div>
                  <div className="text-sm text-gray-600">•••• 4242</div>
                </div>
              </div>
              {method === "card" && <CheckCircle2 className="w-5 h-5 text-[#14B8A6]" />}
            </div>
          </button>
        </Card>

        <Card className="p-4 border border-[#14B8A6]/25 bg-[#14B8A6]/5">
          <div className="flex items-start gap-3">
            <Lock className="w-5 h-5 text-[#14B8A6] mt-0.5" />
            <div>
              <div className="font-semibold text-gray-900">Правила</div>
              <div className="text-sm text-gray-700 mt-1 space-y-1">
                <div>• Отмена без комиссии: {policy.cancelWindowMinutes} мин после оплаты (до назначения).</div>
                <div>• Спор: в течение {policy.disputeWindowHours} ч после отметки «выполнено».</div>
                <div>• Без автовыплаты: если нет действий {policy.autoReleaseHours} ч — заказ передаётся в поддержку для ручного разрешения.</div>
              </div>
            </div>
          </div>
        </Card>

        <label className="flex items-start gap-3 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
            className="mt-1"
          />
          <span>
            Я принимаю условия оферты и политику обработки персональных данных. Оплата будет удержана на номинальном счёте банка до моего подтверждения качества работ.
          </span>
        </label>
      </div>
    </MobileLayout>
  );
}
