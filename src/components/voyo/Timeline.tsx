/**
 * VOYO Music - Timeline Component (Premium Version)
 * Horizontal scrollable timeline: Past ← Current → Queue
 * With fluid animations, depth, and micro-interactions
 */

import { useRef, useEffect } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { Plus, Play } from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { getYouTubeThumbnail } from '../../data/tracks';
import { Track } from '../../types';

// Spring configs
const springs = {
  gentle: { type: 'spring', stiffness: 120, damping: 14 },
  snappy: { type: 'spring', stiffness: 400, damping: 30 },
  bouncy: { type: 'spring', stiffness: 300, damping: 10 },
};

// Timeline Card - Premium Version
const TimelineCard = ({
  track,
  isCurrent = false,
  isPast = false,
  onClick,
}: {
  track: Track;
  isCurrent?: boolean;
  isPast?: boolean;
  onClick: () => void;
}) => {
  const controls = useAnimation();
  const { isPlaying } = usePlayerStore();

  // Breathing animation for current track when playing
  useEffect(() => {
    if (isCurrent && isPlaying) {
      controls.start({
        scale: [1, 1.02, 1],
        transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' }
      });
    } else {
      controls.start({ scale: 1 });
    }
  }, [isCurrent, isPlaying, controls]);

  return (
    <motion.button
      className="relative flex-shrink-0 flex flex-col items-center"
      onClick={onClick}
      animate={controls}
      whileHover={{ scale: isCurrent ? 1.02 : 1.08, y: -4 }}
      whileTap={{ scale: 0.95 }}
      transition={springs.snappy}
    >
      {/* Card Container */}
      <motion.div
        className={`
          relative overflow-hidden
          ${isCurrent ? 'w-32 h-40 rounded-2xl' : 'w-20 h-28 rounded-xl'}
        `}
        style={{
          boxShadow: isCurrent
            ? '0 8px 40px rgba(168,85,247,0.4), 0 0 0 2px rgba(168,85,247,0.6), 0 20px 40px rgba(0,0,0,0.4)'
            : isPast
              ? '0 4px 20px rgba(0,0,0,0.3)'
              : '0 4px 20px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.05)',
          filter: isPast ? 'saturate(0.6) brightness(0.8)' : 'none',
        }}
        whileHover={{
          boxShadow: isCurrent
            ? '0 12px 50px rgba(168,85,247,0.5), 0 0 0 2px rgba(168,85,247,0.8), 0 25px 50px rgba(0,0,0,0.5)'
            : '0 8px 30px rgba(168,85,247,0.3), 0 0 0 1px rgba(168,85,247,0.3)',
        }}
      >
        {/* Cover Image */}
        <img
          src={getYouTubeThumbnail(track.youtubeVideoId, isCurrent ? 'high' : 'medium')}
          alt={track.title}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = getYouTubeThumbnail(track.youtubeVideoId, 'medium');
          }}
        />

        {/* Gradient Overlay */}
        <div
          className="absolute inset-0"
          style={{
            background: isCurrent
              ? 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.3) 40%, transparent 70%)'
              : 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.2) 50%, transparent 100%)',
          }}
        />

        {/* Purple glow overlay for current */}
        {isCurrent && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'linear-gradient(135deg, rgba(168,85,247,0.1) 0%, transparent 50%, rgba(236,72,153,0.1) 100%)',
            }}
            animate={{
              opacity: isPlaying ? [0.3, 0.6, 0.3] : 0.3,
            }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}

        {/* Track Info */}
        <div className={`absolute bottom-0 left-0 right-0 ${isCurrent ? 'p-3' : 'p-2'}`}>
          <p className={`text-white font-semibold truncate ${isCurrent ? 'text-sm' : 'text-[10px]'}`}>
            {track.title}
          </p>
          <p className={`text-white/60 truncate ${isCurrent ? 'text-xs' : 'text-[8px]'}`}>
            {track.artist}
          </p>
        </div>

        {/* Playing Indicator for Current */}
        {isCurrent && (
          <motion.div
            className="absolute top-2 right-2"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={springs.bouncy}
          >
            <motion.div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
                boxShadow: '0 2px 10px rgba(168,85,247,0.5)',
              }}
              animate={isPlaying ? { scale: [1, 1.1, 1] } : {}}
              transition={{ duration: 1, repeat: Infinity }}
            >
              {isPlaying ? (
                <div className="flex gap-0.5 items-end h-3">
                  {[1, 2, 3].map((i) => (
                    <motion.div
                      key={i}
                      className="w-[3px] bg-white rounded-full"
                      animate={{ height: ['4px', '12px', '4px'] }}
                      transition={{ duration: 0.4, repeat: Infinity, delay: i * 0.1 }}
                    />
                  ))}
                </div>
              ) : (
                <Play className="w-4 h-4 text-white ml-0.5" fill="white" />
              )}
            </motion.div>
          </motion.div>
        )}

        {/* Hover play overlay for non-current */}
        {!isCurrent && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center bg-black/40"
            initial={{ opacity: 0 }}
            whileHover={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center"
              whileHover={{ scale: 1.1, backgroundColor: 'rgba(255,255,255,0.3)' }}
            >
              <Play className="w-5 h-5 text-white ml-0.5" fill="white" />
            </motion.div>
          </motion.div>
        )}
      </motion.div>

      {/* Label below card */}
      {!isCurrent && (
        <motion.p
          className="mt-1.5 text-[9px] text-white/40 uppercase tracking-wider"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {isPast ? 'played' : 'next'}
        </motion.p>
      )}
    </motion.button>
  );
};

