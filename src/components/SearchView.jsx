import React, { useState, useEffect, useRef } from 'react';
import { downloadTrackToDevice, isTrackCachedOffline } from '../utils/offlineStorage';

export default function SearchView({ songs, playlists, albums, artists, currentTrack, isPlaying, likedSongIds = [], onToggleLike, onSelectTrack, onSelectAlbum, onSelectArtist, onAddSongToPlaylist, autoFocus = true }) {
  // autoFocus now defaults to true so the search input grabs focus as soon as this
  // view mounts — i.e. the moment the user switches to the Search tab, assuming your
  // tab navigation conditionally renders <SearchView /> (mounts/unmounts per tab).
  // No changes needed in the parent component for this to work.
  // If you keep SearchView permanently mounted and just toggle its visibility with
  // CSS instead of mount/unmount, pass autoFocus explicitly tied to your active-tab
  // state instead (e.g. autoFocus={activeTab === 'search'}) so this effect re-fires
  // on each tab switch rather than only once on initial mount.
  const [searchQuery, setSearchQuery] = useState('');
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [downloadedMap, setDownloadedMap] = useState({});
  const [toastMessage, setToastMessage] = useState(null);
  
  // 🌟 Search History & Trending Searches States
  const [recentSearches, setRecentSearches] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sonara_recent_searches') || '[]'); } catch { return []; }
  });
  const trendingQueries = ['Kollywood Hits', 'Melody', 'Harris Jayaraj', 'Anirudh', 'Party Anthems'];

  const searchInputRef = useRef(null);

  const displayToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  useEffect(() => {
    if (!autoFocus) return;

    const focusInput = () => {
      if (searchInputRef.current) {
        searchInputRef.current.focus({ preventScroll: false });
        const len = searchInputRef.current.value.length;
        searchInputRef.current.setSelectionRange(len, len);
      }
    };

    focusInput();
    const frameId = requestAnimationFrame(focusInput);
    const timer1 = setTimeout(focusInput, 50);
    const timer2 = setTimeout(focusInput, 150);
    const timer3 = setTimeout(focusInput, 300);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [autoFocus]);

  useEffect(() => {
    const audit = {};
    songs.forEach(s => { audit[s.id] = isTrackCachedOffline(s.id); });
    setDownloadedMap(audit);
  }, [songs]);

  const saveRecentSearch = (term) => {
    if (!term || !term.trim()) return;
    setRecentSearches((prev) => {
      const filtered = prev.filter(t => t.toLowerCase() !== term.toLowerCase());
      const updated = [term.trim(), ...filtered].slice(0, 5);
      try { localStorage.setItem('sonara_recent_searches', JSON.stringify(updated)); } catch (err) {}
      return updated;
    });
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    try { localStorage.removeItem('sonara_recent_searches'); } catch (err) {}
  };

  const handleSelectQuery = (queryText) => {
    setSearchQuery(queryText);
    saveRecentSearch(queryText);
  };

  const handleDownloadClick = async (e, song) => {
    e.stopPropagation();
    try {
      setDownloadedMap(prev => ({ ...prev, [song.id]: 'loading' }));
      await downloadTrackToDevice(song);
      setDownloadedMap(prev => ({ ...prev, [song.id]: true }));
      displayToast(`"${song.title || song.name}" saved offline!`);
    } catch {
      setDownloadedMap(prev => ({ ...prev, [song.id]: false }));
      displayToast("Download failed. Check connection.");
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
        displayToast("Song link copied to clipboard!");
      }
    } catch (err) {
      console.log("Share sheet dismissed:", err);
    }
    setActiveDropdown(null);
  };

  const filteredSongs = songs.filter((song) => {
    if (!searchQuery.trim()) return false;
    const songTitle = (song.title || song.name || '').toLowerCase();
    const songArtist = (song.artist || '').toLowerCase();
    const songGenre = (song.genre || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    return songTitle.includes(query) || songArtist.includes(query) || songGenre.includes(query);
  });

  const filteredAlbums = albums && searchQuery.trim() ? albums.filter((album) => {
    const albumName = (album.name || '').toLowerCase();
    const albumArtist = (album.artist || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    return albumName.includes(query) || albumArtist.includes(query);
  }) : [];

  const filteredArtists = artists && searchQuery.trim() ? artists.filter((artist) => {
    const artistName = (artist.name || '').toLowerCase();
    return artistName.includes(searchQuery.toLowerCase());
  }) : [];

  return (
    <div className="mobile-content" style={{ position: 'relative' }}>
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

      <div className="view-header">
        <h2 className="view-title">Search</h2>
      </div>

      <div className="search-input-wrapper" style={{ marginBottom: '24px', position: 'relative' }}>
        <input
          ref={searchInputRef}
          type="text"
          placeholder="What do you want to listen to?"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (e.target.value.trim().length > 1) {
              saveRecentSearch(e.target.value);
            }
          }}
          className="search-input-field"
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

      {/* 🌟 Recent & Trending Searches */}
      {!searchQuery.trim() && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {recentSearches.length > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem', color: '#fff' }}>Recent Searches</h3>
                <button onClick={clearRecentSearches} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '700' }}>Clear</button>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {recentSearches.map((term, i) => (
                  <button key={i} onClick={() => handleSelectQuery(term)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '6px 14px', borderRadius: '12px', fontSize: '0.82rem', cursor: 'pointer' }}>
                    {term}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', color: '#fff' }}>Trending Searches</h3>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {trendingQueries.map((trend, i) => (
                <button key={i} onClick={() => handleSelectQuery(trend)} style={{ background: 'rgba(29, 185, 84, 0.1)', border: '1px solid rgba(29, 185, 84, 0.3)', color: 'var(--accent)', padding: '6px 14px', borderRadius: '12px', fontSize: '0.82rem', fontWeight: '600', cursor: 'pointer' }}>
                  <i className="fa-solid fa-arrow-trend-up" style={{ marginRight: '6px' }}></i>{trend}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

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

      {searchQuery.trim() !== '' && (
        <section>
          <h3 style={{ fontSize: '1.1rem', color: '#ffffff', marginBottom: '14px', fontWeight: '700' }}>Songs</h3>
          
          <div className="songs-vertical-grid">
            {filteredSongs.length > 0 ? (
              filteredSongs.map((song) => {
                const songImgSrc = song.cover || song.image || song.imageUrl;
                const songTitle = song.title || song.name;
                const isCurrent = currentTrack && song.id === currentTrack.id;
                const dlState = downloadedMap[song.id];
                const isLiked = likedSongIds.includes(song.id || songTitle);

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
                  </div>
                );
              })
            ) : (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>No tracks found matching "{searchQuery}".</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}