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

// ============================================
// FOLLOWS API
// ============================================

export const followsAPI = {
  /**
   * Follow a user
   */
  async follow(followerUsername: string, followingUsername: string): Promise<boolean> {
    if (!supabase) return false;

    const { error } = await supabase.from('follows').upsert({
      follower: followerUsername.toLowerCase(),
      following: followingUsername.toLowerCase(),
      created_at: new Date().toISOString(),
    });

    return !error;
  },

  /**
   * Unfollow a user
   */
  async unfollow(followerUsername: string, followingUsername: string): Promise<boolean> {
    if (!supabase) return false;

    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower', followerUsername.toLowerCase())
      .eq('following', followingUsername.toLowerCase());

    return !error;
  },

  /**
   * Check if following
   */
  async isFollowing(followerUsername: string, followingUsername: string): Promise<boolean> {
    if (!supabase) return false;

    const { data } = await supabase
      .from('follows')
      .select('follower')
      .eq('follower', followerUsername.toLowerCase())
      .eq('following', followingUsername.toLowerCase())
      .single();

    return !!data;
  },

  /**
   * Get users I follow
   */
  async getFollowing(username: string): Promise<string[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('follows')
      .select('following')
      .eq('follower', username.toLowerCase());

    if (error || !data) return [];
    return data.map((f: any) => f.following);
  },

  /**
   * Get my followers
   */
  async getFollowers(username: string): Promise<string[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('follows')
      .select('follower')
      .eq('following', username.toLowerCase());

    if (error || !data) return [];
    return data.map((f: any) => f.follower);
  },

  /**
   * Get follow counts
   */
  async getCounts(username: string): Promise<{ followers: number; following: number }> {
    if (!supabase) return { followers: 0, following: 0 };

    const [followersRes, followingRes] = await Promise.all([
      supabase
        .from('follows')
        .select('follower', { count: 'exact', head: true })
        .eq('following', username.toLowerCase()),
      supabase
        .from('follows')
        .select('following', { count: 'exact', head: true })
        .eq('follower', username.toLowerCase()),
    ]);

    return {
      followers: followersRes.count || 0,
      following: followingRes.count || 0,
    };
  },
};

// ============================================
// LYRICS API - Phonetic Lyrics Storage
// ============================================

export interface LyricsRow {
  track_id: string;
  title: string;
  artist: string;
  phonetic_raw: string;
  phonetic_clean: string | null;
  language: string;
  confidence: number;
  segments: LyricSegmentRow[];
  translations: Record<string, string>;
  status: 'raw' | 'polished' | 'verified';
  polished_by: string[];
  verified_by: string | null;
  play_count: number;
  created_at: string;
  updated_at: string;
}

export interface LyricSegmentRow {
  start: number;
  end: number;
  text: string;
  phonetic: string;
  english?: string;
  french?: string;
  cultural_note?: string;
}

