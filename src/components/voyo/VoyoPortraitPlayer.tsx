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
  Play, Pause, SkipForward, SkipBack, Zap, Flame, Plus, Maximize2, Film, Settings, Download
} from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { useDownloadStore } from '../../store/downloadStore';
import { getThumbnailUrl, getTrackThumbnailUrl } from '../../utils/imageHelpers';
import { Track, ReactionType } from '../../types';
import { SmartImage } from '../ui/SmartImage';
import { unlockMobileAudio, isMobileDevice } from '../../utils/mobileAudioUnlock';
import { useMobilePlay } from '../../hooks/useMobilePlay';
import { BoostButton, AutoBoostPrompt } from '../ui/BoostButton';
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
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0, scale: 1.1 }}
        animate={{ opacity: 1, scale: 1.05 }}
        transition={{ duration: 1.5, ease: 'easeOut' }}
        key={trackId} // Re-animate on track change
      >
        <SmartImage
          src={getThumbnailUrl(trackId, 'high')}
          alt="Background"
          className="w-full h-full object-cover blur-2xl scale-110"
          trackId={trackId}
          lazy={false}
        />
      </motion.div>

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
      whileTap={{ scale: 0.95 }}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.3 }}
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
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
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
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
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
              whileTap={bd.locked ? {} : { scale: 0.95 }}
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
    whileHover={{ scale: 1.1 }}
    whileTap={{ scale: 0.9 }}
    initial={{ opacity: 0, scale: 0.8 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ delay: 0.2 }}
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
  const boostTrack = useDownloadStore(state => state.boostTrack);
  const currentTrack = usePlayerStore(state => state.currentTrack);

  const handleDownload = () => {
    if (!currentTrack?.trackId) return;

    boostTrack(
      currentTrack.trackId,
      currentTrack.title,
      currentTrack.artist,
      currentTrack.duration || 0,
      getThumbnailUrl(currentTrack.trackId, 'medium')
    );
  };

  return (
    <motion.div
      className="absolute right-4 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-3"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.4, duration: 0.4 }}
    >
      {/* Glassmorphism container */}
      <div className="relative flex flex-col gap-3 p-2 rounded-2xl bg-gradient-to-b from-purple-900/20 to-pink-900/20 backdrop-blur-xl border border-white/10 shadow-[0_0_30px_rgba(147,51,234,0.15)]">

        {/* Boost Button - Icon variant */}
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <BoostButton variant="icon" />
        </motion.div>

        {/* Divider */}
        <div className="h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />

        {/* Download Button */}
        <motion.button
          onClick={handleDownload}
          className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-full bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 flex items-center justify-center hover:from-cyan-500/30 hover:to-blue-500/30 transition-colors group relative"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          title="Download track"
        >
          <Download size={14} className="text-cyan-400" />

          {/* Tooltip */}
          <div className="absolute right-full mr-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <div className="bg-black/80 backdrop-blur-sm text-white text-[9px] px-2 py-1.5 rounded-lg whitespace-nowrap border border-white/10">
              Download
            </div>
          </div>
        </motion.button>

        {/* Divider */}
        <div className="h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />

        {/* Settings Button */}
        <motion.button
          onClick={onSettingsClick}
          className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-full bg-gradient-to-br from-white/5 to-white/10 border border-white/10 flex items-center justify-center hover:bg-white/20 transition-colors group relative"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          title="Boost settings"
        >
          <Settings size={14} className="text-gray-400" />

          {/* Tooltip */}
          <div className="absolute right-full mr-3 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <div className="bg-black/80 backdrop-blur-sm text-white text-[9px] px-2 py-1.5 rounded-lg whitespace-nowrap border border-white/10">
              Settings
            </div>
          </div>
        </motion.button>
      </div>

      {/* Pulsing glow effect when idle */}
      <motion.div
        className="absolute inset-0 rounded-2xl bg-purple-500/10 blur-xl -z-10"
        animate={{
          opacity: [0.3, 0.6, 0.3],
          scale: [0.95, 1.05, 0.95],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
    </motion.div>
  );
};

