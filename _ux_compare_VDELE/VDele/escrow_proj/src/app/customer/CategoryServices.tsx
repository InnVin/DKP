import React, { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router';
import { MobileLayout } from '../components/vdele/MobileLayout';
import { Card } from '../components/vdele/Card';
import { ChevronRight, Star, Shield } from 'lucide-react';
import { useAppStore } from '../store/AppStore';

export default function CategoryServices() {
  const navigate = useNavigate();
  const { categoryId } = useParams();
  const { categories, services, providers } = useAppStore();

  const category = categories.find((c) => c.id === categoryId);
  const list = useMemo(() => services.filter((s) => s.categoryId === categoryId && s.published), [services, categoryId]);

  // Count specialists for this category
  const specCount = useMemo(() =>
    providers.filter(p => p.skillCategoryIds?.includes(categoryId ?? '')).length,
  [providers, categoryId]);

  return (
    <MobileLayout
      title={category?.name ?? 'Категория'}
      onBack={() => navigate(-1)}
    >
      <div className="p-4 space-y-4">
        {/* Category header */}
        <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
          <span className="text-3xl">{category?.icon}</span>
          <div>
            <div className="text-sm text-gray-500">{list.length} услуг</div>
            <div className="text-sm text-gray-500">{specCount} специалистов в вашем городе</div>
          </div>
        </div>

        {/* Service cards */}
        {list.map((service) => (
          <button
            key={service.id}
            className="w-full text-left"
            onClick={() => navigate(`/customer/service/${service.id}`)}
          >
            <div className="bg-white rounded-2xl p-4 border border-gray-100 active:border-[#14B8A6]/50 transition-all active:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900">{service.name}</h3>
                  <p className="text-sm text-gray-500 mt-1 line-clamp-2">{service.description}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0 mt-1" />
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                <div>
                  <span className="text-xs text-gray-400">от </span>
                  <span className="text-lg font-bold text-[#14B8A6]">
                    {service.basePrice.toLocaleString('ru-RU')} ₽
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  {service.supportsMilestones && (
                    <span className="flex items-center gap-1 text-[#14B8A6] bg-[#14B8A6]/10 px-2 py-0.5 rounded-full">
                      <Shield className="w-3 h-3" /> Поэтапно
                    </span>
                  )}
                </div>
              </div>
            </div>
          </button>
        ))}

        {list.length === 0 && (
          <div className="bg-white rounded-2xl p-8 text-center text-gray-500 border border-gray-100">
            В этой категории пока нет услуг
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
