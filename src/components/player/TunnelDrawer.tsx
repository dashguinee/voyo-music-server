// VOYO Music - THE TUNNEL Queue Drawer
// Visualizes the musical journey: Past → NOW → Future

import React, { useState } from 'react';
import { motion, AnimatePresence, Reorder, PanInfo } from 'framer-motion';
import { X, Music2, Plus, Trash2, GripVertical, Heart } from 'lucide-react';
import { usePlayerStore } from '../../store/playerStore';
import { Track } from '../../types';
import { getThumbnailUrl } from '../../data/tracks';
import { PlaylistModal } from '../playlist/PlaylistModal';

interface TunnelDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSearch?: () => void;
}

const TunnelDrawer: React.FC<TunnelDrawerProps> = ({
  isOpen,
  onClose,
  onOpenSearch,
}) => {
  const {
    queue,
    history,
    currentTrack,
    removeFromQueue,
    reorderQueue,
    setCurrentTrack,
    clearQueue,
  } = usePlayerStore();

  const [queueItems, setQueueItems] = useState(queue);
  const [playlistTrack, setPlaylistTrack] = useState<Track | null>(null);

  // Sync queue items when store updates
  React.useEffect(() => {
    setQueueItems(queue);
  }, [queue]);

  // Handle reorder
  const handleReorder = (newOrder: typeof queueItems) => {
    setQueueItems(newOrder);
    // Update store with new order
    newOrder.forEach((item, index) => {
      const oldIndex = queue.findIndex((q) => q.track.id === item.track.id);
      if (oldIndex !== index && oldIndex !== -1) {
        reorderQueue(oldIndex, index);
      }
    });
  };

  // Handle swipe to remove
  const handleSwipeRemove = (index: number, info: PanInfo) => {
    if (Math.abs(info.offset.x) > 100) {
      removeFromQueue(index);
    }
  };

  // Replay from history
  const handleReplayTrack = (track: Track) => {
    setCurrentTrack(track);
    // FIX: Explicitly start playback when replaying from history
    setTimeout(() => usePlayerStore.getState().togglePlay(), 100);
  };

  // Get last 5 history items
  const recentHistory = history.slice(-5).reverse();

  // Total tracks count
  const totalTracks = recentHistory.length + (currentTrack ? 1 : 0) + queue.length;

  // Format duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />

          {/* Drawer */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => {
              if (info.offset.y > 200) {
                onClose();
              }
            }}
            className="fixed inset-x-0 bottom-0 z-50 h-[85vh] rounded-t-[2rem] bg-[#0a0a0f]/95 backdrop-blur-xl border-t border-white/10 shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Drag Handle */}
            <div className="flex justify-center py-3 cursor-grab active:cursor-grabbing">
              <div className="w-12 h-1.5 rounded-full bg-white/20" />
            </div>

            {/* Header */}
            <div className="px-6 pb-4 border-b border-white/10">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">
                    THE TUNNEL
                  </h2>
                  <p className="text-sm text-white/50 mt-1">
                    {totalTracks} {totalTracks === 1 ? 'track' : 'tracks'} in your journey
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5 text-white/70" />
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
              {/* HISTORY Section */}
              {recentHistory.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-4">
                    Recently Played
                  </h3>
                  <div className="space-y-2">
                    {recentHistory.map((item) => (
                      <motion.button
                        key={item.playedAt}
                        onClick={() => handleReplayTrack(item.track)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors opacity-60 hover:opacity-100"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <img
                          src={getThumbnailUrl(item.track.trackId, 'medium')}
                          alt={item.track.title}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                        <div className="flex-1 text-left">
                          <p className="text-sm font-medium text-white/90 truncate">
                            {item.track.title}
                          </p>
                          <p className="text-xs text-white/50 truncate">
                            {item.track.artist}
                          </p>
                        </div>
                        <span className="text-xs text-white/40">
                          {formatDuration(item.track.duration)}
                        </span>
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              {/* NOW PLAYING Section */}
              {currentTrack && (
                <div>
                  <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-4">
                    Now Playing
                  </h3>
                  <motion.div
                    className="relative p-4 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-2 border-purple-500/50"
                    animate={{
                      boxShadow: [
                        '0 0 20px rgba(168, 85, 247, 0.3)',
                        '0 0 40px rgba(236, 72, 153, 0.4)',
                        '0 0 20px rgba(168, 85, 247, 0.3)',
                      ],
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <img
                          src={getThumbnailUrl(currentTrack.trackId, 'high')}
                          alt={currentTrack.title}
                          className="w-20 h-20 rounded-xl object-cover"
                        />
                        <motion.div
                          className="absolute inset-0 rounded-xl bg-gradient-to-tr from-purple-500/20 to-pink-500/20"
                          animate={{ opacity: [0.3, 0.6, 0.3] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        />
                      </div>
                      <div className="flex-1">
                        <p className="text-lg font-bold text-white mb-1">
                          {currentTrack.title}
                        </p>
                        <p className="text-sm text-white/70">
                          {currentTrack.artist}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs px-2 py-1 rounded-full bg-white/10 text-white/70">
                            {currentTrack.mood?.toUpperCase()}
                          </span>
                          <span className="text-xs text-white/50">
                            {formatDuration(currentTrack.duration)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}

              {/* QUEUE Section */}
              {queue.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                      Up Next ({queue.length})
                    </h3>
                    <button
                      onClick={clearQueue}
                      className="text-xs text-red-400/70 hover:text-red-400 transition-colors flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      Clear
                    </button>
                  </div>
                  <Reorder.Group
                    axis="y"
                    values={queueItems}
                    onReorder={handleReorder}
                    className="space-y-2"
                  >
                    {queueItems.map((item, index) => (
                      <Reorder.Item
                        key={item.track.id}
                        value={item}
                        className="relative"
                      >
                        <motion.div
                          drag="x"
                          dragConstraints={{ left: 0, right: 0 }}
                          onDragEnd={(_, info) => handleSwipeRemove(index, info)}
                          className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors cursor-move"
                          whileHover={{ scale: 1.01 }}
                        >
                          <GripVertical className="w-4 h-4 text-white/30 flex-shrink-0" />
                          <img
                            src={getThumbnailUrl(item.track.trackId, 'medium')}
                            alt={item.track.title}
                            className="w-12 h-12 rounded-lg object-cover"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white/90 truncate">
                              {item.track.title}
                            </p>
                            <p className="text-xs text-white/50 truncate">
                              {item.track.artist}
                            </p>
                          </div>
                          <span className="text-xs text-white/40 flex-shrink-0 mr-1">
                            {formatDuration(item.track.duration)}
                          </span>
                          {/* Heart: tap to like, hold to add to playlist */}
                          <motion.button
                            className="p-1.5 rounded-full hover:bg-white/10"
                            onClick={(e) => e.stopPropagation()}
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              const timer = setTimeout(() => {
                                setPlaylistTrack(item.track);
                              }, 500);
                              (e.currentTarget as any).__timer = timer;
                            }}
                            onPointerUp={(e) => {
                              clearTimeout((e.currentTarget as any).__timer);
                            }}
                            onPointerLeave={(e) => {
                              clearTimeout((e.currentTarget as any).__timer);
                            }}
                            whileTap={{ scale: 0.9 }}
                          >
                            <Heart className="w-4 h-4 text-white/40 hover:text-pink-400" />
                          </motion.button>
                        </motion.div>
                      </Reorder.Item>
                    ))}
                  </Reorder.Group>
                </div>
              )}

              {/* Empty Queue State */}
              {queue.length === 0 && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
                    <Music2 className="w-8 h-8 text-white/30" />
                  </div>
                  <p className="text-white/50 text-sm mb-2">Your queue is empty</p>
                  <p className="text-white/30 text-xs">
                    Add tracks to keep the vibes going
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-white/10 bg-black/20">
              <button
                onClick={onOpenSearch}
                className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
              >
                <Plus className="w-5 h-5" />
                Add More Tracks
              </button>
            </div>

            {/* Playlist Modal */}
            {playlistTrack && (
              <PlaylistModal
                isOpen={!!playlistTrack}
                onClose={() => setPlaylistTrack(null)}
                trackId={playlistTrack.trackId}
                trackTitle={playlistTrack.title}
              />
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default TunnelDrawer;
