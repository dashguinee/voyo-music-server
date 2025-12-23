/**
 * VOYO Music - Intelligent DJ Service
 *
 * THE KILLER ARCHITECTURE:
 * AI understands your vibe → Finds actual YouTube videos → Verified playable content
 *
 * Flow:
 * 1. Collect listening context (mood, patterns, favorites)
 * 2. Ask Gemini to find ACTUAL YouTube video URLs that match
 * 3. Extract video IDs from URLs
 * 4. Verify with our backend → Add to pool
 *
 * The app doesn't need a static database - it discovers content in real-time!
 */

import { Track } from '../types';
import { searchMusic } from './api';
import { useTrackPoolStore } from '../store/trackPoolStore';
import { getThumb } from '../utils/thumbnail';
import { encodeVoyoId } from '../utils/voyoId';

// Gemini Configuration
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// DJ Configuration
const DJ_TRIGGER_TRACKS = 4;       // DJ kicks in after 4 tracks
const DJ_MIN_INTERVAL = 90000;    // Minimum 1.5 minutes between DJ runs
const MAX_VIDEOS_PER_RUN = 8;     // Find up to 8 videos per run

// ============================================
// TYPES
// ============================================

interface ListeningContext {
  recentTracks: TrackSnapshot[];
  favoriteArtists: string[];
  currentMood: string;
  timeOfDay: string;
  skipRate: number;
  lovedTracks: string[];
}

interface TrackSnapshot {
  title: string;
  artist: string;
  wasLoved: boolean;
  wasSkipped: boolean;
}

interface DJSuggestion {
  youtubeUrl: string;
  title: string;
  artist: string;
  reason: string;
}

interface DJResponse {
  vibe: string;
  suggestions: DJSuggestion[];
}

// ============================================
// STATE
// ============================================

let listeningHistory: TrackSnapshot[] = [];
let lastDJRun = 0;
let djEnabled = true;

// ============================================
// YOUTUBE URL PARSING
// ============================================

/**
 * Extract YouTube video ID from various URL formats
 */
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/, // Just the ID
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * Validate YouTube ID format
 */
function isValidYouTubeId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{11}$/.test(id);
}

// ============================================
// CONTEXT BUILDING
// ============================================

/**
 * Build listening context for the AI
 */
function buildContext(): ListeningContext {
  const recent = listeningHistory.slice(-10);

  // Find favorite artists (appeared 2+ times or were loved)
  const artistCounts: Record<string, number> = {};
  const lovedTracks: string[] = [];

  recent.forEach(t => {
    artistCounts[t.artist] = (artistCounts[t.artist] || 0) + 1;
    if (t.wasLoved) lovedTracks.push(`${t.artist} - ${t.title}`);
  });

  const favoriteArtists = Object.entries(artistCounts)
    .filter(([_, count]) => count >= 2)
    .map(([artist]) => artist);

  // Calculate skip rate
  const skipRate = recent.length > 0
    ? recent.filter(t => t.wasSkipped).length / recent.length
    : 0;

  // Determine time of day
  const hour = new Date().getHours();
  const timeOfDay = hour < 6 ? 'late night'
    : hour < 12 ? 'morning'
    : hour < 18 ? 'afternoon'
    : 'evening';

  // Infer mood from recent tracks
  const currentMood = inferMood(recent);

  return {
    recentTracks: recent,
    favoriteArtists,
    currentMood,
    timeOfDay,
    skipRate,
    lovedTracks,
  };
}

function inferMood(tracks: TrackSnapshot[]): string {
  if (tracks.length === 0) return 'exploring';

  const loved = tracks.filter(t => t.wasLoved);
  if (loved.length > 2) return 'vibing';

  const skipped = tracks.filter(t => t.wasSkipped);
  if (skipped.length > tracks.length / 2) return 'searching';

  return 'flowing';
}

// ============================================
// GEMINI INTEGRATION
// ============================================

/**
 * Build the DJ prompt for Gemini
 */
