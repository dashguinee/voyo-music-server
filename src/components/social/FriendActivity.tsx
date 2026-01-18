/**
 * VOYO Friend Activity Component
 *
 * Shows what friends are currently listening to
 * - Live listeners (portal open) with pulsing indicator
 * - Click to join their portal
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Radio, Play, Users, Music2, ChevronRight } from 'lucide-react';
import { useUniverseStore } from '../../store/universeStore';
import { activityFeedAPI, followsAPI, FriendActivity as FriendActivityType } from '../../lib/supabase';

interface FriendActivityProps {
  onJoinPortal?: (username: string) => void;
}

export const FriendActivity = ({ onJoinPortal }: FriendActivityProps) => {
  const navigate = useNavigate();
  const { currentUsername, isLoggedIn } = useUniverseStore();

  const [liveListeners, setLiveListeners] = useState<FriendActivityType[]>([]);
  const [recentActivity, setRecentActivity] = useState<FriendActivityType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [followingList, setFollowingList] = useState<string[]>([]);

  // Load activity on mount
  useEffect(() => {
    if (!currentUsername || !isLoggedIn) {
      setIsLoading(false);
      return;
    }

    const loadActivity = async () => {
      setIsLoading(true);

      // Get following list and activity in parallel
      const [following, activity] = await Promise.all([
        followsAPI.getFollowing(currentUsername),
        activityFeedAPI.getFriendsActivity(currentUsername, 20),
      ]);

      setFollowingList(following);

      // Separate live (portal open) from recent
      const live = activity.filter(a => a.portalOpen && a.nowPlaying);
      const recent = activity.filter(a => !a.portalOpen || !a.nowPlaying);

      setLiveListeners(live);
      setRecentActivity(recent.slice(0, 5));
      setIsLoading(false);
    };

    loadActivity();

    // Set up real-time subscription
    let subscription: any = null;

    const setupSubscription = async () => {
      const following = await followsAPI.getFollowing(currentUsername);
      if (following.length > 0) {
        subscription = activityFeedAPI.subscribeToFriendsActivity(
          following,
          (activity) => {
            // Update state based on activity
            if (activity.portalOpen && activity.nowPlaying) {
              setLiveListeners(prev => {
                const filtered = prev.filter(l => l.username !== activity.username);
                return [activity, ...filtered];
              });
              setRecentActivity(prev => prev.filter(r => r.username !== activity.username));
            } else {
              setLiveListeners(prev => prev.filter(l => l.username !== activity.username));
              setRecentActivity(prev => {
                const filtered = prev.filter(r => r.username !== activity.username);
                return [activity, ...filtered].slice(0, 5);
              });
            }
          }
        );
      }
    };

    setupSubscription();

    return () => {
      if (subscription) {
        activityFeedAPI.unsubscribe(subscription);
      }
    };
  }, [currentUsername, isLoggedIn]);

  // Handle click on friend
  const handleFriendClick = (username: string, hasPortal: boolean) => {
    if (hasPortal && onJoinPortal) {
      onJoinPortal(username);
    }
    navigate(`/${username}`);
  };

  // Not logged in - show sign up prompt
  if (!isLoggedIn) {
    return (
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white/90 font-bold text-lg flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-400" />
            Friends Listening
          </h2>
        </div>
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 text-center">
          <p className="text-white/40 text-sm mb-2">Sign in to see what friends are listening to</p>
          <button
            onClick={() => navigate('/')}
            className="text-purple-400 text-sm font-semibold"
          >
            Create your universe
          </button>
        </div>
      </div>
    );
  }

  // Loading
  if (isLoading) {
    return (
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-5 h-5 text-purple-400" />
          <div className="h-5 w-32 bg-white/10 rounded animate-pulse" />
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex-shrink-0 w-32 h-40 rounded-2xl bg-white/5 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // No friends yet
  if (followingList.length === 0) {
    return (
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white/90 font-bold text-lg flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-400" />
            Friends Listening
          </h2>
        </div>
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 text-center">
          <p className="text-white/40 text-sm mb-2">Follow friends to see what they're listening to</p>
          <button
            onClick={() => navigate('/')}
            className="text-purple-400 text-sm font-semibold"
          >
            Discover people
          </button>
        </div>
      </div>
    );
  }

  // No live listeners and no recent activity
  if (liveListeners.length === 0 && recentActivity.length === 0) {
    return (
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white/90 font-bold text-lg flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-400" />
            Friends Listening
          </h2>
        </div>
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 text-center">
          <Music2 className="w-8 h-8 text-white/20 mx-auto mb-2" />
          <p className="text-white/40 text-sm">No friends are listening right now</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-white/90 font-bold text-lg flex items-center gap-2">
          <Users className="w-5 h-5 text-purple-400" />
          Friends Listening
          {liveListeners.length > 0 && (
            <span className="ml-1 px-2 py-0.5 text-xs font-bold rounded-full bg-green-500/20 text-green-400">
              {liveListeners.length} LIVE
            </span>
          )}
        </h2>
        <button className="text-white/40 text-sm flex items-center gap-1 hover:text-white/60">
          See all
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Live Listeners - Horizontal Scroll */}
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        <AnimatePresence mode="popLayout">
          {/* Live listeners first */}
          {liveListeners.map((friend) => (
            <motion.div
              key={friend.username}
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex-shrink-0"
            >
              <LiveFriendCard
                friend={friend}
                onClick={() => handleFriendClick(friend.username, true)}
              />
            </motion.div>
          ))}

          {/* Recent activity (not live) */}
          {recentActivity.map((friend) => (
            <motion.div
              key={friend.username}
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex-shrink-0"
            >
              <RecentFriendCard
                friend={friend}
                onClick={() => handleFriendClick(friend.username, false)}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

// Live Friend Card - Portal is open, actively listening
const LiveFriendCard = ({
  friend,
  onClick
}: {
  friend: FriendActivityType;
  onClick: () => void;
}) => {
  return (
    <motion.button
      onClick={onClick}
      className="relative w-36 rounded-2xl overflow-hidden bg-gradient-to-b from-green-500/20 to-green-500/5 border border-green-500/20"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Album art background */}
      {friend.nowPlaying?.thumbnail && (
        <div className="absolute inset-0 opacity-30">
          <img
            src={friend.nowPlaying.thumbnail}
            alt=""
            className="w-full h-full object-cover blur-xl"
          />
        </div>
      )}

      <div className="relative p-3">
        {/* Live indicator */}
        <div className="flex items-center gap-1 mb-2">
          <motion.div
            className="w-2 h-2 rounded-full bg-green-400"
            animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
          <span className="text-green-400 text-[10px] font-bold uppercase">Live</span>
        </div>

        {/* Avatar */}
        <div className="relative w-16 h-16 mx-auto mb-2">
          {friend.avatarUrl ? (
            <img
              src={friend.avatarUrl}
              alt={friend.displayName}
              className="w-full h-full rounded-full object-cover ring-2 ring-green-500/50"
            />
          ) : (
            <div className="w-full h-full rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center ring-2 ring-green-500/50">
              <span className="text-xl font-bold text-white">
                {friend.displayName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}

          {/* Portal icon */}
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
            <Radio className="w-3 h-3 text-white" />
          </div>
        </div>

        {/* Name */}
        <p className="text-white font-semibold text-sm truncate text-center">
          {friend.displayName}
        </p>

        {/* Currently playing */}
        {friend.nowPlaying && (
          <div className="mt-2 p-2 rounded-lg bg-black/30">
            <p className="text-white/90 text-xs font-medium truncate">
              {friend.nowPlaying.title}
            </p>
            <p className="text-white/50 text-[10px] truncate">
              {friend.nowPlaying.artist}
            </p>
          </div>
        )}

        {/* Join CTA */}
        <div className="mt-2 flex items-center justify-center gap-1 text-green-400 text-xs font-semibold">
          <Play className="w-3 h-3" fill="currentColor" />
          Join
        </div>
      </div>
    </motion.button>
  );
};

// Recent Friend Card - Not live, but recently active
const RecentFriendCard = ({
  friend,
  onClick
}: {
  friend: FriendActivityType;
  onClick: () => void;
}) => {
  // Calculate "time ago"
  const getTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <motion.button
      onClick={onClick}
      className="relative w-28 rounded-2xl overflow-hidden bg-white/[0.03] border border-white/5"
      whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,0.05)' }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="p-3">
        {/* Avatar */}
        <div className="w-14 h-14 mx-auto mb-2">
          {friend.avatarUrl ? (
            <img
              src={friend.avatarUrl}
              alt={friend.displayName}
              className="w-full h-full rounded-full object-cover opacity-70"
            />
          ) : (
            <div className="w-full h-full rounded-full bg-gradient-to-br from-purple-500/50 to-pink-500/50 flex items-center justify-center">
              <span className="text-lg font-bold text-white/70">
                {friend.displayName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* Name */}
        <p className="text-white/70 font-medium text-sm truncate text-center">
          {friend.displayName}
        </p>

        {/* Last active */}
        <p className="text-white/30 text-[10px] text-center">
          {getTimeAgo(friend.lastActive)}
        </p>
      </div>
    </motion.button>
  );
};

export default FriendActivity;
