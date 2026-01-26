/**
 * VOYO Preload Manager - Professional-grade next-track preloading
 *
 * Inspired by Spotify/YouTube Music for gapless playback.
 *
 * STRATEGY (like major platforms):
 * 1. Start preloading IMMEDIATELY when next track is known
 * 2. Use a hidden audio element that actually buffers the audio data
 * 3. When track changes, audio is already buffered → instant playback
 * 4. For R2 misses, extract via Edge Worker and cache locally
 *
 * PRELOAD SOURCES (priority order):
 * 1. Local IndexedDB cache → Fastest, already downloaded
 * 2. R2 collective cache → Fast, 170K+ shared tracks
 * 3. Edge Worker extraction → Extract, cache, then buffer
 *
 * KEY DIFFERENCE from basic preloading:
 * - We actually LOAD the audio data into the browser's buffer
 * - Not just creating an element, but calling load() and waiting for canplaythrough
 * - This is how Spotify achieves gapless playback
 */

import { checkR2Cache } from './api';

// Edge Worker for extraction (FREE - replaces Fly.io)
const EDGE_WORKER_URL = 'https://voyo-edge.dash-webtv.workers.dev';

// Decode VOYO ID to YouTube ID
function decodeVoyoId(voyoId: string): string {
  if (!voyoId.startsWith('vyo_')) {
    return voyoId;
  }
  const encoded = voyoId.substring(4);
  let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  try {
    return atob(base64);
  } catch {
    return voyoId;
  }
}

export interface PreloadedTrack {
  trackId: string;
  normalizedId: string;
  source: 'cached' | 'r2';
  url: string | null;
  audioElement: HTMLAudioElement | null;
  isReady: boolean;
  preloadedAt: number;
}

interface PreloadManager {
  preloaded: PreloadedTrack | null;
  isPreloading: boolean;
  lastPreloadedId: string | null;
}

const state: PreloadManager = {
  preloaded: null,
  isPreloading: false,
  lastPreloadedId: null,
};

// Keep reference to abort controller for cleanup
let preloadAbortController: AbortController | null = null;

/**
 * Preload the next track for instant playback
 * Call this at ~70% progress of current track
 */
export async function preloadNextTrack(
  trackId: string,
  checkLocalCache: (id: string) => Promise<string | null>
): Promise<PreloadedTrack | null> {
  const normalizedId = decodeVoyoId(trackId);

  // Already preloading this track
  if (state.isPreloading && state.lastPreloadedId === normalizedId) {
    console.log('🔮 [Preload] Already preloading:', normalizedId);
    return state.preloaded;
  }

  // Already preloaded this track
  if (state.preloaded?.normalizedId === normalizedId && state.preloaded.isReady) {
    console.log('🔮 [Preload] Already preloaded:', normalizedId);
    return state.preloaded;
  }

  // Cancel previous preload
  if (preloadAbortController) {
    preloadAbortController.abort();
  }
  preloadAbortController = new AbortController();
  const signal = preloadAbortController.signal;

  // Cleanup previous preloaded track
  cleanupPreloaded();

  state.isPreloading = true;
  state.lastPreloadedId = normalizedId;

  console.log('🔮 [Preload] Starting preload for:', normalizedId);

  try {
    // STEP 1: Check local cache (IndexedDB) - fastest
    const cachedUrl = await checkLocalCache(trackId);

    if (signal.aborted) return null;

    if (cachedUrl) {
      console.log('🔮 [Preload] Found in local cache, preloading audio element');
      const audioEl = createPreloadAudioElement(cachedUrl, signal);

      state.preloaded = {
        trackId,
        normalizedId,
        source: 'cached',
        url: cachedUrl,
        audioElement: audioEl,
        isReady: false,
        preloadedAt: Date.now(),
      };

      // Wait for audio to be ready
      await waitForAudioReady(audioEl, signal);

      if (signal.aborted) {
        audioEl.src = '';
        return null;
      }

      state.preloaded.isReady = true;
      state.isPreloading = false;
      console.log('🔮 [Preload] ✅ Local cache preload complete');
      return state.preloaded;
    }

    // STEP 2: Check R2 collective cache
    const r2Result = await checkR2Cache(normalizedId);

    if (signal.aborted) return null;

    if (r2Result.exists && r2Result.url) {
      console.log('🔮 [Preload] Found in R2, preloading audio element');
      const audioEl = createPreloadAudioElement(r2Result.url, signal);

      state.preloaded = {
        trackId,
        normalizedId,
        source: 'r2',
        url: r2Result.url,
        audioElement: audioEl,
        isReady: false,
        preloadedAt: Date.now(),
      };

      // Wait for audio to be ready (with shorter timeout for R2)
      await waitForAudioReady(audioEl, signal, 5000);

      if (signal.aborted) {
        audioEl.src = '';
        return null;
      }

      state.preloaded.isReady = true;
      state.isPreloading = false;
      console.log('🔮 [Preload] ✅ R2 preload complete');
      return state.preloaded;
    }

    // STEP 3: Get YouTube direct URL and preload
    // Browser fetches from YouTube CDN directly
    console.log('🔮 [Preload] Not in cache/R2, getting YouTube stream URL');

    try {
      const streamResponse = await fetch(`${EDGE_WORKER_URL}/stream?v=${normalizedId}`);

      if (signal.aborted) return null;

      const streamData = await streamResponse.json();

      if (!streamData.url) {
        console.warn('🔮 [Preload] No stream URL available for:', normalizedId);
        state.isPreloading = false;
        return null;
      }

      const audioEl = createPreloadAudioElement(streamData.url, signal);

      state.preloaded = {
        trackId,
        normalizedId,
        source: 'r2', // Treat as r2 for consistent handling
        url: streamData.url,
        audioElement: audioEl,
        isReady: false,
        preloadedAt: Date.now(),
      };

      // Wait for audio to buffer enough to play
      await waitForAudioReady(audioEl, signal, 8000);

      if (signal.aborted) {
        audioEl.src = '';
        return null;
      }

      state.preloaded.isReady = true;
      state.isPreloading = false;
      console.log('🔮 [Preload] ✅ YouTube direct stream preload complete');
      return state.preloaded;
    } catch (extractError) {
      console.warn('🔮 [Preload] Stream preload error:', extractError);
      state.isPreloading = false;
      return null;
    }

  } catch (error) {
    console.warn('🔮 [Preload] Error:', error);
    state.isPreloading = false;
    return null;
  }
}

