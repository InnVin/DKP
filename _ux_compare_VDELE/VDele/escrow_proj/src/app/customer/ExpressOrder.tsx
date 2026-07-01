import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { MobileLayout } from "../components/vdele/MobileLayout";
import { Card } from "../components/vdele/Card";
import { Button } from "../components/vdele/Button";
import { Input } from "../components/vdele/Input";
import { useAppStore } from "../store/AppStore";
import { MapPin, Calendar, Zap, ArrowRight, Shield } from "lucide-react";
import { LAUNCH_CITY } from "../config";
import { computePlatformFee } from "../pricing";

// Quick service categories for express flow
const EXPRESS_SERVICES = [
  { id: "plumbing-quick", icon: "🚿", name: "Сантехник", desc: "Течь, засор, замена", avgPrice: 4500 },
  { id: "electric-quick", icon: "⚡", name: "Электрик", desc: "Розетки, свет, щиток", avgPrice: 3500 },
  { id: "repair-quick", icon: "🔧", name: "Мастер на час", desc: "Мелкий ремонт, сборка", avgPrice: 3000 },
  { id: "cleaning-quick", icon: "🧹", name: "Уборка", desc: "Генеральная, после ремонта", avgPrice: 5000 },
];

export default function ExpressOrder() {
  const navigate = useNavigate();
  const { services, categories } = useAppStore();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [problem, setProblem] = useState("");
  const [address, setAddress] = useState("");
  const [date, setDate] = useState("");
  const [urgent, setUrgent] = useState(false);

  const selectedService = EXPRESS_SERVICES.find(s => s.id === selected);

  // Find matching real service in catalog
  const realService = useMemo(() => {
    if (!selected) return null;
    const catId = selected.split("-")[0];
    return services.find(s => s.categoryId === catId && s.published);
  }, [selected, services]);

  const pricing = useMemo(() => {
    if (!selectedService) return null;
    const base = selectedService.avgPrice;
    const fee = computePlatformFee(base, LAUNCH_CITY);
    return { base, fee, total: base + fee };
  }, [selectedService]);

  return (
    <MobileLayout
      title="Быстрый заказ"
      onBack={() => step > 1 ? setStep((step - 1) as any) : navigate(-1)}
      bottomBar={
        step === 1 && selected ? (
          <Button variant="primary" className="w-full" onClick={() => setStep(2)}>
            Далее <ArrowRight className="w-4 h-4 inline ml-1" />
          </Button>
        ) : step === 2 && address ? (
          <Button variant="primary" className="w-full" onClick={() => setStep(3)}>
            Далее <ArrowRight className="w-4 h-4 inline ml-1" />
          </Button>
        ) : step === 3 && realService ? (
          <div>
            {pricing && (
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm text-gray-500">Ориентировочно</span>
                <span className="text-xl font-bold text-[#14B8A6]">{pricing.total.toLocaleString("ru-RU")} ₽</span>
              </div>
            )}
            <Button
              variant="primary"
              className="w-full"
              onClick={() => {
                navigate(`/customer/service/${realService.id}`);
              }}
            >
              Найти мастера
            </Button>
          </div>
        ) : null
      }
    >
      <div className="p-4">
        {/* Progress */}
        <div className="flex gap-2 mb-5">
          {[1, 2, 3].map(s => (
            <div key={s} className={`h-1 flex-1 rounded-full transition-all ${s <= step ? "bg-[#14B8A6]" : "bg-gray-200"}`} />
          ))}
        </div>

        {/* Step 1: What */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-5 h-5 text-[#14B8A6]" />
                <h2 className="text-lg font-bold text-gray-900">Что нужно сделать?</h2>
              </div>
              <p className="text-sm text-gray-500">Выберите категорию — мы подберём мастера</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {EXPRESS_SERVICES.map(svc => (
                <button
                  key={svc.id}
                  onClick={() => setSelected(svc.id)}
                  className={`text-left p-4 rounded-2xl border-2 transition-all ${
                    selected === svc.id
                      ? "border-[#14B8A6] bg-[#F0FDFA]"
                      : "border-gray-100 bg-white active:border-[#14B8A6]/30"
                  }`}
                >
                  <div className="text-2xl mb-2">{svc.icon}</div>
                  <div className="font-semibold text-gray-900 text-sm">{svc.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{svc.desc}</div>
                  <div className="text-xs font-semibold text-[#14B8A6] mt-2">
                    от {svc.avgPrice.toLocaleString("ru-RU")} ₽
                  </div>
                </button>
              ))}
            </div>

            {selected && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Опишите проблему</label>
                <textarea
                  value={problem}
                  onChange={e => setProblem(e.target.value)}
                  placeholder="Например: течёт кран на кухне, нужна замена..."
                  className="w-full h-24 p-3 rounded-xl border border-gray-200 text-sm resize-none focus:outline-none focus:border-[#14B8A6] focus:ring-1 focus:ring-[#14B8A6]/30"
                />
              </div>
            )}
          </div>
        )}

        {/* Step 2: Where & When */}
        {step === 2 && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold text-gray-900">Куда и когда?</h2>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <MapPin className="w-4 h-4 inline mr-1" />Адрес
              </label>
              <Input placeholder="Улица, дом, квартира" value={address} onChange={e => setAddress(e.target.value)} />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />Когда удобно?
              </label>
              <Input type="datetime-local" value={date} onChange={e => setDate(e.target.value)} />
            </div>

            <button
              onClick={() => setUrgent(!urgent)}
              className={`w-full p-4 rounded-2xl border-2 flex items-center gap-3 transition-all ${
                urgent ? "border-amber-400 bg-amber-50" : "border-gray-100 bg-white"
              }`}
            >
              <Zap className={`w-5 h-5 ${urgent ? "text-amber-500" : "text-gray-400"}`} />
              <div className="text-left">
                <div className="font-semibold text-sm text-gray-900">Срочный вызов</div>
                <div className="text-xs text-gray-500">Мастер приедет в течение 2 часов</div>
              </div>
            </button>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === 3 && selectedService && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Подтвердите заказ</h2>

            <div className="bg-white rounded-2xl p-4 border border-gray-100 space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{selectedService.icon}</span>
                <div>
                  <div className="font-semibold text-gray-900">{selectedService.name}</div>
                  {problem && <div className="text-xs text-gray-500 mt-0.5">{problem}</div>}
                </div>
              </div>
              <div className="pt-3 border-t border-gray-50 space-y-2 text-sm">
                <div className="flex items-center gap-2 text-gray-600">
                  <MapPin className="w-4 h-4 text-gray-400" />{address}
                </div>
                {date && (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Calendar className="w-4 h-4 text-gray-400" />{new Date(date).toLocaleString("ru-RU")}
                  </div>
                )}
                {urgent && (
                  <div className="flex items-center gap-2 text-amber-600 font-medium">
                    <Zap className="w-4 h-4" />Срочный вызов
                  </div>
                )}
              </div>
            </div>

            {/* Escrow trust banner */}
            <div className="bg-[#F0FDFA] rounded-2xl p-4 border border-[#14B8A6]/15">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-[#14B8A6] mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-semibold text-gray-900 text-sm">Безопасная сделка</div>
                  <div className="text-xs text-gray-600 mt-1 leading-relaxed">
                    Деньги удерживаются на номинальном счёте банка до вашего подтверждения. Мастер получит оплату только после приёмки работ.
                  </div>
                </div>
              </div>
            </div>

            {/* Legal consent */}
            <div className="text-[11px] text-gray-400 leading-relaxed">
              Нажимая «Найти мастера», вы принимаете{" "}
              <button onClick={() => navigate("/customer/legal")} className="text-[#14B8A6] underline">условия оферты</button>
              {" "}и{" "}
              <button onClick={() => navigate("/customer/legal")} className="text-[#14B8A6] underline">политику обработки данных</button>.
              Платформа «В Деле» является информационным посредником (ст. 1253.1 ГК РФ).
            </div>
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
