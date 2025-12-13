/**
 * VOYO Music - Hybrid Audio Player with BOOST System
 *
 * SIMPLE FLOW:
 * 1. Check IndexedDB cache → If BOOSTED, play from local blob (instant, offline)
 * 2. If NOT boosted → IFrame plays instantly (YouTube handles streaming)
 * 3. User clicks "⚡ Boost HD" → Downloads to IndexedDB for next time
 *
 * NO server proxy for playback - only for downloads when user requests Boost
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { usePlayerStore } from '../store/playerStore';
import { usePreferenceStore } from '../store/preferenceStore';
import { useDownloadStore } from '../store/downloadStore';
import { getYouTubeIdForIframe, prefetchTrack } from '../services/api';

type PlaybackMode = 'cached' | 'iframe';

export const AudioPlayer = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const currentVideoId = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const cachedUrlRef = useRef<string | null>(null);

  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>('iframe');

  const {
    currentTrack,
    isPlaying,
    volume,
    seekPosition,
    setCurrentTime,
    setDuration,
    setProgress,
    clearSeekPosition,
    nextTrack,
    setBufferHealth,
    setPlaybackSource,
  } = usePlayerStore();

  const {
    startListenSession,
    endListenSession,
  } = usePreferenceStore();

  const {
    initialize: initDownloads,
    checkCache,
  } = useDownloadStore();

  const lastTrackId = useRef<string | null>(null);
  const hasPrefetchedRef = useRef<boolean>(false); // Track if we've prefetched next track

  // Initialize download system (IndexedDB)
  useEffect(() => {
    initDownloads();
  }, [initDownloads]);

  // Load YouTube IFrame API
  useEffect(() => {
    if (typeof window !== 'undefined' && !(window as any).YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScript = document.getElementsByTagName('script')[0];
      firstScript.parentNode?.insertBefore(tag, firstScript);
    }
  }, []);

  // Initialize IFrame player
  const initIframePlayer = useCallback((videoId: string, retryCount: number = 0) => {
    if (!(window as any).YT?.Player) {
      if (retryCount >= 10) {
        console.error('[VOYO] YT API failed to load after 10 retries');
        setBufferHealth(0, 'emergency');
        return;
      }
      setTimeout(() => initIframePlayer(videoId, retryCount + 1), 500);
      return;
    }

    // Destroy existing player and clean up DOM
    if (playerRef.current) {
      try {
        playerRef.current.destroy();
        playerRef.current = null;
      } catch (e) {
        // Ignore
      }
    }

    const container = document.getElementById('voyo-yt-player');
    if (!container) return;

    // Clear previous IFrame remnants
    container.innerHTML = '';

    playerRef.current = new (window as any).YT.Player('voyo-yt-player', {
      height: '1',
      width: '1',
      videoId: videoId,
      playerVars: {
        autoplay: 0, // Always 0 - we control playback via playVideo()
        controls: 0,
        disablekb: 1,
        fs: 0,
        modestbranding: 1,
        rel: 0,
        showinfo: 0,
      },
      events: {
        onReady: (event: any) => {
          // FIX: Start at volume 0 to prevent click/pop, then fade in
          event.target.setVolume(0);
          if (isPlaying) {
            event.target.playVideo();
          }
        },
        onStateChange: (event: any) => {
          const state = event.data;
          if (state === 0) { // ENDED
            nextTrack();
          } else if (state === 1) { // PLAYING
            setBufferHealth(100, 'healthy');
            // FIX: Smooth volume fade-in to prevent click sound
            const player = playerRef.current;
            if (player) {
              let currentVol = 0;
              const targetVol = volume;
              const fadeInterval = setInterval(() => {
                currentVol = Math.min(currentVol + 10, targetVol);
                try {
                  player.setVolume(currentVol);
                } catch (e) {
                  clearInterval(fadeInterval);
                }
                if (currentVol >= targetVol) {
                  clearInterval(fadeInterval);
                }
              }, 30); // 30ms intervals = ~300ms fade-in
            }
          } else if (state === 3) { // BUFFERING
            setBufferHealth(50, 'warning');
          }
        },
        onError: (event: any) => {
          console.error('[VOYO IFrame] Error:', event.data);
          setBufferHealth(0, 'emergency');
          // Auto-skip on error after 2 seconds
          setTimeout(() => {
            nextTrack();
          }, 2000);
        },
      },
    });
  }, [isPlaying, volume, nextTrack, setBufferHealth]);

  // Load track when it changes
  useEffect(() => {
    const loadTrack = async () => {
      if (!currentTrack?.trackId) return;
      if (currentVideoId.current === currentTrack.trackId) return;

      // Cancel previous load operation
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      currentVideoId.current = currentTrack.trackId;
      hasPrefetchedRef.current = false; // Reset prefetch flag for new track

      // End previous session
      if (lastTrackId.current && lastTrackId.current !== currentTrack.id) {
        const el = audioRef.current;
        endListenSession(el?.currentTime || 0, 0);
      }

      // Start new session
      startListenSession(currentTrack.id);
      lastTrackId.current = currentTrack.id;

      try {
        // 1. CHECK LOCAL CACHE FIRST (User's IndexedDB - Boosted tracks)
        const cachedUrl = await checkCache(currentTrack.trackId);

        if (cachedUrl) {
          // ⚡ BOOSTED - Play from local cache (instant, offline-ready)
          setPlaybackMode('cached');
          setPlaybackSource('cached');

          if (audioRef.current) {
            // Revoke previous blob URL
            if (cachedUrlRef.current) {
              URL.revokeObjectURL(cachedUrlRef.current);
            }
            cachedUrlRef.current = cachedUrl;

            // FIX: Start at volume 0 to prevent click/pop
            audioRef.current.volume = 0;
            audioRef.current.src = cachedUrl;
            audioRef.current.load();

            // FIX: Use oncanplaythrough for smoother start
            audioRef.current.oncanplaythrough = () => {
              if (isPlaying && audioRef.current) {
                audioRef.current.play().then(() => {
                  // Smooth volume fade-in
                  let currentVol = 0;
                  const targetVol = volume / 100;
                  const fadeInterval = setInterval(() => {
                    currentVol = Math.min(currentVol + 0.1, targetVol);
                    if (audioRef.current) {
                      audioRef.current.volume = currentVol;
                    }
                    if (currentVol >= targetVol) {
                      clearInterval(fadeInterval);
                    }
                  }, 30);
                }).catch(() => {});
              }
            };
          }
          return;
        }

        // 2. NOT CACHED - Use IFrame for instant playback
        // User can click "⚡ Boost HD" to download for next time
        setPlaybackMode('iframe');
        setPlaybackSource('iframe');

        const ytId = getYouTubeIdForIframe(currentTrack.trackId);
        initIframePlayer(ytId);

      } catch (error: any) {
        // Check if aborted
        if (error.name === 'AbortError') {
          return; // Load was cancelled, ignore
        }

        // Fallback to IFrame on error
        setPlaybackMode('iframe');
        setPlaybackSource('iframe');
        const ytId = getYouTubeIdForIframe(currentTrack.trackId);
        initIframePlayer(ytId);
      }
    };

    loadTrack();

    // Cleanup: abort on track change and revoke blob URL
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (cachedUrlRef.current) {
        URL.revokeObjectURL(cachedUrlRef.current);
        cachedUrlRef.current = null;
      }
    };
  }, [currentTrack?.trackId, initIframePlayer, isPlaying, startListenSession, endListenSession, checkCache, setPlaybackSource]);

  // Handle play/pause
  useEffect(() => {
    if (playbackMode === 'cached' && audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(err => {
        });
      } else {
        audioRef.current.pause();
      }
    } else if (playbackMode === 'iframe' && playerRef.current) {
      try {
        if (isPlaying) {
          playerRef.current.playVideo();
        } else {
          playerRef.current.pauseVideo();
        }
      } catch (e) {
        // Player not ready yet
      }
    }
  }, [isPlaying, playbackMode]);

  // Handle volume
  useEffect(() => {
    if (playbackMode === 'cached' && audioRef.current) {
      audioRef.current.volume = volume / 100;
    } else if (playbackMode === 'iframe' && playerRef.current) {
      try {
        playerRef.current.setVolume(volume);
      } catch (e) {
        // Player not ready yet
      }
    }
  }, [volume, playbackMode]);

  // Handle seek
  useEffect(() => {
    if (seekPosition === null) return;

    if (playbackMode === 'cached' && audioRef.current) {
      audioRef.current.currentTime = seekPosition;
    } else if (playbackMode === 'iframe' && playerRef.current) {
      try {
        playerRef.current.seekTo(seekPosition, true);
      } catch (e) {
        // Player not ready yet
      }
    }
    clearSeekPosition();
  }, [seekPosition, clearSeekPosition, playbackMode]);

  // IFrame time tracking
  useEffect(() => {
    if (playbackMode !== 'iframe') return;

    const interval = setInterval(() => {
      if (playerRef.current) {
        try {
          const currentTime = playerRef.current.getCurrentTime();
          const duration = playerRef.current.getDuration();
          if (duration) {
            setCurrentTime(currentTime);
            setDuration(duration);
            setProgress((currentTime / duration) * 100);

            // Update Media Session position state
            if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
              navigator.mediaSession.setPositionState({
                duration: duration,
                playbackRate: 1,
                position: currentTime
              });
            }

            // 50% PREFETCH: Prefetch next track when 50% through current track (IFrame mode)
            const progressPercent = (currentTime / duration) * 100;
            if (progressPercent >= 50 && !hasPrefetchedRef.current) {
              hasPrefetchedRef.current = true;

              // Get next track from queue
              const state = usePlayerStore.getState();
              const nextInQueue = state.queue[0];

              if (nextInQueue?.track?.trackId) {
                // Prefetch next track
                prefetchTrack(nextInQueue.track.trackId).catch(() => {
                  // Ignore prefetch errors
                });
              }
            }
          }
        } catch (e) {
          // Player not ready
        }
      }
    }, 250);

    return () => clearInterval(interval);
  }, [playbackMode, setCurrentTime, setDuration, setProgress]);

  // Media Session API - Lock screen and notification controls
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentTrack) return;

    // Set metadata
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artist,
      album: 'VOYO Music',
      artwork: [
        {
          src: `https://voyo-music-api.fly.dev/cdn/art/${currentTrack.trackId}?quality=high`,
          sizes: '512x512',
          type: 'image/jpeg'
        }
      ]
    });

    // Set action handlers
    navigator.mediaSession.setActionHandler('play', () => {
      if (playbackMode === 'cached' && audioRef.current) {
        audioRef.current.play();
      } else if (playbackMode === 'iframe' && playerRef.current) {
        playerRef.current.playVideo();
      }
    });

    navigator.mediaSession.setActionHandler('pause', () => {
      if (playbackMode === 'cached' && audioRef.current) {
        audioRef.current.pause();
      } else if (playbackMode === 'iframe' && playerRef.current) {
        playerRef.current.pauseVideo();
      }
    });

    navigator.mediaSession.setActionHandler('nexttrack', () => {
      nextTrack();
    });

    navigator.mediaSession.setActionHandler('previoustrack', () => {
      // Get prevTrack from store
      const { prevTrack } = usePlayerStore.getState();
      prevTrack();
    });

    // Update playback state
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

  }, [currentTrack, isPlaying, playbackMode, nextTrack]);

  // Audio element event handlers (for cached playback)
  const handleTimeUpdate = useCallback(() => {
    const el = audioRef.current;
    if (el && el.duration) {
      setCurrentTime(el.currentTime);
      setProgress((el.currentTime / el.duration) * 100);

      // 50% PREFETCH: Prefetch next track when 50% through current track
      const progressPercent = (el.currentTime / el.duration) * 100;
      if (progressPercent >= 50 && !hasPrefetchedRef.current) {
        hasPrefetchedRef.current = true;

        // Get next track from queue
        const state = usePlayerStore.getState();
        const nextInQueue = state.queue[0];

        if (nextInQueue?.track?.trackId) {
          // Prefetch next track
          prefetchTrack(nextInQueue.track.trackId).catch(() => {
            // Ignore prefetch errors
          });
        }
      }
    }
  }, [setCurrentTime, setProgress]);

  const handleDurationChange = useCallback(() => {
    const el = audioRef.current;
    if (el && el.duration) {
      setDuration(el.duration);
    }
  }, [setDuration]);

  const handleEnded = useCallback(() => {
    const el = audioRef.current;
    if (el && currentTrack) {
      endListenSession(el.currentTime, 0);
    }
    nextTrack();
  }, [nextTrack, currentTrack, endListenSession]);

  const handleProgress = useCallback(() => {
    const el = audioRef.current;
    if (!el || !el.buffered.length) return;

    const bufferedEnd = el.buffered.end(el.buffered.length - 1);
    const duration = el.duration || 1;
    const bufferPercent = (bufferedEnd / duration) * 100;

    if (bufferPercent > 80) {
      setBufferHealth(100, 'healthy');
    } else if (bufferPercent > 30) {
      setBufferHealth(bufferPercent, 'warning');
    } else {
      setBufferHealth(bufferPercent, 'emergency');
    }
  }, [setBufferHealth]);

  const handlePlaying = useCallback(() => {
    setBufferHealth(100, 'healthy');
  }, [setBufferHealth]);

  const handleWaiting = useCallback(() => {
    setBufferHealth(50, 'warning');
  }, [setBufferHealth]);

  return (
    <>
      {/* HTML5 Audio (for cached/boosted tracks) */}
      <audio
        ref={audioRef}
        preload="auto"
        onTimeUpdate={handleTimeUpdate}
        onDurationChange={handleDurationChange}
        onEnded={handleEnded}
        onProgress={handleProgress}
        onPlaying={handlePlaying}
        onWaiting={handleWaiting}
        style={{ display: 'none' }}
      />

      {/* YouTube IFrame (for non-boosted tracks - hidden) */}
      <div
        id="voyo-yt-player"
        style={{
          position: 'fixed',
          top: -9999,
          left: -9999,
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: 'none',
        }}
      />
    </>
  );
};

export default AudioPlayer;
