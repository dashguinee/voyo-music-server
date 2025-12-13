/**
 * VOYO Boost Button - Download HD audio to local device
 *
 * FLOW:
 * 1. User plays track (IFrame - instant start)
 * 2. User clicks "⚡ Boost HD" button
 * 3. Download starts from server proxy -> IndexedDB
 * 4. Next play = instant from cache (BOOSTED)
 *
 * After 3 manual boosts, prompt: "Enable Auto-Boost?"
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Download, Check, AlertCircle, Loader2 } from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { useDownloadStore } from '../../store/downloadStore';
import { getThumbnailUrl } from '../../utils/imageHelpers';

interface BoostButtonProps {
  variant?: 'full' | 'compact' | 'icon';
  className?: string;
}

export const BoostButton = ({ variant = 'full', className = '' }: BoostButtonProps) => {
  const currentTrack = usePlayerStore((state) => state.currentTrack);
  const playbackSource = usePlayerStore((state) => state.playbackSource);

  const {
    boostTrack,
    getDownloadStatus,
    downloads,
    isTrackBoosted,
  } = useDownloadStore();

  const [isBoosted, setIsBoosted] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  // Check if current track is already boosted
  useEffect(() => {
    const checkBoosted = async () => {
      if (!currentTrack?.trackId) {
        setIsBoosted(false);
        setIsChecking(false);
        return;
      }

      setIsChecking(true);
      const boosted = await isTrackBoosted(currentTrack.trackId);
      setIsBoosted(boosted);
      setIsChecking(false);
    };

    checkBoosted();
  }, [currentTrack?.trackId, isTrackBoosted]);

  // Also update when downloads change (after boost completes)
  useEffect(() => {
    if (!currentTrack?.trackId) return;

    const status = downloads.get(currentTrack.trackId);
    if (status?.status === 'complete') {
      setIsBoosted(true);
    }
  }, [downloads, currentTrack?.trackId]);

  if (!currentTrack?.trackId) return null;

  const downloadStatus = getDownloadStatus(currentTrack.trackId);
  const isDownloading = downloadStatus?.status === 'downloading';
  const isQueued = downloadStatus?.status === 'queued';
  const isFailed = downloadStatus?.status === 'failed';
  const progress = downloadStatus?.progress || 0;

  const handleBoost = () => {
    if (isDownloading || isQueued || isBoosted) return;

    boostTrack(
      currentTrack.trackId,
      currentTrack.title,
      currentTrack.artist,
      currentTrack.duration || 0,
      getThumbnailUrl(currentTrack.trackId, 'medium')
    );
  };

  // Already boosted - show Boosted badge
  if (isBoosted || playbackSource === 'cached') {
    if (variant === 'icon') {
      return (
        <motion.div
          className={`flex items-center justify-center ${className}`}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
            <Zap size={14} className="text-white" fill="white" />
          </div>
        </motion.div>
      );
    }

    return (
      <motion.div
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 ${className}`}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
      >
        <Zap size={12} className="text-purple-400" fill="currentColor" />
        <span className="text-[10px] font-bold text-purple-300 uppercase tracking-wider">
          Boosted
        </span>
      </motion.div>
    );
  }

  // Downloading - show progress
  if (isDownloading || isQueued) {
    if (variant === 'icon') {
      return (
        <motion.div
          className={`relative w-8 h-8 ${className}`}
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
        >
          {/* Progress ring */}
          <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
            <circle
              cx="16"
              cy="16"
              r="14"
              fill="none"
              stroke="rgba(147, 51, 234, 0.2)"
              strokeWidth="3"
            />
            <motion.circle
              cx="16"
              cy="16"
              r="14"
              fill="none"
              stroke="url(#boostGradient)"
              strokeWidth="3"
              strokeLinecap="round"
              initial={{ strokeDasharray: '88', strokeDashoffset: '88' }}
              animate={{ strokeDashoffset: 88 - (88 * progress) / 100 }}
              transition={{ duration: 0.3 }}
            />
            <defs>
              <linearGradient id="boostGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#a855f7" />
                <stop offset="100%" stopColor="#ec4899" />
              </linearGradient>
            </defs>
          </svg>
          {/* Center icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 size={12} className="text-purple-400 animate-spin" />
          </div>
        </motion.div>
      );
    }

    return (
      <motion.div
        className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 ${className}`}
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
      >
        <Loader2 size={12} className="text-purple-400 animate-spin" />
        <span className="text-[10px] font-bold text-purple-300 uppercase tracking-wider">
          {isQueued ? 'Queued' : `${progress}%`}
        </span>
      </motion.div>
    );
  }

  // Failed - show retry
  if (isFailed) {
    return (
      <motion.button
        onClick={handleBoost}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors ${className}`}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <AlertCircle size={12} className="text-red-400" />
        <span className="text-[10px] font-bold text-red-300 uppercase tracking-wider">
          Retry
        </span>
      </motion.button>
    );
  }

  // Loading check
  if (isChecking) {
    return (
      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 ${className}`}>
        <Loader2 size={12} className="text-gray-400 animate-spin" />
      </div>
    );
  }

  // Ready to boost - show button - FIX 2: Touch target 44px for icon variant
  if (variant === 'icon') {
    return (
      <motion.button
        onClick={handleBoost}
        className={`min-w-[44px] min-h-[44px] w-11 h-11 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center hover:from-amber-500/30 hover:to-orange-500/30 transition-colors ${className}`}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        title="Boost HD - Download for offline"
      >
        <Download size={14} className="text-amber-400" />
      </motion.button>
    );
  }

  if (variant === 'compact') {
    return (
      <motion.button
        onClick={handleBoost}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 hover:from-amber-500/20 hover:to-orange-500/20 transition-colors ${className}`}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <Zap size={10} className="text-amber-400" />
        <span className="text-[9px] font-bold text-amber-300 uppercase">Boost</span>
      </motion.button>
    );
  }

  // Full button
  return (
    <motion.button
      onClick={handleBoost}
      className={`flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 hover:from-amber-500/20 hover:to-orange-500/20 hover:border-amber-500/50 transition-all group ${className}`}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
    >
      <motion.div
        className="relative"
        animate={{ rotate: [0, 10, -10, 0] }}
        transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
      >
        <Zap size={16} className="text-amber-400 group-hover:text-amber-300" />
      </motion.div>
      <div className="flex flex-col items-start">
        <span className="text-xs font-bold text-amber-300 group-hover:text-amber-200">
          Boost HD
        </span>
        <span className="text-[8px] text-amber-400/60 -mt-0.5">
          Download offline
        </span>
      </div>
    </motion.button>
  );
};

/**
 * Auto-Boost Prompt Modal
 * Shows after 3 manual boosts
 */
export const AutoBoostPrompt = () => {
  const {
    showAutoBoostPrompt,
    enableAutoBoost,
    dismissAutoBoostPrompt,
    manualBoostCount,
  } = useDownloadStore();

  if (!showAutoBoostPrompt) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={dismissAutoBoostPrompt}
        />

        {/* Modal */}
        <motion.div
          className="relative w-full max-w-sm bg-gradient-to-b from-[#1a1a2e] to-[#0f0f16] rounded-3xl border border-purple-500/20 shadow-2xl shadow-purple-500/10 overflow-hidden"
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
        >
          {/* Glow effect */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-1/2 bg-purple-500/20 blur-3xl pointer-events-none" />

          {/* Content */}
          <div className="relative p-6 text-center">
            {/* Icon */}
            <motion.div
              className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Zap size={28} className="text-white" fill="white" />
            </motion.div>

            {/* Title */}
            <h2 className="text-xl font-bold text-white mb-2">
              You're Loving Boost!
            </h2>

            {/* Subtitle */}
            <p className="text-gray-400 text-sm mb-6">
              You've boosted {manualBoostCount} tracks manually. Want to enable Auto-Boost for instant HD playback?
            </p>

            {/* Features list */}
            <div className="text-left bg-white/5 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-3 mb-3">
                <Check size={16} className="text-green-400 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-300">Automatically download tracks as you play</span>
              </div>
              <div className="flex items-start gap-3 mb-3">
                <Check size={16} className="text-green-400 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-300">HD quality audio, instant playback</span>
              </div>
              <div className="flex items-start gap-3">
                <Check size={16} className="text-green-400 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-gray-300">Listen offline anytime</span>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <motion.button
                onClick={dismissAutoBoostPrompt}
                className="flex-1 py-3 rounded-xl bg-white/5 border border-white/10 text-gray-400 font-medium hover:bg-white/10 transition-colors"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Not Now
              </motion.button>
              <motion.button
                onClick={enableAutoBoost}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-shadow"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                Enable Auto-Boost
              </motion.button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default BoostButton;
