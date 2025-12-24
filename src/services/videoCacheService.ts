/**
 * VOYO Video Cache Service
 *
 * Efficiently caches short video loops for background playback.
 * Reduces data usage by ~75% compared to streaming full videos.
 *
 * Architecture:
 * 1. First play: Fetch video segment via proxy/API
 * 2. Store in IndexedDB (persists across sessions)
 * 3. Subsequent plays: Load from cache (zero network)
 * 4. Fallback: Static thumbnail with effects
 */

const DB_NAME = 'voyo-video-cache';
const DB_VERSION = 1;
const STORE_NAME = 'video-loops';
const MAX_CACHE_SIZE = 100 * 1024 * 1024; // 100MB max cache
const LOOP_DURATION = 15; // seconds

// Invidious instances for video extraction (rotate on failure)
const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.privacyredirect.com',
  'https://invidious.nerdvpn.de',
  'https://yt.artemislena.eu',
];

interface CachedVideo {
  videoId: string;
  blob: Blob;
  timestamp: number;
  size: number;
}

interface CacheStatus {
  cached: boolean;
  loading: boolean;
  error: string | null;
  progress: number;
}

class VideoCacheService {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;
  private statusListeners: Map<string, Set<(status: CacheStatus) => void>> = new Map();
  private activeDownloads: Map<string, AbortController> = new Map();

  constructor() {
    this.initPromise = this.initDB();
  }

