import React, { useState, useEffect } from 'react';
import { downloadTrackToDevice, isTrackCachedOffline } from '../utils/offlineStorage';

export default function GenreDetailsView({ genreName, songs, currentTrack, isPlaying, likedSongIds = [], onToggleLike, onSelectTrack, onBack }) {
  const [downloadedMap, setDownloadedMap] = useState({});
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  const displayToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const genreSongs = songs.filter(song => {
    const songGenre = (song.genre || '').toLowerCase();
    return songGenre.includes(genreName.toLowerCase());
  });

  useEffect(() => {
    const audit = {};
    genreSongs.forEach(s => { audit[s.id] = isTrackCachedOffline(s.id); });
    setDownloadedMap(audit);
  }, [genreSongs]);

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

  return (
    <div className="mobile-content" style={{ width: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', padding: '0 20px 160px 20px', position: 'relative' }}>
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

      <div style={{ display: 'flex', alignItems: 'center', padding: '14px 0 16px 0', gap: '16px' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', fontSize: '1.25rem', padding: 0 }}>
          <i className="fa-solid fa-arrow-left"></i>
        </button>
        <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '700', color: '#ffffff' }}>{genreName}</h2>
      </div>

      <div style={{
        backgroundColor: 'rgba(29, 185, 84, 0.08)', border: '1px solid rgba(29, 185, 84, 0.2)',
        borderRadius: '16px', padding: '16px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', color: '#fff' }}>{genreName} Vibes</h3>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{genreSongs.length} track{genreSongs.length === 1 ? '' : 's'} available</p>
        </div>
        <button
          onClick={() => { if (genreSongs.length > 0) onSelectTrack(genreSongs[0], genreSongs); }}
          disabled={genreSongs.length === 0}
          style={{
            backgroundColor: 'var(--accent)', color: '#000', border: 'none', borderRadius: '24px',
            padding: '10px 20px', fontWeight: '800', fontSize: '0.85rem', cursor: genreSongs.length ? 'pointer' : 'not-allowed',
            opacity: genreSongs.length ? 1 : 0.4
          }}
        >
          <i className="fa-solid fa-play" style={{ marginRight: '6px' }}></i> Play All
        </button>
      </div>

      <div className="songs-vertical-grid">
        {genreSongs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            <i className="fa-solid fa-music-slash" style={{ fontSize: '2.2rem', marginBottom: '12px' }}></i>
            <p style={{ margin: 0, fontSize: '0.9rem' }}>No songs found tagged under "{genreName}".</p>
            <p style={{ margin: '6px 0 0', fontSize: '0.75rem', opacity: 0.7 }}>Ask an admin to tag songs with this genre using the Genre Manager.</p>
          </div>
        ) : (
          genreSongs.map((song) => {
            const songImgSrc = song.cover || song.image || song.imageUrl;
            const songTitle = song.title || song.name;
            const isCurrent = currentTrack && song.id === currentTrack.id;
            const dlState = downloadedMap[song.id];
            const isLiked = likedSongIds.includes(song.id || songTitle);

            return (
              <div key={song.id} className="song-list-item" onClick={() => onSelectTrack(song, genreSongs)} style={{ cursor: 'pointer', position: 'relative', overflow: 'visible' }}>
                <div className="list-img-wrapper"><img src={songImgSrc} alt={songTitle} className="list-track-thumb" /></div>
                <div className="list-track-details">
                  <h3 style={{ color: isCurrent ? 'var(--accent)' : '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {isCurrent && <div className={`playing-equalizer-container ${!isPlaying ? 'animation-paused' : ''}`}><span className="playing-equalizer-bar"></span><span className="playing-equalizer-bar"></span><span className="playing-equalizer-bar"></span><span className="playing-equalizer-bar"></span></div>}
                    {songTitle}
                    {dlState === true && <i className="fa-solid fa-circle-down" style={{ color: 'var(--accent)', fontSize: '0.75rem', marginLeft: '4px' }}></i>}
                  </h3>
                  <p>{song.artist}</p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {onToggleLike && (
                    <button
                      onClick={(e) => onToggleLike(song, e)}
                      style={{ background: 'none', border: 'none', color: isLiked ? 'var(--accent)' : 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '1rem', padding: '8px' }}
                    >
                      <i className={`fa-${isLiked ? 'solid' : 'regular'} fa-heart`}></i>
                    </button>
                  )}

                  <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                    <button className="track-options-btn" onClick={() => setActiveMenuId(activeMenuId === song.id ? null : song.id)}><i className="fa-solid fa-ellipsis-vertical"></i></button>
                    {activeMenuId === song.id && (
                      <div className="premium-dropdown-menu" style={{ right: '10px', top: '30px', position: 'absolute', zIndex: 500 }}>
                        <button onClick={(e) => handleDownloadTrack(e, song)} className="dropdown-playlist-option" style={{ padding: '12px 14px', gap: '12px', display: 'flex', alignItems: 'center', background: 'transparent', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', color: dlState === true ? 'var(--accent)' : '#ffffff' }}><i className={dlState === 'loading' ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-download"} style={{ color: dlState === true ? 'var(--accent)' : 'rgba(255,255,255,0.6)' }}></i><span style={{ fontSize: '0.9rem', fontWeight: '500' }}>{dlState === true ? 'Saved Offline' : dlState === 'loading' ? 'Downloading...' : 'Download Track'}</span></button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}