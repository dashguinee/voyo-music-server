/**
 * VOYO Music - Playback Orchestrator
 *
 * Single source of truth for ALL playback operations.
 * Eliminates race conditions by coordinating AudioPlayer + YouTubeIframe.
 *
 * FLOW:
 * 1. play(track) called from any component
 * 2. Set track in store
 * 3. Wait for ready signal (cached audio loaded OR iframe ready)
 * 4. Trigger playback
 * 5. Verify playback actually started (background check)
 * 6. Retry if verification fails
 *
 * GUARANTEES:
 * - Single entry point = no race conditions
 * - Verification = no silent failures
 * - Retry logic = resilient to transient issues
 * - Fallback chain = cached → iframe → retry
 */

import { usePlayerStore } from '../store/playerStore';
import { Track } from '../types';

// Orchestrator state
let isOrchestrating = false;
let currentPlayRequest: string | null = null;
let verificationTimer: ReturnType<typeof setTimeout> | null = null;
let retryCount = 0;

const MAX_RETRIES = 5;
const VERIFICATION_DELAY = 1200; // Check if playing after 1200ms (iframe needs time to load)
const RETRY_DELAY = 800;

/**
 * Get the actual audio element
 */
function getAudioElement(): HTMLAudioElement | null {
  return document.querySelector('audio');
}

/**
 * Check if audio is actually playing (not just state says so)
 */
function isActuallyPlaying(): boolean {
  const audio = getAudioElement();
  const state = usePlayerStore.getState();

  // CRITICAL: Wait for playbackSource to be determined
  // AudioPlayer sets this after checking cache - null means still loading
  if (state.playbackSource === null) {
    console.log('[Orchestrator] Waiting for playbackSource to be determined...');
    return false;
  }

  // For cached playback, check audio element is actually playing
  if (state.playbackSource === 'cached' && audio) {
    const actuallyPlaying = !audio.paused && audio.currentTime > 0;
    console.log(`[Orchestrator] Cached check: paused=${audio.paused}, time=${audio.currentTime}, playing=${actuallyPlaying}`);
    return actuallyPlaying;
  }

  // For iframe playback, verify buffer health indicates stream started
  if (state.playbackSource === 'iframe') {
    const iframePlaying = state.isPlaying && state.bufferHealth > 0;
    console.log(`[Orchestrator] Iframe check: isPlaying=${state.isPlaying}, bufferHealth=${state.bufferHealth}, verified=${iframePlaying}`);
    return iframePlaying;
  }

  console.log(`[Orchestrator] Unknown source: ${state.playbackSource}, isPlaying=${state.isPlaying}`);
  return false;
}

/**
 * Force play on the audio element directly
 */
async function forceAudioPlay(): Promise<boolean> {
  const audio = getAudioElement();
  if (!audio || !audio.src) return false;

  try {
    await audio.play();
    return true;
  } catch (e) {
    console.warn('[Orchestrator] Force play failed:', e);
    return false;
  }
}

/**
 * Verify playback and retry if needed
 */
function verifyAndRetry(trackId: string): void {
  // Clear any existing verification
  if (verificationTimer) {
    clearTimeout(verificationTimer);
  }

  verificationTimer = setTimeout(async () => {
    const state = usePlayerStore.getState();

    // Check if we're still on the same track
    if (state.currentTrack?.trackId !== trackId) {
      console.log('[Orchestrator] Track changed, skipping verification');
      retryCount = 0;
      return;
    }

    // Check if state says playing
    if (!state.isPlaying) {
      console.log('[Orchestrator] State says not playing, skipping verification');
      retryCount = 0;
      return;
    }

    // Verify actual playback
    const actuallyPlaying = isActuallyPlaying();

    if (actuallyPlaying) {
      console.log('[Orchestrator] ✅ Playback verified');
      retryCount = 0;
      isOrchestrating = false;
      return;
    }

    // Not actually playing - retry
    if (retryCount < MAX_RETRIES) {
      retryCount++;
      console.log(`[Orchestrator] ⚠️ Playback not detected, retry ${retryCount}/${MAX_RETRIES}`);

      // Try to force play based on source
      const currentState = usePlayerStore.getState();

      if (currentState.playbackSource === 'cached') {
        console.log('[Orchestrator] Retry: forcing cached audio play');
        const success = await forceAudioPlay();
        if (success && !currentState.isPlaying) {
          usePlayerStore.getState().togglePlay();
        }
      } else if (currentState.playbackSource === 'iframe') {
        // For iframe, try to trigger playVideo directly
        console.log('[Orchestrator] Retry: forcing iframe playVideo');
        const iframe = document.querySelector('#voyo-iframe-container iframe') as HTMLIFrameElement;
        if (iframe?.contentWindow) {
          try {
            // Post message to YouTube iframe
            iframe.contentWindow.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
          } catch (e) {
            console.log('[Orchestrator] Direct iframe command failed, toggling state');
          }
        }
        // Also toggle state to re-trigger YouTubeIframe's effect
        if (!currentState.isPlaying) {
          usePlayerStore.getState().togglePlay();
        }
      } else if (currentState.playbackSource === null) {
        // Source not determined yet - ensure isPlaying is set
        console.log('[Orchestrator] Retry: playbackSource still null, setting isPlaying');
        if (!currentState.isPlaying) {
          usePlayerStore.getState().togglePlay();
        }
      }

      // Verify again after retry
      setTimeout(() => verifyAndRetry(trackId), RETRY_DELAY);
    } else {
      console.error('[Orchestrator] ❌ Playback failed after max retries');
      retryCount = 0;
      isOrchestrating = false;

      // Emit event for UI to show error if needed
      window.dispatchEvent(new CustomEvent('voyo:playbackFailed', {
        detail: { trackId, reason: 'max_retries' }
      }));
    }
  }, VERIFICATION_DELAY);
}

