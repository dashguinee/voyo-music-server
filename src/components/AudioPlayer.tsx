/**
 * VOYO Music - Hybrid Audio Player with BOOST System + AFRICAN BASS
 *
 * SIMPLE FLOW:
 * 1. Check IndexedDB cache → If BOOSTED, play from local blob (instant, offline)
 * 2. If NOT boosted → IFrame plays instantly (YouTube handles streaming)
 * 3. User clicks "⚡ Boost HD" → Downloads to IndexedDB for next time
 *
 * AUDIO ENHANCEMENT (v2 - with LIMITER for speaker protection):
 * - Two profiles: Standard (safe killer) and Extreme (full power)
 * - DynamicsCompressor prevents clipping and speaker damage
 * - African bass character preserved in both modes
 *
 * PROFILES:
 * - Standard: +5dB bass, +2dB presence, 1.15x gain, gentle compression
 * - Extreme: +8dB bass, +3dB presence, 1.3x gain, brick wall limiter
 *
 * NO server proxy for playback - only for downloads when user requests Boost
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { Track } from '../types';
import { usePlayerStore } from '../store/playerStore';
import { usePreferenceStore } from '../store/preferenceStore';
import { useDownloadStore } from '../store/downloadStore';
import { useTrackPoolStore } from '../store/trackPoolStore';
import { getYouTubeIdForIframe, prefetchTrack } from '../services/api';
import { audioEngine } from '../services/audioEngine';
import { recordPoolEngagement } from '../services/personalization';
import { recordTrackInSession } from '../services/poolCurator';
import { recordPlay as djRecordPlay } from '../services/intelligentDJ';
import { onTrackPlay as oyoOnTrackPlay, onTrackSkip as oyoOnTrackSkip, onTrackComplete as oyoOnTrackComplete } from '../services/oyoDJ';

type PlaybackMode = 'cached' | 'iframe';
export type BoostPreset = 'boosted' | 'calm' | 'voyex' | 'xtreme';

// Audio boost presets - Client-side processing on cached files
// 🟡 Boosted (Yellow) - Standard warm boost
// 🔵 Calm (Blue) - Relaxed, balanced
// 🟣 VOYEX (Purple) - Full holistic experience
// 🔴 Xtreme (Red) - Maximum bass power
const BOOST_PRESETS = {
  // 🟡 BOOSTED: Standard warm boost (default when cached)
  boosted: {
    gain: 1.15,           // 115% volume
    bassFreq: 80,         // Bass frequency (Hz)
    bassGain: 5,          // +5dB bass - warm
    presenceFreq: 3000,   // Presence frequency (Hz)
    presenceGain: 2,      // +2dB presence
    subBassFreq: 40,
    subBassGain: 2,       // Slight sub-bass
    warmthFreq: 250,
    warmthGain: 1,        // Touch of warmth
    airFreq: 10000,
    airGain: 1,           // Slight air
    harmonicAmount: 0,    // No harmonic exciter
    compressor: {
      threshold: -12,
      knee: 10,
      ratio: 4,
      attack: 0.003,
      release: 0.25,
    }
  },
  // 🔵 CALM: Relaxed, balanced - easy listening
  calm: {
    gain: 1.05,           // 105% - subtle boost
    bassFreq: 80,
    bassGain: 3,          // +3dB bass - gentle
    presenceFreq: 3000,
    presenceGain: 1,      // +1dB presence - soft
    subBassFreq: 50,
    subBassGain: 1,       // Minimal sub-bass
    warmthFreq: 250,
    warmthGain: 2,        // More warmth for smoothness
    airFreq: 8000,
    airGain: 2,           // Softer air frequency
    harmonicAmount: 0,    // No harmonic exciter
    compressor: {
      threshold: -15,     // More headroom
      knee: 15,           // Very soft knee
      ratio: 3,           // Gentle compression
      attack: 0.005,
      release: 0.3,
    }
  },
  // 🟣 VOYEX: Full holistic audio experience - APEX MODE
  voyex: {
    gain: 1.25,           // 125% - balanced power
    bassFreq: 80,         // African bass knock
    bassGain: 7,          // Strong bass
    presenceFreq: 3000,   // Vocal clarity
    presenceGain: 3,      // Good presence
    subBassFreq: 45,      // Sub-bass you can FEEL
    subBassGain: 5,       // Substantial foundation
    warmthFreq: 250,      // Low-mid body
    warmthGain: 2,        // Warmth and fullness
    airFreq: 12000,       // Air/sparkle
    airGain: 3,           // Heavenly top end
    harmonicAmount: 15,   // Psychoacoustic enhancement
    compressor: {
      threshold: -8,
      knee: 6,
      ratio: 8,
      attack: 0.002,
      release: 0.15,
    }
  },
  // 🔴 XTREME: Maximum bass power - FINISH ME mode
  xtreme: {
    gain: 1.35,           // 135% - full power
    bassFreq: 80,
    bassGain: 10,         // +10dB bass - AFRICAN MODE
    presenceFreq: 3000,
    presenceGain: 4,      // +4dB presence - cut through
    subBassFreq: 40,
    subBassGain: 7,       // Heavy sub-bass
    warmthFreq: 250,
    warmthGain: 1,        // Less warmth, more punch
    airFreq: 10000,
    airGain: 2,           // Some sparkle
    harmonicAmount: 20,   // More harmonics for presence
    compressor: {
      threshold: -4,      // Brick wall
      knee: 0,            // Hard knee
      ratio: 20,          // Limiting
      attack: 0.001,      // Fast catch
      release: 0.1,
    }
  }
};


export const AudioPlayer = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const currentVideoId = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const cachedUrlRef = useRef<string | null>(null);

  // Web Audio API for boost & bass enhancement + LIMITER + VOYEX
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const bassFilterRef = useRef<BiquadFilterNode | null>(null);
  const presenceFilterRef = useRef<BiquadFilterNode | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null); // LIMITER - prevents clipping!
  // VOYEX Extended EQ
  const subBassFilterRef = useRef<BiquadFilterNode | null>(null);  // Sub-bass you can FEEL
  const warmthFilterRef = useRef<BiquadFilterNode | null>(null);   // Low-mid body/warmth
  const airFilterRef = useRef<BiquadFilterNode | null>(null);      // High-end sparkle
  const harmonicExciterRef = useRef<WaveShaperNode | null>(null);  // Psychoacoustic enhancement
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const audioEnhancedRef = useRef<boolean>(false);
  const currentProfileRef = useRef<BoostPreset>('boosted'); // Track current preset

  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>('iframe');
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const {
    currentTrack,
    isPlaying,
    volume,
    seekPosition,
    playbackRate,
    boostProfile,
    currentTime: savedCurrentTime,
    playbackSource: storePlaybackSource,
    setCurrentTime,
    setDuration,
    setProgress,
    clearSeekPosition,
    togglePlay,
    nextTrack,
    setBufferHealth,
    setPlaybackSource,
  } = usePlayerStore();

  const {
    startListenSession,
    endListenSession,
  } = usePreferenceStore();

  const {
    initialize: initDownloads,
    checkCache,
    cacheTrack,
    lastBoostCompletion,
  } = useDownloadStore();

  const lastTrackId = useRef<string | null>(null);
  const previousTrackRef = useRef<Track | null>(null); // For DJ transitions
  const hasPrefetchedRef = useRef<boolean>(false); // Track if we've prefetched next track
  const hasAutoCachedRef = useRef<boolean>(false); // Track if we've auto-cached this track
  const isInitialLoadRef = useRef<boolean>(true); // Track first load for resume position
  const hasRecordedPlayRef = useRef<boolean>(false); // Track if we've recorded 'play' engagement
  const trackProgressRef = useRef<number>(0); // Track current progress for skip detection

  // Initialize download system (IndexedDB)
  useEffect(() => {
    initDownloads();
  }, [initDownloads]);

  // === BACKGROUND PLAYBACK FIX #1: Visibility Change Handler ===
  // Keep audio alive when app goes to background
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // App went to background - ensure audio keeps playing
        if (playbackMode === 'cached' && audioRef.current && !audioRef.current.paused) {
          // Force audio context to stay active
          audioRef.current.play().catch(() => {});

          // Resume audio context if suspended (browser policy)
          if (audioContextRef.current?.state === 'suspended') {
            audioContextRef.current.resume();
          }
        }
        // Note: IFrame playback will stop in background due to YouTube policy
        // This is expected behavior - only CDN/cached tracks support background
      } else if (document.visibilityState === 'visible') {
        // App came back to foreground - AUTO-RESUME if we were playing
        if (audioRef.current) {
          // Resume audio context first (may be suspended by browser)
          if (audioContextRef.current?.state === 'suspended') {
            audioContextRef.current.resume();
          }

          // If store says we should be playing but audio is paused, resume
          const { isPlaying: shouldBePlaying } = usePlayerStore.getState();
          if (shouldBePlaying && audioRef.current.paused) {
            console.log('[VOYO] Auto-resuming playback after returning from background');
            audioRef.current.play().catch((err) => {
              console.warn('[VOYO] Auto-resume failed:', err.message);
            });
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [playbackMode]);

  // === BACKGROUND PLAYBACK FIX #2: Wake Lock ===
  // Prevent screen sleep during playback
  useEffect(() => {
    const requestWakeLock = async () => {
      // Only request wake lock if playing
      if (!isPlaying) {
        // Release wake lock if we have one
        if (wakeLockRef.current) {
          try {
            await wakeLockRef.current.release();
            wakeLockRef.current = null;
          } catch (err) {
            // Ignore errors
          }
        }
        return;
      }

      // Request wake lock (only supported in secure contexts)
      if ('wakeLock' in navigator) {
        try {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
          console.log('🔒 [VOYO] Wake lock active - screen won\'t sleep');

          // Re-acquire wake lock if released (e.g., screen lock/unlock)
          wakeLockRef.current.addEventListener('release', () => {
            console.log('🔓 [VOYO] Wake lock released');
          });
        } catch (err) {
          // Wake lock not available (HTTP, old browser, etc.) - not critical
          console.log('[VOYO] Wake lock not available:', err);
        }
      }
    };

    requestWakeLock();

    // Cleanup: Release wake lock when component unmounts or playback stops
    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, [isPlaying]);

  // Load YouTube IFrame API
  useEffect(() => {
    if (typeof window !== 'undefined' && !(window as any).YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScript = document.getElementsByTagName('script')[0];
      firstScript.parentNode?.insertBefore(tag, firstScript);
    }
  }, []);

  // Generate harmonic exciter curve (soft saturation for warmth + psychoacoustic enhancement)
  // Based on research: adds 2nd/3rd harmonics for perceived bass depth
  const makeHarmonicExciterCurve = (amount: number): Float32Array<ArrayBuffer> => {
    const samples = 44100;
    const curve = new Float32Array(samples) as Float32Array<ArrayBuffer>;
    const deg = Math.PI / 180;

    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      // Soft saturation curve - adds subtle harmonics without harsh clipping
      // amount controls intensity (0 = bypass, 100 = heavy saturation)
      curve[i] = ((3 + amount / 100) * x * 20 * deg) / (Math.PI + (amount / 100) * Math.abs(x));
    }
    return curve;
  };

  // Setup audio enhancement with LIMITER + VOYEX FULL SPECTRUM
  const setupAudioEnhancement = useCallback((preset: BoostPreset = 'boosted') => {
    if (!audioRef.current || audioEnhancedRef.current) return;

    try {
      // Create AudioContext (handle Safari)
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      const ctx = new AudioContextClass();
      audioContextRef.current = ctx;

      const settings = BOOST_PRESETS[preset];
      currentProfileRef.current = preset;

      // Create source from audio element
      const source = ctx.createMediaElementSource(audioRef.current);
      sourceNodeRef.current = source;

      // === VOYEX FULL SPECTRUM EQ CHAIN ===

      // 1. SUB-BASS FOUNDATION (lowshelf at 40-45Hz) - The bass you FEEL
      const subBassFilter = ctx.createBiquadFilter();
      subBassFilter.type = 'lowshelf';
      subBassFilter.frequency.value = settings.subBassFreq;
      subBassFilter.gain.value = settings.subBassGain;
      subBassFilterRef.current = subBassFilter;

      // 2. AFRICAN BASS KNOCK (lowshelf at 80Hz) - Characteristic punch
      const bassFilter = ctx.createBiquadFilter();
      bassFilter.type = 'lowshelf';
      bassFilter.frequency.value = settings.bassFreq;
      bassFilter.gain.value = settings.bassGain;
      bassFilterRef.current = bassFilter;

      // 3. LOW-MID WARMTH (peaking at 250Hz) - Body and fullness
      const warmthFilter = ctx.createBiquadFilter();
      warmthFilter.type = 'peaking';
      warmthFilter.frequency.value = settings.warmthFreq;
      warmthFilter.Q.value = 1.5;
      warmthFilter.gain.value = settings.warmthGain;
      warmthFilterRef.current = warmthFilter;

      // 4. HARMONIC EXCITER (WaveShaperNode) - Psychoacoustic enhancement
      // Adds subtle harmonics that enhance perceived bass (missing fundamental effect)
      const harmonicExciter = ctx.createWaveShaper();
      if (settings.harmonicAmount > 0) {
        harmonicExciter.curve = makeHarmonicExciterCurve(settings.harmonicAmount);
        harmonicExciter.oversample = '2x'; // Better quality, reduce aliasing
      }
      harmonicExciterRef.current = harmonicExciter;

      // 5. VOCAL PRESENCE (peaking at 3kHz) - Clarity and intelligibility
      const presenceFilter = ctx.createBiquadFilter();
      presenceFilter.type = 'peaking';
      presenceFilter.frequency.value = settings.presenceFreq;
      presenceFilter.Q.value = 1;
      presenceFilter.gain.value = settings.presenceGain;
      presenceFilterRef.current = presenceFilter;

      // 6. AIR/SPARKLE (highshelf at 10-12kHz) - Open, heavenly top end
      const airFilter = ctx.createBiquadFilter();
      airFilter.type = 'highshelf';
      airFilter.frequency.value = settings.airFreq;
      airFilter.gain.value = settings.airGain;
      airFilterRef.current = airFilter;

      // 7. GAIN NODE - Volume boost
      const gainNode = ctx.createGain();
      gainNode.gain.value = settings.gain;
      gainNodeRef.current = gainNode;

      // 8. COMPRESSOR/LIMITER - PREVENTS SPEAKER DAMAGE!
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = settings.compressor.threshold;
      compressor.knee.value = settings.compressor.knee;
      compressor.ratio.value = settings.compressor.ratio;
      compressor.attack.value = settings.compressor.attack;
      compressor.release.value = settings.compressor.release;
      compressorRef.current = compressor;

      // === CONNECT THE CHAIN ===
      // source -> subBass -> bass -> warmth -> harmonics -> presence -> air -> gain -> compressor -> destination
      source.connect(subBassFilter);
      subBassFilter.connect(bassFilter);
      bassFilter.connect(warmthFilter);
      warmthFilter.connect(harmonicExciter);
      harmonicExciter.connect(presenceFilter);
      presenceFilter.connect(airFilter);
      airFilter.connect(gainNode);
      gainNode.connect(compressor);
      compressor.connect(ctx.destination);

      audioEnhancedRef.current = true;

      // Log preset activation
      const voyexInfo = preset === 'voyex'
        ? `, SubBass +${settings.subBassGain}dB, Warmth +${settings.warmthGain}dB, Air +${settings.airGain}dB, Harmonics ${settings.harmonicAmount}%`
        : '';
      console.log(`🎵 [VOYO] Audio Enhancement Active (${preset.toUpperCase()}): +${Math.round((settings.gain - 1) * 100)}% gain, +${settings.bassGain}dB bass, +${settings.presenceGain}dB presence${voyexInfo}, Limiter ON`);
    } catch (e) {
      console.warn('[VOYO] Audio enhancement not available:', e);
    }
  }, []);

  // Update boost preset dynamically (without recreating the chain)
  const updateBoostPreset = useCallback((preset: BoostPreset) => {
    if (!audioEnhancedRef.current) return;

    const settings = BOOST_PRESETS[preset];
    currentProfileRef.current = preset;

    // Update sub-bass filter (VOYEX)
    if (subBassFilterRef.current) {
      subBassFilterRef.current.frequency.value = settings.subBassFreq;
      subBassFilterRef.current.gain.value = settings.subBassGain;
    }

    // Update bass filter
    if (bassFilterRef.current) {
      bassFilterRef.current.gain.value = settings.bassGain;
    }

    // Update warmth filter (VOYEX)
    if (warmthFilterRef.current) {
      warmthFilterRef.current.frequency.value = settings.warmthFreq;
      warmthFilterRef.current.gain.value = settings.warmthGain;
    }

    // Update harmonic exciter (VOYEX)
    if (harmonicExciterRef.current) {
      if (settings.harmonicAmount > 0) {
        harmonicExciterRef.current.curve = makeHarmonicExciterCurve(settings.harmonicAmount);
        harmonicExciterRef.current.oversample = '2x';
      } else {
        // Bypass - linear curve (no effect)
        harmonicExciterRef.current.curve = null;
      }
    }

    // Update presence filter
    if (presenceFilterRef.current) {
      presenceFilterRef.current.gain.value = settings.presenceGain;
    }

    // Update air filter (VOYEX)
    if (airFilterRef.current) {
      airFilterRef.current.frequency.value = settings.airFreq;
      airFilterRef.current.gain.value = settings.airGain;
    }

    // Update gain
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = settings.gain;
    }

    // Update compressor
    if (compressorRef.current) {
      compressorRef.current.threshold.value = settings.compressor.threshold;
      compressorRef.current.knee.value = settings.compressor.knee;
      compressorRef.current.ratio.value = settings.compressor.ratio;
      compressorRef.current.attack.value = settings.compressor.attack;
      compressorRef.current.release.value = settings.compressor.release;
    }

    // Log preset switch
    const voyexInfo = preset === 'voyex'
      ? ` | SubBass +${settings.subBassGain}dB, Warmth +${settings.warmthGain}dB, Air +${settings.airGain}dB, Harmonics ${settings.harmonicAmount}%`
      : '';
    console.log(`🎵 [VOYO] Switched to ${preset.toUpperCase()} preset${voyexInfo}`);
  }, []);

  // Initialize IFrame player
  const initIframePlayer = useCallback((videoId: string, retryCount: number = 0) => {
    if (!(window as any).YT?.Player) {
      if (retryCount >= 10) {
        console.error('[VOYO] YT API failed to load after 10 retries');
        setBufferHealth(0, 'emergency');
        return;
      }
      setTimeout(() => initIframePlayer(videoId, retryCount + 1), 500);
      return;
    }

    // INSTANT SKIP: Reuse existing player with cueVideoById instead of destroying
    if (playerRef.current) {
      try {
        console.log('🎵 [VOYO] Reusing iframe player for instant skip');
        // Use type assertion since cueVideoById exists on YT player but not in our minimal type
        (playerRef.current as any).cueVideoById(videoId);
        if (isPlaying) {
          playerRef.current.playVideo();
        }
        return; // Skip recreation
      } catch (e) {
        // If cue fails, fall through to destroy and recreate
        console.warn('[VOYO] Failed to reuse player, recreating:', e);
        try {
          playerRef.current.destroy();
          playerRef.current = null;
        } catch (destroyError) {
          // Ignore
        }
      }
    }

    const container = document.getElementById('voyo-yt-player');
    if (!container) return;

    // Clear previous IFrame remnants
    container.innerHTML = '';

    playerRef.current = new (window as any).YT.Player('voyo-yt-player', {
      height: '1',
      width: '1',
      videoId: videoId,
      playerVars: {
        autoplay: 0, // Always 0 - we control playback via playVideo()
        controls: 0,
        disablekb: 1,
        fs: 0,
        modestbranding: 1,
        rel: 0,
        showinfo: 0,
      },
      events: {
        onReady: (event: any) => {
          // FIX: Start at volume 0 to prevent click/pop, then fade in
          event.target.setVolume(0);

          // RESUME POSITION: On initial load, seek to saved position
          if (isInitialLoadRef.current && savedCurrentTime > 5) {
            event.target.seekTo(savedCurrentTime, true);
            isInitialLoadRef.current = false;
          }

          if (isPlaying) {
            event.target.playVideo();
          }
        },
        onStateChange: (event: any) => {
          const ytState = event.data;
          if (ytState === 0) { // ENDED
            // POOL ENGAGEMENT: Record completion before moving to next track
            const playerState = usePlayerStore.getState();
            if (playerState.currentTrack) {
              const completionRate = trackProgressRef.current;
              recordPoolEngagement(playerState.currentTrack.trackId, 'complete', { completionRate });
              useTrackPoolStore.getState().recordCompletion(playerState.currentTrack.trackId, completionRate);
              console.log(`[VOYO Pool] Recorded complete (iframe): ${playerState.currentTrack.title} (${completionRate.toFixed(0)}%)`);
            }
            nextTrack();
          } else if (ytState === 1) { // PLAYING
            setBufferHealth(100, 'healthy');
            // FIX: Smooth volume fade-in to user's volume setting
            const player = playerRef.current;
            if (player) {
              const playerState = usePlayerStore.getState();
              const targetVol = playerState.volume; // Respect user volume
              let currentVol = 0;
              const fadeInterval = setInterval(() => {
                currentVol = Math.min(currentVol + 10, targetVol);
                try {
                  player.setVolume(currentVol);
                } catch (e) {
                  clearInterval(fadeInterval);
                }
                if (currentVol >= targetVol) {
                  clearInterval(fadeInterval);
                }
              }, 30); // 30ms intervals = ~300ms fade-in
            }

            // POOL ENGAGEMENT: Record play event (once per track, IFrame path)
            const playingState = usePlayerStore.getState();
            if (!hasRecordedPlayRef.current && playingState.currentTrack) {
              hasRecordedPlayRef.current = true;
              recordPoolEngagement(playingState.currentTrack.trackId, 'play');
              useTrackPoolStore.getState().recordPlay(playingState.currentTrack.trackId);
              // POOL CURATOR: Record track in listening session
              recordTrackInSession(playingState.currentTrack, 0, false, false);
              // INTELLIGENT DJ: Feed the AI with listening data
              djRecordPlay(playingState.currentTrack, false, false);
              // OYO DJ: Announce track transition
              oyoOnTrackPlay(playingState.currentTrack, previousTrackRef.current || undefined);
              previousTrackRef.current = playingState.currentTrack;
              console.log(`[VOYO Pool] Recorded play (iframe): ${playingState.currentTrack.title}`);
            }
          } else if (ytState === 3) { // BUFFERING
            setBufferHealth(50, 'warning');
          }
        },
        onError: (event: any) => {
          console.error('[VOYO IFrame] Error:', event.data);
          setBufferHealth(0, 'emergency');
          // Auto-skip on error after 2 seconds
          setTimeout(() => {
            nextTrack();
          }, 2000);
        },
      },
    });
  }, [isPlaying, volume, nextTrack, setBufferHealth, savedCurrentTime]);

  // Load track when it changes
  useEffect(() => {
    const loadTrack = async () => {
      if (!currentTrack?.trackId) return;
      if (currentVideoId.current === currentTrack.trackId) return;

      // Cancel previous load operation
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      currentVideoId.current = currentTrack.trackId;
      hasPrefetchedRef.current = false; // Reset prefetch flag for new track
      hasAutoCachedRef.current = false; // Reset auto-cache flag for new track
      hasRecordedPlayRef.current = false; // Reset play recording for new track
      trackProgressRef.current = 0; // Reset progress tracking

      // End previous session
      if (lastTrackId.current && lastTrackId.current !== currentTrack.id) {
        const el = audioRef.current;
        endListenSession(el?.currentTime || 0, 0);
      }

      // Start new session
      startListenSession(currentTrack.id);
      lastTrackId.current = currentTrack.id;

      try {
        // 1. CHECK ALL CACHES - Priority: MediaCache → AudioEngine → IndexedDB → iframe
        const API_BASE = 'https://voyo-music-api.fly.dev';
        const { url: bestUrl, cached: fromCache, source: cacheSource } = audioEngine.getBestAudioUrl(currentTrack.trackId, API_BASE);

        // 2. CHECK LOCAL CACHE (User's IndexedDB - Boosted tracks) if not in memory cache
        console.log('🎵 AudioPlayer: Checking cache for trackId:', currentTrack.trackId, '| title:', currentTrack.title);
        const cachedUrl = fromCache ? bestUrl : await checkCache(currentTrack.trackId);
        console.log('🎵 AudioPlayer: Cache result:', cachedUrl ? `✅ FOUND (${cacheSource})` : '❌ Not cached (using iframe)');

        if (cachedUrl) {
          // ⚡ BOOSTED - Play from local cache (instant, offline-ready)
          console.log('🎵 AudioPlayer: Playing BOOSTED version from IndexedDB');

          // CRITICAL: Stop iframe player if it was playing previous track
          if (playerRef.current) {
            try {
              playerRef.current.stopVideo();
              playerRef.current.destroy();
              playerRef.current = null;
            } catch (e) {
              // Ignore errors during cleanup
            }
          }

          setPlaybackMode('cached');
          setPlaybackSource('cached');

          if (audioRef.current) {
            // Revoke previous blob URL
            if (cachedUrlRef.current) {
              URL.revokeObjectURL(cachedUrlRef.current);
            }
            cachedUrlRef.current = cachedUrl;

            // Setup audio enhancement (bass + gain boost) BEFORE setting src
            // Use the current boost profile from store
            const { boostProfile: currentProfile } = usePlayerStore.getState();
            setupAudioEnhancement(currentProfile);

            // FIX: Start at volume 0 to prevent click/pop
            audioRef.current.volume = 0;
            audioRef.current.src = cachedUrl;
            audioRef.current.load();

            // FIX: Use oncanplaythrough for smoother start
            audioRef.current.oncanplaythrough = () => {
              if (audioRef.current) {
                // RESUME POSITION: On initial load, seek to saved position
                if (isInitialLoadRef.current && savedCurrentTime > 5) {
                  audioRef.current.currentTime = savedCurrentTime;
                  isInitialLoadRef.current = false;
                }

                if (isPlaying) {
                  // Resume AudioContext if suspended (browser policy)
                  if (audioContextRef.current?.state === 'suspended') {
                    audioContextRef.current.resume();
                  }

                  // FIX: Only play if not already playing
                  const audio = audioRef.current;
                  if (audio && audio.paused) {
                    audio.play().then(() => {
                      // With Web Audio enhancement, volume is controlled by gain node
                      // Set audio element to 100% and let gain node handle boost
                      audioRef.current!.volume = 1.0;

                      // POOL ENGAGEMENT: Record play event (once per track)
                      if (!hasRecordedPlayRef.current && currentTrack) {
                        hasRecordedPlayRef.current = true;
                        recordPoolEngagement(currentTrack.trackId, 'play');
                        useTrackPoolStore.getState().recordPlay(currentTrack.trackId);
                        // POOL CURATOR: Record track in listening session
                        recordTrackInSession(currentTrack, 0, false, false);
                        // INTELLIGENT DJ: Feed the AI with listening data
                        djRecordPlay(currentTrack, false, false);
                        // OYO DJ: Announce track transition
                        oyoOnTrackPlay(currentTrack, previousTrackRef.current || undefined);
                        previousTrackRef.current = currentTrack;
                        console.log(`[VOYO Pool] Recorded play: ${currentTrack.title}`);
                      }
                    }).catch(err => {
                      if (err.name !== 'AbortError') {
                        console.warn('[VOYO] Cached playback failed:', err.message);
                      }
                    });
                  }
                }
              }
            };
          }
          return;
        }

        // 2. NOT CACHED - Try CDN audio streaming first (supports background playback)
        // Falls back to iframe only if CDN fails
        console.log('🎵 AudioPlayer: Trying CDN audio stream for background playback support');

        // Stop iframe if it was playing previous track
        if (playerRef.current) {
          try {
            playerRef.current.stopVideo();
            playerRef.current.destroy();
            playerRef.current = null;
          } catch (e) {
            // Ignore errors during cleanup
          }
        }

        const cdnStreamUrl = `${API_BASE}/cdn/stream/${currentTrack.trackId}?type=audio&quality=medium`;

        // Try CDN audio stream first (enables background playback)
        setPlaybackMode('cached'); // Use audio element, not iframe
        setPlaybackSource('cdn');

        if (audioRef.current) {
          audioRef.current.src = cdnStreamUrl;
          audioRef.current.load();

          audioRef.current.oncanplaythrough = () => {
            if (audioRef.current && isPlaying) {
              audioRef.current.play().then(() => {
                audioRef.current!.volume = volume;
                // Record play event
                if (!hasRecordedPlayRef.current && currentTrack) {
                  hasRecordedPlayRef.current = true;
                  recordPoolEngagement(currentTrack.trackId, 'play');
                  useTrackPoolStore.getState().recordPlay(currentTrack.trackId);
                  recordTrackInSession(currentTrack, 0, false, false);
                  djRecordPlay(currentTrack, false, false);
                  oyoOnTrackPlay(currentTrack, previousTrackRef.current || undefined);
                  previousTrackRef.current = currentTrack;
                }
              }).catch(err => {
                // CDN failed, fall back to iframe
                console.warn('[VOYO] CDN stream failed, falling back to iframe:', err.message);
                setPlaybackMode('iframe');
                setPlaybackSource('iframe');
                const ytId = getYouTubeIdForIframe(currentTrack.trackId);
                initIframePlayer(ytId);
              });
            }
          };

          audioRef.current.onerror = () => {
            // CDN failed, fall back to iframe
            console.warn('[VOYO] CDN stream error, falling back to iframe');
            setPlaybackMode('iframe');
            setPlaybackSource('iframe');
            const ytId = getYouTubeIdForIframe(currentTrack.trackId);
            initIframePlayer(ytId);
          };
        }

      } catch (error: any) {
        // Check if aborted
        if (error.name === 'AbortError') {
          return; // Load was cancelled, ignore
        }

        // Fallback to IFrame on error
        setPlaybackMode('iframe');
        setPlaybackSource('iframe');
        const ytId = getYouTubeIdForIframe(currentTrack.trackId);
        initIframePlayer(ytId);
      }
    };

    loadTrack();

    // Cleanup: abort on track change and revoke blob URL
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (cachedUrlRef.current) {
        URL.revokeObjectURL(cachedUrlRef.current);
        cachedUrlRef.current = null;
      }
    };
  }, [currentTrack?.trackId, initIframePlayer, isPlaying, startListenSession, endListenSession, checkCache, setPlaybackSource, setupAudioEnhancement]);

  // 🔄 TOGGLE: Watch for playback source changes from store (boost toggle feature)
  useEffect(() => {
    if (!currentTrack?.trackId || !storePlaybackSource) return;

    // Sync internal state with store - handles toggle between boosted/original
    const performSourceSwitch = async () => {
      const currentPosition = playbackMode === 'cached' && audioRef.current
        ? audioRef.current.currentTime
        : playerRef.current?.getCurrentTime?.() || 0;

      if (storePlaybackSource === 'iframe' && playbackMode === 'cached') {
        // Switching FROM cached TO iframe (using original)
        console.log('🔄 TOGGLE: Switching to iframe playback');

        // FIX: Stop cached audio completely - pause and clear src to prevent bleed
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = '';
          audioRef.current.load(); // Reset element
        }

        // Initialize iframe player
        setPlaybackMode('iframe');

        // Wait for iframe to be ready then seek
        setTimeout(() => {
          if (playerRef.current && currentPosition > 2) {
            try {
              playerRef.current.seekTo(currentPosition, true);
              if (isPlaying) playerRef.current.playVideo();
            } catch (e) {
              // Player not ready yet
            }
          }
        }, 500);

      } else if (storePlaybackSource === 'cached' && playbackMode === 'iframe') {
        // Switching FROM iframe TO cached (using boosted)
        console.log('🔄 TOGGLE: Switching to cached playback');

        const cachedUrl = await checkCache(currentTrack.trackId);
        if (!cachedUrl) {
          console.warn('🔄 TOGGLE: No cached URL found');
          return;
        }

        // FIX: Stop iframe player completely to prevent audio bleed
        if (playerRef.current) {
          try {
            playerRef.current.stopVideo(); // Use stopVideo instead of pauseVideo for complete stop
            playerRef.current.destroy();
            playerRef.current = null;
          } catch (e) {
            // Ignore
          }
        }

        // Switch to cached mode
        setPlaybackMode('cached');

        if (audioRef.current) {
          if (cachedUrlRef.current) {
            URL.revokeObjectURL(cachedUrlRef.current);
          }
          cachedUrlRef.current = cachedUrl;
          audioRef.current.src = cachedUrl;
          audioRef.current.load();

          audioRef.current.oncanplaythrough = () => {
            if (audioRef.current && currentPosition > 2) {
              audioRef.current.currentTime = currentPosition;
            }
            if (isPlaying && audioRef.current) {
              // FIX: Only play if paused to avoid redundant play() calls
              if (audioRef.current.paused) {
                audioRef.current.play().catch(err => {
                  if (err.name !== 'AbortError') {
                    console.warn('🔄 TOGGLE: Play failed:', err.message);
                  }
                });
              }
            }
          };
        }
      }
    };

    performSourceSwitch();
  }, [storePlaybackSource, currentTrack?.trackId, playbackMode, checkCache, isPlaying]);

  // ⚡ HOT-SWAP: When boost completes mid-song, swap to boosted audio with DJ rewind
  useEffect(() => {
    if (!lastBoostCompletion || !currentTrack?.trackId) return;

    // Check if this completion is for the current track
    // Also check originalTrackId for VOYO encoded IDs
    const isCurrentTrack =
      lastBoostCompletion.trackId === currentTrack.trackId ||
      lastBoostCompletion.trackId === currentTrack.trackId.replace('VOYO_', '');

    if (!isCurrentTrack) return;

    // Only hot-swap if we're currently playing via iframe (not already cached)
    if (playbackMode !== 'iframe') return;

    console.log(`🎵 HOT-SWAP: Boost completed for current track! Fast: ${lastBoostCompletion.isFast}`);

    const performHotSwap = async () => {
      // Save current position
      const currentPosition = playerRef.current?.getCurrentTime?.() || 0;

      // DJ Rewind logic:
      // - Fast boost + early in song (< 30s): Rewind to start with sound effect
      // - Fast boost + far into song (> 30s): Smooth resume (don't lose progress on long mixes)
      // - Slow boost: Always smooth resume
      const shouldDJRewind = lastBoostCompletion.isFast && currentPosition < 30;

      // Play DJ rewind sound only when actually rewinding
      if (shouldDJRewind && audioContextRef.current) {
        try {
          const ctx = audioContextRef.current;
          // Create a quick "pullback" sound - descending tone
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.type = 'sine';
          osc.frequency.setValueAtTime(800, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.15);
          gain.gain.setValueAtTime(0.3, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.2);

          // Wait for sound to finish
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (e) {
          // Audio context not available, continue anyway
        }
      }

      // Get the cached URL
      const cachedUrl = await checkCache(currentTrack.trackId);
      if (!cachedUrl) {
        console.warn('🎵 HOT-SWAP: Cache check failed, staying on iframe');
        return;
      }

      console.log('🎵 HOT-SWAP: Switching to boosted audio...');

      // Stop iframe player
      if (playerRef.current) {
        try {
          playerRef.current.stopVideo();
          playerRef.current.destroy();
          playerRef.current = null;
        } catch (e) {
          // Ignore cleanup errors
        }
      }

      // Switch to cached mode
      setPlaybackMode('cached');
      setPlaybackSource('cached');

      if (audioRef.current) {
        // Revoke previous blob URL if any
        if (cachedUrlRef.current) {
          URL.revokeObjectURL(cachedUrlRef.current);
        }
        cachedUrlRef.current = cachedUrl;

        // Setup audio enhancement
        const { boostProfile: currentProfile } = usePlayerStore.getState();
        setupAudioEnhancement(currentProfile);

        // Start at volume 0 to prevent click
        audioRef.current.volume = 0;
        audioRef.current.src = cachedUrl;
        audioRef.current.load();

        audioRef.current.oncanplaythrough = () => {
          if (audioRef.current) {
            // Resume from previous position (unless DJ rewind for fast boosts early in song)
            if (!shouldDJRewind && currentPosition > 2) {
              audioRef.current.currentTime = currentPosition;
              console.log(`🎵 HOT-SWAP: Resuming at ${currentPosition.toFixed(1)}s`);
            } else if (shouldDJRewind) {
              console.log('🎵 HOT-SWAP: DJ Rewind - starting fresh!');
            }

            if (isPlaying) {
              if (audioContextRef.current?.state === 'suspended') {
                audioContextRef.current.resume();
              }

              // FIX: Only play if not already playing
              const audio = audioRef.current;
              if (audio && audio.paused) {
                audio.play().then(() => {
                  audioRef.current!.volume = 1.0;
                  console.log('🎵 HOT-SWAP: ✅ Now playing boosted audio!');
                }).catch(err => {
                  if (err.name !== 'AbortError') {
                    console.warn('🎵 HOT-SWAP: Playback failed:', err.message);
                  }
                });
              }
            }
          }
        };
      }
    };

    performHotSwap();
  }, [lastBoostCompletion, currentTrack?.trackId, playbackMode, checkCache, isPlaying, setPlaybackSource, setupAudioEnhancement]);

  // Handle play/pause
  useEffect(() => {
    if (playbackMode === 'cached' && audioRef.current) {
      const audio = audioRef.current;
      if (isPlaying) {
        // FIX: Check if audio is already playing to avoid redundant calls
        if (audio.paused) {
          audio.play().catch(err => {
            if (err.name !== 'AbortError') {
              console.warn('[VOYO] Playback failed:', err.message);
            }
          });
        }
      } else {
        // FIX: Check if audio is actually playing before pausing
        if (!audio.paused) {
          audio.pause();
        }
      }
    } else if (playbackMode === 'iframe' && playerRef.current) {
      try {
        const player = playerRef.current;
        // FIX: Check if player has getPlayerState method before using it
        const playerState = typeof player.getPlayerState === 'function' ? player.getPlayerState() : -1;

        if (isPlaying) {
          // Only play if not already playing (state 1 = playing)
          if (playerState !== 1) {
            player.playVideo();
          }
        } else {
          // Only pause if currently playing or buffering (state 1 or 3)
          if (playerState === 1 || playerState === 3) {
            player.pauseVideo();
          }
        }
      } catch (e) {
        // Player not ready yet - silently ignore
      }
    }
  }, [isPlaying, playbackMode]);

  // Handle volume
  useEffect(() => {
    if (playbackMode === 'cached' && audioRef.current) {
      if (audioEnhancedRef.current && gainNodeRef.current) {
        // With Web Audio: keep audio at 100%, use gain node for volume + boost
        // Use current profile's gain setting, multiply by user volume
        const profileGain = BOOST_PRESETS[currentProfileRef.current].gain;
        audioRef.current.volume = 1.0;
        gainNodeRef.current.gain.value = profileGain * (volume / 100);
      } else {
        // Fallback: direct volume control
        audioRef.current.volume = volume / 100;
      }
    } else if (playbackMode === 'iframe' && playerRef.current) {
      try {
        // FIX: Apply user volume to YouTube iframe
        playerRef.current.setVolume(volume);
      } catch (e) {
        // Player not ready yet
      }
    }
  }, [volume, playbackMode]);

  // Handle seek
  useEffect(() => {
    if (seekPosition === null) return;

    if (playbackMode === 'cached' && audioRef.current) {
      audioRef.current.currentTime = seekPosition;
    } else if (playbackMode === 'iframe' && playerRef.current) {
      try {
        playerRef.current.seekTo(seekPosition, true);
      } catch (e) {
        // Player not ready yet
      }
    }
    clearSeekPosition();
  }, [seekPosition, clearSeekPosition, playbackMode]);

  // SKEEP: Handle playbackRate changes (nostalgic CD fast-forward chipmunk effect)
  useEffect(() => {
    if (playbackMode === 'cached' && audioRef.current) {
      // HTML5 Audio: Direct playbackRate control (preserves pitch by default in modern browsers)
      audioRef.current.playbackRate = playbackRate;
    } else if (playbackMode === 'iframe' && playerRef.current) {
      try {
        // YouTube IFrame API: setPlaybackRate supports 0.25, 0.5, 1, 1.25, 1.5, 2
        // For SKEEP we'll use the closest available rate
        const ytRate = playbackRate <= 1 ? 1 : playbackRate <= 1.5 ? 1.5 : 2;
        // Cast to any since YouTube types may not include setPlaybackRate
        (playerRef.current as any).setPlaybackRate(ytRate);
      } catch (e) {
        // Player not ready yet
      }
    }
  }, [playbackRate, playbackMode]);

  // Handle boost preset changes - apply EQ settings dynamically
  useEffect(() => {
    if (playbackMode === 'cached' && audioEnhancedRef.current) {
      updateBoostPreset(boostProfile as BoostPreset);
    }
  }, [boostProfile, playbackMode, updateBoostPreset]);

  // IFrame time tracking
  useEffect(() => {
    if (playbackMode !== 'iframe') return;

    const interval = setInterval(() => {
      if (playerRef.current) {
        try {
          const currentTime = playerRef.current.getCurrentTime();
          const duration = playerRef.current.getDuration();
          if (duration) {
            setCurrentTime(currentTime);
            setDuration(duration);
            setProgress((currentTime / duration) * 100);

            // Update Media Session position state
            if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
              navigator.mediaSession.setPositionState({
                duration: duration,
                playbackRate: 1,
                position: currentTime
              });
            }

            // 30s AUTO-CACHE: Cache track for offline after 30 seconds of playback
            if (currentTime >= 30 && !hasAutoCachedRef.current && currentTrack) {
              hasAutoCachedRef.current = true;
              // Silent background cache at standard quality
              cacheTrack(
                currentTrack.trackId,
                currentTrack.title,
                currentTrack.artist,
                Math.floor(duration),
                `https://voyo-music-api.fly.dev/cdn/art/${currentTrack.trackId}?quality=high`
              );
            }

            // POOL ENGAGEMENT: Track progress for iframe mode (for skip detection + completion)
            const progressPercent = (currentTime / duration) * 100;
            trackProgressRef.current = progressPercent;

            // 50% PREFETCH: Prefetch next track when 50% through current track (IFrame mode)
            if (progressPercent >= 50 && !hasPrefetchedRef.current) {
              hasPrefetchedRef.current = true;

              // Get next track from queue
              const state = usePlayerStore.getState();
              const nextInQueue = state.queue[0];

              if (nextInQueue?.track?.trackId) {
                // Prefetch next track
                prefetchTrack(nextInQueue.track.trackId).catch(() => {
                  // Ignore prefetch errors
                });
              }
            }
          }
        } catch (e) {
          // Player not ready
        }
      }
    }, 250);

    return () => clearInterval(interval);
  }, [playbackMode, setCurrentTime, setDuration, setProgress]);

  // Media Session API - Lock screen and notification controls
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentTrack) return;

    // Set metadata
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artist,
      album: 'VOYO Music',
      artwork: [
        {
          src: `https://voyo-music-api.fly.dev/cdn/art/${currentTrack.trackId}?quality=high`,
          sizes: '96x96',
          type: 'image/jpeg'
        },
        {
          src: `https://voyo-music-api.fly.dev/cdn/art/${currentTrack.trackId}?quality=high`,
          sizes: '128x128',
          type: 'image/jpeg'
        },
        {
          src: `https://voyo-music-api.fly.dev/cdn/art/${currentTrack.trackId}?quality=high`,
          sizes: '192x192',
          type: 'image/jpeg'
        },
        {
          src: `https://voyo-music-api.fly.dev/cdn/art/${currentTrack.trackId}?quality=high`,
          sizes: '256x256',
          type: 'image/jpeg'
        },
        {
          src: `https://voyo-music-api.fly.dev/cdn/art/${currentTrack.trackId}?quality=high`,
          sizes: '384x384',
          type: 'image/jpeg'
        },
        {
          src: `https://voyo-music-api.fly.dev/cdn/art/${currentTrack.trackId}?quality=high`,
          sizes: '512x512',
          type: 'image/jpeg'
        }
      ]
    });

    // Set action handlers
    navigator.mediaSession.setActionHandler('play', () => {
      // Update store state - this will trigger the play effect
      const storeState = usePlayerStore.getState();
      if (!storeState.isPlaying) {
        togglePlay();
      }
    });

    navigator.mediaSession.setActionHandler('pause', () => {
      // Update store state - this will trigger the pause effect
      const storeState = usePlayerStore.getState();
      if (storeState.isPlaying) {
        togglePlay();
      }
    });

    navigator.mediaSession.setActionHandler('nexttrack', () => {
      // POOL ENGAGEMENT: Detect skip (< 30% progress when next is hit)
      const storeState = usePlayerStore.getState();
      if (storeState.currentTrack && trackProgressRef.current < 30) {
        recordPoolEngagement(storeState.currentTrack.trackId, 'skip', { completionRate: trackProgressRef.current });
        useTrackPoolStore.getState().recordSkip(storeState.currentTrack.trackId);
        // OYO DJ: Record skip
        oyoOnTrackSkip(storeState.currentTrack);
        console.log(`[VOYO Pool] Recorded skip (media): ${storeState.currentTrack.title} at ${trackProgressRef.current.toFixed(0)}%`);
      }
      nextTrack();
    });

    navigator.mediaSession.setActionHandler('previoustrack', () => {
      // Get prevTrack from store
      const { prevTrack } = usePlayerStore.getState();
      prevTrack();
    });

    // Seek handlers - enable scrubbing from lock screen
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined) {
        const seekTime = details.seekTime;
        if (playbackMode === 'cached' && audioRef.current) {
          audioRef.current.currentTime = seekTime;
        } else if (playbackMode === 'iframe' && playerRef.current) {
          try {
            playerRef.current.seekTo(seekTime, true);
          } catch (e) {
            // Player not ready
          }
        }
      }
    });

    navigator.mediaSession.setActionHandler('seekbackward', (details) => {
      const seekOffset = details.seekOffset || 10; // Default 10 seconds
      if (playbackMode === 'cached' && audioRef.current) {
        audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - seekOffset);
      } else if (playbackMode === 'iframe' && playerRef.current) {
        try {
          const currentTime = playerRef.current.getCurrentTime();
          playerRef.current.seekTo(Math.max(0, currentTime - seekOffset), true);
        } catch (e) {
          // Player not ready
        }
      }
    });

    navigator.mediaSession.setActionHandler('seekforward', (details) => {
      const seekOffset = details.seekOffset || 10; // Default 10 seconds
      if (playbackMode === 'cached' && audioRef.current) {
        const newTime = Math.min(audioRef.current.duration || 0, audioRef.current.currentTime + seekOffset);
        audioRef.current.currentTime = newTime;
      } else if (playbackMode === 'iframe' && playerRef.current) {
        try {
          const currentTime = playerRef.current.getCurrentTime();
          const duration = playerRef.current.getDuration();
          playerRef.current.seekTo(Math.min(duration, currentTime + seekOffset), true);
        } catch (e) {
          // Player not ready
        }
      }
    });

    // Update playback state
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

  }, [currentTrack, isPlaying, playbackMode, togglePlay, nextTrack]);

  // === QUEUE PRE-BOOST ===
  // Like Spotify: Pre-cache upcoming tracks in background for instant playback
  // ONLY when Auto-Boost is enabled in Boost Settings
  const preBoostingRef = useRef<Set<string>>(new Set()); // Track what's already being pre-boosted
  const { autoBoostEnabled } = useDownloadStore();

  useEffect(() => {
    // Only pre-boost if Auto-Boost is enabled in settings
    if (!autoBoostEnabled) return;

    const preBoostQueue = async () => {
      const state = usePlayerStore.getState();
      const queueTracks = state.queue.slice(0, 3); // Pre-boost next 3 tracks

      for (const queueItem of queueTracks) {
        const track = queueItem.track;
        if (!track?.trackId) continue;

        // Skip if already pre-boosting this track
        if (preBoostingRef.current.has(track.trackId)) continue;

        // Check if already cached
        const cachedUrl = await checkCache(track.trackId);
        if (cachedUrl) continue; // Already cached, skip

        // Mark as pre-boosting
        preBoostingRef.current.add(track.trackId);

        // Pre-boost in background (silent, no UI)
        console.log(`🚀 [VOYO] Pre-boosting: ${track.title}`);
        try {
          await cacheTrack(
            track.trackId,
            track.title,
            track.artist,
            0, // Duration unknown, will be updated on play
            `https://voyo-music-api.fly.dev/cdn/art/${track.trackId}?quality=high`
          );
          console.log(`✅ [VOYO] Pre-boosted: ${track.title}`);
        } catch (e) {
          // Ignore errors, it's background optimization
          console.log(`⚠️ [VOYO] Pre-boost failed: ${track.title}`);
        }

        // Remove from tracking
        preBoostingRef.current.delete(track.trackId);

        // Small delay between downloads to not overwhelm
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    };

    // Run pre-boost when queue changes or current track changes
    preBoostQueue();
  }, [currentTrack?.trackId, checkCache, cacheTrack, autoBoostEnabled]);

  // Audio element event handlers (for cached playback)
  const handleTimeUpdate = useCallback(() => {
    const el = audioRef.current;
    if (el && el.duration) {
      setCurrentTime(el.currentTime);
      const progressPercent = (el.currentTime / el.duration) * 100;
      setProgress(progressPercent);

      // Update Media Session position state (for lock screen seek bar)
      if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
        try {
          navigator.mediaSession.setPositionState({
            duration: el.duration,
            playbackRate: el.playbackRate,
            position: el.currentTime
          });
        } catch (e) {
          // Ignore - some browsers may not support all features
        }
      }

      // POOL ENGAGEMENT: Track progress for skip detection
      trackProgressRef.current = progressPercent;

      // 50% PREFETCH: Smart preload next track when 50% through current track
      if (progressPercent >= 50 && !hasPrefetchedRef.current && currentTrack?.trackId) {
        hasPrefetchedRef.current = true;

        // Get next track from queue
        const state = usePlayerStore.getState();
        const nextInQueue = state.queue[0];

        if (nextInQueue?.track?.trackId) {
          // Smart preload using audioEngine (uses adaptive bitrate + blob caching)
          const apiBase = 'https://voyo-music-api.fly.dev';
          audioEngine.preloadTrack(
            nextInQueue.track.trackId,
            apiBase,
            (progress) => {
              // Track prefetch progress in store
              if (progress === 100) {
                state.setPrefetchStatus(nextInQueue.track.trackId, 'ready');
              }
            }
          ).catch(() => {
            // Ignore prefetch errors, fallback to on-demand loading
          });
        }
      }
    }
  }, [setCurrentTime, setProgress, currentTrack?.trackId]);

  const handleDurationChange = useCallback(() => {
    const el = audioRef.current;
    if (el && el.duration) {
      setDuration(el.duration);
    }
  }, [setDuration]);

  const handleEnded = useCallback(() => {
    const el = audioRef.current;
    if (el && currentTrack) {
      endListenSession(el.currentTime, 0);

      // POOL ENGAGEMENT: Record completion (100% means full listen)
      const completionRate = trackProgressRef.current;
      recordPoolEngagement(currentTrack.trackId, 'complete', { completionRate });
      useTrackPoolStore.getState().recordCompletion(currentTrack.trackId, completionRate);
      // OYO DJ: Record completion for learning
      oyoOnTrackComplete(currentTrack, el.currentTime);
      console.log(`[VOYO Pool] Recorded complete: ${currentTrack.title} (${completionRate.toFixed(0)}%)`);
    }
    nextTrack();
  }, [nextTrack, currentTrack, endListenSession]);

  const handleProgress = useCallback(() => {
    const el = audioRef.current;
    if (!el || !el.buffered.length) return;

    // Use audioEngine for smart buffer health monitoring
    const bufferHealth = audioEngine.getBufferHealth(el);
    setBufferHealth(bufferHealth.percentage, bufferHealth.status);
  }, [setBufferHealth]);

  const handlePlaying = useCallback(() => {
    setBufferHealth(100, 'healthy');
  }, [setBufferHealth]);

  const handleWaiting = useCallback(() => {
    setBufferHealth(50, 'warning');
  }, [setBufferHealth]);

  return (
    <>
      {/* HTML5 Audio (for cached/boosted tracks) */}
      <audio
        ref={audioRef}
        preload="auto"
        onTimeUpdate={handleTimeUpdate}
        onDurationChange={handleDurationChange}
        onEnded={handleEnded}
        onProgress={handleProgress}
        onPlaying={handlePlaying}
        onWaiting={handleWaiting}
        style={{ display: 'none' }}
      />

      {/* YouTube IFrame (for non-boosted tracks - hidden) */}
      <div
        id="voyo-yt-player"
        style={{
          position: 'fixed',
          top: -9999,
          left: -9999,
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: 'none',
        }}
      />
    </>
  );
};

export default AudioPlayer;
