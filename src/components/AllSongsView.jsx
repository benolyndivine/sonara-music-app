import React, { useState, useEffect } from 'react';
import { downloadTrackToDevice, isTrackCachedOffline } from '../utils/offlineStorage';

export default function AllSongsView({ songs, currentTrack, isPlaying, onSelectTrack, onBack }) {
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [downloadedMap, setDownloadedMap] = useState({});

  // Audit active download registers across popular tracks on mount/update
  useEffect(() => {
    const audit = {};
    songs.forEach(s => { audit[s.id] = isTrackCachedOffline(s.id); });
    setDownloadedMap(audit);
  }, [songs]);

  const handleDownloadClick = async (e, song) => {
    e.stopPropagation();
    try {
      setDownloadedMap(prev => ({ ...prev, [song.id]: 'loading' }));
      await downloadTrackToDevice(song);
      setDownloadedMap(prev => ({ ...prev, [song.id]: true }));
      alert(`"${song.title || song.name}" is now available offline!`);
    } catch {
      setDownloadedMap(prev => ({ ...prev, [song.id]: false }));
      alert("Download failed. Check your network connection.");
    }
    setActiveDropdown(null);
  };

  const handleShareSong = async (e, song) => {
    e.stopPropagation();
    const songTitle = song.title || song.name;
    const shareData = {
      title: songTitle,
      text: `Check out "${songTitle}" by ${song.artist} on Sonara!`,
      url: song.songUrl || song.audioUrl || window.location.href
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
        alert("Song link copied to clipboard!");
      }
    } catch (err) {
      console.log("Share sheet dismissed:", err);
    }
    setActiveDropdown(null);
  };

  return (
    <div className="mobile-content">
      <div className="view-header">
        <button className="back-arrow-btn" onClick={onBack} title="Back to Home">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
        </button>
        <h2 className="view-title">Popular Songs</h2>
      </div>

      <div className="songs-vertical-grid">
        {songs.map((song) => {
          const songImgSrc = song.cover || song.image || song.imageUrl;
          const songTitle = song.title || song.name;
          const isCurrent = currentTrack && song.id === currentTrack.id;
          const dlState = downloadedMap[song.id];

          return (
            <div 
              key={song.id} 
              className="song-list-item" 
              onClick={() => onSelectTrack && onSelectTrack(song)}
              style={{ cursor: 'pointer', position: 'relative', overflow: 'visible' }}
            >
              <div className="list-img-wrapper">
                <img src={songImgSrc} alt={songTitle} className="list-track-thumb" />
              </div>
              <div className="list-track-details">
                <h3 style={{ color: isCurrent ? 'var(--accent)' : '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {isCurrent && (
                    <div className={`playing-equalizer-container ${!isPlaying ? 'animation-paused' : ''}`}>
                      <span className="playing-equalizer-bar"></span>
                      <span className="playing-equalizer-bar"></span>
                      <span className="playing-equalizer-bar"></span>
                      <span className="playing-equalizer-bar"></span>
                    </div>
                  )}
                  {songTitle}
                  {dlState === true && <i className="fa-solid fa-circle-down" style={{ color: 'var(--accent)', fontSize: '0.75rem', marginLeft: '4px' }}></i>}
                </h3>
                <p>{song.artist}</p>
              </div>

              <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                <button className="track-options-btn" onClick={() => setActiveDropdown(activeDropdown === song.id ? null : song.id)}><i className="fa-solid fa-ellipsis-vertical"></i></button>
                
                {activeDropdown === song.id && (
                  <div className="premium-dropdown-menu" style={{ right: '10px', top: '30px', position: 'absolute', zIndex: 500 }}>
                    {/* 🛠️ NEW: HIGH CONTRAST OFFLINE TRACK DOWNLOAD BUTTON */}
                    <button 
                      onClick={(e) => handleDownloadClick(e, song)} 
                      className="dropdown-playlist-option" 
                      style={{ padding: '12px 14px', gap: '12px', display: 'flex', alignItems: 'center', background: 'transparent', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', color: dlState === true ? 'var(--accent)' : '#ffffff' }}
                    >
                      <i className={dlState === 'loading' ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-download"} style={{ color: dlState === true ? 'var(--accent)' : 'rgba(255,255,255,0.6)' }}></i>
                      <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>{dlState === true ? 'Saved Offline' : dlState === 'loading' ? 'Downloading...' : 'Download Song'}</span>
                    </button>

                    <button 
                      onClick={(e) => handleShareSong(e, song)} 
                      className="dropdown-playlist-option" 
                      style={{ padding: '12px 14px', gap: '12px', display: 'flex', alignItems: 'center', background: 'transparent', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', color: '#ffffff' }}
                    >
                      <i className="fa-solid fa-share-nodes" style={{ color: 'rgba(255,255,255,0.6)' }}></i>
                      <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>Share Song</span>
                    </button>
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