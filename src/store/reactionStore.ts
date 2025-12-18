/**
 * VOYO Reaction Store
 *
 * The Social Spine - connects Users, Tracks, and Categories
 *
 * Features:
 * - Create reactions (goes to everyone)
 * - Realtime subscriptions (MixBoard pulse)
 * - Fetch reactions by track (comments view)
 * - Fetch reactions by user (portal history)
 * - Track stats for vibe breakdown
 */

import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// ============================================
// TYPES
// ============================================

export type ReactionCategory =
  | 'afro-heat'
  | 'chill-vibes'
  | 'party-mode'
  | 'late-night'
  | 'workout';

export type ReactionType = 'oyo' | 'oye' | 'fire' | 'chill' | 'hype' | 'love';

export interface Reaction {
  id: string;
  username: string;
  track_id: string;
  track_title: string;
  track_artist: string;
  track_thumbnail?: string;
  category: ReactionCategory;
  emoji: string;
  reaction_type: ReactionType;
  comment?: string;
  created_at: string;
}

export interface TrackStats {
  track_id: string;
  track_title?: string;
  track_artist?: string;
  track_thumbnail?: string;
  total_reactions: number;
  afro_heat_count: number;
  chill_vibes_count: number;
  party_mode_count: number;
  late_night_count: number;
  workout_count: number;
  dominant_category?: ReactionCategory;
  first_reaction_at?: string;
  last_reaction_at?: string;
}

export interface CategoryPulse {
  category: ReactionCategory;
  count: number;
  lastReaction?: Reaction;
  isHot: boolean; // Had reaction in last 30 seconds
}

// ============================================
// STORE
// ============================================

interface ReactionStore {
  // State
  recentReactions: Reaction[];
  trackReactions: Map<string, Reaction[]>;
  trackStats: Map<string, TrackStats>;
  categoryPulse: Record<ReactionCategory, CategoryPulse>;
  isSubscribed: boolean;

  // Actions
  createReaction: (params: {
    username: string;
    trackId: string;
    trackTitle: string;
    trackArtist: string;
    trackThumbnail?: string;
    category: ReactionCategory;
    emoji?: string;
    reactionType?: ReactionType;
    comment?: string;
  }) => Promise<boolean>;

  // Fetching
  fetchTrackReactions: (trackId: string, limit?: number) => Promise<Reaction[]>;
  fetchUserReactions: (username: string, limit?: number) => Promise<Reaction[]>;
  fetchTrackStats: (trackId: string) => Promise<TrackStats | null>;
  fetchRecentReactions: (limit?: number) => Promise<Reaction[]>;

  // Realtime
  subscribeToReactions: () => void;
  unsubscribeFromReactions: () => void;

  // Local updates (for optimistic UI)
  addLocalReaction: (reaction: Reaction) => void;
  pulseCategory: (category: ReactionCategory) => void;
}

// Category config for emojis
const CATEGORY_EMOJIS: Record<ReactionCategory, string> = {
  'afro-heat': '🔥',
  'chill-vibes': '🌙',
  'party-mode': '🎉',
  'late-night': '✨',
  'workout': '💪',
};

// Initial category pulse state
const initialCategoryPulse: Record<ReactionCategory, CategoryPulse> = {
  'afro-heat': { category: 'afro-heat', count: 0, isHot: false },
  'chill-vibes': { category: 'chill-vibes', count: 0, isHot: false },
  'party-mode': { category: 'party-mode', count: 0, isHot: false },
  'late-night': { category: 'late-night', count: 0, isHot: false },
  'workout': { category: 'workout', count: 0, isHot: false },
};

