/**
 * VOYO Music - Classic Mode: Home Feed (Spotify-Style Shelves)
 *
 * Features:
 * - Horizontal scrollable shelves (Continue Listening, Heavy Rotation, Made For You, etc.)
 * - Time-based greeting
 * - Personalized recommendations based on user preferences
 * - Mobile-first, touch-friendly design
 */

import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Bell, Play, RefreshCw } from 'lucide-react';
import { getThumb } from '../../utils/thumbnail';
import { SmartImage } from '../ui/SmartImage';
import { TRACKS, VIBES, getHotTracks, Vibe } from '../../data/tracks';
import { LottieIcon } from '../ui/LottieIcon';
import { getUserTopTracks, getPoolAwareHotTracks } from '../../services/personalization';
import { usePlayerStore } from '../../store/playerStore';
import { useTrackPoolStore } from '../../store/trackPoolStore';
import { Track } from '../../types';

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get time-based greeting
 */
const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

/**
 * Get new releases (sorted by createdAt)
 */
const getNewReleases = (limit: number = 10): Track[] => {
  return [...TRACKS]
    .sort((a, b) => {
      const dateA = new Date(a.createdAt || '2024-01-01').getTime();
      const dateB = new Date(b.createdAt || '2024-01-01').getTime();
      return dateB - dateA;
    })
    .slice(0, limit);
};

/**
 * Get unique tracks from history (for Continue Listening)
 */
const getRecentlyPlayed = (history: any[], limit: number = 10): Track[] => {
  const seen = new Set<string>();
  const uniqueTracks: Track[] = [];

  // Iterate backwards (most recent first)
  for (let i = history.length - 1; i >= 0; i--) {
    const item = history[i];
    if (item.track && !seen.has(item.track.id)) {
      seen.add(item.track.id);
      uniqueTracks.push(item.track);
      if (uniqueTracks.length >= limit) break;
    }
  }

  return uniqueTracks;
};

// ============================================
// SHELF COMPONENT
// ============================================

interface ShelfProps {
  title: string;
  onSeeAll?: () => void;
  children: React.ReactNode;
}

const Shelf = ({ title, onSeeAll, children }: ShelfProps) => (
  <div className="mb-6">
    <div className="flex justify-between items-center px-4 mb-3">
      <h2 className="text-white font-bold text-lg">{title}</h2>
      {onSeeAll && (
        <motion.button
          className="text-purple-400 text-sm font-medium"
          onClick={onSeeAll}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          See all
        </motion.button>
      )}
    </div>
    <div className="flex gap-3 px-4 overflow-x-auto scrollbar-hide">
      {children}
    </div>
  </div>
);

// ============================================
// TRACK CARD COMPONENT
// ============================================

interface TrackCardProps {
  track: Track;
  onPlay: () => void;
}

const TrackCard = ({ track, onPlay }: TrackCardProps) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.button
      className="flex-shrink-0 w-32"
      onClick={onPlay}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <div className="relative w-32 h-32 rounded-xl overflow-hidden mb-2 bg-white/5">
        {/* SmartImage with self-healing: if thumbnail fails, verifies and fixes */}
        <SmartImage
          src={getThumb(track.trackId)}
          alt={track.title}
          className="w-full h-full object-cover"
          trackId={track.trackId}
          artist={track.artist}
          title={track.title}
        />
        {/* Play button overlay on hover */}
        {isHovered && (
          <motion.div
            className="absolute inset-0 bg-black/40 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="w-12 h-12 rounded-full bg-purple-500 flex items-center justify-center">
              <Play className="w-6 h-6 text-white ml-1" fill="white" />
            </div>
          </motion.div>
        )}
      </div>
      <p className="text-white text-sm font-medium truncate">{track.title}</p>
      <p className="text-white/50 text-xs truncate">{track.artist}</p>
    </motion.button>
  );
};

// ============================================
// VIBE CARD COMPONENT - Premium with paint splash effect
// ============================================

interface VibeCardProps {
  vibe: Vibe;
  onSelect: () => void;
}

