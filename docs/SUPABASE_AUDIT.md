# VOYO Music - Supabase & Canonization Audit
**Generated**: January 17, 2026

## CRITICAL BLOCKERS

### 1. Migration 002 NOT APPLIED
**File**: `supabase/migrations/002_enrichment_schema.sql`
**Status**: Exists but NOT run in Supabase

**Missing columns in video_intelligence:**
- `artist_tier` - A/B/C/D classification
- `era` - pre-1990, 1990s, 2000s, 2010s, 2020s
- `primary_genre` - Genre classification
- `cultural_tags` - Array of cultural tags
- `aesthetic_tags` - Array of aesthetic tags
- `vibe_scores` - JSONB with party/chill/workout scores
- `enrichment_source`, `enrichment_confidence`, `enriched_at`

**Impact**: vibeEngine queries these columns → queries FAIL

### 2. Canonized Data NOT Loaded
**File**: `data/canonized_v4.json` (117MB, 4.7M lines)
**Contains**: 122,402 tracks with full enrichment data
**Status**: Sits on disk, NEVER loaded to database

**What exists:**
```
data/canonized_v4.json         117MB  ← REAL DATA (122K tracks)
data/canonized_v4_test.json    198KB  ← Test data
data/canonized_v2.json         26MB   ← EMPTY
data/canonized_v3.json         23MB   ← EMPTY
```

### 3. videoIntelligenceAPI Missing Enrichment
**File**: `src/lib/supabase.ts`
**Issue**: `sync()` method doesn't send enrichment fields

## TABLES STATUS

| Table | Status | Issue |
|-------|--------|-------|
| `universes` | ✅ Working | None |
| `video_intelligence` | ⚠️ Partial | Missing enrichment columns |
| `voyo_tracks` | ❌ Orphaned | Defined but no API |
| `voyo_signals` | ❌ Orphaned | Defined but no API |
| `voyo_vibes` | ❌ Orphaned | Defined but no API |
| `vibe_feedback` | ❌ Not created | Migration 002 not applied |

## FIX SEQUENCE

1. **Apply migration 002** (5 min)
   - Open Supabase SQL Editor
   - Paste 002_enrichment_schema.sql
   - Run

2. **Create data loader script** (30 min)
   - Read canonized_v4.json
   - Batch upsert to video_intelligence
   - 122K tracks @ 1000/batch

3. **Update sync API** (15 min)
   - Add enrichment fields to videoIntelligenceAPI.sync()
