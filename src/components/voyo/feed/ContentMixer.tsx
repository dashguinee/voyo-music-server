/**
 * ContentMixer - Dynamic Content Type Selection
 *
 * Determines what visual content to show for each track in the feed:
 * 1. YouTube Video - If track has video ID, show muted video snippet
 * 2. TikTok Embed - If matched with trending TikTok (future)
 * 3. Animated Art - Default fallback with album art effects
 *
 * This creates variety in the feed like a real social platform.
 */

import { useMemo, useState, useEffect } from 'react';
import { VideoSnippet } from './VideoSnippet';
import { AnimatedArtCard, extractDominantColor, type ArtDisplayMode } from './AnimatedArtCard';
import { DynamicVignette } from './DynamicVignette';
// import { TikTokEmbed } from './TikTokEmbed'; // Enable when matching system is ready

// Content type enum
export type ContentType = 'video' | 'tiktok' | 'animated_art' | 'gif';

// Teaser strategy for video treatment
type TeaserStrategy = 'entrance' | 'hotspot' | 'pre-hook' | 'middle';

interface ContentMixerProps {
  trackId: string;
  trackTitle: string;
  trackArtist: string;
  thumbnail?: string;
  isActive: boolean;
  isPlaying: boolean;
  isThisTrack: boolean;
  shouldPreload?: boolean; // Preload for upcoming cards
  teaserStrategy?: TeaserStrategy; // Video treatment based on teaser strategy
  // Optional overrides
  forceContentType?: ContentType;
  tiktokId?: string;
  gifUrl?: string;
  bpm?: number;
}

// Determine content type based on track data
const determineContentType = (
  trackId: string,
  hasVideo: boolean,
  hasTiktok: boolean,
  hasGif: boolean,
): ContentType => {
  // MIX IT UP: Some tracks show as floating art for variety
  if (shouldShowAsStaticArt(trackId)) {
    return 'animated_art'; // Floating oval or disc
  }

  // Priority: Video > TikTok > GIF > Animated Art
  if (hasVideo) return 'video';
  if (hasTiktok) return 'tiktok';
  if (hasGif) return 'gif';
  return 'animated_art';
};

// Check if track ID is a YouTube video ID
const isYouTubeId = (id: string): boolean => {
  // YouTube IDs are 11 chars, or VOYO IDs start with vyo_
  if (id.startsWith('vyo_')) return true;
  if (id.length === 11 && /^[a-zA-Z0-9_-]+$/.test(id)) return true;
  return false;
};

// Videos go FULL SCREEN, only non-video tracks get floating art treatment
// This creates the mix: full screen videos + floating boards for audio-only
const shouldShowAsStaticArt = (trackId: string): boolean => {
  // Only tracks WITHOUT video get the floating art treatment
  // Videos always go full screen
  return false; // Let video detection handle it - videos = full, no video = floating art
};

export const ContentMixer = ({
  trackId,
  trackTitle,
  trackArtist,
  thumbnail,
  isActive,
  isPlaying,
  isThisTrack,
  shouldPreload = false,
  teaserStrategy = 'hotspot',
  forceContentType,
  tiktokId,
  gifUrl,
  bpm,
}: ContentMixerProps) => {
  const [dominantColor, setDominantColor] = useState<string>('#a855f7');

  // Determine content type
  const contentType = useMemo(() => {
    if (forceContentType) return forceContentType;
    return determineContentType(
      trackId,
      isYouTubeId(trackId),
      !!tiktokId,
      !!gifUrl
    );
  }, [trackId, forceContentType, tiktokId, gifUrl]);

  // For static content, randomly pick oval or disc based on track ID (consistent per track)
  const artDisplayMode: ArtDisplayMode = useMemo(() => {
    // Use trackId hash to consistently pick same mode for same track
    const hash = trackId.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    return hash % 2 === 0 ? 'oval' : 'disc';
  }, [trackId]);

  // Extract dominant color for vignette tinting
  useEffect(() => {
    if (thumbnail) {
      extractDominantColor(thumbnail).then(setDominantColor);
    }
  }, [thumbnail]);

  // Render based on content type - all wrapped with DynamicVignette
  switch (contentType) {
    case 'video':
      return (
        <div className="absolute inset-0">
          <VideoSnippet
            trackId={trackId}
            isActive={isActive}
            isPlaying={isPlaying}
            isThisTrack={isThisTrack}
            shouldPreload={shouldPreload}
            fallbackThumbnail={thumbnail}
            teaserStrategy={teaserStrategy}
          />
          <DynamicVignette
            isActive={isActive}
            isPlaying={isPlaying}
            bpm={bpm}
            color={dominantColor}
          />
        </div>
      );

    case 'tiktok':
      // TODO: Enable when TikTok matching system is ready
      // return (
      //   <TikTokEmbed
      //     videoId={tiktokId!}
      //     isActive={isActive}
      //     isPlaying={isPlaying}
      //     fallbackThumbnail={thumbnail}
      //   />
      // );
      // For now, fall through to animated art
      return (
        <AnimatedArtCard
          trackId={trackId}
          thumbnail={thumbnail || ''}
          isActive={isActive}
          isPlaying={isPlaying}
          bpm={bpm}
          dominantColor={dominantColor}
          displayMode={artDisplayMode}
        />
      );

    case 'gif':
      // GIF content - loop the gif with audio
      return (
        <div className="absolute inset-0 overflow-hidden bg-black">
          <img
            src={gifUrl}
            alt={trackTitle}
            className="w-full h-full object-cover"
            style={{
              filter: isPlaying ? 'none' : 'grayscale(50%)',
            }}
          />
          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-black/20" />
        </div>
      );

    case 'animated_art':
    default:
      return (
        <AnimatedArtCard
          trackId={trackId}
          thumbnail={thumbnail || ''}
          isActive={isActive}
          isPlaying={isPlaying}
          bpm={bpm}
          dominantColor={dominantColor}
          displayMode={artDisplayMode} // Oval or Disc, floating in darkness
        />
      );
  }
};

// ============================================
// CONTENT STATS TRACKING
// ============================================

// Track which content types perform best
export interface ContentStats {
  type: ContentType;
  views: number;
  avgWatchTime: number; // seconds
  oyeCount: number;
  shareCount: number;
  engagementRate: number; // 0-1
}

// This would connect to analytics in production
export const trackContentEngagement = (
  trackId: string,
  contentType: ContentType,
  event: 'view' | 'oye' | 'share' | 'complete',
  watchTime?: number
) => {
  console.log(`[ContentMixer] ${event} on ${contentType} for ${trackId}`, watchTime ? `(${watchTime}s)` : '');
  // In production, send to analytics
};

export default ContentMixer;
