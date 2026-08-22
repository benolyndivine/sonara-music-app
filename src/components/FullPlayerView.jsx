import React, { useState, useEffect } from 'react';
import { downloadTrackToDevice, isTrackCachedOffline } from '../utils/offlineStorage';

export default function FullPlayerView({ 
  currentTrack, isPlaying, playlists, lyrics, isShuffle, isRepeat, sleepTimeLeft, trackProgress, trackDuration, lyricsSize,
  onTogglePlay, onNext, onPrev, onSeekProgress, onToggleShuffle, onToggleRepeat, onSetSleepTimer, onAddSongToPlaylist, onGoToAlbum, onGoToArtist, onClose 
}) {
  
  const [showTimerMenu, setShowTimerMenu] = useState(false);
  const [showPlaylistDropdown, setShowPlaylistDropdown] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showLyricsSheet, setShowLyricsSheet] = useState(false);

  // 🚀 Offline File Cache Local States
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // 🍞 Internal UI Feedback Alert
  const [toastMessage, setToastMessage] = useState(null);

  const displayToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  useEffect(() => {
    if (currentTrack) {
      setIsDownloaded(isTrackCachedOffline(currentTrack.id));
    }
  }, [currentTrack]);

  if (!currentTrack) return null;

  const resolvedImgSrc = currentTrack.cover || currentTrack.image || currentTrack.imageUrl;
  const resolvedTitle = currentTrack.title || currentTrack.name;

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

  const normalizeForLyricsMatch = (str) => (str || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const activeTrackLyrics = lyrics.find(
    item => normalizeForLyricsMatch(item.id) === normalizeForLyricsMatch(resolvedTitle)
  )?.text;

  return (
    <div 
      style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: '#05070c', zIndex: 300, display: 'flex',
        flexDirection: 'column', justifyContent: 'space-between',
        boxSizing: 'border-box', overflow: 'hidden'
      }}
    >
      {/* Internal Floating Toast Indicator */}
      {toastMessage && (
        <div
          style={{
            position: 'absolute',
            top: '32px',
            left: '24px',
            right: '24px',
            zIndex: 9999,
            backgroundColor: '#0d2218',
            border: '1px solid var(--accent)',
            borderRadius: '14px',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            animation: 'slideDownToast 0.25s ease'
          }}
        >
          <i className="fa-solid fa-circle-check" style={{ color: 'var(--accent)', fontSize: '1rem' }}></i>
          <span style={{ fontSize: '0.84rem', fontWeight: '600', color: '#ffffff' }}>{toastMessage}</span>
        </div>
      )}

      {/* Blurred Cover Background */}
      <div 
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundImage: `url(${resolvedImgSrc})`, backgroundSize: 'cover',
          backgroundPosition: 'center', filter: 'blur(40px) brightness(0.35)',
          transform: 'scale(1.2)', zIndex: -1
        }}
      />

      {/* Main Player Canvas Layout */}
      <div 
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          justifyContent: 'space-between', padding: '24px', boxSizing: 'border-box'
        }}
      >
        {/* Top Header Navigation Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', fontSize: '1.2rem' }}>
            <i className="fa-solid fa-chevron-down"></i>
          </button>
          <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: '600', letterSpacing: '1px', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase' }}>
            Recommended For You
          </p>
          <button 
            onClick={() => setShowMoreMenu(true)} 
            style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', fontSize: '1.2rem', padding: '4px' }}
          >
            <i className="fa-solid fa-ellipsis-vertical"></i>
          </button>
        </div>

        {/* Large Central Artwork Card */}
        <div style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', margin: 'auto 0' }}>
          <img 
            src={resolvedImgSrc} 
            alt={resolvedTitle} 
            style={{ width: '100%', aspectRatio: '1/1', borderRadius: '16px', objectFit: 'cover', boxShadow: '0 20px 40px rgba(0,0,0,0.6)' }}
          />
        </div>

        {/* Audio Control Sliders Area */}
        <div style={{ width: '100%', position: 'relative' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ overflow: 'hidden', paddingRight: '16px' }}>
              <h2 style={{ margin: '0 0 6px 0', fontSize: '1.35rem', fontWeight: '700', color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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

              <button 
                onClick={() => onSetSleepTimer(null)} 
                style={{ background: 'none', border: 'none', color: sleepTimeLeft ? 'var(--accent)' : '#ffffff', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                <i className="fa-solid fa-circle-xmark"></i>
              </button>
              
              <button 
                onClick={() => setShowPlaylistDropdown(!showPlaylistDropdown)} 
                style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '1.3rem', cursor: 'pointer' }}
              >
                <i className="fa-solid fa-circle-plus"></i>
              </button>

              {/* Playlist Options Dropdown Context */}
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
                          <span className="dropdown-playlist-name-text" style={{ fontSize: '0.85rem' }}>📁 {pl.playlistName}</span>
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

          {/* Progress Timeline Scrubber */}
          <div style={{ marginBottom: '24px' }}>
            <input 
              type="range"
              min="0"
              max={trackDuration || 100}
              value={trackProgress}
              onChange={(e) => onSeekProgress && onSeekProgress(parseFloat(e.target.value))}
              style={{
                width: '100%', height: '4px', WebkitAppearance: 'none', appearance: 'none',
                background: `linear-gradient(to right, #ffffff 0%, #ffffff ${progressPercent}%, rgba(255,255,255,0.2) ${progressPercent}%, rgba(255,255,255,0.2) 100%)`,
                borderRadius: '2px', outline: 'none', cursor: 'pointer', margin: '12px 0 8px 0'
              }}
              className="player-timeline-seeker-slider"
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', fontWeight: '500' }}>
              <span>{formatTimeSignature(trackProgress)}</span>
              <span>{formatTimeSignature(trackDuration)}</span>
            </div>
          </div>

          {/* Action media track deck buttons row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px', marginBottom: '12px' }}>
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

          {/* Sleep Countdown timer bar trigger */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '10px' }}>
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

      {/* 📱 3-Dot Options Action Bottom Sheet */}
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
                  setShowLyricsSheet(true);
                }}
              >
                <i className="fa-solid fa-microphone-lines sheet-icon"></i> Show Full Lyrics
              </button>

              <button className="sheet-action-row-item close-sheet-btn" onClick={() => setShowMoreMenu(false)} style={{ marginTop: '12px', color: '#ff4d4d', justifyContent: 'center', fontWeight: '700' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📜 SLIDE-UP DEDICATED FULL LYRICS SHEET LAYOUT */}
      {showLyricsSheet && (
        <div 
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(5, 7, 12, 0.92)', backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)',
            zIndex: 500, padding: '32px 24px 24px 24px', display: 'flex', flexDirection: 'column',
            boxSizing: 'border-box', animation: 'slideUpSheet 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '16px' }}>
            <div>
              <p style={{ margin: '0 0 4px 0', fontSize: '0.75rem', fontWeight: '700', color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '1px' }}>Lyrics Panel</p>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#ffffff', fontWeight: '700' }}>{resolvedTitle}</h3>
            </div>
            <button 
              onClick={() => setShowLyricsSheet(false)}
              style={{
                width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.06)',
                border: 'none', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
              }}
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div 
            style={{
              flex: 1, overflowY: 'auto', paddingRight: '4px',
              fontSize: lyricsSize === 'Small' ? '0.95rem' : lyricsSize === 'Large' ? '1.4rem' : '1.15rem',
              color: '#ffffff', fontWeight: '600',
              lineHeight: '1.8', whiteSpace: 'pre-line', 
              letterSpacing: '-0.2px'
            }}
            className="lyrics-scroll-deck-view"
          >
            {activeTrackLyrics ? (
              activeTrackLyrics
            ) : (
              <div style={{ height: '80%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                <i className="fa-solid fa-music-slash" style={{ fontSize: '2rem', marginBottom: '16px', color: 'rgba(255,255,255,0.15)' }}></i>
                Lyrics aren't available for this track yet.
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}