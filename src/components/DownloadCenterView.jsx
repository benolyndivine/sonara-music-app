import React, { useState, useEffect } from 'react';
import CachedImage from './CachedImage';
import { 
  getDownloadedSongsList, 
  getTotalStorageUsage, 
  deleteDownloadedSong, 
  clearAllLocalCache, 
  subscribeToDownloadProgress, 
  getActiveDownloads 
} from '../utils/offlineStorage';
import { getDownloadQuality, QUALITY_LABELS } from '../utils/audioQuality';

export default function DownloadCenterView({ 
  onClose, onSelectTrack, isPlaying, currentTrack, onTogglePlay, 
  downloadQuality: downloadQualityProp, onOpenSettings 
}) {
  const currentDlQuality = downloadQualityProp || getDownloadQuality();
  const [downloadedSongs, setDownloadedSongs] = useState([]);
  const [totalStorage, setTotalStorage] = useState(0);
  const [activeTasks, setActiveTasks] = useState(getActiveDownloads());
  const [filterQuery, setFilterQuery] = useState('');
  const [sortBy, setSortBy] = useState('recent'); // 'recent', 'az', 'size'
  const [toastMessage, setToastMessage] = useState(null);

  const displayToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const refreshList = () => {
    const list = getDownloadedSongsList();
    setDownloadedSongs(list);
    let bytes = getTotalStorageUsage();
    if (!bytes || bytes === 0) {
      bytes = list.reduce((sum, s) => sum + (s.size || (3.5 * 1024 * 1024)), 0);
    }
    setTotalStorage(bytes);
  };

  useEffect(() => {
    refreshList();
    const unsub = subscribeToDownloadProgress((tasks) => {
      setActiveTasks({ ...tasks });
      refreshList();
    });
    return () => unsub();
  }, []);

  const handleDeleteSong = async (songId, songTitle) => {
    await deleteDownloadedSong(songId);
    refreshList();
    displayToast(`Removed "${songTitle || 'track'}" from offline storage`);
  };

  const handleClearAll = async () => {
    if (window.confirm("Are you sure you want to remove all offline downloads from your device storage?")) {
      await clearAllLocalCache();
      refreshList();
      displayToast("Offline storage cleared");
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes || isNaN(bytes) || bytes <= 0) return '0.0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(2)} GB`;
    }
    return `${mb.toFixed(1)} MB`;
  };

  // Calculate estimated total playtime
  const totalDurationSec = downloadedSongs.reduce((sum, s) => sum + (s.duration || 210), 0); // fallback ~3.5 min/song
  const formattedPlaytime = totalDurationSec >= 3600
    ? `${Math.floor(totalDurationSec / 3600)}h ${Math.floor((totalDurationSec % 3600) / 60)}m`
    : `${Math.floor(totalDurationSec / 60)} mins`;

  const activeTaskList = Object.values(activeTasks);

  // Filter & Sort
  const filteredDownloads = downloadedSongs.filter(s => {
    if (!filterQuery.trim()) return true;
    const q = filterQuery.toLowerCase();
    const title = (s.title || s.name || '').toLowerCase();
    const artist = (s.artist || '').toLowerCase();
    return title.includes(q) || artist.includes(q);
  }).sort((a, b) => {
    if (sortBy === 'az') {
      const nameA = (a.title || a.name || '').toLowerCase();
      const nameB = (b.title || b.name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    }
    if (sortBy === 'size') {
      return (b.size || 0) - (a.size || 0);
    }
    return 0; // default recent
  });

  const handlePlayAllOffline = () => {
    if (filteredDownloads.length === 0) return;
    const isSongFromDownloadsPlaying = filteredDownloads.some(t => currentTrack && t.id === currentTrack.id);
    if (isSongFromDownloadsPlaying && onTogglePlay) {
      onTogglePlay();
    } else {
      onSelectTrack?.(filteredDownloads[0], filteredDownloads);
    }
  };

  const handleShuffleOffline = () => {
    if (filteredDownloads.length === 0) return;
    const randIdx = Math.floor(Math.random() * filteredDownloads.length);
    onSelectTrack?.(filteredDownloads[randIdx], filteredDownloads);
  };

  const isDownloadedCurrentlyPlaying = isPlaying && filteredDownloads.some(track => currentTrack && track.id === currentTrack.id);

  return (
    <div
      className="dc-hide-scrollbar"
      style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'var(--bg-dark, #05070c)', zIndex: 750,
        padding: 'calc(env(safe-area-inset-top, 0px) + 20px) 20px calc(env(safe-area-inset-bottom, 0px) + 48px)',
        display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
        overflowY: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none',
        animation: 'slideUpSheet 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      <style>{downloadCenterStyles}</style>

      {/* 🌟 Ambient Backdrop Glow */}
      <div className="ambient-backdrop-glow" style={{ '--ambient-glow-color': 'rgba(29, 185, 84, 0.2)', top: '-25px' }}></div>

      {toastMessage && (
        <div style={{
          position: 'fixed', top: 'calc(env(safe-area-inset-top, 0px) + 24px)', left: '20px', right: '20px', zIndex: 9999,
          backgroundColor: '#0d2218', border: '1px solid var(--accent)', borderRadius: '14px',
          padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.6)', animation: 'slideDownToast 0.25s ease'
        }}>
          <i className="fa-solid fa-circle-check" style={{ color: 'var(--accent)', fontSize: '1rem' }}></i>
          <span style={{ fontSize: '0.84rem', fontWeight: '600', color: '#ffffff' }}>{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', position: 'relative', zIndex: 1 }}>
        <button
          onClick={onClose}
          style={{
            width: '42px', height: '42px', borderRadius: '50%',
            backgroundColor: 'rgba(255, 255, 255, 0.06)', border: '1px solid rgba(255, 255, 255, 0.12)',
            color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: '1.05rem', transition: 'all 0.15s ease'
          }}
          aria-label="Back"
        >
          <i className="fa-solid fa-arrow-left"></i>
        </button>

        <div style={{ textAlign: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: '#ffffff', letterSpacing: '-0.3px' }}>
            Download Center
          </h2>
          <span style={{ fontSize: '0.72rem', color: 'var(--accent)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            Offline Storage
          </span>
        </div>

        {downloadedSongs.length > 0 ? (
          <button
            onClick={handleClearAll}
            style={{
              background: 'rgba(255, 77, 77, 0.1)', border: '1px solid rgba(255, 77, 77, 0.25)',
              color: '#ff4d4d', borderRadius: '12px', padding: '6px 12px',
              fontSize: '0.74rem', fontWeight: '700', cursor: 'pointer'
            }}
          >
            Clear all
          </button>
        ) : (
          <div style={{ width: '40px' }}></div>
        )}
      </div>

      {/* 🚀 Upgraded Organized Storage Hero Card */}
      <div 
        style={{
          background: 'linear-gradient(135deg, rgba(29, 185, 84, 0.12) 0%, rgba(13, 22, 35, 0.8) 100%)',
          border: '1px solid rgba(29, 185, 84, 0.35)',
          borderRadius: '22px',
          padding: '18px 20px',
          marginBottom: '20px',
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          zIndex: 1
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <i className="fa-solid fa-hard-drive" style={{ color: 'var(--accent)', fontSize: '0.85rem' }}></i>
              <span style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.7)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                Occupied Storage
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '1.95rem', fontWeight: '800', color: '#ffffff', letterSpacing: '-0.5px', fontFamily: "'Montserrat', sans-serif" }}>
                {formatBytes(totalStorage)}
              </h3>
              <span style={{ fontSize: '0.78rem', color: 'var(--accent)', fontWeight: '700' }}>
                • {downloadedSongs.length} tracks
              </span>
            </div>
          </div>

          <div
            style={{
              width: '46px', height: '46px', borderRadius: '14px',
              backgroundColor: 'rgba(29, 185, 84, 0.16)', border: '1px solid rgba(29, 185, 84, 0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(29, 185, 84, 0.25)'
            }}
          >
            <i className="fa-solid fa-cloud-arrow-down" style={{ color: 'var(--accent)', fontSize: '1.25rem' }}></i>
          </div>
        </div>

        {/* Visual progress track representing offline capacity */}
        <div style={{ width: '100%', height: '7px', backgroundColor: 'rgba(255, 255, 255, 0.08)', borderRadius: '4px', overflow: 'hidden' }}>
          <div
            style={{
              width: `${Math.max(6, Math.min(100, (totalStorage / (1024 * 1024 * 1024 * 2)) * 100))}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #1db954 0%, #1ed760 100%)',
              borderRadius: '4px',
              boxShadow: '0 0 12px rgba(29, 185, 84, 0.7)'
            }}
          ></div>
        </div>

        {/* 3-Pill Quick Stats */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '8px', paddingTop: '10px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.98rem', fontWeight: '800', color: '#ffffff', fontFamily: "'Montserrat', sans-serif" }}>{downloadedSongs.length}</div>
            <div style={{ fontSize: '0.66rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '2px' }}>Songs</div>
          </div>
          <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.08)', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: '0.98rem', fontWeight: '800', color: '#ffffff', fontFamily: "'Montserrat', sans-serif" }}>~{formattedPlaytime}</div>
            <div style={{ fontSize: '0.66rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '2px' }}>Playtime</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.98rem', fontWeight: '800', color: 'var(--accent)', fontFamily: "'Montserrat', sans-serif" }}>320k</div>
            <div style={{ fontSize: '0.66rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '2px' }}>Lossless</div>
          </div>
        </div>
      </div>

      {/* Live Active Downloads Section */}
      {activeTaskList.length > 0 && (
        <div style={{ marginBottom: '24px', position: 'relative', zIndex: 1 }}>
          <h3 style={{ margin: '0 0 12px 4px', fontSize: '0.88rem', fontWeight: '800', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa-solid fa-cloud-arrow-down" style={{ color: 'var(--accent)' }}></i>
            <span>Downloading Now ({activeTaskList.length})</span>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {activeTaskList.map((task) => (
              <div
                key={task.id}
                style={{
                  backgroundColor: 'rgba(29, 185, 84, 0.06)',
                  border: '1px solid rgba(29, 185, 84, 0.25)',
                  borderRadius: '16px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                    {task.cover ? (
                      <CachedImage src={task.cover} alt={task.title} style={{ width: '42px', height: '42px', borderRadius: '10px', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '42px', height: '42px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <i className="fa-solid fa-music" style={{ color: 'var(--accent)' }}></i>
                      </div>
                    )}
                    <div style={{ minWidth: 0, overflow: 'hidden' }}>
                      <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '700', color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.title}</h4>
                      <p style={{ margin: '2px 0 0', fontSize: '0.74rem', color: 'var(--text-muted)' }}>{task.artist}</p>
                    </div>
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--accent)', fontWeight: '800' }}>
                    {task.status === 'completed' ? 'Done' : `${task.progress}%`}
                  </span>
                </div>

                {/* Progress bar */}
                <div style={{ width: '100%', height: '4px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${task.progress}%`,
                      height: '100%',
                      backgroundColor: 'var(--accent)',
                      transition: 'width 0.2s ease-out'
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Offline Actions: Play All & Shuffle */}
      {downloadedSongs.length > 0 && (
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', position: 'relative', zIndex: 1 }}>
          <button
            onClick={handlePlayAllOffline}
            className="pulse-play-btn"
            style={{
              flex: 1, height: '46px', borderRadius: '15px',
              background: 'linear-gradient(135deg, #1ed760 0%, #1db954 100%)',
              border: 'none', color: '#000000', fontWeight: '800', fontSize: '0.92rem',
              fontFamily: "'Montserrat', sans-serif",
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              cursor: 'pointer', boxShadow: '0 4px 18px rgba(29, 185, 84, 0.35)'
            }}
          >
            <i className={isDownloadedCurrentlyPlaying ? "fa-solid fa-pause" : "fa-solid fa-play"} style={{ fontSize: '0.95rem' }}></i>
            <span>{isDownloadedCurrentlyPlaying ? 'Pause Offline' : 'Play All Offline'}</span>
          </button>

          <button
            onClick={handleShuffleOffline}
            style={{
              width: '48px', height: '46px', borderRadius: '15px',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.14)',
              color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: '1.15rem'
            }}
            title="Shuffle offline songs"
          >
            <i className="fa-solid fa-shuffle"></i>
          </button>
        </div>
      )}

      {/* Search Filter & Sort Cluster */}
      {downloadedSongs.length > 0 && (
        <div style={{ marginBottom: '18px', position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Filter downloaded tracks..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              style={{
                width: '100%', height: '42px', backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '14px',
                padding: '0 36px 0 38px', color: '#ffffff', outline: 'none', boxSizing: 'border-box',
                fontSize: '0.86rem', fontFamily: "'Montserrat', sans-serif"
              }}
            />
            <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: '14px', top: '14px', color: 'rgba(255, 255, 255, 0.45)', fontSize: '0.85rem' }}></i>
            {filterQuery && (
              <button
                onClick={() => setFilterQuery('')}
                style={{ position: 'absolute', right: '12px', top: '11px', background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '0.9rem' }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Sort Chips */}
          <div style={{ display: 'flex', gap: '8px' }}>
            {[
              { id: 'recent', label: 'Recent' },
              { id: 'az', label: 'A to Z' },
              { id: 'size', label: 'Largest Size' },
            ].map(chip => (
              <button
                key={chip.id}
                onClick={() => setSortBy(chip.id)}
                style={{
                  padding: '6px 14px', borderRadius: '12px',
                  backgroundColor: sortBy === chip.id ? 'rgba(29, 185, 84, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                  border: sortBy === chip.id ? '1px solid var(--accent)' : '1px solid rgba(255, 255, 255, 0.08)',
                  color: sortBy === chip.id ? 'var(--accent)' : 'var(--text-muted)',
                  fontSize: '0.74rem', fontWeight: '700', cursor: 'pointer',
                  fontFamily: "'Montserrat', sans-serif",
                  transition: 'all 0.15s ease'
                }}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Completed Downloads Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', position: 'relative', zIndex: 1 }}>
        <h3 style={{ margin: 0, fontSize: '0.88rem', fontWeight: '800', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
          Downloaded Tracks ({filteredDownloads.length})
        </h3>
        <span 
          className="audio-hq-badge" 
          onClick={onOpenSettings}
          style={{ cursor: onOpenSettings ? 'pointer' : 'default' }}
          title="Current download quality profile (Tap to open Settings)"
        >
          {currentDlQuality} • {QUALITY_LABELS[currentDlQuality] || '256k'}
        </span>
      </div>

      {/* Downloads List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', position: 'relative', zIndex: 1 }}>
        {filteredDownloads.length > 0 ? (
          filteredDownloads.map((song) => {
            const isCurrent = currentTrack && song.id === currentTrack.id;
            return (
              <div
                key={song.id}
                onClick={() => {
                  onSelectTrack?.(song, downloadedSongs);
                }}
                style={{
                  backgroundColor: isCurrent ? 'rgba(29, 185, 84, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                  border: isCurrent ? '1px solid rgba(29, 185, 84, 0.3)' : '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '16px',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                  {song.cover ? (
                    <CachedImage src={song.cover} alt={song.title} style={{ width: '46px', height: '46px', borderRadius: '10px', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '46px', height: '46px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className="fa-solid fa-music" style={{ color: 'var(--accent)' }}></i>
                    </div>
                  )}
                  <div style={{ minWidth: 0, overflow: 'hidden' }}>
                    <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '700', color: isCurrent ? 'var(--accent)' : '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {isCurrent && (
                        <div className={`playing-equalizer-container ${!isPlaying ? 'animation-paused' : ''}`} style={{ flexShrink: 0 }}>
                          <span className="playing-equalizer-bar"></span>
                          <span className="playing-equalizer-bar"></span>
                          <span className="playing-equalizer-bar"></span>
                          <span className="playing-equalizer-bar"></span>
                        </div>
                      )}
                      <span>{song.title}</span>
                    </h4>
                    <p style={{ margin: '3px 0 0', fontSize: '0.74rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {song.artist} • <span style={{ color: 'rgba(255,255,255,0.7)', fontWeight: '600' }}>{QUALITY_LABELS[song.quality] || song.quality || '256 kbps'}</span> • <span style={{ color: 'var(--accent)', fontWeight: '600' }}>{formatBytes(song.size)}</span>
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSong(song.id, song.title);
                    }}
                    style={{
                      background: 'rgba(255, 77, 77, 0.08)', border: '1px solid rgba(255, 77, 77, 0.15)',
                      color: '#ff4d4d', borderRadius: '10px', width: '34px', height: '34px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', fontSize: '0.85rem'
                    }}
                    title="Remove from storage"
                  >
                    <i className="fa-solid fa-trash-can"></i>
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <i className="fa-solid fa-cloud-arrow-down" style={{ fontSize: '2.6rem', opacity: 0.3, marginBottom: '14px', color: 'var(--accent)' }}></i>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#ffffff', fontWeight: '700' }}>
              {filterQuery ? `No tracks match "${filterQuery}"` : 'No downloaded tracks found'}
            </p>
            <p style={{ margin: '6px 0 0', fontSize: '0.76rem', opacity: 0.7, maxWidth: '260px', marginLeft: 'auto', marginRight: 'auto' }}>
              {filterQuery ? 'Try clearing your search filter.' : 'Download tracks from any album or song row for instant offline playback.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

const downloadCenterStyles = `
  .dc-hide-scrollbar::-webkit-scrollbar {
    display: none !important;
    width: 0 !important;
    height: 0 !important;
  }
  .dc-hide-scrollbar {
    -ms-overflow-style: none !important;
    scrollbar-width: none !important;
  }
  .dc-storage-card {
    background: linear-gradient(135deg, rgba(29, 185, 84, 0.12) 0%, rgba(13, 20, 32, 0.7) 100%) !important;
    border: 1px solid rgba(29, 185, 84, 0.3) !important;
    border-radius: 20px !important;
    padding: 18px 20px !important;
    margin-bottom: 20px !important;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1) !important;
    position: relative !important;
    overflow: hidden !important;
  }
  .dc-stats-grid {
    display: grid !important;
    grid-template-columns: repeat(3, 1fr) !important;
    gap: 8px !important;
    margin-top: 14px !important;
    padding-top: 14px !important;
    border-top: 1px solid rgba(255, 255, 255, 0.08) !important;
  }
  .dc-stat-pill {
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    text-align: center !important;
  }
  .dc-stat-val {
    font-size: 0.95rem !important;
    font-weight: 800 !important;
    color: #ffffff !important;
  }
  .dc-stat-lbl {
    font-size: 0.68rem !important;
    font-weight: 600 !important;
    color: var(--text-muted) !important;
    text-transform: uppercase !important;
    margin-top: 2px !important;
  }
  .audio-hq-badge {
    background-color: rgba(29, 185, 84, 0.15) !important;
    color: var(--accent) !important;
    border: 1px solid rgba(29, 185, 84, 0.35) !important;
    padding: 3px 8px !important;
    border-radius: 8px !important;
    font-size: 0.7rem !important;
    font-weight: 800 !important;
    letter-spacing: 0.4px !important;
  }
`;