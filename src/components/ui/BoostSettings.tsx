/**
 * VOYO Boost Settings Panel
 *
 * Manage boost settings:
 * - Enable/disable auto-boost
 * - WiFi-only toggle
 * - View/clear cached tracks
 * - Storage usage
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Wifi, WifiOff, Trash2, X, HardDrive, Download, Settings, Crown, Eye, EyeOff, Lock } from 'lucide-react';
import { useDownloadStore } from '../../store/downloadStore';
import { usePlayerStore } from '../../store/playerStore';
import { LottieIcon } from './LottieIcon';

interface BoostSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BoostSettings = ({ isOpen, onClose }: BoostSettingsProps) => {
  const {
    autoBoostEnabled,
    enableAutoBoost,
    disableAutoBoost,
    downloadSetting,
    updateSetting,
    cachedTracks,
    cacheSize,
    clearAllDownloads,
    manualBoostCount,
  } = useDownloadStore();

  const { boostProfile, setBoostProfile, oyeBarBehavior, setOyeBarBehavior, playbackSource } = usePlayerStore();

  // VOYEX is only available for boosted tracks (local cache)
  const isCurrentTrackBoosted = playbackSource === 'cached';

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const handleClearCache = async () => {
    setIsClearing(true);
    await clearAllDownloads();
    setIsClearing(false);
    setShowClearConfirm(false);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-end justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            className="relative w-full max-w-md max-h-[75vh] bg-[#0a0a0f]/95 backdrop-blur-xl border-t border-white/10 rounded-t-3xl overflow-hidden flex flex-col"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            {/* Handle */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1 bg-white/20 rounded-full z-10" />

            {/* Header */}
            <div className="flex items-center justify-between p-6 pb-4 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 flex items-center justify-center">
                  <Zap size={18} className="text-purple-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Boost Settings</h3>
                  <p className="text-xs text-gray-500">{cachedTracks.length} tracks boosted</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
              >
                <X size={18} className="text-gray-400" />
              </button>
            </div>

            {/* Content - Scrollable */}
            <div className="px-6 pb-24 space-y-4 overflow-y-auto flex-1">
              {/* Audio Enhancement Preset */}
              <div className="bg-white/5 rounded-2xl p-4">
                <div className="text-sm font-medium text-white mb-3">Audio Enhancement</div>
                <div className="grid grid-cols-3 gap-2">
                  {/* Warm Preset */}
                  <motion.button
                    onClick={() => setBoostProfile('boosted')}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all ${
                      boostProfile === 'boosted'
                        ? 'bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border-yellow-500/30 text-yellow-300'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <LottieIcon
                      lottieUrl="/lottie/fire.json"
                      fallbackEmoji="🔥"
                      size={22}
                    />
                    <span className="text-[11px] font-bold">Warm</span>
                    <span className="text-[9px] opacity-70">Bass Boost</span>
                  </motion.button>

                  {/* Calm Preset */}
                  <motion.button
                    onClick={() => setBoostProfile('calm')}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all ${
                      boostProfile === 'calm'
                        ? 'bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border-blue-500/30 text-blue-300'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <LottieIcon
                      lottieUrl="/lottie/sunrise.json"
                      fallbackEmoji="🌅"
                      size={22}
                      speed={0.5}
                    />
                    <span className="text-[11px] font-bold">Calm</span>
                    <span className="text-[9px] opacity-70">Relaxed</span>
                  </motion.button>

                  {/* VOYEX Preset - Locked to boosted tracks */}
                  <motion.button
                    onClick={() => isCurrentTrackBoosted && setBoostProfile('voyex')}
                    disabled={!isCurrentTrackBoosted}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all relative ${
                      boostProfile === 'voyex' && isCurrentTrackBoosted
                        ? 'bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-purple-500/30 text-purple-300'
                        : isCurrentTrackBoosted
                          ? 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                          : 'bg-white/5 border-white/10 text-gray-600 opacity-50 cursor-not-allowed'
                    }`}
                    whileHover={isCurrentTrackBoosted ? { scale: 1.02 } : {}}
                    whileTap={isCurrentTrackBoosted ? { scale: 0.98 } : {}}
                  >
                    {!isCurrentTrackBoosted && (
                      <div className="absolute top-1 right-1">
                        <Lock size={10} className="text-gray-500" />
                      </div>
                    )}
                    <Crown size={22} className={boostProfile === 'voyex' && isCurrentTrackBoosted ? 'text-purple-300' : ''} />
                    <span className="text-[11px] font-bold">VOYEX</span>
                    <span className="text-[9px] opacity-70">{isCurrentTrackBoosted ? 'Full Exp' : 'Boost to unlock'}</span>
                  </motion.button>
                </div>
                <div className="text-[10px] text-gray-500 mt-3 text-center">
                  {boostProfile === 'boosted' && '🔊 Warm bass boost with speaker protection'}
                  {boostProfile === 'calm' && '🌅 Relaxed, balanced listening - breathe in, breathe out'}
                  {boostProfile === 'voyex' && isCurrentTrackBoosted && '🔥 STEREO WIDE + Deep bass + Crystal highs = MIND BLOWN'}
                  {boostProfile === 'voyex' && !isCurrentTrackBoosted && '🔒 VOYEX unlocks when playing boosted tracks'}
                </div>
              </div>

              {/* Auto-Boost Toggle */}
              <div className="bg-white/5 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      autoBoostEnabled ? 'bg-purple-500/20' : 'bg-white/5'
                    }`}>
                      <Download size={16} className={autoBoostEnabled ? 'text-purple-400' : 'text-gray-500'} />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">Auto-Boost</div>
                      <div className="text-[10px] text-gray-500">Download tracks as you play</div>
                    </div>
                  </div>
                  <button
                    onClick={() => autoBoostEnabled ? disableAutoBoost() : enableAutoBoost()}
                    className={`w-12 h-7 rounded-full transition-colors relative ${
                      autoBoostEnabled ? 'bg-purple-500' : 'bg-white/10'
                    }`}
                  >
                    <motion.div
                      className="absolute top-1 w-5 h-5 rounded-full bg-white shadow-md"
                      animate={{ left: autoBoostEnabled ? 26 : 4 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  </button>
                </div>
                <div className="text-[10px] text-gray-500">
                  {manualBoostCount} manual boosts so far
                </div>
              </div>

              {/* Download Setting */}
              <div className="bg-white/5 rounded-2xl p-4">
                <div className="text-sm font-medium text-white mb-3">Download When</div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'always', label: 'Always', icon: Download },
                    { value: 'wifi-only', label: 'WiFi Only', icon: Wifi },
                    { value: 'never', label: 'Never', icon: WifiOff },
                  ].map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      onClick={() => updateSetting(value as any)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                        downloadSetting === value
                          ? 'bg-purple-500/20 border-purple-500/30 text-purple-300'
                          : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      <Icon size={18} />
                      <span className="text-[10px] font-medium">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* OYÉ Bar Behavior */}
              <div className="bg-white/5 rounded-2xl p-4">
                <div className="text-sm font-medium text-white mb-3">OYÉ Bar Behavior</div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    {
                      value: 'fade',
                      label: 'Fade',
                      icon: Eye,
                      desc: 'Scroll for Mix Board',
                    },
                    {
                      value: 'disappear',
                      label: 'Disappear',
                      icon: EyeOff,
                      desc: 'Full Mix Board',
                    },
                  ].map(({ value, label, icon: Icon, desc }) => (
                    <button
                      key={value}
                      onClick={() => setOyeBarBehavior(value as 'fade' | 'disappear')}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                        oyeBarBehavior === value
                          ? 'bg-purple-500/20 border-purple-500/30 text-purple-300'
                          : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                      }`}
                    >
                      <Icon size={18} />
                      <span className="text-[10px] font-medium">{label}</span>
                      <span className="text-[8px] opacity-70">{desc}</span>
                    </button>
                  ))}
                </div>
                <div className="text-[10px] text-gray-500 mt-3 text-center">
                  {oyeBarBehavior === 'fade' && '✨ Reactions visible, scroll for Mix Board'}
                  {oyeBarBehavior === 'disappear' && '🎛️ Full Mix Board, double-tap for reactions'}
                </div>
              </div>

              {/* Storage Info */}
              <div className="bg-white/5 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <HardDrive size={18} className="text-gray-400" />
                    <div>
                      <div className="text-sm font-medium text-white">Storage Used</div>
                      <div className="text-[10px] text-gray-500">{cachedTracks.length} tracks</div>
                    </div>
                  </div>
                  <div className="text-lg font-bold text-white">
                    {formatSize(cacheSize)}
                  </div>
                </div>

                {/* Storage bar */}
                <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-3">
                  <motion.div
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, (cacheSize / (500 * 1024 * 1024)) * 100)}%` }}
                  />
                </div>

                {/* Clear cache button */}
                {cachedTracks.length > 0 && (
                  <motion.button
                    onClick={() => setShowClearConfirm(true)}
                    className="w-full py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium flex items-center justify-center gap-2 hover:bg-red-500/20 transition-colors"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Trash2 size={14} />
                    Clear All Boosted Tracks
                  </motion.button>
                )}
              </div>

              {/* Recent Boosted Tracks */}
              {cachedTracks.length > 0 && (
                <div className="bg-white/5 rounded-2xl p-4">
                  <div className="text-sm font-medium text-white mb-3">Recently Boosted</div>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {cachedTracks.slice(0, 5).map((track) => (
                      <div key={track.id} className="flex items-center gap-3 py-1">
                        <div className="w-6 h-6 rounded bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                          <Zap size={10} className="text-purple-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-white truncate">{track.title}</div>
                          <div className="text-[10px] text-gray-500 truncate">{track.artist}</div>
                        </div>
                        <div className="text-[10px] text-gray-500">
                          {formatSize(track.size)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Clear Confirm Dialog */}
            <AnimatePresence>
              {showClearConfirm && (
                <motion.div
                  className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <motion.div
                    className="bg-[#1a1a2e] rounded-2xl p-6 w-full max-w-xs"
                    initial={{ scale: 0.9 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0.9 }}
                  >
                    <div className="text-center mb-6">
                      <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-red-500/20 flex items-center justify-center">
                        <Trash2 size={20} className="text-red-400" />
                      </div>
                      <h4 className="text-white font-bold mb-1">Clear All Boosted Tracks?</h4>
                      <p className="text-xs text-gray-400">
                        This will delete {cachedTracks.length} tracks ({formatSize(cacheSize)}) from your device.
                      </p>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setShowClearConfirm(false)}
                        className="flex-1 py-2.5 rounded-xl bg-white/10 text-gray-300 text-sm font-medium"
                        disabled={isClearing}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleClearCache}
                        className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold"
                        disabled={isClearing}
                      >
                        {isClearing ? 'Clearing...' : 'Clear All'}
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/**
 * Compact Boost Settings Button (for player UI)
 */
export const BoostSettingsButton = ({ onClick }: { onClick: () => void }) => (
  <motion.button
    onClick={onClick}
    className="p-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
    title="Boost Settings"
  >
    <Settings size={14} className="text-gray-400" />
  </motion.button>
);

export default BoostSettings;
