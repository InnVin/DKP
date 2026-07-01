import React from "react";
import type { Order } from "../../types";
import { Timeline } from "./Timeline";
import { orderTimeline } from "../../stateMachine";

export function OrderTimeline({ order }: { order: Order }) {
  const steps = orderTimeline(order);
  return <Timeline steps={steps} />;
}
