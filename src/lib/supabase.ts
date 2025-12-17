/**
 * VOYO Supabase Client
 *
 * Smart KV with superpowers:
 * - PIN auth (no email/OAuth)
 * - Real-time portals
 * - Company analytics
 */

import { createClient } from '@supabase/supabase-js';

// Get from environment or use defaults for development
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Check if Supabase is configured
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Create client (will be null if not configured)
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : null;

// ============================================
// TYPES
// ============================================

export interface UniverseRow {
  username: string;
  pin_hash: string;
  phone: string | null;
  state: UniverseState;
  public_profile: PublicProfile;
  now_playing: NowPlaying | null;
  portal_open: boolean;
  portal_viewers: string[];
  created_at: string;
  updated_at: string;
  last_active: string;
}

export interface UniverseState {
  likes: string[];
  playlists: Playlist[];
  queue: string[];
  history: HistoryItem[];
  preferences: {
    boostProfile: string;
    shuffleMode: boolean;
    repeatMode: string;
  };
  stats: {
    totalListens: number;
    totalMinutes: number;
    totalOyes: number;
  };
}

export interface PublicProfile {
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  topTracks: string[];
  publicPlaylists: string[];
  isPublic: boolean;
}

export interface NowPlaying {
  trackId: string;
  title: string;
  artist: string;
  thumbnail: string;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
}

export interface Playlist {
  id: string;
  name: string;
  trackIds: string[];
  isPublic: boolean;
  createdAt: string;
}

export interface HistoryItem {
  trackId: string;
  playedAt: string;
  duration: number;
}

// ============================================
// PIN HASHING (Simple for now, use bcrypt in production)
// ============================================

export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + 'voyo-salt-2024');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  const pinHash = await hashPin(pin);
  return pinHash === hash;
}

// ============================================
// UNIVERSE API
// ============================================

export const universeAPI = {
  /**
   * Check if username is available
   */
  async checkUsername(username: string): Promise<boolean> {
    if (!supabase) return true; // Offline mode

    const { data } = await supabase
      .from('universes')
      .select('username')
      .eq('username', username.toLowerCase())
      .single();

    return !data;
  },

  /**
   * Create a new universe (signup)
   */
  async create(
    username: string,
    pin: string,
    displayName?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    const normalizedUsername = username.toLowerCase().replace(/[^a-z0-9_]/g, '');

    // Validate username
    if (normalizedUsername.length < 3) {
      return { success: false, error: 'Username must be at least 3 characters' };
    }

    // Check availability
    const available = await this.checkUsername(normalizedUsername);
    if (!available) {
      return { success: false, error: 'Username already taken' };
    }

    // Hash PIN
    const pinHash = await hashPin(pin);

    // Create universe
    const { error } = await supabase.from('universes').insert({
      username: normalizedUsername,
      pin_hash: pinHash,
      public_profile: {
        displayName: displayName || normalizedUsername,
        bio: '',
        avatarUrl: null,
        topTracks: [],
        publicPlaylists: [],
        isPublic: true,
      },
    });

    if (error) {
      console.error('[VOYO] Create universe error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  },

  /**
   * Login with username + PIN
   */
  async login(
    username: string,
    pin: string
  ): Promise<{ success: boolean; universe?: UniverseRow; error?: string }> {
    if (!supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    const normalizedUsername = username.toLowerCase();

    // Get universe
    const { data, error } = await supabase
      .from('universes')
      .select('*')
      .eq('username', normalizedUsername)
      .single();

    if (error || !data) {
      return { success: false, error: 'Universe not found' };
    }

    // Verify PIN
    const valid = await verifyPin(pin, data.pin_hash);
    if (!valid) {
      return { success: false, error: 'Invalid PIN' };
    }

    // Update last active
    await supabase
      .from('universes')
      .update({ last_active: new Date().toISOString() })
      .eq('username', normalizedUsername);

    return { success: true, universe: data };
  },

  /**
   * Get public profile (for visitors)
   */
  async getPublicProfile(username: string): Promise<{
    profile: PublicProfile | null;
    nowPlaying: NowPlaying | null;
    portalOpen: boolean;
  }> {
    if (!supabase) {
      return { profile: null, nowPlaying: null, portalOpen: false };
    }

    const { data } = await supabase
      .from('universes')
      .select('public_profile, now_playing, portal_open')
      .eq('username', username.toLowerCase())
      .single();

    if (!data) {
      return { profile: null, nowPlaying: null, portalOpen: false };
    }

    return {
      profile: data.public_profile,
      nowPlaying: data.now_playing,
      portalOpen: data.portal_open,
    };
  },

  /**
   * Update universe state
   */
  async updateState(
    username: string,
    state: Partial<UniverseState>
  ): Promise<boolean> {
    if (!supabase) return false;

    const { error } = await supabase
      .from('universes')
      .update({
        state,
        updated_at: new Date().toISOString(),
      })
      .eq('username', username.toLowerCase());

    return !error;
  },

  /**
   * Update public profile
   */
  async updateProfile(
    username: string,
    profile: Partial<PublicProfile>
  ): Promise<boolean> {
    if (!supabase) return false;

    const { error } = await supabase
      .from('universes')
      .update({
        public_profile: profile,
        updated_at: new Date().toISOString(),
      })
      .eq('username', username.toLowerCase());

    return !error;
  },

  /**
   * Update now playing (for portal sync)
   */
  async updateNowPlaying(
    username: string,
    nowPlaying: NowPlaying | null
  ): Promise<boolean> {
    if (!supabase) return false;

    const { error } = await supabase
      .from('universes')
      .update({
        now_playing: nowPlaying,
        last_active: new Date().toISOString(),
      })
      .eq('username', username.toLowerCase());

    return !error;
  },

  /**
   * Open/close portal
   */
  async setPortalOpen(username: string, isOpen: boolean): Promise<boolean> {
    if (!supabase) return false;

    const { error } = await supabase
      .from('universes')
      .update({
        portal_open: isOpen,
        portal_viewers: isOpen ? [] : [],
      })
      .eq('username', username.toLowerCase());

    return !error;
  },

  /**
   * Subscribe to universe changes (real-time)
   */
  subscribeToUniverse(
    username: string,
    callback: (payload: { new: UniverseRow }) => void
  ) {
    if (!supabase) return null;

    return supabase
      .channel(`universe:${username}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'universes',
          filter: `username=eq.${username.toLowerCase()}`,
        },
        callback
      )
      .subscribe();
  },

  /**
   * Unsubscribe from universe
   */
  unsubscribe(channel: any) {
    if (!supabase || !channel) return;
    supabase.removeChannel(channel);
  },

  /**
   * Search users by username
   */
  async searchUsers(query: string, limit = 10): Promise<{
    username: string;
    displayName: string;
    avatarUrl: string | null;
    portalOpen: boolean;
  }[]> {
    if (!supabase || query.length < 2) return [];

    const { data, error } = await supabase
      .from('universes')
      .select('username, public_profile, portal_open')
      .ilike('username', `%${query.toLowerCase()}%`)
      .limit(limit);

    if (error || !data) return [];

    return data.map((u: any) => ({
      username: u.username,
      displayName: u.public_profile?.displayName || u.username,
      avatarUrl: u.public_profile?.avatarUrl || null,
      portalOpen: u.portal_open || false,
    }));
  },
};

export default supabase;
