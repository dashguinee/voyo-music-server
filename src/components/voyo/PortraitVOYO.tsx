/**
 * VOYO Music - Portrait VOYO Mode (REDESIGNED)
 *
 * NEW LAYOUT: Side DJ Booth + Center Stage Card
 *
 * ┌─────────────────────────────────────┐
 * │ Timeline (Past | Current | Queue)   │
 * ├─────────────────────────────────────┤
 * │  ╭───╮   ┌─────────────────┐        │
 * │  │🦉 │   │                 │        │
 * │  │OYO│   │   BIG CARD      │   ⏭    │
 * │  │ DJ│   │   (Now Playing) │        │
 * │  ╰───╯   └─────────────────┘        │
 * ├─────────────────────────────────────┤
 * │ [OYO⚡] [OYÉÉ] [Wazzguán] [🔥Fire]  │
 * ├─────────────────────────────────────┤
 * │ HOT | VOYO | DISCOVERY cards        │
 * └─────────────────────────────────────┘
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { SkipBack, SkipForward, Play, Pause, Plus, Send, X, Volume2 } from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { getYouTubeThumbnail } from '../../data/tracks';
import { Track, ReactionType, DJMode } from '../../types';
import { useMobilePlay } from '../../hooks/useMobilePlay';

// Import new VOYO Superapp components
import { VoyoBottomNav } from './navigation/VoyoBottomNav';
import { VoyoVerticalFeed } from './feed/VoyoVerticalFeed';
import { CreatorUpload } from './upload/CreatorUpload';
import { VoyoPortraitPlayer } from './VoyoPortraitPlayer';

// DJ Mode Types (also exported from types/index.ts)

// Quick DJ Prompts
const DJ_PROMPTS = [
  { id: 'more-like-this', text: 'More like this 🔥' },
  { id: 'something-different', text: 'Something different' },
  { id: 'more-energy', text: 'More energy ⚡' },
  { id: 'chill-vibes', text: 'Chill vibes 🌙' },
];

// DJ Response Messages
const DJ_RESPONSES: Record<string, string[]> = {
  'more-like-this': ["Got you fam! 🔥", "Adding similar vibes..."],
  'something-different': ["Say less!", "Switching it up..."],
  'more-energy': ["AYEEE! ⚡", "Turning UP!"],
  'chill-vibes': ["Cooling it down... 🌙", "Smooth vibes only"],
  'default': ["I hear you! 🎵", "Say less, fam!", "OYÉ!"],
};

// ============================================
// TIMELINE COMPONENT (Compact)
// ============================================
const Timeline = () => {
  const { currentTrack, history, queue, hotTracks, setCurrentTrack } = usePlayerStore();
  const pastTracks = history.slice(-2).map(h => h.track).reverse();
  const queueTracks = queue.slice(0, 2).map(q => q.track);

  const MiniCard = ({ track, isCurrent }: { track: Track; isCurrent?: boolean }) => (
    <motion.button
      className={`flex-shrink-0 rounded-xl overflow-hidden ${
        isCurrent ? 'w-16 h-20 ring-2 ring-purple-500' : 'w-12 h-16 opacity-60'
      }`}
      onClick={() => setCurrentTrack(track)}
      whileHover={{ scale: 1.05, opacity: 1 }}
      whileTap={{ scale: 0.95 }}
    >
      <img
        src={getYouTubeThumbnail(track.trackId, 'medium')}
        alt={track.title}
        className="w-full h-full object-cover"
      />
    </motion.button>
  );

  return (
    <div className="flex items-center justify-center gap-2 px-4 py-3">
      {pastTracks.map((track, i) => (
        <MiniCard key={`past-${i}`} track={track} />
      ))}
      {/* Show hot tracks as suggestions when no history */}
      {pastTracks.length === 0 && hotTracks.slice(0, 2).map((track, i) => (
        <MiniCard key={`suggest-${i}`} track={track} />
      ))}
      {currentTrack && <MiniCard track={currentTrack} isCurrent />}
      {queueTracks.map((track, i) => (
        <MiniCard key={`queue-${i}`} track={track} />
      ))}
      <motion.button
        className="w-12 h-16 rounded-xl bg-white/5 border border-dashed border-white/20 flex items-center justify-center"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <Plus className="w-4 h-4 text-white/40" />
      </motion.button>
    </div>
  );
};

// ============================================
// OYO THE OWL - DJ CHARACTER (Enhanced)
// ============================================
interface OYOOwlProps {
  djMode: DJMode;
  djResponse: string | null;
  onTap: () => void;
}

