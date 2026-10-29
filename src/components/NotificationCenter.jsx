import React, { useState, useEffect } from 'react';
import CachedImage from './CachedImage';
import { CURRENT_APP_VERSION, isNewerVersion } from '../utils/updateService';

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

export default function NotificationCenter({
  onClose,
  onSelectTrack,
  songs = [],
  albums = [],
  artists = [],
  updateInfo = null,
  onNotificationsRead,
  onNavigateHome
}) {
  const [clearedIds, setClearedIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('sonara_cleared_notifications') || '[]');
    } catch {
      return [];
    }
  });

  const [activeTab, setActiveTab] = useState('all'); // 'all', 'releases', 'updates'
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const liveTimer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 30000);
    return () => clearInterval(liveTimer);
  }, []);

  const getSongTimestamp = (song) => {
    if (song.createdAt?.seconds) return song.createdAt.seconds * 1000;
    if (song.createdAt?.toMillis) return song.createdAt.toMillis();
    if (song.uploadedAt) return new Date(song.uploadedAt).getTime();
    if (song.createdAt) return new Date(song.createdAt).getTime();
    return 0;
  };

  const recentSongs = songs
    .filter((song) => {
      if (clearedIds.includes(song.id)) return false;
      const time = getSongTimestamp(song);
      return time > 0 && (currentTime - time) <= TWO_DAYS_MS;
    })
    .sort((a, b) => getSongTimestamp(b) - getSongTimestamp(a));

  const hasUnreadUpdate = updateInfo && updateInfo.version && isNewerVersion(updateInfo.version, CURRENT_APP_VERSION) && !clearedIds.includes('update_' + updateInfo.version);

  useEffect(() => {
    try {
      const readIds = JSON.parse(localStorage.getItem('sonara_read_notifications') || '[]');
      const currentSongIds = songs.map((s) => s.id);
      if (updateInfo?.version) currentSongIds.push('update_' + updateInfo.version);
      const updated = Array.from(new Set([...readIds, ...currentSongIds]));
      localStorage.setItem('sonara_read_notifications', JSON.stringify(updated));
      onNotificationsRead?.();
    } catch (err) {
      console.error('Failed to mark notifications as read:', err);
    }
  }, [songs, updateInfo, onNotificationsRead]);

  const clearAllNotifications = () => {
    try {
      const currentSongIds = songs.map((s) => s.id);
      if (updateInfo?.version) currentSongIds.push('update_' + updateInfo.version);
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

  // Filter based on active tab
  const showUpdates = (activeTab === 'all' || activeTab === 'updates') && hasUnreadUpdate;
  const filteredSongReleases = (activeTab === 'all' || activeTab === 'releases') ? recentSongs : [];
  const totalNotificationsCount = recentSongs.length + (hasUnreadUpdate ? 1 : 0);

  return (
    <div
      className="nc-hide-scrollbar"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'var(--bg-dark, #05070c)',
        zIndex: 650,
        padding: 'calc(env(safe-area-inset-top, 0px) + 20px) 20px calc(env(safe-area-inset-bottom, 0px) + 48px)',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        overflowY: 'auto',
        animation: 'slideUpSheet 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      <style>{notificationStyles}</style>

      {/* 🌟 Ambient Backdrop Glow */}
      <div className="ambient-backdrop-glow" style={{ '--ambient-glow-color': 'rgba(29, 185, 84, 0.2)', top: '-20px' }}></div>

      {/* Header Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', position: 'relative', zIndex: 1 }}>
        <button
          onClick={onClose}
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            color: 'var(--text-main)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: '1.05rem'
          }}
          aria-label="Back"
        >
          <i className="fa-solid fa-arrow-left"></i>
        </button>

        <div style={{ textAlign: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-main)', letterSpacing: '-0.3px' }}>
            Notifications
          </h2>
          <span style={{ fontSize: '0.72rem', color: 'var(--accent)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            System Updates & Releases
          </span>
        </div>

        {totalNotificationsCount > 0 ? (
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

      {/* 🌟 Category Filter Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', position: 'relative', zIndex: 1, overflowX: 'auto', paddingBottom: '4px' }}>
        <button
          onClick={() => setActiveTab('all')}
          className={`notif-filter-tab ${activeTab === 'all' ? 'active' : 'inactive'}`}
        >
          All ({totalNotificationsCount})
        </button>
        <button
          onClick={() => setActiveTab('releases')}
          className={`notif-filter-tab ${activeTab === 'releases' ? 'active' : 'inactive'}`}
        >
          New Releases ({recentSongs.length})
        </button>
        <button
          onClick={() => setActiveTab('updates')}
          className={`notif-filter-tab ${activeTab === 'updates' ? 'active' : 'inactive'}`}
        >
          App Updates ({hasUnreadUpdate ? 1 : 0})
        </button>
      </div>

      {/* Notifications List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative', zIndex: 1 }}>
        
        {/* App Update Notification Card */}
        {showUpdates && (
          <div
            onClick={() => {
              if (updateInfo.url) window.open(updateInfo.url, '_blank');
            }}
            style={{
              backgroundColor: 'rgba(29, 185, 84, 0.09)',
              border: '1px solid rgba(29, 185, 84, 0.35)',
              borderRadius: '16px',
              padding: '14px 16px',
              display: 'flex',
              gap: '14px',
              alignItems: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)'
            }}
          >
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(29, 185, 84, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className="fa-solid fa-cloud-arrow-down" style={{ color: 'var(--accent)', fontSize: '1.3rem' }}></i>
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: '700', color: 'var(--text-main)' }}>
                  New Version v{updateInfo.version} Available!
                </h4>
                <span style={{ fontSize: '0.65rem', backgroundColor: 'rgba(29, 185, 84, 0.2)', color: 'var(--accent)', fontWeight: '800', padding: '2px 8px', borderRadius: '10px' }}>
                  DATABASE UPDATE
                </span>
              </div>
              <p style={{ margin: '0 0 6px 0', fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.75)' }}>
                {updateInfo.notes || 'Tap here to download and install the latest APK release.'}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--accent)', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <i className="fa-solid fa-download"></i> Download APK
                </span>
                <span style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.35)' }}>•</span>
                <span style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.5)' }}>Current: v{CURRENT_APP_VERSION}</span>
                <span style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.35)' }}>•</span>
                <span style={{ fontSize: '0.7rem', color: 'var(--accent)', opacity: 0.85 }}>Cloud Sync</span>
              </div>
            </div>
          </div>
        )}

        {/* Dedicated App Updates Tab: Up to Date State */}
        {activeTab === 'updates' && !hasUnreadUpdate && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '40px 20px', textAlign: 'center', backgroundColor: 'rgba(255, 255, 255, 0.02)',
            borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.06)'
          }}>
            <div style={{
              width: '52px', height: '52px', borderRadius: '50%',
              backgroundColor: 'rgba(29, 185, 84, 0.12)', border: '1px solid rgba(29, 185, 84, 0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px'
            }}>
              <i className="fa-solid fa-check" style={{ color: 'var(--accent)', fontSize: '1.4rem' }}></i>
            </div>
            <h4 style={{ margin: '0 0 6px 0', fontSize: '1rem', color: 'var(--text-main)', fontWeight: '700' }}>
              Sonara is Up to Date!
            </h4>
            <p style={{ margin: '0 0 12px 0', fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '280px', lineHeight: 1.4 }}>
              You are currently using version v{CURRENT_APP_VERSION}. Checked live against the cloud database.
            </p>
            <span style={{
              fontSize: '0.72rem', color: 'var(--accent)', backgroundColor: 'rgba(29, 185, 84, 0.1)',
              padding: '4px 12px', borderRadius: '20px', fontWeight: '700'
            }}>
              ☁️ Cloud Database: settings/appVersion
            </span>
          </div>
        )}

        {/* Song Releases List */}
        {filteredSongReleases.length > 0 && (
          filteredSongReleases.map((song) => {
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
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  borderRadius: '16px',
                  padding: '12px 14px',
                  display: 'flex',
                  gap: '14px',
                  alignItems: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ position: 'relative', width: '48px', height: '48px', flexShrink: 0 }}>
                  {songImg ? (
                    <CachedImage
                      src={songImg}
                      alt={songTitle}
                      style={{ width: '100%', height: '100%', borderRadius: '10px', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{ width: '100%', height: '100%', borderRadius: '10px', backgroundColor: 'rgba(29, 185, 84, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className="fa-solid fa-music" style={{ color: 'var(--accent)', fontSize: '1.2rem' }}></i>
                    </div>
                  )}
                </div>

                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: '700', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {songTitle}
                    </h4>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '500', marginLeft: '8px', flexShrink: 0 }}>
                      {formatSongTime(song)}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'rgba(255, 255, 255, 0.65)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {song.artist || 'Unknown Artist'} • <span style={{ color: 'var(--accent)', fontWeight: '600' }}>New Song Drop</span>
                  </p>
                </div>

                {/* Instant Play Button */}
                <button
                  style={{
                    width: '34px', height: '34px', borderRadius: '50%',
                    backgroundColor: 'rgba(29, 185, 84, 0.15)', border: '1px solid rgba(29, 185, 84, 0.3)',
                    color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.85rem', flexShrink: 0, cursor: 'pointer'
                  }}
                  title="Play track"
                >
                  <i className="fa-solid fa-play" style={{ marginLeft: '2px' }}></i>
                </button>
              </div>
            );
          })
        )}

        {/* 🌟 Rich Animated Empty State */}
        {!hasUnreadUpdate && recentSongs.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '50px 20px 20px', textAlign: 'center' }}>
            {/* Animated Radar Pulse Rings */}
            <div className="empty-radar-wrap">
              <div className="radar-ring"></div>
              <div className="radar-ring"></div>
              <div className="radar-ring"></div>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'rgba(29, 185, 84, 0.12)', border: '1px solid rgba(29, 185, 84, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                <i className="fa-solid fa-bell" style={{ fontSize: '1.5rem', color: 'var(--accent)' }}></i>
              </div>
            </div>

            <h3 style={{ margin: '0 0 6px 0', fontSize: '1.2rem', color: 'var(--text-main)', fontWeight: '800' }}>
              All Caught Up!
            </h3>
            <p style={{ margin: '0 0 24px 0', fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: '260px', lineHeight: 1.5 }}>
              No new notifications right now. You're completely up to date with new track releases.
            </p>

            {/* Quick Explore Action */}
            <button
              onClick={() => {
                onClose?.();
                onNavigateHome?.();
              }}
              className="pulse-play-btn"
              style={{
                padding: '10px 22px', borderRadius: '24px',
                backgroundColor: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.18)',
                color: 'var(--text-main)', fontWeight: '700', fontSize: '0.84rem', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: '8px'
              }}
            >
              <i className="fa-solid fa-compass" style={{ color: 'var(--accent)' }}></i>
              <span>Explore Trending Music</span>
            </button>
          </div>
        )}

        {/* 🌟 "What's New in Sonara" Highlights Card */}
        <div
          style={{
            marginTop: '20px',
            background: 'linear-gradient(135deg, rgba(29, 185, 84, 0.06) 0%, rgba(13, 20, 32, 0.4) 100%)',
            border: '1px solid rgba(29, 185, 84, 0.15)',
            borderRadius: '16px',
            padding: '16px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <i className="fa-solid fa-wand-magic-sparkles" style={{ color: 'var(--accent)', fontSize: '0.85rem' }}></i>
            <span style={{ fontSize: '0.74rem', color: 'var(--accent)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
              Sonara Highlights
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <i className="fa-solid fa-mobile-screen" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', marginTop: '3px' }}></i>
              <div>
                <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-main)' }}>Origin Island Background Mode</p>
                <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>Displays live audio controls in your phone's island when the app is minimized.</p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <i className="fa-solid fa-hard-drive" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem', marginTop: '3px' }}></i>
              <div>
                <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-main)' }}>Zero-Latency Offline Caching</p>
                <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>Save any track for lossless offline listening with custom storage management.</p>
              </div>
            </div>
          </div>
        </div>

        {/* 🔔 Notification Preferences Pill */}
        <div
          style={{
            marginTop: '8px',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            border: '1px solid rgba(255, 255, 255, 0.06)',
            borderRadius: '14px',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <i className="fa-solid fa-bell-slash" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}></i>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Artist Release Alerts</span>
          </div>
          <span style={{ fontSize: '0.74rem', color: 'var(--accent)', fontWeight: '700' }}>Active</span>
        </div>

      </div>
    </div>
  );
}

const notificationStyles = `
  .nc-hide-scrollbar::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
  .nc-hide-scrollbar { -ms-overflow-style: none !important; scrollbar-width: none !important; }
`;