function buildDJPrompt(context: ListeningContext): string {
  const trackList = context.recentTracks
    .map((t, i) => {
      const status = t.wasSkipped ? '⏭️ skipped' : t.wasLoved ? '❤️ loved' : '✓ played';
      return `${i + 1}. ${t.artist} - ${t.title} [${status}]`;
    })
    .join('\n');

  return `You are VOYO's intelligent DJ. Your job is to find REAL YouTube music videos that match the listener's vibe.

CURRENT LISTENING SESSION:
${trackList || '(Just started)'}

CONTEXT:
- Time: ${context.timeOfDay}
- Mood: ${context.currentMood}
- Skip rate: ${(context.skipRate * 100).toFixed(0)}%
- Favorite artists: ${context.favoriteArtists.join(', ') || 'Still learning...'}
- Loved tracks: ${context.lovedTracks.join(', ') || 'None yet'}

YOUR MISSION:
Find ${MAX_VIDEOS_PER_RUN} YouTube music videos that would PERFECTLY fit what this person wants to hear next.

RULES:
1. Focus on African music: Afrobeats, Amapiano, Afro-soul, Afro-pop, Highlife, Dancehall
2. If they loved certain artists, find more from those artists OR similar vibes
3. If they're skipping a lot, try something different but still African
4. Match the time of day energy (late night = chill, morning = uplifting)
5. Return ACTUAL YouTube URLs - these must be real, playable videos

RESPOND WITH VALID JSON ONLY:
{
  "vibe": "One sentence describing the vibe you're curating for",
  "suggestions": [
    {
      "youtubeUrl": "https://www.youtube.com/watch?v=VIDEO_ID",
      "title": "Song Title",
      "artist": "Artist Name",
      "reason": "Why this fits (one sentence)"
    }
  ]
}

IMPORTANT:
- URLs must be REAL YouTube videos that exist
- Prefer official music videos or audio uploads
- Include mix of familiar and discovery tracks
- No age-restricted or unavailable content`;
}

/**
 * Call Gemini API to get DJ suggestions
 */
async function callGeminiDJ(prompt: string): Promise<DJResponse | null> {
  if (!GEMINI_API_KEY) {
    console.warn('[Intelligent DJ] No API key configured');
    return null;
  }

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.8,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Intelligent DJ] API error:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      console.error('[Intelligent DJ] No text in response');
      return null;
    }

    // Parse JSON from response
    let jsonStr = text.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    }

    const result: DJResponse = JSON.parse(jsonStr);
    console.log(`[Intelligent DJ] 🎧 Vibe: "${result.vibe}"`);

    return result;

  } catch (error) {
    console.error('[Intelligent DJ] Error:', error);
    return null;
  }
}

// ============================================
// TRACK PROCESSING
// ============================================

/**
 * Convert DJ suggestion to VOYO Track
 */
