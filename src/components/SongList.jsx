import React, { useEffect, useState } from 'react';
import { db } from '../firebaseConfig';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';

export default function SongList({ onSelectSong }) {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen for real-time updates ordered by newest first
    const q = query(collection(db, 'songs'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const songData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setSongs(songData);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching songs:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) return <p>Loading catalog...</p>;
  if (songs.length === 0) return <p>No songs uploaded yet.</p>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
      {songs.map((song) => (
        <div 
          key={song.id} 
          onClick={() => onSelectSong(song)}
          style={{ cursor: 'pointer', border: '1px solid #ddd', borderRadius: 8, padding: 12, textAlign: 'center' }}
        >
          <img 
            src={song.coverUrl} 
            alt={song.title} 
            style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 6 }} 
          />
          <h4 style={{ margin: '8px 0 4px' }}>{song.title}</h4>
          <p style={{ margin: 0, fontSize: 14, color: '#666' }}>{song.artist}</p>
          {song.album && <p style={{ margin: 0, fontSize: 12, color: '#999' }}>{song.album}</p>}
        </div>
      ))}
    </div>
  );
}