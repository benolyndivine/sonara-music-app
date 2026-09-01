import React from 'react';

export default function SongRow({ title, songs, onSelectTrack, onSeeAll }) {
  return (
    <section className="content-section">
      <div className="section-header-container">
        <h2>{title}</h2>
        {onSeeAll && (
          <button className="see-all-action-btn" onClick={onSeeAll}>
            See all
          </button>
        )}
      </div>

      <div className="horizontal-scroll">
        {songs.map((song) => {
          {/* Fallback chain: prioritizes '.cover' from your Firestore fields, then checks fallback names */}
          const songImgSrc = song.cover || song.image || song.imageUrl;
          const songTitle = song.title || song.name;

          return (
            <div 
              key={song.id} 
              className="song-card" 
              onClick={() => onSelectTrack(song)}
            >
              <div className="img-container">
                <img 
                  src={songImgSrc} 
                  alt={songTitle} 
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.parentNode.style.backgroundColor = '#1a2436';
                  }}
                />
                <button 
                  className="play-overlay" 
                  title="Play track"
                  onClick={(e) => {
                    e.stopPropagation(); // Stops double click trigger on card row wrapper
                    onSelectTrack(song);
                  }}
                >
                  <svg className="play-icon-svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                  </svg>
                </button>
              </div>
              <h3>{songTitle}</h3>
              <p>{song.artist}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}