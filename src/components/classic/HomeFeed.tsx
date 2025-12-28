/**
 * VOYO Music - Classic Mode: Home Feed (Spotify-Style Shelves)
 *
 * Features:
 * - Horizontal scrollable shelves (Continue Listening, Heavy Rotation, Made For You, etc.)
 * - Time-based greeting
 * - Personalized recommendations based on user preferences
 * - Mobile-first, touch-friendly design
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Bell, Play, RefreshCw } from 'lucide-react';
import { getThumb } from '../../utils/thumbnail';
import { SmartImage } from '../ui/SmartImage';
import { TRACKS, VIBES, getHotTracks, Vibe } from '../../data/tracks';
import { LottieIcon } from '../ui/LottieIcon';
import { getUserTopTracks, getPoolAwareHotTracks } from '../../services/personalization';
import { usePlayerStore } from '../../store/playerStore';
import { useTrackPoolStore } from '../../store/trackPoolStore';
import { Track } from '../../types';
import {
  getCurations,
  SectionCurations,
  invalidateCurationCache
} from '../../services/sectionCurator';
import { TiviPlusCrossPromo } from '../voyo/TiviPlusCrossPromo';

// ============================================
// HELPER FUNCTIONS
// ============================================

const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

const getNewReleases = (limit: number = 15): Track[] => {
  return [...TRACKS]
    .sort((a, b) => {
      const dateA = new Date(a.createdAt || '2024-01-01').getTime();
      const dateB = new Date(b.createdAt || '2024-01-01').getTime();
      return dateB - dateA;
    })
    .slice(0, limit);
};

const getArtistsYouLove = (history: any[], limit: number = 8): { name: string; tracks: Track[]; playCount: number }[] => {
  const artistPlays: Record<string, { tracks: Set<string>; count: number }> = {};
  history.forEach(item => {
    if (item.track?.artist) {
      const artist = item.track.artist;
      if (!artistPlays[artist]) {
        artistPlays[artist] = { tracks: new Set(), count: 0 };
      }
      artistPlays[artist].tracks.add(item.track.id);
      artistPlays[artist].count++;
    }
  });
  return Object.entries(artistPlays)
    .map(([name, data]) => ({
      name,
      playCount: data.count,
      tracks: TRACKS.filter(t => t.artist === name).slice(0, 5),
    }))
    .filter(a => a.tracks.length > 0)
    .sort((a, b) => b.playCount - a.playCount)
    .slice(0, limit);
};

const getTrendingTracks = (hotPool: any[], limit: number = 15): Track[] => {
  return [...hotPool]
    .sort((a, b) => b.poolScore - a.poolScore)
    .slice(0, limit) as Track[];
};

const getRecentlyPlayed = (history: any[], limit: number = 10): Track[] => {
  const seen = new Set<string>();
  const uniqueTracks: Track[] = [];
  for (let i = history.length - 1; i >= 0; i--) {
    const item = history[i];
    if (item.track && !seen.has(item.track.id)) {
      seen.add(item.track.id);
      uniqueTracks.push(item.track);
      if (uniqueTracks.length >= limit) break;
    }
  }
  return uniqueTracks;
};

// ============================================
// SHELF COMPONENT
// ============================================

interface ShelfProps {
  title: string;
  onSeeAll?: () => void;
  children: React.ReactNode;
}

const Shelf = ({ title, onSeeAll, children }: ShelfProps) => (
  <div className="mb-10">
    <div className="flex justify-between items-center px-4 mb-5">
      <h2 className="text-white font-semibold text-base">{title}</h2>
      {onSeeAll && (
        <motion.button
          className="text-purple-400 text-sm font-medium"
          onClick={onSeeAll}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          See all
        </motion.button>
      )}
    </div>
    <div
      className="flex gap-4 px-4 overflow-x-auto scrollbar-hide"
      style={{ scrollSnapType: 'x proximity', WebkitOverflowScrolling: 'touch' }}
    >
      {children}
    </div>
  </div>
);

// ============================================
// CENTER-FOCUSED CAROUSEL - For New Releases
// Center card big, sides smaller (like Landscape player selector)
// ============================================

interface CenterCarouselProps {
  tracks: Track[];
  onPlay: (track: Track) => void;
}

// Scattered VOYO text for left end - arrow pattern (clean, no dot)
const VoyoScatter = () => (
  <div className="relative w-16 h-20">
    {['VOYO', 'VOYO', 'VOYO'].map((text, i) => (
      <motion.span
        key={i}
        className="absolute text-[8px] font-black tracking-wider"
        style={{
          background: 'linear-gradient(135deg, #a855f7, #ec4899)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          color: 'transparent',
          top: `${15 + i * 25}%`,
          left: `${10 + (i % 2) * 20}%`,
          transform: `rotate(${-15 + i * 15}deg)`,
        }}
        animate={{
          opacity: [0.3, 0.8, 0.3],
          scale: [0.9, 1.1, 0.9],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          delay: i * 0.3,
          ease: 'easeInOut',
        }}
      >
        {text}
      </motion.span>
    ))}
  </div>
);

// Smooth pulsing circle while scrolling
const PulsingCircle = () => (
  <motion.div
    className="w-4 h-4 rounded-full"
    style={{
      background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.8), rgba(236, 72, 153, 0.7))',
      boxShadow: '0 0 12px rgba(168, 85, 247, 0.4)',
    }}
    animate={{
      scale: [1, 1.3, 1],
      opacity: [0.5, 1, 0.5],
    }}
    transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
  />
);

const CenterFocusedCarousel = ({ tracks, onPlay }: CenterCarouselProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [centerIndex, setCenterIndex] = useState(1);
  const [scrollState, setScrollState] = useState<'left-end' | 'scrolling' | 'right-end'>('scrolling');

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;
    const { scrollLeft, scrollWidth, clientWidth } = container;
    const cardWidth = 140;
    const newIndex = Math.round(scrollLeft / cardWidth);
    setCenterIndex(Math.min(Math.max(newIndex + 1, 0), tracks.length - 1));

    // Determine scroll position state
    const maxScroll = scrollWidth - clientWidth;
    if (scrollLeft < 50) {
      setScrollState('left-end');
    } else if (scrollLeft > maxScroll - 50) {
      setScrollState('right-end');
    } else {
      setScrollState('scrolling');
    }
  };

  return (
    <div className="relative">
      {/* LEFT END: Scattered VOYO text */}
      <AnimatePresence>
        {scrollState === 'left-end' && (
          <motion.div
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 pointer-events-none"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.3 }}
          >
            <VoyoScatter />
          </motion.div>
        )}
      </AnimatePresence>

      {/* WHILE SCROLLING: Smooth pulsing circle */}
      <AnimatePresence>
        {scrollState === 'scrolling' && (
          <motion.div
            className="absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.2 }}
          >
            <PulsingCircle />
          </motion.div>
        )}
      </AnimatePresence>

      {/* RIGHT END: "New drops coming soon" */}
      <AnimatePresence>
        {scrollState === 'right-end' && (
          <motion.div
            className="absolute right-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.3 }}
          >
            <motion.p
              className="text-[10px] text-purple-400/60 font-medium whitespace-nowrap"
              animate={{ opacity: [0.4, 0.8, 0.4] }}
              transition={{ duration: 2.5, repeat: Infinity }}
            >
              New drops coming soon
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scrollbar-hide py-2"
        style={{
          scrollSnapType: 'x mandatory',
          paddingLeft: 'calc(50% - 70px)', // Center first card
          paddingRight: 'calc(50% - 70px)',
        }}
        onScroll={handleScroll}
      >
        {tracks.map((track, index) => {
          const isCenter = index === centerIndex;
          const distance = Math.abs(index - centerIndex);
          const scale = isCenter ? 1 : Math.max(0.75, 1 - distance * 0.15);
          const opacity = isCenter ? 1 : Math.max(0.5, 1 - distance * 0.25);

          return (
            <motion.button
              key={track.id}
              className="flex-shrink-0"
              onClick={() => onPlay(track)}
              style={{
                scrollSnapAlign: 'center',
                width: 130,
              }}
              animate={{
                scale,
                opacity,
              }}
              transition={{ duration: 0.2 }}
              whileTap={{ scale: scale * 0.95 }}
            >
              <div
                className="relative rounded-xl overflow-hidden mb-2 bg-white/5"
                style={{
                  width: 130,
                  height: 130,
                  boxShadow: isCenter ? '0 8px 30px rgba(139, 92, 246, 0.3)' : '0 4px 15px rgba(0,0,0,0.3)',
                }}
              >
                <SmartImage
                  src={getThumb(track.trackId)}
                  alt={track.title}
                  className="w-full h-full object-cover"
                  trackId={track.trackId}
                  artist={track.artist}
                  title={track.title}
                />
                {isCenter && (
                  <motion.div
                    className="absolute inset-0 flex items-center justify-center bg-black/30"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <div className="w-12 h-12 rounded-full bg-purple-500/90 flex items-center justify-center">
                      <Play className="w-6 h-6 text-white ml-1" fill="white" />
                    </div>
                  </motion.div>
                )}
                {/* Glow ring for center */}
                {isCenter && (
                  <div className="absolute inset-0 rounded-xl ring-2 ring-purple-500/50" />
                )}
              </div>
              <p className={`text-sm font-medium truncate ${isCenter ? 'text-white' : 'text-white/60'}`}>
                {track.title}
              </p>
              <p className={`text-xs truncate ${isCenter ? 'text-white/70' : 'text-white/40'}`}>
                {track.artist}
              </p>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

// ============================================
// TRACK CARD COMPONENT
// ============================================

interface TrackCardProps {
  track: Track;
  onPlay: () => void;
}

const TrackCard = ({ track, onPlay }: TrackCardProps) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.button
      className="flex-shrink-0 w-32"
      onClick={onPlay}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      style={{ scrollSnapAlign: 'start' }}
    >
      <div className="relative w-32 h-32 rounded-xl overflow-hidden mb-2 bg-white/5">
        <SmartImage
          src={getThumb(track.trackId)}
          alt={track.title}
          className="w-full h-full object-cover"
          trackId={track.trackId}
          artist={track.artist}
          title={track.title}
        />
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(135deg, rgba(168,85,247,0.12) 0%, rgba(236,72,153,0.08) 100%)',
          }}
          animate={{ opacity: isHovered ? 0 : 1 }}
          transition={{ duration: 0.2 }}
        />
        {isHovered && (
          <motion.div
            className="absolute inset-0 bg-black/40 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="w-12 h-12 rounded-full bg-purple-500 flex items-center justify-center">
              <Play className="w-6 h-6 text-white ml-1" fill="white" />
            </div>
          </motion.div>
        )}
      </div>
      <p className="text-white text-sm font-medium truncate">{track.title}</p>
      <p className="text-white/50 text-[11px] truncate">{track.artist}</p>
    </motion.button>
  );
};

// ============================================
// WIDE TRACK CARD - 16:9 for Continue Listening
// ============================================

const WideTrackCard = ({ track, onPlay }: TrackCardProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const youtubeId = useMemo(() => decodeVoyoId(track.trackId), [track.trackId]);
  const thumbnailUrl = `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`;

  return (
    <motion.button
      className="flex-shrink-0"
      onClick={onPlay}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      style={{ scrollSnapAlign: 'start', width: '180px' }}
    >
      <div className="relative w-full rounded-xl overflow-hidden mb-2 bg-white/5" style={{ aspectRatio: '16/9' }}>
        <SmartImage
          src={thumbnailUrl}
          alt={track.title}
          className="w-full h-full object-cover"
          trackId={track.trackId}
          artist={track.artist}
          title={track.title}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        {isHovered && (
          <motion.div
            className="absolute inset-0 bg-black/30 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="w-10 h-10 rounded-full bg-purple-500/90 flex items-center justify-center">
              <Play className="w-5 h-5 text-white ml-0.5" fill="white" />
            </div>
          </motion.div>
        )}
        <div className="absolute bottom-0 left-0 right-0 p-2">
          <p className="text-white text-xs font-semibold truncate drop-shadow-lg">{track.title}</p>
        </div>
      </div>
      <p className="text-white/60 text-[11px] truncate">{track.artist}</p>
    </motion.button>
  );
};

// ============================================
// ARTIST CARD COMPONENT
// ============================================

interface ArtistCardProps {
  artist: { name: string; tracks: Track[]; playCount: number };
  onPlay: (track: Track) => void;
}

const ArtistCard = ({ artist, onPlay }: ArtistCardProps) => {
  const firstTrack = artist.tracks[0];

  return (
    <motion.button
      className="flex-shrink-0 w-28"
      onClick={() => firstTrack && onPlay(firstTrack)}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.95 }}
      style={{ scrollSnapAlign: 'start' }}
    >
      <div className="relative w-20 h-20 rounded-full overflow-hidden mb-3 bg-white/5 mx-auto shadow-lg shadow-black/30">
        {firstTrack && (
          <SmartImage
            src={getThumb(firstTrack.trackId)}
            alt={artist.name}
            className="w-full h-full object-cover"
            style={{ objectPosition: 'center 35%', transform: 'scale(1.4)' }}
            trackId={firstTrack.trackId}
            artist={artist.name}
            title={firstTrack.title}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded-full bg-purple-500/80 text-[8px] text-white font-medium">
          {artist.playCount}
        </div>
      </div>
      <p className="text-white text-xs font-medium truncate text-center">{artist.name}</p>
      <p className="text-white/40 text-[10px] truncate text-center">{artist.tracks.length} tracks</p>
    </motion.button>
  );
};

// ============================================
// AFRICAN VIBES VIDEO CARD - With golden glow & video
// ============================================

// Decode VOYO ID to YouTube ID
const decodeVoyoId = (trackId: string): string => {
  if (!trackId.startsWith('vyo_')) return trackId;
  const encoded = trackId.substring(4);
  let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) base64 += '=';
  try {
    return atob(base64);
  } catch {
    return trackId;
  }
};

const AfricanVibesVideoCard = ({
  track,
  idx,
  isActive,
  isMuted,
  onToggleMute,
  onTrackPlay
}: {
  track: Track;
  idx: number;
  isActive: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
  onTrackPlay: () => void;
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Decode VOYO ID to real YouTube ID
  const youtubeId = useMemo(() => decodeVoyoId(track.trackId), [track.trackId]);

  const embedUrl = useMemo(() => {
    const params = new URLSearchParams({
      autoplay: '0',
      mute: '1',
      controls: '0',
      disablekb: '1',
      fs: '0',
      iv_load_policy: '3',
      modestbranding: '1',
      playsinline: '1',
      rel: '0',
      showinfo: '0',
      enablejsapi: '1',
      origin: window.location.origin,
    });
    return `https://www.youtube.com/embed/${youtubeId}?${params.toString()}`;
  }, [youtubeId]);

  useEffect(() => {
    if (!iframeRef.current || !isLoaded) return;
    const cmd = isActive ? 'playVideo' : 'pauseVideo';
    iframeRef.current.contentWindow?.postMessage(
      `{"event":"command","func":"${cmd}","args":""}`, '*'
    );
  }, [isActive, isLoaded]);

  useEffect(() => {
    if (!iframeRef.current || !isLoaded || !isActive) return;
    const cmd = isMuted ? 'mute' : 'unMute';
    iframeRef.current.contentWindow?.postMessage(
      `{"event":"command","func":"${cmd}","args":""}`, '*'
    );
  }, [isMuted, isActive, isLoaded]);

  return (
    <motion.button
      className="flex-shrink-0 relative rounded-xl"
      style={{ width: '95px', height: '142px' }}
      onClick={onTrackPlay}
      whileHover={{ scale: 1.04, y: -3 }}
      whileTap={{ scale: 0.97 }}
    >
      {/* Golden glow - stronger for hero (idx 0) */}
      <div
        className="absolute -inset-1 rounded-xl pointer-events-none"
        style={{
          background: idx === 0
            ? 'linear-gradient(135deg, rgba(251, 191, 36, 0.4) 0%, rgba(251, 191, 36, 0.15) 20%, transparent 50%)'
            : 'linear-gradient(135deg, rgba(251, 191, 36, 0.2) 0%, rgba(251, 191, 36, 0.08) 15%, transparent 40%)',
          filter: 'blur(8px)',
        }}
      />

      <div className="relative w-full h-full rounded-xl overflow-hidden bg-black">
        {/* Thumbnail */}
        <img
          src={`https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`}
          alt={track.title}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ transform: 'scale(1.8)' }}
        />

        {/* Video iframe */}
        <div
          className="absolute inset-0 transition-opacity duration-300"
          style={{ opacity: isActive && isLoaded ? 1 : 0 }}
        >
          <iframe
            ref={iframeRef}
            src={embedUrl}
            className="pointer-events-none"
            style={{
              border: 'none',
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '300%',
              height: '300%',
            }}
            allow="accelerometer; autoplay; encrypted-media"
            onLoad={() => setIsLoaded(true)}
          />
        </div>

        {/* Purple overlay */}
        <div
          className="absolute inset-0 pointer-events-none z-10"
          style={{
            background: 'linear-gradient(180deg, rgba(139, 92, 246, 0.15) 0%, rgba(139, 92, 246, 0.08) 40%, rgba(0,0,0,0.75) 100%)'
          }}
        />

        {/* Genre pill */}
        <div className="absolute top-1.5 left-1.5 z-20">
          <span className="px-1.5 py-0.5 rounded text-[6px] font-bold uppercase bg-purple-600/50 text-white/80">
            {track.tags?.[0] || 'Afrobeats'}
          </span>
        </div>

        {/* Sound toggle */}
        {isActive && isLoaded && (
          <button
            className="absolute top-1.5 right-1.5 z-30 w-5 h-5 rounded-full bg-black/40 flex items-center justify-center"
            onClick={(e) => { e.stopPropagation(); onToggleMute(); }}
          >
            {isMuted ? (
              <svg className="w-2.5 h-2.5 text-white/60" fill="currentColor" viewBox="0 0 24 24">
                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
              </svg>
            ) : (
              <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
              </svg>
            )}
          </button>
        )}

        {/* Blinking recording dot */}
        {isActive && isLoaded && (
          <motion.div
            className="absolute top-7 right-2 z-20 w-1.5 h-1.5 rounded-full bg-red-500"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          />
        )}

        {/* Track info */}
        <div className="absolute bottom-0 left-0 right-0 p-1.5 z-20">
          <p className="text-white text-[9px] font-bold truncate">{track.title}</p>
          <p className="text-white/60 text-[7px] truncate">{track.artist}</p>
          <div className="flex items-center gap-0.5 mt-0.5">
            <span className="text-[7px]">🔥</span>
            <span className="text-[6px] font-bold text-amber-400">
              {track.oyeScore ? (track.oyeScore / 1000).toFixed(0) + 'K' : 'Hot'}
            </span>
          </div>
        </div>
      </div>
    </motion.button>
  );
};

