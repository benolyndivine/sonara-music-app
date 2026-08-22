import React, { useState } from 'react';
import logo from '../assets/logo3.png';

export default function Header({ user, onOpenProfile, onViewChange, onOpenNotifications, onOpenDownloads, hasUnreadNotifications = false }) {
  const [imageError, setImageError] = useState(false);

  const userInitial = user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U';

  const getCleanGooglePhotoURL = (url) => {
    if (!url) return null;
    return url.includes('=s96-c') ? url.replace('=s96-c', '=s400-c') : url;
  };

  const finalPhotoUrl = getCleanGooglePhotoURL(user?.photoURL);

  return (
    <header className="mobile-header">
      <div className="brand">
        <img src={logo} alt="Sonara Logo" className="header-logo-img" />
        <h1 className="brand-title">Sonara</h1>
      </div>
      
      <div className="header-actions">
        {/* Search trigger button in header with autoFocus = true */}
        <button 
          className="header-search-btn" 
          title="Search Music"
          onClick={() => onViewChange && onViewChange('search', true)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </button>

        {/* 📥 Download Center Header Trigger */}
        <button 
          className="header-search-btn" 
          title="Download Center"
          onClick={onOpenDownloads}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
        </button>

        {/* 🔔 Notification trigger button */}
        <button 
          className="header-search-btn" 
          title="Notifications"
          onClick={onOpenNotifications}
          style={{ position: 'relative' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
          </svg>
          {hasUnreadNotifications && (
            <span style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              width: '8px',
              height: '8px',
              backgroundColor: 'var(--accent)',
              borderRadius: '50%'
            }}></span>
          )}
        </button>

        {/* Profile Avatar System */}
        <div className="profile-badge-wrapper">
          <button 
            onClick={onOpenProfile}
            title="View Profile Details"
            className="header-profile-btn"
          >
            {finalPhotoUrl && !imageError ? (
              <img 
                src={finalPhotoUrl} 
                alt="Profile" 
                className="header-profile-img"
                referrerPolicy="no-referrer"
                onError={() => setImageError(true)} 
              />
            ) : (
              <div className="header-profile-fallback">
                {userInitial}
              </div>
            )}
          </button>
          <span style={{
            position: 'absolute', bottom: '-1px', right: '-1px',
            width: '12px', height: '12px', backgroundColor: '#1db954',
            border: '2px solid #05070c', borderRadius: '50%', zIndex: 5
          }}></span>
        </div>
      </div>
    </header>
  );
}