import React, { useState, useEffect, useRef, useMemo } from 'react';
import { downloadTrackToDevice, isTrackCachedOffline, isCanvasVideoCachedOffline, getCanvasVideoSource } from '../utils/offlineStorage';
import { parseSyncedLyrics, getActiveLyricsLineIndex } from '../utils/lyricsSync';
import AudioRouteInfo, { getRouteIconClass, getRouteLabel } from '../utils/audioRoute';
import { getStreamingQuality, getDownloadQuality, QUALITY_LABELS } from '../utils/audioQuality';
import CachedImage from './CachedImage';

export default function FullPlayerView({ 
  currentTrack, isPlaying, playlists, lyrics, isShuffle, isRepeat, sleepTimeLeft, trackProgress, trackDuration, lyricsSize, audioRoute,
  streamingQuality: streamingQualityProp, downloadQuality: downloadQualityProp,
  dolbyAtmos = false, spatialAudio = false,
  isLiked = false, onToggleLike,
  onTogglePlay, onNext, onPrev, onSeekProgress, onToggleShuffle, onToggleRepeat, onSetSleepTimer, onAddSongToPlaylist, onGoToAlbum, onGoToArtist, onOpenQueue, onClose 
}) {
  const currentStreamingQuality = streamingQualityProp || getStreamingQuality();
  const currentDownloadQuality = downloadQualityProp || getDownloadQuality();
  const [showTimerMenu, setShowTimerMenu] = useState(false);
  const [showPlaylistDropdown, setShowPlaylistDropdown] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showLyricsSheet, setShowLyricsSheet] = useState(false);
  const [lyricsInlineMode, setLyricsInlineMode] = useState(false);

  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // 🎬 Spotify Canvas-style 10s looping video
  const [canvasVideoOn, setCanvasVideoOn] = useState(false);
  const [canvasVideoAttempt, setCanvasVideoAttempt] = useState(0);
  const [canvasVideoError, setCanvasVideoError] = useState(false);
  const [videoCachedOffline, setVideoCachedOffline] = useState(false);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const canvasVideoRef = useRef(null);

  const displayToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const resolvedImgSrc = currentTrack?.cover || currentTrack?.image || currentTrack?.imageUrl;

  useEffect(() => {
    if (!showMoreMenu && !showTimerMenu && !showPlaylistDropdown && !showLyricsSheet) return;
    const handleFullPlayerBack = (e) => {
      e.preventDefault();
      if (showMoreMenu) setShowMoreMenu(false);
      else if (showTimerMenu) setShowTimerMenu(false);
      else if (showPlaylistDropdown) setShowPlaylistDropdown(false);
      else if (showLyricsSheet) setShowLyricsSheet(false);
    };
    window.addEventListener('sonara_back_press', handleFullPlayerBack);
    return () => window.removeEventListener('sonara_back_press', handleFullPlayerBack);
  }, [showMoreMenu, showTimerMenu, showPlaylistDropdown, showLyricsSheet]);

  useEffect(() => {
    if (currentTrack) {
      setIsDownloaded(isTrackCachedOffline(currentTrack.id));
      setVideoCachedOffline(isCanvasVideoCachedOffline(currentTrack.id));
      setLyricsInlineMode(false);
      setCanvasVideoOn(false); // reset to cover art whenever the track changes
      setCanvasVideoError(false);
    }
  }, [currentTrack]);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // Available whenever it's cached offline, OR we're online and the track has a canvas video
  const canvasVideoSrc = useMemo(
    () => getCanvasVideoSource(currentTrack),
    [currentTrack, videoCachedOffline, isOnline]
  );
  const hasCanvasVideo = Boolean(currentTrack?.canvasVideoUrl) || videoCachedOffline;
  const canPlayCanvasVideo = Boolean(canvasVideoSrc);

  // Some Android WebViews won't reliably honor the `muted`/`autoPlay` JSX attributes
  // alone for autoplay (a well-known React quirk: the DOM *property* needs to be set
  // explicitly, not just the attribute) — so force both directly once the element mounts,
  // and keep nudging it if the WebView silently stalls or pauses it after the fact.
  useEffect(() => {
    if (!canvasVideoOn || !canPlayCanvasVideo) return;
    const el = canvasVideoRef.current;
    if (!el) return;

    let cancelled = false;
    const tryPlay = () => {
      if (cancelled || !el) return;
      el.muted = true;
      el.defaultMuted = true;
      const playPromise = el.play();
      if (playPromise?.catch) playPromise.catch(() => {});
    };

    tryPlay();
    const retryTimer1 = setTimeout(tryPlay, 200);
    const retryTimer2 = setTimeout(tryPlay, 800);

    // If something pauses/stalls it mid-way (common on some Android WebViews when
    // switching views), nudge it back into playback instead of leaving a frozen frame.
    const resume = () => tryPlay();
    el.addEventListener('pause', resume);
    el.addEventListener('stalled', resume);
    el.addEventListener('canplay', resume);
    el.addEventListener('loadeddata', resume);

    return () => {
      cancelled = true;
      clearTimeout(retryTimer1);
      clearTimeout(retryTimer2);
      el.removeEventListener('pause', resume);
      el.removeEventListener('stalled', resume);
      el.removeEventListener('canplay', resume);
      el.removeEventListener('loadeddata', resume);
    };
  }, [canvasVideoOn, canPlayCanvasVideo, canvasVideoSrc, canvasVideoAttempt]);

  const resolvedTitle = currentTrack?.title || currentTrack?.name;

  const normalizeForLyricsMatch = (str) => (str || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const activeTrackLyrics = lyrics.find(
    item => normalizeForLyricsMatch(item.id) === normalizeForLyricsMatch(resolvedTitle)
  )?.text;

  // 🌟 Parse timed lyrics and track active line index in real time
  const parsedLyrics = useMemo(() => parseSyncedLyrics(activeTrackLyrics || ''), [activeTrackLyrics]);
  const activeLyricsLineIndex = parsedLyrics.isSynced
    ? getActiveLyricsLineIndex(parsedLyrics.lines, trackProgress)
    : -1;

  const activeLineRef = useRef(null);
  const lyricsScrollContainerRef = useRef(null);
  const scrollAnimationFrameRef = useRef(null);

  // 🌟 Custom rAF-driven scroll animation, duration/easing-matched to the line's own
  // transform transition below, so the line's position glide and its size/color fade
  // read as ONE motion instead of two competing animations.
  const LYRICS_TRANSITION_MS = 480;
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

  const lyricsViewActive = showLyricsSheet || lyricsInlineMode;
  useEffect(() => {
    if (!lyricsViewActive || !parsedLyrics.isSynced || activeLyricsLineIndex < 0) return;
    const autoScrollSetting = localStorage.getItem('sonara_lyrics_autoscroll') !== 'false';
    if (!autoScrollSetting) return;

    const container = lyricsScrollContainerRef.current;
    const activeEl = activeLineRef.current;
    if (!container || !activeEl) return;

    // Because the active line scales via `transform` (not font-size) it never
    // triggers layout, so offsetTop is stable and this target won't drift mid-animation.
    const targetScrollTop = activeEl.offsetTop - (container.clientHeight / 2) + (activeEl.clientHeight / 2);
    const startScrollTop = container.scrollTop;
    const distance = targetScrollTop - startScrollTop;

    if (scrollAnimationFrameRef.current) {
      cancelAnimationFrame(scrollAnimationFrameRef.current);
    }

    // Skip the animation entirely if we're already essentially there (avoids a
    // pointless micro-scroll "twitch" on lines that don't need to move much).
    if (Math.abs(distance) < 1) return;

    const startTime = performance.now();
    const step = (now) => {
      const progress = Math.min((now - startTime) / LYRICS_TRANSITION_MS, 1);
      container.scrollTop = startScrollTop + distance * easeOutCubic(progress);
      if (progress < 1) {
        scrollAnimationFrameRef.current = requestAnimationFrame(step);
      } else {
        scrollAnimationFrameRef.current = null;
      }
    };
    scrollAnimationFrameRef.current = requestAnimationFrame(step);

    return () => {
      if (scrollAnimationFrameRef.current) {
        cancelAnimationFrame(scrollAnimationFrameRef.current);
        scrollAnimationFrameRef.current = null;
      }
    };
  }, [lyricsViewActive, parsedLyrics.isSynced, activeLyricsLineIndex]);

  // 🌟 Clean text-only lyrics rendering optimized for GPU-accelerated transitions.
  // Size now animates via `transform: scale` instead of `font-size`: font-size is a
  // layout property, so it reflows (and shifts every line below it) on every single
  // frame of its own transition — that's what was producing the "jump" before the
  // scroll caught up. Transform is compositor-only, so the line's box never moves,
  // only its painted pixels — perfectly smooth and it keeps scroll math stable.
  const renderSyncedLyricsLines = () => (
    parsedLyrics.lines.map((line, idx) => {
      const isActive = idx === activeLyricsLineIndex;
      return (
        <p
          key={idx}
          ref={isActive ? activeLineRef : null}
          onClick={() => line.time !== null && onSeekProgress && onSeekProgress(line.time)}
          style={{
            margin: '0 0 26px 0',
            width: '74%', // reserve headroom so the active line's 1.32x scale can never clip the right edge; same for every line so switching active states causes zero layout shift
            boxSizing: 'border-box',
            fontSize: '1.05rem',
            fontWeight: isActive ? '800' : '600',
            cursor: line.time !== null ? 'pointer' : 'default',
            color: isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.28)',
            backgroundColor: 'transparent',
            padding: '0',
            borderRadius: '0',
            transform: isActive ? 'translateZ(0) scale(1.32)' : 'translateZ(0) scale(1)',
            transformOrigin: 'left center',
            textShadow: isActive ? '0 0 25px rgba(255, 255, 255, 0.5)' : 'none',
            transition: `transform ${LYRICS_TRANSITION_MS}ms cubic-bezier(0.22, 1, 0.36, 1), color 0.4s ease, text-shadow 0.4s ease`,
            willChange: 'transform',
            userSelect: 'none'
          }}
        >
          {line.text || '\u00A0'}
        </p>
      );
    })
  );

  if (!currentTrack) return null;

  const formatTimeSignature = (seconds) => {
    if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const progressPercent = trackDuration > 0 ? (trackProgress / trackDuration) * 100 : 0;

  const handleShareSong = async () => {
    setShowMoreMenu(false);
    const shareData = {
      title: resolvedTitle,
      text: `Listening to "${resolvedTitle}" by ${currentTrack.artist} on Sonara!`,
      url: currentTrack.songUrl || currentTrack.audioUrl || window.location.href
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
        displayToast('Song share link copied to clipboard!');
      }
    } catch (err) {
      console.log("Share sheet dismissed:", err);
    }
  };

  const handleDownloadClick = async () => {
    if (isDownloaded || isDownloading) return;
    try {
      setIsDownloading(true);
      await downloadTrackToDevice(currentTrack);
      setIsDownloaded(true);
      const dlQualityLabel = QUALITY_LABELS[currentDownloadQuality] || currentDownloadQuality;
      displayToast(`Saved "${resolvedTitle}" offline (${dlQualityLabel})!`);
    } catch (err) {
      console.error('Offline download failed:', err);
      displayToast("Offline download failed.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopyLink = () => {
    const songUrl = currentTrack.songUrl || currentTrack.audioUrl || '';
    if (songUrl) {
      navigator.clipboard.writeText(songUrl);
      displayToast('Track audio link copied!');
    }
    setShowMoreMenu(false);
  };

  const handleViewArtist = () => {
    onGoToArtist?.(currentTrack);
    setShowMoreMenu(false);
  };

  return (
    <div 
      style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: '#05070c', zIndex: 300, display: 'flex',
        flexDirection: 'column', justifyContent: 'space-between',
        boxSizing: 'border-box', overflow: 'hidden'
      }}
    >
      {toastMessage && (
        <div
          style={{
            position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 24px)', left: '24px', right: '24px', zIndex: 9999,
            backgroundColor: '#0d2218', border: '1px solid var(--accent)', borderRadius: '14px',
            padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '10px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)', animation: 'slideDownToast 0.25s ease'
          }}
        >
          <i className="fa-solid fa-circle-check" style={{ color: 'var(--accent)', fontSize: '1rem' }}></i>
          <span style={{ fontSize: '0.84rem', fontWeight: '600', color: '#ffffff' }}>{toastMessage}</span>
        </div>
      )}

      {/* Static Blurred Cover Background */}
      <div 
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundImage: `url(${resolvedImgSrc})`,
          backgroundSize: 'cover', backgroundPosition: 'center', 
          filter: 'blur(50px) brightness(0.3)',
          transform: 'scale(1.2)', zIndex: -1
        }}
      />

      <div 
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 24px calc(env(safe-area-inset-bottom, 0px) + 20px)',
          boxSizing: 'border-box'
        }}
      >
        {/* Top Header Bar with Working Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', position: 'relative', zIndex: 10 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', fontSize: '1.2rem', padding: '4px', pointerEvents: 'auto' }}>
            <i className="fa-solid fa-chevron-down"></i>
          </button>
          <button
            onClick={() => AudioRouteInfo.openBluetoothSettings().catch(() => {})}
            title="Tap to manage audio output device"
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '20px',
              padding: '6px 14px',
              cursor: 'pointer', pointerEvents: 'auto',
              display: 'flex', alignItems: 'center', gap: '8px', maxWidth: '68%',
              transition: 'all 0.15s ease'
            }}
          >
            {audioRoute?.connected && audioRoute?.deviceType === 'bluetooth' ? (
              <>
                <i className="fa-brands fa-bluetooth-b" style={{ fontSize: '0.82rem', color: 'var(--accent)' }}></i>
                <span style={{
                  margin: 0, fontSize: '0.74rem', fontWeight: '700', letterSpacing: '0.3px',
                  color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                }}>
                  {audioRoute.deviceName || 'Bluetooth Device'}
                </span>
              </>
            ) : audioRoute?.connected && audioRoute?.deviceType === 'wired' ? (
              <>
                <i className="fa-solid fa-headphones" style={{ fontSize: '0.82rem', color: 'var(--accent)' }}></i>
                <span style={{
                  margin: 0, fontSize: '0.74rem', fontWeight: '700', letterSpacing: '0.3px',
                  color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                }}>
                  {audioRoute.deviceName || 'Wired Headphones'}
                </span>
              </>
            ) : (
              <>
                <i className="fa-solid fa-mobile-screen" style={{ fontSize: '0.82rem', color: 'rgba(255, 255, 255, 0.7)' }}></i>
                <span style={{
                  margin: 0, fontSize: '0.74rem', fontWeight: '600', letterSpacing: '0.3px',
                  color: 'rgba(255, 255, 255, 0.85)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                }}>
                  Phone Speaker
                </span>
              </>
            )}
          </button>
          <button 
            onClick={() => setShowMoreMenu(true)} 
            style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', fontSize: '1.2rem', padding: '4px', pointerEvents: 'auto' }}
          >
            <i className="fa-solid fa-ellipsis-vertical"></i>
          </button>
        </div>

        {/* Middle Section: Centered Scrolling Container with hardware acceleration */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', minHeight: 0, flex: lyricsInlineMode ? 1 : 'initial', margin: '2px 0', zIndex: 5 }}>
          {lyricsInlineMode && activeTrackLyrics ? (
            <div
              ref={lyricsScrollContainerRef}
              style={{
                width: '100%', 
                height: '350px', 
                overflowY: 'auto', 
                textAlign: 'left',
                padding: '160px 8px 160px 8px', 
                scrollBehavior: 'auto', // manual rAF animation below drives the scroll now
                lineHeight: '1.9',
                WebkitOverflowScrolling: 'touch',
                maskImage: 'linear-gradient(to bottom, transparent 0, #000 40px, #000 calc(100% - 40px), transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to bottom, transparent 0, #000 40px, #000 calc(100% - 40px), transparent 100%)'
              }}
              className="lyrics-scroll-deck-view"
            >
              {parsedLyrics.isSynced ? (
                renderSyncedLyricsLines()
              ) : (
                <div style={{ color: 'rgba(255,255,255,0.85)', lineHeight: '2', whiteSpace: 'pre-line', fontSize: '1.15rem', fontWeight: '700' }}>
                  {activeTrackLyrics}
                </div>
              )}
            </div>
          ) : (
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '30px' }}>
              <div style={{ width: '100%', aspectRatio: '1/1', maxHeight: '380px', position: 'relative', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.6)' }}>
                {canvasVideoOn && canPlayCanvasVideo ? (
                  <video
                    key={`${canvasVideoSrc}-${canvasVideoAttempt}`}
                    ref={canvasVideoRef}
                    src={canvasVideoSrc}
                    poster={resolvedImgSrc}
                    autoPlay
                    loop
                    muted
                    playsInline
                    webkit-playsinline="true"
                    preload="auto"
                    disablePictureInPicture
                    controls={false}
                    onError={() => {
                      // Genuinely broken/unreachable source — don't leave the user staring
                      // at a frozen frame with no explanation, fall back to cover art.
                      setCanvasVideoError(true);
                      setCanvasVideoOn(false);
                      displayToast('Canvas video unavailable right now');
                    }}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', backgroundColor: 'transparent' }}
                  />
                ) : (
                  <CachedImage
                    src={resolvedImgSrc}
                    alt={resolvedTitle}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                )}

                {hasCanvasVideo && (
                  <button
                    onClick={() => {
                      if (!canPlayCanvasVideo) return;
                      setCanvasVideoOn(v => {
                        const next = !v;
                        if (next) {
                          // Force a brand-new <video> element every time it's switched on —
                          // guards against WebViews that leave a stale/stuck media element
                          // behind after the first toggle instead of cleanly starting fresh.
                          setCanvasVideoError(false);
                          setCanvasVideoAttempt(a => a + 1);
                        }
                        return next;
                      });
                    }}
                    disabled={!canPlayCanvasVideo}
                    title={
                      !canPlayCanvasVideo
                        ? 'Canvas video unavailable offline'
                        : canvasVideoOn ? 'Show cover art' : 'Play 30s Canvas video'
                    }
                    style={{
                      position: 'absolute', bottom: '10px', right: '10px', zIndex: 8,
                      display: 'flex', alignItems: 'center', gap: '6px',
                      backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
                      border: '1px solid rgba(255,255,255,0.2)', borderRadius: '20px',
                      padding: '7px 12px', color: '#ffffff', fontSize: '0.72rem', fontWeight: '700',
                      cursor: canPlayCanvasVideo ? 'pointer' : 'not-allowed',
                      opacity: canPlayCanvasVideo ? 1 : 0.45
                    }}
                  >
                    <i className={canvasVideoOn ? 'fa-solid fa-image' : 'fa-solid fa-clapperboard'}></i>
                    {canvasVideoOn ? 'Cover' : 'Video'}
                  </button>
                )}
              </div>

              {activeTrackLyrics && (
                <div
                  onClick={() => setLyricsInlineMode(true)}
                  style={{
                    width: '100%',
                    backgroundColor: 'rgba(24, 28, 36, 0.94)', backdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '14px',
                    padding: '12px 16px', cursor: 'pointer', boxShadow: '0 8px 20px rgba(0,0,0,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 6,
                    boxSizing: 'border-box'
                  }}
                >
                  <div style={{ overflow: 'hidden', paddingRight: '8px' }}>
                    <span style={{ fontSize: '0.62rem', color: '#1db954', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', marginBottom: '2px' }}>
                      LIVE LYRICS
                    </span>
                    <p style={{ margin: 0, fontSize: '0.88rem', color: '#fff', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {activeLyricsLineIndex >= 0 && parsedLyrics.lines[activeLyricsLineIndex]?.text 
                        ? parsedLyrics.lines[activeLyricsLineIndex].text 
                        : (parsedLyrics.lines[0]?.text || 'Tap to view live lyrics')}
                    </p>
                  </div>
                  <i className="fa-solid fa-expand" style={{ color: '#ffffff', fontSize: '0.85rem', flexShrink: 0, opacity: 0.85 }}></i>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Track Controls Pushed 20px Up */}
        <div style={{ width: '100%', position: 'relative', zIndex: 10, marginTop: '-20px' }}>
          {/* Row 1: Track Details & Primary Quick Actions (Like & Add to Playlist) */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', gap: '12px' }}>
            <div style={{ overflow: 'hidden', flex: 1, minWidth: 0 }}>
              <h2 style={{
                margin: '0 0 3px 0',
                fontSize: '1.45rem',
                fontWeight: '800',
                color: '#ffffff',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                letterSpacing: '-0.3px',
                lineHeight: 1.25
              }}>
                {resolvedTitle}
              </h2>
              <p 
                onClick={handleViewArtist}
                style={{
                  margin: 0,
                  fontSize: '0.94rem',
                  color: 'rgba(255,255,255,0.68)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
                title="View artist profile"
              >
                {currentTrack.artist}
              </p>
            </div>
            
            {/* Primary Track Actions: Like & Add to Playlist */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexShrink: 0, position: 'relative' }}>
              <button 
                onClick={(e) => onToggleLike && onToggleLike(e)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: isLiked ? 'var(--accent, #1db954)' : 'rgba(255, 255, 255, 0.75)',
                  fontSize: '1.4rem',
                  cursor: 'pointer',
                  padding: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'transform 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
                }}
                title={isLiked ? "Remove from Liked Songs" : "Save to Liked Songs"}
              >
                <i className={`fa-${isLiked ? 'solid' : 'regular'} fa-heart`}></i>
              </button>

              <button 
                onClick={() => setShowPlaylistDropdown(!showPlaylistDropdown)} 
                style={{
                  background: 'none',
                  border: 'none',
                  color: showPlaylistDropdown ? 'var(--accent, #1db954)' : 'rgba(255, 255, 255, 0.75)',
                  fontSize: '1.38rem',
                  cursor: 'pointer',
                  padding: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                title="Add to Playlist"
              >
                <i className="fa-solid fa-circle-plus"></i>
              </button>

              {showPlaylistDropdown && (
                <div className="premium-dropdown-menu" style={{ position: 'absolute', bottom: '44px', right: 0, top: 'auto', width: '200px', zIndex: 100 }}>
                  <p className="dropdown-menu-header">Add to Playlist</p>
                  <div className="dropdown-scroll-container">
                    {playlists && playlists.length > 0 ? (
                      playlists.map(pl => (
                        <button
                          key={pl.id}
                          onClick={() => {
                            onAddSongToPlaylist(pl.id, currentTrack);
                            setShowPlaylistDropdown(false);
                            displayToast(`Added to "${pl.playlistName}"`);
                          }}
                          className="dropdown-playlist-option"
                        >
                          <span className="dropdown-playlist-name-text" style={{ fontSize: '0.85rem' }}>{pl.playlistName}</span>
                        </button>
                      ))
                    ) : (
                      <p style={{ padding: '8px', fontSize: '0.75rem', color: '#ff4d4d', textAlign: 'center', margin: 0 }}>No playlists found</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Row 2: Audio Format & Acoustic Technology Badges (Single-line non-wrapping) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '12px',
            overflowX: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            flexWrap: 'nowrap'
          }}>
            <span 
              style={{
                fontSize: '0.62rem',
                fontWeight: '800',
                letterSpacing: '0.4px',
                textTransform: 'uppercase',
                padding: '3px 8px',
                borderRadius: '8px',
                backgroundColor: isDownloaded ? 'rgba(29, 185, 84, 0.16)' : 'rgba(255, 255, 255, 0.08)',
                color: isDownloaded ? 'var(--accent)' : 'rgba(255, 255, 255, 0.88)',
                border: isDownloaded ? '1px solid rgba(29, 185, 84, 0.35)' : '1px solid rgba(255, 255, 255, 0.12)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                flexShrink: 0
              }}
              title={isDownloaded ? "Playing from offline storage" : `Streaming at ${currentStreamingQuality} bitrate`}
            >
              <i className={isDownloaded ? "fa-solid fa-circle-down" : "fa-solid fa-bolt"} style={{ fontSize: '0.58rem' }}></i>
              {isDownloaded ? 'Offline Lossless' : `${currentStreamingQuality.toUpperCase()} • ${QUALITY_LABELS[currentStreamingQuality] || '320 KBPS'}`}
            </span>

            {dolbyAtmos && (
              <span
                className="dolby-atmos-pill"
                style={{
                  fontSize: '0.62rem',
                  fontWeight: '800',
                  letterSpacing: '0.4px',
                  padding: '3px 8px',
                  borderRadius: '8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  flexShrink: 0
                }}
                title="Dolby Atmos 3D Virtualizer Active"
              >
                <i className="fa-solid fa-volume-high" style={{ fontSize: '0.6rem' }}></i> ATMOS 3D
              </span>
            )}

            {spatialAudio && (
              <span
                style={{
                  fontSize: '0.62rem',
                  fontWeight: '800',
                  letterSpacing: '0.4px',
                  padding: '3px 8px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(56, 189, 248, 0.16)',
                  color: '#38bdf8',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  flexShrink: 0
                }}
                title="3D Spatial Audio Immersion Active"
              >
                <i className="fa-solid fa-headphones" style={{ fontSize: '0.6rem' }}></i> 3D SPATIAL
              </span>
            )}
          </div>

          <div style={{ marginBottom: '14px' }}>
            <input 
              type="range"
              min="0"
              max={trackDuration || 100}
              value={trackProgress}
              onChange={(e) => onSeekProgress && onSeekProgress(parseFloat(e.target.value))}
              style={{
                width: '100%', height: '4px', WebkitAppearance: 'none', appearance: 'none',
                background: `linear-gradient(to right, #ffffff 0%, #ffffff ${progressPercent}%, rgba(255,255,255,0.2) ${progressPercent}%, rgba(255,255,255,0.2) 100%)`,
                borderRadius: '2px', outline: 'none', cursor: 'pointer', margin: '4px 0 3px 0'
              }}
              className="player-timeline-seeker-slider"
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', fontWeight: '500' }}>
              <span>{formatTimeSignature(trackProgress)}</span>
              <span>{formatTimeSignature(trackDuration)}</span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px', marginBottom: '6px' }}>
            <button onClick={onToggleShuffle} style={{ background: 'none', border: 'none', color: isShuffle ? 'var(--accent)' : '#ffffff', fontSize: '1.2rem', cursor: 'pointer' }}>
              <i className="fa-solid fa-shuffle"></i>
            </button>

            <button onClick={onPrev} style={{ background: 'none', border: 'none', color: '#ffffff', fontSize: '1.8rem', cursor: 'pointer' }}>
              <i className="fa-solid fa-backward-step"></i>
            </button>

            <button 
              onClick={onTogglePlay} 
              style={{
                width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#ffffff',
                color: '#000000', border: 'none', fontSize: '1.6rem', display: 'flex',
                alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
              }}
            >
              <i className={isPlaying ? "fa-solid fa-pause" : "fa-solid fa-play"} style={!isPlaying ? { marginLeft: '4px' } : {}}></i>
            </button>

            <button onClick={onNext} style={{ background: 'none', border: 'none', color: '#ffffff', fontSize: '1.8rem', cursor: 'pointer' }}>
              <i className="fa-solid fa-forward-step"></i>
            </button>

            <button onClick={onToggleRepeat} style={{ background: 'none', border: 'none', color: isRepeat ? 'var(--accent)' : '#ffffff', fontSize: '1.2rem', cursor: 'pointer', position: 'relative' }}>
              <i className="fa-solid fa-repeat"></i>
              {isRepeat && <span style={{ position: 'absolute', bottom: '-4px', left: '50%', transform: 'translateX(-50%)', width: '4px', height: '4px', backgroundColor: 'var(--accent)', borderRadius: '50%' }}></span>}
            </button>
          </div>

          {/* Row 5: Sleek Player Tools & Utilities Dock (Queue, Lyrics, Download, Share, Sleep Timer) */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '4px 6px',
            marginTop: '2px',
            background: 'rgba(255, 255, 255, 0.035)',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(12px)',
            position: 'relative'
          }}>
            {/* 1. Queue */}
            <button 
              onClick={onOpenQueue}
              style={{
                background: 'none', border: 'none',
                color: 'rgba(255, 255, 255, 0.85)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                cursor: 'pointer', padding: '6px 8px', borderRadius: '10px',
                minWidth: '52px'
              }}
              title="Up Next / Queue"
            >
              <i className="fa-solid fa-list-ul" style={{ fontSize: '1.02rem' }}></i>
              <span style={{ fontSize: '0.64rem', fontWeight: '600', letterSpacing: '0.2px' }}>Queue</span>
            </button>

            {/* 2. Lyrics */}
            <button
              onClick={() => setLyricsInlineMode(prev => !prev)}
              style={{
                background: lyricsInlineMode ? 'rgba(29, 185, 84, 0.16)' : 'none',
                border: 'none',
                color: lyricsInlineMode ? 'var(--accent, #1db954)' : (activeTrackLyrics ? 'rgba(255, 255, 255, 0.85)' : 'rgba(255, 255, 255, 0.35)'),
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                cursor: activeTrackLyrics ? 'pointer' : 'default',
                padding: '6px 8px', borderRadius: '10px',
                minWidth: '52px'
              }}
              title={lyricsInlineMode ? "Hide live lyrics" : "Show live lyrics"}
              disabled={!activeTrackLyrics}
            >
              <i className="fa-solid fa-microphone-lines" style={{ fontSize: '1.02rem' }}></i>
              <span style={{ fontSize: '0.64rem', fontWeight: '600', letterSpacing: '0.2px' }}>Lyrics</span>
            </button>

            {/* 3. Download */}
            <button 
              onClick={handleDownloadClick}
              style={{
                background: isDownloaded ? 'rgba(29, 185, 84, 0.16)' : 'none',
                border: 'none',
                color: isDownloaded ? 'var(--accent, #1db954)' : 'rgba(255, 255, 255, 0.85)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                cursor: 'pointer', padding: '6px 8px', borderRadius: '10px',
                minWidth: '52px'
              }}
              title={isDownloaded ? "Saved Offline" : "Download Track"}
            >
              <i className={isDownloading ? "fa-solid fa-spinner fa-spin" : isDownloaded ? "fa-solid fa-circle-check" : "fa-solid fa-circle-down"} style={{ fontSize: '1.02rem' }}></i>
              <span style={{ fontSize: '0.64rem', fontWeight: '600', letterSpacing: '0.2px' }}>
                {isDownloading ? 'Saving...' : isDownloaded ? 'Offline' : 'Save'}
              </span>
            </button>

            {/* 4. Share */}
            <button 
              onClick={handleShareSong}
              style={{
                background: 'none', border: 'none',
                color: 'rgba(255, 255, 255, 0.85)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                cursor: 'pointer', padding: '6px 8px', borderRadius: '10px',
                minWidth: '52px'
              }}
              title="Share track"
            >
              <i className="fa-solid fa-share-nodes" style={{ fontSize: '1.02rem' }}></i>
              <span style={{ fontSize: '0.64rem', fontWeight: '600', letterSpacing: '0.2px' }}>Share</span>
            </button>

            {/* 5. Sleep Timer */}
            <button 
              onClick={() => setShowTimerMenu(!showTimerMenu)}
              style={{
                background: sleepTimeLeft ? 'rgba(29, 185, 84, 0.16)' : 'none',
                border: 'none',
                color: sleepTimeLeft ? 'var(--accent, #1db954)' : 'rgba(255, 255, 255, 0.85)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px',
                cursor: 'pointer', padding: '6px 8px', borderRadius: '10px',
                minWidth: '52px'
              }}
              title={sleepTimeLeft ? `Sleep timer active: ${sleepTimeLeft}m left` : "Set Sleep Timer"}
            >
              <i className="fa-solid fa-stopwatch" style={{ fontSize: '1.02rem' }}></i>
              <span style={{ fontSize: '0.64rem', fontWeight: '600', letterSpacing: '0.2px' }}>
                {sleepTimeLeft ? `${sleepTimeLeft}m` : 'Timer'}
              </span>
            </button>

            {/* Floating Timer Picker Popover */}
            {showTimerMenu && (
              <div style={{
                position: 'absolute', bottom: '54px', right: '4px',
                backgroundColor: 'rgba(17, 24, 39, 0.96)', border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '12px', padding: '6px', zIndex: 320, display: 'flex', gap: '6px',
                boxShadow: '0 10px 28px rgba(0,0,0,0.6)', backdropFilter: 'blur(16px)'
              }}>
                {[5, 15, 30, 45, 60].map(mins => (
                  <button
                    key={mins}
                    onClick={() => {
                      onSetSleepTimer(sleepTimeLeft === mins ? null : mins);
                      setShowTimerMenu(false);
                    }}
                    style={{
                      backgroundColor: sleepTimeLeft === mins ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
                      border: 'none', borderRadius: '6px', color: sleepTimeLeft === mins ? '#000000' : '#ffffff',
                      padding: '6px 10px', fontSize: '0.74rem', fontWeight: '700', cursor: 'pointer'
                    }}
                  >
                    {mins}m
                  </button>
                ))}
                {sleepTimeLeft && (
                  <button
                    onClick={() => {
                      onSetSleepTimer(null);
                      setShowTimerMenu(false);
                    }}
                    style={{
                      backgroundColor: 'rgba(255, 77, 77, 0.2)',
                      border: '1px solid rgba(255, 77, 77, 0.4)', borderRadius: '6px', color: '#ff6b6b',
                      padding: '6px 8px', fontSize: '0.74rem', fontWeight: '700', cursor: 'pointer'
                    }}
                    title="Cancel Sleep Timer"
                  >
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                )}
              </div>
            )}
          </div>

        </div>
      </div>

      {showMoreMenu && (
        <div 
          onClick={() => setShowMoreMenu(false)}
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 400, display: 'flex',
            flexDirection: 'column', justifyContent: 'flex-end'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#111622', borderTopLeftRadius: '24px', borderTopRightRadius: '24px',
              padding: '24px 16px', borderTop: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 -8px 32px rgba(0,0,0,0.5)', animation: 'slideUpSheet 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', paddingBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: '16px' }}>
              <CachedImage src={resolvedImgSrc} alt={resolvedTitle} style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover' }} />
              <div style={{ overflow: 'hidden' }}>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{resolvedTitle}</h4>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentTrack.artist}</p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <button className="sheet-action-row-item" onClick={handleViewArtist}>
                <i className="fa-solid fa-user sheet-icon"></i> View Artist Profile
              </button>
              
              <button className="sheet-action-row-item" onClick={() => { onGoToAlbum?.(currentTrack); setShowMoreMenu(false); }}>
                <i className="fa-solid fa-compact-disc sheet-icon"></i> Go to Album
              </button>

              <button 
                className="sheet-action-row-item" 
                onClick={() => {
                  handleDownloadClick();
                  setShowMoreMenu(false);
                }}
                style={{ color: isDownloaded ? 'var(--accent)' : '#ffffff' }}
              >
                <i className={isDownloading ? "fa-solid fa-spinner fa-spin sheet-icon" : isDownloaded ? "fa-solid fa-circle-check sheet-icon" : "fa-solid fa-circle-down sheet-icon"}></i>
                {isDownloading ? "Downloading Track..." : isDownloaded ? "Saved Offline" : "Download Song"}
              </button>

              <button className="sheet-action-row-item" onClick={handleShareSong}>
                <i className="fa-solid fa-share-nodes sheet-icon"></i> Share Song Link
              </button>

              <button className="sheet-action-row-item" onClick={handleCopyLink}>
                <i className="fa-solid fa-link sheet-icon"></i> Copy Raw Track Link
              </button>

              <button 
                className="sheet-action-row-item" 
                onClick={() => {
                  setShowMoreMenu(false);
                  setLyricsInlineMode(true);
                }}
              >
                <i className="fa-solid fa-microphone-lines sheet-icon"></i> Show Live Lyrics View
              </button>

              <button className="sheet-action-row-item close-sheet-btn" onClick={() => setShowMoreMenu(false)} style={{ marginTop: '12px', color: '#ff4d4d', justifyContent: 'center', fontWeight: '700' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}