// ============================================
// AFRICAN VIBES CAROUSEL
// ============================================

const AfricanVibesCarousel = ({ tracks, onTrackPlay }: { tracks: Track[]; onTrackPlay: (track: Track) => void }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeIdx, setActiveIdx] = useState<number>(0);
  const [isMuted, setIsMuted] = useState(true);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setIsInView(entry.isIntersecting),
      { threshold: 0.5 }
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex gap-4 overflow-x-auto scrollbar-hide py-3 pr-4"
      style={{ paddingLeft: '28px' }}
      onMouseLeave={() => setActiveIdx(0)}
    >
      {tracks.slice(0, 6).map((track, idx) => (
        <div key={track.id} onMouseEnter={() => setActiveIdx(idx)}>
          <AfricanVibesVideoCard
            track={track}
            idx={idx}
            isActive={isInView && activeIdx === idx}
            isMuted={isMuted}
            onToggleMute={() => setIsMuted(!isMuted)}
            onTrackPlay={() => onTrackPlay(track)}
          />
        </div>
      ))}
    </div>
  );
};

// ============================================
// VIBE CARD COMPONENT
// ============================================

interface VibeCardProps {
  vibe: Vibe;
  onSelect: () => void;
  index: number;
}

const VibeCard = ({ vibe, onSelect, index }: VibeCardProps) => (
  <motion.button
    className="flex-shrink-0 relative group"
    onClick={onSelect}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.08, duration: 0.4 }}
    whileHover={{ y: -6, scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
    style={{ width: '120px' }}
  >
    <motion.div
      className="absolute -inset-[3px] rounded-[24px]"
      style={{
        background: `conic-gradient(from 0deg, ${vibe.color}, ${vibe.color}44, ${vibe.color})`,
        filter: 'blur(8px)',
      }}
      animate={{ rotate: [0, 360], opacity: [0.4, 0.6, 0.4] }}
      transition={{
        rotate: { duration: 10, repeat: Infinity, ease: 'linear' },
        opacity: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
      }}
    />
    <div
      className="relative rounded-[22px] overflow-hidden"
      style={{
        aspectRatio: '0.9',
        background: `linear-gradient(135deg, ${vibe.color} 0%, ${vibe.color}dd 50%, ${vibe.color}bb 100%)`,
        boxShadow: `0 6px 24px ${vibe.color}50`,
      }}
    >
      <div className="absolute inset-0 opacity-[0.15]" style={{
        backgroundImage: `radial-gradient(circle at 50% 50%, rgba(255,255,255,0.6) 0.5px, transparent 1px)`,
        backgroundSize: '6px 6px',
      }} />
      <div className="absolute inset-0" style={{
        background: 'linear-gradient(130deg, rgba(255,255,255,0.3) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.15) 100%)',
      }} />
      <div className="relative h-full flex flex-col items-center justify-center p-3">
        <div className="mb-2 drop-shadow-lg text-4xl flex items-center justify-center">
          {vibe.id === 'afro-heat' && <LottieIcon lottieUrl="/lottie/fire.json" fallbackEmoji="🔥" size={48} loop={true} />}
          {vibe.id === 'chill-vibes' && <motion.div animate={{ scale: [1, 1.12, 1], opacity: [0.6, 1, 0.6] }} transition={{ duration: 3, repeat: Infinity }}>💜</motion.div>}
          {vibe.id === 'party-mode' && <LottieIcon lottieUrl={vibe.lottie} fallbackEmoji="🪩" size={44} />}
          {vibe.id === 'late-night' && <LottieIcon lottieUrl="/lottie/night-clear.json" fallbackEmoji="🌙" size={48} loop={true} speed={0.6} />}
          {vibe.id === 'workout' && <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>⚡</motion.div>}
        </div>
        <h3 className="text-white font-black text-xs tracking-wide text-center drop-shadow-md">{vibe.name}</h3>
        <p className="text-white/80 text-[9px] mt-1 text-center font-medium">{vibe.description}</p>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-[3px]" style={{
        background: 'linear-gradient(90deg, transparent 5%, rgba(255,255,255,0.5) 50%, transparent 95%)',
      }} />
    </div>
  </motion.button>
);

