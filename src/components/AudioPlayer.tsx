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
import { usePlayerStore } from '../store/playerStore';
import { usePreferenceStore } from '../store/preferenceStore';
import { useDownloadStore } from '../store/downloadStore';
import { getYouTubeIdForIframe, prefetchTrack } from '../services/api';

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

  const {
    currentTrack,
    isPlaying,
    volume,
    seekPosition,
    playbackRate,
    boostProfile,
    setCurrentTime,
    setDuration,
    setProgress,
    clearSeekPosition,
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
  } = useDownloadStore();

  const lastTrackId = useRef<string | null>(null);
  const hasPrefetchedRef = useRef<boolean>(false); // Track if we've prefetched next track
  const hasAutoCachedRef = useRef<boolean>(false); // Track if we've auto-cached this track

  // Initialize download system (IndexedDB)
  useEffect(() => {
    initDownloads();
  }, [initDownloads]);

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

    // Destroy existing player and clean up DOM
    if (playerRef.current) {
      try {
        playerRef.current.destroy();
        playerRef.current = null;
      } catch (e) {
        // Ignore
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
          if (isPlaying) {
            event.target.playVideo();
          }
        },
        onStateChange: (event: any) => {
          const state = event.data;
          if (state === 0) { // ENDED
            nextTrack();
          } else if (state === 1) { // PLAYING
            setBufferHealth(100, 'healthy');
            // FIX: Smooth volume fade-in to prevent click sound
            // ALWAYS fade to 100% - AFRICAN BASS MODE
            const player = playerRef.current;
            if (player) {
              let currentVol = 0;
              const targetVol = 100; // Always max volume
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
          } else if (state === 3) { // BUFFERING
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
  }, [isPlaying, volume, nextTrack, setBufferHealth]);

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

      // End previous session
      if (lastTrackId.current && lastTrackId.current !== currentTrack.id) {
        const el = audioRef.current;
        endListenSession(el?.currentTime || 0, 0);
      }

      // Start new session
      startListenSession(currentTrack.id);
      lastTrackId.current = currentTrack.id;

      try {
        // 1. CHECK LOCAL CACHE FIRST (User's IndexedDB - Boosted tracks)
        console.log('🎵 AudioPlayer: Checking cache for trackId:', currentTrack.trackId, '| title:', currentTrack.title);
        const cachedUrl = await checkCache(currentTrack.trackId);
        console.log('🎵 AudioPlayer: Cache result:', cachedUrl ? '✅ FOUND (playing boosted!)' : '❌ Not cached (using iframe)');

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
              if (isPlaying && audioRef.current) {
                // Resume AudioContext if suspended (browser policy)
                if (audioContextRef.current?.state === 'suspended') {
                  audioContextRef.current.resume();
                }
                audioRef.current.play().then(() => {
                  // With Web Audio enhancement, volume is controlled by gain node
                  // Set audio element to 100% and let gain node handle boost
                  audioRef.current!.volume = 1.0;
                }).catch(err => {
                  console.warn('[VOYO] Cached playback failed:', err.message);
                });
              }
            };
          }
          return;
        }

        // 2. NOT CACHED - Use IFrame for instant playback
        // User can click "⚡ Boost HD" to download for next time

        // Stop audio element if it was playing previous cached track
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = '';
        }

        setPlaybackMode('iframe');
        setPlaybackSource('iframe');

        const ytId = getYouTubeIdForIframe(currentTrack.trackId);
        initIframePlayer(ytId);

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

  // Handle play/pause
  useEffect(() => {
    if (playbackMode === 'cached' && audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(err => {
          console.warn('[VOYO] Playback failed:', err.message);
          // Common on mobile - user needs to interact first
          // Don't spam errors, just log once
        });
      } else {
        audioRef.current.pause();
      }
    } else if (playbackMode === 'iframe' && playerRef.current) {
      try {
        if (isPlaying) {
          playerRef.current.playVideo();
        } else {
          playerRef.current.pauseVideo();
        }
      } catch (e) {
        // Player not ready yet
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
        // YouTube: max volume (100) - no Web Audio enhancement for iframe
        playerRef.current.setVolume(100);
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

            // 50% PREFETCH: Prefetch next track when 50% through current track (IFrame mode)
            const progressPercent = (currentTime / duration) * 100;
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
          sizes: '512x512',
          type: 'image/jpeg'
        }
      ]
    });

    // Set action handlers
    navigator.mediaSession.setActionHandler('play', () => {
      if (playbackMode === 'cached' && audioRef.current) {
        audioRef.current.play();
      } else if (playbackMode === 'iframe' && playerRef.current) {
        playerRef.current.playVideo();
      }
    });

    navigator.mediaSession.setActionHandler('pause', () => {
      if (playbackMode === 'cached' && audioRef.current) {
        audioRef.current.pause();
      } else if (playbackMode === 'iframe' && playerRef.current) {
        playerRef.current.pauseVideo();
      }
    });

    navigator.mediaSession.setActionHandler('nexttrack', () => {
      nextTrack();
    });

    navigator.mediaSession.setActionHandler('previoustrack', () => {
      // Get prevTrack from store
      const { prevTrack } = usePlayerStore.getState();
      prevTrack();
    });

    // Update playback state
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

  }, [currentTrack, isPlaying, playbackMode, nextTrack]);

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
      setProgress((el.currentTime / el.duration) * 100);

      // 50% PREFETCH: Prefetch next track when 50% through current track
      const progressPercent = (el.currentTime / el.duration) * 100;
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
  }, [setCurrentTime, setProgress]);

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
    }
    nextTrack();
  }, [nextTrack, currentTrack, endListenSession]);

  const handleProgress = useCallback(() => {
    const el = audioRef.current;
    if (!el || !el.buffered.length) return;

    const bufferedEnd = el.buffered.end(el.buffered.length - 1);
    const duration = el.duration || 1;
    const bufferPercent = (bufferedEnd / duration) * 100;

    if (bufferPercent > 80) {
      setBufferHealth(100, 'healthy');
    } else if (bufferPercent > 30) {
      setBufferHealth(bufferPercent, 'warning');
    } else {
      setBufferHealth(bufferPercent, 'emergency');
    }
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
