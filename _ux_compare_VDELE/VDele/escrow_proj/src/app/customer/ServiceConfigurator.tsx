import React, { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router';
import { MobileLayout } from '../components/vdele/MobileLayout';
import { Card } from '../components/vdele/Card';
import { Input } from '../components/vdele/Input';
import { Button } from '../components/vdele/Button';
import { useAppStore } from '../store/AppStore';
import { Calendar, MapPin, Ruler, Home, Sparkles, Crown, ChevronDown, ChevronUp, CheckCircle2, Check, Plus, Minus } from 'lucide-react';
import { LAUNCH_CITY } from '../config';
import type { MilestoneTemplate } from '../types';
import { computePlatformFee } from '../pricing';

const PRICE_PER_SQM: Record<string, { label: string; price: number; desc: string; icon: React.ReactNode; examples: string[] }> = {
  cosmetic: { label: "Косметический", price: 5500, desc: "Обои, покраска, замена напольного покрытия",
    icon: <Home className="w-5 h-5" />,
    examples: ["Поклейка обоев", "Покраска стен и потолков", "Укладка ламината", "Замена плинтусов", "Установка дверей"] },
  euro: { label: "Евроремонт", price: 12000, desc: "Выравнивание стен, стяжка, плитка, электрика",
    icon: <Sparkles className="w-5 h-5" />,
    examples: ["Штукатурка и выравнивание", "Стяжка пола", "Укладка плитки", "Замена электропроводки", "Натяжные потолки", "Тёплый пол"] },
  designer: { label: "Дизайнерский", price: 22000, desc: "Авторский проект, премиум-материалы",
    icon: <Crown className="w-5 h-5" />,
    examples: ["Дизайн-проект", "3D визуализация", "Декоративная штукатурка", "Скрытые системы хранения", "Умный дом"] },
};

// Default milestone configurations with toggleable checklist items
// Each checklist item has a price per sqm modifier
type CheckItem = { label: string; default: boolean; pricePerSqm: number };
type MilestoneConfig = { name: string; desc: string; pct: number; checklist: CheckItem[] };

const DEFAULT_MILESTONES: MilestoneConfig[] = [
  { name: "Демонтаж", desc: "Снос перегородок, демонтаж старых покрытий", pct: 0.15, checklist: [
    { label: "Демонтаж стен/перегородок", default: true, pricePerSqm: 350 },
    { label: "Снятие старой плитки", default: true, pricePerSqm: 250 },
    { label: "Демонтаж напольного покрытия", default: true, pricePerSqm: 200 },
    { label: "Демонтаж старой сантехники", default: false, pricePerSqm: 180 },
    { label: "Снос подоконников", default: false, pricePerSqm: 120 },
    { label: "Вывоз строительного мусора", default: true, pricePerSqm: 300 },
  ]},
  { name: "Черновая отделка", desc: "Штукатурка, стяжка, коммуникации", pct: 0.35, checklist: [
    { label: "Стяжка пола", default: true, pricePerSqm: 850 },
    { label: "Штукатурка стен", default: true, pricePerSqm: 750 },
    { label: "Электропроводка по проекту", default: true, pricePerSqm: 600 },
    { label: "Водоснабжение и канализация", default: true, pricePerSqm: 500 },
    { label: "Гидроизоляция санузла", default: true, pricePerSqm: 400 },
    { label: "Разводка отопления", default: false, pricePerSqm: 550 },
    { label: "Вентиляция / кондиционирование", default: false, pricePerSqm: 700 },
    { label: "Монтаж тёплого пола", default: false, pricePerSqm: 900 },
  ]},
  { name: "Чистовая отделка", desc: "Финишные покрытия, плитка, краска", pct: 0.30, checklist: [
    { label: "Укладка плитки в санузле", default: true, pricePerSqm: 800 },
    { label: "Покраска / обои стен", default: true, pricePerSqm: 450 },
    { label: "Укладка напольного покрытия", default: true, pricePerSqm: 650 },
    { label: "Монтаж потолков", default: true, pricePerSqm: 500 },
    { label: "Фартук кухни", default: false, pricePerSqm: 350 },
    { label: "Декоративная штукатурка", default: false, pricePerSqm: 1200 },
    { label: "Затирка швов", default: true, pricePerSqm: 150 },
  ]},
  { name: "Финальный этап", desc: "Двери, сантехника, мебель, уборка", pct: 0.20, checklist: [
    { label: "Установка дверей", default: true, pricePerSqm: 400 },
    { label: "Подключение сантехники", default: true, pricePerSqm: 350 },
    { label: "Установка розеток и выключателей", default: true, pricePerSqm: 250 },
    { label: "Монтаж светильников", default: true, pricePerSqm: 200 },
    { label: "Установка карнизов / жалюзи", default: false, pricePerSqm: 150 },
    { label: "Сборка мебели", default: false, pricePerSqm: 500 },
    { label: "Финальная уборка", default: true, pricePerSqm: 200 },
    { label: "Акт приёма-передачи", default: true, pricePerSqm: 0 },
  ]},
];

export default function ServiceConfigurator() {
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const { services, categories } = useAppStore();
  const service = services.find(s => s.id === serviceId && s.published);
  
  const [selectedType, setSelectedType] = useState<string>("");
  const [sqm, setSqm] = useState<string>("");
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [city, setCity] = useState(LAUNCH_CITY);
  const [address, setAddress] = useState('');
  const [date, setDate] = useState('');
  const [expandedType, setExpandedType] = useState<string | null>(null);
  
  // Milestone checklist state
  const [milestoneChecks, setMilestoneChecks] = useState<Record<string, boolean[]>>(() => {
    const init: Record<string, boolean[]> = {};
    DEFAULT_MILESTONES.forEach((ms, i) => {
      init[i] = ms.checklist.map(c => c.default);
    });
    return init;
  });
  const [showMilestones, setShowMilestones] = useState(false);
  const [expandedMilestone, setExpandedMilestone] = useState<number | null>(null);

  if (!service) {
    return <MobileLayout title="Услуга" onBack={() => navigate(-1)}>
      <div className="p-6 text-center text-gray-500">Услуга не найдена</div>
    </MobileLayout>;
  }

  const category = categories.find(c => c.id === service.categoryId);
  const isTurnkey = category?.requiresMilestones ?? false;
  const isRenovation = service.categoryId === 'renovation' && service.supportsMilestones;
  const milestoneTemplates = category?.milestoneTemplates ?? [];

  const toggleCheck = (msIdx: number, checkIdx: number) => {
    setMilestoneChecks(prev => ({
      ...prev,
      [msIdx]: prev[msIdx].map((v, i) => i === checkIdx ? !v : v),
    }));
  };

  // Build custom milestoneTemplates from user selections
  const customMilestoneTemplates: MilestoneTemplate[] = useMemo(() => {
    return DEFAULT_MILESTONES.map((ms, i) => ({
      name: ms.name,
      description: ms.desc,
      percentSuggested: ms.pct,
      checklistTemplate: ms.checklist.filter((_, ci) => milestoneChecks[i]?.[ci]).map(c => c.label),
    }));
  }, [milestoneChecks]);

  // Calculate extra cost from selected checklist items
  const checklistExtra = useMemo(() => {
    if (!isRenovation) return 0;
    const area = parseFloat(sqm) || 0;
    if (area <= 0) return 0;
    let extra = 0;
    DEFAULT_MILESTONES.forEach((ms, msIdx) => {
      ms.checklist.forEach((item, ci) => {
        if (milestoneChecks[msIdx]?.[ci] && !item.default) {
          extra += item.pricePerSqm * area;
        }
      });
    });
    return Math.round(extra);
  }, [isRenovation, sqm, milestoneChecks]);

  const pricing = useMemo(() => {
    if (isRenovation) {
      const area = parseFloat(sqm) || 0;
      const typeInfo = PRICE_PER_SQM[selectedType];
      if (!typeInfo || area <= 0) return null;
      const workBase = Math.round(typeInfo.price * area);
      const basePrice = workBase + checklistExtra;
      const platformFee = computePlatformFee(basePrice, city);
      const options: { name: string; amount: number }[] = [
        { name: `${area} м² × ${typeInfo.price.toLocaleString('ru-RU')} ₽/м²`, amount: workBase },
      ];
      if (checklistExtra > 0) {
        options.push({ name: "Доп. работы из чек-листа", amount: checklistExtra });
      }
      return { basePrice, options, platformFee, total: basePrice + platformFee };
    }
    let subtotal = service.basePrice;
    const options: { name: string; amount: number }[] = [];
    service.parameters.forEach(param => {
      if (param.type === 'select' && selectedOptions[param.id]) {
        const opt = param.options?.find(o => o.value === selectedOptions[param.id]);
        if (opt && opt.priceModifier !== 0) { subtotal += opt.priceModifier; options.push({ name: opt.label, amount: opt.priceModifier }); }
      }
    });
    const platformFee = computePlatformFee(subtotal, city);
    return { basePrice: service.basePrice, options, platformFee, total: subtotal + platformFee };
  }, [isRenovation, sqm, selectedType, selectedOptions, service, city, checklistExtra]);

  const canProceed = isRenovation
    ? !!(selectedType && parseFloat(sqm) > 0 && city && address && date)
    : !!(city && address && date);

  const handleNext = () => {
    if (!pricing) return;
    navigate('/customer/quote', {
      state: {
        service, selectedOptions: isRenovation ? { renovationType: selectedType, sqm } : selectedOptions,
        city, address, date, pricing,
        isTurnkey,
        milestoneTemplates: isRenovation ? customMilestoneTemplates : milestoneTemplates,
      }
    });
  };

  const totalChecked = Object.values(milestoneChecks).flat().filter(Boolean).length;
  const totalItems = Object.values(milestoneChecks).flat().length;

  return (
    <MobileLayout
      title={service.name}
      onBack={() => navigate(-1)}
      bottomBar={
        <div>
          {pricing && (
            <div className="flex items-center justify-between mb-2">
              <span className="text-[13px] text-gray-500">Итого</span>
              <span className="text-xl font-bold text-[#14B8A6]">{pricing.total.toLocaleString('ru-RU')} ₽</span>
            </div>
          )}
          <Button variant="primary" className="w-full" onClick={handleNext} disabled={!canProceed}>
            {isRenovation ? "Рассчитать и выбрать мастера" : "Показать цену"}
          </Button>
        </div>
      }
    >
      <div className="p-4 space-y-5">
        <div className="bg-white rounded-2xl p-4 shadow-sm shadow-black/[0.04]">
          <p className="text-[14px] text-gray-500 leading-relaxed">{service.description}</p>
        </div>

        {/* ═══ RENOVATION TYPE + SQM ═══ */}
        {isRenovation && (<>
          <div>
            <label className="block text-[13px] font-semibold text-gray-900 mb-2.5">Тип ремонта</label>
            <div className="space-y-2.5">
              {Object.entries(PRICE_PER_SQM).map(([key, info]) => {
                const sel = selectedType === key;
                const exp = expandedType === key;
                return (
                  <div key={key} className={`rounded-2xl overflow-hidden transition-all shadow-sm ${sel ? 'shadow-[#14B8A6]/20 ring-[1.5px] ring-[#14B8A6]' : 'shadow-black/[0.04]'}`}>
                    <button className="w-full text-left p-4 bg-white" onClick={() => { setSelectedType(key); setExpandedType(exp ? null : key); }}>
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${sel ? 'bg-[#14B8A6] text-white' : 'bg-[#F2F2F7] text-gray-400'}`}>{info.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-[15px] text-gray-900">{info.label}</span>
                            <span className="text-[13px] font-bold text-[#14B8A6]">{info.price.toLocaleString('ru-RU')} ₽/м²</span>
                          </div>
                          <p className="text-[13px] text-gray-400 mt-0.5">{info.desc}</p>
                        </div>
                      </div>
                    </button>
                    {exp && (
                      <div className="px-4 pb-3 bg-white border-t border-gray-50">
                        <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2 pt-2">Что входит</div>
                        <div className="flex flex-wrap gap-1.5">
                          {info.examples.map((ex, i) => (
                            <span key={i} className="text-[12px] text-gray-600 bg-[#F2F2F7] px-2.5 py-1 rounded-lg">{ex}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Square meters */}
          <div>
            <label className="block text-[13px] font-semibold text-gray-900 mb-2">
              <Ruler className="w-4 h-4 inline mr-1.5" />Площадь (м²)
            </label>
            <Input type="number" inputMode="decimal" placeholder="Например: 45" value={sqm} onChange={e => setSqm(e.target.value)} />
            <div className="flex gap-2 mt-2">
              {[30, 45, 60, 80, 100].map(v => (
                <button key={v} onClick={() => setSqm(String(v))}
                  className={`flex-1 py-2 rounded-xl text-[13px] font-medium transition-all ${sqm === String(v) ? 'bg-[#14B8A6] text-white' : 'bg-[#F2F2F7] text-gray-500 active:bg-gray-200'}`}>
                  {v}
                </button>
              ))}
            </div>
            {selectedType && parseFloat(sqm) > 0 && pricing && (
              <div className="mt-2 p-3 rounded-xl bg-[#E6FAF5] space-y-1">
                <div className="flex justify-between items-center text-[13px]">
                  <span className="text-gray-600">{parseFloat(sqm)} м² × {PRICE_PER_SQM[selectedType]?.price.toLocaleString('ru-RU')} ₽</span>
                  <span className="font-semibold text-[#0F766E]">{(pricing.basePrice - checklistExtra).toLocaleString('ru-RU')} ₽</span>
                </div>
                {checklistExtra > 0 && (
                  <div className="flex justify-between items-center text-[13px]">
                    <span className="text-gray-600">+ доп. работы</span>
                    <span className="font-semibold text-[#0F766E]">+{checklistExtra.toLocaleString('ru-RU')} ₽</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-[14px] pt-1 border-t border-[#14B8A6]/20">
                  <span className="font-semibold text-[#0F766E]">Работы</span>
                  <span className="font-bold text-[#0F766E]">{pricing.basePrice.toLocaleString('ru-RU')} ₽</span>
                </div>
              </div>
            )}
          </div>

          {/* ═══ MILESTONE CHECKLIST BUILDER ═══ */}
          <div>
            <button onClick={() => setShowMilestones(!showMilestones)}
              className="w-full flex items-center justify-between py-2">
              <div>
                <div className="text-[13px] font-semibold text-gray-900 text-left">Этапы и чек-лист приёмки</div>
                <div className="text-[12px] text-gray-400 text-left">{totalChecked} из {totalItems} пунктов выбрано • 4 этапа</div>
              </div>
              {showMilestones ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
            </button>

            {showMilestones && (
              <div className="space-y-2 mt-2">
                {DEFAULT_MILESTONES.map((ms, msIdx) => {
                  const isExp = expandedMilestone === msIdx;
                  const checked = milestoneChecks[msIdx]?.filter(Boolean).length ?? 0;
                  const total = ms.checklist.length;
                  return (
                    <div key={msIdx} className="bg-white rounded-2xl overflow-hidden shadow-sm shadow-black/[0.04]">
                      <button onClick={() => setExpandedMilestone(isExp ? null : msIdx)}
                        className="w-full text-left px-4 py-3 flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-[#14B8A6]/10 text-[#0F766E] flex items-center justify-center text-[12px] font-bold flex-shrink-0">
                          {msIdx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[14px] font-semibold text-gray-900">{ms.name}</div>
                          <div className="text-[12px] text-gray-400">{ms.desc}</div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-[11px] text-[#14B8A6] font-semibold">{checked}/{total}</span>
                          <span className="text-[12px] text-gray-400 font-medium">{Math.round(ms.pct * 100)}%</span>
                          {isExp ? <ChevronUp className="w-4 h-4 text-gray-300" /> : <ChevronDown className="w-4 h-4 text-gray-300" />}
                        </div>
                      </button>

                      {isExp && (
                        <div className="px-4 pb-3 border-t border-gray-50 space-y-0.5 pt-2">
                          {ms.checklist.map((item, ci) => {
                            const isOn = milestoneChecks[msIdx]?.[ci] ?? false;
                            return (
                              <button key={ci} onClick={() => toggleCheck(msIdx, ci)}
                                className="w-full flex items-center gap-2.5 py-2 px-1 rounded-lg active:bg-gray-50 text-left">
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${isOn ? 'bg-[#14B8A6]' : 'border-2 border-gray-200'}`}>
                                  {isOn && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                                </div>
                                <span className={`text-[14px] flex-1 ${isOn ? 'text-gray-800' : 'text-gray-400'}`}>{item.label}</span>
                                {item.pricePerSqm > 0 && (
                                  <span className={`text-[11px] flex-shrink-0 ${isOn ? 'text-[#14B8A6] font-medium' : 'text-gray-300'}`}>
                                    {item.pricePerSqm.toLocaleString('ru-RU')} ₽/м²
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>)}

        {/* ═══ STANDARD PARAMETERS ═══ */}
        {!isRenovation && service.parameters.map(param => (
          <div key={param.id}>
            {param.type === 'select' && param.options && (
              <div>
                <label className="block text-[13px] font-semibold text-gray-900 mb-2.5">{param.name}</label>
                <div className="space-y-2">
                  {param.options.map(option => (
                    <button key={option.value}
                      className={`w-full text-left p-4 rounded-2xl transition-all shadow-sm ${selectedOptions[param.id] === option.value ? 'ring-[1.5px] ring-[#14B8A6] bg-white shadow-[#14B8A6]/10' : 'bg-white shadow-black/[0.04] active:bg-gray-50'}`}
                      onClick={() => setSelectedOptions(prev => ({ ...prev, [param.id]: option.value }))}>
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-[15px] text-gray-900">{option.label}</span>
                        {option.priceModifier > 0 && <span className="text-[13px] font-semibold text-[#14B8A6]">+{option.priceModifier.toLocaleString('ru-RU')} ₽</span>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* ═══ LOCATION & DATE ═══ */}
        <div className="space-y-4">
          <div>
            <label className="block text-[13px] font-semibold text-gray-900 mb-2">Город</label>
            <Input placeholder="Якутск" value={city} onChange={e => setCity(e.target.value)} />
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-gray-900 mb-2"><MapPin className="w-4 h-4 inline mr-1" />Адрес</label>
            <Input placeholder="Улица, дом, квартира" value={address} onChange={e => setAddress(e.target.value)} />
          </div>
          <div>
            <label className="block text-[13px] font-semibold text-gray-900 mb-2"><Calendar className="w-4 h-4 inline mr-1" />Дата начала</label>
            <Input type="datetime-local" value={date} onChange={e => setDate(e.target.value)} />
          </div>
        </div>

        <div className="h-4" />
      </div>
    </MobileLayout>
  );
}
