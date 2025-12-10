/**
 * VOYO Music - Backend API Service
 * STEALTH MODE: Uses VOYO IDs to hide YouTube traces
 */

// Use production backend in production, localhost in dev
// Override with VITE_BACKEND_URL env var to force production in dev
export const API_BASE = import.meta.env.VITE_BACKEND_URL
  || (import.meta.env.PROD
    ? 'https://voyo-music-server-production.up.railway.app'
    : 'http://localhost:3001');

export interface SearchResult {
  voyoId: string;  // STEALTH: VOYO ID (vyo_XXXXX) instead of YouTube ID
  title: string;
  artist: string;
  duration: number;
  thumbnail: string;  // Points to /cdn/art/vyo_XXXXX
  views: number;
}

export interface StreamResponse {
  url: string;
  audioUrl: string;
  videoId: string;  // Actually a VOYO ID in stealth mode
  type: 'audio' | 'video';
}

/**
 * Search VOYO Music library - YouTube only (STEALTH: Returns VOYO IDs)
 */
export async function searchYouTube(query: string, limit: number = 10): Promise<SearchResult[]> {
  try {
    const response = await fetch(
      `${API_BASE}/api/search?q=${encodeURIComponent(query)}&limit=${limit}`
    );

    if (!response.ok) {
      throw new Error(`Search failed: ${response.status}`);
    }

    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error('[API] YouTube search error:', error);
    throw error;
  }
}

/**
 * Search VOYO Music library - Combined seed data + YouTube
 * Returns seed data matches first, then YouTube results
 */
export async function searchMusic(query: string, limit: number = 10): Promise<SearchResult[]> {
  try {
    const response = await fetch(
      `${API_BASE}/api/search?q=${encodeURIComponent(query)}&limit=${limit}`
    );

    if (!response.ok) {
      throw new Error(`Search failed: ${response.status}`);
    }

    const data = await response.json();
    return data.results || [];
  } catch (error) {
    console.error('[API] Search error:', error);
    throw error;
  }
}

/**
 * Get stream URL for a VOYO track (STEALTH: Accepts VOYO IDs)
 * @param voyoId VOYO track ID (vyo_XXXXX)
 * @param type 'audio' for music mode, 'video' for video mode
 */
export async function getStream(voyoId: string, type: 'audio' | 'video' = 'audio'): Promise<StreamResponse> {
  try {
    console.log(`[API] Getting ${type} stream for: ${voyoId}`);
    const streamUrl = `${API_BASE}/cdn/stream/${voyoId}?type=${type}`;

    return {
      url: streamUrl,
      audioUrl: streamUrl,
      videoId: voyoId,
      type
    };
  } catch (error) {
    console.error('[API] Stream error:', error);
    throw error;
  }
}

/**
 * Get audio stream URL (STEALTH: Uses CDN endpoint with VOYO ID)
 */
export async function getAudioStream(voyoId: string): Promise<string> {
  return `${API_BASE}/cdn/stream/${voyoId}?type=audio`;
}

/**
 * Get video stream URL (STEALTH: Uses CDN endpoint with VOYO ID)
 */
export async function getVideoStream(voyoId: string): Promise<StreamResponse> {
  return {
    url: `${API_BASE}/cdn/stream/${voyoId}?type=video`,
    audioUrl: `${API_BASE}/cdn/stream/${voyoId}?type=audio`,
    videoId: voyoId,
    type: 'video'
  };
}

/**
 * Get thumbnail URL for VOYO track (STEALTH: Uses CDN endpoint)
 */
export function getThumbnailUrl(voyoId: string, quality: 'default' | 'medium' | 'high' | 'max' = 'high'): string {
  return `${API_BASE}/cdn/art/${voyoId}?quality=${quality}`;
}

