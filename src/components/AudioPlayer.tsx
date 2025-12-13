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
import { getYouTubeIdForIframe } from '../services/api';

type PlaybackMode = 'cached' | 'iframe';

export const AudioPlayer = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const currentVideoId = useRef<string | null>(null);
  const loadingRef = useRef<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const cachedUrlRef = useRef<string | null>(null);
  const iframeRetryCount = useRef<number>(0);

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
        setBufferHealth(0, 'emergency');
        return;
      }
      setTimeout(() => initIframePlayer(videoId, retryCount + 1), 500);
      return;
    }

    // Destroy existing player
    if (playerRef.current) {
      try {
        playerRef.current.destroy();
      } catch (e) {
        // Ignore
      }
    }

    const container = document.getElementById('voyo-yt-player');
    if (!container) return;

    playerRef.current = new (window as any).YT.Player('voyo-yt-player', {
      height: '1',
      width: '1',
      videoId: videoId,
      playerVars: {
        autoplay: isPlaying ? 1 : 0,
        controls: 0,
        disablekb: 1,
        fs: 0,
        modestbranding: 1,
        rel: 0,
        showinfo: 0,
      },
      events: {
        onReady: (event: any) => {
          event.target.setVolume(volume);
          if (isPlaying) {
            event.target.playVideo();
          }
          setBufferHealth(100, 'healthy');
        },
        onStateChange: (event: any) => {
          const state = event.data;
          if (state === 0) { // ENDED
            nextTrack();
          } else if (state === 1) { // PLAYING
            setBufferHealth(100, 'healthy');
          } else if (state === 3) { // BUFFERING
            setBufferHealth(50, 'warning');
          }
        },
        onError: (event: any) => {
          setBufferHealth(0, 'emergency');
        },
      },
    });
  }, [isPlaying, volume, nextTrack, setBufferHealth]);

  // Load track when it changes
  useEffect(() => {
    const loadTrack = async () => {
      if (!currentTrack?.trackId) return;
      if (loadingRef.current) return;
      if (currentVideoId.current === currentTrack.trackId) return;

      // Cancel previous load operation
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      loadingRef.current = true;
      currentVideoId.current = currentTrack.trackId;

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

            audioRef.current.src = cachedUrl;
            audioRef.current.load();

            audioRef.current.oncanplay = () => {
              if (isPlaying) {
                audioRef.current?.play().catch(err => {
                });
              }
            };
          }
          loadingRef.current = false;
          return;
        }

        // 2. NOT CACHED - Use IFrame for instant playback
        // User can click "⚡ Boost HD" to download for next time
        setPlaybackMode('iframe');
        setPlaybackSource('iframe');

        const ytId = getYouTubeIdForIframe(currentTrack.trackId);
        initIframePlayer(ytId);

      } catch (error) {
        // Fallback to IFrame
        setPlaybackMode('iframe');
        setPlaybackSource('iframe');
        const ytId = getYouTubeIdForIframe(currentTrack.trackId);
        initIframePlayer(ytId);
      } finally {
        loadingRef.current = false;
      }
    };

    loadTrack();

    // Cleanup: revoke blob URL on unmount
    return () => {
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
          }
        } catch (e) {
          // Player not ready
        }
      }
    }, 250);

    return () => clearInterval(interval);
  }, [playbackMode, setCurrentTime, setDuration, setProgress]);

  // Audio element event handlers (for cached playback)
  const handleTimeUpdate = useCallback(() => {
    const el = audioRef.current;
    if (el && el.duration) {
      setCurrentTime(el.currentTime);
      setProgress((el.currentTime / el.duration) * 100);
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