const OYOOwl = ({ djMode, djResponse, onTap }: OYOOwlProps) => {
  const controls = useAnimation();
  const [blinkEye, setBlinkEye] = useState<'left' | 'right' | null>(null);

  // Random blinking when idle
  useEffect(() => {
    if (djMode === 'idle') {
      const blinkInterval = setInterval(() => {
        const eye = Math.random() > 0.5 ? 'left' : 'right';
        setBlinkEye(eye);
        setTimeout(() => setBlinkEye(null), 150);
      }, 3000 + Math.random() * 2000);
      return () => clearInterval(blinkInterval);
    }
  }, [djMode]);

  // Animate based on DJ mode
  useEffect(() => {
    if (djMode === 'listening') {
      controls.start({
        scale: [1, 1.08, 1],
        transition: { duration: 1.2, repeat: Infinity, ease: 'easeInOut' }
      });
    } else if (djMode === 'thinking') {
      controls.start({
        rotate: [0, -8, 8, 0],
        transition: { duration: 0.4, repeat: Infinity }
      });
    } else if (djMode === 'responding') {
      controls.start({
        y: [0, -8, 0],
        scale: [1, 1.1, 1],
        transition: { duration: 0.5, repeat: 2 }
      });
    } else {
      controls.start({ scale: 1, rotate: 0, y: 0 });
    }
  }, [djMode, controls]);

  // Get glow color based on mode
  const getGlowColor = () => {
    if (djMode === 'listening') return 'rgba(34, 211, 238, 0.6)';
    if (djMode === 'thinking') return 'rgba(251, 191, 36, 0.6)';
    if (djMode === 'responding') return 'rgba(236, 72, 153, 0.6)';
    return 'rgba(168, 85, 247, 0.25)';
  };

  const getEyeGlow = () => {
    if (djMode === 'listening') return '0 0 8px rgba(34, 211, 238, 0.8)';
    if (djMode === 'thinking') return '0 0 8px rgba(251, 191, 36, 0.8)';
    if (djMode === 'responding') return '0 0 12px rgba(236, 72, 153, 0.9)';
    return '0 0 4px rgba(251, 191, 36, 0.4)';
  };

  return (
    <motion.button
      className="relative flex flex-col items-center"
      onClick={onTap}
      animate={controls}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
    >
      {/* Ambient glow ring */}
      <motion.div
        className="absolute inset-0 rounded-3xl"
        animate={{
          boxShadow: djMode !== 'idle'
            ? `0 0 40px ${getGlowColor()}, 0 0 80px ${getGlowColor()}`
            : `0 0 20px ${getGlowColor()}`
        }}
        transition={{ duration: 0.5 }}
      />

      {/* OYO Owl Body */}
      <motion.div
        className="relative w-24 h-28 rounded-3xl flex items-center justify-center overflow-visible"
        style={{
          background: 'linear-gradient(145deg, #2a1a4a 0%, #1a0a2e 50%, #0a0a0f 100%)',
          border: '2px solid rgba(168, 85, 247, 0.4)',
        }}
      >
        {/* Ear tufts */}
        <div className="absolute -top-2 left-3 w-0 h-0 border-l-[8px] border-r-[8px] border-b-[16px] border-l-transparent border-r-transparent border-b-purple-900/80" />
        <div className="absolute -top-2 right-3 w-0 h-0 border-l-[8px] border-r-[8px] border-b-[16px] border-l-transparent border-r-transparent border-b-purple-900/80" />

        {/* Headphones band */}
        <div className="absolute -top-1 left-2 right-2 h-2 rounded-full bg-gradient-to-r from-purple-600 via-purple-500 to-purple-600" />

        {/* Left headphone */}
        <motion.div
          className="absolute top-3 -left-2 w-5 h-7 rounded-lg bg-gradient-to-b from-purple-500 to-purple-700 border border-purple-400/30"
          animate={djMode !== 'idle' ? { scale: [1, 1.1, 1] } : {}}
          transition={{ duration: 0.3, repeat: Infinity }}
        >
          <div className="absolute inset-1 rounded bg-purple-400/20" />
        </motion.div>

        {/* Right headphone */}
        <motion.div
          className="absolute top-3 -right-2 w-5 h-7 rounded-lg bg-gradient-to-b from-purple-500 to-purple-700 border border-purple-400/30"
          animate={djMode !== 'idle' ? { scale: [1, 1.1, 1] } : {}}
          transition={{ duration: 0.3, repeat: Infinity, delay: 0.15 }}
        >
          <div className="absolute inset-1 rounded bg-purple-400/20" />
        </motion.div>

        {/* Owl Face */}
        <div className="relative mt-2">
          {/* Facial disk (owl face ring) */}
          <div className="absolute -inset-3 rounded-full border-2 border-purple-400/20" />

          {/* Eyes container */}
          <div className="flex gap-3 mb-2">
            {/* Left Eye */}
            <motion.div
              className="relative w-7 h-7 rounded-full overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #fef08a 0%, #fbbf24 50%, #f59e0b 100%)',
                boxShadow: getEyeGlow(),
              }}
              animate={
                djMode === 'listening'
                  ? { scale: [1, 1.15, 1] }
                  : blinkEye === 'left'
                    ? { scaleY: 0.1 }
                    : { scaleY: 1 }
              }
              transition={{ duration: djMode === 'listening' ? 0.6 : 0.1, repeat: djMode === 'listening' ? Infinity : 0 }}
            >
              {/* Pupil */}
              <motion.div
                className="absolute w-3 h-3 bg-black rounded-full"
                style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
                animate={djMode === 'thinking' ? { x: [-2, 2, -2] } : {}}
                transition={{ duration: 0.3, repeat: Infinity }}
              >
                {/* Light reflection */}
                <div className="absolute top-0.5 left-0.5 w-1.5 h-1.5 bg-white rounded-full opacity-80" />
              </motion.div>
            </motion.div>

            {/* Right Eye */}
            <motion.div
              className="relative w-7 h-7 rounded-full overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #fef08a 0%, #fbbf24 50%, #f59e0b 100%)',
                boxShadow: getEyeGlow(),
              }}
              animate={
                djMode === 'listening'
                  ? { scale: [1, 1.15, 1] }
                  : blinkEye === 'right'
                    ? { scaleY: 0.1 }
                    : { scaleY: 1 }
              }
              transition={{ duration: djMode === 'listening' ? 0.6 : 0.1, repeat: djMode === 'listening' ? Infinity : 0, delay: 0.1 }}
            >
              {/* Pupil */}
              <motion.div
                className="absolute w-3 h-3 bg-black rounded-full"
                style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
                animate={djMode === 'thinking' ? { x: [2, -2, 2] } : {}}
                transition={{ duration: 0.3, repeat: Infinity }}
              >
                {/* Light reflection */}
                <div className="absolute top-0.5 left-0.5 w-1.5 h-1.5 bg-white rounded-full opacity-80" />
              </motion.div>
            </motion.div>
          </div>

          {/* Beak */}
          <motion.div
            className="mx-auto"
            animate={djMode === 'responding' ? { scale: [1, 1.2, 1] } : {}}
            transition={{ duration: 0.3, repeat: djMode === 'responding' ? 3 : 0 }}
          >
            <div className="w-0 h-0 border-l-[8px] border-r-[8px] border-t-[10px] border-l-transparent border-r-transparent border-t-orange-400" />
            <div className="w-3 h-1 bg-orange-300 rounded-b mx-auto -mt-0.5" />
          </motion.div>
        </div>

        {/* Waveform when active */}
        <AnimatePresence>
          {(djMode !== 'idle') && (
            <motion.div
              className="absolute bottom-2 left-0 right-0 flex justify-center gap-[3px]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {[...Array(7)].map((_, i) => (
                <motion.div
                  key={i}
                  className="w-1.5 rounded-full"
                  style={{
                    background: djMode === 'listening' ? '#22d3ee' : djMode === 'thinking' ? '#fbbf24' : '#ec4899',
                  }}
                  animate={{ height: [4, 14 - Math.abs(i - 3) * 2, 4] }}
                  transition={{ duration: 0.35, repeat: Infinity, delay: i * 0.08 }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chest feathers / body detail */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-8 h-4">
          <div className="w-2 h-3 bg-purple-800/50 rounded-full mx-auto" />
        </div>
      </motion.div>

      {/* DJ Response Bubble */}
      <AnimatePresence>
        {djResponse && (
          <motion.div
            className="absolute -top-14 left-1/2 -translate-x-1/2 whitespace-nowrap px-4 py-2 rounded-2xl text-white text-sm font-bold"
            style={{
              background: djMode === 'responding'
                ? 'linear-gradient(135deg, #ec4899, #8b5cf6)'
                : 'linear-gradient(135deg, #22d3ee, #3b82f6)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            }}
            initial={{ opacity: 0, y: 10, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.8 }}
          >
            {djResponse}
            <div
              className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-3 h-3 rotate-45"
              style={{
                background: djMode === 'responding' ? '#8b5cf6' : '#3b82f6',
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Label with status indicator */}
      <div className="mt-2 flex items-center gap-1.5">
        <motion.div
          className="w-2 h-2 rounded-full"
          style={{
            background: djMode === 'idle' ? '#a855f7' : djMode === 'listening' ? '#22d3ee' : djMode === 'thinking' ? '#fbbf24' : '#ec4899',
          }}
          animate={djMode !== 'idle' ? { scale: [1, 1.3, 1] } : {}}
          transition={{ duration: 0.5, repeat: Infinity }}
        />
        <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider">
          {djMode === 'idle' ? 'OYO' : djMode === 'listening' ? 'Listening...' : djMode === 'thinking' ? 'Thinking...' : 'OYÉ!'}
        </span>
      </div>
    </motion.button>
  );
};

// ============================================
// CENTER STAGE - BIG NOW PLAYING CARD
// ============================================
const CenterStageCard = () => {
  const { currentTrack, isPlaying, progress, currentTime, duration } = usePlayerStore();
  const { handlePlayPause } = useMobilePlay(); // MOBILE FIX: Use direct play handler
  const [imgError, setImgError] = useState(false);

  // Format time helper
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!currentTrack) {
    return (
      <div className="w-52 h-80 rounded-3xl bg-white/5 border border-white/10 flex flex-col items-center justify-center gap-3">
        <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
          <Play className="w-8 h-8 text-white/20" />
        </div>
        <span className="text-white/30 text-sm">Select a track</span>
      </div>
    );
  }

  return (
    <motion.div
      className="relative w-52 h-80 rounded-3xl overflow-hidden"
      style={{
        boxShadow: isPlaying
          ? '0 0 60px rgba(168, 85, 247, 0.35), 0 0 120px rgba(236, 72, 153, 0.2), 0 25px 50px rgba(0,0,0,0.5)'
          : '0 25px 50px rgba(0,0,0,0.5), 0 0 30px rgba(168, 85, 247, 0.1)',
      }}
      whileHover={{ scale: 1.02, y: -5 }}
      whileTap={{ scale: 0.98 }}
      layout
    >
      {/* Album Art */}
      <img
        src={imgError
          ? getYouTubeThumbnail(currentTrack.trackId, 'high')
          : currentTrack.coverUrl
        }
        alt={currentTrack.title}
        className="absolute inset-0 w-full h-full object-cover"
        onError={() => setImgError(true)}
      />

      {/* Animated gradient overlay when playing */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.4) 40%, rgba(0,0,0,0.1) 70%, transparent 100%)',
        }}
        animate={isPlaying ? {
          background: [
            'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(88,28,135,0.3) 40%, rgba(0,0,0,0.1) 70%, transparent 100%)',
            'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(168,85,247,0.3) 40%, rgba(0,0,0,0.1) 70%, transparent 100%)',
            'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(88,28,135,0.3) 40%, rgba(0,0,0,0.1) 70%, transparent 100%)',
          ]
        } : {}}
        transition={{ duration: 3, repeat: Infinity }}
      />

      {/* Play Button Overlay - MOBILE FIX: Direct play in user gesture */}
      <motion.button
        className="absolute inset-0 flex items-center justify-center"
        onClick={handlePlayPause}
      >
        <motion.div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{
            background: isPlaying ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.25)',
            backdropFilter: 'blur(8px)',
          }}
          whileHover={{ scale: 1.15, backgroundColor: 'rgba(255,255,255,0.35)' }}
          whileTap={{ scale: 0.9 }}
        >
          {isPlaying ? (
            <Pause className="w-8 h-8 text-white" fill="white" />
          ) : (
            <Play className="w-8 h-8 text-white ml-1" fill="white" />
          )}
        </motion.div>
      </motion.button>

      {/* Track Info */}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <h3 className="text-white font-bold text-lg truncate drop-shadow-lg">{currentTrack.title}</h3>
        <p className="text-white/80 text-sm truncate drop-shadow">{currentTrack.artist}</p>

        {/* Progress Bar */}
        <div className="mt-3">
          <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{
                background: 'linear-gradient(90deg, #a855f7, #ec4899, #f97316)',
                width: `${progress}%`,
              }}
              transition={{ duration: 0.1 }}
            />
          </div>
          {/* Time Display */}
          <div className="flex justify-between mt-1.5 text-[10px] text-white/60">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      {/* OYÉ Score Badge */}
      <motion.div
        className="absolute top-3 left-3 px-2.5 py-1 rounded-full backdrop-blur-sm"
        style={{
          background: 'linear-gradient(135deg, rgba(0,0,0,0.6), rgba(88,28,135,0.4))',
          border: '1px solid rgba(168,85,247,0.3)',
        }}
        animate={isPlaying ? { scale: [1, 1.05, 1] } : {}}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <span className="text-yellow-400 text-xs font-bold drop-shadow">
          {Math.round(currentTrack.oyeScore / 1000)}k OYÉ
        </span>
      </motion.div>

      {/* Vinyl spinning indicator when playing */}
      {isPlaying && (
        <motion.div
          className="absolute top-3 right-3 w-6 h-6"
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        >
          <div className="w-full h-full rounded-full border-2 border-white/30 border-t-purple-400" />
        </motion.div>
      )}
    </motion.div>
  );
};