/**
 * Health check
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * PREFETCH: Warm up a track on server-side for instant playback
 * Non-blocking - returns immediately with 202 Accepted
 * Server caches the stream URL so subsequent requests are instant
 * @param trackId VOYO track ID (vyo_XXXXX) or raw YouTube ID
 * @param quality Stream quality level (low/medium/high)
 */
export async function prefetchTrack(trackId: string, quality: 'low' | 'medium' | 'high' = 'high'): Promise<boolean> {
  try {
    // Fire and forget - don't await, just trigger
    fetch(`${API_BASE}/prefetch?v=${trackId}&quality=${quality}`, {
      method: 'GET',
    }).catch(() => {
      // Ignore errors - prefetch is best effort
    });
    console.log(`[API] Prefetch triggered for: ${trackId}`);
    return true;
  } catch (error) {
    console.warn('[API] Prefetch error (non-critical):', error);
    return false;
  }
}

/**
 * OFFLINE MODE - Download Management
 * Note: Download features use YouTube IDs internally but can work with VOYO IDs
 */

let downloadedTracksCache: Set<string> | null = null;

/**
 * Initialize the downloads cache
 */
export async function initDownloadsCache(): Promise<void> {
  const tracks = await getDownloadedTracks();
  downloadedTracksCache = new Set(tracks);
  console.log(`[Downloads] Cache initialized with ${tracks.length} tracks`);
}

/**
 * Check if a track is downloaded
 */
export async function isDownloaded(trackId: string): Promise<boolean> {
  if (downloadedTracksCache === null) {
    await initDownloadsCache();
  }
  return downloadedTracksCache?.has(trackId) || false;
}

/**
 * Download a track for offline playback
 */
export async function downloadTrack(trackId: string): Promise<boolean> {
  try {
    console.log(`[API] Downloading track: ${trackId}`);
    const response = await fetch(`${API_BASE}/download?v=${trackId}`);

    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`);
    }

    const data = await response.json();
    if (data.success) {
      if (downloadedTracksCache === null) {
        await initDownloadsCache();
      }
      downloadedTracksCache?.add(trackId);
      console.log(`[API] Download complete: ${trackId}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error('[API] Download error:', error);
    return false;
  }
}

/**
 * Get offline playback URL
 * Tries multiple audio formats to find the downloaded file
 */
export async function getOfflineUrl(trackId: string): Promise<string | null> {
  const downloaded = await isDownloaded(trackId);
  if (!downloaded) {
    return null;
  }

  // Try different formats (backend supports mp3, m4a, webm, opus)
  const formats = ['mp3', 'm4a', 'webm', 'opus'];

  for (const format of formats) {
    const testUrl = `${API_BASE}/downloads/${trackId}.${format}`;
    try {
      // Quick HEAD request to check if file exists
      const response = await fetch(testUrl, { method: 'HEAD' });
      if (response.ok) {
        return testUrl;
      }
    } catch (e) {
      // Continue to next format
    }
  }

  // Fallback to mp3 (most common)
  return `${API_BASE}/downloads/${trackId}.mp3`;
}

/**
 * Delete a downloaded track
 */
export async function deleteDownload(trackId: string): Promise<boolean> {
  try {
    console.log(`[API] Deleting download: ${trackId}`);
    const response = await fetch(`${API_BASE}/download?v=${trackId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error(`Delete failed: ${response.status}`);
    }

    const data = await response.json();
    if (data.success) {
      downloadedTracksCache?.delete(trackId);
      console.log(`[API] Download deleted: ${trackId}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error('[API] Delete error:', error);
    return false;
  }
}

/**
 * Get all downloaded track IDs
 */
export async function getDownloadedTracks(): Promise<string[]> {
  try {
    const response = await fetch(`${API_BASE}/downloaded`);

    if (!response.ok) {
      throw new Error(`Fetch downloads failed: ${response.status}`);
    }

    const data = await response.json();
    return data.downloads || [];
  } catch (error) {
    console.error('[API] Get downloads error:', error);
    return [];
  }
}