// Spring configs
const springs = {
  gentle: { type: 'spring' as const, stiffness: 120, damping: 14 },
  snappy: { type: 'spring' as const, stiffness: 400, damping: 30 },
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
    whileTap={{ scale: 0.95 }}
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
    whileTap={{ scale: 0.95 }}
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
}

const PortalBelt = ({ tracks, onTap, onTeaser, playedTrackIds, type, isActive }: PortalBeltProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Manual scroll state
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartOffset = useRef(0);

  const isHot = type === 'hot';
  // INWARD direction: HOT scrolls RIGHT (+), DISCOVERY scrolls LEFT (-)
  // Both flow toward center (VOYO button)
  const speed = isHot ? 0.4 : -0.4;

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
                left: x,
                width: cardWidth,
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
    dragStartX.current = clientX;
    dragStartOffset.current = offset;
    setIsPaused(true);
  };

  const handleDragMove = (clientX: number) => {
    if (!isDragging.current) return;
    const delta = clientX - dragStartX.current;
    let newOffset = dragStartOffset.current + delta;

    // Wrap around for infinite scroll feel
    while (newOffset <= -totalWidth) newOffset += totalWidth;
    while (newOffset >= totalWidth) newOffset -= totalWidth;

    setOffset(newOffset);
  };

  const handleDragEnd = () => {
    isDragging.current = false;
    // Keep paused for 2 seconds after drag ends to let user see position
    setTimeout(() => setIsPaused(false), 2000);
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

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    handleDragStart(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    handleDragMove(e.touches[0].clientX);
  };

  const handleTouchEnd = () => {
    handleDragEnd();
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 relative h-20 overflow-hidden cursor-grab active:cursor-grabbing"
      onMouseEnter={() => !isDragging.current && setIsPaused(true)}
      onMouseLeave={() => {
        if (!isDragging.current) setIsPaused(false);
        handleDragEnd();
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Cards container */}
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

  // Detect touch device
  useEffect(() => {
    const checkTouch = () => {
      setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
    };
    checkTouch();
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
      setTimeout(() => setShowTeaserFeedback(false), 2000);
    } else {
      // On desktop: click = full play
      onTap();
    }
  };

  return (
    <motion.div
      className="flex-shrink-0 flex flex-col items-center w-16 relative"
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.2}
      onDragStart={() => setWasDragged(true)}
      onDragEnd={(_, info) => {
        // Check if dragged right beyond threshold (100px)
        if (info.offset.x > 100) {
          haptics.success();
          addToQueue(track);
          setShowQueueFeedback(true);
          setTimeout(() => setShowQueueFeedback(false), 1500);
        }
        // Reset drag state after a short delay to prevent tap from firing
        setTimeout(() => setWasDragged(false), 100);
      }}
      whileTap={{ cursor: 'grabbing' }}
    >
      {/* Queue Feedback Indicator */}
      <AnimatePresence>
        {showQueueFeedback && (
          <motion.div
            className="absolute -top-8 left-1/2 -translate-x-1/2 z-50 bg-purple-500 text-white text-[9px] font-bold px-3 py-1.5 rounded-full shadow-lg whitespace-nowrap"
            initial={{ opacity: 0, y: 10, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.8 }}
          >
            Added to Queue
          </motion.div>
        )}
      </AnimatePresence>

      {/* Teaser Feedback Indicator */}
      <AnimatePresence>
        {showTeaserFeedback && (
          <motion.div
            className="absolute -top-8 left-1/2 -translate-x-1/2 z-50 bg-cyan-500 text-white text-[9px] font-bold px-3 py-1.5 rounded-full shadow-lg whitespace-nowrap flex items-center gap-1"
            initial={{ opacity: 0, y: 10, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.8 }}
          >
            <Play size={10} fill="white" /> 30s Preview
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        className="flex flex-col items-center group w-full"
        onClick={handleTap}
        whileHover={{ scale: 1.08, y: -2 }}
        whileTap={{ scale: 0.95 }}
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
    initial={{ scale: 0.9, opacity: 0 }}
    animate={{ scale: 1, opacity: 1 }}
    transition={springs.gentle}
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
}) => {
  // Format time display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate spin animation based on state
  const getSpinAnimation = () => {
    if (isScrubbing) {
      // Fast spin during scrub in the direction
      return {
        rotate: scrubDirection === 'forward' ? [0, 360] : [0, -360],
        transition: { duration: 0.4, repeat: Infinity, ease: 'linear' as const }
      };
    }
    if (isPlaying) {
      // Slow vinyl spin during playback
      return {
        rotate: [0, 360],
        transition: { duration: 3, repeat: Infinity, ease: 'linear' as const }
      };
    }
    return { rotate: 0 };
  };

  return (
    <div className="relative flex items-center justify-center w-full mb-6 z-30">
      {/* RED DOT TIME INDICATOR - Only shows when scrubbing */}
      <AnimatePresence>
        {isScrubbing && (
          <motion.div
            className="absolute -top-10 left-1/2 -translate-x-1/2 flex items-center gap-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
          >
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
            <span className="text-white font-mono text-sm tabular-nums">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
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
        whileTap={{ scale: 0.9 }}
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
          transition={{ duration: 0.3 }}
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
        whileTap={{ scale: 0.9 }}
      >
        <SkipForward size={24} fill="currentColor" />
      </motion.button>
    </div>
  );
});

// ============================================
// REACTIONS BAR - HOLD-TO-CHARGE OYÉ MULTIPLIER
// ============================================
const ReactionBar = memo(({
  onReaction
}: {
  onReaction: (type: ReactionType, emoji: string, text: string, multiplier: number) => void
}) => {
  const [charging, setCharging] = useState<string | null>(null);
  const [chargeStart, setChargeStart] = useState<number>(0);
  const [currentMultiplier, setCurrentMultiplier] = useState<number>(1);

  const handlePressStart = (type: string) => {
    setCharging(type);
    setChargeStart(Date.now());
    setCurrentMultiplier(1);
  };

  const handlePressEnd = (type: ReactionType, emoji: string, text: string) => {
    if (!charging) return;

    const holdDuration = Date.now() - chargeStart;
    let multiplier = 1;

    // Calculate multiplier based on hold duration
    if (holdDuration < 200) multiplier = 1;
    else if (holdDuration < 500) multiplier = 2;
    else if (holdDuration < 1000) multiplier = 5;
    else multiplier = 10; // EXPLOSION!

    // Trigger haptic feedback based on multiplier
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
  const getGlow = (type: string, baseGlow: string) =>
    isCharging(type) ? `0 0 ${15 + currentMultiplier * 5}px rgba(99,102,241,${0.3 + currentMultiplier * 0.1})` : baseGlow;

  return (
    <div className="flex gap-3 mb-4 z-30 relative">
      {/* OYO - FIX 2: Touch target 44px minimum */}
      <motion.button
        className="min-h-[44px] h-11 px-4 rounded-full bg-[#1e1b4b] border border-indigo-500/30 text-indigo-300 text-xs font-bold flex items-center gap-2 hover:bg-indigo-900/40 transition-colors relative"
        style={{
          scale: getScale('oyo'),
          boxShadow: getGlow('oyo', '0 0 15px rgba(99,102,241,0.3)')
        }}
        onMouseDown={() => handlePressStart('oyo')}
        onMouseUp={() => handlePressEnd('oyo', '👋', 'OYO')}
        onMouseLeave={() => { if (charging === 'oyo') handlePressEnd('oyo', '👋', 'OYO'); }}
        onTouchStart={() => handlePressStart('oyo')}
        onTouchEnd={() => handlePressEnd('oyo', '👋', 'OYO')}
      >
        OYO <Zap size={10} fill="currentColor" />
        {isCharging('oyo') && currentMultiplier > 1 && (
          <motion.span
            className="absolute -top-8 left-1/2 -translate-x-1/2 text-yellow-400 font-bold text-base"
            initial={{ opacity: 0, y: 5, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
          >
            {currentMultiplier}x{currentMultiplier === 10 ? '!' : ''}
          </motion.span>
        )}
      </motion.button>

      {/* OYÉ - FIX 2: Touch target 44px minimum */}
      <motion.button
        className="min-h-[44px] h-11 px-4 rounded-full bg-white/5 border border-white/10 text-gray-300 text-xs font-bold hover:bg-white/10 transition-colors relative"
        style={{
          scale: getScale('oye'),
          boxShadow: isCharging('oye') ? `0 0 ${15 + currentMultiplier * 5}px rgba(168,85,247,${0.3 + currentMultiplier * 0.1})` : ''
        }}
        onMouseDown={() => handlePressStart('oye')}
        onMouseUp={() => handlePressEnd('oye', '🎉', 'OYÉÉ')}
        onMouseLeave={() => { if (charging === 'oye') handlePressEnd('oye', '🎉', 'OYÉÉ'); }}
        onTouchStart={() => handlePressStart('oye')}
        onTouchEnd={() => handlePressEnd('oye', '🎉', 'OYÉÉ')}
      >
        OYÉÉ
        {isCharging('oye') && currentMultiplier > 1 && (
          <motion.span
            className="absolute -top-8 left-1/2 -translate-x-1/2 text-yellow-400 font-bold text-base"
            initial={{ opacity: 0, y: 5, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
          >
            {currentMultiplier}x{currentMultiplier === 10 ? '!' : ''}
          </motion.span>
        )}
      </motion.button>

      {/* Wazzguán - FIX 2: Touch target 44px minimum */}
      <motion.button
        className="min-h-[44px] h-11 px-4 rounded-full bg-white/5 border border-white/10 text-gray-300 text-xs font-bold hover:bg-white/10 transition-colors relative"
        style={{
          scale: getScale('wazzguan'),
          boxShadow: isCharging('wazzguan') ? `0 0 ${15 + currentMultiplier * 5}px rgba(34,197,94,${0.3 + currentMultiplier * 0.1})` : ''
        }}
        onMouseDown={() => handlePressStart('wazzguan')}
        onMouseUp={() => handlePressEnd('wazzguan', '🤙', 'Wazzguán')}
        onMouseLeave={() => { if (charging === 'wazzguan') handlePressEnd('wazzguan', '🤙', 'Wazzguán'); }}
        onTouchStart={() => handlePressStart('wazzguan')}
        onTouchEnd={() => handlePressEnd('wazzguan', '🤙', 'Wazzguán')}
      >
        Wazzguán
        {isCharging('wazzguan') && currentMultiplier > 1 && (
          <motion.span
            className="absolute -top-8 left-1/2 -translate-x-1/2 text-yellow-400 font-bold text-base"
            initial={{ opacity: 0, y: 5, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
          >
            {currentMultiplier}x{currentMultiplier === 10 ? '!' : ''}
          </motion.span>
        )}
      </motion.button>

      {/* Fire - FIX 2: Touch target 44px minimum */}
      <motion.button
        className="min-h-[44px] h-11 px-4 rounded-full bg-[#431407] border border-orange-500/30 text-orange-300 text-xs font-bold flex items-center gap-2 hover:bg-orange-900/40 transition-colors relative"
        style={{
          scale: getScale('fire'),
          boxShadow: getGlow('fire', '0 0 15px rgba(249,115,22,0.2)')
        }}
        onMouseDown={() => handlePressStart('fire')}
        onMouseUp={() => handlePressEnd('fire', '🔥', 'Fireee')}
        onMouseLeave={() => { if (charging === 'fire') handlePressEnd('fire', '🔥', 'Fireee'); }}
        onTouchStart={() => handlePressStart('fire')}
        onTouchEnd={() => handlePressEnd('fire', '🔥', 'Fireee')}
      >
        <Flame size={10} fill="currentColor" /> Fireee
        {isCharging('fire') && currentMultiplier > 1 && (
          <motion.span
            className="absolute -top-8 left-1/2 -translate-x-1/2 text-yellow-400 font-bold text-base"
            initial={{ opacity: 0, y: 5, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
          >
            {currentMultiplier}x{currentMultiplier === 10 ? '!' : ''}
          </motion.span>
        )}
      </motion.button>
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
          whileTap={{ scale: 0.95 }}
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
          whileTap={{ scale: 0.95 }}
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

  // SCRUB STATE - Hold prev/next to scrub time
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubDirection, setScrubDirection] = useState<'forward' | 'backward' | null>(null);
  const scrubInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrubHoldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs to avoid stale closures in interval
  const currentTimeRef = useRef(currentTime);
  const durationRef = useRef(duration);
  useEffect(() => { currentTimeRef.current = currentTime; }, [currentTime]);
  useEffect(() => { durationRef.current = duration; }, [duration]);

  // Handle scrub start (after 200ms hold to differentiate from tap)
  const handleScrubStart = useCallback((direction: 'forward' | 'backward') => {
    // Set a timer - if held for 200ms, start scrubbing
    scrubHoldTimer.current = setTimeout(() => {
      setIsScrubbing(true);
      setScrubDirection(direction);

      // Start continuous seeking - uses refs for fresh values
      scrubInterval.current = setInterval(() => {
        const step = direction === 'forward' ? 3 : -3; // 3 seconds per tick
        const newTime = Math.max(0, Math.min(durationRef.current, currentTimeRef.current + step));
        seekTo(newTime);
      }, 100); // Update every 100ms
    }, 200);
  }, [seekTo]);

  // Handle scrub end
  const handleScrubEnd = useCallback(() => {
    // Clear hold timer
    if (scrubHoldTimer.current) {
      clearTimeout(scrubHoldTimer.current);
      scrubHoldTimer.current = null;
    }

    // Clear scrub interval
    if (scrubInterval.current) {
      clearInterval(scrubInterval.current);
      scrubInterval.current = null;
    }

    setIsScrubbing(false);
    setScrubDirection(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scrubInterval.current) clearInterval(scrubInterval.current);
      if (scrubHoldTimer.current) clearTimeout(scrubHoldTimer.current);
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
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
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
              whileTap={{ scale: 0.9 }}
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

        {/* Left: History (played tracks with overlay) */}
        <div className="flex gap-3">
          {historyTracks.length > 0 ? (
            historyTracks.slice(0, 2).map((track, i) => (
              <SmallCard
                key={track.id + i}
                track={track}
                onTap={() => setCurrentTrack(track)}
                isPlayed={true}
              />
            ))
          ) : (
            // Empty state - show DASH placeholders
            <>
              <DashPlaceholder onClick={onSearch} label="history" />
              <DashPlaceholder onClick={onSearch} label="history" />
            </>
          )}
        </div>

        {/* Right: Queue + Add */}
        <div className="flex gap-3">
          {queueTracks.length > 0 ? (
            queueTracks.map((track, i) => (
              <SmallCard
                key={track.id + i}
                track={track}
                onTap={() => setCurrentTrack(track)}
                isPlayed={playedTrackIds.has(track.id)}
              />
            ))
          ) : (
            // Empty queue - show DASH placeholder
            <DashPlaceholder onClick={onSearch} label="queue" />
          )}
          <button
            onClick={onSearch}
            className="w-[70px] h-[70px] rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
          >
            <Plus size={24} className="text-gray-500" />
          </button>
        </div>
      </div>

      {/* --- CENTER SECTION (Hero + Engine) --- */}
      <div className="flex-1 flex flex-col items-center relative z-10 -mt-2">

        {/* RIGHT-SIDE TOOLBAR */}
        <RightToolbar onSettingsClick={() => setIsBoostSettingsOpen(true)} />

        {/* 1. Main Artwork with Expand Video Button */}
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

        {/* PROGRESS BAR - Tap/drag to seek */}
        <div className="w-full max-w-xs mt-6 mb-2 px-4 z-30">
          <div className="flex items-center gap-3">
            {/* Current Time */}
            <span className="text-[10px] text-white/60 font-mono tabular-nums min-w-[32px]">
              {(() => {
                const mins = Math.floor(currentTime / 60);
                const secs = Math.floor(currentTime % 60);
                return `${mins}:${secs.toString().padStart(2, '0')}`;
              })()}
            </span>

            {/* Progress Track */}
            <div className="flex-1 relative">
              <input
                type="range"
                min="0"
                max={duration || 100}
                value={currentTime}
                onChange={(e) => seekTo(parseFloat(e.target.value))}
                className="w-full h-1 appearance-none bg-transparent cursor-pointer relative z-10"
                style={{
                  background: 'transparent',
                }}
              />
              {/* Custom track styling */}
              <div className="absolute inset-0 pointer-events-none">
                {/* Background track */}
                <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1 bg-white/10 rounded-full" />
                {/* Progress fill */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 left-0 h-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-100"
                  style={{
                    width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                  }}
                />
                {/* Thumb */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-[0_0_12px_rgba(147,51,234,0.8)] transition-all duration-100"
                  style={{
                    left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                />
              </div>
            </div>

            {/* Duration */}
            <span className="text-[10px] text-white/60 font-mono tabular-nums min-w-[32px]">
              {(() => {
                const mins = Math.floor(duration / 60);
                const secs = Math.floor(duration % 60);
                return `${mins}:${secs.toString().padStart(2, '0')}`;
              })()}
            </span>
          </div>
        </div>

        {/* 2. THE ENGINE (Play Control) - SPINNING VINYL DISK + HOLD TO SCRUB */}
        <PlayControls
          isPlaying={isPlaying}
          onToggle={handlePlayPause}
          onPrev={prevTrack}
          onNext={nextTrack}
          currentTime={currentTime}
          duration={duration}
          isScrubbing={isScrubbing}
          onScrubStart={handleScrubStart}
          onScrubEnd={handleScrubEnd}
          trackArt={currentTrack ? getTrackThumbnailUrl(currentTrack, 'medium') : undefined}
          scrubDirection={scrubDirection}
        />

        {/* 3. REACTIONS */}
        <ReactionBar onReaction={handleReaction} />
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
            whileTap={{ scale: 0.95 }}
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
            whileTap={{ scale: 0.95 }}
          >
            DISCOVERY
            {isDiscoveryBeltActive && <span className="text-[6px] text-cyan-400/60 ml-1">ON</span>}
          </motion.button>
        </div>

        {/* Horizontal Scroll Deck - Two Separate Zones */}
        <div className="flex items-center relative h-24">

          {/* ========== HOT ZONE (Left side) ========== */}
          <div className="flex-1 flex items-center relative h-full">
            {/* Red Portal Line (left edge of HOT zone) */}
            <div className="flex-shrink-0 w-1.5 h-16 relative z-20 ml-1">
              <div className="h-full w-full rounded-full bg-gradient-to-b from-red-500/30 via-red-500 to-red-500/30" />
              <div className="absolute inset-0 bg-red-500 blur-lg opacity-60" />
            </div>

            {/* HOT Cards Belt (loops within this zone) */}
            <PortalBelt
              tracks={hotTracks.slice(0, 8)}
              onTap={setCurrentTrack}
              onTeaser={handleTeaser}
              playedTrackIds={playedTrackIds}
              type="hot"
              isActive={isHotBeltActive}
            />
          </div>

          {/* ========== VOYO FEED DIVIDER ========== */}
          <div className="flex-shrink-0 px-2 relative z-30">
            {/* Left glow (red) */}
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 w-8 h-20 -translate-x-4 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse at right, rgba(239,68,68,0.5) 0%, transparent 70%)' }}
            />
            {/* Right glow (blue) */}
            <div
              className="absolute right-0 top-1/2 -translate-y-1/2 w-8 h-20 translate-x-4 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse at left, rgba(59,130,246,0.5) 0%, transparent 70%)' }}
            />
            <motion.button
              onClick={onVoyoFeed}
              whileTap={{ scale: 0.9 }}
              className="relative w-12 h-12 rounded-full flex flex-col items-center justify-center"
              style={{
                background: 'linear-gradient(90deg, rgba(239,68,68,0.3) 0%, #1a1a2e 50%, rgba(59,130,246,0.3) 100%)',
                border: '2px solid rgba(255,255,255,0.15)',
                boxShadow: '-6px 0 20px rgba(239,68,68,0.4), 6px 0 20px rgba(59,130,246,0.4)',
              }}
            >
              <span className="text-[8px] font-bold text-white tracking-widest">VOYO</span>
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
            />

            {/* Blue Portal Line (right edge of DISCOVERY zone) */}
            <div className="flex-shrink-0 w-1.5 h-16 relative z-20 mr-1">
              <div className="h-full w-full rounded-full bg-gradient-to-b from-blue-500/30 via-blue-500 to-blue-500/30" />
              <div className="absolute inset-0 bg-blue-500 blur-lg opacity-60" />
            </div>
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

      {/* AUTO-BOOST PROMPT (shows after 3 manual boosts) */}
      <AutoBoostPrompt />

    </div>
  );
};

export default VoyoPortraitPlayer;
