import React from 'react';

export default function ArtistRow({ title, artists, onSelectArtist }) {
  return (
    <section className="content-section">
      <h2>{title}</h2>
      <div className="horizontal-scroll">
        {artists.map((artist) => (
          <div
            key={artist.id}
            className="artist-card"
            onClick={() => onSelectArtist && onSelectArtist(artist)}
            style={{ cursor: onSelectArtist ? 'pointer' : 'default' }}
          >
            {/* Fixed field name from artist.imageUrl to artist.image to match your database */}
            <img src={artist.image} alt={artist.name} className="circle-img" />
            <p>{artist.name}</p>
          </div>
        ))}
      </div>
    </section>
  );
}