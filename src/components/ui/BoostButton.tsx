/**
 * VOYO Boost Button - Lightning Power
 *
 * One button = Download HD + Audio Enhancement
 * Lightning bolt glows when boosted, pulses when charging
 *
 * Variants:
 * - toolbar: Matches RightToolbar button style (40x40, fits with Like/Settings)
 * - floating: Standalone ergonomic thumb position
 * - mini: Compact for tight spaces
 * - inline: Text + icon horizontal
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { usePlayerStore } from '../../store/playerStore';
import { useDownloadStore } from '../../store/downloadStore';
import { getThumbnailUrl } from '../../utils/imageHelpers';

interface BoostButtonProps {
  variant?: 'toolbar' | 'floating' | 'mini' | 'inline';
  className?: string;
}

// Preset color configurations
// 🟡 boosted (Yellow) | 🔵 calm (Blue) | 🟣 voyex (Purple) | 🔴 xtreme (Red)
const PRESET_COLORS = {
  boosted: {
    primary: '#fbbf24',    // Yellow
    secondary: '#f59e0b',
    light: '#fde047',
    glow: 'rgba(251,191,36,0.6)',
    bg: 'bg-yellow-500/30',
    border: 'border-yellow-400/60',
    shadow: 'shadow-yellow-500/30',
    text: 'text-yellow-400',
  },
  calm: {
    primary: '#3b82f6',    // Blue
    secondary: '#1d4ed8',
    light: '#60a5fa',
    glow: 'rgba(59,130,246,0.6)',
    bg: 'bg-blue-500/30',
    border: 'border-blue-400/60',
    shadow: 'shadow-blue-500/30',
    text: 'text-blue-400',
  },
  voyex: {
    primary: '#a855f7',    // Purple
    secondary: '#7c3aed',
    light: '#c084fc',
    glow: 'rgba(168,85,247,0.6)',
    bg: 'bg-purple-500/30',
    border: 'border-purple-400/60',
    shadow: 'shadow-purple-500/30',
    text: 'text-purple-400',
  },
  xtreme: {
    primary: '#ef4444',    // Red
    secondary: '#dc2626',
    light: '#f87171',
    glow: 'rgba(239,68,68,0.6)',
    bg: 'bg-red-500/30',
    border: 'border-red-400/60',
    shadow: 'shadow-red-500/30',
    text: 'text-red-400',
  },
};

type BoostPreset = 'boosted' | 'calm' | 'voyex' | 'xtreme';

// Clean Lightning Bolt SVG Icon - Color changes based on preset
const LightningIcon = ({ isGlowing, isCharging, size = 14, preset = 'boosted' }: { isGlowing: boolean; isCharging: boolean; size?: number; preset?: BoostPreset }) => {
  const colors = PRESET_COLORS[preset];
  const gradientId = `lightningGradient-${preset}`;
  const glowId = `lightningGlow-${preset}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="relative"
    >
      {/* Outer glow when boosted */}
      {isGlowing && (
        <motion.path
          d="M13 2L4 14h7l-2 8 11-12h-7l2-8z"
          fill={`url(#${glowId})`}
          filter="blur(4px)"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}

      {/* Main lightning bolt */}
      <motion.path
        d="M13 2L4 14h7l-2 8 11-12h-7l2-8z"
        fill={isGlowing ? `url(#${gradientId})` : "#6b6b7a"}
        stroke={isGlowing ? colors.primary : "transparent"}
        strokeWidth="0.5"
        animate={isCharging ? {
          opacity: [1, 0.6, 1],
          scale: [1, 1.1, 1]
        } : {}}
        transition={{ duration: 0.4, repeat: isCharging ? Infinity : 0 }}
      />

      {/* Gradients - dynamic based on preset */}
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={colors.light} />
          <stop offset="50%" stopColor={colors.primary} />
          <stop offset="100%" stopColor={colors.secondary} />
        </linearGradient>
        <linearGradient id={glowId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={colors.light} stopOpacity="0.6" />
          <stop offset="100%" stopColor={colors.secondary} stopOpacity="0.3" />
        </linearGradient>
      </defs>
    </svg>
  );
};

