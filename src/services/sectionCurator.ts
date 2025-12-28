/**
 * VOYO Section Curator - LLM Brain for Section-Specific Curations
 *
 * THE ARCHITECTURE:
 * User Profile + Collective Data → LLM Brain → Section Curations
 *
 * INPUTS:
 * - User Profile (intent weights, patterns, artists, reactions)
 * - Collective Pool (Supabase tracks with scores)
 * - Section Intents (what each section means)
 *
 * PROCESS:
 * 1. Curate from collective pool first
 * 2. Identify gaps (not enough tracks? missing genres?)
 * 3. Search online to fill gaps
 * 4. Return section-specific curations
 *
 * OUTPUT:
 * {
 *   madeForYou: [...],
 *   discoverMore: [...],
 *   allTimeClassics: [...],
 *   westAfricanHits: [...],
 *   newReleases: [...]
 * }
 */

import { Track } from '../types';
import { usePreferenceStore } from '../store/preferenceStore';
import { useIntentStore } from '../store/intentStore';
import { usePlayerStore } from '../store/playerStore';
import { useTrackPoolStore } from '../store/trackPoolStore';
import {
  getHotTracks as getSupabaseHotTracks,
  getTracksByMode,
  centralToTracks,
  CentralTrack
} from './centralDJ';
import { searchMusic } from './api';
import { safeAddToPool } from './trackVerifier';

// ============================================
// TYPES
// ============================================

export interface UserProfile {
  // Intent (what user WANTS)
  intentWeights: Record<string, number>;
  dominantModes: string[];

  // Behavior (what user DOES)
  topArtists: string[];
  topGenres: string[];
  completionRate: number;
  skipRate: number;
  reactionRate: number;

  // History
  recentTrackIds: string[];
  lovedTrackIds: string[];
  skippedTrackIds: string[];
}

export interface SectionCurations {
  madeForYou: Track[];
  discoverMore: Track[];
  allTimeClassics: Track[];
  westAfricanHits: Track[];
  newReleases: Track[];
  africanVibes: Track[];
  topOnVoyo: Track[];
}

interface GapAnalysis {
  section: keyof SectionCurations;
  needed: number;
  have: number;
  gap: number;
  searchQuery?: string;
}

// Gemini Configuration
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// Section configuration
const SECTION_CONFIG = {
  madeForYou: {
    count: 15,
    intent: 'Personalized picks based on user listening patterns, favorite artists, and preferred vibes'
  },
  discoverMore: {
    count: 15,
    intent: 'Expansion beyond comfort zone - similar but new artists, adjacent genres, taste growth'
  },
  allTimeClassics: {
    count: 15,
    intent: 'Timeless classics in genres the user loves - legendary tracks that defined the genre'
  },
  westAfricanHits: {
    count: 15,
    intent: 'Trending and hot tracks from West Africa - Afrobeats, Amapiano, Nigerian, Ghanaian hits'
  },
  newReleases: {
    count: 15,
    intent: 'Fresh new music matching user taste - recently released tracks from liked artists/genres'
  },
  africanVibes: {
    count: 15,
    intent: 'African music across the continent - from Lagos to Johannesburg, Afrobeats to Amapiano'
  },
  topOnVoyo: {
    count: 10,
    intent: 'Most popular tracks on VOYO based on collective plays, completions, and reactions'
  },
};

// ============================================
// USER PROFILE BUILDER
// ============================================

