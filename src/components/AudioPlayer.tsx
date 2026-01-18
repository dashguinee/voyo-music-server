/**
 * VOYO Music - Hybrid Audio Player
 *
 * FLOW (Collective Intelligence):
 * 1. Check IndexedDB cache (local boost) → Play instantly with EQ
 * 2. Check R2 collective cache → Play with EQ (41K+ shared tracks)
 * 3. Fall to YouTube iframe → Background boost to both local + R2
 *
 * COORDINATION with YouTubeIframe:
 * - playbackSource === 'iframe' → Iframe handles audio (unmuted)
 * - playbackSource === 'cached' → Local boost handles audio, iframe muted (video only)
 * - playbackSource === 'r2' → R2 stream handles audio with EQ, iframe muted (video only)
 *
 * AUDIO ENHANCEMENT:
 * - Applies to cached AND r2 audio (via Web Audio API)
 * - 4 presets: Boosted, Calm, VOYEX, Xtreme
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { Track } from '../types';
import { usePlayerStore } from '../store/playerStore';
import { usePreferenceStore } from '../store/preferenceStore';
import { useDownloadStore } from '../store/downloadStore';
import { useTrackPoolStore } from '../store/trackPoolStore';
import { audioEngine } from '../services/audioEngine';
import { checkR2Cache } from '../services/api';
import { recordPoolEngagement } from '../services/personalization';
import { recordTrackInSession } from '../services/poolCurator';
import { recordPlay as djRecordPlay } from '../services/intelligentDJ';
import { onTrackPlay as oyoOnTrackPlay, onTrackComplete as oyoOnTrackComplete } from '../services/oyoDJ';
import { registerTrackPlay as viRegisterPlay } from '../services/videoIntelligence';
import { useMiniPiP } from '../hooks/useMiniPiP';

export type BoostPreset = 'boosted' | 'calm' | 'voyex' | 'xtreme';

// Audio boost presets
const BOOST_PRESETS = {
  boosted: {
    gain: 1.15, bassFreq: 80, bassGain: 5, presenceFreq: 3000, presenceGain: 2,
    subBassFreq: 40, subBassGain: 2, warmthFreq: 250, warmthGain: 1,
    airFreq: 10000, airGain: 1, harmonicAmount: 0,
    compressor: { threshold: -12, knee: 10, ratio: 4, attack: 0.003, release: 0.25 }
  },
  calm: {
    gain: 1.05, bassFreq: 80, bassGain: 3, presenceFreq: 3000, presenceGain: 1,
    subBassFreq: 50, subBassGain: 1, warmthFreq: 250, warmthGain: 2,
    airFreq: 8000, airGain: 2, harmonicAmount: 0,
    compressor: { threshold: -15, knee: 15, ratio: 3, attack: 0.005, release: 0.3 }
  },
  voyex: {
    gain: 1.25, bassFreq: 80, bassGain: 7, presenceFreq: 3000, presenceGain: 3,
    subBassFreq: 45, subBassGain: 5, warmthFreq: 250, warmthGain: 2,
    airFreq: 12000, airGain: 3, harmonicAmount: 15,
    compressor: { threshold: -8, knee: 6, ratio: 8, attack: 0.002, release: 0.15 }
  },
  xtreme: {
    gain: 1.35, bassFreq: 80, bassGain: 10, presenceFreq: 3000, presenceGain: 4,
    subBassFreq: 40, subBassGain: 7, warmthFreq: 250, warmthGain: 1,
    airFreq: 10000, airGain: 2, harmonicAmount: 20,
    compressor: { threshold: -4, knee: 0, ratio: 20, attack: 0.001, release: 0.1 }
  }
};

export const AudioPlayer = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const cachedUrlRef = useRef<string | null>(null);

  // Web Audio API refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const bassFilterRef = useRef<BiquadFilterNode | null>(null);
  const presenceFilterRef = useRef<BiquadFilterNode | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);
  const subBassFilterRef = useRef<BiquadFilterNode | null>(null);
  const warmthFilterRef = useRef<BiquadFilterNode | null>(null);
  const airFilterRef = useRef<BiquadFilterNode | null>(null);
  const harmonicExciterRef = useRef<WaveShaperNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const audioEnhancedRef = useRef<boolean>(false);
  const currentProfileRef = useRef<BoostPreset>('boosted');

  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const lastTrackIdRef = useRef<string | null>(null);
  const previousTrackRef = useRef<Track | null>(null);
  const hasRecordedPlayRef = useRef<boolean>(false);
  const trackProgressRef = useRef<number>(0);
  const isInitialLoadRef = useRef<boolean>(true);
  const backgroundBoostingRef = useRef<string | null>(null);
  const hotSwapAbortRef = useRef<AbortController | null>(null);
  const hasTriggered50PercentCacheRef = useRef<boolean>(false); // 50% auto-boost trigger

  // Store state
  const {
    currentTrack, isPlaying, volume, seekPosition, playbackRate, boostProfile,
    currentTime: savedCurrentTime, playbackSource, progress,
    setCurrentTime, setDuration, setProgress, clearSeekPosition, togglePlay,
    nextTrack, setBufferHealth, setPlaybackSource,
  } = usePlayerStore();

  const { startListenSession, endListenSession } = usePreferenceStore();
  const { initialize: initDownloads, checkCache, cacheTrack, lastBoostCompletion, autoBoostEnabled, downloadSetting } = useDownloadStore();

  // Mini-PiP for background playback
  useMiniPiP();

  // Initialize downloads
  useEffect(() => {
    initDownloads();
  }, [initDownloads]);

  // 50% AUTO-BOOST: Trigger caching when user shows genuine interest
  // Only for iframe playback (not cached/r2), respects network preference
  useEffect(() => {
    // Only trigger at 50% for iframe playback
    if (playbackSource !== 'iframe') return;
    if (hasTriggered50PercentCacheRef.current) return;
    if (progress < 50) return;
    if (!currentTrack?.trackId) return;

    // Check network preference (always | wifi-only | ask | never)
    if (downloadSetting === 'never') {
      console.log('🎵 [VOYO] 50% reached but download setting is "never"');
      return;
    }

    if (downloadSetting === 'wifi-only') {
      // Use Network Information API to detect wifi vs cellular
      const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
      const isWifi = !connection || connection.type === 'wifi' || connection.type === 'ethernet' || !connection.effectiveType?.includes('2g');
      if (!isWifi) {
        console.log('🎵 [VOYO] 50% reached but wifi-only setting blocks caching on mobile data');
        return;
      }
    }

    // 'always' and 'ask' both allow caching (ask prompts for manual boost, auto-cache is silent)

    // Mark as triggered to prevent duplicate calls
    hasTriggered50PercentCacheRef.current = true;

    const API_BASE = 'https://voyo-music-api.fly.dev';
    console.log('🎵 [VOYO] 50% reached! Starting background cache (genuine interest)');

    // Start background cache
    backgroundBoostingRef.current = currentTrack.trackId;
    cacheTrack(
      currentTrack.trackId,
      currentTrack.title,
      currentTrack.artist,
      currentTrack.duration || 0,
      `${API_BASE}/cdn/art/${currentTrack.trackId}?quality=high`
    ).finally(() => {
      backgroundBoostingRef.current = null;
    });
  }, [progress, playbackSource, currentTrack, cacheTrack, downloadSetting]);

  // Background playback protection
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden' && (playbackSource === 'cached' || playbackSource === 'r2')) {
        const { isPlaying: shouldPlay } = usePlayerStore.getState();
        if (audioRef.current && shouldPlay) {
          if (audioContextRef.current?.state === 'suspended') {
            audioContextRef.current.resume();
          }
          audioRef.current.play().catch(() => {});
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [playbackSource]);

  // Wake lock
  useEffect(() => {
    const manageWakeLock = async () => {
      if (!isPlaying && wakeLockRef.current) {
        await wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
        return;
      }
      if (isPlaying && 'wakeLock' in navigator && !wakeLockRef.current) {
        try {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
        } catch (e) { /* ignore */ }
      }
    };
    manageWakeLock();
    return () => { wakeLockRef.current?.release().catch(() => {}); };
  }, [isPlaying]);

  // Harmonic exciter curve
  const makeHarmonicCurve = (amount: number): Float32Array<ArrayBuffer> => {
    const samples = 44100;
    const curve = new Float32Array(samples) as Float32Array<ArrayBuffer>;
    const deg = Math.PI / 180;
    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((3 + amount / 100) * x * 20 * deg) / (Math.PI + (amount / 100) * Math.abs(x));
    }
    return curve;
  };

  // Setup audio enhancement
  const setupAudioEnhancement = useCallback((preset: BoostPreset = 'boosted') => {
    if (!audioRef.current || audioEnhancedRef.current) return;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      const ctx = new AudioContextClass();
      audioContextRef.current = ctx;

      const settings = BOOST_PRESETS[preset];
      currentProfileRef.current = preset;

      const source = ctx.createMediaElementSource(audioRef.current);
      sourceNodeRef.current = source;

      // EQ Chain
      const subBass = ctx.createBiquadFilter();
      subBass.type = 'lowshelf'; subBass.frequency.value = settings.subBassFreq; subBass.gain.value = settings.subBassGain;
      subBassFilterRef.current = subBass;

      const bass = ctx.createBiquadFilter();
      bass.type = 'lowshelf'; bass.frequency.value = settings.bassFreq; bass.gain.value = settings.bassGain;
      bassFilterRef.current = bass;

      const warmth = ctx.createBiquadFilter();
      warmth.type = 'peaking'; warmth.frequency.value = settings.warmthFreq; warmth.Q.value = 1.5; warmth.gain.value = settings.warmthGain;
      warmthFilterRef.current = warmth;

      const harmonic = ctx.createWaveShaper();
      if (settings.harmonicAmount > 0) {
        harmonic.curve = makeHarmonicCurve(settings.harmonicAmount);
        harmonic.oversample = '2x';
      }
      harmonicExciterRef.current = harmonic;

      const presence = ctx.createBiquadFilter();
      presence.type = 'peaking'; presence.frequency.value = settings.presenceFreq; presence.Q.value = 1; presence.gain.value = settings.presenceGain;
      presenceFilterRef.current = presence;

      const air = ctx.createBiquadFilter();
      air.type = 'highshelf'; air.frequency.value = settings.airFreq; air.gain.value = settings.airGain;
      airFilterRef.current = air;

      const gain = ctx.createGain();
      gain.gain.value = settings.gain;
      gainNodeRef.current = gain;

      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = settings.compressor.threshold;
      comp.knee.value = settings.compressor.knee;
      comp.ratio.value = settings.compressor.ratio;
      comp.attack.value = settings.compressor.attack;
      comp.release.value = settings.compressor.release;
      compressorRef.current = comp;

      // Connect chain
      source.connect(subBass);
      subBass.connect(bass);
      bass.connect(warmth);
      warmth.connect(harmonic);
      harmonic.connect(presence);
      presence.connect(air);
      air.connect(gain);
      gain.connect(comp);
      comp.connect(ctx.destination);

      audioEnhancedRef.current = true;
      console.log(`🎵 [VOYO] Boost EQ active: ${preset.toUpperCase()}`);
    } catch (e) {
      console.warn('[VOYO] Audio enhancement failed:', e);
    }
  }, []);

  // Update preset dynamically
  const updateBoostPreset = useCallback((preset: BoostPreset) => {
    if (!audioEnhancedRef.current) return;
    const s = BOOST_PRESETS[preset];
    currentProfileRef.current = preset;

    subBassFilterRef.current && (subBassFilterRef.current.gain.value = s.subBassGain);
    bassFilterRef.current && (bassFilterRef.current.gain.value = s.bassGain);
    warmthFilterRef.current && (warmthFilterRef.current.gain.value = s.warmthGain);
    presenceFilterRef.current && (presenceFilterRef.current.gain.value = s.presenceGain);
    airFilterRef.current && (airFilterRef.current.gain.value = s.airGain);
    gainNodeRef.current && (gainNodeRef.current.gain.value = s.gain);

    if (harmonicExciterRef.current) {
      harmonicExciterRef.current.curve = s.harmonicAmount > 0 ? makeHarmonicCurve(s.harmonicAmount) : null;
    }
    if (compressorRef.current) {
      compressorRef.current.threshold.value = s.compressor.threshold;
      compressorRef.current.ratio.value = s.compressor.ratio;
    }
    console.log(`🎵 [VOYO] Switched to ${preset.toUpperCase()}`);
  }, []);

  // === MAIN TRACK LOADING LOGIC ===
  useEffect(() => {
    const loadTrack = async () => {
      if (!currentTrack?.trackId) return;

      const trackId = currentTrack.trackId;

      // Skip if same track
      if (lastTrackIdRef.current === trackId) return;

      // STOP old audio immediately before loading new track
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.src = '';
      }

      lastTrackIdRef.current = trackId;
      hasRecordedPlayRef.current = false;
      trackProgressRef.current = 0;
      hasTriggered50PercentCacheRef.current = false; // Reset 50% trigger for new track

      // End previous session
      endListenSession(audioRef.current?.currentTime || 0, 0);
      startListenSession(currentTrack.id, currentTrack.duration || 0);

      // Check cache first
      const API_BASE = 'https://voyo-music-api.fly.dev';
      const { url: bestUrl, cached: fromCache } = audioEngine.getBestAudioUrl(trackId, API_BASE);
      const cachedUrl = fromCache ? bestUrl : await checkCache(trackId);

      if (cachedUrl) {
        // ⚡ BOOSTED - Play from cache instantly
        console.log('🎵 [VOYO] Playing BOOSTED');
        setPlaybackSource('cached');

        if (cachedUrlRef.current) URL.revokeObjectURL(cachedUrlRef.current);
        cachedUrlRef.current = cachedUrl;

        const { boostProfile: profile } = usePlayerStore.getState();
        setupAudioEnhancement(profile);

        if (audioRef.current) {
          audioRef.current.volume = 0;
          audioRef.current.src = cachedUrl;
          audioRef.current.load();

          audioRef.current.oncanplaythrough = () => {
            if (!audioRef.current) return;

            if (isInitialLoadRef.current && savedCurrentTime > 5) {
              audioRef.current.currentTime = savedCurrentTime;
              isInitialLoadRef.current = false;
            }

            // FIX: Get fresh state to avoid stale closure bug
            // The isPlaying from closure might be outdated when callback fires
            const { isPlaying: shouldPlay } = usePlayerStore.getState();
            if (shouldPlay && audioRef.current.paused) {
              audioContextRef.current?.state === 'suspended' && audioContextRef.current.resume();
              audioRef.current.play().then(() => {
                audioRef.current!.volume = 1.0;
                recordPlayEvent();
              }).catch(() => {});
            }
          };
        }
      } else {
        // 📡 NOT IN LOCAL CACHE - Check R2 collective cache before iframe
        console.log('🎵 [VOYO] Not in local cache, checking R2 collective...');

        const r2Result = await checkR2Cache(trackId);

        if (r2Result.exists && r2Result.url) {
          // 🚀 R2 HIT - Play from collective cache with EQ
          console.log('🎵 [VOYO] R2 HIT! Playing from collective cache');
          setPlaybackSource('r2');

          const { boostProfile: profile } = usePlayerStore.getState();
          setupAudioEnhancement(profile);

          if (audioRef.current) {
            audioRef.current.volume = 0;
            audioRef.current.src = r2Result.url;
            audioRef.current.load();

            audioRef.current.oncanplaythrough = () => {
              if (!audioRef.current) return;

              if (isInitialLoadRef.current && savedCurrentTime > 5) {
                audioRef.current.currentTime = savedCurrentTime;
                isInitialLoadRef.current = false;
              }

              const { isPlaying: shouldPlay } = usePlayerStore.getState();
              if (shouldPlay && audioRef.current.paused) {
                audioContextRef.current?.state === 'suspended' && audioContextRef.current.resume();
                audioRef.current.play().then(() => {
                  audioRef.current!.volume = 1.0;
                  recordPlayEvent();
                }).catch(() => {});
              }
            };
          }
        } else {
          // 📡 R2 MISS - Stream via iframe
          // Caching will trigger at 50% progress (genuine interest threshold)
          console.log('🎵 [VOYO] R2 miss, streaming via iframe (will cache at 50%)');
          setPlaybackSource('iframe');
        }
      }
    };

    loadTrack();

    return () => {
      if (cachedUrlRef.current) {
        URL.revokeObjectURL(cachedUrlRef.current);
        cachedUrlRef.current = null;
      }
    };
  }, [currentTrack?.trackId]);

  // Helper: Record play event
  const recordPlayEvent = useCallback(() => {
    if (hasRecordedPlayRef.current || !currentTrack) return;
    hasRecordedPlayRef.current = true;
    recordPoolEngagement(currentTrack.trackId, 'play');
    useTrackPoolStore.getState().recordPlay(currentTrack.trackId);
    recordTrackInSession(currentTrack, 0, false, false);
    djRecordPlay(currentTrack, false, false);
    oyoOnTrackPlay(currentTrack, previousTrackRef.current || undefined);
    viRegisterPlay(currentTrack.trackId, currentTrack.title, currentTrack.artist, 'user_play');
    previousTrackRef.current = currentTrack;
    console.log(`[VOYO] Recorded play: ${currentTrack.title}`);
  }, [currentTrack]);

  // === HOT-SWAP: When boost completes mid-stream ===
  // CRITICAL: Uses AbortController to prevent race conditions when track changes mid-swap
  useEffect(() => {
    if (!lastBoostCompletion || !currentTrack?.trackId) return;

    const completedId = lastBoostCompletion.trackId;
    const currentId = currentTrack.trackId.replace('VOYO_', '');
    const isCurrentTrackMatch = completedId === currentId || completedId === currentTrack.trackId;

    // Only hot-swap if currently streaming via iframe AND boost is for current track
    if (!isCurrentTrackMatch || playbackSource !== 'iframe') return;

    // Cancel any previous hot-swap operation to prevent race condition
    if (hotSwapAbortRef.current) {
      hotSwapAbortRef.current.abort();
      console.log('[VOYO] Cancelled previous hot-swap operation');
    }
    hotSwapAbortRef.current = new AbortController();
    const signal = hotSwapAbortRef.current.signal;
    const swapTrackId = currentTrack.trackId; // Capture at start

    console.log('🔄 [VOYO] Hot-swap: Boost complete, switching to cached audio...');

    const performHotSwap = async () => {
      // Check if aborted before starting
      if (signal.aborted) {
        console.log('[VOYO] Hot-swap aborted before start');
        return;
      }

      const cachedUrl = await checkCache(currentTrack.trackId);

      // Check AGAIN after async operation - track may have changed
      if (signal.aborted) {
        console.log('[VOYO] Hot-swap aborted after cache check');
        return;
      }

      // Double-verify we're still on the same track (belt and suspenders)
      const storeTrackId = usePlayerStore.getState().currentTrack?.trackId;
      if (storeTrackId !== swapTrackId) {
        console.log('[VOYO] Track changed during hot-swap, aborting. Expected:', swapTrackId, 'Got:', storeTrackId);
        return;
      }

      if (!cachedUrl || !audioRef.current) return;

      // Get current position from store (iframe was tracking it)
      const currentPos = usePlayerStore.getState().currentTime;

      // Switch to cached mode
      setPlaybackSource('cached');

      if (cachedUrlRef.current) URL.revokeObjectURL(cachedUrlRef.current);
      cachedUrlRef.current = cachedUrl;

      const { boostProfile: profile } = usePlayerStore.getState();
      setupAudioEnhancement(profile);

      audioRef.current.volume = 0;
      audioRef.current.src = cachedUrl;
      audioRef.current.load();

      audioRef.current.oncanplaythrough = () => {
        // Final check before applying - ensure we haven't been aborted
        if (signal.aborted) {
          console.log('[VOYO] Hot-swap aborted during canplaythrough');
          return;
        }
        if (!audioRef.current) return;

        // Resume from same position
        if (currentPos > 2) {
          audioRef.current.currentTime = currentPos;
        }

        if (isPlaying && audioRef.current.paused) {
          audioContextRef.current?.state === 'suspended' && audioContextRef.current.resume();
          audioRef.current.play().then(() => {
            audioRef.current!.volume = 1.0;
            console.log('🔄 [VOYO] Hot-swap complete! Now playing boosted audio');
          }).catch(() => {});
        }
      };
    };

    performHotSwap();

    // Cleanup: abort on unmount or when dependencies change
    return () => {
      if (hotSwapAbortRef.current) {
        hotSwapAbortRef.current.abort();
      }
    };
  }, [lastBoostCompletion, currentTrack?.trackId, playbackSource, isPlaying, checkCache, setPlaybackSource, setupAudioEnhancement]);

  // Handle play/pause (only when using audio element: cached or r2)
  useEffect(() => {
    if ((playbackSource !== 'cached' && playbackSource !== 'r2') || !audioRef.current) return;

    const audio = audioRef.current;
    if (isPlaying && audio.paused && audio.src && audio.readyState >= 1) {
      audio.play().catch(() => {});
    } else if (!isPlaying && !audio.paused) {
      audio.pause();
    }
  }, [isPlaying, playbackSource]);

  // Handle volume (only when using audio element: cached or r2)
  useEffect(() => {
    if ((playbackSource !== 'cached' && playbackSource !== 'r2') || !audioRef.current) return;

    if (audioEnhancedRef.current && gainNodeRef.current) {
      const profileGain = BOOST_PRESETS[currentProfileRef.current].gain;
      audioRef.current.volume = 1.0;
      gainNodeRef.current.gain.value = profileGain * (volume / 100);
    } else {
      audioRef.current.volume = volume / 100;
    }
  }, [volume, playbackSource]);

  // Handle seek (only when using audio element: cached or r2)
  useEffect(() => {
    if (seekPosition === null || (playbackSource !== 'cached' && playbackSource !== 'r2') || !audioRef.current) return;
    audioRef.current.currentTime = seekPosition;
    clearSeekPosition();
  }, [seekPosition, playbackSource, clearSeekPosition]);

  // Handle playback rate (only when using audio element: cached or r2)
  useEffect(() => {
    if ((playbackSource !== 'cached' && playbackSource !== 'r2') || !audioRef.current) return;
    audioRef.current.playbackRate = playbackRate;
  }, [playbackRate, playbackSource]);

  // Handle boost preset changes (only when using audio element: cached or r2)
  useEffect(() => {
    if ((playbackSource === 'cached' || playbackSource === 'r2') && audioEnhancedRef.current) {
      updateBoostPreset(boostProfile as BoostPreset);
    }
  }, [boostProfile, playbackSource, updateBoostPreset]);

  // Media Session (only when using audio element: cached or r2)
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentTrack || (playbackSource !== 'cached' && playbackSource !== 'r2')) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artist,
      album: 'VOYO Music',
      artwork: [{ src: `https://voyo-music-api.fly.dev/cdn/art/${currentTrack.trackId}?quality=high`, sizes: '512x512', type: 'image/jpeg' }]
    });

    navigator.mediaSession.setActionHandler('play', () => !usePlayerStore.getState().isPlaying && togglePlay());
    navigator.mediaSession.setActionHandler('pause', () => usePlayerStore.getState().isPlaying && togglePlay());
    navigator.mediaSession.setActionHandler('nexttrack', () => nextTrack());
    navigator.mediaSession.setActionHandler('previoustrack', () => usePlayerStore.getState().prevTrack());
    navigator.mediaSession.setActionHandler('seekto', (d) => d.seekTime !== undefined && audioRef.current && (audioRef.current.currentTime = d.seekTime));

    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [currentTrack, isPlaying, playbackSource, togglePlay, nextTrack]);

  // Audio element handlers (only active when using audio element: cached or r2)
  const handleTimeUpdate = useCallback(() => {
    if ((playbackSource !== 'cached' && playbackSource !== 'r2') || !audioRef.current?.duration) return;
    const el = audioRef.current;
    const progress = (el.currentTime / el.duration) * 100;
    setCurrentTime(el.currentTime);
    setProgress(progress);
    trackProgressRef.current = progress;

    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.setPositionState({
          duration: el.duration, playbackRate: el.playbackRate, position: el.currentTime
        });
      } catch (e) {}
    }
  }, [playbackSource, setCurrentTime, setProgress]);

  const handleDurationChange = useCallback(() => {
    if ((playbackSource !== 'cached' && playbackSource !== 'r2') || !audioRef.current?.duration) return;
    setDuration(audioRef.current.duration);
  }, [playbackSource, setDuration]);

  const handleEnded = useCallback(() => {
    if (playbackSource !== 'cached' && playbackSource !== 'r2') return;
    if (currentTrack) {
      endListenSession(audioRef.current?.currentTime || 0, 0);
      recordPoolEngagement(currentTrack.trackId, 'complete', { completionRate: trackProgressRef.current });
      useTrackPoolStore.getState().recordCompletion(currentTrack.trackId, trackProgressRef.current);
      oyoOnTrackComplete(currentTrack, audioRef.current?.currentTime || 0);
    }
    nextTrack();
  }, [playbackSource, currentTrack, nextTrack, endListenSession]);

  const handleProgress = useCallback(() => {
    if ((playbackSource !== 'cached' && playbackSource !== 'r2') || !audioRef.current?.buffered.length) return;
    const health = audioEngine.getBufferHealth(audioRef.current);
    setBufferHealth(health.percentage, health.status);
  }, [playbackSource, setBufferHealth]);

  return (
    <audio
      ref={audioRef}
      crossOrigin="anonymous"
      preload="auto"
      playsInline
      onTimeUpdate={handleTimeUpdate}
      onDurationChange={handleDurationChange}
      onEnded={handleEnded}
      onProgress={handleProgress}
      onPlaying={() => (playbackSource === 'cached' || playbackSource === 'r2') && setBufferHealth(100, 'healthy')}
      onWaiting={() => (playbackSource === 'cached' || playbackSource === 'r2') && setBufferHealth(50, 'warning')}
      onPause={() => {
        if (playbackSource !== 'cached' && playbackSource !== 'r2') return;
        const { isPlaying: shouldPlay } = usePlayerStore.getState();
        const audio = audioRef.current;
        // Removed 100ms delay - play immediately if should be playing
        if (shouldPlay && audio?.src && audio.readyState >= 1) {
          audio.play().catch(() => {});
        }
      }}
      style={{ display: 'none' }}
    />
  );
};

export default AudioPlayer;
