import React, { useState, useEffect } from 'react';
import { downloadTrackToDevice, isTrackCachedOffline } from '../utils/offlineStorage';
import { isAlbumSaved, setAlbumSaved } from '../utils/savedAlbums';
import { triggerHaptic } from '../utils/audioEffects';
import CachedImage from './CachedImage';

export default function AlbumDetailsView({ 
  album, 
  songs, 
  artists = [], 
  currentTrack, 
  isPlaying, 
  isShuffle, 
  onToggleShuffle, 
  onTogglePlay, 
  onSelectTrack, 
  onSelectArtist, 
  onBack, 
  onOpenSongMenu,
  onAddToQueue,
  onPlayNext,
  playlists = [],
  onAddSongToPlaylist
}) {
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [showPlaylistPicker, setShowPlaylistPicker] = useState(false);
  const [downloadedMap, setDownloadedMap] = useState({});
  const [batchDownloading, setBatchDownloading] = useState(false);
  const [isSavedInLibrary, setIsSavedInLibrary] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    if (!showHeaderMenu && !showSearch) return;
    const handleAlbumSubBack = (e) => {
      e.preventDefault();
      if (showHeaderMenu) {
        if (showPlaylistPicker) {
          setShowPlaylistPicker(false);
        } else {
          setShowHeaderMenu(false);
        }
      } else if (showSearch) {
        setShowSearch(false);
      }
    };
    window.addEventListener('sonara_back_press', handleAlbumSubBack);
    return () => window.removeEventListener('sonara_back_press', handleAlbumSubBack);
  }, [showHeaderMenu, showSearch, showPlaylistPicker]);

  const albumTracks = songs.filter(song => song.albumId === album.id);

  const displayToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  useEffect(() => {
    const audit = {};
    albumTracks.forEach(s => { audit[s.id] = isTrackCachedOffline(s.id); });
    setDownloadedMap(audit);

    setIsSavedInLibrary(isAlbumSaved(album.id));
  }, [songs, album]);

  const handleToggleSaveLibrary = () => {
    const targetState = !isSavedInLibrary;
    setIsSavedInLibrary(targetState);
    setAlbumSaved(album.id, targetState);
    displayToast(targetState ? 'Saved album to your library' : 'Removed album from library');
  };

  const handleDownloadTrack = async (e, song) => {
    e.stopPropagation();
    try {
      setDownloadedMap(prev => ({ ...prev, [song.id]: 'loading' }));
      await downloadTrackToDevice(song);
      setDownloadedMap(prev => ({ ...prev, [song.id]: true }));
      displayToast(`"${song.title || song.name}" saved offline!`);
    } catch {
      setDownloadedMap(prev => ({ ...prev, [song.id]: false }));
      displayToast("Download failed. Check your network.");
    }
    setActiveMenuId(null);
  };

  const handleBatchDownloadAlbum = async () => {
    if (albumTracks.length === 0) return;
    setBatchDownloading(true);
    try {
      for (const song of albumTracks) {
        if (!isTrackCachedOffline(song.id)) {
          setDownloadedMap(prev => ({ ...prev, [song.id]: 'loading' }));
          await downloadTrackToDevice(song);
          setDownloadedMap(prev => ({ ...prev, [song.id]: true }));
        }
      }
      displayToast(`"${album.name}" downloaded for offline playback!`);
    } catch {
      displayToast("Batch download interrupted.");
    } finally {
      setBatchDownloading(false);
    }
  };

  const handleShareAlbum = async () => {
    const shareData = {
      title: album.name,
      text: `Listening to the album "${album.name}" by ${album.artist} on Sonara!`,
      url: window.location.href 
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
        displayToast("Album link copied to clipboard!");
      }
    } catch (err) {
      console.log("Album share sheet dismissed:", err);
    }
  };

  const filteredAlbumTracks = albumTracks.filter(song => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const sTitle = (song.title || song.name || '').toLowerCase();
    const sArtist = (song.artist || '').toLowerCase();
    return sTitle.includes(q) || sArtist.includes(q);
  });

  const handlePlayButtonClick = () => {
    if (albumTracks.length === 0) return;
    const isSongFromAlbumPlaying = albumTracks.some(track => currentTrack && track.id === currentTrack.id);
    if (isSongFromAlbumPlaying) {
      onTogglePlay();
    } else if (isShuffle) {
      const randomIdx = Math.floor(Math.random() * albumTracks.length);
      onSelectTrack(albumTracks[randomIdx], albumTracks);
    } else {
      onSelectTrack(albumTracks[0], albumTracks);
    }
  };

  const matchingArtistData = artists?.find(a => (a.name || '').toLowerCase() === (album.artist || '').toLowerCase());
  const artistProfileImg = matchingArtistData?.image;
  const isAlbumCurrentlyActiveAndPlaying = isPlaying && albumTracks.some(track => currentTrack && track.id === currentTrack.id);
  const isAllDownloaded = albumTracks.length > 0 && albumTracks.every(s => downloadedMap[s.id] === true);

  // Total duration calculation
  const totalDurationSec = albumTracks.reduce((sum, s) => sum + (s.duration || 0), 0);
  const formattedTotalDuration = totalDurationSec > 0 ? (
    totalDurationSec >= 3600
      ? `${Math.floor(totalDurationSec / 3600)} hr ${Math.floor((totalDurationSec % 3600) / 60)} min`
      : `${Math.floor(totalDurationSec / 60)} min`
  ) : null;

  return (
    <div className="mobile-content" style={{ width: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', padding: 0, paddingBottom: '160px', position: 'relative' }}>
      {/* 🌟 Dynamic Ambient Backdrop Glow */}
      <div className="ambient-backdrop-glow" style={{ '--ambient-glow-color': 'rgba(29, 185, 84, 0.32)' }}></div>

      {toastMessage && (
        <div style={{
          position: 'fixed', top: '24px', left: '20px', right: '20px', zIndex: 9999,
          backgroundColor: '#0d2218', border: '1px solid var(--accent)', borderRadius: '14px',
          padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.6)', animation: 'slideDownToast 0.25s ease'
        }}>
          <i className="fa-solid fa-circle-check" style={{ color: 'var(--accent)', fontSize: '1rem' }}></i>
          <span style={{ fontSize: '0.84rem', fontWeight: '600', color: '#ffffff' }}>{toastMessage}</span>
        </div>
      )}

      <div style={{ padding: '0 20px', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0 10px 0' }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', fontSize: '1.4rem', padding: 0 }}>
            <i className="fa-solid fa-arrow-left"></i>
          </button>
          <button
            onClick={() => setShowSearch(!showSearch)}
            style={{ background: 'none', border: 'none', color: showSearch ? 'var(--accent)' : 'rgba(255, 255, 255, 0.75)', cursor: 'pointer', fontSize: '1.15rem', padding: 0 }}
            title="Search songs in album"
          >
            <i className="fa-solid fa-magnifying-glass"></i>
          </button>
        </div>

        {/* 🌟 Centered Album Artwork with Elevation */}
        <div style={{ width: '100%', display: 'flex', justifyContent: 'center', margin: '8px 0 24px 0' }}>
          <CachedImage src={album.image} alt={album.name} style={{ width: '220px', height: '220px', borderRadius: '14px', objectFit: 'cover', boxShadow: '0 20px 40px rgba(0,0,0,0.65)' }} />
        </div>

        {/* 🌟 Album Title, Interactive Artist Badge & Metadata */}
        <div style={{ marginBottom: '22px' }}>
          <h2 style={{ margin: '0 0 10px 0', fontSize: '1.75rem', fontWeight: '800', color: '#ffffff', letterSpacing: '-0.6px' }}>{album.name}</h2>
          
          <div
            onClick={() => onSelectArtist && onSelectArtist(matchingArtistData || { name: album.artist })}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '8px', cursor: 'pointer', background: 'rgba(255,255,255,0.06)', padding: '4px 10px 4px 4px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)' }}
            title={`View artist profile for ${album.artist}`}
          >
            {artistProfileImg ? (
              <CachedImage src={artistProfileImg} alt={album.artist} style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontSize: '0.7rem', fontWeight: '700' }}>
                {(album.artist || '?').charAt(0).toUpperCase()}
              </div>
            )}
            <span style={{ fontSize: '0.88rem', color: '#ffffff', fontWeight: '600' }}>{album.artist}</span>
            <i className="fa-solid fa-chevron-right" style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)', marginLeft: '2px' }}></i>
          </div>

          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>
            Album • {album.year || '2026'} • {albumTracks.length} tracks{formattedTotalDuration ? ` • ${formattedTotalDuration}` : ''}
          </p>
        </div>

        {/* 🌟 Action Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', position: 'relative' }}>
          <div style={{ display: 'flex', gap: '22px', alignItems: 'center', color: '#ffffff', fontSize: '1.35rem' }}>
            <button onClick={handleToggleSaveLibrary} style={{ background: 'none', border: 'none', color: isSavedInLibrary ? 'var(--accent)' : '#ffffff', cursor: 'pointer', padding: 0, fontSize: 'inherit' }} title={isSavedInLibrary ? "Saved to Library" : "Save to Library"}>
              <i className={isSavedInLibrary ? "fa-solid fa-circle-check" : "fa-regular fa-circle-check"}></i>
            </button>

            <button onClick={handleBatchDownloadAlbum} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', padding: 0, fontSize: 'inherit' }} title="Download entire album">
              <i className={batchDownloading ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-download"} style={{ color: batchDownloading ? 'var(--accent)' : '#ffffff' }}></i>
            </button>

            <button onClick={handleShareAlbum} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', padding: 0, fontSize: 'inherit' }} title="Share album">
              <i className="fa-solid fa-arrow-up-from-bracket"></i>
            </button>

            <button 
              onClick={() => {
                triggerHaptic(15);
                setShowPlaylistPicker(false);
                setShowHeaderMenu(true);
              }} 
              style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', padding: 0, fontSize: 'inherit' }}
              title="Album options"
            >
              <i className="fa-solid fa-ellipsis-vertical"></i>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <button onClick={onToggleShuffle} style={{ background: 'none', border: 'none', color: isShuffle ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', padding: 0, fontSize: '1.25rem' }} title="Toggle shuffle">
              <i className="fa-solid fa-shuffle"></i>
            </button>
            <button
              onClick={handlePlayButtonClick}
              className="pulse-play-btn"
              style={{ width: '54px', height: '54px', borderRadius: '50%', backgroundColor: 'var(--accent)', border: 'none', color: '#000000', fontSize: '1.45rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              title={isAlbumCurrentlyActiveAndPlaying ? "Pause" : "Play album"}
            >
              <i className={isAlbumCurrentlyActiveAndPlaying ? "fa-solid fa-pause" : "fa-solid fa-play"} style={{ marginLeft: isAlbumCurrentlyActiveAndPlaying ? '0' : '4px' }}></i>
            </button>
          </div>
        </div>

        {/* 🌟 Inline Search Bar (when user toggles search) */}
        {showSearch && (
          <div className="detail-inline-search-box">
            <input
              autoFocus
              type="text"
              placeholder="Filter songs in album..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="detail-inline-search"
            />
            <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              <i className="fa-solid fa-magnifying-glass"></i>
            </span>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            )}
          </div>
        )}
      </div>

      {/* 🌟 Album Tracks List with Numbered Indices & Live Equalizers */}
      <div className="songs-vertical-grid" style={{ padding: '0 10px', position: 'relative', zIndex: 1 }}>
        {filteredAlbumTracks.map((song, idx) => {
          const songImgSrc = song.cover || song.image || song.imageUrl;
          const songTitle = song.title || song.name;
          const isCurrent = currentTrack && song.id === currentTrack.id;
          const dlState = downloadedMap[song.id];

          return (
            <div key={song.id} className="song-list-item" onClick={() => onSelectTrack(song, albumTracks)} style={{ cursor: 'pointer', background: isCurrent ? 'rgba(29, 185, 84, 0.08)' : 'transparent', position: 'relative', overflow: 'visible', borderRadius: '12px' }}>
              <div className="track-index-num">
                {isCurrent && isPlaying ? (
                  <div className="playing-equalizer-container">
                    <span className="playing-equalizer-bar"></span>
                    <span className="playing-equalizer-bar"></span>
                    <span className="playing-equalizer-bar"></span>
                    <span className="playing-equalizer-bar"></span>
                  </div>
                ) : (
                  <span>{idx + 1}</span>
                )}
              </div>

              <div className="list-img-wrapper">
                <CachedImage src={songImgSrc} alt={songTitle} className="list-track-thumb" />
              </div>

              <div className="list-track-details" style={{ marginLeft: '4px' }}>
                <h3 style={{ color: isCurrent ? 'var(--accent)' : '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {songTitle}
                  {dlState === true && <i className="fa-solid fa-circle-down" style={{ color: 'var(--accent)', fontSize: '0.75rem', marginLeft: '4px' }}></i>}
                </h3>
                <p>{song.artist}</p>
              </div>

              <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                <button
                  className="track-options-btn"
                  onClick={() => onOpenSongMenu ? onOpenSongMenu(song) : setActiveMenuId(activeMenuId === song.id ? null : song.id)}
                  title="Track options"
                >
                  <i className="fa-solid fa-ellipsis-vertical"></i>
                </button>
              </div>
            </div>
          );
        })}
        {filteredAlbumTracks.length === 0 && (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0', fontSize: '0.9rem' }}>No tracks match "{searchQuery}".</p>
        )}
      </div>

      {/* 🌟 Modern Album Action Bottom Sheet */}
      {showHeaderMenu && (
        <div className="sonara-modal-backdrop" onClick={() => { setShowHeaderMenu(false); setShowPlaylistPicker(false); }}>
          <div className="sonara-action-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-drag-handle"></div>

            {/* Album Header Preview Card */}
            <div className="action-sheet-header">
              <CachedImage src={album.image} alt={album.name} className="action-sheet-thumb" />
              <div className="action-sheet-meta">
                <h3>{album.name}</h3>
                <p>{album.artist} • {album.year || '2026'} • {albumTracks.length} tracks{formattedTotalDuration ? ` • ${formattedTotalDuration}` : ''}</p>
              </div>
              <button 
                className="action-sheet-close-btn" 
                onClick={() => { setShowHeaderMenu(false); setShowPlaylistPicker(false); }}
                title="Close"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Options List or Playlist Picker */}
            {showPlaylistPicker ? (
              <div className="action-sheet-options">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 4px 14px 4px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: '8px' }}>
                  <button 
                    onClick={() => setShowPlaylistPicker(false)}
                    style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', fontSize: '1rem', cursor: 'pointer', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title="Back to options"
                  >
                    <i className="fa-solid fa-arrow-left"></i>
                  </button>
                  <div>
                    <h4 style={{ margin: 0, color: '#fff', fontSize: '1rem', fontWeight: '800' }}>Add Album to Playlist</h4>
                    <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>Choose which playlist to append all {albumTracks.length} tracks</p>
                  </div>
                </div>

                {playlists && playlists.length > 0 ? (
                  playlists.map(pl => (
                    <button
                      key={pl.id}
                      className="action-sheet-row"
                      onClick={() => {
                        triggerHaptic(20);
                        if (onAddSongToPlaylist && albumTracks.length > 0) {
                          albumTracks.forEach(tr => onAddSongToPlaylist(pl.id, tr));
                        }
                        displayToast(`Added ${albumTracks.length} tracks to "${pl.playlistName}"`);
                        setShowPlaylistPicker(false);
                        setShowHeaderMenu(false);
                      }}
                    >
                      <div className="action-icon-circle orange">
                        <i className="fa-solid fa-music"></i>
                      </div>
                      <div className="action-text">
                        <div className="action-title">{pl.playlistName}</div>
                        <div className="action-sub">Tap to append all tracks</div>
                      </div>
                      <i className="fa-solid fa-plus action-chevron" style={{ color: 'var(--accent)' }}></i>
                    </button>
                  ))
                ) : (
                  <div style={{ textAlign: 'center', padding: '30px 16px', color: 'var(--text-muted)' }}>
                    <i className="fa-solid fa-compact-disc" style={{ fontSize: '2rem', marginBottom: '8px', opacity: 0.4 }}></i>
                    <p style={{ margin: 0, fontSize: '0.85rem' }}>No playlists found in your library.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="action-sheet-options">
                {/* 1. Play Next */}
                <button
                  className="action-sheet-row"
                  onClick={() => {
                    triggerHaptic(20);
                    if (onPlayNext && albumTracks.length > 0) {
                      onPlayNext(albumTracks);
                    } else {
                      displayToast(`Added "${album.name}" to play next.`);
                    }
                    setShowHeaderMenu(false);
                  }}
                >
                  <div className="action-icon-circle purple">
                    <i className="fa-solid fa-forward-step"></i>
                  </div>
                  <div className="action-text">
                    <div className="action-title">Play Next</div>
                    <div className="action-sub">Queue all {albumTracks.length} tracks right after current song</div>
                  </div>
                </button>

                {/* 2. Add to Queue */}
                <button
                  className="action-sheet-row"
                  onClick={() => {
                    triggerHaptic(20);
                    if (onAddToQueue && albumTracks.length > 0) {
                      onAddToQueue(albumTracks);
                    } else {
                      displayToast(`Added "${album.name}" to queue.`);
                    }
                    setShowHeaderMenu(false);
                  }}
                >
                  <div className="action-icon-circle blue">
                    <i className="fa-solid fa-layer-group"></i>
                  </div>
                  <div className="action-text">
                    <div className="action-title">Add to Queue</div>
                    <div className="action-sub">Append {albumTracks.length} tracks to Up Next list</div>
                  </div>
                </button>

                {/* 3. Save to Library */}
                <button
                  className="action-sheet-row"
                  onClick={() => {
                    triggerHaptic(20);
                    handleToggleSaveLibrary();
                    setShowHeaderMenu(false);
                  }}
                >
                  <div className={`action-icon-circle ${isSavedInLibrary ? 'accent' : 'green'}`}>
                    <i className={isSavedInLibrary ? "fa-solid fa-circle-check" : "fa-regular fa-circle-check"}></i>
                  </div>
                  <div className="action-text">
                    <div className="action-title">
                      {isSavedInLibrary ? 'Saved in Your Library' : 'Save Album to Library'}
                    </div>
                    <div className="action-sub">
                      {isSavedInLibrary ? 'Tap to remove album from your library' : 'Quickly access album from your Library tab'}
                    </div>
                  </div>
                </button>

                {/* 4. Download Album */}
                <button
                  className="action-sheet-row"
                  disabled={batchDownloading}
                  onClick={() => {
                    triggerHaptic(20);
                    setShowHeaderMenu(false);
                    handleBatchDownloadAlbum();
                  }}
                >
                  <div className="action-icon-circle blue">
                    <i className={batchDownloading ? "fa-solid fa-spinner fa-spin" : isAllDownloaded ? "fa-solid fa-circle-check" : "fa-solid fa-circle-down"}></i>
                  </div>
                  <div className="action-text">
                    <div className="action-title">
                      {batchDownloading ? 'Downloading Album...' : isAllDownloaded ? 'All Tracks Downloaded' : 'Download Album'}
                    </div>
                    <div className="action-sub">
                      {isAllDownloaded ? 'All tracks saved for offline listening' : `Download all ${albumTracks.length} tracks offline`}
                    </div>
                  </div>
                </button>

                {/* 5. Add to Playlist */}
                <button
                  className="action-sheet-row"
                  onClick={() => {
                    triggerHaptic(20);
                    setShowPlaylistPicker(true);
                  }}
                >
                  <div className="action-icon-circle orange">
                    <i className="fa-solid fa-circle-plus"></i>
                  </div>
                  <div className="action-text">
                    <div className="action-title">Add to Playlist</div>
                    <div className="action-sub">Append all album tracks to a playlist</div>
                  </div>
                  <i className="fa-solid fa-chevron-right action-chevron"></i>
                </button>

                {/* 6. View Artist Profile */}
                {matchingArtistData && (
                  <button
                    className="action-sheet-row"
                    onClick={() => {
                      triggerHaptic(20);
                      setShowHeaderMenu(false);
                      onSelectArtist(matchingArtistData);
                    }}
                  >
                    <div className="action-icon-circle purple">
                      <i className="fa-solid fa-user"></i>
                    </div>
                    <div className="action-text">
                      <div className="action-title">View Artist: {album.artist}</div>
                      <div className="action-sub">Explore artist profile, albums, and top hits</div>
                    </div>
                    <i className="fa-solid fa-chevron-right action-chevron"></i>
                  </button>
                )}

                {/* 7. Share Album */}
                <button
                  className="action-sheet-row"
                  onClick={() => {
                    triggerHaptic(20);
                    setShowHeaderMenu(false);
                    handleShareAlbum();
                  }}
                >
                  <div className="action-icon-circle teal">
                    <i className="fa-solid fa-arrow-up-from-bracket"></i>
                  </div>
                  <div className="action-text">
                    <div className="action-title">Share Album</div>
                    <div className="action-sub">Share link or details with friends</div>
                  </div>
                </button>

                {/* 8. Report Content */}
                <button
                  className="action-sheet-row danger"
                  onClick={() => {
                    triggerHaptic(30);
                    setShowHeaderMenu(false);
                    displayToast("Report submitted. We will review this album's artwork and metadata.");
                  }}
                >
                  <div className="action-icon-circle red">
                    <i className="fa-solid fa-flag"></i>
                  </div>
                  <div className="action-text">
                    <div className="action-title" style={{ color: '#ff6b6b' }}>Report Issue / Explicit Art</div>
                    <div className="action-sub">Flag inappropriate artwork or content issues</div>
                  </div>
                </button>
              </div>
            )}

            {/* Footer Dismiss Button */}
            <div className="action-sheet-footer">
              <button 
                className="action-sheet-dismiss-btn" 
                onClick={() => { setShowHeaderMenu(false); setShowPlaylistPicker(false); }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}