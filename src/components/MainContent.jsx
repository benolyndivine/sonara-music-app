import React from 'react';

export default function MainContent({ songs, onSeeAll }) {
  return (
    <div className="mobile-content">
      {/* Popular Songs Section Wrapper */}
      <section className="content-section">
        <div className="section-header-container">
          <h2>Popular Songs</h2>
          <button 
            className="see-all-action-btn" 
            onClick={() => onSeeAll('popular-songs')}
          >
            See all
          </button>
        </div>

        <div className="horizontal-scroll">
          {songs.map((song) => (
            <div key={song.id} className="song-card">
              <div className="img-container">
                <img src={song.image} alt={song.name} />
                <button className="play-overlay" title="Play track">
                  <svg className="play-icon-svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                  </svg>
                </button>
              </div>
              <h3>{song.name}</h3>
              <p>{song.artist}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}