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
import { SkipBack, SkipForward, Play, Pause, Plus, Volume2, Smartphone, Loader2, Zap } from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { BoostButton } from '../ui/BoostButton';
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
  registerTrackPlay,
  registerTrackQueue,
  getRelatedVideos
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

  // Cleanup tap and hold timeouts on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
        tapTimeoutRef.current = undefined;
      }
      if (holdTimeoutRef.current) {
        clearTimeout(holdTimeoutRef.current);
        holdTimeoutRef.current = undefined;
      }
    };
  }, []);

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
  onVideoExtracted: (videoId: string, title: string, artist: string) => void;
  iframeRef?: React.RefObject<HTMLIFrameElement>;
}

// Two interceptor styles that alternate randomly
type InterceptorStyle = 'floaty' | 'bold';

const YouTubeInterceptor = ({ onVideoExtracted }: InterceptorProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [successAnimation, setSuccessAnimation] = useState(false);

  // Random style - changes each time interceptor appears
  const [style, setStyle] = useState<InterceptorStyle>('floaty');

  // Get playback state to know when to show interceptor
  const currentTime = usePlayerStore(state => state.currentTime);
  const duration = usePlayerStore(state => state.duration);
  const currentTrack = usePlayerStore(state => state.currentTrack);

  // FORMULA: YouTube shows suggestions ~10-15 seconds before end
  // We arrive 5 SECONDS EARLIER. Already glowing when YouTube's appear.
  // Our layer is on TOP. User sees VOYO, not YouTube.
  const VOYO_ARRIVES_EARLY = 20;  // We show up at -20s
  const YOUTUBE_SHOWS_AT = 15;    // YouTube shows at -15s (5s after us)

  const isInSuggestionZone = duration > 0 && currentTime > (duration - VOYO_ARRIVES_EARLY);
  const secondsUntilEnd = duration > 0 ? Math.ceil(duration - currentTime) : 0;

  // Also show briefly at the start (first 5 seconds) for discovery
  const isInStartZone = currentTime < 5 && currentTime > 0.5;

  // Show interceptor when in either zone
  const showInterceptor = isInSuggestionZone || isInStartZone;

  // Randomize style when interceptor appears
  useEffect(() => {
    if (showInterceptor) {
      setStyle(Math.random() > 0.5 ? 'floaty' : 'bold');
    }
  }, [isInSuggestionZone]); // Only change when entering suggestion zone

  // Handle click on interceptor zone - REAL FLOW
  const handleInterceptClick = async (zone: 'top' | 'bottom') => {
    if (isProcessing || !currentTrack) return;

    setIsProcessing(true);

    try {
      // Get related videos from YouTube via our backend
      const relatedVideos = await getRelatedVideos(currentTrack.trackId, 3);

      if (relatedVideos.length === 0) {
        // Fallback: pick from our catalog
        const randomTrack = TRACKS[Math.floor(Math.random() * TRACKS.length)];
        onVideoExtracted(randomTrack.trackId, randomTrack.title, randomTrack.artist);
        setFeedback(`${randomTrack.title.slice(0, 20)}...`);
      } else {
        // Pick the first related video (or random from top 3 for variety)
        const videoIndex = zone === 'top' ? 0 : Math.min(1, relatedVideos.length - 1);
        const relatedVideo = relatedVideos[videoIndex];

        onVideoExtracted(relatedVideo.id, relatedVideo.title, relatedVideo.artist);
        setFeedback(`${relatedVideo.title.slice(0, 20)}...`);

        // Cache this discovery for collective brain
        cacheVideo({
          youtubeId: relatedVideo.id,
          title: relatedVideo.title,
          artist: relatedVideo.artist,
          durationSeconds: relatedVideo.duration,
          thumbnailUrl: relatedVideo.thumbnail,
          discoveryMethod: 'related_crawl'
        });
      }

      // Success animation
      setSuccessAnimation(true);
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
      {/* INTERCEPTOR ZONES - Appear EXACTLY when YouTube shows suggestions */}
      {/* Formula: Last 15 seconds OR first 5 seconds */}
      <AnimatePresence>
        {showInterceptor && (
          <motion.div
            className="absolute right-0 top-0 bottom-0 w-[300px] z-15 pointer-events-none flex flex-col items-end justify-center gap-4 pr-4"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >

            {/* ADD TO QUEUE - Two random styles */}
            {style === 'floaty' ? (
              /* STYLE A: Floaty bouncing with glow */
              <motion.button
                className="pointer-events-auto relative overflow-hidden"
                onClick={() => handleInterceptClick('top')}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                animate={isProcessing ? {} : { y: [0, -8, 0] }}
                transition={{ y: { duration: 2, repeat: Infinity, ease: "easeInOut" } }}
              >
                <motion.div
                  className="absolute -inset-2 rounded-2xl"
                  animate={{
                    boxShadow: [
                      '0 0 0 3px rgba(147, 51, 234, 0.8), 0 0 30px rgba(147, 51, 234, 0.4)',
                      '0 0 0 4px rgba(236, 72, 153, 0.8), 0 0 50px rgba(236, 72, 153, 0.5)',
                      '0 0 0 3px rgba(147, 51, 234, 0.8), 0 0 30px rgba(147, 51, 234, 0.4)',
                    ]
                  }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                <div className="relative bg-gradient-to-r from-purple-600 to-pink-600 px-8 py-4 rounded-xl border-4 border-white/30">
                  {isProcessing ? (
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                      <span className="text-white font-black text-base">Adding...</span>
                    </div>
                  ) : successAnimation ? (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-2">
                      <span className="text-white font-black text-base">Added! 🔥</span>
                    </motion.div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <Plus className="w-6 h-6 text-white stroke-[3]" />
                      <span className="text-white font-black text-base tracking-wide">ADD TO QUEUE</span>
                    </div>
                  )}
                </div>
              </motion.button>
            ) : (
              /* STYLE B: Bold rectangle with pulse scale */
              <motion.button
                className="pointer-events-auto relative"
                onClick={() => handleInterceptClick('top')}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                animate={isProcessing ? {} : { scale: [1, 1.02, 1] }}
                transition={{ scale: { duration: 1.5, repeat: Infinity, ease: "easeInOut" } }}
              >
                {/* Rotating border effect */}
                <motion.div
                  className="absolute -inset-1 rounded-lg bg-gradient-to-r from-purple-500 via-pink-500 to-purple-500"
                  animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
                  transition={{ duration: 3, repeat: Infinity }}
                  style={{ backgroundSize: '200% 200%' }}
                />
                <div className="relative bg-black px-8 py-4 rounded-lg m-[3px]">
                  {isProcessing ? (
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                      <span className="text-purple-300 font-black text-base">ADDING...</span>
                    </div>
                  ) : successAnimation ? (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-2">
                      <span className="text-green-400 font-black text-base">ADDED! 🔥</span>
                    </motion.div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <Plus className="w-6 h-6 text-purple-400 stroke-[3]" />
                      <span className="text-white font-black text-base tracking-widest">+ QUEUE</span>
                    </div>
                  )}
                </div>
              </motion.button>
            )}

            {/* UP NEXT - Secondary rectangle */}
            <motion.button
              className="pointer-events-auto relative"
              onClick={() => handleInterceptClick('bottom')}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              {/* Bold border */}
              <div className="absolute -inset-1 rounded-xl border-2 border-purple-500/60" />

              <div className="relative bg-black/60 backdrop-blur-md px-6 py-3 rounded-lg border-2 border-purple-400/40">
                <div className="flex items-center gap-3">
                  <SkipForward className="w-5 h-5 text-purple-300" />
                  <span className="text-purple-200 font-bold text-sm tracking-wide">UP NEXT</span>
                </div>
              </div>
            </motion.button>

            {/* Countdown indicator - shows we arrived first */}
            {isInSuggestionZone && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-purple-400/80 text-xs font-mono mt-2 flex items-center gap-2"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                <span>{secondsUntilEnd}s</span>
              </motion.div>
            )}

          </motion.div>
        )}
      </AnimatePresence>

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
    addToQueue,
    addReaction,
    volume,
    refreshRecommendations,
    isPlaying,
    togglePlay,
    playbackSource,
    setPlaybackSource,
    currentTime,
    setVideoTarget,
  } = usePlayerStore();

  // Set video target to landscape on mount, hidden on unmount
  useEffect(() => {
    setVideoTarget('landscape');
    return () => {
      setVideoTarget('hidden');
    };
  }, [setVideoTarget]);

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
      {/* LAYER 1: Video plays via AudioPlayer iframe (positioned by setVideoTarget) */}
      {/* The AudioPlayer's iframe is set to 'landscape' mode and appears fullscreen here */}
      <div className="absolute inset-0 z-0 bg-black" />

      {/* LAYER 2: Tap Detection Area (invisible) */}
      <div
        className="absolute inset-0 z-10"
        onClick={handleVideoTap}
      />

      {/* LAYER 2.5: YouTube Suggestion Interceptor */}
      {/* Purple-bordered zones over YouTube's "Up Next" suggestions */}
      <YouTubeInterceptor
        onVideoExtracted={(videoId, title, artist) => {
          // Find track in our catalog or create a new one
          const existingTrack = TRACKS.find(t => t.trackId === videoId);
          if (existingTrack) {
            addToQueue(existingTrack);
          } else {
            // Create ad-hoc track for videos not in our catalog
            // This is a REAL video from YouTube's related feed!
            const newTrack: Track = {
              id: `intercepted-${videoId}`,
              trackId: videoId,
              title: title,
              artist: artist || 'YouTube',
              coverUrl: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
              duration: 0,
              tags: ['afrobeats'],
              mood: 'party',
              oyeScore: 0,
              createdAt: new Date().toISOString(),
            };
            addToQueue(newTrack);
          }

          // Track queue action in Supabase (collective brain)
          registerTrackQueue(videoId);
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

              {/* Boost Toggle - Enhanced Audio with Video */}
              <div className="ml-4">
                <BoostButton variant="toolbar" />
                {playbackSource === 'cached' && (
                  <span className="block text-[10px] text-yellow-400 text-center mt-1">HD Audio</span>
                )}
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
