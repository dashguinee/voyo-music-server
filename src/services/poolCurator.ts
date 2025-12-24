/**
 * VOYO Music - Pool Curator Service
 *
 * CLEAN ARCHITECTURE:
 * Session tracking → Smart queries → Our backend search → Pool
 *
 * No Gemini (API expired), No Piped (500 errors)
 * Just our backend which returns VERIFIED working VOYO IDs
 */

import { Track } from '../types';
import { searchMusic, SearchResult } from './api';
import { useTrackPoolStore } from '../store/trackPoolStore';
import { getThumb } from '../utils/thumbnail';
import { safeAddToPool } from './trackVerifier';

// Curator Configuration
const CURATOR_TRIGGER_TRACKS = 5;  // Curate after every 5 tracks
const CURATOR_MIN_INTERVAL = 60000; // Minimum 1 minute between curations
const TRACKS_PER_SEARCH = 10;

// ============================================
// TYPES
// ============================================

interface TrackHistory {
  track: Track;
  playedAt: number;
  completionRate: number;
  wasSkipped: boolean;
  hadReaction: boolean;
}

interface ListeningSession {
  tracks: TrackHistory[];
  startTime: number;
  skipCount: number;
  reactionCount: number;
}

// ============================================
// SESSION STATE
// ============================================

let currentSession: ListeningSession = {
  tracks: [],
  startTime: Date.now(),
  skipCount: 0,
  reactionCount: 0,
};

let lastCurationTime = 0;
let isBootstrapped = false;

// ============================================
// BOOTSTRAP - Fresh start with working tracks
// ============================================

const BOOTSTRAP_QUERIES = [
  'Burna Boy 2024',
  'Asake latest',
  'Wizkid hits',
  'Ayra Starr',
  'Rema afrobeats',
  'Davido songs',
  'Amapiano 2024 hits',
  'Tyla water',
  'Afrobeats mix 2024',
  'Nigerian music trending',
];

/**
 * Clear stale pool data (bad IDs from old seed tracks)
 */
export function clearStalePool(): void {
  // Clear the persisted pool in localStorage
  localStorage.removeItem('voyo-track-pool');
  console.log('[Pool Curator] 🗑️ Cleared stale pool data');
}

/**
 * Bootstrap the pool with fresh, verified tracks from our backend
 */
export async function bootstrapPool(forceFresh: boolean = false): Promise<number> {
  if (isBootstrapped && !forceFresh) {
    console.log('[Pool Curator] Already bootstrapped');
    return 0;
  }

  // If forcing fresh, clear the old pool first
  if (forceFresh) {
    clearStalePool();
  }

  console.log('[Pool Curator] 🚀 Bootstrapping pool with fresh tracks...');

  const poolStore = useTrackPoolStore.getState();
  let totalAdded = 0;

  // Shuffle queries and take first 5 for variety
  const shuffledQueries = [...BOOTSTRAP_QUERIES].sort(() => Math.random() - 0.5).slice(0, 5);

  for (const query of shuffledQueries) {
    try {
      const results = await searchMusic(query, TRACKS_PER_SEARCH);
      const tracks = results.map(searchResultToTrack);

      // GATE: Validate each track BEFORE adding to pool
      let addedFromQuery = 0;
      for (const track of tracks) {
        const added = await safeAddToPool(track, 'trending');
        if (added) addedFromQuery++;
      }

      totalAdded += addedFromQuery;
      console.log(`[Pool Curator] ✅ "${query}" → ${addedFromQuery}/${tracks.length} tracks (validated)`);

      // Small delay to avoid hammering the API
      await new Promise(r => setTimeout(r, 200));
    } catch (error) {
      console.warn(`[Pool Curator] Query failed: "${query}"`, error);
    }
  }

  isBootstrapped = true;
  console.log(`[Pool Curator] 🎉 Bootstrap complete: ${totalAdded} fresh tracks in pool`);

  // Trigger recommendation refresh
  triggerRecommendationRefresh();

  return totalAdded;
}

