import React, { useState, useEffect, useRef } from 'react';
import { downloadTrackToDevice, isTrackCachedOffline } from '../utils/offlineStorage';

export default function SearchView({ songs, playlists, albums, artists, currentTrack, isPlaying, onSelectTrack, onSelectAlbum, onSelectArtist, onAddSongToPlaylist }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [downloadedMap, setDownloadedMap] = useState({});
  const searchInputRef = useRef(null);

  // 🆕 Auto-focus the search field the moment this view mounts (i.e. the
  // instant the user taps the search icon), so the mobile keyboard pops up
  // immediately without an extra tap on the input itself.
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

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

  // 🚀 Native Song Share Handler
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
        // Web fallback clipboard hook
        await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
        alert("Song link copied to clipboard!");
      }
    } catch (err) {
      console.log("Share sheet dismissed or failed:", err);
    }
    setActiveDropdown(null);
  };

  const filteredSongs = songs.filter((song) => {
    const songTitle = (song.title || song.name || '').toLowerCase();
    const songArtist = (song.artist || '').toLowerCase();
    return songTitle.includes(searchQuery.toLowerCase()) || songArtist.includes(searchQuery.toLowerCase());
  });

  const filteredAlbums = albums ? albums.filter((album) => {
    const albumName = (album.name || '').toLowerCase();
    const albumArtist = (album.artist || '').toLowerCase();
    return albumName.includes(searchQuery.toLowerCase()) || albumArtist.includes(searchQuery.toLowerCase());
  }) : [];

  const filteredArtists = artists ? artists.filter((artist) => {
    const artistName = (artist.name || '').toLowerCase();
    return artistName.includes(searchQuery.toLowerCase());
  }) : [];

  return (
    <div className="mobile-content">
      <div className="view-header">
        <h2 className="view-title">Search</h2>
      </div>

      <div className="search-input-wrapper" style={{ marginBottom: '24px', position: 'relative' }}>
        <input
          ref={searchInputRef}
          type="text"
          placeholder="What do you want to listen to?"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input-field"
          autoFocus
          style={{
            width: '100%', height: '48px', backgroundColor: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '24px',
            padding: '0 20px 0 48px', color: '#ffffff', outline: 'none', boxSizing: 'border-box'
          }}
        />
        <span style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
          <i className="fa-solid fa-magnifying-glass"></i>
        </span>
      </div>

      {searchQuery.trim() !== '' && filteredArtists.length > 0 && (
        <section style={{ marginBottom: '28px' }}>
          <h3 style={{ fontSize: '1.1rem', color: '#ffffff', marginBottom: '14px', fontWeight: '700' }}>Artists</h3>
          <div className="horizontal-scroll" style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '10px' }}>
            {filteredArtists.map((artist) => (
              <div
                key={artist.id}
                onClick={() => onSelectArtist && onSelectArtist(artist)}
                style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '100px', maxWidth: '100px' }}
              >
                {artist.image ? (
                  <img
                    src={artist.image}
                    alt={artist.name}
                    style={{ width: '90px', height: '90px', borderRadius: '50%', objectFit: 'cover', boxShadow: '0 8px 20px rgba(0,0,0,0.4)' }}
                  />
                ) : (
                  <div
                    style={{
                      width: '90px', height: '90px', borderRadius: '50%', backgroundColor: 'var(--accent)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000',
                      fontSize: '1.6rem', fontWeight: '700'
                    }}
                  >
                    {(artist.name || '?').charAt(0).toUpperCase()}
                  </div>
                )}
                <h3 style={{ fontSize: '0.85rem', margin: '8px 0 2px 0', color: '#ffffff', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100px' }}>
                  {artist.name}
                </h3>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0 }}>Artist</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {searchQuery.trim() !== '' && filteredAlbums.length > 0 && (
        <section style={{ marginBottom: '28px' }}>
          <h3 style={{ fontSize: '1.1rem', color: '#ffffff', marginBottom: '14px', fontWeight: '700' }}>Albums</h3>
          <div className="horizontal-scroll" style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '10px' }}>
            {filteredAlbums.map((album) => (
              <div key={album.id} className="song-card" onClick={() => onSelectAlbum && onSelectAlbum(album)} style={{ cursor: 'pointer', minWidth: '130px', maxWidth: '130px' }}>
                <div className="img-container" style={{ width: '130px', height: '130px' }}>
                  <img src={album.image} alt={album.name} style={{ borderRadius: '8px' }} />
                </div>
                <h3 style={{ fontSize: '0.85rem', margin: '6px 0 2px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{album.name}</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>{album.artist}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        {searchQuery.trim() !== '' && <h3 style={{ fontSize: '1.1rem', color: '#ffffff', marginBottom: '14px', fontWeight: '700' }}>Songs</h3>}
        
        <div className="songs-vertical-grid">
          {filteredSongs.map((song) => {
            const songImgSrc = song.cover || song.image || song.imageUrl;
            const songTitle = song.title || song.name;
            const isCurrent = currentTrack && song.id === currentTrack.id;
            const dlState = downloadedMap[song.id];

            return (
              <div key={song.id} className="song-list-item" onClick={() => onSelectTrack(song, filteredSongs)} style={{ position: 'relative', overflow: 'visible' }}>
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
                  <button className="track-options-btn" onClick={() => setActiveDropdown(activeDropdown === song.id ? null : song.id)} style={{ padding: '8px', color: 'rgba(255,255,255,0.6)' }}>
                    <i className="fa-solid fa-ellipsis-vertical"></i>
                  </button>

                  {activeDropdown === song.id && (
                    <div className="premium-dropdown-menu" style={{ right: '10px', top: '35px', position: 'absolute', zIndex: 500 }}>
                      <button 
                        onClick={(e) => handleDownloadClick(e, song)} 
                        className="dropdown-playlist-option" 
                        style={{ padding: '12px 14px', gap: '12px', display: 'flex', alignItems: 'center', background: 'transparent', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', color: dlState === true ? 'var(--accent)' : '#ffffff' }}
                      >
                        <i className={dlState === 'loading' ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-download"} style={{ color: dlState === true ? 'var(--accent)' : 'rgba(255,255,255,0.6)' }}></i>
                        <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>{dlState === true ? 'Saved Offline' : dlState === 'loading' ? 'Downloading...' : 'Download Song'}</span>
                      </button>

                      {/* 🛠️ NEW: HIGH CONTRAST NATIVE SHARE BUTTON */}
                      <button 
                        onClick={(e) => handleShareSong(e, song)} 
                        className="dropdown-playlist-option" 
                        style={{ padding: '12px 14px', gap: '12px', display: 'flex', alignItems: 'center', background: 'transparent', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', color: '#ffffff' }}
                      >
                        <i className="fa-solid fa-share-nodes" style={{ color: 'rgba(255,255,255,0.6)' }}></i>
                        <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>Share Song</span>
                      </button>
                      
                      <hr style={{ border: 'none', height: '1px', backgroundColor: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />
                      <p className="dropdown-menu-header" style={{ padding: '6px 14px 4px 14px' }}>Add to Playlist</p>
                      
                      {playlists.map(pl => (
                        <button 
                          key={pl.id} 
                          onClick={() => { onAddSongToPlaylist(pl.id, song); setActiveDropdown(null); }} 
                          className="dropdown-playlist-option"
                          style={{ padding: '10px 14px', background: 'transparent', border: 'none', width: '100%', textAlign: 'left', color: '#ffffff', cursor: 'pointer', fontSize: '0.9rem' }}
                        >
                          <span className="dropdown-playlist-name-text">{pl.playlistName}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}