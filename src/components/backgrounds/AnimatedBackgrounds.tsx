/**
 * VOYO Animated Backgrounds & Reaction Canvas
 *
 * Simple, clean background with reaction animations.
 * When users tap reactions, they pop up and float in the space.
 *
 * NEW: Custom image backdrop with user controls (blur, animation, upload)
 */

import { motion, AnimatePresence } from 'framer-motion';
import { usePlayerStore } from '../../store/playerStore';
import { useState, useEffect, useRef } from 'react';

export type BackgroundType = 'glow' | 'particles' | 'aurora' | 'none' | 'custom';

// Custom backdrop animation types
export type CustomAnimation = 'none' | 'zoom' | 'pan';

// LocalStorage keys
const STORAGE_KEYS = {
  IMAGE: 'voyo_custom_backdrop',
  BLUR: 'voyo_custom_blur',
  ANIMATION: 'voyo_custom_animation',
  BRIGHTNESS: 'voyo_custom_brightness',
};

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
// PARTICLE FIELD - Floating particles
// MOBILE OPTIMIZED: Pure CSS animations with GPU acceleration
// ============================================
const ParticleField = () => {
  // Generate 25 particles with random properties
  const particles = Array.from({ length: 25 }, (_, i) => {
    const left = Math.random() * 100; // Random horizontal position
    const size = 2 + Math.random() * 2; // 2-4px
    const duration = 8 + Math.random() * 8; // 8-16s animation duration
    const delay = Math.random() * 8; // Random start delay
    const xDrift = (Math.random() - 0.5) * 100; // Horizontal drift: -50 to 50px

    // Randomize color between purple and pink tones
    const colors = [
      'rgba(147, 51, 234, 0.6)', // Purple
      'rgba(168, 85, 247, 0.6)', // Light purple
      'rgba(219, 39, 119, 0.6)', // Pink
      'rgba(236, 72, 153, 0.6)', // Light pink
      'rgba(192, 132, 252, 0.5)', // Violet
    ];
    const color = colors[Math.floor(Math.random() * colors.length)];

    return {
      id: i,
      left: `${left}%`,
      size: `${size}px`,
      duration: `${duration}s`,
      delay: `${delay}s`,
      xDrift: `${xDrift}px`,
      color,
    };
  });

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <style>{`
        @keyframes particle-float {
          0% {
            transform: translateY(0) translateX(0);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateY(-100vh) translateX(var(--x-drift));
            opacity: 0;
          }
        }
      `}</style>

      {particles.map(particle => (
        <div
          key={particle.id}
          className="absolute rounded-full"
          style={{
            left: particle.left,
            bottom: '-10px',
            width: particle.size,
            height: particle.size,
            backgroundColor: particle.color,
            boxShadow: `0 0 ${parseInt(particle.size) * 2}px ${particle.color}`,
            animation: `particle-float ${particle.duration} linear ${particle.delay} infinite`,
            willChange: 'transform, opacity',
            // @ts-ignore - CSS custom property
            '--x-drift': particle.xDrift,
          }}
        />
      ))}
    </div>
  );
};

