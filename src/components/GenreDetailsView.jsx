import React, { useState, useEffect } from 'react';
import { downloadTrackToDevice, isTrackCachedOffline } from '../utils/offlineStorage';
import CachedImage from './CachedImage';

export default function GenreDetailsView({ genreName, songs, currentTrack, isPlaying, likedSongIds = [], onToggleLike, onSelectTrack, onBack }) {
  const [downloadedMap, setDownloadedMap] = useState({});
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const displayToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const genreSongs = songs.filter(song => {
    const songGenre = (song.genre || '').toLowerCase();
    return songGenre.includes(genreName.toLowerCase());
  });

  const filteredGenreSongs = genreSongs.filter(song => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (song.title || song.name || '').toLowerCase().includes(q) || (song.artist || '').toLowerCase().includes(q);
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

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0 16px 0', position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', fontSize: '1.3rem', padding: 0 }}>
            <i className="fa-solid fa-arrow-left"></i>
          </button>
          <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: '800', color: '#ffffff', letterSpacing: '-0.4px' }}>{genreName}</h2>
        </div>
        <button
          onClick={() => setShowSearch(!showSearch)}
          style={{ background: 'none', border: 'none', color: showSearch ? 'var(--accent)' : 'rgba(255, 255, 255, 0.75)', cursor: 'pointer', fontSize: '1.15rem', padding: 0 }}
          title="Search songs in genre"
        >
          <i className="fa-solid fa-magnifying-glass"></i>
        </button>
      </div>

      {/* 🌟 Hero Vibe Banner */}
      <div style={{
        backgroundColor: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '16px', padding: '16px 18px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'relative', zIndex: 1, backdropFilter: 'blur(10px)', boxShadow: '0 8px 24px rgba(0,0,0,0.35)'
      }}>
        <div>
          <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', color: '#fff', fontWeight: '700' }}>{genreName} Vibes</h3>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{genreSongs.length} track{genreSongs.length === 1 ? '' : 's'} curated</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => {
              if (genreSongs.length === 0) return;
              const randIdx = Math.floor(Math.random() * genreSongs.length);
              onSelectTrack(genreSongs[randIdx], genreSongs);
            }}
            disabled={genreSongs.length === 0}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.08)', color: '#fff', border: '1px solid rgba(255, 255, 255, 0.12)', borderRadius: '24px',
              padding: '9px 14px', fontSize: '0.85rem', cursor: genreSongs.length ? 'pointer' : 'not-allowed',
              opacity: genreSongs.length ? 1 : 0.4
            }}
            title="Shuffle play"
          >
            <i className="fa-solid fa-shuffle"></i>
          </button>
          <button
            onClick={() => { if (genreSongs.length > 0) onSelectTrack(genreSongs[0], genreSongs); }}
            disabled={genreSongs.length === 0}
            className="pulse-play-btn"
            style={{
              backgroundColor: 'var(--accent)', color: '#000', border: 'none', borderRadius: '24px',
              padding: '9px 18px', fontWeight: '800', fontSize: '0.85rem', cursor: genreSongs.length ? 'pointer' : 'not-allowed',
              opacity: genreSongs.length ? 1 : 0.4
            }}
          >
            <i className="fa-solid fa-play" style={{ marginRight: '6px' }}></i> Play All
          </button>
        </div>
      </div>

      {/* 🌟 Inline Search Bar */}
      {showSearch && (
        <div className="detail-inline-search-box" style={{ position: 'relative', zIndex: 1 }}>
          <input
            autoFocus
            type="text"
            placeholder={`Filter ${genreName} tracks...`}
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

      <div className="songs-vertical-grid" style={{ position: 'relative', zIndex: 1 }}>
        {filteredGenreSongs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            <i className="fa-solid fa-music-slash" style={{ fontSize: '2.2rem', marginBottom: '12px' }}></i>
            <p style={{ margin: 0, fontSize: '0.9rem' }}>{searchQuery ? `No songs match "${searchQuery}".` : `No songs found tagged under "${genreName}".`}</p>
          </div>
        ) : (
          filteredGenreSongs.map((song, idx) => {
            const songImgSrc = song.cover || song.image || song.imageUrl;
            const songTitle = song.title || song.name;
            const isCurrent = currentTrack && song.id === currentTrack.id;
            const dlState = downloadedMap[song.id];
            const isLiked = likedSongIds.includes(song.id || songTitle);

            return (
              <div key={song.id} className="song-list-item" onClick={() => onSelectTrack(song, genreSongs)} style={{ cursor: 'pointer', background: isCurrent ? 'rgba(29, 185, 84, 0.08)' : 'transparent', position: 'relative', overflow: 'visible', borderRadius: '12px' }}>
                <div className="track-index-num">
                  {isCurrent && isPlaying ? (
                    <div className="playing-equalizer-container">
                      <span className="playing-equalizer-bar"></span>
                      <span className="playing-equalizer-bar"></span>
                      <span className="playing-equalizer-bar"></span>
                      <span className="playing-equalizer-bar"></span>
                    </div>
                  ) : (
                    <span>{String(idx + 1).padStart(2, '0')}</span>
                  )}
                </div>

                <div className="list-img-wrapper"><CachedImage src={songImgSrc} alt={songTitle} className="list-track-thumb" /></div>
                <div className="list-track-details" style={{ marginLeft: '4px' }}>
                  <h3 style={{ color: isCurrent ? 'var(--accent)' : '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
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