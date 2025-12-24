/**
 * VOYO Music - Premium Now Playing Experience
 * Spotify-inspired with video background + VOYO design language
 *
 * Features:
 * - FULL SCREEN VIDEO LOOP: Muted looped YouTube video
 * - COMPACT CONTROLS: Bottom panel with all controls
 * - COMMUNITY VIBES: Collapsible comments section (replaces Explore)
 * - VOYO GRADIENT: Purple/pink design language
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  Heart,
  Shuffle,
  SkipBack,
  Play,
  Pause,
  SkipForward,
  Repeat,
  MessageCircle,
  ChevronUp,
  Send,
  User,
  Plus,
  X,
  Share2,
  ListMusic,
  Video,
  Music,
  Zap
} from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { usePreferenceStore } from '../../store/preferenceStore';
import { getTrackThumbnailUrl } from '../../utils/imageHelpers';
import { useMobilePlay } from '../../hooks/useMobilePlay';
import { PlaylistModal } from '../playlist/PlaylistModal';
import { useReactionStore, Reaction, ReactionCategory, TrackStats } from '../../store/reactionStore';
import { useUniverseStore } from '../../store/universeStore';
import { videoCacheService, CacheStatus } from '../../services/videoCacheService';

// ============================================
// VOYO ID DECODER
// ============================================
const decodeVoyoId = (trackId: string): string => {
  if (!trackId.startsWith('vyo_')) return trackId;
  const encoded = trackId.substring(4);
  let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) base64 += '=';
  try {
    return atob(base64);
  } catch {
    return trackId;
  }
};

// ============================================
// THUMBNAIL BACKGROUND (When video is off)
// ============================================
const ThumbnailBackground = ({ coverUrl }: { coverUrl: string }) => (
  <div className="absolute inset-0 overflow-hidden">
    <img
      src={coverUrl}
      alt="Album cover"
      className="absolute w-full h-full object-cover scale-110 blur-sm"
    />
    {/* Extra blur overlay for depth */}
    <div className="absolute inset-0 bg-black/40" />
  </div>
);

