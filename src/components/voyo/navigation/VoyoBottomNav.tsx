/**
 * VOYO Bottom Navigation - Tab Switcher
 * HOME | VOYO (Toggle: Player ↔ Feed) | DAHUB
 *
 * When music is playing on Feed, VOYO button cycles:
 * Clean → Play Icon + "Keep Playing" → Clean
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, Sparkles, Play, MessageCircle } from 'lucide-react';
import { usePlayerStore } from '../../../store/playerStore';
import { useUniverseStore } from '../../../store/universeStore';
import { directMessagesAPI } from '../../../lib/supabase';

interface VoyoBottomNavProps {
  onDahub?: () => void;
  onHome?: () => void;
}

export const VoyoBottomNav = ({ onDahub, onHome }: VoyoBottomNavProps) => {
  const { voyoActiveTab, setVoyoTab, isPlaying } = usePlayerStore();
  const { currentUsername, isLoggedIn } = useUniverseStore();
  const [promptState, setPromptState] = useState<'clean' | 'love' | 'keep'>('clean');
  const [promptCount, setPromptCount] = useState(0);
  const [unreadDMs, setUnreadDMs] = useState(0);

  // Fetch unread DM count
  useEffect(() => {
    if (!currentUsername || !isLoggedIn) {
      setUnreadDMs(0);
      return;
    }

    const fetchUnread = async () => {
      const count = await directMessagesAPI.getUnreadCount(currentUsername);
      setUnreadDMs(count);
    };

    fetchUnread();

    // Poll every 30 seconds for new messages
    const interval = setInterval(fetchUnread, 30000);

    // Also subscribe to real-time DM notifications
    const subscription = directMessagesAPI.subscribe(currentUsername, () => {
      // When new message arrives, increment count
      setUnreadDMs(prev => prev + 1);
    });

    return () => {
      clearInterval(interval);
      if (subscription) {
        directMessagesAPI.unsubscribe(subscription);
      }
    };
  }, [currentUsername, isLoggedIn]);

  // VOYO button toggles between Player (music) and Feed
  const isOnFeed = voyoActiveTab === 'feed';
  const voyoLabel = isOnFeed ? 'Player' : 'Feed';

  // Show prompt sequence only a few times (max 3), mostly stay clean
  useEffect(() => {
    if (!isPlaying || !isOnFeed) {
      setPromptState('clean');
      return;
    }

    // Only show prompt sequence 3 times max per session
    if (promptCount >= 3) return;

    // Wait 8 seconds of playing, then show sequence
    const showPromptTimer = setTimeout(() => {
      // Step 1: Show "Love this Vibe" (2s)
      setPromptState('love');

      setTimeout(() => {
        // Step 2: Show "Keep Playing" (2.5s)
        setPromptState('keep');

        setTimeout(() => {
          // Step 3: Back to clean
          setPromptState('clean');
          setPromptCount(prev => prev + 1);
        }, 2500);
      }, 2000);
    }, 8000);

    return () => clearTimeout(showPromptTimer);
  }, [isPlaying, isOnFeed, promptCount]);

  const handleVoyoToggle = () => {
    if (voyoActiveTab === 'feed') {
      setVoyoTab('music'); // Feed → Player
    } else {
      setVoyoTab('feed'); // Player → Feed
    }
  };

  return (
    <div className="glass-nav pt-3 pb-4 px-6" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
      <div className="flex items-center justify-around max-w-md mx-auto">
        {/* LEFT: HOME */}
        <motion.button
          onClick={onHome}
          className="relative"
          whileTap={{ scale: 0.95 }}
        >
          <div className="flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl text-white/40 hover:text-white/60">
            <Home className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Home</span>
          </div>
        </motion.button>

        {/* CENTER: VOYO Toggle (Player ↔ Feed) */}
        <motion.button
          onClick={handleVoyoToggle}
          className="relative"
          whileTap={{ scale: 0.95 }}
        >
          <div
            className={`relative w-16 h-16 rounded-2xl flex flex-col items-center justify-center transition-all ${
              isOnFeed
                ? 'bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500'
                : 'bg-gradient-to-br from-purple-500 to-pink-500'
            }`}
            style={{
              boxShadow: '0 0 30px rgba(168, 85, 247, 0.5), 0 8px 32px rgba(0,0,0,0.4)'
            }}
          >
            {/* Base: VOYO Player - always visible */}
            <div className="flex flex-col items-center">
              <span className="font-black text-sm text-white tracking-tight">VOYO</span>
              <span className="text-[8px] text-white/70 uppercase tracking-widest">
                {voyoLabel}
              </span>
            </div>

            {/* Prompt overlays - appear on top */}
            <AnimatePresence>
              {promptState === 'love' && (
                <motion.div
                  key="love"
                  className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.3 }}
                >
                  <span className="text-[9px] text-white/90 font-medium">Love this Vibe?</span>
                </motion.div>
              )}

              {promptState === 'keep' && (
                <motion.div
                  key="keep"
                  className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-purple-600 via-pink-600 to-orange-500 rounded-2xl"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <motion.div
                    animate={{ opacity: [0.8, 1, 0.8] }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <Play className="w-5 h-5 text-white fill-white" />
                  </motion.div>
                  <span className="text-[7px] text-white/90 uppercase tracking-wider mt-0.5">
                    Keep Playing
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.button>

        {/* RIGHT: DAHUB */}
        <motion.button
          onClick={onDahub}
          className="relative"
          whileTap={{ scale: 0.95 }}
        >
          <div className="flex flex-col items-center gap-1 px-4 py-1.5 rounded-xl text-white/40 hover:text-white/60">
            <div className="relative">
              <Sparkles className="w-4 h-4" />
              {/* DM notification badge */}
              {unreadDMs > 0 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-gradient-to-r from-pink-500 to-purple-500 flex items-center justify-center"
                >
                  <span className="text-[9px] font-bold text-white">
                    {unreadDMs > 99 ? '99+' : unreadDMs}
                  </span>
                </motion.div>
              )}
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest">DaHub</span>
          </div>
        </motion.button>
      </div>

      {/* Tagline at bottom */}
      <div className="text-center mt-2">
        <span className="text-[7px] text-white/15">VOYO Music by DASUPERHUB</span>
      </div>
    </div>
  );
};

export default VoyoBottomNav;
