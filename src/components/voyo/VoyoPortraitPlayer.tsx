/**
 * VOYO Portrait Player - CLEAN V2 STYLE
 *
 * LAYOUT (Top to Bottom):
 * 1. TOP: History (left 2 cards) | Queue + Add (right)
 * 2. CENTER: Big artwork with title overlay
 * 3. PLAY CONTROLS: Neon purple ring
 * 4. REACTIONS: Clean pill buttons with HOLD-TO-CHARGE OYÉ MULTIPLIER
 * 5. BOTTOM: 3-column vertical grid (HOT | VOYO FEED | DISCOVERY)
 */

import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Pause, SkipForward, SkipBack, Zap, Flame, Plus, Maximize2, Film, Settings, Heart,
  Shuffle, Repeat, Repeat1, Share2
} from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { getThumbnailUrl, getTrackThumbnailUrl } from '../../utils/imageHelpers';
import { Track, ReactionType } from '../../types';
import { SmartImage } from '../ui/SmartImage';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { unlockMobileAudio, isMobileDevice } from '../../utils/mobileAudioUnlock';
import { useMobilePlay } from '../../hooks/useMobilePlay';
import { BoostButton } from '../ui/BoostButton';
import { BoostSettings } from '../ui/BoostSettings';
import { haptics, getReactionHaptic } from '../../utils/haptics';

