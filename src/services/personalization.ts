/**
 * VOYO Music - Personalization Service
 * Smart scoring algorithm for HOT and DISCOVERY zones
 *
 * Uses user preferences to rank tracks based on:
 * - Listen history (completion rate, skips)
 * - Reactions (OYÉ score)
 * - Explicit likes/dislikes
 * - Artist/tag/mood affinity
 */

import { Track } from '../types';
import { TrackPreference, usePreferenceStore } from '../store/preferenceStore';
import { TRACKS } from '../data/tracks';

// ============================================
// SCORING WEIGHTS
// ============================================

const WEIGHTS = {
  // Direct track signals
  EXPLICIT_LIKE: 100,
  EXPLICIT_DISLIKE: -200,
  COMPLETION_RATE: 50, // max 50 points for 100% completion
  REACTIONS: 10, // points per reaction
  SKIP_PENALTY: -30, // per skip

  // Indirect signals (artist, tags, mood)
  ARTIST_AFFINITY: 40,
  TAG_AFFINITY: 20,
  MOOD_AFFINITY: 15,

  // Popularity boost
  OYE_SCORE_BOOST: 0.00001, // Small boost for popular tracks
};

// ============================================
// SCORING FUNCTIONS
// ============================================

/**
 * Calculate track score based on user preferences
 * Higher score = more personalized to user
 */
export function calculateTrackScore(track: Track, preferences: Record<string, TrackPreference>): number {
  const pref = preferences[track.id];
  let score = 0;

  // 1. EXPLICIT SIGNALS (strongest)
  if (pref?.explicitLike !== undefined) {
    score += pref.explicitLike ? WEIGHTS.EXPLICIT_LIKE : WEIGHTS.EXPLICIT_DISLIKE;
  }

  // 2. LISTEN BEHAVIOR (strong)
  if (pref) {
    // Completion rate (0-100%)
    const completionRate = pref.totalListens > 0
      ? (pref.completions / pref.totalListens) * 100
      : 0;
    const completionScore = (completionRate / 100) * WEIGHTS.COMPLETION_RATE;
    score += completionScore;

    // Reactions
    const reactionScore = pref.reactions * WEIGHTS.REACTIONS;
    score += reactionScore;

    // Skip penalty
    const skipScore = pref.skips * WEIGHTS.SKIP_PENALTY;
    score += skipScore;
  }

  // 6. POPULARITY BOOST (small)
  const popularityBoost = track.oyeScore * WEIGHTS.OYE_SCORE_BOOST;
  score += popularityBoost;

  return score;
}

/**
 * Get personalized HOT tracks (trending + personalized)
 * Blends global popularity with user preferences
 */
export function getPersonalizedHotTracks(limit: number = 5): Track[] {
  const preferences = usePreferenceStore.getState().trackPreferences;

  // Score all tracks
  const scored = TRACKS.map((track) => ({
    track,
    score: calculateTrackScore(track, preferences),
  }));

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Return top N
  return scored.slice(0, limit).map((s) => s.track);
}

/**
 * Get personalized DISCOVERY tracks (similar to current track + preferences)
 * Combines track similarity with user preferences
 */
export function getPersonalizedDiscoveryTracks(
  currentTrack: Track,
  limit: number = 5,
  excludeIds: string[] = []
): Track[] {
  const preferences = usePreferenceStore.getState().trackPreferences;

  // Filter out excluded tracks
  const candidates = TRACKS.filter(
    (t) => t.id !== currentTrack.id && !excludeIds.includes(t.id)
  );

  // Score each track
  const scored = candidates.map((track) => {
    let score = 0;

    // 1. SIMILARITY TO CURRENT TRACK (baseline)
    // Same artist (strongest)
    if (track.artist.toLowerCase() === currentTrack.artist.toLowerCase()) {
      score += 50;
    }

    // Same mood
    if (track.mood && currentTrack.mood && track.mood === currentTrack.mood) {
      score += 30;
    }

    // Matching tags
    const matchingTags = track.tags.filter((tag) =>
      currentTrack.tags.map((t) => t.toLowerCase()).includes(tag.toLowerCase())
    );
    score += matchingTags.length * 10;

    // Same region
    if (track.region && currentTrack.region && track.region === currentTrack.region) {
      score += 5;
    }

    // 2. USER PREFERENCES (personalization)
    const personalScore = calculateTrackScore(track, preferences);
    score += personalScore * 0.5; // 50% weight on personal prefs

    // 3. POPULARITY (small boost)
    score += track.oyeScore / 1000000;

    return { track, score };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Return top N
  return scored.slice(0, limit).map((s) => s.track);
}

/**
 * Get tracks the user is likely to skip (for testing)
 */
export function getLikelySkips(limit: number = 5): Track[] {
  const preferences = usePreferenceStore.getState().trackPreferences;

  const scored = TRACKS.map((track) => {
    const pref = preferences[track.id];
    if (!pref) return { track, skipRate: 0 };

    const skipRate = pref.totalListens > 0
      ? (pref.skips / pref.totalListens) * 100
      : 0;

    return { track, skipRate };
  });

  // Sort by skip rate descending
  scored.sort((a, b) => b.skipRate - a.skipRate);

  return scored.slice(0, limit).map((s) => s.track);
}

/**
 * Get user's top tracks (most completed, most reactions)
 */
export function getUserTopTracks(limit: number = 10): Track[] {
  const preferences = usePreferenceStore.getState().trackPreferences;

  const scored = TRACKS.map((track) => {
    const pref = preferences[track.id];
    if (!pref) return { track, score: 0 };

    const completionRate = pref.totalListens > 0
      ? (pref.completions / pref.totalListens) * 100
      : 0;

    const score = pref.completions * 10 + pref.reactions * 5 + completionRate;
    return { track, score };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  return scored
    .filter((s) => s.score > 0)
    .slice(0, limit)
    .map((s) => s.track);
}

/**
 * Debug: Print preference stats
 */
export function debugPreferences(): void {
  const state = usePreferenceStore.getState();
  const prefs = Object.values(state.trackPreferences);

  if (prefs.length === 0) {
    return;
  }
}
