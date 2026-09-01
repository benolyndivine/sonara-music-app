import React from 'react';

export default function AllArtistsView({ artists, onSelectArtist, onBack }) {
  return (
    <div className="mobile-content">
      <div className="view-header">
        <button className="back-arrow-btn" onClick={onBack} title="Back to Home">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
        </button>
        <h2 className="view-title">Popular Artists</h2>
      </div>

      <div 
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '20px 12px',
          paddingBottom: '40px',
          textAlign: 'center'
        }}
      >
        {artists.map((artist) => (
          <div 
            key={artist.id} 
            onClick={() => onSelectArtist && onSelectArtist(artist)}
            style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
          >
            <div style={{ width: '84px', height: '84px', borderRadius: '50%', overflow: 'hidden', marginBottom: '8px', boxShadow: '0 8px 20px rgba(0,0,0,0.4)', backgroundColor: 'var(--accent)' }}>
              {artist.image ? (
                <img src={artist.image} alt={artist.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: '700', fontSize: '1.4rem' }}>
                  {(artist.name || '?').charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <h3 style={{ fontSize: '0.8rem', fontWeight: '600', margin: 0, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
              {artist.name}
            </h3>
          </div>
        ))}
      </div>
    </div>
  );
}