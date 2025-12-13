/**
 * VOYO Client-Side Audio Extraction
 *
 * Uses youtubei.js in the browser with Cloudflare Worker as CORS proxy.
 * Extraction logic runs client-side, network requests go through trusted Cloudflare IPs.
 */

import { Innertube, UniversalCache } from 'youtubei.js';

// Cloudflare Worker CORS proxy
const PROXY_URL = 'https://voyo-edge.dash-webtv.workers.dev/proxy';

let innertube: Innertube | null = null;

/**
 * Initialize the Innertube client for browser use
 */
async function getInnertube(): Promise<Innertube> {
  if (!innertube) {

    innertube = await Innertube.create({
      // Use our Cloudflare proxy for all requests
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input.toString();

        // Proxy YouTube API requests through Cloudflare
        if (url.includes('youtube.com') || url.includes('googlevideo.com')) {
          const proxyUrl = `${PROXY_URL}?url=${encodeURIComponent(url)}`;
          return fetch(proxyUrl, {
            ...init,
            headers: {
              ...init?.headers,
              'X-Requested-With': 'VOYO-Client'
            }
          });
        }

        return fetch(input, init);
      },
      cache: new UniversalCache(false), // Don't persist cache
      generate_session_locally: true,
    });

  }

  return innertube;
}

/**
 * Extract audio URL from YouTube video (client-side)
 */
export async function extractAudio(videoId: string): Promise<{
  url: string;
  mimeType: string;
  bitrate: number;
  title: string;
} | null> {
  try {
    const yt = await getInnertube();

    const info = await yt.getBasicInfo(videoId);

    // Check playability
    if (!info.playability_status?.status || info.playability_status.status !== 'OK') {
      return null;
    }

    // Get audio formats
    const formats = info.streaming_data?.adaptive_formats || [];
    const audioFormats = formats.filter(f =>
      f.mime_type?.startsWith('audio/')
    );

    if (audioFormats.length === 0) {
      return null;
    }

    // Find best audio (prefer mp4, highest bitrate)
    const mp4Formats = audioFormats.filter(f => f.mime_type?.includes('mp4'));
    const bestAudio = (mp4Formats.length > 0 ? mp4Formats : audioFormats)
      .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];

    // Get URL - might need deciphering
    let url: string | undefined;

    // Try to get URL directly first
    if (bestAudio.url) {
      url = bestAudio.url;
    } else if (bestAudio.decipher) {
      // Decipher if needed
      url = await bestAudio.decipher(yt.session.player);
    }

    if (!url) {
      return null;
    }

    return {
      url,
      mimeType: bestAudio.mime_type || 'audio/mp4',
      bitrate: bestAudio.bitrate || 0,
      title: info.basic_info?.title || 'Unknown'
    };

  } catch (error) {
    return null;
  }
}

/**
 * Decode VOYO ID to YouTube ID
 */
export function decodeVoyoId(voyoId: string): string {
  if (!voyoId.startsWith('vyo_')) {
    return voyoId;
  }

  const encoded = voyoId.substring(4);
  let base64 = encoded
    .replace(/-/g, '+')
    .replace(/_/g, '/');

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
 * Full extraction with VOYO ID support
 */
export async function extractFromVoyoId(voyoId: string) {
  const youtubeId = decodeVoyoId(voyoId);
  return extractAudio(youtubeId);
}
