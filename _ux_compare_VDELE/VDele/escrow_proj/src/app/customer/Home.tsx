import React from 'react';
import { useNavigate } from 'react-router';
import { Search, Clock, Shield, Camera, CheckSquare, ChevronRight, Ruler, Sparkles, Zap, Star } from 'lucide-react';
import { Badge } from '../components/vdele/Badge';
import { useAppStore } from '../store/AppStore';
import { VDELE_ICON_B64 as vdeleIcon } from '../../assets/icon-base64';

export default function CustomerHome() {
  const navigate = useNavigate();
  const { orders, categories, actions } = useAppStore();
  const recentOrders = orders.filter(o => o.customerId === "c1").slice(0, 3);

  return (
    <div className="pb-4">
      {/* ── Header ── */}
      <div className="bg-gradient-to-b from-[#0B1220] to-[#111827] px-4 pt-4 pb-5">
        <div className="flex items-center gap-3 mb-4">
          <img src={vdeleIcon} alt="" className="w-10 h-10 rounded-xl" />
          <div className="flex-1">
            <h1 className="text-lg font-bold text-white">В деле</h1>
            <p className="text-xs text-white/40">Ремонт под защитой • Якутск</p>
          </div>
          <button onClick={() => actions.resetDemo()} className="text-[10px] text-white/30 px-2 py-1 rounded bg-white/5">Demo</button>
        </div>

        {/* Search */}
        <button onClick={() => navigate('/customer/search')} className="w-full text-left">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-white/30" />
            <div className="h-11 pl-11 pr-4 flex items-center rounded-xl bg-white/8 border border-white/10 text-white/30 text-sm">
              Что нужно сделать?
            </div>
          </div>
        </button>
      </div>

      <div className="px-4 space-y-5 -mt-2">
        {/* ── Express Order ── */}
        <button onClick={() => navigate('/customer/express')} className="w-full text-left">
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl p-4 border border-amber-200/50 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Zap className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-gray-900 text-sm">Быстрый заказ</div>
              <div className="text-xs text-gray-500 mt-0.5">Сантехник, электрик, мастер — за 3 шага</div>
            </div>
            <ChevronRight className="w-4 h-4 text-amber-400 flex-shrink-0" />
          </div>
        </button>

        {/* ── Premium: Ремонт под ключ ── */}
        <button onClick={() => navigate('/customer/category/renovation')} className="w-full text-left">
          <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#0B1220] via-[#111827] to-[#0F766E]/40 p-5">
            <div className="absolute top-0 right-0 w-40 h-40 bg-teal-500/8 rounded-full blur-3xl" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-2xl">🏠</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 font-semibold uppercase tracking-wider">Premium</span>
              </div>
              <h3 className="text-lg font-bold text-white">Ремонт под ключ</h3>
              <p className="text-sm text-white/45 mt-1 mb-3">Поэтапная оплата • Фото-отчёты • Escrow</p>
              <div className="flex gap-2 mb-3">
                {[
                  { label: "Косметический", price: "от 5 500 ₽/м²" },
                  { label: "Евроремонт", price: "от 12 000 ₽/м²" },
                ].map((t, i) => (
                  <div key={i} className="flex-1 bg-white/5 rounded-lg px-2.5 py-1.5">
                    <div className="text-[10px] text-white/35">{t.label}</div>
                    <div className="text-xs text-teal-300 font-semibold">{t.price}</div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-1 text-teal-400 text-sm font-medium">
                <Sparkles className="w-4 h-4" /><span>Рассчитать стоимость</span><ChevronRight className="w-4 h-4" />
              </div>
            </div>
          </div>
        </button>

        {/* ── Categories grid ── */}
        <div>
          <h2 className="text-base font-bold text-gray-900 mb-3">Все услуги</h2>
          <div className="grid grid-cols-4 gap-2">
            {categories.filter(c => c.id !== 'renovation').map((cat) => (
              <button
                key={cat.id}
                className="bg-white rounded-xl p-2.5 text-center border border-gray-100 active:border-[#14B8A6]/40 active:scale-[0.96] transition-all overflow-hidden"
                onClick={() => navigate(`/customer/category/${cat.id}`)}
              >
                <div className="text-xl mb-1">{cat.icon}</div>
                <div className="text-[10px] font-medium text-gray-600 leading-tight truncate w-full">{cat.name}</div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Active orders ── */}
        {recentOrders.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h2 className="text-base font-bold text-gray-900">Мои заказы</h2>
              <button onClick={() => navigate('/customer/orders')} className="text-sm text-[#14B8A6] font-semibold">Все →</button>
            </div>
            <div className="space-y-2.5">
              {recentOrders.map((o) => (
                <button key={o.id} className="w-full text-left" onClick={() => navigate(`/customer/orders/${o.id}`)}>
                  <div className="bg-white rounded-2xl p-3.5 border border-gray-100 active:border-[#14B8A6]/30 transition-all">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate">{o.serviceName}</p>
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{o.address}</p>
                      </div>
                      <Badge type={`order-${o.status.toLowerCase()}` as any} />
                    </div>
                    <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-gray-50">
                      <span className="text-sm font-bold text-gray-900">{o.totalAmount.toLocaleString('ru-RU')} ₽</span>
                      {o.isTurnkey && o.milestones.length > 1 && (
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <div className="h-full rounded-full bg-[#14B8A6]" style={{ width: `${(o.milestones.filter(m => m.status === 'RELEASED').length / o.milestones.length) * 100}%` }} />
                          </div>
                          <span className="text-[10px] text-gray-400">{o.milestones.filter(m => m.status === 'RELEASED').length}/{o.milestones.length}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Trust banner ── */}
        <div className="bg-[#F0FDFA] rounded-2xl p-4 border border-[#14B8A6]/10">
          <div className="flex items-center gap-3 mb-2.5">
            <Shield className="w-5 h-5 text-[#14B8A6]" />
            <span className="font-bold text-gray-900 text-sm">Безопасная сделка</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: "💳", text: "Деньги в банке до приёмки" },
              { icon: "📸", text: "Фото-отчёты на каждом этапе" },
              { icon: "⚖️", text: "Справедливое решение споров" },
            ].map((f, i) => (
              <div key={i} className="text-center">
                <div className="text-lg mb-1">{f.icon}</div>
                <div className="text-[10px] text-gray-500 leading-tight">{f.text}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
