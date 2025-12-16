// VOYO Music - Account Store (Zustand)
// WhatsApp-based authentication system
// voyomusic.com/username

import { create } from 'zustand';
import { VOYOAccount, VerificationState, SubscriptionStatus } from '../types';

// ============================================
// PERSISTENCE - Remember logged in state
// ============================================
const ACCOUNT_STORAGE_KEY = 'voyo-account';
const PIN_STORAGE_KEY = 'voyo-pending-pin';

interface PersistedAccount {
  account: VOYOAccount | null;
  sessionToken?: string;
}

function loadAccount(): PersistedAccount {
  try {
    const saved = localStorage.getItem(ACCOUNT_STORAGE_KEY);
    return saved ? JSON.parse(saved) : { account: null };
  } catch {
    return { account: null };
  }
}

function saveAccount(data: PersistedAccount): void {
  try {
    localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage errors
  }
}

// ============================================
// MOCK DATA - For development
// ============================================
const MOCK_ACCOUNTS: Record<string, VOYOAccount> = {
  'dash': {
    id: 'dash-001',
    username: 'dash',
    whatsapp: '+224611361300',
    pin: '123456',
    displayName: 'Dash',
    bio: 'Building the future of music in Africa',
    subscription: 'vip',
    friendIds: ['aziz-001', 'kenza-001'],
    friendRequestIds: [],
    nowPlaying: {
      trackId: 'last-last',
      title: 'Last Last',
      artist: 'Burna Boy',
      thumbnail: 'https://i.ytimg.com/vi/VLW1ieN9Cg8/maxresdefault.jpg',
      startedAt: new Date().toISOString(),
    },
    totalListeningHours: 127,
    totalOyeGiven: 1240,
    totalOyeReceived: 8500,
    stories: [],
    createdAt: '2024-01-01T00:00:00Z',
    lastSeenAt: new Date().toISOString(),
  },
  'aziz': {
    id: 'aziz-001',
    username: 'aziz',
    whatsapp: '+224621234567',
    pin: '654321',
    displayName: 'Aziz',
    bio: 'Afrobeats enthusiast',
    subscription: 'active',
    friendIds: ['dash-001'],
    friendRequestIds: [],
    nowPlaying: {
      trackId: 'essence',
      title: 'Essence',
      artist: 'Wizkid ft. Tems',
      thumbnail: 'https://i.ytimg.com/vi/GqAYPiCWLgU/maxresdefault.jpg',
      startedAt: new Date().toISOString(),
    },
    totalListeningHours: 89,
    totalOyeGiven: 450,
    totalOyeReceived: 2100,
    stories: [],
    createdAt: '2024-02-15T00:00:00Z',
    lastSeenAt: new Date().toISOString(),
  },
  'kenza': {
    id: 'kenza-001',
    username: 'kenza',
    whatsapp: '+224631234567',
    pin: '111111',
    displayName: 'Kenza',
    bio: 'R&B lover',
    subscription: 'banned',
    banReason: 'Payment overdue since Dec 1',
    friendIds: ['dash-001'],
    friendRequestIds: [],
    totalListeningHours: 45,
    totalOyeGiven: 200,
    totalOyeReceived: 890,
    stories: [],
    createdAt: '2024-03-20T00:00:00Z',
    lastSeenAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
  },
};

// ============================================
// STORE INTERFACE
// ============================================
interface AccountStore {
  // Current user state
  currentAccount: VOYOAccount | null;
  isLoggedIn: boolean;
  isLoading: boolean;

  // Verification state
  verificationState: VerificationState;
  verificationError: string | null;
  pendingUsername: string | null;
  pendingWhatsapp: string | null;
  generatedPin: string | null;

  // Actions - Account creation
  startSignup: (username: string, whatsapp: string) => Promise<boolean>;
  verifyPin: (pin: string) => Promise<boolean>;
  cancelSignup: () => void;

  // Actions - Login
  login: (username: string, pin: string) => Promise<boolean>;
  logout: () => void;

