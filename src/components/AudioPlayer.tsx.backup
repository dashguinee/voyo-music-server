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
import { getAudioStream, getVideoStream } from '../services/api';
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

  // Preference tracking state
  const sessionStartTime = useRef<number>(0);
  const lastTrackId = useRef<string | null>(null);

  // Keep isPlayingRef in sync
  useEffect(() => {
    isPlayingRef.current = isPlaying;
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

  // Cleanup: End session when component unmounts
  useEffect(() => {
    return () => {
      if (lastTrackId.current) {
        const el = getActiveElement();
        const listenDuration = el?.currentTime || 0;
        console.log('[Prefs] Component unmounting, ending session');
        endListenSession(listenDuration, 0);
      }
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

      // Prevent duplicate loads
      if (loadingRef.current) return;
      loadingRef.current = true;

      console.log('[AudioPlayer] Loading stream for:', currentTrack.title);
      currentVideoId.current = currentTrack.trackId;

      try {
        // Get audio or video stream based on mode
        const streamUrl = isVideoMode
          ? (await getVideoStream(currentTrack.trackId)).url
          : await getAudioStream(currentTrack.trackId);

        if (streamUrl) {
          console.log('[AudioPlayer] Got stream URL:', streamUrl);
          currentStreamUrl.current = streamUrl;

          const element = isVideoMode ? videoRef.current : audioRef.current;
          if (element) {
            // FIX: Clear any previous errors
            element.src = '';
            element.load();

            // Set new source
            element.src = streamUrl;
            element.load();

            // Wait for canplay event before trying to play
            const handleCanPlay = () => {
              // Use ref to get current isPlaying state (avoids stale closure)
              console.log('[AudioPlayer] canplay event - isPlaying:', isPlayingRef.current);
              if (isPlayingRef.current) {
                element.play().catch(err => {
                  console.error('[AudioPlayer] Autoplay failed:', err);
                });
              }
              element.removeEventListener('canplay', handleCanPlay);
            };

            // FIX: Handle errors and retry
            const handleError = () => {
              console.error('[AudioPlayer] Load error, clearing cache');
              currentStreamUrl.current = null;
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
  }, [currentTrack?.trackId, isVideoMode, isPlaying]);

  // PRE-BUFFER: Warm up next track in queue when current track is 50% played
  useEffect(() => {
    const nextTrackInQueue = queue[0]?.track;
    if (!nextTrackInQueue || !currentTrack || isVideoMode) return;

    // Check if we should pre-buffer (when > threshold of current track played)
    const shouldPreBuffer = progress > PREFETCH_THRESHOLD && !preBufferCache.has(nextTrackInQueue.trackId);

    if (shouldPreBuffer) {
      console.log('[PreBuffer] Warming up next track:', nextTrackInQueue.title);
      preBufferCache.set(nextTrackInQueue.trackId, true);
      setPrefetchStatus(nextTrackInQueue.trackId, 'loading');

      // Create hidden audio element to pre-load
      const preBuffer = new Audio();
      preBuffer.preload = 'auto';
      preBuffer.volume = 0;

      // Use the same API endpoint as the main player with quality parameter
      const apiBase = import.meta.env.PROD
        ? 'https://voyo-music-server-production.up.railway.app'
        : 'http://localhost:3001';
      preBuffer.src = `${apiBase}/cdn/stream/${nextTrackInQueue.trackId}?type=audio&quality=${streamQuality}`;

      // Track when enough data is buffered
      preBuffer.addEventListener('canplaythrough', () => {
        console.log('[PreBuffer] Next track READY:', nextTrackInQueue.title);
        setPrefetchStatus(nextTrackInQueue.trackId, 'ready');
      }, { once: true });

      preBuffer.addEventListener('loadedmetadata', () => {
        console.log('[PreBuffer] Next track metadata loaded:', nextTrackInQueue.title);
      }, { once: true });

      preBuffer.addEventListener('error', () => {
        console.error('[PreBuffer] Failed to pre-load:', nextTrackInQueue.title);
        preBufferCache.delete(nextTrackInQueue.trackId);
        setPrefetchStatus(nextTrackInQueue.trackId, 'error');
      }, { once: true });

      preBufferRef.current = preBuffer;
      preBuffer.load();
    }

    return () => {
      // Cleanup pre-buffer element when component updates
      if (preBufferRef.current) {
        preBufferRef.current.src = '';
        preBufferRef.current = null;
      }
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
      <audio
        ref={audioRef}
        preload="auto"
        style={{ display: 'none' }}
      />

      {/* Hidden video element - for video mode */}
      <video
        ref={videoRef}
        preload="auto"
        playsInline
        style={{ display: 'none' }}
      />
    </>
  );
};

export default AudioPlayer;
