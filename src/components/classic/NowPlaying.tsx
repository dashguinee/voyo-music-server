/**
 * VOYO Music - Classic Mode: Now Playing
 * Reference: Classic Mode - When clicked on profile.jpg (Right phone)
 *
 * Features:
 * - Standard music player (Spotify-style)
 * - Large album art
 * - Song title & artist
 * - Progress bar with timestamps
 * - Shuffle, Previous, Play/Pause, Next, Queue
 * - Heart to like
 * - VOYO DJ: Live reactions & comments (social layer)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  Heart,
  Share2,
  Shuffle,
  SkipBack,
  Play,
  Pause,
  SkipForward,
  ListMusic,
  Repeat,
  Volume2,
  MessageCircle,
  ChevronUp
} from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { usePreferenceStore } from '../../store/preferenceStore';
import { getTrackThumbnailUrl } from '../../utils/imageHelpers';
import { useMobilePlay } from '../../hooks/useMobilePlay';

// ============================================
// VOYO DJ TYPES
// ============================================
interface FloatingReaction {
  id: number;
  type: 'oye' | 'fire' | 'love' | 'zap';
  emoji: string;
  x: number;
  xOffset1: number;
  xOffset2: number;
}

interface LiveComment {
  id: number;
  user: string;
  text: string;
}

// ============================================
// FAKE LIVE COMMENTS DATA
// ============================================
const LIVE_COMMENTS: LiveComment[] = [
  { id: 1, user: 'nathanp2001', text: 'This track is FIRE 🔥🔥🔥' },
  { id: 2, user: 'abdoulaziz', text: 'DJ I found youuuu OHhhhh!' },
  { id: 3, user: 'saralove', text: 'Great vibez 🔥💯 New afro 🎶' },
  { id: 4, user: 'dashfam', text: 'OYÉÉÉÉ!!! 🦉⚡' },
  { id: 5, user: 'afrovibes', text: 'Amapiano hits different 🌙' },
  { id: 6, user: 'gaborone_g', text: 'South Africa in the building!! 🇿🇦' },
  { id: 7, user: 'lagosqueen', text: 'Nigeria stand UP! 🇳🇬🔥' },
  { id: 8, user: 'accraboy', text: 'Ghana to the world! 🇬🇭' },
  { id: 9, user: 'freetownvibes', text: 'Sierra Leone we outside!! 🇸🇱' },
  { id: 10, user: 'conakry_kid', text: 'Guinea represent! 🇬🇳' },
];

// ============================================
// FLOATING REACTIONS COMPONENT
// ============================================
const FloatingReactions = ({ reactions }: { reactions: FloatingReaction[] }) => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden z-50">
    <AnimatePresence>
      {reactions.map((reaction) => (
        <motion.div
          key={reaction.id}
          className="absolute text-3xl"
          style={{ left: `${reaction.x}%`, bottom: '40%' }}
          initial={{ opacity: 1, y: 0, scale: 0.5 }}
          animate={{
            opacity: [1, 1, 0],
            y: -250,
            scale: [0.5, 1.3, 1],
            x: [0, reaction.xOffset1, reaction.xOffset2]
          }}
          exit={{ opacity: 0 }}
          transition={{ duration: 2.5, ease: 'easeOut' }}
        >
          <span className="drop-shadow-lg">{reaction.emoji}</span>
        </motion.div>
      ))}
    </AnimatePresence>
  </div>
);

// ============================================
// REACTION BUTTONS COMPONENT
// ============================================
const ReactionButtons = ({ onReaction }: { onReaction: (type: FloatingReaction['type'], emoji: string) => void }) => {
  const reactions = [
    { type: 'oye' as const, emoji: '⚡', label: 'OYÉ', color: 'from-yellow-500 to-orange-500' },
    { type: 'fire' as const, emoji: '🔥', label: 'FIRE', color: 'from-red-500 to-orange-500' },
    { type: 'love' as const, emoji: '❤️', label: 'LOVE', color: 'from-pink-500 to-red-500' },
    { type: 'zap' as const, emoji: '💥', label: 'MAD!', color: 'from-purple-500 to-blue-500' },
  ];

  return (
    <div className="flex justify-center gap-2">
      {reactions.map((r) => (
        <motion.button
          key={r.type}
          className={`px-3 py-1.5 rounded-full bg-gradient-to-r ${r.color} text-white font-bold text-xs flex items-center gap-1`}
          onClick={() => onReaction(r.type, r.emoji)}
          whileHover={{ scale: 1.1, y: -2 }}
          whileTap={{ scale: 0.9 }}
        >
          <span>{r.emoji}</span>
          <span>{r.label}</span>
        </motion.button>
      ))}
    </div>
  );
};

// ============================================
// LIVE COMMENTS SECTION
// ============================================
const LiveCommentsSection = ({
  comments,
  isExpanded,
  onToggle
}: {
  comments: LiveComment[];
  isExpanded: boolean;
  onToggle: () => void;
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current && isExpanded) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comments, isExpanded]);

  return (
    <motion.div
      className="bg-black/40 backdrop-blur-sm rounded-2xl overflow-hidden"
      animate={{ height: isExpanded ? 'auto' : 48 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header - Always visible */}
      <button
        className="w-full flex items-center justify-between px-4 py-3"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-purple-400" />
          <span className="text-white/80 text-xs font-bold">VOYO DJ LIVE</span>
          <span className="text-white/40 text-xs">• {comments.length} vibing</span>
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronUp className="w-4 h-4 text-white/50" />
        </motion.div>
      </button>

      {/* Comments - Expandable */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="px-4 pb-3"
          >
            <div ref={scrollRef} className="space-y-2 max-h-32 overflow-y-auto scrollbar-hide">
              {comments.map((comment) => (
                <motion.div
                  key={comment.id}
                  className="flex gap-2"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <span className="text-purple-400 text-xs font-bold">@{comment.user}</span>
                  <span className="text-white/80 text-xs">{comment.text}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ============================================
// MAIN NOW PLAYING COMPONENT
// ============================================
interface NowPlayingProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NowPlaying = ({ isOpen, onClose }: NowPlayingProps) => {
  const {
    currentTrack,
    isPlaying,
    progress,
    duration,
    nextTrack,
    prevTrack,
    seekTo,
    volume,
    setVolume
  } = usePlayerStore();
  const { handlePlayPause } = useMobilePlay();

  // Get like state from preference store (persisted)
  const { trackPreferences, setExplicitLike } = usePreferenceStore();
  const isLiked = currentTrack ? trackPreferences[currentTrack.trackId]?.explicitLike === true : false;

  const [isShuffled, setIsShuffled] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');

  // VOYO DJ State
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  const [visibleComments, setVisibleComments] = useState<LiveComment[]>([]);
  const [isCommentsExpanded, setIsCommentsExpanded] = useState(false);
  const commentIndexRef = useRef(0);

  // Format time in MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate current time from progress
  const currentTime = (progress / 100) * duration;

  // Auto-add comments when playing
  useEffect(() => {
    if (!isPlaying || !isOpen) return;

    const interval = setInterval(() => {
      if (commentIndexRef.current < LIVE_COMMENTS.length) {
        setVisibleComments(prev => [...prev, LIVE_COMMENTS[commentIndexRef.current]]);
        commentIndexRef.current++;
      } else {
        // Loop comments
        commentIndexRef.current = 0;
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [isPlaying, isOpen]);

  // Reset comments when track changes
  useEffect(() => {
    setVisibleComments([]);
    commentIndexRef.current = 0;
  }, [currentTrack?.id]);

  // Handle user reactions - useCallback to avoid stale closure in useEffect
  const handleReaction = useCallback((type: FloatingReaction['type'], emoji: string) => {
    const id = Date.now() + Math.random();
    const x = 10 + Math.random() * 80;
    const xOffset1 = (Math.random() - 0.5) * 50;
    const xOffset2 = (Math.random() - 0.5) * 80;

    setFloatingReactions(prev => [...prev, { id, type, emoji, x, xOffset1, xOffset2 }]);

    // Remove after animation
    setTimeout(() => {
      setFloatingReactions(prev => prev.filter(r => r.id !== id));
    }, 2500);
  }, []);

  // Auto-spawn reactions when playing (ambient vibe)
  useEffect(() => {
    if (!isPlaying || !isOpen) return;

    const interval = setInterval(() => {
      const emojis = ['🔥', '⚡', '❤️', '💥', '🎵', '💜'];
      const emoji = emojis[Math.floor(Math.random() * emojis.length)];
      const types: FloatingReaction['type'][] = ['fire', 'oye', 'love', 'zap'];
      const type = types[Math.floor(Math.random() * types.length)];

      handleReaction(type, emoji);
    }, 3000 + Math.random() * 3000);

    return () => clearInterval(interval);
  }, [isPlaying, isOpen, handleReaction]);

  if (!currentTrack) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 bg-gradient-to-b from-[#1a1a2e] to-[#0a0a0f] overflow-y-auto"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        >
          {/* Floating Reactions Layer */}
          <FloatingReactions reactions={floatingReactions} />

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-4">
            <motion.button
              className="p-2"
              onClick={onClose}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <ChevronDown className="w-6 h-6 text-white/70" />
            </motion.button>
            <div className="text-center">
              <p className="text-white/50 text-xs uppercase tracking-wider">Now Playing</p>
              <p className="text-white text-sm font-medium">Your Library</p>
            </div>
            <motion.button
              className="p-2"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <Share2 className="w-5 h-5 text-white/70" />
            </motion.button>
          </div>

          {/* Album Art */}
          <div className="flex items-center justify-center px-8 py-4">
            <motion.div
              className="relative w-full max-w-xs aspect-square rounded-2xl overflow-hidden shadow-2xl bg-gradient-to-br from-purple-900/30 to-pink-900/20"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1 }}
              key={currentTrack.id}
            >
              <img
                src={getTrackThumbnailUrl(currentTrack, 'high')}
                alt={currentTrack.title}
                className="w-full h-full object-cover"
                loading="eager"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.opacity = '0';
                }}
              />
              {/* Vinyl effect overlay */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent"
                animate={isPlaying ? { opacity: [0.05, 0.1, 0.05] } : { opacity: 0.05 }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </motion.div>
          </div>

          {/* Track Info */}
          <div className="px-8 py-2">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <motion.h2
                  className="text-xl font-bold text-white truncate"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={currentTrack.id}
                >
                  {currentTrack.title}
                </motion.h2>
                <motion.p
                  className="text-white/60 text-base truncate"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  key={`${currentTrack.id}-artist`}
                >
                  {currentTrack.artist}
                </motion.p>
              </div>
              <motion.button
                className="p-2"
                onClick={() => currentTrack && setExplicitLike(currentTrack.trackId, !isLiked)}
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.9 }}
              >
                <Heart
                  className={`w-6 h-6 transition-colors ${
                    isLiked ? 'text-pink-500 fill-pink-500' : 'text-white/50'
                  }`}
                />
              </motion.button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="px-8 py-2">
            <div
              className="relative h-1 bg-white/20 rounded-full cursor-pointer"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const percent = ((e.clientX - rect.left) / rect.width) * 100;
                const timeInSeconds = (percent / 100) * duration;
                seekTo(timeInSeconds);
              }}
            >
              <motion.div
                className="absolute left-0 top-0 h-full bg-white rounded-full"
                style={{ width: `${progress}%` }}
              />
              <motion.div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg"
                style={{ left: `${progress}%`, marginLeft: '-6px' }}
                whileHover={{ scale: 1.3 }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-white/40">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Main Controls */}
          <div className="flex items-center justify-center gap-6 px-8 py-4">
            <motion.button
              className={`p-2 ${isShuffled ? 'text-purple-400' : 'text-white/50'}`}
              onClick={() => setIsShuffled(!isShuffled)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <Shuffle className="w-5 h-5" />
            </motion.button>

            <motion.button
              className="p-3 text-white"
              onClick={prevTrack}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <SkipBack className="w-7 h-7" fill="white" />
            </motion.button>

            <motion.button
              className="w-14 h-14 rounded-full bg-white flex items-center justify-center"
              onClick={handlePlayPause}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {isPlaying ? (
                <Pause className="w-7 h-7 text-black" fill="black" />
              ) : (
                <Play className="w-7 h-7 text-black ml-1" fill="black" />
              )}
            </motion.button>

            <motion.button
              className="p-3 text-white"
              onClick={nextTrack}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <SkipForward className="w-7 h-7" fill="white" />
            </motion.button>

            <motion.button
              className={`p-2 ${repeatMode !== 'off' ? 'text-purple-400' : 'text-white/50'}`}
              onClick={() => {
                const modes: Array<'off' | 'all' | 'one'> = ['off', 'all', 'one'];
                const currentIndex = modes.indexOf(repeatMode);
                setRepeatMode(modes[(currentIndex + 1) % modes.length]);
              }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <Repeat className="w-5 h-5" />
              {repeatMode === 'one' && (
                <span className="absolute text-[8px] font-bold">1</span>
              )}
            </motion.button>
          </div>

          {/* VOYO DJ Reaction Buttons */}
          <div className="px-8 py-2">
            <ReactionButtons onReaction={handleReaction} />
          </div>

          {/* Bottom Controls */}
          <div className="flex items-center justify-between px-8 py-2">
            {/* Volume */}
            <div className="flex items-center gap-2 flex-1">
              <Volume2 className="w-5 h-5 text-white/50" />
              <div
                className="w-20 h-1 bg-white/20 rounded-full cursor-pointer"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const newVolume = ((e.clientX - rect.left) / rect.width) * 100;
                  setVolume(Math.max(0, Math.min(100, newVolume)));
                }}
              >
                <div
                  className="h-full bg-white/50 rounded-full"
                  style={{ width: `${volume}%` }}
                />
              </div>
            </div>

            {/* Queue */}
            <motion.button
              className="p-2 text-white/50"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <ListMusic className="w-6 h-6" />
            </motion.button>
          </div>

          {/* VOYO DJ Live Comments */}
          <div className="px-4 pb-6 pt-2">
            <LiveCommentsSection
              comments={visibleComments}
              isExpanded={isCommentsExpanded}
              onToggle={() => setIsCommentsExpanded(!isCommentsExpanded)}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default NowPlaying;