  // ============================================
  // DATABASE INITIALIZATION
  // ============================================
  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[VideoCache] Failed to open database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[VideoCache] Database initialized');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'videoId' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          console.log('[VideoCache] Object store created');
        }
      };
    });
  }

  private async ensureDB(): Promise<IDBDatabase> {
    if (this.initPromise) {
      await this.initPromise;
    }
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  // ============================================
  // STATUS MANAGEMENT
  // ============================================
  private updateStatus(videoId: string, status: Partial<CacheStatus>) {
    const listeners = this.statusListeners.get(videoId);
    if (listeners) {
      const fullStatus: CacheStatus = {
        cached: false,
        loading: false,
        error: null,
        progress: 0,
        ...status,
      };
      listeners.forEach(listener => listener(fullStatus));
    }
  }

  subscribeToStatus(videoId: string, callback: (status: CacheStatus) => void): () => void {
    if (!this.statusListeners.has(videoId)) {
      this.statusListeners.set(videoId, new Set());
    }
    this.statusListeners.get(videoId)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.statusListeners.get(videoId)?.delete(callback);
    };
  }

  // ============================================
  // CACHE OPERATIONS
  // ============================================
  async isVideoCached(videoId: string): Promise<boolean> {
    try {
      const db = await this.ensureDB();
      return new Promise((resolve) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(videoId);

        request.onsuccess = () => {
          resolve(!!request.result);
        };

        request.onerror = () => {
          resolve(false);
        };
      });
    } catch {
      return false;
    }
  }

  async getCachedVideo(videoId: string): Promise<string | null> {
    try {
      const db = await this.ensureDB();
      return new Promise((resolve) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(videoId);

        request.onsuccess = () => {
          const result = request.result as CachedVideo | undefined;
          if (result) {
            const url = URL.createObjectURL(result.blob);
            console.log(`[VideoCache] Loaded from cache: ${videoId}`);
            resolve(url);
          } else {
            resolve(null);
          }
        };

        request.onerror = () => {
          resolve(null);
        };
      });
    } catch {
      return null;
    }
  }

  private async storeVideo(videoId: string, blob: Blob): Promise<void> {
    try {
      // Enforce cache size limit first
      await this.enforceCacheLimit(blob.size);

      const db = await this.ensureDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        const data: CachedVideo = {
          videoId,
          blob,
          timestamp: Date.now(),
          size: blob.size,
        };

        const request = store.put(data);

        request.onsuccess = () => {
          console.log(`[VideoCache] Stored: ${videoId} (${(blob.size / 1024 / 1024).toFixed(2)}MB)`);
          resolve();
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('[VideoCache] Failed to store video:', error);
    }
  }

  private async enforceCacheLimit(incomingSize: number): Promise<void> {
    try {
      const db = await this.ensureDB();
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('timestamp');

      // Get all entries sorted by timestamp
      const request = index.openCursor();
      let totalSize = incomingSize;
      const toDelete: string[] = [];

      return new Promise((resolve) => {
        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) {
            const entry = cursor.value as CachedVideo;
            totalSize += entry.size;

            // Mark old entries for deletion if over limit
            if (totalSize > MAX_CACHE_SIZE) {
              toDelete.push(entry.videoId);
            }
            cursor.continue();
          } else {
            // Delete marked entries
            toDelete.forEach(id => store.delete(id));
            if (toDelete.length > 0) {
              console.log(`[VideoCache] Evicted ${toDelete.length} old entries`);
            }
            resolve();
          }
        };

        request.onerror = () => resolve();
      });
    } catch {
      // Ignore errors in cache management
    }
  }

  // ============================================
  // VIDEO FETCHING
  // ============================================
  private async fetchVideoFromInvidious(videoId: string, signal: AbortSignal): Promise<Blob | null> {
    for (const instance of INVIDIOUS_INSTANCES) {
      try {
        // Get video info
        const infoUrl = `${instance}/api/v1/videos/${videoId}`;
        const infoResponse = await fetch(infoUrl, { signal });

        if (!infoResponse.ok) continue;

        const info = await infoResponse.json();

        // Find a suitable format (prefer low quality for loops)
        const formats = info.formatStreams || [];
        const adaptiveFormats = info.adaptiveFormats || [];

        // Prefer 360p or 480p for efficiency
        const videoFormat = formats.find((f: any) =>
          f.qualityLabel === '360p' || f.qualityLabel === '480p'
        ) || formats.find((f: any) =>
          f.type?.includes('video/mp4')
        ) || adaptiveFormats.find((f: any) =>
          f.type?.includes('video/mp4') && f.qualityLabel
        );

        if (!videoFormat?.url) continue;

        // Fetch the video
        this.updateStatus(videoId, { loading: true, progress: 10 });

        const videoResponse = await fetch(videoFormat.url, { signal });

        if (!videoResponse.ok) continue;

        const contentLength = videoResponse.headers.get('content-length');
        const total = contentLength ? parseInt(contentLength, 10) : 0;

        // Stream the response with progress
        const reader = videoResponse.body?.getReader();
        if (!reader) continue;

        const chunks: Uint8Array[] = [];
        let received = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          chunks.push(value);
          received += value.length;

          // Only download first ~15 seconds worth (estimate ~1MB for 15s at 360p)
          const maxBytes = 2 * 1024 * 1024; // 2MB max
          if (received >= maxBytes) {
            console.log(`[VideoCache] Truncated at ${(received / 1024 / 1024).toFixed(2)}MB`);
            break;
          }

          if (total > 0) {
            const progress = Math.min(90, Math.round((received / Math.min(total, maxBytes)) * 80) + 10);
            this.updateStatus(videoId, { loading: true, progress });
          }
        }

        const blob = new Blob(chunks, { type: 'video/mp4' });
        console.log(`[VideoCache] Fetched: ${videoId} (${(blob.size / 1024 / 1024).toFixed(2)}MB)`);
        return blob;

      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          throw error;
        }
        console.warn(`[VideoCache] Instance failed: ${instance}`, error);
        continue;
      }
    }

    return null;
  }

  // ============================================
  // PUBLIC API
  // ============================================
  async getVideoUrl(videoId: string): Promise<string | null> {
    // Check cache first
    const cached = await this.getCachedVideo(videoId);
    if (cached) {
      this.updateStatus(videoId, { cached: true, loading: false, progress: 100 });
      return cached;
    }

    // Already downloading?
    if (this.activeDownloads.has(videoId)) {
      return null;
    }

    // Start download
    const controller = new AbortController();
    this.activeDownloads.set(videoId, controller);

    try {
      this.updateStatus(videoId, { loading: true, progress: 0 });

      const blob = await this.fetchVideoFromInvidious(videoId, controller.signal);

      if (blob) {
        await this.storeVideo(videoId, blob);
        const url = URL.createObjectURL(blob);
        this.updateStatus(videoId, { cached: true, loading: false, progress: 100 });
        return url;
      } else {
        this.updateStatus(videoId, { loading: false, error: 'Failed to fetch video' });
        return null;
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        this.updateStatus(videoId, { loading: false, error: (error as Error).message });
      }
      return null;
    } finally {
      this.activeDownloads.delete(videoId);
    }
  }

  cancelDownload(videoId: string): void {
    const controller = this.activeDownloads.get(videoId);
    if (controller) {
      controller.abort();
      this.activeDownloads.delete(videoId);
      this.updateStatus(videoId, { loading: false });
    }
  }

  async clearCache(): Promise<void> {
    try {
      const db = await this.ensureDB();
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.clear();
      console.log('[VideoCache] Cache cleared');
    } catch (error) {
      console.error('[VideoCache] Failed to clear cache:', error);
    }
  }

  async getCacheStats(): Promise<{ count: number; size: number }> {
    try {
      const db = await this.ensureDB();
      return new Promise((resolve) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
          const entries = request.result as CachedVideo[];
          const size = entries.reduce((acc, e) => acc + e.size, 0);
          resolve({ count: entries.length, size });
        };

        request.onerror = () => {
          resolve({ count: 0, size: 0 });
        };
      });
    } catch {
      return { count: 0, size: 0 };
    }
  }
}

// Singleton export
export const videoCacheService = new VideoCacheService();
export type { CacheStatus };
