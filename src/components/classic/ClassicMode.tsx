/**
 * VOYO Music - Classic Mode Container
 * The standard app experience: Home Feed, Library, Now Playing
 *
 * Bottom Navigation:
 * - Home (Home Feed)
 * - VOYO (Switch to VOYO Mode)
 * - Library
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Radio, Library as LibraryIcon, Users } from 'lucide-react';
import { HomeFeed } from './HomeFeed';
import { Library } from './Library';
import { Hub } from './Hub';
import { NowPlaying } from './NowPlaying';
import { usePlayerStore } from '../../store/playerStore';
import { getYouTubeThumbnail } from '../../data/tracks';
import { SmartImage } from '../ui/SmartImage';
import { Track } from '../../types';

type ClassicTab = 'home' | 'hub' | 'library';

interface ClassicModeProps {
  onSwitchToVOYO: () => void;
  onSearch: () => void;
}

// Mini Player (shown at bottom when a track is playing)
const MiniPlayer = ({ onClick }: { onClick: () => void }) => {
  const { currentTrack, isPlaying, togglePlay, progress } = usePlayerStore();
  const [shouldScroll, setShouldScroll] = useState(false);
  const titleRef = useRef<HTMLParagraphElement>(null);

  // Check if title needs scrolling (longer than container)
  useEffect(() => {
    if (titleRef.current) {
      setShouldScroll(titleRef.current.scrollWidth > titleRef.current.clientWidth);
    }
  }, [currentTrack?.title]);

  if (!currentTrack) return null;

  return (
    <motion.div
      className="absolute bottom-16 left-4 right-4 z-40"
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
    >
      <motion.button
        className="w-full flex items-center gap-3 p-3 pr-4 rounded-2xl bg-gradient-to-r from-purple-900/95 to-pink-900/95 border border-white/10 backdrop-blur-xl shadow-2xl relative overflow-hidden"
        onClick={onClick}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        {/* Wave Progress Bar - Dynamic Island style fill */}
        <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/5 overflow-hidden">
          <motion.div
            className="h-full relative"
            style={{ width: `${progress}%` }}
          >
            {/* Gradient fill with glow */}
            <div className="absolute inset-0 bg-gradient-to-r from-violet-500 via-purple-400 to-fuchsia-500" />
            {/* Wave effect at the edge */}
            <motion.div
              className="absolute right-0 top-0 bottom-0 w-3 bg-gradient-to-l from-white/60 to-transparent"
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
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
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Add to playlist */}
          <motion.div
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
            onClick={(e) => {
              e.stopPropagation();
              // TODO: Add to playlist
            }}
            whileHover={{ scale: 1.1, backgroundColor: 'rgba(255,255,255,0.2)' }}
            whileTap={{ scale: 0.9 }}
          >
            <span className="text-white text-lg font-light">+</span>
          </motion.div>

          {/* OYÉ Button */}
          <motion.div
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"
            onClick={(e) => {
              e.stopPropagation();
              // TODO: OYÉ reaction
            }}
            whileHover={{ scale: 1.1, backgroundColor: 'rgba(255,255,255,0.2)' }}
            whileTap={{ scale: 0.9 }}
          >
            <span className="text-sm">🔥</span>
          </motion.div>

          {/* Play/Pause */}
          <motion.div
            className="w-10 h-10 rounded-full bg-white flex items-center justify-center ml-1"
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
          </motion.div>
        </div>
      </motion.button>

      {/* Marquee animation styles */}
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </motion.div>
  );
};

// Bottom Navigation - Home ↔ DAHUB toggle on left
const BottomNav = ({
  activeTab,
  onTabChange,
  onVOYOClick
}: {
  activeTab: ClassicTab;
  onTabChange: (tab: ClassicTab) => void;
  onVOYOClick: () => void;
}) => {
  // Left button toggles between Home and Hub
  const isHub = activeTab === 'hub';
  const leftIcon = isHub ? Home : Users;
  const leftLabel = isHub ? 'Home' : 'DAHUB';

  return (
    <nav className="absolute bottom-0 left-0 right-0 flex items-center justify-around py-3 px-6 bg-[#0a0a0f]/95 backdrop-blur-lg border-t border-white/5">
      {/* LEFT: Home ↔ DAHUB Toggle */}
      <motion.button
        className={`flex flex-col items-center gap-1 p-2 ${
          activeTab === 'home' || activeTab === 'hub' ? 'text-purple-400' : 'text-white/40'
        }`}
        onClick={() => onTabChange(isHub ? 'home' : 'hub')}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        <motion.div
          key={leftLabel}
          initial={{ rotateY: 90, opacity: 0 }}
          animate={{ rotateY: 0, opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          {isHub ? <Home className="w-6 h-6" /> : <Users className="w-6 h-6" />}
        </motion.div>
        <motion.span
          key={leftLabel + '-label'}
          className="text-xs"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {leftLabel}
        </motion.span>
      </motion.button>

      {/* CENTER: VOYO Player */}
      <motion.button
        className="relative"
        onClick={onVOYOClick}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        <div className="w-14 h-14 -mt-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
          <Radio className="w-6 h-6 text-white" />
        </div>
      </motion.button>

      {/* RIGHT: Library */}
      <motion.button
        className={`flex flex-col items-center gap-1 p-2 ${
          activeTab === 'library' ? 'text-purple-400' : 'text-white/40'
        }`}
        onClick={() => onTabChange('library')}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        <LibraryIcon className="w-6 h-6" />
        <span className="text-xs">Library</span>
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
  const { currentTrack } = usePlayerStore();

  const handleTrackClick = (track: Track) => {
    const { setCurrentTrack, togglePlay } = usePlayerStore.getState();
    setCurrentTrack(track);
    // FIX: Explicitly start playback when user clicks track
    setTimeout(() => togglePlay(), 100);
    setShowNowPlaying(true);
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
            <HomeFeed onTrackPlay={handleTrackClick} onSearch={onSearch} onDahub={() => setActiveTab('hub')} />
          )}
          {activeTab === 'hub' && (
            <Hub />
          )}
          {activeTab === 'library' && (
            <Library onTrackClick={handleTrackClick} />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Mini Player */}
      <AnimatePresence>
        {currentTrack && !showNowPlaying && (
          <MiniPlayer onClick={() => setShowNowPlaying(true)} />
        )}
      </AnimatePresence>

      {/* Bottom Navigation */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onVOYOClick={onSwitchToVOYO}
      />

      {/* Full Now Playing */}
      <NowPlaying
        isOpen={showNowPlaying}
        onClose={() => setShowNowPlaying(false)}
      />
    </div>
  );
};

export default ClassicMode;
