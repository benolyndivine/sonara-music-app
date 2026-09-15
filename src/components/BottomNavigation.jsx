import React from 'react';

export default function BottomNavigation({ currentView, onViewChange, isOnline = true }) {
  const handleClick = (view, blockedOffline) => {
    if (blockedOffline && !isOnline) return; // 🚫 Home & Search are unreachable while offline
    onViewChange(view);
  };

  return (
    <nav className="bottom-nav">
      {/* Home Button */}
      <button 
        className={`nav-item ${currentView === 'home' ? 'active' : ''} ${!isOnline ? 'nav-item-offline' : ''}`} 
        onClick={() => handleClick('home', true)}
        title={!isOnline ? 'Unavailable offline' : undefined}
      >
        <span className="nav-icon">
          <i className="fa-solid fa-house"></i>
        </span>
        <span>Home</span>
      </button>

      {/* Search Button */}
      <button 
        className={`nav-item ${currentView === 'search' ? 'active' : ''} ${!isOnline ? 'nav-item-offline' : ''}`} 
        onClick={() => handleClick('search', true)}
        title={!isOnline ? 'Unavailable offline' : undefined}
      >
        <span className="nav-icon">
          <i className="fa-solid fa-magnifying-glass"></i>
        </span>
        <span>Search</span>
      </button>

      {/* Library Button — always reachable, offline shows Downloaded tab only */}
      <button 
        className={`nav-item ${currentView === 'library' ? 'active' : ''}`} 
        onClick={() => handleClick('library', false)}
      >
        <span className="nav-icon">
          <i className="fa-solid fa-music"></i>
        </span>
        <span>Your Library</span>
      </button>
    </nav>
  );
}