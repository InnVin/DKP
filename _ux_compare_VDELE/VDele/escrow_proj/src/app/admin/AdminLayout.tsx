import React, { ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingBag, 
  AlertTriangle, 
  Wallet, 
  Users,
  LogOut
} from 'lucide-react';

import { VDELE_LOGO_B64 as vdeleLogo } from '../../assets/icon-base64';

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { id: 'dashboard', label: 'Обзор', icon: LayoutDashboard, path: '/admin' },
    { id: 'catalog', label: 'Каталог услуг', icon: Package, path: '/admin/catalog' },
    { id: 'orders', label: 'Заказы', icon: ShoppingBag, path: '/admin/orders' },
    { id: 'disputes', label: 'Споры', icon: AlertTriangle, path: '/admin/disputes' },
    { id: 'payouts', label: 'Выплаты', icon: Wallet, path: '/admin/payouts' },
    { id: 'specialists', label: 'Специалисты', icon: Users, path: '/admin/specialists' },
  ];

  const isActive = (path: string) => {
    if (path === '/admin') {
      return location.pathname === path;
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex h-screen bg-[#F2F2F7]">
      {/* Sidebar */}
      <aside className="w-[240px] bg-gradient-to-b from-[#0B1220] to-[#111827] text-white flex flex-col">
        <div className="p-6">
          <div className="flex items-center gap-3">
            <img
              src={vdeleLogo}
              alt="В ДЕЛЕ"
              className="h-8 w-auto drop-shadow-[0_10px_30px_rgba(20,184,166,0.18)]"
            />
          </div>
          <p className="text-white/60 text-sm mt-2">Admin Panel</p>
        </div>

        <nav className="flex-1 px-3">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-lg mb-1
                  transition-all duration-200 text-left
                  ${active 
                    ? 'bg-[#14B8A6] text-white shadow-[0_4px_18px_rgba(20,184,166,0.25)]' 
                    : 'text-white/70 hover:bg-white/5 hover:text-white'
                  }
                `}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/10">
          <button className="w-full flex items-center gap-3 px-4 py-3 text-white/70 hover:bg-white/5 hover:text-white rounded-lg transition-all">
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Выход</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
