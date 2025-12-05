// VOYO Music - Curved Roulette Recommendation Zone
// Two half-circle arcs like music notes swirling - HOT on left, DISCOVER on right
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, animate } from 'framer-motion';
import { Flame, Sparkles, ChevronUp } from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { Track } from '../../types';
import { getYouTubeThumbnail } from '../../data/tracks';

// Single circular track item
const RouletteTrack = ({
  track,
  index,
  totalTracks,
  rotation,
  radius,
  isLeft,
  accentColor,
  onSelect,
}: {
  track: Track;
  index: number;
  totalTracks: number;
  rotation: number;
  radius: number;
  isLeft: boolean;
  accentColor: string;
  onSelect: (track: Track) => void;
}) => {
  // Calculate position on the arc
  const arcSpan = 140; // degrees
  const startAngle = isLeft ? 200 : -20; // Starting angle for left/right
  const anglePerTrack = arcSpan / Math.max(totalTracks - 1, 1);
  const baseAngle = startAngle + (index * anglePerTrack) + rotation;
  const angleRad = (baseAngle * Math.PI) / 180;

  // Position on circle
  const x = Math.cos(angleRad) * radius;
  const y = Math.sin(angleRad) * radius;

  // Scale based on position (items at center of arc are bigger)
  const normalizedAngle = ((baseAngle % 360) + 360) % 360;
  const centerAngle = isLeft ? 270 : 270;
  const distanceFromCenter = Math.abs(normalizedAngle - centerAngle);
  const scale = Math.max(0.5, 1 - (distanceFromCenter / 100) * 0.5);
  const opacity = Math.max(0.3, 1 - (distanceFromCenter / 100) * 0.7);
  const zIndex = Math.round((1 - distanceFromCenter / 70) * 10);

  // Is this the "selected" one (closest to center)?
  const isSelected = distanceFromCenter < 20;

  return (
    <motion.button
      className="absolute"
      style={{
        left: '50%',
        top: '50%',
        x: x - 28, // center the 56px circle
        y: y - 28,
        scale,
        opacity,
        zIndex,
      }}
      onClick={() => onSelect(track)}
      whileHover={{ scale: scale * 1.2 }}
      whileTap={{ scale: scale * 0.9 }}
    >
      <div
        className={`
          w-14 h-14 rounded-full overflow-hidden transition-all duration-200
          ${isSelected ? 'shadow-lg' : 'ring-1 ring-white/20'}
        `}
        style={{
          boxShadow: isSelected ? `0 0 20px ${accentColor}50, 0 0 0 2px ${accentColor}` : undefined,
        }}
      >
        <img
          src={getYouTubeThumbnail(track.youtubeVideoId, 'high')}
          alt={track.title}
          className="w-full h-full object-cover"
        />
        {isSelected && (
          <div
            className="absolute inset-0 flex items-center justify-center bg-black/40"
          >
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center"
              style={{ backgroundColor: accentColor }}
            >
              <div className="w-0 h-0 border-l-[5px] border-l-white border-y-[3px] border-y-transparent ml-0.5" />
            </div>
          </div>
        )}
      </div>
    </motion.button>
  );
};