// ============================================
// DJ BOOTH SECTION (Left side with controls)
// ============================================
interface DJBoothProps {
  djMode: DJMode;
  djResponse: string | null;
  onListenMode: () => void;
  onTextMode: () => void;
}

const DJBooth = ({ djMode, djResponse, onListenMode, onTextMode }: DJBoothProps) => {
  const { prevTrack, nextTrack, volume } = usePlayerStore();

  return (
    <div className="flex flex-col items-center gap-3">
      {/* OYO The Owl */}
      <OYOOwl djMode={djMode} djResponse={djResponse} onTap={onListenMode} />

      {/* Skip Controls */}
      <div className="flex gap-2">
        <motion.button
          className="p-2 rounded-xl bg-white/5 border border-white/10"
          onClick={prevTrack}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <SkipBack className="w-4 h-4 text-white/70" />
        </motion.button>
        <motion.button
          className="p-2 rounded-xl bg-white/5 border border-white/10"
          onClick={nextTrack}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <SkipForward className="w-4 h-4 text-white/70" />
        </motion.button>
      </div>

      {/* Volume Indicator */}
      <div className="flex items-center gap-1 text-white/40">
        <Volume2 className="w-3 h-3" />
        <span className="text-[10px]">{Math.round(volume)}%</span>
      </div>
    </div>
  );
};

