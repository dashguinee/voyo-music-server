/**
 * VOYO Vertical Feed - Music Discovery Feed
 *
 * YouTube Shorts / Stripchat style full-portrait feed
 *
 * 3 Content Types (Same Layout):
 * 1. Thumbnail + scrolling comments/punches
 * 2. Music video snippet (15-30s) + scrolling comments
 * 3. Hottest part snippet (section with most reactions)
 *
 * Layout:
 * - Full portrait screen
 * - Background: Thumbnail OR video snippet
 * - Translucent auto-scrolling comments/punches overlay
 * - Right side: Like + count, OYE, FIRE, Comments, Share
 * - Tap to show/hide full comments section
 */

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Heart, MessageCircle, Share2, Music2, Zap, Play, Pause,
  ChevronDown, User, MapPin, Flame, Plus, X, Volume2, VolumeX,
  Bookmark, UserPlus, UserMinus, FastForward
} from 'lucide-react';
import { useReactionStore, Reaction, ReactionCategory, ReactionType, TrackHotspot } from '../../../store/reactionStore';
import { usePlayerStore } from '../../../store/playerStore';
import { useUniverseStore } from '../../../store/universeStore';
import { useTrackPoolStore } from '../../../store/trackPoolStore';
import { followsAPI } from '../../../lib/supabase';
import { TRACKS } from '../../../data/tracks';
import { AudioVisualizer, WaveformVisualizer } from './AudioVisualizer';

// Snippet config
const SNIPPET_DURATION = 25; // Seconds per snippet before auto-advance
const DEFAULT_SEEK_PERCENT = 25; // Where to start if no hotspots

// ============================================
// FEED MODE TYPE
// ============================================
type FeedMode = 'forYou' | 'following';