// Circular progress ring with priming animation
// Phase 1: 2 full spins (priming) → Phase 2: actual progress
const ProgressRing = ({ progress, isStarting, size = 44, preset = 'boosted' }: { progress: number; isStarting: boolean; size?: number; preset?: BoostPreset }) => {
  const colors = PRESET_COLORS[preset];
  const ringGradientId = `boostGradient-${preset}`;
  const [phase, setPhase] = useState<'priming' | 'progress'>('priming');
  const [primingRound, setPrimingRound] = useState(0);

  const strokeWidth = 3;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Handle priming animation (2 full rounds)
  useEffect(() => {
    if (!isStarting) {
      setPhase('priming');
      setPrimingRound(0);
      return;
    }

    // If we have real progress > 10%, skip to progress phase
    if (progress > 10) {
      setPhase('progress');
      return;
    }

    // Priming: 2 rounds of ~400ms each
    if (phase === 'priming' && primingRound < 2) {
      const timer = setTimeout(() => {
        setPrimingRound(prev => prev + 1);
      }, 400);
      return () => clearTimeout(timer);
    }

    // After 2 rounds, switch to progress phase
    if (primingRound >= 2) {
      setPhase('progress');
    }
  }, [isStarting, progress, phase, primingRound]);

  // Reset when not downloading
  useEffect(() => {
    if (!isStarting) {
      setPhase('priming');
      setPrimingRound(0);
    }
  }, [isStarting]);

  // Calculate stroke offset based on phase
  const getStrokeOffset = () => {
    if (phase === 'priming') {
      // Animate full circle based on priming round
      return 0; // Full circle during priming animation
    }
    // Real progress
    return circumference - (circumference * progress) / 100;
  };

  return (
    <svg
      className="absolute inset-0 -rotate-90 pointer-events-none"
      width={size}
      height={size}
      style={{ filter: `drop-shadow(0 0 4px ${colors.glow})` }}
    >
      {/* Background ring (dim) */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={`${colors.primary}26`}
        strokeWidth={strokeWidth}
      />
      {/* Progress ring */}
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={`url(#${ringGradientId})`}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={phase === 'priming' ? {
          // Priming: fill up completely, then reset
          strokeDashoffset: [circumference, 0, circumference, 0],
        } : {
          // Progress: show actual progress
          strokeDashoffset: getStrokeOffset(),
        }}
        transition={phase === 'priming' ? {
          duration: 0.8,
          times: [0, 0.45, 0.5, 1],
          ease: 'easeInOut',
        } : {
          duration: 0.3,
          ease: 'easeOut',
        }}
      />
      {/* Gradient definition - dynamic based on preset */}
      <defs>
        <linearGradient id={ringGradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={colors.light} />
          <stop offset="50%" stopColor={colors.primary} />
          <stop offset="100%" stopColor={colors.secondary} />
        </linearGradient>
      </defs>
    </svg>
  );
};

// Completion burst animation
const CompletionBurst = ({ onComplete, preset = 'boosted' }: { onComplete: () => void; preset?: BoostPreset }) => {
  const colors = PRESET_COLORS[preset];

  useEffect(() => {
    const timer = setTimeout(onComplete, 800);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      className="absolute inset-0 rounded-full pointer-events-none"
      initial={{ scale: 1, opacity: 1 }}
      animate={{
        scale: [1, 1.8, 2.2],
        opacity: [1, 0.6, 0],
        background: [`${colors.primary}99`, `${colors.secondary}66`, `${colors.secondary}00`]
      }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
    />
  );
};

// Spark particles when boosting
const BoostSparks = ({ preset = 'boosted' }: { preset?: BoostPreset }) => {
  const colors = PRESET_COLORS[preset];

  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible">
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full"
          style={{
            left: '50%',
            top: '50%',
            backgroundColor: colors.primary,
          }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{
            opacity: [0, 1, 0],
            scale: [0, 1, 0],
            x: [0, (Math.random() - 0.5) * 40],
            y: [0, (Math.random() - 0.5) * 40],
          }}
          transition={{
            duration: 0.6,
            delay: i * 0.1,
            repeat: Infinity,
            repeatDelay: 1,
          }}
        />
      ))}
    </div>
  );
};

