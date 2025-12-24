/**
 * LottieIcon - Animated icon with emoji fallback
 *
 * Loads Lottie animation from URL, falls back to emoji on error
 */

import { useState, useEffect, useRef } from 'react';
import Lottie, { LottieRefCurrentProps } from 'lottie-react';

interface LottieIconProps {
  lottieUrl?: string;
  fallbackEmoji: string;
  size?: number;
  className?: string;
  loop?: boolean;
  autoplay?: boolean;
  speed?: number; // Animation speed multiplier (0.5 = half speed, 2 = double)
}

export function LottieIcon({
  lottieUrl,
  fallbackEmoji,
  size = 48,
  className = '',
  loop = true,
  autoplay = true,
  speed = 1,
}: LottieIconProps) {
  const [animationData, setAnimationData] = useState<object | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(!!lottieUrl);
  const lottieRef = useRef<LottieRefCurrentProps>(null);

  // Set speed when ref is ready
  useEffect(() => {
    if (lottieRef.current && speed !== 1) {
      lottieRef.current.setSpeed(speed);
    }
  }, [animationData, speed]);

  useEffect(() => {
    if (!lottieUrl) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(false);

    fetch(lottieUrl)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load');
        return res.json();
      })
      .then(data => {
        setAnimationData(data);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [lottieUrl]);

  // Show emoji if no lottie URL, loading failed, or still loading
  if (!lottieUrl || error || loading) {
    return (
      <span
        className={className}
        style={{
          fontSize: size * 0.8,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: size,
          height: size,
        }}
      >
        {fallbackEmoji}
      </span>
    );
  }

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Lottie
        lottieRef={lottieRef}
        animationData={animationData}
        loop={loop}
        autoplay={autoplay}
        style={{ width: size, height: size }}
      />
    </div>
  );
}

export default LottieIcon;