// ============================================
// PROGRESS BAR COMPONENT WITH HEATMAP
// ============================================
const ProgressBar = ({ isActive, trackId, onSeekToHotspot }: {
  isActive: boolean;
  trackId: string;
  onSeekToHotspot?: (position: number) => void;
}) => {
  const progress = usePlayerStore((state) => state.progress);
  const currentTime = usePlayerStore((state) => state.currentTime);
  const duration = usePlayerStore((state) => state.duration);
  const getHotspots = useReactionStore((state) => state.getHotspots);

  const hotspots = useMemo(() => getHotspots(trackId), [getHotspots, trackId]);

  // Find the hottest spot (highest intensity)
  const hottestSpot = useMemo(() => {
    if (hotspots.length === 0) return null;
    return hotspots.reduce((a, b) => a.intensity > b.intensity ? a : b);
  }, [hotspots]);

  if (!isActive) return null;

  // Get color for hotspot based on dominant reaction type
  const getHotspotColor = (type: string, intensity: number) => {
    const alpha = Math.max(0.3, intensity);
    switch (type) {
      case 'fire': return `rgba(249, 115, 22, ${alpha})`; // Orange
      case 'like': return `rgba(236, 72, 153, ${alpha})`; // Pink
      case 'oye':
      default: return `rgba(251, 191, 36, ${alpha})`; // Yellow
    }
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 z-30">
      {/* Progress bar with heatmap */}
      <div className="relative h-1.5 bg-white/20">
        {/* Hotspot markers */}
        {hotspots.map((hotspot, i) => (
          <div
            key={i}
            className="absolute top-0 bottom-0 rounded-full"
            style={{
              left: `${hotspot.position - 3}%`,
              width: '6%',
              background: getHotspotColor(hotspot.dominantType, hotspot.intensity),
              filter: hotspot.intensity > 0.7 ? 'blur(1px)' : 'none',
            }}
          />
        ))}
        {/* Progress overlay */}
        <motion.div
          className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-purple-500 to-pink-500"
          style={{ width: `${progress}%` }}
          transition={{ duration: 0.1 }}
        />
        {/* Hotspot glow indicators */}
        {hotspots.filter(h => h.intensity > 0.5).map((hotspot, i) => (
          <motion.div
            key={`glow-${i}`}
            className="absolute -top-1 w-2 h-2 rounded-full"
            style={{
              left: `${hotspot.position}%`,
              background: getHotspotColor(hotspot.dominantType, 1),
              boxShadow: `0 0 6px ${getHotspotColor(hotspot.dominantType, 1)}`,
            }}
            animate={{ scale: [1, 1.2, 1], opacity: [0.8, 1, 0.8] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        ))}
      </div>
      {/* Time display */}
      <div className="absolute bottom-2 left-4 text-white/60 text-[10px] font-mono">
        {Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, '0')}
        {' / '}
        {Math.floor(duration / 60)}:{Math.floor(duration % 60).toString().padStart(2, '0')}
      </div>
      {/* Hotspot count indicator + Skip to hot button */}
      {hotspots.length > 0 && (
        <div className="absolute bottom-2 right-4 flex items-center gap-2">
          {hottestSpot && onSeekToHotspot && (
            <motion.button
              className="flex items-center gap-1 px-2 py-1 rounded-full bg-orange-500/80 text-white text-[10px] font-bold"
              onClick={() => onSeekToHotspot(hottestSpot.position)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <FastForward className="w-3 h-3" />
              <span>🔥 HOT</span>
            </motion.button>
          )}
          <div className="flex items-center gap-1 text-white/60 text-[10px]">
            <Flame className="w-3 h-3 text-orange-400" />
            <span>{hotspots.length} hot {hotspots.length === 1 ? 'spot' : 'spots'}</span>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// REACTION CONFIG
// ============================================
const REACTION_CONFIG = {
  like: { icon: Heart, color: '#EC4899', activeColor: '#EC4899', label: 'Like' },
  oye: { icon: Zap, color: '#FBBF24', activeColor: '#FBBF24', label: 'OYÉ' },
  fire: { icon: Flame, color: '#F97316', activeColor: '#F97316', label: 'Fire' },
};

// ============================================
// AUTO-SCROLLING COMMENTS OVERLAY
// ============================================
interface ScrollingComment {
  id: string;
  text: string;
  username: string;
  isPunch: boolean; // Has 📍 distinction
  timestamp: number;
}

const ScrollingCommentsOverlay = ({
  comments,
  isVisible,
}: {
  comments: ScrollingComment[];
  isVisible: boolean;
}) => {
  const [displayedComments, setDisplayedComments] = useState<ScrollingComment[]>([]);
  const indexRef = useRef(0);

  // Add comments one by one with delay
  useEffect(() => {
    if (!isVisible || comments.length === 0) return;

    const interval = setInterval(() => {
      if (indexRef.current < comments.length) {
        setDisplayedComments(prev => [...prev.slice(-8), comments[indexRef.current]]);
        indexRef.current++;
      } else {
        indexRef.current = 0; // Loop
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [comments, isVisible]);

  // Reset when visibility changes
  useEffect(() => {
    if (!isVisible) {
      setDisplayedComments([]);
      indexRef.current = 0;
    }
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className="absolute bottom-32 left-0 right-20 px-4 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {displayedComments.map((comment) => (
          <motion.div
            key={comment.id}
            initial={{ opacity: 0, x: -20, y: 10 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className={`mb-2 px-3 py-2 rounded-2xl backdrop-blur-md max-w-[85%] ${
              comment.isPunch
                ? 'bg-pink-500/30 border-l-2 border-pink-500'
                : 'bg-black/40'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className={`text-[10px] font-bold ${comment.isPunch ? 'text-pink-400' : 'text-purple-400'}`}>
                @{comment.username}
              </span>
              {comment.isPunch && (
                <span className="text-[8px] px-1 rounded bg-pink-500/40 text-pink-200">📍</span>
              )}
            </div>
            <p className="text-white/90 text-sm">{comment.text}</p>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

// ============================================
// FULL COMMENTS SHEET
// ============================================
const CommentsSheet = ({
  isOpen,
  onClose,
  reactions,
  trackTitle,
  onAddComment,
}: {
  isOpen: boolean;
  onClose: () => void;
  reactions: Reaction[];
  trackTitle: string;
  onAddComment: (text: string) => void;
}) => {
  const [commentText, setCommentText] = useState('');

  const handleSubmit = () => {
    if (commentText.trim()) {
      onAddComment(commentText.trim());
      setCommentText('');
    }
  };

  const commentsWithText = reactions.filter(r => r.comment);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="absolute inset-0 z-50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60" onClick={onClose} />

          {/* Sheet */}
          <motion.div
            className="absolute bottom-0 left-0 right-0 bg-[#0f0f16] rounded-t-3xl max-h-[70vh] flex flex-col"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <div>
                <h3 className="text-white font-bold">Comments</h3>
                <p className="text-white/50 text-xs truncate max-w-[200px]">{trackTitle}</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full bg-white/10"
              >
                <X className="w-5 h-5 text-white/70" />
              </button>
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {commentsWithText.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-white/40">
                  <MessageCircle className="w-10 h-10 mb-2" />
                  <p className="text-sm">No comments yet</p>
                  <p className="text-xs">Be the first to comment!</p>
                </div>
              ) : (
                commentsWithText.map((reaction) => {
                  const isPunch = reaction.emoji === '📍';
                  return (
                    <div
                      key={reaction.id}
                      className={`flex gap-3 ${isPunch ? 'bg-pink-500/10 -mx-2 px-2 py-2 rounded-lg border-l-2 border-pink-500' : ''}`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isPunch
                          ? 'bg-gradient-to-br from-pink-500 to-rose-500'
                          : 'bg-gradient-to-br from-purple-500 to-pink-500'
                      }`}>
                        <User className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold ${isPunch ? 'text-pink-400' : 'text-purple-400'}`}>
                            @{reaction.username}
                          </span>
                          {isPunch && (
                            <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-pink-500/30 text-pink-300 font-bold">
                              📍 PUNCH
                            </span>
                          )}
                        </div>
                        <p className="text-white/80 text-sm mt-0.5">{reaction.comment}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Comment Input */}
            <div className="p-4 border-t border-white/10 flex gap-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                placeholder="Add a comment..."
                className="flex-1 bg-white/10 rounded-full px-4 py-2.5 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
              <motion.button
                onClick={handleSubmit}
                className="px-4 py-2.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-bold"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Post
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ============================================
// FEED CARD - Full Portrait YouTube Shorts Style
// ============================================
interface FeedCardProps {
  trackId: string;
  trackTitle: string;
  trackArtist: string;
  trackThumbnail?: string;
  reactions: Reaction[];
  nativeOyeScore?: number; // Track's base OYE score from library
  hottestPosition?: number; // 0-100 percentage of hottest part
  isActive: boolean;
  isPlaying: boolean;
  isThisTrack: boolean; // Is this card's track the current track?
  isFollowingArtist?: boolean; // Is current user following this artist?
  onPlay: () => void;
  onTogglePlay: () => void;
  onReact: (type: ReactionType) => void;
  onAddComment: (text: string) => void;
  onAddToLibrary?: () => void; // OYÉ = add to library + boost
  onAddToPlaylist?: () => void; // + button
  onGoToPlayer?: () => void; // Navigate to full music player
  onShare?: () => void; // Share track
  onSeekToHotspot?: (position: number) => void; // Seek to hot part
  onFollowArtist?: () => void; // Follow/unfollow artist
  onSnippetEnd?: () => void; // Called when snippet duration ends (for auto-advance)
}

const FeedCard = ({
  trackId,
  trackTitle,
  trackArtist,
  trackThumbnail,
  reactions,
  nativeOyeScore = 0,
  hottestPosition,
  isActive,
  isPlaying,
  isThisTrack,
  isFollowingArtist = false,
  onPlay,
  onTogglePlay,
  onReact,
  onAddComment,
  onAddToLibrary,
  onAddToPlaylist,
  onGoToPlayer,
  onShare,
  onSeekToHotspot,
  onFollowArtist,
  onSnippetEnd,
}: FeedCardProps) => {
  const [showComments, setShowComments] = useState(false);
  const [userReactions, setUserReactions] = useState<Set<ReactionType>>(new Set());
  const [snippetStarted, setSnippetStarted] = useState(false);
  const snippetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-play snippet when card becomes active
  useEffect(() => {
    if (isActive && !isThisTrack) {
      // This card is now active but not playing - start snippet
      onPlay();

      // Seek to hottest part (or default position) after a brief delay for load
      setTimeout(() => {
        const seekPosition = hottestPosition ?? DEFAULT_SEEK_PERCENT;
        onSeekToHotspot?.(seekPosition);
        setSnippetStarted(true);
      }, 300);
    }

    // Reset snippet state when card becomes inactive
    if (!isActive) {
      setSnippetStarted(false);
      if (snippetTimerRef.current) {
        clearTimeout(snippetTimerRef.current);
        snippetTimerRef.current = null;
      }
    }
  }, [isActive, isThisTrack, onPlay, onSeekToHotspot, hottestPosition]);

  // Auto-advance timer - trigger after SNIPPET_DURATION seconds
  useEffect(() => {
    if (isActive && isPlaying && isThisTrack && snippetStarted && onSnippetEnd) {
      snippetTimerRef.current = setTimeout(() => {
        console.log(`[Feed] Snippet ended for ${trackTitle}, auto-advancing...`);
        onSnippetEnd();
      }, SNIPPET_DURATION * 1000);

      return () => {
        if (snippetTimerRef.current) {
          clearTimeout(snippetTimerRef.current);
        }
      };
    }
  }, [isActive, isPlaying, isThisTrack, snippetStarted, onSnippetEnd, trackTitle]);

  // Count reactions
  const reactionCounts = useMemo(() => {
    const counts = { like: 0, oye: 0, fire: 0, comments: 0, punches: 0 };
    reactions.forEach(r => {
      if (r.reaction_type === 'like') counts.like++;
      else if (r.reaction_type === 'oye') counts.oye++;
      else if (r.reaction_type === 'fire') counts.fire++;
      if (r.comment) {
        counts.comments++;
        if (r.emoji === '📍') counts.punches++;
      }
    });
    return counts;
  }, [reactions]);

  // Convert reactions to scrolling comments
  const scrollingComments = useMemo((): ScrollingComment[] => {
    return reactions
      .filter(r => r.comment)
      .map(r => ({
        id: r.id,
        text: r.comment || '',
        username: r.username,
        isPunch: r.emoji === '📍',
        timestamp: new Date(r.created_at).getTime(),
      }))
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [reactions]);

  // Handle reaction tap
  const handleReaction = (type: ReactionType) => {
    const newReactions = new Set(userReactions);
    if (newReactions.has(type)) {
      newReactions.delete(type);
    } else {
      newReactions.add(type);
      onReact(type);
    }
    setUserReactions(newReactions);
  };

  // Format count
  const formatCount = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <div className="relative w-full h-full bg-black">
      {/* Background - Thumbnail with gradient + Visualizer */}
      <div className="absolute inset-0">
        {trackThumbnail ? (
          <motion.img
            src={trackThumbnail}
            alt={trackTitle}
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0'; }}
            animate={{
              scale: isPlaying && isThisTrack ? [1, 1.02, 1] : 1,
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-purple-900/50 to-pink-900/30 flex items-center justify-center">
            <Music2 className="w-24 h-24 text-white/20" />
          </div>
        )}
        {/* Gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-black/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/30" />

        {/* Audio Visualizer - shows when playing */}
        <AudioVisualizer
          isPlaying={isPlaying && isThisTrack}
          intensity={0.8}
          barCount={24}
          position="bottom"
          color="rgba(168, 85, 247, 0.7)"
        />

        {/* Waveform effect overlay */}
        <WaveformVisualizer
          isPlaying={isPlaying && isThisTrack}
          color="rgba(236, 72, 153, 0.5)"
        />

        {/* Playing indicator pulse */}
        {isPlaying && isThisTrack && (
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(168,85,247,0.3) 0%, transparent 70%)',
            }}
            animate={{
              scale: [1, 1.5, 1],
              opacity: [0.5, 0.2, 0.5],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        )}
      </div>

      {/* Tap to play/pause - invisible overlay */}
      <button
        className="absolute inset-0 z-10"
        onClick={isThisTrack ? onTogglePlay : onPlay}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      />

      {/* Progress Bar with Heatmap + Hot Part Seek */}
      <ProgressBar
        isActive={isActive && isThisTrack}
        trackId={trackId}
        onSeekToHotspot={onSeekToHotspot}
      />

      {/* Scrolling Comments Overlay */}
      <ScrollingCommentsOverlay
        comments={scrollingComments}
        isVisible={isActive && !showComments}
      />

      {/* Track Info - Bottom Left (Clean) */}
      <div className="absolute bottom-28 left-4 right-24 z-20">
        {/* OYÉ Badge - Only show if significant */}
        {(() => {
          const totalOye = nativeOyeScore + reactionCounts.oye;
          if (totalOye < 100) return null;
          return (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 mb-3 rounded-sm bg-orange-500/90">
              <Zap className="w-3 h-3 text-white" style={{ fill: 'white' }} />
              <span className="text-white text-[10px] font-bold tracking-wide">{formatCount(totalOye)} OYÉ</span>
            </div>
          );
        })()}

        {/* Artist Handle + Follow Button */}
        <div className="flex items-center gap-2 mb-1">
          <p className="text-white/80 text-sm font-medium">@{trackArtist.toLowerCase().replace(/\s+/g, '_')}</p>
          {onFollowArtist && (
            <motion.button
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors ${
                isFollowingArtist
                  ? 'bg-white/20 text-white/70'
                  : 'bg-pink-500/90 text-white'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                onFollowArtist();
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {isFollowingArtist ? (
                <>
                  <UserMinus className="w-3 h-3" />
                  <span>Following</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-3 h-3" />
                  <span>Follow</span>
                </>
              )}
            </motion.button>
          )}
        </div>

        {/* Track Title */}
        <h3 className="text-white text-base font-semibold mb-2 line-clamp-2 leading-tight">
          {trackTitle}
        </h3>

        {/* Song Info */}
        <div className="flex items-center gap-2 text-white/60">
          <Music2 className="w-3.5 h-3.5" />
          <span className="text-xs truncate">{trackArtist}</span>
        </div>
      </div>

      {/* Right Side Actions - Clean & Functional */}
      <div className="absolute right-4 bottom-32 z-20 flex flex-col items-center gap-5">
        {/* OYÉ Button - Main Action (I vibe with this → adds to library + boosts) */}
        <button
          className="flex flex-col items-center"
          onClick={() => {
            handleReaction('oye');
            // OYÉ = I vibe with this = Add to library + Boost
            onAddToLibrary?.();
          }}
        >
          <div
            className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
              userReactions.has('oye')
                ? 'bg-gradient-to-br from-yellow-400 to-orange-500 scale-110'
                : 'bg-gradient-to-br from-orange-500 to-orange-600'
            }`}
          >
            <Zap className="w-7 h-7 text-white" style={{ fill: 'white' }} />
          </div>
          <span className="text-orange-400 text-[11px] font-bold mt-1.5">OYÉ</span>
        </button>

        {/* Comments */}
        <button
          className="flex flex-col items-center"
          onClick={() => setShowComments(true)}
        >
          <MessageCircle className="w-8 h-8 text-white" />
          <span className="text-white text-[11px] font-medium mt-1">{reactionCounts.comments || ''}</span>
        </button>

        {/* Add to Playlist */}
        <button
          className="flex flex-col items-center"
          onClick={() => onAddToPlaylist?.()}
        >
          <Plus className="w-8 h-8 text-white" />
        </button>

        {/* Share */}
        <button
          className="flex flex-col items-center active:scale-90 transition-transform"
          onClick={onShare}
        >
          <Share2 className="w-8 h-8 text-white" />
        </button>
      </div>

      {/* Comments Sheet */}
      <CommentsSheet
        isOpen={showComments}
        onClose={() => setShowComments(false)}
        reactions={reactions}
        trackTitle={trackTitle}
        onAddComment={onAddComment}
      />
    </div>
  );
};

// ============================================
// MAIN FEED COMPONENT
// ============================================
interface VoyoVerticalFeedProps {
  isActive: boolean;
  onGoToPlayer?: () => void; // Navigate to Music player tab
}

export const VoyoVerticalFeed = ({ isActive, onGoToPlayer }: VoyoVerticalFeedProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [feedMode, setFeedMode] = useState<FeedMode>('forYou');
  const [followingList, setFollowingList] = useState<Set<string>>(new Set());
  const [isLoadingFollows, setIsLoadingFollows] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { recentReactions, fetchRecentReactions, subscribeToReactions, isSubscribed, createReaction, computeHotspots, getCategoryScore, getTopCategories, getHotspots } = useReactionStore();
  const { setCurrentTrack, addToQueue, currentTrack, isPlaying, togglePlay, progress, duration, seekTo, volume, setVolume } = usePlayerStore();
  const { currentUsername } = useUniverseStore();
  const { hotPool, recordReaction } = useTrackPoolStore();

  // Fetch reactions on mount
  useEffect(() => {
    if (isActive) {
      fetchRecentReactions(100);
      if (!isSubscribed) {
        subscribeToReactions();
      }
    }
  }, [isActive, fetchRecentReactions, subscribeToReactions, isSubscribed]);

  // Fetch following list on mount
  useEffect(() => {
    const loadFollowing = async () => {
      if (!currentUsername) return;
      setIsLoadingFollows(true);
      try {
        const following = await followsAPI.getFollowing(currentUsername);
        setFollowingList(new Set(following.map(u => u.toLowerCase())));
      } catch (e) {
        console.error('[Feed] Failed to load following:', e);
      }
      setIsLoadingFollows(false);
    };
    loadFollowing();
  }, [currentUsername]);

  // Handle follow/unfollow artist
  const handleFollowArtist = useCallback(async (artistUsername: string) => {
    if (!currentUsername) return;
    const normalizedArtist = artistUsername.toLowerCase().replace(/\s+/g, '_');
    const isFollowing = followingList.has(normalizedArtist);

    // Optimistic update
    const newFollowing = new Set(followingList);
    if (isFollowing) {
      newFollowing.delete(normalizedArtist);
    } else {
      newFollowing.add(normalizedArtist);
    }
    setFollowingList(newFollowing);

    // Persist to Supabase
    try {
      if (isFollowing) {
        await followsAPI.unfollow(currentUsername, normalizedArtist);
      } else {
        await followsAPI.follow(currentUsername, normalizedArtist);
      }
    } catch (e) {
      // Revert on error
      setFollowingList(followingList);
      console.error('[Feed] Follow action failed:', e);
    }
  }, [currentUsername, followingList]);

  // Handle seek to hotspot
  const handleSeekToHotspot = useCallback((position: number) => {
    // position is 0-100 percentage
    const targetTime = (position / 100) * duration;
    seekTo(targetTime);
    console.log(`[Feed] Seeking to hotspot at ${position}% (${targetTime}s)`);
  }, [duration, seekTo]);

  // Build feed from ALL tracks, boosted by reactions + For You algorithm
  const trackGroups = useMemo(() => {
    // Start with reaction data indexed by track
    const reactionsByTrack = new Map<string, {
      reactions: Reaction[];
      hotScore: number;
      categoryBoost: number;
      dominantCategory: string;
    }>();

    recentReactions.forEach(reaction => {
      const existing = reactionsByTrack.get(reaction.track_id);
      if (existing) {
        existing.reactions.push(reaction);
        existing.hotScore = existing.reactions.length;
        const categoryScore = getCategoryScore(reaction.category);
        if (categoryScore > existing.categoryBoost) {
          existing.categoryBoost = categoryScore;
          existing.dominantCategory = reaction.category;
        }
      } else {
        reactionsByTrack.set(reaction.track_id, {
          reactions: [reaction],
          hotScore: 1,
          categoryBoost: getCategoryScore(reaction.category),
          dominantCategory: reaction.category,
        });
      }
    });

    // Build feed from POOL (dynamic) + TRACKS (seed fallback)
    // Pool contains tracks user has searched/played, TRACKS is fallback for new users
    const poolTracks = hotPool.length > 0 ? hotPool : [];
    const seedTracks = TRACKS;

    // Merge: pool tracks first (sorted by poolScore), then seed tracks not in pool
    const poolIds = new Set(poolTracks.map(t => t.id || t.trackId));
    const allTracks = [
      ...poolTracks.sort((a, b) => (b.poolScore || 0) - (a.poolScore || 0)),
      ...seedTracks.filter(t => !poolIds.has(t.id) && !poolIds.has(t.trackId))
    ];

    const feedItems = allTracks.map(track => {
      const trackId = track.id || track.trackId || '';
      const reactionData = reactionsByTrack.get(trackId);
      const poolScore = 'poolScore' in track ? (track as any).poolScore : 0;

      // Get hottest position for this track
      const hotspots = getHotspots(trackId);
      const hottestSpot = hotspots.length > 0
        ? hotspots.reduce((a, b) => a.intensity > b.intensity ? a : b)
        : null;

      return {
        trackId,
        trackTitle: track.title,
        trackArtist: track.artist,
        trackThumbnail: track.coverUrl || `https://voyo-music-api.fly.dev/cdn/art/${trackId}?quality=high`,
        reactions: reactionData?.reactions || [],
        nativeOyeScore: track.oyeScore || 0,
        hotScore: reactionData?.hotScore || 0,
        categoryBoost: reactionData?.categoryBoost || 50,
        dominantCategory: reactionData?.dominantCategory || 'afro-heat',
        poolScore, // Include pool score for sorting
        hottestPosition: hottestSpot?.position, // Position of hottest part (0-100)
      };
    });

    // Filter by feed mode
    const filteredItems = feedMode === 'following'
      ? feedItems.filter(item => {
          // Check if artist is in following list
          const artistHandle = item.trackArtist.toLowerCase().replace(/\s+/g, '_');
          return followingList.has(artistHandle);
        })
      : feedItems;

    // Sort by FOR YOU score: pool score + reactions + category preference
    return filteredItems.sort((a, b) => {
      // Primary: Pool score (user behavior learned from search/play)
      const aPoolBoost = (a.poolScore || 0) / 10; // 0-10 from pool
      const bPoolBoost = (b.poolScore || 0) / 10;

      // Secondary: Has reactions vs doesn't
      const aHasReactions = a.hotScore > 0 ? 5 : 0;
      const bHasReactions = b.hotScore > 0 ? 5 : 0;

      // Tertiary: Category preference + hotness
      const aReactionScore = (a.categoryBoost / 100) * a.hotScore + a.hotScore;
      const bReactionScore = (b.categoryBoost / 100) * b.hotScore + b.hotScore;

      // Combined score
      const aScore = aPoolBoost + aHasReactions + aReactionScore;
      const bScore = bPoolBoost + bHasReactions + bReactionScore;

      if (bScore !== aScore) return bScore - aScore;

      // Quaternary: Random shuffle for equal scores (variety)
      return Math.random() - 0.5;
    });
  }, [recentReactions, getCategoryScore, hotPool, feedMode, followingList, getHotspots]);

  // Auto-advance to next card (called when snippet ends)
  const handleSnippetEnd = useCallback(() => {
    if (!containerRef.current) return;

    const nextIndex = currentIndex + 1;
    if (nextIndex < trackGroups.length) {
      // Scroll to next card
      const itemHeight = containerRef.current.clientHeight;
      containerRef.current.scrollTo({
        top: nextIndex * itemHeight,
        behavior: 'smooth',
      });
      setCurrentIndex(nextIndex);
      console.log(`[Feed] Auto-advancing to card ${nextIndex + 1}/${trackGroups.length}`);
    } else {
      // At end of feed - could loop or stop
      console.log('[Feed] Reached end of feed');
    }
  }, [currentIndex, trackGroups.length]);

  // Handle scroll snap
  const handleScroll = () => {
    if (!containerRef.current) return;
    const scrollTop = containerRef.current.scrollTop;
    const itemHeight = containerRef.current.clientHeight;
    const newIndex = Math.round(scrollTop / itemHeight);
    if (newIndex !== currentIndex && newIndex >= 0 && newIndex < trackGroups.length) {
      setCurrentIndex(newIndex);
    }
  };

  // Handle play - check pool first, then seed tracks
  const handlePlay = useCallback((trackId: string, trackTitle: string, trackArtist: string) => {
    // Check pool first (dynamic tracks from search/play)
    const poolTrack = hotPool.find(t => t.id === trackId || t.trackId === trackId);
    if (poolTrack) {
      setCurrentTrack(poolTrack);
      return;
    }

    // Check seed tracks
    const seedTrack = TRACKS.find(t => t.id === trackId || t.trackId === trackId);
    if (seedTrack) {
      setCurrentTrack(seedTrack);
      return;
    }

    // Fallback: create minimal track object
    setCurrentTrack({
      id: trackId,
      trackId: trackId,
      title: trackTitle,
      artist: trackArtist,
      coverUrl: `https://voyo-music-api.fly.dev/cdn/art/${trackId}?quality=high`,
      duration: 0,
      tags: [],
      oyeScore: 0,
      createdAt: new Date().toISOString(),
    });
  }, [setCurrentTrack, hotPool]);

  // Handle reaction - with track position for hotspot detection
  const handleReact = useCallback((trackId: string, trackTitle: string, trackArtist: string, type: ReactionType) => {
    // Get current playback position for hotspot tracking
    const trackPosition = currentTrack?.id === trackId || currentTrack?.trackId === trackId
      ? Math.round(progress) // 0-100 percentage
      : undefined;

    createReaction({
      username: currentUsername || 'anonymous',
      trackId,
      trackTitle,
      trackArtist,
      trackThumbnail: `https://voyo-music-api.fly.dev/cdn/art/${trackId}?quality=high`,
      category: 'afro-heat', // Default category
      reactionType: type,
      trackPosition, // Where in the song the reaction happened
    });

    console.log(`[Feed] Reaction ${type} at position ${trackPosition}% on ${trackTitle}`);
  }, [createReaction, currentTrack, progress, currentUsername]);

  // Handle add comment - with track position
  const handleAddComment = useCallback((trackId: string, trackTitle: string, trackArtist: string, text: string) => {
    const trackPosition = currentTrack?.id === trackId || currentTrack?.trackId === trackId
      ? Math.round(progress)
      : undefined;

    createReaction({
      username: currentUsername || 'anonymous',
      trackId,
      trackTitle,
      trackArtist,
      trackThumbnail: `https://voyo-music-api.fly.dev/cdn/art/${trackId}?quality=high`,
      category: 'afro-heat',
      emoji: text.length <= 30 ? '📍' : '💬', // Punch if short
      comment: text,
      trackPosition,
    });
  }, [createReaction, currentTrack, progress, currentUsername]);

  // Handle share - use Web Share API if available
  const handleShare = useCallback((trackId: string, trackTitle: string, trackArtist: string) => {
    const shareData = {
      title: trackTitle,
      text: `🎵 ${trackTitle} by ${trackArtist} on VOYO Music`,
      url: `https://voyomusic.com/?track=${trackId}`,
    };

    if (navigator.share) {
      navigator.share(shareData).catch(() => {
        // Fallback: copy to clipboard
        navigator.clipboard.writeText(shareData.url);
      });
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(shareData.url);
    }
  }, []);

  if (!isActive) return null;

  // Empty state - different for Following vs For You
  if (trackGroups.length === 0) {
    const isFollowingEmpty = feedMode === 'following';
    return (
      <motion.div
        className="absolute inset-0 bg-black flex flex-col items-center justify-center px-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {/* Tab buttons still visible */}
        <div className="absolute top-4 left-0 right-0 z-30">
          <div className="flex items-center justify-center gap-6">
            <button
              className={`text-base font-semibold transition-all ${
                feedMode === 'following' ? 'text-white font-bold border-b-2 border-white pb-0.5' : 'text-white/50'
              }`}
              onClick={() => setFeedMode('following')}
            >
              Following
            </button>
            <button
              className={`text-base font-semibold transition-all ${
                feedMode === 'forYou' ? 'text-white font-bold border-b-2 border-white pb-0.5' : 'text-white/50'
              }`}
              onClick={() => setFeedMode('forYou')}
            >
              For You
            </button>
          </div>
        </div>

        <div className="w-24 h-24 rounded-full bg-purple-500/20 flex items-center justify-center mb-4">
          {isFollowingEmpty ? (
            <UserPlus className="w-12 h-12 text-pink-400" />
          ) : (
            <Zap className="w-12 h-12 text-purple-400" />
          )}
        </div>
        <h3 className="text-white font-bold text-xl mb-2">
          {isFollowingEmpty ? 'No Artists Followed' : 'No Vibes Yet'}
        </h3>
        <p className="text-white/50 text-sm text-center mb-4">
          {isFollowingEmpty
            ? 'Follow artists to see their tracks in your Following feed!'
            : 'Start playing music and react to fill your feed with community vibes!'}
        </p>
        {isFollowingEmpty && (
          <motion.button
            className="px-6 py-3 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 text-white font-bold"
            onClick={() => setFeedMode('forYou')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Discover Artists
          </motion.button>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      className="absolute inset-0 bg-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Snap Scroll Container */}
      <div
        ref={containerRef}
        className="h-full w-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
        onScroll={handleScroll}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {/* Preload next 2 thumbnails */}
        {trackGroups.slice(currentIndex + 1, currentIndex + 3).map(g => (
          <link key={`preload-${g.trackId}`} rel="preload" as="image" href={g.trackThumbnail} />
        ))}
        {trackGroups.map((group, index) => {
          const isThisTrack = currentTrack?.trackId === group.trackId || currentTrack?.id === group.trackId;
          const cardIsActive = isActive && index === currentIndex;
          const artistHandle = group.trackArtist.toLowerCase().replace(/\s+/g, '_');
          return (
            <div key={group.trackId} className="h-full w-full snap-start snap-always">
              <FeedCard
                trackId={group.trackId}
                trackTitle={group.trackTitle}
                trackArtist={group.trackArtist}
                trackThumbnail={group.trackThumbnail}
                reactions={group.reactions}
                nativeOyeScore={group.nativeOyeScore}
                hottestPosition={group.hottestPosition}
                isActive={cardIsActive}
                isPlaying={isPlaying && isThisTrack}
                isThisTrack={isThisTrack}
                isFollowingArtist={followingList.has(artistHandle)}
                onPlay={() => handlePlay(group.trackId, group.trackTitle, group.trackArtist)}
                onTogglePlay={togglePlay}
                onReact={(type) => handleReact(group.trackId, group.trackTitle, group.trackArtist, type)}
                onAddComment={(text) => handleAddComment(group.trackId, group.trackTitle, group.trackArtist, text)}
                onAddToLibrary={() => {
                  // OYÉ = Add to library (queue) + auto-play
                  const poolTrack = hotPool.find(t => t.id === group.trackId || t.trackId === group.trackId);
                  const seedTrack = TRACKS.find(t => t.id === group.trackId || t.trackId === group.trackId);
                  const track = poolTrack || seedTrack;
                  if (track) {
                    addToQueue(track);
                    // Also record reaction for the OYÉ
                    handleReact(group.trackId, group.trackTitle, group.trackArtist, 'oye');
                    // Record reaction in pool for scoring
                    recordReaction(group.trackId);
                  }
                }}
                onAddToPlaylist={() => {
                  // + button = Add to queue
                  const poolTrack = hotPool.find(t => t.id === group.trackId || t.trackId === group.trackId);
                  const seedTrack = TRACKS.find(t => t.id === group.trackId || t.trackId === group.trackId);
                  const track = poolTrack || seedTrack;
                  if (track) addToQueue(track);
                }}
                onShare={() => handleShare(group.trackId, group.trackTitle, group.trackArtist)}
                onSeekToHotspot={handleSeekToHotspot}
                onFollowArtist={() => handleFollowArtist(group.trackArtist)}
                onSnippetEnd={handleSnippetEnd}
              />
            </div>
          );
        })}
      </div>

      {/* Top Navigation - Following | For You */}
      <div className="absolute top-4 left-0 right-0 z-30">
        <div className="flex items-center justify-center gap-6">
          <button
            className={`text-base font-semibold transition-all ${
              feedMode === 'following'
                ? 'text-white font-bold border-b-2 border-white pb-0.5'
                : 'text-white/50'
            }`}
            onClick={() => {
              setFeedMode('following');
              setCurrentIndex(0);
            }}
          >
            Following
            {followingList.size > 0 && (
              <span className="ml-1 text-xs text-pink-400">({followingList.size})</span>
            )}
          </button>
          <button
            className={`text-base font-semibold transition-all ${
              feedMode === 'forYou'
                ? 'text-white font-bold border-b-2 border-white pb-0.5'
                : 'text-white/50'
            }`}
            onClick={() => {
              setFeedMode('forYou');
              setCurrentIndex(0);
            }}
          >
            For You
          </button>
        </div>
        {/* Mute/Unmute button */}
        <button
          className="absolute right-4 top-0 active:scale-90 transition-transform"
          onClick={() => setVolume(volume > 0 ? 0 : 80)}
        >
          {volume > 0 ? (
            <Volume2 className="w-5 h-5 text-white/70" />
          ) : (
            <VolumeX className="w-5 h-5 text-white/70" />
          )}
        </button>
      </div>

      {/* Scroll indicator - subtle, no animation */}
      {trackGroups.length > 1 && currentIndex < trackGroups.length - 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
          <ChevronDown className="w-5 h-5 text-white/30" />
        </div>
      )}
    </motion.div>
  );
};

export default VoyoVerticalFeed;
