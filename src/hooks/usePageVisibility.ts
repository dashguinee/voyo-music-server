/**
 * Page Visibility Hook for Battery Optimization
 * Pauses expensive operations when tab is hidden
 */

import { useState, useEffect } from 'react';

export function usePageVisibility(): boolean {
  const [isVisible, setIsVisible] = useState(!document.hidden);

  useEffect(() => {
    const handleVisibility = () => {
      setIsVisible(!document.hidden);
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  return isVisible;
}

/**
 * Returns animation state based on page visibility
 * Use with framer-motion: animate={shouldAnimate ? {...} : undefined}
 */
export function useAnimationPause(): boolean {
  return usePageVisibility();
}
