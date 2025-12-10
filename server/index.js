/**
 * VOYO Music Backend Server
 * Uses yt-dlp to extract audio streams from YouTube
 */

import { spawn } from 'child_process';
import http from 'http';
import https from 'https';
import url from 'url';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  encodeVoyoId,
  decodeVoyoId,
  sanitizeSearchResult,
  isValidVoyoId,
  isValidYouTubeId,
  getVoyoError
} from './stealth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3001;
const YT_DLP_PATH = process.env.YT_DLP_PATH || 'yt-dlp'; // Use system yt-dlp in production
const DOWNLOADS_DIR = path.join(__dirname, 'downloads');

// ========================================
// PRODUCTION-GRADE CACHING SYSTEM
// ========================================

// Stream URL cache (4 hours - YouTube URLs valid for ~6 hours)
const streamCache = new Map();
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

// In-flight requests to prevent duplicate yt-dlp calls
const inFlightRequests = new Map();

// Thumbnail cache (24 hours - images don't expire)
const thumbnailCache = new Map();
const THUMBNAIL_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Prefetch cache - warmed up streams ready to go
const prefetchCache = new Map(); // trackId -> { timestamp, warmed: boolean }
const PREFETCH_TTL = 30 * 60 * 1000; // 30 minutes

// Cache statistics for monitoring
const cacheStats = {
  streamHits: 0,
  streamMisses: 0,
  thumbnailHits: 0,
  thumbnailMisses: 0,
  prefetchRequests: 0,
  activeStreams: 0,
  startTime: Date.now()
};

// ========================================
// ANTI-BLOCKING PROTECTION SYSTEM
// Designed for scale while being a good YouTube citizen
// ========================================

// Rate limiting per IP (prevents abuse, shows YouTube we're responsible)
const ipRequestCounts = new Map(); // IP -> { count, windowStart }
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute window
const RATE_LIMIT_MAX_REQUESTS = 60; // 60 requests per minute per IP (generous)
const RATE_LIMIT_YT_DLP = 10; // Max 10 yt-dlp calls per minute per IP (actual YouTube hits)

// Global yt-dlp rate limiting (across all users)
let globalYtDlpCalls = 0;
let globalYtDlpWindowStart = Date.now();
const GLOBAL_YT_DLP_LIMIT = 300; // 300 yt-dlp calls per minute globally (5 per second)

// Request queue for yt-dlp (prevents thundering herd)
const ytDlpQueue = [];
let ytDlpProcessing = false;
const YT_DLP_CONCURRENCY = 3; // Max 3 concurrent yt-dlp processes
let activeYtDlpProcesses = 0;

// User-Agent rotation (look like different clients)
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
];

function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// Check and update rate limit for an IP
function checkRateLimit(ip, isYtDlp = false) {
  const now = Date.now();
  const key = ip || 'unknown';

  // Get or create IP tracking
  let ipData = ipRequestCounts.get(key);
  if (!ipData || now - ipData.windowStart > RATE_LIMIT_WINDOW) {
    ipData = { count: 0, ytDlpCount: 0, windowStart: now };
    ipRequestCounts.set(key, ipData);
  }

  // Check general rate limit
  if (ipData.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, reason: 'rate_limit_exceeded', retryAfter: Math.ceil((ipData.windowStart + RATE_LIMIT_WINDOW - now) / 1000) };
  }

  // Check yt-dlp specific rate limit
  if (isYtDlp && ipData.ytDlpCount >= RATE_LIMIT_YT_DLP) {
    return { allowed: false, reason: 'yt_dlp_rate_limit', retryAfter: Math.ceil((ipData.windowStart + RATE_LIMIT_WINDOW - now) / 1000) };
  }

  // Check global yt-dlp limit
  if (isYtDlp) {
    if (now - globalYtDlpWindowStart > RATE_LIMIT_WINDOW) {
      globalYtDlpCalls = 0;
      globalYtDlpWindowStart = now;
    }
    if (globalYtDlpCalls >= GLOBAL_YT_DLP_LIMIT) {
      return { allowed: false, reason: 'global_yt_dlp_limit', retryAfter: Math.ceil((globalYtDlpWindowStart + RATE_LIMIT_WINDOW - now) / 1000) };
    }
    globalYtDlpCalls++;
    ipData.ytDlpCount++;
  }

  ipData.count++;
  return { allowed: true };
}

