import React, { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { MobileLayout } from "../components/vdele/MobileLayout";
import { Card } from "../components/vdele/Card";
import { Button } from "../components/vdele/Button";
import { useAppStore } from "../store/AppStore";
import type { Service } from "../types";
import { matchProviders, type ProviderMatch } from "../matching";
import { formatDateTime } from "../copy";
import { Star, MapPin, Clock, ShieldCheck, ChevronRight } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "../components/ui/sheet";

type DraftState = {
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
};

type SortKey = "recommended" | "rating" | "distance" | "earliest";

function sortMatches(matches: ProviderMatch[], key: SortKey): ProviderMatch[] {
  const m = [...matches];
  if (key === "recommended") return m;
  if (key === "rating") return m.sort((a, b) => b.provider.rating - a.provider.rating);
  if (key === "distance") return m.sort((a, b) => a.distanceKm - b.distanceKm);
  if (key === "earliest")
    return m.sort(
      (a, b) =>
        (a.earliestSlot ? Date.parse(a.earliestSlot) : Number.POSITIVE_INFINITY) -
        (b.earliestSlot ? Date.parse(b.earliestSlot) : Number.POSITIVE_INFINITY)
    );
  return m;
}

export default function SpecialistPicker() {
  const navigate = useNavigate();
  const location = useLocation();
  const { providers } = useAppStore();
  const state = location.state as DraftState | undefined;

  const [sortKey, setSortKey] = useState<SortKey>("recommended");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [active, setActive] = useState<ProviderMatch | null>(null);

  if (!state) {
    return (
      <MobileLayout title="Выбор специалиста" onBack={() => navigate(-1)}>
        <div className="p-6 text-center text-gray-600">Нет данных для подбора</div>
      </MobileLayout>
    );
  }

  const city = state.city ?? (state.address.includes("Москва") ? "Москва" : undefined);

  const baseMatches = useMemo(() => {
    return matchProviders({
      providers,
      service: state.service,
      city,
      scheduledIso: state.date,
      requireVerified: false,
    });
  }, [providers, state.service, state.date, city]);

  const matches = useMemo(() => sortMatches(baseMatches, sortKey), [baseMatches, sortKey]);

  return (
    <MobileLayout
      title="Выбор специалиста"
      onBack={() => navigate(-1)}
      headerVariant="dark"
      bottomBar={
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => navigate(-1)}
        >
          Изменить параметры
        </Button>
      }
    >
      <div className="p-4 space-y-4">
        <Card className="p-4 bg-gradient-to-b from-[#0B1220] to-[#111827] text-white border border-white/10">
          <div className="text-white/70 text-sm">Услуга</div>
          <div className="text-lg font-semibold">{state.service.name}</div>
          <div className="mt-3 flex items-center gap-2 text-xs text-white/70">
            <MapPin className="w-4 h-4" />
            <span>{city ?? "Город не выбран"}</span>
            <span className="opacity-40">•</span>
            <Clock className="w-4 h-4" />
            <span>{formatDateTime(state.date)}</span>
          </div>
        </Card>

        {/* Sort chips */}
        <div className="flex gap-2 overflow-auto pb-1">
          {(
            [
              { key: "recommended", label: "Рекомендуемые" },
              { key: "rating", label: "Рейтинг" },
              { key: "distance", label: "Рядом" },
              { key: "earliest", label: "Ближайшее время" },
            ] as const
          ).map((x) => (
            <button
              key={x.key}
              onClick={() => setSortKey(x.key)}
              className={`px-3 py-2 rounded-full text-sm whitespace-nowrap border transition-all ${
                sortKey === x.key
                  ? "bg-[#14B8A6]/15 border-[#14B8A6]/60 text-[#0F766E]"
                  : "bg-white border-gray-200 text-gray-700"
              }`}
            >
              {x.label}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="space-y-3">
          {matches.length === 0 && (
            <Card className="p-5 text-center text-gray-600">
              Пока нет специалистов под эту услугу в выбранном городе.
            </Card>
          )}
          {matches.map((m) => (
            <Card key={m.provider.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-semibold text-gray-900 truncate">{m.provider.name}</div>
                    {m.provider.verified && (
                      <span className="inline-flex items-center gap-1 text-xs text-[#14B8A6]">
                        <ShieldCheck className="w-4 h-4" />
                        Проверен
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                    <Star className="w-4 h-4 text-[#14B8A6]" />
                    <span className="font-medium text-gray-800">{m.provider.rating.toFixed(1)}</span>
                    <span className="text-gray-400">•</span>
                    <span>{m.provider.reviewCount} отзывов</span>
                    <span className="text-gray-400">•</span>
                    <span>{m.distanceKm.toFixed(1)} км</span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {m.matchReasons.map((r) => (
                      <span
                        key={r}
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-[#14B8A6]/10 text-[#0F766E]"
                      >
                        {r}
                      </span>
                    ))}
                  </div>

                  <div className="mt-3 text-sm text-gray-700">
                    Ближайшее время: {m.earliestSlot ? formatDateTime(m.earliestSlot) : "нет слотов"}
                  </div>
                </div>

                <div className="flex flex-col gap-2 items-end">
                  <button
                    className="text-sm text-gray-600 hover:text-gray-900 inline-flex items-center gap-1"
                    onClick={() => {
                      setActive(m);
                      setSheetOpen(true);
                    }}
                  >
                    Профиль <ChevronRight className="w-4 h-4" />
                  </button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      navigate("/customer/review", {
                        state: { ...state, providerId: m.provider.id },
                      });
                    }}
                  >
                    Выбрать
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-[24px]">
          <SheetHeader>
            <SheetTitle>Профиль специалиста</SheetTitle>
          </SheetHeader>
          {active && (
            <div className="mt-4 space-y-4">
              <div>
                <div className="text-lg font-semibold">{active.provider.name}</div>
                <div className="text-sm text-gray-600 mt-1">
                  {active.provider.specializations.join(" • ")}
                </div>
                <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
                  <Star className="w-4 h-4 text-[#14B8A6]" />
                  <span className="font-medium text-gray-900">{active.provider.rating.toFixed(1)}</span>
                  <span className="text-gray-400">•</span>
                  <span>{active.provider.reviewCount} отзывов</span>
                  <span className="text-gray-400">•</span>
                  <span>{active.distanceKm.toFixed(1)} км</span>
                </div>
              </div>

              <Card className="p-4 bg-[#14B8A6]/5 border border-[#14B8A6]/20">
                <div className="text-sm text-gray-700">
                  Ближайшее время: <span className="font-medium">{active.earliestSlot ? formatDateTime(active.earliestSlot) : "нет слотов"}</span>
                </div>
              </Card>

              <div>
                <div className="font-semibold text-gray-900 mb-2">Портфолио</div>
                <div className="grid grid-cols-2 gap-2">
                  {(active.provider.portfolio ?? []).slice(0, 4).map((p) => (
                    <div
                      key={p.id}
                      className="rounded-[16px] bg-gradient-to-br from-[#0B1220] to-[#111827] text-white p-3 border border-white/10"
                    >
                      <div className="text-xs text-white/70">Работа</div>
                      <div className="text-sm font-medium mt-1">{p.title ?? ""}</div>
                    </div>
                  ))}
                  {(active.provider.portfolio ?? []).length === 0 && (
                    <div className="text-sm text-gray-600">Портфолио не добавлено</div>
                  )}
                </div>
              </div>

              <Button
                variant="primary"
                className="w-full"
                onClick={() => {
                  setSheetOpen(false);
                  navigate("/customer/review", {
                    state: { ...state, providerId: active.provider.id },
                  });
                }}
              >
                Выбрать специалиста
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </MobileLayout>
  );
}
