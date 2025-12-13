// VOYO Music - Global Player State (Zustand)
import { create } from 'zustand';
import { Track, ViewMode, QueueItem, HistoryItem, MoodType, Reaction, VoyoTab } from '../types';
import {
  TRACKS,
  getRandomTracks,
  getHotTracks,
  getDiscoverTracks,
  getRelatedTracks,
  getTracksByArtist,
  getTracksByTags,
} from '../data/tracks';
import {
  getPersonalizedHotTracks,
  getPersonalizedDiscoveryTracks,
} from '../services/personalization';
import { BitrateLevel, BufferStatus } from '../services/audioEngine';
import { prefetchTrack } from '../services/api';

// Network quality types
type NetworkQuality = 'slow' | 'medium' | 'fast' | 'unknown';
type PrefetchStatus = 'idle' | 'loading' | 'ready' | 'error';

interface PlayerStore {
  // Current Track State
  currentTrack: Track | null;
  isPlaying: boolean;
  progress: number;
  currentTime: number;
  duration: number;
  volume: number;
  viewMode: ViewMode;
  isVideoMode: boolean;
  seekPosition: number | null; // When set, AudioPlayer should seek to this position

  // Streaming Optimization (Spotify-beating features)
  networkQuality: NetworkQuality;
  streamQuality: BitrateLevel;  // Use BitrateLevel from audioEngine
  bufferHealth: number; // 0-100 percentage
  bufferStatus: BufferStatus;  // 'healthy' | 'warning' | 'emergency'
  prefetchStatus: Map<string, PrefetchStatus>; // trackId -> status
  playbackSource: 'cached' | 'direct' | 'iframe' | null; // VOYO Boost indicator

  // Playback Modes
  shuffleMode: boolean;
  repeatMode: 'off' | 'all' | 'one';

  // Queue & History
  queue: QueueItem[];
  history: HistoryItem[];

  // Recommendations
  hotTracks: Track[];
  aiPicks: Track[];
  discoverTracks: Track[];
  isAiMode: boolean;

  // Mood Tunnel
  currentMood: MoodType | null;

  // OYÉ Reactions
  reactions: Reaction[];
  oyeScore: number;

  // Roulette
  isRouletteMode: boolean;
  rouletteTracks: Track[];

  // VOYO Superapp Tab
  voyoActiveTab: VoyoTab;
  setVoyoTab: (tab: VoyoTab) => void;

  // Actions - Playback
  setCurrentTrack: (track: Track) => void;
  togglePlay: () => void;
  setProgress: (progress: number) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  seekTo: (time: number) => void;
  clearSeekPosition: () => void;
  setVolume: (volume: number) => void;
  nextTrack: () => void;
  prevTrack: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;

  // Actions - View Mode
  cycleViewMode: () => void;
  setViewMode: (mode: ViewMode) => void;
  toggleVideoMode: () => void;

  // Actions - Queue
  addToQueue: (track: Track, position?: number) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;

  // Actions - History
  addToHistory: (track: Track, duration: number) => void;

  // Actions - Recommendations
  refreshRecommendations: () => void;
  toggleAiMode: () => void;
  updateDiscoveryForTrack: (track: Track) => void;
  refreshDiscoveryForCurrent: () => void;

  // Actions - Mood
  setMood: (mood: MoodType | null) => void;

  // Actions - Reactions
  addReaction: (reaction: Omit<Reaction, 'id' | 'createdAt'>) => void;
  multiplyReaction: (reactionId: string) => void;
  clearReactions: () => void;

  // Actions - Roulette
  startRoulette: () => void;
  stopRoulette: (track: Track) => void;