  // Actions - Profile
  getProfile: (username: string) => VOYOAccount | null;
  updateProfile: (updates: Partial<VOYOAccount>) => void;
  updateNowPlaying: (track: { trackId: string; title: string; artist: string; thumbnail: string } | null) => void;

  // Actions - Friends
  addFriend: (username: string) => Promise<boolean>;
  removeFriend: (username: string) => void;
  getFriends: () => VOYOAccount[];

  // Utility
  checkUsernameAvailable: (username: string) => boolean;
  generateWhatsAppLink: (pin: string) => string;
}

// ============================================
// STORE IMPLEMENTATION
// ============================================
export const useAccountStore = create<AccountStore>((set, get) => {
  // Load persisted account on init
  const persisted = loadAccount();

  return {
    // Initial state
    currentAccount: persisted.account,
    isLoggedIn: !!persisted.account,
    isLoading: false,
    verificationState: 'idle',
    verificationError: null,
    pendingUsername: null,
    pendingWhatsapp: null,
    generatedPin: null,

    // ========================================
    // SIGNUP FLOW
    // ========================================
    startSignup: async (username: string, whatsapp: string) => {
      set({ isLoading: true, verificationState: 'sending_pin', verificationError: null });

      // Check username availability
      const normalizedUsername = username.toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (MOCK_ACCOUNTS[normalizedUsername]) {
        set({
          isLoading: false,
          verificationState: 'error',
          verificationError: 'Username already taken',
        });
        return false;
      }

      // Validate WhatsApp format
      const cleanWhatsapp = whatsapp.replace(/\D/g, '');
      if (cleanWhatsapp.length < 9) {
        set({
          isLoading: false,
          verificationState: 'error',
          verificationError: 'Invalid WhatsApp number',
        });
        return false;
      }

      // Generate 6-digit PIN
      const pin = Math.floor(100000 + Math.random() * 900000).toString();

      // Store pending signup
      set({
        isLoading: false,
        verificationState: 'waiting_pin',
        pendingUsername: normalizedUsername,
        pendingWhatsapp: cleanWhatsapp,
        generatedPin: pin,
      });

      // In production: Send PIN via WhatsApp Business API
      // For now: PIN is shown to user (development mode)
      console.log(`[VOYO] Sending PIN ${pin} to +${cleanWhatsapp}`);

      return true;
    },

    verifyPin: async (enteredPin: string) => {
      const { generatedPin, pendingUsername, pendingWhatsapp } = get();

      set({ verificationState: 'verifying' });

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 500));

      if (enteredPin !== generatedPin) {
        set({
          verificationState: 'error',
          verificationError: 'Incorrect PIN. Please try again.',
        });
        return false;
      }

      // Create the account
      const newAccount: VOYOAccount = {
        id: `user-${Date.now()}`,
        username: pendingUsername!,
        whatsapp: `+${pendingWhatsapp}`,
        pin: enteredPin,
        displayName: pendingUsername!.charAt(0).toUpperCase() + pendingUsername!.slice(1),
        subscription: 'trial',
        subscriptionEnds: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 day trial
        friendIds: [],
        friendRequestIds: [],
        totalListeningHours: 0,
        totalOyeGiven: 0,
        totalOyeReceived: 0,
        stories: [],
        createdAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
      };

      // Add to mock database
      MOCK_ACCOUNTS[newAccount.username] = newAccount;

      // Save to localStorage and update state
      saveAccount({ account: newAccount });
      set({
        currentAccount: newAccount,
        isLoggedIn: true,
        verificationState: 'verified',
        pendingUsername: null,
        pendingWhatsapp: null,
        generatedPin: null,
      });

      return true;
    },

    cancelSignup: () => {
      set({
        verificationState: 'idle',
        verificationError: null,
        pendingUsername: null,
        pendingWhatsapp: null,
        generatedPin: null,
      });
    },

    // ========================================
    // LOGIN FLOW
    // ========================================
    login: async (username: string, pin: string) => {
      set({ isLoading: true, verificationError: null });

      await new Promise(resolve => setTimeout(resolve, 300));

      const normalizedUsername = username.toLowerCase();
      const account = MOCK_ACCOUNTS[normalizedUsername];

      if (!account) {
        set({
          isLoading: false,
          verificationError: 'Account not found',
        });
        return false;
      }

      if (account.pin !== pin) {
        set({
          isLoading: false,
          verificationError: 'Incorrect PIN',
        });
        return false;
      }

      // Update last seen
      account.lastSeenAt = new Date().toISOString();

      saveAccount({ account });
      set({
        currentAccount: account,
        isLoggedIn: true,
        isLoading: false,
      });

      return true;
    },

    logout: () => {
      localStorage.removeItem(ACCOUNT_STORAGE_KEY);
      set({
        currentAccount: null,
        isLoggedIn: false,
        verificationState: 'idle',
        verificationError: null,
      });
    },

    // ========================================
    // PROFILE ACTIONS
    // ========================================
    getProfile: (username: string) => {
      return MOCK_ACCOUNTS[username.toLowerCase()] || null;
    },

    updateProfile: (updates: Partial<VOYOAccount>) => {
      const { currentAccount } = get();
      if (!currentAccount) return;

      const updated = { ...currentAccount, ...updates };
      MOCK_ACCOUNTS[currentAccount.username] = updated;
      saveAccount({ account: updated });
      set({ currentAccount: updated });
    },

    updateNowPlaying: (track) => {
      const { currentAccount } = get();
      if (!currentAccount) return;

      const updated = {
        ...currentAccount,
        nowPlaying: track ? { ...track, startedAt: new Date().toISOString() } : undefined,
      };
      MOCK_ACCOUNTS[currentAccount.username] = updated;
      saveAccount({ account: updated });
      set({ currentAccount: updated });
    },

    // ========================================
    // FRIENDS
    // ========================================
    addFriend: async (username: string) => {
      const { currentAccount } = get();
      if (!currentAccount) return false;

      const friendAccount = MOCK_ACCOUNTS[username.toLowerCase()];
      if (!friendAccount) return false;

      // Add to both accounts
      if (!currentAccount.friendIds.includes(friendAccount.id)) {
        currentAccount.friendIds.push(friendAccount.id);
      }
      if (!friendAccount.friendIds.includes(currentAccount.id)) {
        friendAccount.friendIds.push(currentAccount.id);
      }

      saveAccount({ account: currentAccount });
      set({ currentAccount: { ...currentAccount } });
      return true;
    },

    removeFriend: (username: string) => {
      const { currentAccount } = get();
      if (!currentAccount) return;

      const friendAccount = MOCK_ACCOUNTS[username.toLowerCase()];
      if (!friendAccount) return;

      currentAccount.friendIds = currentAccount.friendIds.filter(id => id !== friendAccount.id);
      friendAccount.friendIds = friendAccount.friendIds.filter(id => id !== currentAccount.id);

      saveAccount({ account: currentAccount });
      set({ currentAccount: { ...currentAccount } });
    },

    getFriends: () => {
      const { currentAccount } = get();
      if (!currentAccount) return [];

      return Object.values(MOCK_ACCOUNTS).filter(acc =>
        currentAccount.friendIds.includes(acc.id)
      );
    },

    // ========================================
    // UTILITIES
    // ========================================
    checkUsernameAvailable: (username: string) => {
      const normalized = username.toLowerCase().replace(/[^a-z0-9_]/g, '');
      return !MOCK_ACCOUNTS[normalized] && normalized.length >= 3;
    },

    generateWhatsAppLink: (pin: string) => {
      // Link to VOYO WhatsApp number with prefilled message
      const message = encodeURIComponent(`My VOYO PIN is: ${pin}`);
      return `https://wa.me/224611361300?text=${message}`;
    },
  };
});

export default useAccountStore;
