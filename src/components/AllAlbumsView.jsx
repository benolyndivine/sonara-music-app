import React from 'react';

export default function AllAlbumsView({ albums, onSelectAlbum, onBack }) {
  return (
    <div className="mobile-content">
      {/* Title Header Row */}
      <div className="view-header">
        <button className="back-arrow-btn" onClick={onBack} title="Back to Home">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
        </button>
        <h2 className="view-title">Popular Albums</h2>
      </div>

      {/* Grid view of all system albums */}
      <div 
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '16px',
          paddingBottom: '40px'
        }}
      >
        {albums.map((album) => (
          <div 
            key={album.id} 
            onClick={() => onSelectAlbum && onSelectAlbum(album)}
            style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column' }}
          >
            {/* 🛠️ FIXED: Standardized image layout container with a strict 1/1 square aspect lock */}
            <div 
              style={{ 
                width: '100%', 
                aspectRatio: '1 / 1', 
                borderRadius: '12px', 
                overflow: 'hidden',
                backgroundColor: '#161d2a',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)'
              }}
            >
              <img 
                src={album.image} 
                alt={album.name} 
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'cover' // Gracefully crops and scales image files inside the square boundary
                }} 
              />
            </div>
            <h3 style={{ fontSize: '0.9rem', fontWeight: '600', margin: '10px 0 2px 0', color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {album.name}
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {album.artist}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}