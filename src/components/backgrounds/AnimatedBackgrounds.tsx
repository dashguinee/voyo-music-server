/**
 * VOYO Animated Backgrounds & Reaction Canvas
 *
 * Simple, clean background with reaction animations.
 * When users tap reactions, they pop up and float in the space.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { usePlayerStore } from '../../store/playerStore';

export type BackgroundType = 'glow' | 'none';

// Generate stable random offset from reaction ID (hash-based)
const getStableOffset = (id: string): number => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i);
    hash |= 0;
  }
  return ((hash % 100) - 50) * 1.2; // Range: -60 to 60
};

// ============================================
// REACTION CANVAS - Shows reactions when tapped
// ============================================
export const ReactionCanvas = () => {
  const { reactions } = usePlayerStore();

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-30">
      <AnimatePresence>
        {reactions.map(reaction => {
          // Use stored x position or derive stable position from ID
          const xPos = reaction.x || 50;
          const xOffset = getStableOffset(reaction.id);

          return (
            <motion.div
              key={reaction.id}
              className="absolute text-4xl"
              style={{
                left: `${xPos}%`,
                bottom: '30%',
              }}
              initial={{ y: 0, opacity: 1, scale: 0.5 }}
              animate={{
                y: -250,
                opacity: [1, 1, 0.8, 0],
                scale: [0.5, 1.3, 1],
                x: xOffset,
              }}
              exit={{ opacity: 0 }}
              transition={{
                duration: 2.5,
                ease: 'easeOut',
              }}
            >
              {/* Use stored emoji or fallback to type-based */}
              {reaction.emoji || (
                reaction.type === 'oyo' ? '👋' :
                reaction.type === 'oye' ? '🎉' :
                reaction.type === 'fire' ? '🔥' :
                reaction.type === 'wazzguan' ? '🤙' :
                '✨'
              )}
              {reaction.multiplier > 1 && (
                <span className="text-lg ml-1 text-yellow-400 font-bold">
                  x{reaction.multiplier}
                </span>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

// ============================================
// SIMPLE AMBIENT GLOW - Clean, cinematic
// MOBILE OPTIMIZED: Uses CSS animations instead of Framer Motion
// ============================================
const AmbientGlow = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Center glow - purple/pink - CSS animation for mobile performance */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[100%] h-[100%] rounded-full animate-ambient-breathe"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(147, 51, 234, 0.12) 0%, transparent 60%)',
          willChange: 'transform, opacity',
        }}
      />
      {/* Secondary glow - pink accent - CSS animation with different timing */}
      <div
        className="absolute top-1/3 right-1/4 w-[60%] h-[60%] rounded-full animate-ambient-secondary"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(219, 39, 119, 0.08) 0%, transparent 50%)',
          willChange: 'transform',
          animation: 'ambient-secondary 8s ease-in-out infinite',
        }}
      />
    </div>
  );
};

// ============================================
// MAIN EXPORT - Background Selector
// ============================================
interface AnimatedBackgroundProps {
  type: BackgroundType;
  mood?: 'chill' | 'hype' | 'vibe' | 'focus';
}

export const AnimatedBackground = ({ type }: AnimatedBackgroundProps) => {
  switch (type) {
    case 'glow':
      return <AmbientGlow />;
    case 'none':
    default:
      return null;
  }
};

// ============================================
// BACKGROUND PICKER UI (Simplified)
// ============================================
interface BackgroundPickerProps {
  current: BackgroundType;
  onSelect: (type: BackgroundType) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const BackgroundPicker = ({ current, onSelect, isOpen, onClose }: BackgroundPickerProps) => {
  const options: { type: BackgroundType; label: string; icon: string }[] = [
    { type: 'none', label: 'Clean', icon: '🌑' },
    { type: 'glow', label: 'Glow', icon: '💜' },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

          {/* Picker Panel */}
          <motion.div
            className="relative w-full max-w-md bg-[#0a0a0f]/95 backdrop-blur-xl rounded-t-3xl p-6 pb-10 border-t border-white/10"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            {/* Handle */}
            <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-6" />

            <h3 className="text-lg font-bold text-white mb-4 text-center" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              Background
            </h3>

            <div className="flex justify-center gap-4">
              {options.map(option => (
                <motion.button
                  key={option.type}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl transition-colors ${
                    current === option.type
                      ? 'bg-purple-500/30 border border-purple-500/50'
                      : 'bg-white/5 border border-white/10 hover:bg-white/10'
                  }`}
                  onClick={() => {
                    onSelect(option.type);
                    onClose();
                  }}
                  whileTap={{ scale: 0.95 }}
                >
                  <span className="text-3xl">{option.icon}</span>
                  <span className="text-sm text-white/70 font-medium">{option.label}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AnimatedBackground;
