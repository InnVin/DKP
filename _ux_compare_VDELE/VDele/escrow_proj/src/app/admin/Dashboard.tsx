import React, { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { AdminLayout } from './AdminLayout';
import { Card } from '../components/vdele/Card';
import { TrendingUp, ShoppingBag, AlertTriangle, Clock, Users, DollarSign } from 'lucide-react';
import { useAppStore } from '../store/AppStore';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { orders, disputes } = useAppStore();

  const kpis = useMemo(() => {
    const active = orders.filter((o) => ["FUNDED", "ASSIGNED", "IN_PROGRESS", "SUBMITTED", "DISPUTED"].includes(o.status)).length;
    const revenue = orders.reduce((s, o) => s + (o.breakdown?.platformFee ?? 0), 0);
    const openDisputes = disputes.filter((d) => d.status === "OPEN" || d.status === "UNDER_REVIEW").length;
    return [
      { label: 'Активные заказы', value: active, icon: ShoppingBag, color: 'text-[#14B8A6]' },
      { label: 'Открытые споры', value: openDisputes, icon: AlertTriangle, color: 'text-[#EF4444]' },
      { label: 'Сервисный сбор (демо)', value: `${revenue.toLocaleString('ru-RU')} ₽`, icon: DollarSign, color: 'text-[#0F766E]' },
      { label: 'SLA (условно)', value: '2ч', icon: Clock, color: 'text-[#F59E0B]' },
      { label: 'Специалисты (демо)', value: 128, icon: Users, color: 'text-gray-700' },
      { label: 'Рост (демо)', value: '+12%', icon: TrendingUp, color: 'text-[#10B981]' },
    ];
  }, [orders, disputes]);

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Админка — Overview</h1>
          <p className="text-gray-600 mt-1">Операционная панель escrow marketplace</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {kpis.map((kpi) => (
            <Card key={kpi.label} className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-600 text-sm mb-1">{kpi.label}</p>
                  <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
                </div>
                <div className={`w-12 h-12 rounded-[16px] bg-gray-50 flex items-center justify-center ${kpi.color}`}>
                  {React.createElement(kpi.icon, { className: 'w-6 h-6' })}
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Быстрые действия</h2>
            <div className="flex gap-3">
              <button
                className="px-4 py-3 rounded-[16px] bg-[#14B8A6] text-white font-medium hover:opacity-90"
                onClick={() => navigate('/admin/orders')}
              >
                Открыть заказы
              </button>
              <button
                className="px-4 py-3 rounded-[16px] bg-gray-100 text-gray-900 font-medium hover:bg-gray-200"
                onClick={() => navigate('/admin/disputes')}
              >
                Открыть споры
              </button>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Примечание</h2>
            <p className="text-gray-600">
              Это демо: все статусы (Order/Escrow/Dispute) живут в localStorage. Логика соответствует строгой state machine в <code>src/app/stateMachine.ts</code>.
            </p>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