export const BoostButton = ({ variant = 'toolbar', className = '' }: BoostButtonProps) => {
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const playbackSource = usePlayerStore((state) => state.playbackSource);
  const setPlaybackSource = usePlayerStore((state) => state.setPlaybackSource);
  const seekTo = usePlayerStore((state) => state.seekTo);
  const boostProfile = usePlayerStore((state) => state.boostProfile) as BoostPreset;
  const colors = PRESET_COLORS[boostProfile];

  const {
    boostTrack,
    getDownloadStatus,
    downloads,
    isTrackBoosted,
    lastBoostCompletion,
    checkCache,
  } = useDownloadStore();

  const [isBoosted, setIsBoosted] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [showSparks, setShowSparks] = useState(false);
  const [showBurst, setShowBurst] = useState(false);
  // Toggle state: true = using boosted, false = using original
  const [usingBoosted, setUsingBoosted] = useState(true);

  // Check if current track is already boosted
  useEffect(() => {
    const checkBoosted = async () => {
      if (!currentTrack?.trackId) {
        setIsBoosted(false);
        setIsChecking(false);
        return;
      }

      setIsChecking(true);
      const boosted = await isTrackBoosted(currentTrack.trackId);
      setIsBoosted(boosted);
      setIsChecking(false);
    };

    checkBoosted();
  }, [currentTrack?.trackId, isTrackBoosted]);

  // React to boost completion immediately
  useEffect(() => {
    if (!lastBoostCompletion || !currentTrack?.trackId) return;

    // Check if completion is for current track
    const isMatch =
      lastBoostCompletion.trackId === currentTrack.trackId ||
      lastBoostCompletion.trackId === currentTrack.trackId.replace('VOYO_', '');

    if (isMatch) {
      console.log('🎵 BoostButton: Detected boost completion, updating UI');
      setShowBurst(true);
      setShowSparks(true);
      setTimeout(() => {
        setIsBoosted(true);
        setShowSparks(false);
      }, 800);
    }
  }, [lastBoostCompletion, currentTrack?.trackId]);

  // Update when downloads complete
  useEffect(() => {
    if (!currentTrack?.trackId) return;

    const status = downloads.get(currentTrack.trackId);
    if (status?.status === 'complete') {
      // Trigger completion burst, then show boosted state
      setShowBurst(true);
      setShowSparks(true);
      setTimeout(() => {
        setIsBoosted(true);
        setShowSparks(false);
      }, 800);
    }
  }, [downloads, currentTrack?.trackId]);

  if (!currentTrack?.trackId) return null;

  const downloadStatus = getDownloadStatus(currentTrack.trackId);
  const isDownloading = downloadStatus?.status === 'downloading';
  const isQueued = downloadStatus?.status === 'queued';
  const progress = downloadStatus?.progress || 0;
  // Active = boosted AND using boosted audio (not toggled to original)
  const isActive = isBoosted && usingBoosted;
  // Show toggle indicator when boosted but using original
  const isToggled = isBoosted && !usingBoosted;

  const handleBoost = async () => {
    if (isDownloading || isQueued) return;

    // If already boosted, DJ Rewind - play from beginning
    if (isBoosted) {
      console.log('🎵 DJ REWIND: Boosted track tap → play from start');
      seekTo(0);
      return;
    }

    // Not boosted yet - start boost download
    setShowSparks(true);
    boostTrack(
      currentTrack.trackId,
      currentTrack.title,
      currentTrack.artist,
      currentTrack.duration || 0,
      getThumbnailUrl(currentTrack.trackId, 'medium')
    );
  };

  // Sync usingBoosted state with actual playback source
  useEffect(() => {
    if (isBoosted) {
      setUsingBoosted(playbackSource === 'cached');
    }
  }, [playbackSource, isBoosted]);

  // ============================================
  // TOOLBAR VARIANT - Premium floating style (matches Like/Settings buttons)
  // Dynamic colors based on active preset
  // ============================================
  if (variant === 'toolbar') {
    return (
      <motion.button
        onClick={handleBoost}
        disabled={isDownloading || isQueued}
        className={`w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-md shadow-lg transition-all duration-300 relative ${
          isActive
            ? `${colors.bg} border ${colors.border} ${colors.shadow}`
            : isToggled
              ? 'bg-white/10 border border-white/20 hover:bg-white/15' // Dimmed when toggled to original
              : 'bg-black/40 border border-white/10 hover:bg-black/50 hover:border-white/20'
        } ${className}`}
        whileHover={{ scale: 1.15, y: -2 }}
        whileTap={{ scale: 0.9 }}
        title={isActive ? `${boostProfile.charAt(0).toUpperCase() + boostProfile.slice(1)} Mode (tap to use original)` : isToggled ? 'Using original (tap for boosted)' : isDownloading ? `Boosting ${progress}%` : 'Boost (HD + Enhanced Audio)'}
      >
        {/* Glow effect when boosted - color based on preset */}
        {isActive && (
          <motion.div
            className="absolute inset-0 rounded-full blur-md -z-10"
            style={{ backgroundColor: `${colors.primary}33` }}
            animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}

        {/* Completion burst when boost finishes */}
        {showBurst && <CompletionBurst onComplete={() => setShowBurst(false)} preset={boostProfile} />}

        {/* Progress ring - fills around the button edge */}
        {(isDownloading || isQueued) && <ProgressRing progress={progress} isStarting={isDownloading || isQueued} size={44} preset={boostProfile} />}

        {/* Lightning icon - color based on preset, dimmed when toggled */}
        <div className={isToggled ? 'opacity-50' : ''}>
          <LightningIcon isGlowing={isActive || isToggled} isCharging={isDownloading || isQueued} size={16} preset={boostProfile} />
        </div>
        {showSparks && <BoostSparks preset={boostProfile} />}
      </motion.button>
    );
  }

  // ============================================
  // FLOATING VARIANT - Standalone ergonomic position
  // Dynamic colors based on active preset
  // ============================================
  if (variant === 'floating') {
    return (
      <motion.button
        onClick={handleBoost}
        disabled={isDownloading || isQueued || isActive}
        className={`relative ${className}`}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        {isActive && (
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{ background: `radial-gradient(circle, ${colors.primary}4D 0%, transparent 70%)`, filter: 'blur(8px)' }}
            animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}
        <div className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
          isActive ? `bg-gradient-to-br ${colors.bg.replace('/30', '/20')} border ${colors.border.replace('/60', '/40')}` : 'bg-white/5 border border-white/10 hover:bg-white/10'
        }`}>
          {(isDownloading || isQueued) && (
            <svg className="absolute inset-0 w-full h-full -rotate-90">
              <circle cx="24" cy="24" r="22" fill="none" stroke={`${colors.primary}33`} strokeWidth="2" />
              <motion.circle cx="24" cy="24" r="22" fill="none" stroke={colors.primary} strokeWidth="2" strokeLinecap="round" strokeDasharray={138} strokeDashoffset={138 - (138 * progress) / 100} />
            </svg>
          )}
          <LightningIcon isGlowing={isActive} isCharging={isDownloading || isQueued} size={20} preset={boostProfile} />
          {showSparks && <BoostSparks preset={boostProfile} />}
        </div>
      </motion.button>
    );
  }

  // ============================================
  // MINI VARIANT - For tight spaces
  // Dynamic colors based on active preset
  // ============================================
  if (variant === 'mini') {
    return (
      <motion.button
        onClick={handleBoost}
        disabled={isDownloading || isQueued || isActive}
        className={`relative w-8 h-8 rounded-full flex items-center justify-center ${isActive ? colors.bg.replace('/30', '/20') : 'bg-white/5 hover:bg-white/10'} ${className}`}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        <LightningIcon isGlowing={isActive} isCharging={isDownloading} size={12} preset={boostProfile} />
      </motion.button>
    );
  }

  // ============================================
  // INLINE VARIANT - Text with icon
  // Dynamic colors based on active preset
  // ============================================
  return (
    <motion.button
      onClick={handleBoost}
      disabled={isDownloading || isQueued || isActive}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${isActive ? `${colors.bg.replace('/30', '/10')} border ${colors.border.replace('/60', '/30')}` : 'bg-white/5 border border-white/10 hover:bg-white/10'} ${className}`}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <LightningIcon isGlowing={isActive} isCharging={isDownloading} size={14} preset={boostProfile} />
      <span className={`text-xs font-medium ${isActive ? colors.text : 'text-white/60'}`}>
        {isActive ? boostProfile.charAt(0).toUpperCase() + boostProfile.slice(1) : isDownloading ? `${progress}%` : 'Boost'}
      </span>
    </motion.button>
  );
};

export default BoostButton;
