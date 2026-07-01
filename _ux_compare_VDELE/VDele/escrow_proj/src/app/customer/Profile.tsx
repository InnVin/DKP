import React, { useState } from "react";
import { useNavigate } from "react-router";
import { useAppStore } from "../store/AppStore";
import { Button } from "../components/vdele/Button";
import { LAUNCH_CITY } from "../config";
import {
  User, MapPin, Phone, Shield, Bell, HelpCircle, LogOut, FileText,
  ChevronRight, Star, Clock, CreditCard, MessageCircle, Settings,
  CheckCircle2, AlertTriangle, ExternalLink, Copy, Mail,
} from "lucide-react";
import { formatCurrencyRub } from "../copy";

type SubView = null | "contacts" | "security" | "notifications" | "help";

export default function CustomerProfile() {
  const navigate = useNavigate();
  const { orders, transactions } = useAppStore();
  const [sub, setSub] = useState<SubView>(null);
  const [copied, setCopied] = useState(false);

  // Compute real stats from store
  const myOrders = orders.filter(o => o.customerId === "c1");
  const completed = myOrders.filter(o => o.status === "COMPLETED").length;
  const totalSpent = myOrders.reduce((s, o) => s + o.totalAmount, 0);
  const active = myOrders.filter(o => !["COMPLETED", "CANCELLED"].includes(o.status)).length;

  const copyId = () => {
    navigator.clipboard?.writeText("USR-2026-00001");
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // ═══ Sub-views ═══
  if (sub === "contacts") return (
    <SubPage title="Контактные данные" onBack={() => setSub(null)}>
      <Section>
        <Row icon={<Phone />} label="Телефон" value="+7 (914) 255-38-90" />
        <Row icon={<Mail />} label="E-mail" value="ivan.petrov@mail.ru" />
        <Row icon={<MapPin />} label="Город" value={LAUNCH_CITY} />
      </Section>
      <div className="px-4 mt-3">
        <p className="text-[12px] text-gray-400 leading-relaxed">
          Контактные данные используются для связи по заказам и уведомлений.
          Мастер увидит ваш телефон только после оплаты через escrow.
        </p>
      </div>
    </SubPage>
  );

  if (sub === "security") return (
    <SubPage title="Безопасность" onBack={() => setSub(null)}>
      <Section>
        <Row icon={<Shield />} label="Escrow защита" value="Активна" valueColor="#15803D" />
        <Row icon={<CreditCard />} label="Способ оплаты" value="•••• 4242 (Visa)" />
        <Row icon={<CheckCircle2 />} label="Верификация" value="Телефон подтверждён" valueColor="#15803D" />
      </Section>
      <Section title="Как работает защита">
        <InfoBlock items={[
          "Деньги хранятся на номинальном счёте в банке, а не у платформы",
          "Мастер получает оплату только после вашего подтверждения",
          "При споре средства замораживаются до решения модератора",
          "Отмена бесплатна в течение 30 минут после оплаты",
        ]} />
      </Section>
    </SubPage>
  );

  if (sub === "notifications") return (
    <SubPage title="Уведомления" onBack={() => setSub(null)}>
      <Section>
        <ToggleRow label="Статус заказа" desc="Изменения статуса и этапов" defaultOn />
        <ToggleRow label="Сообщения от мастера" desc="Новые сообщения в чате" defaultOn />
        <ToggleRow label="Акции и скидки" desc="Спецпредложения платформы" defaultOn={false} />
        <ToggleRow label="Напоминания" desc="Приёмка работ, отзывы" defaultOn />
      </Section>
      <div className="px-4 mt-3">
        <p className="text-[12px] text-gray-400">Push-уведомления отправляются через Firebase Cloud Messaging.</p>
      </div>
    </SubPage>
  );

  if (sub === "help") return (
    <SubPage title="Помощь" onBack={() => setSub(null)}>
      <Section title="Частые вопросы">
        <FaqItem q="Как работает escrow?" a="Вы оплачиваете заказ — деньги поступают на номинальный счёт банка. Мастер выполняет работу. Вы подтверждаете качество — деньги перечисляются мастеру. Если возникает спор — средства замораживаются." />
        <FaqItem q="Могу ли я отменить заказ?" a="Бесплатная отмена в течение 30 минут после оплаты (до назначения мастера). После начала работ — через процедуру спора." />
        <FaqItem q="Что если мастер не пришёл?" a="Откройте спор в карточке заказа. Выберите причину «Специалист не пришёл». Средства будут возвращены после рассмотрения." />
        <FaqItem q="Как оценить мастера?" a="После завершения заказа вам будет предложено оставить отзыв. Оценки видны всем пользователям." />
      </Section>
      <Section title="Связаться с нами">
        <Row icon={<MessageCircle />} label="Telegram" value="@vdele_support" />
        <Row icon={<Phone />} label="Телефон" value="+7 (800) 100-00-00" />
        <Row icon={<Mail />} label="E-mail" value="support@vdele.ru" />
      </Section>
    </SubPage>
  );

  // ═══ Main Profile ═══
  return (
    <div className="pb-6">
      {/* Header */}
      <div className="bg-gradient-to-b from-[#0B1220] to-[#15202E] px-4 pt-4 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#14B8A6] to-[#0F766E] flex items-center justify-center shadow-lg shadow-teal-900/30">
            <User className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1">
            <div className="text-lg font-bold text-white">Иван Петров</div>
            <div className="text-[13px] text-white/40 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{LAUNCH_CITY}</div>
          </div>
          <button onClick={copyId} className="text-[10px] text-white/30 bg-white/5 px-2 py-1 rounded-lg active:bg-white/10">
            {copied ? "Скопировано ✓" : "ID: 00001"}
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          {[
            { label: "Заказов", value: String(myOrders.length), sub: `${active} активных` },
            { label: "Потрачено", value: totalSpent > 1000 ? `${Math.round(totalSpent / 1000)}K ₽` : `${totalSpent} ₽`, sub: `${completed} завершённых` },
            { label: "Рейтинг", value: "4.9", sub: "2 отзыва" },
          ].map((s, i) => (
            <div key={i} className="bg-white/5 rounded-xl px-3 py-2.5 text-center">
              <div className="text-base font-bold text-white">{s.value}</div>
              <div className="text-[10px] text-white/35 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 -mt-3 space-y-3">
        {/* Menu sections — iOS grouped style */}
        <MenuSection items={[
          { icon: <Phone className="w-[18px] h-[18px]" />, label: "Контактные данные", sub: "+7 (914) 255-38-90", action: () => setSub("contacts") },
          { icon: <CreditCard className="w-[18px] h-[18px]" />, label: "Способы оплаты", sub: "Visa •••• 4242", action: () => setSub("security") },
        ]} />

        <MenuSection items={[
          { icon: <Shield className="w-[18px] h-[18px]" />, label: "Безопасность", sub: "Escrow активна", action: () => setSub("security"), badge: "✓", badgeColor: "#15803D" },
          { icon: <Bell className="w-[18px] h-[18px]" />, label: "Уведомления", sub: "Push включены", action: () => setSub("notifications") },
        ]} />

        <MenuSection items={[
          { icon: <FileText className="w-[18px] h-[18px]" />, label: "Правовая информация", sub: "Оферта, ПДн", action: () => navigate("/customer/legal") },
          { icon: <HelpCircle className="w-[18px] h-[18px]" />, label: "Помощь и FAQ", sub: "Вопросы, поддержка", action: () => setSub("help") },
        ]} />

        <MenuSection items={[
          { icon: <Star className="w-[18px] h-[18px]" />, label: "Оценить приложение", sub: "Ваш отзыв важен для нас", action: () => {} },
        ]} />

        {/* Version */}
        <div className="text-center pt-2">
          <div className="text-[11px] text-gray-400">В Деле v2.0.0 • Build 2026.03</div>
          <div className="text-[11px] text-gray-300 mt-0.5">Информационный посредник (ст. 1253.1 ГК РФ)</div>
        </div>

        <Button variant="outline" size="md" className="w-full text-gray-400" onClick={() => navigate("/")}>
          <LogOut className="w-4 h-4" />
          Выйти из аккаунта
        </Button>
      </div>
    </div>
  );
}

// ═══ Reusable sub-components ═══

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

function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="px-4">
      {title && <div className="text-[13px] font-medium text-gray-500 uppercase tracking-wide mb-2 ml-1">{title}</div>}
      <div className="bg-white rounded-xl overflow-hidden">{children}</div>
    </div>
  );
}

function Row({ icon, label, value, valueColor }: { icon: React.ReactNode; label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100/80 last:border-0">
      <div className="text-gray-400">{icon}</div>
      <div className="flex-1 text-[15px] text-gray-900">{label}</div>
      <div className="text-[14px] text-gray-500" style={valueColor ? { color: valueColor } : {}}>{value}</div>
    </div>
  );
}

function ToggleRow({ label, desc, defaultOn }: { label: string; desc: string; defaultOn: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <button onClick={() => setOn(!on)} className="w-full flex items-center gap-3 px-4 py-3 border-b border-gray-100/80 last:border-0 text-left">
      <div className="flex-1">
        <div className="text-[15px] text-gray-900">{label}</div>
        <div className="text-[12px] text-gray-400 mt-0.5">{desc}</div>
      </div>
      <div className={`w-[46px] h-[28px] rounded-full p-[2px] transition-colors ${on ? 'bg-[#14B8A6]' : 'bg-gray-200'}`}>
        <div className={`w-[24px] h-[24px] rounded-full bg-white shadow-sm transition-transform ${on ? 'translate-x-[18px]' : ''}`} />
      </div>
    </button>
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

function InfoBlock({ items }: { items: string[] }) {
  return (
    <div className="px-4 py-3 space-y-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2.5">
          <div className="w-5 h-5 rounded-full bg-[#14B8A6]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <CheckCircle2 className="w-3 h-3 text-[#14B8A6]" />
          </div>
          <div className="text-[14px] text-gray-600 leading-relaxed">{item}</div>
        </div>
      ))}
    </div>
  );
}

function MenuSection({ items }: { items: { icon: React.ReactNode; label: string; sub: string; action: () => void; badge?: string; badgeColor?: string }[] }) {
  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-sm shadow-black/[0.03]">
      {items.map((item, i) => (
        <button
          key={i}
          onClick={item.action}
          className="w-full flex items-center gap-3 px-4 py-3 border-b border-gray-100/60 last:border-0 active:bg-gray-50 transition-colors"
        >
          <div className="w-8 h-8 rounded-lg bg-[#F2F2F7] flex items-center justify-center text-gray-500 flex-shrink-0">
            {item.icon}
          </div>
          <div className="flex-1 text-left min-w-0">
            <div className="text-[15px] text-gray-900">{item.label}</div>
            <div className="text-[12px] text-gray-400 truncate">{item.sub}</div>
          </div>
          {item.badge && (
            <span className="text-[12px] font-semibold mr-1" style={{ color: item.badgeColor || '#14B8A6' }}>{item.badge}</span>
          )}
          <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
        </button>
      ))}
    </div>
  );
}
