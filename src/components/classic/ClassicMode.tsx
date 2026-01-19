/**
 * VOYO Music - Classic Mode Container
 * The standard app experience: Home Feed, Library, Now Playing
 *
 * Bottom Navigation:
 * - Home (Home Feed)
 * - VOYO (Switch to VOYO Mode)
 * - Library
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { Home, Radio, Library as LibraryIcon, Users, Zap, Plus, Shuffle, Repeat, Repeat1 } from 'lucide-react';
import { HomeFeed } from './HomeFeed';
import { Library } from './Library';
import { Hub } from './Hub';
import { NowPlaying } from './NowPlaying';
import { usePlayerStore } from '../../store/playerStore';
import { getYouTubeThumbnail } from '../../data/tracks';
import { SmartImage } from '../ui/SmartImage';
import { Track } from '../../types';
import { PlaylistModal } from '../playlist/PlaylistModal';
import { useReactionStore } from '../../store/reactionStore';
import { useAuth } from '../../hooks/useAuth';

type ClassicTab = 'home' | 'hub' | 'library';

interface ClassicModeProps {
  onSwitchToVOYO: () => void;
  onSearch: () => void;
}

// Mini Player (shown at bottom when a track is playing)
// Single tap = floating bubble controls, Double tap = full player, Swipe = next/prev
// VOYO = Music Experience App, not just a player!
const MiniPlayer = ({ onVOYOClick, onOpenFull }: { onVOYOClick: () => void; onOpenFull: () => void }) => {
  const {
    currentTrack, isPlaying, togglePlay, progress, nextTrack, prevTrack,
    shuffleMode, repeatMode, toggleShuffle, cycleRepeat
  } = usePlayerStore();
  const { createReaction } = useReactionStore();
  const { dashId } = useAuth();
  const [shouldScroll, setShouldScroll] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [showBubbles, setShowBubbles] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const titleRef = useRef<HTMLParagraphElement>(null);
  const lastTapRef = useRef<number>(0);

  // Double-tap detection for opening full player
  const handleTap = useCallback(() => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300; // ms

    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      // Double tap → open full player
      onOpenFull();
      lastTapRef.current = 0; // Reset
    } else {
      // Single tap → toggle bubbles (with delay to check for double)
      lastTapRef.current = now;
      setTimeout(() => {
        if (Date.now() - lastTapRef.current >= DOUBLE_TAP_DELAY) {
          setShowBubbles(prev => !prev);
        }
      }, DOUBLE_TAP_DELAY);
    }
  }, [onOpenFull]);

  // Handle OYE reaction
  const handleOye = useCallback(() => {
    if (!currentTrack) return;
    createReaction({
      username: dashId || 'anonymous',
      trackId: currentTrack.trackId || currentTrack.id,
      trackTitle: currentTrack.title,
      trackArtist: currentTrack.artist,
      trackThumbnail: currentTrack.coverUrl,
      category: 'afro-heat',
      emoji: '⚡',
      reactionType: 'oye',
    });
  }, [currentTrack, dashId, createReaction]);

  // Check if title needs scrolling (longer than container)
  useEffect(() => {
    if (titleRef.current) {
      setShouldScroll(titleRef.current.scrollWidth > titleRef.current.clientWidth);
    }
  }, [currentTrack?.title]);

  // Handle swipe gestures
  const handleDragEnd = useCallback((event: any, info: PanInfo) => {
    const threshold = 80;
    if (info.offset.x < -threshold) {
      // Swipe left = next track
      setSwipeDirection('left');
      nextTrack();
      setTimeout(() => setSwipeDirection(null), 300);
    } else if (info.offset.x > threshold) {
      // Swipe right = previous track
      setSwipeDirection('right');
      prevTrack();
      setTimeout(() => setSwipeDirection(null), 300);
    }
  }, [nextTrack, prevTrack]);

  // Auto-hide bubbles after 3 seconds
  useEffect(() => {
    if (showBubbles) {
      const timer = setTimeout(() => setShowBubbles(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showBubbles]);

  if (!currentTrack) return null;

  return (
    <motion.div
      className="absolute bottom-24 left-4 right-4 z-40"
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
    >
      {/* Floating Bubble Controls - appear on tap */}
      <AnimatePresence>
        {showBubbles && (
          <motion.div
            className="absolute -top-16 left-1/2 -translate-x-1/2 flex items-center gap-4 z-50"
            initial={{ opacity: 0, y: 20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          >
            {/* Shuffle Bubble - exits after VOYO */}
            <motion.button
              className={`w-12 h-12 rounded-full backdrop-blur-xl flex items-center justify-center shadow-lg ${
                shuffleMode
                  ? 'bg-purple-500/80 border-2 border-purple-400'
                  : 'bg-black/60 border border-white/20'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                toggleShuffle();
              }}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5, transition: { delay: 0.2 } }}
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
            >
              <Shuffle className={`w-5 h-5 ${shuffleMode ? 'text-white' : 'text-white/70'}`} />
            </motion.button>

            {/* Repeat/Loop Bubble - exits after VOYO */}
            <motion.button
              className={`w-12 h-12 rounded-full backdrop-blur-xl flex items-center justify-center shadow-lg ${
                repeatMode !== 'off'
                  ? 'bg-pink-500/80 border-2 border-pink-400'
                  : 'bg-black/60 border border-white/20'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                cycleRepeat();
              }}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5, transition: { delay: 0.15 } }}
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
            >
              {repeatMode === 'one' ? (
                <Repeat1 className="w-5 h-5 text-white" />
              ) : (
                <Repeat className={`w-5 h-5 ${repeatMode === 'all' ? 'text-white' : 'text-white/70'}`} />
              )}
              {repeatMode !== 'off' && (
                <motion.div
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-pink-400 text-[8px] font-bold text-white flex items-center justify-center"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                >
                  {repeatMode === 'one' ? '1' : '∞'}
                </motion.div>
              )}
            </motion.button>

            {/* VOYO Player Bubble - Video Experience - disappears first so user notices */}
            <motion.button
              className="w-12 h-12 rounded-full backdrop-blur-xl flex items-center justify-center shadow-lg bg-gradient-to-br from-purple-500/80 to-pink-500/80 border-2 border-purple-400"
              onClick={(e) => {
                e.stopPropagation();
                onVOYOClick();
              }}
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5, transition: { delay: 0, duration: 0.15 } }}
              transition={{ delay: 0.1 }}
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
            >
              <Radio className="w-5 h-5 text-white" />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className="w-full flex items-center gap-2.5 p-2 pr-3 rounded-2xl bg-black/25 border border-white/10 backdrop-blur-xl shadow-2xl relative overflow-hidden cursor-pointer"
        onClick={handleTap}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.3}
        onDragEnd={handleDragEnd}
        whileTap={{ scale: 0.98 }}
        animate={{
          x: swipeDirection === 'left' ? -20 : swipeDirection === 'right' ? 20 : 0,
        }}
        transition={{ type: 'spring', damping: 20 }}
      >
        {/* Wave Progress Bar - VOYO gradient style */}
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/10 overflow-hidden rounded-full">
          <motion.div
            className="h-full relative"
            style={{ width: `${progress}%` }}
          >
            {/* VOYO purple-pink gradient fill */}
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500 via-fuchsia-500 to-pink-500" />
            {/* Glowing edge effect */}
            <motion.div
              className="absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-pink-400 to-transparent"
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            />
          </motion.div>
        </div>

        {/* Thumbnail - SmartImage with self-healing */}
        <div className="relative w-12 h-12 rounded-xl overflow-hidden flex-shrink-0">
          <SmartImage
            src={getYouTubeThumbnail(currentTrack.trackId, 'medium')}
            alt={currentTrack.title}
            className="w-full h-full object-cover"
            trackId={currentTrack.trackId}
            artist={currentTrack.artist}
            title={currentTrack.title}
          />
        </div>

        {/* Info with scrolling title */}
        <div className="flex-1 min-w-0 text-left overflow-hidden">
          <div className="overflow-hidden">
            <p
              ref={titleRef}
              className={`text-white font-medium text-sm whitespace-nowrap ${shouldScroll ? 'animate-marquee' : 'truncate'}`}
              style={shouldScroll ? {
                animation: 'marquee 8s linear infinite',
              } : {}}
            >
              {currentTrack.title}
              {shouldScroll && <span className="mx-8">{currentTrack.title}</span>}
            </p>
          </div>
          <p className="text-white/50 text-xs truncate">{currentTrack.artist}</p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-shrink-0" style={{ marginRight: '4px' }}>
          {/* Add to playlist */}
          <motion.button
            className="rounded-full bg-white/10 flex items-center justify-center"
            style={{ width: '30px', height: '30px' }}
            onClick={(e) => {
              e.stopPropagation();
              setShowPlaylistModal(true);
            }}
            whileHover={{ scale: 1.1, backgroundColor: 'rgba(255,255,255,0.2)' }}
            whileTap={{ scale: 0.9 }}
          >
            <Plus className="w-3.5 h-3.5 text-white" />
          </motion.button>

          {/* OYÉ Button - Orange circle with white Zap */}
          <motion.button
            className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center"
            onClick={(e) => {
              e.stopPropagation();
              handleOye();
            }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            style={{ boxShadow: '0 2px 8px rgba(249, 115, 22, 0.4)' }}
          >
            <Zap className="w-4 h-4 text-white" style={{ fill: 'white' }} />
          </motion.button>

          {/* Play/Pause */}
          <motion.button
            className="w-10 h-10 rounded-full bg-white flex items-center justify-center"
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            {isPlaying ? (
              <div className="flex gap-1">
                <div className="w-1 h-4 bg-black rounded-full" />
                <div className="w-1 h-4 bg-black rounded-full" />
              </div>
            ) : (
              <div className="w-0 h-0 border-l-[10px] border-l-black border-y-[6px] border-y-transparent ml-1" />
            )}
          </motion.button>
        </div>
      </motion.div>

      {/* Marquee animation styles */}
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>

      {/* Playlist Modal */}
      {currentTrack && (
        <PlaylistModal
          isOpen={showPlaylistModal}
          onClose={() => setShowPlaylistModal(false)}
          trackId={currentTrack.trackId || currentTrack.id}
          trackTitle={currentTrack.title}
        />
      )}
    </motion.div>
  );
};

