/**
 * VOYO Music - Track Verifier Service
 *
 * SELF-HEALING LOOP:
 * When a thumbnail fails to load (hallucinated/invalid YouTube ID),
 * this service verifies the track via searchMusic() and updates it
 * with the real YouTube ID.
 *
 * Flow:
 * 1. SmartImage fails all fallbacks → calls verifyTrack(trackId, artist, title)
 * 2. We search backend for "artist title" → get VERIFIED voyoId
 * 3. Update track in pool/store with new ID
 * 4. Save to Central DB for future users
 * 5. Return new thumbnail URL
 *
 * SUCCESS METRIC: 0 placeholders, 0 lost tracks
 */

import { searchMusic } from './api';
import { saveVerifiedTrack } from './centralDJ';
import { useTrackPoolStore, PooledTrack } from '../store/trackPoolStore';
import { usePlayerStore } from '../store/playerStore';
import { getThumb } from '../utils/thumbnail';
import { Track } from '../types';

// Flag to prevent multiple batch heals
let hasRunStartupHeal = false;

// Debounce/queue to avoid hammering API
const pendingVerifications = new Map<string, Promise<string | null>>();
const verificationResults = new Map<string, { voyoId: string; thumbnail: string } | null>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Verify and fix a track with a failed thumbnail
 * Returns the new thumbnail URL if verification succeeds, null otherwise
 */
export async function verifyTrack(
  originalTrackId: string,
  artist: string,
  title: string
): Promise<string | null> {
  const cacheKey = `${artist}|${title}`.toLowerCase();

  // Check cache first
  const cached = verificationResults.get(cacheKey);
  if (cached !== undefined) {
    if (cached === null) {
      console.log(`[TrackVerifier] ❌ Already failed: ${artist} - ${title}`);
      return null;
    }
    console.log(`[TrackVerifier] ✅ Cache hit: ${artist} - ${title}`);
    return cached.thumbnail;
  }

  // Check if already in progress
  const pending = pendingVerifications.get(cacheKey);
  if (pending) {
    console.log(`[TrackVerifier] ⏳ Already verifying: ${artist} - ${title}`);
    return pending;
  }

  // Start verification
  const verificationPromise = doVerification(originalTrackId, artist, title, cacheKey);
  pendingVerifications.set(cacheKey, verificationPromise);

  try {
    return await verificationPromise;
  } finally {
    pendingVerifications.delete(cacheKey);
  }
}

async function doVerification(
  originalTrackId: string,
  artist: string,
  title: string,
  cacheKey: string
): Promise<string | null> {
  console.log(`[TrackVerifier] 🔍 Verifying: ${artist} - ${title}`);

  try {
    // Search for the real track
    const searchQuery = `${artist} ${title}`;
    const results = await searchMusic(searchQuery, 3);

    if (results.length === 0) {
      console.log(`[TrackVerifier] ❌ No results for: ${searchQuery}`);
      verificationResults.set(cacheKey, null);

      // Clear cache after TTL
      setTimeout(() => verificationResults.delete(cacheKey), CACHE_TTL);
      return null;
    }

    // Use the best match
    const verified = results[0];
    const newThumbnail = verified.thumbnail || getThumb(verified.voyoId);

    console.log(`[TrackVerifier] ✅ Found: ${verified.artist} - ${verified.title}`);
    console.log(`[TrackVerifier]    Old ID: ${originalTrackId}`);
    console.log(`[TrackVerifier]    New ID: ${verified.voyoId}`);

    // Cache the result
    verificationResults.set(cacheKey, {
      voyoId: verified.voyoId,
      thumbnail: newThumbnail,
    });

    // Clear cache after TTL
    setTimeout(() => verificationResults.delete(cacheKey), CACHE_TTL);

    // Update track in pool store
    updateTrackInPool(originalTrackId, verified);

    // Update track in player store if it's the current track
    updateCurrentTrack(originalTrackId, verified);

    // Save to Central DB for future users
    saveToDatabase(verified, artist, title);

    return newThumbnail;

  } catch (error) {
    console.error(`[TrackVerifier] Error verifying ${artist} - ${title}:`, error);
    verificationResults.set(cacheKey, null);
    setTimeout(() => verificationResults.delete(cacheKey), CACHE_TTL);
    return null;
  }
}

/**
 * Update track in the hot pool with verified ID
 */
