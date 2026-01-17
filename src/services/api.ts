/**
 * VOYO Music - Production API Service
 *
 * HYBRID EXTRACTION SYSTEM:
 * 1. Cloudflare Worker (edge) - Direct high-quality URLs when available
 * 2. Fly.io Backend - Search, thumbnails, fallback streaming
 * 3. YouTube IFrame - Ultimate fallback for protected content
 *
 * Dark Mode: No third-party APIs, full control, VOYO branding
 */

// Production endpoints
const API_URL = 'https://voyo-music-api.fly.dev';
const EDGE_WORKER_URL = 'https://voyo-edge.dash-webtv.workers.dev';

export interface SearchResult {
  voyoId: string;
  title: string;
  artist: string;
  duration: number;
  thumbnail: string;
  views: number;
}

export interface StreamResponse {
  url: string;
  audioUrl: string;
  videoId: string;
  type: 'audio' | 'video';
  quality?: string;
}

/**
 * Search music - Uses our backend with yt-dlp
 */
export async function searchMusic(query: string, limit: number = 10): Promise<SearchResult[]> {
  try {
    const response = await fetch(
      `${API_URL}/api/search?q=${encodeURIComponent(query)}&limit=${limit}`,
      { signal: AbortSignal.timeout(15000) }
    );

    if (!response.ok) {
      throw new Error(`Search failed: ${response.status}`);
    }

    const data = await response.json();

    // Transform to VOYO format (backend returns VOYO IDs)
    return (data.results || []).map((item: any) => ({
      voyoId: item.id || item.voyoId,
      title: item.title,
      artist: item.artist || 'Unknown Artist',
      duration: item.duration || 0,
      thumbnail: `${API_URL}/cdn/art/${item.id || item.voyoId}`,
      views: item.views || 0,
    }));
  } catch (error) {
    throw error;
  }
}

// Alias for backward compatibility
export const searchYouTube = searchMusic;

/**
 * Decode VOYO ID to YouTube ID
 * VOYO IDs are base64url encoded with 'vyo_' prefix
 */
function decodeVoyoId(voyoId: string): string {
  if (!voyoId.startsWith('vyo_')) {
    // Already a YouTube ID
    return voyoId;
  }

  const encoded = voyoId.substring(4);
  let base64 = encoded
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  // Add padding
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }

  try {
    return atob(base64);
  } catch {
    return voyoId;
  }
}

/**
 * Edge Worker extraction result
 */
export interface EdgeStreamResult {
  url: string;
  mimeType: string;
  bitrate: number;
  title: string;
  client: string;
}

/**
 * Try Cloudflare Edge Worker for direct audio URL
 * Returns null if blocked (fallback needed)
 */