// ============================================
// OYO CENTRAL - THE HERO DJ (Big & Center)
// ============================================
interface OYOCentralProps {
  djMode: DJMode;
  djResponse: string | null;
  onTap: () => void;
}

const OYOCentral = ({ djMode, djResponse, onTap }: OYOCentralProps) => {
  const controls = useAnimation();
  const { isPlaying } = usePlayerStore();
  const [blinkEye, setBlinkEye] = useState<'left' | 'right' | 'both' | null>(null);

  // Random blinking when idle
  useEffect(() => {
    if (djMode === 'idle') {
      const blinkInterval = setInterval(() => {
        const blink = Math.random() > 0.7 ? 'both' : Math.random() > 0.5 ? 'left' : 'right';
        setBlinkEye(blink);
        setTimeout(() => setBlinkEye(null), 150);
      }, 2500 + Math.random() * 2000);
      return () => clearInterval(blinkInterval);
    }
  }, [djMode]);

  // Animate based on DJ mode
  useEffect(() => {
    if (djMode === 'listening') {
      controls.start({
        scale: [1, 1.05, 1],
        transition: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' }
      });
    } else if (djMode === 'thinking') {
      controls.start({
        rotate: [0, -5, 5, 0],
        transition: { duration: 0.5, repeat: Infinity }
      });
    } else if (djMode === 'responding') {
      controls.start({
        y: [0, -10, 0],
        scale: [1, 1.1, 1],
        transition: { duration: 0.4, repeat: 3 }
      });
    } else {
      controls.start({ scale: 1, rotate: 0, y: 0 });
    }
  }, [djMode, controls]);

  const getGlowColor = () => {
    if (djMode === 'listening') return '#22d3ee';
    if (djMode === 'thinking') return '#fbbf24';
    if (djMode === 'responding') return '#ec4899';
    return '#a855f7';
  };

  const getModeLabel = () => {
    if (djMode === 'listening') return 'Listening...';
    if (djMode === 'thinking') return 'Thinking...';
    if (djMode === 'responding') return 'OYÉ!';
    return isPlaying ? 'Vibing...' : 'Tap me!';
  };

  return (
    <motion.button
      className="relative flex flex-col items-center"
      onClick={onTap}
      animate={controls}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      {/* GLOW STAGE - The dramatic backdrop */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          margin: '-30px',
          filter: 'blur(20px)',
          background: `radial-gradient(circle, ${getGlowColor()}40 0%, transparent 70%)`,
        }}
      />

      {/* Outer glow rings */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{ margin: '-20px' }}
        animate={{
          boxShadow: [
            `0 0 40px ${getGlowColor()}50, 0 0 80px ${getGlowColor()}25`,
            `0 0 60px ${getGlowColor()}70, 0 0 120px ${getGlowColor()}35`,
            `0 0 40px ${getGlowColor()}50, 0 0 80px ${getGlowColor()}25`,
          ]
        }}
        transition={{ duration: 2, repeat: Infinity }}
      />

      {/* Main OYO Body - BIGGER with MASSIVE DROP SHADOW */}
      <motion.div
        className="relative w-36 h-44 rounded-[2rem] flex flex-col items-center justify-center overflow-visible"
        style={{
          background: `linear-gradient(145deg, #2a1a4a 0%, #1a0a2e 50%, #0a0a0f 100%)`,
          border: `3px solid ${getGlowColor()}60`,
          boxShadow: `0 0 50px ${getGlowColor()}40, 0 20px 60px rgba(0,0,0,0.6), inset 0 0 30px rgba(0,0,0,0.5)`,
          filter: `drop-shadow(0 0 50px ${getGlowColor()}30)`,
        }}
      >
        {/* Ear tufts */}
        <div className="absolute -top-3 left-6 w-0 h-0 border-l-[12px] border-r-[12px] border-b-[24px] border-l-transparent border-r-transparent border-b-purple-900/90" />
        <div className="absolute -top-3 right-6 w-0 h-0 border-l-[12px] border-r-[12px] border-b-[24px] border-l-transparent border-r-transparent border-b-purple-900/90" />

        {/* Headphones */}
        <div className="absolute top-0 left-4 right-4 h-3 rounded-full bg-gradient-to-r from-purple-600 via-purple-400 to-purple-600" />
        <motion.div
          className="absolute top-5 -left-3 w-7 h-10 rounded-xl bg-gradient-to-b from-purple-500 to-purple-700 border-2 border-purple-400/40"
          animate={djMode !== 'idle' || isPlaying ? { scale: [1, 1.1, 1] } : {}}
          transition={{ duration: 0.4, repeat: Infinity }}
        >
          <div className="absolute inset-1 rounded-lg bg-purple-300/10" />
          <motion.div
            className="absolute bottom-1 left-1 right-1 h-2 rounded bg-cyan-400/50"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 0.5, repeat: Infinity }}
          />
        </motion.div>
        <motion.div
          className="absolute top-5 -right-3 w-7 h-10 rounded-xl bg-gradient-to-b from-purple-500 to-purple-700 border-2 border-purple-400/40"
          animate={djMode !== 'idle' || isPlaying ? { scale: [1, 1.1, 1] } : {}}
          transition={{ duration: 0.4, repeat: Infinity, delay: 0.2 }}
        >
          <div className="absolute inset-1 rounded-lg bg-purple-300/10" />
          <motion.div
            className="absolute bottom-1 left-1 right-1 h-2 rounded bg-pink-400/50"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 0.5, repeat: Infinity, delay: 0.25 }}
          />
        </motion.div>

        {/* Face container */}
        <div className="relative mt-4">
          {/* Facial disk ring */}
          <div className="absolute -inset-4 rounded-full border-2 border-purple-400/15" />

          {/* EYES - Big & Expressive */}
          <div className="flex gap-5 mb-3">
            {/* Left Eye */}
            <motion.div
              className="relative w-10 h-10 rounded-full overflow-hidden"
              style={{
                background: 'radial-gradient(circle at 30% 30%, #fef9c3, #fbbf24, #d97706)',
                boxShadow: `0 0 15px ${getGlowColor()}80`,
              }}
              animate={
                djMode === 'listening'
                  ? { scale: [1, 1.2, 1] }
                  : blinkEye === 'left' || blinkEye === 'both'
                    ? { scaleY: 0.1 }
                    : { scaleY: 1 }
              }
              transition={{ duration: djMode === 'listening' ? 0.8 : 0.1, repeat: djMode === 'listening' ? Infinity : 0 }}
            >
              <motion.div
                className="absolute w-4 h-4 bg-black rounded-full"
                style={{ top: '50%', left: '50%', x: '-50%', y: '-50%' }}
                animate={djMode === 'thinking' ? { x: ['-50%', '-30%', '-70%', '-50%'] } : { x: '-50%' }}
                transition={{ duration: 0.4, repeat: djMode === 'thinking' ? Infinity : 0 }}
              >
                <div className="absolute top-1 left-1 w-2 h-2 bg-white rounded-full" />
              </motion.div>
            </motion.div>

            {/* Right Eye */}
            <motion.div
              className="relative w-10 h-10 rounded-full overflow-hidden"
              style={{
                background: 'radial-gradient(circle at 30% 30%, #fef9c3, #fbbf24, #d97706)',
                boxShadow: `0 0 15px ${getGlowColor()}80`,
              }}
              animate={
                djMode === 'listening'
                  ? { scale: [1, 1.2, 1] }
                  : blinkEye === 'right' || blinkEye === 'both'
                    ? { scaleY: 0.1 }
                    : { scaleY: 1 }
              }
              transition={{ duration: djMode === 'listening' ? 0.8 : 0.1, repeat: djMode === 'listening' ? Infinity : 0, delay: 0.1 }}
            >
              <motion.div
                className="absolute w-4 h-4 bg-black rounded-full"
                style={{ top: '50%', left: '50%', x: '-50%', y: '-50%' }}
                animate={djMode === 'thinking' ? { x: ['-50%', '-70%', '-30%', '-50%'] } : { x: '-50%' }}
                transition={{ duration: 0.4, repeat: djMode === 'thinking' ? Infinity : 0 }}
              >
                <div className="absolute top-1 left-1 w-2 h-2 bg-white rounded-full" />
              </motion.div>
            </motion.div>
          </div>

          {/* Beak */}
          <motion.div
            className="flex flex-col items-center"
            animate={djMode === 'responding' ? { scale: [1, 1.3, 1] } : {}}
            transition={{ duration: 0.2, repeat: djMode === 'responding' ? 5 : 0 }}
          >
            <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[14px] border-l-transparent border-r-transparent border-t-orange-400" />
            <div className="w-5 h-2 bg-gradient-to-b from-orange-400 to-orange-500 rounded-b-full -mt-1" />
          </motion.div>
        </div>

        {/* Waveform / Music Visualizer */}
        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1">
          {[...Array(9)].map((_, i) => (
            <motion.div
              key={i}
              className="w-2 rounded-full"
              style={{
                background: `linear-gradient(to top, ${getGlowColor()}, ${getGlowColor()}60)`,
              }}
              animate={{
                height: djMode !== 'idle' || isPlaying
                  ? [6, 20 - Math.abs(i - 4) * 3, 6]
                  : [4, 6, 4]
              }}
              transition={{
                duration: djMode !== 'idle' ? 0.3 : 0.8,
                repeat: Infinity,
                delay: i * 0.05
              }}
            />
          ))}
        </div>
      </motion.div>

      {/* Response Bubble */}
      <AnimatePresence>
        {djResponse && (
          <motion.div
            className="absolute -top-16 left-1/2 -translate-x-1/2 whitespace-nowrap px-5 py-2.5 rounded-2xl text-white font-bold text-base"
            style={{
              background: `linear-gradient(135deg, ${getGlowColor()}, ${getGlowColor()}cc)`,
              boxShadow: `0 4px 30px ${getGlowColor()}60`,
            }}
            initial={{ opacity: 0, y: 10, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.8 }}
          >
            {djResponse}
            <div
              className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-4 h-4 rotate-45"
              style={{ background: `${getGlowColor()}cc` }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status Label */}
      <motion.div
        className="mt-3 px-4 py-1.5 rounded-full flex items-center gap-2"
        style={{
          background: `linear-gradient(135deg, ${getGlowColor()}20, ${getGlowColor()}10)`,
          border: `1px solid ${getGlowColor()}40`,
        }}
      >
        <motion.div
          className="w-2.5 h-2.5 rounded-full"
          style={{ background: getGlowColor() }}
          animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
          transition={{ duration: 0.8, repeat: Infinity }}
        />
        <span className="text-sm font-bold" style={{ color: getGlowColor() }}>
          {getModeLabel()}
        </span>
      </motion.div>
    </motion.button>
  );
};

