/**
 * VOYO Portrait Player - OG Vision EXACT
 *
 * TOP SECTION:
 * - LEFT: 2 small album cards (stacked vertically or side by side)
 * - CENTER: BIG now playing card (the hero)
 * - RIGHT: 1 small card + "+" add button
 *
 * PLAY CONTROLS: Large circular button with purple gradient ring
 * REACTIONS: OYO⚡ | OYÉÉ | Wazzguán | 🔥Fireee
 * BOTTOM: HOT | VOYO | DISCOVERY with track cards
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipBack, SkipForward, Plus, Zap } from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { getYouTubeThumbnail } from '../../data/tracks';
import { Track } from '../../types';

// Spring configs
const springs = {
  gentle: { type: 'spring', stiffness: 120, damping: 14 },
  snappy: { type: 'spring', stiffness: 400, damping: 30 },
  bouncy: { type: 'spring', stiffness: 300, damping: 10 },
};

// ============================================
// SMALL TRACK CARD
// ============================================
const SmallCard = ({
  track,
  onTap,
  label
}: {
  track: Track;
  onTap: () => void;
  label?: string;
}) => (
  <motion.button
    className="flex flex-col items-center"
    onClick={onTap}
    whileHover={{ scale: 1.05, y: -2 }}
    whileTap={{ scale: 0.95 }}
    transition={springs.snappy}
  >
    <div
      className="w-16 h-16 rounded-xl overflow-hidden mb-1.5"
      style={{
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      <img
        src={getYouTubeThumbnail(track.youtubeVideoId, 'medium')}
        alt={track.title}
        className="w-full h-full object-cover"
      />
    </div>
    <p className="text-white text-[10px] font-medium truncate w-16 text-center">
      {track.title}
    </p>
    <p className="text-white/50 text-[8px] truncate w-16 text-center">
      {track.artist}
    </p>
  </motion.button>
);

// ============================================
// ADD BUTTON
// ============================================
const AddButton = () => (
  <motion.button
    className="flex flex-col items-center"
    whileHover={{ scale: 1.1 }}
    whileTap={{ scale: 0.95 }}
    transition={springs.snappy}
  >
    <div
      className="w-16 h-16 rounded-xl flex items-center justify-center"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.1)',
      }}
    >
      <Plus className="w-6 h-6 text-white/40" />
    </div>
  </motion.button>
);

// ============================================
// BIG CENTER CARD (NOW PLAYING - THE HERO)
// ============================================
const BigCenterCard = ({ track, isPlaying }: { track: Track; isPlaying: boolean }) => {
  return (
    <motion.div
      className="relative w-full rounded-2xl overflow-hidden"
      style={{
        aspectRatio: '1/1.1',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)',
      }}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={springs.gentle}
    >
      {/* Album Art */}
      <img
        src={getYouTubeThumbnail(track.youtubeVideoId, 'high')}
        alt={track.title}
        className="w-full h-full object-cover"
      />

      {/* Gradient Overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.3) 40%, transparent 70%)',
        }}
      />

      {/* Track Info */}
      <div className="absolute bottom-0 left-0 right-0 p-4 text-center">
        <motion.h2
          className="text-white font-bold text-lg mb-0.5"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {track.title}
        </motion.h2>
        <motion.p
          className="text-white/60 text-sm"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          {track.artist}
        </motion.p>
      </div>
    </motion.div>
  );
};

