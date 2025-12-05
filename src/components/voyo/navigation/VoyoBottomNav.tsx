/**
 * VOYO Bottom Navigation - Tab Switcher
 * MUSIC | VOYO (Feed) | CREATE
 */

import { motion } from 'framer-motion';
import { Music2, Plus, Flame } from 'lucide-react';
import { usePlayerStore } from '../../../store/playerStore';
import { VoyoTab } from '../../../types';

export const VoyoBottomNav = () => {
  const { voyoActiveTab, setVoyoTab, isPlaying } = usePlayerStore();

  const tabs: { id: VoyoTab; label: string; icon?: React.ReactNode }[] = [
    { id: 'music', label: 'MUSIC', icon: <Music2 className="w-4 h-4" /> },
    { id: 'feed', label: 'VOYO' },
    { id: 'upload', label: 'CREATE', icon: <Plus className="w-4 h-4" /> },
  ];

  return (
    <div className="glass-nav pb-safe pt-3 px-6">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {tabs.map((tab) => (
          <motion.button
            key={tab.id}
            onClick={() => setVoyoTab(tab.id)}
            className="relative"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {tab.id === 'feed' ? (
              // VOYO Center Button - NEON GLOW TREATMENT
              <motion.div
                className={`relative w-16 h-16 rounded-2xl flex flex-col items-center justify-center transition-all ${
                  voyoActiveTab === 'feed'
                    ? 'bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500'
                    : 'bg-white/10 border border-white/10'
                }`}
                style={{
                  boxShadow: voyoActiveTab === 'feed'
                    ? '0 0 30px rgba(168, 85, 247, 0.6), 0 0 60px rgba(236, 72, 153, 0.4), 0 8px 32px rgba(0,0,0,0.4)'
                    : '0 4px 16px rgba(0,0,0,0.3)'
                }}
                animate={voyoActiveTab === 'feed' ? { scale: [1, 1.05, 1] } : {}}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {/* Fire icon when active */}
                {voyoActiveTab === 'feed' && (
                  <motion.div
                    className="absolute -top-1 -right-1"
                    animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                  >
                    <Flame className="w-4 h-4 text-orange-400 fill-orange-400" />
                  </motion.div>
                )}
                <span className="font-black text-sm text-white tracking-tight">VOYO</span>
                <span className="text-[8px] text-white/60 uppercase tracking-widest">Feed</span>
              </motion.div>
            ) : (
              // Regular tabs
              <div
                className={`flex flex-col items-center gap-1.5 px-4 py-2 rounded-xl transition-all ${
                  voyoActiveTab === tab.id
                    ? 'text-white'
                    : 'text-white/40 hover:text-white/60'
                }`}
              >
                {tab.icon}
                <span className="text-[10px] font-bold uppercase tracking-widest">
                  {tab.label}
                </span>
                {voyoActiveTab === tab.id && (
                  <motion.div
                    layoutId="tab-indicator"
                    className="absolute -bottom-1 w-1 h-1 rounded-full bg-purple-500"
                  />
                )}
              </div>
            )}
          </motion.button>
        ))}
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