const VibeCard = ({ vibe, onSelect }: VibeCardProps) => (
  <motion.button
    className="flex-shrink-0 w-28 h-32 relative group"
    onClick={onSelect}
    whileHover={{ scale: 1.08, y: -6 }}
    whileTap={{ scale: 0.95 }}
  >
    {/* Glow effect behind card */}
    <div
      className={`absolute inset-0 rounded-3xl bg-gradient-to-br ${vibe.gradient} blur-xl opacity-40 group-hover:opacity-70 transition-opacity`}
      style={{ transform: 'translateY(8px) scale(0.9)' }}
    />

    {/* Main card with organic blob shape */}
    <div
      className={`relative w-full h-full rounded-[28px] bg-gradient-to-br ${vibe.gradient} overflow-hidden shadow-2xl`}
      style={{
        boxShadow: `0 8px 32px ${vibe.color}44, inset 0 1px 0 rgba(255,255,255,0.2)`,
      }}
    >
      {/* Paint splash texture overlay */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background: `
            radial-gradient(ellipse 80% 60% at 20% 80%, rgba(255,255,255,0.4) 0%, transparent 50%),
            radial-gradient(ellipse 60% 80% at 80% 20%, rgba(255,255,255,0.3) 0%, transparent 50%),
            radial-gradient(circle at 50% 50%, transparent 30%, rgba(0,0,0,0.15) 100%)
          `,
        }}
      />

      {/* Animated shimmer on hover */}
      <motion.div
        className="absolute inset-0 opacity-0 group-hover:opacity-100"
        style={{
          background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.3) 50%, transparent 60%)',
        }}
        initial={{ x: '-100%' }}
        whileHover={{ x: '100%' }}
        transition={{ duration: 0.6, ease: 'easeInOut' }}
      />

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center p-2">
        {/* Animated Lottie icon with emoji fallback + gentle pulse for CHILL */}
        <motion.div
          className="drop-shadow-lg mb-1"
          style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.3))' }}
          whileHover={{ scale: 1.2, rotate: [0, -10, 10, 0] }}
          animate={vibe.id === 'chill-vibes' && !vibe.lottie ? {
            scale: [1, 1.1, 1],
          } : {}}
          transition={vibe.id === 'chill-vibes' && !vibe.lottie ? {
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          } : { duration: 0.4 }}
        >
          <LottieIcon
            lottieUrl={vibe.lottie}
            fallbackEmoji={vibe.icon}
            size={40}
          />
        </motion.div>

        {/* Bold name */}
        <span
          className="text-white font-black text-xs tracking-wide"
          style={{
            textShadow: '0 2px 8px rgba(0,0,0,0.4)',
            letterSpacing: '0.05em',
          }}
        >
          {vibe.name}
        </span>

        {/* Subtle description */}
        <span
          className="text-white/80 text-[9px] font-medium mt-0.5"
          style={{ textShadow: '0 1px 4px rgba(0,0,0,0.3)' }}
        >
          {vibe.description}
        </span>
      </div>

      {/* Corner accent blob */}
      <div
        className="absolute -top-4 -right-4 w-12 h-12 rounded-full opacity-40"
        style={{ background: 'rgba(255,255,255,0.3)', filter: 'blur(8px)' }}
      />
    </div>
  </motion.button>
);

// ============================================
// HOME FEED COMPONENT
// ============================================

interface HomeFeedProps {
  onTrackPlay: (track: Track) => void;
  onSearch: () => void;
  onDahub: () => void;
  onArtistClick?: (artist: { name: string; tracks: Track[] }) => void;
}