export function buildUserProfile(): UserProfile {
  const preferences = usePreferenceStore.getState().trackPreferences;
  const intentStore = useIntentStore.getState();
  const playerStore = usePlayerStore.getState();

  // Get intent weights and dominant modes
  const intentWeights = intentStore.getIntentWeights();
  const dominantModes = intentStore.getDominantModes(3);

  // Analyze track preferences
  const prefs = Object.values(preferences);
  const totalListens = prefs.reduce((sum, p) => sum + p.totalListens, 0);
  const totalCompletions = prefs.reduce((sum, p) => sum + p.completions, 0);
  const totalSkips = prefs.reduce((sum, p) => sum + p.skips, 0);
  const totalReactions = prefs.reduce((sum, p) => sum + p.reactions, 0);

  // Extract top artists from history
  const artistCounts: Record<string, number> = {};
  playerStore.history.forEach(track => {
    artistCounts[track.artist] = (artistCounts[track.artist] || 0) + 1;
  });
  const topArtists = Object.entries(artistCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([artist]) => artist);

  // Extract genres/tags from history (using track titles/artists as proxy)
  const genreKeywords = ['afrobeat', 'amapiano', 'r&b', 'hip-hop', 'soul', 'jazz', 'reggae', 'dancehall'];
  const genreCounts: Record<string, number> = {};
  playerStore.history.forEach(track => {
    const text = `${track.title} ${track.artist}`.toLowerCase();
    genreKeywords.forEach(genre => {
      if (text.includes(genre)) {
        genreCounts[genre] = (genreCounts[genre] || 0) + 1;
      }
    });
  });
  const topGenres = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([genre]) => genre);

  // Get loved and skipped tracks
  const lovedTrackIds = prefs
    .filter(p => p.explicitLike === true)
    .map(p => p.trackId);
  const skippedTrackIds = prefs
    .filter(p => p.skips > p.completions)
    .map(p => p.trackId);

  return {
    intentWeights,
    dominantModes,
    topArtists,
    topGenres: topGenres.length > 0 ? topGenres : ['afrobeat', 'r&b'], // Default if no data
    completionRate: totalListens > 0 ? (totalCompletions / totalListens) * 100 : 50,
    skipRate: totalListens > 0 ? (totalSkips / totalListens) * 100 : 10,
    reactionRate: totalListens > 0 ? (totalReactions / totalListens) * 100 : 5,
    recentTrackIds: playerStore.history.slice(0, 20).map(t => t.id),
    lovedTrackIds,
    skippedTrackIds,
  };
}

// ============================================
// COLLECTIVE POOL FETCHER
// ============================================

async function fetchCollectivePool(): Promise<CentralTrack[]> {
  try {
    // Get hot tracks from Supabase (collective intelligence)
    const hotTracks = await getSupabaseHotTracks(100);
    return hotTracks;
  } catch (error) {
    console.error('[SectionCurator] Failed to fetch collective pool:', error);
    return [];
  }
}

async function fetchAfricanTracks(): Promise<CentralTrack[]> {
  try {
    const tracks = await getTracksByMode('afro-heat', 50);
    return tracks;
  } catch (error) {
    console.error('[SectionCurator] Failed to fetch African tracks:', error);
    return [];
  }
}

// ============================================
// LLM CURATION
// ============================================

async function callGeminiForCuration(
  userProfile: UserProfile,
  collectivePool: CentralTrack[],
  gaps: GapAnalysis[]
): Promise<{ section: string; tracks: { title: string; artist: string; reason: string }[] }[]> {

  if (!GEMINI_API_KEY) {
    console.warn('[SectionCurator] No Gemini API key configured');
    return [];
  }

  // Build the prompt
  const prompt = `You are VOYO's intelligent DJ. Your job is to curate music sections for a user.

USER PROFILE:
- Dominant vibes: ${userProfile.dominantModes.join(', ') || 'exploring'}
- Top artists: ${userProfile.topArtists.slice(0, 5).join(', ') || 'various'}
- Top genres: ${userProfile.topGenres.join(', ') || 'afrobeat, r&b'}
- Completion rate: ${userProfile.completionRate.toFixed(0)}%
- Reaction rate: ${userProfile.reactionRate.toFixed(0)}%

COLLECTIVE POOL (${collectivePool.length} tracks available):
${collectivePool.slice(0, 30).map(t => `- "${t.title}" by ${t.artist} (heat: ${t.heat_score}, completion: ${t.completion_rate}%)`).join('\n')}

SECTIONS NEEDING TRACKS:
${gaps.map(g => `- ${g.section}: Need ${g.gap} more tracks. Intent: ${SECTION_CONFIG[g.section as keyof typeof SECTION_CONFIG]?.intent || 'curated picks'}`).join('\n')}

For each section that needs tracks, suggest YouTube music videos. Return ONLY valid JSON:
{
  "curations": [
    {
      "section": "madeForYou",
      "tracks": [
        { "title": "Song Name", "artist": "Artist Name", "reason": "Why this fits" }
      ]
    }
  ]
}

IMPORTANT:
- Suggest REAL songs that exist on YouTube
- Match the section intent precisely
- For "allTimeClassics" - suggest legendary tracks from the user's preferred genres
- For "westAfricanHits" - suggest trending Afrobeats, Amapiano, Nigerian/Ghanaian hits
- For "newReleases" - suggest songs from 2024-2025
- For "discoverMore" - suggest similar but NEW artists the user hasn't heard
- For "madeForYou" - match the user's exact taste profile`;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 4096,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[SectionCurator] No JSON in Gemini response');
      return [];
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return parsed.curations || [];
  } catch (error) {
    console.error('[SectionCurator] Gemini curation failed:', error);
    return [];
  }
}