export const lyricsAPI = {
  /**
   * Get lyrics for a track (cached)
   */
  async get(trackId: string): Promise<LyricsRow | null> {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('voyo_lyrics')
      .select('*')
      .eq('track_id', trackId)
      .single();

    if (error || !data) return null;
    return data;
  },

  /**
   * Save new lyrics (from Whisper generation)
   */
  async save(lyrics: Omit<LyricsRow, 'created_at' | 'updated_at' | 'play_count'>): Promise<boolean> {
    if (!supabase) return false;

    const { error } = await supabase.from('voyo_lyrics').upsert({
      ...lyrics,
      play_count: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error('[Lyrics] Save error:', error);
      return false;
    }

    console.log(`[Lyrics] Saved lyrics for ${lyrics.track_id}`);
    return true;
  },

  /**
   * Increment play count (for analytics)
   */
  async recordPlay(trackId: string): Promise<void> {
    if (!supabase) return;

    await supabase.rpc('increment_lyrics_play_count', { track_id_param: trackId });
  },

  /**
   * Submit a polish/correction
   */
  async polish(
    trackId: string,
    segmentIndex: number,
    corrections: {
      text?: string;
      phonetic?: string;
      english?: string;
      french?: string;
      cultural_note?: string;
    },
    userId: string
  ): Promise<boolean> {
    if (!supabase) return false;

    // Get current lyrics
    const current = await this.get(trackId);
    if (!current || !current.segments[segmentIndex]) return false;

    // Apply corrections
    const updatedSegments = [...current.segments];
    updatedSegments[segmentIndex] = {
      ...updatedSegments[segmentIndex],
      ...corrections,
    };

    // Update polished_by list
    const polishedBy = current.polished_by || [];
    if (!polishedBy.includes(userId)) {
      polishedBy.push(userId);
    }

    const { error } = await supabase
      .from('voyo_lyrics')
      .update({
        segments: updatedSegments,
        phonetic_clean: updatedSegments.map(s => s.text).join('\n'),
        polished_by: polishedBy,
        status: 'polished',
        updated_at: new Date().toISOString(),
      })
      .eq('track_id', trackId);

    return !error;
  },

  /**
   * Verify lyrics (moderator action)
   */
  async verify(trackId: string, verifierId: string): Promise<boolean> {
    if (!supabase) return false;

    const { error } = await supabase
      .from('voyo_lyrics')
      .update({
        status: 'verified',
        verified_by: verifierId,
        updated_at: new Date().toISOString(),
      })
      .eq('track_id', trackId);

    return !error;
  },

  /**
   * Search lyrics by text
   */
  async search(query: string, limit = 20): Promise<Array<{
    track_id: string;
    title: string;
    artist: string;
    snippet: string;
  }>> {
    if (!supabase || query.length < 2) return [];

    const { data, error } = await supabase
      .from('voyo_lyrics')
      .select('track_id, title, artist, phonetic_raw')
      .or(`phonetic_raw.ilike.%${query}%,phonetic_clean.ilike.%${query}%`)
      .limit(limit);

    if (error || !data) return [];

    return data.map((row: any) => ({
      track_id: row.track_id,
      title: row.title,
      artist: row.artist,
      snippet: extractSnippet(row.phonetic_raw, query),
    }));
  },

  /**
   * Get recent/popular lyrics
   */
  async getPopular(limit = 20): Promise<Array<{
    track_id: string;
    title: string;
    artist: string;
    status: string;
    play_count: number;
  }>> {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('voyo_lyrics')
      .select('track_id, title, artist, status, play_count')
      .order('play_count', { ascending: false })
      .limit(limit);

    if (error || !data) return [];
    return data;
  },

  /**
   * Get lyrics needing polish (community contribution queue)
   */
  async getNeedingPolish(limit = 20): Promise<Array<{
    track_id: string;
    title: string;
    artist: string;
    language: string;
    confidence: number;
  }>> {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('voyo_lyrics')
      .select('track_id, title, artist, language, confidence')
      .eq('status', 'raw')
      .order('play_count', { ascending: false })
      .limit(limit);

    if (error || !data) return [];
    return data;
  },
};

/**
 * Extract a snippet around the search query
 */
function extractSnippet(text: string, query: string, contextLength = 50): string {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);

  if (index === -1) return text.substring(0, 100) + '...';

  const start = Math.max(0, index - contextLength);
  const end = Math.min(text.length, index + query.length + contextLength);

  let snippet = text.substring(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';

  return snippet;
}

// ============================================
// VIDEO INTELLIGENCE API - The Collective Brain
// ============================================

export interface VideoIntelligenceRow {
  youtube_id: string;
  title: string;
  artist: string | null;
  channel_name: string | null;
  duration_seconds: number | null;
  thumbnail_url: string | null;
  search_terms: string[] | null;
  normalized_title: string | null;
  related_ids: string[];
  similar_ids: string[];
  genres: string[];
  moods: string[];
  language: string | null;
  region: string | null;
  voyo_play_count: number;
  voyo_queue_count: number;
  voyo_reaction_count: number;
  discovered_by: string | null;
  discovery_method: 'manual_play' | 'ocr_extraction' | 'api_search' | 'related_crawl' | 'import' | null;
  created_at: string;
  updated_at: string;
  last_played_at: string | null;
}

export const videoIntelligenceAPI = {
  /**
   * Sync a video to Supabase (upsert)
   * Called when a video is discovered/played
   */
  async sync(video: Partial<VideoIntelligenceRow> & { youtube_id: string }): Promise<boolean> {
    if (!supabase) {
      console.log('[VideoIntelligence] Supabase not configured, skipping sync');
      return false;
    }

    const { error } = await supabase
      .from('video_intelligence')
      .upsert({
        ...video,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'youtube_id'
      });

    if (error) {
      console.error('[VideoIntelligence] Sync error:', error.message);
      return false;
    }

    console.log(`[VideoIntelligence] Synced ${video.youtube_id} to Supabase`);
    return true;
  },

  /**
   * Get video by YouTube ID
   */
  async get(youtubeId: string): Promise<VideoIntelligenceRow | null> {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('video_intelligence')
      .select('*')
      .eq('youtube_id', youtubeId)
      .single();

    if (error || !data) return null;
    return data;
  },

  /**
   * Search videos by title (fuzzy)
   */
  async search(query: string, limit = 5): Promise<VideoIntelligenceRow[]> {
    if (!supabase || query.length < 2) return [];

    // Use the RPC function for fuzzy search
    const { data, error } = await supabase
      .rpc('search_video_intelligence', {
        search_query: query,
        limit_count: limit
      });

    if (error) {
      // Fallback to ilike search
      const { data: fallbackData } = await supabase
        .from('video_intelligence')
        .select('*')
        .or(`title.ilike.%${query}%,artist.ilike.%${query}%`)
        .limit(limit);

      return fallbackData || [];
    }

    return data || [];
  },

  /**
   * Increment play count
   */
  async recordPlay(youtubeId: string): Promise<void> {
    if (!supabase) return;

    await supabase.rpc('increment_video_play', { video_id: youtubeId });
  },

  /**
   * Increment queue count
   */
  async recordQueue(youtubeId: string): Promise<void> {
    if (!supabase) return;

    await supabase.rpc('increment_video_queue', { video_id: youtubeId });
  },

  /**
   * Get popular videos (most played)
   */
  async getPopular(limit = 20): Promise<VideoIntelligenceRow[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('video_intelligence')
      .select('*')
      .order('voyo_play_count', { ascending: false })
      .limit(limit);

    if (error) return [];
    return data || [];
  },

  /**
   * Get recent discoveries
   */
  async getRecent(limit = 20): Promise<VideoIntelligenceRow[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('video_intelligence')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return [];
    return data || [];
  },

  /**
   * Batch sync multiple videos (for efficiency)
   */
  async batchSync(videos: Array<Partial<VideoIntelligenceRow> & { youtube_id: string }>): Promise<number> {
    if (!supabase || videos.length === 0) return 0;

    const videosWithTimestamp = videos.map(v => ({
      ...v,
      updated_at: new Date().toISOString(),
    }));

    const { error, count } = await supabase
      .from('video_intelligence')
      .upsert(videosWithTimestamp, {
        onConflict: 'youtube_id',
        count: 'exact'
      });

    if (error) {
      console.error('[VideoIntelligence] Batch sync error:', error.message);
      return 0;
    }

    console.log(`[VideoIntelligence] Batch synced ${count} videos`);
    return count || 0;
  },

  /**
   * Get stats for the collective brain
   */
  async getStats(): Promise<{
    totalVideos: number;
    totalPlays: number;
    recentDiscoveries: number;
  }> {
    if (!supabase) return { totalVideos: 0, totalPlays: 0, recentDiscoveries: 0 };

    const [countRes, playsRes, recentRes] = await Promise.all([
      supabase.from('video_intelligence').select('*', { count: 'exact', head: true }),
      supabase.from('video_intelligence').select('voyo_play_count'),
      supabase.from('video_intelligence')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    ]);

    const totalPlays = (playsRes.data || []).reduce((sum: number, v: any) => sum + (v.voyo_play_count || 0), 0);

    return {
      totalVideos: countRes.count || 0,
      totalPlays,
      recentDiscoveries: recentRes.count || 0,
    };
  },
};

export default supabase;
