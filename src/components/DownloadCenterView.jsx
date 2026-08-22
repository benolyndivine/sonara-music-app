import React, { useState, useEffect } from 'react';
import { 
  getDownloadedSongsList, 
  getTotalStorageUsage, 
  deleteDownloadedSong, 
  clearAllLocalCache, 
  subscribeToDownloadProgress, 
  getActiveDownloads 
} from '../utils/offlineStorage';

export default function DownloadCenterView({ onClose, onSelectTrack, isPlaying, currentTrack }) {
  const [downloadedSongs, setDownloadedSongs] = useState([]);
  const [totalStorage, setTotalStorage] = useState(0);
  const [activeTasks, setActiveTasks] = useState(getActiveDownloads());
  const [filterQuery, setFilterQuery] = useState('');

  const refreshList = () => {
    const list = getDownloadedSongsList();
    setDownloadedSongs(list);
    setTotalStorage(getTotalStorageUsage());
  };

  useEffect(() => {
    refreshList();
    const unsub = subscribeToDownloadProgress((tasks) => {
      setActiveTasks({ ...tasks });
      refreshList();
    });
    return () => unsub();
  }, []);

  const handleDeleteSong = async (songId) => {
    await deleteDownloadedSong(songId);
    refreshList();
  };

  const handleClearAll = async () => {
    if (window.confirm("Are you sure you want to remove all offline downloads from your device storage?")) {
      await clearAllLocalCache();
      refreshList();
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb > 1024) {
      return `${(mb / 1024).toFixed(2)} GB`;
    }
    return `${mb.toFixed(1)} MB`;
  };

  const activeTaskList = Object.values(activeTasks);
  const filteredDownloads = downloadedSongs.filter(s => 
    s.title.toLowerCase().includes(filterQuery.toLowerCase()) || 
    s.artist.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div
      className="dc-hide-scrollbar"
      style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: '#05070c', zIndex: 650, padding: '24px 20px 48px',
        display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
        overflowY: 'auto',
        animation: 'slideUpSheet 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      <style>{downloadCenterStyles}</style>

      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px' }}>
        <button
          onClick={onClose}
          style={{
            width: '40px', height: '40px', borderRadius: '50%',
            backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.08)',
            color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: '0.95rem'
          }}
          aria-label="Back"
        >
          <i className="fa-solid fa-chevron-left"></i>
        </button>

        <div style={{ textAlign: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: '#ffffff' }}>Download Center</h2>
          <span style={{ fontSize: '0.72rem', color: 'var(--accent)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            Offline Storage
          </span>
        </div>

        {downloadedSongs.length > 0 ? (
          <button
            onClick={handleClearAll}
            style={{
              background: 'none', border: 'none', color: '#ff4d4d',
              fontSize: '0.78rem', fontWeight: '700', cursor: 'pointer', padding: '4px'
            }}
          >
            Clear all
          </button>
        ) : (
          <div style={{ width: '40px' }}></div>
        )}
      </div>

      {/* Storage Meter Card */}
      <div
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '20px',
          padding: '20px',
          marginBottom: '24px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Occupied On Device
            </span>
            <h3 style={{ margin: '4px 0 0', fontSize: '1.6rem', fontWeight: '800', color: 'var(--accent)' }}>
              {formatBytes(totalStorage)}
            </h3>
          </div>
          <div
            style={{
              width: '46px', height: '46px', borderRadius: '12px',
              backgroundColor: 'rgba(29, 185, 84, 0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}
          >
            <i className="fa-solid fa-hard-drive" style={{ color: 'var(--accent)', fontSize: '1.25rem' }}></i>
          </div>
        </div>

        {/* Visual progress track representing offline capacity */}
        <div style={{ width: '100%', height: '6px', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
          <div
            style={{
              width: `${Math.min(100, (totalStorage / (1024 * 1024 * 1024 * 2)) * 100)}%`, // Proportional scale up to 2GB reference
              minWidth: totalStorage > 0 ? '8px' : '0px',
              height: '100%',
              backgroundColor: 'var(--accent)',
              borderRadius: '3px'
            }}
          ></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          <span>{downloadedSongs.length} Cached Song{downloadedSongs.length === 1 ? '' : 's'}</span>
          <span>Offline ready</span>
        </div>
      </div>

      {/* Live Active Downloads Section */}
      {activeTaskList.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ margin: '0 0 12px 4px', fontSize: '0.88rem', fontWeight: '800', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            Downloading Now ({activeTaskList.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {activeTaskList.map((task) => (
              <div
                key={task.id}
                style={{
                  backgroundColor: 'rgba(29, 185, 84, 0.05)',
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
                      <img src={task.cover} alt={task.title} style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <i className="fa-solid fa-music" style={{ color: 'var(--accent)' }}></i>
                      </div>
                    )}
                    <div style={{ minWidth: 0, overflow: 'hidden' }}>
                      <h4 style={{ margin: 0, fontSize: '0.88rem', color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.title}</h4>
                      <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{task.artist}</p>
                    </div>
                  </div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--accent)', fontWeight: '700' }}>
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

      {/* Search Filter input */}
      {downloadedSongs.length > 0 && (
        <div style={{ marginBottom: '16px', position: 'relative' }}>
          <input
            type="text"
            placeholder="Filter downloaded tracks..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            style={{
              width: '100%', height: '42px', backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px',
              padding: '0 14px 0 38px', color: '#ffffff', outline: 'none', boxSizing: 'border-box',
              fontSize: '0.84rem'
            }}
          />
          <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: '14px', top: '14px', color: 'var(--text-muted)', fontSize: '0.85rem' }}></i>
        </div>
      )}

      {/* Completed Downloads List */}
      <h3 style={{ margin: '0 0 12px 4px', fontSize: '0.88rem', fontWeight: '800', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
        Downloaded Tracks ({filteredDownloads.length})
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: '14px',
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                  {song.cover ? (
                    <img src={song.cover} alt={song.title} style={{ width: '44px', height: '44px', borderRadius: '8px', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '44px', height: '44px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className="fa-solid fa-music" style={{ color: 'var(--accent)' }}></i>
                    </div>
                  )}
                  <div style={{ minWidth: 0, overflow: 'hidden' }}>
                    <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: '700', color: isCurrent ? 'var(--accent)' : '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {song.title}
                    </h4>
                    <p style={{ margin: '2px 0 0', fontSize: '0.74rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {song.artist} • <span style={{ color: 'var(--accent)' }}>{formatBytes(song.size)}</span>
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSong(song.id);
                    }}
                    style={{
                      background: 'none', border: 'none', color: 'rgba(255, 77, 77, 0.7)',
                      padding: '8px', cursor: 'pointer', fontSize: '0.9rem'
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
            <i className="fa-solid fa-cloud-arrow-down" style={{ fontSize: '2.4rem', opacity: 0.3, marginBottom: '14px' }}></i>
            <p style={{ margin: 0, fontSize: '0.85rem' }}>No downloaded music files found.</p>
            <p style={{ margin: '4px 0 0', fontSize: '0.74rem', opacity: 0.6 }}>Download tracks from any album or song row for offline playback.</p>
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
`;