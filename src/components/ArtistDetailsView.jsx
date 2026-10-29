import React, { useState, useEffect } from 'react';
import { downloadTrackToDevice, isTrackCachedOffline } from '../utils/offlineStorage';
import { songMatchesArtist } from '../utils/artistMatch';
import { isArtistSaved, setArtistSaved } from '../utils/savedArtists';
import CachedImage from './CachedImage';

export default function ArtistDetailsView({
  artist,
  songs = [],
  currentTrack,
  isPlaying,
  isShuffle,
  onToggleShuffle,
  onTogglePlay,
  onSelectTrack,
  onBack,
  likedSongIds = [],
  onToggleLike,
  onOpenSongMenu
}) {
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [downloadedMap, setDownloadedMap] = useState({});
  const [isSaved, setIsSaved] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('all'); // 'all', 'az', 'title'

  const displayToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const artistSongs = songs.filter((song) => songMatchesArtist(song, artist.name));

  useEffect(() => {
    const audit = {};
    artistSongs.forEach(s => { audit[s.id] = isTrackCachedOffline(s.id); });
    setDownloadedMap(audit);

    const savedFlag = isArtistSaved(artist.id);
    setIsSaved(savedFlag);
  }, [songs, artist]);

  const handleToggleSave = () => {
    const targetState = !isSaved;
    setIsSaved(targetState);
    setArtistSaved(artist.id, targetState);
    displayToast(targetState ? `Following ${artist.name}` : `Unfollowed ${artist.name}`);
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
      displayToast("Download failed. Check connection.");
    }
    setActiveMenuId(null);
  };

  const handleShareArtist = async () => {
    const shareData = {
      title: artist.name,
      text: `Listen to ${artist.name} on Sonara!`,
      url: window.location.href
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
        displayToast("Artist link copied to clipboard!");
      }
    } catch (err) {
      console.log("Artist share sheet dismissed:", err);
    }
  };

  // Filter & sort tracks
  const filteredSongs = artistSongs.filter((song) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const title = (song.title || song.name || '').toLowerCase();
    const album = (song.album || '').toLowerCase();
    return title.includes(q) || album.includes(q);
  }).sort((a, b) => {
    if (sortBy === 'az') {
      const nameA = (a.title || a.name || '').toLowerCase();
      const nameB = (b.title || b.name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    }
    return 0;
  });

  const handlePlayButtonClick = () => {
    if (filteredSongs.length === 0) return;
    const isArtistSongPlaying = filteredSongs.some(track => currentTrack && track.id === currentTrack.id);
    if (isArtistSongPlaying) {
      onTogglePlay?.();
    } else if (isShuffle) {
      const randomIdx = Math.floor(Math.random() * filteredSongs.length);
      onSelectTrack(filteredSongs[randomIdx], filteredSongs);
    } else {
      onSelectTrack(filteredSongs[0], filteredSongs);
    }
  };

  const isArtistCurrentlyActiveAndPlaying = isPlaying && filteredSongs.some(track => currentTrack && track.id === currentTrack.id);

  // Total runtime
  const totalDurationSec = artistSongs.reduce((sum, s) => sum + (s.duration || 0), 0);
  const formattedDuration = totalDurationSec > 0 ? (
    totalDurationSec >= 3600
      ? `${Math.floor(totalDurationSec / 3600)} hr ${Math.floor((totalDurationSec % 3600) / 60)} min`
      : `${Math.floor(totalDurationSec / 60)} min`
  ) : null;

  return (
    <div className="mobile-content" style={{ width: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', padding: 0, paddingBottom: '160px', position: 'relative' }}>
      {/* 🌟 Ambient Backdrop Glow */}
      <div className="ambient-backdrop-glow" style={{ '--ambient-glow-color': 'rgba(29, 185, 84, 0.22)', top: '-20px' }}></div>

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

      <div style={{ padding: '0 20px', position: 'relative', zIndex: 1 }}>
        {/* Top Back Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0 10px 0' }}>
          <button
            onClick={onBack}
            style={{
              width: '38px', height: '38px', borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.06)', border: '1px solid rgba(255, 255, 255, 0.1)',
              color: 'var(--text-main)', cursor: 'pointer', fontSize: '1rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
            aria-label="Back"
          >
            <i className="fa-solid fa-arrow-left"></i>
          </button>

          <span className="verified-artist-badge">
            <i className="fa-solid fa-circle-check"></i> Verified Artist
          </span>
        </div>

        {/* Artist Avatar with Subtle Orbiting Ring */}
        <div className="artist-hero-avatar-wrap" style={{ margin: '14px auto 18px' }}>
          <div className="artist-hero-avatar-ring"></div>
          {artist.image ? (
            <CachedImage
              src={artist.image}
              alt={artist.name}
              style={{
                width: '100%', height: '100%', borderRadius: '50%',
                objectFit: 'cover', boxShadow: '0 18px 40px rgba(0,0,0,0.7)',
                position: 'relative', zIndex: 1
              }}
            />
          ) : (
            <div style={{
              width: '100%', height: '100%', borderRadius: '50%',
              backgroundColor: 'var(--accent)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              color: '#000', fontSize: '3.2rem', fontWeight: '800',
              boxShadow: '0 18px 40px rgba(0,0,0,0.7)', position: 'relative', zIndex: 1
            }}>
              {(artist.name || '?').charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Artist Name & Stats */}
        <div style={{ marginBottom: '20px', textAlign: 'center' }}>
          <h2 style={{ margin: '0 0 6px 0', fontSize: '1.85rem', fontWeight: '800', color: 'var(--text-main)', letterSpacing: '-0.6px' }}>
            {artist.name}
          </h2>
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: '500' }}>
            Artist • {artistSongs.length} {artistSongs.length === 1 ? 'song' : 'songs'}
            {formattedDuration && ` • ${formattedDuration}`}
          </p>
        </div>

        {/* Action Row: Follow Pill, Share, Shuffle, Play */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {/* Follow Pill Button */}
            <button
              onClick={handleToggleSave}
              className={`follow-pill-btn ${isSaved ? 'following' : 'not-following'}`}
            >
              <i className={isSaved ? "fa-solid fa-check" : "fa-solid fa-plus"}></i>
              <span>{isSaved ? 'Following' : 'Follow'}</span>
            </button>

            {/* Share Button */}
            <button
              onClick={handleShareArtist}
              style={{
                width: '38px', height: '38px', borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)',
                color: 'var(--text-main)', cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: '0.95rem'
              }}
              title="Share artist"
            >
              <i className="fa-solid fa-arrow-up-from-bracket"></i>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
            {/* Shuffle Button */}
            <button
              onClick={onToggleShuffle}
              style={{
                background: 'none', border: 'none',
                color: isShuffle ? 'var(--accent)' : 'var(--text-muted)',
                cursor: 'pointer', padding: 0, fontSize: '1.3rem',
                transition: 'color 0.2s'
              }}
              title="Shuffle"
            >
              <i className="fa-solid fa-shuffle"></i>
            </button>

            {/* Main Green Play Button */}
            <button
              onClick={handlePlayButtonClick}
              disabled={artistSongs.length === 0}
              className="pulse-play-btn"
              style={{
                width: '54px', height: '54px', borderRadius: '50%',
                backgroundColor: 'var(--accent)', border: 'none',
                color: '#000000', fontSize: '1.45rem', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                cursor: artistSongs.length ? 'pointer' : 'not-allowed',
                opacity: artistSongs.length ? 1 : 0.4
              }}
              title={isArtistCurrentlyActiveAndPlaying ? "Pause" : "Play"}
            >
              <i className={isArtistCurrentlyActiveAndPlaying ? "fa-solid fa-pause" : "fa-solid fa-play"} style={{ marginLeft: isArtistCurrentlyActiveAndPlaying ? '0' : '4px' }}></i>
            </button>
          </div>
        </div>

        {/* 🔍 Inline Search & Filter Bar */}
        {artistSongs.length > 3 && (
          <div className="detail-inline-search-box" style={{ marginBottom: '16px' }}>
            <input
              type="text"
              placeholder={`Search in ${artist.name}'s songs...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="detail-inline-search"
            />
            <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: '13px', top: '12px', color: 'rgba(255,255,255,0.4)', fontSize: '0.85rem' }}></i>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ position: 'absolute', right: '12px', top: '10px', background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                ✕
              </button>
            )}
          </div>
        )}

        {/* Sort Chips */}
        {artistSongs.length > 5 && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            <button
              onClick={() => setSortBy('all')}
              style={{
                padding: '5px 12px', borderRadius: '14px', border: 'none',
                backgroundColor: sortBy === 'all' ? 'var(--accent)' : 'var(--card-bg, rgba(255, 255, 255, 0.04))', color: sortBy === 'all' ? '#000' : 'var(--text-main)',
                color: sortBy === 'all' ? 'var(--accent)' : 'var(--text-muted)',
                fontSize: '0.74rem', fontWeight: '700', cursor: 'pointer'
              }}
            >
              All Tracks ({artistSongs.length})
            </button>
            <button
              onClick={() => setSortBy('az')}
              style={{
                padding: '5px 12px', borderRadius: '14px', border: 'none',
                backgroundColor: sortBy === 'az' ? 'var(--accent)' : 'var(--card-bg, rgba(255, 255, 255, 0.04))', color: sortBy === 'az' ? '#000' : 'var(--text-main)',
                color: sortBy === 'az' ? 'var(--accent)' : 'var(--text-muted)',
                fontSize: '0.74rem', fontWeight: '700', cursor: 'pointer'
              }}
            >
              A to Z
            </button>
          </div>
        )}
      </div>

      {/* Song List with Track Number and Equalizer */}
      <div className="songs-vertical-grid" style={{ padding: '0 10px', position: 'relative', zIndex: 1 }}>
        {filteredSongs.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '30px 0' }}>
            {searchQuery ? `No songs match "${searchQuery}".` : 'No songs found for this artist.'}
          </p>
        ) : (
          filteredSongs.map((song, idx) => {
            const songImgSrc = song.cover || song.image || song.imageUrl;
            const songTitle = song.title || song.name;
            const isCurrent = currentTrack && song.id === currentTrack.id;
            const dlState = downloadedMap[song.id];
            const isLiked = likedSongIds.includes(song.id);

            return (
              <div
                key={song.id}
                className="song-list-item"
                onClick={() => onSelectTrack(song, filteredSongs)}
                style={{
                  cursor: 'pointer', background: isCurrent ? 'rgba(29, 185, 84, 0.08)' : 'transparent',
                  position: 'relative', overflow: 'visible', borderRadius: '12px', padding: '8px 10px'
                }}
              >
                {/* Track Index or Animated Equalizer */}
                <div className="track-index-num">
                  {isCurrent ? (
                    <div className={`playing-equalizer-container ${!isPlaying ? 'animation-paused' : ''}`}>
                      <span className="playing-equalizer-bar"></span>
                      <span className="playing-equalizer-bar"></span>
                      <span className="playing-equalizer-bar"></span>
                      <span className="playing-equalizer-bar"></span>
                    </div>
                  ) : (
                    String(idx + 1).padStart(2, '0')
                  )}
                </div>

                <div className="list-img-wrapper" style={{ marginLeft: '6px' }}>
                  <CachedImage src={songImgSrc} alt={songTitle} className="list-track-thumb" />
                </div>

                <div className="list-track-details" style={{ marginLeft: '10px' }}>
                  <h3 style={{ color: isCurrent ? 'var(--accent)' : '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {songTitle}
                    </span>
                    {dlState === true && (
                      <i className="fa-solid fa-circle-down" style={{ color: 'var(--accent)', fontSize: '0.75rem', flexShrink: 0 }}></i>
                    )}
                  </h3>
                  <p>{song.artist}{song.album ? ` • ${song.album}` : ''}</p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }} onClick={(e) => e.stopPropagation()}>
                  {/* Inline Heart / Like Button */}
                  {onToggleLike && (
                    <button
                      onClick={() => onToggleLike(song.id)}
                      style={{
                        background: 'none', border: 'none',
                        color: isLiked ? 'var(--accent)' : 'rgba(255, 255, 255, 0.3)',
                        cursor: 'pointer', fontSize: '1rem', padding: 0
                      }}
                      title={isLiked ? "Unlike" : "Like"}
                    >
                      <i className={isLiked ? "fa-solid fa-heart" : "fa-regular fa-heart"}></i>
                    </button>
                  )}

                  {/* 3-Dot Options Menu */}
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
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}