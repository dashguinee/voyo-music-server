/**
 * VOYO Music - Classic Mode: Now Playing
 * Reference: Classic Mode - When clicked on profile.jpg (Right phone)
 *
 * Features:
 * - Standard music player (Spotify-style)
 * - Large album art
 * - Song title & artist
 * - Progress bar with timestamps
 * - Shuffle, Previous, Play/Pause, Next, Queue
 * - Heart to like
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  Heart,
  Share2,
  Shuffle,
  SkipBack,
  Play,
  Pause,
  SkipForward,
  ListMusic,
  Repeat,
  Volume2
} from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { getTrackThumbnailUrl } from '../../utils/imageHelpers';
import { useMobilePlay } from '../../hooks/useMobilePlay';

interface NowPlayingProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NowPlaying = ({ isOpen, onClose }: NowPlayingProps) => {
  const {
    currentTrack,
    isPlaying,
    progress,
    duration,
    nextTrack,
    prevTrack,
    seekTo,
    volume,
    setVolume
  } = usePlayerStore();
  const { handlePlayPause } = useMobilePlay(); // MOBILE FIX

  const [isLiked, setIsLiked] = useState(false);
  const [isShuffled, setIsShuffled] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');

  // Format time in MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate current time from progress
  const currentTime = (progress / 100) * duration;

  if (!currentTrack) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 bg-gradient-to-b from-[#1a1a2e] to-[#0a0a0f]"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-4">
            <motion.button
              className="p-2"
              onClick={onClose}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <ChevronDown className="w-6 h-6 text-white/70" />
            </motion.button>
            <div className="text-center">
              <p className="text-white/50 text-xs uppercase tracking-wider">Now Playing</p>
              <p className="text-white text-sm font-medium">Your Library</p>
            </div>
            <motion.button
              className="p-2"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <Share2 className="w-5 h-5 text-white/70" />
            </motion.button>
          </div>

          {/* Album Art */}
          <div className="flex-1 flex items-center justify-center px-8 py-8">
            <motion.div
              className="relative w-full max-w-sm aspect-square rounded-2xl overflow-hidden shadow-2xl bg-gradient-to-br from-purple-900/30 to-pink-900/20"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1 }}
              key={currentTrack.id}
            >
              <img
                src={getTrackThumbnailUrl(currentTrack, 'high')}
                alt={currentTrack.title}
                className="w-full h-full object-cover"
                loading="eager"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.opacity = '0';
                }}
              />
              {/* Vinyl effect overlay */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent"
                animate={isPlaying ? { opacity: [0.05, 0.1, 0.05] } : { opacity: 0.05 }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </motion.div>
          </div>

          {/* Track Info */}
          <div className="px-8 py-4">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <motion.h2
                  className="text-2xl font-bold text-white truncate"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={currentTrack.id}
                >
                  {currentTrack.title}
                </motion.h2>
                <motion.p
                  className="text-white/60 text-lg truncate"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 }}
                  key={`${currentTrack.id}-artist`}
                >
                  {currentTrack.artist}
                </motion.p>
              </div>
              <motion.button
                className="p-2"
                onClick={() => setIsLiked(!isLiked)}
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.9 }}
              >
                <Heart
                  className={`w-6 h-6 transition-colors ${
                    isLiked ? 'text-pink-500 fill-pink-500' : 'text-white/50'
                  }`}
                />
              </motion.button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="px-8 py-4">
            <div
              className="relative h-1 bg-white/20 rounded-full cursor-pointer"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const percent = ((e.clientX - rect.left) / rect.width) * 100;
                // FIX: Convert percentage to seconds (seekTo expects seconds, not percentage)
                const timeInSeconds = (percent / 100) * duration;
                seekTo(timeInSeconds);
              }}
            >
              <motion.div
                className="absolute left-0 top-0 h-full bg-white rounded-full"
                style={{ width: `${progress}%` }}
              />
              <motion.div
                className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg"
                style={{ left: `${progress}%`, marginLeft: '-6px' }}
                whileHover={{ scale: 1.3 }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-white/40">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Main Controls */}
          <div className="flex items-center justify-center gap-6 px-8 py-6">
            <motion.button
              className={`p-2 ${isShuffled ? 'text-purple-400' : 'text-white/50'}`}
              onClick={() => setIsShuffled(!isShuffled)}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <Shuffle className="w-5 h-5" />
            </motion.button>

            <motion.button
              className="p-3 text-white"
              onClick={prevTrack}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <SkipBack className="w-8 h-8" fill="white" />
            </motion.button>

            <motion.button
              className="w-16 h-16 rounded-full bg-white flex items-center justify-center"
              onClick={handlePlayPause}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {isPlaying ? (
                <Pause className="w-8 h-8 text-black" fill="black" />
              ) : (
                <Play className="w-8 h-8 text-black ml-1" fill="black" />
              )}
            </motion.button>

            <motion.button
              className="p-3 text-white"
              onClick={nextTrack}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <SkipForward className="w-8 h-8" fill="white" />
            </motion.button>

            <motion.button
              className={`p-2 ${repeatMode !== 'off' ? 'text-purple-400' : 'text-white/50'}`}
              onClick={() => {
                const modes: Array<'off' | 'all' | 'one'> = ['off', 'all', 'one'];
                const currentIndex = modes.indexOf(repeatMode);
                setRepeatMode(modes[(currentIndex + 1) % modes.length]);
              }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <Repeat className="w-5 h-5" />
              {repeatMode === 'one' && (
                <span className="absolute text-[8px] font-bold">1</span>
              )}
            </motion.button>
          </div>

          {/* Bottom Controls */}
          <div className="flex items-center justify-between px-8 py-4 pb-8">
            {/* Volume */}
            <div className="flex items-center gap-2 flex-1">
              <Volume2 className="w-5 h-5 text-white/50" />
              <div
                className="w-20 h-1 bg-white/20 rounded-full cursor-pointer"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const newVolume = ((e.clientX - rect.left) / rect.width) * 100;
                  setVolume(Math.max(0, Math.min(100, newVolume)));
                }}
              >
                <div
                  className="h-full bg-white/50 rounded-full"
                  style={{ width: `${volume}%` }}
                />
              </div>
            </div>

            {/* Queue */}
            <motion.button
              className="p-2 text-white/50"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
            >
              <ListMusic className="w-6 h-6" />
            </motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default NowPlaying;
