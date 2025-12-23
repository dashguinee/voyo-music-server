/**
 * VideoSnippet - YouTube iFrame Video for Feed Cards
 *
 * Uses YouTube's native iframe embed (simple & reliable)
 * Video is MUTED - audio comes from our AudioPlayer engine
 * Syncs video position with audio playback via postMessage API
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Film, Play } from 'lucide-react';
import { usePlayerStore } from '../../../store/playerStore';

// Teaser strategy determines video treatment
type TeaserStrategy = 'entrance' | 'hotspot' | 'pre-hook' | 'middle';

interface VideoSnippetProps {
  trackId: string; // YouTube video ID or VOYO ID
  isActive: boolean;
  isPlaying: boolean;
  isThisTrack: boolean;
  shouldPreload?: boolean; // Preload this video (for upcoming cards)
  fallbackThumbnail?: string;
  teaserStrategy?: TeaserStrategy; // Video treatment based on teaser strategy
  onVideoReady?: () => void;
  onVideoError?: () => void;
}

// Video treatments per strategy - cinematic feel
const VIDEO_TREATMENTS: Record<TeaserStrategy, {
  scale: [number, number];      // Start -> End scale
  translateY: [string, string]; // Subtle vertical motion
  duration: number;             // Animation duration
  description: string;
}> = {
  entrance: {
    scale: [1.0, 1.08],          // Slow zoom IN - building anticipation
    translateY: ['0%', '-1%'],   // Slight upward drift
    duration: 12,
    description: 'Zoom in - anticipation',
  },
  hotspot: {
    scale: [1.05, 1.02],         // Pulse/breathe - energy at hook
    translateY: ['0%', '0%'],    // Stay centered on action
    duration: 8,
    description: 'Pulse - energy',
  },
  'pre-hook': {
    scale: [1.1, 1.0],           // Zoom OUT - tension release incoming
    translateY: ['1%', '0%'],    // Settle down
    duration: 10,
    description: 'Zoom out - tension',
  },
  middle: {
    scale: [1.03, 1.06],         // Gentle drift - discovery
    translateY: ['-0.5%', '0.5%'], // Pan motion
    duration: 15,
    description: 'Drift - discovery',
  },
};

export const VideoSnippet = ({
  trackId,
  isActive,
  isPlaying,
  isThisTrack,
  shouldPreload = false,
  fallbackThumbnail,
  teaserStrategy = 'hotspot',
  onVideoReady,
  onVideoError,
}: VideoSnippetProps) => {
  // Get video treatment for this strategy
  const treatment = VIDEO_TREATMENTS[teaserStrategy];
  const [isLoaded, setIsLoaded] = useState(false);
  const [showIframe, setShowIframe] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const { progress, duration } = usePlayerStore();

  // Decode VOYO ID to YouTube ID if needed
  const youtubeId = useMemo(() => {
    if (!trackId.startsWith('vyo_')) return trackId;

    const encoded = trackId.substring(4);
    let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) base64 += '=';

    try {
      return atob(base64);
    } catch {
      return trackId;
    }
  }, [trackId]);

  // Build YouTube embed URL with optimal params
  const embedUrl = useMemo(() => {
    const params = new URLSearchParams({
      autoplay: '1',
      mute: '1', // MUST be muted - audio from our engine
      controls: '0',
      disablekb: '1',
      fs: '0',
      iv_load_policy: '3', // Hide annotations
      loop: '0',
      modestbranding: '1',
      playsinline: '1',
      rel: '0',
      showinfo: '0',
      enablejsapi: '1', // Enable JS API for seeking
      origin: window.location.origin,
    });

    return `https://www.youtube.com/embed/${youtubeId}?${params.toString()}`;
  }, [youtubeId]);

  // Load iframe when card becomes active OR when preloading next cards
  useEffect(() => {
    if (isActive && !showIframe) {
      // Immediate load for active card (no delay - preloading handles smoothness)
      setShowIframe(true);
      console.log(`[VideoSnippet] Loading YouTube iframe for ${youtubeId}`);
    }
  }, [isActive, showIframe, youtubeId]);

  // PRELOAD: Load iframe IMMEDIATELY for upcoming cards - no delay!
  useEffect(() => {
    if (shouldPreload && !showIframe) {
      // No delay - preload as soon as marked for preload
      setShowIframe(true);
      console.log(`[VideoSnippet] 🔄 Preloading YouTube iframe for ${youtubeId}`);
    }
  }, [shouldPreload, showIframe, youtubeId]);

  // Control playback via postMessage
  useEffect(() => {
    if (!iframeRef.current || !isLoaded) return;

    const iframe = iframeRef.current;

    if (isPlaying && isThisTrack) {
      iframe.contentWindow?.postMessage('{"event":"command","func":"playVideo","args":""}', '*');
    } else {
      iframe.contentWindow?.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
    }
  }, [isPlaying, isThisTrack, isLoaded]);

  // Sync video position with audio
  useEffect(() => {
    if (!iframeRef.current || !isThisTrack || !isLoaded || duration <= 0) return;

    const targetTime = (progress / 100) * duration;

    // Only seek on significant progress changes (every ~5%)
    if (Math.floor(progress / 5) !== Math.floor((progress - 1) / 5)) {
      iframeRef.current.contentWindow?.postMessage(
        JSON.stringify({
          event: 'command',
          func: 'seekTo',
          args: [targetTime, true]
        }),
        '*'
      );
    }
  }, [progress, duration, isThisTrack, isLoaded]);

  // Handle iframe load
  const handleIframeLoad = () => {
    setIsLoaded(true);
    onVideoReady?.();
    console.log(`[VideoSnippet] ✅ YouTube iframe loaded for ${youtubeId}`);
  };

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      {/* Fallback thumbnail (shows while iframe loads) */}
      {fallbackThumbnail && (
        <motion.img
          src={fallbackThumbnail}
          alt="Track thumbnail"
          className="absolute inset-0 w-full h-full object-cover"
          animate={{
            scale: isPlaying && isThisTrack ? [1, 1.02, 1] : 1,
            opacity: isLoaded ? 0 : 1,
          }}
          transition={{
            scale: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
            opacity: { duration: 0.5 },
          }}
        />
      )}

      {/* YouTube iframe - FULL SCREEN video fill with cinematic treatment */}
      {showIframe && (
        <motion.div
          className="absolute inset-0 overflow-hidden"
          initial={{ opacity: 0, scale: treatment.scale[0], y: treatment.translateY[0] }}
          animate={{
            opacity: isLoaded ? 1 : 0,
            scale: isPlaying && isThisTrack ? treatment.scale : treatment.scale[0],
            y: isPlaying && isThisTrack ? treatment.translateY : treatment.translateY[0],
          }}
          transition={{
            opacity: { duration: 0.5 },
            scale: { duration: treatment.duration, ease: 'easeInOut' },
            y: { duration: treatment.duration, ease: 'easeInOut' },
          }}
        >
          {/*
            Full screen video container
            16:9 video filling 9:16 portrait = need ~3.16x width scale
            Using fixed viewport units for true full screen
          */}
          <iframe
            ref={iframeRef}
            src={embedUrl}
            className="pointer-events-none"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen={false}
            onLoad={handleIframeLoad}
            style={{
              border: 'none',
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              // 16:9 video needs to be scaled to fill 9:16 portrait
              // Width = height * (16/9) to maintain aspect while filling height
              width: '177.78vh', // 100vh * (16/9)
              height: '100vh',
              minWidth: '100vw', // Ensure it's at least full width too
              minHeight: '56.25vw', // 100vw * (9/16) - fallback for landscape
            }}
          />
        </motion.div>
      )}

      {/* Loading indicator */}
      {isActive && showIframe && !isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            className="w-12 h-12 rounded-full border-3 border-purple-500/30 border-t-purple-500"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
        </div>
      )}

      {/* Video indicator badge */}
      {isLoaded && isActive && (
        <motion.div
          className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/70 backdrop-blur-sm"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Film className="w-3 h-3 text-purple-400" />
          <span className="text-white/90 text-xs font-medium">Video</span>
          {isPlaying && isThisTrack && (
            <motion.div
              className="w-2 h-2 rounded-full bg-green-500"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
          )}
        </motion.div>
      )}

      {/* Play button overlay when paused */}
      {isLoaded && isActive && !isPlaying && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center bg-black/30"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.div
            className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <Play className="w-10 h-10 text-white ml-1" style={{ fill: 'white' }} />
          </motion.div>
        </motion.div>
      )}
    </div>
  );
};

export default VideoSnippet;
