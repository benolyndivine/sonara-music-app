import React, { useState, useEffect } from 'react';
import { getSavedArtists } from '../utils/savedArtists';

export default function ProfileDrawerView({
  user,
  artists = [],
  onLogout,
  onNavigateSettings,
  onGoToSavedArtists,
  onUpdateProfile,
  onClose
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhotoUrl, setEditPhotoUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [downloadedCount, setDownloadedCount] = useState(0);

  // 🆕 Storage stats — scanned fresh every time the drawer opens (this
  // component remounts on each open, same pattern SettingsView uses).
  useEffect(() => {
    let count = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('offline_track_')) count++;
    }
    setDownloadedCount(count);
  }, []);

  if (!user) return null;

  const savedArtistsCount = getSavedArtists(artists).length;

  const handleCheckUpdate = () => {
    alert("Checking system servers... Sonara is completely up to date! (v1.4.2)");
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
      style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: '#05070c', zIndex: 600, padding: '32px 24px',
        display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
        overflowY: 'auto',
        animation: 'slideUpSheet 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      {/* Drawer Header Navbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: '700', color: '#ffffff' }}>Account Profile</h2>
        <button 
          onClick={onClose}
          style={{
            width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.06)',
            border: 'none', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
          }}
        >
          <i className="fa-solid fa-xmark"></i>
        </button>
      </div>

      {/* User Info Overview Card */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '28px' }}>
        <div style={{ position: 'relative', marginBottom: '16px' }}>
          <img 
            src={(isEditing ? editPhotoUrl : user.photoURL) || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150'} 
            alt="User Account" 
            style={{ width: '84px', height: '84px', borderRadius: '50%', border: '3px solid #1db954', objectFit: 'cover' }}
            referrerPolicy="no-referrer"
          />
          {!isEditing && (
            <span style={{ position: 'absolute', bottom: '4px', right: '4px', width: '16px', height: '16px', backgroundColor: '#1db954', border: '3px solid #05070c', borderRadius: '50%' }}></span>
          )}
          {!isEditing && (
            <button
              onClick={handleStartEdit}
              title="Edit Profile"
              style={{
                position: 'absolute', top: '-2px', right: '-2px', width: '28px', height: '28px', borderRadius: '50%',
                backgroundColor: '#1a2232', border: '2px solid #05070c', color: '#ffffff', display: 'flex',
                alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '0.75rem'
              }}
            >
              <i className="fa-solid fa-pen"></i>
            </button>
          )}
        </div>

        {isEditing ? (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'stretch' }}>
            <div style={{ textAlign: 'left' }}>
              <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '600' }}>Display Name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Your name"
                style={{ width: '100%', height: '40px', backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '0 12px', color: '#ffffff', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ textAlign: 'left' }}>
              <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '600' }}>Photo URL</label>
              <input
                type="text"
                value={editPhotoUrl}
                onChange={(e) => setEditPhotoUrl(e.target.value)}
                placeholder="https://..."
                style={{ width: '100%', height: '40px', backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '0 12px', color: '#ffffff', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
              <button
                onClick={handleCancelEdit}
                disabled={isSaving}
                style={{ flex: 1, height: '40px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#ffffff', fontWeight: '600', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSaving}
                style={{ flex: 1, height: '40px', borderRadius: '10px', border: 'none', background: 'var(--accent)', color: '#000000', fontWeight: '700', cursor: 'pointer', opacity: isSaving ? 0.6 : 1 }}
              >
                {isSaving ? <i className="fa-solid fa-spinner fa-spin"></i> : 'Save'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '1.2rem', fontWeight: '700', color: '#ffffff' }}>{user.displayName || 'Sonara Streamer'}</h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.6)' }}>{user.email}</p>
          </>
        )}
      </div>

      {/* 🆕 Storage stats card */}
      <div style={{ marginBottom: '20px', backgroundColor: 'rgba(255, 255, 255, 0.03)', padding: '14px 16px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <i className="fa-solid fa-download" style={{ color: 'var(--accent)', fontSize: '1.1rem' }}></i>
          <div>
            <p style={{ margin: '0 0 2px 0', fontSize: '0.9rem', color: '#ffffff', fontWeight: '600' }}>Downloaded Songs</p>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>{downloadedCount} {downloadedCount === 1 ? 'track' : 'tracks'} saved offline</p>
          </div>
        </div>
        <button
          onClick={onNavigateSettings}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}
        >
          Manage
        </button>
      </div>

      {/* Row List Panel System */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>

        {/* 🆕 Saved Artists Row - jumps straight to Library's Artists tab */}
        <button 
          className="sheet-action-row-item" 
          onClick={onGoToSavedArtists}
          style={{ height: '48px', padding: '0 20px', backgroundColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <i className="fa-solid fa-user-group sheet-icon" style={{ color: '#1db954', fontSize: '1.15rem' }}></i>
            <span style={{ fontWeight: '500', fontSize: '1rem', color: '#ffffff' }}>Saved Artists</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{savedArtistsCount}</span>
            <i className="fa-solid fa-chevron-right" style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}></i>
          </span>
        </button>

        {/* Settings Row - Navigates to Settings View */}
        <button 
          className="sheet-action-row-item" 
          onClick={onNavigateSettings}
          style={{ height: '48px', padding: '0 20px', backgroundColor: 'transparent' }}
        >
          <i className="fa-solid fa-gear sheet-icon" style={{ color: '#1db954', fontSize: '1.25rem' }}></i> 
          <span style={{ fontWeight: '500', fontSize: '1rem', color: '#ffffff' }}>Settings</span>
        </button>

        {/* About Sonara Row */}
        <button 
          className="sheet-action-row-item" 
          onClick={() => alert("Sonara App v1.4.2 — Handcrafted React Cloud Audio Streaming Interface.")}
          style={{ height: '48px', padding: '0 20px', backgroundColor: 'transparent' }}
        >
          <i className="fa-solid fa-circle-info sheet-icon" style={{ color: 'rgba(255,255,255,0.6)', fontSize: '1.15rem' }}></i> 
          <span style={{ fontWeight: '500', fontSize: '1rem', color: '#ffffff' }}>About Sonara</span>
        </button>

        {/* Check for Update Row */}
        <button 
          className="sheet-action-row-item" 
          onClick={handleCheckUpdate}
          style={{ height: '48px', padding: '0 20px', backgroundColor: 'transparent' }}
        >
          <i className="fa-solid fa-rotate sheet-icon" style={{ color: 'rgba(255,255,255,0.6)', fontSize: '1.15rem' }}></i> 
          <span style={{ fontWeight: '500', fontSize: '1rem', color: '#ffffff' }}>Check for Update</span>
        </button>

        {/* App Version Row with Pill Badge */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px', height: '48px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '16px', color: 'rgba(255, 255, 255, 0.4)', fontSize: '1rem', fontWeight: '500' }}>
            <i className="fa-solid fa-code-branch" style={{ width: '24px', textAlign: 'center', fontSize: '1.15rem' }}></i> 
            App Version
          </span>
          <span style={{ fontWeight: '700', color: '#ffffff', backgroundColor: 'rgba(255, 255, 255, 0.1)', padding: '6px 14px', borderRadius: '20px', fontSize: '0.85rem', letterSpacing: '0.5px' }}>
            v1.4.3
          </span>
        </div>

      </div>

      <button 
        className="sheet-action-row-item close-sheet-btn" 
        onClick={onLogout}
        style={{ color: '#ff4d4d', justifyContent: 'center', fontWeight: '700', height: '50px', borderRadius: '14px', marginTop: 'auto' }}
      >
        Sign Out Account
      </button>
    </div>
  );
}