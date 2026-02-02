/**
 * VoyoMoments - Control vs Surrender Navigation Feed
 *
 * UP = Control (deeper in same category, deterministic)
 * DOWN = Surrender (bleed into adjacent category, organic)
 * LEFT = Memory (retrace trail with fading precision)
 * RIGHT = Drift (explore somewhere new, weighted random)
 * Tabs = Hard shift (intentional dimension change)
 *
 * Hold = position overlay | Double-tap = OYE reaction
 * Double-tap + hold = Star panel (1 star = follow)
 */

import React, { useState, useRef, useCallback, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Flame, MessageCircle, ExternalLink, Play, Volume2, VolumeX } from 'lucide-react';
import { useMoments, CategoryAxis, NavAction } from '../../../hooks/useMoments';
import type { Moment } from '../../../services/momentsService';

// ============================================
// CONSTANTS & HELPERS
// ============================================

const SWIPE_THRESHOLD = 50;
const LONG_PRESS_MS = 500;
const DOUBLE_TAP_MS = 300;
const STAR_HOLD_MS = 500; // hold after double-tap to open star panel

// Control = snappy, deterministic feel (UP, LEFT)
const SPRING_CONTROL = { type: 'spring' as const, stiffness: 400, damping: 35, mass: 0.8 };
// Surrender = floaty, organic feel (DOWN, RIGHT)
const SPRING_SURRENDER = { type: 'spring' as const, stiffness: 280, damping: 25, mass: 1.0 };

function getSpring(action: NavAction) {
  if (action === 'down' || action === 'right') return SPRING_SURRENDER;
  return SPRING_CONTROL;
}

// API base for R2 feed video streaming
const VOYO_API = import.meta.env.VITE_API_URL || (
  window.location.hostname === 'localhost' ? 'http://localhost:3001' : 'https://voyo-music-api.fly.dev'
);

const css = (obj: Record<string, any>) => obj as React.CSSProperties;

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

type SlideDir = 'up' | 'down' | 'left' | 'right' | null;

function slideVariants(dir: SlideDir, isSurrender: boolean = false) {
  const axis = dir === 'up' || dir === 'down' ? 'y' : 'x';
  const sign = dir === 'up' || dir === 'left' ? 1 : dir === 'down' || dir === 'right' ? -1 : 0;
  const hScale = dir === 'left' || dir === 'right' ? 0.92 : 1;

  // Surrender directions get subtle rotation and scale variance
  const rotateIn = isSurrender ? (Math.random() - 0.5) * 3 : 0;
  const scaleIn = isSurrender ? 0.95 + Math.random() * 0.05 : hScale;

  return {
    initial: { [axis]: `${sign * 100}%`, opacity: 0.7, scale: scaleIn, rotate: rotateIn },
    animate: { [axis]: 0, opacity: 1, scale: 1, rotate: 0 },
    exit: { [axis]: `${-sign * 100}%`, opacity: 0.5, scale: hScale, rotate: -rotateIn },
  };
}

// ============================================
// COMPACT STYLES
// ============================================

