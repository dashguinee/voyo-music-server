/**
 * VOYO Music - Unified YouTube Iframe
 *
 * Single iframe that handles BOTH:
 * 1. Audio streaming (when track not boosted) - UNMUTED
 * 2. Video display (when user wants video)
 *
 * States:
 * - playbackSource === 'cached' → Iframe MUTED (audio from Boost)
 * - playbackSource === 'iframe' → Iframe UNMUTED (audio from stream)
 * - videoTarget === 'hidden' → Iframe hidden (offscreen for audio only)
 * - videoTarget === 'portrait' → Renders in BigCenterCard (swaps with thumbnail)
 * - videoTarget === 'landscape' → Fullscreen fixed position
 */

import { useEffect, useRef, useCallback, memo, useMemo } from 'react';
import { usePlayerStore } from '../store/playerStore';

const YT_STATES = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
};

function getYouTubeId(trackId: string): string {
  if (!trackId) return '';

  // Handle VOYO_ prefix (old format)
  if (trackId.startsWith('VOYO_')) {
    const result = trackId.replace('VOYO_', '');
    console.log(`[YouTubeIframe] getYouTubeId: ${trackId} → ${result} (VOYO_ prefix)`);
    return result;
  }

  // Handle vyo_ prefix (base64url encoded YouTube ID)
  if (trackId.startsWith('vyo_')) {
    try {
      const encoded = trackId.substring(4);
      // Convert base64url to standard base64
      let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
      // Add padding if needed
      while (base64.length % 4 !== 0) base64 += '=';
      const decoded = atob(base64);
      // Valid YouTube IDs are 11 characters
      if (decoded.length === 11 && /^[a-zA-Z0-9_-]+$/.test(decoded)) {
        console.log(`[YouTubeIframe] getYouTubeId: ${trackId} → ${decoded} (vyo_ decoded)`);
        return decoded;
      }
      console.warn(`[YouTubeIframe] getYouTubeId: ${trackId} decoded to invalid ID: ${decoded}`);
    } catch (e) {
      console.warn('[YouTubeIframe] Failed to decode vyo_ trackId:', trackId, e);
    }
  }

  console.log(`[YouTubeIframe] getYouTubeId: ${trackId} → ${trackId} (passthrough)`);
  return trackId;
}

// Isolated component for portrait mode - handles dynamic zoom based on overlay state
const PortraitVideoContainer = memo(({ iframeContent }: { iframeContent: React.ReactNode }) => {
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const queue = usePlayerStore((s) => s.queue);
  const isPlaying = usePlayerStore((s) => s.isPlaying);

  // Calculate overlay visibility (same logic as VideoOverlays)
  const timeRemaining = duration - currentTime;
  const showingNowPlaying = currentTime < 5;
  const showingNextUpMid = currentTime > 30 && duration > 60 &&
                            currentTime >= duration * 0.45 && currentTime < duration * 0.55;
  const showingNextUpEnd = timeRemaining > 0 && timeRemaining < 20;
  const showingOverlay = showingNowPlaying || ((showingNextUpMid || showingNextUpEnd) && queue.length > 0);

  // Dynamic zoom:
  // - Full zoom (220%) during pure playback
  // - Pull back (190%) when overlay appears (give text breathing room)
  // - Slight pull back when paused
  const getZoomLevel = () => {
    if (!isPlaying) return { width: '200%', height: '130%' }; // Paused
    if (showingOverlay) return { width: '190%', height: '120%' }; // Overlay visible
    return { width: '220%', height: '140%' }; // Full immersion
  };

  const { width, height } = getZoomLevel();

  return (
    <div
      id="voyo-iframe-container"
      className="absolute inset-0 z-10 overflow-hidden rounded-[2rem]"
      style={{ background: '#000' }}
    >
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width,
          height,
          transform: 'translate(-50%, -50%)',
          transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1), height 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {iframeContent}
      </div>
    </div>
  );
});

