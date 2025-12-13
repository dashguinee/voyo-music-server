/**
 * VOYO Music - Smart Audio Engine
 * Spotify-beating prebuffer system with adaptive bitrate and intelligent caching
 *
 * Key Features:
 * - 15-second initial buffer target
 * - 3-second emergency threshold
 * - Prefetch next track at 50% progress
 * - Adaptive bitrate based on network speed
 * - Smart buffer health monitoring
 */

export type BitrateLevel = 'low' | 'medium' | 'high';
export type BufferStatus = 'healthy' | 'warning' | 'emergency';

export interface BufferHealth {
  current: number;        // Current buffer in seconds
  target: number;         // Target buffer in seconds
  status: BufferStatus;   // Overall health status
  percentage: number;     // 0-100 how full the buffer is
}

export interface NetworkStats {
  speed: number;          // Estimated speed in kbps
  latency: number;        // Average latency in ms
  lastMeasured: number;   // Timestamp of last measurement
}

export interface PrefetchStatus {
  trackId: string;
  status: 'pending' | 'loading' | 'ready' | 'failed';
  progress: number;       // 0-100
  startTime: number;
  endTime?: number;
}

interface DownloadMeasurement {
  bytes: number;
  duration: number;       // in ms
  timestamp: number;
}

class AudioEngine {
  // Buffer configuration
  private readonly BUFFER_TARGET = 15;           // Target 15 seconds buffered
  private readonly EMERGENCY_THRESHOLD = 3;      // Emergency if < 3 seconds
  private readonly WARNING_THRESHOLD = 8;        // Warning if < 8 seconds
  private readonly PREFETCH_PROGRESS = 50;       // Start prefetch at 50% track progress

  // Bitrate thresholds (kbps)
  private readonly BITRATE_HIGH_THRESHOLD = 1000;   // > 1 Mbps
  private readonly BITRATE_MEDIUM_THRESHOLD = 400;  // > 400 kbps

  // Quality levels (match backend expectations)
  private readonly BITRATE_QUALITY: Record<BitrateLevel, number> = {
    low: 64,      // 64 kbps
    medium: 128,  // 128 kbps
    high: 256,    // 256 kbps
  };

  // Network monitoring
  private networkStats: NetworkStats = {
    speed: 1000,        // Assume decent connection initially
    latency: 100,       // Assume 100ms latency initially
    lastMeasured: 0,
  };

  private downloadMeasurements: DownloadMeasurement[] = [];
  private readonly MAX_MEASUREMENTS = 10;  // Keep last 10 measurements

  // Preload cache - stores blob URLs for preloaded tracks
  private preloadCache: Map<string, string> = new Map();
  private readonly MAX_CACHE_SIZE = 10;  // LRU cache limit

  // Prefetch tracking
  private activePrefetch: Map<string, PrefetchStatus> = new Map();
  private prefetchAbortController: AbortController | null = null;

  // Singleton pattern
  private static instance: AudioEngine | null = null;

  private constructor() {
    // Audio engine initialized
  }

