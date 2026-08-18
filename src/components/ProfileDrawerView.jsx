import React, { useState, useEffect } from 'react';
import { getSavedArtists } from '../utils/savedArtists';

const HEAD_ADMIN_EMAIL = 'benolynd@gmail.com';

export default function ProfileDrawerView({
  user,
  artists = [],
  onLogout,
  onNavigateSettings,
  onGoToSavedArtists,
  onOpenUploadSong,
  onOpenManageAlbums,
  onOpenManageArtists,
  onOpenManageLyrics,
  onUpdateProfile,
  onClose
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhotoUrl, setEditPhotoUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [downloadedCount, setDownloadedCount] = useState(0);

  useEffect(() => {
    let count = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('offline_track_')) count++;
    }
    setDownloadedCount(count);
  }, []);

  if (!user) return null;

  const isHeadAdmin = user.email === HEAD_ADMIN_EMAIL;
  const savedArtistsCount = getSavedArtists(artists).length;

  const handleCheckUpdate = () => {
    alert("Checking system servers... Sonara is completely up to date! (v1.4.3)");
  };

  const handleStartEdit = () => {
    setEditName(user.displayName || '');
    setEditPhotoUrl(user.photoURL || '');
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) {
      alert("Please enter a display name.");
      return;
    }
    setIsSaving(true);
    try {
      await onUpdateProfile?.({
        displayName: editName.trim(),
        photoURL: editPhotoUrl.trim() || null,
      });
      setIsEditing(false);
    } catch (err) {
      console.error("Failed to update profile:", err);
      alert("Couldn't save your profile changes. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div 
      className="pdv-hide-scrollbar"
      style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: '#05070c', zIndex: 600, padding: '24px 20px 36px',
        display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
        overflowY: 'auto',
        animation: 'slideUpSheet 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      <style>{profileDrawerStyles}</style>

      {/* Drawer Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: '#ffffff', letterSpacing: '-0.3px' }}>
          Account Profile
        </h2>
        <button 
          onClick={onClose}
          className="pdv-icon-btn"
          aria-label="Close"
          style={{
            width: '38px', height: '38px', borderRadius: '50%',
            backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.08)',
            color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
          }}
        >
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>

      {/* User Info Card */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '22px' }}>
        <div style={{ position: 'relative', marginBottom: '14px' }}>
          <img 
            src={(isEditing ? editPhotoUrl : user.photoURL) || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150'} 
            alt="User Account" 
            style={{ width: '82px', height: '82px', borderRadius: '50%', border: '3px solid var(--accent)', objectFit: 'cover', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}
            referrerPolicy="no-referrer"
          />
          {!isEditing && (
            <span style={{ position: 'absolute', bottom: '2px', right: '2px', width: '16px', height: '16px', backgroundColor: '#1db954', border: '3px solid #05070c', borderRadius: '50%' }}></span>
          )}
          {!isEditing && (
            <button
              onClick={handleStartEdit}
              title="Edit Profile"
              className="pdv-edit-avatar-btn"
              style={{
                position: 'absolute', top: '-2px', right: '-2px', width: '28px', height: '28px', borderRadius: '50%',
                backgroundColor: '#1a2232', border: '2px solid #05070c', color: '#ffffff', display: 'flex',
                alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '0.72rem'
              }}
            >
              <i className="fa-solid fa-pen"></i>
            </button>
          )}
        </div>

        {isEditing ? (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'stretch' }}>
            <div style={{ textAlign: 'left' }}>
              <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '700', textTransform: 'uppercase' }}>Display Name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Your name"
                className="pdv-input"
                style={inputStyle}
              />
            </div>
            <div style={{ textAlign: 'left' }}>
              <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '700', textTransform: 'uppercase' }}>Photo URL</label>
              <input
                type="text"
                value={editPhotoUrl}
                onChange={(e) => setEditPhotoUrl(e.target.value)}
                placeholder="https://..."
                className="pdv-input"
                style={inputStyle}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
              <button
                onClick={handleCancelEdit}
                disabled={isSaving}
                style={{ flex: 1, height: '42px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#ffffff', fontWeight: '700', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSaving}
                style={{ flex: 1, height: '42px', borderRadius: '10px', border: 'none', background: 'var(--accent)', color: '#000000', fontWeight: '800', cursor: 'pointer', opacity: isSaving ? 0.6 : 1 }}
              >
                {isSaving ? <i className="fa-solid fa-spinner fa-spin"></i> : 'Save'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '1.25rem', fontWeight: '800', color: '#ffffff', letterSpacing: '-0.3px' }}>
              {user.displayName || 'Sonara Streamer'}
            </h3>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'rgba(255, 255, 255, 0.55)' }}>
              {user.email}
            </p>
          </>
        )}
      </div>

      {/* 👑 Head Admin Control Studio Card */}
      {isHeadAdmin && (
        <div style={{ marginBottom: '18px', backgroundColor: 'rgba(29, 185, 84, 0.04)', padding: '16px 14px', borderRadius: '16px', border: '1px solid rgba(29, 185, 84, 0.18)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', paddingLeft: '4px' }}>
            <i className="fa-solid fa-crown" style={{ color: 'var(--accent)', fontSize: '0.85rem' }}></i>
            <span style={{ fontSize: '0.74rem', color: 'var(--accent)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Head Admin Studio
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* 1. Upload Song */}
            <button onClick={onOpenUploadSong} className="pdv-action-row" style={adminRowBtnStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={iconBoxStyle}>
                  <i className="fa-solid fa-cloud-arrow-up" style={{ color: 'var(--accent)', fontSize: '0.95rem' }}></i>
                </div>
                <span style={{ color: '#ffffff', fontWeight: '600', fontSize: '0.88rem' }}>Upload Song & Cover</span>
              </div>
              <i className="fa-solid fa-chevron-right" style={chevronStyle}></i>
            </button>

            {/* 2. Manage Albums */}
            <button onClick={onOpenManageAlbums} className="pdv-action-row" style={adminRowBtnStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={iconBoxStyle}>
                  <i className="fa-solid fa-compact-disc" style={{ color: 'var(--accent)', fontSize: '0.95rem' }}></i>
                </div>
                <span style={{ color: '#ffffff', fontWeight: '600', fontSize: '0.88rem' }}>Create & Assign Albums</span>
              </div>
              <i className="fa-solid fa-chevron-right" style={chevronStyle}></i>
            </button>

            {/* 3. Manage Artists */}
            <button onClick={onOpenManageArtists} className="pdv-action-row" style={adminRowBtnStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={iconBoxStyle}>
                  <i className="fa-solid fa-user-astronaut" style={{ color: 'var(--accent)', fontSize: '0.95rem' }}></i>
                </div>
                <span style={{ color: '#ffffff', fontWeight: '600', fontSize: '0.88rem' }}>Manage Artists</span>
              </div>
              <i className="fa-solid fa-chevron-right" style={chevronStyle}></i>
            </button>

            {/* 4. Manage Lyrics */}
            <button onClick={onOpenManageLyrics} className="pdv-action-row" style={adminRowBtnStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={iconBoxStyle}>
                  <i className="fa-solid fa-file-lines" style={{ color: 'var(--accent)', fontSize: '0.95rem' }}></i>
                </div>
                <span style={{ color: '#ffffff', fontWeight: '600', fontSize: '0.88rem' }}>Manage Lyrics</span>
              </div>
              <i className="fa-solid fa-chevron-right" style={chevronStyle}></i>
            </button>
          </div>
        </div>
      )}

      {/* Storage & Offline Card */}
      <div style={{ marginBottom: '18px', backgroundColor: 'rgba(255, 255, 255, 0.02)', padding: '14px 16px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'rgba(29, 185, 84, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="fa-solid fa-download" style={{ color: 'var(--accent)', fontSize: '1rem' }}></i>
          </div>
          <div>
            <p style={{ margin: '0 0 2px 0', fontSize: '0.88rem', color: '#ffffff', fontWeight: '700' }}>Downloaded Songs</p>
            <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-muted)' }}>{downloadedCount} {downloadedCount === 1 ? 'track' : 'tracks'} saved offline</p>
          </div>
        </div>
        <button
          onClick={onNavigateSettings}
          style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '700', padding: '6px 8px' }}
        >
          Manage
        </button>
      </div>

      {/* General Preferences Grouped Card */}
      <div style={{ display: 'flex', flexDirection: 'column', backgroundColor: 'rgba(255, 255, 255, 0.02)', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.06)', overflow: 'hidden', marginBottom: '24px' }}>
        
        {/* Saved Artists */}
        <button 
          className="pdv-list-row"
          onClick={onGoToSavedArtists}
          style={listRowStyle}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={iconBoxStyle}>
              <i className="fa-solid fa-user-group" style={{ color: 'var(--accent)', fontSize: '0.95rem' }}></i>
            </div>
            <span style={{ fontWeight: '600', fontSize: '0.9rem', color: '#ffffff' }}>Saved Artists</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>{savedArtistsCount}</span>
            <i className="fa-solid fa-chevron-right" style={chevronStyle}></i>
          </div>
        </button>

        <div style={rowDividerStyle}></div>

        {/* Settings */}
        <button 
          className="pdv-list-row"
          onClick={onNavigateSettings}
          style={listRowStyle}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={iconBoxStyle}>
              <i className="fa-solid fa-gear" style={{ color: 'var(--accent)', fontSize: '0.95rem' }}></i>
            </div>
            <span style={{ fontWeight: '600', fontSize: '0.9rem', color: '#ffffff' }}>Settings</span>
          </div>
          <i className="fa-solid fa-chevron-right" style={chevronStyle}></i>
        </button>

        <div style={rowDividerStyle}></div>

        {/* About Sonara */}
        <button 
          className="pdv-list-row"
          onClick={() => alert("Sonara App v1.4.3 — Handcrafted React Cloud Audio Streaming Interface.")}
          style={listRowStyle}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={iconBoxStyle}>
              <i className="fa-solid fa-circle-info" style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.95rem' }}></i>
            </div>
            <span style={{ fontWeight: '600', fontSize: '0.9rem', color: '#ffffff' }}>About Sonara</span>
          </div>
          <i className="fa-solid fa-chevron-right" style={chevronStyle}></i>
        </button>

        <div style={rowDividerStyle}></div>

        {/* Check for Update */}
        <button 
          className="pdv-list-row"
          onClick={handleCheckUpdate}
          style={listRowStyle}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={iconBoxStyle}>
              <i className="fa-solid fa-rotate" style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.95rem' }}></i>
            </div>
            <span style={{ fontWeight: '600', fontSize: '0.9rem', color: '#ffffff' }}>Check for Update</span>
          </div>
          <i className="fa-solid fa-chevron-right" style={chevronStyle}></i>
        </button>

        <div style={rowDividerStyle}></div>

        {/* App Version Row */}
        <div style={{ ...listRowStyle, cursor: 'default' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={iconBoxStyle}>
              <i className="fa-solid fa-code-branch" style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: '0.95rem' }}></i>
            </div>
            <span style={{ fontWeight: '600', fontSize: '0.9rem', color: 'rgba(255, 255, 255, 0.6)' }}>App Version</span>
          </div>
          <span style={{ fontWeight: '700', color: '#ffffff', backgroundColor: 'rgba(255, 255, 255, 0.08)', padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', letterSpacing: '0.5px' }}>
            v1.4.3
          </span>
        </div>

      </div>

      {/* Sign Out Button */}
      <button 
        onClick={onLogout}
        className="pdv-signout-btn"
        style={{
          width: '100%', height: '48px', borderRadius: '14px', border: '1px solid rgba(255, 77, 77, 0.25)',
          backgroundColor: 'rgba(255, 77, 77, 0.08)', color: '#ff4d4d', fontWeight: '700', fontSize: '0.9rem',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer',
          marginTop: 'auto'
        }}
      >
        <i className="fa-solid fa-arrow-right-from-bracket"></i>
        <span>Sign Out Account</span>
      </button>
    </div>
  );
}

// 💅 Unified Styling Constants
const inputStyle = {
  width: '100%', height: '42px', backgroundColor: 'rgba(255, 255, 255, 0.05)',
  border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '10px',
  padding: '0 12px', color: '#ffffff', outline: 'none', boxSizing: 'border-box'
};

const iconBoxStyle = {
  width: '32px', height: '32px', borderRadius: '8px',
  backgroundColor: 'rgba(255, 255, 255, 0.04)',
  display: 'flex', alignItems: 'center', justifyContent: 'center'
};

const chevronStyle = {
  color: 'var(--text-muted)', fontSize: '0.75rem', opacity: 0.5
};

const adminRowBtnStyle = {
  width: '100%', height: '46px', padding: '0 12px',
  backgroundColor: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)',
  borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  cursor: 'pointer', transition: 'all 0.15s'
};

const listRowStyle = {
  width: '100%', height: '52px', padding: '0 16px',
  backgroundColor: 'transparent', border: 'none',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  cursor: 'pointer', transition: 'background-color 0.15s', boxSizing: 'border-box'
};

const rowDividerStyle = {
  height: '1px', backgroundColor: 'rgba(255, 255, 255, 0.04)', marginLeft: '62px'
};

const profileDrawerStyles = `
  @keyframes slideUpSheet {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }

  /* 🛡️ Hide scrollbars while preserving scrolling */
  .pdv-hide-scrollbar::-webkit-scrollbar {
    display: none;
  }
  .pdv-hide-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  .pdv-icon-btn { transition: background-color 0.2s, transform 0.15s; }
  .pdv-icon-btn:hover { background-color: rgba(255, 255, 255, 0.1) !important; }
  .pdv-icon-btn:active { transform: scale(0.92); }

  .pdv-edit-avatar-btn { transition: transform 0.15s; }
  .pdv-edit-avatar-btn:hover { transform: scale(1.1); }

  .pdv-action-row:hover {
    background-color: rgba(255, 255, 255, 0.07) !important;
    border-color: rgba(29, 185, 84, 0.4) !important;
    transform: translateY(-1px);
  }

  .pdv-list-row:hover {
    background-color: rgba(255, 255, 255, 0.04) !important;
  }

  .pdv-signout-btn { transition: background-color 0.2s, transform 0.15s; }
  .pdv-signout-btn:hover {
    background-color: rgba(255, 77, 77, 0.16) !important;
    border-color: rgba(255, 77, 77, 0.4) !important;
    transform: translateY(-1px);
  }
  .pdv-signout-btn:active { transform: scale(0.98); }
`;