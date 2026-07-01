import React from "react";
import { createHashRouter } from "react-router";
import CustomerTabLayout from "./layouts/CustomerTabLayout";
import SpecialistTabLayout from "./layouts/SpecialistTabLayout";
import CustomerHome from "./customer/Home";
import CustomerOrders from "./customer/Orders";
import CustomerSearch from "./customer/Search";
import CustomerProfile from "./customer/Profile";
import CategoryServices from "./customer/CategoryServices";
import ServiceConfigurator from "./customer/ServiceConfigurator";
import Quote from "./customer/Quote";
import SpecialistPicker from "./customer/SpecialistPicker";
import Review from "./customer/Review";
import Payment from "./customer/Payment";
import OrderDetails from "./customer/OrderDetails";
import ExpressOrder from "./customer/ExpressOrder";
import Legal from "./customer/Legal";
import SpecialistDashboard from "./specialist/Dashboard";
import SpecialistWallet from "./specialist/Wallet";
import SpecialistProfile from "./specialist/Profile";
import SpecialistOrderDetails from "./specialist/OrderDetails";
import SpecialistWithdraw from "./specialist/Withdraw";
import AdminDashboard from "./admin/Dashboard";
import AdminOrders from "./admin/Orders";
import AdminDisputes from "./admin/Disputes";
import AdminCatalog from "./admin/Catalog";
import AdminPayouts from "./admin/Payouts";
import AdminSpecialists from "./admin/Specialists";
import { VDELE_LOGO_B64 as vdeleLogo } from "../assets/icon-base64";

function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0B1220] to-[#111827] text-white flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <img src={vdeleLogo} alt="В Деле" className="h-20 mx-auto mb-5" style={{ objectFit: "contain" }} />
          <p className="text-xl text-white/80">Escrow-first marketplace</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <a href="#/customer" className="bg-gradient-to-br from-[#0F766E] to-[#14B8A6] rounded-[24px] p-8 text-center hover:scale-105 transition-all">
            <div className="text-5xl mb-4">\ud83d\udc64</div>
            <h2 className="text-2xl font-semibold">\u0417\u0430\u043a\u0430\u0437\u0447\u0438\u043a</h2>
          </a>
          <a href="#/specialist" className="bg-[#111827] rounded-[24px] p-8 text-center border border-white/10 hover:scale-105 transition-all">
            <div className="text-5xl mb-4">\ud83e\uddf0</div>
            <h2 className="text-2xl font-semibold">\u0421\u043f\u0435\u0446\u0438\u0430\u043b\u0438\u0441\u0442</h2>
          </a>
          <a href="#/admin" className="bg-[#111827] rounded-[24px] p-8 text-center border border-white/10 hover:scale-105 transition-all">
            <div className="text-5xl mb-4">\ud83d\udee1</div>
            <h2 className="text-2xl font-semibold">\u0410\u0434\u043c\u0438\u043d\u043a\u0430</h2>
          </a>
        </div>
      </div>
    </div>
  );
}

export const router = createHashRouter([
  { path: "/", Component: LandingPage },
  {
    path: "/customer", Component: CustomerTabLayout,
    children: [
      { index: true, Component: CustomerHome },
      { path: "orders", Component: CustomerOrders },
      { path: "profile", Component: CustomerProfile },
    ],
  },
  { path: "/customer/search", Component: CustomerSearch },
  { path: "/customer/express", Component: ExpressOrder },
  { path: "/customer/legal", Component: Legal },
  { path: "/customer/category/:categoryId", Component: CategoryServices },
  { path: "/customer/service/:serviceId", Component: ServiceConfigurator },
  { path: "/customer/quote", Component: Quote },
  { path: "/customer/pick-specialist", Component: SpecialistPicker },
  { path: "/customer/review", Component: Review },
  { path: "/customer/payment", Component: Payment },
  { path: "/customer/orders/:orderId", Component: OrderDetails },
  {
    path: "/specialist", Component: SpecialistTabLayout,
    children: [
      { index: true, Component: SpecialistDashboard },
      { path: "wallet", Component: SpecialistWallet },
      { path: "profile", Component: SpecialistProfile },
    ],
  },
  { path: "/specialist/withdraw", Component: SpecialistWithdraw },
  { path: "/specialist/orders/:orderId", Component: SpecialistOrderDetails },
  { path: "/admin", Component: AdminDashboard },
  { path: "/admin/disputes", Component: AdminDisputes },
  { path: "/admin/orders", Component: AdminOrders },
  { path: "/admin/catalog", Component: AdminCatalog },
  { path: "/admin/payouts", Component: AdminPayouts },
  { path: "/admin/specialists", Component: AdminSpecialists },
  { path: "*", Component: () => <div className="min-h-screen flex items-center justify-center"><a href="#/">404 — \u0413\u043b\u0430\u0432\u043d\u0430\u044f</a></div> },
]);
