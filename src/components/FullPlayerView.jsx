import React, { useState, useEffect, useRef, useMemo } from 'react';
import { downloadTrackToDevice, isTrackCachedOffline } from '../utils/offlineStorage';
import { parseSyncedLyrics, getActiveLyricsLineIndex } from '../utils/lyricsSync';

export default function FullPlayerView({ 
  currentTrack, isPlaying, playlists, lyrics, isShuffle, isRepeat, sleepTimeLeft, trackProgress, trackDuration, lyricsSize,
  onTogglePlay, onNext, onPrev, onSeekProgress, onToggleShuffle, onToggleRepeat, onSetSleepTimer, onAddSongToPlaylist, onGoToAlbum, onGoToArtist, onOpenQueue, onClose 
}) {
  const [showTimerMenu, setShowTimerMenu] = useState(false);
  const [showPlaylistDropdown, setShowPlaylistDropdown] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showLyricsSheet, setShowLyricsSheet] = useState(false);
  const [lyricsInlineMode, setLyricsInlineMode] = useState(false);

  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const displayToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const resolvedImgSrc = currentTrack?.cover || currentTrack?.image || currentTrack?.imageUrl;

  useEffect(() => {
    if (currentTrack) {
      setIsDownloaded(isTrackCachedOffline(currentTrack.id));
      setLyricsInlineMode(false);
    }
  }, [currentTrack]);

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
    if (isNaN(seconds) || seconds === undefined) return '0:00';
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
      displayToast(`Saved "${resolvedTitle}" offline!`);
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
            position: 'absolute', top: '32px', left: '24px', right: '24px', zIndex: 9999,
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
          justifyContent: 'space-between', padding: '20px 24px', boxSizing: 'border-box'
        }}
      >
        {/* Top Header Bar with Working Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', position: 'relative', zIndex: 10 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', fontSize: '1.2rem', padding: '4px', pointerEvents: 'auto' }}>
            <i className="fa-solid fa-chevron-down"></i>
          </button>
          <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: '600', letterSpacing: '1px', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase' }}>
            Playing from Library
          </p>
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
              <div style={{ width: '100%', aspectRatio: '1/1', maxHeight: '380px' }}>
                <img 
                  src={resolvedImgSrc} 
                  alt={resolvedTitle} 
                  style={{ width: '100%', height: '100%', borderRadius: '16px', objectFit: 'cover', boxShadow: '0 20px 40px rgba(0,0,0,0.6)' }}
                />
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div style={{ overflow: 'hidden', paddingRight: '16px' }}>
              <h2 style={{ margin: '0 0 4px 0', fontSize: '1.35rem', fontWeight: '700', color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {resolvedTitle}
              </h2>
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {currentTrack.artist}
              </p>
            </div>
            
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexShrink: 0, position: 'relative' }}>
              <button 
                onClick={handleDownloadClick}
                style={{ background: 'none', border: 'none', color: isDownloaded ? 'var(--accent)' : '#ffffff', fontSize: '1.25rem', cursor: 'pointer', padding: '4px' }}
                title={isDownloaded ? "Saved Offline" : "Download Track"}
              >
                <i className={isDownloading ? "fa-solid fa-spinner fa-spin" : isDownloaded ? "fa-solid fa-circle-down" : "fa-solid fa-download"}></i>
              </button>

              <button 
                onClick={handleShareSong}
                style={{ background: 'none', border: 'none', color: '#ffffff', fontSize: '1.25rem', cursor: 'pointer', padding: '4px' }}
                title="Share track details"
              >
                <i className="fa-solid fa-share-nodes"></i>
              </button>

              {sleepTimeLeft != null && (
                <button
                  onClick={() => onSetSleepTimer(null)}
                  title="Cancel sleep timer"
                  style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '1.2rem', cursor: 'pointer' }}
                >
                  <i className="fa-solid fa-circle-xmark"></i>
                </button>
              )}

              {activeTrackLyrics && (
                <button
                  onClick={() => setLyricsInlineMode(prev => !prev)}
                  title={lyricsInlineMode ? "Show album art" : "Show live lyrics"}
                  style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    backgroundColor: lyricsInlineMode ? 'var(--accent)' : 'rgba(255,255,255,0.1)',
                    border: 'none', color: lyricsInlineMode ? '#000000' : '#ffffff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '0.9rem'
                  }}
                >
                  <i className="fa-solid fa-microphone-lines"></i>
                </button>
              )}

              <button 
                onClick={() => setShowPlaylistDropdown(!showPlaylistDropdown)} 
                style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '1.3rem', cursor: 'pointer' }}
              >
                <i className="fa-solid fa-circle-plus"></i>
              </button>

              {showPlaylistDropdown && (
                <div className="premium-dropdown-menu" style={{ position: 'absolute', bottom: '40px', right: 0, top: 'auto', width: '180px' }}>
                  <p className="dropdown-menu-header">Add to Playlist</p>
                  <div className="dropdown-scroll-container">
                    {playlists && playlists.length > 0 ? (
                      playlists.map(pl => (
                        <button
                          key={pl.id}
                          onClick={() => {
                            onAddSongToPlaylist(pl.id, currentTrack);
                            setShowPlaylistDropdown(false);
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

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
            <button 
              onClick={onOpenQueue}
              style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '14px', padding: '6px 14px', color: '#ffffff',
                fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
              }}
            >
              <i className="fa-solid fa-list"></i> Queue
            </button>

            <button 
              onClick={() => setShowTimerMenu(!showTimerMenu)}
              style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '14px', padding: '6px 14px', color: sleepTimeLeft ? 'var(--accent)' : '#ffffff',
                fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
              }}
            >
              <i className="fa-solid fa-stopwatch"></i>
              {sleepTimeLeft ? `Sleeps in: ${sleepTimeLeft}m` : 'Sleep Timer'}
            </button>

            {showTimerMenu && (
              <div style={{
                position: 'absolute', bottom: '50px', left: '50%', transform: 'translateX(-50%)',
                backgroundColor: 'rgba(20,28,43,0.95)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px', padding: '8px', zIndex: '320', display: 'flex', gap: '8px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)'
              }}>
                {[5, 15, 30, 45, 60].map(mins => (
                  <button
                    key={mins}
                    onClick={() => {
                      onSetSleepTimer(mins);
                      setShowTimerMenu(false);
                    }}
                    style={{
                      backgroundColor: sleepTimeLeft === mins ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
                      border: 'none', borderRadius: '6px', color: sleepTimeLeft === mins ? '#000000' : '#ffffff',
                      padding: '6px 10px', fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer'
                    }}
                  >
                    {mins}m
                  </button>
                ))}
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
              <img src={resolvedImgSrc} alt={resolvedTitle} style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover' }} />
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