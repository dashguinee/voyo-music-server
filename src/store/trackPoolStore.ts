/**
 * VOYO Music - Dynamic Track Pool Store
 *
 * INTELLIGENT TRACK MANAGEMENT
 * Instead of static tracks, maintain a living pool that:
 * - Grows from user searches, related tracks, trending
 * - Scores tracks based on intent + behavior
 * - Promotes/demotes based on current vibe (never deletes)
 * - Ages tracks over time (cold storage for stale vibes)
 *
 * POOL STRUCTURE:
 * ┌─────────────────────────────────────────────────────┐
 * │  HOT POOL (active)     │  COLD POOL (aged out)     │
 * │  - High intent match   │  - Low recent activity    │
 * │  - Recently played     │  - Mismatched intent      │
 * │  - User reactions      │  - Recoverable on shift   │
 * └─────────────────────────────────────────────────────┘
 *
 * SCORING FORMULA:
 * trackScore = intentMatch * 0.4 + recency * 0.3 + engagement * 0.3
 *
 * SOURCES:
 * 1. Seed tracks (initial 11)
 * 2. User searches (grows pool)
 * 3. Related tracks (Piped API)
 * 4. Trending (YouTube/backend)
 * 5. LLM suggestions (future: DJ mode)
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Track } from '../types';
import { TRACKS } from '../data/tracks';
import { matchTrackToMode, VibeMode } from './intentStore';

// ============================================
// TYPES
// ============================================

export interface PooledTrack extends Track {
  // Pool metadata
  pooledAt: string;           // When added to pool
  lastPlayedAt?: string;      // Last time played
  lastScoredAt?: string;      // Last time scored

  // Engagement signals
  playCount: number;          // Times played
  completionRate: number;     // Average % listened (0-100)
  reactionCount: number;      // OYÉ reactions received
  queuedCount: number;        // Times added to queue
  skippedCount: number;       // Times skipped

  // Classification
  detectedMode: VibeMode;     // Auto-detected vibe mode
  confidence: number;         // How confident in mode detection (0-1)

  // Pool status
  poolScore: number;          // Current relevance score (0-100)
  isHot: boolean;             // In hot pool (active rotation)
  isCold: boolean;            // In cold pool (aged out)

  // Source tracking
  source: 'seed' | 'search' | 'related' | 'trending' | 'llm' | 'album';
}

interface TrackPoolStore {
  // The pools
  hotPool: PooledTrack[];     // Active rotation (HOT/DISCOVERY pull from here)
  coldPool: PooledTrack[];    // Aged out (recoverable)

  // Pool settings
  maxHotPoolSize: number;     // Max tracks in hot pool
  maxColdPoolSize: number;    // Max tracks in cold pool
  ageOutThreshold: number;    // Days without play before aging out

  // Actions - Adding tracks
  addToPool: (track: Track, source: PooledTrack['source']) => void;
  addManyToPool: (tracks: Track[], source: PooledTrack['source']) => void;

  // Actions - Engagement tracking
  recordPlay: (trackId: string) => void;
  recordCompletion: (trackId: string, completionRate: number) => void;
  recordReaction: (trackId: string) => void;
  recordQueue: (trackId: string) => void;
  recordSkip: (trackId: string) => void;

  // Actions - Pool management
  rescoreAllTracks: () => void;     // Rescore based on current intent
  ageOutStale: () => void;          // Move stale tracks to cold pool
  recoverFromCold: (modeId: VibeMode, count: number) => void; // Bring back matching tracks

  // Getters - For HOT/DISCOVERY engines
  getHotTracks: (limit: number) => PooledTrack[];
  getTracksForMode: (modeId: VibeMode, limit: number) => PooledTrack[];
  getDiscoveryTracks: (currentTrack: Track, limit: number) => PooledTrack[];

  // Stats
  getPoolStats: () => { hot: number; cold: number; total: number };
}

// ============================================
// SCORING HELPERS
// ============================================

function calculatePoolScore(track: PooledTrack, intentWeights: Record<VibeMode, number>): number {
  let score = 0;

  // 1. INTENT MATCH (40%)
  const modeWeight = intentWeights[track.detectedMode] || 0.1;
  score += modeWeight * 40;

  // 2. RECENCY (30%)
  if (track.lastPlayedAt) {
    const daysSincePlay = (Date.now() - new Date(track.lastPlayedAt).getTime()) / (1000 * 60 * 60 * 24);
    const recencyScore = Math.max(0, 30 - daysSincePlay * 2); // Decays over 15 days
    score += recencyScore;
  } else {
    // Never played - give some score for being new
    const daysSincePooled = (Date.now() - new Date(track.pooledAt).getTime()) / (1000 * 60 * 60 * 24);
    score += Math.max(0, 20 - daysSincePooled * 4); // New tracks get boost that decays
  }

  // 3. ENGAGEMENT (30%)
  const engagementScore =
    (track.playCount * 2) +
    (track.completionRate * 0.2) +
    (track.reactionCount * 5) +
    (track.queuedCount * 3) -
    (track.skippedCount * 2);
  score += Math.min(30, Math.max(0, engagementScore));

  return Math.min(100, Math.max(0, score));
}

function detectTrackMode(track: Track): { mode: VibeMode; confidence: number } {
  const result = matchTrackToMode({
    title: track.title,
    artist: track.artist,
    tags: track.tags,
    mood: track.mood,
  });

  // Calculate confidence based on how many keywords matched
  // (simplified - could be more sophisticated)
  const confidence = result === 'random-mixer' ? 0.3 : 0.7;

  return { mode: result, confidence };
}

function createPooledTrack(track: Track, source: PooledTrack['source']): PooledTrack {
  const { mode, confidence } = detectTrackMode(track);

  return {
    ...track,
    pooledAt: new Date().toISOString(),
    playCount: 0,
    completionRate: 0,
    reactionCount: 0,
    queuedCount: 0,
    skippedCount: 0,
    detectedMode: mode,
    confidence,
    poolScore: 50, // Start in middle
    isHot: true,   // New tracks start hot
    isCold: false,
    source,
  };
}

// ============================================
// STORE
// ============================================

export const useTrackPoolStore = create<TrackPoolStore>()(
  persist(
    (set, get) => ({
      // Initialize with seed tracks
      hotPool: TRACKS.map((t) => createPooledTrack(t, 'seed')),
      coldPool: [],

      // Settings
      maxHotPoolSize: 100,
      maxColdPoolSize: 200,
      ageOutThreshold: 7, // Days

      // =====================================
      // ADDING TRACKS
      // =====================================

      addToPool: (track, source) => {
        set((state) => {
          // Check if already in pool
          const existsInHot = state.hotPool.some((t) => t.id === track.id || t.trackId === track.trackId);
          const existsInCold = state.coldPool.some((t) => t.id === track.id || t.trackId === track.trackId);

          if (existsInHot || existsInCold) {
            // Already exists - just update last seen
            return state;
          }

          const pooledTrack = createPooledTrack(track, source);

          // Add to hot pool
          let newHotPool = [...state.hotPool, pooledTrack];

          // If hot pool is too big, move lowest scored to cold
          if (newHotPool.length > state.maxHotPoolSize) {
            newHotPool.sort((a, b) => b.poolScore - a.poolScore);
            const overflow = newHotPool.splice(state.maxHotPoolSize);

            const newColdPool = [
              ...state.coldPool,
              ...overflow.map((t) => ({ ...t, isHot: false, isCold: true })),
            ].slice(-state.maxColdPoolSize); // Keep only last N

            return { hotPool: newHotPool, coldPool: newColdPool };
          }

          return { hotPool: newHotPool };
        });
      },

      addManyToPool: (tracks, source) => {
        tracks.forEach((track) => get().addToPool(track, source));
      },

      // =====================================
      // ENGAGEMENT TRACKING
      // =====================================

      recordPlay: (trackId) => {
        set((state) => ({
          hotPool: state.hotPool.map((t) =>
            (t.id === trackId || t.trackId === trackId)
              ? { ...t, playCount: t.playCount + 1, lastPlayedAt: new Date().toISOString() }
              : t
          ),
        }));
      },

      recordCompletion: (trackId, completionRate) => {
        set((state) => ({
          hotPool: state.hotPool.map((t) =>
            (t.id === trackId || t.trackId === trackId)
              ? {
                  ...t,
                  completionRate: t.playCount > 0
                    ? (t.completionRate * (t.playCount - 1) + completionRate) / t.playCount
                    : completionRate,
                }
              : t
          ),
        }));
      },

      recordReaction: (trackId) => {
        set((state) => ({
          hotPool: state.hotPool.map((t) =>
            (t.id === trackId || t.trackId === trackId)
              ? { ...t, reactionCount: t.reactionCount + 1 }
              : t
          ),
        }));
      },

      recordQueue: (trackId) => {
        set((state) => ({
          hotPool: state.hotPool.map((t) =>
            (t.id === trackId || t.trackId === trackId)
              ? { ...t, queuedCount: t.queuedCount + 1 }
              : t
          ),
        }));
      },

      recordSkip: (trackId) => {
        set((state) => ({
          hotPool: state.hotPool.map((t) =>
            (t.id === trackId || t.trackId === trackId)
              ? { ...t, skippedCount: t.skippedCount + 1 }
              : t
          ),
        }));
      },

      // =====================================
      // POOL MANAGEMENT
      // =====================================

      rescoreAllTracks: () => {
        // Import intent weights dynamically to avoid circular deps
        import('./intentStore').then(({ useIntentStore }) => {
          const intentWeights = useIntentStore.getState().getIntentWeights();

          set((state) => ({
            hotPool: state.hotPool.map((t) => ({
              ...t,
              poolScore: calculatePoolScore(t, intentWeights),
              lastScoredAt: new Date().toISOString(),
            })),
          }));

          // TRIGGER PLAYER REFRESH: After rescoring, update player recommendations
          import('./playerStore').then(({ usePlayerStore }) => {
            usePlayerStore.getState().refreshRecommendations();
            console.log('[VOYO Pool] Rescored all tracks, refreshed recommendations');
          }).catch(() => {});
        });
      },

      ageOutStale: () => {
        set((state) => {
          const threshold = Date.now() - state.ageOutThreshold * 24 * 60 * 60 * 1000;

          const stillHot: PooledTrack[] = [];
          const toAge: PooledTrack[] = [];

          state.hotPool.forEach((t) => {
            const lastActive = t.lastPlayedAt ? new Date(t.lastPlayedAt).getTime() : new Date(t.pooledAt).getTime();

            if (lastActive < threshold && t.poolScore < 30) {
              toAge.push({ ...t, isHot: false, isCold: true });
            } else {
              stillHot.push(t);
            }
          });

          const newColdPool = [...state.coldPool, ...toAge].slice(-state.maxColdPoolSize);

          return { hotPool: stillHot, coldPool: newColdPool };
        });
      },

      recoverFromCold: (modeId, count) => {
        set((state) => {
          // Find matching tracks in cold pool
          const matching = state.coldPool
            .filter((t) => t.detectedMode === modeId)
            .slice(0, count);

          if (matching.length === 0) return state;

          // Move to hot pool
          const matchingIds = new Set(matching.map((t) => t.id));
          const newColdPool = state.coldPool.filter((t) => !matchingIds.has(t.id));
          const recovered = matching.map((t) => ({ ...t, isHot: true, isCold: false, poolScore: 50 }));

          return {
            hotPool: [...state.hotPool, ...recovered],
            coldPool: newColdPool,
          };
        });
      },

      // =====================================
      // GETTERS FOR HOT/DISCOVERY
      // =====================================

      getHotTracks: (limit) => {
        const state = get();
        return [...state.hotPool]
          .sort((a, b) => b.poolScore - a.poolScore)
          .slice(0, limit);
      },

      getTracksForMode: (modeId, limit) => {
        const state = get();
        return state.hotPool
          .filter((t) => t.detectedMode === modeId)
          .sort((a, b) => b.poolScore - a.poolScore)
          .slice(0, limit);
      },

      getDiscoveryTracks: (currentTrack, limit) => {
        const state = get();
        const currentMode = matchTrackToMode({
          title: currentTrack.title,
          artist: currentTrack.artist,
          tags: currentTrack.tags,
          mood: currentTrack.mood,
        });

        // Prioritize same mode, then similar, then high score
        const scored = state.hotPool
          .filter((t) => t.id !== currentTrack.id)
          .map((t) => {
            let score = t.poolScore;

            // Boost same mode
            if (t.detectedMode === currentMode) score += 20;

            // Boost same artist
            if (t.artist.toLowerCase() === currentTrack.artist.toLowerCase()) score += 30;

            return { track: t, score };
          })
          .sort((a, b) => b.score - a.score);

        return scored.slice(0, limit).map((s) => s.track);
      },

      // =====================================
      // STATS
      // =====================================

      getPoolStats: () => {
        const state = get();
        return {
          hot: state.hotPool.length,
          cold: state.coldPool.length,
          total: state.hotPool.length + state.coldPool.length,
        };
      },
    }),
    {
      name: 'voyo-track-pool',
      version: 1,
    }
  )
);

// ============================================
// AUTO-MAINTENANCE
// ============================================

// Run pool maintenance every 5 minutes when app is active
let maintenanceInterval: ReturnType<typeof setInterval> | null = null;

export function startPoolMaintenance(): void {
  if (maintenanceInterval) return;

  maintenanceInterval = setInterval(() => {
    const store = useTrackPoolStore.getState();
    store.rescoreAllTracks();
    store.ageOutStale();
  }, 5 * 60 * 1000); // 5 minutes

  console.log('[VOYO Track Pool] Maintenance started');
}

export function stopPoolMaintenance(): void {
  if (maintenanceInterval) {
    clearInterval(maintenanceInterval);
    maintenanceInterval = null;
    console.log('[VOYO Track Pool] Maintenance stopped');
  }
}
