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
// VIBE CARD COMPONENT - Premium Glass Design
// ============================================

interface VibeCardProps {
  vibe: Vibe;
  onSelect: () => void;
  index: number;
}

const VibeCard = ({ vibe, onSelect, index }: VibeCardProps) => (
  <motion.button
    className="flex-shrink-0 relative group"
    onClick={onSelect}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.08, duration: 0.4 }}
    whileHover={{ y: -6, scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
    style={{ width: '120px' }}
  >
    {/* Concert lights glow - rotation + pulse */}
    <motion.div
      className="absolute -inset-[3px] rounded-[24px]"
      style={{
        background: `conic-gradient(from 0deg, ${vibe.color}, ${vibe.color}44, ${vibe.color})`,
        filter: 'blur(8px)',
      }}
      animate={{
        rotate: [0, 360],
        opacity: [0.4, 0.6, 0.4],
      }}
      transition={{
        rotate: { duration: 10, repeat: Infinity, ease: 'linear' },
        opacity: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
      }}
    />

    {/* Main card - BOLD solid color, VOYO energy */}
    <div
      className="relative rounded-[22px] overflow-hidden"
      style={{
        aspectRatio: '0.9',
        background: `linear-gradient(135deg, ${vibe.color} 0%, ${vibe.color}dd 50%, ${vibe.color}bb 100%)`,
        boxShadow: `0 6px 24px ${vibe.color}50`,
      }}
    >
      {/* Texture overlay - vinyl/album feel (more translucent) */}
      <div
        className="absolute inset-0 opacity-[0.15]"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 50%, rgba(255,255,255,0.6) 0.5px, transparent 1px)`,
          backgroundSize: '6px 6px',
        }}
      />

      {/* Shine streak */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(130deg, rgba(255,255,255,0.3) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.15) 100%)',
        }}
      />

      {/* Content */}
      <div className="relative h-full flex flex-col items-center justify-center p-3">
        {/* Animated Icon - unique per vibe */}
        <div className="mb-2 drop-shadow-lg text-4xl flex items-center justify-center">
          {vibe.id === 'afro-heat' && (
            <motion.div
              style={{ display: 'inline-block' }}
              whileHover={{ scale: 1.1 }}
            >
              <LottieIcon
                lottieUrl="/lottie/fire.json"
                fallbackEmoji="🔥"
                size={48}
                loop={true}
              />
            </motion.div>
          )}
          {vibe.id === 'chill-vibes' && (
            <motion.div
              style={{ display: 'inline-block' }}
              animate={{
                scale: [1, 1.12, 1],
                opacity: [0.6, 1, 0.6],
              }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              💜
            </motion.div>
          )}
          {vibe.id === 'party-mode' && (
            <div className="relative">
              <LottieIcon
                lottieUrl={vibe.lottie}
                fallbackEmoji="🪩"
                size={44}
              />
              <motion.div
                className="absolute -top-1 -right-2 text-lg"
                style={{ display: 'inline-block' }}
                animate={{
                  scale: [0.8, 1.2, 0.8],
                  rotate: [0, 15, -15, 0],
                  opacity: [0.7, 1, 0.7],
                }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              >
                ✨
              </motion.div>
            </div>
          )}
          {vibe.id === 'late-night' && (
            <motion.div
              style={{ display: 'inline-block' }}
              whileHover={{ scale: 1.1 }}
            >
              <LottieIcon
                lottieUrl="/lottie/night-clear.json"
                fallbackEmoji="🌙"
                size={48}
                loop={true}
              />
            </motion.div>
          )}
          {vibe.id === 'workout' && (
            <motion.div
              style={{ display: 'inline-block' }}
              animate={{
                scale: [1, 1.2, 1, 1.15, 1],
                x: [-2, 2, -2, 2, 0],
              }}
              transition={{ duration: 0.6, repeat: Infinity, ease: 'easeInOut' }}
            >
              ⚡
            </motion.div>
          )}
        </div>

        {/* Name - bold, no subtlety */}
        <h3 className="text-white font-black text-xs tracking-wide text-center drop-shadow-md">
          {vibe.name}
        </h3>

        {/* Description */}
        <p className="text-white/80 text-[9px] mt-1 text-center font-medium">
          {vibe.description}
        </p>
      </div>

      {/* Colored footer accent */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[3px]"
        style={{
          background: `linear-gradient(90deg, transparent 5%, rgba(255,255,255,0.5) 50%, transparent 95%)`,
        }}
      />

      {/* AFRO HEAT - Full Fire Orchestration */}
      {vibe.id === 'afro-heat' && (
        <>
          {/* Ember wave 1 - syncs with main fire pulse 2 */}
          {[
            { left: '20%', delay: 0.8, dir: 1 },
            { left: '40%', delay: 1.6, dir: -1 },
            { left: '60%', delay: 2.4, dir: 1 },
            { left: '80%', delay: 3.2, dir: -1 },
          ].map((spark, i) => (
            <motion.div
              key={`ember-${i}`}
              className="absolute rounded-full"
              style={{
                bottom: '2px',
                left: spark.left,
                width: '4px',
                height: '4px',
                background: 'radial-gradient(circle, #ffeb3b 0%, #ff9800 40%, #f4511e 100%)',
                boxShadow: '0 0 6px 1px rgba(255, 152, 0, 0.7)',
              }}
              animate={{
                y: [0, -30, -60, -90, -115],
                x: [0, spark.dir * 4, spark.dir * -2, spark.dir * 5, spark.dir * 2],
                opacity: [0, 0.9, 0.8, 0.5, 0],
                scale: [0.3, 0.7, 0.9, 0.6, 0.3],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                repeatDelay: 1,
                delay: spark.delay,
                ease: [0.4, 0, 0.2, 1],
              }}
            />
          ))}

          {/* Fire bloom - appears when main fire peaks */}
          {[
            { left: '30%', delay: 2.5 },
            { left: '70%', delay: 3.5 },
          ].map((bloom, i) => (
            <motion.div
              key={`bloom-${i}`}
              className="absolute text-[11px]"
              style={{
                bottom: '85px',
                left: bloom.left,
                marginLeft: '-7px',
              }}
              animate={{
                y: [0, -8, -20],
                opacity: [0, 1, 0],
                scale: [0.4, 1, 1.4],
              }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                repeatDelay: 2.5,
                delay: bloom.delay,
                ease: 'easeOut',
              }}
            >
              🔥
            </motion.div>
          ))}

          {/* Tiny sparks - rapid, random feel */}
          {[
            { left: '25%', delay: 0, size: 3 },
            { left: '50%', delay: 0.5, size: 2 },
            { left: '75%', delay: 1, size: 3 },
            { left: '35%', delay: 1.5, size: 2 },
            { left: '65%', delay: 2, size: 2 },
          ].map((spark, i) => (
            <motion.div
              key={`spark-${i}`}
              className="absolute rounded-full"
              style={{
                bottom: '0px',
                left: spark.left,
                width: `${spark.size}px`,
                height: `${spark.size}px`,
                background: '#ffcc00',
                boxShadow: '0 0 4px #ff9900',
              }}
              animate={{
                y: [0, -20, -35],
                opacity: [0, 1, 0],
                x: [0, (i % 2 === 0 ? 3 : -3), 0],
              }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                repeatDelay: 0.8,
                delay: spark.delay,
                ease: 'easeOut',
              }}
            />
          ))}
        </>
      )}
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

      {/* Browse by Vibes - Floating cards */}
      <div className="mb-6">
        <div className="px-4 mb-4">
          <h2 className="text-white font-bold text-lg">Browse by Vibes</h2>
        </div>
        <div className="flex gap-5 px-4 overflow-x-auto scrollbar-hide py-4">
          {vibes.map((vibe, index) => (
            <VibeCard
              key={vibe.id}
              vibe={vibe}
              index={index}
              onSelect={() => handleVibeSelect(vibe)}
            />
          ))}
        </div>
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
