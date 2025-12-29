/**
 * VOYO Music - Vibes Section Component
 * Shows community vibes (playlists) in search results
 * Vibes = Community playlists that grow organically
 */

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Play, Loader2, ChevronLeft, Users, Heart } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import { usePlayerStore } from '../../store/playerStore';
import { Track } from '../../types';
import { getThumb } from '../../utils/thumbnail';

// MixBoard mode icons for vibe display
const MODE_COLORS: Record<string, string> = {
  'afro-heat': '#f97316',
  'chill-vibes': '#8b5cf6',
  'party-mode': '#ec4899',
  'late-night': '#3b82f6',
  'workout': '#22c55e',
};

interface Vibe {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  target_afro: number;
  target_chill: number;
  target_hype: number;
  target_workout: number;
  curated_tracks: string[];
  play_count: number;
  follower_count: number;
  cover_url: string | null;
  created_by: string;
  is_featured: boolean;
}

interface VibeTrack {
  voyo_id: string;
  youtube_id: string;
  title: string;
  artist: string;
  thumbnail: string | null;
  duration: number;
}

interface VibesSectionProps {
  query: string;
  isVisible: boolean;
}

// Get dominant vibe color based on targets
function getDominantColor(vibe: Vibe): string {
  const scores = [
    { mode: 'afro-heat', score: vibe.target_afro },
    { mode: 'chill-vibes', score: vibe.target_chill },
    { mode: 'party-mode', score: vibe.target_hype },
    { mode: 'workout', score: vibe.target_workout },
  ];
  const dominant = scores.reduce((a, b) => (a.score > b.score ? a : b));
  return MODE_COLORS[dominant.mode] || MODE_COLORS['afro-heat'];
}