// ============================================
// CACHED VIDEO BACKGROUND COMPONENT
// Efficient: Downloads once, caches in IndexedDB, loops locally
// ============================================
const CachedVideoBackground = ({
  trackId,
  isPlaying,
  showVideo,
  fallbackUrl,
  onCacheStatus,
}: {
  trackId: string;
  isPlaying: boolean;
  showVideo: boolean;
  fallbackUrl: string;
  onCacheStatus?: (status: CacheStatus) => void;
}) => {
  const youtubeId = useMemo(() => decodeVoyoId(trackId), [trackId]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [cacheStatus, setCacheStatus] = useState<CacheStatus>({
    cached: false,
    loading: false,
    error: null,
    progress: 0,
  });

  // Subscribe to cache status updates
  useEffect(() => {
    const unsubscribe = videoCacheService.subscribeToStatus(youtubeId, (status) => {
      setCacheStatus(status);
      onCacheStatus?.(status);
    });
    return unsubscribe;
  }, [youtubeId, onCacheStatus]);

  // Fetch or load cached video
  useEffect(() => {
    let cancelled = false;

    const loadVideo = async () => {
      const url = await videoCacheService.getVideoUrl(youtubeId);
      if (!cancelled && url) {
        setVideoUrl(url);
      }
    };

    if (showVideo) {
      loadVideo();
    }

    return () => {
      cancelled = true;
    };
  }, [youtubeId, showVideo]);

  // Control playback
  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying, videoUrl]);

  if (!showVideo) return null;

  // Show loading state or fallback thumbnail while caching
  if (!videoUrl) {
    return (
      <div className="absolute inset-0 overflow-hidden">
        {/* Fallback: Blurred thumbnail */}
        <img
          src={fallbackUrl}
          alt="Loading video..."
          className="absolute w-full h-full object-cover scale-110 blur-sm"
        />
        <div className="absolute inset-0 bg-black/40" />

        {/* Cache progress indicator */}
        {cacheStatus.loading && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-50">
            <div className="bg-black/80 backdrop-blur-sm rounded-full px-4 py-2 flex items-center gap-3">
              <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-white/80 text-xs font-medium">
                Caching video... {cacheStatus.progress}%
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="absolute inset-0 overflow-hidden">
      <video
        ref={videoRef}
        src={videoUrl}
        className="absolute w-full h-full object-cover"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: '177.78vh',
          height: '100vh',
          minWidth: '100%',
          minHeight: '56.25vw',
          transform: 'translate(-50%, -50%)',
        }}
        autoPlay
        loop
        muted
        playsInline
      />

      {/* Cached indicator (subtle) */}
      {cacheStatus.cached && (
        <div className="absolute top-4 right-4 z-50">
          <div className="bg-green-500/20 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1">
            <div className="w-1.5 h-1.5 bg-green-400 rounded-full" />
            <span className="text-green-400 text-[10px] font-medium">Cached</span>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// FLOATING REACTIONS
// ============================================
interface FloatingReaction {
  id: number;
  emoji: string;
  x: number;
  xOffset: number;
}

const FloatingReactions = ({ reactions }: { reactions: FloatingReaction[] }) => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
    <AnimatePresence>
      {reactions.map((reaction) => (
        <motion.div
          key={reaction.id}
          className="absolute text-4xl"
          style={{ left: `${reaction.x}%`, bottom: '30%' }}
          initial={{ opacity: 1, y: 0, scale: 0.5 }}
          animate={{
            opacity: [1, 1, 0],
            y: -300,
            scale: [0.5, 1.5, 1],
            x: [0, reaction.xOffset, reaction.xOffset * 1.5]
          }}
          exit={{ opacity: 0 }}
          transition={{ duration: 3, ease: 'easeOut' }}
        >
          <span className="drop-shadow-2xl">{reaction.emoji}</span>
        </motion.div>
      ))}
    </AnimatePresence>
  </div>
);

// ============================================
// COMMUNITY VIBES PANEL (Replaces Explore)
// ============================================
const CommunityVibesPanel = ({
  isExpanded,
  onToggle,
  reactions,
  onAddComment,
  trackStats,
  currentUsername,
}: {
  isExpanded: boolean;
  onToggle: () => void;
  reactions: Reaction[];
  onAddComment: (text: string) => void;
  trackStats: TrackStats | null;
  currentUsername: string | null;
}) => {
  const [commentText, setCommentText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleSubmit = () => {
    if (commentText.trim()) {
      onAddComment(commentText.trim());
      setCommentText('');
    }
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  };

  // Fallback comments
  const fallbackComments = [
    { user: 'burna_fan', text: 'This track is FIRE 🔥🔥🔥', time: '2m' },
    { user: 'afrovibes', text: 'OYÉ OYÉ OYÉ!!! ⚡', time: '5m' },
    { user: 'dashfam', text: 'On repeat all day 🔂', time: '12m' },
    { user: 'music_lover', text: 'Best afrobeats this year 💜', time: '1h' },
  ];

  return (
    <motion.div
      className="bg-black/90 backdrop-blur-xl rounded-t-3xl border-t border-white/10"
      animate={{ height: isExpanded ? 320 : 56 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
    >
      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-5 py-4"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
            <MessageCircle className="w-4 h-4 text-white" />
          </div>
          <div className="text-left">
            <p className="text-white font-bold text-sm">Community Vibes</p>
            <p className="text-white/50 text-xs">
              {trackStats?.total_reactions || reactions.length || 0} vibing now
            </p>
          </div>
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronUp className="w-5 h-5 text-white/50" />
        </motion.div>
      </button>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            className="px-5 pb-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Comments List */}
            <div ref={scrollRef} className="space-y-3 max-h-[180px] overflow-y-auto scrollbar-hide mb-4">
              {reactions.length > 0 ? (
                reactions.slice(-10).map((reaction) => (
                  <div key={reaction.id} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-purple-400 text-xs font-bold">@{reaction.username}</span>
                        <span className="text-white/30 text-[10px]">{timeAgo(reaction.created_at)}</span>
                      </div>
                      <p className="text-white/80 text-sm">
                        {reaction.emoji} {reaction.comment || 'sent a vibe'}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                fallbackComments.map((comment, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-purple-400 text-xs font-bold">@{comment.user}</span>
                        <span className="text-white/30 text-[10px]">{comment.time}</span>
                      </div>
                      <p className="text-white/80 text-sm">{comment.text}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                placeholder="Drop a vibe... 🔥"
                className="flex-1 bg-white/10 rounded-full px-4 py-3 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
              <motion.button
                className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center"
                onClick={handleSubmit}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <Send className="w-5 h-5 text-white" />
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
  } = usePlayerStore();
  const { handlePlayPause } = useMobilePlay();

  const { trackPreferences, setExplicitLike } = usePreferenceStore();
  const isLiked = currentTrack ? trackPreferences[currentTrack.trackId]?.explicitLike === true : false;

  const {
    createReaction,
    fetchTrackReactions,
    fetchTrackStats,
    trackReactions,
    trackStats: statsMap,
  } = useReactionStore();
  const { currentUsername } = useUniverseStore();

  // State
  const [showVideo, setShowVideo] = useState(true);
  const [isShuffled, setIsShuffled] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [isVibesExpanded, setIsVibesExpanded] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);

  // Reactions data
  const currentTrackId = currentTrack?.id || '';
  const realReactions = trackReactions.get(currentTrackId) || [];
  const currentTrackStats = statsMap.get(currentTrackId) || null;

  // Fetch reactions
  useEffect(() => {
    if (currentTrack && isOpen) {
      fetchTrackReactions(currentTrack.id);
      fetchTrackStats(currentTrack.id);
    }
  }, [currentTrack?.id, isOpen, fetchTrackReactions, fetchTrackStats]);

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const currentTime = (progress / 100) * duration;

  // Handle floating reaction
  const spawnReaction = useCallback((emoji: string) => {
    const id = Date.now() + Math.random();
    const x = 20 + Math.random() * 60;
    const xOffset = (Math.random() - 0.5) * 100;

    setFloatingReactions(prev => [...prev, { id, emoji, x, xOffset }]);
    setTimeout(() => {
      setFloatingReactions(prev => prev.filter(r => r.id !== id));
    }, 3000);
  }, []);

  // Handle OYÉ reaction
  const handleOye = useCallback(() => {
    spawnReaction('⚡');
    if (currentTrack) {
      createReaction({
        username: currentUsername || 'anonymous',
        trackId: currentTrack.id,
        trackTitle: currentTrack.title,
        trackArtist: currentTrack.artist,
        trackThumbnail: currentTrack.coverUrl,
        category: 'afro-heat',
        emoji: '⚡',
        reactionType: 'oye',
      });
    }
  }, [currentTrack, currentUsername, createReaction, spawnReaction]);

  // Handle comment
  const handleAddComment = useCallback(async (text: string) => {
    if (!currentTrack) return;
    spawnReaction('🔥');
    await createReaction({
      username: currentUsername || 'anonymous',
      trackId: currentTrack.id,
      trackTitle: currentTrack.title,
      trackArtist: currentTrack.artist,
      trackThumbnail: currentTrack.coverUrl,
      category: 'afro-heat',
      emoji: '💬',
      reactionType: 'oye',
      comment: text,
    });
  }, [currentTrack, currentUsername, createReaction, spawnReaction]);

  // Auto-spawn ambient reactions
  useEffect(() => {
    if (!isPlaying || !isOpen) return;
    const interval = setInterval(() => {
      const emojis = ['🔥', '⚡', '💜', '🎵', '✨'];
      spawnReaction(emojis[Math.floor(Math.random() * emojis.length)]);
    }, 4000 + Math.random() * 3000);
    return () => clearInterval(interval);
  }, [isPlaying, isOpen, spawnReaction]);

  if (!currentTrack) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 bg-black flex flex-col"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        >
          {/* BACKGROUND - Cached Video or Thumbnail */}
          {showVideo ? (
            <CachedVideoBackground
              trackId={currentTrack.trackId}
              isPlaying={isPlaying}
              showVideo={showVideo}
              fallbackUrl={getTrackThumbnailUrl(currentTrack, 'large')}
            />
          ) : (
            <ThumbnailBackground coverUrl={getTrackThumbnailUrl(currentTrack, 'large')} />
          )}

          {/* GRADIENT OVERLAYS - Black Contour Style */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent z-10" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-transparent z-10" />

          {/* FLOATING REACTIONS */}
          <FloatingReactions reactions={floatingReactions} />

          {/* MAIN CONTENT */}
          <div className="relative z-30 flex flex-col h-full">
            {/* TOP BAR */}
            <div className="flex items-center justify-between px-4 py-4">
              <motion.button
                className="p-2"
                onClick={onClose}
                whileTap={{ scale: 0.9 }}
              >
                <ChevronDown className="w-7 h-7 text-white" />
              </motion.button>
              <div className="text-center">
                <p className="text-white/50 text-xs uppercase tracking-wider">Playing from playlist</p>
                <p className="text-white text-sm font-medium">{currentTrack.album || 'Your Library'}</p>
              </div>
              <div className="w-11" /> {/* Spacer */}
            </div>

            {/* SPACER - Push content to bottom */}
            <div className="flex-1" />

            {/* VIDEO/THUMBNAIL TOGGLE - Similar to Portrait Player */}
            <div className="px-4 mb-4">
              <div className="inline-flex items-center gap-2 px-2 py-1.5 rounded-full bg-black/60 backdrop-blur-sm border border-white/20">
                {/* Video Option */}
                <motion.button
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all ${
                    showVideo
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                      : 'text-white/50 hover:text-white/80'
                  }`}
                  onClick={() => setShowVideo(true)}
                  whileTap={{ scale: 0.95 }}
                >
                  <Video className="w-4 h-4" />
                  <span className="text-xs font-semibold">Video</span>
                </motion.button>

                {/* Thumbnail Option */}
                <motion.button
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all ${
                    !showVideo
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                      : 'text-white/50 hover:text-white/80'
                  }`}
                  onClick={() => setShowVideo(false)}
                  whileTap={{ scale: 0.95 }}
                >
                  <Music className="w-4 h-4" />
                  <span className="text-xs font-semibold">Cover</span>
                </motion.button>
              </div>
            </div>

            {/* TRACK INFO ROW */}
            <div className="flex items-center gap-4 px-4 mb-3">
              {/* Album Art */}
              <div className="w-14 h-14 rounded-lg overflow-hidden shadow-xl ring-1 ring-white/10">
                <img
                  src={getTrackThumbnailUrl(currentTrack, 'medium')}
                  alt={currentTrack.title}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Title & Artist */}
              <div className="flex-1 min-w-0">
                <h2 className="text-white font-bold text-lg truncate">{currentTrack.title}</h2>
                <p className="text-white/60 text-sm truncate">{currentTrack.artist}</p>
              </div>

              {/* Action Buttons */}
              <motion.button
                className="p-2"
                onClick={() => currentTrack && setExplicitLike(currentTrack.trackId, !isLiked)}
                whileTap={{ scale: 0.9 }}
              >
                <X className="w-6 h-6 text-white/60" />
              </motion.button>
              <motion.button
                className="p-2"
                onClick={() => setShowPlaylistModal(true)}
                whileTap={{ scale: 0.9 }}
              >
                <Plus className="w-6 h-6 text-white" strokeWidth={2.5} />
              </motion.button>
            </div>

            {/* PROGRESS BAR */}
            <div className="px-4 mb-2">
              <div
                className="relative h-1 bg-white/20 rounded-full cursor-pointer"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const percent = ((e.clientX - rect.left) / rect.width) * 100;
                  seekTo((percent / 100) * duration);
                }}
              >
                <div
                  className="absolute left-0 top-0 h-full bg-white rounded-full"
                  style={{ width: `${progress}%` }}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg"
                  style={{ left: `${progress}%`, marginLeft: '-6px' }}
                />
              </div>
              <div className="flex justify-between mt-1 text-xs text-white/50">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* MAIN CONTROLS */}
            <div className="flex items-center justify-between px-6 py-4">
              <motion.button
                className={isShuffled ? 'text-purple-400' : 'text-white/60'}
                onClick={() => setIsShuffled(!isShuffled)}
                whileTap={{ scale: 0.9 }}
              >
                <Shuffle className="w-6 h-6" />
              </motion.button>

              <motion.button
                className="text-white"
                onClick={prevTrack}
                whileTap={{ scale: 0.9 }}
              >
                <SkipBack className="w-8 h-8" fill="white" />
              </motion.button>

              <motion.button
                className="w-16 h-16 rounded-full bg-white flex items-center justify-center"
                onClick={handlePlayPause}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {isPlaying ? (
                  <Pause className="w-8 h-8 text-black" fill="black" />
                ) : (
                  <Play className="w-8 h-8 text-black ml-1" fill="black" />
                )}
              </motion.button>

              <motion.button
                className="text-white"
                onClick={nextTrack}
                whileTap={{ scale: 0.9 }}
              >
                <SkipForward className="w-8 h-8" fill="white" />
              </motion.button>

              <motion.button
                className={repeatMode !== 'off' ? 'text-purple-400' : 'text-white/60'}
                onClick={() => {
                  const modes: Array<'off' | 'all' | 'one'> = ['off', 'all', 'one'];
                  setRepeatMode(modes[(modes.indexOf(repeatMode) + 1) % 3]);
                }}
                whileTap={{ scale: 0.9 }}
              >
                <Repeat className="w-6 h-6" />
              </motion.button>
            </div>

            {/* SECONDARY CONTROLS */}
            <div className="flex items-center justify-between px-6 py-2">
              {/* OYÉ Button */}
              <motion.button
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-orange-500 to-orange-600"
                onClick={handleOye}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Zap className="w-4 h-4 text-white" fill="white" />
                <span className="text-white text-sm font-bold">OYÉ</span>
              </motion.button>

              {/* Right buttons */}
              <div className="flex items-center gap-4">
                <motion.button className="text-white/60" whileTap={{ scale: 0.9 }}>
                  <Share2 className="w-5 h-5" />
                </motion.button>
                <motion.button className="text-white/60" whileTap={{ scale: 0.9 }}>
                  <ListMusic className="w-5 h-5" />
                </motion.button>
              </div>
            </div>

            {/* COMMUNITY VIBES PANEL */}
            <CommunityVibesPanel
              isExpanded={isVibesExpanded}
              onToggle={() => setIsVibesExpanded(!isVibesExpanded)}
              reactions={realReactions}
              onAddComment={handleAddComment}
              trackStats={currentTrackStats}
              currentUsername={currentUsername}
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
