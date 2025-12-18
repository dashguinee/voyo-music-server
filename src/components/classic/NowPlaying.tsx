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
  ListPlus,
  Repeat,
  Volume2,
  MessageCircle,
  ChevronUp,
  Send,
  User,
  BarChart2
} from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { usePreferenceStore } from '../../store/preferenceStore';
import { getTrackThumbnailUrl } from '../../utils/imageHelpers';
import { useMobilePlay } from '../../hooks/useMobilePlay';
import { PlaylistModal } from '../playlist/PlaylistModal';
import { useReactionStore, Reaction, ReactionCategory, TrackStats } from '../../store/reactionStore';
import { useUniverseStore } from '../../store/universeStore';

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
// CATEGORY CONFIG
// ============================================
const CATEGORY_CONFIG: Record<ReactionCategory, { emoji: string; color: string; name: string }> = {
  'afro-heat': { emoji: '🔥', color: '#FF6B35', name: 'Afro Heat' },
  'chill-vibes': { emoji: '🌙', color: '#A855F7', name: 'Chill Vibes' },
  'party-mode': { emoji: '🎉', color: '#EC4899', name: 'Party Mode' },
  'late-night': { emoji: '✨', color: '#6366F1', name: 'Late Night' },
  'workout': { emoji: '💪', color: '#10B981', name: 'Workout' },
};

