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
// ⚪ off (Gray) | 🟡 boosted (Yellow) | 🔵 calm (Blue) | 🟣 voyex (Purple) | 🔴 xtreme (Red)
const PRESET_COLORS = {
  off: {
    primary: '#6b7280',    // Gray
    secondary: '#4b5563',
    light: '#9ca3af',
    glow: 'rgba(107,114,128,0.3)',
    bg: 'bg-gray-500/20',
    border: 'border-gray-400/40',
    shadow: 'shadow-gray-500/20',
    text: 'text-gray-400',
  },
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

type BoostPreset = 'off' | 'boosted' | 'calm' | 'voyex' | 'xtreme';

// Clean Lightning Bolt SVG Icon - Color changes based on preset
// NEW: outlineOnly mode = yellow stroke, no fill (for R2 server-boosted)
const LightningIcon = ({ isGlowing, isCharging, size = 14, preset = 'boosted', outlineOnly = false }: { isGlowing: boolean; isCharging: boolean; size?: number; preset?: BoostPreset; outlineOnly?: boolean }) => {
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
      {/* Outer glow when boosted (not for outline mode) */}
      {isGlowing && !outlineOnly && (
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
        fill={outlineOnly ? "none" : (isGlowing ? `url(#${gradientId})` : "#6b6b7a")}
        stroke={outlineOnly ? colors.primary : (isGlowing ? colors.primary : "transparent")}
        strokeWidth={outlineOnly ? "2" : "0.5"}
        animate={isCharging ? {
          opacity: [1, 0.6, 1],
          scale: [1, 1.1, 1]
        } : outlineOnly ? {
          opacity: [0.7, 1, 0.7]
        } : {}}
        transition={{ duration: outlineOnly ? 1.5 : 0.4, repeat: (isCharging || outlineOnly) ? Infinity : 0 }}
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
  const boostProfile = usePlayerStore((state) => state.boostProfile) as BoostPreset;
  const setBoostProfile = usePlayerStore((state) => state.setBoostProfile);

  const {
    boostTrack,
    getDownloadStatus,
    downloads,
    isTrackBoosted,
    lastBoostCompletion,
  } = useDownloadStore();

  const [isCached, setIsCached] = useState(false);
  const [showSparks, setShowSparks] = useState(false);
  const [showBurst, setShowBurst] = useState(false);
  // Remember last active preset for toggling back from 'off'
  const [lastActivePreset, setLastActivePreset] = useState<BoostPreset>('boosted');

  // EQ is ON when profile is not 'off'
  const isEqOn = boostProfile !== 'off';
  // Get colors - use last active preset colors when off (for subtle hint)
  const activePreset = isEqOn ? boostProfile : lastActivePreset;
  const colors = PRESET_COLORS[activePreset];

  // R2 = Server cached (collective cache)
  const isServerCached = playbackSource === 'r2';
  // Local = IndexedDB cached
  const isLocalCached = playbackSource === 'cached';

  // Check if current track is cached locally
  useEffect(() => {
    const checkCached = async () => {
      if (!currentTrack?.trackId) {
        setIsCached(false);
        return;
      }
      const cached = await isTrackBoosted(currentTrack.trackId);
      setIsCached(cached);
    };
    checkCached();
  }, [currentTrack?.trackId, isTrackBoosted]);

  // React to cache completion with visual feedback
  useEffect(() => {
    if (!lastBoostCompletion || !currentTrack?.trackId) return;
    const isMatch =
      lastBoostCompletion.trackId === currentTrack.trackId ||
      lastBoostCompletion.trackId === currentTrack.trackId.replace('VOYO_', '');
    if (isMatch) {
      setShowBurst(true);
      setShowSparks(true);
      setTimeout(() => {
        setIsCached(true);
        setShowSparks(false);
      }, 800);
    }
  }, [lastBoostCompletion, currentTrack?.trackId]);

  // Update when downloads complete
  useEffect(() => {
    if (!currentTrack?.trackId) return;
    const status = downloads.get(currentTrack.trackId);
    if (status?.status === 'complete') {
      setShowBurst(true);
      setShowSparks(true);
      setTimeout(() => {
        setIsCached(true);
        setShowSparks(false);
      }, 800);
    }
  }, [downloads, currentTrack?.trackId]);

  // Track last active preset when changing away from 'off'
  useEffect(() => {
    if (boostProfile !== 'off') {
      setLastActivePreset(boostProfile);
    }
  }, [boostProfile]);

  if (!currentTrack?.trackId) return null;

  const downloadStatus = getDownloadStatus(currentTrack.trackId);
  const isDownloading = downloadStatus?.status === 'downloading';
  const isQueued = downloadStatus?.status === 'queued';
  const progress = downloadStatus?.progress || 0;

  // Visual states:
  // - OUTLINE (contour) = R2/stream + Boost (EQ ON, not downloaded yet)
  // - FILLED = Local + Boost (downloaded + EQ ON)
  // - GRAY = EQ OFF (raw audio)
  const isActive = isEqOn;
  const showOutline = isEqOn && !isCached; // R2/stream: boosted but not local
  const showFilled = isEqOn && isCached;   // Local: boosted and downloaded

  // 3-ACTION TAP LOGIC:
  // 1. Not local + EQ ON → Download to local (EQ stays ON)
  // 2. Local + EQ ON → Turn EQ OFF
  // 3. Local + EQ OFF → Turn EQ ON
  const handleTap = () => {
    if (isDownloading || isQueued) return;

    if (!isCached) {
      // STATE 1: Not locally cached → Download it
      console.log('🎵 [Boost] Downloading to local cache...');
      setShowSparks(true);
      boostTrack(
        currentTrack.trackId,
        currentTrack.title,
        currentTrack.artist,
        currentTrack.duration || 0,
        getThumbnailUrl(currentTrack.trackId, 'medium')
      );
    } else if (isEqOn) {
      // STATE 2: Local + EQ ON → Turn OFF
      console.log('🎵 [Boost] OFF → Raw audio');
      setBoostProfile('off');
    } else {
      // STATE 3: Local + EQ OFF → Turn ON
      console.log(`🎵 [Boost] ON → ${lastActivePreset} mode`);
      setBoostProfile(lastActivePreset);
      setShowSparks(true);
      setTimeout(() => setShowSparks(false), 600);
    }
  };

  // ============================================
  // TOOLBAR VARIANT - 3 visual states
  // OUTLINE = R2 + Boost (tap to download)
  // FILLED = Local + Boost (tap for raw)
  // GRAY = EQ OFF (tap for boost)
  // ============================================
  if (variant === 'toolbar') {
    // Dynamic title based on state
    const getTitle = () => {
      if (isDownloading) return `Downloading ${progress}%`;
      if (showOutline) return 'Boosted (tap to download)';
      if (showFilled) return `${activePreset.charAt(0).toUpperCase() + activePreset.slice(1)} (tap for raw)`;
      return 'Raw audio (tap for boost)';
    };

    return (
      <motion.button
        onClick={handleTap}
        className={`w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-md shadow-lg transition-all duration-300 relative ${
          showOutline
            ? `bg-black/40 border-2 ${colors.border}` // OUTLINE: R2 boosted, not local
            : showFilled
              ? `${colors.bg} border ${colors.border} ${colors.shadow}` // FILLED: Local + boosted
              : 'bg-black/40 border border-white/20 hover:bg-black/50' // GRAY: Raw/off
        } ${className}`}
        whileHover={{ scale: 1.15, y: -2 }}
        whileTap={{ scale: 0.9 }}
        title={getTitle()}
      >
        {/* Glow effect when EQ is ON */}
        {isEqOn && (
          <motion.div
            className="absolute inset-0 rounded-full blur-md -z-10"
            style={{ backgroundColor: `${colors.primary}33` }}
            animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}

        {/* Completion burst when cache finishes */}
        {showBurst && <CompletionBurst onComplete={() => setShowBurst(false)} preset={activePreset} />}

        {/* Progress ring for background caching */}
        {(isDownloading || isQueued) && <ProgressRing progress={progress} isStarting={isDownloading || isQueued} size={44} preset={activePreset} />}

        {/* Lightning icon: OUTLINE=R2, FILLED=local+boost, GRAY=off */}
        <LightningIcon
          isGlowing={isEqOn}
          isCharging={isDownloading || isQueued}
          size={16}
          preset={isEqOn ? activePreset : 'off'}
          outlineOnly={showOutline}
        />
        {showSparks && <BoostSparks preset={activePreset} />}
      </motion.button>
    );
  }

  // ============================================
  // FLOATING VARIANT - Standalone ergonomic position
  // ============================================
  if (variant === 'floating') {
    return (
      <motion.button
        onClick={handleTap}
        className={`relative ${className}`}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        {isEqOn && (
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{ background: `radial-gradient(circle, ${colors.primary}4D 0%, transparent 70%)`, filter: 'blur(8px)' }}
            animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}
        <div className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
          isEqOn ? `bg-gradient-to-br ${colors.bg.replace('/30', '/20')} border ${colors.border.replace('/60', '/40')}` : 'bg-white/5 border border-white/10 hover:bg-white/10'
        }`}>
          {(isDownloading || isQueued) && (
            <svg className="absolute inset-0 w-full h-full -rotate-90">
              <circle cx="24" cy="24" r="22" fill="none" stroke={`${colors.primary}33`} strokeWidth="2" />
              <motion.circle cx="24" cy="24" r="22" fill="none" stroke={colors.primary} strokeWidth="2" strokeLinecap="round" strokeDasharray={138} strokeDashoffset={138 - (138 * progress) / 100} />
            </svg>
          )}
          <LightningIcon isGlowing={isEqOn} isCharging={isDownloading || isQueued} size={20} preset={isEqOn ? activePreset : 'off'} />
          {showSparks && <BoostSparks preset={activePreset} />}
        </div>
      </motion.button>
    );
  }

  // ============================================
  // MINI VARIANT - For tight spaces
  // ============================================
  if (variant === 'mini') {
    return (
      <motion.button
        onClick={handleTap}
        className={`relative w-8 h-8 rounded-full flex items-center justify-center ${isEqOn ? colors.bg.replace('/30', '/20') : 'bg-white/5 hover:bg-white/10'} ${className}`}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        <LightningIcon isGlowing={isEqOn} isCharging={isDownloading} size={12} preset={isEqOn ? activePreset : 'off'} />
      </motion.button>
    );
  }

  // ============================================
  // INLINE VARIANT - Text with icon
  // ============================================
  return (
    <motion.button
      onClick={handleTap}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${isEqOn ? `${colors.bg.replace('/30', '/10')} border ${colors.border.replace('/60', '/30')}` : 'bg-white/5 border border-white/10 hover:bg-white/10'} ${className}`}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <LightningIcon isGlowing={isEqOn} isCharging={isDownloading} size={14} preset={isEqOn ? activePreset : 'off'} />
      <span className={`text-xs font-medium ${isEqOn ? colors.text : 'text-white/60'}`}>
        {isEqOn ? activePreset.charAt(0).toUpperCase() + activePreset.slice(1) : 'Raw'}
      </span>
    </motion.button>
  );
};

export default BoostButton;
