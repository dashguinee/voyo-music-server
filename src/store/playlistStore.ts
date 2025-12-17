/**
 * VOYO Playlist Store
 *
 * Local-first playlists with cloud sync
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { universeAPI, isSupabaseConfigured } from '../lib/supabase';

export interface Playlist {
  id: string;
  name: string;
  trackIds: string[];
  coverUrl?: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PlaylistStore {
  playlists: Playlist[];

  // CRUD
  createPlaylist: (name: string) => Playlist;
  deletePlaylist: (id: string) => void;
  renamePlaylist: (id: string, name: string) => void;
  togglePublic: (id: string) => void;

  // Track management
  addTrackToPlaylist: (playlistId: string, trackId: string) => void;
  removeTrackFromPlaylist: (playlistId: string, trackId: string) => void;
  reorderPlaylist: (playlistId: string, fromIndex: number, toIndex: number) => void;

  // Sync
  syncToCloud: (username: string) => Promise<boolean>;
  syncFromCloud: (username: string) => Promise<boolean>;

  // Getters
  getPlaylist: (id: string) => Playlist | undefined;
  getPlaylistsByTrack: (trackId: string) => Playlist[];
}

function generateId(): string {
  return `pl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const usePlaylistStore = create<PlaylistStore>()(
  persist(
    (set, get) => ({
      playlists: [],

      createPlaylist: (name: string) => {
        const now = new Date().toISOString();
        const playlist: Playlist = {
          id: generateId(),
          name,
          trackIds: [],
          isPublic: false,
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          playlists: [...state.playlists, playlist],
        }));

        return playlist;
      },

      deletePlaylist: (id: string) => {
        set((state) => ({
          playlists: state.playlists.filter((p) => p.id !== id),
        }));
      },

      renamePlaylist: (id: string, name: string) => {
        set((state) => ({
          playlists: state.playlists.map((p) =>
            p.id === id ? { ...p, name, updatedAt: new Date().toISOString() } : p
          ),
        }));
      },

      togglePublic: (id: string) => {
        set((state) => ({
          playlists: state.playlists.map((p) =>
            p.id === id ? { ...p, isPublic: !p.isPublic, updatedAt: new Date().toISOString() } : p
          ),
        }));
      },

      addTrackToPlaylist: (playlistId: string, trackId: string) => {
        set((state) => ({
          playlists: state.playlists.map((p) =>
            p.id === playlistId && !p.trackIds.includes(trackId)
              ? { ...p, trackIds: [...p.trackIds, trackId], updatedAt: new Date().toISOString() }
              : p
          ),
        }));
      },

      removeTrackFromPlaylist: (playlistId: string, trackId: string) => {
        set((state) => ({
          playlists: state.playlists.map((p) =>
            p.id === playlistId
              ? { ...p, trackIds: p.trackIds.filter((t) => t !== trackId), updatedAt: new Date().toISOString() }
              : p
          ),
        }));
      },

      reorderPlaylist: (playlistId: string, fromIndex: number, toIndex: number) => {
        set((state) => ({
          playlists: state.playlists.map((p) => {
            if (p.id !== playlistId) return p;
            const newTracks = [...p.trackIds];
            const [removed] = newTracks.splice(fromIndex, 1);
            newTracks.splice(toIndex, 0, removed);
            return { ...p, trackIds: newTracks, updatedAt: new Date().toISOString() };
          }),
        }));
      },

      syncToCloud: async (username: string) => {
        if (!isSupabaseConfigured) return false;

        const { playlists } = get();
        const cloudPlaylists = playlists.map((p) => ({
          id: p.id,
          name: p.name,
          trackIds: p.trackIds,
          isPublic: p.isPublic,
          createdAt: p.createdAt,
        }));

        return universeAPI.updateState(username, { playlists: cloudPlaylists });
      },

      syncFromCloud: async (username: string) => {
        if (!isSupabaseConfigured) return false;

        try {
          const { supabase } = await import('../lib/supabase');
          if (!supabase) return false;

          const { data } = await supabase
            .from('universes')
            .select('state')
            .eq('username', username)
            .single();

          if (data?.state?.playlists) {
            const cloudPlaylists = data.state.playlists.map((p: any) => ({
              ...p,
              updatedAt: p.updatedAt || p.createdAt,
            }));
            set({ playlists: cloudPlaylists });
          }

          return true;
        } catch {
          return false;
        }
      },

      getPlaylist: (id: string) => {
        return get().playlists.find((p) => p.id === id);
      },

      getPlaylistsByTrack: (trackId: string) => {
        return get().playlists.filter((p) => p.trackIds.includes(trackId));
      },
    }),
    {
      name: 'voyo-playlists',
      version: 1,
    }
  )
);

export default usePlaylistStore;
