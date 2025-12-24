/**
 * VOYO Music - SmartImage Component
 * Bulletproof image loading with fallback chains, skeleton loading, and caching
 * NEVER shows broken images
 */

import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getThumbnailFallbackChain,
  generatePlaceholder,
  preloadImage,
} from '../../utils/imageUtils';
import { getCachedThumbnail, cacheThumbnail } from '../../hooks/useThumbnailCache';
import { verifyTrack } from '../../services/trackVerifier';

export interface SmartImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackSrc?: string;
  placeholderColor?: string;
  trackId?: string; // For YouTube thumbnail fallback chain
  lazy?: boolean; // Enable lazy loading
  onLoad?: () => void;
  onError?: () => void;
  // Self-healing: If thumbnail fails and we have artist+title, verify and fix
  artist?: string;
  title?: string;
}

type LoadState = 'loading' | 'loaded' | 'error';

const SmartImageInner: React.FC<SmartImageProps> = ({
  src,
  alt,
  className = '',
  fallbackSrc,
  placeholderColor = '#1a1a1a',
  trackId,
  lazy = true,
  onLoad,
  onError,
  artist,
  title,
}) => {
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [currentSrc, setCurrentSrc] = useState<string>('');
  const [isInView, setIsInView] = useState(!lazy);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Track previous src to avoid unnecessary reloads
  const prevSrcRef = useRef<string>('');
  const hasLoadedRef = useRef<boolean>(false);

  // Stable callback refs to avoid re-triggering effect
  const onLoadRef = useRef(onLoad);
  const onErrorRef = useRef(onError);
  onLoadRef.current = onLoad;
  onErrorRef.current = onError;

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!lazy || isInView) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
          }
        });
      },
      {
        rootMargin: '50px', // Start loading 50px before entering viewport
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [lazy, isInView]);

  // Load image with fallback chain
  // CRITICAL: Only reload if src actually changes, not on every parent re-render
  useEffect(() => {
    if (!isInView) return;

    // Skip if we've already loaded this exact src
    const srcKey = `${src}|${trackId}|${fallbackSrc}`;
    if (hasLoadedRef.current && prevSrcRef.current === srcKey) {
      return;
    }

    let cancelled = false;

    const loadImage = async () => {
      // Only show loading state if we don't have an image yet
      if (!currentSrc) {
        setLoadState('loading');
      }

      // Step 1: Check cache if trackId provided
      if (trackId) {
        const cachedUrl = getCachedThumbnail(trackId);
        if (cachedUrl) {
          const success = await preloadImage(cachedUrl);
          if (success && !cancelled) {
            setCurrentSrc(cachedUrl);
            setLoadState('loaded');
            hasLoadedRef.current = true;
            prevSrcRef.current = srcKey;
            onLoadRef.current?.();
            return;
          }
        }
      }

      // Step 2: Try primary src
      if (src) {
        const success = await preloadImage(src);
        if (success && !cancelled) {
          setCurrentSrc(src);
          setLoadState('loaded');
          hasLoadedRef.current = true;
          prevSrcRef.current = srcKey;
          if (trackId) cacheThumbnail(trackId, src);
          onLoadRef.current?.();
          return;
        }
      }

      // Step 3: Try fallback chain if trackId provided
      if (trackId) {
        const fallbackChain = getThumbnailFallbackChain(trackId);
        for (const fallbackUrl of fallbackChain) {
          const success = await preloadImage(fallbackUrl);
          if (success && !cancelled) {
            setCurrentSrc(fallbackUrl);
            setLoadState('loaded');
            hasLoadedRef.current = true;
            prevSrcRef.current = srcKey;
            cacheThumbnail(trackId, fallbackUrl);
            onLoadRef.current?.();
            return;
          }
        }
      }

      // Step 4: Try explicit fallbackSrc
      if (fallbackSrc) {
        const success = await preloadImage(fallbackSrc);
        if (success && !cancelled) {
          setCurrentSrc(fallbackSrc);
          setLoadState('loaded');
          hasLoadedRef.current = true;
          prevSrcRef.current = srcKey;
          onLoadRef.current?.();
          return;
        }
      }

      // Step 5: Self-healing verification OR placeholder as last resort
      if (!cancelled) {
        // SELF-HEALING: If we have artist+title, try verification FIRST
        // Keep showing loading skeleton while we verify - NO PLACEHOLDER SHOWN
        if (artist && title && trackId) {
          console.log(`[SmartImage] 🔧 Self-healing: ${artist} - ${title}`);
          // Stay in loading state while we verify
          setLoadState('loading');

          verifyTrack(trackId, artist, title).then(async (newThumbnail) => {
            if (cancelled) return;

            if (newThumbnail) {
              // Verification succeeded! Use the real thumbnail
              console.log(`[SmartImage] ✅ Self-heal succeeded: ${artist} - ${title}`);
              const success = await preloadImage(newThumbnail);
              if (success && !cancelled) {
                setCurrentSrc(newThumbnail);
                setLoadState('loaded');
                hasLoadedRef.current = true;
                prevSrcRef.current = srcKey;
                if (trackId) cacheThumbnail(trackId, newThumbnail);
                onLoadRef.current?.();
                return;
              }
            }

            // Verification failed - NOW show placeholder as last resort
            console.warn(`[SmartImage] ⚠️ Self-heal failed: ${artist} - ${title}`);
            const placeholderSrc = generatePlaceholder(alt || 'Track', 400);
            setCurrentSrc(placeholderSrc);
            setLoadState('loaded');
            hasLoadedRef.current = true;
            prevSrcRef.current = srcKey;
            onErrorRef.current?.();
          }).catch(() => {
            if (cancelled) return;
            // Error during verification - show placeholder
            const placeholderSrc = generatePlaceholder(alt || 'Track', 400);
            setCurrentSrc(placeholderSrc);
            setLoadState('loaded');
            hasLoadedRef.current = true;
            prevSrcRef.current = srcKey;
            onErrorRef.current?.();
          });
        } else {
          // No artist+title - can't self-heal, show placeholder immediately
          const placeholderSrc = generatePlaceholder(alt || 'Track', 400);
          setCurrentSrc(placeholderSrc);
          setLoadState('loaded');
          hasLoadedRef.current = true;
          prevSrcRef.current = srcKey;
          onErrorRef.current?.();
        }
      }
    };

    loadImage();

    return () => {
      cancelled = true;
    };
  }, [src, fallbackSrc, trackId, alt, isInView, currentSrc, artist, title]);

  return (
    <div ref={containerRef} className={`relative overflow-hidden ${className}`}>
      {/* Skeleton Loading State */}
      <AnimatePresence>
        {loadState === 'loading' && (
          <motion.div
            className="absolute inset-0 z-10"
            style={{ backgroundColor: placeholderColor }}
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Animated skeleton gradient */}
            <motion.div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(
                  90deg,
                  transparent 0%,
                  rgba(255, 255, 255, 0.05) 50%,
                  transparent 100%
                )`,
              }}
              animate={{
                x: ['-100%', '100%'],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: 'linear',
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actual Image */}
      {currentSrc && (
        <motion.img
          ref={imgRef}
          src={currentSrc}
          alt={alt}
          className={`w-full h-full object-cover ${className}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: loadState === 'loaded' ? 1 : 0 }}
          transition={{ duration: 0.3 }}
          loading={lazy ? 'lazy' : 'eager'}
          draggable={false}
        />
      )}
    </div>
  );
};

// Memoize to prevent re-renders when parent re-renders with same props
export const SmartImage = memo(SmartImageInner);

export default SmartImage;
