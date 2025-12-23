# VOYO Feed Evolution Timeline

## Commit History (Recent to Oldest)

```
HEAD → 4644a53 (AGENT'S VERSION - THE GOOD ONE) ← RESTORE TO HERE
   ↓
   │  fix: Feed playback never stops + natural varied clip lengths
   │  • Full 30s, Extract 18s (±5s variance, 15s min)
   │  • Fixed playback resume bug
   │  • Natural feel: 13-23s extract, 25-35s full
   │
   ↓
49478d3 (PERFORMANCE BOOST - KEEP THIS)
   │  perf: Eliminate feed load gap for instant scrolling
   │  • 50ms seek (was 300ms)
   │  • 16ms scroll debounce (was 50ms)
   │  • Preload 3 cards (was 2)
   │  • Instant iframe load
   │
   ↓
6d982e3 fix: Remove unused bandwidth import
   ↓
6468fcf VOYO Ship v1.0 - Complete music flow fixes
   ↓
   ...
   ↓
2ec0e24 feat(feed): Add dual snippet mode (Extract vs Full)
   │  • Full 25s, Extract 12s
   │  • Mode toggle button
   │
   ↓
20facaa feat: Video Snippets - actual music videos in feed
   │  • Piped API integration
   │  • VideoSnippet component
   │
   ↓
cce2e0c feat: Music Snippet Feed - auto-play, visualizer, auto-advance
   │  • AudioVisualizer component
   │  • 25s fixed snippet timer
   │  • Auto-advance like TikTok
   │
   ↓
(earlier commits...)
```

---

## Duration Evolution

| Commit | Full Mode | Extract Mode | Variance | Minimum | Status |
|--------|-----------|--------------|----------|---------|--------|
| `cce2e0c` (Original) | 25s fixed | N/A | None | 25s | Basic working |
| `2ec0e24` (Dual mode) | 25s | 12s | None | 12s-25s | Good improvement |
| `4644a53` (Agent) | **30s** | **18s** | **±5s** | **15s** | **BEST** ✓ |
| Uncommitted (Current) | 20s | 10s | ±3s | 8s | TOO SHORT ✗ |

---

## User Experience Comparison

### Original Version (cce2e0c)
```
Timeline: [--------25 seconds--------]
Feel: Fixed duration, no variety
Result: Works but feels robotic
```

### Dual Mode (2ec0e24)
```
Full:    [--------25 seconds--------]
Extract: [--12 seconds--]
Feel: Better but still fixed
Result: Good start, needs variance
```

### Agent's Version (4644a53) ⭐
```
Full:    [-----25-35 seconds-----]  ← Sweet spot
Extract: [--13-23 seconds--]       ← Perfect vibe
Feel: Natural, breathing room
Result: Users can react and engage
```

### Current Uncommitted (BROKEN)
```
Full:    [--17-23 seconds--]  ← Too rushed
Extract: [--7-13s--]          ← Way too short
Feel: Jarring, cut off mid-vibe
Result: "Tease" backfires, feels incomplete
```

---

## The "Tease Psychology" Mistake

**Theory**: Shorter clips = leave them wanting more = click to full player
**Reality**: Shorter clips = not enough time to vibe = scroll past without engaging

### Problems with 8-13 second clips:
1. Can't recognize the track yet
2. Can't feel the vibe
3. Gets cut off just as hook hits
4. No time to heart/comment/share
5. Feels like buffering/loading issue

### Why 15-35 seconds works:
1. Enough time to recognize artist/song
2. Feel the vibe and mood
3. Hear the hook and memorable parts
4. Time to react emotionally
5. Decide if want to save/share/comment

---

## What the Agent Got Right

### 1. Playback Resume Fix
```javascript
// Before: Stops after few videos
// After: Checks if track is paused and resumes it
else if (isThisTrack && !isPlaying) {
  onTogglePlay(); // Resume!
}
```

### 2. Natural Variance
```javascript
// Simple hash from trackId = consistent "random" per track
// Each track gets its own duration, but same track = same duration
const variance = (Math.abs(hash) % 11) - 5; // -5 to +5
return Math.max(15, baseDuration + variance);
```

### 3. Smart Minimum
```javascript
// 15 seconds minimum = always enough time to react
// 8 seconds = too rushed, feels broken
```

---

## Golden Metrics

| Metric | Agent Version | Current Version |
|--------|--------------|-----------------|
| **Extract Range** | 13-23s | 7-13s |
| **Full Range** | 25-35s | 17-23s |
| **Average Extract** | 18s | 10s |
| **Average Full** | 30s | 20s |
| **Variance** | High (feels organic) | Low (feels rigid) |
| **Min Duration** | 15s (comfortable) | 8s (jarring) |

---

## Performance Stack (All Working)

These optimizations from `49478d3` are EXCELLENT, keep them:

```javascript
✓ Seek delay:      300ms → 50ms   (6x faster)
✓ Scroll debounce:  50ms → 16ms   (3x faster)
✓ Preload window:   2 cards → 3   (smoother)
✓ Iframe load:      300ms → 0ms   (instant)
```

Result: **TikTok-smooth scrolling experience**

---

## Recommendation Path

```
Current State (Uncommitted)
         ↓
    git restore
         ↓
    Agent's Version (4644a53)  ← Go here!
         ↓
      DONE
```

**Do NOT**:
- Keep the "tease psychology" changes
- Use 8-10 second base durations
- Over-complicate the timer logic

**DO**:
- Restore to 4644a53
- Trust the agent's natural feel approach
- Give users breathing room
- Let music discovery happen organically

---

*Analysis by ZION Git Archaeologist*
*Conclusion: Agent nailed it, restore immediately*
