import { ReactNode, useRef } from "react";
import { GestureResponderEvent, View } from "react-native";

type SwipeViewProps = {
  children: ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
};

export function SwipeView({ children, onSwipeLeft, onSwipeRight }: SwipeViewProps) {
  const start = useRef({ x: 0, y: 0 });

  const rememberStart = (event: GestureResponderEvent) => {
    start.current = {
      x: event.nativeEvent.pageX,
      y: event.nativeEvent.pageY,
    };
  };

  const finish = (event: GestureResponderEvent) => {
    const dx = event.nativeEvent.pageX - start.current.x;
    const dy = event.nativeEvent.pageY - start.current.y;
    if (Math.abs(dx) < 90 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0) onSwipeLeft?.();
    else onSwipeRight?.();
  };

  return (
    <View style={{ flex: 1 }} onTouchStart={rememberStart} onTouchEnd={finish}>
      {children}
    </View>
  );
}