// ============================================
// FULLSCREEN BACKGROUND LAYER - Album art with dark overlay
// Creates the "floating in space" atmosphere
// ============================================
const FullscreenBackground = memo(({ trackId, isVideoMode }: { trackId?: string; isVideoMode: boolean }) => {
  if (!trackId) return null;

  return (
    <div className="absolute inset-0 z-0 overflow-hidden">
      {/* Album art - blurred and scaled up for cinematic effect */}
      <AnimatePresence mode="sync">
        <motion.div
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: 'easeInOut' }}
          key={trackId}
        >
          <SmartImage
            src={getThumbnailUrl(trackId, 'high')}
            alt="Background"
            className="w-full h-full object-cover blur-2xl scale-110 will-change-transform"
            trackId={trackId}
            lazy={false}
          />
        </motion.div>
      </AnimatePresence>

      {/* Dark overlay gradient - makes reactions POP */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(
            to bottom,
            rgba(2, 2, 3, 0.75) 0%,
            rgba(2, 2, 3, 0.65) 30%,
            rgba(2, 2, 3, 0.70) 60%,
            rgba(2, 2, 3, 0.85) 100%
          )`
        }}
      />

      {/* Extra vignette for depth */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.4) 100%)'
        }}
      />

      {/* Subtle color tint from album dominant color (approximated with purple) */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          background: 'linear-gradient(135deg, rgba(147, 51, 234, 0.3) 0%, rgba(99, 102, 241, 0.2) 50%, rgba(219, 39, 119, 0.2) 100%)',
          mixBlendMode: 'overlay',
        }}
      />
    </div>
  );
});

// ============================================
// BACKDROP TOGGLE - Two-state with double-click/hold for library
// ============================================
const BackdropToggle = memo(({
  isEnabled,
  onToggle,
  onOpenLibrary,
}: {
  isEnabled: boolean;
  onToggle: () => void;
  onOpenLibrary: () => void;
}) => {
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clickCount = useRef(0);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // FIX: Cleanup timers on unmount to prevent race conditions
  useEffect(() => {
    return () => {
      if (holdTimer.current) clearTimeout(holdTimer.current);
      if (clickTimer.current) clearTimeout(clickTimer.current);
    };
  }, []);

  const handlePressStart = () => {
    // Start hold timer - 500ms to trigger library
    holdTimer.current = setTimeout(() => {
      onOpenLibrary();
      holdTimer.current = null;
    }, 500);
  };

  const handlePressEnd = () => {
    // If hold timer is still active, it was a quick tap
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  };

  const handleClick = () => {
    clickCount.current++;

    if (clickCount.current === 1) {
      // Start timer for double-click detection
      clickTimer.current = setTimeout(() => {
        // Single click - toggle backdrop
        if (clickCount.current === 1) {
          onToggle();
        }
        clickCount.current = 0;
      }, 250);
    } else if (clickCount.current === 2) {
      // Double click - open library
      if (clickTimer.current) {
        clearTimeout(clickTimer.current);
      }
      clickCount.current = 0;
      onOpenLibrary();
    }
  };

  return (
    <motion.button
      onClick={handleClick}
      onMouseDown={handlePressStart}
      onMouseUp={handlePressEnd}
      onMouseLeave={handlePressEnd}
      onTouchStart={handlePressStart}
      onTouchEnd={handlePressEnd}
      className="absolute left-4 top-1/2 -translate-y-1/2 z-50 group"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.97 }}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3, ...springs.smooth }}
    >
      {/* Vertical pill container */}
      <div className={`
        relative w-9 h-[72px] rounded-full
        backdrop-blur-xl border transition-all duration-300
        ${isEnabled
          ? 'bg-purple-500/15 border-purple-500/30 shadow-[0_0_25px_rgba(147,51,234,0.25)]'
          : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
        }
      `}>
        {/* Toggle knob - slides between OFF and ON */}
        <motion.div
          className={`
            absolute left-1/2 -translate-x-1/2 w-7 h-7 rounded-full
            flex items-center justify-center transition-colors duration-300
            ${isEnabled
              ? 'bg-gradient-to-br from-purple-500 to-indigo-600 shadow-[0_0_15px_rgba(147,51,234,0.7)]'
              : 'bg-white/15 border border-white/20'
            }
          `}
          animate={{ y: isEnabled ? 38 : 4 }}
          transition={{ type: 'spring', stiffness: 280, damping: 24 }}
        >
          {/* Icon changes based on state */}
          <motion.div
            animate={{ rotate: isEnabled ? 0 : 180, opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {isEnabled ? (
              <Film size={13} className="text-white" />
            ) : (
              <div className="w-3 h-0.5 bg-gray-400 rounded-full" />
            )}
          </motion.div>
        </motion.div>

        {/* Labels - rotated on side */}
        <div className="absolute -left-0.5 top-2 text-[5px] font-black text-gray-500/60 tracking-[0.15em] -rotate-90 origin-bottom-left uppercase">
          off
        </div>
        <div className="absolute -left-0.5 bottom-7 text-[5px] font-black text-purple-400/80 tracking-[0.15em] -rotate-90 origin-bottom-left uppercase">
          bg
        </div>
      </div>

      {/* Tooltip on hover */}
      <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <div className="bg-black/80 backdrop-blur-sm text-white text-[9px] px-2 py-1.5 rounded-lg whitespace-nowrap border border-white/10">
          <span className="font-medium">{isEnabled ? 'Backdrop On' : 'Backdrop Off'}</span>
          <div className="text-[7px] text-gray-400 mt-0.5">Hold or 2× tap for library</div>
        </div>
      </div>
    </motion.button>
  );
});

// ============================================
// BACKDROP LIBRARY MODAL - Choose from presets or custom
// ============================================
const BackdropLibrary = ({
  isOpen,
  onClose,
  currentBackdrop,
  onSelect,
}: {
  isOpen: boolean;
  onClose: () => void;
  currentBackdrop: string;
  onSelect: (backdrop: string) => void;
}) => {
  if (!isOpen) return null;

  const backdrops = [
    { id: 'album', name: 'Album Art', preview: '🎵', type: 'dynamic' },
    { id: 'gradient-purple', name: 'Purple Wave', preview: '🟣', type: 'animated' },
    { id: 'gradient-ocean', name: 'Ocean Dream', preview: '🔵', type: 'animated' },
    { id: 'gradient-sunset', name: 'Sunset Fire', preview: '🟠', type: 'animated' },
    { id: 'gradient-aurora', name: 'Aurora', preview: '🟢', type: 'animated' },
    { id: 'particles', name: 'Particle Storm', preview: '✨', type: 'animated' },
    { id: 'video', name: 'Music Video', preview: '🎬', type: 'video', locked: true },
  ];

  return (
    <motion.div
      className="fixed inset-0 z-[90] flex items-end justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Backdrop overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Library panel */}
      <motion.div
        className="relative w-full max-w-md bg-[#0a0a0f]/95 backdrop-blur-xl border-t border-white/10 rounded-t-3xl p-6 pb-10"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 26, stiffness: 260 }}
      >
        {/* Handle */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1 bg-white/20 rounded-full" />

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-white">Backdrop Library</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
          >
            <Plus size={16} className="text-gray-400 rotate-45" />
          </button>
        </div>

        {/* Grid of backdrops */}
        <div className="grid grid-cols-3 gap-3">
          {backdrops.map((bd) => (
            <motion.button
              key={bd.id}
              onClick={() => !bd.locked && onSelect(bd.id)}
              className={`
                relative aspect-square rounded-2xl overflow-hidden border-2 transition-all
                ${currentBackdrop === bd.id
                  ? 'border-purple-500 shadow-[0_0_20px_rgba(147,51,234,0.4)]'
                  : 'border-white/10 hover:border-white/30'
                }
                ${bd.locked ? 'opacity-50' : ''}
              `}
              whileHover={bd.locked ? {} : { scale: 1.05 }}
              whileTap={bd.locked ? {} : { scale: 0.97 }}
              transition={springs.smooth}
            >
              {/* Preview */}
              <div
                className="absolute inset-0 flex items-center justify-center text-3xl"
                style={{
                  background: bd.id.includes('gradient')
                    ? `linear-gradient(135deg, ${
                        bd.id === 'gradient-purple' ? '#7c3aed, #2563eb' :
                        bd.id === 'gradient-ocean' ? '#0ea5e9, #06b6d4' :
                        bd.id === 'gradient-sunset' ? '#f97316, #dc2626' :
                        '#10b981, #8b5cf6'
                      })`
                    : bd.id === 'particles' ? '#1a1a2e' :
                    bd.id === 'album' ? 'linear-gradient(135deg, #1e1b4b, #0f172a)' :
                    '#111'
                }}
              >
                {bd.preview}
              </div>

              {/* Type badge */}
              <div className="absolute top-2 right-2">
                <span className={`
                  text-[7px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full
                  ${bd.type === 'animated' ? 'bg-cyan-500/30 text-cyan-300' :
                    bd.type === 'video' ? 'bg-orange-500/30 text-orange-300' :
                    'bg-purple-500/30 text-purple-300'
                  }
                `}>
                  {bd.type}
                </span>
              </div>

              {/* Lock icon */}
              {bd.locked && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <span className="text-xl">🔒</span>
                </div>
              )}

              {/* Selected checkmark */}
              {currentBackdrop === bd.id && (
                <div className="absolute bottom-2 right-2 w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}

              {/* Name */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-6">
                <span className="text-[9px] font-bold text-white">{bd.name}</span>
              </div>
            </motion.button>
          ))}
        </div>

        {/* Coming soon note */}
        <div className="mt-4 text-center">
          <span className="text-[10px] text-gray-500">
            More animated backdrops coming soon • Upload your own
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ============================================
// EXPAND BUTTON - Opens fullscreen video mode
// ============================================
const ExpandVideoButton = ({ onClick }: { onClick: () => void }) => (
  <motion.button
    onClick={onClick}
    className="absolute top-3 right-3 z-30 p-2 rounded-xl bg-black/40 backdrop-blur-sm border border-white/10 text-white/60 hover:text-white hover:bg-black/60 hover:border-purple-500/30 transition-all group"
    whileHover={{ scale: 1.08 }}
    whileTap={{ scale: 0.93 }}
    initial={{ opacity: 0, scale: 0.85 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ delay: 0.2, ...springs.smooth }}
  >
    <Maximize2 size={16} />
    {/* Tooltip */}
    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
      <div className="bg-black/80 backdrop-blur-sm text-white text-[9px] px-2 py-1 rounded whitespace-nowrap">
        Watch Video
      </div>
    </div>
  </motion.button>
);

// ============================================
// RIGHT-SIDE TOOLBAR - Vertical action buttons
// ============================================
const RightToolbar = ({ onSettingsClick }: { onSettingsClick: () => void }) => {
  const currentTrack = usePlayerStore(state => state.currentTrack);
  const [isLiked, setIsLiked] = useState(false);

  // Reset like state when track changes
  useEffect(() => {
    setIsLiked(false);
    // Check localStorage for liked status
    if (currentTrack?.trackId) {
      const liked = localStorage.getItem(`voyo_liked_${currentTrack.trackId}`);
      setIsLiked(liked === 'true');
    }
  }, [currentTrack?.trackId]);

  const handleLike = () => {
    if (!currentTrack?.trackId) return;
    const newLiked = !isLiked;
    setIsLiked(newLiked);
    localStorage.setItem(`voyo_liked_${currentTrack.trackId}`, String(newLiked));
    haptics.success();
  };

  return (
    <motion.div
      className="absolute right-6 top-[42%] -translate-y-1/2 z-50 flex flex-col gap-3"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.4, ...springs.smooth }}
    >
      {/* Like Button - Premium floating */}
      <motion.button
        onClick={handleLike}
        className={`w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-md shadow-lg transition-all duration-300 ${
          isLiked
            ? 'bg-pink-500/30 border border-pink-400/60 shadow-pink-500/30'
            : 'bg-black/40 border border-white/10 hover:bg-black/50 hover:border-white/20'
        }`}
        whileHover={{ scale: 1.15, y: -2 }}
        whileTap={{ scale: 0.9 }}
        title={isLiked ? 'Unlike' : 'Like'}
      >
        <Heart size={16} className={isLiked ? 'text-pink-300 fill-pink-300' : 'text-white/70'} />
        {isLiked && (
          <motion.div
            className="absolute inset-0 rounded-full bg-pink-500/20 blur-md -z-10"
            animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}
      </motion.button>

      {/* Boost Button - Lightning Power */}
      <BoostButton variant="toolbar" />

      {/* Settings Button - Premium floating */}
      <motion.button
        onClick={onSettingsClick}
        className="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-black/50 hover:border-white/20 shadow-lg transition-all duration-300"
        whileHover={{ scale: 1.15, y: -2 }}
        whileTap={{ scale: 0.9 }}
        title="Audio settings"
      >
        <Settings size={16} className="text-white/70" />
      </motion.button>
    </motion.div>
  );
};

// Spring configs - OPTIMIZED for smooth, fluid motion
const springs = {
  gentle: { type: 'spring' as const, stiffness: 150, damping: 20 },      // Smoother gentle transitions
  snappy: { type: 'spring' as const, stiffness: 300, damping: 25 },      // Less aggressive snappy
  smooth: { type: 'spring' as const, stiffness: 180, damping: 22 },      // General purpose smooth
  ultraSmooth: { type: 'spring' as const, stiffness: 120, damping: 18 }, // Ultra fluid for large elements
};

// ============================================
// VOYO BRAND TINT - Purple overlay that fades on hover
// ============================================
const VoyoBrandTint = ({ isPlayed }: { isPlayed?: boolean }) => (
  <div
    className={`absolute inset-0 pointer-events-none transition-opacity duration-300 group-hover:opacity-0 ${
      isPlayed ? 'opacity-60' : 'opacity-40'
    }`}
    style={{
      background: 'linear-gradient(135deg, rgba(147, 51, 234, 0.4) 0%, rgba(219, 39, 119, 0.3) 100%)',
      mixBlendMode: 'overlay',
    }}
  />
);

// ============================================
// SMALL CARD (History/Queue - with VOYO brand tint)
// ============================================
const SmallCard = memo(({ track, onTap, isPlayed }: { track: Track; onTap: () => void; isPlayed?: boolean }) => (
  <motion.button
    className="flex flex-col gap-2 w-[70px] flex-shrink-0 group"
    onClick={onTap}
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.97 }}
    transition={springs.smooth}
  >
    <div className="w-[70px] h-[70px] rounded-2xl overflow-hidden relative border border-white/5 bg-gradient-to-br from-purple-900/30 to-pink-900/20">
      <SmartImage
        src={getTrackThumbnailUrl(track, 'medium')}
        alt={track.title}
        className={`w-full h-full object-cover transition-all duration-300 ${
          isPlayed ? 'opacity-60' : 'opacity-90 group-hover:opacity-100 group-hover:scale-105'
        }`}
        trackId={track.trackId}
        lazy={true}
      />
      {/* VOYO Brand Tint - fades on hover */}
      <VoyoBrandTint isPlayed={isPlayed} />
      {/* Played checkmark overlay */}
      {isPlayed && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-5 h-5 rounded-full bg-purple-500/80 flex items-center justify-center shadow-lg">
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      )}
    </div>
    <div className="text-left">
      <h4 className={`text-[10px] font-bold truncate leading-tight ${isPlayed ? 'text-gray-400' : 'text-white'}`}>{track.title}</h4>
      <p className="text-[9px] text-gray-500 truncate">{track.artist}</p>
    </div>
  </motion.button>
));

// ============================================
// DASH PLACEHOLDER (Empty state for queue/history)
// ============================================
const DashPlaceholder = ({ onClick, label }: { onClick?: () => void; label: string }) => (
  <motion.button
    onClick={onClick}
    className="w-[70px] h-[70px] rounded-2xl bg-gradient-to-br from-purple-900/30 to-pink-900/20 border border-purple-500/20 flex flex-col items-center justify-center gap-1 hover:border-purple-500/40 transition-colors"
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.97 }}
    transition={springs.smooth}
  >
    <span className="text-[10px] font-black bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
      DASH
    </span>
    <Plus size={14} className="text-purple-400/60" />
    <span className="text-[7px] text-gray-500 uppercase tracking-wider">{label}</span>
  </motion.button>
);

// ============================================
// PORTAL BELT - Watch dial style infinite loop
// Cards wrap around like snake game walls
// Direction: INWARD toward VOYO (center)
// ============================================
interface PortalBeltProps {
  tracks: Track[];
  onTap: (track: Track) => void;
  onTeaser?: (track: Track) => void;
  playedTrackIds: Set<string>;
  type: 'hot' | 'discovery';
  isActive: boolean; // Controls if belt is scrolling
  onScrollOutward?: () => void; // Callback when user wants to scroll outward (reverse)
  scrollOutwardTrigger?: number; // Increment to trigger outward scroll
}

const PortalBelt = ({ tracks, onTap, onTeaser, playedTrackIds, type, isActive, scrollOutwardTrigger = 0 }: PortalBeltProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isReversed, setIsReversed] = useState(false); // For outward scroll

  // Manual scroll state
  const isDragging = useRef(false);
  const hasDraggedPastThreshold = useRef(false); // True if moved > threshold (real drag)
  const dragStartX = useRef(0);
  const dragStartOffset = useRef(0);
  const pauseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reverseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const DRAG_THRESHOLD = 10; // Pixels before considered a drag vs tap

  const isHot = type === 'hot';
  // INWARD direction: HOT scrolls RIGHT (+), DISCOVERY scrolls LEFT (-)
  // When reversed: opposite direction (OUTWARD from center)
  const baseSpeed = isHot ? 0.4 : -0.4;
  const speed = isReversed ? -baseSpeed * 2 : baseSpeed; // Faster when reversed

  // Handle scroll outward trigger from portal button
  useEffect(() => {
    if (scrollOutwardTrigger > 0) {
      // Reverse direction temporarily
      setIsReversed(true);
      setIsPaused(false);

      // Clear any existing timeout
      if (reverseTimeoutRef.current) clearTimeout(reverseTimeoutRef.current);

      // Return to normal after 1.5 seconds
      reverseTimeoutRef.current = setTimeout(() => {
        setIsReversed(false);
      }, 1500);
    }

    return () => {
      if (reverseTimeoutRef.current) clearTimeout(reverseTimeoutRef.current);
    };
  }, [scrollOutwardTrigger]);

  // Card dimensions
  const cardWidth = 72; // 64px + gap
  const totalWidth = tracks.length * cardWidth;

  // Auto-scroll animation - Only when isActive AND not paused
  useEffect(() => {
    if (tracks.length === 0 || !isActive) return;

    let animationId: number;
    let lastTime = 0;
    let mounted = true;

    const animate = (time: number) => {
      if (!mounted) return;

      try {
        if (!isPaused && lastTime) {
          const delta = time - lastTime;
          setOffset(prev => {
            let next = prev + speed * (delta / 16);
            // Wrap around (snake style)
            if (next <= -totalWidth) next += totalWidth;
            if (next >= totalWidth) next -= totalWidth;
            return next;
          });
        }
        lastTime = time;
        animationId = requestAnimationFrame(animate);
      } catch (error) {
        // FIX: Graceful error handling for animation loop
        console.error('[VOYO PortalBelt] Animation error:', error);
        mounted = false;
      }
    };

    animationId = requestAnimationFrame(animate);

    return () => {
      mounted = false;
      cancelAnimationFrame(animationId);
      if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
    };
  }, [tracks.length, isPaused, speed, totalWidth, isActive]);

  // Calculate entrance effect based on position and direction
  const getEntranceStyle = (x: number, containerWidth: number) => {
    if (isHot) {
      // HOT: Cards enter from LEFT (x near 0), add red glow fade-in
      const entranceZone = cardWidth * 1.5;
      if (x < entranceZone) {
        const progress = Math.max(0, x / entranceZone);
        return {
          opacity: 0.4 + progress * 0.6,
          filter: `drop-shadow(0 0 ${(1 - progress) * 8}px rgba(239, 68, 68, 0.6))`,
        };
      }
    } else {
      // DISCOVERY: Cards enter from RIGHT, add blue glow fade-in
      const entranceZone = containerWidth - cardWidth * 1.5;
      if (x > entranceZone) {
        const progress = Math.max(0, (containerWidth - x) / (cardWidth * 1.5));
        return {
          opacity: 0.4 + progress * 0.6,
          filter: `drop-shadow(0 0 ${(1 - progress) * 8}px rgba(59, 130, 246, 0.6))`,
        };
      }
    }
    return { opacity: 1, filter: 'none' };
  };

  // Render cards with wrap-around positioning (works for both directions)
  const renderCards = () => {
    const cards: React.ReactNode[] = [];
    const containerWidth = totalWidth; // Use track count as reference

    // Render each track twice for seamless loop
    for (let loop = 0; loop < 2; loop++) {
      tracks.forEach((track, i) => {
        // Calculate base position with loop offset
        let x = i * cardWidth + offset + (loop * totalWidth);

        // Normalize to visible range
        while (x < -totalWidth) x += totalWidth * 2;
        while (x >= totalWidth * 2) x -= totalWidth * 2;

        // Only render if within visible bounds (with buffer)
        if (x >= -cardWidth && x < containerWidth + cardWidth) {
          const entranceStyle = getEntranceStyle(x, containerWidth);

          cards.push(
            <motion.div
              key={`${track.id}-${loop}-${i}`}
              className="absolute top-0 bottom-0 flex items-center pointer-events-auto"
              style={{
                left: 0,
                transform: `translateX(${x}px) translateZ(0)`, // GPU accelerated
                width: cardWidth,
                willChange: 'transform',
                ...entranceStyle,
                transition: 'opacity 0.3s ease, filter 0.3s ease',
              }}
            >
              <StreamCard
                track={track}
                onTap={() => onTap(track)}
                onTeaser={onTeaser}
                isPlayed={playedTrackIds.has(track.id)}
              />
            </motion.div>
          );
        }
      });
    }

    return cards;
  };

  // Manual scroll handlers - works when auto-scroll is paused
  const handleDragStart = (clientX: number) => {
    isDragging.current = true;
    hasDraggedPastThreshold.current = false;
    dragStartX.current = clientX;
    dragStartOffset.current = offset;
    // Don't pause yet - wait until threshold is crossed
  };

  const handleDragMove = (clientX: number) => {
    if (!isDragging.current) return;
    const delta = clientX - dragStartX.current;

    // Check if we've crossed the drag threshold
    if (!hasDraggedPastThreshold.current && Math.abs(delta) > DRAG_THRESHOLD) {
      hasDraggedPastThreshold.current = true;
      setIsPaused(true); // Now pause auto-scroll since it's a real drag
    }

    // Only move if past threshold (prevents micro-movements during tap)
    if (hasDraggedPastThreshold.current) {
      let newOffset = dragStartOffset.current + delta;

      // Wrap around for infinite scroll feel
      while (newOffset <= -totalWidth) newOffset += totalWidth;
      while (newOffset >= totalWidth) newOffset -= totalWidth;

      setOffset(newOffset);
    }
  };

  const handleDragEnd = () => {
    const wasDrag = hasDraggedPastThreshold.current;
    isDragging.current = false;
    hasDraggedPastThreshold.current = false;

    // Only keep paused if it was a real drag
    if (wasDrag) {
      if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
      pauseTimeoutRef.current = setTimeout(() => setIsPaused(false), 2000);
    }
  };

  // Mouse handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleDragStart(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    handleDragMove(e.clientX);
  };

  const handleMouseUp = () => {
    handleDragEnd();
  };

  // Touch handlers - optimized for mobile belt dragging
  const handleTouchStart = (e: React.TouchEvent) => {
    // Don't prevent default here - allow tap-through for card taps
    handleDragStart(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    // Only prevent page scroll when it's a real drag (past threshold)
    if (hasDraggedPastThreshold.current) {
      e.preventDefault();
      e.stopPropagation(); // Stop cards from getting the event
    }
    handleDragMove(e.touches[0].clientX);
  };

  const handleTouchEnd = () => {
    handleDragEnd();
  };

  // Prevent context menu on long press (mobile)
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 relative h-20 overflow-hidden cursor-grab active:cursor-grabbing select-none"
      style={{ touchAction: 'pan-x' }} // Allow horizontal drag, prevent vertical scroll
      onMouseEnter={() => !isDragging.current && setIsPaused(true)}
      onMouseLeave={() => {
        if (!isDragging.current) setIsPaused(false);
        handleDragEnd();
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      // Use capture phase for touch events so belt handles drag before cards handle tap
      onTouchStartCapture={handleTouchStart}
      onTouchMoveCapture={handleTouchMove}
      onTouchEndCapture={handleTouchEnd}
      onContextMenu={handleContextMenu}
    >
      {/* Cards container - cards have pointer-events-auto for tap, belt captures drag */}
      <div className="absolute inset-0 pointer-events-none">
        {renderCards()}
      </div>
    </div>
  );
};

// ============================================
// STREAM CARD (Horizontal scroll - HOT/DISCOVERY - with VOYO brand tint)
// Now with MOBILE TAP-TO-TEASER (30s preview) + DRAG-TO-QUEUE
// ============================================
const StreamCard = memo(({ track, onTap, isPlayed, onTeaser }: { track: Track; onTap: () => void; isPlayed?: boolean; onTeaser?: (track: Track) => void }) => {
  const addToQueue = usePlayerStore(state => state.addToQueue);
  const [showQueueFeedback, setShowQueueFeedback] = useState(false);
  const [showTeaserFeedback, setShowTeaserFeedback] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [wasDragged, setWasDragged] = useState(false);
  const [isFlying, setIsFlying] = useState(false); // Card flying to queue animation

  // Timeout refs for cleanup - prevents memory leaks on rapid scrolling
  const teaserTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detect touch device
  useEffect(() => {
    const checkTouch = () => {
      setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
    };
    checkTouch();
  }, []);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (teaserTimeoutRef.current) clearTimeout(teaserTimeoutRef.current);
      if (queueTimeoutRef.current) clearTimeout(queueTimeoutRef.current);
      if (dragTimeoutRef.current) clearTimeout(dragTimeoutRef.current);
      if (flyTimeoutRef.current) clearTimeout(flyTimeoutRef.current);
    };
  }, []);

  // Handle tap - on mobile plays teaser, on desktop plays full
  const handleTap = () => {
    // If was dragging, don't trigger tap
    if (wasDragged) {
      setWasDragged(false);
      return;
    }

    // On mobile: tap = teaser preview (30s)
    if (isTouchDevice && onTeaser) {
      onTeaser(track);
      setShowTeaserFeedback(true);
      if (teaserTimeoutRef.current) clearTimeout(teaserTimeoutRef.current);
      teaserTimeoutRef.current = setTimeout(() => setShowTeaserFeedback(false), 2000);
    } else {
      // On desktop: click = full play
      onTap();
    }
  };

  return (
    <motion.div
      className="flex-shrink-0 flex flex-col items-center w-16 relative"
      drag
      dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={0.2}
      dragMomentum={false}
      dragTransition={{ bounceStiffness: 600, bounceDamping: 20 }}
      onDragStart={() => setWasDragged(true)}
      onDragEnd={(_, info) => {
        const dragDistance = Math.abs(info.offset.y) + Math.abs(info.offset.x);

        // Consider it a drag if moved more than 5px
        if (dragDistance > 5) {
          setWasDragged(true);
        }

        // Drag UP (or up-right toward queue) to add to queue
        // Trigger if dragged up at least 30px, or diagonal toward top-right
        const isSwipeToQueue = info.offset.y < -30 || (info.offset.y < -15 && info.offset.x > 15);

        if (isSwipeToQueue) {
          haptics.success();
          // Trigger flying animation
          setIsFlying(true);

          // Add to queue after a short delay (let animation start)
          if (flyTimeoutRef.current) clearTimeout(flyTimeoutRef.current);
          flyTimeoutRef.current = setTimeout(() => {
            addToQueue(track);
            setShowQueueFeedback(true);
          }, 200);

          // Reset flying state after animation completes
          if (queueTimeoutRef.current) clearTimeout(queueTimeoutRef.current);
          queueTimeoutRef.current = setTimeout(() => {
            setIsFlying(false);
            setShowQueueFeedback(false);
          }, 1200);
        }

        // Reset drag state after a short delay to prevent tap from firing
        if (dragTimeoutRef.current) clearTimeout(dragTimeoutRef.current);
        dragTimeoutRef.current = setTimeout(() => setWasDragged(false), 150);
      }}
      whileTap={{ cursor: 'grabbing' }}
    >
      {/* Queue Feedback - Shows after card flies */}
      <AnimatePresence>
        {showQueueFeedback && !isFlying && (
          <motion.div
            className="absolute -top-6 left-1/2 -translate-x-1/2 z-50"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
          >
            <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[8px] font-bold px-2 py-1 rounded-full shadow-lg whitespace-nowrap flex items-center gap-1">
              <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Queued
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Flying trail effect - shows during flight */}
      <AnimatePresence>
        {isFlying && (
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            initial={{ opacity: 1, scale: 1 }}
            animate={{ opacity: 0, scale: 2 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="w-14 h-14 rounded-xl bg-gradient-to-r from-purple-500/40 to-pink-500/40 blur-md" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Teaser Feedback Indicator */}
      <AnimatePresence>
        {showTeaserFeedback && (
          <motion.div
            className="absolute -top-8 left-1/2 -translate-x-1/2 z-50 bg-cyan-500 text-white text-[9px] font-bold px-3 py-1.5 rounded-full shadow-lg whitespace-nowrap flex items-center gap-1"
            initial={{ opacity: 0, y: 10, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.85 }}
            transition={springs.smooth}
          >
            <Play size={10} fill="white" /> 30s Preview
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        className="flex flex-col items-center group w-full"
        onClick={handleTap}
        whileHover={!isFlying ? { scale: 1.06, y: -2 } : {}}
        whileTap={!isFlying ? { scale: 0.96 } : {}}
        animate={isFlying ? {
          // Fly toward top-right (queue area)
          x: [0, 60, 120],
          y: [0, -80, -160],
          rotate: [0, 180, 360],
          scale: [1, 0.8, 0.4],
          opacity: [1, 0.9, 0],
        } : {
          x: 0, y: 0, rotate: 0, scale: 1, opacity: 1
        }}
        transition={isFlying ? {
          duration: 0.5,
          ease: [0.4, 0, 0.2, 1], // ease-out-cubic
        } : springs.smooth}
      >
        <div className="w-14 h-14 rounded-xl overflow-hidden mb-1.5 relative border border-white/5 shadow-md bg-gradient-to-br from-purple-900/30 to-pink-900/20">
          <SmartImage
            src={getTrackThumbnailUrl(track, 'medium')}
            alt={track.title}
            className={`w-full h-full object-cover transition-all duration-300 group-hover:scale-110 ${
              isPlayed ? 'opacity-60' : 'opacity-90 group-hover:opacity-100'
            }`}
            trackId={track.trackId}
            lazy={true}
          />
          {/* VOYO Brand Tint - fades on hover */}
          <VoyoBrandTint isPlayed={isPlayed} />
          {/* Played checkmark overlay */}
          {isPlayed && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-4 h-4 rounded-full bg-purple-500/80 flex items-center justify-center shadow-lg">
                <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          )}
          {/* Mobile hint indicator */}
          {isTouchDevice && (
            <div className="absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full bg-cyan-500/80 flex items-center justify-center">
              <Play size={6} fill="white" className="text-white" />
            </div>
          )}
        </div>
        <h4 className={`text-[9px] font-bold truncate w-full text-center ${isPlayed ? 'text-gray-400' : 'text-white'}`}>{track.title}</h4>
        <p className="text-[7px] text-gray-500 truncate w-full text-center uppercase">{track.artist}</p>
      </motion.button>
    </motion.div>
  );
});
// memo comparison function for StreamCard
StreamCard.displayName = 'StreamCard';

// ============================================
// BIG CENTER CARD (NOW PLAYING - Canva-style purple fade with premium typography)
// ============================================
const BigCenterCard = memo(({ track, onExpandVideo }: { track: Track; onExpandVideo?: () => void }) => (
  <motion.div
    className="relative w-52 h-52 md:w-60 md:h-60 rounded-[2rem] overflow-hidden z-20 group"
    style={{
      boxShadow: '0 25px 60px -12px rgba(0,0,0,0.9), 0 0 50px rgba(139,92,246,0.2), 0 0 100px rgba(139,92,246,0.1)',
    }}
    initial={{ scale: 0.95, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    transition={springs.ultraSmooth}
    whileHover={{ scale: 1.02 }}
    key={track.id}
  >
    {/* Original artwork - crisp and clean */}
    <SmartImage
      src={getTrackThumbnailUrl(track, 'high')}
      alt={track.title}
      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
      trackId={track.trackId}
      lazy={false}
    />

    {/* CANVA-STYLE PURPLE FADE - Bottom to top gradient */}
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        background: `linear-gradient(
          to top,
          rgba(88, 28, 135, 0.95) 0%,
          rgba(139, 92, 246, 0.7) 15%,
          rgba(139, 92, 246, 0.4) 30%,
          rgba(139, 92, 246, 0.1) 50%,
          transparent 70%
        )`,
      }}
    />

    {/* Subtle vignette for depth */}
    <div
      className="absolute inset-0 pointer-events-none opacity-40"
      style={{
        background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.6) 100%)',
      }}
    />

    {/* Expand Video Button */}
    {onExpandVideo && (
      <ExpandVideoButton onClick={onExpandVideo} />
    )}

    {/* PREMIUM TITLE SECTION */}
    <div className="absolute bottom-0 left-0 right-0 p-5">
      {/* Track Title - Bold and prominent */}
      <h1
        className="text-xl font-black text-white mb-1.5 line-clamp-2 leading-tight tracking-tight"
        style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          textShadow: '0 2px 20px rgba(0,0,0,0.8)',
          letterSpacing: '-0.02em',
        }}
      >
        {/* FIX: Sanitize text to prevent XSS and layout breaking */}
        {track.title?.replace(/[<>]/g, '').slice(0, 80) || 'Unknown Title'}
      </h1>

      {/* Artist Name - Elegant and subtle */}
      <div className="flex items-center gap-2">
        <div className="w-1 h-1 rounded-full bg-purple-400" />
        <p
          className="text-purple-200/90 text-sm font-medium tracking-wide truncate"
          style={{
            fontFamily: "'Inter', sans-serif",
            textShadow: '0 1px 10px rgba(0,0,0,0.6)',
          }}
        >
          {track.artist?.replace(/[<>]/g, '').slice(0, 60) || 'Unknown Artist'}
        </p>
      </div>
    </div>

    {/* Glowing border accent */}
    <div
      className="absolute inset-0 rounded-[2rem] pointer-events-none transition-all duration-500"
      style={{
        border: '1px solid rgba(139, 92, 246, 0.3)',
        boxShadow: 'inset 0 0 30px rgba(139, 92, 246, 0.1)',
      }}
    />
  </motion.div>
));

// ============================================
// PLAY CONTROLS - SPINNING VINYL DISK PLAY BUTTON
// ============================================
const PlayControls = memo(({

  isPlaying,
  onToggle,
  onPrev,
  onNext,
  currentTime,
  duration,
  isScrubbing,
  onScrubStart,
  onScrubEnd,
  trackArt,
  scrubDirection,
  skeepLevel,
}: {

  isPlaying: boolean;
  onToggle: () => void;
  onPrev: () => void;
  onNext: () => void;
  currentTime: number;
  duration: number;
  isScrubbing: boolean;
  onScrubStart: (direction: 'forward' | 'backward') => void;
  onScrubEnd: () => void;
  trackArt?: string;
  scrubDirection: 'forward' | 'backward' | null;
  skeepLevel: number; // 1=2x, 2=4x, 3=8x
}) => {
  // Convert skeepLevel to display speed
  const displaySpeed = skeepLevel === 1 ? 2 : skeepLevel === 2 ? 4 : 8;

  // Calculate spin animation based on state - SKEEP makes it spin FAST
  const getSpinAnimation = () => {
    if (isScrubbing) {
      // SKEEP mode: spin speed based on skeepLevel
      const spinDuration = 3 / displaySpeed;
      return {
        rotate: [0, 360],
        transition: { duration: spinDuration, repeat: Infinity, ease: 'linear' as const }
      };
    }
    if (isPlaying) {
      // Normal playback: slow vinyl spin
      return {
        rotate: [0, 360],
        transition: { duration: 3, repeat: Infinity, ease: 'linear' as const }
      };
    }
    return { rotate: 0 };
  };

  return (
    <div className="relative flex items-center justify-center w-full mb-3 z-30">
      {/* SKEEP SPEED INDICATOR - Shows current speed level */}
      <AnimatePresence>
        {isScrubbing && (
          <motion.div
            className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-2"
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
          >
            {/* Animated speed badge */}
            <motion.div
              className="px-4 py-1.5 rounded-full bg-gradient-to-r from-orange-500 to-red-500 shadow-lg shadow-orange-500/40"
              animate={{
                scale: [1, 1.05, 1],
                boxShadow: [
                  '0 4px 15px rgba(249, 115, 22, 0.4)',
                  '0 4px 25px rgba(249, 115, 22, 0.6)',
                  '0 4px 15px rgba(249, 115, 22, 0.4)'
                ]
              }}
              transition={{ duration: 0.5, repeat: Infinity }}
            >
              <span className="text-white font-bold text-lg tracking-wider">
                {displaySpeed}x
              </span>
            </motion.div>
            {/* Direction-aware arrows */}
            <motion.div
              className="flex gap-0.5"
              animate={{ x: scrubDirection === 'backward' ? [0, -4, 0] : [0, 4, 0] }}
              transition={{ duration: 0.3, repeat: Infinity }}
            >
              {scrubDirection === 'backward' ? (
                <>
                  <SkipBack size={16} className="text-orange-300 -mr-2" fill="currentColor" />
                  <SkipBack size={16} className="text-orange-400" fill="currentColor" />
                </>
              ) : (
                <>
                  <SkipForward size={16} className="text-orange-400" fill="currentColor" />
                  <SkipForward size={16} className="text-orange-300 -ml-2" fill="currentColor" />
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Prev - HOLD TO REWIND */}
      <motion.button
        className="absolute left-[20%] text-white/50 hover:text-white transition-colors"
        onClick={() => {
          haptics.light();
          onPrev();
        }}
        onMouseDown={() => onScrubStart('backward')}
        onMouseUp={onScrubEnd}
        onMouseLeave={onScrubEnd}
        onTouchStart={() => onScrubStart('backward')}
        onTouchEnd={onScrubEnd}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.92 }}
        transition={springs.snappy}
      >
        <SkipBack size={24} fill="currentColor" />
      </motion.button>

      {/* SPINNING VINYL DISK PLAY BUTTON */}
      <div className="relative w-20 h-20 flex items-center justify-center">
        {/* Glow - intensifies when playing */}
        <motion.div
          className="absolute inset-0 rounded-full blur-xl"
          animate={{
            backgroundColor: isPlaying ? 'rgba(99, 102, 241, 0.3)' : 'rgba(99, 102, 241, 0.15)',
            scale: isPlaying ? 1.2 : 1,
          }}
          transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
        />

        {/* Spinning Vinyl Disk */}
        <motion.button
          className="absolute inset-0 rounded-full overflow-hidden border-2 border-white/20 shadow-lg"
          onClick={() => {
            haptics.medium();
            onToggle();
          }}
          animate={getSpinAnimation()}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          style={{
            background: isPlaying || isScrubbing
              ? 'transparent'
              : 'linear-gradient(to bottom, #1a1a2e, #0f0f16)'
          }}
        >
          {/* Vinyl grooves background */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: `repeating-radial-gradient(
                circle at center,
                #1a1a2e 0px,
                #1a1a2e 2px,
                #0f0f16 2px,
                #0f0f16 4px
              )`
            }}
          />

          {/* Album art - only visible when playing/scrubbing */}
          <AnimatePresence>
            {(isPlaying || isScrubbing) && trackArt && (
              <motion.div
                className="absolute inset-2 w-[calc(100%-16px)] h-[calc(100%-16px)] rounded-full overflow-hidden"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
              >
                <SmartImage
                  src={trackArt}
                  alt="Now Playing"
                  className="w-full h-full object-cover"
                  lazy={false}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Center hole (vinyl style) */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-[#0a0a0f] border border-white/30 z-10 flex items-center justify-center">
            {/* Play/Pause icon in center */}
            {isPlaying ? (
              <Pause size={10} className="text-white/70" />
            ) : (
              <Play size={10} className="text-white/70 ml-0.5" />
            )}
          </div>

          {/* Shine effect */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none" />
        </motion.button>
      </div>

      {/* Next - HOLD TO FAST FORWARD */}
      <motion.button
        className="absolute right-[20%] text-white/50 hover:text-white transition-colors"
        onClick={() => {
          haptics.light();
          onNext();
        }}
        onMouseDown={() => onScrubStart('forward')}
        onMouseUp={onScrubEnd}
        onMouseLeave={onScrubEnd}
        onTouchStart={() => onScrubStart('forward')}
        onTouchEnd={onScrubEnd}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.92 }}
        transition={springs.snappy}
      >
        <SkipForward size={24} fill="currentColor" />
      </motion.button>
    </div>
  );
});

// ============================================
// SUGGESTION CHAIN - Glowing pills that cycle then fade to grey
// ============================================
const SUGGESTIONS = ['Shuffle', 'Run it back', 'Slow down', 'Afrobeats', 'Pump it up'];

const SuggestionChain = memo(({ onSelect }: { onSelect: (text: string) => void }) => {
  const [glowIndex, setGlowIndex] = useState(-1); // -1 = all grey, 0-4 = that pill glows
  const [cycleComplete, setCycleComplete] = useState(false);

  // Glowing chain effect: cycle through pills one by one, then settle to grey
  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      if (index < SUGGESTIONS.length) {
        setGlowIndex(index);
        index++;
      } else {
        // Chain complete - all go grey
        setGlowIndex(-1);
        setCycleComplete(true);
        clearInterval(interval);
      }
    }, 300); // 300ms per pill

    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      className="mt-4 flex flex-wrap gap-2 justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {SUGGESTIONS.map((suggestion, index) => {
        const isGlowing = glowIndex === index;
        const isStale = cycleComplete || glowIndex > index || glowIndex === -1;

        return (
          <motion.button
            key={suggestion}
            onClick={() => onSelect(suggestion)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-300 ${
              isGlowing
                ? 'bg-purple-600/60 border border-purple-400/60 text-white shadow-lg shadow-purple-500/30'
                : isStale
                  ? 'bg-stone-800/40 border border-stone-600/30 text-stone-400 hover:bg-stone-700/50 hover:text-stone-300'
                  : 'bg-purple-900/40 border border-purple-500/30 text-purple-200'
            }`}
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{
              opacity: 1,
              scale: isGlowing ? 1.05 : 1,
              y: 0,
            }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{
              delay: 0.15 + (index * 0.1),
              type: 'spring',
              damping: 20,
              stiffness: 300
            }}
            whileTap={{ scale: 0.95 }}
          >
            {suggestion}
          </motion.button>
        );
      })}
    </motion.div>
  );
});

