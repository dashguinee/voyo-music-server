/**
 * VOYO Live Card
 * For the People, by The People
 *
 * Central avatar + 3 overlapping orbiting avatars + dynamic gradients
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play } from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { useAuth } from '../../hooks/useAuth';
import { friendsAPI, activityAPI, Friend, FriendActivity } from '../../lib/voyo-api';

// Default avatars for fallback (diverse, West Africa vibes)
const DEFAULT_AVATARS = [
  'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=100&h=100&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1539701938214-0d9736e1c16b?w=100&h=100&fit=crop&crop=face',
  'https://images.unsplash.com/photo-1523824921871-d6f1a15151f1?w=100&h=100&fit=crop&crop=face',
];

// Mock friends listening (fallback)
const MOCK_FRIENDS_LISTENING = [
  { id: '1', name: 'Aziz', avatar: DEFAULT_AVATARS[1], track: { title: 'Last Last', thumbnail: 'https://i.ytimg.com/vi/421w1j87fEM/hqdefault.jpg' } },
  { id: '2', name: 'Kenza', avatar: DEFAULT_AVATARS[2], track: { title: 'Essence', thumbnail: 'https://i.ytimg.com/vi/jipQpjUA_o8/hqdefault.jpg' } },
  { id: '3', name: 'Mamadou', avatar: DEFAULT_AVATARS[3], track: { title: 'Calm Down', thumbnail: 'https://i.ytimg.com/vi/WcIcVapfqXw/hqdefault.jpg' } },
  { id: '4', name: 'Fatou', avatar: DEFAULT_AVATARS[4], track: { title: 'Peru', thumbnail: 'https://i.ytimg.com/vi/mCfPHnO3EB4/hqdefault.jpg' } },
];

// Gradient colors
const GRADIENT_COLORS = [
  { from: '#d97706', via: '#f97316', to: '#db2777' },  // Sunset
  { from: '#9333ea', via: '#d946ef', to: '#ec4899' },  // Purple haze
  { from: '#059669', via: '#14b8a6', to: '#06b6d4' },  // Ocean
  { from: '#e11d48', via: '#ec4899', to: '#fb923c' },  // Tropical
  { from: '#4f46e5', via: '#a855f7', to: '#ec4899' },  // Night
  { from: '#0ea5e9', via: '#3b82f6', to: '#6366f1' },  // Blue sky
  { from: '#d4a574', via: '#8b4513', to: '#722F37' },  // Rich sunset
];

interface ListeningFriend {
  id: string;
  name: string;
  avatar: string;
  track: { title: string; thumbnail: string };
}

export const VoyoLiveCard = () => {
  const { setShouldOpenNowPlaying, currentTrack } = usePlayerStore();
  const { dashId, isLoggedIn } = useAuth();

  // Real data
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendsActivity, setFriendsActivity] = useState<FriendActivity[]>([]);
  const [friendsListening, setFriendsListening] = useState<ListeningFriend[]>(MOCK_FRIENDS_LISTENING);

  // Animation state
  const [gradientIndex, setGradientIndex] = useState(0);
  const [prevGradientIndex, setPrevGradientIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [centerIndex, setCenterIndex] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [friendIndex, setFriendIndex] = useState(0);
  const animationRef = useRef<number | null>(null);

  // Fetch real friends data
  useEffect(() => {
    if (!dashId || !isLoggedIn) return;

    const loadData = async () => {
      try {
        const [friendsList, activity] = await Promise.all([
          friendsAPI.getFriends(dashId),
          activityAPI.getFriendsActivity(dashId),
        ]);
        setFriends(friendsList);
        setFriendsActivity(activity);

        // Build real friends listening list
        const realList: ListeningFriend[] = [];

        // Add yourself if playing
        if (currentTrack) {
          realList.push({
            id: 'me',
            name: 'You',
            avatar: DEFAULT_AVATARS[0],
            track: { title: currentTrack.title, thumbnail: currentTrack.coverUrl },
          });
        }

        // Add friends who are listening
        activity.filter(a => a.now_playing).forEach(a => {
          const friend = friendsList.find(f => f.dash_id === a.dash_id);
          realList.push({
            id: a.dash_id,
            name: friend?.name || `V${a.dash_id.slice(0, 4)}`,
            avatar: friend?.avatar || DEFAULT_AVATARS[realList.length % DEFAULT_AVATARS.length],
            track: { title: a.now_playing!.title, thumbnail: a.now_playing!.thumbnail },
          });
        });

        // Only update if we have real data, otherwise keep mock
        if (realList.length > 0) {
          setFriendsListening(realList);
        }
      } catch (err) {
        console.warn('[VoyoLiveCard] Failed to load:', err);
      }
    };

    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [dashId, isLoggedIn, currentTrack]);

  // Build avatars from real friends or defaults
  const avatars = friends.length > 0
    ? friends.slice(0, 5).map(f => f.avatar || DEFAULT_AVATARS[0])
    : DEFAULT_AVATARS;

  // Slow gradient cycle (10 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      setPrevGradientIndex(gradientIndex);
      setIsTransitioning(true);
      setGradientIndex(prev => (prev + 1) % GRADIENT_COLORS.length);
      setTimeout(() => setIsTransitioning(false), 2000);
    }, 10000);
    return () => clearInterval(interval);
  }, [gradientIndex]);

  // Cycle center avatar
  useEffect(() => {
    const interval = setInterval(() => {
      setCenterIndex(prev => (prev + 1) % avatars.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [avatars.length]);

  // Cycle friends listening - THIS IS THE KEY FIX
  useEffect(() => {
    const interval = setInterval(() => {
      setFriendIndex(prev => (prev + 1) % friendsListening.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [friendsListening.length]);

  // Smooth rotation animation
  useEffect(() => {
    let lastTime = performance.now();
    const speed = 0.02;

    const animate = (currentTime: number) => {
      const delta = currentTime - lastTime;
      lastTime = currentTime;
      setRotation(prev => (prev + delta * speed) % 360);
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  const orbitAvatars = avatars.filter((_, i) => i !== centerIndex).slice(0, 3);
  const radius = 32;
  const currentGradient = GRADIENT_COLORS[gradientIndex];
  const prevGradient = GRADIENT_COLORS[prevGradientIndex];

  // Get current 2 friends to display
  const friend1 = friendsListening[friendIndex % friendsListening.length];
  const friend2 = friendsListening[(friendIndex + 1) % friendsListening.length];

  const getAvatarPosition = (index: number) => {
    const baseAngle = rotation + (index * 100);
    const rad = (baseAngle * Math.PI) / 180;
    return { x: Math.cos(rad) * radius, y: Math.sin(rad) * radius };
  };

  return (
    <div className="mb-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3 px-4">
        <motion.div
          className="w-2 h-2 rounded-full bg-green-500"
          animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
        <h2 className="text-white/90 font-bold text-lg">Oyé! We Live</h2>
      </div>

      {/* Card */}
      <div className="px-4">
        <motion.div
          className="relative overflow-hidden rounded-2xl cursor-pointer"
          onClick={() => currentTrack && setShouldOpenNowPlaying(true)}
          whileTap={{ scale: 0.98 }}
        >
          {/* Background gradient - previous */}
          <motion.div
            className="absolute inset-0"
            style={{ background: `linear-gradient(135deg, ${prevGradient.from}, ${prevGradient.via}, ${prevGradient.to})` }}
            animate={{ opacity: isTransitioning ? 0 : 1 }}
            transition={{ duration: 2, ease: "easeInOut" }}
          />

          {/* Background gradient - current */}
          <motion.div
            className="absolute inset-0"
            style={{ background: `linear-gradient(135deg, ${currentGradient.from}, ${currentGradient.via}, ${currentGradient.to})` }}
            animate={{ opacity: isTransitioning ? 1 : 1 }}
            initial={{ opacity: 0 }}
            transition={{ duration: 2, ease: "easeInOut" }}
          />

          {/* Shimmer */}
          <motion.div
            className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/12 to-transparent"
            animate={{ left: ['-50%', '150%'] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", repeatDelay: 2.5 }}
          />

          <div className="relative flex items-center gap-5 p-4">
            {/* Avatar orbit system */}
            <div className="relative w-20 h-20 flex-shrink-0">
              {/* Pulsing ring */}
              <motion.div
                className="absolute inset-0 rounded-full border-2 border-white/20"
                animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.1, 0.3] }}
                transition={{ duration: 2.5, repeat: Infinity }}
              />

              {/* Center avatar */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={centerIndex}
                    className="w-11 h-11 rounded-full overflow-hidden border-[3px] border-white shadow-xl"
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.7, opacity: 0 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                  >
                    <img src={avatars[centerIndex]} alt="" className="w-full h-full object-cover" />
                  </motion.div>
                </AnimatePresence>

                <motion.div
                  className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white"
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
              </div>

              {/* Orbiting avatars */}
              {orbitAvatars.map((avatar, i) => {
                const pos = getAvatarPosition(i);
                return (
                  <div
                    key={`orbit-${i}`}
                    className="absolute w-7 h-7 rounded-full overflow-hidden border-2 border-white/90 shadow-lg"
                    style={{
                      left: '50%',
                      top: '50%',
                      transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))`,
                      zIndex: 10 - i,
                    }}
                  >
                    <img src={avatar} alt="" className="w-full h-full object-cover" />
                  </div>
                );
              })}
            </div>

            {/* Copy */}
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-bold text-lg leading-tight">Vibes on Vibes</h3>
              <p className="text-white/70 text-xs">For the People, by The People</p>
            </div>

            {/* Mini friend cards + Play button */}
            <div className="flex items-center gap-2">
              <div className="flex -space-x-3">
                <AnimatePresence mode="popLayout">
                  <motion.div
                    key={`friend-${friend1.id}-${friendIndex}`}
                    className="relative w-9 h-9 rounded-lg overflow-hidden border-2 border-white/50 shadow-lg"
                    initial={{ opacity: 0, scale: 0.8, x: 10 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.8, x: -10 }}
                    transition={{ duration: 0.3 }}
                    style={{ zIndex: 10 }}
                  >
                    <img src={friend1.track.thumbnail} alt="" className="w-full h-full object-cover" />
                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border border-white overflow-hidden">
                      <img src={friend1.avatar} alt={friend1.name} className="w-full h-full object-cover" />
                    </div>
                  </motion.div>

                  <motion.div
                    key={`friend-${friend2.id}-${friendIndex}`}
                    className="relative w-9 h-9 rounded-lg overflow-hidden border-2 border-white/50 shadow-lg"
                    initial={{ opacity: 0, scale: 0.8, x: 10 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.8, x: -10 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                    style={{ zIndex: 9 }}
                  >
                    <img src={friend2.track.thumbnail} alt="" className="w-full h-full object-cover" />
                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border border-white overflow-hidden">
                      <img src={friend2.avatar} alt={friend2.name} className="w-full h-full object-cover" />
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>

              <motion.div
                className="w-11 h-11 rounded-full bg-black/30 backdrop-blur flex items-center justify-center"
                whileHover={{ scale: 1.1, backgroundColor: 'rgba(0,0,0,0.5)' }}
              >
                <Play className="w-5 h-5 text-white" fill="white" />
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export const SignInPrompt = VoyoLiveCard;
export default VoyoLiveCard;