export const YouTubeIframe = memo(() => {
  const playerRef = useRef<YT.Player | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isApiLoadedRef = useRef(false);
  const currentVideoIdRef = useRef<string | null>(null);
  const initializingRef = useRef(false);

  // Interval management refs to prevent leaks
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isIntervalRunningRef = useRef(false);

  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const volume = usePlayerStore((s) => s.volume);
  const playbackSource = usePlayerStore((s) => s.playbackSource);
  const videoTarget = usePlayerStore((s) => s.videoTarget);
  const seekPosition = usePlayerStore((s) => s.seekPosition);

  const setCurrentTime = usePlayerStore((s) => s.setCurrentTime);
  const setDuration = usePlayerStore((s) => s.setDuration);
  const setProgress = usePlayerStore((s) => s.setProgress);
  const setBufferHealth = usePlayerStore((s) => s.setBufferHealth);
  const nextTrack = usePlayerStore((s) => s.nextTrack);
  const clearSeekPosition = usePlayerStore((s) => s.clearSeekPosition);

  const youtubeId = currentTrack?.trackId ? getYouTubeId(currentTrack.trackId) : '';
  const showVideo = videoTarget !== 'hidden';

  // Load YouTube API
  useEffect(() => {
    if (isApiLoadedRef.current) return;
    if ((window as any).YT?.Player) {
      isApiLoadedRef.current = true;
      return;
    }

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScript = document.getElementsByTagName('script')[0];
    firstScript.parentNode?.insertBefore(tag, firstScript);

    (window as any).onYouTubeIframeAPIReady = () => {
      isApiLoadedRef.current = true;
      if (youtubeId) initPlayer(youtubeId);
    };
  }, []);

  const initPlayer = useCallback((videoId: string) => {
    console.log(`[YouTubeIframe] initPlayer called with videoId: ${videoId}`);
    if (!isApiLoadedRef.current || !(window as any).YT?.Player) {
      console.log('[YouTubeIframe] API not loaded yet');
      return;
    }
    if (!containerRef.current) {
      console.log('[YouTubeIframe] No container ref');
      return;
    }
    if (initializingRef.current) {
      console.log('[YouTubeIframe] Already initializing');
      return;
    }
    if (playerRef.current && currentVideoIdRef.current === videoId) {
      console.log('[YouTubeIframe] Same video, skipping');
      return;
    }

    console.log(`[YouTubeIframe] Creating player for: ${videoId}`);
    initializingRef.current = true;
    currentVideoIdRef.current = videoId;

    if (playerRef.current) {
      try { playerRef.current.destroy(); } catch (e) {}
      playerRef.current = null;
    }

    containerRef.current.innerHTML = '';
    const isBoosted = usePlayerStore.getState().playbackSource === 'cached';

    playerRef.current = new (window as any).YT.Player(containerRef.current, {
      width: '100%',
      height: '100%',
      videoId: videoId,
      playerVars: {
        autoplay: 1,
        controls: 0,
        disablekb: 1,
        fs: 0,
        iv_load_policy: 3,
        modestbranding: 1,
        rel: 0,
        showinfo: 0,
        playsinline: 1,
        origin: window.location.origin,
        enablejsapi: 1,
        mute: isBoosted ? 1 : 0,
      },
      events: {
        onReady: (event: any) => {
          initializingRef.current = false;
          const player = event.target;
          const state = usePlayerStore.getState();
          console.log(`[YouTubeIframe] onReady: playbackSource=${state.playbackSource}, isPlaying=${state.isPlaying}`);

          if (state.playbackSource === 'cached') {
            console.log('[YouTubeIframe] onReady: Source is cached, muting iframe');
            player.setVolume(0);
            player.mute();
          } else {
            // playbackSource is 'iframe' OR null (AudioPlayer still determining)
            // Either way, we should play since user requested playback
            console.log(`[YouTubeIframe] onReady: Source is ${state.playbackSource}, calling playVideo()`);
            player.unMute();
            player.setVolume(state.volume);
            player.playVideo();

            // FORCE sync: Always ensure store reflects playing state
            if (!state.isPlaying) {
              usePlayerStore.getState().togglePlay();
            }

            // RETRY LOGIC: Verify playback started after 500ms
            // Handles cases where playVideo() silently fails
            setTimeout(() => {
              try {
                const playerState = player.getPlayerState();
                const freshState = usePlayerStore.getState();
                console.log(`[YouTubeIframe] Retry check: playerState=${playerState}, playbackSource=${freshState.playbackSource}`);
                // Only retry if we're still in iframe mode (not switched to cached)
                // AND if we should be playing but it's not actually playing
                if (freshState.playbackSource !== 'cached' &&
                    freshState.isPlaying &&
                    playerState !== YT_STATES.PLAYING &&
                    playerState !== YT_STATES.BUFFERING) {
                  console.log('[YouTubeIframe] Retry: forcing playVideo()');
                  player.playVideo();
                }
              } catch (e) {
                // Player may have been destroyed, ignore
              }
            }, 500);
          }

          const duration = player.getDuration();
          if (duration > 0) setDuration(duration);
        },
        onStateChange: (event: any) => {
          const ytState = event.data;
          const state = usePlayerStore.getState();
          console.log(`[YouTubeIframe] onStateChange: ytState=${ytState}, playbackSource=${state.playbackSource}, isPlaying=${state.isPlaying}`);

          if (ytState === YT_STATES.ENDED && state.playbackSource !== 'cached') {
            // Track ended - go to next (unless we're in cached mode where AudioPlayer handles this)
            nextTrack();
          } else if (ytState === YT_STATES.PLAYING) {
            // Update buffer health if we're streaming via iframe (or source not yet determined)
            if (state.playbackSource !== 'cached') {
              setBufferHealth(100, 'healthy');
              // Also ensure playbackSource is set to iframe if it was null
              if (state.playbackSource === null) {
                usePlayerStore.getState().setPlaybackSource('iframe');
              }
            }
            if (state.playbackSource !== 'cached' && !state.isPlaying) {
              usePlayerStore.getState().togglePlay();
            }
          } else if (ytState === YT_STATES.BUFFERING) {
            // Update buffer health if we're streaming via iframe
            if (state.playbackSource !== 'cached') {
              setBufferHealth(50, 'warning');
            }
          }
        },
        onError: (event: any) => {
          console.error('🎬 [VOYO] Iframe error:', event.data);
          setBufferHealth(0, 'emergency');
          initializingRef.current = false;
        },
      },
    });
  }, [setDuration, setBufferHealth, nextTrack]);

  useEffect(() => {
    if (!youtubeId) return;
    const timer = setTimeout(() => {
      if (isApiLoadedRef.current) initPlayer(youtubeId);
    }, 100);
    return () => clearTimeout(timer);
  }, [youtubeId, initPlayer]);

  useEffect(() => {
    if (!playerRef.current) return;
    try {
      const ytState = playerRef.current.getPlayerState();
      const currentSource = usePlayerStore.getState().playbackSource;

      // Only control playback if we're the audio source (iframe mode) or source not yet determined
      // In cached mode, AudioPlayer handles playback - we just provide video
      if (currentSource === 'cached') {
        // In cached mode, just sync video position with audio, don't control play state
        return;
      }

      if (isPlaying) {
        if (ytState !== YT_STATES.PLAYING && ytState !== YT_STATES.BUFFERING) {
          console.log('[YouTubeIframe] isPlaying effect: calling playVideo()');
          playerRef.current.playVideo();
        }
      } else {
        if (ytState === YT_STATES.PLAYING || ytState === YT_STATES.BUFFERING) {
          playerRef.current.pauseVideo();
        }
      }
    } catch (e) {}
  }, [isPlaying]);

  useEffect(() => {
    if (!playerRef.current) return;
    try {
      if (playbackSource === 'cached') {
        playerRef.current.mute();
        playerRef.current.setVolume(0);
      } else if (playbackSource === 'iframe') {
        playerRef.current.unMute();
        playerRef.current.setVolume(volume);

        // FIX: When switching to iframe mode, ensure playback starts if isPlaying is true
        // This handles the case where isPlaying was set before playbackSource
        const { isPlaying: shouldPlay } = usePlayerStore.getState();
        if (shouldPlay) {
          const ytState = playerRef.current.getPlayerState();
          if (ytState !== YT_STATES.PLAYING && ytState !== YT_STATES.BUFFERING) {
            console.log('[YouTubeIframe] playbackSource=iframe + isPlaying=true, calling playVideo()');
            playerRef.current.playVideo();
          }
        }
      }
    } catch (e) {}
  }, [playbackSource, volume]);

  useEffect(() => {
    if (!playerRef.current || playbackSource !== 'iframe') return;
    try { playerRef.current.setVolume(volume); } catch (e) {}
  }, [volume, playbackSource]);

  useEffect(() => {
    // ONLY handle seek if we're the active playback source (iframe mode)
    // In cached mode, AudioPlayer handles the seek
    if (playbackSource !== 'iframe') return;
    if (seekPosition === null || !playerRef.current) return;

    try { playerRef.current.seekTo(seekPosition, true); } catch (e) {}
    clearSeekPosition();
  }, [seekPosition, playbackSource, clearSeekPosition]);

  // Progress tracking interval with leak prevention
  useEffect(() => {
    // Clear any existing interval first to prevent stacking
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (playbackSource !== 'iframe' || !playerRef.current) {
      isIntervalRunningRef.current = false;
      return;
    }

    // Guard against re-entry during rapid mode switches
    if (isIntervalRunningRef.current) return;
    isIntervalRunningRef.current = true;

    intervalRef.current = setInterval(() => {
      if (!playerRef.current) return;
      try {
        const time = playerRef.current.getCurrentTime();
        const dur = playerRef.current.getDuration();
        setCurrentTime(time);
        if (dur > 0) {
          setProgress((time / dur) * 100);
        }
      } catch (e) {
        // Player not ready, ignore
      }
    }, 250);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      isIntervalRunningRef.current = false;
    };
  }, [playbackSource]); // Minimal deps - setCurrentTime/setProgress are stable store functions

  // The iframe content
  const iframeContent = (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%' }}
    />
  );

  // Landscape mode: fullscreen fixed
  if (videoTarget === 'landscape') {
    return (
      <div
        id="voyo-iframe-container"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          transform: 'scale(1.2)',
          transformOrigin: 'center center',
          zIndex: 100,
          pointerEvents: 'none',
          overflow: 'hidden',
          background: '#000',
        }}
      >
        {iframeContent}
      </div>
    );
  }

  // Portrait mode: DYNAMIC ZOOM based on playback state
  // Full zoom during playback, pull back when showing overlays
  if (videoTarget === 'portrait') {
    return <PortraitVideoContainer iframeContent={iframeContent} />;
  }

  // Hidden mode: visually hidden but still "visible" to YouTube
  // YouTube blocks autoplay for truly invisible iframes (1x1px, offscreen)
  // So we make it small but on-screen with opacity:0 and behind everything
  return (
    <div
      id="voyo-iframe-container"
      style={{
        position: 'fixed',
        bottom: 0,
        right: 0,
        width: 300,
        height: 150,
        opacity: 0.001, // Nearly invisible but not 0 (some browsers detect opacity:0)
        pointerEvents: 'none',
        zIndex: -1, // Behind everything
      }}
    >
      {iframeContent}
    </div>
  );
});

YouTubeIframe.displayName = 'YouTubeIframe';
export default YouTubeIframe;