export async function tryEdgeExtraction(voyoId: string): Promise<EdgeStreamResult | null> {
  const youtubeId = decodeVoyoId(voyoId);

  try {
    const response = await fetch(`${EDGE_WORKER_URL}/stream?v=${youtubeId}`, {
      signal: AbortSignal.timeout(8000)
    });

    const data = await response.json();

    if (data.url) {
      return data as EdgeStreamResult;
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Stream response from server
 */
export interface StreamResult {
  url: string;
  cached: boolean;
  boosting: boolean;
  source: 'r2' | 'voyo_cache' | 'youtube_direct';
  quality: string;
}

/**
 * Check if track exists in R2 cache (41K+ pre-downloaded tracks)
 */
export async function checkR2Cache(videoId: string, quality: '128' | '64' = '128'): Promise<{
  exists: boolean;
  url: string | null;
}> {
  const youtubeId = decodeVoyoId(videoId);

  try {
    const response = await fetch(`${API_URL}/r2/exists?v=${youtubeId}&q=${quality}`, {
      signal: AbortSignal.timeout(3000) // Fast check
    });

    if (!response.ok) {
      return { exists: false, url: null };
    }

    const data = await response.json();
    return {
      exists: data.exists || false,
      url: data.url || null
    };
  } catch {
    return { exists: false, url: null };
  }
}

/**
 * Get audio stream URL - R2 + VOYO BOOST SYSTEM
 *
 * Flow:
 * 1. Check R2 first (41K+ pre-cached tracks) - FASTEST
 * 2. If not in R2, check local server cache
 * 3. If not cached: Returns YouTube URL + starts background download
 * 4. Next play of same track: Served from cache
 *
 * Browser plays DIRECTLY from URL (R2 for cached, YouTube for live)
 */
export async function getAudioStream(videoId: string, quality?: string): Promise<string> {
  const youtubeId = decodeVoyoId(videoId);

  // ADAPTIVE QUALITY: Use stream quality from player store if not specified
  if (!quality) {
    const { usePlayerStore } = await import('../store/playerStore');
    quality = usePlayerStore.getState().streamQuality;
  }

  // Map quality to R2 format (128 or 64)
  const r2Quality = quality === 'low' ? '64' : '128';

  try {
    // STEP 1: Check R2 first (fast parallel check)
    const r2Check = checkR2Cache(youtubeId, r2Quality);

    // STEP 2: Also prepare YouTube fallback (parallel)
    const ytFallback = fetch(`${API_URL}/stream?v=${youtubeId}&quality=${quality}`, {
      signal: AbortSignal.timeout(15000)
    });

    // Wait for R2 check first (it's faster)
    const r2Result = await r2Check;

    if (r2Result.exists && r2Result.url) {
      console.log(`[API] 🚀 R2 HIT: ${youtubeId} (${r2Quality}kbps)`);
      return r2Result.url;
    }

    // R2 miss - wait for YouTube fallback
    console.log(`[API] R2 miss, falling back to YouTube: ${youtubeId}`);
    const response = await ytFallback;

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    const data = await response.json();

    if (data.url) {
      return data.url;
    }

    throw new Error(data.error || 'No URL returned');

  } catch (err) {
    console.error('[API] Stream error:', err);
    return `iframe:${youtubeId}`;
  }
}

/**
 * Get full stream info (for UI to show boost status)
 */
export async function getStreamInfo(videoId: string, quality: string = 'high'): Promise<StreamResult | null> {
  const youtubeId = decodeVoyoId(videoId);

  try {
    const response = await fetch(`${API_URL}/stream?v=${youtubeId}&quality=${quality}`, {
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (!data.url) return null;

    return {
      url: data.url,
      cached: data.cached || false,
      boosting: data.boosting || false,
      source: data.source || 'youtube_direct',
      quality: data.quality || quality
    };
  } catch {
    return null;
  }
}

/**
 * Get YouTube ID for IFrame fallback
 */
export function getYouTubeIdForIframe(voyoId: string): string {
  return decodeVoyoId(voyoId);
}

/**
 * Get video stream URL
 */
export async function getVideoStream(videoId: string): Promise<StreamResponse> {
  const url = `${API_URL}/cdn/stream/${videoId}?type=video`;
  return {
    url,
    audioUrl: `${API_URL}/cdn/stream/${videoId}`,
    videoId,
    type: 'video',
  };
}

/**
 * Get stream (generic)
 */
export async function getStream(videoId: string, type: 'audio' | 'video' = 'audio'): Promise<StreamResponse> {
  if (type === 'video') {
    return getVideoStream(videoId);
  }

  const audioUrl = await getAudioStream(videoId);
  return {
    url: audioUrl,
    audioUrl,
    videoId,
    type: 'audio',
  };
}

/**
 * Get video details (for metadata)
 */
export async function getVideoDetails(videoId: string): Promise<any> {
  try {
    const response = await fetch(`${API_URL}/stream?v=${videoId}`, {
      signal: AbortSignal.timeout(10000),
    });
    return response.json();
  } catch (error) {
    return null;
  }
}

/**
 * Get thumbnail URL - Proxied through our backend
 */
export function getThumbnailUrl(videoId: string, quality: 'default' | 'medium' | 'high' | 'max' = 'high'): string {
  return `${API_URL}/cdn/art/${videoId}?quality=${quality}`;
}

/**
 * Health check
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get trending music
 */
export async function getTrending(region: string = 'US'): Promise<SearchResult[]> {
  try {
    // Use search with trending terms as fallback
    return searchMusic('trending music 2025', 20);
  } catch (error) {
    return [];
  }
}

/**
 * Prefetch - Warm up stream URL in backend cache
 */
export async function prefetchTrack(trackId: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/prefetch?v=${trackId}`, {
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

// ============================================
// OFFLINE MODE - NOW AVAILABLE WITH BACKEND!
// ============================================

/**
 * Check if track is downloaded
 */
export async function isDownloaded(trackId: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/downloaded`, {
      signal: AbortSignal.timeout(5000),
    });
    const data = await response.json();
    return (data.downloads || []).includes(trackId);
  } catch {
    return false;
  }
}

/**
 * Download track for offline playback
 */
export async function downloadTrack(trackId: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/download?v=${trackId}`, {
      signal: AbortSignal.timeout(60000), // 1 minute for download
    });
    const data = await response.json();
    return data.success === true;
  } catch (error) {
    return false;
  }
}

/**
 * Get offline URL for downloaded track
 */
export async function getOfflineUrl(trackId: string): Promise<string | null> {
  const downloaded = await isDownloaded(trackId);
  if (downloaded) {
    return `${API_URL}/downloads/${trackId}.mp3`;
  }
  return null;
}

/**
 * Delete downloaded track
 */
export async function deleteDownload(trackId: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/download?v=${trackId}`, {
      method: 'DELETE',
      signal: AbortSignal.timeout(5000),
    });
    const data = await response.json();
    return data.success === true;
  } catch {
    return false;
  }
}

/**
 * Get list of downloaded tracks
 */
export async function getDownloadedTracks(): Promise<string[]> {
  try {
    const response = await fetch(`${API_URL}/downloaded`, {
      signal: AbortSignal.timeout(5000),
    });
    const data = await response.json();
    return data.downloads || [];
  } catch {
    return [];
  }
}

/**
 * Initialize downloads cache (no-op, backend handles it)
 */
export async function initDownloadsCache(): Promise<void> {
  // Backend maintains its own cache
}

// ============================================
// INSTANCE MANAGEMENT (for debugging)
// ============================================

export function getCurrentInstance(): string {
  return API_URL;
}

export function getAvailableInstances(): string[] {
  return [API_URL];
}

export function forceRotateInstance(): string {
  return API_URL; // Single instance, no rotation needed
}
