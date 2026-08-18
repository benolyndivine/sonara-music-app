import React, { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';

/**
 * NotificationCenter
 * ------------------
 * Renders a Spotify-style "now playing" notification bar that drops from the
 * top of the screen. On the web/PWA it also registers the Web Media Session
 * API so the browser/OS lock-screen and notification shade show album art +
 * controls. On native (Capacitor/Android), it does NOT touch
 * navigator.mediaSession at all — App.jsx already registers a real native
 * MediaSessionCompat session via @capgo/capacitor-media-session, which is
 * what actually receives Bluetooth AVRCP (play/pause/next/previous) button
 * events. The Android WebView itself also implements the Web Media Session
 * API, so if this component registered its own handlers unconditionally, it
 * would create a second, competing OS media session that keeps re-asserting
 * itself (it used to re-register every ~1s via the trackProgress dependency)
 * and steals Bluetooth/lock-screen focus away from the real native session —
 * which is why the hardware headset buttons weren't working.
 *
 * Props
 * -----
 * currentTrack  – track object  (required)
 * isPlaying     – boolean
 * trackProgress – number (seconds)
 * trackDuration – number (seconds)
 * onTogglePlay  – () => void
 * onNext        – () => void
 * onPrev        – () => void
 * onSeekProgress– (seconds: number) => void
 * onExpand      – () => void  (opens FullPlayerView)
 */
export default function NotificationCenter({
  currentTrack,
  isPlaying,
  trackProgress,
  trackDuration,
  onTogglePlay,
  onNext,
  onPrev,
  onSeekProgress,
  onExpand,
}) {
  const [visible, setVisible] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragDelta, setDragDelta] = useState(0);
  const startYRef = useRef(null);
  const mediaSessionReady = useRef(false);

  /* ── Show / hide on track change ── */
  useEffect(() => {
    if (currentTrack) {
      setVisible(true);
    }
  }, [currentTrack]);

  /* ── Web Media Session API (web/PWA only — see note above) ── */
  useEffect(() => {
    if (Capacitor.isNativePlatform() || !('mediaSession' in navigator) || !currentTrack) return;

    const artwork = currentTrack.cover || currentTrack.image || currentTrack.imageUrl || '';
    const title   = currentTrack.title  || currentTrack.name  || 'Unknown';
    const artist  = currentTrack.artist || '';

    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist,
      album: 'Sonara',
      artwork: artwork
        ? [
            { src: artwork, sizes: '96x96',   type: 'image/png' },
            { src: artwork, sizes: '128x128',  type: 'image/png' },
            { src: artwork, sizes: '256x256',  type: 'image/png' },
            { src: artwork, sizes: '512x512',  type: 'image/png' },
          ]
        : [],
    });

    mediaSessionReady.current = true;
  }, [currentTrack]);

  /* ── Sync playback state to Media Session (web/PWA only) ── */
  useEffect(() => {
    if (Capacitor.isNativePlatform() || !('mediaSession' in navigator) || !mediaSessionReady.current) return;
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [isPlaying]);

  /* ── Sync position to Media Session (web/PWA only, every ~1 s via trackProgress) ── */
  useEffect(() => {
    if (Capacitor.isNativePlatform() || !('mediaSession' in navigator) || !mediaSessionReady.current) return;
    if (!trackDuration || isNaN(trackDuration)) return;
    try {
      navigator.mediaSession.setPositionState({
        duration:     trackDuration,
        playbackRate: 1,
        position:     Math.min(trackProgress, trackDuration),
      });
    } catch (_) { /* older browsers */ }
  }, [trackProgress, trackDuration]);

  /* ── Wire OS media buttons → our handlers (web/PWA only — on native,
     App.jsx's @capgo/capacitor-media-session handlers own this) ── */
  useEffect(() => {
    if (Capacitor.isNativePlatform() || !('mediaSession' in navigator)) return;

    const set = (action, handler) => {
      try { navigator.mediaSession.setActionHandler(action, handler); } catch (_) {}
    };

    set('play',          () => onTogglePlay());
    set('pause',         () => onTogglePlay());
    set('nexttrack',     () => onNext());
    set('previoustrack', () => onPrev());
    set('seekto',        (d) => d?.seekTime != null && onSeekProgress(d.seekTime));
    set('seekbackward',  (d) => onSeekProgress(Math.max(0, trackProgress - (d?.seekOffset ?? 10))));
    set('seekforward',   (d) => onSeekProgress(Math.min(trackDuration, trackProgress + (d?.seekOffset ?? 10))));

    return () => {
      ['play','pause','nexttrack','previoustrack','seekto','seekbackward','seekforward']
        .forEach(a => { try { navigator.mediaSession.setActionHandler(a, null); } catch (_) {} });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackProgress, trackDuration, onTogglePlay, onNext, onPrev, onSeekProgress]);

  /* ── Swipe-up to dismiss ── */
  const handlePointerDown = (e) => {
    startYRef.current = e.touches?.[0]?.clientY ?? e.clientY;
    setIsDragging(true);
    setDragDelta(0);
  };

  const handlePointerMove = (e) => {
    if (!isDragging || startYRef.current === null) return;
    const y = e.touches?.[0]?.clientY ?? e.clientY;
    const delta = y - startYRef.current;
    if (delta < 0) setDragDelta(delta); // only upward
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    if (dragDelta < -60) {
      setVisible(false); // swiped up enough → dismiss
    }
    setDragDelta(0);
    startYRef.current = null;
  };

  /* ── Helpers ── */
  const fmt = (s) => {
    if (isNaN(s) || s === undefined) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
  };

  const pct = trackDuration > 0 ? (trackProgress / trackDuration) * 100 : 0;

  if (!currentTrack || !visible) return null;

  const imgSrc = currentTrack.cover || currentTrack.image || currentTrack.imageUrl;
  const title  = currentTrack.title || currentTrack.name;

  const translateY = Math.max(-120, dragDelta);
  const opacity    = 1 + translateY / 120;

  return (
    <div
      className="nc-wrapper"
      style={{ transform: `translateY(${translateY}px)`, opacity }}
      onTouchStart={handlePointerDown}
      onTouchMove={handlePointerMove}
      onTouchEnd={handlePointerUp}
      onMouseDown={handlePointerDown}
      onMouseMove={isDragging ? handlePointerMove : undefined}
      onMouseUp={handlePointerUp}
    >
      {/* Drag pill */}
      <div className="nc-pill" />

      {/* Main card — click anywhere non-button to open full player */}
      <div className="nc-card" onClick={onExpand}>

        {/* Left: art + info */}
        <div className="nc-track-info">
          <div className="nc-art-wrap">
            <img src={imgSrc} alt={title} className="nc-art" />
            {isPlaying && (
              <div className="nc-playing-bars">
                <span /><span /><span /><span />
              </div>
            )}
          </div>
          <div className="nc-meta">
            <p className="nc-title">{title}</p>
            <p className="nc-artist">{currentTrack.artist}</p>
          </div>
        </div>

        {/* Right: controls */}
        <div className="nc-controls" onClick={e => e.stopPropagation()}>
          <button className="nc-btn" onClick={onPrev} title="Previous">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/>
            </svg>
          </button>

          <button className="nc-btn nc-play-btn" onClick={onTogglePlay} title={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying
              ? <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
              : <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style={{marginLeft:'2px'}}><path d="M8 5v14l11-7z"/></svg>
            }
          </button>

          <button className="nc-btn" onClick={onNext} title="Next">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 18l8.5-6L6 6v12zm2-8.14 5.09 2.14L8 14.14V9.86zM16 6h2v12h-2z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="nc-progress-track" onClick={e => e.stopPropagation()}>
        <input
          type="range"
          min="0"
          max={trackDuration || 100}
          value={trackProgress}
          onChange={e => onSeekProgress(parseFloat(e.target.value))}
          className="nc-seeker"
          style={{
            background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${pct}%, rgba(255,255,255,0.18) ${pct}%, rgba(255,255,255,0.18) 100%)`
          }}
        />
        <div className="nc-times">
          <span>{fmt(trackProgress)}</span>
          <span>{fmt(trackDuration)}</span>
        </div>
      </div>
    </div>
  );
}