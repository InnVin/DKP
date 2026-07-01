import React, { useState } from "react";
import { useNavigate } from "react-router";
import { useAppStore } from "../store/AppStore";
import { Button } from "../components/vdele/Button";
import { formatCurrencyRub } from "../copy";
import {
  User, Star, CheckCircle2, ShieldCheck, MapPin, Phone, Calendar,
  ChevronRight, Briefcase, Award, Clock, Settings, LogOut,
  FileText, Bell, HelpCircle, CreditCard, Wrench,
} from "lucide-react";

const DEMO_PROVIDER_ID = "prov1";

type SubView = null | "schedule" | "documents" | "skills" | "help";

export default function SpecialistProfile() {
  const navigate = useNavigate();
  const { providers, orders, wallet } = useAppStore();
  const [sub, setSub] = useState<SubView>(null);

  const provider = providers.find(p => p.id === DEMO_PROVIDER_ID);
  const myOrders = orders.filter(o => o.providerId === DEMO_PROVIDER_ID);
  const completed = myOrders.filter(o => o.status === "COMPLETED").length;
  const active = myOrders.filter(o => ["ASSIGNED", "IN_PROGRESS", "SUBMITTED"].includes(o.status)).length;

  if (!provider) return <div className="p-6 text-gray-500 text-center">Профиль не найден</div>;

  // ── Sub-views ──
  if (sub === "schedule") return (
    <SubPage title="Расписание" onBack={() => setSub(null)}>
      <div className="px-4 space-y-3">
        <p className="text-[13px] text-gray-500">Ваше расписание видно заказчикам при выборе мастера.</p>
        {(provider.availability ?? []).map((day, i) => (
          <div key={i} className="bg-white rounded-xl p-4 shadow-sm shadow-black/[0.03]">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-[#14B8A6]" />
              <span className="text-[15px] font-semibold text-gray-900">
                {new Date(day.day).toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {day.slots.map((slot, j) => (
                <span key={j} className="px-3 py-1.5 rounded-lg bg-[#14B8A6]/10 text-[#0F766E] text-[13px] font-medium">{slot}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </SubPage>
  );

  if (sub === "documents") return (
    <SubPage title="Документы" onBack={() => setSub(null)}>
      <div className="px-4 space-y-3">
        <div className="bg-white rounded-xl overflow-hidden shadow-sm shadow-black/[0.03]">
          <DocRow label="Паспорт РФ" status="verified" />
          <DocRow label={provider.taxStatus === "SELF_EMPLOYED" ? "Статус самозанятого" : provider.taxStatus === "INDIVIDUAL_ENTREPRENEUR" ? "Свидетельство ИП" : "Устав ООО"} status="verified" />
          <DocRow label="Фото профиля" status="verified" />
          <DocRow label="Портфолио работ" status={provider.portfolio && provider.portfolio.length > 0 ? "verified" : "pending"} />
          <DocRow label="Страхование ответственности" status="not_uploaded" />
        </div>
        <p className="text-[12px] text-gray-400 ml-1">Верифицированные документы повышают доверие заказчиков и рейтинг в выдаче.</p>
      </div>
    </SubPage>
  );

  if (sub === "skills") return (
    <SubPage title="Навыки и услуги" onBack={() => setSub(null)}>
      <div className="px-4 space-y-3">
        <div className="bg-white rounded-xl p-4 shadow-sm shadow-black/[0.03]">
          <div className="text-[13px] font-medium text-gray-500 uppercase tracking-wide mb-3">Категории</div>
          <div className="flex flex-wrap gap-2">
            {(provider.skillCategoryIds ?? []).map(cat => (
              <span key={cat} className="px-3 py-1.5 rounded-lg bg-[#14B8A6]/10 text-[#0F766E] text-[13px] font-semibold capitalize">{cat}</span>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm shadow-black/[0.03]">
          <div className="text-[13px] font-medium text-gray-500 uppercase tracking-wide mb-3">Портфолио</div>
          {provider.portfolio && provider.portfolio.length > 0 ? (
            <div className="space-y-2">
              {provider.portfolio.map(p => (
                <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg bg-[#F2F2F7]">
                  <div className="w-12 h-12 rounded-lg bg-gray-200 flex-shrink-0" />
                  <div className="text-[14px] text-gray-700">{p.title}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-gray-400">Добавьте примеры работ</p>
          )}
        </div>
      </div>
    </SubPage>
  );

  if (sub === "help") return (
    <SubPage title="Помощь" onBack={() => setSub(null)}>
      <div className="px-4 space-y-3">
        <div className="bg-white rounded-xl overflow-hidden shadow-sm shadow-black/[0.03]">
          <FaqItem q="Когда я получу деньги?" a="После того как заказчик подтвердит выполнение работы. Средства поступят на баланс кошелька, откуда вы сможете вывести на карту." />
          <FaqItem q="Что если заказчик не принимает работу?" a="Через 72 часа без действий заказ передаётся в поддержку для ручного разрешения. Автоматической выплаты без подтверждения нет." />
          <FaqItem q="Как повысить рейтинг?" a="Выполняйте заказы качественно, прикладывайте фото-отчёты, заполняйте чек-листы. Верификация документов также повышает доверие." />
          <FaqItem q="Какая комиссия платформы?" a="Комиссия оплачивается заказчиком (8% от суммы). С вашей стороны удержаний нет — вы получаете полную стоимость работ." />
        </div>
      </div>
    </SubPage>
  );

  // ── Main Profile ──
  return (
    <div className="pb-6">
      {/* Header */}
      <div className="bg-gradient-to-b from-[#0B1220] to-[#15202E] px-4 pt-4 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#0F766E] to-[#14B8A6] flex items-center justify-center shadow-lg shadow-teal-900/30">
            <Wrench className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-white">{provider.name}</span>
              {provider.kycStatus === "VERIFIED" && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
            </div>
            <div className="text-[13px] text-white/40 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />{provider.location?.city ?? "Якутск"}
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-[13px] text-amber-300 flex items-center gap-1"><Star className="w-3.5 h-3.5" />{provider.rating}</span>
              <span className="text-[12px] text-white/30">{provider.reviewCount} отзывов</span>
              <span className="text-[12px] text-white/30">{provider.completedOrders} заказов</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          {[
            { label: "Активных", value: String(active) },
            { label: "Завершено", value: String(completed) },
            { label: "На балансе", value: `${Math.round((wallet as any).available / 1000)}K ₽` },
          ].map((s, i) => (
            <div key={i} className="bg-white/5 rounded-xl px-3 py-2.5 text-center">
              <div className="text-base font-bold text-white">{s.value}</div>
              <div className="text-[10px] text-white/35">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 -mt-3 space-y-3">
        <MenuSection items={[
          { icon: <Wrench className="w-[18px] h-[18px]" />, label: "Навыки и портфолио", sub: `${provider.skillCategoryIds?.length ?? 0} категорий`, action: () => setSub("skills") },
          { icon: <Calendar className="w-[18px] h-[18px]" />, label: "Расписание", sub: "3 дня доступны", action: () => setSub("schedule") },
          { icon: <ShieldCheck className="w-[18px] h-[18px]" />, label: "Документы", sub: provider.kycStatus === "VERIFIED" ? "Верифицирован" : "Требуется", action: () => setSub("documents"),
            badge: provider.kycStatus === "VERIFIED" ? "✓" : "!", badgeColor: provider.kycStatus === "VERIFIED" ? "#15803D" : "#F59E0B" },
        ]} />

        <MenuSection items={[
          { icon: <Bell className="w-[18px] h-[18px]" />, label: "Уведомления", sub: "Push включены", action: () => {} },
          { icon: <HelpCircle className="w-[18px] h-[18px]" />, label: "Помощь", sub: "FAQ и поддержка", action: () => setSub("help") },
        ]} />

        <div className="text-center pt-2">
          <div className="text-[11px] text-gray-400">
            {provider.taxStatus === "SELF_EMPLOYED" ? "Самозанятый" : provider.taxStatus === "INDIVIDUAL_ENTREPRENEUR" ? "ИП" : "ООО"} • На платформе с {new Date(provider.memberSince ?? "").toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}
          </div>
        </div>

        <Button variant="outline" size="md" className="w-full text-gray-400" onClick={() => navigate("/")}>
          <LogOut className="w-4 h-4" />
          Выйти
        </Button>
      </div>
    </div>
  );
}

// ═══ Shared sub-components ═══

function SubPage({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F2F2F7]">
      <div className="bg-white/80 px-4 flex items-center gap-2 border-b border-gray-200/50" style={{ minHeight: 48, backdropFilter: 'blur(20px)' } as any}>
        <button onClick={onBack} className="text-[#14B8A6] text-[15px] font-medium">← Назад</button>
        <h1 className="text-[17px] font-semibold text-gray-900 flex-1 text-center pr-10">{title}</h1>
      </div>
      <div className="py-4 space-y-4">{children}</div>
    </div>
  );
}

function DocRow({ label, status }: { label: string; status: "verified" | "pending" | "not_uploaded" }) {
  const cfg = { verified: { text: "Подтверждён", color: "#15803D", icon: <CheckCircle2 className="w-4 h-4" /> },
    pending: { text: "На проверке", color: "#F59E0B", icon: <Clock className="w-4 h-4" /> },
    not_uploaded: { text: "Загрузить", color: "#9CA3AF", icon: <ChevronRight className="w-4 h-4" /> } }[status];
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100/80 last:border-0">
      <div className="flex-1 text-[15px] text-gray-900">{label}</div>
      <div className="flex items-center gap-1 text-[13px]" style={{ color: cfg.color }}>{cfg.icon}<span>{cfg.text}</span></div>
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button onClick={() => setOpen(!open)} className="w-full text-left px-4 py-3 border-b border-gray-100/80 last:border-0">
      <div className="flex items-center justify-between">
        <div className="text-[15px] text-gray-900 font-medium pr-4">{q}</div>
        <ChevronRight className={`w-4 h-4 text-gray-300 flex-shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
      </div>
      {open && <div className="text-[13px] text-gray-500 mt-2 leading-relaxed">{a}</div>}
    </button>
  );
}

function MenuSection({ items }: { items: { icon: React.ReactNode; label: string; sub: string; action: () => void; badge?: string; badgeColor?: string }[] }) {
  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-sm shadow-black/[0.03]">
      {items.map((item, i) => (
        <button key={i} onClick={item.action} className="w-full flex items-center gap-3 px-4 py-3 border-b border-gray-100/60 last:border-0 active:bg-gray-50 transition-colors">
          <div className="w-8 h-8 rounded-lg bg-[#F2F2F7] flex items-center justify-center text-gray-500 flex-shrink-0">{item.icon}</div>
          <div className="flex-1 text-left min-w-0">
            <div className="text-[15px] text-gray-900">{item.label}</div>
            <div className="text-[12px] text-gray-400 truncate">{item.sub}</div>
          </div>
          {item.badge && <span className="text-[12px] font-semibold mr-1" style={{ color: item.badgeColor || '#14B8A6' }}>{item.badge}</span>}
          <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
        </button>
      ))}
    </div>
  );
}
