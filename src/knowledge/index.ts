/**
 * VOYO Knowledge System
 *
 * Pre-classified knowledge about African music that the Brain reads from.
 * Scouts write, Brain reads. No searching, just knowing.
 */

// Mood tags and types
export type {
  PrimaryMood,
  FeelingTag,
  EnergyLevel,
  AfricanRegion,
  AfricanGenre,
  VibeProfile
} from './MoodTags';

export {
  VIBE_PROFILES,
  MOOD_KEYWORDS,
  detectMoodFromText,
  estimateEnergy,
  getCompatibleMoods
} from './MoodTags';

// Knowledge store types
export type {
  TrackKnowledge,
  ArtistKnowledge,
  VibeClustersEntry,
  ScoutDiscovery
} from './KnowledgeStore';

// Knowledge store
export {
  useKnowledgeStore,
  getKnowledgeStats,
  findTracksByVibeProfile
} from './KnowledgeStore';
