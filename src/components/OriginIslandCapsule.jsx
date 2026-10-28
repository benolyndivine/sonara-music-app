import React, { useState, useEffect, useRef } from 'react';
import CachedImage from './CachedImage';
import { triggerHaptic } from '../utils/audioEffects';

export default function OriginIslandCapsule({
  currentTrack,
  isPlaying,
  trackProgress = 0,
  trackDuration = 0,
  audioRoute,
  onTogglePlay,
  onNext,
  onPrev,
  onExpand
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const autoCollapseTimerRef = useRef(null);

  // Auto-collapse after 7s of no interaction in expanded mode
  useEffect(() => {
    if (isExpanded) {
      if (autoCollapseTimerRef.current) clearTimeout(autoCollapseTimerRef.current);
      autoCollapseTimerRef.current = setTimeout(() => {
        setIsExpanded(false);
      }, 7000);
    }
    return () => {
      if (autoCollapseTimerRef.current) clearTimeout(autoCollapseTimerRef.current);
    };
  }, [isExpanded, isPlaying, trackProgress]);

  if (!currentTrack) return null;

  const title = currentTrack.title || currentTrack.name || 'Unknown Title';
  const artist = currentTrack.artist || 'Unknown Artist';
  const coverUrl = currentTrack.cover || currentTrack.image || currentTrack.imageUrl || 'https://placehold.co/100x100/0b111e/1db954.png';

  const formatSec = (sec) => {
    if (!sec || isNaN(sec) || sec < 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = trackDuration > 0 ? Math.min(100, Math.max(0, (trackProgress / trackDuration) * 100)) : 0;

  const handleCapsuleClick = (e) => {
    e.stopPropagation();
    triggerHaptic(20);
    setIsExpanded(prev => !prev);
  };

  return (
    <aside
      className={`origin-island-container ${isExpanded ? 'origin-island-expanded' : 'origin-island-compact'}`}
      onClick={handleCapsuleClick}
      role="region"
      aria-label="Origin Island Live Music Capsule"
      style={{
        boxShadow: isExpanded
          ? '0 16px 45px rgba(0, 0, 0, 0.88), 0 0 24px rgba(29, 185, 84, 0.28)'
          : isPlaying
            ? '0 8px 24px rgba(0, 0, 0, 0.8), 0 0 14px rgba(29, 185, 84, 0.22)'
            : '0 8px 24px rgba(0, 0, 0, 0.7)'
      }}
    >
      {!isExpanded ? (
        /* ================= COMPACT ISLAND CAPSULE ================= */
        <>
          {/* Mini Album Disc */}
          <div style={{ position: 'relative', width: '26px', height: '26px', flexShrink: 0 }}>
            <CachedImage
              src={coverUrl}
              alt=""
              className={`origin-island-disc ${isPlaying ? 'origin-island-spin' : ''}`}
            />
          </div>

          {/* Marquee Track Title & Artist */}
          <div style={{ flex: 1, minWidth: 0, margin: '0 8px', overflow: 'hidden' }}>
            <p style={{
              margin: 0,
              fontSize: '0.74rem',
              fontWeight: '700',
              color: '#ffffff',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {title} <span style={{ opacity: 0.5, fontWeight: '400' }}>• {artist}</span>
            </p>
          </div>

          {/* Animated Waveform Visualizer & Mini Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <div className={`origin-island-wave ${isPlaying ? 'origin-island-wave-playing' : ''}`}>
              <div className="origin-island-bar" style={{ height: isPlaying ? '10px' : '4px' }}></div>
              <div className="origin-island-bar" style={{ height: isPlaying ? '14px' : '6px' }}></div>
              <div className="origin-island-bar" style={{ height: isPlaying ? '8px' : '4px' }}></div>
              <div className="origin-island-bar" style={{ height: isPlaying ? '12px' : '5px' }}></div>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                triggerHaptic(20);
                onTogglePlay?.();
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                color: '#ffffff',
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '0.62rem',
                padding: 0
              }}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              <i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'}`} style={{ marginLeft: isPlaying ? 0 : '1px' }}></i>
            </button>
          </div>
        </>
      ) : (
        /* ================= EXPANDED ISLAND CONTROLLER ================= */
        <>
          {/* Header row: Album art, Title, Audio Route, Collapse */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <CachedImage
              src={coverUrl}
              alt={title}
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                objectFit: 'cover',
                flexShrink: 0,
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.6), 0 0 10px rgba(29, 185, 84, 0.25)'
              }}
            />

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                <span style={{
                  fontSize: '0.62rem',
                  fontWeight: '800',
                  color: 'var(--accent)',
                  background: 'rgba(29, 185, 84, 0.15)',
                  padding: '1px 6px',
                  borderRadius: '6px',
                  letterSpacing: '0.5px'
                }}>
                  ORIGIN ISLAND
                </span>
                {audioRoute?.name && (
                  <span style={{ fontSize: '0.64rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                    {audioRoute.name}
                  </span>
                )}
              </div>
              <p style={{
                margin: 0,
                fontSize: '0.88rem',
                fontWeight: '800',
                color: '#ffffff',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {title}
              </p>
              <p style={{
                margin: 0,
                fontSize: '0.74rem',
                color: 'rgba(255, 255, 255, 0.6)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {artist}
              </p>
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                triggerHaptic(15);
                setIsExpanded(false);
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.7)',
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '0.74rem'
              }}
              aria-label="Collapse Island"
            >
              <i className="fa-solid fa-chevron-up"></i>
            </button>
          </div>

          {/* Progress Bar & Timestamps */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{
              width: '100%',
              height: '3.5px',
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              borderRadius: '2px',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                width: `${progressPercent}%`,
                backgroundColor: 'var(--accent)',
                borderRadius: '2px',
                transition: 'width 0.25s linear'
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'rgba(255, 255, 255, 0.5)', fontWeight: '600' }}>
              <span>{formatSec(trackProgress)}</span>
              <span>{formatSec(trackDuration)}</span>
            </div>
          </div>

          {/* Quick Playback Actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '2px' }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                triggerHaptic(20);
                onExpand?.();
                setIsExpanded(false);
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#ffffff',
                fontSize: '0.7rem',
                fontWeight: '700',
                padding: '5px 10px',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                cursor: 'pointer'
              }}
            >
              <i className="fa-solid fa-up-right-and-down-left-from-center" style={{ fontSize: '0.65rem' }}></i>
              <span>Player</span>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  triggerHaptic(20);
                  onPrev?.();
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.85)',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  padding: '4px'
                }}
                aria-label="Previous Track"
              >
                <i className="fa-solid fa-backward-step"></i>
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  triggerHaptic(25);
                  onTogglePlay?.();
                }}
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--accent)',
                  border: 'none',
                  color: '#000000',
                  fontSize: '0.95rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: '0 0 14px var(--accent)'
                }}
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                <i className={`fa-solid ${isPlaying ? 'fa-pause' : 'fa-play'}`} style={{ marginLeft: isPlaying ? 0 : '2px' }}></i>
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  triggerHaptic(20);
                  onNext?.();
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.85)',
                  fontSize: '1rem',
                  cursor: 'pointer',
                  padding: '4px'
                }}
                aria-label="Next Track"
              >
                <i className="fa-solid fa-forward-step"></i>
              </button>
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
