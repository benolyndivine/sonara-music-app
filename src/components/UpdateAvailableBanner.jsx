import React from 'react';

/**
 * UpdateAvailableBanner
 * -----------------------
 * A slim, app-wide banner that appears the instant a new version is detected
 * (via the live onSnapshot listener on settings/appVersion in App.jsx) — no
 * need to open Notifications or Profile to find out. Dismissing it just
 * hides the banner for THIS version; it won't nag again until the next
 * actual update ships.
 *
 * Render this once, near the top of App.jsx's root return, outside/above
 * your view-switching logic so it's visible no matter which screen the
 * user is on (except maybe skip it while FullPlayerView is open, your call).
 */
export default function UpdateAvailableBanner({ updateInfo, currentVersion, onDismiss }) {
  if (!updateInfo || !updateInfo.version || updateInfo.version === currentVersion) return null;

  const handleUpdateClick = () => {
    if (updateInfo.url) window.open(updateInfo.url, '_blank');
  };

  return (
    <div
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9998,
        backgroundColor: '#0d2218', borderBottom: '1px solid rgba(29, 185, 84, 0.35)',
        padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '12px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        animation: 'slideDownToast 0.25s ease',
        boxSizing: 'border-box'
      }}
    >
      <div style={{
        width: '32px', height: '32px', borderRadius: '10px', flexShrink: 0,
        backgroundColor: 'rgba(29, 185, 84, 0.15)', display: 'flex',
        alignItems: 'center', justifyContent: 'center'
      }}>
        <i className="fa-solid fa-cloud-arrow-down" style={{ color: 'var(--accent)', fontSize: '0.95rem' }}></i>
      </div>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: '700', color: '#ffffff' }}>
          Version {updateInfo.version} is available
        </p>
        {updateInfo.notes && (
          <p style={{
            margin: '1px 0 0 0', fontSize: '0.72rem', color: 'rgba(255,255,255,0.6)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
          }}>
            {updateInfo.notes}
          </p>
        )}
      </div>

      <button
        onClick={handleUpdateClick}
        style={{
          background: 'var(--accent)', border: 'none', color: '#000000',
          fontWeight: '800', fontSize: '0.78rem', padding: '7px 14px',
          borderRadius: '10px', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap'
        }}
      >
        Update
      </button>

      <button
        onClick={() => onDismiss?.(updateInfo.version)}
        aria-label="Dismiss update banner"
        style={{
          background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)',
          fontSize: '1rem', cursor: 'pointer', padding: '4px', flexShrink: 0
        }}
      >
        <i className="fa-solid fa-xmark"></i>
      </button>
    </div>
  );
}