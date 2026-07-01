import React from 'react';
import { useNavigate, useLocation } from 'react-router';
import { MobileLayout } from '../components/vdele/MobileLayout';
import { Card } from '../components/vdele/Card';
import { Button } from '../components/vdele/Button';
import { Shield, Info, Ruler, MapPin, Calendar } from 'lucide-react';
import { formatDateTime } from '../copy';
import type { Service, MilestoneTemplate } from '../types';

type QuoteState = {
  service: Service;
  selectedOptions: Record<string, any>;
  city?: string;
  address: string;
  date: string;
  pricing: {
    basePrice: number;
    options: { name: string; amount: number }[];
    platformFee: number;
    total: number;
  };
  isTurnkey?: boolean;
  milestoneTemplates?: MilestoneTemplate[];
};

export default function Quote() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as QuoteState | undefined;

  if (!state) {
    return (
      <MobileLayout title="Расчёт" onBack={() => navigate(-1)}>
        <div className="p-6 text-center text-gray-500">Нет данных для расчёта</div>
      </MobileLayout>
    );
  }

  const isRenovation = !!state.selectedOptions?.renovationType;
  const sqm = state.selectedOptions?.sqm;
  const RENO_LABELS: Record<string, string> = { cosmetic: "Косметический", euro: "Евроремонт", designer: "Дизайнерский" };

  return (
    <MobileLayout title="Расчёт стоимости" onBack={() => navigate(-1)} headerVariant="dark">
      <div className="p-4 space-y-4">
        {/* Summary card */}
        <div className="bg-gradient-to-b from-[#0B1220] to-[#111827] rounded-2xl p-4 text-white border border-white/5">
          <div className="text-lg font-semibold">{state.service.name}</div>

          {isRenovation && (
            <div className="flex gap-3 mt-3">
              <div className="flex-1 bg-white/5 rounded-xl px-3 py-2">
                <div className="text-[10px] text-white/40">Тип</div>
                <div className="text-sm font-medium">{RENO_LABELS[state.selectedOptions.renovationType] ?? ""}</div>
              </div>
              <div className="flex-1 bg-white/5 rounded-xl px-3 py-2">
                <div className="text-[10px] text-white/40">Площадь</div>
                <div className="text-sm font-medium flex items-center gap-1"><Ruler className="w-3.5 h-3.5 text-teal-400" />{sqm} м²</div>
              </div>
            </div>
          )}

          <div className="flex gap-3 mt-2">
            <div className="flex-1 bg-white/5 rounded-xl px-3 py-2">
              <div className="text-[10px] text-white/40">Адрес</div>
              <div className="text-sm flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-teal-400" /><span className="truncate">{state.address}</span></div>
            </div>
          </div>
          <div className="mt-2 bg-white/5 rounded-xl px-3 py-2">
            <div className="text-[10px] text-white/40">Дата начала</div>
            <div className="text-sm flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-teal-400" />{formatDateTime(state.date)}</div>
          </div>
        </div>

        {/* Price breakdown */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          <div className="font-semibold text-gray-900 mb-3">Стоимость</div>
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Работы</span>
              <span className="font-medium">{state.pricing.basePrice.toLocaleString('ru-RU')} ₽</span>
            </div>
            {state.pricing.options.filter(o => o.amount !== 0).map((op, idx) => (
              <div className="flex justify-between" key={idx}>
                <span className="text-gray-500">{op.name}</span>
                <span className="font-medium">+{op.amount.toLocaleString('ru-RU')} ₽</span>
              </div>
            ))}
            <div className="flex justify-between">
              <span className="text-gray-500">Сервисный сбор</span>
              <span className="font-medium">{state.pricing.platformFee.toLocaleString('ru-RU')} ₽</span>
            </div>
            <div className="pt-3 border-t border-gray-100 flex justify-between items-end">
              <span className="font-semibold text-gray-900">Итого</span>
              <span className="text-2xl font-bold text-[#14B8A6]">{state.pricing.total.toLocaleString('ru-RU')} ₽</span>
            </div>
          </div>
        </div>

        {/* Milestone preview for turnkey */}
        {state.isTurnkey && state.milestoneTemplates && state.milestoneTemplates.length > 0 && (
          <div className="bg-white rounded-2xl p-4 border border-gray-100">
            <div className="font-semibold text-gray-900 mb-1">Поэтапная оплата</div>
            <div className="text-xs text-gray-500 mb-3">{state.milestoneTemplates.length} этапов, каждый через escrow</div>
            {state.milestoneTemplates.map((t, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
                <div className="w-6 h-6 rounded-full bg-[#14B8A6]/10 text-[#0F766E] flex items-center justify-center text-xs font-bold">{i+1}</div>
                <div className="flex-1 text-sm text-gray-700">{t.name}</div>
                <div className="text-sm font-semibold text-[#0F766E]">
                  {Math.round(state.pricing.basePrice * t.percentSuggested).toLocaleString('ru-RU')} ₽
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Escrow shield */}
        <div className="bg-[#F0FDFA] rounded-2xl p-4 border border-[#14B8A6]/15">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-[#14B8A6] mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-semibold text-gray-900 text-sm">Escrow защита</div>
              <div className="text-xs text-gray-600 mt-1 leading-relaxed">
                Оплата удерживается до подтверждения. В споре средства замораживаются до решения модератора.
              </div>
            </div>
          </div>
        </div>

        <Button
          variant="primary"
          className="w-full"
          onClick={() => navigate('/customer/pick-specialist', { state })}
        >
          Выбрать специалиста
        </Button>

        <div className="flex items-start gap-2 text-[11px] text-gray-400 pb-2">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>Подбор по навыкам, рейтингу и дистанции. Далее — оплата через escrow.</span>
        </div>
      </div>
    </MobileLayout>
  );
}
