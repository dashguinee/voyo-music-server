/**
 * VOYO Vertical Feed - TikTok-style Cultural Feed
 * The heart of VOYO OYÉ - African culture in motion
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, MessageCircle, Share2, Music2, Zap, Bookmark, MoreHorizontal, Volume2, VolumeX } from 'lucide-react';
import { FeedItem } from '../../../types';

// Mock clips for demo - Real content will come from API
const MOCK_CLIPS: FeedItem[] = [
  {
    id: '1',
    user: 'accra_vibes',
    userAvatar: 'https://i.pravatar.cc/100?img=1',
    caption: 'New challenge alert! Show me your best moves 🇬🇭 #GhanaToTheWorld #OYE',
    likes: '12.4k',
    oyes: '45k OYÉ',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-girl-dancing-in-front-of-a-colorful-wall-39755-large.mp4',
    songTitle: 'Terminator',
    songArtist: 'King Promise',
    tags: ['dance', 'ghana', 'afrobeats'],
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    user: 'lagos_heat',
    userAvatar: 'https://i.pravatar.cc/100?img=2',
    caption: 'OYÉ! Look at this footwork! Lagos no dey carry last 🇳🇬🔥 #Naija #WeMoveee',
    likes: '45.2k',
    oyes: '120k OYÉ',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-man-dancing-under-colored-lights-1240-large.mp4',
    songTitle: 'Unavailable',
    songArtist: 'Davido ft. Musa Keys',
    tags: ['naija', 'amapiano', 'vibes'],
    createdAt: new Date().toISOString(),
  },
  {
    id: '3',
    user: 'dakar_flow',
    userAvatar: 'https://i.pravatar.cc/100?img=3',
    caption: 'Senegal represent! 🇸🇳 This sound is everything #Mbalax #AfricanVibes',
    likes: '28.7k',
    oyes: '89k OYÉ',
    videoUrl: 'https://assets.mixkit.co/videos/preview/mixkit-woman-dancing-freely-at-a-concert-4489-large.mp4',
    songTitle: 'Waka Waka',
    songArtist: 'Shakira ft. Freshlyground',
    tags: ['senegal', 'dance', 'africa'],
    createdAt: new Date().toISOString(),
  },
];

// Floating OYÉ Reaction Component
const FloatingOye = ({ id, onComplete }: { id: number; onComplete: () => void }) => (
  <motion.div
    className="fixed text-2xl pointer-events-none z-50"
    style={{
      right: `${15 + Math.random() * 10}%`,
      bottom: '20%',
    }}
    initial={{ opacity: 1, y: 0, scale: 0.5 }}
    animate={{
      opacity: [1, 1, 0],
      y: -200 - Math.random() * 100,
      scale: [0.5, 1.2, 0.8],
      x: (Math.random() - 0.5) * 50,
    }}
    transition={{ duration: 2 + Math.random(), ease: 'easeOut' }}
    onAnimationComplete={onComplete}
  >
    ⚡
  </motion.div>
);

// Single Feed Item Component
const FeedItemCard = ({
  item,
  isActive,
  isMuted,
  onToggleMute,
}: {
  item: FeedItem;
  isActive: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [oyeCount, setOyeCount] = useState(0);
  const [floatingOyes, setFloatingOyes] = useState<number[]>([]);

  // Play/pause based on active state
  useEffect(() => {
    if (videoRef.current) {
      if (isActive) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
    }
  }, [isActive]);

  // Handle OYÉ reaction
  const handleOye = () => {
    setOyeCount((prev) => prev + 1);
    // Add multiple floating reactions
    const newOyes = Array.from({ length: 3 + Math.floor(Math.random() * 3) }, () => Date.now() + Math.random());
    setFloatingOyes((prev) => [...prev, ...newOyes]);
  };

  const removeFloatingOye = (id: number) => {
    setFloatingOyes((prev) => prev.filter((oyeId) => oyeId !== id));
  };

  return (
    <div className="relative w-full h-full snap-start snap-always">
      {/* Background Video */}
      <video
        ref={videoRef}
        src={item.videoUrl}
        className="absolute inset-0 w-full h-full object-cover"
        loop
        muted={isMuted}
        playsInline
        webkit-playsinline="true"
      />

      {/* Gradient overlays - CINEMATIC */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-black/40" />

      {/* Mute Button */}
      <motion.button
        className="absolute top-4 right-4 p-2 rounded-full bg-black/40 backdrop-blur-sm"
        onClick={onToggleMute}
        whileTap={{ scale: 0.9 }}
      >
        {isMuted ? (
          <VolumeX className="w-5 h-5 text-white" />
        ) : (
          <Volume2 className="w-5 h-5 text-white" />
        )}
      </motion.button>

      {/* Right Side Controls */}
      <div className="absolute right-3 bottom-32 flex flex-col gap-5 items-center">
        {/* User Avatar */}
        <motion.div className="relative" whileHover={{ scale: 1.1 }}>
          <div className="w-12 h-12 rounded-full border-2 border-white overflow-hidden">
            <img
              src={item.userAvatar || `https://i.pravatar.cc/100?u=${item.user}`}
              alt={item.user}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center">
            <span className="text-white text-xs">+</span>
          </div>
        </motion.div>

        {/* Like Button */}
        <motion.button
          className="flex flex-col items-center gap-1"
          onClick={() => setIsLiked(!isLiked)}
          whileTap={{ scale: 0.8 }}
        >
          <div className="p-2.5 rounded-full bg-black/30 backdrop-blur-sm">
            <Heart
              className={`w-7 h-7 ${isLiked ? 'text-red-500 fill-red-500' : 'text-white'}`}
            />
          </div>
          <span className="text-xs font-bold text-white">{item.likes}</span>
        </motion.button>

        {/* OYÉ Button - The Main Reaction */}
        <motion.button
          className="flex flex-col items-center gap-1"
          onClick={handleOye}
          whileTap={{ scale: 0.8 }}
        >
          <motion.div
            className="p-2.5 rounded-full bg-gradient-to-br from-yellow-400 via-orange-500 to-red-500"
            animate={oyeCount > 0 ? { scale: [1, 1.2, 1] } : {}}
            transition={{ duration: 0.3 }}
          >
            <Zap className="w-7 h-7 text-white fill-white" />
          </motion.div>
          <span className="text-xs font-bold text-orange-400">
            {oyeCount > 0 ? `${oyeCount}+` : 'OYÉ'}
          </span>
        </motion.button>

        {/* Comments */}
        <motion.button className="flex flex-col items-center gap-1" whileTap={{ scale: 0.8 }}>
          <div className="p-2.5 rounded-full bg-black/30 backdrop-blur-sm">
            <MessageCircle className="w-7 h-7 text-white" />
          </div>
          <span className="text-xs font-bold text-white">1.2k</span>
        </motion.button>

        {/* Save */}
        <motion.button
          className="flex flex-col items-center gap-1"
          onClick={() => setIsSaved(!isSaved)}
          whileTap={{ scale: 0.8 }}
        >
          <div className="p-2.5 rounded-full bg-black/30 backdrop-blur-sm">
            <Bookmark
              className={`w-7 h-7 ${isSaved ? 'text-yellow-400 fill-yellow-400' : 'text-white'}`}
            />
          </div>
        </motion.button>

        {/* Share */}
        <motion.button className="flex flex-col items-center gap-1" whileTap={{ scale: 0.8 }}>
          <div className="p-2.5 rounded-full bg-black/30 backdrop-blur-sm">
            <Share2 className="w-7 h-7 text-white" />
          </div>
        </motion.button>

        {/* Spinning Album Art */}
        <motion.div
          className="w-10 h-10 rounded-lg overflow-hidden border border-white/20"
          animate={isActive ? { rotate: 360 } : {}}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        >
          <div className="w-full h-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
            <Music2 className="w-5 h-5 text-white" />
          </div>
        </motion.div>
      </div>

      {/* Bottom Info */}
      <div className="absolute bottom-20 left-4 right-20 z-10">
        {/* OYÉ Trending Badge */}
        <motion.div
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-purple-500/30 to-pink-500/30 border border-purple-500/40 backdrop-blur-sm mb-3"
          animate={{ scale: [1, 1.02, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <Zap className="w-3 h-3 text-yellow-400 fill-yellow-400" />
          <span className="text-[10px] font-bold text-purple-200 uppercase tracking-wider">
            OYÉ Trending
          </span>
          <span className="text-[10px] text-purple-300">{item.oyes}</span>
        </motion.div>

        {/* Username */}
        <h3 className="font-bold text-white text-base mb-1 drop-shadow-lg">@{item.user}</h3>

        {/* Caption */}
        <p className="text-sm text-white/90 line-clamp-2 mb-3 drop-shadow-lg">{item.caption}</p>

        {/* Song Info */}
        <motion.div
          className="flex items-center gap-2"
          animate={{ x: [0, -5, 0] }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          <Music2 className="w-3.5 h-3.5 text-white flex-shrink-0" />
          <div className="overflow-hidden">
            <motion.span
              className="text-xs text-white/80 whitespace-nowrap inline-block"
              animate={{ x: ['0%', '-50%'] }}
              transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            >
              {item.songTitle} • {item.songArtist} &nbsp;&nbsp;&nbsp; {item.songTitle} • {item.songArtist}
            </motion.span>
          </div>
        </motion.div>
      </div>

      {/* Floating OYÉ Reactions */}
      <AnimatePresence>
        {floatingOyes.map((id) => (
          <FloatingOye key={id} id={id} onComplete={() => removeFloatingOye(id)} />
        ))}
      </AnimatePresence>
    </div>
  );
};

// Main Feed Component
export const VoyoVerticalFeed = ({ isActive }: { isActive: boolean }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle scroll to detect current video
  const handleScroll = () => {
    if (!containerRef.current) return;
    const scrollTop = containerRef.current.scrollTop;
    const itemHeight = containerRef.current.clientHeight;
    const newIndex = Math.round(scrollTop / itemHeight);
    if (newIndex !== currentIndex) {
      setCurrentIndex(newIndex);
    }
  };

  if (!isActive) return null;

  return (
    <motion.div
      className="absolute inset-0 bg-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div
        ref={containerRef}
        className="h-full w-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
        onScroll={handleScroll}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {MOCK_CLIPS.map((clip, index) => (
          <div key={clip.id} className="h-full w-full">
            <FeedItemCard
              item={clip}
              isActive={isActive && index === currentIndex}
              isMuted={isMuted}
              onToggleMute={() => setIsMuted(!isMuted)}
            />
          </div>
        ))}
      </div>

      {/* Top gradient for status bar */}
      <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />

      {/* "For You" / "Following" tabs placeholder */}
      <div className="absolute top-4 left-0 right-0 flex items-center justify-center gap-6">
        <button className="text-white/50 text-sm font-semibold">Following</button>
        <button className="text-white text-sm font-bold border-b-2 border-white pb-1">For You</button>
      </div>
    </motion.div>
  );
};

export default VoyoVerticalFeed;
