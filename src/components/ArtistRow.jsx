import React from 'react';

export default function ArtistRow({ title, artists, onSelectArtist, onSeeAll }) {
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
        {artists.map((artist) => (
          <div
            key={artist.id}
            className="artist-card"
            onClick={() => onSelectArtist && onSelectArtist(artist)}
            style={{ cursor: onSelectArtist ? 'pointer' : 'default' }}
          >
            <img src={artist.image} alt={artist.name} className="circle-img" />
            <p>{artist.name}</p>
          </div>
        ))}
      </div>
    </section>
  );
}