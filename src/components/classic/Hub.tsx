/**
 * VOYO Music - DAHUB
 * Snapchat + WhatsApp hybrid social hub
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import {
  Settings, Plus, X, Play, Pause, Volume2,
  Send, Heart, ChevronRight, BadgeCheck, Music2, User
} from 'lucide-react';
import { UniversePanel } from '../universe/UniversePanel';
import { usePlayerStore } from '../../store/playerStore';
import { useUniverseStore } from '../../store/universeStore';
import { getYouTubeThumbnail } from '../../data/tracks';
import { DirectMessageChat } from '../chat/DirectMessageChat';

// Premium avatar images
// TODO: Replace dash with actual profile photo when available
const AVATARS = {
  dash: '/dash-profile.jpg', // Your profile - add image to public folder
  aziz: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop&crop=face',
  kenza: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face',
  omar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=face',
  sarah: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=face',
  youssef: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=face',
};

// Story preview thumbnails
const STORY_PREVIEWS = {
  aziz: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=600&fit=crop',
  kenza: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=600&fit=crop',
  sarah: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=400&h=600&fit=crop',
  omar: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&h=600&fit=crop',
};

// Artist avatars - use their track thumbnails (already verified working)
const CELEBRITY_AVATARS = {
  burna: 'https://i.ytimg.com/vi/421w1j87fEM/hqdefault.jpg', // Last Last (REAL)
  wizkid: 'https://i.ytimg.com/vi/jipQpjUA_o8/hqdefault.jpg', // Essence
  rema: 'https://i.ytimg.com/vi/WcIcVapfqXw/hqdefault.jpg', // Calm Down
  tems: 'https://i.ytimg.com/vi/VDcEJE633rM/hqdefault.jpg', // Free Mind
  davido: 'https://i.ytimg.com/vi/iL3IEkCs-NA/hqdefault.jpg', // Fall
};

// Celebrities/Artists the user follows
const celebrities = [
  {
    id: 'burna',
    name: 'Burna Boy',
    avatar: CELEBRITY_AVATARS.burna,
    verified: true,
    latestRelease: { title: 'Last Last', thumbnail: 'https://i.ytimg.com/vi/421w1j87fEM/hqdefault.jpg' },
    isLive: false,
  },
  {
    id: 'wizkid',
    name: 'Wizkid',
    avatar: CELEBRITY_AVATARS.wizkid,
    verified: true,
    latestRelease: { title: 'Essence', thumbnail: 'https://i.ytimg.com/vi/jipQpjUA_o8/hqdefault.jpg' },
    isLive: true,
  },
  {
    id: 'rema',
    name: 'Rema',
    avatar: CELEBRITY_AVATARS.rema,
    verified: true,
    latestRelease: { title: 'Calm Down', thumbnail: 'https://i.ytimg.com/vi/WcIcVapfqXw/hqdefault.jpg' },
    isLive: false,
  },
  {
    id: 'tems',
    name: 'Tems',
    avatar: CELEBRITY_AVATARS.tems,
    verified: true,
    latestRelease: { title: 'Free Mind', thumbnail: 'https://i.ytimg.com/vi/VDcEJE633rM/hqdefault.jpg' },
    isLive: false,
  },
];

// Instagram-style Notes from friends
const friendNotes = [
  { id: '1', friend: 'Aziz', avatar: AVATARS.aziz, note: 'vibing to Burna rn 🔥', timestamp: '2h', hasMusic: true },
  { id: '2', friend: 'Kenza', avatar: AVATARS.kenza, note: 'new playlist dropping tonight', timestamp: '4h', hasMusic: false },
  { id: '3', friend: 'Sarah', avatar: AVATARS.sarah, note: '🎧', timestamp: '6h', hasMusic: true },
  { id: '4', friend: 'Omar', avatar: AVATARS.omar, note: 'who up?', timestamp: '8h', hasMusic: false },
];

// Friends data
// NOTE: nowPlaying is display-only. To enable playback, add trackId to each nowPlaying object
// and wire up onClick to setCurrentTrack() in the friend cards below (lines ~790-818).
// Current design: tapping a friend opens their story, not their track.
const friends = [
  {
    id: 'aziz',
    name: 'Aziz',
    avatar: AVATARS.aziz,
    hasStory: true,
    isOnline: true,
    storyPreview: STORY_PREVIEWS.aziz,
    nowPlaying: { title: 'Last Last', artist: 'Burna Boy', thumbnail: 'https://i.ytimg.com/vi/421w1j87fEM/hqdefault.jpg' },
  },
  {
    id: 'kenza',
    name: 'Kenza',
    avatar: AVATARS.kenza,
    hasStory: true,
    isOnline: true,
    storyPreview: STORY_PREVIEWS.kenza,
    nowPlaying: { title: 'Essence', artist: 'Wizkid', thumbnail: 'https://i.ytimg.com/vi/jipQpjUA_o8/hqdefault.jpg' },
  },
  {
    id: 'omar',
    name: 'Omar',
    avatar: AVATARS.omar,
    hasStory: false,
    isOnline: false,
    storyPreview: STORY_PREVIEWS.omar,
    nowPlaying: null,
  },
  {
    id: 'sarah',
    name: 'Sarah',
    avatar: AVATARS.sarah,
    hasStory: true,
    isOnline: true,
    storyPreview: STORY_PREVIEWS.sarah,
    nowPlaying: { title: 'Calm Down', artist: 'Rema', thumbnail: 'https://i.ytimg.com/vi/WcIcVapfqXw/hqdefault.jpg' },
  },
  {
    id: 'youssef',
    name: 'Youssef',
    avatar: AVATARS.youssef,
    hasStory: false,
    isOnline: true,
    storyPreview: null,
    nowPlaying: null,
  },
];

// Friend stories content
const friendStories: Record<string, {
  content: { type: 'image' | 'now_playing'; url?: string; track?: { title: string; artist: string; thumbnail: string } }[]
}> = {
  'aziz': {
    content: [
      { type: 'now_playing', track: { title: 'Last Last', artist: 'Burna Boy', thumbnail: 'https://i.ytimg.com/vi/421w1j87fEM/hqdefault.jpg' } },
      { type: 'image', url: STORY_PREVIEWS.aziz },
    ]
  },
  'kenza': {
    content: [
      { type: 'now_playing', track: { title: 'Essence', artist: 'Wizkid ft. Tems', thumbnail: 'https://i.ytimg.com/vi/jipQpjUA_o8/hqdefault.jpg' } },
      { type: 'image', url: STORY_PREVIEWS.kenza },
    ]
  },
  'sarah': {
    content: [
      { type: 'now_playing', track: { title: 'Calm Down', artist: 'Rema', thumbnail: 'https://i.ytimg.com/vi/WcIcVapfqXw/hqdefault.jpg' } },
      { type: 'image', url: STORY_PREVIEWS.sarah },
    ]
  },
};

// Chat messages with Snapchat-style status
type MessageStatus = 'new_image' | 'new_video' | 'new_voice' | 'received' | 'opened' | 'delivered' | 'sent' | 'new_dm';
interface Message {
  id: string;
  friendId: string;
  friendName: string;
  friendAvatar: string;
  isOnline: boolean;
  status: MessageStatus;
  statusText: string;
  time: string;
  isNew: boolean;
  unreadCount?: number;
}

const messages: Message[] = [
  { id: '1', friendId: 'oyodj', friendName: 'Oyo DJ', friendAvatar: 'https://i.ytimg.com/vi/421w1j87fEM/hqdefault.jpg', isOnline: true, status: 'new_dm', statusText: 'New Message', time: 'now', isNew: true, unreadCount: 1 },
  { id: '2', friendId: 'dash', friendName: 'Dash', friendAvatar: AVATARS.dash, isOnline: true, status: 'new_dm', statusText: 'New Message', time: '2m', isNew: true, unreadCount: 3 },
  { id: '3', friendId: 'aziz', friendName: 'Aziz', friendAvatar: AVATARS.aziz, isOnline: true, status: 'new_image', statusText: 'New Image', time: '5m', isNew: true, unreadCount: 2 },
  { id: '4', friendId: 'omar', friendName: 'Omar', friendAvatar: AVATARS.omar, isOnline: false, status: 'new_voice', statusText: 'New Voice Note', time: '1h', isNew: true, unreadCount: 1 },
  { id: '5', friendId: 'kenza', friendName: 'Kenza', friendAvatar: AVATARS.kenza, isOnline: true, status: 'received', statusText: 'Received', time: '3h', isNew: false },
  { id: '6', friendId: 'sarah', friendName: 'Sarah', friendAvatar: AVATARS.sarah, isOnline: true, status: 'opened', statusText: 'Opened', time: '5h', isNew: false },
];

// Status colors like Snapchat
const statusColors: Record<MessageStatus, string> = {
  new_dm: '#a855f7', // Purple for DMs
  new_image: '#9333ea', // Purple for images
  new_video: '#9333ea', // Purple for video
  new_voice: '#3b82f6', // Blue for voice
  received: '#9333ea',
  opened: '#6b7280',
  delivered: '#6b7280',
  sent: '#6b7280',
};

// ============================================
// STORY VIEWER
// ============================================
interface StoryViewerProps {
  friend: typeof friends[0];
  onClose: () => void;
}

const StoryViewer = ({ friend, onClose }: StoryViewerProps) => {
  const story = friendStories[friend.id];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState('');

  const dragY = useMotionValue(0);
  const opacity = useTransform(dragY, [0, 150], [1, 0.5]);
  const scale = useTransform(dragY, [0, 150], [1, 0.92]);

  const content = story?.content || [];
  const currentContent = content[currentIndex];
  const DURATION = 5000;

  useEffect(() => {
    if (isPaused || showReply || !content.length) return;
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          if (currentIndex < content.length - 1) {
            setCurrentIndex(i => i + 1);
            return 0;
          }
          onClose();
          return 100;
        }
        return p + (100 / (DURATION / 50));
      });
    }, 50);
    return () => clearInterval(interval);
  }, [currentIndex, content.length, isPaused, showReply, onClose]);

  useEffect(() => { setProgress(0); }, [currentIndex]);

  const handleTap = (e: React.MouseEvent) => {
    if (showReply) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width * 0.3 && currentIndex > 0) setCurrentIndex(i => i - 1);
    else if (x > rect.width * 0.7 && currentIndex < content.length - 1) setCurrentIndex(i => i + 1);
  };

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.y > 100) onClose();
  };

  if (!content.length) return null;

  return (
    <motion.div
      className="fixed inset-0 z-[100] bg-black"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="h-full w-full"
        style={{ opacity, scale, y: dragY }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        onPointerDown={() => setIsPaused(true)}
        onPointerUp={() => setIsPaused(false)}
        onClick={handleTap}
      >
        {/* Progress bars */}
        <div className="absolute top-0 inset-x-0 z-30 flex gap-1 p-3 pt-12">
          {content.map((_, i) => (
            <div key={i} className="flex-1 h-[2px] bg-white/20 rounded-full overflow-hidden">
              <motion.div className="h-full bg-white" style={{ width: i < currentIndex ? '100%' : i === currentIndex ? `${progress}%` : '0%' }} />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-16 inset-x-0 z-30 flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <img src={friend.avatar} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-white/20" />
            <div>
              <p className="text-white font-semibold text-sm">{friend.name}</p>
              <p className="text-white/60 text-xs">{currentContent?.type === 'now_playing' ? 'Now Playing' : 'Story'}</p>
            </div>
          </div>
          <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="p-2">
            <X className="w-6 h-6 text-white" />
          </button>
        </div>

        {/* Pause indicator */}
        <AnimatePresence>
          {isPaused && !showReply && (
            <motion.div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="w-20 h-20 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
                <Pause className="w-10 h-10 text-white" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div key={currentIndex} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {currentContent?.type === 'now_playing' && currentContent.track ? (
              <div className="h-full flex flex-col items-center justify-center p-8 bg-gradient-to-b from-black via-[#0a0a0f] to-black">
                <motion.div className="relative mb-10" animate={isPaused ? {} : { scale: [1, 1.02, 1] }} transition={{ duration: 3, repeat: Infinity }}>
                  <div className="absolute inset-0 blur-3xl bg-purple-500/30 scale-150" />
                  <img src={currentContent.track.thumbnail} alt="" className="relative w-56 h-56 rounded-2xl object-cover shadow-2xl" />
                  <div className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-black/60 backdrop-blur flex items-center justify-center">
                    <Volume2 className="w-5 h-5 text-white animate-pulse" />
                  </div>
                </motion.div>
                <div className="flex items-end gap-1 mb-6 h-8">
                  {[...Array(5)].map((_, i) => (
                    <motion.div key={i} className="w-1 bg-white/80 rounded-full" animate={isPaused ? { height: 8 } : { height: [8, 24, 8] }} transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.1 }} />
                  ))}
                </div>
                <h2 className="text-2xl font-bold text-white text-center mb-1">{currentContent.track.title}</h2>
                <p className="text-white/60 mb-8">{currentContent.track.artist}</p>
                <div className="flex gap-4">
                  <motion.button className="px-8 py-3 rounded-full bg-white text-black font-semibold flex items-center gap-2" whileTap={{ scale: 0.95 }} onClick={(e) => e.stopPropagation()}>
                    <Play className="w-5 h-5" /> Play
                  </motion.button>
                  <motion.button className="px-6 py-3 rounded-full bg-white/10 text-white font-medium" whileTap={{ scale: 0.95 }} onClick={(e) => e.stopPropagation()}>
                    + Queue
                  </motion.button>
                </div>
              </div>
            ) : currentContent?.url ? (
              <img src={currentContent.url} alt="" className="w-full h-full object-cover" />
            ) : null}
          </motion.div>
        </AnimatePresence>

        {/* Reply bar */}
        <div className="absolute bottom-0 inset-x-0 z-30 p-4 pb-8">
          {showReply ? (
            <motion.div className="flex items-center gap-2 bg-white/10 backdrop-blur-xl rounded-full p-2" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} onClick={(e) => e.stopPropagation()}>
              <input type="text" className="flex-1 bg-transparent text-white px-4 py-2 outline-none" placeholder={`Reply to ${friend.name}...`} value={replyText} onChange={(e) => setReplyText(e.target.value)} autoFocus />
              <button className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
                <Send className="w-5 h-5 text-black" />
              </button>
            </motion.div>
          ) : (
            <div className="flex items-center gap-3">
              <motion.button className="flex-1 py-3 rounded-full bg-white/10 backdrop-blur-sm text-white/80 text-sm" whileTap={{ scale: 0.98 }} onClick={(e) => { e.stopPropagation(); setShowReply(true); }}>
                Send a message...
              </motion.button>
              <motion.button className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center" whileTap={{ scale: 0.9 }} onClick={(e) => e.stopPropagation()}>
                <Heart className="w-6 h-6 text-white" />
              </motion.button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

// ============================================
// MAIN HUB
// ============================================
interface HubProps {
  onOpenProfile?: () => void;
}

export const Hub = ({ onOpenProfile }: HubProps) => {
  const [selectedFriend, setSelectedFriend] = useState<typeof friends[0] | null>(null);
  const [myNote, setMyNote] = useState('');
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteInput, setNoteInput] = useState('');
  const [messageTab, setMessageTab] = useState<'all' | 'unread' | 'stories'>('all');
  const [isUniverseOpen, setIsUniverseOpen] = useState(false);
  const [activeChat, setActiveChat] = useState<{
    username: string;
    displayName: string;
    avatar: string | null;
  } | null>(null);

  // Connect to real player state
  const { currentTrack, queue } = usePlayerStore();

  // Get current logged in user
  const { currentUsername } = useUniverseStore();
  const myNowPlaying = currentTrack ? { title: currentTrack.title, artist: currentTrack.artist } : null;
  const nextTrack = queue[0] || null;

  // Auto-fill note with what I'm listening to if empty
  const displayNote = myNote || (myNowPlaying ? `♪ ${myNowPlaying.title}` : '');
  const isAutoNote = !myNote && myNowPlaying;

  // Filter messages by tab
  const unreadCount = messages.filter(m => m.isNew).length;
  const storiesCount = friends.filter(f => f.hasStory).length;
  const filteredMessages = messageTab === 'unread'
    ? messages.filter(m => m.isNew)
    : messageTab === 'stories'
      ? []
      : messages;

  return (
    <div className="h-full bg-[#0a0a0f] overflow-y-auto pb-24">
      {/* Story Viewer */}
      <AnimatePresence>
        {selectedFriend && <StoryViewer friend={selectedFriend} onClose={() => setSelectedFriend(null)} />}
      </AnimatePresence>

      {/* Direct Message Chat */}
      <AnimatePresence>
        {activeChat && currentUsername && (
          <DirectMessageChat
            currentUser={currentUsername}
            otherUser={activeChat.username}
            otherUserDisplayName={activeChat.displayName}
            otherUserAvatar={activeChat.avatar}
            onBack={() => setActiveChat(null)}
          />
        )}
      </AnimatePresence>

      {/* Universe Panel */}
      <UniversePanel isOpen={isUniverseOpen} onClose={() => setIsUniverseOpen(false)} />

      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#0a0a0f]/95 backdrop-blur-xl border-b border-white/[0.05]">
        <div className="flex items-center justify-between px-6 py-5">
          <h1 className="text-xl font-bold text-white tracking-tight">DAHUB</h1>
          <motion.button
            onClick={() => setIsUniverseOpen(true)}
            className="p-2 -mr-2 rounded-full hover:bg-white/[0.08] active:bg-white/[0.12] transition-colors"
            whileTap={{ scale: 0.95 }}
          >
            <Settings className="w-5 h-5 text-white/60" />
          </motion.button>
        </div>
      </div>

      {/* My Profile + Now Playing Preview */}
      <div className="px-6 pt-5 pb-4">
        <motion.div
          className="relative flex items-center gap-4 p-5 rounded-3xl bg-gradient-to-br from-purple-500/[0.12] via-fuchsia-500/[0.08] to-pink-500/[0.12] border border-white/[0.08] overflow-hidden cursor-pointer"
          whileTap={{ scale: 0.98 }}
          transition={{ duration: 0.2 }}
          onClick={() => setIsUniverseOpen(true)}
        >
          {/* Subtle glow effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-purple-400/[0.03] to-pink-400/[0.03] blur-2xl" />

          {/* Profile - Left */}
          <div className="relative flex-shrink-0 z-10">
            <div className="relative">
              <img src={AVATARS.dash} alt="" className="w-16 h-16 rounded-full object-cover ring-2 ring-white/[0.08]" />
              <div className="absolute -bottom-0.5 -right-0.5 w-[18px] h-[18px] rounded-full bg-green-500 border-[3px] border-[#0a0a0f] shadow-lg" />
            </div>
          </div>

          <div className="flex-1 min-w-0 z-10">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="text-white font-semibold text-base">Dash</p>
              <ChevronRight className="w-4 h-4 text-white/40" />
            </div>
            <p className="text-white/50 text-sm font-medium">Tap for account & stats</p>
          </div>

          {/* Timeline Preview - Right */}
          <div className="flex items-center gap-2 z-10">
            {/* Current Track */}
            {currentTrack?.trackId ? (
              <div className="relative w-14 h-14 rounded-xl overflow-hidden shadow-lg ring-1 ring-white/[0.1]">
                <img src={getYouTubeThumbnail(currentTrack.trackId, 'medium')} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                <div className="absolute top-1.5 left-1.5 flex gap-0.5">
                  {[...Array(3)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="w-0.5 bg-white rounded-full shadow-sm"
                      animate={{ height: [4, 10, 4] }}
                      transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.12, ease: "easeInOut" }}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className="w-14 h-14 rounded-xl bg-white/5 flex items-center justify-center ring-1 ring-white/[0.1]">
                <Music2 className="w-6 h-6 text-white/30" />
              </div>
            )}
            {/* Next in Queue */}
            {nextTrack?.track?.trackId ? (
              <div className="relative w-11 h-11 rounded-lg overflow-hidden opacity-50 ring-1 ring-white/[0.05]">
                <img src={getYouTubeThumbnail(nextTrack.track.trackId, 'medium')} alt="" className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-11 h-11 rounded-lg bg-white/5 opacity-50 ring-1 ring-white/[0.05]" />
            )}
            {/* Account Icon */}
            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center ml-1">
              <User className="w-4 h-4 text-white/60" />
            </div>
          </div>
        </motion.div>
      </div>

      {/* Note Editor Modal */}
      <AnimatePresence>
        {isEditingNote && (
          <motion.div
            className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-xl flex items-end justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsEditingNote(false)}
          >
            <motion.div
              className="w-full max-w-md bg-[#1a1a24] rounded-t-3xl p-6 pb-10"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <button onClick={() => setIsEditingNote(false)} className="text-white/50 text-sm">Cancel</button>
                <p className="text-white font-semibold">New Note</p>
                <button
                  onClick={() => {
                    setMyNote(noteInput);
                    setIsEditingNote(false);
                  }}
                  className="text-purple-400 font-semibold text-sm"
                >
                  Share
                </button>
              </div>

              {/* Preview */}
              <div className="flex flex-col items-center mb-6">
                <div className="relative mb-2">
                  {/* Note bubble preview */}
                  <motion.div
                    className="px-4 py-2 rounded-2xl bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 mb-2"
                    animate={{ scale: [1, 1.02, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <p className="text-white text-sm">
                      {noteInput || (myNowPlaying ? `♪ ${myNowPlaying.title}` : 'Your note...')}
                    </p>
                  </motion.div>
                  <div className="w-3 h-3 rotate-45 bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-r border-b border-purple-500/30 mx-auto -mt-2" />
                </div>
                <img src={AVATARS.dash} alt="" className="w-16 h-16 rounded-full object-cover ring-2 ring-purple-500/50" />
                <p className="text-white/50 text-xs mt-2">Your note • 24h</p>
              </div>

              {/* Input */}
              <div className="relative">
                <input
                  type="text"
                  value={noteInput}
                  onChange={(e) => setNoteInput(e.target.value.slice(0, 60))}
                  placeholder={myNowPlaying ? `♪ ${myNowPlaying.title} (auto)` : "What's on your mind?"}
                  className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 outline-none focus:border-purple-500/50 transition-colors"
                  autoFocus
                  maxLength={60}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 text-xs">
                  {noteInput.length}/60
                </span>
              </div>

              {/* Music auto-fill hint */}
              {myNowPlaying && !noteInput && (
                <div className="flex items-center gap-2 mt-3 px-2">
                  <Music2 className="w-3.5 h-3.5 text-purple-400" />
                  <p className="text-white/40 text-xs">Leave empty to share what you're listening to</p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notes - Instagram Style (Clean Gray Bubbles) */}
      <div className="py-3">
        <div className="flex gap-4 overflow-x-auto pb-3 px-6 scrollbar-hide">
          {/* Your Note */}
          <motion.button
            className="flex flex-col items-center flex-shrink-0"
            onClick={() => {
              setNoteInput(myNote);
              setIsEditingNote(true);
            }}
            whileTap={{ scale: 0.92 }}
            transition={{ duration: 0.15 }}
          >
            {/* Note bubble */}
            <div className="mb-2 min-h-[32px] flex items-end justify-center">
              {displayNote ? (
                <div className="relative">
                  <div className="px-4 py-2 rounded-2xl bg-[#2a2a2a] shadow-lg">
                    <p className="text-white text-[11px] font-medium max-w-[76px] truncate leading-tight">{displayNote}</p>
                  </div>
                  <div className="absolute left-1/2 -translate-x-1/2 -bottom-[5px] w-2.5 h-2.5 rotate-45 bg-[#2a2a2a]" />
                </div>
              ) : (
                <div className="relative">
                  <div className="px-4 py-2 rounded-2xl border-[1.5px] border-dashed border-white/[0.25] bg-white/[0.02]">
                    <Plus className="w-3.5 h-3.5 text-white/50" />
                  </div>
                  <div className="absolute left-1/2 -translate-x-1/2 -bottom-[5px] w-2.5 h-2.5 rotate-45 border-r-[1.5px] border-b-[1.5px] border-dashed border-white/[0.25] bg-[#0a0a0f]" />
                </div>
              )}
            </div>
            {/* Avatar */}
            <div className="relative">
              <div className={`absolute -inset-[2.5px] rounded-full ${displayNote ? 'bg-gradient-to-br from-purple-500 via-fuchsia-500 to-pink-500' : 'border-[1.5px] border-dashed border-white/[0.35]'}`} />
              <img src={AVATARS.dash} alt="" className="relative w-[60px] h-[60px] rounded-full object-cover ring-[3px] ring-[#0a0a0f]" />
            </div>
            <span className="text-white/60 text-[10px] font-medium mt-2 tracking-wide">Your note</span>
          </motion.button>

          {/* Friends with notes */}
          {friends.map((friend) => {
            const note = friendNotes.find(n => n.friend === friend.name);
            const autoNote = !note && friend.nowPlaying ? `♪${friend.nowPlaying.title}` : null;
            const friendDisplayNote = note?.note || autoNote;

            return (
              <motion.button
                key={friend.id}
                className="flex flex-col items-center flex-shrink-0"
                onClick={() => friend.hasStory && setSelectedFriend(friend)}
                whileTap={{ scale: 0.92 }}
                transition={{ duration: 0.15 }}
              >
                {/* Note bubble */}
                <div className="mb-2 min-h-[32px] flex items-end justify-center">
                  {friendDisplayNote && (
                    <div className="relative">
                      <div className="px-4 py-2 rounded-2xl bg-[#2a2a2a] shadow-lg">
                        <p className="text-white text-[11px] font-medium max-w-[76px] truncate leading-tight">{friendDisplayNote}</p>
                      </div>
                      <div className="absolute left-1/2 -translate-x-1/2 -bottom-[5px] w-2.5 h-2.5 rotate-45 bg-[#2a2a2a]" />
                    </div>
                  )}
                </div>
                {/* Avatar */}
                <div className="relative">
                  {friend.hasStory && (
                    <div className="absolute -inset-[2.5px] rounded-full bg-gradient-to-br from-purple-500 via-fuchsia-500 to-pink-500" />
                  )}
                  <img
                    src={friend.avatar}
                    alt=""
                    className={`relative w-[60px] h-[60px] rounded-full object-cover ring-[3px] ring-[#0a0a0f] ${!friend.hasStory && !friendDisplayNote ? 'opacity-40' : ''}`}
                  />
                  {friend.isOnline && (
                    <div className="absolute bottom-0.5 right-0.5 w-[14px] h-[14px] rounded-full bg-green-500 border-[3px] border-[#0a0a0f] shadow-sm" />
                  )}
                </div>
                <span className={`text-[10px] font-medium mt-2 tracking-wide ${friend.hasStory || friendDisplayNote ? 'text-white/70' : 'text-white/40'}`}>{friend.name}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Following - Artists */}
      <div className="px-6 py-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-white/60 text-xs font-semibold uppercase tracking-widest">Following</p>
          <motion.button
            className="flex items-center gap-1 text-white/40 text-xs font-medium hover:text-white/60 transition-colors"
            whileTap={{ scale: 0.95 }}
          >
            See all <ChevronRight className="w-3 h-3" />
          </motion.button>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-6 px-6 scrollbar-hide">
          {celebrities.map((celeb) => (
            <motion.button
              key={celeb.id}
              className="flex-shrink-0 relative w-[120px] h-[160px] rounded-3xl overflow-hidden shadow-xl"
              whileTap={{ scale: 0.96 }}
              transition={{ duration: 0.2 }}
            >
              {/* Background */}
              <img
                src={celeb.latestRelease.thumbnail}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-black/20" />

              {/* Green ring for verified artists */}
              <div className="absolute top-3 left-3">
                <div className="relative">
                  <div className="absolute -inset-[2.5px] rounded-full bg-gradient-to-br from-green-400 to-emerald-500 shadow-lg" />
                  <img src={celeb.avatar} alt="" className="relative w-9 h-9 rounded-full object-cover ring-2 ring-black/50" />
                </div>
              </div>

              {/* Verified badge or Live */}
              <div className="absolute top-3 right-3">
                {celeb.isLive ? (
                  <div className="px-2 py-0.5 rounded-md bg-red-500 shadow-lg">
                    <p className="text-white text-[9px] font-bold tracking-wide">LIVE</p>
                  </div>
                ) : celeb.verified && (
                  <BadgeCheck className="w-4.5 h-4.5 text-blue-400 drop-shadow-lg" />
                )}
              </div>

              {/* Name at bottom */}
              <div className="absolute bottom-3 left-3 right-3">
                <p className="text-white text-sm font-semibold truncate mb-0.5 drop-shadow-lg">{celeb.name}</p>
                <p className="text-white/70 text-[11px] font-medium truncate">{celeb.latestRelease.title}</p>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Activity - Mixed board style with tabs */}
      <div className="px-6 py-5">
        {/* Tabs */}
        <div className="flex items-center gap-2 mb-5 overflow-x-auto scrollbar-hide">
          <motion.button
            onClick={() => setMessageTab('all')}
            className={`px-5 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
              messageTab === 'all'
                ? 'bg-white text-black shadow-lg'
                : 'bg-white/[0.08] text-white/60 hover:bg-white/[0.12] hover:text-white/80'
            }`}
            whileTap={{ scale: 0.95 }}
          >
            All
          </motion.button>
          <motion.button
            onClick={() => setMessageTab('unread')}
            className={`px-5 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${
              messageTab === 'unread'
                ? 'bg-white text-black shadow-lg'
                : 'bg-white/[0.08] text-white/60 hover:bg-white/[0.12] hover:text-white/80'
            }`}
            whileTap={{ scale: 0.95 }}
          >
            Unread
            {unreadCount > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                messageTab === 'unread' ? 'bg-purple-500 text-white' : 'bg-purple-500 text-white'
              }`}>
                {unreadCount}
              </span>
            )}
          </motion.button>
          <motion.button
            onClick={() => setMessageTab('stories')}
            className={`px-5 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${
              messageTab === 'stories'
                ? 'bg-white text-black shadow-lg'
                : 'bg-white/[0.08] text-white/60 hover:bg-white/[0.12] hover:text-white/80'
            }`}
            whileTap={{ scale: 0.95 }}
          >
            Stories
            {storiesCount > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                messageTab === 'stories' ? 'bg-pink-500 text-white' : 'bg-pink-500 text-white'
              }`}>
                {storiesCount}
              </span>
            )}
          </motion.button>
        </div>

        {/* Activity List */}
        <div className="space-y-2">
          {messageTab === 'stories' ? (
            /* Stories Tab */
            friends.filter(f => f.hasStory).map((friend) => (
              <motion.button
                key={friend.id}
                className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] active:bg-white/[0.06] transition-colors"
                onClick={() => setSelectedFriend(friend)}
                whileTap={{ scale: 0.98 }}
              >
                <div className="relative flex-shrink-0">
                  <div className="absolute -inset-[2.5px] rounded-full bg-gradient-to-br from-purple-500 via-fuchsia-500 to-pink-500" />
                  <img src={friend.avatar} alt="" className="relative w-13 h-13 rounded-full object-cover ring-[3px] ring-[#0a0a0f]" />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-white text-sm font-semibold mb-0.5">{friend.name}</p>
                  <p className="text-white/60 text-xs font-medium">Tap to view story</p>
                </div>
              </motion.button>
            ))
          ) : (
            <>
              {/* Friends listening - Mixed board (album art + avatar) */}
              {friends.filter(f => f.nowPlaying).map((friend) => {
                const msg = messages.find(m => m.friendId === friend.id);
                if (messageTab === 'unread' && !msg?.isNew) return null;
                return (
                  <motion.button
                    key={friend.id}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] active:bg-white/[0.06] transition-colors"
                    onClick={() => setSelectedFriend(friend)}
                    whileTap={{ scale: 0.98 }}
                  >
                    {/* Album art + avatar overlay */}
                    <div className="relative flex-shrink-0">
                      <img src={friend.nowPlaying?.thumbnail} alt="" className="w-13 h-13 rounded-xl object-cover shadow-md ring-1 ring-white/[0.05]" />
                      <img src={friend.avatar} alt="" className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full object-cover ring-[3px] ring-[#0a0a0f] shadow-lg" />
                    </div>
                    {/* Info */}
                    <div className="flex-1 text-left min-w-0 pr-2">
                      <p className="text-white text-sm font-semibold truncate mb-0.5">{friend.name}</p>
                      <p className="text-white/60 text-xs font-medium truncate">{friend.nowPlaying?.title} • {friend.nowPlaying?.artist}</p>
                    </div>
                    {/* Status */}
                    {msg?.isNew ? (
                      <div className="flex flex-col items-end flex-shrink-0 min-w-[76px]">
                        <p className="text-xs font-semibold mb-0.5" style={{ color: statusColors[msg.status] }}>
                          {msg.statusText}
                        </p>
                        <span className="text-white/40 text-[10px] font-medium">{msg.time}</span>
                      </div>
                    ) : (
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0 shadow-sm" />
                    )}
                  </motion.button>
                );
              })}

              {/* Messages from friends not listening */}
              {filteredMessages.filter(m => !friends.find(f => f.id === m.friendId && f.nowPlaying)).map((msg) => (
                <motion.button
                  key={msg.id}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-white/[0.03] active:bg-white/[0.04] transition-colors"
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveChat({
                    username: msg.friendId,
                    displayName: msg.friendName,
                    avatar: msg.friendAvatar,
                  })}
                >
                  {/* Circle avatar */}
                  <div className="relative flex-shrink-0">
                    <img src={msg.friendAvatar} alt="" className="w-13 h-13 rounded-full object-cover ring-1 ring-white/[0.05]" />
                    {msg.isOnline && (
                      <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-green-500 border-[3px] border-[#0a0a0f] shadow-sm" />
                    )}
                  </div>
                  {/* Info */}
                  <div className="flex-1 text-left min-w-0 pr-2">
                    <p className={`text-sm font-semibold mb-0.5 ${msg.isNew ? 'text-white' : 'text-white/60'}`}>
                      {msg.friendName}
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-sm flex-shrink-0 shadow-sm" style={{ backgroundColor: msg.isNew ? statusColors[msg.status] : '#4b5563' }} />
                      <p className="text-xs font-medium truncate" style={{ color: msg.isNew ? statusColors[msg.status] : '#6b7280' }}>
                        {msg.statusText}
                      </p>
                      <span className="text-white/40 text-xs font-medium flex-shrink-0">• {msg.time}</span>
                    </div>
                  </div>
                  {msg.isNew && (
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0 shadow-sm" />
                  )}
                </motion.button>
              ))}
            </>
          )}
        </div>

        {/* Empty state */}
        {messageTab === 'unread' && filteredMessages.length === 0 && friends.filter(f => f.nowPlaying).every(f => !messages.find(m => m.friendId === f.id)?.isNew) && (
          <div className="py-12 text-center">
            <p className="text-white/40 text-sm font-medium">No unread activity</p>
          </div>
        )}
      </div>

      <div className="h-24" />
    </div>
  );
};

export default Hub;