// Curved Roulette Arc
const CurvedRoulette = ({
  tracks,
  isLeft,
  label,
  accentColor,
  onTrackSelect,
}: {
  tracks: Track[];
  isLeft: boolean;
  label: string;
  accentColor: string;
  onTrackSelect: (track: Track) => void;
}) => {
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const lastY = useRef(0);
  const velocity = useRef(0);
  const animationRef = useRef<number | undefined>(undefined);

  const radius = 120;

  // Handle drag
  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    lastY.current = e.clientY;
    velocity.current = 0;
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const deltaY = e.clientY - lastY.current;
    velocity.current = deltaY;
    setRotation((r) => r + deltaY * 0.5);
    lastY.current = e.clientY;
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    // Apply momentum
    const decelerate = () => {
      velocity.current *= 0.95;
      if (Math.abs(velocity.current) > 0.5) {
        setRotation((r) => r + velocity.current * 0.3);
        animationRef.current = requestAnimationFrame(decelerate);
      }
    };
    decelerate();
  };

  return (
    <div
      className={`relative ${isLeft ? 'mr-auto' : 'ml-auto'}`}
      style={{ width: 200, height: 200 }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* Label */}
      <div
        className={`absolute ${isLeft ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 flex flex-col items-center gap-1`}
      >
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center"
          style={{
            background: `linear-gradient(135deg, ${accentColor}30, ${accentColor}10)`,
            border: `1px solid ${accentColor}40`,
          }}
        >
          {isLeft ? (
            <Flame className="w-5 h-5" style={{ color: accentColor }} />
          ) : (
            <Sparkles className="w-5 h-5" style={{ color: accentColor }} />
          )}
        </div>
        <span className="text-[10px] font-bold uppercase" style={{ color: accentColor }}>
          {label}
        </span>
      </div>

      {/* Arc visual guide */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none opacity-10"
        viewBox="-100 -100 200 200"
      >
        <circle
          cx="0"
          cy="0"
          r={radius}
          fill="none"
          stroke={accentColor}
          strokeWidth="1"
          strokeDasharray="4,4"
        />
      </svg>

      {/* Track circles */}
      {tracks.slice(0, 7).map((track, index) => (
        <RouletteTrack
          key={track.id}
          track={track}
          index={index}
          totalTracks={Math.min(tracks.length, 7)}
          rotation={rotation}
          radius={radius}
          isLeft={isLeft}
          accentColor={accentColor}
          onSelect={onTrackSelect}
        />
      ))}

      {/* Drag hint */}
      <motion.div
        className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[8px] text-white/30"
        animate={{ y: [0, 3, 0] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        drag to spin
      </motion.div>
    </div>
  );
};

export const RecommendationZone = ({ onVoyoFeedTap }: { onVoyoFeedTap?: () => void }) => {
  const {
    hotTracks,
    discoverTracks,
    setCurrentTrack,
  } = usePlayerStore();

  const handleTrackSelect = (track: Track) => {
    setCurrentTrack(track);
  };

  return (
    <div className="w-full px-2">
      {/* THREE COLUMN LAYOUT: HOT | VOYO FEED | DISCOVER */}
      <div className="flex items-start gap-2">
        {/* HOT COLUMN - Left */}
        <div className="flex-1">
          <div className="flex items-center gap-1 mb-1.5">
            <Flame className="w-3 h-3 text-red-400" />
            <span className="text-[10px] font-bold text-red-400 uppercase">Hot</span>
          </div>
          <div className="flex flex-col gap-1.5">
            {hotTracks.slice(0, 3).map((track) => (
              <motion.button
                key={track.id}
                className="group"
                onClick={() => handleTrackSelect(track)}
                whileTap={{ scale: 0.95 }}
              >
                <div className="w-full h-12 rounded-lg overflow-hidden ring-1 ring-red-500/30">
                  <img
                    src={getYouTubeThumbnail(track.youtubeVideoId, 'medium')}
                    alt={track.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              </motion.button>
            ))}
          </div>
        </div>

        {/* VOYO FEED CENTER - The Bridge */}
        <motion.button
          className="flex-shrink-0 w-20"
          onClick={onVoyoFeedTap}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
              <span className="text-white font-black text-sm">VOYO</span>
            </div>
            <span className="text-[8px] text-white/50 mt-1 uppercase tracking-wider">Feed</span>
          </div>
        </motion.button>

        {/* DISCOVER COLUMN - Right */}
        <div className="flex-1">
          <div className="flex items-center justify-end gap-1 mb-1.5">
            <span className="text-[10px] font-bold text-purple-400 uppercase">Discover</span>
            <Sparkles className="w-3 h-3 text-purple-400" />
          </div>
          <div className="flex flex-col gap-1.5">
            {discoverTracks.slice(0, 3).map((track) => (
              <motion.button
                key={track.id}
                className="group"
                onClick={() => handleTrackSelect(track)}
                whileTap={{ scale: 0.95 }}
              >
                <div className="w-full h-12 rounded-lg overflow-hidden ring-1 ring-purple-500/30">
                  <img
                    src={getYouTubeThumbnail(track.youtubeVideoId, 'medium')}
                    alt={track.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
