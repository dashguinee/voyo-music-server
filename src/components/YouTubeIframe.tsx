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
  if (trackId.startsWith('VOYO_')) return trackId.replace('VOYO_', '');
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
    if (!isApiLoadedRef.current || !(window as any).YT?.Player) return;
    if (!containerRef.current) return;
    if (initializingRef.current) return;
    if (playerRef.current && currentVideoIdRef.current === videoId) return;

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

          if (state.playbackSource === 'cached') {
            player.setVolume(0);
            player.mute();
          } else {
            player.unMute();
            player.setVolume(state.volume);
            player.playVideo();
            if (!state.isPlaying) usePlayerStore.getState().togglePlay();
          }

          const duration = player.getDuration();
          if (duration > 0) setDuration(duration);
        },
        onStateChange: (event: any) => {
          const ytState = event.data;
          const state = usePlayerStore.getState();

          if (ytState === YT_STATES.ENDED && state.playbackSource === 'iframe') {
            nextTrack();
          } else if (ytState === YT_STATES.PLAYING) {
            // Only update buffer health if we're the active playback source
            if (state.playbackSource === 'iframe') {
              setBufferHealth(100, 'healthy');
            }
            if (state.playbackSource === 'iframe' && !state.isPlaying) {
              usePlayerStore.getState().togglePlay();
            }
          } else if (ytState === YT_STATES.BUFFERING) {
            // Only update buffer health if we're the active playback source
            if (state.playbackSource === 'iframe') {
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
      const state = playerRef.current.getPlayerState();
      if (isPlaying) {
        if (state !== YT_STATES.PLAYING && state !== YT_STATES.BUFFERING) {
          playerRef.current.playVideo();
        }
      } else {
        if (state === YT_STATES.PLAYING || state === YT_STATES.BUFFERING) {
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

  // Hidden mode: offscreen but active for audio
  return (
    <div
      id="voyo-iframe-container"
      style={{
        position: 'fixed',
        top: -9999,
        left: -9999,
        width: 1,
        height: 1,
        opacity: 0,
        pointerEvents: 'none',
      }}
    >
      {iframeContent}
    </div>
  );
});

YouTubeIframe.displayName = 'YouTubeIframe';
export default YouTubeIframe;
