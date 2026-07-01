import React, { useMemo, useState } from 'react';
import { AdminLayout } from './AdminLayout';
import { Card } from '../components/vdele/Card';
import { Button } from '../components/vdele/Button';
import { useAppStore } from '../store/AppStore';
import { Badge } from '../components/vdele/Badge';
import { CheckCircle2, XCircle, Clock, RefreshCw } from 'lucide-react';

function fmt(iso?: string) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('ru-RU');
  } catch {
    return iso;
  }
}

export default function AdminPayouts() {
  const { payouts, providers, actions } = useAppStore();
  const [filter, setFilter] = useState<'ALL' | 'REQUESTED' | 'APPROVED' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'REJECTED'>('ALL');

  const list = useMemo(() => {
    const xs = filter === 'ALL' ? payouts : payouts.filter((p) => p.status === filter);
    return [...xs].sort((a, b) => (b.requestedAt ?? '').localeCompare(a.requestedAt ?? ''));
  }, [payouts, filter]);

  const kpi = useMemo(() => {
    const requested = payouts.filter((p) => p.status === 'REQUESTED').length;
    const processing = payouts.filter((p) => p.status === 'PROCESSING' || p.status === 'APPROVED').length;
    return { requested, processing };
  }, [payouts]);

  return (
    <AdminLayout>
      <div className="p-8">
        <div className="flex items-start justify-between gap-6 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Выплаты</h1>
            <p className="text-gray-600 mt-1">Очередь на вывод средств (демо, localStorage)</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-4 py-3 rounded-[18px] bg-white border border-gray-100">
              <div className="text-xs text-gray-500">REQUESTED</div>
              <div className="text-xl font-bold text-gray-900">{kpi.requested}</div>
            </div>
            <div className="px-4 py-3 rounded-[18px] bg-white border border-gray-100">
              <div className="text-xs text-gray-500">IN PROGRESS</div>
              <div className="text-xl font-bold text-gray-900">{kpi.processing}</div>
            </div>
          </div>
        </div>

        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            {(
              [
                { key: 'ALL', label: 'Все' },
                { key: 'REQUESTED', label: 'Новые' },
                { key: 'APPROVED', label: 'Одобрено' },
                { key: 'PROCESSING', label: 'В обработке' },
                { key: 'SUCCEEDED', label: 'Успешно' },
                { key: 'FAILED', label: 'Ошибка' },
                { key: 'REJECTED', label: 'Отклонено' },
              ] as const
            ).map((t) => (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                className={
                  'px-3 py-2 rounded-[14px] text-sm font-medium border transition ' +
                  (filter === t.key ? 'border-[#14B8A6] bg-[#14B8A6]/5 text-[#0F766E]' : 'border-gray-100 bg-white text-gray-700 hover:border-gray-200')
                }
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {list.map((p) => {
              const prov = providers.find((x) => x.id === p.providerId);
              const canApprove = p.status === 'REQUESTED';
              const canProcess = p.status === 'APPROVED';
              const canSucceed = p.status === 'PROCESSING';
              const canReject = p.status === 'REQUESTED' || p.status === 'APPROVED';

              return (
                <div key={p.id} className="p-4 rounded-[18px] border border-gray-100 bg-white">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-semibold text-gray-900">{p.id}</div>
                      <div className="text-sm text-gray-600 mt-1">Исполнитель: {prov?.name ?? p.providerId}</div>
                      <div className="text-sm text-gray-600">Запрос: {fmt(p.requestedAt)}</div>
                      <div className="text-sm text-gray-600">Сумма: <span className="font-semibold text-gray-900">{p.amount.toLocaleString('ru-RU')} ₽</span> (fee {p.fee.toLocaleString('ru-RU')} ₽)</div>
                      {p.failureReason && (
                        <div className="text-sm text-[#EF4444] mt-1">Причина: {p.failureReason}</div>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <div className="text-xs font-semibold px-2 py-1 rounded-full bg-gray-50 border border-gray-100 text-gray-700">
                        {p.status}
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          onClick={() => actions.updatePayoutStatus(p.id, 'APPROVED')}
                          disabled={!canApprove}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span className="ml-2">Approve</span>
                        </Button>

                        <Button
                          variant="secondary"
                          onClick={() => actions.updatePayoutStatus(p.id, 'PROCESSING')}
                          disabled={!canProcess}
                        >
                          <RefreshCw className="w-4 h-4" />
                          <span className="ml-2">Process</span>
                        </Button>

                        <Button
                          variant="primary"
                          onClick={() => actions.updatePayoutStatus(p.id, 'SUCCEEDED')}
                          disabled={!canSucceed}
                        >
                          <Clock className="w-4 h-4" />
                          <span className="ml-2">Settle</span>
                        </Button>

                        <Button
                          variant="secondary"
                          onClick={() => actions.updatePayoutStatus(p.id, 'REJECTED', 'Недостаточно данных KYC (демо)')}
                          disabled={!canReject}
                        >
                          <XCircle className="w-4 h-4" />
                          <span className="ml-2">Reject</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {list.length === 0 && (
              <div className="p-8 text-center text-gray-600">Очередь пуста</div>
            )}
          </div>
        </Card>

        <div className="mt-4 text-xs text-gray-500">
          В реальном продукте тут будет: payout provider (банк/СБП), статусы webhook, антифрод, KYC/KYB, лимиты и удержания.
        </div>
      </div>
    </AdminLayout>
  );
}
