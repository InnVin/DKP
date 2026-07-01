import React from "react";
import type { Milestone } from "../../types";
import { Check, AlertCircle } from "lucide-react";

interface Props { milestones: Milestone[]; className?: string }

const statusColor = (s: Milestone["status"]) => {
  if (s === "RELEASED" || s === "APPROVED") return { bg: "bg-emerald-500", ring: "ring-emerald-500/30", line: "bg-emerald-500" };
  if (s === "IN_PROGRESS" || s === "SUBMITTED" || s === "FUNDED") return { bg: "bg-teal-500", ring: "ring-teal-500/30", line: "bg-teal-500" };
  if (s === "DISPUTED") return { bg: "bg-red-500", ring: "ring-red-500/30", line: "bg-red-500" };
  return { bg: "bg-gray-300", ring: "ring-gray-300/30", line: "bg-gray-200" };
};

const isActive = (s: Milestone["status"]) => ["IN_PROGRESS", "SUBMITTED", "FUNDED"].includes(s);
const isDone = (s: Milestone["status"]) => ["RELEASED", "APPROVED"].includes(s);

export function MilestoneProgressBar({ milestones, className = "" }: Props) {
  const done = milestones.filter((m) => isDone(m.status)).length;
  const pct = milestones.length > 0 ? Math.round((done / milestones.length) * 100) : 0;

  return (
    <div className={className}>
      {/* Summary line */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-700">Прогресс: {done} из {milestones.length} этапов</span>
        <span className="text-sm font-semibold text-teal-600">{pct}%</span>
      </div>

      {/* Overall bar */}
      <div className="h-2 rounded-full bg-gray-100 mb-4 overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>

      {/* Step dots */}
      <div className="flex items-center">
        {milestones.map((ms, i) => {
          const c = statusColor(ms.status);
          const last = i === milestones.length - 1;
          return (
            <React.Fragment key={ms.id}>
              <div className="flex flex-col items-center" style={{ flex: last ? "0 0 auto" : 1 }}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ring-4 ${c.bg} ${c.ring} ${isActive(ms.status) ? "animate-pulse" : ""}`}>
                  {isDone(ms.status) ? <Check className="w-4 h-4" /> : ms.status === "DISPUTED" ? <AlertCircle className="w-4 h-4" /> : ms.seq}
                </div>
                <span className="text-[10px] text-gray-500 mt-1 max-w-[60px] text-center leading-tight truncate">{ms.name}</span>
              </div>
              {!last && (
                <div className="flex-1 mx-1 self-start mt-4">
                  <div className={`h-0.5 w-full rounded ${isDone(ms.status) ? c.line : "bg-gray-200"}`} />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
