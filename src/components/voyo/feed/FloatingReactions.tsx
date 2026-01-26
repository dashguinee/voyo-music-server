/**
 * FloatingReactions - TikTok Live Style Rising Reactions
 *
 * Bubbles that float up when users react to tracks.
 * Creates that viral, social media feel.
 *
 * Features:
 * - Reactions rise with slight wobble
 * - Different colors per reaction type
 * - Size varies based on reaction "power"
 * - Fades out at top
 * - Reaction storm mode (double-tap)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Zap, Flame } from 'lucide-react';
import type { ReactionType } from '../../../store/reactionStore';

// Single floating reaction
interface FloatingReaction {
  id: string;
  type: ReactionType;
  x: number; // 0-100 percentage from left
  createdAt: number;
  size: 'sm' | 'md' | 'lg';
  isStorm?: boolean; // Part of a reaction storm
}

// Reaction config
const REACTION_CONFIG: Record<ReactionType, {
  icon: typeof Heart;
  colors: string[];
  glow: string;
}> = {
  like: {
    icon: Heart,
    colors: ['#EC4899', '#F472B6', '#DB2777'],
    glow: 'rgba(236, 72, 153, 0.6)',
  },
  oye: {
    icon: Zap,
    colors: ['#FBBF24', '#F59E0B', '#FCD34D'],
    glow: 'rgba(251, 191, 36, 0.6)',
  },
  fire: {
    icon: Flame,
    colors: ['#F97316', '#EA580C', '#FB923C'],
    glow: 'rgba(249, 115, 22, 0.6)',
  },
};

interface FloatingReactionsProps {
  isActive: boolean;
}

export const FloatingReactions = ({ isActive }: FloatingReactionsProps) => {
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Add a single reaction
  const addReaction = useCallback((type: ReactionType, isStorm = false) => {
    const newReaction: FloatingReaction = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      type,
      x: 70 + Math.random() * 25, // Right side of screen (70-95%)
      createdAt: Date.now(),
      size: isStorm
        ? (['sm', 'md', 'lg'] as const)[Math.floor(Math.random() * 3)]
        : Math.random() > 0.7 ? 'lg' : Math.random() > 0.4 ? 'md' : 'sm',
      isStorm,
    };

    setReactions(prev => [...prev, newReaction]);

    // Remove after animation
    setTimeout(() => {
      setReactions(prev => prev.filter(r => r.id !== newReaction.id));
    }, isStorm ? 2500 : 3500);
  }, []);

  // Trigger reaction storm (multiple reactions at once)
  const triggerStorm = useCallback((type: ReactionType, count = 12) => {
    // Burst reactions with staggered timing
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        addReaction(type, true);
      }, i * 80);
    }
  }, [addReaction]);

  // Expose methods globally for other components to use
  useEffect(() => {
    if (isActive) {
      (window as any).__voyoFloatingReactions = {
        addReaction,
        triggerStorm,
      };
    }
    return () => {
      delete (window as any).__voyoFloatingReactions;
    };
  }, [isActive, addReaction, triggerStorm]);

  if (!isActive) return null;

  const getSizeClass = (size: FloatingReaction['size']) => {
    switch (size) {
      case 'sm': return 'w-6 h-6';
      case 'md': return 'w-8 h-8';
      case 'lg': return 'w-10 h-10';
    }
  };

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none overflow-hidden z-40"
    >
      <AnimatePresence>
        {reactions.map((reaction) => {
          const config = REACTION_CONFIG[reaction.type];
          const Icon = config.icon;
          const color = config.colors[Math.floor(Math.random() * config.colors.length)];

          return (
            <motion.div
              key={reaction.id}
              className={`absolute ${getSizeClass(reaction.size)} flex items-center justify-center`}
              style={{
                left: `${reaction.x}%`,
                bottom: '15%',
              }}
              initial={{
                y: 0,
                opacity: 1,
                scale: 0,
                rotate: -10 + Math.random() * 20,
              }}
              animate={{
                y: -450 - Math.random() * 100,
                opacity: [1, 1, 1, 0],
                scale: [0, 1.2, 1, 0.8],
                x: [0, Math.sin(reaction.createdAt) * 30, Math.sin(reaction.createdAt + 1) * -20, 0],
                rotate: [-10, 10, -5, 0],
              }}
              exit={{
                opacity: 0,
                scale: 0.5,
              }}
              transition={{
                duration: reaction.isStorm ? 2.5 : 3.5,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <Icon
                className={`${getSizeClass(reaction.size)}`}
                style={{
                  color: color,
                  fill: color,
                  filter: `drop-shadow(0 0 8px ${config.glow})`,
                }}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

// Hook to trigger floating reactions from anywhere
export const useFloatingReactions = () => {
  const addReaction = useCallback((type: ReactionType) => {
    const api = (window as any).__voyoFloatingReactions;
    if (api?.addReaction) {
      api.addReaction(type);
    }
  }, []);

  const triggerStorm = useCallback((type: ReactionType, count = 12) => {
    const api = (window as any).__voyoFloatingReactions;
    if (api?.triggerStorm) {
      api.triggerStorm(type, count);
    }
  }, []);

  return { addReaction, triggerStorm };
};

// Double-tap detector hook
export const useDoubleTap = (
  onDoubleTap: () => void,
  onSingleTap?: () => void,
  delay = 300
) => {
  const lastTapRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTap = useCallback(() => {
    const now = Date.now();
    const timeSinceLast = now - lastTapRef.current;

    if (timeSinceLast < delay) {
      // Double tap detected
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      onDoubleTap();
      lastTapRef.current = 0;
    } else {
      // Single tap - wait to see if it becomes double
      lastTapRef.current = now;
      if (onSingleTap) {
        timeoutRef.current = setTimeout(() => {
          onSingleTap();
          lastTapRef.current = 0;
        }, delay);
      }
    }
  }, [delay, onDoubleTap, onSingleTap]);

  return handleTap;
};

export default FloatingReactions;
