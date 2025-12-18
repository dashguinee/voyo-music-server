-- VOYO Universe Schema
-- The smart KV: username = key, universe = value
-- Run this in Supabase SQL Editor

-- ============================================
-- UNIVERSES TABLE (The Core)
-- ============================================
CREATE TABLE IF NOT EXISTS universes (
  -- THE KEY (URL identity)
  username TEXT PRIMARY KEY,

  -- THE LOCK (PIN auth, no email needed)
  pin_hash TEXT NOT NULL,
  phone TEXT,  -- Optional: for PIN recovery via SMS

  -- THE VALUE (user's universe)
  state JSONB DEFAULT '{
    "likes": [],
    "playlists": [],
    "queue": [],
    "history": [],
    "preferences": {
      "boostProfile": "boosted",
      "shuffleMode": false,
      "repeatMode": "off"
    },
    "stats": {
      "totalListens": 0,
      "totalMinutes": 0,
      "totalOyes": 0
    }
  }'::jsonb,

  -- PUBLIC VIEW (what visitors see without PIN)
  public_profile JSONB DEFAULT '{
    "displayName": "",
    "bio": "",
    "avatarUrl": null,
    "topTracks": [],
    "publicPlaylists": [],
    "isPublic": true
  }'::jsonb,

  -- PORTAL (real-time sync)
  now_playing JSONB,  -- { trackId, title, artist, thumbnail, currentTime, duration }
  portal_open BOOLEAN DEFAULT false,
  portal_viewers TEXT[] DEFAULT '{}',

  -- METADATA
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_active TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_universes_portal_open ON universes(portal_open) WHERE portal_open = true;
CREATE INDEX IF NOT EXISTS idx_universes_last_active ON universes(last_active DESC);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE universes ENABLE ROW LEVEL SECURITY;

-- Anyone can read public profiles and portal state
CREATE POLICY "Public profiles are viewable by everyone"
  ON universes FOR SELECT
  USING (true);

