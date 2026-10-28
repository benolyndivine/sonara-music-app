import React, { useState, useEffect } from 'react';
import CachedImage from './CachedImage';
import { triggerHaptic } from '../utils/audioEffects';
import { isTrackCachedOffline, downloadTrackToDevice } from '../utils/offlineStorage';

export default function SongActionSheet({
  song,
  onClose,
  onSelectTrack,
  onPlayNext,
  onAddToQueue,
  isLiked,
  onToggleLike,
  playlists = [],
  playlistSongs = [],
  onAddToPlaylist,
  onGoToAlbum,
  onGoToArtist,
  onRemoveFromPlaylist,
  currentPlaylistId
}) {
  const [showPlaylistsView, setShowPlaylistsView] = useState(false);
  const [playlistSearch, setPlaylistSearch] = useState('');
  const [downloadStatus, setDownloadStatus] = useState(null); // null | 'loading' | 'done'

  useEffect(() => {
    if (song?.id) {
      setDownloadStatus(isTrackCachedOffline(song.id) ? 'done' : null);
    }
    setShowPlaylistsView(false);
    setPlaylistSearch('');
  }, [song]);

  useEffect(() => {
    if (!showPlaylistsView) return;
    const handleActionSheetBack = (e) => {
      e.preventDefault();
      setShowPlaylistsView(false);
    };
    window.addEventListener('sonara_back_press', handleActionSheetBack);
    return () => window.removeEventListener('sonara_back_press', handleActionSheetBack);
  }, [showPlaylistsView]);

  if (!song) return null;

  const songTitle = song.title || song.name || 'Unknown Track';
  const songArtist = song.artist || 'Unknown Artist';
  const songImgSrc = song.cover || song.image || song.imageUrl || 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=200&auto=format&fit=crop';
  const songKey = (songTitle || '').toLowerCase();
  const songIdKey = (song.id || '').toLowerCase();

  const handleDownload = async () => {
    if (downloadStatus === 'loading') return;
    triggerHaptic(20);
    try {
      setDownloadStatus('loading');
      await downloadTrackToDevice(song);
      setDownloadStatus('done');
    } catch (err) {
      console.error('Failed to download track:', err);
      setDownloadStatus(null);
    }
  };

  const handleShare = async () => {
    triggerHaptic(20);
    const shareData = {
      title: songTitle,
      text: `Listen to "${songTitle}" by ${songArtist} on Sonara!`,
      url: window.location.href
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
        alert('Song details copied to clipboard!');
      }
    } catch (err) {
      console.log('Share dismissed:', err);
    }
    onClose?.();
  };

  const filteredPlaylists = playlists.filter(p => {
    if (!playlistSearch.trim()) return true;
    return (p.playlistName || '').toLowerCase().includes(playlistSearch.toLowerCase());
  });

  return (
    <div className="sonara-modal-backdrop" onClick={onClose}>
      <div className="sonara-action-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-drag-handle"></div>

        {/* 🌟 Track Header Info Card */}
        <div className="action-sheet-header">
          <CachedImage src={songImgSrc} alt={songTitle} className="action-sheet-thumb" />
          <div className="action-sheet-meta">
            <h3>{songTitle}</h3>
            <p>{songArtist}{song.album ? ` • ${song.album}` : ''}</p>
          </div>
          <button className="action-sheet-close-btn" onClick={onClose} title="Close">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* 🌟 Body: Either Standard Actions or Playlists Drilldown */}
        {!showPlaylistsView ? (
          <div className="action-sheet-options">
            {/* 1. Like / Favorite */}
            {onToggleLike && (
              <button
                className="action-sheet-row"
                onClick={(e) => {
                  triggerHaptic(20);
                  onToggleLike(song, e);
                }}
              >
                <div className="action-icon-circle red">
                  <i className={`fa-${isLiked ? 'solid' : 'regular'} fa-heart`} style={{ color: isLiked ? '#ef4444' : 'inherit' }}></i>
                </div>
                <div className="action-text">
                  <div className="action-title" style={{ color: isLiked ? '#f87171' : '#ffffff' }}>
                    {isLiked ? 'Liked Song' : 'Add to Favorites'}
                  </div>
                  <div className="action-sub">{isLiked ? 'In your Liked Songs library' : 'Save to your Liked Songs'}</div>
                </div>
              </button>
            )}

            {/* 2. Play Immediately */}
            {onSelectTrack && (
              <button
                className="action-sheet-row"
                onClick={() => {
                  triggerHaptic(20);
                  onSelectTrack(song);
                  onClose?.();
                }}
              >
                <div className="action-icon-circle accent">
                  <i className="fa-solid fa-play"></i>
                </div>
                <div className="action-text">
                  <div className="action-title">Play Now</div>
                  <div className="action-sub">Start playing this track immediately</div>
                </div>
              </button>
            )}

            {/* 3. Play Next */}
            {onPlayNext && (
              <button
                className="action-sheet-row"
                onClick={() => {
                  triggerHaptic(20);
                  onPlayNext(song);
                  onClose?.();
                }}
              >
                <div className="action-icon-circle purple">
                  <i className="fa-solid fa-forward-step"></i>
                </div>
                <div className="action-text">
                  <div className="action-title">Play Next</div>
                  <div className="action-sub">Play right after the current song finishes</div>
                </div>
              </button>
            )}

            {/* 4. Add to Queue */}
            {onAddToQueue && (
              <button
                className="action-sheet-row"
                onClick={() => {
                  triggerHaptic(20);
                  onAddToQueue(song);
                  onClose?.();
                }}
              >
                <div className="action-icon-circle blue">
                  <i className="fa-solid fa-layer-group"></i>
                </div>
                <div className="action-text">
                  <div className="action-title">Add to Queue</div>
                  <div className="action-sub">Append track to the playback queue</div>
                </div>
              </button>
            )}

            {/* 5. Add to Playlist */}
            {onAddToPlaylist && (
              <button
                className="action-sheet-row"
                onClick={() => {
                  triggerHaptic(20);
                  setShowPlaylistsView(true);
                }}
              >
                <div className="action-icon-circle green">
                  <i className="fa-solid fa-folder-plus"></i>
                </div>
                <div className="action-text">
                  <div className="action-title">Add to Playlist</div>
                  <div className="action-sub">Include this song in your playlists ({playlists.length})</div>
                </div>
                <i className="fa-solid fa-chevron-right action-chevron"></i>
              </button>
            )}

            {/* 6. Download Track */}
            <button
              className="action-sheet-row"
              onClick={handleDownload}
              disabled={downloadStatus === 'loading'}
            >
              <div className="action-icon-circle teal">
                <i className={downloadStatus === 'loading' ? "fa-solid fa-spinner fa-spin" : downloadStatus === 'done' ? "fa-solid fa-circle-check" : "fa-solid fa-arrow-down-to-line"}></i>
              </div>
              <div className="action-text">
                <div className="action-title" style={{ color: downloadStatus === 'done' ? 'var(--accent)' : '#ffffff' }}>
                  {downloadStatus === 'loading' ? 'Downloading Track...' : downloadStatus === 'done' ? 'Saved Offline' : 'Download Track'}
                </div>
                <div className="action-sub">{downloadStatus === 'done' ? 'Available offline without internet' : 'Download for offline playback'}</div>
              </div>
            </button>

            {/* 7. Go to Album */}
            {onGoToAlbum && (song.albumId || song.album) && (
              <button
                className="action-sheet-row"
                onClick={() => {
                  triggerHaptic(20);
                  onGoToAlbum(song);
                  onClose?.();
                }}
              >
                <div className="action-icon-circle orange">
                  <i className="fa-solid fa-compact-disc"></i>
                </div>
                <div className="action-text">
                  <div className="action-title">Go to Album</div>
                  <div className="action-sub">{song.album || 'View full album tracklist'}</div>
                </div>
              </button>
            )}

            {/* 8. Go to Artist Profile */}
            {onGoToArtist && (
              <button
                className="action-sheet-row"
                onClick={() => {
                  triggerHaptic(20);
                  onGoToArtist(songArtist);
                  onClose?.();
                }}
              >
                <div className="action-icon-circle purple">
                  <i className="fa-solid fa-user"></i>
                </div>
                <div className="action-text">
                  <div className="action-title">View Artist</div>
                  <div className="action-sub">Explore {songArtist}'s profile and releases</div>
                </div>
              </button>
            )}

            {/* 9. Share Song */}
            <button className="action-sheet-row" onClick={handleShare}>
              <div className="action-icon-circle blue">
                <i className="fa-solid fa-share-nodes"></i>
              </div>
              <div className="action-text">
                <div className="action-title">Share Song</div>
                <div className="action-sub">Send track link or info to friends</div>
              </div>
            </button>

            {/* 10. Remove from playlist (conditional) */}
            {onRemoveFromPlaylist && currentPlaylistId && (
              <button
                className="action-sheet-row danger"
                onClick={() => {
                  triggerHaptic(25);
                  onRemoveFromPlaylist(currentPlaylistId, song);
                  onClose?.();
                }}
              >
                <div className="action-icon-circle red">
                  <i className="fa-solid fa-trash-can"></i>
                </div>
                <div className="action-text">
                  <div className="action-title" style={{ color: '#ff4d4d' }}>Remove from Playlist</div>
                  <div className="action-sub">Delete track from this playlist</div>
                </div>
              </button>
            )}
          </div>
        ) : (
          /* 🌟 Playlists Drilldown Subview */
          <div style={{ padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '55vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '2px' }}>
              <button
                onClick={() => setShowPlaylistsView(false)}
                style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', fontSize: '1.1rem', padding: '6px' }}
                title="Back to options"
              >
                <i className="fa-solid fa-arrow-left"></i>
              </button>
              <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: '#ffffff' }}>Add to Playlist</h4>
            </div>

            <div className="creator-songs-search">
              <i className="fa-solid fa-magnifying-glass"></i>
              <input
                type="text"
                placeholder="Search playlists..."
                value={playlistSearch}
                onChange={(e) => setPlaylistSearch(e.target.value)}
                autoFocus
              />
              {playlistSearch && (
                <i className="fa-solid fa-xmark" onClick={() => setPlaylistSearch('')}></i>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {filteredPlaylists.length > 0 ? (
                filteredPlaylists.map(pl => {
                  const isAlreadyIn = playlistSongs.some(
                    m => m.playlistId === pl.id && (
                      (m.songId || '').toLowerCase() === songKey ||
                      (m.songId || '').toLowerCase() === songIdKey
                    )
                  );

                  return (
                    <div
                      key={pl.id}
                      className="creator-song-row"
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        triggerHaptic(20);
                        if (!isAlreadyIn && onAddToPlaylist) {
                          onAddToPlaylist(pl.id, song);
                        }
                      }}
                    >
                      <div className="playlist-art-gradient" style={{ width: '42px', height: '42px', borderRadius: '10px', fontSize: '1.1rem' }}>
                        <i className="fa-solid fa-music"></i>
                      </div>
                      <div className="creator-song-info">
                        <div className="creator-song-title">{pl.playlistName}</div>
                        <div className="creator-song-artist">Playlist</div>
                      </div>

                      {isAlreadyIn ? (
                        <span className="already-added-pill">
                          <i className="fa-solid fa-check"></i> Added
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="add-to-playlist-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            triggerHaptic(20);
                            onAddToPlaylist?.(pl.id, song);
                          }}
                        >
                          <i className="fa-solid fa-plus"></i> Add
                        </button>
                      )}
                    </div>
                  );
                })
              ) : (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', margin: '20px 0' }}>
                  {playlists.length === 0 ? 'No playlists created yet.' : `No playlists match "${playlistSearch}".`}
                </p>
              )}
            </div>
          </div>
        )}

        {/* 🌟 Footer Dismiss Button */}
        <div className="action-sheet-footer">
          <button className="action-sheet-dismiss-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
