import React, { useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export default function ManageLyricsView({ songs = [], lyrics = [], onBack, onLyricsSaved }) {
  const [activeTab, setActiveTab] = useState('pending');
  const [search, setSearch] = useState('');
  const [selectedSong, setSelectedSong] = useState(null);
  const [lyricsText, setLyricsText] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  const lyricsMap = new Map();
  lyrics.forEach((l) => {
    const key = (l.id || l.title || '').trim().toLowerCase();
    lyricsMap.set(key, l.text || '');
  });

  const pendingSongs = songs.filter((s) => {
    const key = (s.title || s.name || s.id || '').trim().toLowerCase();
    return !lyricsMap.has(key) || !lyricsMap.get(key);
  });

  const completedSongs = songs.filter((s) => {
    const key = (s.title || s.name || s.id || '').trim().toLowerCase();
    return lyricsMap.has(key) && lyricsMap.get(key);
  });

  const activeList = activeTab === 'pending' ? pendingSongs : completedSongs;
  const filteredList = activeList.filter((s) =>
    (s.title || s.name || s.id || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.artist || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleSelectSong = (song) => {
    setSelectedSong(song);
    const key = (song.title || song.name || song.id || '').trim().toLowerCase();
    setLyricsText(lyricsMap.get(key) || '');
    setStatus('');
  };

  const handleSaveLyrics = async (e) => {
    e.preventDefault();
    if (!selectedSong) return;

    const docKey = (selectedSong.title || selectedSong.name || selectedSong.id || '').trim();
    if (!docKey) return;

    setSaving(true);
    setStatus('Saving lyrics to Firebase...');

    try {
      await setDoc(doc(db, 'lyrics', docKey), {
        text: lyricsText.trim(),
      });

      setStatus('Lyrics updated successfully!');
      onLyricsSaved?.({ id: docKey, text: lyricsText.trim() });
      setTimeout(() => {
        setStatus('');
        setSelectedSong(null);
      }, 1500);
    } catch (err) {
      console.error(err);
      setStatus(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="mlv-hide-scrollbar"
      style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: '#05070c', zIndex: 650, padding: '24px 20px 48px',
        display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflowY: 'auto',
        animation: 'slideUpSheet 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      <style>{manageLyricsStyles}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <button onClick={selectedSong ? () => setSelectedSong(null) : onBack} style={iconBtnStyle}>
          <i className="fa-solid fa-chevron-left"></i>
        </button>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800', color: '#fff' }}>
            {selectedSong ? 'Edit Lyrics' : 'Lyrics Manager'}
          </h2>
          <span style={{ fontSize: '0.72rem', color: 'var(--accent)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            {selectedSong ? (selectedSong.title || selectedSong.id) : 'Admin Studio'}
          </span>
        </div>
        <div style={{ width: 40 }}></div>
      </div>

      {selectedSong ? (
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <img
              src={selectedSong.cover || 'https://placehold.co/100'}
              alt=""
              style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }}
            />
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', color: '#fff' }}>{selectedSong.title || selectedSong.id}</h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{selectedSong.artist}</p>
            </div>
          </div>

          <form onSubmit={handleSaveLyrics} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={labelStyle}>Lyrics Lines</label>
            <textarea
              rows={12}
              className="mlv-hide-scrollbar"
              placeholder="Paste lyrics lines here..."
              value={lyricsText}
              onChange={(e) => setLyricsText(e.target.value)}
              required
              style={{
                width: '100%', backgroundColor: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '12px',
                color: '#fff', outline: 'none', boxSizing: 'border-box', fontSize: '0.85rem',
                fontFamily: 'inherit', resize: 'none'
              }}
            />

            {status && (
              <p style={{ margin: 0, fontSize: '0.8rem', color: status.startsWith('Error') ? '#ff4d4d' : 'var(--accent)' }}>
                {status}
              </p>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => setSelectedSong(null)}
                style={{ flex: 1, padding: 12, borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#fff', fontWeight: '700', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                style={{ flex: 1, padding: 12, borderRadius: 10, border: 'none', backgroundColor: 'var(--accent)', color: '#000', fontWeight: '800', cursor: saving ? 'not-allowed' : 'pointer' }}
              >
                {saving ? 'Saving...' : 'Save Lyrics'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            <button
              onClick={() => setActiveTab('pending')}
              style={tabButtonStyle(activeTab === 'pending')}
            >
              Pending ({pendingSongs.length})
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              style={tabButtonStyle(activeTab === 'completed')}
            >
              Completed ({completedSongs.length})
            </button>
          </div>

          <div style={{ marginBottom: 16 }}>
            <input
              type="text"
              placeholder="Search songs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={inputStyle}
            />
          </div>

          <div className="mlv-hide-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, overflowY: 'auto' }}>
            {filteredList.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 40 }}>
                {activeTab === 'pending' ? 'All songs have lyrics added!' : 'No songs with lyrics found.'}
              </p>
            ) : (
              filteredList.map((song) => (
                <div
                  key={song.id}
                  onClick={() => handleSelectSong(song)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px', borderRadius: 12, cursor: 'pointer',
                    backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, overflow: 'hidden' }}>
                    <img
                      src={song.cover || 'https://placehold.co/100'}
                      alt=""
                      style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover' }}
                    />
                    <div style={{ overflow: 'hidden' }}>
                      <p style={{ margin: 0, fontSize: '0.88rem', color: '#fff', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {song.title || song.id}
                      </p>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{song.artist}</span>
                    </div>
                  </div>

                  <i className="fa-solid fa-pen-to-square" style={{ color: 'var(--accent)', fontSize: '0.9rem', marginLeft: 12 }}></i>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

const iconBtnStyle = { width: 40, height: 40, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const tabButtonStyle = (active) => ({
  flex: 1, padding: '10px', borderRadius: 10, border: 'none',
  backgroundColor: active ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
  color: active ? '#000' : '#fff', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer'
});
const cardStyle = { backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18, padding: '20px' };
const labelStyle = { display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 6, fontWeight: '700', textTransform: 'uppercase' };
const inputStyle = { width: '100%', height: 44, backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '0 14px', color: '#fff', outline: 'none', boxSizing: 'border-box', fontSize: '0.85rem' };

const manageLyricsStyles = `
  .mlv-hide-scrollbar::-webkit-scrollbar {
    display: none;
  }
  .mlv-hide-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
`;