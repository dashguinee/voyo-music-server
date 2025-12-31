/**
 * VOYO Knowledge - Mood & Feeling Tags
 *
 * The taxonomy of emotions, moods, and feelings that power VOYO recommendations.
 * Brain doesn't search - it reads from pre-classified knowledge.
 */

// ============================================
// PRIMARY MOOD CATEGORIES
// ============================================

export type PrimaryMood =
  | 'energetic'    // High energy, makes you move
  | 'chill'        // Relaxed, laid back
  | 'romantic'     // Love songs, sensual
  | 'party'        // Club bangers, celebrations
  | 'spiritual'    // Gospel, worship, reflective
  | 'melancholic'  // Sad, heartbreak, longing
  | 'triumphant'   // Victory, success, motivation
  | 'nostalgic'    // Throwback vibes, memories
  | 'sensual'      // Slow wine, intimate
  | 'aggressive'   // Hard-hitting, intense
  | 'peaceful'     // Calm, meditation, ambient
  | 'playful';     // Fun, carefree, lighthearted

// ============================================
// FEELING TAGS (Granular emotions)
// ============================================

export type FeelingTag =
  // Energy feelings
  | 'hype' | 'lit' | 'fire' | 'turnt' | 'wild'
  // Chill feelings
  | 'mellow' | 'smooth' | 'easy' | 'floating' | 'dreamy'
  // Love feelings
  | 'in-love' | 'heartbreak' | 'longing' | 'desire' | 'devotion'
  // Party feelings
  | 'celebration' | 'dancing' | 'vibing' | 'euphoric' | 'ecstatic'
  // Spiritual feelings
  | 'grateful' | 'blessed' | 'worship' | 'hope' | 'faith'
  // Sad feelings
  | 'pain' | 'tears' | 'loss' | 'missing' | 'regret'
  // Power feelings
  | 'confident' | 'boss' | 'winner' | 'unstoppable' | 'legendary'
  // Memory feelings
  | 'throwback' | 'memories' | 'old-school' | 'classic' | 'timeless'
  // Intimate feelings
  | 'sexy' | 'seductive' | 'intimate' | 'slow-wine' | 'bedroom'
  // Intensity feelings
  | 'raw' | 'gritty' | 'street' | 'hardcore' | 'real';

// ============================================
// ENERGY LEVELS
// ============================================

export type EnergyLevel = 1 | 2 | 3 | 4 | 5;
// 1 = Very calm (meditation, ambient)
// 2 = Relaxed (chill, acoustic)
// 3 = Moderate (mid-tempo, easy listening)
// 4 = High (upbeat, danceable)
// 5 = Maximum (bangers, club anthems)

// ============================================
// AFRICAN MUSIC REGIONS
// ============================================

export type AfricanRegion =
  | 'west-africa'      // Nigeria, Ghana, Senegal, etc.
  | 'east-africa'      // Kenya, Tanzania, Uganda, etc.
  | 'south-africa'     // SA, Zimbabwe, Botswana, etc.
  | 'north-africa'     // Morocco, Egypt, Algeria, etc.
  | 'central-africa'   // Congo, Cameroon, etc.
  | 'francophone'      // French-speaking Africa
  | 'lusophone'        // Portuguese-speaking (Angola, Mozambique)
  | 'diaspora';        // African diaspora worldwide

// ============================================
// AFRICAN GENRES
// ============================================

export type AfricanGenre =
  // Nigerian
  | 'afrobeats' | 'afropop' | 'afro-fusion' | 'alte' | 'fuji' | 'juju'
  // Ghanaian
  | 'highlife' | 'hiplife' | 'azonto' | 'ghana-gospel'
  // South African
  | 'amapiano' | 'gqom' | 'kwaito' | 'maskandi' | 'sa-house'
  // East African
  | 'bongo-flava' | 'gengetone' | 'benga' | 'taarab'
  // Francophone
  | 'coupe-decale' | 'ndombolo' | 'makossa' | 'mbalax' | 'zouk'
  // Other
  | 'afro-house' | 'afro-soul' | 'afro-rnb' | 'african-gospel'
  | 'rumba' | 'soukous' | 'kuduro' | 'kizomba' | 'semba';

// ============================================
// VIBE COMBINATIONS (Common mood patterns)
// ============================================

export interface VibeProfile {
  primary: PrimaryMood;
  feelings: FeelingTag[];
  energy: EnergyLevel;
  region?: AfricanRegion;
  genre?: AfricanGenre;
}

// Pre-defined vibe profiles for quick matching
export const VIBE_PROFILES: Record<string, VibeProfile> = {
  'afro-heat': {
    primary: 'energetic',
    feelings: ['fire', 'lit', 'turnt', 'dancing'],
    energy: 5,
    genre: 'afrobeats'
  },
  'chill-vibes': {
    primary: 'chill',
    feelings: ['mellow', 'smooth', 'floating', 'easy'],
    energy: 2,
  },
  'love-songs': {
    primary: 'romantic',
    feelings: ['in-love', 'devotion', 'desire'],
    energy: 3,
  },
  'party-mode': {
    primary: 'party',
    feelings: ['celebration', 'euphoric', 'vibing', 'dancing'],
    energy: 5,
  },
  'worship': {
    primary: 'spiritual',
    feelings: ['grateful', 'blessed', 'worship', 'hope'],
    energy: 3,
  },
  'amapiano-groove': {
    primary: 'party',
    feelings: ['vibing', 'dancing', 'smooth'],
    energy: 4,
    genre: 'amapiano',
    region: 'south-africa'
  },
  'slow-wine': {
    primary: 'sensual',
    feelings: ['sexy', 'intimate', 'slow-wine'],
    energy: 2,
  },
  'street-anthems': {
    primary: 'aggressive',
    feelings: ['raw', 'street', 'real', 'boss'],
    energy: 4,
  },
  'throwback-jams': {
    primary: 'nostalgic',
    feelings: ['throwback', 'memories', 'classic', 'timeless'],
    energy: 3,
  },
  'motivation': {
    primary: 'triumphant',
    feelings: ['winner', 'unstoppable', 'confident', 'boss'],
    energy: 4,
  }
};

