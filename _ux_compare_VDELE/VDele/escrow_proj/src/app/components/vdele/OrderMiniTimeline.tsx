import React from "react";
import type { Order } from "../../types";
import { orderTimeline } from "../../stateMachine";

export function OrderMiniTimeline({ order }: { order: Order }) {
  const steps = orderTimeline(order);

  // compress to 4 meaningful steps
  const take = steps.slice(0, 4);

  const dotClass = (s: (typeof take)[number]["state"]) => {
    if (s === "completed") return "bg-[#14B8A6]";
    if (s === "active") return "bg-[#14B8A6] shadow-[0_0_0_6px_rgba(20,184,166,0.18)]";
    if (s === "disputed") return "bg-red-500";
    return "bg-gray-300";
  };

  const lineClass = (s: (typeof take)[number]["state"]) => {
    if (s === "completed") return "bg-[#14B8A6]/70";
    if (s === "active") return "bg-[#14B8A6]/40";
    if (s === "disputed") return "bg-red-500/50";
    return "bg-gray-200";
  };

  return (
    <div className="mt-3">
      <div className="flex items-center gap-2">
        {take.map((st, i) => (
          <React.Fragment key={i}>
            <div className={`w-2.5 h-2.5 rounded-full ${dotClass(st.state)}`} />
            {i < take.length - 1 && <div className={`h-[2px] flex-1 rounded ${lineClass(take[i].state)}`} />}
          </React.Fragment>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-gray-500">
        {take.map((st, i) => (
          <div key={i} className="max-w-[25%] truncate">
            {st.label}
          </div>
        ))}
      </div>
    </div>
  );
}
