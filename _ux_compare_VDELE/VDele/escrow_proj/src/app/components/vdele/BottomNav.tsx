import React from "react";
import { useLocation, useNavigate } from "react-router";
import { Home, ListChecks, User, Wallet } from "lucide-react";

type Role = "customer" | "specialist";
type Tab = { key: string; label: string; path: string; icon: React.ReactNode; match?: (p: string) => boolean };

export function BottomNav({ role }: { role: Role }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const customerTabs: Tab[] = [
    { key: "home", label: "Главная", path: "/customer", icon: <Home className="w-[22px] h-[22px]" />, match: (p) => p === "/customer" },
    { key: "orders", label: "Заказы", path: "/customer/orders", icon: <ListChecks className="w-[22px] h-[22px]" />, match: (p) => p.startsWith("/customer/orders") },
    { key: "profile", label: "Профиль", path: "/customer/profile", icon: <User className="w-[22px] h-[22px]" /> },
  ];

  const specialistTabs: Tab[] = [
    { key: "orders", label: "Заказы", path: "/specialist", icon: <ListChecks className="w-[22px] h-[22px]" />, match: (p) => p === "/specialist" },
    { key: "wallet", label: "Кошелёк", path: "/specialist/wallet", icon: <Wallet className="w-[22px] h-[22px]" /> },
    { key: "profile", label: "Профиль", path: "/specialist/profile", icon: <User className="w-[22px] h-[22px]" /> },
  ];

  const tabs = role === "customer" ? customerTabs : specialistTabs;

  return (
    <div
      className="grid grid-cols-3"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {tabs.map((t) => {
        const active = t.match ? t.match(pathname) : pathname === t.path;
        return (
          <button
            key={t.key}
            onClick={() => navigate(t.path)}
            className="flex flex-col items-center justify-center gap-[2px] py-1.5"
            style={{ minHeight: 48 }}
          >
            <div className={active ? "text-[#14B8A6]" : "text-[#8E8E93]"}>{t.icon}</div>
            <span className={`text-[10px] ${active ? "text-[#14B8A6] font-semibold" : "text-[#8E8E93]"}`}>
              {t.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
