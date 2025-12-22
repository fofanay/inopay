import { useState, useEffect, useCallback, useRef } from "react";

interface SwipeConfig {
  threshold?: number; // Minimum distance for swipe detection
  allowedTime?: number; // Maximum time for swipe
}

interface SwipeHandlers {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
}

export function useSwipeNavigation<T extends string>(
  tabs: T[],
  currentTab: T,
  onTabChange: (tab: T) => void,
  config: SwipeConfig = {}
): SwipeHandlers {
  const { threshold = 50, allowedTime = 300 } = config;
  
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const touchStartTime = useRef<number>(0);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
    touchStartTime.current = Date.now();
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartX.current;
    const deltaY = touch.clientY - touchStartY.current;
    const elapsedTime = Date.now() - touchStartTime.current;

    // Check if it's a horizontal swipe (not vertical scroll)
    if (
      elapsedTime <= allowedTime &&
      Math.abs(deltaX) > threshold &&
      Math.abs(deltaX) > Math.abs(deltaY) * 1.5 // Horizontal bias
    ) {
      const currentIndex = tabs.indexOf(currentTab);
      
      if (deltaX < 0 && currentIndex < tabs.length - 1) {
        // Swipe left -> next tab
        onTabChange(tabs[currentIndex + 1]);
      } else if (deltaX > 0 && currentIndex > 0) {
        // Swipe right -> previous tab
        onTabChange(tabs[currentIndex - 1]);
      }
    }
  }, [tabs, currentTab, onTabChange, threshold, allowedTime]);

  return { onTouchStart, onTouchEnd };
}
