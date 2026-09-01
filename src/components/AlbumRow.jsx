import React from 'react';

export default function AlbumRow({ title, albums, onSelectAlbum }) {
  return (
    <section className="content-section" style={{ marginTop: '24px' }}>
      <div className="section-header-container">
        <h2>{title}</h2>
      </div>

      <div className="horizontal-scroll">
        {albums.map((album) => {
          const albumImgSrc = album.image || album.cover || 'https://placehold.co/140x140/121824/ffffff?text=Album';
          
          return (
            <div 
              key={album.id} 
              className="song-card" 
              onClick={() => onSelectAlbum && onSelectAlbum(album)}
              style={{ cursor: 'pointer' }}
            >
              <div className="img-container">
                <img src={albumImgSrc} alt={album.name} />
                <button className="play-overlay" title="View album">
                  <svg className="play-icon-svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                  </svg>
                </button>
              </div>
              <h3>{album.name}</h3>
              <p>{album.artist}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}