/**
 * Mobile Play Hook
 *
 * Provides direct audio playback control that works with mobile autoplay restrictions.
 * On mobile, audio.play() MUST be called directly in a user gesture handler.
 *
 * Usage:
 * const { handlePlayPause } = useMobilePlay();
 * <button onClick={handlePlayPause}>Play</button>
 */

import { useCallback } from 'react';
import { usePlayerStore } from '../store/playerStore';
import { unlockMobileAudio, isAudioUnlocked } from '../utils/mobileAudioUnlock';

/**
 * Get the global audio element used by AudioPlayer
 */
function getAudioElement(): HTMLAudioElement | null {
  return document.querySelector('audio');
}

/**
 * Get the global video element used by AudioPlayer
 */
function getVideoElement(): HTMLVideoElement | null {
  return document.querySelector('video');
}

export function useMobilePlay() {
  const { isPlaying, isVideoMode, togglePlay } = usePlayerStore();

  /**
   * Handle play/pause with mobile-compatible direct audio control.
   * Call this DIRECTLY in your onClick handler.
   */
  const handlePlayPause = useCallback(async (e?: React.MouseEvent | React.TouchEvent) => {
    // Prevent event bubbling if needed
    e?.stopPropagation?.();

    const element = isVideoMode ? getVideoElement() : getAudioElement();

    // If no audio element yet, just toggle state and let AudioPlayer handle it
    if (!element) {
      console.log('[MobilePlay] No element yet, toggling state');
      togglePlay();
      return;
    }

    // Unlock audio if needed (this is a user gesture context)
    if (!isAudioUnlocked()) {
      await unlockMobileAudio();
    }

    if (isPlaying) {
      // Pause - this always works
      console.log('[MobilePlay] Pausing');
      element.pause();
      togglePlay();
    } else {
      // Play - DIRECTLY in user gesture handler
      console.log('[MobilePlay] Playing directly in user gesture');

      try {
        // Check if element has a source
        if (!element.src || element.src === '') {
          console.log('[MobilePlay] No source yet, toggling state to trigger load');
          togglePlay();
          return;
        }

        // Try to play directly
        await element.play();

        // Update state after successful play
        if (!usePlayerStore.getState().isPlaying) {
          togglePlay();
        }

        console.log('[MobilePlay] Play successful!');
      } catch (err: any) {
        console.error('[MobilePlay] Play failed:', err);

        if (err.name === 'NotAllowedError') {
          // Autoplay was blocked - try again on next tap
          console.log('[MobilePlay] NotAllowedError - user needs to tap again');
        }

        // Still toggle state so UI stays in sync
        togglePlay();
      }
    }
  }, [isPlaying, isVideoMode, togglePlay]);

  /**
   * Force play (use when you're certain there's a valid source)
   */
  const forcePlay = useCallback(async () => {
    const element = isVideoMode ? getVideoElement() : getAudioElement();
    if (!element) return false;

    if (!isAudioUnlocked()) {
      await unlockMobileAudio();
    }

    try {
      await element.play();
      return true;
    } catch (err) {
      console.error('[MobilePlay] Force play failed:', err);
      return false;
    }
  }, [isVideoMode]);

  /**
   * Check if we can play (has source and ready)
   */
  const canPlay = useCallback(() => {
    const element = isVideoMode ? getVideoElement() : getAudioElement();
    return element && element.src && element.readyState >= 2;
  }, [isVideoMode]);

  return {
    handlePlayPause,
    forcePlay,
    canPlay,
    isUnlocked: isAudioUnlocked(),
  };
}
