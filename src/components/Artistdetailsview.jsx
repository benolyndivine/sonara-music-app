import React, { useState, useEffect } from 'react';
import { downloadTrackToDevice, isTrackCachedOffline } from '../utils/offlineStorage';
import { songMatchesArtist } from '../utils/artistMatch';
import { isArtistSaved, setArtistSaved } from '../utils/savedArtists';

/**
 * ArtistDetailsView
 * ------------------
 * Shown when a user taps an artist on the Home page. Lists every song by
 * that artist, pulled from the `songs` collection already loaded from
 * Firestore in App.jsx (no separate network fetch needed — songs simply
 * carry an `artist` name string, so we filter the existing list).
 */
export default function ArtistDetailsView({ artist, songs, currentTrack, isPlaying, isShuffle, onToggleShuffle, onTogglePlay, onSelectTrack, onBack }) {
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [downloadedMap, setDownloadedMap] = useState({});
  const [isSaved, setIsSaved] = useState(false);

  const artistSongs = songs.filter((song) => songMatchesArtist(song, artist.name));

  useEffect(() => {
    const audit = {};
    artistSongs.forEach(s => { audit[s.id] = isTrackCachedOffline(s.id); });
    setDownloadedMap(audit);

    const savedFlag = isArtistSaved(artist.id);
    setIsSaved(savedFlag);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songs, artist]);

  const handleToggleSave = () => {
    const targetState = !isSaved;
    setIsSaved(targetState);
    setArtistSaved(artist.id, targetState);
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

  const handleShareArtist = async () => {
    const shareData = {
      title: artist.name,
      text: `Check out ${artist.name} on Sonara!`,
      url: window.location.href
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
        alert("Artist link copied to clipboard!");
      }
    } catch (err) {
      console.log("Artist share sheet dismissed:", err);
    }
  };

  const handlePlayButtonClick = () => {
    if (artistSongs.length === 0) return;
    const isArtistSongPlaying = artistSongs.some(track => currentTrack && track.id === currentTrack.id);
    if (isArtistSongPlaying) {
      onTogglePlay();
    } else {
      onSelectTrack(artistSongs[0], artistSongs);
    }
  };

  const isArtistCurrentlyActiveAndPlaying = isPlaying && artistSongs.some(track => currentTrack && track.id === currentTrack.id);

  return (
    <div className="mobile-content" style={{ width: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', padding: 0, paddingBottom: '160px' }}>
      <div style={{ padding: '0 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '14px 0 10px 0' }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', fontSize: '1.4rem', padding: 0 }}>
            <i className="fa-solid fa-arrow-left"></i>
          </button>
        </div>

        <div style={{ width: '100%', display: 'flex', justifyContent: 'center', margin: '10px 0 20px 0' }}>
          {artist.image ? (
            <img src={artist.image} alt={artist.name} style={{ width: '180px', height: '180px', borderRadius: '50%', objectFit: 'cover', boxShadow: '0 16px 36px rgba(0,0,0,0.6)' }} />
          ) : (
            <div style={{ width: '180px', height: '180px', borderRadius: '50%', backgroundColor: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontSize: '3rem', fontWeight: '700' }}>
              {(artist.name || '?').charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div style={{ marginBottom: '22px', textAlign: 'center' }}>
          <h2 style={{ margin: '0 0 6px 0', fontSize: '1.75rem', fontWeight: '700', color: '#ffffff', letterSpacing: '-0.6px' }}>{artist.name}</h2>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>Artist • {artistSongs.length} {artistSongs.length === 1 ? 'song' : 'songs'}</p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ display: 'flex', gap: '24px', alignItems: 'center', color: '#ffffff', fontSize: '1.4rem' }}>
            <button onClick={handleToggleSave} title={isSaved ? 'Remove from Your Library' : 'Save to Your Library'} style={{ background: 'none', border: 'none', color: isSaved ? 'var(--accent)' : '#ffffff', cursor: 'pointer', padding: 0, fontSize: 'inherit' }}>
              <i className={isSaved ? "fa-solid fa-circle-check" : "fa-regular fa-circle-check"}></i>
            </button>

            <button onClick={handleShareArtist} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', padding: 0, fontSize: 'inherit' }}>
              <i className="fa-solid fa-arrow-up-from-bracket"></i>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '22px' }}>
            <button onClick={onToggleShuffle} style={{ background: 'none', border: 'none', color: isShuffle ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer', padding: 0, fontSize: '1.25rem' }}>
              <i className="fa-solid fa-shuffle"></i>
            </button>
            <button
              onClick={handlePlayButtonClick}
              disabled={artistSongs.length === 0}
              style={{ width: '54px', height: '54px', borderRadius: '50%', backgroundColor: 'var(--accent)', border: 'none', color: '#000000', fontSize: '1.45rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: artistSongs.length ? 'pointer' : 'not-allowed', opacity: artistSongs.length ? 1 : 0.4, boxShadow: '0 6px 16px rgba(29, 185, 84, 0.35)' }}
            >
              <i className={isArtistCurrentlyActiveAndPlaying ? "fa-solid fa-pause" : "fa-solid fa-play"} style={{ marginLeft: isArtistCurrentlyActiveAndPlaying ? '0' : '4px' }}></i>
            </button>
          </div>
        </div>
      </div>

      <div className="songs-vertical-grid" style={{ padding: '0 10px' }}>
        {artistSongs.length === 0 && (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>No songs found for this artist.</p>
        )}

        {artistSongs.map((song) => {
          const songImgSrc = song.cover || song.image || song.imageUrl;
          const songTitle = song.title || song.name;
          const isCurrent = currentTrack && song.id === currentTrack.id;
          const dlState = downloadedMap[song.id];

          return (
            <div key={song.id} className="song-list-item" onClick={() => onSelectTrack(song, artistSongs)} style={{ cursor: 'pointer', background: 'transparent', position: 'relative', overflow: 'visible' }}>
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
                    <button onClick={(e) => handleDownloadTrack(e, song)} className="dropdown-playlist-option" style={{ padding: '12px 14px', gap: '12px', display: 'flex', alignItems: 'center', background: 'transparent', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', color: dlState === true ? 'var(--accent)' : '#ffffff' }}>
                      <i className={dlState === 'loading' ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-download"} style={{ color: dlState === true ? 'var(--accent)' : 'rgba(255,255,255,0.6)' }}></i>
                      <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>{dlState === true ? 'Saved Offline' : dlState === 'loading' ? 'Downloading...' : 'Download Track'}</span>
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