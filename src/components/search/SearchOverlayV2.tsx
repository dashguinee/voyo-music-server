/**
 * VOYO Music - Search Overlay V2
 * LED Strip Portal System - Queue (Purple) / Discovery (Blue)
 * Drag tracks into zones with CD disc animation
 */

import { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { Search, X, Loader2, Music2, Clock, Play, Plus, ListPlus, Compass, Disc3, Sparkles } from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { Track } from '../../types';
import { searchMusic, SearchResult } from '../../services/api';
import { getThumb } from '../../utils/thumbnail';
import { SmartImage } from '../ui/SmartImage';
import { TRACKS } from '../../data/tracks';
import { searchCache } from '../../utils/searchCache';
import { addSearchResultsToPool } from '../../services/personalization';
import { syncSearchResults } from '../../services/databaseSync';
import { AlbumSection } from './AlbumSection';
import { VibesSection } from './VibesSection';

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

const SEARCH_HISTORY_KEY = 'voyo_search_history';
const MAX_HISTORY = 10;

// Flying CD animation component
interface FlyingCDProps {
  thumbnail: string;
  startPos: { x: number; y: number };
  targetZone: 'queue' | 'discovery';
  onComplete: () => void;
}

const FlyingCD = ({ thumbnail, startPos, targetZone, onComplete }: FlyingCDProps) => {
  const isQueue = targetZone === 'queue';

  return (
    <motion.div
      className="fixed z-[100] pointer-events-none"
      initial={{
        x: startPos.x,
        y: startPos.y,
        scale: 1,
        rotate: 0,
      }}
      animate={{
        x: window.innerWidth - 60,
        y: isQueue ? window.innerHeight * 0.25 : window.innerHeight * 0.75,
        scale: 0.2,
        rotate: 720,
      }}
      transition={{
        duration: 0.6,
        ease: [0.32, 0.72, 0, 1],
      }}
      onAnimationComplete={onComplete}
    >
      {/* CD Disc */}
      <div
        className="w-12 h-12 rounded-full overflow-hidden relative"
        style={{
          boxShadow: `0 0 20px ${isQueue ? 'rgba(139,92,246,0.8)' : 'rgba(59,130,246,0.8)'}`,
        }}
      >
        {/* Album art */}
        <img src={thumbnail} alt="" className="w-full h-full object-cover" />
        {/* CD hole overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-3 h-3 rounded-full bg-black/80 border border-white/20" />
        </div>
        {/* CD shine */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: 'linear-gradient(135deg, transparent 30%, rgba(255,255,255,0.3) 50%, transparent 70%)',
          }}
        />
      </div>
    </motion.div>
  );
};

// Track item with dual buttons
interface TrackItemProps {
  result: SearchResult;
  index: number;
  onSelect: (result: SearchResult) => void;
  onAddToQueue: (result: SearchResult, pos: { x: number; y: number }) => void;
  onAddToDiscovery: (result: SearchResult, pos: { x: number; y: number }) => void;
  onDragStart: (result: SearchResult, thumbnail: string) => void;
  onDragUpdate: (y: number) => void;
  onDragEnd: (zone: 'queue' | 'discovery' | null, pos: { x: number; y: number }) => void;
  formatDuration: (seconds: number) => string;
  formatViews: (views: number) => string;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

const TrackItem = memo(({
  result,
  index,
  onSelect,
  onAddToQueue,
  onAddToDiscovery,
  onDragStart,
  onDragUpdate,
  onDragEnd,
  formatDuration,
  formatViews,
  containerRef,
}: TrackItemProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);

  const handleDragStart = () => {
    setIsDragging(true);
    onDragStart(result, result.thumbnail);
  };

  const handleDrag = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (itemRef.current && containerRef.current) {
      const rect = itemRef.current.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();
      const relativeY = (rect.top + rect.height / 2 - containerRect.top) / containerRect.height;
      onDragUpdate(relativeY);
    }
  };

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    setIsDragging(false);