// ============================================
// PLAY CONTROLS - LARGE CIRCULAR WITH PURPLE RING
// ============================================
const PlayControls = ({
  isPlaying,
  onToggle,
  onPrev,
  onNext,
}: {
  isPlaying: boolean;
  onToggle: () => void;
  onPrev: () => void;
  onNext: () => void;
}) => {
  return (
    <motion.div
      className="flex items-center justify-center gap-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, ...springs.gentle }}
    >
      {/* Previous */}
      <motion.button
        onClick={onPrev}
        className="p-3"
        whileHover={{ scale: 1.15 }}
        whileTap={{ scale: 0.9 }}
        transition={springs.snappy}
      >
        <SkipBack className="w-7 h-7 text-white/80" fill="white" fillOpacity={0.8} />
      </motion.button>

      {/* Play/Pause - Large with purple gradient ring */}
      <motion.button
        onClick={onToggle}
        className="relative w-28 h-28 rounded-full flex items-center justify-center"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        transition={springs.snappy}
      >
        {/* Purple gradient ring */}
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            background: 'conic-gradient(from 180deg, #a855f7 0%, #ec4899 50%, #a855f7 100%)',
            padding: '3px',
          }}
          animate={isPlaying ? { rotate: 360 } : {}}
          transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
        >
          <div className="w-full h-full rounded-full bg-[#0a0a0f]" />
        </motion.div>

        {/* Inner content with waveform/icon */}
        <div className="relative z-10 flex items-center justify-center">
          {isPlaying ? (
            <div className="flex items-center gap-1">
              {/* Waveform bars */}
              {[1, 2, 3, 4, 5].map((i) => (
                <motion.div
                  key={i}
                  className="w-1 bg-white/80 rounded-full"
                  animate={{
                    height: ['8px', '24px', '8px'],
                  }}
                  transition={{
                    duration: 0.6,
                    repeat: Infinity,
                    delay: i * 0.1,
                    ease: 'easeInOut'
                  }}
                />
              ))}
              {/* Pause icon overlaid */}
              <div className="absolute inset-0 flex items-center justify-center">
                <Pause className="w-10 h-10 text-white" fill="white" />
              </div>
            </div>
          ) : (
            <Play className="w-10 h-10 text-white ml-1" fill="white" />
          )}
        </div>
      </motion.button>

      {/* Next */}
      <motion.button
        onClick={onNext}
        className="p-3"
        whileHover={{ scale: 1.15 }}
        whileTap={{ scale: 0.9 }}
        transition={springs.snappy}
      >
        <SkipForward className="w-7 h-7 text-white/80" fill="white" fillOpacity={0.8} />
      </motion.button>
    </motion.div>
  );
};

// ============================================
// REACTIONS
// ============================================
const ReactionButtons = () => {
  const reactions = [
    { id: 'oyo', label: 'OYO', icon: <Zap className="w-4 h-4 text-yellow-400" />, hasIcon: true },
    { id: 'oye', label: 'OYÉÉ', icon: null, hasIcon: false },
    { id: 'wazzguan', label: 'Wazzguán', icon: null, hasIcon: false },
    { id: 'fire', label: 'Fireee', icon: <span>🔥</span>, hasIcon: true },
  ];

  return (
    <motion.div
      className="flex items-center justify-center gap-3 px-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, ...springs.gentle }}
    >
      {reactions.map((r) => (
        <motion.button
          key={r.id}
          className="px-4 py-2.5 rounded-full flex items-center gap-1.5"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.12)',
          }}
          whileHover={{ scale: 1.05, backgroundColor: 'rgba(255,255,255,0.1)' }}
          whileTap={{ scale: 0.95 }}
          transition={springs.snappy}
        >
          {r.hasIcon && r.icon}
          <span className="text-white text-sm font-medium">{r.label}</span>
        </motion.button>
      ))}
    </motion.div>
  );
};

