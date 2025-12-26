/**
 * VOYO Music - Landscape Video Mode
 *
 * VIDEO-FIRST EXPERIENCE:
 * - YouTube video plays fullscreen as background
 * - UI overlay auto-hides after 3 seconds
 * - 1 tap: Show controls briefly
 * - 2 taps (double-tap): OYO DJ mode directly
 * - Back button returns to portrait
 *
 * INTERCEPTOR:
 * - Purple-bordered overlay on YouTube suggestions (right side)
 * - Click → OCR extracts video title → adds to VOYO queue
 * - User never leaves VOYO ecosystem
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { SkipBack, SkipForward, Play, Pause, Plus, Volume2, Smartphone, Loader2 } from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { getYouTubeThumbnail, TRACKS } from '../../data/tracks';
import { Track } from '../../types';
import { SmartImage } from '../ui/SmartImage';
import { DJTextInput } from './PortraitVOYO';
import {
  extractTextFromImage,
  parseVideoTitles,
  searchLocalCache,
  searchYouTube,
  cacheVideo,
  registerTrackPlay
} from '../../services/videoIntelligence';

// Timeline Card (horizontal scroll)
const TimelineCard = ({
  track,
  isCurrent,
  onClick,
}: {
  track: Track;
  isCurrent?: boolean;
  onClick: () => void;
}) => (
  <motion.button
    className={`
      relative flex-shrink-0 rounded-xl overflow-hidden
      ${isCurrent ? 'w-32 h-24' : 'w-20 h-16 opacity-70 hover:opacity-90'}
    `}
    onClick={onClick}
    whileHover={{ scale: isCurrent ? 1 : 1.05 }}
    whileTap={{ scale: 0.95 }}
    layout
  >
    <SmartImage
      src={getYouTubeThumbnail(track.trackId, 'medium')}
      alt={track.title}
      className="w-full h-full object-cover"
      trackId={track.trackId}
      lazy={true}
    />
    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
    <div className="absolute bottom-1 left-1 right-1">
      <p className="text-white font-bold text-[10px] truncate">{track.title}</p>
      <p className="text-white/60 text-[8px] truncate">{track.artist}</p>
    </div>
  </motion.button>
);

// Waveform Bars (landscape version)
const WaveformBars = ({ isPlaying }: { isPlaying: boolean }) => {
  const bars = 24;
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="flex items-center gap-[2px]">
        {Array.from({ length: bars }).map((_, i) => {
          const distance = Math.abs(i - bars / 2);
          const maxHeight = 28 - distance * 1.2;

          return (
            <motion.div
              key={i}
              className="w-[3px] rounded-full bg-white/80"
              animate={isPlaying ? {
                height: [maxHeight * 0.3, maxHeight, maxHeight * 0.5, maxHeight * 0.8, maxHeight * 0.3],
              } : {
                height: maxHeight * 0.4,
              }}
              transition={isPlaying ? {
                duration: 0.6 + (i % 5) * 0.08,  // Deterministic variation based on index
                repeat: Infinity,
                delay: i * 0.02,
                ease: "easeInOut",
              } : { duration: 0.2 }}
            />
          );
        })}
      </div>
    </div>
  );
};

// Main Play Circle (landscape)
// Triple-tap = Video Mode, Hold (500ms) = DJ Mode
const PlayCircle = ({ onTripleTap, onHold }: { onTripleTap: () => void; onHold: () => void }) => {
  const { isPlaying, togglePlay, progress } = usePlayerStore();
  const controls = useAnimation();
  const tapCountRef = useRef(0);
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isHoldingRef = useRef(false);

  useEffect(() => {
    if (isPlaying) {
      controls.start({
        boxShadow: [
          '0 0 40px rgba(168, 85, 247, 0.4), 0 0 80px rgba(236, 72, 153, 0.2)',
          '0 0 60px rgba(168, 85, 247, 0.6), 0 0 100px rgba(236, 72, 153, 0.3)',
        ],
      });
    } else {
      controls.start({
        boxShadow: '0 0 30px rgba(168, 85, 247, 0.3)',
      });
    }
  }, [isPlaying, controls]);

  const handlePointerDown = () => {
    isHoldingRef.current = false;
    holdTimeoutRef.current = setTimeout(() => {
      isHoldingRef.current = true;
      onHold();
    }, 500); // 500ms hold to trigger DJ
  };

  const handlePointerUp = () => {
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
    }
    // Only process tap if we didn't hold
    if (!isHoldingRef.current) {
      handleTap();
    }
    isHoldingRef.current = false;
  };

  const handleTap = () => {
    tapCountRef.current += 1;

    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
    }

    if (tapCountRef.current >= 3) {
      tapCountRef.current = 0;
      onTripleTap();
      return;
    }

    tapTimeoutRef.current = setTimeout(() => {
      if (tapCountRef.current < 3) {
        togglePlay();
      }
      tapCountRef.current = 0;
    }, 300);
  };

  return (
    <motion.button
      className="relative w-36 h-36 rounded-full flex items-center justify-center"
      style={{
        background: 'conic-gradient(from 0deg, #a855f7, #ec4899, #a855f7)',
        padding: '3px',
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={() => holdTimeoutRef.current && clearTimeout(holdTimeoutRef.current)}
      animate={controls}
      transition={{ duration: 2, repeat: isPlaying ? Infinity : 0, ease: "easeInOut" }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Progress ring */}
      <svg className="absolute inset-0 w-full h-full -rotate-90">
        <circle cx="72" cy="72" r="68" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3" />
        <motion.circle
          cx="72" cy="72" r="68" fill="none" stroke="rgba(255,255,255,0.5)"
          strokeWidth="3" strokeLinecap="round" strokeDasharray={427}
          strokeDashoffset={427 - (progress / 100) * 427}
        />
      </svg>

      {/* Inner circle */}
      <div className="w-full h-full rounded-full bg-[#0a0a0f] flex items-center justify-center relative overflow-hidden">
        <WaveformBars isPlaying={isPlaying} />

        {/* Play/Pause Icon */}
        <div className="relative z-10">
          <AnimatePresence mode="wait">
            {isPlaying ? (
              <motion.div
                key="pause"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="flex gap-1.5"
              >
                <div className="w-3 h-10 bg-white rounded-sm" />
                <div className="w-3 h-10 bg-white rounded-sm" />
              </motion.div>
            ) : (
              <motion.div key="play" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                <Play className="w-12 h-12 text-white ml-1" fill="white" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.button>
  );
};

