/**
 * VOYO Bottom Navigation - Tab Switcher
 * DAHUB | VOYO (Toggle: Player ↔ Feed) | HOME
 */

import { motion } from 'framer-motion';
import { Home, Sparkles, Flame, Music } from 'lucide-react';
import { usePlayerStore } from '../../../store/playerStore';
import { VoyoTab } from '../../../types';

interface VoyoBottomNavProps {
  onDahub?: () => void;
  onHome?: () => void;
}

export const VoyoBottomNav = ({ onDahub, onHome }: VoyoBottomNavProps) => {
  const { voyoActiveTab, setVoyoTab, isPlaying } = usePlayerStore();

  // VOYO button toggles between Player (music) and Feed
  const isOnFeed = voyoActiveTab === 'feed';
  const voyoLabel = isOnFeed ? 'Player' : 'Feed';

  const handleVoyoToggle = () => {
    if (voyoActiveTab === 'feed') {
      setVoyoTab('music'); // Feed → Player
    } else {
      setVoyoTab('feed'); // Player → Feed
    }
  };

  return (
    <div className="glass-nav pb-safe pt-3 px-6">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {/* LEFT: DAHUB */}
        <motion.button
          onClick={onDahub}
          className="relative"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <div className="flex flex-col items-center gap-1.5 px-4 py-2 rounded-xl text-white/40 hover:text-white/60">
            <Sparkles className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-widest">DaHub</span>
          </div>
        </motion.button>

        {/* CENTER: VOYO Toggle (Player ↔ Feed) */}
        <motion.button
          onClick={handleVoyoToggle}
          className="relative"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <motion.div
            className={`relative w-16 h-16 rounded-2xl flex flex-col items-center justify-center transition-all ${
              isOnFeed
                ? 'bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500'
                : 'bg-gradient-to-br from-purple-500 to-pink-500'
            }`}
            style={{
              boxShadow: '0 0 30px rgba(168, 85, 247, 0.5), 0 8px 32px rgba(0,0,0,0.4)'
            }}
            animate={{ scale: [1, 1.02, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {/* Icon indicator */}
            <motion.div
              className="absolute -top-1 -right-1"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            >
              {isOnFeed ? (
                <Music className="w-4 h-4 text-white" />
              ) : (
                <Flame className="w-4 h-4 text-orange-400 fill-orange-400" />
              )}
            </motion.div>
            <span className="font-black text-sm text-white tracking-tight">VOYO</span>
            <motion.span
              key={voyoLabel}
              className="text-[8px] text-white/70 uppercase tracking-widest"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {voyoLabel}
            </motion.span>
          </motion.div>
        </motion.button>

        {/* RIGHT: HOME (includes library) */}
        <motion.button
          onClick={onHome}
          className="relative"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <div className="flex flex-col items-center gap-1.5 px-4 py-2 rounded-xl text-white/40 hover:text-white/60">
            <Home className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Home</span>
          </div>
        </motion.button>
      </div>

      {/* Now Playing Mini Indicator */}
      {isPlaying && voyoActiveTab !== 'music' && (
        <motion.div
          className="mt-2 flex items-center justify-center gap-2 text-white/40"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex gap-0.5">
            {[...Array(3)].map((_, i) => (
              <motion.div
                key={i}
                className="w-0.5 bg-purple-400 rounded-full"
                animate={{ height: [4, 10, 4] }}
                transition={{ duration: 0.4, repeat: Infinity, delay: i * 0.1 }}
              />
            ))}
          </div>
          <span className="text-[10px]">Now Playing</span>
        </motion.div>
      )}
    </div>
  );
};

export default VoyoBottomNav;
