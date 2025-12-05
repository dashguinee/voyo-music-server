/**
 * VOYO Music - Main Application
 * The complete music listening experience - YOUR PERSONAL DJ
 *
 * Modes:
 * 1. Classic Mode - Home Feed, Library, Now Playing (Spotify-style)
 * 2. Portrait VOYO - Main player with DJ interaction
 * 3. Landscape VOYO - Wide layout (detected by orientation)
 * 4. Video Mode - Full immersion with floating reactions
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, User, Home, Radio } from 'lucide-react';
import { PortraitVOYO } from './components/voyo/PortraitVOYO';
import { LandscapeVOYO } from './components/voyo/LandscapeVOYO';
import { VideoMode } from './components/voyo/VideoMode';
import { DJSessionMode } from './components/voyo/DJSessionMode';
import { ClassicMode } from './components/classic/ClassicMode';
import { YouTubePlayer } from './components/player/YouTubePlayer';
import { SearchOverlay } from './components/search/SearchOverlay';
import { usePlayerStore } from './store/playerStore';
import { getYouTubeThumbnail } from './data/tracks';

// App modes
type AppMode = 'classic' | 'voyo' | 'video' | 'dj';

// Detect orientation
const useOrientation = () => {
  const [isLandscape, setIsLandscape] = useState(
    typeof window !== 'undefined' ? window.innerWidth > window.innerHeight : false
  );

  useEffect(() => {
    const handleResize = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  return isLandscape;
};

function App() {
  const { currentTrack } = usePlayerStore();
  const [bgError, setBgError] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [appMode, setAppMode] = useState<AppMode>('voyo'); // Start with VOYO Superapp!
  const isLandscape = useOrientation();

  // Get background image URL with fallback
  const getBackgroundUrl = () => {
    if (!currentTrack) return '';
    if (bgError) {
      return getYouTubeThumbnail(currentTrack.youtubeVideoId, 'high');
    }
    return currentTrack.coverUrl;
  };

  // Handle video mode entry/exit
  const handleVideoModeEnter = () => setAppMode('video');
  const handleVideoModeExit = () => setAppMode('dj');

  // Handle mode switching
  const handleSwitchToVOYO = () => setAppMode('voyo');
  const handleSwitchToClassic = () => setAppMode('classic');
  const handleSwitchToDJ = () => setAppMode('dj');

  return (
    <div className="relative h-full w-full bg-[#0a0a0f] overflow-hidden">
      {/* Dynamic Background based on current track (only for VOYO modes) */}
      {currentTrack && appMode !== 'video' && appMode !== 'classic' && (
        <motion.div
          className="absolute inset-0 z-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
          key={currentTrack.id}
        >
          {/* Blurred album art background with fallback */}
          <img
            src={getBackgroundUrl()}
            alt=""
            className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-20 scale-110"
            onError={() => setBgError(true)}
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0f]/90 via-[#0a0a0f]/70 to-[#0a0a0f]" />
        </motion.div>
      )}

      {/* Main Content */}
      <AnimatePresence mode="wait">
        {appMode === 'dj' ? (
          <motion.div
            key="dj"
            className="relative z-10 h-full"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            {/* DJ Mode Header */}
            <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3">
              <motion.div
                className="flex items-center gap-2"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <span className="text-2xl font-black bg-gradient-to-r from-purple-400 via-pink-500 to-purple-600 bg-clip-text text-transparent">
                  VOYO
                </span>
                <span className="text-yellow-400 text-xs font-bold">DJ</span>
              </motion.div>
              <div className="flex items-center gap-2">
                <motion.button
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20"
                  onClick={handleSwitchToVOYO}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  title="Player Mode"
                >
                  <Radio className="w-5 h-5 text-white/70" />
                </motion.button>
                <motion.button
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20"
                  onClick={() => setIsSearchOpen(true)}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <Search className="w-5 h-5 text-white/70" />
                </motion.button>
              </div>
            </header>
            <DJSessionMode />
          </motion.div>
        ) : appMode === 'classic' ? (
          <motion.div
            key="classic"
            className="relative z-10 h-full"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
          >
            <ClassicMode
              onSwitchToVOYO={handleSwitchToDJ}
              onSearch={() => setIsSearchOpen(true)}
            />
          </motion.div>
        ) : appMode === 'video' ? (
          <motion.div
            key="video"
            className="relative z-10 h-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <VideoMode onExit={handleVideoModeExit} />
          </motion.div>
        ) : (
          <motion.div
            key="voyo"
            className="relative z-10 h-full flex flex-col"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
          >
            {/* Top Bar - VOYO Logo & Navigation */}
            <header className="flex items-center justify-between px-4 py-3 flex-shrink-0">
              <motion.div
                className="flex items-center gap-2"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <div className="relative">
                  <span className="text-2xl font-black bg-gradient-to-r from-purple-400 via-pink-500 to-purple-600 bg-clip-text text-transparent">
                    VOYO
                  </span>
                  <span className="absolute -top-1 -right-8 text-[10px] font-bold text-yellow-400">
                    OYÉ
                  </span>
                </div>
              </motion.div>

              {/* Navigation Buttons */}
              <div className="flex items-center gap-2">
                {/* Classic Mode Button */}
                <motion.button
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                  onClick={handleSwitchToClassic}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  title="Classic Mode"
                >
                  <Home className="w-5 h-5 text-white/70" />
                </motion.button>

                {/* Search Button */}
                <motion.button
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                  onClick={() => setIsSearchOpen(true)}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <Search className="w-5 h-5 text-white/70" />
                </motion.button>

                {/* Profile Button */}
                <motion.button
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <User className="w-5 h-5 text-white/70" />
                </motion.button>
              </div>
            </header>

            {/* VOYO Mode Content - Portrait or Landscape */}
            <div className="flex-1 overflow-hidden">
              {isLandscape ? (
                <LandscapeVOYO onVideoMode={handleVideoModeEnter} />
              ) : (
                <PortraitVOYO />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* VOYO Watermark */}
      {appMode !== 'video' && (
        <div className="fixed bottom-2 right-2 z-40 opacity-30">
          <span className="text-[8px] text-white/30">
            VOYO Music by DASUPERHUB
          </span>
        </div>
      )}

      {/* YouTube Player (hidden in audio mode, visible in video mode) */}
      <YouTubePlayer />

      {/* Search Overlay - Powered by Piped API */}
      <SearchOverlay isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </div>
  );
}

export default App;