// Get client IP from request
function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.socket?.remoteAddress ||
         'unknown';
}

// Clean up old IP tracking entries (run periodically)
function cleanupRateLimitData() {
  const now = Date.now();
  for (const [ip, data] of ipRequestCounts.entries()) {
    if (now - data.windowStart > RATE_LIMIT_WINDOW * 2) {
      ipRequestCounts.delete(ip);
    }
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupRateLimitData, 5 * 60 * 1000);

// ========================================
// CACHE CLEANUP - Prevent memory leaks
// ========================================

function cleanupExpiredCache() {
  const now = Date.now();
  let cleaned = 0;

  // Clean stream cache (4 hour TTL)
  for (const [key, entry] of streamCache.entries()) {
    if (now - entry.timestamp > CACHE_TTL) {
      streamCache.delete(key);
      cleaned++;
    }
  }

  // Clean thumbnail cache (24 hour TTL) - CRITICAL: prevents memory leaks
  for (const [key, entry] of thumbnailCache.entries()) {
    if (now - entry.timestamp > THUMBNAIL_CACHE_TTL) {
      thumbnailCache.delete(key);
      cleaned++;
    }
  }

  // Clean prefetch cache (30 min TTL)
  for (const [key, entry] of prefetchCache.entries()) {
    if (now - entry.timestamp > PREFETCH_TTL) {
      prefetchCache.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`[Cache Cleanup] Removed ${cleaned} expired entries (stream: ${streamCache.size}, thumb: ${thumbnailCache.size}, prefetch: ${prefetchCache.size})`);
  }
}

// Run cache cleanup every 10 minutes
setInterval(cleanupExpiredCache, 10 * 60 * 1000);

// ========================================

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/**
 * Get stream URL using yt-dlp with quality selection
 * @param {string} videoId - YouTube video ID
 * @param {string} type - 'audio' or 'video'
 * @param {string} quality - 'low', 'medium', 'high' (audio only)
 */
async function getStreamUrl(videoId, type = 'audio', quality = 'high') {
  const cacheKey = `${videoId}-${type}-${quality}`;

  // Check cache first
  const cached = streamCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[Cache Hit] ${cacheKey}`);
    cacheStats.streamHits++;
    return cached;
  }

  cacheStats.streamMisses++;

  // Check if there's already a request in flight for this video
  if (inFlightRequests.has(cacheKey)) {
    console.log(`[In-Flight] Waiting for existing request: ${cacheKey}`);
    return inFlightRequests.get(cacheKey);
  }

  // Create promise for this request
  const requestPromise = new Promise((resolve, reject) => {
    const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;
    console.log(`[yt-dlp] Fetching ${type} (${quality}) URL for: ${videoId}`);

    // Format selection with quality tiers:
    let format;
    if (type === 'video') {
      format = 'bestvideo[ext=mp4]+bestaudio/best[ext=mp4]/best';
    } else {
      // Audio quality selection based on bitrate
      switch (quality) {
        case 'low':
          format = 'bestaudio[abr<=64]/bestaudio';
          break;
        case 'medium':
          format = 'bestaudio[abr<=128]/bestaudio';
          break;
        case 'high':
        default:
          format = 'bestaudio[ext=webm]/bestaudio';
          break;
      }
    }

    // Anti-blocking: Use random User-Agent and add delay jitter
    const userAgent = getRandomUserAgent();

    const ytdlp = spawn(YT_DLP_PATH, [
      '-f', format,
      '-g',  // Get URL only
      '--no-warnings',
      '--user-agent', userAgent,
      '--sleep-requests', '0.5',  // 500ms between requests to YouTube
      '--no-check-certificates',  // Skip certificate validation (faster)
      ytUrl
    ], {
      env: { ...process.env, PATH: `${process.env.HOME}/.deno/bin:${process.env.HOME}/.local/bin:${process.env.PATH}` }
    });

    let stdout = '';
    let stderr = '';

    ytdlp.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ytdlp.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ytdlp.on('close', (code) => {
      if (code === 0 && stdout.trim()) {
        const urls = stdout.trim().split('\n');
        // For video, yt-dlp may return 2 URLs (video + audio separately)
        // For audio, it returns 1 URL
        const result = {
          url: urls[0],
          audioUrl: urls.length > 1 ? urls[1] : urls[0],
          type,
          timestamp: Date.now()
        };
        // Cache the result
        streamCache.set(cacheKey, result);
        console.log(`[yt-dlp] Success: ${cacheKey}`);
        resolve(result);
      } else {
        console.error(`[yt-dlp] Error for ${videoId}:`, stderr);
        reject(new Error(stderr || 'Failed to get stream URL'));
      }
    });

    ytdlp.on('error', (err) => {
      console.error(`[yt-dlp] Spawn error:`, err);
      reject(err);
    });
  });

  // Track in-flight request
  inFlightRequests.set(cacheKey, requestPromise);

  // Clean up in-flight tracking when done
  requestPromise.finally(() => {
    inFlightRequests.delete(cacheKey);
  });

  return requestPromise;
}

/**
 * Fetch and proxy YouTube thumbnail
 * @param {string} videoId - YouTube video ID
 * @param {string} quality - Thumbnail quality (high, medium, default, max)
 */
async function getThumbnail(videoId, quality = 'high') {
  const cacheKey = `${videoId}-${quality}`;

  // Check cache first (use longer TTL for thumbnails)
  const cached = thumbnailCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < THUMBNAIL_CACHE_TTL) {
    console.log(`[Thumbnail Cache Hit] ${cacheKey}`);
    cacheStats.thumbnailHits++;
    return cached.data;
  }

  cacheStats.thumbnailMisses++;

  return new Promise((resolve, reject) => {
    // Quality mapping
    const qualityMap = {
      'max': 'maxresdefault.jpg',
      'high': 'hqdefault.jpg',
      'medium': 'mqdefault.jpg',
      'default': 'default.jpg'
    };

    const filename = qualityMap[quality] || qualityMap.high;
    const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/${filename}`;

    console.log(`[Thumbnail] Fetching for: ${videoId} (${quality})`);

    https.get(thumbnailUrl, (proxyRes) => {
      if (proxyRes.statusCode !== 200) {
        reject(new Error(`Failed to fetch thumbnail: ${proxyRes.statusCode}`));
        return;
      }

      const chunks = [];
      proxyRes.on('data', (chunk) => chunks.push(chunk));
      proxyRes.on('end', () => {
        const imageData = Buffer.concat(chunks);
        // Cache the result
        thumbnailCache.set(cacheKey, {
          data: imageData,
          timestamp: Date.now()
        });
        console.log(`[Thumbnail] Success: ${cacheKey} (${imageData.length} bytes)`);
        resolve(imageData);
      });
    }).on('error', (err) => {
      console.error(`[Thumbnail] Error for ${videoId}:`, err);
      reject(err);
    });
  });
}