const S = {
  container: css({ position: 'relative', width: '100%', height: '100%', backgroundColor: '#000', overflow: 'hidden', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }),
  topBar: css({ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30, paddingTop: 'env(safe-area-inset-top, 12px)', background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.3) 70%, transparent 100%)', pointerEvents: 'auto' }),
  axisTabs: css({ display: 'flex', justifyContent: 'center', gap: 4, padding: '8px 16px 4px' }),
  catRow: css({ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '6px 16px 10px', fontSize: 12, color: 'rgba(255,255,255,0.5)' }),
  catCurrent: css({ fontSize: 14, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: 1.5 }),
  catAdj: css({ fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: 0.5 }),
  arrow: css({ fontSize: 10, color: 'rgba(255,255,255,0.25)' }),
  card: css({ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }),
  thumb: css({ position: 'absolute', inset: 0, objectFit: 'cover', width: '100%', height: '100%' }),
  grad: css({ position: 'absolute', bottom: 0, left: 0, right: 0, height: '55%', background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 50%, transparent 100%)', zIndex: 2, pointerEvents: 'none' }),
  bottom: css({ position: 'relative', zIndex: 5, padding: '0 16px 24px', paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))' }),
  title: css({ fontSize: 16, fontWeight: 700, color: '#fff', lineHeight: 1.3, marginBottom: 4, textShadow: '0 1px 4px rgba(0,0,0,0.5)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as any),
  crRow: css({ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }),
  avatar: css({ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0 }),
  crName: css({ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }),
  track: css({ fontSize: 12, color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: 4 }),
  actBar: css({ position: 'absolute', right: 12, bottom: 160, zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }),
  actBtn: css({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer' }),
  actLbl: css({ fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }),
  overlay: css({ position: 'absolute', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }),
  posCard: css({ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 20, padding: '28px 36px', textAlign: 'center', maxWidth: 300 }),
  posTitle: css({ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 16 }),
  posCats: css({ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 12, fontSize: 14, color: 'rgba(255,255,255,0.4)' }),
  posCur: css({ fontSize: 18, fontWeight: 700, color: '#FBBF24', padding: '4px 12px', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 8 }),
  posTime: css({ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 8 }),
  posHint: css({ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 16 }),
  loading: css({ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'rgba(255,255,255,0.5)', fontSize: 14 }),
  spinner: css({ width: 32, height: 32, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.15)', borderTopColor: '#FBBF24' }),
  empty: css({ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32, textAlign: 'center' }),
  emptyH: css({ fontSize: 18, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }),
  emptyP: css({ fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }),
  oyeF: css({ position: 'absolute', zIndex: 40, pointerEvents: 'none', fontSize: 28 }),
  volBadge: css({ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 20, background: 'rgba(0,0,0,0.6)', borderRadius: '50%', width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center' }),
};

const axisTab = (on: boolean): React.CSSProperties => ({
  padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: on ? 700 : 500,
  color: on ? '#fff' : 'rgba(255,255,255,0.6)',
  background: on ? 'rgba(255,255,255,0.15)' : 'transparent',
  backdropFilter: on ? 'blur(20px)' : 'none', WebkitBackdropFilter: on ? 'blur(20px)' : 'none',
  border: on ? '1px solid rgba(255,255,255,0.2)' : '1px solid transparent',
  cursor: 'pointer', transition: 'all 0.2s ease', letterSpacing: 0.5,
});

const actIcon = (on: boolean): React.CSSProperties => ({
  width: 40, height: 40, borderRadius: '50%',
  background: on ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.1)',
  backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease',
});

// ============================================
// OYE FLOATING HEARTS
// ============================================

interface OyeFloat { id: string; x: number; y: number }

const OyeAnimations = memo(({ floats }: { floats: OyeFloat[] }) => (
  <AnimatePresence>
    {floats.map(f => (
      <motion.div
        key={f.id}
        style={{ ...S.oyeF, left: f.x, top: f.y }}
        initial={{ opacity: 1, scale: 0, y: 0 }}
        animate={{ opacity: [1, 1, 0], scale: [0, 1.4, 1], y: -200 - Math.random() * 100, x: Math.sin(Math.random() * 6.28) * 40 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 2, ease: [0.16, 1, 0.3, 1] }}
      >
        <Heart size={28} style={{ color: '#FBBF24', fill: '#FBBF24', filter: 'drop-shadow(0 0 8px rgba(251,191,36,0.6))' }} />
      </motion.div>
    ))}
  </AnimatePresence>
));
OyeAnimations.displayName = 'OyeAnimations';

// ============================================
// MOMENT CARD
// ============================================

interface MomentCardProps {
  moment: Moment;
  isOyed: boolean;
  onOye: () => void;
  isActive: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
  onPlayTrack?: () => void;
}

const MomentCard = memo(({ moment, isOyed, onOye, isActive, isMuted, onToggleMute, onPlayTrack }: MomentCardProps) => {
  const initial = (moment.creator_name || moment.creator_username || '?')[0].toUpperCase();
  const creator = moment.creator_name || moment.creator_username || 'Unknown';
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoAvailable, setVideoAvailable] = useState<boolean | null>(null);
  const [videoError, setVideoError] = useState(false);

  const videoUrl = `${VOYO_API}/r2/feed/${moment.source_id}`;

  // Check if video exists in R2 on mount
  useEffect(() => {
    let cancelled = false;
    setVideoAvailable(null);
    setVideoError(false);

    fetch(`${videoUrl}/check`)
      .then(r => r.json())
      .then(data => {
        if (!cancelled) setVideoAvailable(data.exists === true);
      })
      .catch(() => {
        if (!cancelled) setVideoAvailable(false);
      });

    return () => { cancelled = true; };
  }, [moment.source_id, videoUrl]);

  // Auto-play/pause based on active state
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !videoAvailable || videoError) return;

    if (isActive) {
      vid.currentTime = 0;
      vid.play().catch(() => {
        // Autoplay blocked - keep showing thumbnail
      });
    } else {
      vid.pause();
    }
  }, [isActive, videoAvailable, videoError]);

  // Sync muted state
  useEffect(() => {
    const vid = videoRef.current;
    if (vid) vid.muted = isMuted;
  }, [isMuted]);

  const handleVideoError = useCallback(() => {
    setVideoError(true);
    console.warn(`[MomentCard] Video load failed for ${moment.source_id}, falling back to thumbnail`);
  }, [moment.source_id]);

  const showVideo = videoAvailable === true && !videoError;

  return (
    <div style={S.card}>
      {/* Thumbnail as background (always rendered as fallback) */}
      {moment.thumbnail_url && <img src={moment.thumbnail_url} alt="" style={S.thumb} loading="eager" draggable={false} />}

      {/* Video overlay when available */}
      {showVideo && (
        <video
          ref={videoRef}
          src={videoUrl}
          style={S.thumb}
          muted={isMuted}
          loop
          playsInline
          preload="metadata"
          onError={handleVideoError}
        />
      )}

      <div style={S.grad} />

      <div style={S.actBar}>
        <div style={S.actBtn} onClick={onOye}>
          <div style={actIcon(isOyed)}>
            <Heart size={20} style={{ color: isOyed ? '#FBBF24' : '#fff', fill: isOyed ? '#FBBF24' : 'none', transition: 'all 0.2s ease' }} />
          </div>
          <span style={{ ...S.actLbl, color: isOyed ? '#FBBF24' : 'rgba(255,255,255,0.6)' }}>OYE</span>
        </div>
        <div style={S.actBtn}>
          <div style={actIcon(false)}><Flame size={20} style={{ color: '#fff' }} /></div>
          <span style={S.actLbl}>{formatCount(moment.voyo_reactions || 0)}</span>
        </div>
        <div style={S.actBtn}>
          <div style={actIcon(false)}><MessageCircle size={20} style={{ color: '#fff' }} /></div>
          <span style={S.actLbl}>{formatCount(moment.comment_count || 0)}</span>
        </div>
        <div style={S.actBtn}>
          <div style={actIcon(false)}><ExternalLink size={18} style={{ color: '#fff' }} /></div>
          <span style={S.actLbl}>Share</span>
        </div>
      </div>

      <div style={S.bottom}>
        <div style={S.title}>{moment.title}</div>
        <div style={S.crRow}>
          <div style={S.avatar}>{initial}</div>
          <span style={S.crName}>@{creator}</span>
        </div>
        {moment.parent_track_title && (
          <div
            style={{ ...S.track, cursor: onPlayTrack ? 'pointer' : 'default' }}
            onClick={(e) => { if (onPlayTrack) { e.stopPropagation(); onPlayTrack(); } }}
          >
            <Play size={10} style={{ color: 'rgba(255,255,255,0.5)' }} />
            <span>{moment.parent_track_artist} - {moment.parent_track_title}</span>
          </div>
        )}
      </div>
    </div>
  );
});
MomentCard.displayName = 'MomentCard';

// ============================================
// POSITION OVERLAY
// ============================================

const PositionOverlay = memo(({ position, categories, totalInCategory, onClose, displayName }: {
  position: { categoryIndex: number; timeIndex: number };
  categories: string[];
  totalInCategory: number;
  onClose: () => void;
  displayName: (key: string) => string;
}) => {
  const cur = categories[position.categoryIndex];
  const prev = categories[(position.categoryIndex - 1 + categories.length) % categories.length];
  const next = categories[(position.categoryIndex + 1) % categories.length];

  return (
    <motion.div style={S.overlay} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onClick={onClose}>
      <motion.div style={S.posCard} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} transition={{ duration: 0.2, delay: 0.05 }} onClick={e => e.stopPropagation()}>
        <div style={S.posTitle}>YOUR POSITION</div>
        <div style={S.posCats}>
          <span>{displayName(prev)}</span>
          <span style={S.arrow}>{'>'}</span>
          <span style={S.posCur}>{displayName(cur)}</span>
          <span style={S.arrow}>{'>'}</span>
          <span>{displayName(next)}</span>
        </div>
        <div style={{ fontSize: 22, color: 'rgba(255,255,255,0.3)', margin: '4px 0' }}>|</div>
        <div style={S.posTime}>{totalInCategory > 0 ? `${position.timeIndex + 1} of ${totalInCategory} moments` : 'No moments yet'}</div>
        <div style={S.posHint}>Tap anywhere to close</div>
      </motion.div>
    </motion.div>
  );
});
PositionOverlay.displayName = 'PositionOverlay';

// ============================================
// STAR PANEL (Double-tap-hold → 1-5 stars)
// ============================================

interface StarPanelProps {
  creator: string;
  onGiveStar: (stars: number) => void;
  onClose: () => void;
}

const StarPanel = memo(({ creator, onGiveStar, onClose }: StarPanelProps) => {
  const initial = (creator || '?')[0].toUpperCase();
  return (
    <motion.div
      style={{ position: 'absolute', inset: 0, zIndex: 60, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        style={{ background: 'linear-gradient(to top, rgba(10,10,15,0.98), rgba(26,26,46,0.95))', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: '24px 20px 40px', textAlign: 'center' }}
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', fontSize: 16, fontWeight: 700, color: '#fff' }}>{initial}</div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>@{creator}</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 20 }}>Give a star to follow</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
          {[1, 2, 3, 4, 5].map(n => (
            <motion.button
              key={n}
              style={{
                width: 48, height: 48, borderRadius: '50%',
                background: n === 1 ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.08)',
                border: n === 1 ? '2px solid rgba(251,191,36,0.4)' : '1px solid rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, cursor: 'pointer', color: '#FBBF24',
              }}
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => onGiveStar(n)}
            >
              {'★'.repeat(Math.min(n, 3))}{n > 3 ? <span style={{ fontSize: 10, color: 'rgba(251,191,36,0.7)' }}>+{n - 3}</span> : null}
            </motion.button>
          ))}
        </div>
        {/* Hint: 1 star = follow */}
        <div style={{ fontSize: 10, color: 'rgba(251,191,36,0.5)', marginTop: 12 }}>1 star = follow this creator</div>
      </motion.div>
    </motion.div>
  );
});
StarPanel.displayName = 'StarPanel';

// Star Confirmation (first time per creator)
interface StarConfirmProps {
  creator: string;
  stars: number;
  onConfirm: () => void;
  onCancel: () => void;
}

const StarConfirmation = memo(({ creator, stars, onConfirm, onCancel }: StarConfirmProps) => (
  <motion.div
    style={{ position: 'absolute', inset: 0, zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(15px)', WebkitBackdropFilter: 'blur(15px)' }}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    onClick={onConfirm}
  >
    <motion.div
      style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 20, padding: '28px 36px', textAlign: 'center', maxWidth: 280 }}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      onClick={e => e.stopPropagation()}
    >
      <div style={{ fontSize: 28, marginBottom: 12 }}>{'★'.repeat(stars)}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
        Send {stars === 1 ? 'a star' : `${stars} stars`} to @{creator}?
      </div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 20 }}>
        {stars === 1 ? 'This will follow them' : 'Stars show your appreciation'}
      </div>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
        <motion.button
          style={{ padding: '10px 24px', borderRadius: 20, background: 'linear-gradient(135deg, #FBBF24, #F59E0B)', color: '#000', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer' }}
          whileTap={{ scale: 0.95 }}
          onClick={onConfirm}
        >
          Send ★
        </motion.button>
        <motion.button
          style={{ padding: '10px 24px', borderRadius: 20, background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', fontWeight: 500, fontSize: 14, border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}
          whileTap={{ scale: 0.95 }}
          onClick={(e) => { e.stopPropagation(); onCancel(); }}
        >
          Cancel
        </motion.button>
      </div>
    </motion.div>
  </motion.div>
));
StarConfirmation.displayName = 'StarConfirmation';

// ============================================
// MAIN COMPONENT
// ============================================

export interface MomentTrackInfo {
  id: string;
  title: string;
  artist: string;
}

export interface VoyoMomentsProps {
  onPlayFullTrack?: (track: MomentTrackInfo) => void;
}

export const VoyoMoments: React.FC<VoyoMomentsProps> = ({ onPlayFullTrack }) => {
  const {
    currentMoment, position, categoryAxis, categories, currentCategory, displayName,
    goUp, goDown, goLeft, goRight, setCategoryAxis,
    loading, totalInCategory, navAction, recordPlay, recordOye, recordStar,
  } = useMoments();

  const [showOverlay, setShowOverlay] = useState(false);
  const [oyedMoments, setOyedMoments] = useState<Set<string>>(new Set());
  const [oyeFloats, setOyeFloats] = useState<OyeFloat[]>([]);
  const [slideDir, setSlideDir] = useState<SlideDir>(null);
  const [mKey, setMKey] = useState(0);
  const [isMuted, setIsMuted] = useState(true);
  const [showVol, setShowVol] = useState(false);
  const [showStarPanel, setShowStarPanel] = useState(false);
  const [confirmedCreators, setConfirmedCreators] = useState<Set<string>>(new Set());
  const [pendingStar, setPendingStar] = useState<{ momentId: string; creator: string; stars: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const lpTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTap = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStart = useRef<{ x: number; y: number; time: number } | null>(null);
  const swiping = useRef(false);
  const volTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const starHoldTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Record play when moment changes
  useEffect(() => { if (currentMoment) recordPlay(currentMoment.id); }, [currentMoment?.id, recordPlay]);

  // Navigate with animation direction
  const nav = useCallback((dir: SlideDir, fn: () => void) => {
    setSlideDir(dir);
    setMKey(p => p + 1);
    fn();
  }, []);

  // ---- TOUCH HANDLERS ----

  const onTS = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY, time: Date.now() };
    swiping.current = false;

    // Check if this is a second tap (potential double-tap-hold for stars)
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS && currentMoment) {
      // Second tap detected — start star hold timer
      starHoldTimer.current = setTimeout(() => {
        if (!swiping.current) {
          const creator = currentMoment.creator_username || currentMoment.creator_name || '';
          if (creator) {
            setShowStarPanel(true);
          }
        }
      }, STAR_HOLD_MS);
    }

    lpTimer.current = setTimeout(() => { if (!swiping.current) setShowOverlay(true); }, LONG_PRESS_MS);
  }, [currentMoment]);

  const onTM = useCallback((e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const t = e.touches[0];
    if (Math.abs(t.clientX - touchStart.current.x) > 10 || Math.abs(t.clientY - touchStart.current.y) > 10) {
      swiping.current = true;
      if (lpTimer.current) { clearTimeout(lpTimer.current); lpTimer.current = null; }
      if (starHoldTimer.current) { clearTimeout(starHoldTimer.current); starHoldTimer.current = null; }
    }
  }, []);

  const handleOye = useCallback((momentId: string, x: number, y: number) => {
    setOyedMoments(p => { const n = new Set(p); n.add(momentId); return n; });
    const nf: OyeFloat[] = Array.from({ length: 5 }, (_, i) => ({ id: `${Date.now()}-${i}`, x: x - 14 + (Math.random() - 0.5) * 40, y: y - 14 }));
    setOyeFloats(p => [...p, ...nf]);
    setTimeout(() => setOyeFloats(p => p.filter(f => !nf.find(n => n.id === f.id))), 2200);
    recordOye(momentId);
  }, [recordOye]);

  const showVolBadge = useCallback(() => {
    setIsMuted(p => !p);
    setShowVol(true);
    if (volTimer.current) clearTimeout(volTimer.current);
    volTimer.current = setTimeout(() => setShowVol(false), 800);
  }, []);

  const onTE = useCallback((e: React.TouchEvent) => {
    if (lpTimer.current) { clearTimeout(lpTimer.current); lpTimer.current = null; }
    if (starHoldTimer.current) { clearTimeout(starHoldTimer.current); starHoldTimer.current = null; }
    if (showOverlay) { setShowOverlay(false); touchStart.current = null; return; }
    if (showStarPanel) { touchStart.current = null; return; }
    if (!touchStart.current) return;

    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    const duration = Date.now() - touchStart.current.time;
    touchStart.current = null;

    const distance = Math.sqrt(dx * dx + dy * dy);

    if (Math.abs(dx) > SWIPE_THRESHOLD || Math.abs(dy) > SWIPE_THRESHOLD) {
      // Calculate velocity (px/ms)
      const velocity = distance / Math.max(duration, 1);

      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) {
          nav('left', () => goRight(velocity));
        } else {
          nav('right', () => goLeft(velocity));
        }
      } else {
        if (dy < 0) {
          nav('up', () => goUp(velocity));
        } else {
          nav('down', () => goDown(velocity));
        }
      }
      return;
    }

    // Double-tap detection with star-hold
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      if (tapTimer.current) { clearTimeout(tapTimer.current); tapTimer.current = null; }
      // Double-tap detected — fire OYE immediately
      if (currentMoment) handleOye(currentMoment.id, t.clientX, t.clientY);
      lastTap.current = 0;
    } else {
      lastTap.current = now;
      tapTimer.current = setTimeout(() => { showVolBadge(); lastTap.current = 0; }, DOUBLE_TAP_MS);
    }
  }, [showOverlay, showStarPanel, currentMoment, goUp, goDown, goLeft, goRight, nav, handleOye, showVolBadge]);

  // ---- KEYBOARD (desktop) ----

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp': e.preventDefault(); nav('up', goUp); break;
        case 'ArrowDown': e.preventDefault(); nav('down', goDown); break;
        case 'ArrowLeft': e.preventDefault(); nav('right', goLeft); break;
        case 'ArrowRight': e.preventDefault(); nav('left', goRight); break;
        case ' ': e.preventDefault(); showVolBadge(); break;
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [goUp, goDown, goLeft, goRight, nav, showVolBadge]);

  // Cleanup
  useEffect(() => () => {
    if (lpTimer.current) clearTimeout(lpTimer.current);
    if (tapTimer.current) clearTimeout(tapTimer.current);
    if (volTimer.current) clearTimeout(volTimer.current);
    if (starHoldTimer.current) clearTimeout(starHoldTimer.current);
  }, []);

  // Adjacent categories
  const prevCat = categories[(position.categoryIndex - 1 + categories.length) % categories.length];
  const nextCat = categories[(position.categoryIndex + 1) % categories.length];
  const isSurrender = navAction === 'down' || navAction === 'right';
  const sv = slideVariants(slideDir, isSurrender);
  const spring = getSpring(navAction);
  const isOyed = currentMoment ? oyedMoments.has(currentMoment.id) : false;

  const handleOyeBtn = useCallback(() => {
    if (!currentMoment || !containerRef.current) return;
    const r = containerRef.current.getBoundingClientRect();
    handleOye(currentMoment.id, r.width / 2, r.height / 2);
  }, [currentMoment, handleOye]);

  // Star giving flow
  const handleGiveStar = useCallback((stars: number) => {
    if (!currentMoment) return;
    const creator = currentMoment.creator_username || currentMoment.creator_name || '';
    if (!creator) return;

    // First time per creator: show confirmation
    if (!confirmedCreators.has(creator)) {
      setPendingStar({ momentId: currentMoment.id, creator, stars });
      setShowStarPanel(false);
      return;
    }

    // Already confirmed: send immediately
    recordStar(currentMoment.id, creator, stars);
    setShowStarPanel(false);
  }, [currentMoment, confirmedCreators, recordStar]);

  const handleConfirmStar = useCallback(() => {
    if (!pendingStar) return;
    recordStar(pendingStar.momentId, pendingStar.creator, pendingStar.stars);
    setConfirmedCreators(prev => { const n = new Set(prev); n.add(pendingStar.creator); return n; });
    setPendingStar(null);
  }, [pendingStar, recordStar]);

  const handleCancelStar = useCallback(() => {
    setPendingStar(null);
  }, []);

  return (
    <div ref={containerRef} style={S.container} onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE}>
      {/* TOP BAR */}
      <div style={S.topBar}>
        <div style={S.axisTabs}>
          {(['countries', 'vibes', 'genres'] as CategoryAxis[]).map(a => (
            <div key={a} style={axisTab(categoryAxis === a)} onClick={e => { e.stopPropagation(); setCategoryAxis(a); }}>
              {a.charAt(0).toUpperCase() + a.slice(1)}
            </div>
          ))}
        </div>
        <div style={S.catRow}>
          <span style={S.catAdj}>{displayName(prevCat)}</span>
          <span style={S.arrow}>{'<'}</span>
          <span style={S.catCurrent}>{displayName(currentCategory)}</span>
          <span style={S.arrow}>{'>'}</span>
          <span style={S.catAdj}>{displayName(nextCat)}</span>
        </div>
      </div>

      {/* MOMENT CARD */}
      <AnimatePresence mode="wait" initial={false}>
        {loading && !currentMoment ? (
          <motion.div key="load" style={S.loading} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div style={S.spinner} animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
            <span>Loading moments...</span>
          </motion.div>
        ) : currentMoment ? (
          <motion.div key={`m-${currentMoment.id}-${mKey}`} style={{ position: 'absolute', inset: 0 }} initial={sv.initial} animate={sv.animate} exit={sv.exit} transition={spring}>
            <MomentCard
              moment={currentMoment}
              isOyed={isOyed}
              onOye={handleOyeBtn}
              isActive={true}
              isMuted={isMuted}
              onToggleMute={showVolBadge}
              onPlayTrack={currentMoment.parent_track_id && onPlayFullTrack ? () => onPlayFullTrack({
                id: currentMoment.parent_track_id!,
                title: currentMoment.parent_track_title || 'Unknown',
                artist: currentMoment.parent_track_artist || 'Unknown Artist',
              }) : undefined}
            />
          </motion.div>
        ) : (
          <motion.div key="empty" style={S.empty} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div style={S.emptyH}>No moments in {displayName(currentCategory)}</div>
            <div style={S.emptyP}>Swipe left or right to explore other {categoryAxis}.{'\n'}Moments will appear here as creators share them.</div>
          </motion.div>
        )}
      </AnimatePresence>

      <OyeAnimations floats={oyeFloats} />

      <AnimatePresence>
        {showVol && (
          <motion.div style={S.volBadge} initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }} transition={{ duration: 0.15 }}>
            {isMuted ? <VolumeX size={24} style={{ color: '#fff' }} /> : <Volume2 size={24} style={{ color: '#fff' }} />}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showOverlay && (
          <PositionOverlay position={position} categories={categories} totalInCategory={totalInCategory} onClose={() => setShowOverlay(false)} displayName={displayName} />
        )}
      </AnimatePresence>

      {/* STAR PANEL */}
      <AnimatePresence>
        {showStarPanel && currentMoment && (
          <StarPanel
            creator={currentMoment.creator_username || currentMoment.creator_name || 'Unknown'}
            onGiveStar={handleGiveStar}
            onClose={() => setShowStarPanel(false)}
          />
        )}
      </AnimatePresence>

      {/* STAR CONFIRMATION (first time per creator) */}
      <AnimatePresence>
        {pendingStar && (
          <StarConfirmation
            creator={pendingStar.creator}
            stars={pendingStar.stars}
            onConfirm={handleConfirmStar}
            onCancel={handleCancelStar}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default VoyoMoments;