// ============================================
// AURORA EFFECT - Dreamy Northern Lights
// MOBILE OPTIMIZED: Reduced blur on mobile for smooth performance
// ============================================
const AuroraEffect = () => {
  // Detect mobile/Android for performance optimization
  const isMobile = typeof window !== 'undefined' && (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    window.innerWidth < 768
  );
  const isAndroid = typeof window !== 'undefined' && /Android/i.test(navigator.userAgent);

  // Mobile gets reduced blur (Android even more reduced due to GPU limitations)
  const blurLevel = isAndroid ? 15 : isMobile ? 25 : 60;
  const blurLevel2 = isAndroid ? 18 : isMobile ? 30 : 70;

  // On Android, use only 2 layers instead of 4 for better performance
  if (isAndroid) {
    return (
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Simplified Aurora for Android - Single flowing gradient */}
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at 50% 80%, rgba(147, 51, 234, 0.2) 0%, rgba(168, 85, 247, 0.12) 30%, rgba(236, 72, 153, 0.08) 50%, transparent 70%)',
            animation: 'aurora-mobile 8s ease-in-out infinite',
            willChange: 'transform',
          }}
        />

        {/* Secondary glow layer */}
        <div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at 30% 60%, rgba(139, 92, 246, 0.15) 0%, transparent 50%)',
            animation: 'aurora-mobile-secondary 10s ease-in-out infinite',
            willChange: 'transform',
          }}
        />

        <style>{`
          @keyframes aurora-mobile {
            0%, 100% {
              transform: translateY(0%) scale(1);
              opacity: 1;
            }
            50% {
              transform: translateY(-5%) scale(1.05);
              opacity: 0.85;
            }
          }

          @keyframes aurora-mobile-secondary {
            0%, 100% {
              transform: translateX(0%) translateY(0%);
              opacity: 0.8;
            }
            50% {
              transform: translateX(5%) translateY(-3%);
              opacity: 1;
            }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Aurora Layer 1 - Purple to Teal */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(135deg, rgba(147, 51, 234, 0.15) 0%, rgba(20, 184, 166, 0.1) 50%, transparent 100%)',
          filter: `blur(${blurLevel}px)`,
          transform: 'translateY(0%) scale(1.2)',
          animation: 'aurora-wave-1 12s ease-in-out infinite',
          willChange: 'transform, opacity',
        }}
      />

      {/* Aurora Layer 2 - Pink to Blue */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(225deg, rgba(236, 72, 153, 0.12) 0%, rgba(59, 130, 246, 0.08) 50%, transparent 100%)',
          filter: `blur(${blurLevel2}px)`,
          transform: 'translateY(0%) scale(1.1)',
          animation: 'aurora-wave-2 15s ease-in-out infinite',
          animationDelay: '2s',
          willChange: 'transform, opacity',
        }}
      />

      {/* Aurora Layer 3 - Teal Accent (Skip on mobile for perf) */}
      {!isMobile && (
        <div
          className="absolute top-0 left-0 right-0 h-[70%]"
          style={{
            background: 'linear-gradient(180deg, rgba(20, 184, 166, 0.1) 0%, rgba(168, 85, 247, 0.08) 60%, transparent 100%)',
            filter: 'blur(80px)',
            transform: 'translateX(0%)',
            animation: 'aurora-wave-3 18s ease-in-out infinite',
            animationDelay: '4s',
            willChange: 'transform, opacity',
          }}
        />
      )}

      {/* Aurora Layer 4 - Purple Curtain (Skip on mobile for perf) */}
      {!isMobile && (
        <div
          className="absolute bottom-0 left-0 right-0 h-[60%]"
          style={{
            background: 'linear-gradient(0deg, rgba(139, 92, 246, 0.12) 0%, rgba(236, 72, 153, 0.06) 50%, transparent 100%)',
            filter: 'blur(90px)',
            transform: 'translateX(0%)',
            animation: 'aurora-wave-4 20s ease-in-out infinite',
            animationDelay: '6s',
            willChange: 'transform, opacity',
          }}
        />
      )}

      {/* Subtle shimmer overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 50% 50%, rgba(255, 255, 255, 0.03) 0%, transparent 60%)',
          animation: 'aurora-shimmer 8s ease-in-out infinite',
          willChange: 'opacity',
        }}
      />

      {/* CSS Keyframes injected via style tag */}
      <style>{`
        @keyframes aurora-wave-1 {
          0%, 100% {
            transform: translateY(0%) translateX(0%) scale(1.2) rotate(0deg);
            opacity: 1;
          }
          25% {
            transform: translateY(-8%) translateX(5%) scale(1.25) rotate(1deg);
            opacity: 0.9;
          }
          50% {
            transform: translateY(-5%) translateX(-3%) scale(1.15) rotate(-1deg);
            opacity: 1;
          }
          75% {
            transform: translateY(-10%) translateX(3%) scale(1.22) rotate(0.5deg);
            opacity: 0.95;
          }
        }

        @keyframes aurora-wave-2 {
          0%, 100% {
            transform: translateY(0%) translateX(0%) scale(1.1) rotate(0deg);
            opacity: 1;
          }
          30% {
            transform: translateY(6%) translateX(-4%) scale(1.18) rotate(-1deg);
            opacity: 0.85;
          }
          60% {
            transform: translateY(-4%) translateX(6%) scale(1.12) rotate(1deg);
            opacity: 1;
          }
          85% {
            transform: translateY(3%) translateX(-2%) scale(1.15) rotate(-0.5deg);
            opacity: 0.9;
          }
        }

        @keyframes aurora-wave-3 {
          0%, 100% {
            transform: translateX(0%) translateY(0%) scale(1);
            opacity: 1;
          }
          35% {
            transform: translateX(8%) translateY(-3%) scale(1.08);
            opacity: 0.8;
          }
          65% {
            transform: translateX(-6%) translateY(2%) scale(1.05);
            opacity: 1;
          }
          90% {
            transform: translateX(4%) translateY(-1%) scale(1.06);
            opacity: 0.9;
          }
        }

        @keyframes aurora-wave-4 {
          0%, 100% {
            transform: translateX(0%) translateY(0%) scale(1);
            opacity: 1;
          }
          40% {
            transform: translateX(-7%) translateY(-4%) scale(1.1);
            opacity: 0.9;
          }
          70% {
            transform: translateX(5%) translateY(3%) scale(1.05);
            opacity: 0.85;
          }
          95% {
            transform: translateX(-3%) translateY(-2%) scale(1.07);
            opacity: 0.95;
          }
        }

        @keyframes aurora-shimmer {
          0%, 100% {
            opacity: 0.4;
          }
          50% {
            opacity: 0.7;
          }
        }
      `}</style>
    </div>
  );
};

// ============================================
// CUSTOM IMAGE BACKDROP - User uploaded image with controls
// ============================================
const CustomBackdrop = () => {
  const [imageData, setImageData] = useState<string | null>(null);
  const [blur, setBlur] = useState<number>(10);
  const [animation, setAnimation] = useState<CustomAnimation>('none');
  const [brightness, setBrightness] = useState<number>(0.5);

  // Load settings from localStorage
  useEffect(() => {
    const loadedImage = localStorage.getItem(STORAGE_KEYS.IMAGE);
    const loadedBlur = localStorage.getItem(STORAGE_KEYS.BLUR);
    const loadedAnimation = localStorage.getItem(STORAGE_KEYS.ANIMATION);
    const loadedBrightness = localStorage.getItem(STORAGE_KEYS.BRIGHTNESS);

    if (loadedImage) setImageData(loadedImage);
    if (loadedBlur) setBlur(Number(loadedBlur));
    if (loadedAnimation) setAnimation(loadedAnimation as CustomAnimation);
    if (loadedBrightness) setBrightness(Number(loadedBrightness));
  }, []);

  // If no image uploaded, fallback to glow
  if (!imageData) {
    return <AmbientGlow />;
  }

  // Animation styles
  const getAnimationStyle = () => {
    switch (animation) {
      case 'zoom':
        return 'animate-backdrop-zoom';
      case 'pan':
        return 'animate-backdrop-pan';
      case 'none':
      default:
        return '';
    }
  };

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div
        className={`absolute inset-0 bg-cover bg-center ${getAnimationStyle()}`}
        style={{
          backgroundImage: `url(${imageData})`,
          filter: `blur(${blur}px) brightness(${brightness})`,
          willChange: animation !== 'none' ? 'transform' : 'auto',
        }}
      />
      {/* Overlay to maintain readability */}
      <div className="absolute inset-0 bg-black/40" />
    </div>
  );
};

// ============================================
// CUSTOM BACKDROP SETTINGS - Controls for custom image
// ============================================
interface CustomBackdropSettingsProps {
  onClose: () => void;
}

export const CustomBackdropSettings = ({ onClose }: CustomBackdropSettingsProps) => {
  const [imageData, setImageData] = useState<string | null>(null);
  const [blur, setBlur] = useState<number>(10);
  const [animation, setAnimation] = useState<CustomAnimation>('none');
  const [brightness, setBrightness] = useState<number>(0.5);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load settings from localStorage
  useEffect(() => {
    const loadedImage = localStorage.getItem(STORAGE_KEYS.IMAGE);
    const loadedBlur = localStorage.getItem(STORAGE_KEYS.BLUR);
    const loadedAnimation = localStorage.getItem(STORAGE_KEYS.ANIMATION);
    const loadedBrightness = localStorage.getItem(STORAGE_KEYS.BRIGHTNESS);

    if (loadedImage) setImageData(loadedImage);
    if (loadedBlur) setBlur(Number(loadedBlur));
    if (loadedAnimation) setAnimation(loadedAnimation as CustomAnimation);
    if (loadedBrightness) setBrightness(Number(loadedBrightness));
  }, []);

  // Handle image upload
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      setImageData(base64);
      localStorage.setItem(STORAGE_KEYS.IMAGE, base64);
    };
    reader.readAsDataURL(file);
  };

  // Update blur
  const handleBlurChange = (value: number) => {
    setBlur(value);
    localStorage.setItem(STORAGE_KEYS.BLUR, value.toString());
  };

  // Update animation
  const handleAnimationChange = (value: CustomAnimation) => {
    setAnimation(value);
    localStorage.setItem(STORAGE_KEYS.ANIMATION, value);
  };

  // Update brightness
  const handleBrightnessChange = (value: number) => {
    setBrightness(value);
    localStorage.setItem(STORAGE_KEYS.BRIGHTNESS, value.toString());
  };

  // Remove custom image
  const handleRemoveImage = () => {
    setImageData(null);
    localStorage.removeItem(STORAGE_KEYS.IMAGE);
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Settings Panel */}
      <motion.div
        className="relative w-full max-w-md bg-[#0a0a0f]/95 backdrop-blur-xl rounded-t-3xl p-6 pb-10 border-t border-white/10 max-h-[80vh] overflow-y-auto"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-6" />

        <h3 className="text-lg font-bold text-white mb-4 text-center" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
          Custom Backdrop
        </h3>

        {/* Preview */}
        {imageData && (
          <div className="mb-6 relative rounded-2xl overflow-hidden h-40 border border-white/10">
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `url(${imageData})`,
                filter: `blur(${blur}px) brightness(${brightness})`,
              }}
            />
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <span className="text-white/80 text-sm">Preview</span>
            </div>
          </div>
        )}

        {/* Image Upload */}
        <div className="mb-6">
          <label className="block text-white/70 text-sm font-medium mb-2">
            Background Image
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          <div className="flex gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/50 text-purple-300 px-4 py-3 rounded-xl font-medium transition-colors"
            >
              {imageData ? 'Change Image' : 'Upload Image'}
            </button>
            {imageData && (
              <button
                onClick={handleRemoveImage}
                className="bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-300 px-4 py-3 rounded-xl font-medium transition-colors"
              >
                Remove
              </button>
            )}
          </div>
        </div>

        {/* Blur Control */}
        <div className="mb-6">
          <label className="block text-white/70 text-sm font-medium mb-2">
            Blur: {blur}px
          </label>
          <input
            type="range"
            min="0"
            max="20"
            value={blur}
            onChange={(e) => handleBlurChange(Number(e.target.value))}
            className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer slider-thumb"
          />
        </div>

        {/* Brightness Control */}
        <div className="mb-6">
          <label className="block text-white/70 text-sm font-medium mb-2">
            Brightness: {Math.round(brightness * 100)}%
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={brightness}
            onChange={(e) => handleBrightnessChange(Number(e.target.value))}
            className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer slider-thumb"
          />
        </div>

        {/* Animation Control */}
        <div className="mb-6">
          <label className="block text-white/70 text-sm font-medium mb-2">
            Animation
          </label>
          <div className="flex gap-2">
            {(['none', 'zoom', 'pan'] as CustomAnimation[]).map((anim) => (
              <button
                key={anim}
                onClick={() => handleAnimationChange(anim)}
                className={`flex-1 px-4 py-3 rounded-xl font-medium transition-colors capitalize ${
                  animation === anim
                    ? 'bg-purple-500/30 border border-purple-500/50 text-purple-300'
                    : 'bg-white/5 border border-white/10 text-white/70 hover:bg-white/10'
                }`}
              >
                {anim}
              </button>
            ))}
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full bg-white/10 hover:bg-white/20 text-white px-4 py-3 rounded-xl font-medium transition-colors"
        >
          Done
        </button>
      </motion.div>
    </motion.div>
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
    case 'particles':
      return <ParticleField />;
    case 'aurora':
      return <AuroraEffect />;
    case 'custom':
      return <CustomBackdrop />;
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
  const [showCustomSettings, setShowCustomSettings] = useState(false);

  const options: { type: BackgroundType; label: string; icon: string }[] = [
    { type: 'none', label: 'Clean', icon: '🌑' },
    { type: 'glow', label: 'Glow', icon: '💜' },
    { type: 'particles', label: 'Particles', icon: '✨' },
    { type: 'aurora', label: 'Aurora', icon: '🌌' },
    { type: 'custom', label: 'Custom', icon: '🖼️' },
  ];

  const handleSelect = (type: BackgroundType) => {
    if (type === 'custom') {
      // Show custom settings instead of closing
      setShowCustomSettings(true);
      onSelect(type);
    } else {
      onSelect(type);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {!showCustomSettings ? (
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

                <div className="grid grid-cols-2 gap-4">
                  {options.map(option => (
                    <motion.button
                      key={option.type}
                      className={`flex flex-col items-center gap-2 p-4 rounded-2xl transition-colors ${
                        current === option.type
                          ? 'bg-purple-500/30 border border-purple-500/50'
                          : 'bg-white/5 border border-white/10 hover:bg-white/10'
                      }`}
                      onClick={() => handleSelect(option.type)}
                      whileTap={{ scale: 0.95 }}
                    >
                      <span className="text-3xl">{option.icon}</span>
                      <span className="text-sm text-white/70 font-medium">{option.label}</span>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          ) : (
            <CustomBackdropSettings
              onClose={() => {
                setShowCustomSettings(false);
                onClose();
              }}
            />
          )}
        </>
      )}
    </AnimatePresence>
  );
};

export default AnimatedBackground;