// ============================================
// MOOD DETECTION KEYWORDS
// ============================================

// Keywords that indicate specific moods (for classification)
export const MOOD_KEYWORDS: Record<PrimaryMood, string[]> = {
  energetic: ['fire', 'banger', 'hit', 'jam', 'vibe', 'energy', 'hype', 'lit', 'turn up', 'go crazy'],
  chill: ['chill', 'relax', 'mellow', 'smooth', 'easy', 'laid back', 'vibes', 'calm', 'peace'],
  romantic: ['love', 'baby', 'heart', 'forever', 'you', 'mine', 'together', 'darling', 'sweetheart'],
  party: ['party', 'dance', 'club', 'celebration', 'tonight', 'let\'s go', 'hands up', 'move'],
  spiritual: ['god', 'lord', 'jesus', 'praise', 'worship', 'blessed', 'hallelujah', 'amen', 'grace'],
  melancholic: ['sad', 'pain', 'cry', 'tears', 'hurt', 'broken', 'alone', 'miss', 'gone'],
  triumphant: ['win', 'champion', 'victory', 'success', 'king', 'queen', 'boss', 'legend', 'great'],
  nostalgic: ['remember', 'back', 'old', 'days', 'memories', 'time', 'classic', 'throwback'],
  sensual: ['body', 'touch', 'skin', 'close', 'slow', 'wine', 'waist', 'hold', 'night'],
  aggressive: ['street', 'real', 'hard', 'raw', 'gangsta', 'hustle', 'grind', 'savage'],
  peaceful: ['peace', 'quiet', 'still', 'rest', 'tranquil', 'serene', 'gentle', 'soft'],
  playful: ['fun', 'play', 'laugh', 'crazy', 'silly', 'enjoy', 'happy', 'joy', 'smile']
};

// ============================================
// HELPER FUNCTIONS
// ============================================

export function detectMoodFromText(text: string): PrimaryMood[] {
  const lowerText = text.toLowerCase();
  const detectedMoods: PrimaryMood[] = [];

  for (const [mood, keywords] of Object.entries(MOOD_KEYWORDS)) {
    const matches = keywords.filter(kw => lowerText.includes(kw));
    if (matches.length >= 2) {
      detectedMoods.push(mood as PrimaryMood);
    }
  }

  return detectedMoods.length > 0 ? detectedMoods : ['energetic']; // Default
}

export function estimateEnergy(title: string, genre?: AfricanGenre): EnergyLevel {
  const lowerTitle = title.toLowerCase();

  // High energy indicators
  if (['banger', 'fire', 'lit', 'turn up', 'party'].some(w => lowerTitle.includes(w))) {
    return 5;
  }

  // Genre-based defaults
  if (genre) {
    const highEnergy: AfricanGenre[] = ['gqom', 'gengetone', 'coupe-decale'];
    const medHighEnergy: AfricanGenre[] = ['afrobeats', 'amapiano', 'ndombolo'];
    const medEnergy: AfricanGenre[] = ['highlife', 'bongo-flava', 'mbalax'];
    const lowEnergy: AfricanGenre[] = ['afro-soul', 'afro-rnb', 'kizomba'];

    if (highEnergy.includes(genre)) return 5;
    if (medHighEnergy.includes(genre)) return 4;
    if (medEnergy.includes(genre)) return 3;
    if (lowEnergy.includes(genre)) return 2;
  }

  // Low energy indicators
  if (['chill', 'slow', 'acoustic', 'ballad', 'love'].some(w => lowerTitle.includes(w))) {
    return 2;
  }

  return 3; // Default moderate
}

export function getCompatibleMoods(mood: PrimaryMood): PrimaryMood[] {
  const compatibility: Record<PrimaryMood, PrimaryMood[]> = {
    energetic: ['party', 'triumphant', 'playful'],
    chill: ['peaceful', 'romantic', 'nostalgic'],
    romantic: ['sensual', 'chill', 'melancholic'],
    party: ['energetic', 'playful', 'triumphant'],
    spiritual: ['peaceful', 'triumphant', 'nostalgic'],
    melancholic: ['romantic', 'nostalgic', 'peaceful'],
    triumphant: ['energetic', 'party', 'aggressive'],
    nostalgic: ['chill', 'melancholic', 'peaceful'],
    sensual: ['romantic', 'chill', 'party'],
    aggressive: ['energetic', 'triumphant', 'party'],
    peaceful: ['chill', 'spiritual', 'nostalgic'],
    playful: ['energetic', 'party', 'chill']
  };

  return compatibility[mood] || [];
}
