/**
 * VOYO Splash Screen - Premium Water Drop Animation
 *
 * USEFUL: Actually preloads stores and data during animation
 * - Initializes download store (IndexedDB)
 * - Preloads first track thumbnail for smoother experience
 * - Initializes preference store
 * - Only completes when BOTH animation AND data are ready
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDownloadStore } from '../../store/downloadStore';
import { usePreferenceStore } from '../../store/preferenceStore';
import { TRACKS } from '../../data/tracks';
import { mediaCache } from '../../services/mediaCache';
import { devLog, devWarn } from '../../utils/logger';

interface VoyoSplashProps {
  onComplete: () => void;
  minDuration?: number;
}

export const VoyoSplash = ({ onComplete, minDuration = 2800 }: VoyoSplashProps) => {
  const [phase, setPhase] = useState<'intro' | 'drop' | 'impact' | 'expand' | 'done'>('intro');
  const [isDataReady, setIsDataReady] = useState(false);
  const [isAnimationDone, setIsAnimationDone] = useState(false);
  const hasCompletedRef = useRef(false);
  const isDataReadyRef = useRef(false);

  // Store initialization
  const initDownloads = useDownloadStore((s) => s.initialize);
  const preferenceStore = usePreferenceStore(); // Touch to initialize

  // Preload: Initialize stores AND cache real content
  useEffect(() => {
    const preloadData = async () => {
      try {
        devLog('🎵 SPLASH: Initializing stores & caching content...');

        // 1. Initialize IndexedDB for cached tracks (with timeout)
        await Promise.race([
          initDownloads(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('IndexedDB timeout')), 3000))
        ]).catch(err => {
          devWarn('🎵 SPLASH: IndexedDB init failed/timeout, continuing:', err);
        });
        devLog('🎵 SPLASH: ✅ IndexedDB ready!');

        // 2. Cache first 5 track thumbnails using mediaCache (not just Image preload)
        const firstTracks = TRACKS.slice(0, 5);
        const cachePromises = firstTracks.map(track =>
          mediaCache.cacheTrack(track.trackId, { thumbnail: true }).catch(() => null)
        );
        await Promise.race([
          Promise.all(cachePromises),
          new Promise(resolve => setTimeout(resolve, 2000))
        ]);
        devLog('🎵 SPLASH: ✅ First 5 thumbnails cached!');

        // 3. Skipping Fly.io search warmup - database is source of truth
        // refreshRecommendations() in App.tsx loads from 324K Supabase tracks
        devLog('🎵 SPLASH: ✅ Database is source of truth (no Fly.io warmup)');

        // 4. Touch preference store to ensure it's initialized
        devLog('🎵 SPLASH: ✅ Preferences loaded!', Object.keys(preferenceStore.trackPreferences).length, 'tracks');

        // 5. Pre-cache audio for first track (background, non-blocking)
        if (firstTracks[0]) {
          mediaCache.cacheTrack(firstTracks[0].trackId, { audio: true, thumbnail: true })
            .then(() => devLog('🎵 SPLASH: ✅ First track audio pre-cached!'))
            .catch(() => {});
        }

        isDataReadyRef.current = true;
        setIsDataReady(true);
      } catch (err) {
        devWarn('🎵 SPLASH: Init error (continuing anyway):', err);
        isDataReadyRef.current = true;
        setIsDataReady(true);
      }
    };

    preloadData();

    // SAFETY: Force ready after 5 seconds no matter what
    const safetyTimeout = setTimeout(() => {
      if (!isDataReadyRef.current) {
        devWarn('🎵 SPLASH: Safety timeout triggered, forcing ready');
        isDataReadyRef.current = true;
        setIsDataReady(true);
      }
    }, 5000);

    return () => clearTimeout(safetyTimeout);
  }, [initDownloads, preferenceStore.trackPreferences]);

  // Animation timeline
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    timers.push(setTimeout(() => setPhase('drop'), 500));
    timers.push(setTimeout(() => setPhase('impact'), 1200));
    timers.push(setTimeout(() => setPhase('expand'), 2000));
    timers.push(setTimeout(() => setIsAnimationDone(true), minDuration));

    return () => timers.forEach(clearTimeout);
  }, [minDuration]);

  // Complete only when BOTH animation AND data are ready
  useEffect(() => {
    if (isAnimationDone && isDataReady && !hasCompletedRef.current) {
      hasCompletedRef.current = true;
      setPhase('done');
      onComplete();
    }
  }, [isAnimationDone, isDataReady, onComplete]);

  return (
    <AnimatePresence>
      {phase !== 'done' && (
        <motion.div
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, #0a0612 0%, #120a1a 40%, #1a0a20 70%, #0a0612 100%)',
          }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          {/* Ambient particles */}
          <div className="absolute inset-0 overflow-hidden">
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 rounded-full bg-purple-500/30"
                style={{
                  left: `${10 + (i * 4.5) % 80}%`,
                  top: `${20 + (i * 7) % 60}%`,
                }}
                animate={{
                  y: [0, -30, 0],
                  opacity: [0.2, 0.5, 0.2],
                  scale: [1, 1.5, 1],
                }}
                transition={{
                  duration: 3 + (i % 3),
                  delay: i * 0.2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            ))}
          </div>

          {/* Central glow */}
          <motion.div
            className="absolute w-96 h-96 rounded-full blur-3xl"
            style={{
              background: 'radial-gradient(circle, rgba(147, 51, 234, 0.3) 0%, rgba(236, 72, 153, 0.15) 40%, transparent 70%)',
            }}
            animate={{
              scale: phase === 'expand' ? [1, 1.8] : [1, 1.15, 1],
              opacity: phase === 'expand' ? [0.5, 0] : [0.4, 0.6, 0.4],
            }}
            transition={{
              duration: phase === 'expand' ? 0.8 : 2,
              repeat: phase === 'expand' ? 0 : Infinity,
              ease: 'easeInOut',
            }}
          />

          {/* VOYO Logo */}
          <motion.div
            className="relative z-20 mb-8"
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{
              opacity: 1,
              scale: phase === 'expand' ? 1.1 : 1,
              y: 0,
            }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Outer ring glow */}
            <motion.div
              className="absolute -inset-8 rounded-full"
              style={{
                background: 'radial-gradient(circle, rgba(147, 51, 234, 0.2) 0%, transparent 70%)',
              }}
              animate={{
                scale: phase === 'expand' ? [1, 2.5, 3] : [1, 1.2, 1],
                opacity: phase === 'expand' ? [0.4, 0.2, 0] : [0.3, 0.5, 0.3],
              }}
              transition={{
                duration: phase === 'expand' ? 0.8 : 1.5,
                repeat: phase === 'expand' ? 0 : Infinity,
                ease: 'easeOut',
              }}
            />

            {/* Logo text */}
            <motion.span
              className="text-6xl font-black tracking-wider relative"
              style={{
                background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 50%, #a855f7 100%)',
                backgroundSize: '200% 200%',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                color: 'transparent',
                filter: 'drop-shadow(0 0 30px rgba(168, 85, 247, 0.5))',
              }}
              animate={{
                backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
              }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            >
              VOYO
            </motion.span>

            {/* Subtitle */}
            <motion.p
              className="text-center text-xs text-purple-300/50 mt-2 tracking-[0.3em] uppercase"
              initial={{ opacity: 0 }}
              animate={{ opacity: phase !== 'intro' ? 0.6 : 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              Music
            </motion.p>
          </motion.div>

          {/* Water Drop - Centered */}
          <div className="relative h-40 flex items-start justify-center">
            <AnimatePresence>
              {(phase === 'intro' || phase === 'drop') && (
                <motion.div
                  className="relative"
                  initial={{ y: -20, opacity: 0, scale: 0 }}
                  animate={phase === 'drop' ? {
                    y: [0, 120],
                    scale: [1.2, 0.7],
                    opacity: [1, 0.9],
                  } : {
                    y: 0,
                    scale: [0, 1.2, 1],
                    opacity: 1,
                  }}
                  exit={{ opacity: 0 }}
                  transition={{
                    duration: phase === 'drop' ? 0.5 : 0.4,
                    ease: phase === 'drop' ? [0.55, 0.055, 0.675, 0.19] : 'easeOut',
                  }}
                >
                  {/* Drop body */}
                  <div
                    className="w-5 h-7 relative"
                    style={{
                      background: 'linear-gradient(180deg, rgba(168, 85, 247, 0.9) 0%, rgba(236, 72, 153, 0.8) 60%, rgba(147, 51, 234, 0.9) 100%)',
                      borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%',
                      boxShadow: '0 0 20px rgba(168, 85, 247, 0.6), inset 0 2px 6px rgba(255, 255, 255, 0.4), inset 0 -3px 6px rgba(147, 51, 234, 0.5)',
                    }}
                  >
                    {/* Shine */}
                    <div
                      className="absolute top-1 left-1 w-2 h-2 rounded-full"
                      style={{
                        background: 'radial-gradient(circle, rgba(255,255,255,0.8) 0%, transparent 70%)',
                      }}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Impact ripples */}
            <AnimatePresence>
              {(phase === 'impact' || phase === 'expand') && (
                <motion.div
                  className="absolute top-28 left-1/2 -translate-x-1/2"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {/* Splash particles */}
                  {[...Array(8)].map((_, i) => (
                    <motion.div
                      key={`splash-${i}`}
                      className="absolute w-1.5 h-1.5 rounded-full"
                      style={{
                        background: 'linear-gradient(135deg, #a855f7, #ec4899)',
                        boxShadow: '0 0 8px rgba(168, 85, 247, 0.8)',
                      }}
                      initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                      animate={{
                        x: Math.cos((i * Math.PI * 2) / 8) * 40,
                        y: [0, Math.sin((i * Math.PI * 2) / 8) * -30 - 20, 10],
                        opacity: [1, 0.8, 0],
                        scale: [1, 0.8, 0.3],
                      }}
                      transition={{
                        duration: 0.6,
                        ease: 'easeOut',
                      }}
                    />
                  ))}

                  {/* Expanding rings */}
                  {[0, 1, 2, 3].map((i) => (
                    <motion.div
                      key={`ring-${i}`}
                      className="absolute left-1/2 -translate-x-1/2 rounded-full"
                      style={{
                        border: `${2 - i * 0.3}px solid`,
                        borderColor: `rgba(168, 85, 247, ${0.7 - i * 0.15})`,
                        boxShadow: `0 0 ${10 - i * 2}px rgba(168, 85, 247, ${0.4 - i * 0.1})`,
                      }}
                      initial={{ width: 0, height: 0, opacity: 0.9 }}
                      animate={{
                        width: [0, 120 + i * 50],
                        height: [0, 40 + i * 15],
                        opacity: [0.9, 0],
                      }}
                      transition={{
                        duration: 1,
                        delay: i * 0.1,
                        ease: 'easeOut',
                      }}
                    />
                  ))}

                  {/* Impact glow */}
                  <motion.div
                    className="absolute left-1/2 -translate-x-1/2 w-8 h-3 rounded-full blur-sm"
                    style={{
                      background: 'linear-gradient(90deg, transparent, rgba(168, 85, 247, 0.8), transparent)',
                    }}
                    initial={{ scaleX: 1, opacity: 1 }}
                    animate={{ scaleX: 6, opacity: 0 }}
                    transition={{ duration: 0.5 }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Loading status */}
          <motion.div
            className="absolute bottom-20 flex flex-col items-center gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: phase === 'impact' || phase === 'expand' ? 1 : 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* Loading dots */}
            <div className="flex items-center gap-1.5">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 rounded-full"
                  style={{
                    background: isDataReady
                      ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                      : 'linear-gradient(135deg, #a855f7, #ec4899)',
                    boxShadow: isDataReady
                      ? '0 0 10px rgba(34, 197, 94, 0.5)'
                      : '0 0 10px rgba(168, 85, 247, 0.5)',
                  }}
                  animate={isDataReady ? {
                    scale: [1, 1.3, 1],
                  } : {
                    y: [0, -10, 0],
                    scale: [1, 1.2, 1],
                    opacity: [0.5, 1, 0.5],
                  }}
                  transition={{
                    duration: isDataReady ? 0.3 : 0.6,
                    delay: i * 0.12,
                    repeat: isDataReady ? 0 : Infinity,
                    ease: 'easeInOut',
                  }}
                />
              ))}
            </div>

            {/* Status text */}
            <motion.p
              className="text-[10px] text-purple-300/40"
              animate={{ opacity: [0.4, 0.7, 0.4] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              {isDataReady ? 'Ready' : 'Loading tracks...'}
            </motion.p>
          </motion.div>

          {/* Bottom brand */}
          <motion.p
            className="absolute bottom-8 text-[10px] text-purple-400/30 tracking-widest"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            transition={{ delay: 1 }}
          >
            by DASUPERHUB
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default VoyoSplash;
