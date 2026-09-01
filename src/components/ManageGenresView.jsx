import React, { useState, useRef, useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

const POPULAR_GENRES = ['Kollywood', 'Melody', 'Party', 'Chill', 'Devotional', 'Hip Hop', 'Classical', 'Folk', 'Love', 'Break Heart'];

export default function ManageGenresView({ songs = [], onBack, onGenreSaved }) {
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'completed'
  const [search, setSearch] = useState('');
  const [selectedSong, setSelectedSong] = useState(null);
  const [genreInput, setGenreInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  const previewAudioRef = useRef(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const previewUrl = selectedSong?.songUrl || selectedSong?.audioUrl || null;

  useEffect(() => {
    setPreviewPlaying(false);
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current.currentTime = 0;
    }
  }, [selectedSong]);

  const togglePreviewPlay = () => {
    const audio = previewAudioRef.current;
    if (!audio) return;
    if (previewPlaying) {
      audio.pause();
      setPreviewPlaying(false);
    } else {
      audio.play().then(() => setPreviewPlaying(true)).catch(() => {});
    }
  };

  const pendingSongs = songs.filter((s) => !s.genre || !s.genre.trim());
  const completedSongs = songs.filter((s) => s.genre && s.genre.trim());

  const activeList = activeTab === 'pending' ? pendingSongs : completedSongs;
  const filteredList = activeList.filter((s) =>
    (s.title || s.name || s.id || '').toLowerCase().includes(search.toLowerCase()) ||
    (s.artist || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleSelectSong = (song) => {
    setSelectedSong(song);
    setGenreInput(song.genre || '');
    setStatus('');
  };

  const handleSaveGenre = async (e) => {
    e.preventDefault();
    if (!selectedSong) return;

    const trimmedGenre = genreInput.trim();
    if (!trimmedGenre) {
      alert("Please enter or select a genre tag.");
      return;
    }

    setSaving(true);
    setStatus('Updating genre in Firebase...');

    try {
      const songRef = doc(db, 'songs', selectedSong.id);
      await updateDoc(songRef, {
        genre: trimmedGenre,
      });

      setStatus('Genre updated successfully!');
      onGenreSaved?.({ ...selectedSong, genre: trimmedGenre });
      
      setTimeout(() => {
        setStatus('');
        setSelectedSong(null);
      }, 1200);
    } catch (err) {
      console.error(err);
      setStatus(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="mgv-hide-scrollbar"
      style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: '#05070c', zIndex: 650, padding: '24px 20px 48px',
        display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflowY: 'auto',
        animation: 'slideUpSheet 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      <style>{manageGenresStyles}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <button onClick={selectedSong ? () => setSelectedSong(null) : onBack} style={iconBtnStyle}>
          <i className="fa-solid fa-chevron-left"></i>
        </button>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800', color: '#fff' }}>
            {selectedSong ? 'Set Song Genre' : 'Genre Manager'}
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
              src={selectedSong.cover || selectedSong.image || 'https://placehold.co/100'}
              alt=""
              style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }}
            />
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', color: '#fff' }}>{selectedSong.title || selectedSong.name}</h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{selectedSong.artist || 'Unknown Artist'}</p>
            </div>
          </div>

          <form onSubmit={handleSaveGenre} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {previewUrl && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)'
              }}>
                <audio
                  ref={previewAudioRef}
                  src={previewUrl}
                  onEnded={() => setPreviewPlaying(false)}
                  onPause={() => setPreviewPlaying(false)}
                  onPlay={() => setPreviewPlaying(true)}
                />
                <button
                  type="button"
                  onClick={togglePreviewPlay}
                  title={previewPlaying ? 'Pause preview' : 'Play preview'}
                  style={{
                    width: 38, height: 38, borderRadius: '50%', border: 'none', flexShrink: 0,
                    backgroundColor: 'var(--accent)', color: '#000', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                  }}
                >
                  <i className={previewPlaying ? 'fa-solid fa-pause' : 'fa-solid fa-play'}></i>
                </button>
                <div style={{ fontSize: '0.8rem', color: '#fff' }}>
                  <p style={{ margin: 0, fontWeight: '600' }}>Preview Track Audio</p>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Listen before tagging genre</span>
                </div>
              </div>
            )}

            <div>
              <label style={labelStyle}>Genre / Mood Tag</label>
              <input
                type="text"
                placeholder="e.g. Kollywood, Melody, Party"
                value={genreInput}
                onChange={(e) => setGenreInput(e.target.value)}
                required
                style={inputStyle}
              />
            </div>

            <div>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
                Quick Suggestions
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {POPULAR_GENRES.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGenreInput(g)}
                    style={{
                      backgroundColor: genreInput.toLowerCase() === g.toLowerCase() ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
                      color: genreInput.toLowerCase() === g.toLowerCase() ? '#000' : '#fff',
                      border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '6px 12px',
                      fontSize: '0.78rem', fontWeight: '600', cursor: 'pointer'
                    }}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {status && (
              <p style={{ margin: 0, fontSize: '0.8rem', color: status.startsWith('Error') ? '#ff4d4d' : 'var(--accent)', fontWeight: '600' }}>
                {status}
              </p>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
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
                {saving ? 'Saving...' : 'Save Genre'}
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

          <div className="mgv-hide-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, overflowY: 'auto' }}>
            {filteredList.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 40 }}>
                {activeTab === 'pending' ? 'All songs have been assigned a genre!' : 'No tagged songs found.'}
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
                      src={song.cover || song.image || 'https://placehold.co/100'}
                      alt=""
                      style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover' }}
                    />
                    <div style={{ overflow: 'hidden' }}>
                      <p style={{ margin: 0, fontSize: '0.88rem', color: '#fff', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {song.title || song.name}
                      </p>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {song.artist || 'Unknown'} {song.genre ? `• [${song.genre}]` : ''}
                      </span>
                    </div>
                  </div>

                  <span style={{
                    fontSize: '0.72rem', fontWeight: '700', padding: '4px 10px', borderRadius: '12px',
                    backgroundColor: song.genre ? 'rgba(29, 185, 84, 0.15)' : 'rgba(255,255,255,0.08)',
                    color: song.genre ? 'var(--accent)' : 'var(--text-muted)'
                  }}>
                    {song.genre || 'Untagged'}
                  </span>
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

const manageGenresStyles = `
  .mgv-hide-scrollbar::-webkit-scrollbar { display: none; }
  .mgv-hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
`;