/**
 * Force re-bootstrap (clears flag)
 */
export async function forceBootstrap(): Promise<number> {
  isBootstrapped = false;
  return bootstrapPool();
}

// ============================================
// SEARCH RESULT → TRACK CONVERSION
// ============================================

function searchResultToTrack(result: SearchResult): Track {
  return {
    id: result.voyoId,
    title: result.title,
    artist: result.artist,
    album: 'VOYO',
    trackId: result.voyoId,
    coverUrl: result.thumbnail || getThumb(result.voyoId),
    duration: result.duration,
    tags: inferTags(result.title, result.artist),
    mood: inferMood(result.title),
    region: inferRegion(result.artist),
    oyeScore: result.views || 0,
    createdAt: new Date().toISOString(),
  };
}

function inferTags(title: string, artist: string): string[] {
  const tags: string[] = [];
  const lower = (title + ' ' + artist).toLowerCase();

  if (lower.includes('amapiano') || lower.includes('piano')) tags.push('amapiano');
  if (lower.includes('afrobeat')) tags.push('afrobeats');
  if (lower.includes('dancehall')) tags.push('dancehall');
  if (lower.includes('rnb') || lower.includes('r&b')) tags.push('rnb');
  if (lower.includes('love') || lower.includes('heart')) tags.push('love');
  if (lower.includes('party') || lower.includes('club')) tags.push('party');

  // Default
  if (tags.length === 0) tags.push('afrobeats');

  return tags;
}

function inferMood(title: string): 'afro' | 'hype' | 'chill' | 'rnb' {
  const lower = title.toLowerCase();
  if (lower.includes('party') || lower.includes('dance')) return 'hype';
  if (lower.includes('love') || lower.includes('heart')) return 'rnb';
  if (lower.includes('chill') || lower.includes('relax')) return 'chill';
  return 'afro';
}

function inferRegion(artist: string): string {
  const lower = artist.toLowerCase();
  if (lower.includes('burna') || lower.includes('wizkid') || lower.includes('davido') || lower.includes('asake')) return 'NG';
  if (lower.includes('tyla') || lower.includes('kabza') || lower.includes('maphorisa')) return 'ZA';
  if (lower.includes('stonebwoy') || lower.includes('sarkodie')) return 'GH';
  return 'NG';
}

// ============================================
// SESSION TRACKING
// ============================================

/**
 * Record a track play in the current session
 */
export function recordTrackInSession(
  track: Track,
  completionRate: number = 100,
  wasSkipped: boolean = false,
  hadReaction: boolean = false
): void {
  currentSession.tracks.push({
    track,
    playedAt: Date.now(),
    completionRate,
    wasSkipped,
    hadReaction,
  });

  if (wasSkipped) currentSession.skipCount++;
  if (hadReaction) currentSession.reactionCount++;

  // Keep only last 10
  if (currentSession.tracks.length > 10) {
    currentSession.tracks = currentSession.tracks.slice(-10);
  }

  console.log(`[Pool Curator] Session: ${currentSession.tracks.length} tracks`);

  // Check if we should expand the pool
  checkCurationTrigger();
}

/**
 * Check if we should trigger pool expansion
 */
async function checkCurationTrigger(): Promise<void> {
  const now = Date.now();
  const timeSinceLastCuration = now - lastCurationTime;

  if (currentSession.tracks.length >= CURATOR_TRIGGER_TRACKS && timeSinceLastCuration >= CURATOR_MIN_INTERVAL) {
    await expandPool();
  }
}

// ============================================
// SMART POOL EXPANSION
// ============================================

/**
 * Expand pool based on current listening patterns
 */
