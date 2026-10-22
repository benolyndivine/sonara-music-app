import React, { useState, useEffect } from 'react';
import { getSavedArtists } from '../utils/savedArtists';
import { triggerHaptic } from '../utils/audioEffects';
import {
  CURRENT_APP_VERSION,
  CURRENT_APP_BUILD,
  isNewerVersion,
  fetchUpdateFromDatabase,
  publishAppUpdateToDatabase,
  notifyAppUpdate
} from '../utils/updateService';
import CachedImage from './CachedImage';
import logo from '../assets/logo3.png';

const ADMIN_EMAILS = [
  'benolynd@gmail.com',
  'darkrush311@gmail.com',
  '2007kirubhasaravanan@gmail.com',
  'ganeshjagan006@gmail.com',
  'kratozthomas@gmail.com'
];

export default function ProfileDrawerView({
  user,
  artists = [],
  playlists = [],
  currentVersion = CURRENT_APP_VERSION,
  updateInfo = null,
  onLogout,
  onSyncAccount,
  isSyncingAccount = false,
  onNavigateSettings,
  onNavigateDownloads,
  onOpenDownloads,
  onGoToSavedArtists,
  onOpenUploadSong,
  onOpenManageAlbums,
  onOpenManageArtists,
  onOpenManageLyrics,
  onOpenManageGenres,
  onOpenManageSongs,
  onOpenManageCanvas,
  onUpdateProfile,
  showAboutModal,
  setShowAboutModal,
  onClose
}) {
  const [localShowAbout, setLocalShowAbout] = useState(false);
  const isAboutOpen = showAboutModal !== undefined ? showAboutModal : localShowAbout;
  const setAboutOpen = setShowAboutModal || setLocalShowAbout;

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhotoUrl, setEditPhotoUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [downloadedCount, setDownloadedCount] = useState(0);
  const [toastMessage, setToastMessage] = useState(null);

  // 🔄 Update States
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [updateModalData, setUpdateModalData] = useState(null);

  // 👑 Admin Publish Update States
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [pubVersion, setPubVersion] = useState('1.4.6');
  const [pubNotes, setPubNotes] = useState('Full Screen Edge-to-Edge, Android Back Button Navigation, and Download Center UI Polish!');
  const [pubUrl, setPubUrl] = useState('https://github.com');
  const [isPublishing, setIsPublishing] = useState(false);

  const displayToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  useEffect(() => {
    let count = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('offline_track_')) count++;
    }
    setDownloadedCount(count);
  }, []);

  if (!user) return null;

  const isHeadAdmin = ADMIN_EMAILS.includes((user.email || '').toLowerCase().trim());
  const savedArtistsCount = getSavedArtists(artists).length;
  const hasNewUpdate = updateInfo && updateInfo.version && isNewerVersion(updateInfo.version, currentVersion);

  const handleCopyEmail = async () => {
    if (!user.email) return;
    try {
      await navigator.clipboard.writeText(user.email);
      displayToast("Email copied to clipboard!");
    } catch {
      displayToast(user.email);
    }
  };

  const handleCheckUpdate = async () => {
    triggerHaptic();
    setIsCheckingUpdate(true);
    displayToast("Connecting to Firebase database...");
    try {
      const result = await fetchUpdateFromDatabase();
      if (result.success) {
        if (result.hasUpdate) {
          setUpdateModalData({
            hasUpdate: true,
            version: result.version,
            currentVersion,
            notes: result.notes,
            url: result.url,
            releaseDate: result.releaseDate,
            source: result.source
          });
          setShowUpdateModal(true);
          notifyAppUpdate(result.data);
        } else {
          setUpdateModalData({
            hasUpdate: false,
            version: result.version || currentVersion,
            currentVersion,
            notes: result.notes,
            source: result.source,
            isLatest: true
          });
          setShowUpdateModal(true);
        }
      } else {
        setUpdateModalData({
          hasUpdate: false,
          error: result.error || 'Failed to connect to Firebase database',
          currentVersion,
          source: 'Firebase Firestore (settings/appVersion)'
        });
        setShowUpdateModal(true);
      }
    } catch (err) {
      console.error("Check update failed:", err);
      displayToast("Error querying database for updates.");
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  const handlePublishUpdate = async (e) => {
    e?.preventDefault();
    if (!pubVersion.trim()) {
      alert("Please enter a version number (e.g., 1.3.1).");
      return;
    }
    setIsPublishing(true);
    try {
      await publishAppUpdateToDatabase({
        version: pubVersion.trim(),
        notes: pubNotes.trim(),
        url: pubUrl.trim()
      });
      displayToast(`Published v${pubVersion.trim()} to database!`);
      setShowPublishModal(false);
    } catch (err) {
      console.error("Failed to publish update:", err);
      alert("Failed to publish update: " + err.message);
    } finally {
      setIsPublishing(false);
    }
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
      displayToast("Profile updated successfully!");
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
        backgroundColor: '#05070c', zIndex: 600,
        padding: 'calc(env(safe-area-inset-top, 0px) + 20px) 20px calc(env(safe-area-inset-bottom, 0px) + 36px)',
        display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
        overflowY: 'auto',
        animation: 'slideUpSheet 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      <style>{profileDrawerStyles}</style>

      {/* 🌟 Ambient Backdrop Glow */}
      <div className="ambient-backdrop-glow" style={{ '--ambient-glow-color': 'rgba(29, 185, 84, 0.22)', top: '-25px' }}></div>

      {toastMessage && (
        <div style={{
          position: 'fixed', top: '24px', left: '20px', right: '20px', zIndex: 9999,
          backgroundColor: '#0d2218', border: '1px solid var(--accent)', borderRadius: '14px',
          padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.6)', animation: 'slideDownToast 0.25s ease'
        }}>
          <i className="fa-solid fa-circle-check" style={{ color: 'var(--accent)', fontSize: '1rem' }}></i>
          <span style={{ fontSize: '0.84rem', fontWeight: '600', color: '#ffffff' }}>{toastMessage}</span>
        </div>
      )}

      {/* Drawer Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', position: 'relative', zIndex: 1 }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: '#ffffff', letterSpacing: '-0.3px' }}>
          Account Profile
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button 
            onClick={() => {
              triggerHaptic(20);
              onNavigateSettings?.();
            }}
            className="pdv-icon-btn"
            aria-label="Settings"
            title="Settings & Preferences"
            style={{
              width: '38px', height: '38px', borderRadius: '50%',
              backgroundColor: 'rgba(29, 185, 84, 0.12)', border: '1px solid rgba(29, 185, 84, 0.3)',
              color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '0.95rem'
            }}
          >
            <i className="fa-solid fa-gear"></i>
          </button>
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
      </div>

      {/* User Info Hero Card */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '20px', position: 'relative', zIndex: 1 }}>
        <div style={{ position: 'relative', marginBottom: '14px' }}>
          <CachedImage 
            src={(isEditing ? editPhotoUrl : user.photoURL) || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150'} 
            alt="User Account" 
            style={{ width: '88px', height: '88px', borderRadius: '50%', border: '3px solid var(--accent)', objectFit: 'cover', boxShadow: '0 10px 28px rgba(0,0,0,0.6)' }}
            referrerPolicy="no-referrer"
          />
          {!isEditing && (
            <span style={{ position: 'absolute', bottom: '2px', right: '4px', width: '16px', height: '16px', backgroundColor: '#1db954', border: '3px solid #05070c', borderRadius: '50%' }}></span>
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '4px' }}>
              <h3 style={{ margin: 0, fontSize: '1.35rem', fontWeight: '800', color: '#ffffff', letterSpacing: '-0.3px' }}>
                {user.displayName || 'Sonara Streamer'}
              </h3>
              {isHeadAdmin && (
                <span style={{
                  backgroundColor: 'rgba(29, 185, 84, 0.15)', border: '1px solid rgba(29, 185, 84, 0.4)',
                  color: 'var(--accent)', padding: '2px 8px', borderRadius: '12px',
                  fontSize: '0.66rem', fontWeight: '800', letterSpacing: '0.5px', display: 'inline-flex', alignItems: 'center', gap: '4px'
                }}>
                  <i className="fa-solid fa-crown" style={{ fontSize: '0.62rem' }}></i> ADMIN
                </span>
              )}
            </div>
            <button
              onClick={handleCopyEmail}
              style={{
                background: 'none', border: 'none', padding: 0,
                fontSize: '0.82rem', color: 'rgba(255, 255, 255, 0.55)',
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px'
              }}
              title="Click to copy email"
            >
              <span>{user.email}</span>
              <i className="fa-regular fa-copy" style={{ fontSize: '0.74rem', opacity: 0.6 }}></i>
            </button>
          </>
        )}
      </div>

      {/* 🌟 Interactive Stats Strip */}
      <div className="profile-stats-row" style={{ position: 'relative', zIndex: 1 }}>
        <div 
          onClick={() => {
            triggerHaptic(20);
            (onOpenDownloads || onNavigateDownloads)?.();
          }}
          className="profile-stat-card"
          style={{ cursor: 'pointer' }}
          title="Open Downloaded Songs"
        >
          <div className="profile-stat-number" style={{ color: 'var(--accent)' }}>{downloadedCount}</div>
          <div className="profile-stat-label">Offline Tracks</div>
        </div>
        <div 
          onClick={() => {
            triggerHaptic(20);
            onGoToSavedArtists?.();
          }}
          className="profile-stat-card"
          style={{ cursor: 'pointer' }}
          title="Open Saved Artists"
        >
          <div className="profile-stat-number">{savedArtistsCount}</div>
          <div className="profile-stat-label">Saved Artists</div>
        </div>
        <div className="profile-stat-card">
          <div className="profile-stat-number">{playlists.length}</div>
          <div className="profile-stat-label">Playlists</div>
        </div>
      </div>

      {/* ⚙️ Direct Prominent Settings & Audio Controls Hero Card */}
      <div
        onClick={() => {
          triggerHaptic(20);
          onNavigateSettings?.();
        }}
        className="pdv-settings-hero-card"
        style={{
          marginBottom: '20px',
          background: 'linear-gradient(135deg, rgba(29, 185, 84, 0.1) 0%, rgba(13, 20, 32, 0.5) 100%)',
          border: '1px solid rgba(29, 185, 84, 0.3)',
          borderRadius: '18px',
          padding: '16px 18px',
          cursor: 'pointer',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '42px', height: '42px', borderRadius: '12px',
            backgroundColor: 'rgba(29, 185, 84, 0.2)', border: '1px solid rgba(29, 185, 84, 0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <i className="fa-solid fa-gear" style={{ color: 'var(--accent)', fontSize: '1.25rem' }}></i>
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '0.98rem', fontWeight: '800', color: '#ffffff' }}>
              Settings & Preferences
            </h4>
            <p style={{ margin: '2px 0 0', fontSize: '0.74rem', color: 'rgba(255, 255, 255, 0.65)' }}>
              Audio Quality, Origin Island, Equalizer, Themes
            </p>
          </div>
        </div>
        <div style={{
          width: '32px', height: '32px', borderRadius: '50%',
          backgroundColor: 'rgba(255, 255, 255, 0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <i className="fa-solid fa-chevron-right" style={{ color: 'var(--accent)', fontSize: '0.82rem' }}></i>
        </div>
      </div>

      {/* 🚀 Prominent Check for Updates Option in Profile */}
      <div 
        onClick={handleCheckUpdate}
        className="pdv-settings-hero-card"
        style={{
          marginBottom: '20px',
          background: hasNewUpdate 
            ? 'linear-gradient(135deg, rgba(29, 185, 84, 0.16) 0%, rgba(9, 13, 20, 0.75) 100%)'
            : 'linear-gradient(135deg, rgba(255, 255, 255, 0.04) 0%, rgba(9, 13, 20, 0.5) 100%)',
          borderRadius: '18px',
          border: hasNewUpdate ? '1px solid rgba(29, 185, 84, 0.4)' : '1px solid rgba(255, 255, 255, 0.08)',
          padding: '14px 18px', cursor: 'pointer',
          boxShadow: hasNewUpdate ? '0 8px 24px rgba(29, 185, 84, 0.2)' : '0 6px 20px rgba(0, 0, 0, 0.25)',
          position: 'relative', zIndex: 1,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '42px', height: '42px', borderRadius: '12px',
            backgroundColor: hasNewUpdate ? 'rgba(29, 185, 84, 0.22)' : 'rgba(255, 255, 255, 0.06)',
            border: hasNewUpdate ? '1px solid rgba(29, 185, 84, 0.45)' : '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <i className={`fa-solid ${isCheckingUpdate ? 'fa-spinner fa-spin' : 'fa-arrows-rotate'}`}
               style={{ color: 'var(--accent)', fontSize: '1.15rem' }}></i>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h4 style={{ margin: 0, fontSize: '0.96rem', fontWeight: '800', color: '#ffffff' }}>
                Check for Updates
              </h4>
              {hasNewUpdate ? (
                <span style={{ backgroundColor: 'var(--accent)', color: '#000000', fontSize: '0.64rem', fontWeight: '800', padding: '2px 8px', borderRadius: '10px' }}>
                  v{updateInfo?.version || 'NEW'} READY
                </span>
              ) : (
                <span style={{ backgroundColor: 'rgba(29, 185, 84, 0.12)', color: 'var(--accent)', fontSize: '0.64rem', fontWeight: '700', padding: '2px 8px', borderRadius: '10px' }}>
                  v{currentVersion}
                </span>
              )}
            </div>
            <p style={{ margin: '3px 0 0', fontSize: '0.74rem', color: 'rgba(255, 255, 255, 0.65)' }}>
              {isCheckingUpdate ? 'Connecting to Firebase database...' : hasNewUpdate ? 'New version available in database • Tap to update' : 'Live cloud database sync • Tap to check'}
            </p>
          </div>
        </div>
        <button
          style={{
            background: hasNewUpdate ? 'var(--accent)' : 'rgba(255, 255, 255, 0.08)',
            border: hasNewUpdate ? 'none' : '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '12px',
            color: hasNewUpdate ? '#000000' : '#ffffff',
            cursor: 'pointer', fontSize: '0.78rem', fontWeight: '700',
            padding: '7px 14px', flexShrink: 0
          }}
        >
          {isCheckingUpdate ? 'Checking...' : hasNewUpdate ? 'Update' : 'Check'}
        </button>
      </div>

      {/* 👑 Head Admin Control Studio Card */}
      {isHeadAdmin && (
        <div style={{
          marginBottom: '20px',
          background: 'linear-gradient(135deg, rgba(29, 185, 84, 0.08) 0%, rgba(9, 13, 20, 0.6) 100%)',
          padding: '16px 14px', borderRadius: '18px',
          border: '1px solid rgba(29, 185, 84, 0.22)',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
          position: 'relative', zIndex: 1
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', paddingLeft: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa-solid fa-crown" style={{ color: 'var(--accent)', fontSize: '0.9rem' }}></i>
              <span style={{ fontSize: '0.74rem', color: 'var(--accent)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                Head Admin Studio
              </span>
            </div>
            <span style={{ fontSize: '0.68rem', color: 'rgba(255, 255, 255, 0.4)', fontWeight: '600' }}>Master Controls</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button onClick={onOpenUploadSong} className="pdv-action-row" style={adminRowBtnStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={iconBoxStyle}>
                  <i className="fa-solid fa-cloud-arrow-up" style={{ color: 'var(--accent)', fontSize: '0.95rem' }}></i>
                </div>
                <span style={{ color: '#ffffff', fontWeight: '600', fontSize: '0.88rem' }}>Upload Song & Cover</span>
              </div>
              <i className="fa-solid fa-chevron-right" style={chevronStyle}></i>
            </button>

            <button onClick={onOpenManageAlbums} className="pdv-action-row" style={adminRowBtnStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={iconBoxStyle}>
                  <i className="fa-solid fa-compact-disc" style={{ color: 'var(--accent)', fontSize: '0.95rem' }}></i>
                </div>
                <span style={{ color: '#ffffff', fontWeight: '600', fontSize: '0.88rem' }}>Create & Assign Albums</span>
              </div>
              <i className="fa-solid fa-chevron-right" style={chevronStyle}></i>
            </button>

            <button onClick={onOpenManageArtists} className="pdv-action-row" style={adminRowBtnStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={iconBoxStyle}>
                  <i className="fa-solid fa-user-astronaut" style={{ color: 'var(--accent)', fontSize: '0.95rem' }}></i>
                </div>
                <span style={{ color: '#ffffff', fontWeight: '600', fontSize: '0.88rem' }}>Manage Artists</span>
              </div>
              <i className="fa-solid fa-chevron-right" style={chevronStyle}></i>
            </button>

            <button onClick={onOpenManageLyrics} className="pdv-action-row" style={adminRowBtnStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={iconBoxStyle}>
                  <i className="fa-solid fa-file-lines" style={{ color: 'var(--accent)', fontSize: '0.95rem' }}></i>
                </div>
                <span style={{ color: '#ffffff', fontWeight: '600', fontSize: '0.88rem' }}>Manage Lyrics</span>
              </div>
              <i className="fa-solid fa-chevron-right" style={chevronStyle}></i>
            </button>

            <button onClick={onOpenManageGenres} className="pdv-action-row" style={adminRowBtnStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={iconBoxStyle}>
                  <i className="fa-solid fa-tags" style={{ color: 'var(--accent)', fontSize: '0.95rem' }}></i>
                </div>
                <span style={{ color: '#ffffff', fontWeight: '600', fontSize: '0.88rem' }}>Manage Genres & Moods</span>
              </div>
              <i className="fa-solid fa-chevron-right" style={chevronStyle}></i>
            </button>

            <button onClick={onOpenManageCanvas} className="pdv-action-row" style={adminRowBtnStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={iconBoxStyle}>
                  <i className="fa-solid fa-video" style={{ color: 'var(--accent)', fontSize: '0.95rem' }}></i>
                </div>
                <span style={{ color: '#ffffff', fontWeight: '600', fontSize: '0.88rem' }}>Manage Canvas Videos</span>
              </div>
              <i className="fa-solid fa-chevron-right" style={chevronStyle}></i>
            </button>

            <button onClick={onOpenManageSongs} className="pdv-action-row" style={adminRowBtnStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={iconBoxStyle}>
                  <i className="fa-solid fa-trash-can" style={{ color: '#ff4d4d', fontSize: '0.95rem' }}></i>
                </div>
                <span style={{ color: '#ffffff', fontWeight: '600', fontSize: '0.88rem' }}>Delete Songs (Admin)</span>
              </div>
              <i className="fa-solid fa-chevron-right" style={chevronStyle}></i>
            </button>

            <button onClick={() => setShowPublishModal(true)} className="pdv-action-row" style={adminRowBtnStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={iconBoxStyle}>
                  <i className="fa-solid fa-cloud-arrow-up" style={{ color: 'var(--accent)', fontSize: '0.95rem' }}></i>
                </div>
                <span style={{ color: '#ffffff', fontWeight: '600', fontSize: '0.88rem' }}>Publish / Manage App Update</span>
              </div>
              <span style={{ fontSize: '0.65rem', backgroundColor: 'rgba(29, 185, 84, 0.2)', color: 'var(--accent)', padding: '2px 8px', borderRadius: '8px', fontWeight: '800' }}>
                DATABASE
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Storage & Offline Card */}
      <div 
        onClick={() => {
          triggerHaptic(20);
          (onOpenDownloads || onNavigateDownloads)?.();
        }}
        className="pdv-action-row"
        style={{
          marginBottom: '18px', backgroundColor: 'rgba(255, 255, 255, 0.02)',
          padding: '14px 16px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          cursor: 'pointer', transition: 'all 0.18s ease',
          position: 'relative', zIndex: 1
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', backgroundColor: 'rgba(29, 185, 84, 0.12)', border: '1px solid rgba(29, 185, 84, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="fa-solid fa-download" style={{ color: 'var(--accent)', fontSize: '1.05rem' }}></i>
          </div>
          <div>
            <p style={{ margin: '0 0 2px 0', fontSize: '0.88rem', color: '#ffffff', fontWeight: '700' }}>Downloaded Songs</p>
            <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-muted)' }}>{downloadedCount} {downloadedCount === 1 ? 'track' : 'tracks'} saved offline</p>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            triggerHaptic(20);
            (onOpenDownloads || onNavigateDownloads)?.();
          }}
          style={{ background: 'rgba(29, 185, 84, 0.12)', border: '1px solid rgba(29, 185, 84, 0.3)', borderRadius: '10px', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '700', padding: '6px 14px' }}
        >
          Manage
        </button>
      </div>

      {/* ℹ️ Dedicated About Sonara Hero Card (Replaces redundant Image 3 list) */}
      <div
        onClick={() => {
          triggerHaptic(20);
          setAboutOpen(true);
        }}
        className="pdv-settings-hero-card"
        style={{
          marginBottom: '20px',
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.04) 0%, rgba(13, 20, 32, 0.6) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '18px',
          padding: '14px 18px',
          cursor: 'pointer',
          boxShadow: '0 6px 20px rgba(0, 0, 0, 0.25)',
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'transform 0.15s, border-color 0.15s'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '42px', height: '42px', borderRadius: '12px',
            backgroundColor: 'rgba(29, 185, 84, 0.15)', border: '1px solid rgba(29, 185, 84, 0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <i className="fa-solid fa-circle-info" style={{ color: 'var(--accent)', fontSize: '1.2rem' }}></i>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h4 style={{ margin: 0, fontSize: '0.96rem', fontWeight: '800', color: '#ffffff' }}>
                About Sonara
              </h4>
              <span style={{ backgroundColor: 'rgba(29, 185, 84, 0.12)', color: 'var(--accent)', fontSize: '0.64rem', fontWeight: '700', padding: '2px 8px', borderRadius: '10px' }}>
                v{currentVersion}
              </span>
            </div>
            <p style={{ margin: '3px 0 0', fontSize: '0.74rem', color: 'rgba(255, 255, 255, 0.65)' }}>
              Cloud Music Streaming • Hi-Fi Lossless & Offline Vault
            </p>
          </div>
        </div>
        <div style={{
          width: '32px', height: '32px', borderRadius: '50%',
          backgroundColor: 'rgba(255, 255, 255, 0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <i className="fa-solid fa-chevron-right" style={{ color: 'var(--accent)', fontSize: '0.82rem' }}></i>
        </div>
      </div>

      {/* Audio Tier Quality Pill */}
      <div style={{
        marginBottom: '20px', backgroundColor: 'rgba(255, 255, 255, 0.02)',
        borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.06)',
        padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'relative', zIndex: 1
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <i className="fa-solid fa-sliders" style={{ color: 'var(--accent)', fontSize: '0.9rem' }}></i>
          <span style={{ fontSize: '0.8rem', color: '#ffffff', fontWeight: '600' }}>Streaming Engine</span>
        </div>
        <span style={{ fontSize: '0.74rem', color: 'var(--accent)', fontWeight: '700', letterSpacing: '0.4px' }}>Hi-Fi Lossless (320k)</span>
      </div>

      {/* 🔄 Sync Account Data Button */}
      {onSyncAccount && (
        <button 
          onClick={onSyncAccount}
          disabled={isSyncingAccount}
          style={{
            width: '100%', height: '48px', borderRadius: '14px', border: '1px solid rgba(29, 185, 84, 0.35)',
            backgroundColor: 'rgba(29, 185, 84, 0.08)', color: 'var(--accent)', fontWeight: '700', fontSize: '0.9rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: isSyncingAccount ? 'default' : 'pointer',
            flexShrink: 0, position: 'relative', zIndex: 1, marginBottom: '10px',
            transition: 'all 0.2s ease', opacity: isSyncingAccount ? 0.7 : 1
          }}
        >
          <i className={isSyncingAccount ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-arrows-rotate"}></i>
          <span>{isSyncingAccount ? 'Syncing Account Data...' : 'Sync Account Data'}</span>
        </button>
      )}

      {/* Sign Out Button */}
      <button 
        onClick={onLogout}
        className="pdv-signout-btn"
        style={{
          width: '100%', height: '48px', borderRadius: '14px', border: '1px solid rgba(255, 77, 77, 0.25)',
          backgroundColor: 'rgba(255, 77, 77, 0.08)', color: '#ff4d4d', fontWeight: '700', fontSize: '0.9rem',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer',
          flexShrink: 0, position: 'relative', zIndex: 1
        }}
      >
        <i className="fa-solid fa-arrow-right-from-bracket"></i>
        <span>Sign Out Account</span>
      </button>

      {/* 📱 App Version Down in Profile */}
      <div style={{
        marginTop: '26px',
        paddingBottom: '20px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        position: 'relative',
        zIndex: 1
      }}>
        <div
          onClick={handleCheckUpdate}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '24px',
            padding: '7px 18px',
            cursor: 'pointer',
            transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)'
          }}
          className="pdv-version-pill-btn"
          title="Tap to check for updates in database"
        >
          <span style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: hasNewUpdate ? '#f59e0b' : 'var(--accent)',
            boxShadow: `0 0 10px ${hasNewUpdate ? '#f59e0b' : 'var(--accent)'}`
          }}></span>
          <span style={{ fontSize: '0.84rem', fontWeight: '700', color: '#ffffff', letterSpacing: '0.4px' }}>
            Sonara v{currentVersion}
          </span>
          {hasNewUpdate ? (
            <span style={{
              backgroundColor: 'var(--accent)',
              color: '#000000',
              fontSize: '0.65rem',
              fontWeight: '800',
              padding: '2px 7px',
              borderRadius: '10px',
              marginLeft: '2px'
            }}>
              UPDATE READY
            </span>
          ) : (
            <span style={{
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              color: 'rgba(255, 255, 255, 0.6)',
              fontSize: '0.65rem',
              fontWeight: '700',
              padding: '2px 7px',
              borderRadius: '10px',
              marginLeft: '2px'
            }}>
              LATEST
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          <span>Build {CURRENT_APP_BUILD}</span>
          <span>•</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent)', opacity: 0.85 }}>
            <i className="fa-solid fa-database" style={{ fontSize: '0.65rem' }}></i> Cloud Database Synced
          </span>
        </div>
      </div>

      {/* 🚀 Update Status Modal (Triggered by Check for Updates) */}
      {showUpdateModal && updateModalData && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div style={{
            width: '100%', maxWidth: '380px', backgroundColor: '#0d131e',
            borderRadius: '24px', border: '1px solid rgba(255, 255, 255, 0.12)',
            padding: '24px 20px', boxShadow: '0 24px 60px rgba(0, 0, 0, 0.8)',
            display: 'flex', flexDirection: 'column', gap: '16px', position: 'relative'
          }}>
            {/* Header Icon */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{
                width: '52px', height: '52px', borderRadius: '16px',
                backgroundColor: updateModalData.hasUpdate ? 'rgba(29, 185, 84, 0.18)' : 'rgba(255, 255, 255, 0.08)',
                border: `1px solid ${updateModalData.hasUpdate ? 'rgba(29, 185, 84, 0.4)' : 'rgba(255, 255, 255, 0.12)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <i className={`fa-solid ${updateModalData.hasUpdate ? 'fa-cloud-arrow-down' : updateModalData.error ? 'fa-triangle-exclamation' : 'fa-circle-check'}`}
                   style={{ fontSize: '1.5rem', color: updateModalData.hasUpdate ? 'var(--accent)' : updateModalData.error ? '#f87171' : 'var(--accent)' }}></i>
              </div>
              <button
                onClick={() => setShowUpdateModal(false)}
                style={{ background: 'none', border: 'none', color: 'rgba(255, 255, 255, 0.5)', fontSize: '1.2rem', cursor: 'pointer', padding: '4px' }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Title & Database Origin */}
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(29, 185, 84, 0.12)', border: '1px solid rgba(29, 185, 84, 0.25)', borderRadius: '20px', padding: '3px 10px', marginBottom: '8px' }}>
                <i className="fa-solid fa-database" style={{ fontSize: '0.68rem', color: 'var(--accent)' }}></i>
                <span style={{ fontSize: '0.68rem', color: 'var(--accent)', fontWeight: '700' }}>
                  Cloud Database Check
                </span>
              </div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '1.2rem', fontWeight: '800', color: '#ffffff' }}>
                {updateModalData.hasUpdate
                  ? `New Version v${updateModalData.version} Available!`
                  : updateModalData.error
                  ? 'Database Check Failed'
                  : "You're on the Latest Version!"}
              </h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.65)', lineHeight: 1.4 }}>
                {updateModalData.hasUpdate
                  ? 'A newer version has been published to the cloud database.'
                  : updateModalData.error
                  ? updateModalData.error
                  : `Sonara v${currentVersion} matches the latest release in Firestore.`}
              </p>
            </div>

            {/* Version Comparison Box (if update available) */}
            {updateModalData.hasUpdate && (
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '16px', padding: '14px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-around'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: '0.68rem', color: 'rgba(255, 255, 255, 0.45)', textTransform: 'uppercase', fontWeight: '700' }}>Current</span>
                  <p style={{ margin: '3px 0 0 0', fontSize: '0.95rem', fontWeight: '700', color: '#ffffff' }}>v{currentVersion}</p>
                </div>
                <i className="fa-solid fa-arrow-right" style={{ color: 'var(--accent)', fontSize: '0.9rem' }}></i>
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: '0.68rem', color: 'var(--accent)', textTransform: 'uppercase', fontWeight: '800' }}>Latest in DB</span>
                  <p style={{ margin: '3px 0 0 0', fontSize: '1rem', fontWeight: '800', color: 'var(--accent)' }}>v{updateModalData.version}</p>
                </div>
              </div>
            )}

            {/* Release Notes */}
            {updateModalData.notes && (
              <div style={{
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                borderRadius: '14px', padding: '12px 14px',
                border: '1px solid rgba(255, 255, 255, 0.06)'
              }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--accent)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  What's New in Database:
                </span>
                <p style={{ margin: '6px 0 0 0', fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.85)', lineHeight: 1.45, maxHeight: '100px', overflowY: 'auto' }}>
                  {updateModalData.notes}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
              {updateModalData.hasUpdate ? (
                <>
                  <button
                    onClick={() => {
                      if (updateModalData.url) {
                        window.open(updateModalData.url, '_blank');
                      } else {
                        displayToast("No download link attached in database.");
                      }
                      setShowUpdateModal(false);
                    }}
                    style={{
                      flex: 1, height: '46px', borderRadius: '14px',
                      backgroundColor: 'var(--accent)', border: 'none',
                      color: '#000000', fontWeight: '800', fontSize: '0.88rem',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      gap: '8px', cursor: 'pointer', boxShadow: '0 8px 20px rgba(29, 185, 84, 0.3)'
                    }}
                  >
                    <i className="fa-solid fa-download"></i>
                    <span>Download APK</span>
                  </button>
                  <button
                    onClick={() => setShowUpdateModal(false)}
                    style={{
                      height: '46px', padding: '0 16px', borderRadius: '14px',
                      backgroundColor: 'rgba(255, 255, 255, 0.06)', border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#ffffff', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer'
                    }}
                  >
                    Later
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowUpdateModal(false)}
                  style={{
                    width: '100%', height: '46px', borderRadius: '14px',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#ffffff', fontWeight: '700', fontSize: '0.88rem', cursor: 'pointer'
                  }}
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 👑 Head Admin Publish Update Modal */}
      {showPublishModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <form onSubmit={handlePublishUpdate} style={{
            width: '100%', maxWidth: '390px', backgroundColor: '#0d131e',
            borderRadius: '24px', border: '1px solid rgba(29, 185, 84, 0.3)',
            padding: '24px 20px', boxShadow: '0 24px 60px rgba(0, 0, 0, 0.8)',
            display: 'flex', flexDirection: 'column', gap: '14px', position: 'relative'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-crown" style={{ color: 'var(--accent)' }}></i>
                <h3 style={{ margin: 0, fontSize: '1.05rem', color: '#ffffff', fontWeight: '800' }}>
                  Publish Update to Database
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPublishModal(false)}
                style={{ background: 'none', border: 'none', color: 'rgba(255, 255, 255, 0.5)', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <p style={{ margin: 0, fontSize: '0.78rem', color: 'rgba(255, 255, 255, 0.65)' }}>
              Saves release metadata directly to Firestore <code style={{ color: 'var(--accent)' }}>settings/appVersion</code>. All connected apps receive the live update notice immediately.
            </p>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', fontWeight: '700', marginBottom: '5px' }}>
                New Version (e.g. 1.3.1)
              </label>
              <input
                type="text"
                value={pubVersion}
                onChange={(e) => setPubVersion(e.target.value)}
                placeholder="1.3.1"
                style={inputStyle}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', fontWeight: '700', marginBottom: '5px' }}>
                Changelog / Release Notes
              </label>
              <textarea
                value={pubNotes}
                onChange={(e) => setPubNotes(e.target.value)}
                placeholder="List new features..."
                style={{ ...inputStyle, height: '70px', padding: '8px 12px', resize: 'none' }}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', fontWeight: '700', marginBottom: '5px' }}>
                APK / Release Download URL
              </label>
              <input
                type="url"
                value={pubUrl}
                onChange={(e) => setPubUrl(e.target.value)}
                placeholder="https://..."
                style={inputStyle}
                required
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
              <button
                type="submit"
                disabled={isPublishing}
                style={{
                  flex: 1, height: '46px', borderRadius: '14px',
                  backgroundColor: 'var(--accent)', border: 'none',
                  color: '#000000', fontWeight: '800', fontSize: '0.88rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: '8px', cursor: 'pointer'
                }}
              >
                <i className={`fa-solid ${isPublishing ? 'fa-spinner fa-spin' : 'fa-cloud-arrow-up'}`}></i>
                <span>{isPublishing ? 'Publishing...' : 'Save & Publish to DB'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowPublishModal(false)}
                style={{
                  height: '46px', padding: '0 16px', borderRadius: '14px',
                  backgroundColor: 'rgba(255, 255, 255, 0.06)', border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: '#ffffff', fontWeight: '600', fontSize: '0.85rem', cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 🌟 Rich About Sonara Modal */}
      {isAboutOpen && (
        <div 
          onClick={() => setAboutOpen(false)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: '20px',
            animation: 'fadeInModal 0.22s ease'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#0c1322', border: '1px solid rgba(29, 185, 84, 0.35)',
              borderRadius: '24px', width: '100%', maxWidth: '420px',
              maxHeight: '90vh', overflowY: 'auto',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.85), 0 0 30px rgba(29, 185, 84, 0.15)',
              padding: '24px 22px', position: 'relative',
              display: 'flex', flexDirection: 'column', gap: '16px',
              animation: 'slideUpModal 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            {/* Top Close Button */}
            <button
              onClick={() => setAboutOpen(false)}
              style={{
                position: 'absolute', top: '16px', right: '16px',
                width: '34px', height: '34px', borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.08)', border: 'none',
                color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', fontSize: '0.9rem'
              }}
            >
              <i className="fa-solid fa-xmark"></i>
            </button>

            {/* Logo & Identity */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', paddingTop: '8px' }}>
              <div style={{
                width: '74px', height: '74px', borderRadius: '22px',
                backgroundColor: 'rgba(29, 185, 84, 0.12)', border: '1.5px solid rgba(29, 185, 84, 0.4)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 10px 28px rgba(29, 185, 84, 0.25)', marginBottom: '12px'
              }}>
                <img src={logo} alt="Sonara" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.45rem', fontWeight: '900', color: '#ffffff', letterSpacing: '-0.4px' }}>
                Sonara Music
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                <span style={{ backgroundColor: 'var(--accent)', color: '#000000', fontSize: '0.68rem', fontWeight: '800', padding: '3px 10px', borderRadius: '12px' }}>
                  v{currentVersion}
                </span>
                <span style={{ backgroundColor: 'rgba(255, 255, 255, 0.08)', color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.68rem', fontWeight: '700', padding: '3px 10px', borderRadius: '12px' }}>
                  Build {CURRENT_APP_BUILD}
                </span>
              </div>
              <p style={{ margin: '10px 0 0', fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.45, maxWidth: '340px' }}>
                Next-generation cloud audio streaming player featuring lossless Hi-Fi audio, intelligent offline caching, and responsive acoustic customization.
              </p>
            </div>

            {/* Feature Highlights Grid */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px',
              backgroundColor: 'rgba(255, 255, 255, 0.02)', padding: '12px',
              borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.06)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fa-solid fa-bolt" style={{ color: 'var(--accent)', fontSize: '1rem', width: '20px', textAlign: 'center' }}></i>
                <div>
                  <div style={{ fontSize: '0.76rem', fontWeight: '700', color: '#ffffff' }}>Lossless 320k</div>
                  <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>Hi-Fi dynamic stream</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fa-solid fa-cloud-arrow-down" style={{ color: 'var(--accent)', fontSize: '1rem', width: '20px', textAlign: 'center' }}></i>
                <div>
                  <div style={{ fontSize: '0.76rem', fontWeight: '700', color: '#ffffff' }}>Offline Vault</div>
                  <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>Zero-data playback</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fa-solid fa-sliders" style={{ color: 'var(--accent)', fontSize: '1rem', width: '20px', textAlign: 'center' }}></i>
                <div>
                  <div style={{ fontSize: '0.76rem', fontWeight: '700', color: '#ffffff' }}>Studio EQ</div>
                  <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>10-Band + Off mode</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <i className="fa-solid fa-palette" style={{ color: 'var(--accent)', fontSize: '1rem', width: '20px', textAlign: 'center' }}></i>
                <div>
                  <div style={{ fontSize: '0.76rem', fontWeight: '700', color: '#ffffff' }}>6 Themes</div>
                  <div style={{ fontSize: '0.66rem', color: 'var(--text-muted)' }}>Cyber & Light styles</div>
                </div>
              </div>
            </div>

            {/* System Info Strip */}
            <div style={{
              backgroundColor: 'rgba(29, 185, 84, 0.06)', border: '1px solid rgba(29, 185, 84, 0.2)',
              borderRadius: '14px', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <span style={{ fontSize: '0.74rem', color: 'rgba(255, 255, 255, 0.8)', fontWeight: '600' }}>Cloud Database Sync</span>
              <span style={{ fontSize: '0.74rem', color: 'var(--accent)', fontWeight: '800' }}>Active & Connected</span>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
              <button
                onClick={() => {
                  setAboutOpen(false);
                  handleCheckUpdate();
                }}
                style={{
                  flex: 1, height: '44px', borderRadius: '12px',
                  backgroundColor: 'rgba(29, 185, 84, 0.15)', border: '1px solid rgba(29, 185, 84, 0.35)',
                  color: 'var(--accent)', fontWeight: '700', fontSize: '0.82rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer'
                }}
              >
                <i className="fa-solid fa-arrows-rotate"></i>
                <span>Check for Updates</span>
              </button>
              <button
                onClick={() => setAboutOpen(false)}
                style={{
                  flex: 1, height: '44px', borderRadius: '12px',
                  backgroundColor: 'var(--accent)', border: 'none',
                  color: '#000000', fontWeight: '800', fontSize: '0.84rem', cursor: 'pointer'
                }}
              >
                Done
              </button>
            </div>

            <div style={{ textAlign: 'center', fontSize: '0.68rem', color: 'rgba(255, 255, 255, 0.4)', marginTop: '2px' }}>
              © 2026 Sonara Music Platform. All rights reserved.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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
  @keyframes fadeInModal {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes slideUpModal {
    from { transform: translateY(24px) scale(0.96); opacity: 0; }
    to { transform: translateY(0) scale(1); opacity: 1; }
  }

  .pdv-hide-scrollbar::-webkit-scrollbar { display: none; }
  .pdv-hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

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

  .pdv-list-row:hover { background-color: rgba(255, 255, 255, 0.04) !important; }

  .pdv-signout-btn { transition: background-color 0.2s, transform 0.15s; }
  .pdv-signout-btn:hover {
    background-color: rgba(255, 77, 77, 0.16) !important;
    border-color: rgba(255, 77, 77, 0.4) !important;
    transform: translateY(-1px);
  }
  .pdv-signout-btn:active { transform: scale(0.98); }
`;