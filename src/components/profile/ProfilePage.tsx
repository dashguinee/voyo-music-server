/**
 * VOYO Profile Page - voyomusic.com/username
 * Public profile with embedded player showing NOW PLAYING
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Pause, Volume2, VolumeX, SkipForward, SkipBack,
  Heart, Share2, UserPlus, UserCheck, Clock, Music2, Zap,
  ArrowLeft, MoreHorizontal, Lock, AlertCircle
} from 'lucide-react';
import { useAccountStore } from '../../store/accountStore';

// Premium avatar images
const AVATARS: Record<string, string> = {
  dash: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=face',
  aziz: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=400&fit=crop&crop=face',
  kenza: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop&crop=face',
};

export const ProfilePage = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { getProfile, currentAccount, addFriend } = useAccountStore();

  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(35);
  const [isFollowing, setIsFollowing] = useState(false);

  const profile = username ? getProfile(username) : null;
  const isOwnProfile = currentAccount?.username === username;
  const isBanned = profile?.subscription === 'banned';

  // Simulate progress
  useEffect(() => {
    if (!isPlaying || !profile?.nowPlaying) return;
    const interval = setInterval(() => {
      setProgress(p => p >= 100 ? 0 : p + 0.5);
    }, 100);
    return () => clearInterval(interval);
  }, [isPlaying, profile?.nowPlaying]);

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-white/5 flex items-center justify-center">
            <Music2 className="w-12 h-12 text-white/20" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">User not found</h1>
          <p className="text-white/50 mb-8">@{username} doesn't exist yet</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 rounded-full bg-white text-black font-semibold"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const avatar = AVATARS[profile.username] || `https://ui-avatars.com/api/?name=${profile.displayName}&background=7c3aed&color=fff&size=400`;

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2">
            <ArrowLeft className="w-5 h-5 text-white/70" />
          </button>
          <p className="text-white/60 text-sm font-medium">@{profile.username}</p>
          <button className="p-2 -mr-2">
            <MoreHorizontal className="w-5 h-5 text-white/70" />
          </button>
        </div>
      </div>

      {/* Banned Overlay */}
      {isBanned && (
        <motion.div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="text-center max-w-sm">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-red-500/20 border-2 border-red-500/50 flex items-center justify-center">
              <Lock className="w-12 h-12 text-red-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Account Suspended</h1>
            <p className="text-white/60 mb-2">@{profile.username}</p>
            <div className="px-4 py-2 rounded-full bg-red-500/20 border border-red-500/30 inline-flex items-center gap-2 mb-6">
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span className="text-red-400 text-sm font-medium">{profile.banReason}</span>
            </div>
            <p className="text-white/40 text-sm mb-8">
              This user's subscription has expired. They need to renew to restore access.
            </p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-3 rounded-full bg-white text-black font-semibold"
            >
              Go Home
            </button>
          </div>
        </motion.div>
      )}

      {/* Profile Content */}
      <div className="px-5 py-6">
        {/* Avatar & Info */}
        <div className="flex items-start gap-5 mb-8">
          <div className="relative">
            <img
              src={avatar}
              alt={profile.displayName}
              className="w-24 h-24 rounded-full object-cover ring-4 ring-white/10"
            />
            {/* Online indicator */}
            <div className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-green-500 border-2 border-[#0a0a0f]" />
          </div>

          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-white mb-1">{profile.displayName}</h1>
            <p className="text-white/50 text-sm mb-3">{profile.bio || 'VOYO Music listener'}</p>

            {!isOwnProfile && (
              <motion.button
                onClick={() => {
                  setIsFollowing(!isFollowing);
                  if (!isFollowing) addFriend(profile.username);
                }}
                className={`px-5 py-2 rounded-full text-sm font-semibold flex items-center gap-2 ${
                  isFollowing
                    ? 'bg-white/10 text-white border border-white/20'
                    : 'bg-white text-black'
                }`}
                whileTap={{ scale: 0.95 }}
              >
                {isFollowing ? (
                  <>
                    <UserCheck className="w-4 h-4" />
                    Friends
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    Add Friend
                  </>
                )}
              </motion.button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-around py-4 rounded-2xl bg-white/[0.03] border border-white/5 mb-8">
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{profile.totalListeningHours}h</p>
            <p className="text-white/40 text-xs">Listened</p>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{profile.totalOyeGiven.toLocaleString()}</p>
            <p className="text-white/40 text-xs">OYÉ Given</p>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{profile.friendIds.length}</p>
            <p className="text-white/40 text-xs">Friends</p>
          </div>
        </div>

        {/* NOW PLAYING - Timeline Style */}
        {profile.nowPlaying ? (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <p className="text-white/40 text-xs font-medium uppercase tracking-wider">Now Playing</p>
            </div>

            {/* Timeline Cards Container */}
            <motion.div
              className="relative rounded-3xl overflow-hidden bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/10 p-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-center gap-3">
                {/* CURRENT - Big Card */}
                <motion.button
                  className="flex-shrink-0 relative w-32 h-24 rounded-xl overflow-hidden"
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsPlaying(!isPlaying)}
                >
                  <img
                    src={profile.nowPlaying.thumbnail}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                  <div className="absolute bottom-2 left-2 right-2">
                    <p className="text-white font-bold text-xs truncate">{profile.nowPlaying.title}</p>
                    <p className="text-white/60 text-[10px] truncate">{profile.nowPlaying.artist}</p>
                  </div>
                  {/* Play/Pause indicator */}
                  <div className="absolute top-2 left-2 flex items-center gap-1">
                    {isPlaying ? (
                      <div className="flex gap-0.5">
                        {[...Array(3)].map((_, i) => (
                          <motion.div
                            key={i}
                            className="w-0.5 bg-white rounded-full"
                            animate={{ height: [4, 10, 4] }}
                            transition={{ duration: 0.4, repeat: Infinity, delay: i * 0.1 }}
                          />
                        ))}
                      </div>
                    ) : (
                      <Play className="w-3 h-3 text-white" fill="white" />
                    )}
                  </div>
                </motion.button>

                {/* UP NEXT - Smaller Cards */}
                {[
                  { title: 'Essence', artist: 'Wizkid', img: 'https://i.ytimg.com/vi/GqAYPiCWLgU/maxresdefault.jpg' },
                  { title: 'Calm Down', artist: 'Rema', img: 'https://i.ytimg.com/vi/WcIcVapfqXw/maxresdefault.jpg' },
                ].map((track, i) => (
                  <motion.button
                    key={i}
                    className="flex-shrink-0 relative w-20 h-16 rounded-xl overflow-hidden opacity-70 hover:opacity-100 transition-opacity"
                    whileTap={{ scale: 0.95 }}
                  >
                    <img src={track.img} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                    <div className="absolute bottom-1 left-1 right-1">
                      <p className="text-white font-bold text-[10px] truncate">{track.title}</p>
                      <p className="text-white/60 text-[8px] truncate">{track.artist}</p>
                    </div>
                  </motion.button>
                ))}

                {/* Add to queue */}
                <button className="flex-shrink-0 w-14 h-14 rounded-xl bg-white/5 border border-dashed border-white/20 flex items-center justify-center">
                  <Music2 className="w-5 h-5 text-white/40" />
                </button>
              </div>

              {/* Actions Row */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
                <div className="flex items-center gap-3">
                  <motion.button className="p-2 text-white/50" whileTap={{ scale: 0.9 }}>
                    <Heart className="w-5 h-5" />
                  </motion.button>
                  <motion.button className="p-2 text-white/50" whileTap={{ scale: 0.9 }}>
                    <Share2 className="w-5 h-5" />
                  </motion.button>
                </div>
                <motion.button
                  className="px-4 py-2 rounded-full bg-white/10 text-white text-xs font-medium"
                  whileTap={{ scale: 0.95 }}
                >
                  + Add to Queue
                </motion.button>
              </div>
            </motion.div>
          </div>
        ) : (
          /* Not Playing */
          <div className="mb-8 p-8 rounded-3xl bg-white/[0.03] border border-white/5 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
              <Music2 className="w-8 h-8 text-white/30" />
            </div>
            <p className="text-white/40">Not listening to anything right now</p>
          </div>
        )}

        {/* Recently Played */}
        <div>
          <p className="text-white/40 text-xs font-medium uppercase tracking-wider mb-4">Recent Activity</p>
          <div className="space-y-3">
            {[
              { title: 'Essence', artist: 'Wizkid ft. Tems', time: '2h ago' },
              { title: 'Calm Down', artist: 'Rema', time: '5h ago' },
              { title: 'Love Nwantiti', artist: 'CKay', time: 'Yesterday' },
            ].map((track, i) => (
              <motion.div
                key={i}
                className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02]"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                  <Music2 className="w-5 h-5 text-white/40" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white/80 text-sm font-medium truncate">{track.title}</p>
                  <p className="text-white/40 text-xs truncate">{track.artist}</p>
                </div>
                <p className="text-white/30 text-xs">{track.time}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-8 text-center">
        <p className="text-white/20 text-xs">voyomusic.com/{profile.username}</p>
      </div>
    </div>
  );
};

export default ProfilePage;
