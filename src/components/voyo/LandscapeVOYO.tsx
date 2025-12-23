/**
 * VOYO Music - Landscape VOYO Mode (No Video)
 * Reference: Voyo No Video - V2 Lanscape.jpg
 *
 * Features:
 * - Same as Portrait but wider layout
 * - More cards visible horizontally
 * - Reactions split to left and right sides
 * - Triple-tap center circle to enter Video Mode
 * - Hold center circle to reveal DJ (OYO) mode
 */

import { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { SkipBack, SkipForward, Play, Plus, Volume2 } from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { getYouTubeThumbnail } from '../../data/tracks';
import { Track } from '../../types';
import { SmartImage } from '../ui/SmartImage';
import { DJTextInput } from './PortraitVOYO';

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

  // DJ Mode state
  const [isDJOpen, setIsDJOpen] = useState(false);

  const pastTracks = history.slice(-3).map(h => h.track).reverse();
  const queueTracks = queue.slice(0, 2).map(q => q.track);

  // Handle DJ command
  const handleDJCommand = (command: string) => {
    setIsDJOpen(false);

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

    // Apply the DJ's suggestion
    refreshRecommendations();
    if (!isPlaying) togglePlay();
  };

  // Handle hold to open DJ
  const handleHoldForDJ = () => {
    if (isPlaying) togglePlay(); // Pause music when opening DJ
    setIsDJOpen(true);
  };

  return (
    <div className="flex flex-col h-full p-4">
      {/* TOP: Timeline */}
      <div className="flex items-center justify-center gap-2 py-2">
        {/* Past tracks */}
        {pastTracks.map((track, i) => (
          <TimelineCard key={`past-${i}`} track={track} onClick={() => {
            setCurrentTrack(track);
            // FIX: Explicitly start playback
            setTimeout(() => togglePlay(), 100);
          }} />
        ))}

        {/* Show hot tracks as suggestions if no history */}
        {pastTracks.length === 0 && hotTracks.slice(0, 2).map((track, i) => (
          <TimelineCard key={`suggest-${i}`} track={track} onClick={() => {
            setCurrentTrack(track);
            // FIX: Explicitly start playback
            setTimeout(() => togglePlay(), 100);
          }} />
        ))}

        {/* Current track */}
        {currentTrack && (
          <TimelineCard track={currentTrack} isCurrent onClick={() => {}} />
        )}

        {/* Queue tracks */}
        {queueTracks.map((track, i) => (
          <TimelineCard key={`queue-${i}`} track={track} onClick={() => {
            setCurrentTrack(track);
            // FIX: Explicitly start playback
            setTimeout(() => togglePlay(), 100);
          }} />
        ))}

        {/* Add button */}
        <motion.button
          className="w-16 h-14 rounded-xl bg-white/5 border border-dashed border-white/20 flex items-center justify-center"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Plus className="w-5 h-5 text-white/40" />
        </motion.button>

        {/* Volume indicator */}
        <div className="ml-4 flex items-center gap-2 text-white/40">
          <Volume2 className="w-4 h-4" />
          <span className="text-xs">{Math.round(volume)}%</span>
        </div>
      </div>

      {/* MIDDLE: Play Circle & Controls */}
      <div className="flex-1 flex items-center justify-center gap-8">
        {/* Left Reactions */}
        <div className="flex flex-col gap-2">
          <motion.button
            className="px-4 py-2 rounded-full bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 text-white text-sm font-semibold"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => addReaction({ type: 'oyo', multiplier: 1, text: 'OYO', emoji: '🔥', x: 50, y: 50, userId: 'user' })}
          >
            OYO 🔥
          </motion.button>
          <motion.button
            className="px-4 py-2 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 text-white text-sm font-semibold"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => addReaction({ type: 'oye', multiplier: 1, text: 'OYÉÉ', emoji: '💜', x: 50, y: 50, userId: 'user' })}
          >
            OYÉÉ 💜
          </motion.button>
        </div>

        {/* Skip Prev */}
        <motion.button
          className="p-3 rounded-xl bg-white/5 border border-white/10"
          onClick={prevTrack}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <SkipBack className="w-6 h-6 text-white/70" />
        </motion.button>

        {/* Play Circle - Triple-tap for Video, Hold for DJ */}
        <PlayCircle onTripleTap={onVideoMode} onHold={handleHoldForDJ} />

        {/* Skip Next */}
        <motion.button
          className="p-3 rounded-xl bg-white/5 border border-white/10"
          onClick={nextTrack}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <SkipForward className="w-6 h-6 text-white/70" />
        </motion.button>

        {/* Right Reactions */}
        <div className="flex flex-col gap-2">
          <motion.button
            className="px-4 py-2 rounded-full bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 text-white text-sm font-semibold"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => addReaction({ type: 'wazzguan', multiplier: 1, text: 'Wazzguán', emoji: '👋', x: 50, y: 50, userId: 'user' })}
          >
            Wazzguán 👋
          </motion.button>
          <motion.button
            className="px-4 py-2 rounded-full bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/30 text-white text-sm font-semibold"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => addReaction({ type: 'fire', multiplier: 1, text: 'Fireee', emoji: '🔥', x: 50, y: 50, userId: 'user' })}
          >
            Fireee 🔥
          </motion.button>
        </div>
      </div>

      {/* BOTTOM: HOT | VOYO | DISCOVERY */}
      <div className="flex items-center justify-center gap-6 py-3">
        {/* HOT Section */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-white/40 text-xs uppercase tracking-wider">HOT</span>
          <div className="flex gap-2">
            {hotTracks.slice(0, 4).map((track) => (
              <MiniCard key={track.id} track={track} onClick={() => {
                setCurrentTrack(track);
                // FIX: Explicitly start playback
                setTimeout(() => togglePlay(), 100);
              }} />
            ))}
          </div>
        </div>

        {/* VOYO FEED */}
        <motion.button
          className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-900/50 to-pink-900/50 border border-purple-500/30 flex flex-col items-center justify-center"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <span className="text-white font-bold text-sm">VOYO</span>
          <span className="text-white/60 text-xs">FEED</span>
        </motion.button>

        {/* DISCOVERY Section */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-white/40 text-xs uppercase tracking-wider">DISCOVERY</span>
          <div className="flex gap-2">
            {discoverTracks.slice(0, 4).map((track) => (
              <MiniCard key={track.id} track={track} onClick={() => {
                setCurrentTrack(track);
                // FIX: Explicitly start playback
                setTimeout(() => togglePlay(), 100);
              }} />
            ))}
          </div>
        </div>
      </div>

      {/* Interaction hints */}
      <p className="text-center text-white/20 text-xs">Triple-tap for Video Mode | Hold for DJ</p>

      {/* DJ Text Input Overlay */}
      <DJTextInput
        isOpen={isDJOpen}
        onClose={() => setIsDJOpen(false)}
        onSubmit={handleDJCommand}
      />
    </div>
  );
};

export default LandscapeVOYO;
