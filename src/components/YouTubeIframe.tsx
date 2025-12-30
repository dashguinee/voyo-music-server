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

import { useEffect, useRef, useCallback, memo } from 'react';
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
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const queue = usePlayerStore((s) => s.queue);

  const setCurrentTime = usePlayerStore((s) => s.setCurrentTime);
  const setDuration = usePlayerStore((s) => s.setDuration);
  const setProgress = usePlayerStore((s) => s.setProgress);
  const setBufferHealth = usePlayerStore((s) => s.setBufferHealth);
  const nextTrack = usePlayerStore((s) => s.nextTrack);
  const clearSeekPosition = usePlayerStore((s) => s.clearSeekPosition);
  const setVideoTarget = usePlayerStore((s) => s.setVideoTarget);

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
            // Only auto-play if isPlaying is already true (user initiated via playTrack)
            // Don't force play on page refresh - browser autoplay policies will block it
            if (state.isPlaying) {
              console.log(`[YouTubeIframe] onReady: isPlaying=true, calling playVideo()`);
              player.unMute();
              player.setVolume(state.volume);
              player.playVideo();
            } else {
              console.log(`[YouTubeIframe] onReady: isPlaying=false (page refresh), waiting for user action`);
              player.unMute();
              player.setVolume(state.volume);
              // Don't call playVideo() - wait for user to click play
            }

            // RETRY LOGIC: Verify playback started after 150ms (reduced from 500ms)
            setTimeout(() => {
              try {
                const playerState = player.getPlayerState();
                const freshState = usePlayerStore.getState();
                if (freshState.playbackSource !== 'cached' &&
                    freshState.isPlaying &&
                    playerState !== YT_STATES.PLAYING &&
                    playerState !== YT_STATES.BUFFERING) {
                  player.playVideo();
                }
              } catch (e) {}
            }, 150);
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
            // REMOVED: Auto-toggle was causing refresh bug
            // When YouTube fires PLAYING during init but browser blocks autoplay,
            // this would set isPlaying=true even though audio isn't playing.
            // User must explicitly tap play after refresh - let browser policy work.
            // if (state.playbackSource !== 'cached' && !state.isPlaying) {
            //   usePlayerStore.getState().togglePlay();
            // }
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
    if (isApiLoadedRef.current) initPlayer(youtubeId);
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

  // Get container styles based on videoTarget
  // CRITICAL: Always return same structure to prevent iframe remount
  const getContainerStyles = (): React.CSSProperties => {
    if (videoTarget === 'landscape') {
      return {
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
      };
    }
    if (videoTarget === 'portrait') {
      return {
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 60, // Above player controls, below modals
        overflow: 'hidden',
        background: '#000',
      };
    }
    // Hidden mode
    return {
      position: 'fixed',
      bottom: 0,
      right: 0,
      width: 300,
      height: 150,
      opacity: 0.001, // Nearly invisible but not 0 (some browsers detect opacity:0)
      pointerEvents: 'none',
      zIndex: -1, // Behind everything
    };
  };

  // Get video iframe inner styles
  const getVideoStyles = (): React.CSSProperties => {
    if (videoTarget === 'landscape') {
      return {
        width: '100%',
        height: '100%',
      };
    }
    if (videoTarget === 'portrait') {
      const scale = !isPlaying ? 1.2 : (showingOverlay ? 1.3 : 1.4);
      return {
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: '100%',
        height: '100%',
        transform: `translate(-50%, -50%) scale(${scale})`,
        transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
        zIndex: 0,
      };
    }
    return {
      width: '100%',
      height: '100%',
    };
  };

  // Calculate overlay visibility for portrait mode
  const timeRemaining = duration - currentTime;
  const showingNowPlaying = currentTime < 5;
  const showingNextUpMid = currentTime > 30 && duration > 60 &&
                            currentTime >= duration * 0.45 && currentTime < duration * 0.55;
  const showingNextUpEnd = timeRemaining > 0 && timeRemaining < 20;
  const upcomingTrack = queue[0]?.track || null;
  const showNextUp = (showingNextUpMid || showingNextUpEnd) && upcomingTrack;
  const showingOverlay = showingNowPlaying || showNextUp;

  return (
    <div
      id="voyo-iframe-container"
      style={getContainerStyles()}
    >
      {/* Video iframe - always same structure to prevent remount */}
      <div style={getVideoStyles()}>
        <div
          ref={containerRef}
          style={{ width: '100%', height: '100%' }}
        />
      </div>

      {/* Portrait mode overlays - only render when visible */}
      {videoTarget === 'portrait' && (
        <>
          {/* TAP TO CLOSE OVERLAY */}
          <div
            onClick={() => setVideoTarget('hidden')}
            style={{
              position: 'absolute',
              inset: 0,
              cursor: 'pointer',
              zIndex: 5,
            }}
            role="button"
            aria-label="Tap to close video"
          />

          {/* VIDEO INFO OVERLAYS */}
          {currentTrack && (
            <>
              {/* TOP Purple fade gradient */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'none',
                  zIndex: 10,
                  background: `linear-gradient(
                    to bottom,
                    rgba(88, 28, 135, 0.9) 0%,
                    rgba(139, 92, 246, 0.6) 12%,
                    rgba(139, 92, 246, 0.3) 25%,
                    transparent 45%
                  )`,
                }}
              />

              {/* BOTTOM Purple fade gradient */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'none',
                  zIndex: 10,
                  background: `linear-gradient(
                    to top,
                    rgba(88, 28, 135, 0.95) 0%,
                    rgba(139, 92, 246, 0.7) 15%,
                    rgba(139, 92, 246, 0.4) 30%,
                    rgba(139, 92, 246, 0.1) 50%,
                    transparent 70%
                  )`,
                }}
              />

              {/* NOW PLAYING - First 5 seconds */}
              {showingNowPlaying && (
                <div
                  style={{
                    position: 'absolute',
                    top: 16,
                    left: 16,
                    right: 16,
                    zIndex: 15,
                    pointerEvents: 'none',
                  }}
                >
                  <p style={{
                    color: 'rgba(216, 180, 254, 0.9)',
                    fontSize: 10,
                    textTransform: 'uppercase',
                    letterSpacing: '0.2em',
                    fontWeight: 500,
                    marginBottom: 4,
                    textShadow: '0 1px 4px rgba(0,0,0,0.9)',
                  }}>
                    Now Playing
                  </p>
                  <p style={{
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: 16,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    textShadow: '0 2px 8px rgba(0,0,0,0.9)',
                  }}>
                    {currentTrack.title}
                  </p>
                  <p style={{
                    color: 'rgba(255,255,255,0.7)',
                    fontSize: 12,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    textShadow: '0 1px 4px rgba(0,0,0,0.9)',
                  }}>
                    {currentTrack.artist}
                  </p>
                </div>
              )}

              {/* NEXT UP - Mid & End of track */}
              {showNextUp && !showingNowPlaying && upcomingTrack && (
                <div
                  style={{
                    position: 'absolute',
                    top: 16,
                    left: 16,
                    right: 16,
                    zIndex: 15,
                    pointerEvents: 'none',
                  }}
                >
                  <p style={{
                    color: 'rgba(251, 191, 36, 0.9)',
                    fontSize: 10,
                    textTransform: 'uppercase',
                    letterSpacing: '0.2em',
                    fontWeight: 500,
                    marginBottom: 4,
                    textShadow: '0 1px 4px rgba(0,0,0,0.9)',
                  }}>
                    Next Up
                  </p>
                  <p style={{
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: 16,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    textShadow: '0 2px 8px rgba(0,0,0,0.9)',
                  }}>
                    {upcomingTrack.title}
                  </p>
                  <p style={{
                    color: 'rgba(255,255,255,0.7)',
                    fontSize: 12,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    textShadow: '0 1px 4px rgba(0,0,0,0.9)',
                  }}>
                    {upcomingTrack.artist}
                  </p>
                </div>
              )}

              {/* BOTTOM TRACK INFO - Always visible */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 80,
                  left: 16,
                  right: 16,
                  zIndex: 15,
                  pointerEvents: 'none',
                }}
              >
                <p style={{
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: 18,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  textShadow: '0 2px 8px rgba(0,0,0,0.9)',
                }}>
                  {currentTrack.title}
                </p>
                <p style={{
                  color: 'rgba(255,255,255,0.7)',
                  fontSize: 14,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  textShadow: '0 1px 4px rgba(0,0,0,0.9)',
                }}>
                  {currentTrack.artist}
                </p>
              </div>

              {/* TAP HINT */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 40,
                  left: 0,
                  right: 0,
                  textAlign: 'center',
                  zIndex: 15,
                  pointerEvents: 'none',
                }}
              >
                <p style={{
                  color: 'rgba(255,255,255,0.4)',
                  fontSize: 10,
                  textShadow: '0 1px 4px rgba(0,0,0,0.9)',
                }}>
                  Tap anywhere to close
                </p>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
});

YouTubeIframe.displayName = 'YouTubeIframe';
export default YouTubeIframe;
