import React, { useState, useEffect } from 'react';
import { downloadTrackToDevice, isTrackCachedOffline } from '../utils/offlineStorage';
import { isAlbumSaved, setAlbumSaved } from '../utils/savedAlbums';

export default function AlbumDetailsView({ album, songs, artists, currentTrack, isPlaying, isShuffle, onToggleShuffle, onTogglePlay, onSelectTrack, onBack }) {
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [downloadedMap, setDownloadedMap] = useState({});
  const [batchDownloading, setBatchDownloading] = useState(false);
  const [isSavedInLibrary, setIsSavedInLibrary] = useState(false);

  const albumTracks = songs.filter(song => song.albumId === album.id);

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
  };

  const handleDownloadTrack = async (e, song) => {
    e.stopPropagation();
    try {
      setDownloadedMap(prev => ({ ...prev, [song.id]: 'loading' }));
      await downloadTrackToDevice(song);
      setDownloadedMap(prev => ({ ...prev, [song.id]: true }));
    } catch {
      setDownloadedMap(prev => ({ ...prev, [song.id]: false }));
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
      alert(`"${album.name}" download finished!`);
    } catch {
      alert("Batch transmission interrupted.");
    } finally {
      setBatchDownloading(false);
    }
  };

  // 🚀 Upgraded Album Share Sheet Engine Hook
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
        alert("Album share details copied to clipboard!");
      }
    } catch (err) {
      console.log("Album share sheet dismissed:", err);
    }
  };

  const handlePlayButtonClick = () => {
    if (albumTracks.length === 0) return;
    const isSongFromAlbumPlaying = albumTracks.some(track => currentTrack && track.id === currentTrack.id);
    if (isSongFromAlbumPlaying) {
      onTogglePlay();
    } else {
      onSelectTrack(albumTracks[0], albumTracks);
    }
  };

  // 🛠️ FIX: album.artist (or an artist doc missing .name) can be undefined —
  // calling .toLowerCase() directly crashed this entire view the moment a
  // single malformed record showed up. Normalize both sides to '' first.
  const matchingArtistData = artists?.find(a => (a.name || '').toLowerCase() === (album.artist || '').toLowerCase());
  const artistProfileImg = matchingArtistData?.image;
  const isAlbumCurrentlyActiveAndPlaying = isPlaying && albumTracks.some(track => currentTrack && track.id === currentTrack.id);

  return (
    <div className="mobile-content" style={{ width: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', padding: 0, paddingBottom: '160px' }}>
      <div style={{ padding: '0 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 0 10px 0' }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', fontSize: '1.4rem', padding: 0 }}><i className="fa-solid fa-arrow-left"></i></button>
        </div>

        <div style={{ width: '100%', display: 'flex', justifyContent: 'center', margin: '10px 0 28px 0' }}>
          <img src={album.image} alt={album.name} style={{ width: '220px', height: '220px', borderRadius: '12px', objectFit: 'cover', boxShadow: '0 16px 36px rgba(0,0,0,0.6)' }} />
        </div>

        <div style={{ marginBottom: '22px' }}>
          <h2 style={{ margin: '0 0 10px 0', fontSize: '1.75rem', fontWeight: '700', color: '#ffffff', letterSpacing: '-0.6px' }}>{album.name}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            {artistProfileImg ? <img src={artistProfileImg} alt={album.artist} style={{ width: '24px', height: '24px', borderRadius: '50%', objectFit: 'cover' }} /> : <div style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontSize: '0.7rem', fontWeight: '700' }}>{(album.artist || '?').charAt(0).toUpperCase()}</div>}
            <span style={{ fontSize: '0.95rem', color: '#ffffff', fontWeight: '600' }}>{album.artist}</span>
          </div>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>Album • {album.year || '2026'} • {albumTracks.length} tracks</p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', position: 'relative' }}>
          <div style={{ display: 'flex', gap: '24px', alignItems: 'center', color: '#ffffff', fontSize: '1.4rem' }}>
            <button onClick={handleToggleSaveLibrary} style={{ background: 'none', border: 'none', color: isSavedInLibrary ? 'var(--accent)' : '#ffffff', cursor: 'pointer', padding: 0, fontSize: 'inherit' }}>
              <i className={isSavedInLibrary ? "fa-solid fa-circle-check" : "fa-regular fa-circle-check"}></i>
            </button>

            <button onClick={handleBatchDownloadAlbum} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', padding: 0, fontSize: 'inherit' }}>
              <i className={batchDownloading ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-download"}></i>
            </button>

            {/* 🛠️ UPGRADED: Album share option utilizes unified system engine */}
            <button onClick={handleShareAlbum} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', padding: 0, fontSize: 'inherit' }}>
              <i className="fa-solid fa-arrow-up-from-bracket"></i>
            </button>

            <div style={{ position: 'relative', display: 'inline-block' }}>
              <button onClick={() => setShowHeaderMenu(!showHeaderMenu)} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', padding: 0, fontSize: 'inherit' }}><i className="fa-solid fa-ellipsis-vertical"></i></button>
              {showHeaderMenu && (
                <div className="premium-dropdown-menu" style={{ left: '0', top: '30px', position: 'absolute', zIndex: 600 }}>
                  <button onClick={() => { alert(`Added album "${album.name}" to streaming queue.`); setShowHeaderMenu(false); }} className="dropdown-playlist-option" style={{ padding: '12px 14px', background: 'transparent', border: 'none', width: '100%', textAlign: 'left', color: '#ffffff', cursor: 'pointer', fontSize: '0.9rem' }}>Add to queue</button>
                  <button onClick={() => { alert("Reporting content parameters to servers."); setShowHeaderMenu(false); }} className="dropdown-playlist-option" style={{ padding: '12px 14px', background: 'transparent', border: 'none', width: '100%', textAlign: 'left', color: '#ff4d4d', cursor: 'pointer', fontSize: '0.9rem' }}>Report Explicit Art</button>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '22px' }}>
            <button onClick={onToggleShuffle} style={{ background: 'none', border: 'none', color: isShuffle ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', padding: 0, fontSize: '1.25rem' }}><i className="fa-solid fa-shuffle"></i></button>
            <button onClick={handlePlayButtonClick} style={{ width: '54px', height: '54px', borderRadius: '50%', backgroundColor: 'var(--accent)', border: 'none', color: '#000000', fontSize: '1.45rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 6px 16px rgba(29, 185, 84, 0.35)' }}><i className={isAlbumCurrentlyActiveAndPlaying ? "fa-solid fa-pause" : "fa-solid fa-play"} style={{ marginLeft: isAlbumCurrentlyActiveAndPlaying ? '0' : '4px' }}></i></button>
          </div>
        </div>
      </div>

      <div className="songs-vertical-grid" style={{ padding: '0 10px' }}>
        {albumTracks.map((song) => {
          const songImgSrc = song.cover || song.image || song.imageUrl;
          const songTitle = song.title || song.name;
          const isCurrent = currentTrack && song.id === currentTrack.id;
          const dlState = downloadedMap[song.id];

          return (
            <div key={song.id} className="song-list-item" onClick={() => onSelectTrack(song, albumTracks)} style={{ cursor: 'pointer', background: 'transparent', position: 'relative', overflow: 'visible' }}>
              <div className="list-img-wrapper"><img src={songImgSrc} alt={songTitle} className="list-track-thumb" /></div>
              <div className="list-track-details" style={{ marginLeft: '4px' }}>
                <h3 style={{ color: isCurrent ? 'var(--accent)' : '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {isCurrent && <div className={`playing-equalizer-container ${!isPlaying ? 'animation-paused' : ''}`}><span className="playing-equalizer-bar"></span><span className="playing-equalizer-bar"></span><span className="playing-equalizer-bar"></span><span className="playing-equalizer-bar"></span></div>}
                  {songTitle}
                  {dlState === true && <i className="fa-solid fa-circle-down" style={{ color: 'var(--accent)', fontSize: '0.75rem', marginLeft: '4px' }}></i>}
                </h3>
                <p>{song.artist}</p>
              </div>

              <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                <button className="track-options-btn" onClick={() => setActiveMenuId(activeMenuId === song.id ? null : song.id)}><i className="fa-solid fa-ellipsis-vertical"></i></button>
                {activeMenuId === song.id && (
                  <div className="premium-dropdown-menu" style={{ right: '10px', top: '30px', position: 'absolute', zIndex: 500 }}>
                    <button onClick={(e) => handleDownloadTrack(e, song)} className="dropdown-playlist-option" style={{ padding: '12px 14px', gap: '12px', display: 'flex', alignItems: 'center', background: 'transparent', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', color: dlState === true ? 'var(--accent)' : '#ffffff' }}><i className={dlState === 'loading' ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-download"} style={{ color: dlState === true ? 'var(--accent)' : 'rgba(255,255,255,0.6)' }}></i><span style={{ fontSize: '0.9rem', fontWeight: '500' }}>{dlState === true ? 'Saved Offline' : dlState === 'loading' ? 'Downloading...' : 'Download Track'}</span></button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}