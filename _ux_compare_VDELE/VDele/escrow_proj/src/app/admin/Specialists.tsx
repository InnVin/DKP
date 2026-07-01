import React, { useMemo, useState } from 'react';
import { AdminLayout } from './AdminLayout';
import { Card } from '../components/vdele/Card';
import { Button } from '../components/vdele/Button';
import { useAppStore } from '../store/AppStore';
import { Search, ShieldCheck, ShieldX } from 'lucide-react';

export default function AdminSpecialists() {
  const { providers, actions } = useAppStore();
  const [q, setQ] = useState('');

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return providers.filter((p) => (t ? `${p.name} ${p.specializations.join(' ')}`.toLowerCase().includes(t) : true));
  }, [providers, q]);

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="flex items-start justify-between gap-6 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Специалисты</h1>
            <p className="text-gray-600 mt-1">Верификация, категории, доступ к “ремонт под ключ” (демо)</p>
          </div>
        </div>

        <Card className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <Search className="w-5 h-5 text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Поиск по имени / специализациям"
              className="w-full bg-transparent outline-none text-sm"
            />
          </div>

          <div className="space-y-3">
            {list.map((p) => (
              <div key={p.id} className="p-4 rounded-[18px] border border-gray-100 bg-white">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold text-gray-900">{p.name}</div>
                    <div className="text-sm text-gray-600 mt-1">ID: {p.id}</div>
                    <div className="text-sm text-gray-600">Рейтинг: <span className="font-semibold text-gray-900">{p.rating.toFixed(1)}</span> ({p.reviewCount})</div>
                    <div className="text-sm text-gray-600">Спеки: {p.specializations.join(', ')}</div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <div className={
                      'text-xs font-semibold px-2 py-1 rounded-full border ' +
                      (p.verified ? 'border-[#10B981]/25 bg-[#10B981]/10 text-[#10B981]' : 'border-gray-200 bg-gray-50 text-gray-700')
                    }>
                      {p.verified ? 'VERIFIED' : 'UNVERIFIED'}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => actions.toggleProviderVerified(p.id)}
                      >
                        {p.verified ? (
                          <>
                            <ShieldX className="w-4 h-4" />
                            <span className="ml-2">Снять верификацию</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-4 h-4" />
                            <span className="ml-2">Верифицировать</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {list.length === 0 && (
              <div className="p-8 text-center text-gray-600">Ничего не найдено</div>
            )}
          </div>
        </Card>

        <div className="mt-4 text-xs text-gray-500">
          В реальном продукте здесь: KYC, документы, рейтинг рисков, сегментация (ремонт/стройка), доступ к тендерам и воронка онбординга.
        </div>
      </div>
    </AdminLayout>
  );
}