// ============================================
// HOME FEED COMPONENT
// ============================================

interface HomeFeedProps {
  onTrackPlay: (track: Track) => void;
  onSearch: () => void;
  onDahub: () => void;
  onNavVisibilityChange?: (visible: boolean) => void;
}

export const HomeFeed = ({ onTrackPlay, onSearch, onDahub, onNavVisibilityChange }: HomeFeedProps) => {
  const { history, hotTracks, discoverTracks, refreshRecommendations } = usePlayerStore();
  const { hotPool } = useTrackPoolStore();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingCurations, setIsLoadingCurations] = useState(false);
  const [curations, setCurations] = useState<SectionCurations | null>(null);

  // Ref for TIVI+ immersive section (nav hides when in view)
  const tiviBreakRef = useRef<HTMLDivElement>(null);

  // Track when TIVI+ "Take a Break" section is in view
  useEffect(() => {
    if (!onNavVisibilityChange) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const isInView = entries[0]?.isIntersecting ?? false;
        onNavVisibilityChange(!isInView); // Hide nav when TIVI+ banner is in view
      },
      { threshold: 0, rootMargin: '0px 0px -300px 0px' } // Trigger extra early
    );

    if (tiviBreakRef.current) observer.observe(tiviBreakRef.current);

    return () => observer.disconnect();
  }, [onNavVisibilityChange]);

  useEffect(() => {
    refreshRecommendations();
  }, [hotPool.length, refreshRecommendations]);

  // Load LLM-curated sections
  useEffect(() => {
    const loadCurations = async () => {
      setIsLoadingCurations(true);
      try {
        const result = await getCurations();
        setCurations(result);
        console.log('[HomeFeed] Curations loaded:', {
          madeForYou: result.madeForYou.length,
          discoverMore: result.discoverMore.length,
          allTimeClassics: result.allTimeClassics.length,
          westAfricanHits: result.westAfricanHits.length,
          newReleases: result.newReleases.length,
        });
      } catch (error) {
        console.error('[HomeFeed] Failed to load curations:', error);
      } finally {
        setIsLoadingCurations(false);
      }
    };

    loadCurations();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    refreshRecommendations();
    invalidateCurationCache();
    // Reload curations
    getCurations().then(setCurations).catch(console.error);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // TIER 1 - Pure Local (no API calls)
  const recentlyPlayed = useMemo(() => getRecentlyPlayed(history, 15), [history]);
  const heavyRotation = useMemo(() => getUserTopTracks(15), [history]);
  const artistsYouLove = useMemo(() => getArtistsYouLove(history, 8), [history]);
  const vibes = VIBES;

  // TIER 2 & 3 - LLM Curated (from sectionCurator)
  // Falls back to local pool if curations not loaded yet
  const madeForYou = curations?.madeForYou.length ? curations.madeForYou : (hotTracks.length > 0 ? hotTracks : getPoolAwareHotTracks(15));
  const discoverMoreTracks = curations?.discoverMore.length ? curations.discoverMore : discoverTracks;
  const allTimeClassics = curations?.allTimeClassics || [];
  const westAfricanHits = curations?.westAfricanHits || [];
  const africanVibes = curations?.africanVibes.length ? curations.africanVibes : getPoolAwareHotTracks(15);
  const newReleases = curations?.newReleases.length ? curations.newReleases : getNewReleases(15);
  const trending = curations?.topOnVoyo.length ? curations.topOnVoyo : getTrendingTracks(hotPool, 15);

  const greeting = getGreeting();

  const handleVibeSelect = (vibe: Vibe) => {
    const { hotPool } = useTrackPoolStore.getState();
    const matchingTracks = hotPool
      .filter(t => t.detectedMode === vibe.id)
      .sort((a, b) => b.poolScore - a.poolScore)
      .slice(0, 10);
    if (matchingTracks.length > 0) {
      onTrackPlay(matchingTracks[0]);
      const { addToQueue } = usePlayerStore.getState();
      matchingTracks.slice(1).forEach(track => addToQueue(track));
    } else {
      const fallback = getPoolAwareHotTracks(10);
      if (fallback.length > 0) onTrackPlay(fallback[0]);
    }
  };

  const hasHistory = recentlyPlayed.length > 0;
  const hasPreferences = heavyRotation.length > 0;
  const hasArtists = artistsYouLove.length > 0;
  const hasTrending = trending.length > 0;
  const hasAllTimeClassics = allTimeClassics.length > 0;
  const hasWestAfricanHits = westAfricanHits.length > 0;
  const hasDiscoverMore = discoverMoreTracks.length > 0;

  return (
    <div className="flex flex-col h-full overflow-y-auto pb-52 scrollbar-hide">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 sticky top-0 bg-[#0a0a0f]/95 backdrop-blur-lg z-10">
        <motion.button
          className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold"
          onClick={onDahub}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          D
        </motion.button>
        <div className="flex items-center gap-2">
          <motion.button className="p-2 rounded-full bg-white/10 hover:bg-white/20" onClick={onSearch} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
            <Search className="w-5 h-5 text-white/70" />
          </motion.button>
          <motion.button className="p-2 rounded-full bg-white/10 hover:bg-white/20 relative" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
            <Bell className="w-5 h-5 text-white/70" />
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
          </motion.button>
        </div>
      </header>

      {/* Greeting */}
      <div className="px-4 pt-4 pb-6">
        <h1 className="text-2xl font-bold text-white">{greeting}, Dash</h1>
      </div>

      {/* Continue Listening */}
      {hasHistory && (
        <Shelf title="Continue Listening">
          {recentlyPlayed.map((track) => (
            <WideTrackCard key={track.id} track={track} onPlay={() => onTrackPlay(track)} />
          ))}
        </Shelf>
      )}

      {/* Heavy Rotation - circles, only first one rotates gently */}
      {hasPreferences && (
        <div className="mb-10">
          <div className="px-4 mb-4">
            <h2 className="text-white font-semibold text-base">Heavy Rotation</h2>
          </div>
          <div className="flex gap-5 px-4 overflow-x-auto scrollbar-hide">
            {heavyRotation.map((track, index) => {
              const isFirst = index === 0;
              return (
                <motion.button
                  key={track.id}
                  className="flex-shrink-0 w-32"
                  onClick={() => onTrackPlay(track)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <motion.div
                    className="relative w-32 h-32 rounded-full overflow-hidden mb-2 bg-white/5 mx-auto shadow-lg shadow-black/40"
                    animate={isFirst ? { rotate: 360 } : undefined}
                    transition={isFirst ? {
                      duration: 60,
                      repeat: Infinity,
                      ease: 'linear',
                    } : undefined}
                  >
                    <img
                      src={`https://i.ytimg.com/vi/${track.trackId}/hqdefault.jpg`}
                      alt={track.title}
                      className="w-full h-full object-cover"
                      style={{ objectPosition: 'center 35%', transform: 'scale(1.3)' }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                  </motion.div>
                  <p className="text-white text-sm font-medium truncate text-center mt-1">{track.title.split('|')[0].trim()}</p>
                  <p className="text-white/50 text-xs truncate text-center">{track.artist}</p>
                </motion.button>
              );
            })}
          </div>
        </div>
      )}

      {/* 🌍 African Vibes - cultural pillar, holds its ground */}
      <div className="mb-6">
        <div className="px-4 mb-5 flex items-center gap-2">
          <span className="text-xl">🌍</span>
          <div className="flex-1">
            <h2 className="text-white font-semibold text-base">African Vibes</h2>
            <p
              className="text-[9px] font-medium tracking-wider uppercase"
              style={{
                background: 'linear-gradient(90deg, #fbbf24 0%, #ea580c 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                opacity: 0.85
              }}
            >
              From Lagos to Johannesburg
            </p>
          </div>
          <motion.button
            className="px-3 py-1.5 rounded-full text-[10px] font-semibold text-amber-400 bg-transparent border border-amber-500/40"
            onClick={() => usePlayerStore.getState().setVoyoTab('feed')}
            whileHover={{ scale: 1.05, boxShadow: '0 0 20px rgba(251, 191, 36, 0.3)', borderColor: 'rgba(251, 191, 36, 0.6)' }}
            whileTap={{ scale: 0.95 }}
          >
            Watch More →
          </motion.button>
        </div>
        <div className="relative">
          {/* TRENDING - Contour style */}
          <div className="absolute left-1 top-0 bottom-0 flex items-center pointer-events-none" style={{ width: '24px' }}>
            <span
              className="text-[9px] font-black tracking-wider"
              style={{
                writingMode: 'vertical-rl',
                transform: 'rotate(180deg)',
                letterSpacing: '0.15em',
                color: 'transparent',
                WebkitTextStroke: '0.5px rgba(251, 191, 36, 0.7)',
                textShadow: '0 0 8px rgba(251, 191, 36, 0.15)'
              }}
            >
              TRENDING
            </span>
          </div>
          <AfricanVibesCarousel tracks={africanVibes.slice(0, 8)} onTrackPlay={onTrackPlay} />
        </div>
      </div>

      {/* Made For You - bold, sits on cards, no hesitation */}
      <div className="mb-10">
        <div className="flex justify-between items-center px-4 mb-1.5">
          <h2 className="text-white font-semibold text-base">Made For You</h2>
          <motion.button
            className="p-2 rounded-full bg-white/10 hover:bg-white/20"
            onClick={handleRefresh}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            animate={isRefreshing ? { rotate: 360 } : {}}
            transition={{ duration: 0.5 }}
          >
            <RefreshCw className={`w-4 h-4 text-purple-400 ${isRefreshing ? 'animate-spin' : ''}`} />
          </motion.button>
        </div>
        <div className="flex gap-3 px-4 overflow-x-auto scrollbar-hide">
          {madeForYou.map((track) => (
            <TrackCard key={track.id} track={track} onPlay={() => onTrackPlay(track)} />
          ))}
        </div>
      </div>

      {/* Artists You Love - individuality with breathing room */}
      {hasArtists && (
        <div className="mb-10">
          <div className="px-4 mb-5">
            <h2 className="text-white font-semibold text-base">Artists You Love</h2>
          </div>
          <div className="flex gap-6 px-4 overflow-x-auto scrollbar-hide">
            {artistsYouLove.map((artist) => (
              <ArtistCard key={artist.name} artist={artist} onPlay={onTrackPlay} />
            ))}
          </div>
        </div>
      )}

      {/* Discover More - LLM curated expansion beyond comfort zone */}
      {hasDiscoverMore && (
        <Shelf title="Discover More">
          {discoverMoreTracks.map((track) => (
            <TrackCard key={track.id} track={track} onPlay={() => onTrackPlay(track)} />
          ))}
        </Shelf>
      )}

      {/* 🔥 West African Hits - Regional trending */}
      {hasWestAfricanHits && (
        <div className="mb-10">
          <div className="px-4 mb-4 flex items-center gap-2">
            <span className="text-xl">🔥</span>
            <div className="flex-1">
              <h2 className="text-white font-semibold text-base">West African Hits</h2>
              <p className="text-[9px] font-medium tracking-wider uppercase text-orange-400/70">
                Trending in Nigeria, Ghana & Beyond
              </p>
            </div>
          </div>
          <div className="flex gap-3 px-4 overflow-x-auto scrollbar-hide">
            {westAfricanHits.map((track) => (
              <TrackCard key={track.id} track={track} onPlay={() => onTrackPlay(track)} />
            ))}
          </div>
        </div>
      )}

      {/* 👑 All Time Classics - Legendary tracks from user's genres */}
      {hasAllTimeClassics && (
        <div className="mb-10">
          <div className="px-4 mb-4 flex items-center gap-2">
            <span className="text-xl">👑</span>
            <div className="flex-1">
              <h2 className="text-white font-semibold text-base">All Time Classics</h2>
              <p className="text-[9px] font-medium tracking-wider uppercase text-yellow-400/70">
                Timeless Hits You'll Love
              </p>
            </div>
          </div>
          <div className="flex gap-3 px-4 overflow-x-auto scrollbar-hide">
            {allTimeClassics.map((track) => (
              <TrackCard key={track.id} track={track} onPlay={() => onTrackPlay(track)} />
            ))}
          </div>
        </div>
      )}

      {/* Top 10 on VOYO */}
      {hasTrending && (
        <div className="mb-8 py-8" style={{ background: 'linear-gradient(180deg, rgba(157,78,221,0.12) 0%, rgba(157,78,221,0.03) 50%, transparent 100%)' }}>
          <div className="px-4 mb-6 flex items-center gap-2">
            <span className="text-yellow-400 text-xl">⭐</span>
            <h2 className="text-white font-semibold text-base">Top 10 on VOYO</h2>
          </div>
          <style>{`
            @keyframes top10-marquee {
              0% { transform: translateX(0); }
              100% { transform: translateX(-50%); }
            }
            .top10-scroll-title {
              display: inline-block;
              animation: top10-marquee 6s linear infinite;
            }
          `}</style>
          <div className="flex gap-6 px-4 overflow-x-auto scrollbar-hide" style={{ scrollSnapType: 'x proximity', paddingBottom: '60px' }}>
            {trending.slice(0, 10).map((track, index) => {
              const maxChars = 12;
              const titleNeedsScroll = track.title.length > maxChars;
              const artistNeedsScroll = track.artist.length > maxChars;
              const isPodium = index < 3;
              const numberFill = index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : index === 2 ? '#CD7F32' : 'transparent';
              const numberStroke = index === 0 ? '#B8860B' : index === 1 ? '#808080' : index === 2 ? '#8B4513' : '#9D4EDD';
              const strokeWidth = isPodium ? '2px' : '3px';
              const numberGlow = index === 0 ? '0 0 30px rgba(255, 215, 0, 0.5)' : index === 1 ? '0 0 20px rgba(192, 192, 192, 0.4)' : index === 2 ? '0 0 20px rgba(205, 127, 50, 0.4)' : '0 0 25px rgba(157, 78, 221, 0.5), 3px 3px 0 rgba(0,0,0,0.6)';

              return (
                <motion.button
                  key={track.id}
                  className="flex-shrink-0 flex items-end relative"
                  onClick={() => onTrackPlay(track)}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  style={{ scrollSnapAlign: 'start' }}
                >
                  <div
                    className="font-black select-none self-center"
                    style={{
                      fontSize: index < 9 ? '5.5rem' : '4.5rem',
                      lineHeight: '1',
                      marginRight: '-22px',
                      zIndex: 1,
                      color: numberFill,
                      WebkitTextStroke: `${strokeWidth} ${numberStroke}`,
                      textShadow: numberGlow,
                      fontFamily: 'Arial Black, sans-serif',
                    }}
                  >
                    {index + 1}
                  </div>
                  <div className="relative" style={{ zIndex: 2 }}>
                    <div className="absolute -inset-2 rounded-full opacity-40" style={{
                      background: 'radial-gradient(circle, rgba(157,78,221,0.5) 0%, transparent 70%)',
                      filter: 'blur(8px)',
                    }} />
                    <div className="relative rounded-full overflow-hidden" style={{ width: '85px', height: '85px', boxShadow: '0 4px 20px rgba(0,0,0,0.5), 0 0 20px rgba(157,78,221,0.2)' }}>
                      <SmartImage
                        src={getThumb(track.trackId)}
                        alt={track.title}
                        className="w-full h-full object-cover"
                        style={{ transform: 'scale(1.3)', objectPosition: 'center 35%' }}
                        trackId={track.trackId}
                        artist={track.artist}
                        title={track.title}
                      />
                      <div className="absolute inset-0 rounded-full" style={{
                        background: 'radial-gradient(circle, transparent 28%, rgba(0,0,0,0.3) 48%, transparent 52%, rgba(0,0,0,0.2) 100%)',
                        boxShadow: 'inset 0 0 15px rgba(0,0,0,0.5)',
                      }} />
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0a0a0f]" style={{ width: '10px', height: '10px', boxShadow: '0 0 5px rgba(0,0,0,0.8)' }} />
                    </div>
                  </div>
                  <div className="absolute text-center" style={{ width: '110px', left: '50%', transform: 'translateX(-50%)', bottom: '-52px' }}>
                    <div className="overflow-hidden mx-auto" style={{ width: '100px' }}>
                      <p className={`text-white text-[10px] font-semibold whitespace-nowrap ${titleNeedsScroll ? 'top10-scroll-title' : ''}`}>
                        {titleNeedsScroll ? <>{track.title}<span className="mx-3">•</span>{track.title}<span className="mx-3">•</span></> : track.title}
                      </p>
                    </div>
                    <div className="overflow-hidden mx-auto" style={{ width: '100px' }}>
                      <p className={`text-white/50 text-[9px] whitespace-nowrap ${artistNeedsScroll ? 'top10-scroll-title' : ''}`} style={{ animationDelay: '1s' }}>
                        {artistNeedsScroll ? <>{track.artist}<span className="mx-3">•</span>{track.artist}<span className="mx-3">•</span></> : track.artist}
                      </p>
                    </div>
                    <div className="flex items-center justify-center gap-1 mt-0.5">
                      <span className="text-yellow-400 text-[9px]">⭐</span>
                      <span className="text-yellow-400/80 text-[9px] font-medium">
                        {track.oyeScore ? (track.oyeScore / 1000).toFixed(1) : ((10 - index) * 1.2).toFixed(1)}
                      </span>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      )}

      {/* Vibes - choices, not playlist */}
      <div className="mb-12">
        <div className="px-4 mb-1.5">
          <h2 className="text-white font-semibold text-base">Vibes</h2>
        </div>
        <div className="flex gap-4 px-4 overflow-x-auto scrollbar-hide py-4">
          {vibes.map((vibe, index) => (
            <VibeCard key={vibe.id} vibe={vibe} index={index} onSelect={() => handleVibeSelect(vibe)} />
          ))}
        </div>
      </div>

      {/* TIVI+ Cross-Promo - "Take a Break with Family" */}
      <TiviPlusCrossPromo immersiveRef={tiviBreakRef} />

      {/* New Releases - Center-focused carousel */}
      <div className="mb-12">
        <div className="px-4 mb-5">
          <h2 className="text-white font-semibold text-base">New Releases</h2>
        </div>
        <CenterFocusedCarousel tracks={newReleases} onPlay={onTrackPlay} />
      </div>

      {/* Empty State */}
      {!hasHistory && !hasPreferences && (
        <div className="px-4 py-8 text-center">
          <p className="text-white/50 text-sm mb-4">Start listening to build your personalized collection</p>
          <motion.button
            className="px-6 py-3 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold"
            onClick={() => {
              // Pool-aware: Use dynamic pool if available, fallback to static
              const poolTracks = hotPool.length > 0 ? hotPool : getHotTracks();
              const randomTrack = poolTracks[0];
              if (randomTrack) onTrackPlay(randomTrack);
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Discover Music
          </motion.button>
        </div>
      )}
    </div>
  );
};

export default HomeFeed;
