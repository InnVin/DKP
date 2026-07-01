import React, { useMemo } from "react";
import { useLocation, useNavigate } from "react-router";
import { MobileLayout } from "../components/vdele/MobileLayout";
import { Card } from "../components/vdele/Card";
import { Button } from "../components/vdele/Button";
import { Shield, MapPin, Calendar, Star, ChevronRight } from "lucide-react";
import { useAppStore } from "../store/AppStore";
import type { Service } from "../types";
import { formatCurrencyRub, formatDateTime } from "../copy";
import { computeDistanceKm, findEarliestSlot } from "../matching";

type ReviewState = {
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
};

export default function Review() {
  const navigate = useNavigate();
  const location = useLocation();
  const { providers } = useAppStore();
  const state = location.state as ReviewState | undefined;

  const provider = useMemo(() => {
    if (!state) return undefined;
    return providers.find((p) => p.id === state.providerId);
  }, [providers, state]);

  if (!state || !provider) {
    return (
      <MobileLayout title="Проверка" onBack={() => navigate(-1)}>
        <div className="p-6 text-center text-gray-600">Нет данных для оформления</div>
      </MobileLayout>
    );
  }

  const city = state.city ?? (state.address.includes("Москва") ? "Москва" : undefined);
  const distanceKm = computeDistanceKm(provider);
  const earliest = findEarliestSlot(provider, state.date);

  return (
    <MobileLayout
      title="Проверим детали"
      onBack={() => navigate(-1)}
      headerVariant="dark"
      bottomBar={
        <Button
          variant="primary"
          className="w-full"
          onClick={() => navigate("/customer/payment", { state })}
        >
          Перейти к оплате
        </Button>
      }
    >
      <div className="p-4 space-y-4">
        <Card className="p-4 bg-gradient-to-b from-[#0B1220] to-[#111827] text-white border border-white/10">
          <div className="text-white/70 text-sm">Услуга</div>
          <div className="text-lg font-semibold">{state.service.name}</div>
          <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-white/75">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              <span className="truncate">{state.address}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>{formatDateTime(state.date)}</span>
              {city && <span className="opacity-50">•</span>}
              {city && <span>{city}</span>}
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="font-semibold text-gray-900">Специалист</div>
          <div className="mt-3 flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold text-gray-900">{provider.name}</div>
              <div className="text-sm text-gray-600 mt-1">{provider.specializations.join(" • ")}</div>
              <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
                <Star className="w-4 h-4 text-[#14B8A6]" />
                <span className="font-medium text-gray-900">{provider.rating.toFixed(1)}</span>
                <span className="text-gray-400">•</span>
                <span>{provider.reviewCount} отзывов</span>
                <span className="text-gray-400">•</span>
                <span>{distanceKm.toFixed(1)} км</span>
              </div>
              <div className="mt-2 text-sm text-gray-700">
                Ближайшее время: <span className="font-medium">{earliest ? formatDateTime(earliest) : "нет слотов"}</span>
              </div>
            </div>
            <button
              className="text-sm text-gray-600 hover:text-gray-900 inline-flex items-center gap-1"
              onClick={() => navigate("/customer/pick-specialist", { state })}
            >
              Сменить <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </Card>

        <Card className="p-4">
          <div className="font-semibold text-gray-900 mb-3">Стоимость</div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Базовая работа</span>
              <span className="font-medium">{formatCurrencyRub(state.pricing.basePrice)}</span>
            </div>
            {state.pricing.options.map((op, idx) => (
              <div className="flex justify-between" key={idx}>
                <span className="text-gray-600">{op.name}</span>
                <span className="font-medium">{formatCurrencyRub(op.amount)}</span>
              </div>
            ))}
            <div className="flex justify-between">
              <span className="text-gray-600">Сервисный сбор (безопасная сделка)</span>
              <span className="font-medium">{formatCurrencyRub(state.pricing.platformFee)}</span>
            </div>
            <div className="pt-2 border-t border-gray-200 flex justify-between">
              <span className="font-semibold">Итого</span>
              <span className="text-xl font-bold text-[#14B8A6]">{formatCurrencyRub(state.pricing.total)}</span>
            </div>
          </div>
        </Card>

        {state.isTurnkey && state.milestoneTemplates?.length > 0 && (
          <Card className="p-4 border border-violet-200/50 bg-violet-50/50">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center">
                <span className="text-sm">📋</span>
              </div>
              <div>
                <div className="font-semibold text-gray-900">Поэтапная оплата</div>
                <div className="text-sm text-gray-600 mt-1">
                  {state.milestoneTemplates.length} этапов. Оплата в escrow за каждый этап отдельно.
                </div>
              </div>
            </div>
          </Card>
        )}

        <Card className="p-4 border border-[#14B8A6]/25 bg-[#14B8A6]/5">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-[#14B8A6] mt-0.5" />
            <div>
              <div className="font-semibold text-gray-900">Оплата под защитой</div>
              <div className="text-sm text-gray-700 mt-1">
                Средства удерживаются до подтверждения выполнения. В споре — замораживаются.
              </div>
            </div>
          </div>
        </Card>
      </div>
    </MobileLayout>
  );
}
