import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { MobileLayout } from '../components/vdele/MobileLayout';
import { Card } from '../components/vdele/Card';
import { Button } from '../components/vdele/Button';
import { useAppStore } from '../store/AppStore';

export default function SpecialistWithdraw() {
  const navigate = useNavigate();
  const { wallet, actions } = useAppStore();
  const [amount, setAmount] = useState<string>('');

  const parsed = useMemo(() => {
    const v = Number(amount.replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(v) ? v : 0;
  }, [amount]);

  const fee = useMemo(() => Math.round(parsed * 0.02), [parsed]);
  const total = useMemo(() => Math.max(0, parsed - fee), [parsed, fee]);

  const can = parsed > 0 && parsed <= wallet.available;

  return (
    <MobileLayout title="Вывод средств" onBack={() => navigate(-1)} headerVariant="dark">
      <div className="p-4 space-y-4">
        <Card className="p-4">
          <div className="text-sm text-gray-600">Доступно</div>
          <div className="text-2xl font-bold text-gray-900">{wallet.available.toLocaleString('ru-RU')} ₽</div>

          <div className="mt-4">
            <div className="text-sm font-medium text-gray-700 mb-2">Сумма вывода</div>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Например: 5000"
              className="w-full h-[48px] px-4 rounded-[16px] border-2 border-gray-200 bg-white"
            />
          </div>
        </Card>

        <Card className="p-4">
          <div className="font-semibold text-gray-900 mb-3">Итого</div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Сумма</span>
              <span className="font-medium">{parsed.toLocaleString('ru-RU')} ₽</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Комиссия (2%)</span>
              <span className="font-medium">{fee.toLocaleString('ru-RU')} ₽</span>
            </div>
            <div className="pt-2 border-t border-gray-200 flex justify-between">
              <span className="font-semibold">К зачислению</span>
              <span className="text-lg font-bold text-[#14B8A6]">{total.toLocaleString('ru-RU')} ₽</span>
            </div>
          </div>
        </Card>

        <Button
          variant="primary"
          className="w-full"
          disabled={!can}
          onClick={() => {
            actions.requestPayout('prov1', parsed);
            alert('Демо: создана заявка на вывод. Откройте админку → Выплаты, чтобы провести её по статусам.');
            navigate('/specialist/wallet');
          }}
        >
          Подтвердить вывод
        </Button>

        {!can && (
          <div className="text-xs text-gray-500">
            Введите сумму до {wallet.available.toLocaleString('ru-RU')} ₽
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
