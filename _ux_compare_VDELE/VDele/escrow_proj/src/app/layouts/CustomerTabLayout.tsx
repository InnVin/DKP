import React from "react";
import { Outlet } from "react-router";
import { BottomNav } from "../components/vdele/BottomNav";

export default function CustomerTabLayout() {
  return (
    <div className="w-full h-screen flex flex-col bg-[#F2F2F7]">
      <div className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'none' } as any}>
        <Outlet />
      </div>
      <div
        className="bg-white/80 border-t border-gray-200/50 flex-shrink-0"
        style={{ backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)' } as any}
      >
        <BottomNav role="customer" />
      </div>
    </div>
  );
}
