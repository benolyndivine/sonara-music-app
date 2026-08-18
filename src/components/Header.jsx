import React, { useState } from 'react';
import logo from '../assets/logo3.png';

export default function Header({ user, onOpenProfile, onViewChange }) {
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
        {/* Search trigger navbar button */}
        <button 
          className="header-search-btn" 
          title="Search Music"
          onClick={() => onViewChange && onViewChange('search')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </button>

        {/* Profile Avatar System */}
        <div className="profile-badge-wrapper">
          <button 
            onClick={onOpenProfile} /* 🔌 Redirected handler task target link */
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