function updateTrackInPool(originalTrackId: string, verified: { voyoId: string; title: string; artist: string; thumbnail: string; duration: number }) {
  try {
    const poolStore = useTrackPoolStore.getState();
    const hotPool = poolStore.hotPool;

    // Find tracks with the original ID
    const tracksToUpdate = hotPool.filter(t =>
      t.trackId === originalTrackId ||
      t.id === originalTrackId ||
      t.id === `dj_${originalTrackId}`
    );

    for (const poolTrack of tracksToUpdate) {
      // Update the track in place
      poolTrack.trackId = verified.voyoId;
      poolTrack.coverUrl = verified.thumbnail;
      if (verified.duration) poolTrack.duration = verified.duration;

      console.log(`[TrackVerifier] 📦 Updated pool track: ${poolTrack.title}`);
    }
  } catch (error) {
    console.warn('[TrackVerifier] Could not update pool:', error);
  }
}

/**
 * Update current track if it matches the verified one
 */
function updateCurrentTrack(originalTrackId: string, verified: { voyoId: string; title: string; artist: string; thumbnail: string; duration: number }) {
  try {
    const playerStore = usePlayerStore.getState();
    const currentTrack = playerStore.currentTrack;

    if (currentTrack && (currentTrack.trackId === originalTrackId || currentTrack.id === originalTrackId)) {
      // Create updated track
      const updatedTrack: Track = {
        ...currentTrack,
        trackId: verified.voyoId,
        coverUrl: verified.thumbnail,
        duration: verified.duration || currentTrack.duration,
      };

      // Update current track (this will trigger re-render with new thumbnail)
      playerStore.setCurrentTrack(updatedTrack);
      console.log(`[TrackVerifier] 🎵 Updated current track: ${currentTrack.title}`);
    }
  } catch (error) {
    console.warn('[TrackVerifier] Could not update current track:', error);
  }
}

/**
 * Save verified track to Central DB
 */
async function saveToDatabase(verified: { voyoId: string; title: string; artist: string; thumbnail: string; duration: number }, originalArtist: string, originalTitle: string) {
  try {
    const track: Track = {
      id: `verified_${verified.voyoId}`,
      title: verified.title || originalTitle,
      artist: verified.artist || originalArtist,
      album: 'Verified',
      trackId: verified.voyoId,
      coverUrl: verified.thumbnail,
      duration: verified.duration || 0,
      tags: ['verified', 'self-healed'],
      mood: 'afro',
      region: 'NG',
      oyeScore: 0,
      createdAt: new Date().toISOString(),
    };

    const saved = await saveVerifiedTrack(track, undefined, 'self-heal');
    if (saved) {
      console.log(`[TrackVerifier] 💾 Saved to Central DB for future users!`);
    }
  } catch (error) {
    console.warn('[TrackVerifier] Could not save to Central DB:', error);
  }
}

/**
 * Clear verification cache (for testing)
 */
export function clearVerificationCache(): void {
  verificationResults.clear();
  pendingVerifications.clear();
  console.log('[TrackVerifier] Cache cleared');
}

// ============================================
// BATCH HEALER - One-time fix for all bad tracks
// ============================================

/**
 * Check if a thumbnail URL is valid (actually loads)
 */
async function isThumbnailValid(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
    // Timeout after 5 seconds
    setTimeout(() => resolve(false), 5000);
  });
}

/**
 * BATCH HEAL - Fix ALL tracks with bad thumbnails
 * Run once to ensure no user ever sees a placeholder
 *
 * Returns: { healed: number, failed: string[], total: number }
 */
export async function batchHealTracks(): Promise<{
  healed: number;
  failed: string[];
  total: number;
  skipped: number;
}> {
  console.log('[TrackVerifier] 🔧 BATCH HEAL STARTED...');

  const poolStore = useTrackPoolStore.getState();
  const hotPool = poolStore.hotPool;

  let healed = 0;
  let skipped = 0;
  const failed: string[] = [];

  console.log(`[TrackVerifier] 📊 Checking ${hotPool.length} tracks in pool...`);

  for (const track of hotPool) {
    const thumbnailUrl = getThumb(track.trackId);

    // Check if thumbnail is valid
    const isValid = await isThumbnailValid(thumbnailUrl);

    if (isValid) {
      skipped++;
      continue; // Thumbnail works, skip
    }

    console.log(`[TrackVerifier] ❌ Bad thumbnail: ${track.artist} - ${track.title}`);

    // Try to heal
    const result = await verifyTrack(track.trackId, track.artist, track.title);

    if (result) {
      healed++;
      console.log(`[TrackVerifier] ✅ Healed: ${track.artist} - ${track.title}`);
    } else {
      failed.push(`${track.artist} - ${track.title}`);
      console.log(`[TrackVerifier] ⚠️ Could not heal: ${track.artist} - ${track.title}`);
    }

    // Small delay to avoid hammering API
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`[TrackVerifier] 🎉 BATCH HEAL COMPLETE`);
  console.log(`[TrackVerifier]    Total: ${hotPool.length}`);
  console.log(`[TrackVerifier]    Valid: ${skipped}`);
  console.log(`[TrackVerifier]    Healed: ${healed}`);
  console.log(`[TrackVerifier]    Failed: ${failed.length}`);

  return { healed, failed, total: hotPool.length, skipped };
}

