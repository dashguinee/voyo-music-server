/**
 * VOYO Music - Global Audio Player
 *
 * This component handles actual audio playback using our yt-dlp backend.
 * It syncs with the playerStore and plays audio in the background.
 * Renders hidden audio/video elements that the rest of the app controls.
 */

import { useEffect, useRef, useCallback } from 'react';
import { usePlayerStore } from '../store/playerStore';
import { usePreferenceStore } from '../store/preferenceStore';
import { getAudioStream, getVideoStream, API_BASE } from '../services/api';
import { audioEngine, BufferStatus } from '../services/audioEngine';

// Constants for Spotify-beating optimization
const PREFETCH_THRESHOLD = 50; // Start prefetch at 50% progress
const BUFFER_WARNING_THRESHOLD = 8; // seconds - show warning (match audioEngine)
const BUFFER_EMERGENCY_THRESHOLD = 3; // seconds - switch to low quality

// Pre-buffer cache for next track (stores the URL we've pre-warmed)
const preBufferCache = new Map<string, boolean>();

export const AudioPlayer = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const preBufferRef = useRef<HTMLAudioElement | null>(null);

  const {
    currentTrack,
    isPlaying,
    isVideoMode,
    volume,
    queue,
    progress,
    seekPosition,
    streamQuality,
    setCurrentTime,
    setDuration,
    setProgress,
    clearSeekPosition,
    nextTrack,
    setBufferHealth,
    setPrefetchStatus,
    detectNetworkQuality,
  } = usePlayerStore();

  // Preference tracking
  const {
    startListenSession,
    endListenSession,
    recordSkip,
    recordCompletion,
  } = usePreferenceStore();

  // Store the current stream URL to avoid refetching
  const currentStreamUrl = useRef<string | null>(null);
  const currentVideoId = useRef<string | null>(null);
  const loadingRef = useRef<boolean>(false);
  const isPlayingRef = useRef<boolean>(isPlaying); // Track isPlaying in ref to avoid stale closures
  const shouldAutoPlayOnLoad = useRef<boolean>(false); // FIX: Track if we should auto-play on canplay

  // Preference tracking state
  const sessionStartTime = useRef<number>(0);
  const lastTrackId = useRef<string | null>(null);

  // Keep isPlayingRef in sync
  useEffect(() => {
    isPlayingRef.current = isPlaying;
    // FIX: If isPlaying becomes true while loading, mark for auto-play
    if (isPlaying) {
      shouldAutoPlayOnLoad.current = true;
    }
  }, [isPlaying]);

  // Detect network quality on mount
  useEffect(() => {
    detectNetworkQuality();
  }, [detectNetworkQuality]);

  // Monitor buffer health using AudioEngine
  useEffect(() => {
    const element = isVideoMode ? videoRef.current : audioRef.current;
    if (!element) return;

    const checkBufferHealth = () => {
      const health = audioEngine.getBufferHealth(element);
      setBufferHealth(health.percentage, health.status);

      // Log warnings
      if (health.status === 'emergency') {
        console.warn('[Buffer] EMERGENCY: Only', health.current.toFixed(1), 's buffered');
      } else if (health.status === 'warning') {
        console.warn('[Buffer] Warning:', health.current.toFixed(1), 's buffered');
      }
    };

    const interval = setInterval(checkBufferHealth, 1000);
    return () => clearInterval(interval);
  }, [isVideoMode, setBufferHealth]);

  // Get the active media element
  const getActiveElement = useCallback(() => {
    return isVideoMode ? videoRef.current : audioRef.current;
  }, [isVideoMode]);

  // Cleanup: End session and clear cache when component unmounts
  useEffect(() => {
    return () => {
      if (lastTrackId.current) {
        const el = getActiveElement();
        const listenDuration = el?.currentTime || 0;
        console.log('[Prefs] Component unmounting, ending session');
        endListenSession(listenDuration, 0);
      }
      // Clean up audioEngine cache to free memory
      audioEngine.clearAllCache();
      console.log('[AudioEngine] Cache cleared on unmount');
    };
  }, [endListenSession, getActiveElement]);

  // Load stream URL when track changes
  useEffect(() => {
    const loadStream = async () => {
      if (!currentTrack?.trackId) {
        currentStreamUrl.current = null;
        currentVideoId.current = null;
        return;
      }

      // Track changed - end previous session if exists
      if (lastTrackId.current && lastTrackId.current !== currentTrack.id) {
        const el = getActiveElement();
        const listenDuration = el?.currentTime || 0;
        console.log('[Prefs] Track changed, ending previous session');
        endListenSession(listenDuration, 0);
      }

      // Same track - handle resume properly
      if (currentVideoId.current === currentTrack.trackId && currentStreamUrl.current) {
        const element = isVideoMode ? videoRef.current : audioRef.current;
        if (element) {
          // FIX: Check if element has a valid source and can play
          if (element.readyState >= 2) {
            // HAVE_CURRENT_DATA or better - can resume
            if (isPlaying && element.paused) {
              console.log('[AudioPlayer] Same track, resuming playback');
              element.play().catch(err => {
                console.error('[AudioPlayer] Resume failed, will reload:', err);
                // If resume fails, reload the stream
                currentStreamUrl.current = null;
                currentVideoId.current = null;
              });
            }
            return;
          } else {
            // Element isn't ready - reload the stream
            console.log('[AudioPlayer] Same track but element not ready, reloading');
            currentStreamUrl.current = null;
            currentVideoId.current = null;
          }
        }
      }

      // Start new preference session
      startListenSession(currentTrack.id);
      sessionStartTime.current = Date.now();
      lastTrackId.current = currentTrack.id;
      console.log('[Prefs] Started tracking:', currentTrack.title);

      // FIX: When loading a NEW track, capture current isPlaying state for auto-play
      // This is crucial for skip/next/prev which set isPlaying: true before this effect runs
      if (isPlaying) {
        shouldAutoPlayOnLoad.current = true;
        console.log('[AudioPlayer] Will auto-play when canplay fires');
      }

      // Prevent duplicate loads
      if (loadingRef.current) return;
      loadingRef.current = true;

      console.log('[AudioPlayer] Loading stream for:', currentTrack.title);
      currentVideoId.current = currentTrack.trackId;

      try {
        // OPTIMIZATION: Check if track is already cached by audioEngine
        const cachedUrl = audioEngine.getCachedTrack(currentTrack.trackId);
        let streamUrl: string;

        if (cachedUrl && !isVideoMode) {
          // Use cached blob URL for instant playback
          console.log('[AudioEngine] Using cached track - instant playback!');
          streamUrl = cachedUrl;
        } else {
          // Get audio or video stream based on mode with quality parameter
          if (isVideoMode) {
            streamUrl = (await getVideoStream(currentTrack.trackId)).url;
          } else {
            const baseUrl = await getAudioStream(currentTrack.trackId);
            // Add quality parameter based on current streamQuality
            streamUrl = `${baseUrl}&quality=${streamQuality}`;
          }
        }

        if (streamUrl) {
          console.log('[AudioPlayer] Got stream URL:', streamUrl);
          currentStreamUrl.current = streamUrl;

          const element = isVideoMode ? videoRef.current : audioRef.current;
          if (element) {
            // Clear any previous errors
            element.src = '';
            element.load();

            // Set new source
            element.src = streamUrl;
            element.load();

            // Wait for canplay event before trying to play
            const handleCanPlay = () => {
              // FIX: Check both isPlayingRef AND shouldAutoPlayOnLoad for more reliable auto-play
              // shouldAutoPlayOnLoad is set when track changes with isPlaying: true (skip/next/prev)
              const shouldPlay = isPlayingRef.current || shouldAutoPlayOnLoad.current;
              console.log('[AudioPlayer] canplay event - isPlaying:', isPlayingRef.current, 'shouldAutoPlay:', shouldAutoPlayOnLoad.current);
              if (shouldPlay) {
                console.log('[AudioPlayer] Auto-playing new track');
                element.play().catch(err => {
                  console.error('[AudioPlayer] Autoplay failed:', err);
                });
                // Reset the flag after successful play trigger
                shouldAutoPlayOnLoad.current = false;
              }
              element.removeEventListener('canplay', handleCanPlay);
            };

            // Handle errors and retry
            const handleError = () => {
              console.error('[AudioPlayer] Load error, clearing cache');
              currentStreamUrl.current = null;
              // Clear this track from audioEngine cache
              audioEngine.clearTrackCache(currentTrack.trackId);
              element.removeEventListener('error', handleError);
            };

            element.addEventListener('canplay', handleCanPlay);
            element.addEventListener('error', handleError, { once: true });
          }
        } else {
          console.error('[AudioPlayer] Failed to get stream URL');
        }
      } catch (error) {
        console.error('[AudioPlayer] Error loading stream:', error);
        // Clear cache on error so next attempt will reload
        currentStreamUrl.current = null;
        currentVideoId.current = null;
      } finally {
        loadingRef.current = false;
      }
    };

    loadStream();
  }, [currentTrack?.trackId, isVideoMode, isPlaying, streamQuality, getActiveElement, startListenSession, endListenSession]);

  // SMART PREFETCH: Warm up next tracks in queue for INSTANT playback
  // Strategy:
  // - Immediately start preloading queue[0] (next track) as soon as we have a currentTrack
  // - At 50% progress: Also preload queue[1] and queue[2]
  // - Server-side prefetch is triggered when tracks are added to queue (see playerStore)
  useEffect(() => {
    if (!currentTrack || isVideoMode) return;

    const apiBase = API_BASE;

    // How many tracks to preload depends on progress
    // - Always preload at least 1 (queue[0]) for instant next-track playback
    // - At 50%+ progress, preload 2 more (queue[1], queue[2])
    const maxTracksToPreload = progress > PREFETCH_THRESHOLD ? 3 : 1;
    const tracksToPreload = queue.slice(0, maxTracksToPreload);

    tracksToPreload.forEach((queueItem, index) => {
      const track = queueItem.track;
      if (!track?.trackId) return;

      // Skip if already cached or already loading
      if (audioEngine.isTrackCached(track.trackId) || preBufferCache.has(track.trackId)) {
        return;
      }

      console.log(`[AudioEngine] Prefetching queue[${index}]:`, track.title);
      preBufferCache.set(track.trackId, true);
      setPrefetchStatus(track.trackId, 'loading');

      // Stagger preloads by 500ms to avoid network congestion
      setTimeout(() => {
        audioEngine.preloadTrack(
          track.trackId,
          apiBase,
          (prefetchProgress) => {
            // Only log progress for first track to reduce noise
            if (index === 0 && prefetchProgress % 25 === 0) {
              console.log('[AudioEngine] Next track prefetch:', prefetchProgress, '%');
            }
          }
        ).then(() => {
          console.log('[AudioEngine] ✓ Prefetch ready:', track.title);
          setPrefetchStatus(track.trackId, 'ready');

          // Log estimated network speed occasionally
          if (index === 0) {
            const networkSpeed = audioEngine.estimateNetworkSpeed();
            console.log('[AudioEngine] Network speed:', networkSpeed, 'kbps');
          }
        }).catch((error) => {
          console.error('[AudioEngine] Prefetch failed:', track.title, error);
          preBufferCache.delete(track.trackId);
          setPrefetchStatus(track.trackId, 'error');
        });
      }, index * 500);
    });

    return () => {
      // Cancel active prefetch if track changes
      audioEngine.cancelPrefetch();
    };
  }, [progress, queue, currentTrack, isVideoMode, streamQuality, setPrefetchStatus]);

  // Clear pre-buffer cache when track changes (so next track can be pre-buffered)
  useEffect(() => {
    // When current track changes, clear cache for old tracks
    preBufferCache.clear();
  }, [currentTrack?.id]);

  // Handle play/pause state changes
  useEffect(() => {
    const element = isVideoMode ? videoRef.current : audioRef.current;
    if (!element) {
      console.log('[AudioPlayer] Play/pause skipped - no element');
      return;
    }

    // If no stream URL yet, canplay handler will start playback when ready
    if (!currentStreamUrl.current) {
      console.log('[AudioPlayer] Play/pause skipped - waiting for stream URL');
      return;
    }

    // Only act if element has a source loaded
    if (!element.src || element.readyState < 1) {
      console.log('[AudioPlayer] Play/pause skipped - element not ready');
      return;
    }

    if (isPlaying) {
      console.log('[AudioPlayer] Playing...');
      element.play().catch(err => {
        console.error('[AudioPlayer] Play failed:', err);
      });
    } else {
      console.log('[AudioPlayer] Pausing...');
      element.pause();
    }
  }, [isPlaying, isVideoMode]);

  // Handle volume changes
  useEffect(() => {
    const audio = audioRef.current;
    const video = videoRef.current;
    const vol = volume / 100; // Store has 0-100, audio wants 0-1

    if (audio) audio.volume = vol;
    if (video) video.volume = vol;
  }, [volume]);

  // Handle seek requests (when user scrubs or clicks progress)
  useEffect(() => {
    if (seekPosition === null) return;

    const element = isVideoMode ? videoRef.current : audioRef.current;
    if (element && element.readyState >= 1) {
      console.log('[AudioPlayer] Seeking to:', seekPosition);
      element.currentTime = seekPosition;
      clearSeekPosition();
    }
  }, [seekPosition, isVideoMode, clearSeekPosition]);

  // Time update handler
  const handleTimeUpdate = useCallback(() => {
    const el = getActiveElement();
    if (el && el.duration) {
      setCurrentTime(el.currentTime);
      setProgress((el.currentTime / el.duration) * 100);
    }
  }, [getActiveElement, setCurrentTime, setProgress]);

  // Duration change handler
  const handleDurationChange = useCallback(() => {
    const el = getActiveElement();
    if (el && el.duration) {
      setDuration(el.duration);
    }
  }, [getActiveElement, setDuration]);

  // Track ended handler
  const handleEnded = useCallback(() => {
    console.log('[AudioPlayer] Track ended, playing next');

    // Record completion before moving to next track
    const el = getActiveElement();
    if (el && currentTrack) {
      const listenDuration = el.currentTime;
      console.log('[Prefs] Track completed:', currentTrack.title);
      endListenSession(listenDuration, 0); // TODO: pass actual reaction count
    }

    nextTrack();
  }, [nextTrack, currentTrack, endListenSession, getActiveElement]);

  // Error handler
  const handleError = useCallback((e: Event) => {
    const el = e.target as HTMLMediaElement;
    console.error('[AudioPlayer] Playback error:', el.error?.message);
  }, []);

  // Attach event listeners
  useEffect(() => {
    const audio = audioRef.current;
    const video = videoRef.current;

    const attachListeners = (el: HTMLMediaElement | null) => {
      if (!el) return;
      el.addEventListener('timeupdate', handleTimeUpdate);
      el.addEventListener('durationchange', handleDurationChange);
      el.addEventListener('ended', handleEnded);
      el.addEventListener('error', handleError);
    };

    const removeListeners = (el: HTMLMediaElement | null) => {
      if (!el) return;
      el.removeEventListener('timeupdate', handleTimeUpdate);
      el.removeEventListener('durationchange', handleDurationChange);
      el.removeEventListener('ended', handleEnded);
      el.removeEventListener('error', handleError);
    };

    attachListeners(audio);
    attachListeners(video);

    return () => {
      removeListeners(audio);
      removeListeners(video);
    };
  }, [handleTimeUpdate, handleDurationChange, handleEnded, handleError]);

  return (
    <>
      {/* Hidden audio element - always renders */}
      {/* MOBILE FIX: Added playsInline, webkit-playsinline, crossOrigin for iOS/Android */}
      <audio
        ref={audioRef}
        preload="auto"
        playsInline
        // @ts-ignore - webkit prefix for older iOS
        webkit-playsinline="true"
        crossOrigin="anonymous"
        style={{ display: 'none' }}
      />

      {/* Hidden video element - for video mode */}
      <video
        ref={videoRef}
        preload="auto"
        playsInline
        // @ts-ignore - webkit prefix for older iOS
        webkit-playsinline="true"
        crossOrigin="anonymous"
        style={{ display: 'none' }}
      />
    </>
  );
};

export default AudioPlayer;