export async function expandPool(): Promise<number> {
  lastCurationTime = Date.now();

  // Build smart queries based on recent tracks
  const queries = buildSmartQueries();

  console.log('[Pool Curator] 🔄 Expanding pool with:', queries);

  const poolStore = useTrackPoolStore.getState();
  let totalAdded = 0;

  for (const query of queries) {
    try {
      const results = await searchMusic(query, TRACKS_PER_SEARCH);
      const tracks = results.map(searchResultToTrack);

      // GATE: Validate each track BEFORE adding to pool
      for (const track of tracks) {
        const added = await safeAddToPool(track, 'related');
        if (added) totalAdded++;
      }
    } catch (error) {
      console.warn(`[Pool Curator] Expansion query failed: "${query}"`);
    }
  }

  console.log(`[Pool Curator] ✅ Expanded pool with ${totalAdded} validated tracks`);

  triggerRecommendationRefresh();

  return totalAdded;
}

/**
 * Build smart queries based on listening session
 */
function buildSmartQueries(): string[] {
  const queries: string[] = [];
  const recentTracks = currentSession.tracks.slice(-5);

  if (recentTracks.length === 0) {
    return ['afrobeats trending 2024'];
  }

  // Get unique artists from recent tracks
  const artists = [...new Set(recentTracks.map(h => h.track.artist))];

  // Get loved tracks (had reaction or high completion)
  const lovedTracks = recentTracks.filter(h => h.hadReaction || h.completionRate > 80);

  // Query 1: More from favorite artist
  if (lovedTracks.length > 0) {
    queries.push(`${lovedTracks[0].track.artist} songs`);
  } else if (artists.length > 0) {
    queries.push(`${artists[0]} latest`);
  }

  // Query 2: Related artist or genre
  const lastTrack = recentTracks[recentTracks.length - 1]?.track;
  if (lastTrack) {
    const tags = lastTrack.tags || [];
    if (tags.includes('amapiano')) {
      queries.push('amapiano hits 2024');
    } else if (tags.includes('rnb')) {
      queries.push('afro rnb songs');
    } else {
      queries.push('afrobeats trending');
    }
  }

  // Query 3: Discovery - similar but new
  if (artists.length > 0) {
    queries.push(`artists like ${artists[0]}`);
  }

  return queries.slice(0, 3); // Max 3 queries
}

// ============================================
// HELPERS
// ============================================

function triggerRecommendationRefresh(): void {
  import('../store/playerStore').then(({ usePlayerStore }) => {
    usePlayerStore.getState().refreshRecommendations?.();
  }).catch(() => {});
}

/**
 * Reset session
 */
export function resetSession(): void {
  currentSession = {
    tracks: [],
    startTime: Date.now(),
    skipCount: 0,
    reactionCount: 0,
  };
}

/**
 * Get session stats
 */
export function getSessionStats() {
  return {
    trackCount: currentSession.tracks.length,
    skipCount: currentSession.skipCount,
    reactionCount: currentSession.reactionCount,
    isBootstrapped,
    lastCurationTime,
  };
}

// ============================================
// AUTO-BOOTSTRAP ON IMPORT
// ============================================

// Check pool size and bootstrap if needed
setTimeout(() => {
  const poolStore = useTrackPoolStore.getState();
  const stats = poolStore.getPoolStats();

  // If pool has fewer than 20 tracks, bootstrap
  if (stats.hot < 20) {
    console.log(`[Pool Curator] Pool only has ${stats.hot} tracks, bootstrapping...`);
    bootstrapPool();
  } else {
    console.log(`[Pool Curator] Pool has ${stats.hot} tracks, ready`);
    isBootstrapped = true;
  }
}, 2000);

// ============================================
// DEBUG HELPERS (available in browser console)
// ============================================

if (typeof window !== 'undefined') {
  (window as any).voyoPool = {
    bootstrap: () => bootstrapPool(false),
    forceBootstrap: () => bootstrapPool(true),
    clearStale: clearStalePool,
    expand: expandPool,
    stats: getSessionStats,
    reset: resetSession,
  };
  console.log('🎵 [Pool Curator] Debug tools: window.voyoPool.bootstrap() / .forceBootstrap() / .clearStale()');
}

export default {
  bootstrapPool,
  forceBootstrap,
  clearStalePool,
  expandPool,
  recordTrackInSession,
  resetSession,
  getSessionStats,
};
