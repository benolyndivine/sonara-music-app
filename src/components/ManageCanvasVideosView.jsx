import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { uploadToCloudinary } from '../utils/cloudinaryService';

export default function ManageCanvasVideosView({ songs = [], onBack, onSongUpdated }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' or 'completed'
  const [uploadingSongId, setUploadingSongId] = useState(null);

  const filteredSongs = songs.filter(s => {
    const query = searchTerm.trim().toLowerCase();
    const titleMatch = (s.title || s.name || '').toLowerCase().includes(query);
    const artistMatch = (s.artist || '').toLowerCase().includes(query);
    const searchMatch = query === '' || titleMatch || artistMatch;
    const hasCanvas = !!s.canvasVideoUrl;

    if (activeTab === 'completed') return searchMatch && hasCanvas;
    return searchMatch && !hasCanvas;
  });

  const handleFileUpload = async (e, song) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingSongId(song.id);
    try {
      const videoUrl = await uploadToCloudinary(file, 'video');
      const songRef = doc(db, 'songs', song.id);
      
      const updatedData = {
        canvasVideoUrl: videoUrl,
        canvasStatus: 'completed'
      };

      await updateDoc(songRef, updatedData);
      onSongUpdated?.({ ...song, ...updatedData });
      alert("Canvas video uploaded successfully!");
    } catch (err) {
      console.error(err);
      alert("Failed to upload canvas video.");
    } finally {
      setUploadingSongId(null);
    }
  };

  return (
    <div 
      className="mcv-hide-scrollbar"
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
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
          <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800', color: '#ffffff' }}>Canvas Videos</h2>
          <span style={{ fontSize: '0.7rem', color: 'var(--accent)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            Cloudinary Sync Studio
          </span>
        </div>
        <div style={{ width: '40px' }}></div>
      </div>

      {/* Tabs (Pending vs Completed) */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '18px' }}>
        <button
          onClick={() => setActiveTab('pending')}
          style={{
            flex: 1, height: '38px', borderRadius: '10px', border: 'none',
            backgroundColor: activeTab === 'pending' ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
            color: activeTab === 'pending' ? '#000000' : '#ffffff', fontWeight: '700', fontSize: '0.82rem',
            cursor: 'pointer'
          }}
        >
          Pending
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          style={{
            flex: 1, height: '38px', borderRadius: '10px', border: 'none',
            backgroundColor: activeTab === 'completed' ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
            color: activeTab === 'completed' ? '#000000' : '#ffffff', fontWeight: '700', fontSize: '0.82rem',
            cursor: 'pointer'
          }}
        >
          Completed
        </button>
      </div>

      {/* Search Filter */}
      <div style={{ marginBottom: '16px', position: 'relative' }}>
        <input
          type="text"
          placeholder="Search tracks..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            width: '100%', height: '42px', backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px',
            padding: '0 14px 0 38px', color: '#ffffff', outline: 'none', boxSizing: 'border-box',
            fontSize: '0.85rem'
          }}
        />
        <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: '14px', top: '14px', color: 'var(--text-muted)', fontSize: '0.85rem' }}></i>
      </div>

      {/* Songs List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {filteredSongs.length > 0 ? (
          filteredSongs.map((song) => {
            const songTitle = song.title || song.name || 'Untitled';
            const songImg = song.cover || song.image || song.imageUrl;
            const isUploading = uploadingSongId === song.id;

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
                    <img src={songImg} alt="" style={{ width: '42px', height: '42px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} />
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
                      {song.artist || 'Unknown'}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <label
                    style={{
                      backgroundColor: 'rgba(29, 185, 84, 0.15)',
                      border: '1px solid var(--accent)',
                      color: 'var(--accent)',
                      borderRadius: '10px',
                      padding: '7px 12px',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      cursor: isUploading ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    {isUploading ? (
                      <i className="fa-solid fa-spinner fa-spin"></i>
                    ) : (
                      <>
                        <i className="fa-solid fa-video"></i>
                        <span>{song.canvasVideoUrl ? 'Replace' : 'Upload Canvas'}</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="video/*"
                      onChange={(e) => handleFileUpload(e, song)}
                      style={{ display: 'none' }}
                      disabled={isUploading}
                    />
                  </label>
                </div>
              </div>
            );
          })
        ) : (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <p style={{ margin: 0, fontSize: '0.85rem' }}>No songs found in this tab.</p>
          </div>
        )}
      </div>
    </div>
  );
}

const adminViewStyles = `
  .mcv-hide-scrollbar::-webkit-scrollbar { display: none !important; width: 0 !important; height: 0 !important; }
  .mcv-hide-scrollbar { -ms-overflow-style: none !important; scrollbar-width: none !important; }
  @keyframes slideUpSheet {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
`;