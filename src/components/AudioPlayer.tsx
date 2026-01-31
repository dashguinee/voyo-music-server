/**
 * VOYO Music - Audio Player with EQ Enhancement
 *
 * FLOW (No iframe dependency - 100% VOYO controlled):
 * 1. Check IndexedDB cache (local boost) → Play instantly with EQ
 * 2. Check R2 collective cache → Play with EQ (170K+ shared tracks)
 * 3. R2 miss → Extract via Edge Worker → Cache locally + contribute to R2 → Play with EQ
 *
 * PLAYBACK SOURCES:
 * - playbackSource === 'cached' → Local IndexedDB audio with full EQ
 * - playbackSource === 'r2' → R2 collective stream with full EQ
 *
 * AUDIO ENHANCEMENT (Web Audio API):
 * - Applies to ALL audio (cached + r2)
 * - 4 presets: Boosted, Calm, VOYEX (multiband mastering), Xtreme
 *
 * SMART BANDWIDTH:
 * - Preload next 3 tracks from DJ queue
 * - Quality upgrade at 50% interest (R2 low → high)
 * - User bandwidth contributes to collective R2 cache
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { Track } from '../types';
import { usePlayerStore } from '../store/playerStore';
import { devLog, devWarn } from '../utils/logger';
import { usePreferenceStore } from '../store/preferenceStore';
import { useDownloadStore } from '../store/downloadStore';
import { useTrackPoolStore } from '../store/trackPoolStore';
import { audioEngine } from '../services/audioEngine';
import { checkR2Cache } from '../services/api';
import { downloadTrack, getCachedTrackUrl } from '../services/downloadManager';

// Edge Worker for extraction (FREE - replaces Fly.io)
const EDGE_WORKER_URL = 'https://voyo-edge.dash-webtv.workers.dev';
import { recordPoolEngagement } from '../services/personalization';
import { recordTrackInSession } from '../services/poolCurator';
import { recordPlay as djRecordPlay } from '../services/intelligentDJ';
import { onTrackPlay as oyoOnTrackPlay, onTrackComplete as oyoOnTrackComplete } from '../services/oyoDJ';
import { registerTrackPlay as viRegisterPlay } from '../services/videoIntelligence';
import { useMiniPiP } from '../hooks/useMiniPiP';
import {
  preloadNextTrack,
  getPreloadedTrack,
  consumePreloadedAudio,
  cleanupPreloaded,
  cancelPreload,
} from '../services/preloadManager';

export type BoostPreset = 'off' | 'boosted' | 'calm' | 'voyex' | 'xtreme';

// Audio boost presets
const BOOST_PRESETS = {
  boosted: {
    gain: 1.15, highPassFreq: 0, bassFreq: 80, bassGain: 5, presenceFreq: 3000, presenceGain: 2,
    subBassFreq: 40, subBassGain: 2, warmthFreq: 250, warmthGain: 1,
    airFreq: 10000, airGain: 1, harmonicAmount: 0, stereoWidth: 0,
    compressor: { threshold: -12, knee: 10, ratio: 4, attack: 0.003, release: 0.25 }
  },
  calm: {
    gain: 1.05, highPassFreq: 0, bassFreq: 80, bassGain: 3, presenceFreq: 3000, presenceGain: 1,
    subBassFreq: 50, subBassGain: 1, warmthFreq: 250, warmthGain: 2,
    airFreq: 8000, airGain: 2, harmonicAmount: 0, stereoWidth: 0,
    compressor: { threshold: -15, knee: 15, ratio: 3, attack: 0.005, release: 0.3 }
  },
  voyex: {
    // PROFESSIONAL MASTERING: Multiband compression + stereo widening
    multiband: true, // Enable multiband processing
    gain: 1.4, highPassFreq: 25, stereoWidth: 0.015,
    // Band crossover frequencies
    lowCrossover: 180, // Below 180Hz = bass band
    highCrossover: 4500, // Above 4.5kHz = treble band
    // Per-band settings: gain, then compressor
    low: { gain: 1.3, threshold: -18, ratio: 5, attack: 0.01, release: 0.15 }, // Heavy bass control
    mid: { gain: 1.1, threshold: -12, ratio: 2, attack: 0.02, release: 0.25 }, // Gentle, dynamic mids
    high: { gain: 1.25, threshold: -15, ratio: 3, attack: 0.005, release: 0.1 }, // Crisp highs
    // Legacy (for fallback)
    bassFreq: 80, bassGain: 0, presenceFreq: 3000, presenceGain: 0,
    subBassFreq: 50, subBassGain: 0, warmthFreq: 280, warmthGain: 0,
    airFreq: 12000, airGain: 0, harmonicAmount: 8,
    compressor: { threshold: -6, knee: 10, ratio: 2, attack: 0.01, release: 0.2 }
  },
  xtreme: {
    gain: 1.35, highPassFreq: 0, bassFreq: 80, bassGain: 10, presenceFreq: 3000, presenceGain: 4,
    subBassFreq: 40, subBassGain: 7, warmthFreq: 250, warmthGain: 1,
    airFreq: 10000, airGain: 2, harmonicAmount: 20, stereoWidth: 0,
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
  const stereoDelayRef = useRef<DelayNode | null>(null);
  const stereoSplitterRef = useRef<ChannelSplitterNode | null>(null);
  const stereoMergerRef = useRef<ChannelMergerNode | null>(null);
  const highPassFilterRef = useRef<BiquadFilterNode | null>(null);
  // Multiband compression nodes (VOYEX mastering chain)
  const multibandLowFilterRef = useRef<BiquadFilterNode | null>(null);
  const multibandMidLowFilterRef = useRef<BiquadFilterNode | null>(null);
  const multibandMidHighFilterRef = useRef<BiquadFilterNode | null>(null);
  const multibandHighFilterRef = useRef<BiquadFilterNode | null>(null);
  const multibandLowCompRef = useRef<DynamicsCompressorNode | null>(null);
  const multibandMidCompRef = useRef<DynamicsCompressorNode | null>(null);
  const multibandHighCompRef = useRef<DynamicsCompressorNode | null>(null);
  const multibandLowGainRef = useRef<GainNode | null>(null);
  const multibandMidGainRef = useRef<GainNode | null>(null);
  const multibandHighGainRef = useRef<GainNode | null>(null);
  const audioEnhancedRef = useRef<boolean>(false);
  const currentProfileRef = useRef<BoostPreset>('boosted');

  // VOYEX Spatial Layer refs
  const spatialEnhancedRef = useRef<boolean>(false);
  const crossfeedLeftGainRef = useRef<GainNode | null>(null);
  const crossfeedRightGainRef = useRef<GainNode | null>(null);
  const panDepthGainRef = useRef<GainNode | null>(null);
  const panDepthYGainRef = useRef<GainNode | null>(null);
  const panDepthZGainRef = useRef<GainNode | null>(null);
  const diveLowPassRef = useRef<BiquadFilterNode | null>(null);
  const haasDelayRef = useRef<DelayNode | null>(null);
  const reverbDamping1Ref = useRef<BiquadFilterNode | null>(null);
  const reverbDamping2Ref = useRef<BiquadFilterNode | null>(null);
  const reverbDamping3Ref = useRef<BiquadFilterNode | null>(null);
  const reverbFeedback1Ref = useRef<GainNode | null>(null);
  const reverbFeedback2Ref = useRef<GainNode | null>(null);
  const reverbFeedback3Ref = useRef<GainNode | null>(null);
  const reverbWetGainRef = useRef<GainNode | null>(null);
  const subHarmonicGainRef = useRef<GainNode | null>(null);
  const spatialInputRef = useRef<GainNode | null>(null);

  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const lastTrackIdRef = useRef<string | null>(null);
  const previousTrackRef = useRef<Track | null>(null);
  const hasRecordedPlayRef = useRef<boolean>(false);
  const trackProgressRef = useRef<number>(0);
  const isInitialLoadRef = useRef<boolean>(true);
  const backgroundBoostingRef = useRef<string | null>(null);
  const hotSwapAbortRef = useRef<AbortController | null>(null);
  const hasTriggered50PercentCacheRef = useRef<boolean>(false); // 50% auto-boost trigger
  const hasTriggeredPreloadRef = useRef<boolean>(false); // 70% next-track preload trigger
  const shouldAutoResumeRef = useRef<boolean>(false); // Resume playback on refresh if position was saved

  // Store state
  const {
    currentTrack, isPlaying, volume, seekPosition, playbackRate, boostProfile, voyexSpatial,
    currentTime: savedCurrentTime, playbackSource, progress, queue,
    setCurrentTime, setDuration, setProgress, clearSeekPosition, togglePlay,
    nextTrack, predictNextTrack, setBufferHealth, setPlaybackSource,
  } = usePlayerStore();

  const { startListenSession, endListenSession } = usePreferenceStore();
  const { initialize: initDownloads, checkCache, cacheTrack, lastBoostCompletion, autoBoostEnabled, downloadSetting } = useDownloadStore();

  // Mini-PiP for background playback
  useMiniPiP();

  // Initialize downloads
  useEffect(() => {
    initDownloads();
  }, [initDownloads]);

  // 50% AUTO-BOOST: Trigger quality upgrade when user shows genuine interest
  // Works for: r2 low quality (upgrade to high)
  useEffect(() => {
    // Only trigger at 50% for r2 (for quality upgrade from low to high)
    if (playbackSource !== 'r2') return;
    if (hasTriggered50PercentCacheRef.current) return;
    if (progress < 50) return;
    if (!currentTrack?.trackId) return;

    // Check network preference (always | wifi-only | ask | never)
    if (downloadSetting === 'never') {
      devLog('🎵 [VOYO] 50% reached but download setting is "never"');
      return;
    }

    if (downloadSetting === 'wifi-only') {
      // Use Network Information API to detect wifi vs cellular
      const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
      const isWifi = !connection || connection.type === 'wifi' || connection.type === 'ethernet' || !connection.effectiveType?.includes('2g');
      if (!isWifi) {
        devLog('🎵 [VOYO] 50% reached but wifi-only setting blocks caching on mobile data');
        return;
      }
    }

    // 'always' and 'ask' both allow caching (ask prompts for manual boost, auto-cache is silent)

    // Mark as triggered to prevent duplicate calls
    hasTriggered50PercentCacheRef.current = true;

    const API_BASE = 'https://voyo-music-api.fly.dev';
    devLog('🎵 [VOYO] 50% reached! Upgrading R2 low quality to HIGH (genuine interest)');

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

  // PRELOAD: Start preloading next track IMMEDIATELY when track starts (like Spotify)
  // Major platforms don't wait - they start buffering the next track right away
  useEffect(() => {
    if (!currentTrack?.trackId) {
      return;
    }
    if (hasTriggeredPreloadRef.current) {
      // Already triggered for this track, skip
      return;
    }

    // Determine next track: check queue first, then use prediction
    let nextTrackToPreload: Track | null | undefined = queue[0]?.track;

    if (!nextTrackToPreload?.trackId) {
      // Queue empty - use predictNextTrack to determine what will play next
      nextTrackToPreload = predictNextTrack();
      if (!nextTrackToPreload?.trackId) {
        devLog(`🔮 [Preload] No next track available (queue empty, prediction empty)`);
        return;
      }
      devLog(`🔮 [Preload] Queue empty, using prediction: ${nextTrackToPreload.title}`);
    }

    // Start preload immediately - like Spotify/YouTube Music
    // Small delay (500ms) just to let current track establish playback first
    const timeoutId = setTimeout(() => {
      // Double-check we haven't triggered yet (race condition protection)
      if (hasTriggeredPreloadRef.current) return;

      // Verify track hasn't changed
      const currentState = usePlayerStore.getState();
      if (currentState.currentTrack?.trackId !== currentTrack.trackId) return;

      // Re-get next track in case queue changed
      let trackToPreload = currentState.queue[0]?.track || currentState.predictNextTrack();
      if (!trackToPreload?.trackId) return;

      hasTriggeredPreloadRef.current = true;

      devLog(`🔮 [VOYO] Preloading next track: ${trackToPreload.title}`);

      // Start preloading (async, non-blocking) - this buffers the audio data
      preloadNextTrack(trackToPreload.trackId, checkCache).then((result) => {
        if (result) {
          devLog(`🔮 [VOYO] ✅ Preload ready: ${trackToPreload!.title} (source: ${result.source})`);
        }
      }).catch((err) => {
        devWarn('🔮 [VOYO] Preload failed:', err);
      });
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [currentTrack?.trackId, queue, checkCache, predictNextTrack]);

  // PRELOAD CLEANUP: Cancel preload when track changes (user skipped to different track)
  useEffect(() => {
    return () => {
      cancelPreload();
    };
  }, [currentTrack?.trackId]);

  // Background playback + AudioContext battery optimization
  useEffect(() => {
    const handleVisibility = () => {
      const { isPlaying: shouldPlay } = usePlayerStore.getState();

      if (document.visibilityState === 'hidden') {
        // Tab hidden - if playing, keep AudioContext running for background playback
        if (shouldPlay && audioRef.current && (playbackSource === 'cached' || playbackSource === 'r2')) {
          if (audioContextRef.current?.state === 'suspended') {
            audioContextRef.current.resume();
          }
          audioRef.current.play().catch(e => devWarn('🎵 [Playback] Background resume failed:', e.name));
        }
        // If NOT playing and tab hidden, suspend AudioContext to save battery
        else if (!shouldPlay && audioContextRef.current?.state === 'running') {
          audioContextRef.current.suspend();
          devLog('🔋 [Battery] AudioContext suspended (tab hidden, not playing)');
        }
      } else {
        // Tab visible - resume AudioContext if it was suspended
        if (audioContextRef.current?.state === 'suspended' && shouldPlay) {
          audioContextRef.current.resume();
          devLog('🔋 [Battery] AudioContext resumed (tab visible)');
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
        await wakeLockRef.current.release().catch(e => devWarn('🔒 [WakeLock] Release failed:', e.name));
        wakeLockRef.current = null;
        return;
      }
      if (isPlaying && 'wakeLock' in navigator && !wakeLockRef.current) {
        try {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
        } catch (e) {
          devWarn('🔒 [WakeLock] Request failed:', (e as Error).name);
        }
      }
    };
    manageWakeLock();
    return () => { wakeLockRef.current?.release().catch(e => devWarn('🔒 [WakeLock] Cleanup release failed:', e.name)); };
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
      currentProfileRef.current = preset;

      // === VOYEX SPATIAL LAYER (created once, shared by all presets) ===
      const spInput = ctx.createGain(); spInput.gain.value = 1;
      spatialInputRef.current = spInput;

      const cfSplitter = ctx.createChannelSplitter(2);
      const cfMerger = ctx.createChannelMerger(2);
      const cfLD = ctx.createDelay(0.01); cfLD.delayTime.value = 0.0003;
      const cfLF = ctx.createBiquadFilter(); cfLF.type = 'lowpass'; cfLF.frequency.value = 6000;
      const cfLG = ctx.createGain(); cfLG.gain.value = 0; crossfeedLeftGainRef.current = cfLG;
      const cfRD = ctx.createDelay(0.01); cfRD.delayTime.value = 0.0003;
      const cfRF = ctx.createBiquadFilter(); cfRF.type = 'lowpass'; cfRF.frequency.value = 6000;
      const cfRG = ctx.createGain(); cfRG.gain.value = 0; crossfeedRightGainRef.current = cfRG;

      // DIVE low-pass: darkens main signal progressively (20kHz = transparent)
      const diveLP = ctx.createBiquadFilter(); diveLP.type = 'lowpass'; diveLP.frequency.value = 20000; diveLP.Q.value = 0.7;
      diveLowPassRef.current = diveLP;
      spInput.connect(diveLP);
      diveLP.connect(cfSplitter);
      cfSplitter.connect(cfMerger, 0, 0); cfSplitter.connect(cfMerger, 1, 1);
      cfSplitter.connect(cfLD, 0); cfLD.connect(cfLF); cfLF.connect(cfLG); cfLG.connect(cfMerger, 0, 1);
      cfSplitter.connect(cfRD, 1); cfRD.connect(cfRF); cfRF.connect(cfRG); cfRG.connect(cfMerger, 0, 0);

      // Organic stereo panner: 3 irrational-ratio LFOs for never-repeating movement
      const panner = ctx.createStereoPanner(); panner.pan.value = 0;
      const lfo1 = ctx.createOscillator(); lfo1.type = 'sine'; lfo1.frequency.value = 0.037;
      const lfo2 = ctx.createOscillator(); lfo2.type = 'sine'; lfo2.frequency.value = 0.071;
      const lfo3 = ctx.createOscillator(); lfo3.type = 'sine'; lfo3.frequency.value = 0.113;
      const panD = ctx.createGain(); panD.gain.value = 0; panDepthGainRef.current = panD;
      lfo1.connect(panD); lfo2.connect(panD); lfo3.connect(panD); panD.connect(panner.pan);
      lfo1.start(); lfo2.start(); lfo3.start();
      cfMerger.connect(panner);

      const hS = ctx.createChannelSplitter(2); const hM = ctx.createChannelMerger(2);
      const hD = ctx.createDelay(0.02); hD.delayTime.value = 0; haasDelayRef.current = hD;
      panner.connect(hS); hS.connect(hM, 0, 0); hS.connect(hD, 1); hD.connect(hM, 0, 1);
      hM.connect(ctx.destination);

      const rvbIn = ctx.createGain(); rvbIn.gain.value = 1;
      const rvbWet = ctx.createGain(); rvbWet.gain.value = 0; reverbWetGainRef.current = rvbWet;
      const rvbT = [0.037, 0.047, 0.059];
      const rvbDR = [reverbDamping1Ref, reverbDamping2Ref, reverbDamping3Ref];
      const rvbFR = [reverbFeedback1Ref, reverbFeedback2Ref, reverbFeedback3Ref];
      for (let i = 0; i < 3; i++) {
        const dl = ctx.createDelay(0.1); dl.delayTime.value = rvbT[i];
        const dm = ctx.createBiquadFilter(); dm.type = 'lowpass'; dm.frequency.value = 4000;
        const fb = ctx.createGain(); fb.gain.value = 0;
        rvbIn.connect(dl); dl.connect(dm); dm.connect(fb); fb.connect(dl); dm.connect(rvbWet);
        rvbDR[i].current = dm; rvbFR[i].current = fb;
      }
      spInput.connect(rvbIn); rvbWet.connect(ctx.destination);

      const sBP = ctx.createBiquadFilter(); sBP.type = 'bandpass'; sBP.frequency.value = 90; sBP.Q.value = 1;
      const sSh = ctx.createWaveShaper();
      const sC = new Float32Array(44100);
      for (let si = 0; si < 44100; si++) { const sx = (si * 2) / 44100 - 1; sC[si] = Math.tanh(sx * 3) * 0.8; }
      sSh.curve = sC; sSh.oversample = '2x';
      const sLP = ctx.createBiquadFilter(); sLP.type = 'lowpass'; sLP.frequency.value = 80;
      const sMx = ctx.createGain(); sMx.gain.value = 0; subHarmonicGainRef.current = sMx;
      spInput.connect(sBP); sBP.connect(sSh); sSh.connect(sLP); sLP.connect(sMx); sMx.connect(ctx.destination);

      spatialEnhancedRef.current = true;
      // All presets route final output → spInput → spatial chain → destination

      // 'off' = RAW AUDIO - bypass all EQ, connect directly to spatial input
      if (preset === 'off') {
        devLog('🎵 [VOYO] RAW mode - EQ bypassed');
        const source = ctx.createMediaElementSource(audioRef.current);
        sourceNodeRef.current = source;
        source.connect(spInput);
        audioEnhancedRef.current = true;
        return;
      }

      const settings = BOOST_PRESETS[preset] as any;

      const source = ctx.createMediaElementSource(audioRef.current);
      sourceNodeRef.current = source;

      // High-pass filter to cut rumble
      const highPass = ctx.createBiquadFilter();
      highPass.type = 'highpass';
      highPass.frequency.value = settings.highPassFreq || 20;
      highPass.Q.value = 0.7;
      highPassFilterRef.current = highPass;

      // Master gain at the end
      const masterGain = ctx.createGain();
      masterGain.gain.value = settings.gain;
      gainNodeRef.current = masterGain;

      // ═══════════════════════════════════════════════════════════════
      // VOYEX: Professional Multiband Compression Chain
      // ═══════════════════════════════════════════════════════════════
      if (settings.multiband) {
        devLog('🎛️ [VOYO] VOYEX Multiband Mastering Chain Active');

        // Create band-split filters (Linkwitz-Riley style crossover)
        // LOW BAND: lowpass at crossover frequency
        const lowFilter = ctx.createBiquadFilter();
        lowFilter.type = 'lowpass';
        lowFilter.frequency.value = settings.lowCrossover;
        lowFilter.Q.value = 0.5; // Gentle slope
        multibandLowFilterRef.current = lowFilter;

        // MID BAND: highpass at low crossover + lowpass at high crossover
        const midLowFilter = ctx.createBiquadFilter();
        midLowFilter.type = 'highpass';
        midLowFilter.frequency.value = settings.lowCrossover;
        midLowFilter.Q.value = 0.5;
        multibandMidLowFilterRef.current = midLowFilter;

        const midHighFilter = ctx.createBiquadFilter();
        midHighFilter.type = 'lowpass';
        midHighFilter.frequency.value = settings.highCrossover;
        midHighFilter.Q.value = 0.5;
        multibandMidHighFilterRef.current = midHighFilter;

        // HIGH BAND: highpass at high crossover frequency
        const highFilter = ctx.createBiquadFilter();
        highFilter.type = 'highpass';
        highFilter.frequency.value = settings.highCrossover;
        highFilter.Q.value = 0.5;
        multibandHighFilterRef.current = highFilter;

        // Per-band gain nodes
        const lowGain = ctx.createGain();
        lowGain.gain.value = settings.low.gain;
        multibandLowGainRef.current = lowGain;

        const midGain = ctx.createGain();
        midGain.gain.value = settings.mid.gain;
        multibandMidGainRef.current = midGain;

        const highGain = ctx.createGain();
        highGain.gain.value = settings.high.gain;
        multibandHighGainRef.current = highGain;

        // Per-band compressors
        const lowComp = ctx.createDynamicsCompressor();
        lowComp.threshold.value = settings.low.threshold;
        lowComp.knee.value = 6;
        lowComp.ratio.value = settings.low.ratio;
        lowComp.attack.value = settings.low.attack;
        lowComp.release.value = settings.low.release;
        multibandLowCompRef.current = lowComp;

        const midComp = ctx.createDynamicsCompressor();
        midComp.threshold.value = settings.mid.threshold;
        midComp.knee.value = 10;
        midComp.ratio.value = settings.mid.ratio;
        midComp.attack.value = settings.mid.attack;
        midComp.release.value = settings.mid.release;
        multibandMidCompRef.current = midComp;

        const highComp = ctx.createDynamicsCompressor();
        highComp.threshold.value = settings.high.threshold;
        highComp.knee.value = 8;
        highComp.ratio.value = settings.high.ratio;
        highComp.attack.value = settings.high.attack;
        highComp.release.value = settings.high.release;
        multibandHighCompRef.current = highComp;

        // Harmonic exciter for warmth
        const harmonic = ctx.createWaveShaper();
        if (settings.harmonicAmount > 0) {
          harmonic.curve = makeHarmonicCurve(settings.harmonicAmount);
          harmonic.oversample = '2x';
        }
        harmonicExciterRef.current = harmonic;

        // Band merger (sum the 3 bands)
        const bandMerger = ctx.createGain();
        bandMerger.gain.value = 1.0;

        // Connect: source → highPass → [3 parallel bands] → merger → harmonic → stereo → master
        source.connect(highPass);

        // LOW band chain
        highPass.connect(lowFilter);
        lowFilter.connect(lowGain);
        lowGain.connect(lowComp);
        lowComp.connect(bandMerger);

        // MID band chain
        highPass.connect(midLowFilter);
        midLowFilter.connect(midHighFilter);
        midHighFilter.connect(midGain);
        midGain.connect(midComp);
        midComp.connect(bandMerger);

        // HIGH band chain
        highPass.connect(highFilter);
        highFilter.connect(highGain);
        highGain.connect(highComp);
        highComp.connect(bandMerger);

        // Harmonic exciter after band merge
        bandMerger.connect(harmonic);

        // Stereo widening
        if (settings.stereoWidth > 0) {
          const splitter = ctx.createChannelSplitter(2);
          const merger = ctx.createChannelMerger(2);
          const delayL = ctx.createDelay(0.1);
          const delayR = ctx.createDelay(0.1);
          delayL.delayTime.value = 0;
          delayR.delayTime.value = settings.stereoWidth;
          stereoSplitterRef.current = splitter;
          stereoMergerRef.current = merger;
          stereoDelayRef.current = delayR;

          harmonic.connect(splitter);
          splitter.connect(delayL, 0);
          splitter.connect(delayR, 1);
          delayL.connect(merger, 0, 0);
          delayR.connect(merger, 0, 1);
          merger.connect(masterGain);
        } else {
          harmonic.connect(masterGain);
        }

        masterGain.connect(spInput);
        audioEnhancedRef.current = true;
        devLog('🎛️ [VOYO] Multiband: LOW(<180Hz) 5:1 | MID(180-4.5k) 2:1 | HIGH(>4.5k) 3:1');
        return;
      }

      // ═══════════════════════════════════════════════════════════════
      // Standard EQ Chain (Warm, Calm, etc.)
      // ═══════════════════════════════════════════════════════════════
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

      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = settings.compressor.threshold;
      comp.knee.value = settings.compressor.knee;
      comp.ratio.value = settings.compressor.ratio;
      comp.attack.value = settings.compressor.attack;
      comp.release.value = settings.compressor.release;
      compressorRef.current = comp;

      // Connect standard EQ chain
      source.connect(highPass);
      highPass.connect(subBass);
      subBass.connect(bass);
      bass.connect(warmth);
      warmth.connect(harmonic);
      harmonic.connect(presence);
      presence.connect(air);
      air.connect(masterGain);

      // Stereo widening for non-multiband presets
      if (settings.stereoWidth > 0) {
        const splitter = ctx.createChannelSplitter(2);
        const merger = ctx.createChannelMerger(2);
        const delayL = ctx.createDelay(0.1);
        const delayR = ctx.createDelay(0.1);
        delayL.delayTime.value = 0;
        delayR.delayTime.value = settings.stereoWidth;
        stereoSplitterRef.current = splitter;
        stereoMergerRef.current = merger;
        stereoDelayRef.current = delayR;

        masterGain.connect(splitter);
        splitter.connect(delayL, 0);
        splitter.connect(delayR, 1);
        delayL.connect(merger, 0, 0);
        delayR.connect(merger, 0, 1);
        merger.connect(comp);
        comp.connect(spInput);
      } else {
        masterGain.connect(comp);
        comp.connect(spInput);
      }

      audioEnhancedRef.current = true;
      devLog(`🎵 [VOYO] Boost EQ active: ${preset.toUpperCase()}`);
    } catch (e) {
      devWarn('[VOYO] Audio enhancement failed:', e);
    }
  }, []);

  // Update preset dynamically
  const updateBoostPreset = useCallback((preset: BoostPreset) => {
    if (!audioEnhancedRef.current) return;
    currentProfileRef.current = preset;

    // 'off' = RAW AUDIO - set all EQ to neutral (bypass)
    if (preset === 'off') {
      subBassFilterRef.current && (subBassFilterRef.current.gain.value = 0);
      bassFilterRef.current && (bassFilterRef.current.gain.value = 0);
      warmthFilterRef.current && (warmthFilterRef.current.gain.value = 0);
      presenceFilterRef.current && (presenceFilterRef.current.gain.value = 0);
      airFilterRef.current && (airFilterRef.current.gain.value = 0);
      gainNodeRef.current && (gainNodeRef.current.gain.value = 1.0); // Unity gain
      harmonicExciterRef.current && (harmonicExciterRef.current.curve = null);
      // Compressor to transparent settings
      if (compressorRef.current) {
        compressorRef.current.threshold.value = 0;
        compressorRef.current.ratio.value = 1;
      }
      // Multiband compressors to transparent
      multibandLowGainRef.current && (multibandLowGainRef.current.gain.value = 1.0);
      multibandMidGainRef.current && (multibandMidGainRef.current.gain.value = 1.0);
      multibandHighGainRef.current && (multibandHighGainRef.current.gain.value = 1.0);
      if (multibandLowCompRef.current) {
        multibandLowCompRef.current.threshold.value = 0;
        multibandLowCompRef.current.ratio.value = 1;
      }
      if (multibandMidCompRef.current) {
        multibandMidCompRef.current.threshold.value = 0;
        multibandMidCompRef.current.ratio.value = 1;
      }
      if (multibandHighCompRef.current) {
        multibandHighCompRef.current.threshold.value = 0;
        multibandHighCompRef.current.ratio.value = 1;
      }
      devLog('🎵 [VOYO] RAW mode - EQ bypassed');
      return;
    }

    const s = BOOST_PRESETS[preset];

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
    devLog(`🎵 [VOYO] Switched to ${preset.toUpperCase()}`);
  }, []);

  // Update VOYEX Spatial slider — controls spatial layer + shifts multiband mastering character
  const updateVoyexSpatial = useCallback((value: number) => {
    if (!spatialEnhancedRef.current) return;
    const v = Math.max(-100, Math.min(100, value));

    // --- Multiband mastering shift (subtle, always active) ---
    // DIV: warmer mastering (boost lows, soften highs)
    // IMM: open mastering (brighten highs, present mids)
    // Center: default VOYEX mastering
    const slider01 = v / 100; // -1 to +1
    if (multibandLowGainRef.current && multibandMidGainRef.current && multibandHighGainRef.current) {
      // Base gains from VOYEX preset: low=1.3, mid=1.1, high=1.25
      if (v < 0) {
        const i = Math.abs(slider01);
        multibandLowGainRef.current.gain.value = 1.3 + (i * 0.2);   // 1.3 → 1.5 (warmer)
        multibandMidGainRef.current.gain.value = 1.1;                 // untouched (clean vocals)
        multibandHighGainRef.current.gain.value = 1.25 - (i * 0.15); // 1.25 → 1.1 (softer)
      } else if (v > 0) {
        const i = slider01;
        multibandLowGainRef.current.gain.value = 1.3;                 // solid bass
        multibandMidGainRef.current.gain.value = 1.1 + (i * 0.1);    // 1.1 → 1.2 (vocal presence)
        multibandHighGainRef.current.gain.value = 1.25 + (i * 0.15); // 1.25 → 1.4 (air, sparkle)
      } else {
        multibandLowGainRef.current.gain.value = 1.3;
        multibandMidGainRef.current.gain.value = 1.1;
        multibandHighGainRef.current.gain.value = 1.25;
      }
    }

    // --- Spatial layer ---
    if (v === 0) {
      // TRUE BYPASS - all spatial effects off, multiband at default
      crossfeedLeftGainRef.current && (crossfeedLeftGainRef.current.gain.value = 0);
      crossfeedRightGainRef.current && (crossfeedRightGainRef.current.gain.value = 0);
      panDepthGainRef.current && (panDepthGainRef.current.gain.value = 0);
      haasDelayRef.current && (haasDelayRef.current.delayTime.value = 0);
      diveLowPassRef.current && (diveLowPassRef.current.frequency.value = 20000);
      reverbWetGainRef.current && (reverbWetGainRef.current.gain.value = 0);
      reverbFeedback1Ref.current && (reverbFeedback1Ref.current.gain.value = 0);
      reverbFeedback2Ref.current && (reverbFeedback2Ref.current.gain.value = 0);
      reverbFeedback3Ref.current && (reverbFeedback3Ref.current.gain.value = 0);
      reverbDamping1Ref.current && (reverbDamping1Ref.current.frequency.value = 4000);
      reverbDamping2Ref.current && (reverbDamping2Ref.current.frequency.value = 4000);
      reverbDamping3Ref.current && (reverbDamping3Ref.current.frequency.value = 4000);
      subHarmonicGainRef.current && (subHarmonicGainRef.current.gain.value = 0);
      devLog('🎛️ [VOYO] Spatial: BALANCE (bypass)');
      return;
    }

    if (v < 0) {
      // DIVE: warm crossfeed + dark reverb + sub + gentle darkening
      const intensity = Math.abs(v) / 100;
      crossfeedLeftGainRef.current && (crossfeedLeftGainRef.current.gain.value = intensity * 0.28);
      crossfeedRightGainRef.current && (crossfeedRightGainRef.current.gain.value = intensity * 0.28);
      diveLowPassRef.current && (diveLowPassRef.current.frequency.value = 20000 - (intensity * 11200));
      reverbWetGainRef.current && (reverbWetGainRef.current.gain.value = intensity * 0.24);
      reverbFeedback1Ref.current && (reverbFeedback1Ref.current.gain.value = 0.7);
      reverbFeedback2Ref.current && (reverbFeedback2Ref.current.gain.value = 0.7);
      reverbFeedback3Ref.current && (reverbFeedback3Ref.current.gain.value = 0.7);
      const dampFreq = 4000 - (intensity * 1400);
      reverbDamping1Ref.current && (reverbDamping1Ref.current.frequency.value = dampFreq);
      reverbDamping2Ref.current && (reverbDamping2Ref.current.frequency.value = dampFreq);
      reverbDamping3Ref.current && (reverbDamping3Ref.current.frequency.value = dampFreq);
      subHarmonicGainRef.current && (subHarmonicGainRef.current.gain.value = intensity * 0.14);
      // IMMERSE off
      panDepthGainRef.current && (panDepthGainRef.current.gain.value = 0);
      haasDelayRef.current && (haasDelayRef.current.delayTime.value = 0);
      devLog(`🎛️ [VOYO] Spatial: DIVE ${Math.round(intensity * 100)}%`);
    } else {
      // IMMERSE: spatial presence with smooth 8D surround in last 20%
      const intensity = v / 100;

      // Pan depth + Haas: gentle 0-80%, surround opens up 80-100%
      // Continuous curve — no discontinuity, no clicks
      let panDepth: number;
      let haas: number;
      if (intensity <= 0.8) {
        // 0-80%: subtle enhancement zone
        panDepth = intensity * 0.15;           // 0 → 0.12
        haas = intensity * 0.002;              // 0 → 1.6ms
      } else {
        // 80-100%: surround zone — opens up smoothly
        const surround = (intensity - 0.8) / 0.2; // 0→1 within last 20%
        panDepth = 0.12 + (surround * 0.18);  // 0.12 → 0.30
        haas = 0.0016 + (surround * 0.002);   // 1.6ms → 3.6ms
      }

      panDepthGainRef.current && (panDepthGainRef.current.gain.value = panDepth);
      haasDelayRef.current && (haasDelayRef.current.delayTime.value = haas);
      diveLowPassRef.current && (diveLowPassRef.current.frequency.value = 20000);
      reverbWetGainRef.current && (reverbWetGainRef.current.gain.value = intensity * 0.15);
      reverbFeedback1Ref.current && (reverbFeedback1Ref.current.gain.value = 0.5);
      reverbFeedback2Ref.current && (reverbFeedback2Ref.current.gain.value = 0.5);
      reverbFeedback3Ref.current && (reverbFeedback3Ref.current.gain.value = 0.5);
      const dampFreq = 4000 + (intensity * 2500);
      reverbDamping1Ref.current && (reverbDamping1Ref.current.frequency.value = dampFreq);
      reverbDamping2Ref.current && (reverbDamping2Ref.current.frequency.value = dampFreq);
      reverbDamping3Ref.current && (reverbDamping3Ref.current.frequency.value = dampFreq);
      subHarmonicGainRef.current && (subHarmonicGainRef.current.gain.value = intensity * 0.07);
      // DIVE off
      crossfeedLeftGainRef.current && (crossfeedLeftGainRef.current.gain.value = 0);
      crossfeedRightGainRef.current && (crossfeedRightGainRef.current.gain.value = 0);
      devLog(`🎛️ [VOYO] Spatial: IMMERSE ${Math.round(intensity * 100)}%${intensity > 0.8 ? ' [SURROUND]' : ''}`);
    }
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

      // RESUME FIX: On initial load, if we have a saved position > 5s, auto-resume playback
      // This fixes the bug where track seeks correctly on refresh but audio doesn't play
      if (isInitialLoadRef.current && savedCurrentTime > 5) {
        shouldAutoResumeRef.current = true;
        devLog(`🔄 [VOYO] Session resume detected (position: ${savedCurrentTime.toFixed(1)}s) - will auto-play`);
      }

      lastTrackIdRef.current = trackId;
      hasRecordedPlayRef.current = false;
      trackProgressRef.current = 0;
      hasTriggered50PercentCacheRef.current = false; // Reset 50% trigger for new track
      hasTriggeredPreloadRef.current = false; // Reset preload trigger for new track

      // End previous session
      endListenSession(audioRef.current?.currentTime || 0, 0);
      startListenSession(currentTrack.id, currentTrack.duration || 0);

      // PRELOAD CHECK: Use preloaded audio if available (instant playback!)
      const preloaded = getPreloadedTrack(trackId);
      if (preloaded && preloaded.audioElement && (preloaded.source === 'cached' || preloaded.source === 'r2')) {
        devLog(`🔮 [VOYO] Using PRELOADED audio (source: ${preloaded.source})`);

        // Consume the preloaded audio element
        const preloadedAudio = consumePreloadedAudio(trackId);
        if (preloadedAudio) {
          setPlaybackSource(preloaded.source);

          const { boostProfile: profile } = usePlayerStore.getState();
          setupAudioEnhancement(profile);

          // Replace our audio ref with preloaded one? No - we need to use our own ref
          // Instead, copy the src from preloaded element
          if (cachedUrlRef.current) URL.revokeObjectURL(cachedUrlRef.current);
          cachedUrlRef.current = preloaded.url;

          if (audioRef.current && preloaded.url) {
            audioRef.current.volume = 0;
            audioRef.current.src = preloaded.url;
            audioRef.current.load();

            // Since we preloaded, audio should be ready almost instantly
            audioRef.current.oncanplaythrough = () => {
              if (!audioRef.current) return;

              const { isPlaying: shouldPlay } = usePlayerStore.getState();
              if (shouldPlay && audioRef.current.paused) {
                audioContextRef.current?.state === 'suspended' && audioContextRef.current.resume();
                audioRef.current.play().then(() => {
                  audioRef.current!.volume = 1.0;
                  recordPlayEvent();
                  devLog('🔮 [VOYO] Preloaded playback started!');
                }).catch(e => devWarn('🎵 [Playback] Preloaded play failed:', e.name));
              }
            };
          }

          // Cleanup the preloaded element
          preloadedAudio.pause();
          preloadedAudio.src = '';
          return; // Skip normal loading flow
        }
      }

      // Normal loading flow: Check cache first
      const API_BASE = 'https://voyo-music-api.fly.dev';
      const { url: bestUrl, cached: fromCache } = audioEngine.getBestAudioUrl(trackId, API_BASE);
      const cachedUrl = fromCache ? bestUrl : await checkCache(trackId);

      if (cachedUrl) {
        // ⚡ BOOSTED - Play from cache instantly
        devLog('🎵 [VOYO] Playing BOOSTED');
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

            // Restore position on initial load
            if (isInitialLoadRef.current && savedCurrentTime > 5) {
              audioRef.current.currentTime = savedCurrentTime;
              isInitialLoadRef.current = false;
            }

            // FIX: Get fresh state to avoid stale closure bug
            // The isPlaying from closure might be outdated when callback fires
            const { isPlaying: shouldPlay } = usePlayerStore.getState();

            // RESUME FIX: Also auto-play if we detected a session resume (even if isPlaying is false)
            const shouldAutoResume = shouldAutoResumeRef.current;
            if (shouldAutoResume) {
              shouldAutoResumeRef.current = false; // Only auto-resume once
            }

            if ((shouldPlay || shouldAutoResume) && audioRef.current.paused) {
              audioContextRef.current?.state === 'suspended' && audioContextRef.current.resume();
              audioRef.current.play().then(() => {
                audioRef.current!.volume = 1.0;
                recordPlayEvent();
                // Update store to reflect playing state if we auto-resumed
                if (shouldAutoResume && !shouldPlay) {
                  usePlayerStore.getState().togglePlay();
                }
                devLog('🎵 [VOYO] Playback started (cached)');
              }).catch(e => devWarn('🎵 [Playback] Cached play failed:', e.name));
            }
          };
        }
      } else {
        // 📡 NOT IN LOCAL CACHE - Check R2 collective cache before iframe
        devLog('🎵 [VOYO] Not in local cache, checking R2 collective...');

        const r2Result = await checkR2Cache(trackId);

        if (r2Result.exists && r2Result.url) {
          // 🚀 R2 HIT - Play from collective cache with EQ
          const qualityInfo = r2Result.hasHigh ? 'HIGH' : 'LOW';
          devLog(`🎵 [VOYO] R2 HIT! Playing from collective cache (${qualityInfo} quality)`);
          setPlaybackSource('r2');

          // PHASE 5: Track if low quality - will upgrade at 50%
          if (!r2Result.hasHigh && r2Result.hasLow) {
            devLog('🎵 [VOYO] Low quality R2 - will upgrade at 50% interest');
            hasTriggered50PercentCacheRef.current = false; // Allow upgrade trigger
          }

          const { boostProfile: profile } = usePlayerStore.getState();
          setupAudioEnhancement(profile);

          if (audioRef.current) {
            audioRef.current.volume = 0;
            audioRef.current.src = r2Result.url;
            audioRef.current.load();

            audioRef.current.oncanplaythrough = () => {
              if (!audioRef.current) return;

              // Restore position on initial load
              if (isInitialLoadRef.current && savedCurrentTime > 5) {
                audioRef.current.currentTime = savedCurrentTime;
                isInitialLoadRef.current = false;
              }

              const { isPlaying: shouldPlay } = usePlayerStore.getState();

              // RESUME FIX: Also auto-play if we detected a session resume (even if isPlaying is false)
              const shouldAutoResume = shouldAutoResumeRef.current;
              if (shouldAutoResume) {
                shouldAutoResumeRef.current = false; // Only auto-resume once
              }

              if ((shouldPlay || shouldAutoResume) && audioRef.current.paused) {
                audioContextRef.current?.state === 'suspended' && audioContextRef.current.resume();
                audioRef.current.play().then(() => {
                  audioRef.current!.volume = 1.0;
                  recordPlayEvent();
                  // Update store to reflect playing state if we auto-resumed
                  if (shouldAutoResume && !shouldPlay) {
                    usePlayerStore.getState().togglePlay();
                  }
                  devLog('🎵 [VOYO] Playback started (R2)');
                }).catch(e => devWarn('🎵 [Playback] R2 play failed:', e.name));
              }
            };
          }
        } else {
          // 📡 R2 MISS - Get direct YouTube URL, stream via browser
          // Browser fetches from YouTube CDN directly (no CORS issues with audio element)
          devLog('🎵 [VOYO] R2 miss, getting stream URL...');

          try {
            // Get the direct YouTube audio URL from our worker
            const streamResponse = await fetch(`${EDGE_WORKER_URL}/stream?v=${trackId}`);
            const streamData = await streamResponse.json();

            if (!streamData.url) {
              console.error('🚨 [VOYO] No stream URL available');
              return;
            }

            devLog(`🎵 [VOYO] Got stream URL (${streamData.bitrate}bps ${streamData.mimeType})`);
            setPlaybackSource('cached'); // Treat as cached for EQ purposes

            const { boostProfile: profile } = usePlayerStore.getState();
            setupAudioEnhancement(profile);

            if (audioRef.current) {
              audioRef.current.volume = 0;
              audioRef.current.src = streamData.url; // Browser fetches directly from YouTube CDN
              audioRef.current.load();

              audioRef.current.oncanplaythrough = () => {
                if (!audioRef.current) return;

                if (isInitialLoadRef.current && savedCurrentTime > 5) {
                  audioRef.current.currentTime = savedCurrentTime;
                  isInitialLoadRef.current = false;
                }

                const { isPlaying: shouldPlay } = usePlayerStore.getState();
                const shouldAutoResume = shouldAutoResumeRef.current;
                if (shouldAutoResume) {
                  shouldAutoResumeRef.current = false;
                }

                if ((shouldPlay || shouldAutoResume) && audioRef.current.paused) {
                  audioContextRef.current?.state === 'suspended' && audioContextRef.current.resume();
                  audioRef.current.play().then(() => {
                    audioRef.current!.volume = 1.0;
                    recordPlayEvent();
                    if (shouldAutoResume && !shouldPlay) {
                      usePlayerStore.getState().togglePlay();
                    }
                    devLog('🎵 [VOYO] Playback started (YouTube direct stream)');
                  }).catch(e => devWarn('🎵 [Playback] Stream play failed:', e.name));
                }
              };

              // BACKGROUND: Download to cache after playback starts (non-blocking)
              audioRef.current.onplay = () => {
                // Start background caching after 5 seconds of playback (genuine interest)
                setTimeout(() => {
                  const currentState = usePlayerStore.getState();
                  if (currentState.currentTrack?.trackId === trackId && currentState.isPlaying) {
                    devLog('🎵 [VOYO] Starting background cache for streaming track');
                    cacheTrack(
                      trackId,
                      currentTrack.title,
                      currentTrack.artist,
                      currentTrack.duration || 0,
                      `https://voyo-music-api.fly.dev/cdn/art/${trackId}?quality=high`
                    );
                  }
                }, 5000);
              };
            }
          } catch (streamError) {
            console.error('🚨 [VOYO] Stream error:', streamError);
          }
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
    devLog(`[VOYO] Recorded play: ${currentTrack.title}`);
  }, [currentTrack]);

  // === HOT-SWAP: When boost completes mid-stream (R2 → cached upgrade) ===
  // CRITICAL: Uses AbortController to prevent race conditions when track changes mid-swap
  useEffect(() => {
    if (!lastBoostCompletion || !currentTrack?.trackId) return;

    const completedId = lastBoostCompletion.trackId;
    const currentId = currentTrack.trackId.replace('VOYO_', '');
    const isCurrentTrackMatch = completedId === currentId || completedId === currentTrack.trackId;

    // Only hot-swap if currently streaming via R2 AND boost is for current track
    // This upgrades from R2 (potentially low quality) to local cached (high quality)
    if (!isCurrentTrackMatch || playbackSource !== 'r2') return;

    // Cancel any previous hot-swap operation to prevent race condition
    if (hotSwapAbortRef.current) {
      hotSwapAbortRef.current.abort();
      devLog('[VOYO] Cancelled previous hot-swap operation');
    }
    hotSwapAbortRef.current = new AbortController();
    const signal = hotSwapAbortRef.current.signal;
    const swapTrackId = currentTrack.trackId; // Capture at start

    devLog('🔄 [VOYO] Hot-swap: Boost complete, upgrading R2 to cached audio...');

    const performHotSwap = async () => {
      // Check if aborted before starting
      if (signal.aborted) {
        devLog('[VOYO] Hot-swap aborted before start');
        return;
      }

      const cachedUrl = await checkCache(currentTrack.trackId);

      // Check AGAIN after async operation - track may have changed
      if (signal.aborted) {
        devLog('[VOYO] Hot-swap aborted after cache check');
        return;
      }

      // Double-verify we're still on the same track (belt and suspenders)
      const storeTrackId = usePlayerStore.getState().currentTrack?.trackId;
      if (storeTrackId !== swapTrackId) {
        devLog('[VOYO] Track changed during hot-swap, aborting. Expected:', swapTrackId, 'Got:', storeTrackId);
        return;
      }

      if (!cachedUrl || !audioRef.current) return;

      // Get current position from store (iframe was tracking it)
      const currentPos = usePlayerStore.getState().currentTime;

      // IMPORTANT: Don't switch playbackSource yet - iframe keeps playing until audio is ready
      // This prevents the "stop" bug when boost completes fast

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
          devLog('[VOYO] Hot-swap aborted during canplaythrough');
          return;
        }
        if (!audioRef.current) return;

        // Resume from same position
        if (currentPos > 2) {
          audioRef.current.currentTime = currentPos;
        }

        // FIX: Get fresh state to avoid stale closure bug
        // The isPlaying from the outer closure could be outdated when this callback fires
        const { isPlaying: shouldPlayNow } = usePlayerStore.getState();

        // FIXED: Only switch playbackSource AFTER audio element is ready
        // This ensures iframe keeps playing until cached audio can take over seamlessly
        if (shouldPlayNow && audioRef.current.paused) {
          audioContextRef.current?.state === 'suspended' && audioContextRef.current.resume();
          audioRef.current.play().then(() => {
            // NOW switch to cached mode - audio is playing, safe to mute iframe
            setPlaybackSource('cached');
            audioRef.current!.volume = 1.0;
            devLog('🔄 [VOYO] Hot-swap complete! Now playing boosted audio');
          }).catch((err) => {
            // Play failed - don't switch source, keep iframe playing
            devLog('[VOYO] Hot-swap play failed, keeping iframe:', err);
          });
        } else if (!shouldPlayNow) {
          // Paused state - switch source but don't play
          setPlaybackSource('cached');
          devLog('🔄 [VOYO] Hot-swap ready (paused state)');
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
  // Also suspend AudioContext when paused to save battery
  useEffect(() => {
    if ((playbackSource !== 'cached' && playbackSource !== 'r2') || !audioRef.current) return;

    const audio = audioRef.current;
    if (isPlaying && audio.paused && audio.src && audio.readyState >= 1) {
      // Resume AudioContext if suspended, then play
      if (audioContextRef.current?.state === 'suspended') {
        audioContextRef.current.resume();
      }
      audio.play().catch(e => devWarn('🎵 [Playback] Resume play failed:', e.name));
    } else if (!isPlaying && !audio.paused) {
      audio.pause();
    }
  }, [isPlaying, playbackSource]);

  // Suspend AudioContext when paused + hidden (delayed to allow quick resume)
  const suspendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    // Clear any pending suspend timer
    if (suspendTimerRef.current) {
      clearTimeout(suspendTimerRef.current);
      suspendTimerRef.current = null;
    }

    // Only set suspend timer when not playing
    if (!isPlaying && (playbackSource === 'cached' || playbackSource === 'r2')) {
      suspendTimerRef.current = setTimeout(() => {
        if (!usePlayerStore.getState().isPlaying && document.visibilityState === 'hidden') {
          audioContextRef.current?.suspend();
          devLog('🔋 [Battery] AudioContext suspended (paused + hidden)');
        }
        suspendTimerRef.current = null;
      }, 5000);
    }

    return () => {
      if (suspendTimerRef.current) {
        clearTimeout(suspendTimerRef.current);
        suspendTimerRef.current = null;
      }
    };
  }, [isPlaying, playbackSource]);

  // Handle volume (only when using audio element: cached or r2)
  useEffect(() => {
    if ((playbackSource !== 'cached' && playbackSource !== 'r2') || !audioRef.current) return;

    if (audioEnhancedRef.current && gainNodeRef.current) {
      // 'off' = unity gain, other presets use their defined gain
      const profileGain = currentProfileRef.current === 'off' ? 1.0 : BOOST_PRESETS[currentProfileRef.current].gain;
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

  // VOYEX Spatial slider: apply when slider changes or preset changes
  useEffect(() => {
    if ((playbackSource === 'cached' || playbackSource === 'r2') && spatialEnhancedRef.current) {
      if (boostProfile === 'voyex') {
        updateVoyexSpatial(voyexSpatial);
      } else {
        // Not VOYEX - mute spatial (true bypass)
        updateVoyexSpatial(0);
      }
    }
  }, [voyexSpatial, boostProfile, playbackSource, updateVoyexSpatial]);

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

  // ERROR HANDLER: Handle audio element errors gracefully
  const handleAudioError = useCallback((e: React.SyntheticEvent<HTMLAudioElement, Event>) => {
    if (playbackSource !== 'cached' && playbackSource !== 'r2') return;

    const audio = e.currentTarget;
    const error = audio.error;
    const errorCodes: Record<number, string> = {
      1: 'MEDIA_ERR_ABORTED',
      2: 'MEDIA_ERR_NETWORK',
      3: 'MEDIA_ERR_DECODE',
      4: 'MEDIA_ERR_SRC_NOT_SUPPORTED',
    };

    const errorName = error ? (errorCodes[error.code] || `Unknown(${error.code})`) : 'Unknown';
    console.error(`🚨 [VOYO] Audio error: ${errorName}`, error?.message);

    // On error, try to re-extract
    if (currentTrack?.trackId && error) {
      devLog('🚨 [VOYO] Audio error - clearing source. User may need to retry.');
      // Clear the failed audio source
      audio.src = '';
      if (cachedUrlRef.current) {
        URL.revokeObjectURL(cachedUrlRef.current);
        cachedUrlRef.current = null;
      }
    }
  }, [playbackSource, currentTrack?.trackId, setPlaybackSource]);

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
      onError={handleAudioError}
      onPlaying={() => (playbackSource === 'cached' || playbackSource === 'r2') && setBufferHealth(100, 'healthy')}
      onWaiting={() => (playbackSource === 'cached' || playbackSource === 'r2') && setBufferHealth(50, 'warning')}
      onPause={() => {
        if (playbackSource !== 'cached' && playbackSource !== 'r2') return;
        const { isPlaying: shouldPlay } = usePlayerStore.getState();
        const audio = audioRef.current;
        if (!audio) return;
        // Don't resume if track ended (prevents brief replay before next track)
        const hasEnded = audio.duration > 0 && audio.currentTime >= audio.duration - 0.5;
        if (hasEnded) return;
        // Resume if should be playing (handles interruptions)
        if (shouldPlay && audio.src && audio.readyState >= 1) {
          audio.play().catch(e => devWarn('🎵 [Playback] Pause handler resume failed:', e.name));
        }
      }}
      style={{ display: 'none' }}
    />
  );
};

export default AudioPlayer;
