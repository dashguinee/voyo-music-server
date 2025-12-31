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
// AVATAR API - Profile Photo Uploads
// ============================================

export const avatarAPI = {
  /**
   * Upload avatar to Supabase Storage
   * @param username - User's username (used as folder name)
   * @param file - The image file to upload
   * @returns Public URL of uploaded avatar or null on error
   */
  async uploadAvatar(username: string, file: File): Promise<string | null> {
    if (!supabase) {
      console.error('[Avatar] Supabase not configured');
      return null;
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      console.error('[Avatar] Invalid file type:', file.type);
      return null;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      console.error('[Avatar] File too large:', file.size);
      return null;
    }

    const normalizedUsername = username.toLowerCase();
    const fileExt = file.name.split('.').pop() || 'jpg';
    const fileName = `${normalizedUsername}/avatar.${fileExt}`;

    // Delete existing avatar first (to handle extension changes)
    await this.deleteAvatar(username);

    // Upload new avatar
    const { data, error } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type,
      });

    if (error) {
      console.error('[Avatar] Upload error:', error.message);
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(data.path);

    console.log(`[Avatar] Uploaded: ${urlData.publicUrl}`);
    return urlData.publicUrl;
  },

  /**
   * Get avatar public URL for a user
   * @param username - User's username
   * @returns Public URL or null if no avatar
   */
  getAvatarUrl(username: string): string | null {
    if (!supabase) return null;

    const normalizedUsername = username.toLowerCase();

    // Return the base URL pattern - actual file may have different extensions
    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl(`${normalizedUsername}/avatar`);

    return data.publicUrl;
  },

  /**
   * Delete user's avatar
   * @param username - User's username
   * @returns true if deleted successfully
   */
  async deleteAvatar(username: string): Promise<boolean> {
    if (!supabase) return false;

    const normalizedUsername = username.toLowerCase();

    // List files in user's folder to find the avatar (could have different extensions)
    const { data: files, error: listError } = await supabase.storage
      .from('avatars')
      .list(normalizedUsername);

    if (listError || !files || files.length === 0) {
      return true; // No files to delete
    }

    // Delete all files in user's avatar folder
    const filesToDelete = files.map(f => `${normalizedUsername}/${f.name}`);
    const { error } = await supabase.storage
      .from('avatars')
      .remove(filesToDelete);

    if (error) {
      console.error('[Avatar] Delete error:', error.message);
      return false;
    }

    console.log(`[Avatar] Deleted avatar for ${normalizedUsername}`);
    return true;
  },

  /**
   * Upload avatar and update user profile in one operation
   * @param username - User's username
   * @param file - The image file to upload
   * @returns true if successful
   */
  async uploadAndUpdateProfile(username: string, file: File): Promise<boolean> {
    const avatarUrl = await this.uploadAvatar(username, file);
    if (!avatarUrl) return false;

    // Update the user's profile with the new avatar URL
    const success = await universeAPI.updateProfile(username, {
      avatarUrl: avatarUrl,
    });

    return success;
  },
};

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
// PORTAL CHAT API - Room chat in someone's portal
// ============================================

export interface PortalMessage {
  id: string;
  portal_owner: string;
  sender: string;
  sender_color: string;
  message: string;
  created_at: string;
}