  static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine();
    }
    return AudioEngine.instance;
  }

  /**
   * Measure current buffer health for an audio element
   */
  getBufferHealth(audioElement: HTMLMediaElement | null): BufferHealth {
    if (!audioElement) {
      return {
        current: 0,
        target: this.BUFFER_TARGET,
        status: 'emergency',
        percentage: 0,
      };
    }

    const buffered = audioElement.buffered;
    const currentTime = audioElement.currentTime;

    let bufferAhead = 0;

    // Find how much is buffered ahead of current playback position
    for (let i = 0; i < buffered.length; i++) {
      const start = buffered.start(i);
      const end = buffered.end(i);

      if (start <= currentTime && end > currentTime) {
        bufferAhead = end - currentTime;
        break;
      }
    }

    // Calculate status
    let status: BufferStatus = 'healthy';
    if (bufferAhead < this.EMERGENCY_THRESHOLD) {
      status = 'emergency';
    } else if (bufferAhead < this.WARNING_THRESHOLD) {
      status = 'warning';
    }

    // Calculate percentage (capped at 100%)
    const percentage = Math.min(100, (bufferAhead / this.BUFFER_TARGET) * 100);

    return {
      current: bufferAhead,
      target: this.BUFFER_TARGET,
      status,
      percentage: Math.round(percentage),
    };
  }

  /**
   * Record a download measurement for network speed estimation
   */
  recordDownloadMeasurement(bytes: number, durationMs: number): void {
    const measurement: DownloadMeasurement = {
      bytes,
      duration: durationMs,
      timestamp: Date.now(),
    };

    this.downloadMeasurements.push(measurement);

    // Keep only last N measurements
    if (this.downloadMeasurements.length > this.MAX_MEASUREMENTS) {
      this.downloadMeasurements.shift();
    }

    // Update network stats
    this.updateNetworkStats();
  }

  /**
   * Update network statistics based on recent measurements
   */
  private updateNetworkStats(): void {
    if (this.downloadMeasurements.length === 0) return;

    // Calculate average speed from recent measurements
    let totalSpeed = 0;
    let count = 0;

    const now = Date.now();
    const recentThreshold = 30000; // Only consider measurements from last 30s

    for (const measurement of this.downloadMeasurements) {
      if (now - measurement.timestamp < recentThreshold) {
        // Convert to kbps: (bytes / duration_ms) * 8 * 1000
        const speedKbps = (measurement.bytes / measurement.duration) * 8;
        totalSpeed += speedKbps;
        count++;
      }
    }

    if (count > 0) {
      this.networkStats.speed = Math.round(totalSpeed / count);
      this.networkStats.lastMeasured = now;

    }
  }

  /**
   * Estimate current network speed
   */
  estimateNetworkSpeed(): number {
    return this.networkStats.speed;
  }

  /**
   * Get current network statistics
   */
  getNetworkStats(): NetworkStats {
    return { ...this.networkStats };
  }

  /**
   * Select optimal bitrate based on current network conditions
   */
  selectOptimalBitrate(): BitrateLevel {
    const speed = this.networkStats.speed;

    if (speed >= this.BITRATE_HIGH_THRESHOLD) {
      return 'high';
    } else if (speed >= this.BITRATE_MEDIUM_THRESHOLD) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Get the bitrate value (in kbps) for a quality level
   */
  getBitrateValue(level: BitrateLevel): number {
    return this.BITRATE_QUALITY[level];
  }

  /**
   * Preload a track into cache
   */
  async preloadTrack(
    trackId: string,
    apiBase: string,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    // Check if already cached
    if (this.preloadCache.has(trackId)) {
      return;
    }

    // Check if already loading
    if (this.activePrefetch.has(trackId)) {
      return;
    }


    const prefetchStatus: PrefetchStatus = {
      trackId,
      status: 'loading',
      progress: 0,
      startTime: Date.now(),
    };

    this.activePrefetch.set(trackId, prefetchStatus);

    // Create abort controller for this prefetch
    this.prefetchAbortController = new AbortController();

    try {
      const bitrate = this.selectOptimalBitrate();
      const streamUrl = `${apiBase}/cdn/stream/${trackId}?type=audio&quality=${bitrate}`;

      const startTime = Date.now();
      const response = await fetch(streamUrl, {
        signal: this.prefetchAbortController.signal,
      });

      if (!response.ok) {
        throw new Error(`Prefetch failed: ${response.status}`);
      }

      const contentLength = parseInt(response.headers.get('content-length') || '0', 10);

      // Stream the response and track progress
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const chunks: BlobPart[] = [];
      let receivedBytes = 0;

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        // Convert to ArrayBuffer for Blob compatibility
        chunks.push(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
        receivedBytes += value.length;

        // Update progress
        if (contentLength > 0) {
          const progress = Math.round((receivedBytes / contentLength) * 100);
          prefetchStatus.progress = progress;
          onProgress?.(progress);
        }
      }

      // Combine chunks into single blob
      const blob = new Blob(chunks, { type: 'audio/mpeg' });
      const blobUrl = URL.createObjectURL(blob);

      // Cache the blob URL with LRU eviction
      this.preloadCache.set(trackId, blobUrl);

      // LRU eviction: if cache exceeds limit, remove oldest entry
      if (this.preloadCache.size > this.MAX_CACHE_SIZE) {
        const oldestKey = this.preloadCache.keys().next().value;
        if (oldestKey) {
          const oldestUrl = this.preloadCache.get(oldestKey);
          if (oldestUrl) {
            URL.revokeObjectURL(oldestUrl);
          }
          this.preloadCache.delete(oldestKey);
        }
      }

      const duration = Date.now() - startTime;

      // Record download measurement for network speed estimation
      this.recordDownloadMeasurement(receivedBytes, duration);

      prefetchStatus.status = 'ready';
      prefetchStatus.progress = 100;
      prefetchStatus.endTime = Date.now();

    } catch (error: any) {
      if (error.name === 'AbortError') {
        prefetchStatus.status = 'pending';
      } else {
        prefetchStatus.status = 'failed';
      }

      this.activePrefetch.delete(trackId);
    }
  }

  /**
   * Cancel active prefetch
   */
  cancelPrefetch(): void {
    if (this.prefetchAbortController) {
      this.prefetchAbortController.abort();
      this.prefetchAbortController = null;
    }
  }

  /**
   * Get cached blob URL for a track
   */
  getCachedTrack(trackId: string): string | null {
    return this.preloadCache.get(trackId) || null;
  }

  /**
   * Check if a track is cached
   */
  isTrackCached(trackId: string): boolean {
    return this.preloadCache.has(trackId);
  }

  /**
   * Get prefetch status for a track
   */
  getPrefetchStatus(trackId: string): PrefetchStatus | null {
    return this.activePrefetch.get(trackId) || null;
  }

  /**
   * Clear a specific track from cache
   */
  clearTrackCache(trackId: string): void {
    const blobUrl = this.preloadCache.get(trackId);
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
      this.preloadCache.delete(trackId);
    }
    this.activePrefetch.delete(trackId);
  }

  /**
   * Clear all cached tracks (for memory management)
   */
  clearAllCache(): void {
    // Revoke all blob URLs to free memory
    for (const blobUrl of this.preloadCache.values()) {
      URL.revokeObjectURL(blobUrl);
    }

    this.preloadCache.clear();
    this.activePrefetch.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      cachedTracks: this.preloadCache.size,
      activePrefetches: this.activePrefetch.size,
      prefetchStatuses: Array.from(this.activePrefetch.values()),
    };
  }
}

// Export singleton instance
export const audioEngine = AudioEngine.getInstance();
