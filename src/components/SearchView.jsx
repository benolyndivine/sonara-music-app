import React, { useState, useEffect, useRef } from 'react';
import { downloadTrackToDevice, isTrackCachedOffline } from '../utils/offlineStorage';
import { triggerHaptic } from '../utils/audioEffects';
import CachedImage from './CachedImage';

export default function SearchView({ songs, playlists, albums, artists, currentTrack, isPlaying, likedSongIds = [], onToggleLike, onSelectTrack, onSelectAlbum, onSelectArtist, onAddSongToPlaylist, onOpenSongMenu, autoFocus = true }) {
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
  const [searchTab, setSearchTab] = useState('all'); // 'all' | 'songs' | 'artists' | 'albums'
  
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

  const removeRecentSearch = (term) => {
    setRecentSearches((prev) => {
      const updated = prev.filter(t => t.toLowerCase() !== term.toLowerCase());
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

  const handleSurpriseMe = () => {
    if (!songs || songs.length === 0) return;
    triggerHaptic(30);
    const randomSong = songs[Math.floor(Math.random() * songs.length)];
    displayToast(`🎲 Playing surprise: "${randomSong.title || randomSong.name}"`);
    onSelectTrack(randomSong, songs);
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
          <span style={{ fontSize: '0.84rem', fontWeight: '600', color: 'var(--text-main)' }}>{toastMessage}</span>
        </div>
      )}

      <div className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 className="view-title">Search</h2>
        <button
          onClick={handleSurpriseMe}
          style={{
            background: 'color-mix(in srgb, var(--accent) 12%, var(--card-bg, rgba(255, 255, 255, 0.05)))',
            border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
            borderRadius: '20px',
            padding: '6px 14px',
            color: 'var(--accent)',
            fontSize: '0.78rem',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 4px 12px color-mix(in srgb, var(--accent) 20%, transparent)',
            transition: 'transform 0.15s ease'
          }}
          title="Play a random surprise track!"
        >
          <i className="fa-solid fa-dice" style={{ fontSize: '0.88rem' }}></i>
          <span>Surprise Me</span>
        </button>
      </div>

      <div className="search-input-wrapper" style={{ marginBottom: '20px', position: 'relative' }}>
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
          className="search-input search-input-field"
          style={{
            width: '100%', height: '48px', backgroundColor: 'var(--card-bg, rgba(255, 255, 255, 0.06))',
            border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.1))', borderRadius: '24px',
            padding: '0 44px 0 48px', color: 'var(--text-main, #ffffff)', outline: 'none', boxSizing: 'border-box',
            fontSize: '0.92rem'
          }}
        />
        <span style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
          <i className="fa-solid fa-magnifying-glass"></i>
        </span>
        {searchQuery.trim() !== '' && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              if (searchInputRef.current) searchInputRef.current.focus();
            }}
            style={{
              position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)',
              background: 'rgba(255, 255, 255, 0.15)', border: 'none', borderRadius: '50%',
              width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-main)', cursor: 'pointer', fontSize: '0.75rem'
            }}
            title="Clear search"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        )}
      </div>

      {/* 🌟 Active Result Filter Chips (shown when user is searching) */}
      {searchQuery.trim() !== '' && (
        <div className="quick-filters-scroll" style={{ marginBottom: '22px' }}>
          {[
            { id: 'all', label: `All (${filteredSongs.length + filteredArtists.length + filteredAlbums.length})` },
            { id: 'songs', label: `Songs (${filteredSongs.length})` },
            { id: 'artists', label: `Artists (${filteredArtists.length})` },
            { id: 'albums', label: `Albums (${filteredAlbums.length})` }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSearchTab(tab.id)}
              className={`quick-filter-chip ${searchTab === tab.id ? 'active' : ''}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* 🌟 Recent Searches, Trending & Browse Categories (when search is empty) */}
      {!searchQuery.trim() && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '26px' }}>
          {recentSearches.length > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text-main)', fontWeight: '700' }}>Recent Searches</h3>
                <button onClick={clearRecentSearches} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '700' }}>Clear all</button>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {recentSearches.map((term, i) => (
                  <div
                    key={i}
                    onClick={() => handleSelectQuery(term)}
                    style={{
                      background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                      color: 'var(--text-main)', padding: '6px 12px', borderRadius: '14px', fontSize: '0.82rem',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                      transition: 'background-color 0.15s ease'
                    }}
                  >
                    <span>{term}</span>
                    <i
                      className="fa-solid fa-xmark"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeRecentSearch(term);
                      }}
                      style={{ opacity: 0.5, fontSize: '0.75rem', cursor: 'pointer' }}
                      title="Remove"
                    ></i>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', color: 'var(--text-main)', fontWeight: '700' }}>Trending Searches</h3>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {trendingQueries.map((trend, i) => (
                <button key={i} onClick={() => handleSelectQuery(trend)} style={{ background: 'color-mix(in srgb, var(--accent) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)', color: 'var(--accent)', padding: '7px 14px', borderRadius: '14px', fontSize: '0.82rem', fontWeight: '600', cursor: 'pointer' }}>
                  <i className="fa-solid fa-arrow-trend-up" style={{ marginRight: '6px' }}></i>{trend}
                </button>
              ))}
            </div>
          </div>

          {/* 🌟 Modern 2-Column "Browse Categories" Visual Grid */}
          <div>
            <h3 style={{ margin: '0 0 14px 0', fontSize: '1.05rem', color: 'var(--text-main)', fontWeight: '700' }}>Browse Categories</h3>
            <div className="browse-categories-grid">
              {[
                { title: 'Kollywood Hits', bg: 'linear-gradient(135deg, #f43f5e 0%, #be123c 60%, #881337 100%)', icon: 'fa-fire', query: 'Kollywood' },
                { title: 'Melody Magic', bg: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 60%, #1e3a8a 100%)', icon: 'fa-headphones', query: 'Melody' },
                { title: 'Party & EDM', bg: 'linear-gradient(135deg, #c084fc 0%, #9333ea 60%, #581c87 100%)', icon: 'fa-compact-disc', query: 'Party' },
                { title: 'Chill & Relax', bg: 'linear-gradient(135deg, #34d399 0%, #059669 60%, #064e3b 100%)', icon: 'fa-mug-hot', query: 'Chill' },
                { title: 'Romance & Love', bg: 'linear-gradient(135deg, #fb7185 0%, #e11d48 60%, #9f1239 100%)', icon: 'fa-heart', query: 'Love' },
                { title: 'Devotional Songs', bg: 'linear-gradient(135deg, #fbbf24 0%, #d97706 60%, #78350f 100%)', icon: 'fa-hands-praying', query: 'Devotional' },
                { title: 'Hip Hop & Rap', bg: 'linear-gradient(135deg, #f472b6 0%, #db2777 60%, #831843 100%)', icon: 'fa-bolt', query: 'Hip Hop' },
                { title: 'Classical & Acoustic', bg: 'linear-gradient(135deg, #818cf8 0%, #4f46e5 60%, #312e81 100%)', icon: 'fa-guitar', query: 'Classical' }
              ].map((cat) => (
                <div
                  key={cat.title}
                  className="category-browse-card"
                  style={{ background: cat.bg }}
                  onClick={() => handleSelectQuery(cat.query)}
                >
                  <i className={`fa-solid ${cat.icon} category-browse-icon`}></i>
                  <span className="category-browse-title">{cat.title}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 🌟 Top Result Spotlight Card (when on 'all' tab) */}
      {searchQuery.trim() !== '' && searchTab === 'all' && (filteredSongs.length > 0 || filteredArtists.length > 0) && (() => {
        const topSong = filteredSongs[0];
        const topArtist = !topSong && filteredArtists.length > 0 ? filteredArtists[0] : null;
        if (!topSong && !topArtist) return null;

        if (topSong) {
          const isCurrent = currentTrack && topSong.id === currentTrack.id;
          const songImg = topSong.cover || topSong.image || topSong.imageUrl;
          return (
            <section style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '1.05rem', color: 'var(--text-main)', marginBottom: '12px', fontWeight: '800' }}>
                Top Result
              </h3>
              <div
                onClick={() => onSelectTrack(topSong, filteredSongs)}
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)',
                  border: isCurrent ? '1px solid var(--accent)' : '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '16px',
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                  transition: 'all 0.15s ease',
                }}
              >
                <CachedImage
                  src={songImg}
                  alt={topSong.title || ''}
                  style={{ width: '74px', height: '74px', borderRadius: '12px', objectFit: 'cover', flexShrink: 0, boxShadow: '0 6px 18px rgba(0,0,0,0.45)' }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '2px 8px', borderRadius: '6px', background: 'rgba(29, 185, 84, 0.2)', color: 'var(--accent)', fontSize: '0.64rem', fontWeight: '800', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px' }}>
                    <i className="fa-solid fa-music"></i> Song
                  </div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '1.05rem', fontWeight: '800', color: isCurrent ? 'var(--accent)' : '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {topSong.title || topSong.name}
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(255,255,255,0.65)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {topSong.artist || 'Unknown Artist'} • {topSong.genre || 'Music'}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectTrack(topSong, filteredSongs);
                  }}
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '50%',
                    background: 'var(--accent)',
                    border: 'none',
                    color: '#000000',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.05rem',
                    flexShrink: 0,
                    cursor: 'pointer',
                    boxShadow: '0 6px 16px rgba(29, 185, 84, 0.45)',
                  }}
                >
                  <i className={isCurrent && isPlaying ? "fa-solid fa-pause" : "fa-solid fa-play"} style={{ marginLeft: isCurrent && isPlaying ? '0' : '2px' }}></i>
                </button>
              </div>
            </section>
          );
        } else if (topArtist) {
          return (
            <section style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '1.05rem', color: 'var(--text-main)', marginBottom: '12px', fontWeight: '800' }}>
                Top Result
              </h3>
              <div
                onClick={() => onSelectArtist && onSelectArtist(topArtist)}
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '16px',
                  padding: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                }}
              >
                {topArtist.image ? (
                  <CachedImage
                    src={topArtist.image}
                    alt={topArtist.name}
                    style={{ width: '74px', height: '74px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0, boxShadow: '0 6px 18px rgba(0,0,0,0.45)' }}
                  />
                ) : (
                  <div style={{ width: '74px', height: '74px', borderRadius: '50%', background: 'var(--accent)', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: '800' }}>
                    {(topArtist.name || 'A').charAt(0)}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '2px 8px', borderRadius: '6px', background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', fontSize: '0.64rem', fontWeight: '800', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px' }}>
                    <i className="fa-solid fa-user"></i> Artist
                  </div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '1.05rem', fontWeight: '800', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {topArtist.name}
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(255,255,255,0.65)' }}>
                    Artist Profile
                  </p>
                </div>
              </div>
            </section>
          );
        }
        return null;
      })()}

      {/* 🌟 Artists Results */}
      {searchQuery.trim() !== '' && (searchTab === 'all' || searchTab === 'artists') && filteredArtists.length > 0 && (
        <section style={{ marginBottom: '28px' }}>
          <h3 style={{ fontSize: '1.1rem', color: 'var(--text-main)', marginBottom: '14px', fontWeight: '700' }}>Artists</h3>
          <div className="horizontal-scroll" style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '10px' }}>
            {filteredArtists.map((artist) => (
              <div
                key={artist.id}
                onClick={() => onSelectArtist && onSelectArtist(artist)}
                style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '100px', maxWidth: '100px' }}
              >
                {artist.image ? (
                  <CachedImage
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
                <h3 style={{ fontSize: '0.85rem', margin: '8px 0 2px 0', color: 'var(--text-main)', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100px' }}>
                  {artist.name}
                </h3>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0 }}>Artist</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 🌟 Albums Results */}
      {searchQuery.trim() !== '' && (searchTab === 'all' || searchTab === 'albums') && filteredAlbums.length > 0 && (
        <section style={{ marginBottom: '28px' }}>
          <h3 style={{ fontSize: '1.1rem', color: 'var(--text-main)', marginBottom: '14px', fontWeight: '700' }}>Albums</h3>
          <div className="horizontal-scroll" style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '10px' }}>
            {filteredAlbums.map((album) => (
              <div key={album.id} className="song-card" onClick={() => onSelectAlbum && onSelectAlbum(album)} style={{ cursor: 'pointer', minWidth: '130px', maxWidth: '130px' }}>
                <div className="img-container" style={{ width: '130px', height: '130px' }}>
                  <CachedImage src={album.image} alt={album.name} style={{ borderRadius: '8px' }} />
                </div>
                <h3 style={{ fontSize: '0.85rem', margin: '6px 0 2px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{album.name}</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>{album.artist}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 🌟 Songs Results */}
      {searchQuery.trim() !== '' && (searchTab === 'all' || searchTab === 'songs') && (
        <section>
          <h3 style={{ fontSize: '1.1rem', color: 'var(--text-main)', marginBottom: '14px', fontWeight: '700' }}>Songs</h3>
          
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
                      <CachedImage src={songImgSrc} alt={songTitle} className="list-track-thumb" />
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
                        <button
                          className="track-options-btn"
                          onClick={() => onOpenSongMenu ? onOpenSongMenu(song) : setActiveDropdown(activeDropdown === song.id ? null : song.id)}
                          style={{ padding: '8px', color: 'rgba(255,255,255,0.6)' }}
                          title="Song options"
                        >
                          <i className="fa-solid fa-ellipsis-vertical"></i>
                        </button>
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