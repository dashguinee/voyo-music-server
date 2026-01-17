/**
 * VOYO Music - Vibes Section Component
 * Shows community vibes powered by vibeEngine
 * Queries enriched video_intelligence table with 122K+ tracks
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Play, Loader2, ChevronLeft, Music2, Zap } from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { Track } from '../../types';
import { getThumb } from '../../utils/thumbnail';
import { vibeEngine, VIBES, Vibe as VibeDefinition, VibeTrack as EngineTrack } from '../../lib/vibeEngine';

// Vibe category colors
const CATEGORY_COLORS: Record<string, string> = {
  regional: '#f97316',   // Orange
  mood: '#8b5cf6',       // Purple
  activity: '#22c55e',   // Green
  era: '#3b82f6',        // Blue
  cultural: '#ec4899',   // Pink
  genre: '#eab308',      // Yellow
};

// Energy level to color intensity
const ENERGY_COLORS: Record<number, string> = {
  1: '33',
  2: '44',
  3: '55',
  4: '66',
  5: '77',
};

interface VibeTrack {
  youtube_id: string;
  title: string;
  artist: string;
  thumbnail_url: string | null;
  artist_tier: string | null;
  matched_artist: string | null;
  era: string | null;
}

interface VibesSectionProps {
  query: string;
  isVisible: boolean;
}

// Get vibe color based on category
function getVibeColor(vibe: VibeDefinition): string {
  return CATEGORY_COLORS[vibe.category] || CATEGORY_COLORS.mood;
}

// Format energy level
function getEnergyBars(level: number): string {
  return '▪'.repeat(level) + '▫'.repeat(5 - level);
}

export const VibesSection = ({ query, isVisible }: VibesSectionProps) => {
  const [selectedVibe, setSelectedVibe] = useState<VibeDefinition | null>(null);
  const [vibeTracks, setVibeTracks] = useState<VibeTrack[]>([]);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const { addToQueue } = usePlayerStore();

  // Get all vibes from vibeEngine, filtered by query
  const vibes = useMemo(() => {
    const allVibes = vibeEngine.getAllVibes();

    if (!query || query.trim().length < 2) {
      return allVibes;
    }

    const q = query.toLowerCase();
    return allVibes.filter(v =>
      v.name.toLowerCase().includes(q) ||
      v.description.toLowerCase().includes(q) ||
      v.category.toLowerCase().includes(q)
    );
  }, [query]);

  // Group vibes by category
  const vibesByCategory = useMemo(() => {
    const grouped: Record<string, VibeDefinition[]> = {};
    for (const vibe of vibes) {
      if (!grouped[vibe.category]) {
        grouped[vibe.category] = [];
      }
      grouped[vibe.category].push(vibe);
    }
    return grouped;
  }, [vibes]);

  const categories = Object.keys(vibesByCategory);

  // Load tracks for a vibe using vibeEngine
  const handleVibeClick = useCallback(async (vibe: VibeDefinition) => {
    setSelectedVibe(vibe);
    setIsLoadingTracks(true);

    try {
      // Use vibeEngine to get tracks from enriched video_intelligence table
      const tracks = await vibeEngine.getTracksForVibe(vibe.id, 30);
      setVibeTracks(tracks as VibeTrack[]);
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
      id: t.youtube_id,
      title: t.title,
      artist: t.artist || t.matched_artist || 'Unknown Artist',
      album: selectedVibe.name,
      trackId: t.youtube_id,
      coverUrl: t.thumbnail_url || getThumb(t.youtube_id),
      duration: 0,
      tags: [selectedVibe.category, t.era || ''].filter(Boolean),
      mood: 'afro',
      region: 'NG',
      oyeScore: selectedVibe.energy_level * 20,
      createdAt: new Date().toISOString(),
    }));

    // Play first, queue rest
    usePlayerStore.getState().playTrack(tracks[0]);
    tracks.slice(1).forEach(track => addToQueue(track));
  }, [vibeTracks, selectedVibe, addToQueue]);

  // Play individual track
  const handleTrackClick = useCallback((track: VibeTrack) => {
    const voyoTrack: Track = {
      id: track.youtube_id,
      title: track.title,
      artist: track.artist || track.matched_artist || 'Unknown Artist',
      album: selectedVibe?.name || 'VOYO Vibes',
      trackId: track.youtube_id,
      coverUrl: track.thumbnail_url || getThumb(track.youtube_id),
      duration: 0,
      tags: [selectedVibe?.category || 'vibe', track.era || ''].filter(Boolean),
      mood: 'afro',
      region: 'NG',
      oyeScore: 0,
      createdAt: new Date().toISOString(),
    };
    usePlayerStore.getState().playTrack(voyoTrack);
  }, [selectedVibe]);

  // Get tier badge color
  const getTierColor = (tier: string | null): string => {
    switch (tier) {
      case 'A': return '#22c55e';
      case 'B': return '#3b82f6';
      case 'C': return '#eab308';
      case 'D': return '#6b7280';
      default: return '#6b7280';
    }
  };

  if (!isVisible) return null;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 px-1">
        <Sparkles className="w-4 h-4 text-purple-400" />
        <h3 className="text-white/80 text-sm font-semibold">Vibes</h3>
        <span className="text-white/30 text-xs">{vibes.length} moods • powered by vibeEngine</span>
      </div>

      {/* Category Pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <button
          onClick={() => setActiveCategory(null)}
          className={`px-3 py-1 rounded-full text-xs whitespace-nowrap transition-all ${
            activeCategory === null
              ? 'bg-purple-500/30 text-purple-300 border border-purple-500/50'
              : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10'
          }`}
        >
          All
        </button>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat === activeCategory ? null : cat)}
            className={`px-3 py-1 rounded-full text-xs whitespace-nowrap transition-all capitalize ${
              activeCategory === cat
                ? 'text-white border'
                : 'bg-white/5 text-white/50 border border-white/10 hover:bg-white/10'
            }`}
            style={activeCategory === cat ? {
              background: `${CATEGORY_COLORS[cat]}33`,
              borderColor: `${CATEGORY_COLORS[cat]}66`,
              color: CATEGORY_COLORS[cat]
            } : {}}
          >
            {cat}
          </button>
        ))}
      </div>

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
                background: `linear-gradient(135deg, ${getVibeColor(selectedVibe)}33 0%, ${getVibeColor(selectedVibe)}11 100%)`,
                border: `1px solid ${getVibeColor(selectedVibe)}44`,
              }}
            >
              <div className="flex items-center gap-4">
                {/* Vibe Icon */}
                <div
                  className="w-16 h-16 rounded-xl flex items-center justify-center"
                  style={{ background: `${getVibeColor(selectedVibe)}44` }}
                >
                  <Sparkles className="w-8 h-8" style={{ color: getVibeColor(selectedVibe) }} />
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="text-white/90 font-semibold text-lg truncate">
                    {selectedVibe.name}
                  </h4>
                  <p className="text-white/50 text-sm truncate">{selectedVibe.description}</p>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-white/40">
                    <span className="flex items-center gap-1 capitalize">
                      <Music2 className="w-3 h-3" />
                      {selectedVibe.category}
                    </span>
                    <span className="flex items-center gap-1">
                      <Zap className="w-3 h-3" />
                      {getEnergyBars(selectedVibe.energy_level)}
                    </span>
                  </div>
                </div>

                <motion.button
                  className="p-3 rounded-full transition-colors"
                  style={{ background: getVibeColor(selectedVibe) }}
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
                      <div className="w-10 h-10 rounded bg-white/5" />
                      <div className="flex-1">
                        <div className="h-3 w-3/4 bg-white/5 rounded mb-1" />
                        <div className="h-2 w-1/2 bg-white/5 rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : vibeTracks.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-white/40 text-sm">No tracks match this vibe</p>
                  <p className="text-white/30 text-xs mt-1">Try a different vibe or add more music</p>
                </div>
              ) : (
                vibeTracks.map((track, index) => (
                  <motion.div
                    key={track.youtube_id}
                    className="flex items-center gap-3 p-2 rounded-lg cursor-pointer group"
                    style={{ background: 'rgba(255,255,255,0.03)' }}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    onClick={() => handleTrackClick(track)}
                    whileHover={{ background: 'rgba(255,255,255,0.06)' }}
                  >
                    {/* Thumbnail */}
                    <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-white/5">
                      <img
                        src={track.thumbnail_url || getThumb(track.youtube_id)}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Track info */}
                    <div className="flex-1 min-w-0">
                      <h5 className="text-white/80 text-xs truncate">{track.title}</h5>
                      <p className="text-white/40 text-[10px] truncate">
                        {track.matched_artist || track.artist || 'Unknown Artist'}
                      </p>
                    </div>

                    {/* Tier Badge */}
                    {track.artist_tier && (
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                        style={{
                          background: `${getTierColor(track.artist_tier)}22`,
                          color: getTierColor(track.artist_tier),
                          border: `1px solid ${getTierColor(track.artist_tier)}44`
                        }}
                      >
                        {track.artist_tier}
                      </span>
                    )}

                    {/* Era Badge */}
                    {track.era && (
                      <span className="text-[9px] text-white/30 px-1.5 py-0.5 rounded bg-white/5">
                        {track.era}
                      </span>
                    )}

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

            {/* Connected Vibes */}
            {selectedVibe.connected_vibes.length > 0 && (
              <div className="pt-2 border-t border-white/10">
                <p className="text-white/30 text-[10px] mb-2">Related Vibes</p>
                <div className="flex gap-2 flex-wrap">
                  {selectedVibe.connected_vibes.slice(0, 4).map(connectedId => {
                    const connected = VIBES[connectedId];
                    if (!connected) return null;
                    return (
                      <button
                        key={connectedId}
                        onClick={() => handleVibeClick(connected)}
                        className="px-2 py-1 rounded-full text-[10px] transition-all hover:scale-105"
                        style={{
                          background: `${getVibeColor(connected)}22`,
                          border: `1px solid ${getVibeColor(connected)}44`,
                          color: getVibeColor(connected)
                        }}
                      >
                        {connected.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
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
            {vibes.length === 0 && (
              <div className="text-center py-4">
                <p className="text-white/40 text-xs">No vibes found</p>
              </div>
            )}

            {(activeCategory ? vibesByCategory[activeCategory] || [] : vibes).map((vibe, index) => (
              <motion.div
                key={vibe.id}
                className="relative cursor-pointer group"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                onClick={() => handleVibeClick(vibe)}
              >
                <div
                  className="flex items-center gap-3 p-3 rounded-xl transition-all hover:scale-[1.01]"
                  style={{
                    background: `linear-gradient(135deg, ${getVibeColor(vibe)}22 0%, ${getVibeColor(vibe)}08 100%)`,
                    border: `1px solid ${getVibeColor(vibe)}33`,
                  }}
                >
                  {/* Vibe Icon */}
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: `${getVibeColor(vibe)}33` }}
                  >
                    <Sparkles className="w-6 h-6" style={{ color: getVibeColor(vibe) }} />
                  </div>

                  {/* Vibe Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-white/90 text-sm font-medium truncate">
                      {vibe.name}
                    </h4>
                    <p className="text-white/40 text-[10px] truncate">{vibe.description}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-[9px] text-white/30">
                      <span className="capitalize">{vibe.category}</span>
                      <span>•</span>
                      <span>{getEnergyBars(vibe.energy_level)}</span>
                    </div>
                  </div>

                  {/* Play button on hover */}
                  <motion.div
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    whileHover={{ scale: 1.1 }}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ background: getVibeColor(vibe) }}
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