    if (itemRef.current && containerRef.current) {
      const rect = itemRef.current.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();
      const relativeY = (rect.top + rect.height / 2 - containerRect.top) / containerRect.height;

      // If dragged far enough right and in a zone
      if (info.offset.x > 50) {
        const zone = relativeY < 0.5 ? 'queue' : 'discovery';
        onDragEnd(zone, { x: rect.left, y: rect.top });
      } else {
        onDragEnd(null, { x: 0, y: 0 });
      }
    }
  };

  const handleQueueClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    onAddToQueue(result, { x: rect.left, y: rect.top });
  };

  const handleDiscoveryClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    onAddToDiscovery(result, { x: rect.left, y: rect.top });
  };

  return (
    <motion.div
      ref={itemRef}
      className="flex items-center gap-3 p-3 rounded-xl cursor-pointer group relative"
      style={{
        background: isDragging ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
      }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      drag="x"
      dragConstraints={{ left: 0, right: 100 }}
      dragElastic={0.2}
      onDragStart={handleDragStart}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
      onClick={() => !isDragging && onSelect(result)}
      whileHover={!isDragging ? { background: 'rgba(255,255,255,0.06)' } : {}}
    >
      {/* Thumbnail - SmartImage with self-healing */}
      <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-gradient-to-br from-purple-900/30 to-pink-900/20">
        <SmartImage
          src={result.thumbnail}
          alt={result.title}
          className="w-full h-full object-cover"
          trackId={result.voyoId}
          artist={result.artist}
          title={result.title}
          lazy={true}
        />
        <motion.div
          className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Play className="w-5 h-5 text-white" fill="white" />
        </motion.div>
      </div>

      {/* Track Info */}
      <div className="flex-1 min-w-0">
        <h4 className="text-white/90 font-medium truncate text-sm">{result.title}</h4>
        <p className="text-white/40 text-xs truncate">{result.artist}</p>
        <div className="flex items-center gap-2 text-[10px] text-white/25 mt-0.5">
          <span>{formatDuration(result.duration)}</span>
          {result.views > 0 && (
            <>
              <span>•</span>
              <span>{formatViews(result.views)}</span>
            </>
          )}
        </div>
      </div>

      {/* Action Buttons - Always visible on mobile */}
      <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        {/* Add to Queue */}
        <motion.button
          className="p-2 rounded-full flex items-center gap-1"
          style={{
            background: 'linear-gradient(135deg, rgba(139,92,246,0.3) 0%, rgba(168,85,247,0.2) 100%)',
            border: '1px solid rgba(139,92,246,0.3)',
          }}
          onClick={handleQueueClick}
          whileHover={{ scale: 1.1, boxShadow: '0 0 15px rgba(139,92,246,0.5)' }}
          whileTap={{ scale: 0.9 }}
          title="Add to Queue"
        >
          <ListPlus className="w-4 h-4 text-purple-400" />
        </motion.button>

        {/* Add to Discovery */}
        <motion.button
          className="p-2 rounded-full flex items-center gap-1"
          style={{
            background: 'linear-gradient(135deg, rgba(59,130,246,0.3) 0%, rgba(96,165,250,0.2) 100%)',
            border: '1px solid rgba(59,130,246,0.3)',
          }}
          onClick={handleDiscoveryClick}
          whileHover={{ scale: 1.1, boxShadow: '0 0 15px rgba(59,130,246,0.5)' }}
          whileTap={{ scale: 0.9 }}
          title="Discover More Like This"
        >
          <Compass className="w-4 h-4 text-blue-400" />
        </motion.button>
      </div>
    </motion.div>
  );
});