-- Only authenticated user can update their own universe
-- (We'll handle auth via PIN verification in the app)
CREATE POLICY "Users can update own universe"
  ON universes FOR UPDATE
  USING (true)  -- We verify PIN in app before allowing updates
  WITH CHECK (true);

-- Anyone can insert (create account)
CREATE POLICY "Anyone can create universe"
  ON universes FOR INSERT
  WITH CHECK (true);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER universes_updated_at
  BEFORE UPDATE ON universes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================
-- REALTIME
-- ============================================
-- Enable realtime for portal sync
ALTER PUBLICATION supabase_realtime ADD TABLE universes;

-- ============================================
-- REACTIONS TABLE (The Social Spine)
-- ============================================
-- Every reaction connects: User + Track + Category + Moment
CREATE TABLE IF NOT EXISTS reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- WHO reacted
  username TEXT NOT NULL REFERENCES universes(username) ON DELETE CASCADE,

  -- WHAT track
  track_id TEXT NOT NULL,           -- VOYO ID (vyo_xxx)
  track_title TEXT NOT NULL,
  track_artist TEXT NOT NULL,
  track_thumbnail TEXT,

  -- WHICH category (MixBoard column)
  category TEXT NOT NULL CHECK (category IN (
    'afro-heat', 'chill-vibes', 'party-mode', 'late-night', 'workout'
  )),

  -- THE reaction
  emoji TEXT NOT NULL DEFAULT '🔥',
  reaction_type TEXT NOT NULL DEFAULT 'oye' CHECK (reaction_type IN (
    'oyo', 'oye', 'fire', 'chill', 'hype', 'love'
  )),

  -- Optional text comment
  comment TEXT,

  -- WHEN
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- TRACK STATS TABLE (Aggregated per track)
-- ============================================
-- Cached stats for quick lookups (updated via trigger)
CREATE TABLE IF NOT EXISTS track_stats (
  track_id TEXT PRIMARY KEY,
  track_title TEXT,
  track_artist TEXT,
  track_thumbnail TEXT,

  -- Total reactions
  total_reactions INTEGER DEFAULT 0,

  -- Reactions by category (for vibe breakdown)
  afro_heat_count INTEGER DEFAULT 0,
  chill_vibes_count INTEGER DEFAULT 0,
  party_mode_count INTEGER DEFAULT 0,
  late_night_count INTEGER DEFAULT 0,
  workout_count INTEGER DEFAULT 0,

  -- Dominant category (auto-calculated)
  dominant_category TEXT,

  -- Timestamps
  first_reaction_at TIMESTAMPTZ,
  last_reaction_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- REACTIONS INDEXES
-- ============================================
-- Fast lookup: reactions for a track (comments view)
CREATE INDEX IF NOT EXISTS idx_reactions_track ON reactions(track_id, created_at DESC);

-- Fast lookup: reactions by user (portal history)
CREATE INDEX IF NOT EXISTS idx_reactions_user ON reactions(username, created_at DESC);

-- Fast lookup: reactions by category (MixBoard pulse)
CREATE INDEX IF NOT EXISTS idx_reactions_category ON reactions(category, created_at DESC);

-- Fast lookup: recent reactions globally (live feed)
CREATE INDEX IF NOT EXISTS idx_reactions_recent ON reactions(created_at DESC);

-- ============================================
-- REACTIONS RLS
-- ============================================
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE track_stats ENABLE ROW LEVEL SECURITY;

-- Anyone can read reactions
CREATE POLICY "Reactions are viewable by everyone"
  ON reactions FOR SELECT USING (true);

-- Only logged-in users can create reactions (verified in app via PIN)
CREATE POLICY "Authenticated users can create reactions"
  ON reactions FOR INSERT WITH CHECK (true);

-- Track stats are public
CREATE POLICY "Track stats are viewable by everyone"
  ON track_stats FOR SELECT USING (true);

-- Track stats updated via trigger only
CREATE POLICY "Track stats updated via system"
  ON track_stats FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- TRACK STATS TRIGGER (Auto-update on reaction)
-- ============================================
CREATE OR REPLACE FUNCTION update_track_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Upsert track stats
  INSERT INTO track_stats (
    track_id, track_title, track_artist, track_thumbnail,
    total_reactions, first_reaction_at, last_reaction_at,
    afro_heat_count, chill_vibes_count, party_mode_count,
    late_night_count, workout_count
  ) VALUES (
    NEW.track_id, NEW.track_title, NEW.track_artist, NEW.track_thumbnail,
    1, NEW.created_at, NEW.created_at,
    CASE WHEN NEW.category = 'afro-heat' THEN 1 ELSE 0 END,
    CASE WHEN NEW.category = 'chill-vibes' THEN 1 ELSE 0 END,
    CASE WHEN NEW.category = 'party-mode' THEN 1 ELSE 0 END,
    CASE WHEN NEW.category = 'late-night' THEN 1 ELSE 0 END,
    CASE WHEN NEW.category = 'workout' THEN 1 ELSE 0 END
  )
  ON CONFLICT (track_id) DO UPDATE SET
    total_reactions = track_stats.total_reactions + 1,
    last_reaction_at = NEW.created_at,
    afro_heat_count = track_stats.afro_heat_count +
      CASE WHEN NEW.category = 'afro-heat' THEN 1 ELSE 0 END,
    chill_vibes_count = track_stats.chill_vibes_count +
      CASE WHEN NEW.category = 'chill-vibes' THEN 1 ELSE 0 END,
    party_mode_count = track_stats.party_mode_count +
      CASE WHEN NEW.category = 'party-mode' THEN 1 ELSE 0 END,
    late_night_count = track_stats.late_night_count +
      CASE WHEN NEW.category = 'late-night' THEN 1 ELSE 0 END,
    workout_count = track_stats.workout_count +
      CASE WHEN NEW.category = 'workout' THEN 1 ELSE 0 END,
    updated_at = now();

  -- Update dominant category
  UPDATE track_stats SET dominant_category = (
    SELECT category FROM (
      VALUES
        ('afro-heat', afro_heat_count),
        ('chill-vibes', chill_vibes_count),
        ('party-mode', party_mode_count),
        ('late-night', late_night_count),
        ('workout', workout_count)
    ) AS t(category, count)
    ORDER BY count DESC
    LIMIT 1
  )
  WHERE track_id = NEW.track_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reaction_stats_trigger
  AFTER INSERT ON reactions
  FOR EACH ROW
  EXECUTE FUNCTION update_track_stats();

-- ============================================
-- REALTIME FOR REACTIONS
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE track_stats;

-- ============================================
-- SAMPLE DATA (for testing)
-- ============================================
-- INSERT INTO universes (username, pin_hash, public_profile)
-- VALUES (
--   'dash',
--   '$2a$10$...', -- hashed PIN
--   '{
--     "displayName": "Dash",
--     "bio": "Building the future of music",
--     "topTracks": ["track1", "track2"],
--     "isPublic": true
--   }'::jsonb
-- );