// ============================================
// BOTTOM SECTION - HOT | VOYO | DISCOVERY
// ============================================
const BottomSection = ({
  hotTracks,
  discoverTracks,
  onTrackSelect,
  onVoyoFeed
}: {
  hotTracks: Track[];
  discoverTracks: Track[];
  onTrackSelect: (track: Track) => void;
  onVoyoFeed: () => void;
}) => {
  const [activeTab, setActiveTab] = useState<'hot' | 'voyo' | 'discovery'>('voyo');

  const MiniCard = ({ track }: { track: Track }) => (
    <motion.button
      className="flex flex-col items-center"
      onClick={() => onTrackSelect(track)}
      whileHover={{ scale: 1.08, y: -2 }}
      whileTap={{ scale: 0.95 }}
      transition={springs.snappy}
    >
      <div
        className="w-16 h-16 rounded-xl overflow-hidden mb-1.5"
        style={{
          boxShadow: '0 4px 15px rgba(0,0,0,0.4)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <img
          src={getYouTubeThumbnail(track.youtubeVideoId, 'medium')}
          alt={track.title}
          className="w-full h-full object-cover"
        />
      </div>
      <p className="text-white text-[10px] font-medium truncate w-16 text-center">{track.title}</p>
      <p className="text-white/50 text-[8px] truncate w-16 text-center">{track.artist}</p>
    </motion.button>
  );

  return (
    <motion.div
      className="rounded-t-3xl pt-4 pb-2 px-4"
      style={{
        background: 'linear-gradient(180deg, rgba(20,20,28,0.98) 0%, rgba(10,10,14,1) 100%)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}
      initial={{ y: 50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.2, ...springs.gentle }}
    >
      {/* Tabs - HOT | VOYO | DISCOVERY */}
      <div className="flex items-center justify-center gap-8 mb-4">
        {(['hot', 'voyo', 'discovery'] as const).map((tab) => (
          <motion.button
            key={tab}
            className="relative py-1"
            onClick={() => setActiveTab(tab)}
            whileTap={{ scale: 0.95 }}
          >
            <span className={`
              font-bold uppercase tracking-wide transition-all duration-200
              ${tab === 'voyo' ? 'text-lg' : 'text-sm'}
              ${activeTab === tab ? 'text-white' : 'text-white/30'}
            `}>
              {tab}
            </span>
            {activeTab === tab && tab !== 'voyo' && (
              <motion.div
                className="absolute -bottom-1 left-0 right-0 h-0.5 rounded-full"
                style={{ background: 'linear-gradient(90deg, #a855f7, #ec4899)' }}
                layoutId="bottomTabIndicator"
                transition={springs.snappy}
              />
            )}
          </motion.button>
        ))}
      </div>

      {/* Content Row */}
      <div className="flex items-start justify-between gap-2">
        {/* HOT Tracks (left) */}
        <div className="flex gap-3">
          {hotTracks.slice(0, 2).map((track) => (
            <MiniCard key={track.id} track={track} />
          ))}
        </div>

        {/* VOYO FEED (center) */}
        <motion.button
          className="flex-shrink-0"
          onClick={onVoyoFeed}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          transition={springs.bouncy}
        >
          <div
            className="w-16 h-16 rounded-2xl flex flex-col items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(168,85,247,0.15) 0%, rgba(236,72,153,0.1) 100%)',
              border: '2px dashed rgba(168,85,247,0.4)',
            }}
          >
            <span className="text-white font-black text-[10px]">VOYO</span>
            <span className="text-white/40 text-[8px]">FEED</span>
          </div>
        </motion.button>

        {/* DISCOVERY Tracks (right) */}
        <div className="flex gap-3">
          {discoverTracks.slice(0, 2).map((track) => (
            <MiniCard key={track.id} track={track} />
          ))}
        </div>
      </div>

      {/* Bottom row - more tracks */}
      <div className="flex items-center justify-between mt-4 px-2">
        {hotTracks.slice(2, 3).map((track) => (
          <motion.button
            key={track.id}
            className="flex items-center gap-3"
            onClick={() => onTrackSelect(track)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="w-14 h-14 rounded-xl overflow-hidden">
              <img
                src={getYouTubeThumbnail(track.youtubeVideoId, 'medium')}
                alt={track.title}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="text-left">
              <p className="text-white text-sm font-medium">{track.title}</p>
              <p className="text-white/50 text-xs">{track.artist}</p>
            </div>
          </motion.button>
        ))}
        {discoverTracks.slice(2, 3).map((track) => (
          <motion.button
            key={track.id}
            className="flex items-center gap-3"
            onClick={() => onTrackSelect(track)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="w-14 h-14 rounded-xl overflow-hidden">
              <img
                src={getYouTubeThumbnail(track.youtubeVideoId, 'medium')}
                alt={track.title}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="text-left">
              <p className="text-white text-sm font-medium">{track.title}</p>
              <p className="text-white/50 text-xs">{track.artist}</p>
            </div>
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================
export const VoyoPortraitPlayer = ({
  onVoyoFeed,
  djMode = false,
  onToggleDJMode
}: {
  onVoyoFeed: () => void;
  djMode?: boolean;
  onToggleDJMode?: () => void;
}) => {
  const {
    currentTrack,
    isPlaying,
    queue,
    history,
    hotTracks,
    discoverTracks,
    togglePlayPause,
    skipToNext,
    skipToPrevious,
    setCurrentTrack,
  } = usePlayerStore();

  // Get tracks for left/right sides
  const leftTracks = history.slice(-2).map(h => h.track).reverse();
  const rightTracks = queue.slice(0, 1).map(q => q.track);

  // Fill with hot/discover if needed
  const displayLeftTracks = leftTracks.length >= 2
    ? leftTracks
    : [...leftTracks, ...hotTracks.slice(0, 2 - leftTracks.length)];

  const displayRightTracks = rightTracks.length >= 1
    ? rightTracks
    : discoverTracks.slice(0, 1);

  return (
    <motion.div
      className="flex flex-col h-full pb-20 relative overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #0a0a0f 0%, #0f0f15 50%, #08080c 100%)',
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      {/* TOP SECTION - Cards Layout */}
      <div className="px-4 pt-4 pb-3">
        <div
          className="rounded-2xl p-4"
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.05)',
          }}
        >
          <div className="flex items-end justify-between gap-3">
            {/* LEFT - 2 small cards */}
            <div className="flex gap-2">
              {displayLeftTracks.slice(0, 2).map((track, i) => (
                <SmallCard
                  key={track.id + i}
                  track={track}
                  onTap={() => setCurrentTrack(track)}
                />
              ))}
            </div>

            {/* CENTER - BIG card */}
            <div className="flex-1 max-w-[180px]">
              {currentTrack ? (
                <BigCenterCard track={currentTrack} isPlaying={isPlaying} />
              ) : (
                <div
                  className="w-full rounded-2xl flex items-center justify-center"
                  style={{
                    aspectRatio: '1/1.1',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px dashed rgba(255,255,255,0.1)',
                  }}
                >
                  <Play className="w-10 h-10 text-white/20" />
                </div>
              )}
            </div>

            {/* RIGHT - 1 small card + add button */}
            <div className="flex gap-2">
              {displayRightTracks.map((track, i) => (
                <SmallCard
                  key={track.id + i}
                  track={track}
                  onTap={() => setCurrentTrack(track)}
                />
              ))}
              <AddButton />
            </div>
          </div>
        </div>
      </div>

      {/* PLAY CONTROLS */}
      <div className="py-6">
        <PlayControls
          isPlaying={isPlaying}
          onToggle={togglePlayPause}
          onPrev={skipToPrevious}
          onNext={skipToNext}
        />
      </div>

      {/* REACTIONS */}
      <div className="py-2">
        <ReactionButtons />
      </div>

      {/* SPACER */}
      <div className="flex-1" />

      {/* BOTTOM SECTION */}
      <BottomSection
        hotTracks={hotTracks}
        discoverTracks={discoverTracks}
        onTrackSelect={setCurrentTrack}
        onVoyoFeed={onVoyoFeed}
      />
    </motion.div>
  );
};

export default VoyoPortraitPlayer;