// Add Button - Premium
const AddButton = () => (
  <motion.button
    className="flex-shrink-0 flex flex-col items-center"
    whileHover={{ scale: 1.1, y: -4 }}
    whileTap={{ scale: 0.95 }}
    transition={springs.snappy}
  >
    <motion.div
      className="w-16 h-24 rounded-xl flex items-center justify-center"
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
        border: '2px dashed rgba(255,255,255,0.15)',
        boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
      }}
      whileHover={{
        borderColor: 'rgba(168,85,247,0.5)',
        background: 'linear-gradient(135deg, rgba(168,85,247,0.1) 0%, rgba(236,72,153,0.05) 100%)',
        boxShadow: '0 4px 25px rgba(168,85,247,0.2)',
      }}
    >
      <Plus className="w-6 h-6 text-white/30" />
    </motion.div>
    <p className="mt-1.5 text-[9px] text-white/30 uppercase tracking-wider">add</p>
  </motion.button>
);

export const Timeline = () => {
  const { currentTrack, history, queue, setCurrentTrack, isPlaying } = usePlayerStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Get last 3 from history
  const pastTracks = history.slice(-3).map(h => h.track).reverse();

  // Get next 3 from queue
  const queueTracks = queue.slice(0, 3).map(q => q.track);

  // Auto-scroll to center (current track) on mount and track change
  useEffect(() => {
    if (scrollRef.current) {
      const container = scrollRef.current;
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        const scrollCenter = container.scrollWidth / 2 - container.clientWidth / 2;
        container.scrollTo({ left: scrollCenter, behavior: 'smooth' });
      }, 100);
    }
  }, [currentTrack?.id]);

  return (
    <motion.div
      className="relative w-full py-4"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springs.gentle}
    >
      {/* Fade edges with gradient */}
      <div
        className="absolute left-0 top-0 bottom-0 w-12 z-10 pointer-events-none"
        style={{
          background: 'linear-gradient(to right, #08080c 0%, transparent 100%)',
        }}
      />
      <div
        className="absolute right-0 top-0 bottom-0 w-12 z-10 pointer-events-none"
        style={{
          background: 'linear-gradient(to left, #08080c 0%, transparent 100%)',
        }}
      />

      {/* Scrollable Timeline */}
      <div
        ref={scrollRef}
        className="flex items-end gap-4 overflow-x-auto scrollbar-hide px-10 pb-2"
        style={{
          scrollSnapType: 'x mandatory',
          scrollBehavior: 'smooth',
        }}
      >
        {/* Past Tracks */}
        <AnimatePresence mode="popLayout">
          {pastTracks.map((track, index) => (
            <motion.div
              key={`past-${track.id}-${index}`}
              initial={{ opacity: 0, scale: 0.8, x: -20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.8, x: -20 }}
              transition={{ ...springs.gentle, delay: index * 0.05 }}
              style={{ scrollSnapAlign: 'center' }}
            >
              <TimelineCard
                track={track}
                isPast
                onClick={() => setCurrentTrack(track)}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Spacer if no past tracks */}
        {pastTracks.length === 0 && (
          <div className="flex gap-4">
            {[1, 2].map((i) => (
              <motion.div
                key={`empty-past-${i}`}
                className="w-20 h-28 rounded-xl flex-shrink-0"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
                  border: '1px dashed rgba(255,255,255,0.08)',
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
              />
            ))}
          </div>
        )}

        {/* Current Track (Center, Bigger) */}
        {currentTrack && (
          <motion.div
            key={`current-${currentTrack.id}`}
            className="flex-shrink-0"
            style={{ scrollSnapAlign: 'center' }}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={springs.bouncy}
          >
            <TimelineCard
              track={currentTrack}
              isCurrent
              onClick={() => {}}
            />
          </motion.div>
        )}

        {/* Queue Tracks */}
        <AnimatePresence mode="popLayout">
          {queueTracks.map((track, index) => (
            <motion.div
              key={`queue-${track.id}-${index}`}
              initial={{ opacity: 0, scale: 0.8, x: 20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.8, x: 20 }}
              transition={{ ...springs.gentle, delay: index * 0.05 }}
              style={{ scrollSnapAlign: 'center' }}
            >
              <TimelineCard
                track={track}
                onClick={() => setCurrentTrack(track)}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Add to Queue Button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          style={{ scrollSnapAlign: 'center' }}
        >
          <AddButton />
        </motion.div>
      </div>
    </motion.div>
  );
};

export default Timeline;