// Fallback comments for when no real reactions exist yet
const FALLBACK_COMMENTS: LiveComment[] = [
  { id: 1, user: 'nathanp2001', text: 'This track is FIRE 🔥🔥🔥' },
  { id: 2, user: 'abdoulaziz', text: 'DJ I found youuuu OHhhhh!' },
  { id: 3, user: 'saralove', text: 'Great vibez 🔥💯 New afro 🎶' },
  { id: 4, user: 'dashfam', text: 'OYÉÉÉÉ!!! 🦉⚡' },
  { id: 5, user: 'afrovibes', text: 'Amapiano hits different 🌙' },
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
// VIBE BREAKDOWN COMPONENT
// ============================================
const VibeBreakdown = ({ stats }: { stats: TrackStats | null }) => {
  if (!stats || stats.total_reactions === 0) return null;

  const allCategories: { key: ReactionCategory; count: number }[] = [
    { key: 'afro-heat', count: stats.afro_heat_count },
    { key: 'chill-vibes', count: stats.chill_vibes_count },
    { key: 'party-mode', count: stats.party_mode_count },
    { key: 'late-night', count: stats.late_night_count },
    { key: 'workout', count: stats.workout_count },
  ];
  const categories = allCategories.filter(c => c.count > 0).sort((a, b) => b.count - a.count);

  const maxCount = Math.max(...categories.map(c => c.count));

  return (
    <div className="bg-black/30 rounded-xl p-3 mb-3">
      <div className="flex items-center gap-2 mb-2">
        <BarChart2 className="w-4 h-4 text-purple-400" />
        <span className="text-white/80 text-xs font-bold">VIBE BREAKDOWN</span>
        <span className="text-white/40 text-xs">• {stats.total_reactions} reactions</span>
      </div>
      <div className="space-y-1.5">
        {categories.map(({ key, count }) => {
          const config = CATEGORY_CONFIG[key];
          const percent = (count / maxCount) * 100;
          return (
            <div key={key} className="flex items-center gap-2">
              <span className="text-sm">{config.emoji}</span>
              <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: config.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${percent}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </div>
              <span className="text-white/60 text-[10px] w-8 text-right">{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================
// LIVE COMMENTS SECTION (Enhanced with real reactions)
// ============================================
const LiveCommentsSection = ({
  reactions,
  fallbackComments,
  isExpanded,
  onToggle,
  onAddComment,
  trackStats,
  onUserClick,
}: {
  reactions: Reaction[];
  fallbackComments: LiveComment[];
  isExpanded: boolean;
  onToggle: () => void;
  onAddComment: (text: string) => void;
  trackStats: TrackStats | null;
  onUserClick?: (username: string) => void;
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [commentText, setCommentText] = useState('');

  useEffect(() => {
    if (scrollRef.current && isExpanded) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [reactions, isExpanded]);

  const handleSubmit = () => {
    if (commentText.trim()) {
      onAddComment(commentText.trim());
      setCommentText('');
    }
  };

  // Use real reactions if available, otherwise fallback
  const hasRealReactions = reactions.length > 0;
  const displayCount = hasRealReactions ? reactions.length : fallbackComments.length;

  // Format time ago
  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  };

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
          <span className="text-white/80 text-xs font-bold">COMMUNITY VIBES</span>
          <span className="text-white/40 text-xs">• {displayCount} {hasRealReactions ? 'reactions' : 'vibing'}</span>
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronUp className="w-4 h-4 text-white/50" />
        </motion.div>
      </button>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="px-4 pb-4"
          >
            {/* Vibe Breakdown */}
            <VibeBreakdown stats={trackStats} />

            {/* Comments List */}
            <div ref={scrollRef} className="space-y-3 max-h-48 overflow-y-auto scrollbar-hide mb-3">
              {hasRealReactions ? (
                // Real reactions from community
                reactions.map((reaction) => {
                  const config = CATEGORY_CONFIG[reaction.category];
                  return (
                    <motion.div
                      key={reaction.id}
                      className="flex gap-3 items-start"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      {/* User Avatar */}
                      <button
                        className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0"
                        onClick={() => onUserClick?.(reaction.username)}
                      >
                        <User className="w-4 h-4 text-white" />
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <button
                            className="text-purple-400 text-xs font-bold hover:underline"
                            onClick={() => onUserClick?.(reaction.username)}
                          >
                            @{reaction.username}
                          </button>
                          <span className="text-white/30 text-[10px]">{timeAgo(reaction.created_at)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span
                            className="text-xs px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: `${config.color}20`, color: config.color }}
                          >
                            {reaction.emoji} {config.name}
                          </span>
                          {reaction.comment && (
                            <span className="text-white/80 text-xs truncate">{reaction.comment}</span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              ) : (
                // Fallback comments
                fallbackComments.map((comment) => (
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
                ))
              )}
            </div>

            {/* Add Comment Input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                placeholder="Add a vibe... (optional emoji 🔥)"
                className="flex-1 bg-white/10 rounded-full px-4 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
              <motion.button
                className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center"
                onClick={handleSubmit}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <Send className="w-4 h-4 text-white" />
              </motion.button>
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

  // Reaction system hooks
  const {
    createReaction,
    fetchTrackReactions,
    fetchTrackStats,
    trackReactions,
    trackStats: statsMap,
    subscribeToReactions,
    isSubscribed
  } = useReactionStore();
  const { currentUsername } = useUniverseStore();

  const [isShuffled, setIsShuffled] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);

  // VOYO DJ State
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  const [visibleComments, setVisibleComments] = useState<LiveComment[]>([]);
  const [isCommentsExpanded, setIsCommentsExpanded] = useState(false);
  const commentIndexRef = useRef(0);

  // Get real reactions for current track
  const currentTrackId = currentTrack?.id || '';
  const realReactions = trackReactions.get(currentTrackId) || [];
  const currentTrackStats = statsMap.get(currentTrackId) || null;

  // Fetch reactions when track changes or comments expand
  useEffect(() => {
    if (currentTrack && isOpen) {
      fetchTrackReactions(currentTrack.id);
      fetchTrackStats(currentTrack.id);
    }
  }, [currentTrack?.id, isOpen, fetchTrackReactions, fetchTrackStats]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!isSubscribed && isOpen) {
      subscribeToReactions();
    }
  }, [isOpen, isSubscribed, subscribeToReactions]);

  // Handle adding a comment with reaction
  const handleAddComment = useCallback(async (text: string) => {
    if (!currentTrack) return;

    // Detect category from track or default to afro-heat
    const defaultCategory: ReactionCategory = 'afro-heat';

    // Check if text has emoji to determine reaction type
    const hasEmoji = /\p{Emoji}/u.test(text);

    await createReaction({
      username: currentUsername || 'anonymous',
      trackId: currentTrack.id,
      trackTitle: currentTrack.title,
      trackArtist: currentTrack.artist,
      trackThumbnail: currentTrack.coverUrl,
      category: defaultCategory,
      emoji: hasEmoji ? '🔥' : '💬',
      reactionType: 'oye',
      comment: text,
    });

    // Trigger floating reaction
    handleReaction('fire', '🔥');
  }, [currentTrack, currentUsername, createReaction]);

  // Handle clicking on a username to view their portal
  const handleUserClick = useCallback((username: string) => {
    // Navigate to user's portal
    window.open(`/u/${username}`, '_blank');
  }, []);

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
      if (commentIndexRef.current < FALLBACK_COMMENTS.length) {
        setVisibleComments(prev => [...prev, FALLBACK_COMMENTS[commentIndexRef.current]]);
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
              {/* Heart button: tap to like, hold to add to playlist */}
              <motion.button
                className="p-2 relative"
                onClick={() => currentTrack && setExplicitLike(currentTrack.trackId, !isLiked)}
                onPointerDown={() => {
                  // Start long press timer (500ms)
                  const timer = setTimeout(() => {
                    setShowPlaylistModal(true);
                  }, 500);
                  (window as any).__heartLongPressTimer = timer;
                }}
                onPointerUp={() => {
                  // Clear timer on release
                  clearTimeout((window as any).__heartLongPressTimer);
                }}
                onPointerLeave={() => {
                  // Clear timer if pointer leaves
                  clearTimeout((window as any).__heartLongPressTimer);
                }}
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.9 }}
              >
                <Heart
                  className={`w-6 h-6 transition-colors ${
                    isLiked ? 'text-pink-500 fill-pink-500' : 'text-white/50'
                  }`}
                />
                {/* Long press hint ring */}
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-purple-500/0"
                  whileTap={{
                    borderColor: 'rgba(168, 85, 247, 0.5)',
                    scale: 1.3,
                    transition: { duration: 0.5 }
                  }}
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

          {/* VOYO DJ Reaction Buttons - Creates real reactions */}
          <div className="px-8 py-2">
            <ReactionButtons onReaction={(type, emoji) => {
              // Visual floating effect
              handleReaction(type, emoji);

              // Save to store (community reaction)
              if (currentTrack) {
                const categoryMap: Record<string, ReactionCategory> = {
                  'oye': 'afro-heat',
                  'fire': 'afro-heat',
                  'love': 'chill-vibes',
                  'zap': 'party-mode',
                };
                createReaction({
                  username: currentUsername || 'anonymous',
                  trackId: currentTrack.id,
                  trackTitle: currentTrack.title,
                  trackArtist: currentTrack.artist,
                  trackThumbnail: currentTrack.coverUrl,
                  category: categoryMap[type] || 'afro-heat',
                  emoji,
                  reactionType: type === 'zap' ? 'hype' : type === 'love' ? 'love' : 'oye',
                });
              }
            }} />
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

          {/* VOYO DJ Live Comments - Real community reactions */}
          <div className="px-4 pb-6 pt-2">
            <LiveCommentsSection
              reactions={realReactions}
              fallbackComments={visibleComments.length > 0 ? visibleComments : FALLBACK_COMMENTS}
              isExpanded={isCommentsExpanded}
              onToggle={() => setIsCommentsExpanded(!isCommentsExpanded)}
              onAddComment={handleAddComment}
              trackStats={currentTrackStats}
              onUserClick={handleUserClick}
            />
          </div>

          {/* Playlist Modal */}
          <PlaylistModal
            isOpen={showPlaylistModal}
            onClose={() => setShowPlaylistModal(false)}
            trackId={currentTrack.trackId}
            trackTitle={currentTrack.title}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default NowPlaying;
