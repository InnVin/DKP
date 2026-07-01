import React from 'react';
import { createBrowserRouter } from 'react-router';

// Layouts (nested routes with persistent tab bar)
import CustomerTabLayout from './layouts/CustomerTabLayout';
import SpecialistTabLayout from './layouts/SpecialistTabLayout';

// Customer screens (tab sections)
import CustomerHome from './customer/Home';
import CustomerOrders from './customer/Orders';
import CustomerSearch from './customer/Search';
import CustomerProfile from './customer/Profile';

// Customer flows (no tab bar)
import CategoryServices from './customer/CategoryServices';
import ServiceConfigurator from './customer/ServiceConfigurator';
import Quote from './customer/Quote';
import SpecialistPicker from './customer/SpecialistPicker';
import Review from './customer/Review';
import Payment from './customer/Payment';
import OrderDetails from './customer/OrderDetails';
import ExpressOrder from './customer/ExpressOrder';
import Legal from './customer/Legal';

// Specialist screens (tab sections)
import SpecialistDashboard from './specialist/Dashboard';
import SpecialistWallet from './specialist/Wallet';
import SpecialistProfile from './specialist/Profile';

// Specialist flows (no tab bar)
import SpecialistOrderDetails from './specialist/OrderDetails';
import SpecialistWithdraw from './specialist/Withdraw';

// Admin screens
import AdminDashboard from './admin/Dashboard';
import AdminOrders from './admin/Orders';
import AdminDisputes from './admin/Disputes';
import AdminCatalog from './admin/Catalog';
import AdminPayouts from './admin/Payouts';
import AdminSpecialists from './admin/Specialists';

import { VDELE_LOGO_B64 as vdeleLogo } from '../assets/icon-base64';

function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0B1220] to-[#111827] text-white flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-5">
            <img
              src={vdeleLogo}
              alt="В ДЕЛЕ"
              className="h-16 md:h-20 w-auto drop-shadow-[0_10px_30px_rgba(20,184,166,0.20)]"
            />
          </div>
          <p className="text-xl text-white/80">Escrow-first marketplace ремонтных и бытовых услуг</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <a
            href="/customer"
            className="bg-gradient-to-br from-[#0F766E] to-[#14B8A6] rounded-[24px] p-8 text-center hover:shadow-[0_12px_35px_rgba(20,184,166,0.45)] transition-all duration-300 hover:scale-105"
          >
            <div className="text-5xl mb-4">👤</div>
            <h2 className="text-2xl font-semibold mb-2">Заказчик</h2>
            <p className="text-white/80">Создание заказа и подтверждение</p>
          </a>

          <a
            href="/specialist"
            className="bg-[#111827] rounded-[24px] p-8 text-center border border-white/10 hover:border-[#14B8A6]/40 hover:shadow-[0_12px_35px_rgba(20,184,166,0.22)] transition-all duration-300 hover:scale-105"
          >
            <div className="text-5xl mb-4">🧰</div>
            <h2 className="text-2xl font-semibold mb-2">Специалист</h2>
            <p className="text-white/70">Приём и выполнение заказов</p>
          </a>

          <a
            href="/admin"
            className="bg-[#111827] rounded-[24px] p-8 text-center border border-white/10 hover:border-[#14B8A6]/40 hover:shadow-[0_12px_35px_rgba(20,184,166,0.22)] transition-all duration-300 hover:scale-105"
          >
            <div className="text-5xl mb-4">🛡️</div>
            <h2 className="text-2xl font-semibold mb-2">Админка</h2>
            <p className="text-white/70">Заказы, споры, выплаты</p>
          </a>
        </div>

        <div className="mt-10 text-center">
          <p className="text-white/60 text-sm">
            Демо-режим: все действия выполняются на мок-данных в браузере.
          </p>
        </div>
      </div>
    </div>
  );
}

export const router = createBrowserRouter([
  { path: '/', Component: LandingPage },

  // CUSTOMER (tabs)
  {
    path: '/customer',
    Component: CustomerTabLayout,
    children: [
      { index: true, Component: CustomerHome },
      { path: 'orders', Component: CustomerOrders },
      { path: 'profile', Component: CustomerProfile },
    ],
  },

  // CUSTOMER flows (no tabs)
  { path: '/customer/search', Component: CustomerSearch },
  { path: '/customer/express', Component: ExpressOrder },
  { path: '/customer/legal', Component: Legal },
  { path: '/customer/category/:categoryId', Component: CategoryServices },
  { path: '/customer/service/:serviceId', Component: ServiceConfigurator },
  { path: '/customer/quote', Component: Quote },
  { path: '/customer/pick-specialist', Component: SpecialistPicker },
  { path: '/customer/review', Component: Review },
  { path: '/customer/payment', Component: Payment },
  { path: '/customer/orders/:orderId', Component: OrderDetails },

  // SPECIALIST (tabs)
  {
    path: '/specialist',
    Component: SpecialistTabLayout,
    children: [
      { index: true, Component: SpecialistDashboard },
      { path: 'wallet', Component: SpecialistWallet },
      { path: 'profile', Component: SpecialistProfile },
    ],
  },

  // SPECIALIST flows (no tabs)
  { path: '/specialist/withdraw', Component: SpecialistWithdraw },
  { path: '/specialist/orders/:orderId', Component: SpecialistOrderDetails },

  // ADMIN
  { path: '/admin', Component: AdminDashboard },
  { path: '/admin/disputes', Component: AdminDisputes },
  { path: '/admin/orders', Component: AdminOrders },
  { path: '/admin/catalog', Component: AdminCatalog },
  { path: '/admin/payouts', Component: AdminPayouts },
  { path: '/admin/specialists', Component: AdminSpecialists },

  // 404
  {
    path: '*',
    Component: () => (
      <div className="min-h-screen flex items-center justify-center bg-[#F2F2F7]">
        <div className="text-center">
          <h1 className="text-6xl font-bold text-gray-900 mb-4">404</h1>
          <p className="text-gray-600 mb-6">Страница не найдена</p>
          <a href="/" className="text-[#14B8A6] font-medium hover:underline">
            Вернуться на главную
          </a>
        </div>
      </div>
    ),
  },
]);