// ============================================
// REACTION SYSTEM V3 - Ghosted Row with OYÉ Gateway
// ============================================
// Flow: All buttons visible but ghosted → Tap OYÉ → All light up
// OYÉ is slightly more prominent (the leader/invitation)

const ReactionBar = memo(({
  onReaction,
  isRevealed,
  onRevealChange,
  oyeBarBehavior = 'fade',
  activateChatTrigger = 0,
}: {
  onReaction: (type: ReactionType, emoji: string, text: string, multiplier: number) => void;
  isRevealed: boolean;
  onRevealChange: (revealed: boolean) => void;
  oyeBarBehavior?: 'fade' | 'disappear';
  activateChatTrigger?: number;
}) => {
  const [isActive, setIsActive] = useState(false); // false = ghosted, true = lit
  const [charging, setCharging] = useState<string | null>(null);
  const [chargeStart, setChargeStart] = useState<number>(0);
  const [currentMultiplier, setCurrentMultiplier] = useState<number>(1);

  // WAZZGUÁN CHAT MODE - Patent-worthy feature
  const [isChatMode, setIsChatMode] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatResponse, setChatResponse] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const prevTriggerRef = useRef(activateChatTrigger);

  // Access store for DJ commands
  const { addToQueue, currentTrack } = usePlayerStore();

  // DOUBLE TAP → Straight to Wazzguan chat
  useEffect(() => {
    // Only activate on actual changes (not initial mount)
    if (activateChatTrigger > prevTriggerRef.current) {
      prevTriggerRef.current = activateChatTrigger;
      // Small delay to ensure parent state updates have propagated
      requestAnimationFrame(() => {
        // Activate chat directly - wake up and open
        setIsActive(true);
        setIsChatMode(true);
        setChatResponse(null);
        // Focus input after animation completes
        setTimeout(() => chatInputRef.current?.focus(), 400);
      });
    }
  }, [activateChatTrigger]);

  // Auto-hide after inactivity (when revealed but not interacting)
  useEffect(() => {
    if (!isRevealed || isChatMode) return;

    const timeout = setTimeout(() => {
      if (!isChatMode && !charging) {
        setIsActive(false);
        onRevealChange(false); // Hide buttons after timeout
      }
    }, 6000); // Hide after 6s of no interaction

    return () => clearTimeout(timeout);
  }, [isRevealed, isActive, charging, isChatMode, onRevealChange]);

  // Handle Wazzguán tap → opens chat mode
  const handleWazzguanTap = () => {
    if (!isActive) return;
    setIsChatMode(true);
    setChatResponse(null);
    // Focus input after animation
    setTimeout(() => chatInputRef.current?.focus(), 300);
  };

  // Handle chat submission - DJ commands & song requests
  const handleChatSubmitWithText = async (text: string) => {
    if (!text.trim() || isProcessing) return;

    setIsProcessing(true);
    const input = text.trim().toLowerCase();
    setChatInput('');

    // Simple pattern matching for DJ commands (can be enhanced with actual AI later)
    // DJ CONTROLS - Shuffle, Run it back, Slow down
    if (input.includes('shuffle')) {
      setChatResponse('🔀 Shuffling the vibes...');
      // TODO: Wire to actual shuffle toggle in playerStore
      setTimeout(() => setIsChatMode(false), 1500);
    } else if (input.includes('run it back') || input.includes('again') || input.includes('replay') || input.includes('repeat')) {
      setChatResponse('🔁 Running it back!');
      // TODO: Wire to actual replay/seek to start
      setTimeout(() => setIsChatMode(false), 1500);
    } else if (input.includes('add') || input.includes('play') || input.includes('queue')) {
      const songMatch = input.replace(/^(add|play|queue)\s*/i, '').trim();
      if (songMatch) {
        setChatResponse(`🎵 Adding "${songMatch}" to queue...`);
        setTimeout(() => {
          setChatResponse(`✓ "${songMatch}" queued up next!`);
          setTimeout(() => setIsChatMode(false), 2000);
        }, 1000);
      } else {
        setChatResponse('🎧 What song should I add?');
      }
    } else if (input.includes('slow') || input.includes('chill') || input.includes('wine')) {
      setChatResponse('🌙 Got it, winding down the vibe...');
      setTimeout(() => setIsChatMode(false), 2000);
    } else if (input.includes('up') || input.includes('hype') || input.includes('energy')) {
      setChatResponse('🔥 Let\'s bring up the energy!');
      setTimeout(() => setIsChatMode(false), 2000);
    } else if (input.includes('afro') || input.includes('caribbean') || input.includes('latin')) {
      const genre = input.match(/(afro|caribbean|latin|dancehall|reggae)/i)?.[0] || 'vibes';
      setChatResponse(`🌍 Adding more ${genre} to the mix!`);
      setTimeout(() => setIsChatMode(false), 2000);
    } else if (input.includes('more like this') || input.includes('similar')) {
      setChatResponse(`🎯 Finding more like "${currentTrack?.title || 'this track'}"...`);
      setTimeout(() => setIsChatMode(false), 2000);
    } else {
      setChatResponse(`🎧 "${text}" - I hear you!`);
      setTimeout(() => setIsChatMode(false), 2000);
    }

    setIsProcessing(false);
  };

  const handleChatSubmit = async () => {
    if (!chatInput.trim() || isProcessing) return;
    handleChatSubmitWithText(chatInput);
  };

  // Close chat mode
  const handleChatClose = () => {
    setIsChatMode(false);
    setChatInput('');
    setChatResponse(null);
  };

  // Track which button just flashed (for sleep mode single-tap feedback)
  const [flashingButton, setFlashingButton] = useState<string | null>(null);
  // Track if Wazzguán was primed (tapped once in sleep mode) - use ref to avoid stale closure
  const [wazzguanPrimed, setWazzguanPrimed] = useState(false);
  const wazzguanPrimedRef = useRef(false);

  // All reactions in a row - OYÉ is the gateway (defined early for use in handlers)
  // REFINED PREMIUM COLORS - sophisticated, muted, elegant (not "kid style")
  const reactions = [
    { type: 'oyo', emoji: '👋', text: 'OYO', icon: Zap, gradient: 'from-violet-800/70 to-purple-900/60' },
    { type: 'oye', emoji: '🎉', text: 'OYÉ', icon: Zap, gradient: 'from-purple-700/70 to-fuchsia-900/60', isGateway: true },
    { type: 'wazzguan', emoji: '🤙', text: 'Wazzguán', icon: null, gradient: 'from-stone-600/50 to-stone-700/40', isChat: true },
    { type: 'fire', emoji: '🔥', text: 'Fireee', icon: Flame, gradient: 'from-rose-900/70 to-red-950/60' },
  ];

  const handlePressStart = (type: string) => {
    // === WAZZGUÁN FLOW ===
    if (type === 'wazzguan') {
      if (isActive) {
        // Active mode: direct open chat
        handleWazzguanTap();
        return;
      } else if (wazzguanPrimedRef.current) {
        // Sleep mode + primed: open chat
        handleWazzguanTap();
        wazzguanPrimedRef.current = false;
        setWazzguanPrimed(false);
        return;
      } else {
        // Sleep mode + not primed: prime it (flash and wait for second tap)
        setFlashingButton('wazzguan');
        wazzguanPrimedRef.current = true;
        setWazzguanPrimed(true);
        haptics.light();
        setTimeout(() => setFlashingButton(null), 400);
        // Auto-unprime after 3 seconds
        setTimeout(() => {
          wazzguanPrimedRef.current = false;
          setWazzguanPrimed(false);
        }, 3000);
        return;
      }
    }

    // === OYÉ FLOW (Gateway) ===
    if (type === 'oye') {
      if (!isActive) {
        // Sleep mode: elegant wake-up of all buttons
        setIsActive(true);
        // Flash Wazzguán to draw attention (grey → orange → back)
        setFlashingButton('wazzguan');
        setTimeout(() => setFlashingButton(null), 800);
        haptics.medium();
        return;
      }
      // Active mode: start charging for reaction
      setCharging(type);
      setChargeStart(Date.now());
      setCurrentMultiplier(1);
      return;
    }

    // === OTHER BUTTONS (OYO, Fire) ===
    if (!isActive) {
      // Sleep mode: flash, show emoji, go back to sleep
      setFlashingButton(type);
      haptics.light();
      // Trigger a quick reaction (emoji on canvas)
      const reactionData = reactions.find(r => r.type === type);
      if (reactionData) {
        onReaction(type as ReactionType, reactionData.emoji, reactionData.text, 1);
      }
      setTimeout(() => setFlashingButton(null), 400);
      return;
    }

    // Active mode: start charging
    setCharging(type);
    setChargeStart(Date.now());
    setCurrentMultiplier(1);
  };

  const handlePressEnd = (type: ReactionType, emoji: string, text: string) => {
    if (!charging) return;

    const holdDuration = Date.now() - chargeStart;
    let multiplier = 1;

    if (holdDuration < 200) multiplier = 1;
    else if (holdDuration < 500) multiplier = 2;
    else if (holdDuration < 1000) multiplier = 5;
    else multiplier = 10;

    getReactionHaptic(multiplier)();
    onReaction(type, emoji, text, multiplier);
    setCharging(null);
    setCurrentMultiplier(1);
  };

  // Update multiplier display while holding
  useEffect(() => {
    if (!charging) return;

    const interval = setInterval(() => {
      const holdDuration = Date.now() - chargeStart;
      let multiplier = 1;
      if (holdDuration >= 1000) multiplier = 10;
      else if (holdDuration >= 500) multiplier = 5;
      else if (holdDuration >= 200) multiplier = 2;
      setCurrentMultiplier(multiplier);
    }, 50);

    return () => clearInterval(interval);
  }, [charging, chargeStart]);

  const isCharging = (type: string) => charging === type;
  const getScale = (type: string) => isCharging(type) ? 1 + (currentMultiplier - 1) * 0.05 : 1;

  // Position offsets - all buttons hidden when chat opens, so no spread needed
  const getSpreadX = (_type: string) => 0;

  // Check if button is currently flashing (sleep mode tap feedback)
  const isFlashing = (type: string) => flashingButton === type || (type === 'wazzguan' && wazzguanPrimed);

  return (
    <div className="relative z-30 flex flex-col items-center mb-4">
      {/* Main reaction row - buttons spread when chat opens */}
      {/* min-h-[44px] when chat active to prevent collapse (absolute chat bar doesn't take space) */}
      <div className={`relative flex items-center justify-center gap-2 w-full ${isChatMode ? 'min-h-[44px]' : ''}`}>
        {reactions.map((r) => {
          const isGateway = r.isGateway;
          const isChat = r.isChat;
          const buttonFlashing = isFlashing(r.type);
          const isLit = isActive || buttonFlashing;

          // Hide ALL reaction buttons when chat is open - completely clean
          if (isChatMode) return null;

          // VISIBILITY LOGIC based on oyeBarBehavior:
          // 'fade' mode: ALWAYS visible (signature), just more ghosted when not revealed
          // 'disappear' mode: Only show when revealed
          if (oyeBarBehavior === 'disappear' && !isRevealed) return null;

          // In fade mode, buttons are always visible but more transparent when not revealed
          const isFadeGhosted = oyeBarBehavior === 'fade' && !isRevealed;

          // Fire flicker animation (only used when not in chat mode)
          const isFireSpread = false;

          return (
            <motion.button
              key={r.type}
              className={`
                relative rounded-full font-bold flex items-center gap-1.5
                backdrop-blur-sm transition-colors duration-300
                ${isGateway
                  ? 'min-h-[44px] h-11 px-6 text-sm z-10'
                  : 'min-h-[38px] h-[38px] px-4 text-xs'
                }
                ${isGateway
                  ? (isLit
                    ? 'bg-gradient-to-r from-purple-700/70 to-fuchsia-900/60 border border-purple-400/30 text-white shadow-lg shadow-purple-900/30'
                    : 'bg-purple-950/50 border border-purple-600/30 text-purple-300/80')
                  : isChat
                    ? (buttonFlashing
                      ? 'bg-gradient-to-r from-amber-500/70 to-orange-500/60 border border-amber-400/40 text-white shadow-lg shadow-orange-500/30'
                      : isLit
                        ? 'bg-gradient-to-r from-stone-600/50 to-stone-700/40 border border-stone-400/20 text-white shadow-lg'
                        : 'bg-stone-900/30 border border-stone-600/20 text-stone-300/50')
                    : (isLit
                      ? `bg-gradient-to-r ${r.gradient} border border-white/20 text-white shadow-lg`
                      : 'bg-white/5 border border-white/10 text-white/50')
                }
              `}
              animate={{
                x: getSpreadX(r.type),
                y: isGateway && !isActive && !isChatMode && !buttonFlashing && !isFadeGhosted ? [0, -3, 0] : 0,
                scale: isFireSpread ? [0.85, 0.9, 0.85] : (isFadeGhosted ? 0.9 : (isChatMode ? 0.8 : (buttonFlashing && isChat ? [1, 1.15, 1] : (buttonFlashing ? 1.05 : 1)))),
                opacity: isFireSpread
                  ? [0.3, 0.45, 0.3]
                  : isFadeGhosted
                    ? (isGateway ? 0.35 : 0.25) // Extra ghosted in fade mode when not revealed
                    : (isChatMode ? 0.6 : (isLit ? 1 : (isGateway ? 0.9 : 0.5))),
              }}
              transition={{
                x: { type: 'spring', damping: 25, stiffness: 200 },
                y: { duration: 2.5, repeat: Infinity, ease: "easeInOut" },
                scale: isFireSpread
                  ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" }
                  : { type: 'spring', damping: 20, stiffness: 400 },
                opacity: isFireSpread
                  ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" }
                  : { duration: 0.3, ease: "easeOut" },
              }}
              onMouseDown={() => handlePressStart(r.type)}
              onMouseUp={() => handlePressEnd(r.type as ReactionType, r.emoji, r.text)}
              onMouseLeave={() => { if (charging === r.type) handlePressEnd(r.type as ReactionType, r.emoji, r.text); }}
              onTouchStart={() => handlePressStart(r.type)}
              onTouchEnd={() => handlePressEnd(r.type as ReactionType, r.emoji, r.text)}
            >
              {r.icon && <r.icon size={isGateway ? 14 : 11} fill="currentColor" />}
              <span>{r.text}</span>

              {/* Chat indicator on Wazzguán */}
              {isChat && isActive && !isChatMode && (
                <span className="text-[10px]">?</span>
              )}

              {/* Multiplier display */}
              {isCharging(r.type) && currentMultiplier > 1 && (
                <motion.span
                  className="absolute -top-8 left-1/2 -translate-x-1/2 text-yellow-400 font-bold text-lg drop-shadow-lg"
                  initial={{ opacity: 0, y: 5, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                >
                  {currentMultiplier}x{currentMultiplier === 10 ? '🔥' : ''}
                </motion.span>
              )}

              {/* Gateway pulse indicator */}
              {isGateway && !isActive && !isChatMode && (
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-purple-400/50"
                  animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}
            </motion.button>
          );
        })}

        {/* Chat input - appears in center when Wazzguán tapped */}
        {/* PREMIUM STYLING: Muted stone/neutral tones with subtle purple accent */}
        <AnimatePresence>
          {isChatMode && (
            <motion.div
              className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 bg-gradient-to-r from-stone-800/50 to-stone-900/40 backdrop-blur-xl rounded-full border border-stone-500/20 px-3 py-1.5 shadow-lg shadow-black/30"
              initial={{ opacity: 0, scale: 0.8, width: 80 }}
              animate={{ opacity: 1, scale: 1, width: 220 }}
              exit={{ opacity: 0, scale: 0.8, width: 80 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
              <input
                ref={chatInputRef}
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleChatSubmit()}
                placeholder="Tell the DJ..."
                className="flex-1 bg-transparent text-white text-xs placeholder:text-stone-400 outline-none min-w-0"
                disabled={isProcessing}
              />
              <motion.button
                onClick={handleChatSubmit}
                className="w-6 h-6 rounded-full bg-purple-600/60 flex items-center justify-center flex-shrink-0"
                whileTap={{ scale: 0.9 }}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <motion.div
                    className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                  />
                ) : (
                  <SkipForward size={12} className="text-white" fill="currentColor" />
                )}
              </motion.button>
              <motion.button
                onClick={handleChatClose}
                className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-white/60 text-xs flex-shrink-0"
                whileTap={{ scale: 0.9 }}
              >
                ×
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* DJ Response - below the buttons */}
      <AnimatePresence>
        {isChatMode && chatResponse && (
          <motion.div
            className="mt-3 px-4 py-2 rounded-2xl bg-black/50 backdrop-blur-sm border border-white/10 text-white/90 text-xs text-center max-w-[240px]"
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
          >
            {chatResponse}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick suggestions - Glowing chain effect, then stale grey */}
      <AnimatePresence>
        {isChatMode && !chatResponse && (
          <SuggestionChain onSelect={handleChatSubmitWithText} />
        )}
      </AnimatePresence>
    </div>
  );
});

// ============================================
// FULLSCREEN VIDEO PLAYER - Takes over screen for video watching
// ============================================
const FullscreenVideoPlayer = ({
  track,
  isPlaying,
  onClose,
  onTogglePlay,
}: {
  track: Track;
  isPlaying: boolean;
  onClose: () => void;
  onTogglePlay: () => void;
}) => (
  <motion.div
    className="fixed inset-0 z-[100] bg-black flex flex-col"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
  >
    {/* Video Container - YouTube iframe would go here */}
    <div className="flex-1 relative bg-black flex items-center justify-center">
      {/* Placeholder - in production this would be a YouTube embed */}
      <div className="relative w-full h-full max-w-4xl mx-auto">
        <SmartImage
          src={getTrackThumbnailUrl(track, 'high')}
          alt={track.title}
          className="w-full h-full object-contain"
          trackId={track.trackId}
          lazy={false}
        />
        {/* Play overlay */}
        <motion.button
          onClick={onTogglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors"
          whileTap={{ scale: 0.97 }}
          transition={springs.smooth}
        >
          <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
            {isPlaying ? (
              <Pause size={32} className="text-white" />
            ) : (
              <Play size={32} className="text-white ml-1" />
            )}
          </div>
        </motion.button>
      </div>
    </div>

    {/* Bottom Bar - Track info and close */}
    <div className="bg-black/90 backdrop-blur-xl border-t border-white/10 p-4">
      <div className="flex items-center justify-between max-w-4xl mx-auto">
        <div className="flex-1 min-w-0">
          <h2 className="text-white font-bold text-lg truncate">{track.title}</h2>
          <p className="text-purple-300 text-sm truncate">{track.artist}</p>
        </div>
        <motion.button
          onClick={onClose}
          className="ml-4 px-6 py-2 rounded-full bg-white/10 border border-white/20 text-white text-sm font-bold hover:bg-white/20 transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.97 }}
          transition={springs.smooth}
        >
          Close
        </motion.button>
      </div>
    </div>
  </motion.div>
);

// ============================================
// MAIN COMPONENT - Clean V2 Style (matching screenshot)
// ============================================
export const VoyoPortraitPlayer = ({
  onVoyoFeed,
  onSearch,
}: {
  onVoyoFeed: () => void;
  djMode?: boolean;
  onToggleDJMode?: () => void;
  onSearch?: () => void;
}) => {
  const {
    currentTrack,
    isPlaying,
    isVideoMode,
    toggleVideoMode,
    queue,
    history,
    hotTracks,
    discoverTracks,
    nextTrack,
    prevTrack,
    setCurrentTrack,
    addReaction,
    reactions,
    currentTime,
    duration,
    seekTo,
    // SKEEP (Fast-forward) state
    playbackRate,
    isSkeeping,
    setPlaybackRate,
    stopSkeep,
    // OYÉ Bar behavior
    oyeBarBehavior,
  } = usePlayerStore();

  // MOBILE FIX: Use direct play handler
  const { handlePlayPause } = useMobilePlay();

  // Backdrop state
  const [backdropEnabled, setBackdropEnabled] = useState(true); // ON by default for the floaty feel
  const [currentBackdrop, setCurrentBackdrop] = useState('album'); // 'album', 'gradient-purple', etc.
  const [isBackdropLibraryOpen, setIsBackdropLibraryOpen] = useState(false);
  // State for fullscreen video mode
  const [isFullscreenVideo, setIsFullscreenVideo] = useState(false);
  // State for boost settings panel
  const [isBoostSettingsOpen, setIsBoostSettingsOpen] = useState(false);

  // PORTAL BELT toggle state - tap HOT/DISCOVERY to activate scrolling
  const [isHotBeltActive, setIsHotBeltActive] = useState(false);
  const [isDiscoveryBeltActive, setIsDiscoveryBeltActive] = useState(false);

  // CLEAN STATE: Two levels of reveal
  // TAP: Quick controls only (shuffle, repeat, share)
  // HOLD or DOUBLE TAP: Full DJ Mode (reactions + chat)
  const [isControlsRevealed, setIsControlsRevealed] = useState(false); // Level 1: Quick controls
  const [isReactionsRevealed, setIsReactionsRevealed] = useState(false); // Level 2: Full DJ
  const [activateChatTrigger, setActivateChatTrigger] = useState(0); // Increment to trigger chat
  const [showDJWakeMessage, setShowDJWakeMessage] = useState(false); // Tutorial toast
  const [djWakeMessageText, setDjWakeMessageText] = useState(''); // Dynamic message content
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRef = useRef<number>(0);
  const didHoldRef = useRef(false);
  const djWakeCountRef = useRef(0); // Track how many times DJ mode was activated

  // Quick controls state
  const [repeatMode, setRepeatMode] = useState<'off' | 'one' | 'all'>('off'); // off → one → all
  const [isShuffleOn, setIsShuffleOn] = useState(false);

  // Tutorial messages for DJ wake - rotates through different messages
  const DJ_WAKE_MESSAGES = [
    "Fiouuuh ✌🏾",
    "Now Peace ✌🏾",
    "DJ Mode Active ✌🏾",
    "Let's gooo ✌🏾",
  ];

  // Single tap counter for tutorial hint
  const singleTapCountRef = useRef(0);
  const hasShownHintRef = useRef(false);

  const showDJWakeToast = useCallback(() => {
    const messageIndex = djWakeCountRef.current % DJ_WAKE_MESSAGES.length;
    setDjWakeMessageText(DJ_WAKE_MESSAGES[messageIndex]);
    setShowDJWakeMessage(true);
    djWakeCountRef.current++;
    singleTapCountRef.current = 0; // Reset single tap counter
    hasShownHintRef.current = true; // User has discovered DJ mode
    setTimeout(() => setShowDJWakeMessage(false), 1500);
  }, []);

  // Show tutorial hint after 3 single taps
  const showTutorialHint = useCallback(() => {
    if (hasShownHintRef.current) return; // Already discovered DJ mode
    setDjWakeMessageText("Don't forget, double tap to wake DJ ✌🏾");
    setShowDJWakeMessage(true);
    setTimeout(() => setShowDJWakeMessage(false), 2000);
  }, []);

  // Handle tap/hold/double-tap
  const handleCanvasPointerDown = useCallback(() => {
    didHoldRef.current = false;
    // Start hold timer (400ms to trigger DJ mode)
    holdTimerRef.current = setTimeout(() => {
      didHoldRef.current = true;
      setIsControlsRevealed(true);
      setIsReactionsRevealed(true);
      showDJWakeToast();
      haptics.medium();
    }, 400);
  }, [showDJWakeToast]);

  const handleCanvasPointerUp = useCallback(() => {
    // Cancel hold timer
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  const handleCanvasTap = useCallback(() => {
    // Skip if this was a hold
    if (didHoldRef.current) {
      didHoldRef.current = false;
      return;
    }

    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      // Double tap → Straight to Wazzguan chat!
      setIsControlsRevealed(true);
      setIsReactionsRevealed(true);
      setActivateChatTrigger(prev => prev + 1); // Trigger chat activation
      haptics.medium();
    } else {
      // Single tap → Toggle quick controls only
      if (!isReactionsRevealed) {
        const wasHidden = !isControlsRevealed;
        setIsControlsRevealed(prev => !prev);
        if (wasHidden) {
          haptics.light();
          // In 'disappear' mode: show Peace toast on reveal (tutorial moment)
          if (oyeBarBehavior === 'disappear') {
            showDJWakeToast();
          }
        }

        // Track single taps for tutorial hint
        singleTapCountRef.current++;
        if (singleTapCountRef.current === 3 && !hasShownHintRef.current) {
          showTutorialHint();
        }
      }
    }
    lastTapRef.current = now;
  }, [isControlsRevealed, isReactionsRevealed, showTutorialHint, oyeBarBehavior, showDJWakeToast]);

  // AUTO-HIDE for 'disappear' mode - hide controls after 4 seconds
  const controlsHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    // Only auto-hide in 'disappear' mode when controls are revealed (not in DJ mode)
    if (oyeBarBehavior === 'disappear' && isControlsRevealed && !isReactionsRevealed) {
      controlsHideTimerRef.current = setTimeout(() => {
        setIsControlsRevealed(false);
      }, 4000); // Hide after 4 seconds
    }
    return () => {
      if (controlsHideTimerRef.current) clearTimeout(controlsHideTimerRef.current);
    };
  }, [isControlsRevealed, isReactionsRevealed, oyeBarBehavior]);

  // PORTAL SCROLL CONTROLS - tap red/blue portal to scroll outward (reverse direction)
  const [hotScrollTrigger, setHotScrollTrigger] = useState(0);
  const [discoveryScrollTrigger, setDiscoveryScrollTrigger] = useState(0);

  // PORTAL GLOW - lights up when scrolling outward (from VOYO to portal)
  const [hotPortalGlow, setHotPortalGlow] = useState(false);
  const [discoveryPortalGlow, setDiscoveryPortalGlow] = useState(false);


  // SKEEP STATE - Custom seek-based fast-forward/rewind (nostalgic CD player ch-ch-ch effect)
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubDirection, setScrubDirection] = useState<'forward' | 'backward' | null>(null);
  const [skeepLevel, setSkeepLevel] = useState(1); // 1=2x, 2=4x, 3=8x (for display)
  const skeepHoldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skeepSeekInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const skeepEscalateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasSkeeping = useRef(false); // Track if we just finished skeeping (to prevent skip on release)
  const skeepLevelRef = useRef(1);
  const skeepTargetTime = useRef(0); // Track target position ourselves (store updates too slowly)
  const wasPlayingBeforeSkeep = useRef(false); // Remember if we need to resume after SKEEP

  // Jump distances for seek-based SKEEP
  // BIGGER jumps for real impact - YouTube is PAUSED during seek mode
  // Level 1 (2x): 0.3s every 100ms = 3s/sec = ~3x (backward only, forward uses native)
  // Level 2 (4x): 0.6s every 100ms = 6s/sec = ~6x
  // Level 3 (8x): 1.2s every 100ms = 12s/sec = ~12x (feels like real fast-forward!)
  const getJumpDistance = (level: number, isBackward: boolean) => {
    if (isBackward) {
      if (level === 1) return 0.4;  // 2x feel
      if (level === 2) return 0.8;  // 4x feel
      return 1.5;                    // 8x feel
    }
    // Forward: level 1 uses native 2x, levels 2-3 use seek
    if (level === 2) return 0.8;    // 4x feel
    return 1.5;                      // 8x feel
  };

  // Handle SKEEP start (after 200ms hold to differentiate from tap)
  const handleScrubStart = useCallback((direction: 'forward' | 'backward') => {
    console.log('🎵 SKEEP: handleScrubStart called', direction);
    // Set a timer - if held for 200ms, start SKEEP mode
    skeepHoldTimer.current = setTimeout(() => {
      console.log('🎵 SKEEP: 200ms passed, starting SKEEP mode', direction);
      setIsScrubbing(true);
      setScrubDirection(direction);
      setSkeepLevel(1);
      skeepLevelRef.current = 1;
      haptics.medium();

      const isBackward = direction === 'backward';

      // HYBRID SKEEP:
      // - Forward Level 1: Native playbackRate=2 (smooth chipmunk)
      // - Forward Level 2+: Seek-based (ch-ch-ch)
      // - Backward: Always seek-based (no native reverse playback)

      if (!isBackward) {
        // Forward: start with native 2x
        console.log('🎵 SKEEP: Setting native playbackRate to 2');
        setPlaybackRate(2);
      }

      // Start seek interval for backward OR when we escalate past 2x
      const startSeekMode = () => {
        if (skeepSeekInterval.current) return; // Already running
        console.log('🎵 SKEEP: Starting seek mode');

        // PAUSE playback so YouTube doesn't fight our seeks!
        const { isPlaying } = usePlayerStore.getState();
        wasPlayingBeforeSkeep.current = isPlaying;
        if (isPlaying) {
          console.log('🎵 SKEEP: Pausing playback for clean seeks');
          handlePlayPause(); // Pause
        }

        // Initialize target time from current position
        const { currentTime, duration: dur } = usePlayerStore.getState();
        skeepTargetTime.current = currentTime;
        console.log('🎵 SKEEP: Initialized target time to', currentTime.toFixed(1));

        skeepSeekInterval.current = setInterval(() => {
          const { duration: dur } = usePlayerStore.getState();
          const jump = getJumpDistance(skeepLevelRef.current, isBackward);

          // Update OUR target time (don't read from store - it's too slow to update)
          skeepTargetTime.current = isBackward
            ? Math.max(skeepTargetTime.current - jump, 0)
            : Math.min(skeepTargetTime.current + jump, dur - 0.5);

          console.log('🎵 SKEEP: Seeking to', skeepTargetTime.current.toFixed(1), 'jump:', jump);
          seekTo(skeepTargetTime.current);
          haptics.light();
        }, 100); // Faster interval (100ms) for smoother seeking
      };

      // Backward starts seek immediately
      if (isBackward) {
        startSeekMode();
      }

      // Escalate every 800ms: level 1 → 2 → 3 (max)
      const escalate = () => {
        if (skeepLevelRef.current < 3) {
          skeepLevelRef.current += 1;
          setSkeepLevel(skeepLevelRef.current);
          haptics.heavy();

          // Forward: switch from native to seek at level 2
          if (!isBackward && skeepLevelRef.current === 2) {
            setPlaybackRate(1); // Reset native speed
            startSeekMode(); // Start seek-based
          }

          skeepEscalateTimer.current = setTimeout(escalate, 800);
        }
      };
      skeepEscalateTimer.current = setTimeout(escalate, 800);
    }, 200);
  }, [seekTo, setPlaybackRate, handlePlayPause]);

  // Handle SKEEP end
  const handleScrubEnd = useCallback(() => {
    // Clear hold timer
    if (skeepHoldTimer.current) {
      clearTimeout(skeepHoldTimer.current);
      skeepHoldTimer.current = null;
    }

    // Clear seek interval
    if (skeepSeekInterval.current) {
      clearInterval(skeepSeekInterval.current);
      skeepSeekInterval.current = null;
    }

    // Clear escalation timer
    if (skeepEscalateTimer.current) {
      clearTimeout(skeepEscalateTimer.current);
      skeepEscalateTimer.current = null;
    }

    // Return to normal playback
    if (isScrubbing) {
      wasSkeeping.current = true; // Flag to prevent skip on click
      setPlaybackRate(1); // Reset native playback speed
      setIsScrubbing(false);
      setScrubDirection(null);
      setSkeepLevel(1);
      skeepLevelRef.current = 1;

      // Resume playback if it was playing before SKEEP
      if (wasPlayingBeforeSkeep.current) {
        console.log('🎵 SKEEP: Resuming playback');
        setTimeout(() => {
          const { isPlaying } = usePlayerStore.getState();
          if (!isPlaying) handlePlayPause(); // Resume
        }, 50); // Small delay to let seek settle
      }
      wasPlayingBeforeSkeep.current = false;

      // Clear the flag after a short delay (after onClick would have fired)
      setTimeout(() => { wasSkeeping.current = false; }, 100);
    }
  }, [isScrubbing, setPlaybackRate, handlePlayPause]);

  // Safe next track - doesn't skip if we were just skeeping
  const handleNextTrack = useCallback(() => {
    if (wasSkeeping.current) return; // Block skip after SKEEP
    nextTrack();
  }, [nextTrack]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (skeepEscalateTimer.current) clearInterval(skeepEscalateTimer.current);
      if (skeepHoldTimer.current) clearTimeout(skeepHoldTimer.current);
    };
  }, []);

  // Get actual history tracks (these are "played")
  const historyTracks = history.slice(-2).map(h => h.track).reverse();

  // Get actual queue tracks
  const queueTracks = queue.slice(0, 1).map(q => q.track);

  // Track IDs that have been played (for overlay)
  const playedTrackIds = new Set(history.map(h => h.track.id));

  // Handle reaction with store integration
  const handleReaction = (type: ReactionType, emoji: string, text: string, multiplier: number) => {
    addReaction({
      type,
      text,
      emoji,
      x: Math.random() * 80 + 10, // Random position between 10-90%
      y: 50,
      multiplier,
      userId: 'user-1', // Default user
    });
  };

  // ============================================
  // MOBILE TEASER PREVIEW (30 seconds at 30% volume)
  // ============================================
  const [teaserTrack, setTeaserTrack] = useState<Track | null>(null);
  const [isTeaserPlaying, setIsTeaserPlaying] = useState(false);
  const teaserAudioRef = useRef<HTMLAudioElement | null>(null);
  const teaserTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Handle teaser playback for mobile tap
  const handleTeaser = useCallback((track: Track) => {
    // Stop any existing teaser
    if (teaserAudioRef.current) {
      teaserAudioRef.current.pause();
      teaserAudioRef.current = null;
    }
    if (teaserTimeoutRef.current) {
      clearTimeout(teaserTimeoutRef.current);
    }

    // Create audio element for teaser preview
    // Note: In production, this would use the actual audio source
    // For now, we'll set the current track and auto-stop after 30s
    setTeaserTrack(track);
    setIsTeaserPlaying(true);
    setCurrentTrack(track);

    // Auto-stop after 30 seconds
    teaserTimeoutRef.current = setTimeout(() => {
      setIsTeaserPlaying(false);
      setTeaserTrack(null);
      // Don't auto-pause - let user decide
    }, 30000);
  }, [setCurrentTrack]);

  // Cleanup teaser on unmount
  useEffect(() => {
    return () => {
      if (teaserTimeoutRef.current) clearTimeout(teaserTimeoutRef.current);
      if (teaserAudioRef.current) teaserAudioRef.current.pause();
    };
  }, []);

  return (
    <div
      className="relative w-full bg-[#020203] text-white font-sans overflow-hidden flex flex-col"
      style={{ height: 'calc(100vh - env(safe-area-inset-bottom))' }}
    >

      {/* FULLSCREEN BACKGROUND - Album art with dark overlay for floating effect */}
      {backdropEnabled && (
        <FullscreenBackground
          trackId={currentTrack?.trackId}
          isVideoMode={false}
        />
      )}

      {/* BACKDROP TOGGLE - Sleek vertical toggle on left side */}
      <BackdropToggle
        isEnabled={backdropEnabled}
        onToggle={() => setBackdropEnabled(!backdropEnabled)}
        onOpenLibrary={() => setIsBackdropLibraryOpen(true)}
      />

      {/* BACKDROP LIBRARY MODAL */}
      <AnimatePresence>
        {isBackdropLibraryOpen && (
          <BackdropLibrary
            isOpen={isBackdropLibraryOpen}
            onClose={() => setIsBackdropLibraryOpen(false)}
            currentBackdrop={currentBackdrop}
            onSelect={(bd) => {
              setCurrentBackdrop(bd);
              setBackdropEnabled(true);
              setIsBackdropLibraryOpen(false);
            }}
          />
        )}
      </AnimatePresence>

      {/* Noise texture overlay */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay pointer-events-none z-[1]" />

      {/* TEASER PREVIEW INDICATOR - Shows when 30s preview is active */}
      <AnimatePresence>
        {isTeaserPlaying && teaserTrack && (
          <motion.div
            className="absolute top-4 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/90 backdrop-blur-sm border border-cyan-400/50 shadow-lg"
            initial={{ opacity: 0, y: -20, scale: 0.88 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.88 }}
            transition={springs.smooth}
          >
            <motion.div
              className="w-2 h-2 rounded-full bg-white"
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            />
            <span className="text-white text-xs font-bold">30s Preview</span>
            <motion.button
              className="ml-1 p-1 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
              onClick={() => {
                setIsTeaserPlaying(false);
                setTeaserTrack(null);
                if (teaserTimeoutRef.current) {
                  clearTimeout(teaserTimeoutRef.current);
                }
              }}
              whileTap={{ scale: 0.92 }}
              transition={springs.snappy}
            >
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FULLSCREEN VIDEO PLAYER - Shows when expand button clicked */}
      <AnimatePresence>
        {isFullscreenVideo && currentTrack && (
          <FullscreenVideoPlayer
            track={currentTrack}
            isPlaying={isPlaying}
            onClose={() => setIsFullscreenVideo(false)}
            onTogglePlay={handlePlayPause}
          />
        )}
      </AnimatePresence>

      {/* --- TOP SECTION (History/Queue) - FIX 4: Safe area insets --- */}
      <div className="px-6 flex justify-between items-start z-20 h-[18%]" style={{ paddingTop: 'max(2rem, env(safe-area-inset-top))' }}>

        {/* Left: History (scrollable) */}
        <div className="relative max-w-[48%]">
          {/* Scroll fade indicator - right edge */}
          {historyTracks.length > 2 && (
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#0a0a0f] to-transparent pointer-events-none z-10" />
          )}

          <div
            className="flex gap-3 overflow-x-auto scrollbar-hide"
            style={{ scrollSnapType: 'x mandatory' }}
          >
            {historyTracks.length > 0 ? (
              historyTracks.slice(0, 10).map((track, i) => (
                <div key={track.id + i} style={{ scrollSnapAlign: 'start', flexShrink: 0 }}>
                  <SmallCard
                    track={track}
                    onTap={() => setCurrentTrack(track)}
                    isPlayed={true}
                  />
                </div>
              ))
            ) : (
              // Empty state - show DASH placeholders
              <>
                <DashPlaceholder onClick={onSearch} label="history" />
                <DashPlaceholder onClick={onSearch} label="history" />
              </>
            )}
          </div>
        </div>

        {/* Right: Queue + Add (scrollable, reversed) */}
        <div className="relative max-w-[48%]">
          {/* Scroll fade indicator - left edge */}
          {queueTracks.length > 1 && (
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[#0a0a0f] to-transparent pointer-events-none z-10" />
          )}

          <div
            className="flex gap-3 overflow-x-auto scrollbar-hide flex-row-reverse"
            style={{ scrollSnapType: 'x mandatory' }}
          >
            {/* Add button always visible at end */}
            <button
              onClick={onSearch}
              className="flex-shrink-0 w-[70px] h-[70px] rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
              style={{ scrollSnapAlign: 'start' }}
            >
              <Plus size={24} className="text-gray-500" />
            </button>

            {queueTracks.length > 0 ? (
              queueTracks.slice(0, 10).map((track, i) => (
                <div key={track.id + i} style={{ scrollSnapAlign: 'start', flexShrink: 0 }}>
                  <SmallCard
                    track={track}
                    onTap={() => setCurrentTrack(track)}
                    isPlayed={playedTrackIds.has(track.id)}
                  />
                </div>
              ))
            ) : (
              // Empty queue - show DASH placeholder
              <DashPlaceholder onClick={onSearch} label="queue" />
            )}
          </div>
        </div>
      </div>

      {/* --- CENTER SECTION (Hero + Engine) --- */}
      {/* TAP: Quick controls | HOLD/DOUBLE TAP: Full DJ Mode */}
      <div
        className="flex-1 flex flex-col items-center relative z-10 -mt-2"
        onPointerDown={handleCanvasPointerDown}
        onPointerUp={handleCanvasPointerUp}
        onPointerLeave={handleCanvasPointerUp}
        onClick={handleCanvasTap}
      >

        {/* RIGHT-SIDE TOOLBAR - Always visible */}
        <RightToolbar onSettingsClick={() => setIsBoostSettingsOpen(true)} />

        {/* 1. Main Artwork with Expand Video Button */}
        <div className="relative">
          {currentTrack ? (
            <BigCenterCard
              track={currentTrack}
              onExpandVideo={() => setIsFullscreenVideo(true)}
            />
          ) : (
            <div className="w-48 h-48 rounded-[2rem] bg-white/5 border border-white/10 flex items-center justify-center">
              <Play size={32} className="text-white/20" />
            </div>
          )}

          {/* LEFT QUICK CONTROLS - ")" arc: center reaches IN toward card */}
          <AnimatePresence>
            {isControlsRevealed && (
              <motion.div
                className="absolute top-1/2 -translate-y-1/2 -left-14 flex flex-col gap-4"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ type: 'spring', damping: 20 }}
              >
                {/* Shuffle - Top of ")", slightly OUT */}
                <motion.button
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors -translate-x-[2px] ${
                    isShuffleOn
                      ? 'bg-fuchsia-500/30 border border-fuchsia-500/50 text-fuchsia-400'
                      : 'bg-fuchsia-500/20 border border-fuchsia-500/30 text-fuchsia-300/70 hover:bg-fuchsia-500/30'
                  }`}
                  whileTap={{ scale: 0.9 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsShuffleOn(prev => !prev);
                    haptics.light();
                  }}
                  title={isShuffleOn ? 'Shuffle On' : 'Shuffle Off'}
                >
                  <Shuffle size={16} />
                </motion.button>

                {/* Repeat - Middle of ")", reaches IN closest to card */}
                <motion.button
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors translate-x-[6px] ${
                    repeatMode === 'one'
                      ? 'bg-orange-500/30 border border-orange-500/50 text-orange-400'
                      : repeatMode === 'all'
                      ? 'bg-fuchsia-500/30 border border-fuchsia-500/50 text-fuchsia-400'
                      : 'bg-fuchsia-500/20 border border-fuchsia-500/30 text-fuchsia-300/70 hover:bg-fuchsia-500/30'
                  }`}
                  whileTap={{ scale: 0.9 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setRepeatMode(prev => {
                      if (prev === 'off') return 'one';
                      if (prev === 'one') return 'all';
                      return 'off';
                    });
                    haptics.light();
                  }}
                  title={repeatMode === 'one' ? 'Repeat One' : repeatMode === 'all' ? 'Repeat All' : 'Repeat Off'}
                >
                  {repeatMode === 'one' ? <Repeat1 size={16} /> : <Repeat size={16} />}
                </motion.button>

                {/* Share - Bottom of ")", slightly OUT */}
                <motion.button
                  className="w-9 h-9 rounded-full bg-fuchsia-500/20 border border-fuchsia-500/30 flex items-center justify-center text-fuchsia-300/70 hover:bg-fuchsia-500/30 transition-colors -translate-x-[2px]"
                  whileTap={{ scale: 0.9 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (currentTrack && navigator.share) {
                      navigator.share({
                        title: currentTrack.title,
                        text: `Listen to ${currentTrack.title} by ${currentTrack.artist} on VOYO`,
                        url: window.location.href,
                      }).catch(() => {});
                    }
                    haptics.light();
                  }}
                  title="Share"
                >
                  <Share2 size={16} />
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

        </div>

        {/* FLOATING REACTIONS OVERLAY */}
        <div className="absolute inset-0 pointer-events-none">
          <AnimatePresence>
            {reactions.map(reaction => (
              <motion.div
                key={reaction.id}
                className="absolute"
                style={{ left: `${reaction.x}%`, bottom: '30%' }}
                initial={{ opacity: 1, y: 0, scale: 0.5 }}
                animate={{
                  opacity: 0,
                  y: -100,
                  scale: reaction.multiplier >= 10 ? 2.5 : 1.5
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 2 }}
              >
                <div className="flex flex-col items-center gap-1">
                  <span className="text-3xl">{reaction.emoji}</span>
                  {reaction.multiplier > 1 && (
                    <span className={`font-bold ${reaction.multiplier >= 10 ? 'text-2xl text-yellow-300' : 'text-lg text-yellow-400'}`}>
                      {reaction.multiplier}x{reaction.multiplier >= 10 ? '!!!' : ''}
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* MINIMAL PROGRESS - Fades when idle, only current time + red dot */}
        <motion.div
          className="w-full max-w-[180px] mt-2 mb-1 px-2 z-30"
          animate={{ opacity: isScrubbing ? 1 : 0.25 }}
          whileHover={{ opacity: 0.8 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center gap-2">
            {/* Current Time only - no end time needed */}
            <span className="text-[8px] text-white/40 font-mono tabular-nums min-w-[26px]">
              {Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, '0')}
            </span>

            {/* Translucent track + red dot */}
            <div className="flex-1 relative h-3 flex items-center">
              <div className="absolute left-0 right-0 h-[1px] bg-white/15 rounded-full" />
              <input
                type="range"
                min="0"
                max={duration || 100}
                value={currentTime}
                onChange={(e) => seekTo(parseFloat(e.target.value))}
                className="absolute inset-0 w-full opacity-0 cursor-pointer z-10"
              />
              <motion.div
                className="absolute w-[5px] h-[5px] rounded-full bg-red-500/90"
                animate={{
                  scale: isScrubbing ? 1.3 : 1,
                }}
                style={{
                  left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                  transform: 'translateX(-50%)',
                  boxShadow: isScrubbing ? '0 0 10px rgba(239,68,68,0.9)' : '0 0 4px rgba(239,68,68,0.4)',
                }}
              />
            </div>
          </div>
        </motion.div>

        {/* 2. THE ENGINE (Play Control) - SPINNING VINYL DISK + HOLD TO SKEEP */}
        <PlayControls
          isPlaying={isPlaying}
          onToggle={handlePlayPause}
          onPrev={prevTrack}
          onNext={handleNextTrack}
          currentTime={currentTime}
          duration={duration}
          isScrubbing={isScrubbing}
          onScrubStart={handleScrubStart}
          onScrubEnd={handleScrubEnd}
          trackArt={currentTrack ? getTrackThumbnailUrl(currentTrack, 'medium') : undefined}
          scrubDirection={scrubDirection}
          skeepLevel={skeepLevel}
        />

        {/* 3. OYÉ REACTIONS - ALWAYS visible (ghosted in fade mode), lights up on tap */}
        <div className="mt-6 min-h-[60px] flex items-center justify-center">
          <ReactionBar
            onReaction={handleReaction}
            isRevealed={isControlsRevealed || isReactionsRevealed}
            onRevealChange={setIsReactionsRevealed}
            oyeBarBehavior={oyeBarBehavior}
            activateChatTrigger={activateChatTrigger}
          />
        </div>

        {/* DJ Wake Toast - "Now Peace ✌🏾" */}
        <AnimatePresence>
          {showDJWakeMessage && (
            <motion.div
              className="fixed inset-0 flex items-center justify-center pointer-events-none z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="px-6 py-3 rounded-full bg-black/60 backdrop-blur-xl border border-white/10"
                initial={{ scale: 0.8, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: -10, opacity: 0 }}
                transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              >
                <span className="text-white text-lg font-medium tracking-wide">
                  {djWakeMessageText}
                </span>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* --- BOTTOM SECTION: DASHBOARD - FIX 4: Safe area insets --- */}
      <div
        className="h-[40%] w-full bg-[#08080a]/95 backdrop-blur-2xl rounded-t-[2.5rem] border-t border-white/5 relative z-40 flex flex-col pt-5 shadow-[0_-20px_60px_-10px_rgba(0,0,0,1)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >

        {/* Stream Labels - Tap to toggle belt scroll */}
        <div className="flex justify-between px-6 mb-3">
          <motion.button
            onClick={() => setIsHotBeltActive(prev => !prev)}
            className="text-[10px] font-bold tracking-[0.2em] text-rose-500 uppercase flex items-center gap-1"
            animate={isHotBeltActive ? {
              opacity: [1, 0.5, 1],
              transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' }
            } : { opacity: 1 }}
            whileTap={{ scale: 0.96 }}
            transition={springs.snappy}
          >
            <Flame size={10} /> HOT
            {isHotBeltActive && <span className="text-[6px] text-rose-400/60 ml-1">ON</span>}
          </motion.button>
          <motion.button
            onClick={() => setIsDiscoveryBeltActive(prev => !prev)}
            className="text-[10px] font-bold tracking-[0.2em] text-cyan-500 uppercase flex items-center gap-1"
            animate={isDiscoveryBeltActive ? {
              opacity: [1, 0.5, 1],
              transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' }
            } : { opacity: 1 }}
            whileTap={{ scale: 0.96 }}
            transition={springs.snappy}
          >
            DISCOVERY
            {isDiscoveryBeltActive && <span className="text-[6px] text-cyan-400/60 ml-1">ON</span>}
          </motion.button>
        </div>

        {/* Horizontal Scroll Deck - Two Separate Zones */}
        <div className="flex items-center relative h-24">

          {/* ========== HOT ZONE (Left side) ========== */}
          <div className="flex-1 flex items-center relative h-full">
            {/* Red Portal Line (left edge of HOT zone) - CLICKABLE SCROLL CONTROL */}
            <motion.button
              onClick={() => {
                setHotScrollTrigger(prev => prev + 1);
                setIsHotBeltActive(true);
                // Trigger glow effect
                setHotPortalGlow(true);
                setTimeout(() => setHotPortalGlow(false), 800);
              }}
              whileTap={{ scale: 1.3 }}
              className="flex-shrink-0 w-5 h-20 relative z-20 ml-1 touch-manipulation"
              aria-label="Scroll HOT belt outward"
            >
              {/* Portal line */}
              <motion.div
                className="h-full w-1.5 mx-auto rounded-full"
                style={{
                  background: hotPortalGlow
                    ? 'linear-gradient(180deg, #ff6b6b, #ff4444, #ff6b6b)'
                    : 'linear-gradient(180deg, rgba(239,68,68,0.3), rgb(239,68,68), rgba(239,68,68,0.3))'
                }}
                animate={hotPortalGlow ? {
                  boxShadow: ['0 0 10px #ff4444', '0 0 30px #ff4444', '0 0 10px #ff4444'],
                } : {}}
                transition={{ duration: 0.4 }}
              />
              {/* Ambient glow - always visible */}
              <div className={`absolute inset-0 bg-red-500 blur-lg transition-opacity duration-300 ${hotPortalGlow ? 'opacity-100' : 'opacity-40'}`} />
              {/* Pulse ring on glow */}
              <AnimatePresence>
                {hotPortalGlow && (
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-red-400"
                    initial={{ scale: 0.5, opacity: 1 }}
                    animate={{ scale: 2, opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.6 }}
                  />
                )}
              </AnimatePresence>
              {/* Arrow hint */}
              <motion.div
                className="absolute inset-0 flex items-center justify-center text-xs"
                animate={{ color: hotPortalGlow ? '#ffffff' : 'rgba(248,113,113,0.6)' }}
              >
                ‹
              </motion.div>
            </motion.button>

            {/* HOT Cards Belt (loops within this zone) */}
            <PortalBelt
              tracks={hotTracks.slice(0, 8)}
              onTap={setCurrentTrack}
              onTeaser={handleTeaser}
              playedTrackIds={playedTrackIds}
              type="hot"
              isActive={isHotBeltActive}
              scrollOutwardTrigger={hotScrollTrigger}
            />
          </div>

          {/* ========== VOYO FEED DIVIDER - Enhanced Portal Effects ========== */}
          <div className="flex-shrink-0 px-1 relative z-30">
            {/* Left fade - covers track overflow with dark gradient */}
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 w-16 h-28 -translate-x-12 pointer-events-none"
              style={{ background: 'linear-gradient(to right, #08080a 0%, #08080a 30%, transparent 100%)' }}
            />
            {/* Left glow (red) - enhanced with animation */}
            <motion.div
              className="absolute left-0 top-1/2 -translate-y-1/2 w-12 h-20 -translate-x-8 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse at right, rgba(239,68,68,0.5) 0%, transparent 70%)' }}
              animate={{ opacity: [0.6, 0.9, 0.6] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            />
            {/* Right fade - covers track overflow with dark gradient */}
            <div
              className="absolute right-0 top-1/2 -translate-y-1/2 w-16 h-28 translate-x-12 pointer-events-none"
              style={{ background: 'linear-gradient(to left, #08080a 0%, #08080a 30%, transparent 100%)' }}
            />
            {/* Right glow (blue) - enhanced with animation */}
            <motion.div
              className="absolute right-0 top-1/2 -translate-y-1/2 w-12 h-20 translate-x-8 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse at left, rgba(59,130,246,0.5) 0%, transparent 70%)' }}
              animate={{ opacity: [0.6, 0.9, 0.6] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
            />

            {/* VOYO Portal Button with enhanced effects */}
            <motion.button
              onClick={onVoyoFeed}
              whileTap={{ scale: 0.9 }}
              whileHover={{ scale: 1.05 }}
              transition={springs.snappy}
              className="relative w-14 h-14 rounded-full flex flex-col items-center justify-center"
              style={{
                background: 'radial-gradient(circle at center, #1a1a2e 0%, #0f0f16 100%)',
                border: '2px solid rgba(255,255,255,0.2)',
                boxShadow: '-8px 0 25px rgba(239,68,68,0.5), 8px 0 25px rgba(59,130,246,0.5), 0 0 20px rgba(147,51,234,0.3)',
              }}
            >
              {/* Outer rotating ring */}
              <motion.div
                className="absolute inset-[-4px] rounded-full border-2 border-transparent pointer-events-none"
                style={{
                  background: 'linear-gradient(90deg, rgba(239,68,68,0.6), transparent, rgba(59,130,246,0.6)) padding-box, linear-gradient(90deg, #ef4444, #8b5cf6, #3b82f6) border-box',
                }}
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
              />
              {/* Inner pulsing glow */}
              <motion.div
                className="absolute inset-0 rounded-full pointer-events-none"
                style={{ background: 'radial-gradient(circle at center, rgba(147,51,234,0.3) 0%, transparent 70%)' }}
                animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.8, 0.5] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              />
              <span className="text-[9px] font-bold text-white tracking-widest relative z-10">VOYO</span>
            </motion.button>
          </div>

          {/* ========== DISCOVERY ZONE (Right side) ========== */}
          <div className="flex-1 flex items-center relative h-full">
            {/* DISCOVERY Cards Belt (loops within this zone) */}
            <PortalBelt
              tracks={discoverTracks.slice(0, 8)}
              onTap={setCurrentTrack}
              onTeaser={handleTeaser}
              playedTrackIds={playedTrackIds}
              type="discovery"
              isActive={isDiscoveryBeltActive}
              scrollOutwardTrigger={discoveryScrollTrigger}
            />

            {/* Blue Portal Line (right edge of DISCOVERY zone) - CLICKABLE SCROLL CONTROL */}
            <motion.button
              onClick={() => {
                setDiscoveryScrollTrigger(prev => prev + 1);
                setIsDiscoveryBeltActive(true);
                // Trigger glow effect
                setDiscoveryPortalGlow(true);
                setTimeout(() => setDiscoveryPortalGlow(false), 800);
              }}
              whileTap={{ scale: 1.3 }}
              className="flex-shrink-0 w-5 h-20 relative z-20 mr-1 touch-manipulation"
              aria-label="Scroll DISCOVERY belt outward"
            >
              {/* Portal line */}
              <motion.div
                className="h-full w-1.5 mx-auto rounded-full"
                style={{
                  background: discoveryPortalGlow
                    ? 'linear-gradient(180deg, #60a5fa, #3b82f6, #60a5fa)'
                    : 'linear-gradient(180deg, rgba(59,130,246,0.3), rgb(59,130,246), rgba(59,130,246,0.3))'
                }}
                animate={discoveryPortalGlow ? {
                  boxShadow: ['0 0 10px #3b82f6', '0 0 30px #3b82f6', '0 0 10px #3b82f6'],
                } : {}}
                transition={{ duration: 0.4 }}
              />
              {/* Ambient glow - always visible */}
              <div className={`absolute inset-0 bg-blue-500 blur-lg transition-opacity duration-300 ${discoveryPortalGlow ? 'opacity-100' : 'opacity-40'}`} />
              {/* Pulse ring on glow */}
              <AnimatePresence>
                {discoveryPortalGlow && (
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-blue-400"
                    initial={{ scale: 0.5, opacity: 1 }}
                    animate={{ scale: 2, opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.6 }}
                  />
                )}
              </AnimatePresence>
              {/* Arrow hint */}
              <motion.div
                className="absolute inset-0 flex items-center justify-center text-xs"
                animate={{ color: discoveryPortalGlow ? '#ffffff' : 'rgba(96,165,250,0.6)' }}
              >
                ›
              </motion.div>
            </motion.button>
          </div>

        </div>

        {/* PLAYLIST RECOMMENDATION BAR */}
        <div className="mt-4 px-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-bold tracking-[0.15em] text-purple-400 uppercase">Your Playlists</span>
            <span className="text-[8px] text-gray-500">See all</span>
          </div>
          <div className="overflow-x-auto no-scrollbar flex gap-3 pb-3">
            {/* Playlist Cards */}
            {[
              { id: 'pl1', title: 'Afro Heat 2024', count: 45, color: 'from-orange-500/30 to-red-500/20' },
              { id: 'pl2', title: 'Chill Vibes', count: 32, color: 'from-cyan-500/30 to-blue-500/20' },
              { id: 'pl3', title: 'Party Mode', count: 58, color: 'from-purple-500/30 to-pink-500/20' },
              { id: 'pl4', title: 'Workout', count: 24, color: 'from-green-500/30 to-emerald-500/20' },
            ].map(pl => (
              <motion.button
                key={pl.id}
                className={`flex-shrink-0 w-28 h-14 rounded-xl bg-gradient-to-br ${pl.color} border border-white/5 flex items-center justify-center relative overflow-hidden`}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                transition={springs.smooth}
              >
                <div className="text-center">
                  <div className="text-[10px] font-bold text-white">{pl.title}</div>
                  <div className="text-[8px] text-white/50">{pl.count} tracks</div>
                </div>
              </motion.button>
            ))}
            {/* Add New */}
            <button
              onClick={onSearch}
              className="flex-shrink-0 w-28 h-14 rounded-xl bg-white/5 border border-dashed border-white/10 flex items-center justify-center gap-1 hover:bg-white/10 transition-colors"
            >
              <Plus size={12} className="text-gray-500" />
              <span className="text-[9px] text-gray-500 font-bold">New</span>
            </button>
          </div>
        </div>

      </div>

      {/* BOOST SETTINGS PANEL */}
      <BoostSettings
        isOpen={isBoostSettingsOpen}
        onClose={() => setIsBoostSettingsOpen(false)}
      />

    </div>
  );
};

export default VoyoPortraitPlayer;