export const SearchOverlayV2 = ({ isOpen, onClose }: SearchOverlayProps) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'tracks' | 'albums' | 'vibes'>('tracks');

  // Portal zone state
  const [activeZone, setActiveZone] = useState<'queue' | 'discovery' | null>(null);
  const [queueItems, setQueueItems] = useState<Track[]>([]);
  const [discoveryItems, setDiscoveryItems] = useState<Track[]>([]);
  const [showQueuePreview, setShowQueuePreview] = useState(false);
  const [showDiscoveryPreview, setShowDiscoveryPreview] = useState(false);

  // Flying CD state
  const [flyingCD, setFlyingCD] = useState<{
    thumbnail: string;
    startPos: { x: number; y: number };
    targetZone: 'queue' | 'discovery';
  } | null>(null);

  // Dragging state
  const [isDraggingTrack, setIsDraggingTrack] = useState(false);
  const [dragThumbnail, setDragThumbnail] = useState<string>('');

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { setCurrentTrack, addToQueue, queue, updateDiscoveryForTrack } = usePlayerStore();

  // Sync queue items from store
  useEffect(() => {
    setQueueItems(queue.map(q => q.track));
  }, [queue]);

  // Load search history
  useEffect(() => {
    const history = localStorage.getItem(SEARCH_HISTORY_KEY);
    if (history) setSearchHistory(JSON.parse(history));
  }, []);

  // Save to history
  const saveToHistory = (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    setSearchHistory((prev) => {
      const filtered = prev.filter((q) => q !== searchQuery);
      const updated = [searchQuery, ...filtered].slice(0, MAX_HISTORY);
      localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
    if (!isOpen) {
      setResults([]);
      setQuery('');
      setError(null);
      setActiveZone(null);
    }
  }, [isOpen]);

  // Search seed data locally - MEMOIZED for performance
  const searchSeedData = useCallback((searchQuery: string): SearchResult[] => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return [];

    // Search in title, artist, album, and tags
    const matches = TRACKS.filter(track => {
      const title = track.title.toLowerCase();
      const artist = track.artist.toLowerCase();
      const album = (track.album || '').toLowerCase();
      const tags = track.tags.join(' ').toLowerCase();

      return title.includes(query) ||
             artist.includes(query) ||
             album.includes(query) ||
             tags.includes(query);
    });

    // Convert Track to SearchResult format
    return matches.slice(0, 5).map(track => ({
      voyoId: track.trackId, // Seed data has raw YouTube IDs
      title: track.title,
      artist: track.artist,
      duration: track.duration,
      thumbnail: getThumb(track.trackId), // Direct YouTube thumbnail
      views: track.oyeScore,
    }));
  }, []);

  // Memoized seed results for current query
  const seedResults = useMemo(() => {
    if (!query || query.trim().length < 2) return [];
    return searchSeedData(query);
  }, [query, searchSeedData]);

  // Show seed results INSTANTLY when they change
  useEffect(() => {
    if (seedResults.length > 0) {
      setResults(seedResults);
    }
  }, [seedResults]);

  // Hybrid search: seed data first, then YouTube - WITH CACHING
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setResults([]);
      return;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsSearching(true);
    setError(null);
    try {
      // 1. Search seed data first (instant results)
      const seedResults = searchSeedData(searchQuery);

      // Show seed results immediately
      if (seedResults.length > 0) {
        setResults(seedResults);
      }

      // 2. Search YouTube (async, may take longer) - only if 3+ chars
      if (searchQuery.trim().length >= 3) {
        // CHECK CACHE FIRST
        const cachedResults = searchCache.get(searchQuery);
        let youtubeResults: SearchResult[];

        if (cachedResults) {
          // Cache hit - instant results!
          youtubeResults = cachedResults;
        } else {
          // Cache miss - fetch from API
          youtubeResults = await searchMusic(searchQuery, 15);
          // Store in cache for next time
          searchCache.set(searchQuery, youtubeResults);
        }

        // Check if this request was aborted
        if (abortControllerRef.current?.signal.aborted) {
          return;
        }

        // 3. Merge results, prioritizing seed data
        const seedIds = new Set(seedResults.map(r => r.voyoId));
        const uniqueYoutubeResults = youtubeResults.filter(r => !seedIds.has(r.voyoId));

        // Combine: seed first, then YouTube
        const mergedResults = [...seedResults, ...uniqueYoutubeResults];
        setResults(mergedResults);
        saveToHistory(searchQuery);

        // DATABASE SYNC: Every search result goes to collective brain
        syncSearchResults(mergedResults);
      }
    } catch (err: any) {
      // Ignore abort errors
      if (err?.name === 'AbortError') return;

      // Still show seed results even if YouTube fails
      const seedResults = searchSeedData(searchQuery);
      if (seedResults.length > 0) {
        setResults(seedResults);
        setError('YouTube search unavailable. Showing local results only.');
      } else {
        setError('Search failed. Check your connection.');
        setResults([]);
      }
    } finally {
      setIsSearching(false);
    }
  }, [searchSeedData]);

  const handleSearch = (value: string) => {
    setQuery(value);

    // Clear results if query too short
    if (value.trim().length < 2) {
      setResults([]);
    }
    // NOTE: Seed results are shown via useMemo hook (seedResults) automatically

    // DEBOUNCED: YouTube API search (150ms delay - faster than before)
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => performSearch(value), 150);
  };

  // Convert search result to track - MEMOIZED with useCallback
  const resultToTrack = useCallback((result: SearchResult): Track => ({
    id: result.voyoId,
    title: result.title,
    artist: result.artist,
    album: 'VOYO',
    trackId: result.voyoId,
    coverUrl: result.thumbnail,
    duration: result.duration,
    tags: ['search'],
    mood: 'afro',
    region: 'NG',
    oyeScore: result.views || 0,
    createdAt: new Date().toISOString(),
  }), []);

  const handleSelectTrack = useCallback((result: SearchResult) => {
    const track = resultToTrack(result);
    // POOL INTEGRATION: Add played search result to track pool for recommendations
    addSearchResultsToPool([track]);
    // CONSOLIDATED: playTrack handles everything atomically
    usePlayerStore.getState().playTrack(track);
    // FIX A4: Signal to Classic mode that NowPlaying should open
    usePlayerStore.getState().setShouldOpenNowPlaying(true);
    // DON'T auto-close - user stays on search, clicks X when done
  }, [resultToTrack]);

  const handleAddToQueue = useCallback((result: SearchResult, pos: { x: number; y: number }) => {
    setFlyingCD({
      thumbnail: result.thumbnail,
      startPos: pos,
      targetZone: 'queue',
    });
  }, []);

  const handleAddToDiscovery = useCallback((result: SearchResult, pos: { x: number; y: number }) => {
    setFlyingCD({
      thumbnail: result.thumbnail,
      startPos: pos,
      targetZone: 'discovery',
    });
    // Add to discovery items (for now just show similar tracks)
    const track = resultToTrack(result);
    setDiscoveryItems(prev => [track, ...prev].slice(0, 5));
    // POOL INTEGRATION: Add to track pool for recommendations
    addSearchResultsToPool([track]);
    // FIX 1: Wire to player store to update recommendations!
    updateDiscoveryForTrack(track);
  }, [resultToTrack, updateDiscoveryForTrack]);

  const handleFlyingCDComplete = useCallback(() => {
    if (flyingCD) {
      if (flyingCD.targetZone === 'queue') {
        // Find the result and add to queue
        const result = results.find(r => r.thumbnail === flyingCD.thumbnail);
        if (result) {
          const track = resultToTrack(result);
          // POOL INTEGRATION: Add to track pool when queued from search
          addSearchResultsToPool([track]);
          addToQueue(track);
        }
        setShowQueuePreview(true);
        setTimeout(() => setShowQueuePreview(false), 2000);
      } else {
        setShowDiscoveryPreview(true);
        setTimeout(() => setShowDiscoveryPreview(false), 2000);
      }
    }
    setFlyingCD(null);
  }, [flyingCD, results, resultToTrack, addToQueue]);

  // Drag handlers - WRAPPED in useCallback for performance
  const handleDragStart = useCallback((result: SearchResult, thumbnail: string) => {
    setIsDraggingTrack(true);
    setDragThumbnail(thumbnail);
  }, []);

  const handleDragUpdate = useCallback((relativeY: number) => {
    setActiveZone(relativeY < 0.5 ? 'queue' : 'discovery');
  }, []);

  const handleDragEnd = useCallback((zone: 'queue' | 'discovery' | null, pos: { x: number; y: number }) => {
    setIsDraggingTrack(false);

    if (zone && dragThumbnail) {
      const result = results.find(r => r.thumbnail === dragThumbnail);
      if (result) {
        setFlyingCD({
          thumbnail: dragThumbnail,
          startPos: pos,
          targetZone: zone,
        });
        if (zone === 'discovery') {
          const track = resultToTrack(result);
          setDiscoveryItems(prev => [track, ...prev].slice(0, 5));
          // POOL INTEGRATION: Add to track pool when dragged to discovery
          addSearchResultsToPool([track]);
          // FIX 1: Wire drag-and-drop to player store too!
          updateDiscoveryForTrack(track);
        }
      }
    }

    setActiveZone(null);
    setDragThumbnail('');
  }, [dragThumbnail, results, resultToTrack, updateDiscoveryForTrack]);

  const formatDuration = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const formatViews = useCallback((views: number): string => {
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
    if (views >= 1000) return `${(views / 1000).toFixed(0)}K`;
    return views.toString();
  }, []);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
            }}
          />

          {/* Main Container */}
          <motion.div
            ref={containerRef}
            className="fixed inset-x-0 top-0 bottom-0 z-50 flex"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Left Side - Search Results */}
            <motion.div
              className="flex-1 min-w-0 flex flex-col p-4"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              {/* Search Header */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-white/80 text-lg font-semibold">Search</h2>
                  <motion.button
                    className="p-2 rounded-full bg-white/10"
                    onClick={onClose}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <X className="w-5 h-5 text-white/70" />
                  </motion.button>
                </div>

                {/* Search Input */}
                <div
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl"
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.12)',
                  }}
                >
                  <Search className="w-5 h-5 text-white/40" />
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="Search your vibe..."
                    value={query}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="flex-1 bg-transparent text-white placeholder:text-white/30 focus:outline-none"
                  />
                  {isSearching && <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />}
                </div>

                {/* Tab Switcher - Always show to access Vibes */}
                <div className="flex gap-2 mt-3">
                  <motion.button
                    className="flex-1 py-2 rounded-xl text-sm font-medium transition-colors"
                    style={{
                      background: activeTab === 'tracks'
                        ? 'linear-gradient(135deg, rgba(139,92,246,0.3) 0%, rgba(168,85,247,0.2) 100%)'
                        : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${activeTab === 'tracks' ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.08)'}`,
                      color: activeTab === 'tracks' ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)',
                    }}
                    onClick={() => setActiveTab('tracks')}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Music2 className="w-4 h-4 inline-block mr-1.5" />
                    Tracks
                  </motion.button>
                  <motion.button
                    className="flex-1 py-2 rounded-xl text-sm font-medium transition-colors"
                    style={{
                      background: activeTab === 'albums'
                        ? 'linear-gradient(135deg, rgba(139,92,246,0.3) 0%, rgba(168,85,247,0.2) 100%)'
                        : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${activeTab === 'albums' ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.08)'}`,
                      color: activeTab === 'albums' ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)',
                    }}
                    onClick={() => setActiveTab('albums')}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Disc3 className="w-4 h-4 inline-block mr-1.5" />
                    Albums
                  </motion.button>
                  <motion.button
                    className="flex-1 py-2 rounded-xl text-sm font-medium transition-colors"
                    style={{
                      background: activeTab === 'vibes'
                        ? 'linear-gradient(135deg, rgba(236,72,153,0.3) 0%, rgba(139,92,246,0.2) 100%)'
                        : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${activeTab === 'vibes' ? 'rgba(236,72,153,0.4)' : 'rgba(255,255,255,0.08)'}`,
                      color: activeTab === 'vibes' ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)',
                    }}
                    onClick={() => setActiveTab('vibes')}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Sparkles className="w-4 h-4 inline-block mr-1.5" />
                    Vibes
                  </motion.button>
                </div>
              </div>

              {/* Results List */}
              <div className="flex-1 overflow-y-auto space-y-1">
                {/* Album Section */}
                {activeTab === 'albums' && (
                  <AlbumSection query={query} isVisible={true} />
                )}

                {/* Vibes Section */}
                {activeTab === 'vibes' && (
                  <VibesSection query={query} isVisible={true} />
                )}

                {/* Track Results */}
                {activeTab === 'tracks' && (
                  <>
                    {/* FIX 2: Search History UI */}
                    {!query && searchHistory.length > 0 && !isSearching && (
                  <div className="mb-4">
                    <p className="text-white/40 text-xs mb-2 px-1">Recent Searches</p>
                    <div className="flex flex-wrap gap-2">
                      {searchHistory.map((historyQuery, i) => (
                        <button
                          key={i}
                          onClick={() => handleSearch(historyQuery)}
                          className="group flex items-center gap-2 px-3 py-1.5 rounded-full text-sm text-white/60 hover:text-white/90 transition-colors"
                          style={{
                            background: 'linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(59,130,246,0.15) 100%)',
                            border: '1px solid rgba(139,92,246,0.2)',
                          }}
                        >
                          <Clock className="w-3 h-3" />
                          <span className="text-xs">{historyQuery}</span>
                          <X
                            className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSearchHistory(prev => {
                                const updated = prev.filter(q => q !== historyQuery);
                                localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
                                return updated;
                              });
                            }}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty state */}
                {!query && !isSearching && results.length === 0 && (
                  <div className="text-center py-16">
                    <Music2 className="w-16 h-16 mx-auto mb-4 text-purple-400/40" />
                    <p className="text-white/30">Search for any song or artist</p>
                    <p className="text-white/20 text-sm mt-2">Drag results to the portals →</p>
                  </div>
                )}

                {/* Error */}
                {error && (
                  <div className="text-center py-8">
                    <p className="text-red-400/80">{error}</p>
                  </div>
                )}

                {/* FIX 3: Empty Results State */}
                {!isSearching && query.length >= 2 && results.length === 0 && !error && (
                  <div className="text-center py-8">
                    <p className="text-white/60">No results for "{query}"</p>
                    <p className="text-white/40 text-sm mt-2">Try different keywords</p>
                  </div>
                )}

                {/* Results */}
                {results.map((result, index) => (
                  <TrackItem
                    key={result.voyoId}
                    result={result}
                    index={index}
                    onSelect={handleSelectTrack}
                    onAddToQueue={handleAddToQueue}
                    onAddToDiscovery={handleAddToDiscovery}
                    onDragStart={handleDragStart}
                    onDragUpdate={handleDragUpdate}
                    onDragEnd={handleDragEnd}
                    formatDuration={formatDuration}
                    formatViews={formatViews}
                    containerRef={containerRef}
                  />
                ))}

                    {/* Loading */}
                    {isSearching && results.length === 0 && (
                      <div className="space-y-2">
                        {[...Array(5)].map((_, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-3 p-3 rounded-xl animate-pulse"
                            style={{ background: 'rgba(255,255,255,0.03)' }}
                          >
                            <div className="w-12 h-12 rounded-lg bg-white/5" />
                            <div className="flex-1">
                              <div className="h-3 w-3/4 bg-white/5 rounded mb-2" />
                              <div className="h-2 w-1/2 bg-white/5 rounded" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Footer hint */}
              <div className="mt-4 text-center text-white/20 text-xs">
                Drag tracks to portals or use buttons to add
              </div>
            </motion.div>

            {/* Right Side - LED Strip Portal Zones - ALWAYS VISIBLE */}
            <motion.div
              className="w-24 flex-shrink-0 flex flex-col relative"
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              {/* Queue Zone (Purple - Top Half) */}
              <motion.div
                className="flex-1 relative overflow-hidden"
                animate={{
                  boxShadow: activeZone === 'queue' || showQueuePreview
                    ? 'inset 0 0 60px rgba(139,92,246,0.8), 0 0 30px rgba(139,92,246,0.4)'
                    : 'inset 0 0 30px rgba(139,92,246,0.3)',
                }}
                transition={{ duration: 0.2 }}
              >
                {/* LED Strip gradient */}
                <div
                  className="absolute inset-0"
                  style={{
                    background: 'linear-gradient(180deg, rgba(139,92,246,0.4) 0%, rgba(139,92,246,0.1) 100%)',
                  }}
                />

                {/* Animated glow lines */}
                <motion.div
                  className="absolute inset-0"
                  animate={{
                    background: activeZone === 'queue'
                      ? [
                          'linear-gradient(180deg, rgba(139,92,246,0.6) 0%, transparent 50%)',
                          'linear-gradient(180deg, rgba(168,85,247,0.8) 0%, transparent 60%)',
                          'linear-gradient(180deg, rgba(139,92,246,0.6) 0%, transparent 50%)',
                        ]
                      : 'none',
                  }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                />

                {/* Zone Label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <ListPlus className="w-6 h-6 text-purple-400 mb-2" />
                  <span className="text-purple-300 text-xs font-semibold tracking-wider rotate-0">
                    QUEUE
                  </span>
                  <span className="text-purple-400/60 text-[10px] mt-1">
                    {queueItems.length} tracks
                  </span>
                </div>

                {/* Preview panel (slides in when active) */}
                <AnimatePresence>
                  {showQueuePreview && (
                    <motion.div
                      className="absolute inset-0 bg-black/80 p-2"
                      initial={{ x: '100%' }}
                      animate={{ x: 0 }}
                      exit={{ x: '100%' }}
                    >
                      <p className="text-purple-400 text-[10px] font-semibold mb-2">UP NEXT</p>
                      {queueItems.slice(0, 3).map((track, i) => (
                        <div key={track.id} className="flex items-center gap-2 mb-1">
                          <img
                            src={track.coverUrl}
                            alt=""
                            className="w-6 h-6 rounded object-cover"
                          />
                          <span className="text-white/70 text-[9px] truncate flex-1">
                            {track.title}
                          </span>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Swallow animation overlay */}
                <AnimatePresence>
                  {activeZone === 'queue' && (
                    <motion.div
                      className="absolute inset-0 pointer-events-none"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      {/* Vortex rings */}
                      {[...Array(3)].map((_, i) => (
                        <motion.div
                          key={i}
                          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-purple-400/50"
                          animate={{
                            width: [20, 80],
                            height: [20, 80],
                            opacity: [0.8, 0],
                          }}
                          transition={{
                            duration: 1,
                            repeat: Infinity,
                            delay: i * 0.3,
                          }}
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Divider */}
              <div className="h-px bg-gradient-to-r from-purple-500/50 via-white/20 to-blue-500/50" />

              {/* Discovery Zone (Blue - Bottom Half) */}
              <motion.div
                className="flex-1 relative overflow-hidden"
                animate={{
                  boxShadow: activeZone === 'discovery' || showDiscoveryPreview
                    ? 'inset 0 0 60px rgba(59,130,246,0.8), 0 0 30px rgba(59,130,246,0.4)'
                    : 'inset 0 0 30px rgba(59,130,246,0.3)',
                }}
                transition={{ duration: 0.2 }}
              >
                {/* LED Strip gradient */}
                <div
                  className="absolute inset-0"
                  style={{
                    background: 'linear-gradient(0deg, rgba(59,130,246,0.4) 0%, rgba(59,130,246,0.1) 100%)',
                  }}
                />

                {/* Animated glow lines */}
                <motion.div
                  className="absolute inset-0"
                  animate={{
                    background: activeZone === 'discovery'
                      ? [
                          'linear-gradient(0deg, rgba(59,130,246,0.6) 0%, transparent 50%)',
                          'linear-gradient(0deg, rgba(96,165,250,0.8) 0%, transparent 60%)',
                          'linear-gradient(0deg, rgba(59,130,246,0.6) 0%, transparent 50%)',
                        ]
                      : 'none',
                  }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                />

                {/* Zone Label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <Compass className="w-6 h-6 text-blue-400 mb-2" />
                  <span className="text-blue-300 text-xs font-semibold tracking-wider">
                    DISCOVER
                  </span>
                  <span className="text-blue-400/60 text-[10px] mt-1">
                    {discoveryItems.length} similar
                  </span>
                </div>

                {/* Preview panel */}
                <AnimatePresence>
                  {showDiscoveryPreview && (
                    <motion.div
                      className="absolute inset-0 bg-black/80 p-2"
                      initial={{ x: '100%' }}
                      animate={{ x: 0 }}
                      exit={{ x: '100%' }}
                    >
                      <p className="text-blue-400 text-[10px] font-semibold mb-2">SIMILAR</p>
                      {discoveryItems.slice(0, 3).map((track, i) => (
                        <div key={track.id + i} className="flex items-center gap-2 mb-1">
                          <img
                            src={track.coverUrl}
                            alt=""
                            className="w-6 h-6 rounded object-cover"
                          />
                          <span className="text-white/70 text-[9px] truncate flex-1">
                            {track.title}
                          </span>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Swallow animation overlay */}
                <AnimatePresence>
                  {activeZone === 'discovery' && (
                    <motion.div
                      className="absolute inset-0 pointer-events-none"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      {[...Array(3)].map((_, i) => (
                        <motion.div
                          key={i}
                          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-blue-400/50"
                          animate={{
                            width: [20, 80],
                            height: [20, 80],
                            opacity: [0.8, 0],
                          }}
                          transition={{
                            duration: 1,
                            repeat: Infinity,
                            delay: i * 0.3,
                          }}
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </motion.div>
          </motion.div>

          {/* Flying CD Animation */}
          <AnimatePresence>
            {flyingCD && (
              <FlyingCD
                thumbnail={flyingCD.thumbnail}
                startPos={flyingCD.startPos}
                targetZone={flyingCD.targetZone}
                onComplete={handleFlyingCDComplete}
              />
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  );
};

export default SearchOverlayV2;
