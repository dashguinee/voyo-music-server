/**
 * useMoments - 4-Directional Moments Grid Navigation
 *
 * Powers the VoyoMoments feed with:
 * - Vertical axis: TIME (older/newer moments)
 * - Horizontal axis: CATEGORIES (countries, vibes, genres)
 * - No algorithm - organized by PLACE and TIME
 *
 * Data flows from Supabase voyo_moments table.
 * Categories are FIXED presets, not algorithm-generated.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Moment } from '../services/momentsService';

// ============================================
// TYPES
// ============================================

export type CategoryAxis = 'countries' | 'vibes' | 'genres';

export interface MomentPosition {
  categoryIndex: number;
  timeIndex: number;
}

export interface UseMomentsReturn {
  currentMoment: Moment | null;
  position: MomentPosition;
  categoryAxis: CategoryAxis;
  categories: string[];
  currentCategory: string;
  displayName: (key: string) => string;
  goUp: () => void;
  goDown: () => void;
  goLeft: () => void;
  goRight: () => void;
  setCategoryAxis: (axis: CategoryAxis) => void;
  moments: Map<string, Moment[]>;
  loading: boolean;
  totalInCategory: number;
  recordPlay: (momentId: string) => void;
  recordOye: (momentId: string) => void;
}

// ============================================
// FIXED CATEGORY PRESETS
// ============================================

const CATEGORY_PRESETS: Record<CategoryAxis, string[]> = {
  countries: [
    'nigeria', 'ghana', 'kenya', 'south africa', 'senegal',
    'algeria', 'uk', 'usa', 'france', 'diaspora',
  ],
  vibes: [
    'dance', 'comedy', 'live', 'fashion', 'original', 'cover', 'reaction',
  ],
  genres: [
    '#music', '#afrobeats', '#amapiano', '#afrodance',
    '#afrodaily', '#dance', '#dj', '#trending',
  ],
};

// Display names for UI (map internal keys to pretty labels)
const DISPLAY_NAMES: Record<string, string> = {
  'nigeria': 'Nigeria', 'ghana': 'Ghana', 'kenya': 'Kenya',
  'south africa': 'South Africa', 'senegal': 'Senegal', 'algeria': 'Algeria',
  'uk': 'UK', 'usa': 'USA', 'france': 'France', 'diaspora': 'Diaspora',
  'dance': 'Dance', 'comedy': 'Comedy', 'live': 'Live', 'fashion': 'Fashion',
  'original': 'Original', 'cover': 'Cover', 'reaction': 'Reaction',
  '#music': 'Music', '#afrobeats': 'Afrobeats', '#amapiano': 'Amapiano',
  '#afrodance': 'Afro Dance', '#afrodaily': 'Afro Daily', '#dance': 'Dance',
  '#dj': 'DJ', '#trending': 'Trending',
};

const MOMENTS_PER_PAGE = 20;

// ============================================
// HOOK
// ============================================

export function useMoments(): UseMomentsReturn {
  const [categoryAxis, setCategoryAxisState] = useState<CategoryAxis>('countries');
  const [position, setPosition] = useState<MomentPosition>({ categoryIndex: 0, timeIndex: 0 });
  const [moments, setMoments] = useState<Map<string, Moment[]>>(new Map());
  const [loading, setLoading] = useState(false);

  // Track which categories have been fetched to avoid re-fetching
  const fetchedRef = useRef<Set<string>>(new Set());
  // Track ongoing fetches to avoid duplicates
  const fetchingRef = useRef<Set<string>>(new Set());

  const categories = useMemo(() => CATEGORY_PRESETS[categoryAxis], [categoryAxis]);
  const currentCategory = categories[position.categoryIndex] || categories[0];

  // Build a cache key combining axis + category for fetch dedup
  const cacheKey = useCallback(
    (axis: CategoryAxis, cat: string) => `${axis}::${cat}`,
    []
  );

  // ============================================
  // DATA FETCHING
  // ============================================

  const fetchMomentsForCategory = useCallback(
    async (axis: CategoryAxis, category: string, offset = 0) => {
      if (!supabase || !isSupabaseConfigured) return;

      const key = cacheKey(axis, category);

      // Skip if already fetching this exact key
      if (fetchingRef.current.has(key) && offset === 0) return;
      // Skip if already fetched initial page (offset 0)
      if (fetchedRef.current.has(key) && offset === 0) return;

      fetchingRef.current.add(key);
      if (offset === 0) setLoading(true);

      try {
        let query = supabase
          .from('voyo_moments')
          .select('*')
          .eq('is_active', true)
          .order('discovered_at', { ascending: false })
          .range(offset, offset + MOMENTS_PER_PAGE - 1);

        // Apply filter based on which axis we are on
        if (axis === 'countries') {
          query = query.contains('cultural_tags', [category]);
        } else if (axis === 'vibes') {
          // Vibes filter by content_type column (dance, comedy, live, etc.)
          query = query.eq('content_type', category);
        } else {
          // Genres filter by vibe_tags array (hashtags like #afrobeats)
          query = query.contains('vibe_tags', [category]);
        }

        const { data, error } = await query;

        if (error) {
          console.error(`[useMoments] Fetch error for ${category}:`, error.message);
          return;
        }

        const fetched = (data || []) as Moment[];

        setMoments(prev => {
          const next = new Map(prev);
          const existing = next.get(key) || [];
          if (offset === 0) {
            next.set(key, fetched);
          } else {
            // Append, dedup by id
            const ids = new Set(existing.map(m => m.id));
            const newItems = fetched.filter(m => !ids.has(m.id));
            next.set(key, [...existing, ...newItems]);
          }
          return next;
        });

        fetchedRef.current.add(key);
      } catch (err) {
        console.error('[useMoments] Fetch exception:', err);
      } finally {
        fetchingRef.current.delete(key);
        if (offset === 0) setLoading(false);
      }
    },
    [cacheKey]
  );

  // Fetch current category on mount and when axis/category changes
  useEffect(() => {
    fetchMomentsForCategory(categoryAxis, currentCategory);
  }, [categoryAxis, currentCategory, fetchMomentsForCategory]);

  // Pre-fetch adjacent categories for smoother swiping
  useEffect(() => {
    const prevIdx = (position.categoryIndex - 1 + categories.length) % categories.length;
    const nextIdx = (position.categoryIndex + 1) % categories.length;

    const prevCat = categories[prevIdx];
    const nextCat = categories[nextIdx];

    // Slight delay to prioritize current category
    const timer = setTimeout(() => {
      fetchMomentsForCategory(categoryAxis, prevCat);
      fetchMomentsForCategory(categoryAxis, nextCat);
    }, 300);

    return () => clearTimeout(timer);
  }, [categoryAxis, position.categoryIndex, categories, fetchMomentsForCategory]);

  // ============================================
  // CURRENT STATE
  // ============================================

  const currentKey = cacheKey(categoryAxis, currentCategory);
  const currentMoments = moments.get(currentKey) || [];
  const currentMoment = currentMoments[position.timeIndex] || null;
  const totalInCategory = currentMoments.length;

  // ============================================
  // NAVIGATION
  // ============================================

  const goUp = useCallback(() => {
    setPosition(prev => {
      const key = cacheKey(categoryAxis, CATEGORY_PRESETS[categoryAxis][prev.categoryIndex] || '');
      const categoryMoments = moments.get(key) || [];
      const newTimeIndex = Math.min(prev.timeIndex + 1, categoryMoments.length - 1);

      // If we are near the end, fetch more
      if (newTimeIndex >= categoryMoments.length - 3) {
        const cat = CATEGORY_PRESETS[categoryAxis][prev.categoryIndex];
        if (cat) {
          fetchMomentsForCategory(categoryAxis, cat, categoryMoments.length);
        }
      }

      return { ...prev, timeIndex: Math.max(newTimeIndex, 0) };
    });
  }, [categoryAxis, moments, cacheKey, fetchMomentsForCategory]);

  const goDown = useCallback(() => {
    setPosition(prev => ({
      ...prev,
      timeIndex: Math.max(prev.timeIndex - 1, 0),
    }));
  }, []);

  const goLeft = useCallback(() => {
    setPosition(prev => ({
      categoryIndex: (prev.categoryIndex - 1 + categories.length) % categories.length,
      timeIndex: 0,
    }));
  }, [categories.length]);

  const goRight = useCallback(() => {
    setPosition(prev => ({
      categoryIndex: (prev.categoryIndex + 1) % categories.length,
      timeIndex: 0,
    }));
  }, [categories.length]);

  const setCategoryAxis = useCallback((axis: CategoryAxis) => {
    setCategoryAxisState(axis);
    setPosition({ categoryIndex: 0, timeIndex: 0 });
  }, []);

  // ============================================
  // ENGAGEMENT
  // ============================================

  const recordPlay = useCallback(async (momentId: string) => {
    if (!supabase || !isSupabaseConfigured) return;
    try {
      await supabase.rpc('record_moment_play', {
        p_moment_id: momentId,
        p_tapped_full_song: false,
      });
    } catch {
      // Silent fail - engagement tracking is best-effort
    }
  }, []);

  const recordOye = useCallback(async (momentId: string) => {
    if (!supabase || !isSupabaseConfigured) return;
    try {
      // Increment voyo_reactions
      const { data: current } = await supabase
        .from('voyo_moments')
        .select('voyo_reactions')
        .eq('id', momentId)
        .single();

      if (current) {
        await supabase
          .from('voyo_moments')
          .update({ voyo_reactions: (current.voyo_reactions || 0) + 1 })
          .eq('id', momentId);
      }
    } catch {
      // Silent fail
    }
  }, []);

  const displayName = useCallback((key: string) => DISPLAY_NAMES[key] || key, []);

  return {
    currentMoment,
    position,
    categoryAxis,
    categories,
    currentCategory,
    displayName,
    goUp,
    goDown,
    goLeft,
    goRight,
    setCategoryAxis,
    moments,
    loading,
    totalInCategory,
    recordPlay,
    recordOye,
  };
}

export default useMoments;
