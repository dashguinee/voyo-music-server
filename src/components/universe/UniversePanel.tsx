/**
 * VOYO Verse Panel
 *
 * voyomusic.com/username management
 *
 * Features:
 * - Login/Signup (PIN-based, no email)
 * - Verse stats (likes, listens, etc.)
 * - Backup to JSON file
 * - Passphrase backup
 * - Portal sharing
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Download,
  Upload,
  Key,
  QrCode,
  Users,
  Music,
  Heart,
  Clock,
  Zap,
  Copy,
  Check,
  RefreshCw,
  Shield,
  Globe,
  Smartphone,
  LogIn,
  UserPlus,
  LogOut,
  AtSign,
  Lock,
  User,
  Edit3,
  Camera,
  Save,
  Search
} from 'lucide-react';
import { useUniverseStore } from '../../store/universeStore';
import { usePreferenceStore } from '../../store/preferenceStore';
import { universeAPI } from '../../lib/supabase';
import { UserSearch } from './UserSearch';

interface UniversePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UniversePanel = ({ isOpen, onClose }: UniversePanelProps) => {
  const {
    // Auth
    isLoggedIn,
    currentUsername,
    isLoading,
    error,
    signup,
    login,
    logout,
    checkUsername,
    // Backup
    downloadBackup,
    generatePassphrase,
    saveToCloud,
    restoreFromCloud,
    lastBackupAt,
    // Portal
    openPortal,
    closePortal,
    portalSession,
    isPortalOpen,
  } = useUniverseStore();

  const { trackPreferences } = usePreferenceStore();

  // Tab state
  const [activeTab, setActiveTab] = useState<'auth' | 'stats' | 'profile' | 'backup' | 'portal' | 'discover'>(
    isLoggedIn ? 'stats' : 'auth'
  );

  // Profile edit state
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileLoaded, setProfileLoaded] = useState(false);

  // Auth form state
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [usernameInput, setUsernameInput] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);

  // Backup state
  const [passphrase, setPassphrase] = useState('');
  const [passphraseInput, setPassphraseInput] = useState('');
  const [portalUrl, setPortalUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Calculate stats
  const stats = {
    tracksPlayed: Object.keys(trackPreferences).length,
    totalListens: Object.values(trackPreferences).reduce((sum, p) => sum + p.totalListens, 0),
    totalReactions: Object.values(trackPreferences).reduce((sum, p) => sum + p.reactions, 0),
    likedTracks: Object.values(trackPreferences).filter(p => p.explicitLike === true).length,
    completions: Object.values(trackPreferences).reduce((sum, p) => sum + p.completions, 0),
    skips: Object.values(trackPreferences).reduce((sum, p) => sum + p.skips, 0),
    totalMinutes: Math.round(Object.values(trackPreferences).reduce((sum, p) => sum + p.totalDuration, 0) / 60)
  };

  // Check username availability (debounced)
  useEffect(() => {
    if (authMode !== 'signup' || usernameInput.length < 3) {
      setUsernameAvailable(null);
      return;
    }

    const timer = setTimeout(async () => {
      setCheckingUsername(true);
      const available = await checkUsername(usernameInput);
      setUsernameAvailable(available);
      setCheckingUsername(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [usernameInput, authMode, checkUsername]);

  // Update active tab when login state changes
  useEffect(() => {
    if (isLoggedIn && activeTab === 'auth') {
      setActiveTab('stats');
    }
  }, [isLoggedIn, activeTab]);

  // Handle auth submit
  const handleAuthSubmit = async () => {
    if (authMode === 'signup') {
      const success = await signup(usernameInput, pinInput, displayNameInput || undefined);
      if (success) {
        setMessage({ type: 'success', text: `Welcome to VOYO, ${usernameInput}!` });
        setUsernameInput('');
        setPinInput('');
        setDisplayNameInput('');
      }
    } else {
      const success = await login(usernameInput, pinInput);
      if (success) {
        setMessage({ type: 'success', text: 'Welcome back!' });
        setUsernameInput('');
        setPinInput('');
      }
    }
  };

  // Handle logout
  const handleLogout = () => {
    logout();
    setActiveTab('auth');
    setProfileLoaded(false);
    setMessage({ type: 'success', text: 'Logged out' });
  };

  // Load profile data when profile tab opens
  useEffect(() => {
    if (activeTab === 'profile' && isLoggedIn && currentUsername && !profileLoaded) {
      const loadProfile = async () => {
        const result = await universeAPI.getPublicProfile(currentUsername);
        if (result.profile) {
          setEditDisplayName(result.profile.displayName || '');
          setEditBio(result.profile.bio || '');
          setEditAvatarUrl(result.profile.avatarUrl || '');
          setProfileLoaded(true);
        }
      };
      loadProfile();
    }
  }, [activeTab, isLoggedIn, currentUsername, profileLoaded]);

  // Handle save profile
  const handleSaveProfile = async () => {
    if (!currentUsername) return;

    setIsSavingProfile(true);
    const success = await universeAPI.updateProfile(currentUsername, {
      displayName: editDisplayName,
      bio: editBio,
      avatarUrl: editAvatarUrl || null,
    });
    setIsSavingProfile(false);

    if (success) {
      setMessage({ type: 'success', text: 'Profile updated!' });
    } else {
      setMessage({ type: 'error', text: 'Failed to save profile' });
    }
  };

  // Generate new passphrase
  const handleGeneratePassphrase = () => {
    const newPassphrase = generatePassphrase();
    setPassphrase(newPassphrase);
    setMessage({ type: 'success', text: 'Passphrase generated! Save it somewhere safe.' });
  };

  // Save to cloud
  const handleSaveToCloud = async () => {
    if (!passphrase) {
      setMessage({ type: 'error', text: 'Generate a passphrase first' });
      return;
    }
    setIsSaving(true);
    const success = await saveToCloud(passphrase);
    setIsSaving(false);
    setMessage(success
      ? { type: 'success', text: 'Verse saved!' }
      : { type: 'error', text: 'Save failed' }
    );
  };

  // Restore from cloud
  const handleRestoreFromCloud = async () => {
    if (!passphraseInput) {
      setMessage({ type: 'error', text: 'Enter your passphrase' });
      return;
    }
    setIsRestoring(true);
    const success = await restoreFromCloud(passphraseInput);
    setIsRestoring(false);
    setMessage(success
      ? { type: 'success', text: 'Verse restored!' }
      : { type: 'error', text: 'Invalid passphrase' }
    );
  };

  // Open portal
  const handleOpenPortal = async () => {
    const url = await openPortal();
    setPortalUrl(url);
    setMessage({ type: 'success', text: 'Portal opened!' });
  };

  // Copy to clipboard
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Clear message after 3s
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // Show error from store
  useEffect(() => {
    if (error) {
      setMessage({ type: 'error', text: error });
    }
  }, [error]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div className="absolute inset-0 bg-black/80 backdrop-blur-xl" onClick={onClose} />

          <motion.div
            className="relative w-full max-w-md bg-gradient-to-b from-[#1a1a2e] to-[#0a0a0f] rounded-3xl overflow-hidden border border-white/10"
            initial={{ scale: 0.9, y: 50 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 50 }}
          >
            {/* Header */}
            <div className="relative p-6 pb-4 border-b border-white/10">
              <button
                onClick={onClose}
                className="absolute right-4 top-4 p-2 rounded-full bg-white/5 hover:bg-white/10"
              >
                <X className="w-5 h-5 text-white/70" />
              </button>

              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <Globe className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h2 className="text-white font-bold text-xl">
                    {isLoggedIn ? 'My Verse' : 'VOYO Verse'}
                  </h2>
                  <p className="text-white/50 text-sm">
                    {isLoggedIn
                      ? `voyomusic.com/${currentUsername}`
                      : 'Claim your URL'}
                  </p>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-white/10">
              {(isLoggedIn
                ? [
                    { id: 'stats', icon: Music, label: 'Stats' },
                    { id: 'discover', icon: Search, label: 'Find' },
                    { id: 'profile', icon: Edit3, label: 'Profile' },
                    { id: 'portal', icon: Users, label: 'Portal' },
                    { id: 'backup', icon: Shield, label: 'Backup' },
                  ]
                : [{ id: 'auth', icon: LogIn, label: 'Login' }]
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex-1 py-3 flex items-center justify-center gap-2 transition-colors ${
                    activeTab === tab.id
                      ? 'text-white border-b-2 border-purple-500'
                      : 'text-white/50 hover:text-white/70'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  <span className="text-sm">{tab.label}</span>
                </button>
              ))}
              {isLoggedIn && (
                <button
                  onClick={handleLogout}
                  className="px-4 py-3 flex items-center justify-center text-white/40 hover:text-red-400 transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Content */}
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {/* Message Toast */}
              <AnimatePresence>
                {message && (
                  <motion.div
                    className={`mb-4 p-3 rounded-xl text-sm ${
                      message.type === 'success'
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    {message.text}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* AUTH TAB */}
              {activeTab === 'auth' && (
                <div className="space-y-4">
                  {/* Mode Toggle */}
                  <div className="flex bg-white/5 rounded-xl p-1">
                    <button
                      onClick={() => setAuthMode('login')}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        authMode === 'login'
                          ? 'bg-purple-500 text-white'
                          : 'text-white/50 hover:text-white'
                      }`}
                    >
                      Login
                    </button>
                    <button
                      onClick={() => setAuthMode('signup')}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                        authMode === 'signup'
                          ? 'bg-purple-500 text-white'
                          : 'text-white/50 hover:text-white'
                      }`}
                    >
                      Claim Username
                    </button>
                  </div>

                  {/* Username Input */}
                  <div>
                    <label className="text-white/50 text-xs uppercase tracking-wider mb-2 block">
                      Username
                    </label>
                    <div className="relative">
                      <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                      <input
                        type="text"
                        value={usernameInput}
                        onChange={(e) => setUsernameInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                        placeholder="yourname"
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/50"
                      />
                      {authMode === 'signup' && usernameInput.length >= 3 && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          {checkingUsername ? (
                            <RefreshCw className="w-4 h-4 text-white/50 animate-spin" />
                          ) : usernameAvailable ? (
                            <Check className="w-4 h-4 text-green-400" />
                          ) : (
                            <X className="w-4 h-4 text-red-400" />
                          )}
                        </div>
                      )}
                    </div>
                    {authMode === 'signup' && (
                      <p className="text-white/30 text-xs mt-1">
                        voyomusic.com/{usernameInput || 'yourname'}
                      </p>
                    )}
                  </div>

                  {/* Display Name (signup only) */}
                  {authMode === 'signup' && (
                    <div>
                      <label className="text-white/50 text-xs uppercase tracking-wider mb-2 block">
                        Display Name (optional)
                      </label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                        <input
                          type="text"
                          value={displayNameInput}
                          onChange={(e) => setDisplayNameInput(e.target.value)}
                          placeholder="Your Name"
                          className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/50"
                        />
                      </div>
                    </div>
                  )}

                  {/* PIN Input */}
                  <div>
                    <label className="text-white/50 text-xs uppercase tracking-wider mb-2 block">
                      PIN Code
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                      <input
                        type="password"
                        value={pinInput}
                        onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="6-digit PIN"
                        maxLength={6}
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/50 tracking-[0.5em] text-center"
                      />
                    </div>
                    <p className="text-white/30 text-xs mt-1">
                      {authMode === 'signup'
                        ? 'Choose a 6-digit PIN to secure your universe'
                        : 'Enter your PIN'}
                    </p>
                  </div>

                  {/* Submit Button */}
                  <button
                    onClick={handleAuthSubmit}
                    disabled={isLoading || usernameInput.length < 3 || pinInput.length < 4 || (authMode === 'signup' && usernameAvailable === false)}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : authMode === 'signup' ? (
                      <>
                        <UserPlus className="w-5 h-5" />
                        Claim voyomusic.com/{usernameInput || '...'}
                      </>
                    ) : (
                      <>
                        <LogIn className="w-5 h-5" />
                        Enter Verse
                      </>
                    )}
                  </button>

                  {/* No email notice */}
                  <p className="text-center text-white/30 text-xs">
                    No email needed. Just username + PIN.
                  </p>
                </div>
              )}

              {/* STATS TAB */}
              {activeTab === 'stats' && isLoggedIn && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <div className="flex items-center gap-2 text-purple-400 mb-2">
                        <Music className="w-4 h-4" />
                        <span className="text-xs uppercase tracking-wider">Tracks</span>
                      </div>
                      <p className="text-white text-2xl font-bold">{stats.tracksPlayed}</p>
                    </div>

                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <div className="flex items-center gap-2 text-pink-400 mb-2">
                        <Heart className="w-4 h-4" />
                        <span className="text-xs uppercase tracking-wider">Liked</span>
                      </div>
                      <p className="text-white text-2xl font-bold">{stats.likedTracks}</p>
                    </div>

                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <div className="flex items-center gap-2 text-blue-400 mb-2">
                        <Clock className="w-4 h-4" />
                        <span className="text-xs uppercase tracking-wider">Minutes</span>
                      </div>
                      <p className="text-white text-2xl font-bold">{stats.totalMinutes}</p>
                    </div>

                    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                      <div className="flex items-center gap-2 text-yellow-400 mb-2">
                        <Zap className="w-4 h-4" />
                        <span className="text-xs uppercase tracking-wider">OYEs</span>
                      </div>
                      <p className="text-white text-2xl font-bold">{stats.totalReactions}</p>
                    </div>
                  </div>

                  {/* Completion Rate */}
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-white/70 text-sm">Completion Rate</span>
                      <span className="text-white font-bold">
                        {stats.totalListens > 0
                          ? Math.round((stats.completions / stats.totalListens) * 100)
                          : 0}%
                      </span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"
                        style={{
                          width: `${stats.totalListens > 0
                            ? (stats.completions / stats.totalListens) * 100
                            : 0}%`
                        }}
                      />
                    </div>
                  </div>

                  {/* Share URL */}
                  <div className="p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20">
                    <p className="text-white/50 text-xs mb-2">Your Verse URL</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-white text-sm">
                        voyomusic.com/{currentUsername}
                      </code>
                      <button
                        onClick={() => handleCopy(`https://voyomusic.com/${currentUsername}`)}
                        className="p-2 rounded-lg bg-white/10 hover:bg-white/20"
                      >
                        {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-white/70" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* DISCOVER TAB */}
              {activeTab === 'discover' && isLoggedIn && (
                <UserSearch
                  onSelectUser={(username) => {
                    window.location.href = `/${username}`;
                  }}
                />
              )}

              {/* PROFILE TAB */}
              {activeTab === 'profile' && isLoggedIn && (
                <div className="space-y-4">
                  {/* Avatar */}
                  <div className="flex flex-col items-center">
                    <div className="relative mb-4">
                      {editAvatarUrl ? (
                        <img
                          src={editAvatarUrl}
                          alt="Avatar"
                          className="w-24 h-24 rounded-full object-cover ring-4 ring-purple-500/30"
                          onError={() => setEditAvatarUrl('')}
                        />
                      ) : (
                        <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center ring-4 ring-purple-500/30">
                          <span className="text-3xl font-bold text-white">
                            {editDisplayName?.charAt(0)?.toUpperCase() || currentUsername?.charAt(0)?.toUpperCase() || '?'}
                          </span>
                        </div>
                      )}
                      <button className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center border-2 border-[#1a1a2e]">
                        <Camera className="w-4 h-4 text-white" />
                      </button>
                    </div>
                    <p className="text-white/40 text-sm">@{currentUsername}</p>
                  </div>

                  {/* Display Name */}
                  <div>
                    <label className="text-white/50 text-xs uppercase tracking-wider mb-2 block">
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={editDisplayName}
                      onChange={(e) => setEditDisplayName(e.target.value)}
                      placeholder="Your display name"
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/50"
                    />
                  </div>

                  {/* Bio */}
                  <div>
                    <label className="text-white/50 text-xs uppercase tracking-wider mb-2 block">
                      Bio
                    </label>
                    <textarea
                      value={editBio}
                      onChange={(e) => setEditBio(e.target.value)}
                      placeholder="Tell the world about your music taste..."
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/50 resize-none"
                    />
                    <p className="text-white/30 text-xs mt-1">{editBio.length}/150</p>
                  </div>

                  {/* Avatar URL */}
                  <div>
                    <label className="text-white/50 text-xs uppercase tracking-wider mb-2 block">
                      Avatar URL (optional)
                    </label>
                    <input
                      type="url"
                      value={editAvatarUrl}
                      onChange={(e) => setEditAvatarUrl(e.target.value)}
                      placeholder="https://example.com/your-photo.jpg"
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/50"
                    />
                  </div>

                  {/* Save Button */}
                  <button
                    onClick={handleSaveProfile}
                    disabled={isSavingProfile}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSavingProfile ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <Save className="w-5 h-5" />
                    )}
                    {isSavingProfile ? 'Saving...' : 'Save Profile'}
                  </button>

                  {/* Preview Link */}
                  <div className="text-center">
                    <a
                      href={`/${currentUsername}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-400 text-sm hover:underline"
                    >
                      Preview your public profile →
                    </a>
                  </div>
                </div>
              )}

              {/* BACKUP TAB */}
              {activeTab === 'backup' && isLoggedIn && (
                <div className="space-y-4">
                  {lastBackupAt && (
                    <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
                      Last backup: {new Date(lastBackupAt).toLocaleDateString()}
                    </div>
                  )}

                  {/* Download Backup */}
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <h3 className="text-white font-semibold mb-2">Download Backup</h3>
                    <p className="text-white/50 text-sm mb-3">Export your universe as JSON</p>
                    <button
                      onClick={downloadBackup}
                      className="w-full py-3 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-400 flex items-center justify-center gap-2 hover:bg-purple-500/30"
                    >
                      <Download className="w-5 h-5" />
                      Download Verse
                    </button>
                  </div>

                  {/* Passphrase Backup */}
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <h3 className="text-white font-semibold mb-2">Passphrase Backup</h3>
                    <p className="text-white/50 text-sm mb-3">Encrypt with memorable words</p>

                    {!passphrase ? (
                      <button
                        onClick={handleGeneratePassphrase}
                        className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-white/70 flex items-center justify-center gap-2 hover:bg-white/10"
                      >
                        <Key className="w-5 h-5" />
                        Generate Passphrase
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <div className="p-3 rounded-xl bg-black/30 border border-white/10">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-white/50 text-xs">YOUR PASSPHRASE</span>
                            <button onClick={() => handleCopy(passphrase)} className="text-purple-400 hover:text-purple-300">
                              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            </button>
                          </div>
                          <p className="text-white font-mono text-sm">{passphrase}</p>
                        </div>

                        <button
                          onClick={handleSaveToCloud}
                          disabled={isSaving}
                          className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {isSaving ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Shield className="w-5 h-5" />}
                          {isSaving ? 'Saving...' : 'Save to Cloud'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Restore */}
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                    <h3 className="text-white font-semibold mb-2">Restore Verse</h3>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={passphraseInput}
                        onChange={(e) => setPassphraseInput(e.target.value)}
                        placeholder="Enter passphrase..."
                        className="flex-1 px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-purple-500/50"
                      />
                      <button
                        onClick={handleRestoreFromCloud}
                        disabled={isRestoring}
                        className="px-4 py-3 rounded-xl bg-white/10 text-white hover:bg-white/20 disabled:opacity-50"
                      >
                        {isRestoring ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* PORTAL TAB */}
              {activeTab === 'portal' && isLoggedIn && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20">
                    <h3 className="text-white font-semibold mb-2">What is a Portal?</h3>
                    <p className="text-white/70 text-sm">
                      Open your portal to let friends join your listening session in real-time.
                    </p>
                  </div>

                  {isPortalOpen ? (
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                          <span className="text-green-400 font-semibold">Portal Open</span>
                        </div>
                        <button
                          onClick={closePortal}
                          className="px-3 py-1 rounded-lg bg-red-500/20 text-red-400 text-sm hover:bg-red-500/30"
                        >
                          Close
                        </button>
                      </div>

                      {portalUrl && (
                        <div className="p-3 rounded-xl bg-black/30 border border-white/10">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-white/50 text-xs">PORTAL LINK</span>
                            <button onClick={() => handleCopy(portalUrl)} className="text-purple-400 hover:text-purple-300">
                              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                            </button>
                          </div>
                          <p className="text-white text-sm truncate">{portalUrl}</p>
                        </div>
                      )}

                      {portalSession && (
                        <div className="flex items-center gap-2 text-white/50 text-sm">
                          <Users className="w-4 h-4" />
                          <span>{portalSession.connectedPeers.length} listeners</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={handleOpenPortal}
                      className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white flex items-center justify-center gap-2"
                    >
                      <Globe className="w-5 h-5" />
                      Open My Portal
                    </button>
                  )}

                  {isPortalOpen && portalUrl && (
                    <>
                      <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-center">
                        <div className="w-40 h-40 mx-auto bg-white rounded-xl overflow-hidden flex items-center justify-center mb-3 p-2">
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(portalUrl)}&bgcolor=ffffff&color=7c3aed&format=svg`}
                            alt="Portal QR Code"
                            className="w-full h-full"
                            onError={(e) => {
                              // Fallback to icon if QR fails to load
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.parentElement?.classList.add('qr-fallback');
                            }}
                          />
                        </div>
                        <p className="text-white/50 text-sm">Scan to join portal</p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => {
                            if (navigator.share) {
                              navigator.share({ title: 'Join my VOYO', text: 'Listen with me', url: portalUrl });
                            }
                          }}
                          className="py-3 rounded-xl bg-white/5 border border-white/10 text-white/70 flex items-center justify-center gap-2 hover:bg-white/10"
                        >
                          <Smartphone className="w-4 h-4" />
                          Share
                        </button>
                        <button
                          onClick={() => handleCopy(portalUrl)}
                          className="py-3 rounded-xl bg-white/5 border border-white/10 text-white/70 flex items-center justify-center gap-2 hover:bg-white/10"
                        >
                          <Copy className="w-4 h-4" />
                          Copy Link
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default UniversePanel;
