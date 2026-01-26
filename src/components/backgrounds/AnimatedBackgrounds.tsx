/**
 * VOYO Backgrounds & Reaction Canvas
 *
 * Simple backgrounds: black or custom image.
 * Reaction animations pop up when users tap reactions.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { usePlayerStore } from '../../store/playerStore';
import { useState, useEffect, useRef } from 'react';

export type BackgroundType = 'none' | 'custom';

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

  // If no image uploaded, just show nothing (black bg)
  if (!imageData) {
    return null;
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
    case 'custom':
      return <CustomBackdrop />;
    case 'none':
    default:
      return null;
  }
};

// ============================================
// BACKGROUND PICKER UI - Simple toggle: Black or Custom Image
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
    { type: 'none', label: 'Black', icon: '🌑' },
    { type: 'custom', label: 'Image', icon: '🖼️' },
  ];

  const handleSelect = (type: BackgroundType) => {
    if (type === 'custom') {
      // Show custom settings for image upload
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