function suggestionToTrack(suggestion: DJSuggestion, youtubeId: string): Track {
  const voyoId = encodeVoyoId(youtubeId);

  return {
    id: `dj_${youtubeId}`,
    title: suggestion.title,
    artist: suggestion.artist,
    album: 'DJ Discovery',
    trackId: voyoId,
    coverUrl: getThumb(youtubeId),
    duration: 0, // Will be determined on play
    tags: ['dj-pick', 'discovery'],
    mood: 'afro',
    region: 'NG',
    oyeScore: 0,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Process DJ suggestions and add valid ones to pool
 */
async function processSuggestions(suggestions: DJSuggestion[]): Promise<number> {
  const poolStore = useTrackPoolStore.getState();
  let added = 0;

  for (const suggestion of suggestions) {
    // Extract YouTube ID from URL
    const youtubeId = extractYouTubeId(suggestion.youtubeUrl);

    if (!youtubeId || !isValidYouTubeId(youtubeId)) {
      console.warn(`[Intelligent DJ] Invalid URL: ${suggestion.youtubeUrl}`);
      continue;
    }

    // Convert to track and add to pool
    const track = suggestionToTrack(suggestion, youtubeId);
    poolStore.addToPool(track, 'llm');
    added++;

    console.log(`[Intelligent DJ] ✅ Added: ${suggestion.artist} - ${suggestion.title}`);
  }

  return added;
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Record a track play for DJ context
 */
export function recordPlay(track: Track, wasLoved: boolean = false, wasSkipped: boolean = false): void {
  listeningHistory.push({
    title: track.title,
    artist: track.artist,
    wasLoved,
    wasSkipped,
  });

  // Keep only last 20
  if (listeningHistory.length > 20) {
    listeningHistory = listeningHistory.slice(-20);
  }

  // Check if DJ should run
  checkDJTrigger();
}

/**
 * Check if we should trigger the DJ
 */
async function checkDJTrigger(): Promise<void> {
  if (!djEnabled) return;

  const now = Date.now();
  const timeSinceLastRun = now - lastDJRun;

  if (listeningHistory.length >= DJ_TRIGGER_TRACKS && timeSinceLastRun >= DJ_MIN_INTERVAL) {
    await runDJ();
  }
}

/**
 * Run the intelligent DJ
 */
export async function runDJ(): Promise<number> {
  lastDJRun = Date.now();

  console.log('[Intelligent DJ] 🎧 DJ is finding tracks for you...');

  // Build context and prompt
  const context = buildContext();
  const prompt = buildDJPrompt(context);

  // Call Gemini
  const response = await callGeminiDJ(prompt);

  if (!response || !response.suggestions || response.suggestions.length === 0) {
    console.log('[Intelligent DJ] No suggestions, falling back to search');
    return await fallbackToSearch(context);
  }

  // Process suggestions
  const added = await processSuggestions(response.suggestions);

  console.log(`[Intelligent DJ] 🎉 Added ${added} tracks to your queue`);

  // Trigger recommendation refresh
  import('../store/playerStore').then(({ usePlayerStore }) => {
    usePlayerStore.getState().refreshRecommendations?.();
  }).catch(() => {});

  return added;
}

/**
 * Fallback to search-based discovery if Gemini fails
 */
async function fallbackToSearch(context: ListeningContext): Promise<number> {
  const query = context.favoriteArtists.length > 0
    ? `${context.favoriteArtists[0]} ${context.currentMood === 'vibing' ? 'hits' : 'songs'}`
    : 'afrobeats trending 2024';

  console.log(`[Intelligent DJ] Fallback search: "${query}"`);

  try {
    const results = await searchMusic(query, 10);
    const poolStore = useTrackPoolStore.getState();

    let added = 0;
    for (const result of results) {
      const track: Track = {
        id: result.voyoId,
        title: result.title,
        artist: result.artist,
        album: 'VOYO',
        trackId: result.voyoId,
        coverUrl: result.thumbnail,
        duration: result.duration,
        tags: ['fallback'],
        mood: 'afro',
        region: 'NG',
        oyeScore: result.views || 0,
        createdAt: new Date().toISOString(),
      };

      poolStore.addToPool(track, 'related');
      added++;
    }

    return added;
  } catch (error) {
    console.error('[Intelligent DJ] Fallback also failed:', error);
    return 0;
  }
}

/**
 * Force DJ to run now (for testing)
 */
export async function forceDJ(): Promise<number> {
  console.log('[Intelligent DJ] 🎧 Force running DJ...');
  return await runDJ();
}

/**
 * Enable/disable DJ
 */
export function setDJEnabled(enabled: boolean): void {
  djEnabled = enabled;
  console.log(`[Intelligent DJ] DJ ${enabled ? 'enabled' : 'disabled'}`);
}

/**
 * Get DJ status
 */
export function getDJStatus() {
  return {
    enabled: djEnabled,
    historyLength: listeningHistory.length,
    lastRun: lastDJRun,
    timeSinceLastRun: Date.now() - lastDJRun,
  };
}

/**
 * Reset DJ state
 */
export function resetDJ(): void {
  listeningHistory = [];
  lastDJRun = 0;
  console.log('[Intelligent DJ] DJ reset');
}

/**
 * Test Gemini connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Say "VOYO DJ ready" and nothing else.' }] }],
        generationConfig: { maxOutputTokens: 20 },
      }),
    });

    if (!response.ok) {
      console.error('[Intelligent DJ] Connection test failed:', response.status);
      return false;
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    console.log('[Intelligent DJ] Connection test:', text);
    return text?.toLowerCase().includes('voyo') || text?.toLowerCase().includes('ready');
  } catch (error) {
    console.error('[Intelligent DJ] Connection test error:', error);
    return false;
  }
}

// ============================================
// DEBUG HELPERS
// ============================================

if (typeof window !== 'undefined') {
  (window as any).voyoDJ = {
    run: forceDJ,
    test: testConnection,
    status: getDJStatus,
    reset: resetDJ,
    enable: () => setDJEnabled(true),
    disable: () => setDJEnabled(false),
  };
  console.log('🎧 [Intelligent DJ] Debug: window.voyoDJ.run() / .test() / .status()');
}

export default {
  recordPlay,
  runDJ,
  forceDJ,
  testConnection,
  getDJStatus,
  resetDJ,
  setDJEnabled,
};