/**
 * Search YouTube using yt-dlp
 */
async function searchYouTube(query, limit = 10) {
  return new Promise((resolve, reject) => {
    console.log(`[yt-dlp] Searching: ${query}`);

    const ytdlp = spawn(YT_DLP_PATH, [
      `ytsearch${limit}:${query}`,
      '--flat-playlist',
      '-j',
      '--no-warnings'
    ], {
      env: { ...process.env, PATH: `${process.env.HOME}/.deno/bin:${process.env.HOME}/.local/bin:${process.env.PATH}` }
    });

    let stdout = '';
    let stderr = '';

    ytdlp.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    ytdlp.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    ytdlp.on('close', (code) => {
      if (code === 0 && stdout.trim()) {
        try {
          const results = stdout.trim().split('\n')
            .filter(line => line.trim())
            .map(line => {
              const data = JSON.parse(line);
              return {
                id: data.id,
                title: data.title,
                artist: data.uploader || data.channel || 'Unknown',
                duration: data.duration || 0,
                thumbnail: data.thumbnails?.[0]?.url || `https://img.youtube.com/vi/${data.id}/hqdefault.jpg`,
                views: data.view_count || 0
              };
            });
          console.log(`[yt-dlp] Found ${results.length} results`);
          resolve(results);
        } catch (e) {
          console.error('[yt-dlp] Parse error:', e);
          reject(e);
        }
      } else {
        console.error(`[yt-dlp] Search error:`, stderr);
        reject(new Error(stderr || 'Search failed'));
      }
    });

    ytdlp.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Download audio file using yt-dlp
 * @param {string} videoId - YouTube video ID
 */
async function downloadAudio(videoId) {
  return new Promise((resolve, reject) => {
    const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const outputPath = path.join(DOWNLOADS_DIR, `${videoId}.mp3`);

    // Check if already downloaded
    if (fs.existsSync(outputPath)) {
      console.log(`[Download] Already exists: ${videoId}`);
      resolve({ success: true, path: `/downloads/${videoId}.mp3`, alreadyExists: true });
      return;
    }

    console.log(`[Download] Starting download for: ${videoId}`);

    const ytdlp = spawn(YT_DLP_PATH, [
      '-f', 'bestaudio',
      '-x',
      '--audio-format', 'mp3',
      '-o', outputPath,
      '--no-warnings',
      ytUrl
    ], {
      env: { ...process.env, PATH: `${process.env.HOME}/.deno/bin:${process.env.HOME}/.local/bin:${process.env.PATH}` }
    });

    let stderr = '';

    ytdlp.stderr.on('data', (data) => {
      stderr += data.toString();
      // Log progress
      const progressMatch = stderr.match(/(\d+\.\d+)%/);
      if (progressMatch) {
        console.log(`[Download] Progress: ${progressMatch[1]}%`);
      }
    });

    ytdlp.on('close', (code) => {
      if (code === 0 && fs.existsSync(outputPath)) {
        console.log(`[Download] Success: ${videoId}`);
        resolve({
          success: true,
          path: `/downloads/${videoId}.mp3`,
          alreadyExists: false
        });
      } else {
        console.error(`[Download] Failed for ${videoId}:`, stderr);
        reject(new Error(stderr || 'Download failed'));
      }
    });

    ytdlp.on('error', (err) => {
      console.error(`[Download] Spawn error:`, err);
      reject(err);
    });
  });
}

/**
 * Get list of downloaded video IDs
 */
function getDownloadedIds() {
  try {
    const files = fs.readdirSync(DOWNLOADS_DIR);
    const audioExts = ['.mp3', '.m4a', '.webm', '.opus'];
    return files
      .filter(file => audioExts.some(ext => file.endsWith(ext)))
      .map(file => {
        // Remove extension
        for (const ext of audioExts) {
          if (file.endsWith(ext)) {
            return file.replace(ext, '');
          }
        }
        return file;
      });
  } catch (error) {
    console.error('[Downloads] Error reading directory:', error);
    return [];
  }
}

/**
 * Delete a downloaded file
 * @param {string} videoId - YouTube video ID
 */
function deleteDownload(videoId) {
  const audioExts = ['.mp3', '.m4a', '.webm', '.opus'];
  try {
    // Find and delete file with any supported audio extension
    for (const ext of audioExts) {
      const filePath = path.join(DOWNLOADS_DIR, `${videoId}${ext}`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[Download] Deleted: ${videoId}${ext}`);
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error(`[Download] Delete error for ${videoId}:`, error);
    return false;
  }
}

/**
 * HTTP Server
 */
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;
  const clientIP = getClientIP(req);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  // Rate limit check for all requests (except health check)
  if (pathname !== '/health') {
    const isYtDlpRequest = ['/cdn/stream', '/proxy', '/stream', '/search', '/api/search'].some(p => pathname.startsWith(p));
    const rateLimit = checkRateLimit(clientIP, isYtDlpRequest && !streamCache.has(query.v));

    if (!rateLimit.allowed) {
      console.log(`[Rate Limit] Blocked ${clientIP}: ${rateLimit.reason}`);
      res.writeHead(429, {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Retry-After': rateLimit.retryAfter
      });
      res.end(JSON.stringify({
        error: 'Too many requests',
        reason: rateLimit.reason,
        retryAfter: rateLimit.retryAfter
      }));
      return;
    }
  }

  // ========================================
  // PRODUCTION MONITORING ENDPOINTS
  // ========================================

  // Enhanced health check with detailed metrics
  if (pathname === '/health') {
    const uptime = process.uptime();
    const memory = process.memoryUsage();

    const hitRate = cacheStats.streamHits + cacheStats.streamMisses > 0
      ? ((cacheStats.streamHits / (cacheStats.streamHits + cacheStats.streamMisses)) * 100).toFixed(2)
      : 0;

    res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      service: 'voyo-backend',
      uptime: Math.floor(uptime),
      uptimeFormatted: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
      memory: {
        rss: `${Math.round(memory.rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memory.heapUsed / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memory.heapTotal / 1024 / 1024)}MB`
      },
      cache: {
        streamCacheSize: streamCache.size,
        thumbnailCacheSize: thumbnailCache.size,
        prefetchCacheSize: prefetchCache.size,
        streamHitRate: `${hitRate}%`,
        stats: cacheStats
      },
      rateLimit: {
        activeIPs: ipRequestCounts.size,
        globalYtDlpCalls: globalYtDlpCalls,
        globalYtDlpLimit: GLOBAL_YT_DLP_LIMIT,
        perIPLimit: RATE_LIMIT_MAX_REQUESTS,
        perIPYtDlpLimit: RATE_LIMIT_YT_DLP
      },
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // Debug endpoint - check yt-dlp availability
  if (pathname === '/debug') {
    const { exec } = await import('child_process');
    const checkYtDlp = () => new Promise((resolve) => {
      exec('which yt-dlp && yt-dlp --version', (error, stdout, stderr) => {
        resolve({
          available: !error,
          path: stdout.trim().split('\n')[0] || 'not found',
          version: stdout.trim().split('\n')[1] || 'unknown',
          error: error ? error.message : null
        });
      });
    });

    const ytdlpInfo = await checkYtDlp();
    res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ytdlp: ytdlpInfo,
      ytdlpPath: YT_DLP_PATH,
      env: {
        NODE_ENV: process.env.NODE_ENV,
        PORT: process.env.PORT,
        RAILWAY: !!process.env.RAILWAY_PUBLIC_DOMAIN
      }
    }));
    return;
  }

  // Prefetch warming endpoint - warm up stream URL before needed
  if (pathname === '/prefetch' && query.v) {
    try {
      const videoId = query.v;
      const quality = query.quality || 'high';
      const type = query.type || 'audio';

      console.log(`[Prefetch] Warming ${videoId} (${quality})`);
      cacheStats.prefetchRequests++;

      // Mark as warming
      prefetchCache.set(videoId, {
        timestamp: Date.now(),
        warmed: false,
        quality
      });

      // Start warming in background (don't await)
      getStreamUrl(videoId, type, quality)
        .then(() => {
          prefetchCache.set(videoId, {
            timestamp: Date.now(),
            warmed: true,
            quality
          });
          console.log(`[Prefetch] Warmed ${videoId}`);
        })
        .catch(err => {
          console.error(`[Prefetch] Failed for ${videoId}:`, err.message);
          prefetchCache.delete(videoId);
        });

      // Respond immediately (non-blocking)
      res.writeHead(202, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'warming',
        videoId,
        message: 'Stream warming initiated'
      }));
    } catch (err) {
      res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Get stream URL (audio or video) with quality selection
  if (pathname === '/stream' && query.v) {
    // SECURITY: Validate video ID before processing
    if (!isValidYouTubeId(query.v)) {
      console.warn(`[Stream] REJECTED invalid video ID: ${query.v}`);
      res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: getVoyoError('INVALID_ID') }));
      return;
    }
    try {
      const type = query.type === 'video' ? 'video' : 'audio';
      const quality = query.quality || 'high'; // low, medium, high
      const result = await getStreamUrl(query.v, type, quality);
      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        url: result.url,
        audioUrl: result.audioUrl,
        videoId: query.v,
        type: result.type,
        quality
      }));
    } catch (err) {
      res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // PROXY endpoint - streams audio through our server with range support
  if (pathname === '/proxy' && query.v) {
    // SECURITY: Validate video ID before processing
    if (!isValidYouTubeId(query.v)) {
      console.warn(`[Proxy] REJECTED invalid video ID: ${query.v}`);
      res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: getVoyoError('INVALID_ID') }));
      return;
    }
    try {
      const type = query.type === 'video' ? 'video' : 'audio';
      const quality = query.quality || 'high'; // low, medium, high
      const result = await getStreamUrl(query.v, type, quality);
      const streamUrl = type === 'audio' ? result.audioUrl : result.url;

      console.log(`[Proxy] Streaming ${type} (${quality}) for ${query.v}`);
      cacheStats.activeStreams++;

      // Parse the googlevideo URL
      const parsedStream = new URL(streamUrl);

      // Forward request to googlevideo with range support
      const proxyReq = https.request({
        hostname: parsedStream.hostname,
        path: parsedStream.pathname + parsedStream.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Range': req.headers.range || 'bytes=0-',
        }
      }, (proxyRes) => {
        // Forward headers with CORS
        let contentType = 'audio/webm; codecs=opus';
        const origType = proxyRes.headers['content-type'] || '';
        if (origType.includes('mp4') || origType.includes('m4a')) contentType = 'audio/mp4';
        else if (origType.includes('mpeg') || origType.includes('mp3')) contentType = 'audio/mpeg';

        const headers = {
          ...corsHeaders,
          'Content-Type': contentType,
          'Accept-Ranges': 'bytes',
        };

        // Forward Content-Length if present
        if (proxyRes.headers['content-length']) {
          headers['Content-Length'] = proxyRes.headers['content-length'];
        }

        // Forward Content-Range for partial content (206 responses)
        if (proxyRes.headers['content-range']) {
          headers['Content-Range'] = proxyRes.headers['content-range'];
        }

        // Use appropriate status code (206 for range requests, 200 for full)
        res.writeHead(proxyRes.statusCode, headers);
        proxyRes.pipe(res);

        // Track when stream ends
        proxyRes.on('end', () => {
          cacheStats.activeStreams--;
        });
      });

      proxyReq.on('error', (err) => {
        console.error('[Proxy] Error:', err);
        cacheStats.activeStreams--;
        res.writeHead(500, corsHeaders);
        res.end(JSON.stringify({ error: 'Proxy failed' }));
      });

      proxyReq.end();
    } catch (err) {
      console.error('[Proxy] Error:', err);
      res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Search
  if (pathname === '/search' && query.q) {
    try {
      const limit = parseInt(query.limit) || 10;
      const results = await searchYouTube(query.q, limit);
      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ results }));
    } catch (err) {
      res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Thumbnail proxy - HIDE YouTube completely
  if (pathname === '/thumbnail' && query.id) {
    // SECURITY: Validate video ID before processing
    if (!isValidYouTubeId(query.id)) {
      console.warn(`[Thumbnail] REJECTED invalid video ID: ${query.id}`);
      res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: getVoyoError('INVALID_ID') }));
      return;
    }
    try {
      const quality = query.quality || 'high';
      const imageData = await getThumbnail(query.id, quality);

      res.writeHead(200, {
        ...corsHeaders,
        'Content-Type': 'image/jpeg',
        'Content-Length': imageData.length,
        'Cache-Control': 'public, max-age=3600' // 1 hour browser cache
      });
      res.end(imageData);
    } catch (err) {
      console.error('[Thumbnail] Error:', err);
      res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Download audio file
  if (pathname === '/download' && req.method === 'GET' && query.v) {
    // SECURITY: Validate video ID before processing
    if (!isValidYouTubeId(query.v)) {
      console.warn(`[Download] REJECTED invalid video ID: ${query.v}`);
      res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: getVoyoError('INVALID_ID') }));
      return;
    }
    try {
      const result = await downloadAudio(query.v);
      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Delete downloaded file
  if (pathname === '/download' && req.method === 'DELETE' && query.v) {
    // SECURITY: Validate video ID before processing
    if (!isValidYouTubeId(query.v)) {
      console.warn(`[Delete] REJECTED invalid video ID: ${query.v}`);
      res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: getVoyoError('INVALID_ID') }));
      return;
    }
    try {
      const success = deleteDownload(query.v);
      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success }));
    } catch (err) {
      res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Get list of downloaded tracks
  if (pathname === '/downloaded') {
    try {
      const downloads = getDownloadedIds();
      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ downloads }));
    } catch (err) {
      res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Serve downloaded audio file (supports multiple formats)
  if (pathname.startsWith('/downloads/')) {
    const audioExts = ['.mp3', '.m4a', '.webm', '.opus'];
    let videoId = null;
    let fileExt = null;

    // Extract videoId and extension
    for (const ext of audioExts) {
      if (pathname.endsWith(ext)) {
        videoId = pathname.replace('/downloads/', '').replace(ext, '');
        fileExt = ext;
        break;
      }
    }

    if (!videoId || !fileExt) {
      res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid file format' }));
      return;
    }

    const filePath = path.join(DOWNLOADS_DIR, `${videoId}${fileExt}`);

    try {
      if (!fs.existsSync(filePath)) {
        res.writeHead(404, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'File not found' }));
        return;
      }

      const stat = fs.statSync(filePath);
      const fileSize = stat.size;
      const range = req.headers.range;

      // Determine content type based on extension
      const contentTypes = {
        '.mp3': 'audio/mpeg',
        '.m4a': 'audio/mp4',
        '.webm': 'audio/webm',
        '.opus': 'audio/opus'
      };
      const contentType = contentTypes[fileExt] || 'audio/mpeg';

      if (range) {
        // Handle range request for seeking
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const fileStream = fs.createReadStream(filePath, { start, end });

        res.writeHead(206, {
          ...corsHeaders,
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunksize,
          'Content-Type': contentType,
        });
        fileStream.pipe(res);
      } else {
        // Full file
        res.writeHead(200, {
          ...corsHeaders,
          'Content-Length': fileSize,
          'Content-Type': contentType,
          'Accept-Ranges': 'bytes',
        });
        fs.createReadStream(filePath).pipe(res);
      }
    } catch (err) {
      console.error('[Downloads] Serve error:', err);
      res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // ========================================
  // STEALTH MODE ENDPOINTS
  // ========================================

  // STEALTH: Search with VOYO IDs - /api/search?q=QUERY
  if (pathname === '/api/search' && query.q) {
    try {
      const limit = parseInt(query.limit) || 10;
      const results = await searchYouTube(query.q, limit);

      // Transform all results to use VOYO IDs
      const voyoResults = results.map(sanitizeSearchResult);

      res.writeHead(200, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ results: voyoResults }));
    } catch (err) {
      console.error('[API/Search] Error:', err);
      res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: getVoyoError('SEARCH_FAILED') }));
    }
    return;
  }

  // STEALTH: CDN Art endpoint - accepts both vyo_XXXXX and raw YouTube IDs
  if (pathname.startsWith('/cdn/art/')) {
    try {
      const trackId = pathname.split('/cdn/art/')[1];

      // Accept BOTH VOYO IDs (vyo_XXXXX) and raw YouTube IDs (for seed tracks)
      // SECURITY: All IDs validated with strict regex to prevent command injection
      let youtubeId;
      if (isValidVoyoId(trackId)) {
        youtubeId = decodeVoyoId(trackId);
        console.log(`[CDN/Art] VOYO ID: ${trackId} -> ${youtubeId}`);
      } else if (isValidYouTubeId(trackId)) {
        // Raw YouTube ID - VALIDATED with strict alphanumeric regex
        youtubeId = trackId;
        console.log(`[CDN/Art] Raw ID: ${trackId}`);
      } else {
        console.warn(`[CDN/Art] REJECTED invalid ID: ${trackId}`);
        res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: getVoyoError('INVALID_ID') }));
        return;
      }

      const quality = query.quality || 'high';
      const imageData = await getThumbnail(youtubeId, quality);

      console.log(`[CDN/Art] Served art for ${youtubeId}`);

      res.writeHead(200, {
        ...corsHeaders,
        'Content-Type': 'image/jpeg',
        'Content-Length': imageData.length,
        'Cache-Control': 'public, max-age=3600'
      });
      res.end(imageData);
    } catch (err) {
      console.error('[CDN/Art] Error:', err);
      res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: getVoyoError('THUMBNAIL_FAILED') }));
    }
    return;
  }

  // STEALTH: CDN Stream endpoint - accepts both vyo_XXXXX and raw YouTube IDs
  if (pathname.startsWith('/cdn/stream/')) {
    try {
      const trackId = pathname.split('/cdn/stream/')[1];

      // Accept BOTH VOYO IDs (vyo_XXXXX) and raw YouTube IDs (for seed tracks)
      // SECURITY: All IDs validated with strict regex to prevent command injection
      let youtubeId;
      if (isValidVoyoId(trackId)) {
        youtubeId = decodeVoyoId(trackId);
        console.log(`[CDN/Stream] VOYO ID: ${trackId} -> ${youtubeId}`);
      } else if (isValidYouTubeId(trackId)) {
        // Raw YouTube ID - VALIDATED with strict alphanumeric regex
        youtubeId = trackId;
        console.log(`[CDN/Stream] Raw ID: ${trackId}`);
      } else {
        console.warn(`[CDN/Stream] REJECTED invalid ID: ${trackId}`);
        res.writeHead(400, { ...corsHeaders, 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: getVoyoError('INVALID_ID') }));
        return;
      }

      const type = query.type === 'video' ? 'video' : 'audio';
      const quality = query.quality || 'high'; // Support quality selection
      const result = await getStreamUrl(youtubeId, type, quality);
      const streamUrl = type === 'audio' ? result.audioUrl : result.url;

      console.log(`[CDN/Stream] Streaming ${type} (${quality}) for ${youtubeId}`);
      cacheStats.activeStreams++;

      // Parse the googlevideo URL
      const parsedStream = new URL(streamUrl);

      // Forward request to googlevideo with full range support
      const proxyReq = https.request({
        hostname: parsedStream.hostname,
        path: parsedStream.pathname + parsedStream.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Range': req.headers.range || 'bytes=0-',
        }
      }, (proxyRes) => {
        // Forward headers with CORS
        let contentType = 'audio/webm; codecs=opus';
        const origType = proxyRes.headers['content-type'] || '';
        if (origType.includes('mp4') || origType.includes('m4a')) contentType = 'audio/mp4';
        else if (origType.includes('mpeg') || origType.includes('mp3')) contentType = 'audio/mpeg';

        const headers = {
          ...corsHeaders,
          'Content-Type': contentType,
          'Accept-Ranges': 'bytes',
        };

        // Forward Content-Length if present
        if (proxyRes.headers['content-length']) {
          headers['Content-Length'] = proxyRes.headers['content-length'];
        }

        // Forward Content-Range for partial content (206 responses)
        if (proxyRes.headers['content-range']) {
          headers['Content-Range'] = proxyRes.headers['content-range'];
        }

        // Use appropriate status code (206 for range requests, 200 for full)
        res.writeHead(proxyRes.statusCode, headers);
        proxyRes.pipe(res);

        // Track when stream ends
        proxyRes.on('end', () => {
          cacheStats.activeStreams--;
        });
      });

      proxyReq.on('error', (err) => {
        console.error('[CDN/Stream] Error:', err);
        cacheStats.activeStreams--;
        res.writeHead(500, corsHeaders);
        res.end(JSON.stringify({ error: getVoyoError('STREAM_UNAVAILABLE') }));
      });

      proxyReq.end();
    } catch (err) {
      console.error('[CDN/Stream] Error:', err);
      res.writeHead(500, { ...corsHeaders, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: getVoyoError('STREAM_UNAVAILABLE') }));
    }
    return;
  }

  // 404
  res.writeHead(404, { ...corsHeaders, 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  // Ensure downloads directory exists
  if (!fs.existsSync(DOWNLOADS_DIR)) {
    fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
  }

  // Clear caches on startup to ensure fresh URLs
  streamCache.clear();
  thumbnailCache.clear();
  prefetchCache.clear();

  console.log(`🎵 VOYO Backend running on http://localhost:${PORT}`);
  console.log(`\n   🚀 PRODUCTION-GRADE STREAMING ACTIVE\n`);
  console.log(`   📊 MONITORING:`);
  console.log(`   - GET /health                        → Health check + cache metrics`);
  console.log(`   - GET /prefetch?v=ID&quality=LEVEL   → Warm up stream (202 async)`);
  console.log(`\n   🥷 STEALTH ENDPOINTS (VOYO IDs):`);
  console.log(`   - GET /cdn/stream/vyo_XXXXX?quality=LEVEL  → Stream audio (STEALTH)`);
  console.log(`   - GET /cdn/art/vyo_XXXXX                   → Album art (STEALTH)`);
  console.log(`   - GET /api/search?q=QUERY                  → Search with VOYO IDs`);
  console.log(`\n   🔧 LEGACY ENDPOINTS (YouTube IDs):`);
  console.log(`   - GET /proxy?v=ID&quality=LEVEL      → Stream audio/video`);
  console.log(`   - GET /stream?v=ID&quality=LEVEL     → Get raw stream URL`);
  console.log(`   - GET /search?q=QUERY                → Search YouTube`);
  console.log(`   - GET /thumbnail?id=VIDEO_ID         → Proxy thumbnails`);
  console.log(`\n   💾 OFFLINE PLAYBACK:`);
  console.log(`   - GET /download?v=VIDEO_ID           → Download track`);
  console.log(`   - DELETE /download?v=VIDEO_ID        → Delete downloaded track`);
  console.log(`   - GET /downloaded                    → List downloaded IDs`);
  console.log(`   - GET /downloads/VIDEO_ID.mp3        → Serve downloaded file`);
  console.log(`\n   🎚️  QUALITY LEVELS: low (64kbps) | medium (128kbps) | high (best)`);
});