// Bottom Navigation - Context-aware: shows nav to OTHER pages, not current
const BottomNav = ({
  activeTab,
  onTabChange,
  onVOYOClick
}: {
  activeTab: ClassicTab;
  onTabChange: (tab: ClassicTab) => void;
  onVOYOClick: () => void;
}) => {
  // Left button: Home when on DAHUB/Library, DAHUB when on Home
  const leftTab = activeTab === 'home' ? 'hub' : 'home';
  const LeftIcon = activeTab === 'home' ? Users : Home;
  const leftLabel = activeTab === 'home' ? 'DAHUB' : 'Home';

  // Right button: Library when on Home/DAHUB, DAHUB when on Library
  const rightTab = activeTab === 'library' ? 'hub' : 'library';
  const RightIcon = activeTab === 'library' ? Users : LibraryIcon;
  const rightLabel = activeTab === 'library' ? 'DAHUB' : 'Library';

  return (
    <nav className="absolute bottom-0 left-0 right-0 z-30 flex items-center justify-around py-3 px-6 bg-[#0a0a0f]/95 backdrop-blur-lg border-t border-white/5">
      {/* LEFT */}
      <motion.button
        className="flex flex-col items-center gap-1 p-2 text-white/40"
        onClick={() => onTabChange(leftTab)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        <LeftIcon className="w-6 h-6" />
        <span className="text-xs">{leftLabel}</span>
      </motion.button>

      {/* CENTER: VOYO Player - Gentle premium glow */}
      <motion.button
        className="relative"
        onClick={onVOYOClick}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        {/* Gentle ambient glow - slow, premium feel */}
        <motion.div
          className="absolute inset-0 -m-2 rounded-full bg-purple-500/30 blur-xl"
          animate={{
            opacity: [0.3, 0.6, 0.3],
            scale: [1, 1.15, 1],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <div className="relative w-14 h-14 -mt-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/40">
          <Radio className="w-6 h-6 text-white" />
        </div>
      </motion.button>

      {/* RIGHT */}
      <motion.button
        className="flex flex-col items-center gap-1 p-2 text-white/40"
        onClick={() => onTabChange(rightTab)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        <RightIcon className="w-6 h-6" />
        <span className="text-xs">{rightLabel}</span>
      </motion.button>
    </nav>
  );
};

// Settings/Profile Screen
const SettingsScreen = () => {
  return (
    <div className="flex flex-col h-full px-4 py-4">
      <h1 className="text-2xl font-bold text-white mb-6">Profile</h1>

      {/* Profile Header */}
      <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 mb-6">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-2xl font-bold text-white">
          D
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Dash</h2>
          <p className="text-white/50 text-sm">Premium Member</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Songs', value: '142' },
          { label: 'Playlists', value: '8' },
          { label: 'OYÉ Given', value: '1.2K' },
        ].map((stat) => (
          <div key={stat.label} className="p-4 rounded-xl bg-white/5 text-center">
            <p className="text-xl font-bold text-white">{stat.value}</p>
            <p className="text-white/50 text-xs">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Settings List */}
      <div className="space-y-2">
        {[
          { label: 'Audio Quality', value: 'High' },
          { label: 'Download Quality', value: 'Very High' },
          { label: 'Storage', value: '2.4 GB used' },
          { label: 'Theme', value: 'Dark' },
          { label: 'Language', value: 'English' },
        ].map((item) => (
          <motion.button
            key={item.label}
            className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
            whileHover={{ x: 4 }}
          >
            <span className="text-white">{item.label}</span>
            <span className="text-white/50 text-sm">{item.value}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export const ClassicMode = ({ onSwitchToVOYO, onSearch }: ClassicModeProps) => {
  const [activeTab, setActiveTab] = useState<ClassicTab>('home');
  const [showNowPlaying, setShowNowPlaying] = useState(false);
  const [navVisible, setNavVisible] = useState(true);
  const { currentTrack, shouldOpenNowPlaying, setShouldOpenNowPlaying } = usePlayerStore();

  // FIX A4: Listen for shouldOpenNowPlaying flag (set by search overlay)
  useEffect(() => {
    if (shouldOpenNowPlaying) {
      setShowNowPlaying(true);
      setShouldOpenNowPlaying(false); // Clear the flag
    }
  }, [shouldOpenNowPlaying, setShouldOpenNowPlaying]);

  // Section-aware track play handler - CONSOLIDATED
  // Communal sections (Top 10, African Vibes, Trending) → open full player
  // Personal sections (Continue Listening, Made For You) → mini player only
  const handleTrackClick = (track: Track, options?: { openFull?: boolean }) => {
    // Open full player for communal/discovery sections
    if (options?.openFull) {
      setShowNowPlaying(true);
    }

    // CONSOLIDATED: One atomic call - no delays, no fragmentation
    usePlayerStore.getState().playTrack(track);
  };

  const handleArtistClick = (artist: { name: string; tracks: Track[] }) => {
    // Switch to library with artist filter
    setActiveTab('library');
  };

  return (
    <div className="relative h-full bg-[#0a0a0f]">
      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          className="h-full"
          initial={{ opacity: 0, x: activeTab === 'home' ? -20 : 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: activeTab === 'home' ? 20 : -20 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'home' && (
            <HomeFeed
              onTrackPlay={handleTrackClick}
              onSearch={onSearch}
              onDahub={() => setActiveTab('hub')}
              onNavVisibilityChange={setNavVisible}
              onSwitchToVOYO={onSwitchToVOYO}
            />
          )}
          {activeTab === 'hub' && (
            <Hub />
          )}
          {activeTab === 'library' && (
            <Library onTrackClick={handleTrackClick} />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Mini Player - Double tap to open full player */}
      <AnimatePresence>
        {currentTrack && !showNowPlaying && (
          <MiniPlayer onVOYOClick={onSwitchToVOYO} onOpenFull={() => setShowNowPlaying(true)} />
        )}
      </AnimatePresence>

      {/* Bottom Navigation - hides during immersive sections */}
      <AnimatePresence>
        {navVisible && (
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{
              duration: 0.5,
              ease: [0.25, 0.1, 0.25, 1],
            }}
          >
            <BottomNav
              activeTab={activeTab}
              onTabChange={setActiveTab}
              onVOYOClick={onSwitchToVOYO}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full Now Playing */}
      <NowPlaying
        isOpen={showNowPlaying}
        onClose={() => setShowNowPlaying(false)}
      />
    </div>
  );
};

export default ClassicMode;
