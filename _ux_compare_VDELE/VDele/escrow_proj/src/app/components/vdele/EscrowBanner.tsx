import React from "react";
import { ShieldAlert, ShieldCheck, Shield, ShieldOff } from "lucide-react";
import type { EscrowStatus } from "../../types";
import { escrowBannerText } from "../../stateMachine";

export function EscrowBanner({ status }: { status: EscrowStatus }) {
  const info = escrowBannerText(status);

  const toneStyles =
    info.tone === "teal" ? "border-teal-500/30 bg-teal-500/10 text-white"
    : info.tone === "red" ? "border-red-500/30 bg-red-500/10 text-white"
    : info.tone === "yellow" ? "border-amber-500/30 bg-amber-500/10 text-white"
    : "border-white/10 bg-white/5 text-white";

  const Icon =
    info.tone === "teal" ? ShieldCheck
    : info.tone === "red" ? ShieldAlert
    : info.tone === "yellow" ? ShieldAlert
    : Shield;

  return (
    <div className={`rounded-2xl border px-4 py-3 bg-gradient-to-b from-[#0B1220] to-[#111827] ${toneStyles}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5"><Icon className="w-5 h-5" /></div>
        <div className="min-w-0">
          <div className="font-semibold text-sm">{info.title}</div>
          <div className="text-xs opacity-80 mt-0.5">{info.body}</div>
        </div>
      </div>
    </div>
  );
}
