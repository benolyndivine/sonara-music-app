import React, { useState, useEffect } from 'react';

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

export default function NotificationCenter({ onClose, onSelectTrack, songs = [], onNotificationsRead }) {
  const [clearedIds, setClearedIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('sonara_cleared_notifications') || '[]');
    } catch {
      return [];
    }
  });

  // 🕒 Live clock tick every 30 seconds to force automatic relative timestamp updates
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const liveTimer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 30000);
    return () => clearInterval(liveTimer);
  }, []);

  // Helper to extract timestamp in milliseconds
  const getSongTimestamp = (song) => {
    if (song.createdAt?.seconds) return song.createdAt.seconds * 1000;
    if (song.createdAt?.toMillis) return song.createdAt.toMillis();
    if (song.uploadedAt) return new Date(song.uploadedAt).getTime();
    if (song.createdAt) return new Date(song.createdAt).getTime();
    return 0;
  };

  // Filter songs added within 2 days that have not been permanently cleared
  const recentSongs = songs
    .filter((song) => {
      if (clearedIds.includes(song.id)) return false;
      const time = getSongTimestamp(song);
      return time > 0 && (currentTime - time) <= TWO_DAYS_MS;
    })
    .sort((a, b) => getSongTimestamp(b) - getSongTimestamp(a));

  // Automatically mark all current notifications as read upon opening
  useEffect(() => {
    try {
      const readIds = JSON.parse(localStorage.getItem('sonara_read_notifications') || '[]');
      const currentSongIds = songs.map((s) => s.id);
      const updated = Array.from(new Set([...readIds, ...currentSongIds]));
      localStorage.setItem('sonara_read_notifications', JSON.stringify(updated));
      onNotificationsRead?.();
    } catch (err) {
      console.error('Failed to mark notifications as read:', err);
    }
  }, [songs, onNotificationsRead]);

  // Permanently clears all current notifications across app sessions
  const clearAllNotifications = () => {
    try {
      const currentSongIds = songs.map((s) => s.id);
      const updatedCleared = Array.from(new Set([...clearedIds, ...currentSongIds]));
      setClearedIds(updatedCleared);
      localStorage.setItem('sonara_cleared_notifications', JSON.stringify(updatedCleared));

      const readIds = JSON.parse(localStorage.getItem('sonara_read_notifications') || '[]');
      const updatedRead = Array.from(new Set([...readIds, ...currentSongIds]));
      localStorage.setItem('sonara_read_notifications', JSON.stringify(updatedRead));

      onNotificationsRead?.();
    } catch (err) {
      console.error('Failed to clear notifications:', err);
    }
  };

  // ⏱️ Live Relative Time Formatter (< 1m: just now, < 60m: Xm ago, < 24h: Xh ago, >= 24h: Xd ago)
  const formatSongTime = (song) => {
    const time = getSongTimestamp(song);
    if (!time) return 'Recently Added';
    const diffMs = currentTime - time;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div
      className="nc-hide-scrollbar"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#05070c',
        zIndex: 650,
        padding: '24px 20px 48px',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        overflowY: 'auto',
        animation: 'slideUpSheet 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      <style>{notificationStyles}</style>

      {/* Header Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <button
          onClick={onClose}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: '0.95rem'
          }}
          aria-label="Back"
        >
          <i className="fa-solid fa-chevron-left"></i>
        </button>

        <div style={{ textAlign: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: '#ffffff' }}>Notifications</h2>
          <span style={{ fontSize: '0.72rem', color: 'var(--accent)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            Last 48 Hours
          </span>
        </div>

        {recentSongs.length > 0 ? (
          <button
            onClick={clearAllNotifications}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--accent)',
              fontSize: '0.78rem',
              fontWeight: '700',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            Clear all
          </button>
        ) : (
          <div style={{ width: '40px' }}></div>
        )}
      </div>

      {/* Subheader summary */}
      {recentSongs.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', padding: '0 4px' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>
            {recentSongs.length} New Song{recentSongs.length === 1 ? '' : 's'} Added Recently
          </span>
        </div>
      )}

      {/* Filtered Song Releases List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {recentSongs.length > 0 ? (
          recentSongs.map((song) => {
            const songImg = song.cover || song.image || song.imageUrl || song.coverUrl;
            const songTitle = song.title || song.name || 'Untitled Track';

            return (
              <div
                key={song.id}
                onClick={() => {
                  onSelectTrack?.(song, songs);
                  onClose?.();
                }}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '16px',
                  padding: '14px 16px',
                  display: 'flex',
                  gap: '14px',
                  alignItems: 'center',
                  position: 'relative',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {/* Song Cover Thumbnail */}
                <div style={{ position: 'relative', width: '48px', height: '48px', flexShrink: 0 }}>
                  {songImg ? (
                    <img
                      src={songImg}
                      alt={songTitle}
                      style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: '10px',
                        objectFit: 'cover',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: '10px',
                        backgroundColor: 'rgba(29, 185, 84, 0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <i className="fa-solid fa-music" style={{ color: 'var(--accent)', fontSize: '1.2rem' }}></i>
                    </div>
                  )}
                </div>

                {/* Song Details */}
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <h4
                      style={{
                        margin: 0,
                        fontSize: '0.92rem',
                        fontWeight: '700',
                        color: '#ffffff',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {songTitle}
                    </h4>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '500', marginLeft: '8px', flexShrink: 0 }}>
                      {formatSongTime(song)}
                    </span>
                  </div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: '0.8rem',
                      color: 'rgba(255, 255, 255, 0.65)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {song.artist || 'Unknown Artist'} • <span style={{ color: 'var(--accent)' }}>Tap to play</span>
                  </p>
                </div>
              </div>
            );
          })
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '80px 20px',
              textAlign: 'center'
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px'
              }}
            >
              <i className="fa-regular fa-bell" style={{ fontSize: '1.8rem', color: 'var(--text-muted)' }}></i>
            </div>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', color: '#ffffff', fontWeight: '700' }}>No Recent Releases</h3>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: '240px' }}>
              No new songs have been added in the past 2 days.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

const notificationStyles = `
  /* 🛡️ Hide Scrollbar Globally inside Notification Center */
  .nc-hide-scrollbar::-webkit-scrollbar {
    display: none !important;
    width: 0 !important;
    height: 0 !important;
  }
  .nc-hide-scrollbar {
    -ms-overflow-style: none !important;
    scrollbar-width: none !important;
  }
`;