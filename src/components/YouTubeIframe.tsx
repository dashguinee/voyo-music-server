/**
 * VOYO Music - Single Source of Truth YouTube Iframe
 *
 * ONE iframe that handles everything:
 * - Audio streaming (unmuted when not boosted)
 * - Video display in 3 modes:
 *   - hidden: offscreen (audio only)
 *   - portrait: overlay on BigCenterCard area (208x208 centered)
 *   - landscape: fullscreen
 *
 * NEVER unmounts - CSS positioning changes only
 */

import { useEffect, useRef, useCallback, memo, useState } from 'react';
import { motion } from 'framer-motion';
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
  if (trackId.startsWith('vyo_')) {
    try {
      const encoded = trackId.substring(4);
      let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4 !== 0) base64 += '=';
      const decoded = atob(base64);
      if (decoded.length === 11 && /^[a-zA-Z0-9_-]+$/.test(decoded)) return decoded;
    } catch (e) {}
  }
  return trackId;
}

export const YouTubeIframe = memo(() => {
  const playerRef = useRef<YT.Player | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isApiLoadedRef = useRef(false);
  const currentVideoIdRef = useRef<string | null>(null);
  const initializingRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Overlay timing state
  const [showNowPlaying, setShowNowPlaying] = useState(false);
  const [showNextUp, setShowNextUp] = useState(false);
  const [showPortraitNextUp, setShowPortraitNextUp] = useState(false); // Full-cover thumbnail for portrait
  const [isDragging, setIsDragging] = useState(false);
  const upcomingTrack = queue[0]?.track || null;


  // Update overlay visibility based on playback time
  useEffect(() => {
    if (videoTarget === 'hidden') {
      setShowNowPlaying(false);
      setShowNextUp(false);
      setShowPortraitNextUp(false);
      return;
    }
    // Now Playing: first 5 seconds
    setShowNowPlaying(currentTime < 5 && currentTime > 0);
    // Next Up: 45-55% or last 20 seconds
    const timeRemaining = duration - currentTime;
    const midTrack = currentTime > 30 && duration > 60 && currentTime >= duration * 0.45 && currentTime < duration * 0.55;
    const endTrack = timeRemaining > 0 && timeRemaining < 20;
    setShowNextUp((midTrack || endTrack) && !!upcomingTrack);

    // Portrait: Full thumbnail takeover in last 8 seconds (YouTube shows at ~5s)
    // Disguised as intentional "Up Next" preview - not blocking, featuring!
    const portraitEndZone = timeRemaining > 0 && timeRemaining < 8;
    setShowPortraitNextUp(videoTarget === 'portrait' && portraitEndZone && !!upcomingTrack);
  }, [currentTime, duration, videoTarget, upcomingTrack]);

  // Load YouTube API once
  useEffect(() => {
    if (isApiLoadedRef.current || (window as any).YT?.Player) {
      isApiLoadedRef.current = true;
      return;
    }
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
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
      videoId,
      playerVars: {
        autoplay: 1,
        controls: 0,
        disablekb: 1,
        enablejsapi: 1,
        fs: 0,
        iv_load_policy: 3,
        modestbranding: 1,
        playsinline: 1,
        rel: 0,
        showinfo: 0,
        origin: window.location.origin,
      },
      events: {
        onReady: (e: any) => {
          initializingRef.current = false;
          const isBoostedNow = usePlayerStore.getState().playbackSource === 'cached';
          if (isBoostedNow) {
            e.target.mute();
          } else {
            e.target.unMute();
            e.target.setVolume(volume * 100);
          }
          const dur = e.target.getDuration?.() || 0;
          if (dur > 0) setDuration(dur);
          if (usePlayerStore.getState().isPlaying) {
            e.target.playVideo();
          }
        },
        onStateChange: (e: any) => {
          if (e.data === YT_STATES.ENDED) {
            nextTrack();
          }
        },
        onError: (e: any) => {
          console.error('[YouTubeIframe] Error:', e.data);
          initializingRef.current = false;
        },
      },
    });
  }, [volume, nextTrack, setDuration]);

  // Init player when track changes
  useEffect(() => {
    if (youtubeId && isApiLoadedRef.current) {
      initPlayer(youtubeId);
    }
  }, [youtubeId, initPlayer]);

  // Play/Pause sync
  useEffect(() => {
    const player = playerRef.current;
    if (!player?.getPlayerState) return;
    const state = player.getPlayerState();
    if (isPlaying && state !== YT_STATES.PLAYING) {
      player.playVideo?.();
    } else if (!isPlaying && state === YT_STATES.PLAYING) {
      player.pauseVideo?.();
    }
  }, [isPlaying]);

  // Volume sync (only when not boosted)
  useEffect(() => {
    const player = playerRef.current;
    if (!player?.setVolume || playbackSource === 'cached') return;
    player.setVolume(volume * 100);
  }, [volume, playbackSource]);

  // Mute/unmute based on boost status
  useEffect(() => {
    const player = playerRef.current;
    if (!player?.mute) return;
    if (playbackSource === 'cached') {
      player.mute();
    } else {
      player.unMute();
      player.setVolume?.(volume * 100);
    }
  }, [playbackSource, volume]);

  // Seek handling
  useEffect(() => {
    if (seekPosition === null) return;
    const player = playerRef.current;
    if (player?.seekTo) {
      player.seekTo(seekPosition, true);
      clearSeekPosition();
    }
  }, [seekPosition, clearSeekPosition]);

  // Fallback sync: When boosted, video should follow audio (not vice versa)
  // Only kicks in if drift exceeds threshold - YouTube rarely buffers
  // NOTE: Don't include currentTime in deps - read it fresh each check
  useEffect(() => {
    if (playbackSource !== 'cached' || !isPlaying) return;

    const DRIFT_THRESHOLD = 2; // seconds - only sync if drift is noticeable
    const CHECK_INTERVAL = 5000; // check every 5 seconds

    const syncInterval = setInterval(() => {
      const player = playerRef.current;
      if (!player?.getCurrentTime || !player?.seekTo) return;

      const videoTime = player.getCurrentTime() || 0;
      const audioTime = usePlayerStore.getState().currentTime; // Read fresh from store
      const drift = Math.abs(videoTime - audioTime);

      if (drift > DRIFT_THRESHOLD) {
        console.log(`[YouTubeIframe] Drift detected: ${drift.toFixed(1)}s - syncing video to audio`);
        player.seekTo(audioTime, true);
      }
    }, CHECK_INTERVAL);

    return () => clearInterval(syncInterval);
  }, [playbackSource, isPlaying]);

  // Time update interval (only when streaming from iframe)
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (playbackSource !== 'iframe' || !isPlaying) return;

    intervalRef.current = setInterval(() => {
      const player = playerRef.current;
      if (!player?.getCurrentTime || !player?.getDuration) return;
      const time = player.getCurrentTime() || 0;
      const dur = player.getDuration() || 0;
      if (dur > 0) {
        setCurrentTime(time);
        setProgress((time / dur) * 100);
        setDuration(dur);
        const buffered = player.getVideoLoadedFraction?.() || 0;
        setBufferHealth(Math.round(buffered * 100), 'healthy');
      }
    }, 250);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playbackSource, isPlaying, setCurrentTime, setProgress, setDuration, setBufferHealth]);

  // Container styles based on videoTarget
  const getContainerStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: 'fixed',
      overflow: 'hidden',
      background: '#000',
      transition: 'all 0.3s ease-out',
    };

    if (videoTarget === 'landscape') {
      return {
        ...base,
        inset: 0,
        zIndex: 40,
      };
    }

    if (videoTarget === 'portrait' && isPlaying) {
      // Center over BigCenterCard area
      return {
        ...base,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '208px',
        height: '208px',
        borderRadius: '2rem',
        zIndex: 60,
        opacity: 1,
      };
    }

    // Hidden - offscreen for audio streaming
    // Keep same size as portrait to prevent YouTube rebuffer on transition
    return {
      ...base,
      bottom: '-300px',
      right: '-300px',
      width: '208px',
      height: '208px',
      zIndex: -1,
      opacity: 0,
      pointerEvents: 'none',
      transition: 'opacity 0.15s ease-out',
    };
  };

  // Video styles (zoom to hide YouTube branding)
  const getVideoStyle = (): React.CSSProperties => {
    const zoom = videoTarget === 'landscape' ? 1.2 : 2;
    return {
      width: '100%',
      height: '100%',
      transform: `scale(${zoom})`,
      transformOrigin: 'center center',
      pointerEvents: 'none',
    };
  };

  const showOverlays = videoTarget !== 'hidden' && isPlaying;

  // Portrait mode: draggable
  const isPortraitMode = videoTarget === 'portrait' && isPlaying;

  return (
    <motion.div
      style={getContainerStyle()}
      drag={isPortraitMode}
      dragMomentum={false}
      dragElastic={0}
      onDragStart={() => setIsDragging(true)}
      onDragEnd={() => setIsDragging(false)}
      whileDrag={{ boxShadow: '0 25px 50px rgba(139, 92, 246, 0.5)' }}
    >
      {/* Video container */}
      <div style={getVideoStyle()}>
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      </div>

      {/* Tap to close - portrait only (uses onTap to not fire on drag) */}
      {isPortraitMode && (
        <motion.div
          onTap={() => setVideoTarget('hidden')}
          style={{
            position: 'absolute',
            inset: 0,
            cursor: 'grab',
            zIndex: 5,
          }}
        />
      )}

      {/* Purple overlays */}
      {showOverlays && (
        <>
          {/* Gentle full-card purple tint */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              zIndex: 9,
              background: 'rgba(139, 92, 246, 0.04)',
            }}
          />
          {/* Top gradient */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              zIndex: 10,
              background: 'linear-gradient(to bottom, rgba(88,28,135,0.7) 0%, transparent 30%)',
              animation: 'fadeIn 1s ease-out',
            }}
          />
          {/* Bottom gradient */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              zIndex: 10,
              background: 'linear-gradient(to top, rgba(88,28,135,0.8) 0%, transparent 35%)',
              animation: 'fadeIn 1s ease-out',
            }}
          />
          <style>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
          `}</style>
        </>
      )}

      {/* Now Playing overlay */}
      {showOverlays && showNowPlaying && currentTrack && (
        <div
          style={{
            position: 'absolute',
            top: videoTarget === 'landscape' ? 24 : 12,
            left: videoTarget === 'landscape' ? 24 : 12,
            right: videoTarget === 'landscape' ? 24 : 12,
            zIndex: 15,
            pointerEvents: 'none',
          }}
        >
          <p style={{ color: 'rgba(216,180,254,0.9)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 500, marginBottom: 2 }}>
            Now Playing
          </p>
          <p style={{ color: 'white', fontWeight: 'bold', fontSize: videoTarget === 'landscape' ? 18 : 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {currentTrack.title}
          </p>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: videoTarget === 'landscape' ? 14 : 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {currentTrack.artist}
          </p>
        </div>
      )}

      {/* Next Up overlay */}
      {showOverlays && showNextUp && !showNowPlaying && upcomingTrack && (
        <div
          style={{
            position: 'absolute',
            top: videoTarget === 'landscape' ? 24 : 12,
            left: videoTarget === 'landscape' ? 24 : 12,
            right: videoTarget === 'landscape' ? 24 : 12,
            zIndex: 15,
            pointerEvents: 'none',
          }}
        >
          <p style={{ color: 'rgba(251,191,36,0.9)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 500, marginBottom: 2 }}>
            Next Up
          </p>
          <p style={{ color: 'white', fontWeight: 'bold', fontSize: videoTarget === 'landscape' ? 18 : 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {upcomingTrack.title}
          </p>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: videoTarget === 'landscape' ? 14 : 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {upcomingTrack.artist}
          </p>
        </div>
      )}

      {/* Bottom track info */}
      {showOverlays && currentTrack && (
        <div
          style={{
            position: 'absolute',
            bottom: videoTarget === 'landscape' ? 80 : 12,
            left: videoTarget === 'landscape' ? 24 : 12,
            right: videoTarget === 'landscape' ? 24 : 12,
            zIndex: 15,
            pointerEvents: 'none',
          }}
        >
          <p style={{ color: 'white', fontWeight: 'bold', fontSize: videoTarget === 'landscape' ? 20 : 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {currentTrack.title}
          </p>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: videoTarget === 'landscape' ? 16 : 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {currentTrack.artist}
          </p>
        </div>
      )}

      {/* Portrait: drag/tap hint */}
      {isPortraitMode && !showPortraitNextUp && (
        <div style={{ position: 'absolute', bottom: 4, left: 0, right: 0, textAlign: 'center', zIndex: 15, pointerEvents: 'none' }}>
          <p style={{ color: isDragging ? 'rgba(139,92,246,0.8)' : 'rgba(255,255,255,0.4)', fontSize: 8, transition: 'color 0.2s' }}>
            {isDragging ? '📱 Rotate phone for FULL Vibes' : 'Drag to move • Tap to close'}
          </p>
        </div>
      )}

      {/* Portrait: Full "Up Next" thumbnail takeover - covers YouTube suggestions intentionally */}
      {showPortraitNextUp && upcomingTrack && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 20,
            borderRadius: '2rem',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Next track thumbnail as background */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `url(${upcomingTrack.coverUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'brightness(0.7)',
            }}
          />
          {/* Purple gradient overlay */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to bottom, rgba(88,28,135,0.4) 0%, rgba(88,28,135,0.8) 100%)',
            }}
          />
          {/* Content */}
          <div style={{ position: 'relative', zIndex: 5, textAlign: 'center', padding: 16 }}>
            <p style={{ color: 'rgba(251,191,36,0.9)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.2em', fontWeight: 600, marginBottom: 8 }}>
              Up Next
            </p>
            <p style={{ color: 'white', fontWeight: 'bold', fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
              {upcomingTrack.title}
            </p>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 2 }}>
              {upcomingTrack.artist}
            </p>
          </div>
        </motion.div>
      )}

      {/* No X button in landscape - LandscapeVOYO controls handle navigation */}
    </motion.div>
  );
});

YouTubeIframe.displayName = 'YouTubeIframe';
export default YouTubeIframe;