/**
 * Pre-validate a track BEFORE it enters the pool
 * Call this when adding tracks from any source
 */
export async function validateBeforePool(
  trackId: string,
  artist: string,
  title: string
): Promise<{ valid: boolean; verifiedId?: string; thumbnail?: string }> {
  const thumbnailUrl = getThumb(trackId);
  const isValid = await isThumbnailValid(thumbnailUrl);

  if (isValid) {
    return { valid: true };
  }

  // Not valid, verify immediately
  console.log(`[TrackVerifier] 🔍 Pre-validating: ${artist} - ${title}`);

  try {
    const results = await searchMusic(`${artist} ${title}`, 3);

    if (results.length > 0) {
      const verified = results[0];
      return {
        valid: true,
        verifiedId: verified.voyoId,
        thumbnail: verified.thumbnail,
      };
    }
  } catch (error) {
    console.warn(`[TrackVerifier] Pre-validation failed for ${artist} - ${title}`);
  }

  return { valid: false };
}

/**
 * SAFE ADD TO POOL - Validates before adding
 * Use this instead of addToPool directly to ensure no bad tracks enter
 */
export async function safeAddToPool(
  track: Track,
  source: PooledTrack['source']
): Promise<boolean> {
  const validation = await validateBeforePool(track.trackId, track.artist, track.title);

  if (!validation.valid) {
    console.warn(`[TrackVerifier] ❌ Rejected invalid track: ${track.artist} - ${track.title}`);
    return false;
  }

  // Update track with verified ID if different
  const finalTrack = validation.verifiedId ? {
    ...track,
    trackId: validation.verifiedId,
    coverUrl: validation.thumbnail || track.coverUrl,
  } : track;

  // Add to pool
  useTrackPoolStore.getState().addToPool(finalTrack, source);
  return true;
}

/**
 * SAFE ADD MANY TO POOL - Validates each track before adding
 * Use this instead of addManyToPool directly
 */
export async function safeAddManyToPool(
  tracks: Track[],
  source: PooledTrack['source']
): Promise<number> {
  let added = 0;
  for (const track of tracks) {
    const wasAdded = await safeAddToPool(track, source);
    if (wasAdded) added++;
  }
  return added;
}

/**
 * RUN AT APP STARTUP - Heal any existing bad tracks
 * Called once when app initializes
 */
export async function runStartupHeal(): Promise<void> {
  if (hasRunStartupHeal) {
    console.log('[TrackVerifier] Startup heal already ran');
    return;
  }

  hasRunStartupHeal = true;

  // Wait a bit for app to stabilize
  await new Promise(r => setTimeout(r, 2000));

  const poolStore = useTrackPoolStore.getState();

  if (poolStore.hotPool.length === 0) {
    console.log('[TrackVerifier] No tracks in pool, skipping startup heal');
    return;
  }

  console.log('[TrackVerifier] 🚀 Running startup heal...');

  // Run batch heal in background
  batchHealTracks().then(result => {
    if (result.healed > 0) {
      console.log(`[TrackVerifier] ✅ Startup heal fixed ${result.healed} tracks`);
    }
    if (result.failed.length > 0) {
      console.warn(`[TrackVerifier] ⚠️ Could not heal ${result.failed.length} tracks`);
    }
  }).catch(err => {
    console.error('[TrackVerifier] Startup heal error:', err);
  });
}

// Debug helper
if (typeof window !== 'undefined') {
  (window as any).trackVerifier = {
    verify: verifyTrack,
    batchHeal: batchHealTracks,
    safeAdd: safeAddToPool,
    safeAddMany: safeAddManyToPool,
    validateBeforePool,
    runStartupHeal,
    clearCache: clearVerificationCache,
    getPending: () => Array.from(pendingVerifications.keys()),
    getCached: () => Array.from(verificationResults.entries()),
  };
  console.log('🔧 [TrackVerifier] Debug commands:');
  console.log('   window.trackVerifier.batchHeal()  - Fix ALL bad thumbnails NOW');
  console.log('   window.trackVerifier.verify(id, artist, title)  - Fix single track');
}

export default {
  verifyTrack,
  batchHealTracks,
  safeAddToPool,
  safeAddManyToPool,
  validateBeforePool,
  runStartupHeal,
  clearVerificationCache,
};
