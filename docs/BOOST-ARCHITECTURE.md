# VOYO BOOST Architecture

## Philosophy: Collective Intelligence Storage

Every user contributes to the collective library. The more people play and boost, the richer the shared R2 cache becomes. Users benefit from each other's listening.

---

## Core Concept

```
BOOST = Download to Device + Upload to R2 + Audio Enhancement

User plays track → Collective grows
User boosts track → Prioritized + Offline ready
```

---

## Playback Decision Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     USER PLAYS TRACK                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ Check R2 Cache  │
                    │ (metadata API)  │
                    └─────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
         ┌────────┐     ┌──────────┐    ┌──────────┐
         │ EXISTS │     │ EXISTS   │    │ NOT ON   │
         │ ≥128kb │     │ <128kbps │    │ R2       │
         └────────┘     └──────────┘    └──────────┘
              │               │               │
              ▼               ▼               ▼
         ┌────────┐     ┌──────────┐    ┌──────────┐
         │Play R2 │     │Play YouTube│   │Play YouTube│
         │(better)│     │+ Re-download│  │+ Download │
         └────────┘     │to R2 (BG)  │   │to R2 (BG) │
                        └──────────┘    └──────────┘
```

**Quality Threshold:** 128kbps (YouTube iframe typical quality)
- R2 ≥ 128kbps → Use R2 (superior)
- R2 < 128kbps → Use YouTube + upgrade R2 in background

---

## Auto-Boost Feature

**Trigger:** User plays ≥50% of track (shows genuine interest)

**Action:**
1. Background download to user's device (IndexedDB)
2. If not on R2 or low quality → trigger R2 upload job
3. Track ready for instant replay next time

**Settings:**
- `autoBoostEnabled: true/false`
- `autoBoostThreshold: 0.5` (50% of track)
- `downloadSetting: 'always' | 'wifi-only' | 'never'`

---

## Manual Boost Button

| Current State | Click Action | Result |
|---------------|--------------|--------|
| Not boosted | Tap | Start download (device + R2 queue) |
| Downloading | Tap | Show progress |
| Boosted | Quick tap | DJ Rewind - play from start |
| Boosted | Long press | Options menu |

**DJ Rewind:** Fast tap on boosted track = instant restart from 0:00
(Like a DJ quick-cueing a track)

---

## Video Mode Behavior

```
┌─────────────────────────────────────────────────────────────┐
│                     VIDEO MODE ACTIVE                        │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
      ┌──────────────┐               ┌──────────────┐
      │ Track BOOSTED │               │ Track NOT    │
      │ (on device)   │               │ BOOSTED      │
      └──────────────┘               └──────────────┘
              │                               │
              ▼                               ▼
      ┌──────────────┐               ┌──────────────┐
      │ Play R2 audio│               │ Play YouTube │
      │ + Show video │               │ iframe       │
      │ (muted)      │               │ (audio+video)│
      └──────────────┘               └──────────────┘
```

**Why mute video when boosted?**
- R2 audio is higher quality
- Sync issues between R2 audio and YouTube video avoided
- Video becomes visual-only accompaniment

---

## Audio Enhancement Presets

**3 Presets (remove Xtreme):**

| Preset | Character | When Available |
|--------|-----------|----------------|
| **Warm** | Bass boost, smooth | Always |
| **Calm** | Relaxed, reduced bass | Always |
| **VOYEX** | Full experience, premium | Boosted tracks only |

**VOYEX Restriction:**
- Only available when track is boosted (high quality source)
- Grayed out / locked icon for non-boosted tracks
- Tooltip: "Boost this track to unlock VOYEX"

**Enhancement Chain:**
```
Audio Source → SubBass → Bass → Warmth → Harmonic → Presence → Air → Gain → Compressor → Output
```

---

## R2 Quality Metadata

Each track on R2 should store:

```typescript
interface R2TrackMetadata {
  trackId: string;
  bitrate: number;        // e.g., 128, 192, 256, 320
  format: string;         // 'mp3' | 'opus' | 'aac'
  duration: number;       // seconds
  uploadedAt: string;     // ISO date
  uploadedBy?: string;    // anonymous user hash
  playCount: number;      // for priority
}
```

---

## Background Download Priority Queue

```
Priority Score = playCount × recencyBoost × qualityNeed

Where:
- playCount: How often this track is played globally
- recencyBoost: Recent plays weighted higher
- qualityNeed: 2x if replacing <128kbps, 1x if new
```

**Queue Processing:**
- Process during idle time
- Respect rate limits
- WiFi-only option for users

---

## Implementation Checklist

### Phase 1: Playback Flow
- [ ] R2 metadata API endpoint (check if track exists + quality)
- [ ] Quality-based playback decision in AudioPlayer
- [ ] Background download trigger at 50% play

### Phase 2: Boost Button
- [ ] Remove Xtreme preset (keep Warm, Calm, VOYEX)
- [ ] VOYEX locked for non-boosted tracks
- [ ] DJ Rewind on boosted track tap
- [ ] Progress indicator during download

### Phase 3: Video Mode
- [ ] Detect boosted state in video mode
- [ ] R2 audio + muted video for boosted tracks
- [ ] Seamless audio source switching

### Phase 4: Collective Growth
- [ ] R2 upload job queue (backend)
- [ ] Quality upgrade detection (replace 64kbps)
- [ ] Priority queue based on play count
- [ ] Cleanup old low-quality uploads

### Phase 5: Settings UI
- [ ] Auto-boost toggle (50% threshold)
- [ ] Download setting: Always / WiFi-only / Never
- [ ] Clear cache option
- [ ] Storage usage display
- [ ] Add Lottie animations (Sunrise for Calm, etc.)

---

## Current State vs Target

| Feature | Current | Target |
|---------|---------|--------|
| Auto-boost trigger | 100% play? | 50% play |
| Presets | 4 (Warm, Calm, VOYEX, Xtreme) | 3 (remove Xtreme) |
| VOYEX availability | Always | Boosted only |
| Quality detection | None | Check R2 bitrate |
| Background upgrade | None | Replace <128kbps |
| Video mode | ? | R2 audio + muted video |
| Lottie animations | None in settings | Add for presets |

---

## Files to Modify

1. `src/components/AudioPlayer.tsx` - Playback decision flow
2. `src/components/ui/BoostSettings.tsx` - Remove Xtreme, add Lotties
3. `src/components/ui/BoostButton.tsx` - DJ Rewind, VOYEX lock
4. `src/store/downloadStore.ts` - Auto-boost threshold
5. `src/services/mediaCache.ts` - Quality detection
6. Backend: R2 metadata API + upload queue

---

*Document created: 2026-01-18*
*Status: Architecture ready for implementation*