export const VibesSection = ({ query, isVisible }: VibesSectionProps) => {
  const [vibes, setVibes] = useState<Vibe[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedVibe, setSelectedVibe] = useState<Vibe | null>(null);
  const [vibeTracks, setVibeTracks] = useState<VibeTrack[]>([]);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);

  const { addToQueue } = usePlayerStore();

  // Search vibes from Supabase
  const handleSearch = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      // Show hardcoded MixBoard vibes if Supabase not configured
      setVibes([
        {
          id: 'afro-heat',
          name: 'afro-heat',
          display_name: 'Afro Heat',
          description: 'High-energy Afrobeats, Amapiano, Naija sounds 🔥',
          target_afro: 90,
          target_chill: 20,
          target_hype: 80,
          target_workout: 60,
          curated_tracks: [],
          play_count: 1247,
          follower_count: 892,
          cover_url: null,
          created_by: 'system',
          is_featured: true,
        },
        {
          id: 'chill-vibes',
          name: 'chill-vibes',
          display_name: 'Chill Vibes',
          description: 'Smooth R&B, slow jams, mellow acoustic vibes 🌙',
          target_afro: 40,
          target_chill: 90,
          target_hype: 20,
          target_workout: 10,
          curated_tracks: [],
          play_count: 834,
          follower_count: 567,
          cover_url: null,
          created_by: 'system',
          is_featured: true,
        },
        {
          id: 'party-mode',
          name: 'party-mode',
          display_name: 'Party Mode',
          description: 'Club bangers, dance floor energy 🎉',
          target_afro: 70,
          target_chill: 10,
          target_hype: 95,
          target_workout: 50,
          curated_tracks: [],
          play_count: 2103,
          follower_count: 1456,
          cover_url: null,
          created_by: 'system',
          is_featured: true,
        },
        {
          id: 'late-night',
          name: 'late-night',
          display_name: 'Late Night',
          description: 'Moody, atmospheric late night vibes 🌃',
          target_afro: 50,
          target_chill: 70,
          target_hype: 30,
          target_workout: 10,
          curated_tracks: [],
          play_count: 612,
          follower_count: 389,
          cover_url: null,
          created_by: 'system',
          is_featured: true,
        },
        {
          id: 'workout',
          name: 'workout',
          display_name: 'Workout',
          description: 'High tempo, pump up energy 💪',
          target_afro: 60,
          target_chill: 5,
          target_hype: 85,
          target_workout: 95,
          curated_tracks: [],
          play_count: 456,
          follower_count: 234,
          cover_url: null,
          created_by: 'system',
          is_featured: true,
        },
      ]);
      return;
    }

    setIsLoading(true);
    try {
      let queryBuilder = supabase.from('voyo_vibes').select('*');

      // Filter by search query if provided
      if (query && query.trim().length >= 2) {
        queryBuilder = queryBuilder.or(`display_name.ilike.%${query}%,description.ilike.%${query}%`);
      }

      // Order by featured first, then follower count
      queryBuilder = queryBuilder.order('is_featured', { ascending: false })
        .order('follower_count', { ascending: false })
        .limit(10);

      const { data, error } = await queryBuilder;

      if (error) {
        console.error('Vibes search error:', error);
        setVibes([]);
        return;
      }

      setVibes(data || []);
    } catch (error) {
      console.error('Vibes search failed:', error);
      setVibes([]);
    } finally {
      setIsLoading(false);
    }
  }, [query]);

  // Load vibes on mount and when query changes
  useEffect(() => {
    if (isVisible) {
      handleSearch();
    }
  }, [isVisible, handleSearch]);

  // Load tracks for a vibe
  const handleVibeClick = useCallback(async (vibe: Vibe) => {
    setSelectedVibe(vibe);
    setIsLoadingTracks(true);

    try {
      if (!isSupabaseConfigured || !supabase) {
        // Show mock tracks for demo
        setVibeTracks([
          { voyo_id: 'vyo_demo1', youtube_id: 'demo1', title: 'Demo Track 1', artist: 'Demo Artist', thumbnail: null, duration: 210 },
          { voyo_id: 'vyo_demo2', youtube_id: 'demo2', title: 'Demo Track 2', artist: 'Demo Artist', thumbnail: null, duration: 195 },
        ]);
        return;
      }

      // Query tracks that match this vibe's profile
      const vibeColumn = vibe.name === 'afro-heat' ? 'vibe_afro_heat' :
                         vibe.name === 'chill-vibes' ? 'vibe_chill_vibes' :
                         vibe.name === 'party-mode' ? 'vibe_party_mode' :
                         vibe.name === 'late-night' ? 'vibe_late_night' :
                         vibe.name === 'workout' ? 'vibe_workout' : 'vibe_afro_heat';

      const { data, error } = await supabase
        .from('voyo_tracks')
        .select('voyo_id, youtube_id, title, artist, thumbnail, duration')
        .gt(vibeColumn, 50)
        .order(vibeColumn, { ascending: false })
        .limit(20);

      if (error) {
        console.error('Failed to load vibe tracks:', error);
        setVibeTracks([]);
        return;
      }

      setVibeTracks(data || []);
    } catch (error) {
      console.error('Failed to load vibe tracks:', error);
      setVibeTracks([]);
    } finally {
      setIsLoadingTracks(false);
    }
  }, []);

  // Play entire vibe
  const handlePlayVibe = useCallback(async () => {
    if (vibeTracks.length === 0 || !selectedVibe) return;

    const tracks: Track[] = vibeTracks.map(t => ({
      id: t.voyo_id,
      title: t.title,
      artist: t.artist,
      album: selectedVibe.display_name,
      trackId: t.voyo_id,
      coverUrl: t.thumbnail || getThumb(t.youtube_id),
      duration: t.duration,
      tags: [selectedVibe.name],
      mood: 'afro',
      region: 'NG',
      oyeScore: 0,
      createdAt: new Date().toISOString(),
    }));

    // Play first, queue rest
    usePlayerStore.getState().playTrack(tracks[0]);
    tracks.slice(1).forEach(track => addToQueue(track));
  }, [vibeTracks, selectedVibe, addToQueue]);

  // Play individual track
  const handleTrackClick = useCallback((track: VibeTrack) => {
    const voyoTrack: Track = {
      id: track.voyo_id,
      title: track.title,
      artist: track.artist,
      album: selectedVibe?.display_name || 'VOYO',
      trackId: track.voyo_id,
      coverUrl: track.thumbnail || getThumb(track.youtube_id),
      duration: track.duration,
      tags: [selectedVibe?.name || 'vibe'],
      mood: 'afro',
      region: 'NG',
      oyeScore: 0,
      createdAt: new Date().toISOString(),
    };
    usePlayerStore.getState().playTrack(voyoTrack);
  }, [selectedVibe]);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatCount = (count: number): string => {
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return count.toString();
  };

  if (!isVisible) return null;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 px-1">
        <Sparkles className="w-4 h-4 text-purple-400" />
        <h3 className="text-white/80 text-sm font-semibold">Vibes</h3>
        <span className="text-white/30 text-xs">Community Playlists</span>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
        </div>
      )}

      {/* Vibe Browser View */}
      <AnimatePresence mode="wait">
        {selectedVibe ? (
          // Vibe Detail View
          <motion.div
            key="vibe-detail"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-3"
          >
            {/* Back button */}
            <button
              onClick={() => setSelectedVibe(null)}
              className="flex items-center gap-2 text-white/60 hover:text-white/90 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="text-xs">Back to vibes</span>
            </button>

            {/* Vibe Header */}
            <div
              className="p-4 rounded-xl relative overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${getDominantColor(selectedVibe)}33 0%, ${getDominantColor(selectedVibe)}11 100%)`,
                border: `1px solid ${getDominantColor(selectedVibe)}44`,
              }}
            >
              <div className="flex items-center gap-4">
                {/* Vibe Icon */}
                <div
                  className="w-16 h-16 rounded-xl flex items-center justify-center"
                  style={{ background: `${getDominantColor(selectedVibe)}44` }}
                >
                  <Sparkles className="w-8 h-8" style={{ color: getDominantColor(selectedVibe) }} />
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="text-white/90 font-semibold text-lg truncate">
                    {selectedVibe.display_name}
                  </h4>
                  <p className="text-white/50 text-sm truncate">{selectedVibe.description}</p>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-white/40">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {formatCount(selectedVibe.follower_count)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Play className="w-3 h-3" />
                      {formatCount(selectedVibe.play_count)}
                    </span>
                  </div>
                </div>

                <motion.button
                  className="p-3 rounded-full transition-colors"
                  style={{ background: getDominantColor(selectedVibe) }}
                  onClick={handlePlayVibe}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  disabled={isLoadingTracks || vibeTracks.length === 0}
                >
                  <Play className="w-5 h-5 text-white" fill="white" />
                </motion.button>
              </div>
            </div>

            {/* Track List */}
            <div className="space-y-1">
              {isLoadingTracks ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-2 rounded-lg animate-pulse"
                      style={{ background: 'rgba(255,255,255,0.03)' }}
                    >
                      <div className="w-8 h-8 rounded bg-white/5" />
                      <div className="flex-1">
                        <div className="h-3 w-3/4 bg-white/5 rounded mb-1" />
                        <div className="h-2 w-1/2 bg-white/5 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : vibeTracks.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-white/40 text-sm">No tracks in this vibe yet</p>
                  <p className="text-white/30 text-xs mt-1">Play some music to train this vibe!</p>
                </div>
              ) : (
                vibeTracks.map((track, index) => (
                  <motion.div
                    key={track.voyo_id}
                    className="flex items-center gap-3 p-2 rounded-lg cursor-pointer group"
                    style={{ background: 'rgba(255,255,255,0.03)' }}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    onClick={() => handleTrackClick(track)}
                    whileHover={{ background: 'rgba(255,255,255,0.06)' }}
                  >
                    {/* Track number / thumbnail */}
                    <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-white/5">
                      {track.thumbnail ? (
                        <img
                          src={track.thumbnail}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-white/30 text-xs">
                          {index + 1}
                        </div>
                      )}
                    </div>

                    {/* Track info */}
                    <div className="flex-1 min-w-0">
                      <h5 className="text-white/80 text-xs truncate">{track.title}</h5>
                      <p className="text-white/40 text-[10px] truncate">{track.artist}</p>
                    </div>

                    {/* Duration */}
                    <span className="text-white/30 text-[10px]">
                      {formatDuration(track.duration)}
                    </span>

                    {/* Play on hover */}
                    <motion.div
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Play className="w-4 h-4 text-white/60" />
                    </motion.div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        ) : (
          // Vibes Grid View
          <motion.div
            key="vibes-grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 gap-2"
          >
            {!isLoading && vibes.length === 0 && (
              <div className="text-center py-4">
                <p className="text-white/40 text-xs">No vibes found</p>
              </div>
            )}

            {vibes.map((vibe, index) => (
              <motion.div
                key={vibe.id}
                className="relative cursor-pointer group"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => handleVibeClick(vibe)}
              >
                <div
                  className="flex items-center gap-3 p-3 rounded-xl transition-all"
                  style={{
                    background: `linear-gradient(135deg, ${getDominantColor(vibe)}22 0%, ${getDominantColor(vibe)}08 100%)`,
                    border: `1px solid ${getDominantColor(vibe)}33`,
                  }}
                >
                  {/* Vibe Icon */}
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `${getDominantColor(vibe)}33` }}
                  >
                    <Sparkles className="w-6 h-6" style={{ color: getDominantColor(vibe) }} />
                  </div>

                  {/* Vibe Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-white/90 text-sm font-medium truncate">
                        {vibe.display_name}
                      </h4>
                      {vibe.is_featured && (
                        <Heart className="w-3 h-3 text-pink-400 flex-shrink-0" fill="currentColor" />
                      )}
                    </div>
                    <p className="text-white/40 text-[10px] truncate">{vibe.description}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-[9px] text-white/30">
                      <span>{formatCount(vibe.follower_count)} followers</span>
                      <span>•</span>
                      <span>{formatCount(vibe.play_count)} plays</span>
                    </div>
                  </div>

                  {/* Play button on hover */}
                  <motion.div
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    whileHover={{ scale: 1.1 }}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ background: getDominantColor(vibe) }}
                    >
                      <Play className="w-4 h-4 text-white" fill="white" />
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VibesSection;