export const portalChatAPI = {
  /**
   * Get recent messages for a portal (last 2 hours)
   */
  async getMessages(portalOwner: string, limit = 50): Promise<PortalMessage[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('portal_messages')
      .select('*')
      .eq('portal_owner', portalOwner.toLowerCase())
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('[VOYO] Failed to fetch portal messages:', error);
      return [];
    }

    return data || [];
  },

  /**
   * Send a message to a portal
   */
  async sendMessage(
    portalOwner: string,
    sender: string,
    senderColor: string,
    message: string
  ): Promise<boolean> {
    if (!supabase) return false;

    const { error } = await supabase.from('portal_messages').insert({
      portal_owner: portalOwner.toLowerCase(),
      sender,
      sender_color: senderColor,
      message: message.slice(0, 500),
    });

    if (error) {
      console.error('[VOYO] Failed to send portal message:', error);
      return false;
    }

    return true;
  },

  /**
   * Subscribe to portal messages (real-time)
   */
  subscribe(portalOwner: string, onMessage: (message: PortalMessage) => void) {
    if (!supabase) return null;

    return supabase
      .channel(`portal_chat:${portalOwner.toLowerCase()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'portal_messages',
          filter: `portal_owner=eq.${portalOwner.toLowerCase()}`,
        },
        (payload) => {
          onMessage(payload.new as PortalMessage);
        }
      )
      .subscribe();
  },

  /**
   * Unsubscribe from portal chat
   */
  unsubscribe(channel: any) {
    if (!supabase || !channel) return;
    supabase.removeChannel(channel);
  },
};

// ============================================
// DIRECT MESSAGES API - User to User DMs
// ============================================

export interface DirectMessage {
  id: string;
  from_user: string;
  to_user: string;
  message: string;
  created_at: string;
  read_at: string | null;
}

export interface Conversation {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
}

export const directMessagesAPI = {
  /**
   * Get conversation list (people I've messaged or who messaged me)
   */
  async getConversations(username: string): Promise<Conversation[]> {
    if (!supabase) return [];

    const normalizedUsername = username.toLowerCase();

    // Get all messages involving this user
    const { data, error } = await supabase
      .from('direct_messages')
      .select('*')
      .or(`from_user.eq.${normalizedUsername},to_user.eq.${normalizedUsername}`)
      .order('created_at', { ascending: false });

    if (error || !data) {
      console.error('[VOYO] Failed to fetch conversations:', error);
      return [];
    }

    // Group by conversation partner
    const conversationMap = new Map<string, {
      lastMessage: DirectMessage;
      unreadCount: number;
    }>();

    for (const msg of data) {
      const partner = msg.from_user === normalizedUsername ? msg.to_user : msg.from_user;

      if (!conversationMap.has(partner)) {
        conversationMap.set(partner, {
          lastMessage: msg,
          unreadCount: 0,
        });
      }

      // Count unread (messages TO me that aren't read)
      if (msg.to_user === normalizedUsername && !msg.read_at) {
        const conv = conversationMap.get(partner)!;
        conv.unreadCount++;
      }
    }

    // Get profile info for each partner
    const partners = Array.from(conversationMap.keys());
    const { data: profiles } = await supabase
      .from('universes')
      .select('username, public_profile')
      .in('username', partners);

    const profileMap = new Map<string, any>();
    for (const p of profiles || []) {
      profileMap.set(p.username, p.public_profile);
    }

    // Build conversation list
    return Array.from(conversationMap.entries()).map(([partner, conv]) => {
      const profile = profileMap.get(partner);
      return {
        username: partner,
        displayName: profile?.displayName || partner,
        avatarUrl: profile?.avatarUrl || null,
        lastMessage: conv.lastMessage.message,
        lastMessageTime: conv.lastMessage.created_at,
        unreadCount: conv.unreadCount,
      };
    });
  },

  /**
   * Get messages between two users
   */
  async getMessages(user1: string, user2: string, limit = 100): Promise<DirectMessage[]> {
    if (!supabase) return [];

    const u1 = user1.toLowerCase();
    const u2 = user2.toLowerCase();

    const { data, error } = await supabase
      .from('direct_messages')
      .select('*')
      .or(`and(from_user.eq.${u1},to_user.eq.${u2}),and(from_user.eq.${u2},to_user.eq.${u1})`)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      console.error('[VOYO] Failed to fetch messages:', error);
      return [];
    }

    return data || [];
  },

  /**
   * Send a direct message
   */
  async sendMessage(fromUser: string, toUser: string, message: string): Promise<boolean> {
    if (!supabase) return false;

    const { error } = await supabase.from('direct_messages').insert({
      from_user: fromUser.toLowerCase(),
      to_user: toUser.toLowerCase(),
      message: message.slice(0, 1000), // Max 1000 chars
    });

    if (error) {
      console.error('[VOYO] Failed to send message:', error);
      return false;
    }

    return true;
  },

  /**
   * Mark messages as read
   */
  async markAsRead(fromUser: string, toUser: string): Promise<boolean> {
    if (!supabase) return false;

    const { error } = await supabase
      .from('direct_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('from_user', fromUser.toLowerCase())
      .eq('to_user', toUser.toLowerCase())
      .is('read_at', null);

    return !error;
  },

  /**
   * Get unread count for a user
   */
  async getUnreadCount(username: string): Promise<number> {
    if (!supabase) return 0;

    const { count, error } = await supabase
      .from('direct_messages')
      .select('*', { count: 'exact', head: true })
      .eq('to_user', username.toLowerCase())
      .is('read_at', null);

    if (error) return 0;
    return count || 0;
  },

  /**
   * Subscribe to new messages for a user (real-time)
   */
  subscribe(username: string, onMessage: (message: DirectMessage) => void) {
    if (!supabase) return null;

    const normalizedUsername = username.toLowerCase();

    return supabase
      .channel(`dm:${normalizedUsername}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `to_user=eq.${normalizedUsername}`,
        },
        (payload) => {
          onMessage(payload.new as DirectMessage);
        }
      )
      .subscribe();
  },

  /**
   * Subscribe to a specific conversation (real-time)
   */
  subscribeToConversation(
    user1: string,
    user2: string,
    onMessage: (message: DirectMessage) => void
  ) {
    if (!supabase) return null;

    const u1 = user1.toLowerCase();
    const u2 = user2.toLowerCase();
    const channelId = [u1, u2].sort().join(':');

    return supabase
      .channel(`dm_conv:${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
        },
        (payload) => {
          const msg = payload.new as DirectMessage;
          // Filter to only this conversation
          if (
            (msg.from_user === u1 && msg.to_user === u2) ||
            (msg.from_user === u2 && msg.to_user === u1)
          ) {
            onMessage(msg);
          }
        }
      )
      .subscribe();
  },

  /**
   * Unsubscribe from DM channel
   */
  unsubscribe(channel: any) {
    if (!supabase || !channel) return;
    supabase.removeChannel(channel);
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

    // Only include columns that exist in the table
    const { error } = await supabase
      .from('video_intelligence')
      .upsert({
        youtube_id: video.youtube_id,
        title: video.title || 'Unknown',
        artist: video.artist || null,
        thumbnail_url: video.thumbnail_url || `https://i.ytimg.com/vi/${video.youtube_id}/hqdefault.jpg`,
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

    // Only include columns that exist in the table
    const cleanVideos = videos.map(v => ({
      youtube_id: v.youtube_id,
      title: v.title || 'Unknown',
      artist: v.artist || null,
      thumbnail_url: v.thumbnail_url || `https://i.ytimg.com/vi/${v.youtube_id}/hqdefault.jpg`,
    }));

    const { error, count } = await supabase
      .from('video_intelligence')
      .upsert(cleanVideos, {
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

// ============================================
// FEED CONTENT API - Cached Track Storage
// ============================================

export type FeedContentSource = 'youtube' | 'ugc' | 'social';

export interface FeedContentRow {
  id: string;
  track_id: string;
  title: string;
  artist: string;
  thumbnail_url: string | null;
  audio_extract_url: string | null;
  duration: number | null;
  source: FeedContentSource;
  metadata: Record<string, unknown>;
  cached_at: string;
  last_accessed_at: string;
  access_count: number;
}

export interface FeedContentInput {
  track_id: string;
  title: string;
  artist: string;
  thumbnail_url?: string | null;
  audio_extract_url?: string | null;
  duration?: number | null;
  source?: FeedContentSource;
  metadata?: Record<string, unknown>;
}

export const feedContentAPI = {
  /**
   * Get feed content by track ID
   */
  async get(trackId: string): Promise<FeedContentRow | null> {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('voyo_feed_content')
      .select('*')
      .eq('track_id', trackId)
      .single();

    if (error || !data) return null;
    return data as FeedContentRow;
  },

  /**
   * Save feed content (upsert)
   */
  async save(content: FeedContentInput): Promise<boolean> {
    if (!supabase) return false;

    const now = new Date().toISOString();

    const { error } = await supabase
      .from('voyo_feed_content')
      .upsert({
        track_id: content.track_id,
        title: content.title,
        artist: content.artist,
        thumbnail_url: content.thumbnail_url || `https://i.ytimg.com/vi/${content.track_id}/hqdefault.jpg`,
        audio_extract_url: content.audio_extract_url || null,
        duration: content.duration || null,
        source: content.source || 'youtube',
        metadata: content.metadata || {},
        cached_at: now,
        last_accessed_at: now,
        access_count: 1,
      }, {
        onConflict: 'track_id',
      });

    if (error) {
      console.error('[FeedContent] Save error:', error.message);
      return false;
    }

    console.log(`[FeedContent] Saved: ${content.track_id}`);
    return true;
  },

  /**
   * Update access time and increment count
   */
  async updateAccess(trackId: string): Promise<void> {
    if (!supabase) return;

    await supabase.rpc('update_feed_content_access', {
      track_id_param: trackId,
    });
  },

  /**
   * Batch get multiple feed content items
   */
  async getBatch(trackIds: string[]): Promise<FeedContentRow[]> {
    if (!supabase || trackIds.length === 0) return [];

    const { data, error } = await supabase
      .from('voyo_feed_content')
      .select('*')
      .in('track_id', trackIds);

    if (error || !data) return [];
    return data as FeedContentRow[];
  },

  /**
   * Batch save multiple feed content items
   */
  async saveBatch(contents: FeedContentInput[]): Promise<number> {
    if (!supabase || contents.length === 0) return 0;

    const now = new Date().toISOString();

    const rows = contents.map((content) => ({
      track_id: content.track_id,
      title: content.title,
      artist: content.artist,
      thumbnail_url: content.thumbnail_url || `https://i.ytimg.com/vi/${content.track_id}/hqdefault.jpg`,
      audio_extract_url: content.audio_extract_url || null,
      duration: content.duration || null,
      source: content.source || 'youtube',
      metadata: content.metadata || {},
      cached_at: now,
      last_accessed_at: now,
      access_count: 1,
    }));

    const { error, count } = await supabase
      .from('voyo_feed_content')
      .upsert(rows, {
        onConflict: 'track_id',
        count: 'exact',
      });

    if (error) {
      console.error('[FeedContent] Batch save error:', error.message);
      return 0;
    }

    console.log(`[FeedContent] Batch saved ${count} items`);
    return count || 0;
  },

  /**
   * Get recently accessed content
   */
  async getRecent(limit = 20): Promise<FeedContentRow[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('voyo_feed_content')
      .select('*')
      .order('last_accessed_at', { ascending: false })
      .limit(limit);

    if (error) return [];
    return (data || []) as FeedContentRow[];
  },

  /**
   * Get popular content by access count
   */
  async getPopular(limit = 20): Promise<FeedContentRow[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('voyo_feed_content')
      .select('*')
      .order('access_count', { ascending: false })
      .limit(limit);

    if (error) return [];
    return (data || []) as FeedContentRow[];
  },

  /**
   * Get content by source type
   */
  async getBySource(source: FeedContentSource, limit = 50): Promise<FeedContentRow[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('voyo_feed_content')
      .select('*')
      .eq('source', source)
      .order('cached_at', { ascending: false })
      .limit(limit);

    if (error) return [];
    return (data || []) as FeedContentRow[];
  },

  /**
   * Check if content exists
   */
  async exists(trackId: string): Promise<boolean> {
    if (!supabase) return false;

    const { data } = await supabase
      .from('voyo_feed_content')
      .select('track_id')
      .eq('track_id', trackId)
      .single();

    return !!data;
  },
};

// ============================================
// PLAYLIST API - Dedicated Playlist Cloud Storage
// ============================================

export interface PlaylistRow {
  id: string;
  username: string;
  name: string;
  track_ids: string[];
  cover_url: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlaylistInput {
  id: string;
  name: string;
  trackIds: string[];
  coverUrl?: string | null;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
}

export const playlistAPI = {
  /**
   * Save a playlist to the cloud (upsert)
   */
  async savePlaylist(username: string, playlist: PlaylistInput): Promise<boolean> {
    if (!supabase) return false;

    const { error } = await supabase
      .from('voyo_playlists')
      .upsert({
        id: playlist.id,
        username: username.toLowerCase(),
        name: playlist.name,
        track_ids: playlist.trackIds,
        cover_url: playlist.coverUrl || null,
        is_public: playlist.isPublic,
        created_at: playlist.createdAt,
        updated_at: playlist.updatedAt,
      }, {
        onConflict: 'id',
      });

    if (error) {
      console.error('[Playlist] Save error:', error.message);
      return false;
    }

    console.log(`[Playlist] Saved: ${playlist.name} (${playlist.id})`);
    return true;
  },

  /**
   * Get all playlists for a user
   */
  async getPlaylists(username: string): Promise<PlaylistInput[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('voyo_playlists')
      .select('*')
      .eq('username', username.toLowerCase())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Playlist] Get error:', error.message);
      return [];
    }

    return (data || []).map((row: PlaylistRow) => ({
      id: row.id,
      name: row.name,
      trackIds: row.track_ids || [],
      coverUrl: row.cover_url,
      isPublic: row.is_public,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  },

  /**
   * Delete a playlist from the cloud
   */
  async deletePlaylist(username: string, playlistId: string): Promise<boolean> {
    if (!supabase) return false;

    const { error } = await supabase
      .from('voyo_playlists')
      .delete()
      .eq('id', playlistId)
      .eq('username', username.toLowerCase());

    if (error) {
      console.error('[Playlist] Delete error:', error.message);
      return false;
    }

    console.log(`[Playlist] Deleted: ${playlistId}`);
    return true;
  },

  /**
   * Batch save multiple playlists (for full sync)
   */
  async savePlaylists(username: string, playlists: PlaylistInput[]): Promise<number> {
    if (!supabase || playlists.length === 0) return 0;

    const rows = playlists.map((playlist) => ({
      id: playlist.id,
      username: username.toLowerCase(),
      name: playlist.name,
      track_ids: playlist.trackIds,
      cover_url: playlist.coverUrl || null,
      is_public: playlist.isPublic,
      created_at: playlist.createdAt,
      updated_at: playlist.updatedAt,
    }));

    const { error, count } = await supabase
      .from('voyo_playlists')
      .upsert(rows, {
        onConflict: 'id',
        count: 'exact',
      });

    if (error) {
      console.error('[Playlist] Batch save error:', error.message);
      return 0;
    }

    console.log(`[Playlist] Batch saved ${count} playlists`);
    return count || 0;
  },

  /**
   * Get public playlists from a user (for profile viewing)
   */
  async getPublicPlaylists(username: string): Promise<PlaylistInput[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('voyo_playlists')
      .select('*')
      .eq('username', username.toLowerCase())
      .eq('is_public', true)
      .order('created_at', { ascending: false });

    if (error) return [];

    return (data || []).map((row: PlaylistRow) => ({
      id: row.id,
      name: row.name,
      trackIds: row.track_ids || [],
      coverUrl: row.cover_url,
      isPublic: row.is_public,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  },
};

export default supabase;
