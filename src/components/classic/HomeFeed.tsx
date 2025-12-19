/**
 * VOYO Music - Classic Mode: Home Feed (Spotify-Style Shelves)
 *
 * Features:
 * - Horizontal scrollable shelves (Continue Listening, Heavy Rotation, Made For You, etc.)
 * - Time-based greeting
 * - Personalized recommendations based on user preferences
 * - Mobile-first, touch-friendly design
 */

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, Bell, Play } from 'lucide-react';
import { getThumb } from '../../utils/thumbnail';
import { TRACKS, MOOD_TUNNELS, getHotTracks } from '../../data/tracks';
import { getUserTopTracks, getPoolAwareHotTracks } from '../../services/personalization';
import { usePlayerStore } from '../../store/playerStore';
import { Track, MoodTunnel } from '../../types';

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
  const [imageError, setImageError] = useState(false);
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
        <img
          src={imageError ? '/placeholder-album.svg' : getThumb(track.trackId)}
          alt={track.title}
          className="w-full h-full object-cover"
          onError={() => setImageError(true)}
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
// MOOD CARD COMPONENT
// ============================================

interface MoodCardProps {
  mood: MoodTunnel;
  onSelect: () => void;
}

const MoodCard = ({ mood, onSelect }: MoodCardProps) => (
  <motion.button
    className={`flex-shrink-0 w-28 h-28 rounded-2xl bg-gradient-to-br ${mood.gradient} flex flex-col items-center justify-center shadow-lg`}
    onClick={onSelect}
    whileHover={{ scale: 1.05, y: -4 }}
    whileTap={{ scale: 0.95 }}
  >
    <span className="text-3xl mb-1">{mood.icon}</span>
    <span className="text-white font-bold text-sm">{mood.name}</span>
  </motion.button>
);

// ============================================
// HOME FEED COMPONENT
// ============================================

interface HomeFeedProps {
  onTrackPlay: (track: Track) => void;
  onSearch: () => void;
  onArtistClick?: (artist: { name: string; tracks: Track[] }) => void;
}

export const HomeFeed = ({ onTrackPlay, onSearch }: HomeFeedProps) => {
  const { history } = usePlayerStore();

  // Data for shelves (memoized for performance)
  const recentlyPlayed = useMemo(() => getRecentlyPlayed(history, 10), [history]);
  const heavyRotation = useMemo(() => getUserTopTracks(10), []);
  const madeForYou = useMemo(() => getPoolAwareHotTracks(10), []);
  const moods = MOOD_TUNNELS;
  const newReleases = useMemo(() => getNewReleases(10), []);

  // Time-based greeting
  const greeting = getGreeting();

  // Mood selection handler
  const handleMoodSelect = (mood: MoodTunnel) => {
    // TODO: Navigate to mood tunnel view - feature coming soon
    // For now, we could filter tracks by mood tag
  };

  // Check if user has listening history
  const hasHistory = recentlyPlayed.length > 0;
  const hasPreferences = heavyRotation.length > 0;

  return (
    <div className="flex flex-col h-full overflow-y-auto pb-32 scrollbar-hide">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 sticky top-0 bg-[#0a0a0f]/95 backdrop-blur-lg z-10">
        {/* Profile Avatar */}
        <motion.button
          className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold"
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

      {/* Made For You */}
      <Shelf title="Made For You">
        {madeForYou.map((track) => (
          <TrackCard
            key={track.id}
            track={track}
            onPlay={() => onTrackPlay(track)}
          />
        ))}
      </Shelf>

      {/* Browse by Mood */}
      <Shelf title="Browse by Mood">
        {moods.map((mood) => (
          <MoodCard
            key={mood.id}
            mood={mood}
            onSelect={() => handleMoodSelect(mood)}
          />
        ))}
      </Shelf>

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