/**
 * Get preloaded track if available for the given trackId
 */
export function getPreloadedTrack(trackId: string): PreloadedTrack | null {
  const normalizedId = decodeVoyoId(trackId);

  if (state.preloaded?.normalizedId === normalizedId && state.preloaded.isReady) {
    return state.preloaded;
  }

  return null;
}

/**
 * Consume the preloaded audio element (transfers ownership to caller)
 * Returns the element and clears it from preload cache
 */
export function consumePreloadedAudio(trackId: string): HTMLAudioElement | null {
  const normalizedId = decodeVoyoId(trackId);

  if (state.preloaded?.normalizedId === normalizedId && state.preloaded.audioElement) {
    const audioEl = state.preloaded.audioElement;
    state.preloaded.audioElement = null; // Transfer ownership
    console.log('🔮 [Preload] Consumed preloaded audio element');
    return audioEl;
  }

  return null;
}

/**
 * Check if a track is currently preloaded and ready
 */
export function isPreloaded(trackId: string): boolean {
  const normalizedId = decodeVoyoId(trackId);
  return state.preloaded?.normalizedId === normalizedId && state.preloaded.isReady;
}

/**
 * Get current preload status
 */
export function getPreloadStatus(): {
  isPreloading: boolean;
  preloadedId: string | null;
  source: 'cached' | 'r2' | null;
} {
  return {
    isPreloading: state.isPreloading,
    preloadedId: state.preloaded?.normalizedId || null,
    source: state.preloaded?.source || null,
  };
}

/**
 * Cleanup preloaded resources
 */
export function cleanupPreloaded(): void {
  if (state.preloaded?.audioElement) {
    state.preloaded.audioElement.pause();
    state.preloaded.audioElement.src = '';
    state.preloaded.audioElement = null;
  }
  state.preloaded = null;
}

/**
 * Cancel any in-progress preload
 */
export function cancelPreload(): void {
  if (preloadAbortController) {
    preloadAbortController.abort();
    preloadAbortController = null;
  }
  state.isPreloading = false;
}

// ============================================
// INTERNAL HELPERS
// ============================================

function createPreloadAudioElement(url: string, signal: AbortSignal): HTMLAudioElement {
  const audio = new Audio();
  audio.preload = 'auto';
  audio.volume = 0; // Silent during preload
  audio.src = url;

  // Cleanup on abort
  signal.addEventListener('abort', () => {
    audio.pause();
    audio.src = '';
  });

  return audio;
}

function waitForAudioReady(
  audio: HTMLAudioElement,
  signal: AbortSignal,
  timeout: number = 10000
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      console.log('🔮 [Preload] Timeout waiting for audio ready, proceeding anyway');
      resolve(); // Resolve anyway - partial preload is better than none
    }, timeout);

    const cleanup = () => {
      clearTimeout(timeoutId);
      audio.removeEventListener('canplaythrough', onReady);
      audio.removeEventListener('error', onError);
    };

    const onReady = () => {
      cleanup();
      resolve();
    };

    const onError = (e: Event) => {
      cleanup();
      console.warn('🔮 [Preload] Audio error during preload:', e);
      resolve(); // Still resolve - we tried
    };

    // Check if already ready
    if (audio.readyState >= 4) {
      clearTimeout(timeoutId);
      resolve();
      return;
    }

    audio.addEventListener('canplaythrough', onReady, { once: true });
    audio.addEventListener('error', onError, { once: true });

    // Handle abort
    signal.addEventListener('abort', () => {
      cleanup();
      reject(new Error('Preload aborted'));
    });

    // Trigger load
    audio.load();
  });
}