export const HomeFeed = ({ onTrackPlay, onSearch, onDahub }: HomeFeedProps) => {
  const { history, hotTracks, discoverTracks, refreshRecommendations } = usePlayerStore();
  const { hotPool } = useTrackPoolStore();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Refresh recommendations on mount and when pool changes
  useEffect(() => {
    refreshRecommendations();
  }, [hotPool.length, refreshRecommendations]);

  // Handle manual refresh
  const handleRefresh = () => {
    setIsRefreshing(true);
    refreshRecommendations();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Data for shelves - now reactive to store changes!
  const recentlyPlayed = useMemo(() => getRecentlyPlayed(history, 10), [history]);
  const heavyRotation = useMemo(() => getUserTopTracks(10), [history]); // Re-compute when history changes

  // LIVE RECOMMENDATIONS from playerStore (updated by pool + intent)
  const madeForYou = hotTracks.length > 0 ? hotTracks : getPoolAwareHotTracks(10);
  const vibes = VIBES; // Matches MixBoard modes + database vibes
  const newReleases = useMemo(() => getNewReleases(10), []);

  // Time-based greeting
  const greeting = getGreeting();

  // Vibe selection handler - plays tracks matching this vibe
  const handleVibeSelect = (vibe: Vibe) => {
    // Get tracks from pool matching this vibe
    const { hotPool } = useTrackPoolStore.getState();
    const matchingTracks = hotPool
      .filter(t => t.detectedMode === vibe.id)
      .sort((a, b) => b.poolScore - a.poolScore)
      .slice(0, 10);

    if (matchingTracks.length > 0) {
      // Play first track, queue the rest
      onTrackPlay(matchingTracks[0]);
      const { addToQueue } = usePlayerStore.getState();
      matchingTracks.slice(1).forEach(track => addToQueue(track));
    } else {
      // Fallback: play hot tracks (will be filtered by vibe in the future)
      const fallback = getPoolAwareHotTracks(10);
      if (fallback.length > 0) {
        onTrackPlay(fallback[0]);
      }
    }
  };

  // Check if user has listening history
  const hasHistory = recentlyPlayed.length > 0;
  const hasPreferences = heavyRotation.length > 0;

  return (
    <div className="flex flex-col h-full overflow-y-auto pb-32 scrollbar-hide">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 sticky top-0 bg-[#0a0a0f]/95 backdrop-blur-lg z-10">
        {/* Profile Avatar → DAHUB */}
        <motion.button
          className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold"
          onClick={onDahub}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          D
        </motion.button>

        {/* Search & Notifications */}
        <div className="flex items-center gap-2">
          <motion.button
            className="p-2 rounded-full bg-white/10 hover:bg-white/20"
            onClick={onSearch}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <Search className="w-5 h-5 text-white/70" />
          </motion.button>
          <motion.button
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 relative"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <Bell className="w-5 h-5 text-white/70" />
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
          </motion.button>
        </div>
      </header>

      {/* Greeting */}
      <div className="px-4 py-4">
        <h1 className="text-2xl font-bold text-white">{greeting}, Dash</h1>
      </div>

      {/* Continue Listening (only if user has history) */}
      {hasHistory && (
        <Shelf title="Continue Listening">
          {recentlyPlayed.map((track) => (
            <TrackCard
              key={track.id}
              track={track}
              onPlay={() => onTrackPlay(track)}
            />
          ))}
        </Shelf>
      )}

      {/* Heavy Rotation (only if user has preferences) */}
      {hasPreferences && (
        <Shelf title="Your Heavy Rotation">
          {heavyRotation.map((track) => (
            <TrackCard
              key={track.id}
              track={track}
              onPlay={() => onTrackPlay(track)}
            />
          ))}
        </Shelf>
      )}

      {/* Made For You - LIVE recommendations from pool + intent */}
      <div className="mb-6">
        <div className="flex justify-between items-center px-4 mb-3">
          <h2 className="text-white font-bold text-lg">Made For You</h2>
          <motion.button
            className="p-2 rounded-full bg-white/10 hover:bg-white/20"
            onClick={handleRefresh}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            animate={isRefreshing ? { rotate: 360 } : {}}
            transition={{ duration: 0.5 }}
          >
            <RefreshCw className={`w-4 h-4 text-purple-400 ${isRefreshing ? 'animate-spin' : ''}`} />
          </motion.button>
        </div>
        <div className="flex gap-3 px-4 overflow-x-auto scrollbar-hide">
          {madeForYou.map((track) => (
            <TrackCard
              key={track.id}
              track={track}
              onPlay={() => onTrackPlay(track)}
            />
          ))}
        </div>
      </div>

      {/* Discovery - Based on what you're playing + intent */}
      {discoverTracks.length > 0 && (
        <Shelf title="Discover More">
          {discoverTracks.map((track) => (
            <TrackCard
              key={track.id}
              track={track}
              onPlay={() => onTrackPlay(track)}
            />
          ))}
        </Shelf>
      )}

      {/* Browse by Vibes (matches MixBoard + database) */}
      <div className="relative -mx-4 px-4 py-6">
        {/* Gradient fade background - prominent at bottom, fades to top */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(to top, rgba(139, 92, 246, 0.25) 0%, rgba(139, 92, 246, 0.15) 30%, rgba(139, 92, 246, 0.05) 60%, transparent 100%)',
          }}
        />
        <Shelf title="Browse by Vibes">
          {vibes.map((vibe) => (
            <VibeCard
              key={vibe.id}
              vibe={vibe}
              onSelect={() => handleVibeSelect(vibe)}
            />
          ))}
        </Shelf>
      </div>

      {/* New Releases */}
      <Shelf title="New Releases">
        {newReleases.map((track) => (
          <TrackCard
            key={track.id}
            track={track}
            onPlay={() => onTrackPlay(track)}
          />
        ))}
      </Shelf>

      {/* Empty State (only if no history AND no preferences) */}
      {!hasHistory && !hasPreferences && (
        <div className="px-4 py-8 text-center">
          <p className="text-white/50 text-sm mb-4">
            Start listening to build your personalized collection
          </p>
          <motion.button
            className="px-6 py-3 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold"
            onClick={() => {
              // Play a random track to get started
              const randomTrack = getHotTracks()[0];
              if (randomTrack) onTrackPlay(randomTrack);
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Discover Music
          </motion.button>
        </div>
      )}
    </div>
  );
};

export default HomeFeed;
