import React, { useState } from 'react';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';

export default function ManageSongsAdminView({ songs = [], onBack, onSongDeleted }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  const filteredSongs = songs.filter(s => 
    (s.title || s.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.artist || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDeleteSong = async (song) => {
    const songTitle = song.title || song.name || 'Untitled track';
    const confirmDelete = window.confirm(`Are you sure you want to permanently delete "${songTitle}" by ${song.artist || 'Unknown'} from the database?`);
    if (!confirmDelete) return;

    setDeletingId(song.id);
    try {
      await deleteDoc(doc(db, 'songs', song.id));
      onSongDeleted?.(song.id);
      alert(`"${songTitle}" has been successfully deleted.`);
    } catch (err) {
      console.error("Failed to delete song:", err);
      alert("Failed to delete song. Check your permissions.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div 
      className="msa-hide-scrollbar"
      style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: '#05070c', zIndex: 650, padding: '24px 20px 48px',
        display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
        overflowY: 'auto',
        animation: 'slideUpSheet 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      <style>{adminViewStyles}</style>

      {/* Header Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <button
          onClick={onBack}
          style={{
            width: '40px', height: '40px', borderRadius: '50%',
            backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.08)',
            color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
          }}
        >
          <i className="fa-solid fa-chevron-left"></i>
        </button>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800', color: '#ffffff' }}>Delete Songs</h2>
          <span style={{ fontSize: '0.7rem', color: '#ff4d4d', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            Admin Control Panel
          </span>
        </div>
        <div style={{ width: '40px' }}></div>
      </div>

      {/* Search Bar */}
      <div style={{ marginBottom: '18px', position: 'relative' }}>
        <input
          type="text"
          placeholder="Search song or artist to delete..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%', height: '44px', backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px',
            padding: '0 14px 0 38px', color: '#ffffff', outline: 'none', boxSizing: 'border-box',
            fontSize: '0.88rem'
          }}
        />
        <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--text-muted)', fontSize: '0.85rem' }}></i>
      </div>

      {/* Songs List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {filteredSongs.length > 0 ? (
          filteredSongs.map((song) => {
            const songTitle = song.title || song.name || 'Untitled';
            const songImg = song.cover || song.image || song.imageUrl || song.coverUrl;
            const isDeleting = deletingId === song.id;

            return (
              <div
                key={song.id}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: '14px',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                  {songImg ? (
                    <img src={songImg} alt={songTitle} style={{ width: '42px', height: '42px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: '42px', height: '42px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <i className="fa-solid fa-music" style={{ color: 'var(--accent)' }}></i>
                    </div>
                  )}
                  <div style={{ minWidth: 0, overflow: 'hidden' }}>
                    <h4 style={{ margin: '0 0 2px 0', fontSize: '0.9rem', fontWeight: '700', color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {songTitle}
                    </h4>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {song.artist || 'Unknown Artist'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteSong(song)}
                  disabled={isDeleting}
                  style={{
                    backgroundColor: 'rgba(255, 77, 77, 0.1)',
                    border: '1px solid rgba(255, 77, 77, 0.3)',
                    color: '#ff4d4d',
                    borderRadius: '10px',
                    padding: '8px 12px',
                    fontSize: '0.78rem',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    flexShrink: 0,
                    transition: 'background-color 0.2s'
                  }}
                >
                  {isDeleting ? (
                    <i className="fa-solid fa-spinner fa-spin"></i>
                  ) : (
                    <>
                      <i className="fa-solid fa-trash-can"></i>
                      <span>Delete</span>
                    </>
                  )}
                </button>
              </div>
            );
          })
        ) : (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <p style={{ margin: 0, fontSize: '0.88rem' }}>No songs found matching your search.</p>
          </div>
        )}
      </div>
    </div>
  );
}

const adminViewStyles = `
  .msa-hide-scrollbar::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
  .msa-hide-scrollbar { -ms-overflow-style: none !important; scrollbar-width: none !important; }
  @keyframes slideUpSheet {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
`;