export const useReactionStore = create<ReactionStore>((set, get) => ({
  // Initial state
  recentReactions: [],
  trackReactions: new Map(),
  trackStats: new Map(),
  categoryPulse: { ...initialCategoryPulse },
  isSubscribed: false,

  // ============================================
  // CREATE REACTION
  // ============================================
  createReaction: async ({
    username,
    trackId,
    trackTitle,
    trackArtist,
    trackThumbnail,
    category,
    emoji,
    reactionType = 'oye',
    comment,
  }) => {
    if (!isSupabaseConfigured || !supabase) {
      console.warn('[Reactions] Supabase not configured, using local only');
      // Create local reaction for offline mode
      const localReaction: Reaction = {
        id: `local_${Date.now()}`,
        username,
        track_id: trackId,
        track_title: trackTitle,
        track_artist: trackArtist,
        track_thumbnail: trackThumbnail,
        category,
        emoji: emoji || CATEGORY_EMOJIS[category],
        reaction_type: reactionType,
        comment,
        created_at: new Date().toISOString(),
      };
      get().addLocalReaction(localReaction);
      get().pulseCategory(category);
      return true;
    }

    try {
      const { error } = await supabase.from('reactions').insert({
        username,
        track_id: trackId,
        track_title: trackTitle,
        track_artist: trackArtist,
        track_thumbnail: trackThumbnail,
        category,
        emoji: emoji || CATEGORY_EMOJIS[category],
        reaction_type: reactionType,
        comment,
      });

      if (error) {
        console.error('[Reactions] Error creating reaction:', error);
        return false;
      }

      // Pulse the category locally (realtime will also trigger)
      get().pulseCategory(category);
      return true;
    } catch (err) {
      console.error('[Reactions] Error:', err);
      return false;
    }
  },

  // ============================================
  // FETCH REACTIONS
  // ============================================
  fetchTrackReactions: async (trackId, limit = 50) => {
    if (!isSupabaseConfigured || !supabase) {
      return get().trackReactions.get(trackId) || [];
    }

    try {
      const { data, error } = await supabase
        .from('reactions')
        .select('*')
        .eq('track_id', trackId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      const reactions = data as Reaction[];

      // Cache locally
      set((state) => {
        const newMap = new Map(state.trackReactions);
        newMap.set(trackId, reactions);
        return { trackReactions: newMap };
      });

      return reactions;
    } catch (err) {
      console.error('[Reactions] Error fetching track reactions:', err);
      return [];
    }
  },

  fetchUserReactions: async (username, limit = 50) => {
    if (!isSupabaseConfigured || !supabase) return [];

    try {
      const { data, error } = await supabase
        .from('reactions')
        .select('*')
        .eq('username', username)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data as Reaction[];
    } catch (err) {
      console.error('[Reactions] Error fetching user reactions:', err);
      return [];
    }
  },

  fetchTrackStats: async (trackId) => {
    if (!isSupabaseConfigured || !supabase) {
      return get().trackStats.get(trackId) || null;
    }

    try {
      const { data, error } = await supabase
        .from('track_stats')
        .select('*')
        .eq('track_id', trackId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }

      const stats = data as TrackStats;

      // Cache locally
      set((state) => {
        const newMap = new Map(state.trackStats);
        newMap.set(trackId, stats);
        return { trackStats: newMap };
      });

      return stats;
    } catch (err) {
      console.error('[Reactions] Error fetching track stats:', err);
      return null;
    }
  },

  fetchRecentReactions: async (limit = 20) => {
    if (!isSupabaseConfigured || !supabase) {
      return get().recentReactions;
    }

    try {
      const { data, error } = await supabase
        .from('reactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      const reactions = data as Reaction[];
      set({ recentReactions: reactions });
      return reactions;
    } catch (err) {
      console.error('[Reactions] Error fetching recent reactions:', err);
      return [];
    }
  },

  // ============================================
  // REALTIME SUBSCRIPTIONS
  // ============================================
  subscribeToReactions: () => {
    if (!isSupabaseConfigured || !supabase || get().isSubscribed) return;

    console.log('[Reactions] Subscribing to realtime updates...');

    const channel = supabase
      .channel('reactions-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'reactions',
        },
        (payload) => {
          const newReaction = payload.new as Reaction;
          console.log('[Reactions] New reaction received:', newReaction);

          // Add to recent reactions
          set((state) => ({
            recentReactions: [newReaction, ...state.recentReactions].slice(0, 50),
          }));

          // Add to track reactions if we're tracking that track
          set((state) => {
            const trackReactions = state.trackReactions.get(newReaction.track_id);
            if (trackReactions) {
              const newMap = new Map(state.trackReactions);
              newMap.set(newReaction.track_id, [newReaction, ...trackReactions].slice(0, 100));
              return { trackReactions: newMap };
            }
            return state;
          });

          // Pulse the category
          get().pulseCategory(newReaction.category);
        }
      )
      .subscribe();

    set({ isSubscribed: true });

    // Store channel reference for cleanup
    (window as any).__voyoReactionChannel = channel;
  },

  unsubscribeFromReactions: () => {
    const channel = (window as any).__voyoReactionChannel;
    if (channel && supabase) {
      supabase.removeChannel(channel);
      delete (window as any).__voyoReactionChannel;
    }
    set({ isSubscribed: false });
  },

  // ============================================
  // LOCAL UPDATES
  // ============================================
  addLocalReaction: (reaction) => {
    set((state) => ({
      recentReactions: [reaction, ...state.recentReactions].slice(0, 50),
    }));

    // Add to track reactions
    set((state) => {
      const newMap = new Map(state.trackReactions);
      const existing = newMap.get(reaction.track_id) || [];
      newMap.set(reaction.track_id, [reaction, ...existing].slice(0, 100));
      return { trackReactions: newMap };
    });
  },

  pulseCategory: (category) => {
    set((state) => ({
      categoryPulse: {
        ...state.categoryPulse,
        [category]: {
          ...state.categoryPulse[category],
          count: state.categoryPulse[category].count + 1,
          isHot: true,
        },
      },
    }));

    // Reset hot state after 30 seconds
    setTimeout(() => {
      set((state) => ({
        categoryPulse: {
          ...state.categoryPulse,
          [category]: {
            ...state.categoryPulse[category],
            isHot: false,
          },
        },
      }));
    }, 30000);
  },
}));

// ============================================
// HOOKS
// ============================================

// Auto-subscribe on import (can be called multiple times safely)
export const initReactionSubscription = () => {
  const { subscribeToReactions, isSubscribed } = useReactionStore.getState();
  if (!isSubscribed) {
    subscribeToReactions();
  }
};

export default useReactionStore;
