# VOYO Music - Session Resume

**Last Updated**: 2026-01-19
**Status**: 100% Code Complete ✅
**Branch**: main

---

## COMPLETED ✅

### VoyoLiveCard Component ✅
`src/components/social/SignInPrompt.tsx`

- Orbiting avatars around center (3 orbiting, 1 center cycling)
- 7 dynamic gradient backgrounds with smooth crossfade (10s cycle)
- Mini friend cards showing who's listening (album art + profile overlay)
- Connected to Command Center for real friends & activity data
- Shimmer effect, pulsing live indicators
- Falls back to mock data (Aziz, Kenza, Mamadou, Fatou) when not logged in
- Play button opens Now Playing panel

### DaHub Socials (Hub.tsx) ✅ VERIFIED
`src/components/classic/Hub.tsx`

- ✅ `friendsAPI.getVoyoFriends()` - Gets friends from Command Center
- ✅ `profileAPI.getProfile()` - Gets each friend's now_playing
- ✅ `messagesAPI.getConversations()` - Gets DM threads with unread counts
- ✅ `friendsAPI.addFriend()` - Add friend modal with DASH ID input
- ✅ Notes section shows `♪ track.title` for friends listening
- ✅ Green ring on avatars for friends with `nowPlaying`
- ✅ DirectMessageChat component with real-time subscription, read receipts

### Feed (HomeFeed.tsx) ✅ VERIFIED
`src/components/classic/HomeFeed.tsx`

- ✅ VoyoLiveCard renders at line 1150 (`<SignInPrompt />`)
- ✅ Track pool from `useTrackPoolStore` → 325K video_intelligence DB
- ✅ Personalization via `calculateBehaviorScore`, `getPoolAwareHotTracks`
- ✅ R2 audio integration via SmartImage + getThumb()
- ✅ All shelves use pool-aware vibe engine recommendations

### Auth & User Data ✅ IMPLEMENTED
`src/providers/AuthProvider.tsx`

- ✅ AuthProvider wraps app - detects login from Command Center
- ✅ Auto-creates `voyo_profiles` entry on first login via `get_or_create_profile` RPC
- ✅ Listens for localStorage changes + window focus for cross-tab auth
- ✅ Updates `now_playing` in real-time when track changes
- ✅ Updates presence in Command Center every 30s (friends see what you're playing)
- ✅ Auto-syncs preferences to cloud on change (debounced 5s)
- ✅ Restores preferences from cloud on login

**Auth Flow:**
1. User clicks "Sign in" → Opens `hub.dasuperhub.com` in new tab
2. User logs in on Command Center
3. AuthProvider detects localStorage change (or window focus)
4. Calls `profileAPI.getOrCreate(dashId)` → Creates VOYO profile in Supabase
5. Starts presence updates + now_playing sync

---

## REMAINING (Non-Code)

1. **voyomusic.com DNS** - Configure domain to point to Vercel deployment
2. **R2 Audio Upload** - ~4K local tracks pending upload to R2 bucket

---

## DATA CONTEXT

| Source | Count | Status |
|--------|-------|--------|
| Total tracks in DB | 325,043 | ✅ Connected via vibeEngine |
| R2 audio objects | ~4,000 | ✅ Live at `voyo-edge.dash-webtv.workers.dev` |
| Local audio (not in R2) | ~4,000 | Pending upload |
| Total seed data | ~8,000 | Good enough for launch |

**R2 Coverage**: ~52% of tracks have boosted audio
**Edge Worker**: `voyo-edge.dash-webtv.workers.dev` - LIVE

---

## KEY FILES

| File | Purpose |
|------|---------|
| `src/components/social/SignInPrompt.tsx` | VoyoLiveCard - just completed |
| `src/components/classic/Hub.tsx` | DaHub social interface (Notes, Messages, Activity) |
| `src/components/classic/HomeFeed.tsx` | Main feed with VoyoLiveCard |
| `src/lib/voyo-api.ts` | Command Center integration, friends, activity APIs |
| `src/services/vibeEngine.ts` | Queries 325K tracks from video_intelligence |
| `src/components/AudioPlayer.tsx` | R2 integration for boosted audio |

---

## COMMAND CENTER APIS

```typescript
// Friends
friendsAPI.getFriends(dashId)        // Get all friends
friendsAPI.getVoyoFriends(dashId)    // Friends currently on VOYO

// Activity
activityAPI.getFriendsActivity(dashId)  // Friends' nowPlaying from voyo_profiles
activityAPI.getLiveListeners(dashId)    // Friends with portal open

// Profile
profileAPI.getProfile(dashId)        // User's VOYO profile
profileAPI.updateNowPlaying(dashId, track)  // Update what you're playing
```

---

## SUPABASE TABLES

- `voyo_profiles` - User profiles, now_playing, preferences
- `voyo_playlists` - User playlists
- `video_intelligence` - 325K tracks (main content DB)
- Command Center (separate): `friendships`, `messages`, `presence`

---

## STATUS FOR LAUNCH

1. ✅ VoyoLiveCard - Complete with animations, real data
2. ✅ DaHub Socials - Verified, all APIs connected
3. ✅ Feed - Verified, 325K tracks, R2 audio working
4. ⏳ voyomusic.com DNS - External configuration pending
5. ⏳ R2 Audio Upload - ~4K local tracks pending

---

## HOW TO RESUME

```bash
cd /home/dash/voyo-music
npm run dev  # Start dev server on port 5173

# Test locally
# - Check VoyoLiveCard animations
# - Test Hub.tsx social features
# - Verify feed loads tracks
```

---

## VOYO VOCABULARY

- "Oyé!" - Greeting/attention
- "Vibes on Vibes" - Headline
- "For the People, by The People" - Tagline
- West Africa focus - diverse avatars, Afrobeats content
