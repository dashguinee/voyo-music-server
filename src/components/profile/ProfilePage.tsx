/**
 * VOYO Profile Page - voyomusic.com/username
 *
 * The URL IS your identity:
 * - Visit /dash → see dash's public profile + live portal
 * - Enter PIN → full access to your universe
 * - Join portal → sync playback with host
 */

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Pause, Music2, Radio, Lock, Unlock, Eye, Users,
  ArrowLeft, User, Edit3, Heart, Share2, ExternalLink, QrCode, Copy, Check, X
} from 'lucide-react';
import { useUniverseStore } from '../../store/universeStore';
import { usePlayerStore } from '../../store/playerStore';
import { universeAPI, followsAPI, PublicProfile, NowPlaying } from '../../lib/supabase';
import { PortalChat } from '../portal/PortalChat';

export const ProfilePage = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();

  // Universe store
  const {
    isLoggedIn,
    currentUsername,
    login,
    viewUniverse,
    leaveUniverse,
    viewingUniverse,
    isViewingOther,
    isLoading,
    error,
  } = useUniverseStore();

  // Player store
  const { setCurrentTrack, currentTrack, isPlaying } = usePlayerStore();

  // Local state
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const [portalOpen, setPortalOpen] = useState(false);
  const [showPinInput, setShowPinInput] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [showShareModal, setShowShareModal] = useState(false);
  const [copied, setCopied] = useState(false);

  // Follow state
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowLoading, setIsFollowLoading] = useState(false);

  // Generate profile URL
  const profileUrl = `${window.location.origin}/${username}`;

  // Copy to clipboard
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Native share
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${profile?.displayName || username}'s VOYO`,
          text: portalOpen ? 'Listen along with me on VOYO!' : 'Check out my VOYO profile',
          url: profileUrl,
        });
      } catch {
        // User cancelled or error
      }
    } else {
      setShowShareModal(true);
    }
  };

  // Check if viewing own profile
  const isOwnProfile = currentUsername?.toLowerCase() === username?.toLowerCase();

  // Load profile on mount
  useEffect(() => {
    if (!username) return;

    const loadProfile = async () => {
      setLoadingProfile(true);

      // If logged in and viewing own profile
      if (isOwnProfile && isLoggedIn) {
        // Could load from local state, but let's get fresh from server
      }

      // Fetch public profile
      const result = await universeAPI.getPublicProfile(username);

      if (result.profile) {
        setProfile(result.profile);
        setNowPlaying(result.nowPlaying);
        setPortalOpen(result.portalOpen);
      }

      setLoadingProfile(false);
    };

    loadProfile();

    // Subscribe to real-time updates if portal is open
    const setupRealtime = async () => {
      const result = await universeAPI.getPublicProfile(username);
      if (result.portalOpen) {
        await viewUniverse(username);
      }
    };
    setupRealtime();

    return () => {
      leaveUniverse();
    };
  }, [username]);

  // Load follow status
  useEffect(() => {
    if (!username || !currentUsername || isOwnProfile) return;

    const loadFollowStatus = async () => {
      const [following, counts] = await Promise.all([
        followsAPI.isFollowing(currentUsername, username),
        followsAPI.getCounts(username),
      ]);
      setIsFollowing(following);
      setFollowerCount(counts.followers);
      setFollowingCount(counts.following);
    };
    loadFollowStatus();
  }, [username, currentUsername, isOwnProfile]);

  // Handle follow/unfollow
  const handleFollowToggle = async () => {
    if (!username || !currentUsername || isFollowLoading) return;

    setIsFollowLoading(true);
    if (isFollowing) {
      const success = await followsAPI.unfollow(currentUsername, username);
      if (success) {
        setIsFollowing(false);
        setFollowerCount((c) => Math.max(0, c - 1));
      }
    } else {
      const success = await followsAPI.follow(currentUsername, username);
      if (success) {
        setIsFollowing(true);
        setFollowerCount((c) => c + 1);
      }
    }
    setIsFollowLoading(false);
  };

  // Update from viewingUniverse when it changes + AUTO-SYNC playback
  const [hasJoinedPortal, setHasJoinedPortal] = useState(false);
  const lastTrackIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (viewingUniverse) {
      setNowPlaying(viewingUniverse.nowPlaying);
      setPortalOpen(viewingUniverse.portalOpen);

      // AUTO-SYNC: If viewer has joined portal and track changes, auto-play new track
      if (hasJoinedPortal && viewingUniverse.nowPlaying) {
        const newTrackId = viewingUniverse.nowPlaying.trackId;
        if (lastTrackIdRef.current && lastTrackIdRef.current !== newTrackId) {
          // Track changed! Auto-sync to new track
          const track = {
            id: newTrackId,
            trackId: newTrackId,
            title: viewingUniverse.nowPlaying.title,
            artist: viewingUniverse.nowPlaying.artist,
            coverUrl: viewingUniverse.nowPlaying.thumbnail,
          };
          setCurrentTrack(track as any);
        }
        lastTrackIdRef.current = newTrackId;
      }
    }
  }, [viewingUniverse, hasJoinedPortal, setCurrentTrack]);

  // Handle PIN login
  const handlePinLogin = async () => {
    if (!username || pin.length !== 6) return;

    setPinError('');
    const success = await login(username, pin);

    if (success) {
      setShowPinInput(false);
      setPin('');
      // Redirect to main app since they're now logged in
      navigate('/');
    } else {
      setPinError('Invalid PIN');
    }
  };

  // Handle join portal (sync playback)
  const handleJoinPortal = async () => {
    if (!nowPlaying) return;

    // Create a track object from nowPlaying
    const track = {
      id: nowPlaying.trackId,
      trackId: nowPlaying.trackId,
      title: nowPlaying.title,
      artist: nowPlaying.artist,
      coverUrl: nowPlaying.thumbnail,
    };

    // Set as current track and play
    setCurrentTrack(track as any);

    // Mark as joined - enables auto-sync for future track changes
    setHasJoinedPortal(true);
    lastTrackIdRef.current = nowPlaying.trackId;
  };

  // Loading state
  if (loadingProfile) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <motion.div
          className="w-16 h-16 rounded-full border-4 border-purple-500/30 border-t-purple-500"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    );
  }

  // Not found
  if (!profile) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-8">
        <div className="text-center">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-white/5 flex items-center justify-center">
            <User className="w-12 h-12 text-white/20" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Universe not found</h1>
          <p className="text-white/50 mb-4">@{username} hasn't claimed their universe yet</p>
          <p className="text-white/30 text-sm mb-8">
            Want this username? Go to the app and claim it!
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold"
          >
            Open VOYO
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={() => navigate('/')} className="p-2 -ml-2">
            <ArrowLeft className="w-5 h-5 text-white/70" />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-white/60 text-sm font-medium">voyomusic.com/</span>
            <span className="text-white text-sm font-bold">{username}</span>
          </div>
          <div className="w-9" /> {/* Spacer */}
        </div>
      </div>

      {/* Profile Content */}
      <div className="px-5 py-6">
        {/* Avatar & Info */}
        <div className="flex flex-col items-center text-center mb-8">
          {/* Avatar */}
          <div className="relative mb-4">
            {profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt={profile.displayName}
                className="w-28 h-28 rounded-full object-cover ring-4 ring-purple-500/30"
              />
            ) : (
              <div className="w-28 h-28 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center ring-4 ring-purple-500/30">
                <span className="text-4xl font-bold text-white">
                  {profile.displayName?.charAt(0)?.toUpperCase() || '?'}
                </span>
              </div>
            )}

            {/* Portal indicator */}
            {portalOpen && (
              <motion.div
                className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-green-500 border-4 border-[#0a0a0f] flex items-center justify-center"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Radio className="w-4 h-4 text-white" />
              </motion.div>
            )}
          </div>

          {/* Name & Bio */}
          <h1 className="text-2xl font-bold text-white mb-1">{profile.displayName}</h1>
          <p className="text-white/40 text-sm mb-4">@{username}</p>
          {profile.bio && (
            <p className="text-white/60 text-sm max-w-xs mb-4">{profile.bio}</p>
          )}

          {/* Follower Stats */}
          {!isOwnProfile && (
            <div className="flex gap-6 mb-4">
              <div className="text-center">
                <p className="text-white font-bold">{followerCount}</p>
                <p className="text-white/40 text-xs">followers</p>
              </div>
              <div className="text-center">
                <p className="text-white font-bold">{followingCount}</p>
                <p className="text-white/40 text-xs">following</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            {isOwnProfile ? (
              <button
                onClick={() => navigate('/')}
                className="px-5 py-2 rounded-full bg-white text-black font-semibold text-sm flex items-center gap-2"
              >
                <Edit3 className="w-4 h-4" />
                Edit Profile
              </button>
            ) : (
              <>
                {/* Follow Button */}
                {currentUsername && (
                  <motion.button
                    onClick={handleFollowToggle}
                    disabled={isFollowLoading}
                    className={`px-5 py-2 rounded-full font-semibold text-sm flex items-center gap-2 ${
                      isFollowing
                        ? 'bg-white/10 text-white border border-white/20'
                        : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                    }`}
                    whileTap={{ scale: 0.95 }}
                  >
                    {isFollowLoading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : isFollowing ? (
                      <>
                        <Check className="w-4 h-4" />
                        Following
                      </>
                    ) : (
                      <>
                        <Users className="w-4 h-4" />
                        Follow
                      </>
                    )}
                  </motion.button>
                )}
                <button
                  onClick={handleShare}
                  className="px-5 py-2 rounded-full bg-white/10 text-white font-semibold text-sm flex items-center gap-2 border border-white/20"
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </button>
              </>
            )}
          </div>
        </div>

        {/* NOW PLAYING - Portal */}
        {portalOpen && nowPlaying ? (
          <motion.div
            className="mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center gap-2 mb-4">
              <motion.div
                className="w-2 h-2 rounded-full bg-green-400"
                animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <p className="text-green-400 text-xs font-semibold uppercase tracking-wider">
                Portal Open • Live
              </p>
              <div className="flex items-center gap-1 text-white/40 text-xs ml-auto">
                <Eye className="w-3 h-3" />
                <span>watching</span>
              </div>
            </div>

            {/* Now Playing Card */}
            <div className="relative rounded-3xl overflow-hidden bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/10">
              {/* Album Art Background */}
              <div className="absolute inset-0 opacity-30">
                <img
                  src={nowPlaying.thumbnail}
                  alt=""
                  className="w-full h-full object-cover blur-2xl"
                />
              </div>

              <div className="relative p-5">
                <div className="flex items-center gap-4">
                  {/* Album Art */}
                  <div className="relative flex-shrink-0">
                    <img
                      src={nowPlaying.thumbnail}
                      alt={nowPlaying.title}
                      className="w-24 h-24 rounded-xl object-cover shadow-2xl"
                    />
                    {nowPlaying.isPlaying && (
                      <div className="absolute bottom-2 left-2 flex gap-0.5">
                        {[...Array(3)].map((_, i) => (
                          <motion.div
                            key={i}
                            className="w-1 bg-white rounded-full"
                            animate={{ height: [4, 12, 4] }}
                            transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Track Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-lg truncate">{nowPlaying.title}</p>
                    <p className="text-white/60 text-sm truncate mb-3">{nowPlaying.artist}</p>

                    {/* Progress */}
                    <div className="space-y-1">
                      <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-purple-500 to-pink-500"
                          style={{ width: `${(nowPlaying.currentTime / nowPlaying.duration) * 100}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-white/40">
                        <span>{formatTime(nowPlaying.currentTime)}</span>
                        <span>{formatTime(nowPlaying.duration)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Join Button */}
                <motion.button
                  onClick={handleJoinPortal}
                  className={`w-full mt-4 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 ${
                    hasJoinedPortal
                      ? 'bg-green-500/20 border border-green-500/30 text-green-400'
                      : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {hasJoinedPortal ? (
                    <>
                      <Radio className="w-5 h-5" />
                      Synced • Following Along
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5" fill="white" />
                      Join Portal • Listen Along
                    </>
                  )}
                </motion.button>
              </div>
            </div>
          </motion.div>
        ) : (
          /* Portal Closed / Not Playing */
          <div className="mb-8 p-8 rounded-3xl bg-white/[0.03] border border-white/5 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
              <Music2 className="w-8 h-8 text-white/30" />
            </div>
            <p className="text-white/40 mb-1">Portal is closed</p>
            <p className="text-white/20 text-sm">Check back later to listen along!</p>
          </div>
        )}

        {/* Top Tracks - if public */}
        {profile.topTracks && profile.topTracks.length > 0 && (
          <div className="mb-8">
            <p className="text-white/40 text-xs font-medium uppercase tracking-wider mb-4">
              Top Tracks
            </p>
            <div className="space-y-2">
              {profile.topTracks.slice(0, 5).map((trackId, i) => (
                <div
                  key={trackId}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.05] transition-colors"
                >
                  <span className="text-white/30 text-sm font-bold w-6">{i + 1}</span>
                  <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                    <Music2 className="w-5 h-5 text-white/40" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white/80 text-sm font-medium truncate">{trackId}</p>
                  </div>
                  <Heart className="w-4 h-4 text-white/20" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Open App CTA */}
        <div className="text-center py-8">
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 rounded-full bg-white/10 text-white font-semibold flex items-center gap-2 mx-auto border border-white/20"
          >
            <ExternalLink className="w-4 h-4" />
            Open VOYO Music
          </button>
        </div>
      </div>

      {/* PIN Input Modal */}
      <AnimatePresence>
        {showPinInput && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setShowPinInput(false)}
            />

            {/* Modal */}
            <motion.div
              className="relative w-full max-w-sm bg-gradient-to-b from-[#1a1a2e] to-[#0f0f16] rounded-3xl border border-purple-500/20 p-6"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
            >
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <Lock className="w-8 h-8 text-purple-400" />
                </div>
                <h2 className="text-xl font-bold text-white mb-1">Enter PIN</h2>
                <p className="text-white/50 text-sm">
                  Enter your 6-digit PIN to access @{username}
                </p>
              </div>

              {/* PIN Input */}
              <div className="mb-4">
                <input
                  type="password"
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={(e) => e.key === 'Enter' && handlePinLogin()}
                  className="w-full px-4 py-4 text-center text-2xl font-bold tracking-[0.5em] bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-purple-500/50"
                  placeholder="••••••"
                  autoFocus
                />
                {pinError && (
                  <p className="text-red-400 text-sm mt-2 text-center">{pinError}</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowPinInput(false)}
                  className="flex-1 py-3 rounded-xl bg-white/10 text-white font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePinLogin}
                  disabled={pin.length !== 6 || isLoading}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold disabled:opacity-50"
                >
                  {isLoading ? 'Verifying...' : 'Unlock'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Share Modal with QR Code */}
      <AnimatePresence>
        {showShareModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setShowShareModal(false)}
            />

            {/* Modal */}
            <motion.div
              className="relative w-full max-w-sm bg-gradient-to-b from-[#1a1a2e] to-[#0f0f16] rounded-3xl border border-purple-500/20 p-6"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
            >
              {/* Close button */}
              <button
                onClick={() => setShowShareModal(false)}
                className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20"
              >
                <X className="w-4 h-4 text-white/70" />
              </button>

              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <QrCode className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-xl font-bold text-white mb-1">Share Profile</h2>
                <p className="text-white/50 text-sm">
                  {portalOpen ? 'Invite friends to listen along!' : `Share @${username}'s profile`}
                </p>
              </div>

              {/* QR Code */}
              <div className="p-4 rounded-xl bg-white mx-auto w-48 h-48 mb-4">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(profileUrl)}&bgcolor=ffffff&color=7c3aed&format=svg`}
                  alt="Profile QR Code"
                  className="w-full h-full"
                />
              </div>

              {/* URL Display */}
              <div className="p-3 rounded-xl bg-black/30 border border-white/10 mb-4">
                <div className="flex items-center justify-between">
                  <code className="text-white/80 text-sm truncate flex-1 mr-2">
                    voyomusic.com/{username}
                  </code>
                  <button
                    onClick={() => handleCopy(profileUrl)}
                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-white/70" />
                    )}
                  </button>
                </div>
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleCopy(profileUrl)}
                  className="py-3 rounded-xl bg-white/10 text-white font-semibold flex items-center justify-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  Copy Link
                </button>
                <button
                  onClick={() => {
                    if (navigator.share) {
                      navigator.share({
                        title: `${profile?.displayName || username}'s VOYO`,
                        text: portalOpen ? 'Listen along with me!' : 'Check out my VOYO',
                        url: profileUrl,
                      });
                    }
                  }}
                  className="py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold flex items-center justify-center gap-2"
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <div className="px-5 py-8 text-center border-t border-white/5">
        <p className="text-2xl font-black bg-gradient-to-r from-purple-400 via-pink-500 to-purple-600 bg-clip-text text-transparent mb-2">
          VOYO
        </p>
        <p className="text-white/30 text-xs">The African Music Experience</p>
      </div>

      {/* Portal Chat - Shows when portal is open and user joined */}
      {portalOpen && hasJoinedPortal && username && currentUsername && (
        <PortalChat
          portalOwner={username}
          currentUser={currentUsername}
          isPortalOpen={portalOpen}
        />
      )}
    </div>
  );
};

// Helper to format time
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default ProfilePage;
