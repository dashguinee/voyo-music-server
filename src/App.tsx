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
import { Search, User, Home, Radio, Sparkles, X, Zap } from 'lucide-react';
import { PortraitVOYO } from './components/voyo/PortraitVOYO';
import { LandscapeVOYO } from './components/voyo/LandscapeVOYO';
import { VideoMode } from './components/voyo/VideoMode';
import { ClassicMode } from './components/classic/ClassicMode';
import { AudioPlayer } from './components/AudioPlayer';
import { SearchOverlayV2 as SearchOverlay } from './components/search/SearchOverlayV2';
import { AnimatedBackground, BackgroundPicker, BackgroundType, ReactionCanvas } from './components/backgrounds/AnimatedBackgrounds';
import { usePlayerStore } from './store/playerStore';
import { getYouTubeThumbnail } from './data/tracks';
import { setupMobileAudioUnlock } from './utils/mobileAudioUnlock';
import { InstallButton } from './components/ui/InstallButton';
import { OfflineIndicator } from './components/ui/OfflineIndicator';

// App modes
type AppMode = 'classic' | 'voyo' | 'video';

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
  const [backgroundType, setBackgroundType] = useState<BackgroundType>('glow'); // Clean ambient glow
  const [isBackgroundPickerOpen, setIsBackgroundPickerOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const isLandscape = useOrientation();

  // MOBILE FIX: Setup audio unlock on app mount
  useEffect(() => {
    setupMobileAudioUnlock();
  }, []);

  // NETWORK DETECTION: Detect network quality on app mount
  useEffect(() => {
    const { detectNetworkQuality } = usePlayerStore.getState();
    detectNetworkQuality();
  }, []);

  // Get background image URL with fallback
  const getBackgroundUrl = () => {
    if (!currentTrack) return '';
    if (bgError) {
      return getYouTubeThumbnail(currentTrack.trackId, 'high');
    }
    return currentTrack.coverUrl;
  };

  // Handle video mode entry/exit
  const handleVideoModeEnter = () => setAppMode('video');
  const handleVideoModeExit = () => setAppMode('voyo');

  // Handle mode switching
  const handleSwitchToVOYO = () => setAppMode('voyo');
  const handleSwitchToClassic = () => setAppMode('classic');

  return (
    <div className="relative h-full w-full bg-[#0a0a0f] overflow-hidden">
      {/* Dynamic Background based on current track (only for VOYO modes) */}
      {appMode !== 'video' && appMode !== 'classic' && (
        <div className="absolute inset-0 z-0">
          {/* Blurred album art background with fallback */}
          {currentTrack && (
            <motion.div
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1 }}
              key={currentTrack.id}
            >
              <img
                src={getBackgroundUrl()}
                alt=""
                className="absolute inset-0 w-full h-full object-cover blur-3xl opacity-15 scale-110"
                onError={() => setBgError(true)}
              />
            </motion.div>
          )}

          {/* ANIMATED BACKGROUND - User's chosen vibe */}
          <AnimatedBackground type={backgroundType} mood="vibe" />

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0f]/80 via-[#0a0a0f]/50 to-[#0a0a0f]/90" />
        </div>
      )}

      {/* REACTION CANVAS - Reactions float up when tapped */}
      {appMode !== 'video' && appMode !== 'classic' && (
        <ReactionCanvas />
      )}

      {/* Main Content */}
      <AnimatePresence mode="wait">
        {appMode === 'classic' ? (
          <motion.div
            key="classic"
            className="relative z-10 h-full"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
          >
            <ClassicMode
              onSwitchToVOYO={handleSwitchToVOYO}
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
                {/* Vibe/Background Picker Button */}
                <motion.button
                  className="p-2 rounded-full bg-purple-500/20 hover:bg-purple-500/30 transition-colors border border-purple-500/30"
                  onClick={() => setIsBackgroundPickerOpen(true)}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  title="Choose Vibe"
                >
                  <Sparkles className="w-5 h-5 text-purple-400" />
                </motion.button>

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
                  onClick={() => setIsProfileOpen(true)}
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
                <PortraitVOYO onSearch={() => setIsSearchOpen(true)} />
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

      {/* Audio Player - Piped API direct streams (handles actual playback) */}
      <AudioPlayer />

      {/* Search Overlay - Powered by Piped API */}
      <SearchOverlay isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

      {/* Background/Vibe Picker - Choose your animated background */}
      <BackgroundPicker
        current={backgroundType}
        onSelect={setBackgroundType}
        isOpen={isBackgroundPickerOpen}
        onClose={() => setIsBackgroundPickerOpen(false)}
      />

      {/* Profile Modal */}
      <AnimatePresence>
        {isProfileOpen && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setIsProfileOpen(false)}
            />

            {/* Modal */}
            <motion.div
              className="relative w-full max-w-sm bg-gradient-to-b from-[#1a1a2e] to-[#0f0f16] rounded-3xl border border-purple-500/20 shadow-2xl overflow-hidden"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <User size={20} className="text-purple-400" />
                  VOYO Settings
                </h2>
                <motion.button
                  onClick={() => setIsProfileOpen(false)}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <X size={18} className="text-white/70" />
                </motion.button>
              </div>

              {/* Content */}
              <div className="p-4 space-y-4">
                {/* Audio Enhancement Status */}
                <div className="bg-white/5 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                      <Zap size={18} className="text-white" />
                    </div>
                    <div>
                      <p className="text-white font-semibold">African Bass Mode</p>
                      <p className="text-xs text-green-400">Active - +30% gain, +8dB bass</p>
                    </div>
                  </div>
                </div>

                {/* Mode Switcher */}
                <div className="space-y-2">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Player Mode</p>
                  <div className="grid grid-cols-2 gap-2">
                    <motion.button
                      className={`p-3 rounded-xl flex flex-col items-center gap-1 ${appMode === 'voyo' ? 'bg-purple-500/30 border border-purple-500/50' : 'bg-white/5 border border-white/10'}`}
                      onClick={() => { setAppMode('voyo'); setIsProfileOpen(false); }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Radio size={20} className={appMode === 'voyo' ? 'text-purple-400' : 'text-gray-400'} />
                      <span className={`text-xs ${appMode === 'voyo' ? 'text-purple-300' : 'text-gray-400'}`}>VOYO</span>
                    </motion.button>
                    <motion.button
                      className={`p-3 rounded-xl flex flex-col items-center gap-1 ${appMode === 'classic' ? 'bg-purple-500/30 border border-purple-500/50' : 'bg-white/5 border border-white/10'}`}
                      onClick={() => { setAppMode('classic'); setIsProfileOpen(false); }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Home size={20} className={appMode === 'classic' ? 'text-purple-400' : 'text-gray-400'} />
                      <span className={`text-xs ${appMode === 'classic' ? 'text-purple-300' : 'text-gray-400'}`}>Classic</span>
                    </motion.button>
                  </div>
                </div>

                {/* App Info */}
                <div className="text-center pt-4 border-t border-white/10">
                  <p className="text-xl font-black bg-gradient-to-r from-purple-400 via-pink-500 to-purple-600 bg-clip-text text-transparent">
                    VOYO
                  </p>
                  <p className="text-[10px] text-gray-500 mt-1">The African Music Experience</p>
                  <p className="text-[10px] text-gray-600">v1.0.1 • Made with ❤️</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PWA Install Button - Subtle, bottom right */}
      <InstallButton />

      {/* Offline Indicator - Shows when network is lost */}
      <OfflineIndicator />
    </div>
  );
}

export default App;
