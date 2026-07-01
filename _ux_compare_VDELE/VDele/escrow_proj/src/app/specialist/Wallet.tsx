import React from "react";
import { useNavigate } from "react-router";
import { Card } from "../components/vdele/Card";
import { Button } from "../components/vdele/Button";
import { TrendingUp, Clock, Lock, ArrowUpRight, CreditCard } from "lucide-react";
import { useAppStore } from "../store/AppStore";

export default function SpecialistWallet() {
  const navigate = useNavigate();
  const { wallet, transactions } = useAppStore();

  return (
    <div className="space-y-4">
      {/* Dark header / balance */}
      <div className="p-4">
        <Card variant="wallet" className="shadow-[0_8px_28px_rgba(20,184,166,0.28)]">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-white/80 text-sm mb-1">Доступно к выводу</p>
              <p className="text-4xl font-bold">{wallet.available.toLocaleString("ru-RU")} ₽</p>
            </div>
            <div className="w-12 h-12 rounded-[16px] bg-white/10 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-[#14B8A6]" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-white/5 rounded-[16px] p-3">
              <div className="flex items-center gap-2 mb-1 text-white/80 text-xs">
                <Clock className="w-4 h-4" /> Pending
              </div>
              <div className="font-semibold text-white">{wallet.pending.toLocaleString("ru-RU")} ₽</div>
            </div>
            <div className="bg-white/5 rounded-[16px] p-3">
              <div className="flex items-center gap-2 mb-1 text-white/80 text-xs">
                <Lock className="w-4 h-4" /> Locked
              </div>
              <div className="font-semibold text-white">{wallet.held.toLocaleString("ru-RU")} ₽</div>
            </div>
            <div className="bg-white/5 rounded-[16px] p-3">
              <div className="flex items-center gap-2 mb-1 text-white/80 text-xs">
                <CreditCard className="w-4 h-4" /> Карта
              </div>
              <div className="font-semibold text-white">•••• 2311</div>
            </div>
          </div>

          <Button
            variant="primary"
            className="w-full"
            onClick={() => navigate("/specialist/withdraw")}
            disabled={wallet.available <= 0}
          >
            <ArrowUpRight className="w-5 h-5" />
            Вывести
          </Button>

          <div className="text-xs text-white/60 mt-3">
            Выплаты в демо-режиме имитируются, реальных списаний нет.
          </div>
        </Card>
      </div>

      {/* Transactions */}
      <div className="px-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Операции</h2>
        <div className="space-y-3">
          {transactions.map((t) => (
            <Card key={t.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium text-gray-900">{t.description}</div>
                  <div className="text-sm text-gray-600 mt-1">{new Date(t.date).toLocaleString("ru-RU")}</div>
                </div>
                <div className={`font-semibold ${t.amount >= 0 ? "text-gray-900" : "text-gray-700"}`}>
                  {t.amount >= 0 ? "+" : ""}{t.amount.toLocaleString("ru-RU")} ₽
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div className="h-4" />
    </div>
  );
}
