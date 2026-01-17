# VOYO Music - R2 Audio Pipeline Audit
**Generated**: January 17, 2026

## CRITICAL FINDING: R2 IS ORPHANED

### What Was Built (100% Complete)
- R2 bucket: `voyo-audio` configured
- Credentials: `~/.r2_credentials` active
- Files uploaded: ~41,000 (20K tracks × 2 bitrates)
- Structure: `128/` and `64/` folders
- GitHub Actions: 11 parallel workflows active

### What's Missing (0% Complete)
- Backend R2 endpoint: ❌ None
- Frontend R2 integration: ❌ None
- Playback fallback to R2: ❌ None
- Download manager R2 check: ❌ None

## Current Playback Flow

```
User clicks → playerStore → YouTubeIframe → YouTube ONLY
                                              ↓
                                        R2 never touched
```

**Playback sources in code:**
- `youtube_direct` - YouTube iframe ← ONLY ONE USED
- `voyo_proxy` - Backend proxy
- `voyo_cache` - Local IndexedDB
- `r2` - NOT IMPLEMENTED

## Investment Analysis

| Item | Status |
|------|--------|
| 11 GitHub Actions workflows | ✅ Working |
| Multi-account parallel downloads | ✅ Working |
| R2 deduplication | ✅ Working |
| 41K audio files | ✅ Uploaded |
| Backend R2 streaming | ❌ Missing |
| Frontend R2 awareness | ❌ Missing |
| **ROI** | **0%** |

## 4-Hour Integration Plan

### Phase 1: Backend R2 Endpoint (2 hours)
```javascript
// server/index.js
app.get('/r2/stream/:trackId', async (req, res) => {
  const { trackId } = req.params;
  const quality = req.query.q || '128';

  // Try R2 first
  const r2Url = `https://${R2_BUCKET}.r2.cloudflarestorage.com/${quality}/${trackId}.mp3`;
  const r2Response = await fetch(r2Url);

  if (r2Response.ok) {
    res.set('Content-Type', 'audio/mpeg');
    return r2Response.body.pipe(res);
  }

  // Fallback to YouTube extraction
  return youtubeExtract(trackId, res);
});
```

### Phase 2: Frontend R2 Check (1 hour)
```typescript
// src/services/api.ts
export async function getStreamUrl(trackId: string): Promise<string> {
  // Try R2 first
  const r2Check = await fetch(`${BACKEND_URL}/r2/exists/${trackId}`);
  if (r2Check.ok) {
    return `${BACKEND_URL}/r2/stream/${trackId}`;
  }

  // Fallback to YouTube
  return getYouTubeStream(trackId);
}
```

### Phase 3: Quality Selection (30 min)
- Check network quality
- Select 128kbps (fast) or 64kbps (slow)

### Phase 4: Monitoring (30 min)
- Track R2 hit rate
- Monitor bandwidth savings

## Decision Required

**Option A: Enable R2** (Recommended)
- 4 hours dev work
- Unlocks 41K pre-downloaded tracks
- Faster playback (no extraction delay)
- Better reliability

**Option B: Disable R2**
- Delete 11 workflows
- Clear R2 bucket
- Lose infrastructure investment