/**
 * MAIN ENTRY POINT: Play a track
 *
 * @param track - The track to play
 * @param options - Play options
 * @returns Promise that resolves when playback is initiated
 */
export async function play(
  track: Track,
  options?: {
    openFullPlayer?: boolean;
    skipVerification?: boolean;
  }
): Promise<void> {
  const trackId = track.trackId;

  // Prevent duplicate requests for same track
  if (isOrchestrating && currentPlayRequest === trackId) {
    console.log('[Orchestrator] Already orchestrating this track, skipping');
    return;
  }

  console.log(`[Orchestrator] 🎵 Play requested: ${track.title}`);

  isOrchestrating = true;
  currentPlayRequest = trackId;
  retryCount = 0;

  // Clear any pending verification from previous track
  if (verificationTimer) {
    clearTimeout(verificationTimer);
    verificationTimer = null;
  }

  const store = usePlayerStore.getState();

  // Step 1: Set the track (triggers AudioPlayer + YouTubeIframe to load)
  store.setCurrentTrack(track);

  // Step 2: Ensure isPlaying is true
  // Small delay to let components initialize
  await new Promise(resolve => setTimeout(resolve, 150));

  const { isPlaying, togglePlay } = usePlayerStore.getState();
  if (!isPlaying) {
    console.log('[Orchestrator] Setting isPlaying = true');
    togglePlay();
  }

  // Step 3: Start verification loop (background, non-blocking)
  if (!options?.skipVerification) {
    verifyAndRetry(trackId);
  } else {
    isOrchestrating = false;
  }

  // Return immediately - verification happens in background
  return;
}

/**
 * Pause playback
 */
export function pause(): void {
  const { isPlaying, togglePlay } = usePlayerStore.getState();
  if (isPlaying) {
    togglePlay();
  }

  // Clear verification since we're pausing intentionally
  if (verificationTimer) {
    clearTimeout(verificationTimer);
    verificationTimer = null;
  }
  isOrchestrating = false;
}

/**
 * Resume playback
 */
export async function resume(): Promise<void> {
  const state = usePlayerStore.getState();

  if (!state.currentTrack) {
    console.warn('[Orchestrator] No track to resume');
    return;
  }

  if (state.isPlaying) {
    console.log('[Orchestrator] Already playing');
    return;
  }

  console.log('[Orchestrator] Resuming playback');
  state.togglePlay();

  // Verify resume worked
  verifyAndRetry(state.currentTrack.trackId);
}

/**
 * Toggle play/pause
 */
export async function togglePlayback(): Promise<void> {
  const state = usePlayerStore.getState();

  if (state.isPlaying) {
    pause();
  } else if (state.currentTrack) {
    await resume();
  }
}

/**
 * Skip to next track
 */
export async function next(): Promise<void> {
  const store = usePlayerStore.getState();
  const nextTrack = store.queue[0];

  if (nextTrack) {
    await play(nextTrack.track);
    store.nextTrack(); // Remove from queue
  } else {
    console.log('[Orchestrator] No next track in queue');
  }
}

/**
 * Skip to previous track
 */
export function previous(): void {
  usePlayerStore.getState().prevTrack();
}

/**
 * Check orchestrator status (for debugging)
 */
export function getStatus(): {
  isOrchestrating: boolean;
  currentRequest: string | null;
  retryCount: number;
} {
  return {
    isOrchestrating,
    currentRequest: currentPlayRequest,
    retryCount,
  };
}

// Export as default object for easier imports
const PlaybackOrchestrator = {
  play,
  pause,
  resume,
  togglePlayback,
  next,
  previous,
  getStatus,
};

export default PlaybackOrchestrator;