// Mini Track Card for bottom rows
const MiniCard = ({ track, onClick }: { track: Track; onClick: () => void }) => {
  const addToQueue = usePlayerStore(state => state.addToQueue);
  const [showQueueFeedback, setShowQueueFeedback] = useState(false);

  return (
    <motion.div
      className="flex-shrink-0 w-16 relative"
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.2}
      onDragEnd={(_, info) => {
        if (info.offset.x > 100) {
          addToQueue(track);
          setShowQueueFeedback(true);
          setTimeout(() => setShowQueueFeedback(false), 1500);
        }
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

      <motion.button
        className="w-full"
        onClick={onClick}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <div className="w-16 h-16 rounded-lg overflow-hidden mb-1">
          <SmartImage
            src={getYouTubeThumbnail(track.trackId, 'medium')}
            alt={track.title}
            className="w-full h-full object-cover"
            trackId={track.trackId}
            lazy={true}
          />
        </div>
        <p className="text-white text-[9px] font-medium truncate">{track.title}</p>
      </motion.button>
    </motion.div>
  );
};

interface LandscapeVOYOProps {
  onVideoMode: () => void;
}

// DJ Response Messages
const DJ_RESPONSES: Record<string, string[]> = {
  'more-like-this': ["Got you fam!", "Adding similar vibes..."],
  'something-different': ["Say less!", "Switching it up..."],
  'more-energy': ["AYEEE!", "Turning UP!"],
  'chill-vibes': ["Cooling it down...", "Smooth vibes only"],
  'default': ["I hear you!", "Say less, fam!", "OYE!"],
};

// ============================================
// INTERCEPTOR - Capture YouTube Suggestions
// ============================================
interface InterceptorProps {
  onVideoExtracted: (videoId: string, title: string) => void;
  iframeRef?: React.RefObject<HTMLIFrameElement>;
}

const YouTubeInterceptor = ({ onVideoExtracted }: InterceptorProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [successAnimation, setSuccessAnimation] = useState(false);

  // Handle click on interceptor zone
  const handleInterceptClick = async (zone: 'top' | 'bottom') => {
    if (isProcessing) return;

    setIsProcessing(true);

    try {
      // Simulated flow - In production: OCR → Video Intelligence → Real video
      await new Promise(r => setTimeout(r, 600));

      // For demo: search for a related track from our catalog
      const randomTrack = TRACKS[Math.floor(Math.random() * TRACKS.length)];

      onVideoExtracted(randomTrack.trackId, randomTrack.title);

      // Success animation
      setSuccessAnimation(true);
      setFeedback(`${randomTrack.title.slice(0, 25)}...`);
      setTimeout(() => {
        setSuccessAnimation(false);
        setFeedback(null);
      }, 2000);

    } catch (err) {
      console.error('[Interceptor] Error:', err);
      setFeedback('Oops! Try again');
      setTimeout(() => setFeedback(null), 2000);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      {/* INTERCEPTOR ZONES - INTENTIONAL & BEAUTIFUL */}
      {/* Not hiding - INVITING. Users WANT to tap these. */}
      <div className="absolute right-0 top-0 bottom-0 w-[300px] z-15 pointer-events-none flex flex-col items-end justify-center gap-4 pr-4">

        {/* ADD TO QUEUE - Bouncing & Glowing */}
        <motion.button
          className="pointer-events-auto relative overflow-hidden"
          onClick={() => handleInterceptClick('top')}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          animate={isProcessing ? {} : {
            y: [0, -8, 0],
          }}
          transition={{
            y: { duration: 2, repeat: Infinity, ease: "easeInOut" }
          }}
        >
          {/* Glow Effect */}
          <motion.div
            className="absolute inset-0 rounded-2xl"
            animate={{
              boxShadow: [
                '0 0 20px rgba(147, 51, 234, 0.3)',
                '0 0 40px rgba(147, 51, 234, 0.6)',
                '0 0 20px rgba(147, 51, 234, 0.3)',
              ]
            }}
            transition={{ duration: 2, repeat: Infinity }}
          />

          {/* Button Content */}
          <div className="relative bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-3 rounded-2xl border-2 border-white/20">
            {isProcessing ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 text-white animate-spin" />
                <span className="text-white font-bold text-sm">Adding...</span>
              </div>
            ) : successAnimation ? (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="flex items-center gap-2"
              >
                <span className="text-white font-bold text-sm">Added! 🔥</span>
              </motion.div>
            ) : (
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-white" />
                <span className="text-white font-bold text-sm">Add to Queue</span>
              </div>
            )}
          </div>
        </motion.button>

        {/* UP NEXT - Subtle pulse */}
        <motion.button
          className="pointer-events-auto relative"
          onClick={() => handleInterceptClick('bottom')}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          animate={{
            opacity: [0.7, 1, 0.7],
          }}
          transition={{
            opacity: { duration: 3, repeat: Infinity, ease: "easeInOut" }
          }}
        >
          <div className="bg-black/40 backdrop-blur-sm px-5 py-2.5 rounded-xl border border-purple-500/50">
            <div className="flex items-center gap-2">
              <SkipForward className="w-4 h-4 text-purple-400" />
              <span className="text-purple-300 font-medium text-sm">Up Next</span>
            </div>
          </div>
        </motion.button>

      </div>

      {/* Success Feedback Toast */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            className="absolute bottom-24 left-1/2 -translate-x-1/2 z-50"
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
          >
            <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-5 py-2.5 rounded-full text-sm font-bold shadow-xl flex items-center gap-2">
              <span>🎵</span>
              <span>{feedback}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export const LandscapeVOYO = ({ onVideoMode }: LandscapeVOYOProps) => {
  const {
    currentTrack,
    history,
    queue,
    hotTracks,
    discoverTracks,
    nextTrack,
    prevTrack,
    setCurrentTrack,
    addReaction,
    volume,
    refreshRecommendations,
    isPlaying,
    togglePlay,
  } = usePlayerStore();

  // UI visibility state - auto-hide after 3 seconds
  const [showOverlay, setShowOverlay] = useState(true);
  const [isDJOpen, setIsDJOpen] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRef = useRef<number>(0);

  // Build timeline with deduplication
  const seenIds = new Set<string>();
  if (currentTrack) seenIds.add(currentTrack.id);

  const pastTracks = history
    .slice(-5) // Look at more history to fill 3 unique slots
    .map(h => h.track)
    .reverse()
    .filter(t => {
      if (seenIds.has(t.id)) return false;
      seenIds.add(t.id);
      return true;
    })
    .slice(0, 3);

  const queueTracks = queue
    .slice(0, 4) // Look at more queue to fill 2 unique slots
    .map(q => q.track)
    .filter(t => {
      if (seenIds.has(t.id)) return false;
      seenIds.add(t.id);
      return true;
    })
    .slice(0, 2);

  // Fallback suggestions when no history (also deduplicated)
  const suggestTracks = hotTracks
    .filter(t => !seenIds.has(t.id))
    .slice(0, 2);

  // Auto-hide overlay after 3 seconds
  const startHideTimer = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (!isDJOpen) setShowOverlay(false);
    }, 3000);
  }, [isDJOpen]);

  // Handle tap on video area
  const handleVideoTap = useCallback(() => {
    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;
    lastTapRef.current = now;

    // Double-tap detection (< 300ms)
    if (timeSinceLastTap < 300) {
      // Double-tap = Open DJ directly
      setIsDJOpen(true);
      setShowOverlay(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    } else {
      // Single tap = Toggle overlay visibility
      if (showOverlay) {
        setShowOverlay(false);
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      } else {
        setShowOverlay(true);
        startHideTimer();
      }
    }
  }, [showOverlay, startHideTimer]);

  // Start hide timer when overlay shown
  useEffect(() => {
    if (showOverlay && !isDJOpen) {
      startHideTimer();
    }
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [showOverlay, isDJOpen, startHideTimer]);

  // Handle DJ command
  const handleDJCommand = (command: string) => {
    setIsDJOpen(false);
    startHideTimer();

    const commandLower = command.toLowerCase();
    if (commandLower.includes('like this') || commandLower.includes('similar')) {
      // more-like-this
    } else if (commandLower.includes('different') || commandLower.includes('change')) {
      // something-different
    } else if (commandLower.includes('energy') || commandLower.includes('hype')) {
      // more-energy
    } else if (commandLower.includes('chill') || commandLower.includes('relax')) {
      // chill-vibes
    }

    refreshRecommendations();
    if (!isPlaying) togglePlay();
  };

  // Handle back to portrait
  const handleBackToPortrait = () => {
    // Rotate back by exiting fullscreen or just letting orientation change
    // For now, this is handled by the orientation hook in App.tsx
    // We could force portrait mode here if needed
  };

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      {/* LAYER 1: YouTube Video Fullscreen Background */}
      {currentTrack && (
        <div className="absolute inset-0 z-0">
          <iframe
            src={`https://www.youtube.com/embed/${currentTrack.trackId}?autoplay=1&controls=0&modestbranding=1&rel=0&playsinline=1&loop=1&playlist=${currentTrack.trackId}&showinfo=0&iv_load_policy=3&fs=0`}
            className="absolute inset-0 w-full h-full"
            style={{
              // Scale up to hide YouTube UI edges
              transform: 'scale(1.2)',
              transformOrigin: 'center center',
            }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            title={currentTrack.title}
          />
        </div>
      )}

      {/* LAYER 2: Tap Detection Area (invisible) */}
      <div
        className="absolute inset-0 z-10"
        onClick={handleVideoTap}
      />

      {/* LAYER 2.5: YouTube Suggestion Interceptor */}
      {/* Purple-bordered zones over YouTube's "Up Next" suggestions */}
      <YouTubeInterceptor
        onVideoExtracted={(videoId, title) => {
          // Find track in our catalog or create a new one
          const existingTrack = TRACKS.find(t => t.trackId === videoId);
          if (existingTrack) {
            addToQueue(existingTrack);
          } else {
            // Create ad-hoc track for videos not in our catalog
            const newTrack: Track = {
              id: `intercepted-${videoId}`,
              trackId: videoId,
              title: title,
              artist: 'YouTube',
              thumbnail: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
              duration: 0,
              genres: ['afrobeats'],
              mood: ['party'],
              energy: 0.7,
              releaseYear: new Date().getFullYear(),
            };
            addToQueue(newTrack);
          }
          // Show overlay briefly with feedback
          setShowOverlay(true);
          startHideTimer();
        }}
      />

      {/* LAYER 3: UI Overlay - Auto-hides */}
      <AnimatePresence>
        {showOverlay && !isDJOpen && (
          <motion.div
            className="absolute inset-0 z-20 flex flex-col pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Dark gradient for readability */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/60" />

            {/* TOP: Timeline */}
            <div className="relative flex items-center justify-center gap-2 p-3 pointer-events-auto">
              {pastTracks.map((track, i) => (
                <TimelineCard key={`past-${i}`} track={track} onClick={() => {
                  setCurrentTrack(track);
                  setTimeout(() => togglePlay(), 100);
                  startHideTimer();
                }} />
              ))}
              {pastTracks.length === 0 && suggestTracks.map((track, i) => (
                <TimelineCard key={`suggest-${i}`} track={track} onClick={() => {
                  setCurrentTrack(track);
                  setTimeout(() => togglePlay(), 100);
                  startHideTimer();
                }} />
              ))}
              {currentTrack && (
                <TimelineCard track={currentTrack} isCurrent onClick={() => {}} />
              )}
              {queueTracks.map((track, i) => (
                <TimelineCard key={`queue-${i}`} track={track} onClick={() => {
                  setCurrentTrack(track);
                  setTimeout(() => togglePlay(), 100);
                  startHideTimer();
                }} />
              ))}
              <motion.button
                className="w-14 h-12 rounded-xl bg-white/10 backdrop-blur-sm border border-dashed border-white/30 flex items-center justify-center"
                whileTap={{ scale: 0.95 }}
              >
                <Plus className="w-4 h-4 text-white/60" />
              </motion.button>
            </div>

            {/* MIDDLE: Controls */}
            <div className="flex-1 flex items-center justify-center gap-6 pointer-events-auto">
              {/* Left Reactions */}
              <div className="flex flex-col gap-2">
                <motion.button
                  className="px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-yellow-500/40 text-white text-sm"
                  whileTap={{ scale: 0.95 }}
                  onClick={() => { addReaction({ type: 'oyo', multiplier: 1, text: 'OYO', emoji: '🔥', x: 50, y: 50, userId: 'user' }); startHideTimer(); }}
                >
                  OYO 🔥
                </motion.button>
                <motion.button
                  className="px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-purple-500/40 text-white text-sm"
                  whileTap={{ scale: 0.95 }}
                  onClick={() => { addReaction({ type: 'oye', multiplier: 1, text: 'OYÉÉ', emoji: '💜', x: 50, y: 50, userId: 'user' }); startHideTimer(); }}
                >
                  OYÉÉ 💜
                </motion.button>
              </div>

              {/* Skip Prev */}
              <motion.button
                className="p-3 rounded-full bg-white/10 backdrop-blur-sm"
                onClick={() => { prevTrack(); startHideTimer(); }}
                whileTap={{ scale: 0.9 }}
              >
                <SkipBack className="w-6 h-6 text-white" />
              </motion.button>

              {/* Play/Pause - Center */}
              <motion.button
                className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center"
                onClick={() => { togglePlay(); startHideTimer(); }}
                whileTap={{ scale: 0.9 }}
              >
                {isPlaying ? (
                  <Pause className="w-8 h-8 text-white" fill="white" />
                ) : (
                  <Play className="w-8 h-8 text-white ml-1" fill="white" />
                )}
              </motion.button>

              {/* Skip Next */}
              <motion.button
                className="p-3 rounded-full bg-white/10 backdrop-blur-sm"
                onClick={() => { nextTrack(); startHideTimer(); }}
                whileTap={{ scale: 0.9 }}
              >
                <SkipForward className="w-6 h-6 text-white" />
              </motion.button>

              {/* Right Reactions */}
              <div className="flex flex-col gap-2">
                <motion.button
                  className="px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-cyan-500/40 text-white text-sm"
                  whileTap={{ scale: 0.95 }}
                  onClick={() => { addReaction({ type: 'wazzguan', multiplier: 1, text: 'Wazzguán', emoji: '👋', x: 50, y: 50, userId: 'user' }); startHideTimer(); }}
                >
                  Wazzguán 👋
                </motion.button>
                <motion.button
                  className="px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-red-500/40 text-white text-sm"
                  whileTap={{ scale: 0.95 }}
                  onClick={() => { addReaction({ type: 'fire', multiplier: 1, text: 'Fireee', emoji: '🔥', x: 50, y: 50, userId: 'user' }); startHideTimer(); }}
                >
                  Fireee 🔥
                </motion.button>
              </div>
            </div>

            {/* BOTTOM: HOT | DISCOVERY + Back Button */}
            <div className="relative flex items-center justify-center gap-4 p-3 pointer-events-auto">
              {/* HOT Section */}
              <div className="flex items-center gap-2">
                <span className="text-white/60 text-xs uppercase">HOT</span>
                {hotTracks.slice(0, 3).map((track) => (
                  <MiniCard key={track.id} track={track} onClick={() => {
                    setCurrentTrack(track);
                    setTimeout(() => togglePlay(), 100);
                    startHideTimer();
                  }} />
                ))}
              </div>

              {/* DISCOVERY Section */}
              <div className="flex items-center gap-2">
                <span className="text-white/60 text-xs uppercase">DISCOVER</span>
                {discoverTracks.slice(0, 3).map((track) => (
                  <MiniCard key={track.id} track={track} onClick={() => {
                    setCurrentTrack(track);
                    setTimeout(() => togglePlay(), 100);
                    startHideTimer();
                  }} />
                ))}
              </div>

              {/* Back to Portrait Button */}
              <motion.button
                className="absolute right-3 bottom-3 px-3 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 flex items-center gap-2 text-white text-xs"
                whileTap={{ scale: 0.95 }}
                onClick={handleBackToPortrait}
              >
                <Smartphone className="w-4 h-4" />
                Portrait
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* LAYER 4: OYO DJ Overlay - Double-tap activated */}
      <AnimatePresence>
        {isDJOpen && (
          <motion.div
            className="absolute inset-0 z-30 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Semi-transparent backdrop */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setIsDJOpen(false); startHideTimer(); }} />

            {/* DJ Input */}
            <DJTextInput
              isOpen={isDJOpen}
              onClose={() => { setIsDJOpen(false); startHideTimer(); }}
              onSubmit={handleDJCommand}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Track info - always visible at top left */}
      {currentTrack && !showOverlay && !isDJOpen && (
        <motion.div
          className="absolute top-3 left-3 z-20 bg-black/40 backdrop-blur-sm rounded-lg px-3 py-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <p className="text-white text-sm font-medium truncate max-w-[200px]">{currentTrack.title}</p>
          <p className="text-white/60 text-xs truncate">{currentTrack.artist}</p>
        </motion.div>
      )}
    </div>
  );
};

export default LandscapeVOYO;
