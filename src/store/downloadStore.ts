/**
 * VOYO Download Store - Zustand state for local caching
 *
 * BOOST SYSTEM:
 * - Manual Boost: User clicks "⚡ Boost HD" to download to IndexedDB
 * - Auto-Boost: After 3 manual boosts, prompt to enable auto-download
 * - All downloads go to USER's device (IndexedDB), not server
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  isTrackCached,
  getCachedTrackUrl,
  downloadTrack,
  getCachedTracks,
  getCacheSize,
  deleteTrack,
  clearCache,
  getDownloadSetting,
  setDownloadSetting,
  shouldAutoDownload,
  type DownloadSetting,
} from '../services/downloadManager';

// API URL for proxy downloads
const API_URL = 'https://voyo-music-api.fly.dev';

interface DownloadProgress {
  trackId: string;
  progress: number;
  status: 'queued' | 'downloading' | 'complete' | 'failed';
  error?: string;
}

interface CachedTrackInfo {
  id: string;
  title: string;
  artist: string;
  size: number;
  quality: 'standard' | 'boosted';
  downloadedAt: number;
}

interface DownloadStore {
  // State
  downloads: Map<string, DownloadProgress>;
  cachedTracks: CachedTrackInfo[];
  cacheSize: number;
  downloadSetting: DownloadSetting;
  isInitialized: boolean;

  // Boost tracking (persisted)
  manualBoostCount: number;
  autoBoostEnabled: boolean;
  showAutoBoostPrompt: boolean;

  // Actions
  initialize: () => Promise<void>;
  checkCache: (trackId: string) => Promise<string | null>;

  // MANUAL BOOST - User triggers download
  boostTrack: (trackId: string, title: string, artist: string, duration: number, thumbnail: string) => Promise<void>;

  // Legacy queue (for auto-boost when enabled)
  queueDownload: (trackId: string, title: string, artist: string, duration: number, thumbnail: string) => void;
  processQueue: () => Promise<void>;

  getDownloadStatus: (trackId: string) => DownloadProgress | undefined;
  isTrackBoosted: (trackId: string) => Promise<boolean>;
  removeDownload: (trackId: string) => Promise<void>;
  clearAllDownloads: () => Promise<void>;
  updateSetting: (setting: DownloadSetting) => void;
  refreshCacheInfo: () => Promise<void>;

  // Auto-boost management
  enableAutoBoost: () => void;
  disableAutoBoost: () => void;
  dismissAutoBoostPrompt: () => void;
}

// Download queue (for auto-boost)
const downloadQueue: Array<{
  trackId: string;
  title: string;
  artist: string;
  duration: number;
  thumbnail: string;
}> = [];

let isProcessing = false;

/**
 * Decode VOYO ID to YouTube ID
 */
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