  // Actions - Streaming Optimization
  setNetworkQuality: (quality: NetworkQuality) => void;
  setStreamQuality: (quality: BitrateLevel) => void;
  setBufferHealth: (health: number, status: BufferStatus) => void;
  setPlaybackSource: (source: 'cached' | 'direct' | 'iframe' | null) => void;
  setPrefetchStatus: (trackId: string, status: PrefetchStatus) => void;
  detectNetworkQuality: () => void;
}

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  // Initial State
  currentTrack: TRACKS[0],
  isPlaying: false,
  progress: 0,
  currentTime: 0,
  duration: 0,
  volume: parseInt(localStorage.getItem('voyo-volume') || '80', 10),
  seekPosition: null,
  viewMode: 'card',
  isVideoMode: false,
  shuffleMode: false,
  repeatMode: 'off',

  // Streaming Optimization Initial State
  networkQuality: 'unknown',
  streamQuality: 'high',
  bufferHealth: 100,
  bufferStatus: 'healthy',
  prefetchStatus: new Map(),
  playbackSource: null,

  queue: TRACKS.slice(1, 4).map((track) => ({
    track,
    addedAt: new Date().toISOString(),
    source: 'auto' as const,
  })),
  history: [],

  hotTracks: getHotTracks(),
  aiPicks: getRandomTracks(5),
  discoverTracks: getDiscoverTracks([]),
  isAiMode: true,

  currentMood: 'afro',

  reactions: [],
  oyeScore: 0,

  isRouletteMode: false,
  rouletteTracks: TRACKS,

  // VOYO Superapp Tab - Default to music
  voyoActiveTab: 'music',
  setVoyoTab: (tab) => set({ voyoActiveTab: tab }),

  // Playback Actions
  setCurrentTrack: (track) => {
    const state = get();
    // Add current track to history before switching
    if (state.currentTrack) {
      get().addToHistory(state.currentTrack, state.currentTime);
    }
    set({ currentTrack: track, isPlaying: true, progress: 0, currentTime: 0, seekPosition: null });

    // AUTO-TRIGGER: Update smart discovery for this track
    get().updateDiscoveryForTrack(track);
  },

  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),

  setProgress: (progress) => set({ progress }),

  setCurrentTime: (time) => set({ currentTime: time }),

  setDuration: (duration) => set({ duration }),

  seekTo: (time) => set({ seekPosition: time, currentTime: time }),
  clearSeekPosition: () => set({ seekPosition: null }),

  setVolume: (volume) => {
    localStorage.setItem('voyo-volume', String(volume));
    set({ volume });
  },

  nextTrack: () => {
    const state = get();

    // Handle repeat one mode - replay the same track
    if (state.repeatMode === 'one' && state.currentTrack) {
      set({
        isPlaying: true,
        progress: 0,
        currentTime: 0,
      });
      return;
    }

    // Check queue first
    if (state.queue.length > 0) {
      const [next, ...rest] = state.queue;
      if (state.currentTrack) {
        get().addToHistory(state.currentTrack, state.currentTime);
      }
      set({
        currentTrack: next.track,
        queue: rest,
        isPlaying: true,
        progress: 0,
        currentTime: 0,
      });
      return;
    }

    // Queue is empty - check repeat all mode
    if (state.repeatMode === 'all' && state.history.length > 0) {
      // Restart from the first track in history
      const firstTrack = state.history[0].track;
      if (state.currentTrack) {
        get().addToHistory(state.currentTrack, state.currentTime);
      }
      set({
        currentTrack: firstTrack,
        isPlaying: true,
        progress: 0,
        currentTime: 0,
      });
      return;
    }

    // Pick next track - shuffle mode or regular discovery
    const availableTracks = state.discoverTracks.length > 0
      ? state.discoverTracks
      : state.hotTracks.length > 0
      ? state.hotTracks
      : TRACKS;

    if (availableTracks.length > 0) {
      let nextTrack;

      if (state.shuffleMode) {
        // ROULETTE MODE: Pick random track with animation trigger
        const randomIndex = Math.floor(Math.random() * availableTracks.length);
        nextTrack = availableTracks[randomIndex];
      } else {
        // Regular mode: Pick random from available
        nextTrack = availableTracks[Math.floor(Math.random() * availableTracks.length)];
      }

      if (state.currentTrack) {
        get().addToHistory(state.currentTrack, state.currentTime);
      }
      set({
        currentTrack: nextTrack,
        isPlaying: true,
        progress: 0,
        currentTime: 0,
      });
    }
  },

  prevTrack: () => {
    const state = get();
    if (state.history.length > 0) {
      const lastPlayed = state.history[state.history.length - 1];
      set({
        currentTrack: lastPlayed.track,
        history: state.history.slice(0, -1),
        isPlaying: true,
        progress: 0,
        currentTime: 0,
      });
    }
  },

  // View Mode Actions
  cycleViewMode: () => {
    const modes: ViewMode[] = ['card', 'lyrics', 'video', 'feed'];
    set((state) => {
      const currentIndex = modes.indexOf(state.viewMode);
      const nextIndex = (currentIndex + 1) % modes.length;
      return { viewMode: modes[nextIndex] };
    });
  },

  setViewMode: (mode) => set({ viewMode: mode }),

  toggleVideoMode: () => set((state) => ({ isVideoMode: !state.isVideoMode })),

  // Queue Actions
  addToQueue: (track, position) => {
    set((state) => {
      // FIX 4: Duplicate detection
      if (state.queue.some(q => q.track.id === track.id)) {
        return state; // Don't add duplicate
      }

      const newItem: QueueItem = {
        track,
        addedAt: new Date().toISOString(),
        source: 'manual',
      };

      // INSTANT PLAYBACK: Warm up the track for streaming
      if (track.trackId) {
        prefetchTrack(track.trackId);
      }

      if (position !== undefined) {
        const newQueue = [...state.queue];
        newQueue.splice(position, 0, newItem);
        return { queue: newQueue };
      }
      return { queue: [...state.queue, newItem] };
    });
  },

  removeFromQueue: (index) => {
    set((state) => ({
      queue: state.queue.filter((_, i) => i !== index),
    }));
  },

  clearQueue: () => set({ queue: [] }),

  reorderQueue: (fromIndex, toIndex) => {
    set((state) => {
      const newQueue = [...state.queue];
      const [removed] = newQueue.splice(fromIndex, 1);
      newQueue.splice(toIndex, 0, removed);
      return { queue: newQueue };
    });
  },

  // History Actions
  addToHistory: (track, duration) => {
    set((state) => ({
      history: [
        ...state.history,
        {
          track,
          playedAt: new Date().toISOString(),
          duration,
          oyeReactions: 0,
        },
      ],
    }));
  },

  // Recommendation Actions
  refreshRecommendations: () => {
    const state = get();
    const excludeIds = [
      state.currentTrack?.id,
      ...state.queue.map((q) => q.track.id),
      ...state.history.slice(-5).map((h) => h.track.id),
    ].filter(Boolean) as string[];

    // Use personalized recommendations if AI mode is enabled
    const hotTracks = state.isAiMode
      ? getPersonalizedHotTracks(5)
      : getHotTracks();

    set({
      hotTracks,
      aiPicks: getRandomTracks(5),
      discoverTracks: getDiscoverTracks(excludeIds),
    });
  },

  toggleAiMode: () => set((state) => ({ isAiMode: !state.isAiMode })),

  // SMART DISCOVERY: Update discovery based on current track
  updateDiscoveryForTrack: (track) => {
    if (!track) return;

    const state = get();
    const excludeIds = [
      track.id,
      ...state.queue.map((q) => q.track.id),
    ].filter(Boolean) as string[];

    // Use personalized discovery if AI mode is enabled
    const relatedTracks = state.isAiMode
      ? getPersonalizedDiscoveryTracks(track, 5, excludeIds)
      : getRelatedTracks(track, 5, excludeIds);

    set({ discoverTracks: relatedTracks });
  },

  // Manually refresh discovery for current track
  refreshDiscoveryForCurrent: () => {
    const state = get();
    if (state.currentTrack) {
      get().updateDiscoveryForTrack(state.currentTrack);
    }
  },

  // Mood Actions
  setMood: (mood) => set({ currentMood: mood }),

  // Reaction Actions
  addReaction: (reaction) => {
    const newReaction: Reaction = {
      ...reaction,
      id: `reaction-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
    };
    set((state) => ({
      reactions: [...state.reactions, newReaction],
      oyeScore: state.oyeScore + reaction.multiplier,
    }));

    // Record reaction in preferences (if there's a current track)
    const { currentTrack } = get();
    if (currentTrack) {
      // Import at runtime to avoid circular dependencies
      import('./preferenceStore').then(({ usePreferenceStore }) => {
        usePreferenceStore.getState().recordReaction(currentTrack.id);
      });
    }

    // Auto-remove after animation (2s)
    setTimeout(() => {
      set((state) => ({
        reactions: state.reactions.filter((r) => r.id !== newReaction.id),
      }));
    }, 2000);
  },

  multiplyReaction: (reactionId) => {
    set((state) => ({
      reactions: state.reactions.map((r) =>
        r.id === reactionId ? { ...r, multiplier: r.multiplier * 2 } : r
      ),
      oyeScore: state.oyeScore + 1,
    }));
  },

  clearReactions: () => set({ reactions: [] }),

  // Roulette Actions
  startRoulette: () => set({ isRouletteMode: true }),

  stopRoulette: (track) => {
    set({ isRouletteMode: false });
    get().setCurrentTrack(track);
  },

  // Playback Mode Actions
  toggleShuffle: () => set((state) => ({ shuffleMode: !state.shuffleMode })),

  cycleRepeat: () => {
    set((state) => {
      const modes: Array<'off' | 'all' | 'one'> = ['off', 'all', 'one'];
      const currentIndex = modes.indexOf(state.repeatMode);
      const nextIndex = (currentIndex + 1) % modes.length;
      return { repeatMode: modes[nextIndex] };
    });
  },

  // Streaming Optimization Actions
  setNetworkQuality: (quality) => set({ networkQuality: quality }),

  setStreamQuality: (quality) => set({ streamQuality: quality }),

  setBufferHealth: (health, status) => set({
    bufferHealth: Math.max(0, Math.min(100, health)),
    bufferStatus: status
  }),

  setPlaybackSource: (source) => set({ playbackSource: source }),

  setPrefetchStatus: (trackId, status) => {
    set((state) => {
      const newMap = new Map(state.prefetchStatus);
      newMap.set(trackId, status);
      return { prefetchStatus: newMap };
    });
  },

  // Detect network quality using Navigator API
  detectNetworkQuality: () => {
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;

    if (connection) {
      const effectiveType = connection.effectiveType;
      const downlink = connection.downlink; // Mbps

      let quality: NetworkQuality = 'unknown';
      let streamQuality: BitrateLevel = 'high';

      if (effectiveType === '4g' && downlink > 5) {
        quality = 'fast';
        streamQuality = 'high';
      } else if (effectiveType === '4g' || effectiveType === '3g') {
        quality = 'medium';
        streamQuality = 'medium';
      } else if (effectiveType === '2g' || effectiveType === 'slow-2g') {
        quality = 'slow';
        streamQuality = 'low';
      } else if (downlink) {
        // Fallback to downlink speed
        if (downlink > 5) {
          quality = 'fast';
          streamQuality = 'high';
        } else if (downlink > 1) {
          quality = 'medium';
          streamQuality = 'medium';
        } else {
          quality = 'slow';
          streamQuality = 'low';
        }
      }

      set({ networkQuality: quality, streamQuality });

      // Listen for changes
      connection.addEventListener?.('change', () => {
        get().detectNetworkQuality();
      });
    } else {
      // No Network Information API - assume fast
      set({ networkQuality: 'fast', streamQuality: 'high' });
    }
  },
}));