// ============================================
// NOW PLAYING CARD (Left side - smaller)
// ============================================
const NowPlayingCard = () => {
  const { currentTrack, isPlaying, progress } = usePlayerStore();
  const { handlePlayPause } = useMobilePlay(); // MOBILE FIX: Direct play

  if (!currentTrack) {
    return (
      <div className="w-28 h-36 rounded-2xl bg-white/5 border border-dashed border-white/10 flex items-center justify-center">
        <Play className="w-6 h-6 text-white/20" />
      </div>
    );
  }

  return (
    <motion.button
      className="relative w-28 h-36 rounded-2xl overflow-hidden"
      onClick={handlePlayPause}
      whileHover={{ scale: 1.05, y: -5 }}
      whileTap={{ scale: 0.95 }}
      style={{
        boxShadow: isPlaying
          ? '0 0 30px rgba(168, 85, 247, 0.4), 0 10px 30px rgba(0,0,0,0.5)'
          : '0 10px 30px rgba(0,0,0,0.4)',
      }}
    >
      <img
        src={getYouTubeThumbnail(currentTrack.trackId, 'medium')}
        alt={currentTrack.title}
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

      {/* Play indicator */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center"
          animate={isPlaying ? { scale: [1, 1.1, 1] } : {}}
          transition={{ duration: 1, repeat: Infinity }}
        >
          {isPlaying ? (
            <div className="flex gap-1">
              {[...Array(3)].map((_, i) => (
                <motion.div
                  key={i}
                  className="w-1 bg-white rounded-full"
                  animate={{ height: [8, 16, 8] }}
                  transition={{ duration: 0.4, repeat: Infinity, delay: i * 0.1 }}
                />
              ))}
            </div>
          ) : (
            <Play className="w-5 h-5 text-white ml-0.5" fill="white" />
          )}
        </motion.div>
      </div>

      {/* Track info */}
      <div className="absolute bottom-0 left-0 right-0 p-2">
        <p className="text-[10px] text-white font-bold truncate">{currentTrack.title}</p>
        <p className="text-[9px] text-white/60 truncate">{currentTrack.artist}</p>
        {/* Mini progress */}
        <div className="mt-1 h-0.5 bg-white/20 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-purple-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* NOW label */}
      <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-purple-500/80 backdrop-blur-sm">
        <span className="text-[8px] font-bold text-white uppercase">Now</span>
      </div>
    </motion.button>
  );
};

// ============================================
// NEXT UP CARD (Right side - smaller)
// ============================================
const NextUpCard = () => {
  const { queue, nextTrack } = usePlayerStore();
  const nextTrackInQueue = queue[0]?.track;

  if (!nextTrackInQueue) {
    return (
      <div className="w-28 h-36 rounded-2xl bg-white/5 border border-dashed border-white/10 flex flex-col items-center justify-center gap-2">
        <Plus className="w-6 h-6 text-white/20" />
        <span className="text-[9px] text-white/30">Add to queue</span>
      </div>
    );
  }

  return (
    <motion.button
      className="relative w-28 h-36 rounded-2xl overflow-hidden"
      onClick={nextTrack}
      whileHover={{ scale: 1.05, y: -5 }}
      whileTap={{ scale: 0.95 }}
      style={{
        boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
      }}
    >
      <img
        src={getYouTubeThumbnail(nextTrackInQueue.trackId, 'medium')}
        alt={nextTrackInQueue.title}
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />

      {/* Skip indicator */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          className="w-10 h-10 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center"
          animate={{ x: [0, 4, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <SkipForward className="w-5 h-5 text-white" />
        </motion.div>
      </div>

      {/* Track info */}
      <div className="absolute bottom-0 left-0 right-0 p-2">
        <p className="text-[10px] text-white font-bold truncate">{nextTrackInQueue.title}</p>
        <p className="text-[9px] text-white/60 truncate">{nextTrackInQueue.artist}</p>
      </div>

      {/* NEXT label */}
      <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-white/20 backdrop-blur-sm">
        <span className="text-[8px] font-bold text-white uppercase">Next</span>
      </div>

      {/* Queue count */}
      {queue.length > 1 && (
        <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full bg-purple-500/80 backdrop-blur-sm">
          <span className="text-[8px] font-bold text-white">+{queue.length - 1}</span>
        </div>
      )}
    </motion.button>
  );
};

// ============================================
// REACTION BAR
// ============================================
interface ReactionBarProps {
  onListenMode: () => void;
  onTextMode: () => void;
  isListening: boolean;
}

const ReactionBar = ({ onListenMode, onTextMode, isListening }: ReactionBarProps) => {
  const { addReaction } = usePlayerStore();
  const [floatingEmojis, setFloatingEmojis] = useState<Array<{ id: number; emoji: string; x: number }>>([]);

  const reactions = [
    { type: 'oyo', text: 'OYO', emoji: '⚡', color: 'from-yellow-500/20 to-orange-500/20', border: 'border-yellow-500/30' },
    { type: 'oye', text: 'OYÉÉ', emoji: '🎤', color: 'from-cyan-500/20 to-blue-500/20', border: 'border-cyan-500/30', action: 'listen' },
    { type: 'wazzguan', text: 'Wazzguán', emoji: '💬', color: 'from-purple-500/20 to-pink-500/20', border: 'border-purple-500/30', action: 'text' },
    { type: 'fire', text: 'Fireee', emoji: '🔥', color: 'from-red-500/20 to-orange-500/20', border: 'border-red-500/30' },
  ];

  const handleReaction = (reaction: typeof reactions[0]) => {
    if (reaction.action === 'listen') {
      onListenMode();
      return;
    }
    if (reaction.action === 'text') {
      onTextMode();
      return;
    }

    // Floating animation
    const id = Date.now();
    setFloatingEmojis(prev => [...prev, { id, emoji: reaction.emoji, x: 30 + Math.random() * 40 }]);
    setTimeout(() => setFloatingEmojis(prev => prev.filter(e => e.id !== id)), 2000);

    addReaction({
      type: reaction.type as ReactionType,
      text: reaction.text,
      emoji: reaction.emoji,
      x: 50,
      y: 50,
      multiplier: 1,
      userId: 'user',
    });
  };

  return (
    <>
      {/* Floating emojis */}
      <AnimatePresence>
        {floatingEmojis.map(({ id, emoji, x }) => (
          <motion.div
            key={id}
            className="fixed z-50 text-3xl pointer-events-none"
            style={{ left: `${x}%`, bottom: '35%' }}
            initial={{ opacity: 1, y: 0 }}
            animate={{ opacity: 0, y: -120 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5 }}
          >
            {emoji}
          </motion.div>
        ))}
      </AnimatePresence>

      <div className="flex items-center justify-center gap-1.5 px-4 py-1.5">
        {reactions.map((reaction) => (
          <motion.button
            key={reaction.type}
            className={`px-2.5 py-1 rounded-full bg-gradient-to-r ${reaction.color} border ${reaction.border} ${
              reaction.action === 'listen' && isListening ? 'ring-2 ring-cyan-400' : ''
            }`}
            onClick={() => handleReaction(reaction)}
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
          >
            <span className="text-white font-semibold text-[10px]">
              {reaction.emoji} {reaction.text}
            </span>
          </motion.button>
        ))}
      </div>
    </>
  );
};

// ============================================
// DJ TEXT INPUT OVERLAY
// ============================================
interface DJTextInputProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (text: string) => void;
}

const DJTextInput = ({ isOpen, onClose, onSubmit }: DJTextInputProps) => {
  const [inputText, setInputText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = () => {
    if (inputText.trim()) {
      onSubmit(inputText.trim());
      setInputText('');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex flex-col justify-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

          <motion.div
            className="relative z-10 bg-gradient-to-t from-[#0a0a0f] via-[#1a1a2e] to-transparent px-4 pb-8 pt-12"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
          >
            <motion.button
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10"
              onClick={onClose}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <X className="w-5 h-5 text-white/70" />
            </motion.button>

            <div className="text-center mb-4">
              <p className="text-white/50 text-sm">Talk to OYO</p>
              <h3 className="text-white font-bold text-lg">Wazzguán? 🦉</h3>
            </div>

            <div className="flex flex-wrap justify-center gap-2 mb-4">
              {DJ_PROMPTS.map((prompt) => (
                <motion.button
                  key={prompt.id}
                  className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/70 text-sm"
                  onClick={() => { onSubmit(prompt.text); setInputText(''); }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {prompt.text}
                </motion.button>
              ))}
            </div>

            <div className="flex items-center gap-3">
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                placeholder="Or type your request..."
                className="flex-1 px-4 py-3 rounded-full bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/50"
              />
              <motion.button
                className="p-3 rounded-full bg-gradient-to-r from-purple-500 to-pink-500"
                onClick={handleSubmit}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <Send className="w-5 h-5 text-white" />
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ============================================
// BOTTOM SECTION - HOT | VOYO | DISCOVERY
// Now with MOBILE TAP-TO-TEASER (30s preview) + DRAG-TO-QUEUE
// ============================================
const BottomSection = () => {
  const [activeTab, setActiveTab] = useState<'hot' | 'voyo' | 'discovery'>('voyo');
  const { hotTracks, discoverTracks, setCurrentTrack, addToQueue } = usePlayerStore();
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  // Detect touch device
  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  const MiniCard = ({ track }: { track: Track }) => {
    const [showQueueFeedback, setShowQueueFeedback] = useState(false);
    const [showTeaserFeedback, setShowTeaserFeedback] = useState(false);
    const [wasDragged, setWasDragged] = useState(false);

    // Handle tap - on mobile plays teaser, on desktop plays full
    const handleTap = () => {
      if (wasDragged) {
        setWasDragged(false);
        return;
      }

      // On mobile: tap = teaser preview indicator (30s)
      if (isTouchDevice) {
        setShowTeaserFeedback(true);
        setTimeout(() => setShowTeaserFeedback(false), 2000);
      }
      // Both mobile and desktop set the current track
      setCurrentTrack(track);
    };

    return (
      <motion.div
        className="flex-shrink-0 w-16 relative"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragStart={() => setWasDragged(true)}
        onDragEnd={(_, info) => {
          if (info.offset.x > 100) {
            addToQueue(track);
            setShowQueueFeedback(true);
            setTimeout(() => setShowQueueFeedback(false), 1500);
          }
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
          className="w-full"
          onClick={handleTap}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <div className="w-16 h-16 rounded-xl overflow-hidden mb-1 relative">
            <img
              src={getYouTubeThumbnail(track.trackId, 'medium')}
              alt={track.title}
              className="w-full h-full object-cover"
            />
            {/* Mobile hint indicator */}
            {isTouchDevice && (
              <div className="absolute bottom-0.5 right-0.5 w-3 h-3 rounded-full bg-cyan-500/80 flex items-center justify-center">
                <Play size={6} fill="white" className="text-white" />
              </div>
            )}
          </div>
          <p className="text-white text-[10px] font-medium truncate">{track.title}</p>
        </motion.button>
      </motion.div>
    );
  };

  return (
    <div className="px-4 py-2">
      <div className="flex items-center justify-center gap-8 mb-3">
        {['hot', 'voyo', 'discovery'].map((tab) => (
          <motion.button
            key={tab}
            className="relative"
            onClick={() => setActiveTab(tab as any)}
          >
            <span className={`text-xs font-bold uppercase tracking-wider ${
              activeTab === tab ? 'text-white' : 'text-white/40'
            }`}>
              {tab}
            </span>
            {activeTab === tab && (
              <motion.div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-purple-500" layoutId="activeTab" />
            )}
          </motion.button>
        ))}
      </div>

      <div className="flex items-start gap-3 overflow-x-auto scrollbar-hide pb-2">
        <div className="flex gap-2">
          {hotTracks.slice(0, 2).map((track) => (
            <MiniCard key={track.id} track={track} />
          ))}
        </div>

        <motion.button
          className="flex-shrink-0 w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-900/50 to-pink-900/50 border border-purple-500/30 flex flex-col items-center justify-center"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <span className="text-white font-bold text-xs">VOYO</span>
          <span className="text-white/60 text-[10px]">FEED</span>
        </motion.button>

        <div className="flex gap-2">
          {discoverTracks.slice(0, 2).map((track) => (
            <MiniCard key={track.id} track={track} />
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================
// MAIN EXPORT - PORTRAIT VOYO MODE (ORCHESTRATOR)
// Now with MUSIC | FEED | CREATE tabs
// ============================================
export const PortraitVOYO = ({ onSearch }: { onSearch?: () => void }) => {
  const { isPlaying, togglePlay, refreshRecommendations, setVolume, volume, voyoActiveTab, setVoyoTab } = usePlayerStore();

  const [djMode, setDjMode] = useState<DJMode>('idle');
  const [djResponse, setDjResponse] = useState<string | null>(null);
  const [isTextInputOpen, setIsTextInputOpen] = useState(false);
  const originalVolumeRef = useRef(volume);

  // Fade music when DJ is active
  useEffect(() => {
    if (djMode !== 'idle') {
      originalVolumeRef.current = volume;
      setVolume(Math.max(10, volume * 0.3));
    } else if (djMode === 'idle' && originalVolumeRef.current > 0) {
      setVolume(originalVolumeRef.current);
    }
  }, [djMode]);

  // Handle OYÉÉ - Voice listen mode
  const handleListenMode = () => {
    if (djMode === 'listening') {
      setDjMode('responding');
      setDjResponse("Back to the vibes! 🎵");
      setTimeout(() => {
        setDjMode('idle');
        setDjResponse(null);
        if (!isPlaying) togglePlay();
      }, 1500);
    } else {
      setDjMode('listening');
      if (isPlaying) togglePlay();
      setTimeout(() => setDjResponse("Wazzguán? 🦉"), 800);
      setTimeout(() => setDjResponse(null), 2500);
    }
  };

  // Handle Wazzguán - Text input mode
  const handleTextMode = () => {
    setIsTextInputOpen(true);
    setDjMode('listening');
    if (isPlaying) togglePlay();
  };

  // Handle DJ command submission
  const handleDJCommand = (command: string) => {
    setIsTextInputOpen(false);
    setDjMode('thinking');

    const commandLower = command.toLowerCase();
    let responseKey = 'default';

    if (commandLower.includes('like this') || commandLower.includes('similar')) {
      responseKey = 'more-like-this';
    } else if (commandLower.includes('different') || commandLower.includes('change')) {
      responseKey = 'something-different';
    } else if (commandLower.includes('energy') || commandLower.includes('hype')) {
      responseKey = 'more-energy';
    } else if (commandLower.includes('chill') || commandLower.includes('relax')) {
      responseKey = 'chill-vibes';
    }

    setTimeout(() => {
      setDjMode('responding');
      const responses = DJ_RESPONSES[responseKey] || DJ_RESPONSES.default;
      setDjResponse(responses[Math.floor(Math.random() * responses.length)]);
      refreshRecommendations();

      setTimeout(() => {
        setDjMode('idle');
        setDjResponse(null);
        if (!isPlaying) togglePlay();
      }, 2000);
    }, 600);
  };

  const handleCloseTextInput = () => {
    setIsTextInputOpen(false);
    if (djMode === 'listening') setDjMode('idle');
  };

  return (
    <>
      <div className="flex flex-col h-full bg-[#050507] overflow-hidden relative">

        {/* ============================================ */}
        {/* LAYER 1: MUSIC MODE - OG Portrait Vision */}
        {/* ============================================ */}
        <motion.div
          className="absolute inset-0 z-0 pb-20"
          animate={{
            scale: voyoActiveTab === 'music' ? 1 : 0.95,
            opacity: voyoActiveTab === 'music' ? 1 : 0,
            filter: voyoActiveTab === 'music' ? 'blur(0px)' : 'blur(10px)'
          }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          style={{ pointerEvents: voyoActiveTab === 'music' ? 'auto' : 'none' }}
        >
          <VoyoPortraitPlayer
            onVoyoFeed={() => setVoyoTab('feed')}
            djMode={djMode === 'listening' || djMode === 'responding'}
            onToggleDJMode={handleListenMode}
            onSearch={onSearch}
          />
        </motion.div>

        {/* ============================================ */}
        {/* LAYER 2: FEED MODE (Slide-in Overlay) */}
        {/* ============================================ */}
        <motion.div
          className="absolute inset-0 z-10"
          initial={false}
          animate={{
            x: voyoActiveTab === 'feed' ? 0 : '100%',
            opacity: voyoActiveTab === 'feed' ? 1 : 0
          }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          style={{ pointerEvents: voyoActiveTab === 'feed' ? 'auto' : 'none' }}
        >
          <VoyoVerticalFeed isActive={voyoActiveTab === 'feed'} />
        </motion.div>

        {/* ============================================ */}
        {/* LAYER 3: CREATOR MODE (Bottom Sheet Overlay) */}
        {/* ============================================ */}
        <AnimatePresence>
          {voyoActiveTab === 'upload' && (
            <CreatorUpload onClose={() => setVoyoTab('music')} />
          )}
        </AnimatePresence>

        {/* ============================================ */}
        {/* LAYER 4: BOTTOM NAVIGATION (Always on Top) */}
        {/* ============================================ */}
        <div className="absolute bottom-0 left-0 right-0 z-50">
          <VoyoBottomNav />
        </div>

      </div>

      {/* DJ Text Input Overlay */}
      <DJTextInput
        isOpen={isTextInputOpen}
        onClose={handleCloseTextInput}
        onSubmit={handleDJCommand}
      />
    </>
  );
};

export default PortraitVOYO;