export const useDownloadStore = create<DownloadStore>((set, get) => ({
  downloads: new Map(),
  cachedTracks: [],
  cacheSize: 0,
  downloadSetting: 'wifi-only',
  isInitialized: false,

  // Boost tracking
  manualBoostCount: parseInt(localStorage.getItem('voyo-manual-boost-count') || '0', 10),
  autoBoostEnabled: localStorage.getItem('voyo-auto-boost') === 'true',
  showAutoBoostPrompt: false,

  initialize: async () => {
    if (get().isInitialized) return;

    const setting = getDownloadSetting();
    const tracks = await getCachedTracks();
    const size = await getCacheSize();

    set({
      downloadSetting: setting,
      cachedTracks: tracks.map(t => ({
        id: t.id,
        title: t.title,
        artist: t.artist,
        size: t.size,
        quality: t.quality,
        downloadedAt: t.downloadedAt,
      })),
      cacheSize: size,
      isInitialized: true,
    });
  },

  checkCache: async (trackId: string) => {
    const cached = await isTrackCached(trackId);
    if (cached) {
      const url = await getCachedTrackUrl(trackId);
      if (url) {
        return url;
      }
    }
    return null;
  },

  // ⚡ MANUAL BOOST - User clicks button to download
  boostTrack: async (trackId, title, artist, duration, thumbnail) => {
    const { downloads, manualBoostCount, autoBoostEnabled } = get();

    // Already downloading or complete?
    const existing = downloads.get(trackId);
    if (existing && (existing.status === 'downloading' || existing.status === 'complete')) {
      return;
    }

    // Check if already cached
    const cached = await isTrackCached(trackId);
    if (cached) {
      const newDownloads = new Map(downloads);
      newDownloads.set(trackId, { trackId, progress: 100, status: 'complete' });
      set({ downloads: newDownloads });
      return;
    }

    // Update status to downloading
    const newDownloads = new Map(downloads);
    newDownloads.set(trackId, { trackId, progress: 0, status: 'downloading' });
    set({ downloads: newDownloads });

    try {
      // Build proxy URL - server will fetch and pipe to us
      const youtubeId = decodeVoyoId(trackId);
      const proxyUrl = `${API_URL}/proxy?v=${youtubeId}&quality=high`;

      // Download with progress tracking (throttled to 500ms)
      let lastUpdateTime = 0;
      const success = await downloadTrack(
        trackId,
        proxyUrl,
        { title, artist, duration, thumbnail, quality: 'boosted' },
        'boosted',
        (progress) => {
          const now = Date.now();
          if (now - lastUpdateTime < 500) return; // Throttle updates
          lastUpdateTime = now;

          const currentDownloads = new Map(get().downloads);
          currentDownloads.set(trackId, {
            trackId,
            progress,
            status: 'downloading',
          });
          set({ downloads: currentDownloads });
        }
      );

      if (success) {
        const finalDownloads = new Map(get().downloads);
        finalDownloads.set(trackId, { trackId, progress: 100, status: 'complete' });

        // Increment manual boost count
        const newCount = manualBoostCount + 1;
        localStorage.setItem('voyo-manual-boost-count', String(newCount));

        // Show auto-boost prompt after 3 manual boosts (if not already enabled)
        const shouldPrompt = newCount >= 3 && !autoBoostEnabled && !localStorage.getItem('voyo-auto-boost-dismissed');

        set({
          downloads: finalDownloads,
          manualBoostCount: newCount,
          showAutoBoostPrompt: shouldPrompt,
        });

        // Refresh cache info
        await get().refreshCacheInfo();
      } else {
        throw new Error('Download failed');
      }

    } catch (error) {
      const failedDownloads = new Map(get().downloads);
      failedDownloads.set(trackId, {
        trackId,
        progress: 0,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Download failed',
      });
      set({ downloads: failedDownloads });
    }
  },

  // Legacy queue for auto-boost
  queueDownload: (trackId, title, artist, duration, thumbnail) => {
    const { downloads, autoBoostEnabled } = get();

    // Only auto-queue if auto-boost is enabled
    if (!autoBoostEnabled) {
      return;
    }

    // Don't queue if already downloading or complete
    const existing = downloads.get(trackId);
    if (existing && (existing.status === 'downloading' || existing.status === 'complete')) {
      return;
    }

    // Check network settings
    if (!shouldAutoDownload()) {
      return;
    }

    // Add to queue
    downloadQueue.push({ trackId, title, artist, duration, thumbnail });

    // Update state
    const newDownloads = new Map(downloads);
    newDownloads.set(trackId, { trackId, progress: 0, status: 'queued' });
    set({ downloads: newDownloads });

    // Start processing
    get().processQueue();
  },

  processQueue: async () => {
    if (isProcessing || downloadQueue.length === 0) return;

    isProcessing = true;

    while (downloadQueue.length > 0) {
      const item = downloadQueue.shift();
      if (!item) continue;

      const { trackId, title, artist, duration, thumbnail } = item;

      // Use boostTrack for actual download
      await get().boostTrack(trackId, title, artist, duration, thumbnail);

      // Small delay between downloads
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    isProcessing = false;
  },

  getDownloadStatus: (trackId) => {
    return get().downloads.get(trackId);
  },

  isTrackBoosted: async (trackId: string) => {
    return isTrackCached(trackId);
  },

  removeDownload: async (trackId) => {
    await deleteTrack(trackId);

    const newDownloads = new Map(get().downloads);
    newDownloads.delete(trackId);
    set({ downloads: newDownloads });

    await get().refreshCacheInfo();
  },

  clearAllDownloads: async () => {
    await clearCache();
    set({
      downloads: new Map(),
      cachedTracks: [],
      cacheSize: 0,
    });
  },

  updateSetting: (setting) => {
    setDownloadSetting(setting);
    set({ downloadSetting: setting });
  },

  refreshCacheInfo: async () => {
    const tracks = await getCachedTracks();
    const size = await getCacheSize();

    set({
      cachedTracks: tracks.map(t => ({
        id: t.id,
        title: t.title,
        artist: t.artist,
        size: t.size,
        quality: t.quality,
        downloadedAt: t.downloadedAt,
      })),
      cacheSize: size,
    });
  },

  // Auto-boost management
  enableAutoBoost: () => {
    localStorage.setItem('voyo-auto-boost', 'true');
    set({ autoBoostEnabled: true, showAutoBoostPrompt: false });
  },

  disableAutoBoost: () => {
    localStorage.setItem('voyo-auto-boost', 'false');
    set({ autoBoostEnabled: false });
  },

  dismissAutoBoostPrompt: () => {
    localStorage.setItem('voyo-auto-boost-dismissed', 'true');
    set({ showAutoBoostPrompt: false });
  },
}));