// ============================================
// GAP FILLER (Search & Verify)
// ============================================

async function fillGapsWithSearch(
  suggestions: { title: string; artist: string; reason: string }[]
): Promise<Track[]> {
  const verified: Track[] = [];

  for (const suggestion of suggestions.slice(0, 5)) { // Limit to 5 searches per section
    try {
      const query = `${suggestion.artist} ${suggestion.title}`;
      const results = await searchMusic(query, 1);

      if (results.length > 0) {
        const track = results[0];
        // Add to pool for future use
        await safeAddToPool(track, 'llm_curation');
        verified.push(track);
      }
    } catch (error) {
      console.error(`[SectionCurator] Failed to verify: ${suggestion.title}`, error);
    }
  }

  return verified;
}

// ============================================
// MAIN CURATOR FUNCTION
// ============================================

export async function curateSections(): Promise<SectionCurations> {
  console.log('[SectionCurator] Starting section curation...');

  // 1. Build user profile
  const userProfile = buildUserProfile();
  console.log('[SectionCurator] User profile:', {
    dominantModes: userProfile.dominantModes,
    topArtists: userProfile.topArtists.slice(0, 3),
    completionRate: userProfile.completionRate.toFixed(0) + '%',
  });

  // 2. Fetch collective pool
  const [collectivePool, africanTracks] = await Promise.all([
    fetchCollectivePool(),
    fetchAfricanTracks(),
  ]);
  console.log(`[SectionCurator] Collective pool: ${collectivePool.length} tracks, African: ${africanTracks.length} tracks`);

  // 3. Initialize curations from collective
  const curations: SectionCurations = {
    madeForYou: [],
    discoverMore: [],
    allTimeClassics: [],
    westAfricanHits: [],
    newReleases: [],
    africanVibes: centralToTracks(africanTracks.slice(0, SECTION_CONFIG.africanVibes.count)),
    topOnVoyo: centralToTracks(collectivePool
      .sort((a, b) => b.heat_score - a.heat_score)
      .slice(0, SECTION_CONFIG.topOnVoyo.count)),
  };

  // 4. Score and assign tracks from collective pool
  const poolTracks = centralToTracks(collectivePool);
  const usedIds = new Set<string>();

  // Made For You: Match user's intent weights
  const madeForYouScored = poolTracks
    .filter(t => !userProfile.skippedTrackIds.includes(t.id))
    .map(track => {
      let score = 0;
      // Boost for matching artists
      if (userProfile.topArtists.some(a => track.artist.toLowerCase().includes(a.toLowerCase()))) {
        score += 50;
      }
      // Boost for high completion rate in collective
      const central = collectivePool.find(c => c.youtube_id === track.trackId);
      if (central) {
        score += central.completion_rate * 0.3;
        score += central.heat_score * 0.2;
      }
      return { track, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, SECTION_CONFIG.madeForYou.count);

  curations.madeForYou = madeForYouScored.map(s => s.track);
  madeForYouScored.forEach(s => usedIds.add(s.track.id));

  // West African Hits: African tracks sorted by heat
  curations.westAfricanHits = centralToTracks(africanTracks
    .sort((a, b) => b.heat_score - a.heat_score)
    .slice(0, SECTION_CONFIG.westAfricanHits.count));
  curations.westAfricanHits.forEach(t => usedIds.add(t.id));

  // Top on VOYO: Already set above
  curations.topOnVoyo.forEach(t => usedIds.add(t.id));

  // 5. Analyze gaps
  const gaps: GapAnalysis[] = [];

  const checkGap = (section: keyof SectionCurations) => {
    const config = SECTION_CONFIG[section];
    const have = curations[section].length;
    const gap = config.count - have;
    if (gap > 0) {
      gaps.push({ section, needed: config.count, have, gap });
    }
  };

  checkGap('madeForYou');
  checkGap('discoverMore');
  checkGap('allTimeClassics');
  checkGap('westAfricanHits');
  checkGap('newReleases');

  console.log('[SectionCurator] Gaps to fill:', gaps);

  // 6. Call LLM to fill gaps
  if (gaps.length > 0) {
    const llmCurations = await callGeminiForCuration(userProfile, collectivePool, gaps);

    // 7. Search and verify LLM suggestions
    for (const curation of llmCurations) {
      const section = curation.section as keyof SectionCurations;
      if (curations[section] && curation.tracks) {
        const verified = await fillGapsWithSearch(curation.tracks);
        curations[section] = [...curations[section], ...verified].slice(0, SECTION_CONFIG[section]?.count || 15);
      }
    }
  }

  // 8. Discover More: Tracks NOT in user's usual taste (expansion)
  const discoverPool = poolTracks.filter(t =>
    !usedIds.has(t.id) &&
    !userProfile.topArtists.some(a => t.artist.toLowerCase().includes(a.toLowerCase()))
  );
  curations.discoverMore = discoverPool.slice(0, SECTION_CONFIG.discoverMore.count);

  console.log('[SectionCurator] Curation complete:', {
    madeForYou: curations.madeForYou.length,
    discoverMore: curations.discoverMore.length,
    allTimeClassics: curations.allTimeClassics.length,
    westAfricanHits: curations.westAfricanHits.length,
    newReleases: curations.newReleases.length,
    africanVibes: curations.africanVibes.length,
    topOnVoyo: curations.topOnVoyo.length,
  });

  return curations;
}

// ============================================
// QUICK ACCESS (for individual sections)
// ============================================

let cachedCurations: SectionCurations | null = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getCurations(): Promise<SectionCurations> {
  const now = Date.now();

  // Return cache if fresh
  if (cachedCurations && (now - cacheTime) < CACHE_TTL) {
    return cachedCurations;
  }

  // Curate fresh
  cachedCurations = await curateSections();
  cacheTime = now;

  return cachedCurations;
}

export function invalidateCurationCache(): void {
  cachedCurations = null;
  cacheTime = 0;
}

// Export for direct section access
export async function getMadeForYou(): Promise<Track[]> {
  const curations = await getCurations();
  return curations.madeForYou;
}

export async function getDiscoverMore(): Promise<Track[]> {
  const curations = await getCurations();
  return curations.discoverMore;
}

export async function getAllTimeClassics(): Promise<Track[]> {
  const curations = await getCurations();
  return curations.allTimeClassics;
}

export async function getWestAfricanHits(): Promise<Track[]> {
  const curations = await getCurations();
  return curations.westAfricanHits;
}

export async function getNewReleases(): Promise<Track[]> {
  const curations = await getCurations();
  return curations.newReleases;
}

export async function getAfricanVibes(): Promise<Track[]> {
  const curations = await getCurations();
  return curations.africanVibes;
}

export async function getTopOnVoyo(): Promise<Track[]> {
  const curations = await getCurations();
  return curations.topOnVoyo;
}
