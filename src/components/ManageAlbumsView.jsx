import React, { useState, useRef, useEffect } from 'react';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { uploadToCloudinary } from '../services/cloudinaryService';

export default function ManageAlbumsView({ albums = [], songs = [], onBack, onAlbumCreated, onSongUpdated }) {
  const [activeTab, setActiveTab] = useState('assign'); // Defaults to assign tab
  
  // Create Album Form State
  const [albumId, setAlbumId] = useState('');
  const [name, setName] = useState('');
  const [artist, setArtist] = useState('');
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [creating, setCreating] = useState(false);
  const [createStatus, setCreateStatus] = useState('');

  // Assign Song Form State
  const [selectedAlbumId, setSelectedAlbumId] = useState(albums[0]?.id || '');
  const [albumDropdownOpen, setAlbumDropdownOpen] = useState(false);
  const [songSearch, setSongSearch] = useState('');
  const [updatingSongId, setUpdatingSongId] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');

  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!albumDropdownOpen) return;
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setAlbumDropdownOpen(false);
      }
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') setAlbumDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [albumDropdownOpen]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleCreateAlbum = async (e) => {
    e.preventDefault();
    if (!albumId.trim() || !name.trim() || !imageFile) {
      alert('Please fill out all required fields and choose a cover image.');
      return;
    }

    setCreating(true);
    setCreateStatus('Uploading album artwork to Cloudinary...');

    try {
      const imageUrl = await uploadToCloudinary(imageFile, 'image');
      setCreateStatus('Saving album in Firebase...');

      const customId = albumId.trim().toLowerCase().replace(/\s+/g, '_');
      const albumData = {
        name: name.trim(),
        artist: artist.trim(),
        year: year.trim(),
        image: imageUrl,
      };

      await setDoc(doc(db, 'albums', customId), albumData);

      setCreateStatus('Album created successfully!');
      onAlbumCreated?.({ id: customId, ...albumData });
      setSelectedAlbumId(customId);
      setActiveTab('assign');

      setAlbumId('');
      setName('');
      setArtist('');
      setImageFile(null);
      setImagePreview(null);
    } catch (err) {
      console.error(err);
      setCreateStatus(`Error: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  // Link or Unlink a Song to the selected album
  const handleToggleAlbumLink = async (song, targetAlbumId) => {
    setUpdatingSongId(song.id);
    const newAlbumId = targetAlbumId === null ? '' : targetAlbumId;

    try {
      const songRef = doc(db, 'songs', song.id);
      await updateDoc(songRef, {
        albumId: newAlbumId,
      });

      onSongUpdated?.({ ...song, albumId: newAlbumId });
      setStatusMessage(
        newAlbumId 
          ? `Added "${song.title || song.id}" to ${selectedAlbum?.name || targetAlbumId}!` 
          : `Removed "${song.title || song.id}" from album.`
      );
      setTimeout(() => setStatusMessage(''), 3500);
    } catch (err) {
      console.error(err);
      setStatusMessage(`Error updating song: ${err.message}`);
    } finally {
      setUpdatingSongId(null);
    }
  };

  const selectedAlbum = albums.find((a) => a.id === selectedAlbumId);

  // Songs currently in this album
  const songsInSelectedAlbum = songs.filter(s => s.albumId === selectedAlbumId);

  // Songs available to be linked
  const availableSongs = songs.filter(s => {
    const matchesSearch = 
      (s.title || s.id || '').toLowerCase().includes(songSearch.toLowerCase()) ||
      (s.artist || '').toLowerCase().includes(songSearch.toLowerCase());
    return matchesSearch && s.albumId !== selectedAlbumId;
  });

  return (
    <div
      className="mav-hide-scrollbar"
      style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: '#05070c', zIndex: 650, padding: '24px 20px 48px',
        display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflowY: 'auto',
        animation: 'slideUpSheet 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      <style>{manageAlbumStyles}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <button onClick={onBack} className="mav-icon-btn" style={iconBtnStyle}>
          <i className="fa-solid fa-chevron-left"></i>
        </button>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: '#fff', letterSpacing: '-0.3px' }}>
            Albums Manager
          </h2>
          <span style={{ fontSize: '0.72rem', color: 'var(--accent)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            Admin Studio
          </span>
        </div>
        <div style={{ width: 40 }}></div>
      </div>

      {/* Tab Switcher */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button
          type="button"
          onClick={() => setActiveTab('assign')}
          style={tabButtonStyle(activeTab === 'assign')}
        >
          Assign Songs to Album
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('create')}
          style={tabButtonStyle(activeTab === 'create')}
        >
          Create New Album
        </button>
      </div>

      {/* Tab 1: Assign Songs & Album Breakdown */}
      {activeTab === 'assign' && (
        <div style={cardStyle}>
          {/* Custom Album Dropdown Selector */}
          <div ref={dropdownRef} style={{ marginBottom: 20 }}>
            <label style={labelStyle}>
              <i className="fa-solid fa-layer-group" style={iconLabelStyle}></i>
              Select Target Album <span style={{ color: 'var(--accent)' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className="mav-input mav-select-trigger"
                onClick={() => setAlbumDropdownOpen((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={albumDropdownOpen}
                style={{
                  ...inputStyle,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderColor: albumDropdownOpen ? 'var(--accent)' : 'rgba(255, 255, 255, 0.08)'
                }}
              >
                {selectedAlbum ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
                    <img src={selectedAlbum.image || 'https://placehold.co/80'} alt="" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover' }} />
                    <span style={{ color: '#fff', fontWeight: '600', fontSize: '0.86rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {selectedAlbum.name} <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>({selectedAlbum.id})</span>
                    </span>
                  </div>
                ) : (
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.86rem' }}>-- Choose an Album --</span>
                )}
                <i className="fa-solid fa-chevron-down" style={{
                  color: 'var(--text-muted)',
                  fontSize: '0.75rem',
                  transform: albumDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s'
                }}></i>
              </button>

              {/* Custom Dark Dropdown List */}
              {albumDropdownOpen && (
                <ul
                  role="listbox"
                  className="mav-select-panel mav-hide-scrollbar"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    left: 0,
                    right: 0,
                    zIndex: 40,
                    backgroundColor: '#0c1017',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '14px',
                    padding: '6px',
                    margin: 0,
                    listStyle: 'none',
                    maxHeight: '240px',
                    overflowY: 'auto',
                    boxShadow: '0 16px 36px rgba(0, 0, 0, 0.75)'
                  }}
                >
                  {albums.length === 0 ? (
                    <li style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      No albums created yet.
                    </li>
                  ) : (
                    albums.map((alb) => {
                      const isSelected = alb.id === selectedAlbumId;
                      return (
                        <li key={alb.id} role="option" aria-selected={isSelected}>
                          <button
                            type="button"
                            className="mav-select-option"
                            onClick={() => {
                              setSelectedAlbumId(alb.id);
                              setAlbumDropdownOpen(false);
                            }}
                            style={{
                              width: '100%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '8px 10px',
                              borderRadius: '8px',
                              border: 'none',
                              backgroundColor: isSelected ? 'rgba(29, 185, 84, 0.14)' : 'transparent',
                              cursor: 'pointer',
                              textAlign: 'left'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
                              <img src={alb.image || 'https://placehold.co/80'} alt="" style={{ width: 34, height: 34, borderRadius: 6, objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)' }} />
                              <div style={{ overflow: 'hidden' }}>
                                <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: isSelected ? 'var(--accent)' : '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {alb.name}
                                </span>
                                <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                  {alb.artist || 'Unknown'} • {alb.id}
                                </span>
                              </div>
                            </div>
                            {isSelected && <i className="fa-solid fa-check" style={{ color: 'var(--accent)', fontSize: '0.8rem', marginLeft: 8 }}></i>}
                          </button>
                        </li>
                      );
                    })
                  )}
                </ul>
              )}
            </div>
          </div>

          {/* Status Message Notification */}
          {statusMessage && (
            <p style={{ margin: '0 0 16px 0', fontSize: '0.82rem', color: 'var(--accent)', fontWeight: '700', textAlign: 'center' }}>
              <i className="fa-solid fa-circle-check" style={{ marginRight: '6px' }}></i>
              {statusMessage}
            </p>
          )}

          {/* 🌟 1. SONGS CURRENTLY IN THIS ALBUM */}
          {selectedAlbumId && (
            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.78rem', color: '#ffffff', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <i className="fa-solid fa-list-check" style={{ color: 'var(--accent)', marginRight: '6px' }}></i>
                  Tracks in {selectedAlbum?.name || selectedAlbumId} ({songsInSelectedAlbum.length})
                </span>
              </div>

              <div className="mav-hide-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '200px', overflowY: 'auto' }}>
                {songsInSelectedAlbum.length === 0 ? (
                  <div style={{ padding: '14px', textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 10, border: '1px dashed rgba(255,255,255,0.08)' }}>
                    <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>No songs assigned to this album yet.</p>
                  </div>
                ) : (
                  songsInSelectedAlbum.map((song) => (
                    <div
                      key={song.id}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '8px 12px', borderRadius: 10,
                        backgroundColor: 'rgba(29, 185, 84, 0.06)', border: '1px solid rgba(29, 185, 84, 0.2)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, overflow: 'hidden' }}>
                        <img src={song.cover || 'https://placehold.co/100'} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover' }} />
                        <div style={{ overflow: 'hidden' }}>
                          <p style={{ margin: 0, fontSize: '0.85rem', color: '#fff', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {song.title || song.id}
                          </p>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{song.artist || 'Unknown Artist'}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleToggleAlbumLink(song, null)}
                        disabled={updatingSongId === song.id}
                        style={{
                          padding: '5px 12px', borderRadius: 16, border: '1px solid rgba(255,77,77,0.3)',
                          backgroundColor: 'rgba(255,77,77,0.1)', color: '#ff6b6b',
                          fontWeight: '700', fontSize: '0.72rem', cursor: 'pointer',
                          transition: '0.15s'
                        }}
                      >
                        {updatingSongId === song.id ? 'Removing...' : 'Remove'}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 🌟 2. SEARCH & ADD MORE SONGS */}
          <div>
            <div style={{ marginBottom: 12 }}>
              <label style={labelStyle}>
                <i className="fa-solid fa-magnifying-glass" style={iconLabelStyle}></i>
                Add More Songs to Album
              </label>
              <input
                type="text"
                placeholder="Search catalog to add songs..."
                value={songSearch}
                onChange={(e) => setSongSearch(e.target.value)}
                className="mav-input"
                style={inputStyle}
              />
            </div>

            <div className="mav-hide-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '280px', overflowY: 'auto' }}>
              {availableSongs.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', padding: '16px 0' }}>
                  {songsInSelectedAlbum.length > 0 && !songSearch ? 'All matching songs are in this album.' : 'No other songs found.'}
                </p>
              ) : (
                availableSongs.map((song) => {
                  const currentAlbum = song.albumId;

                  return (
                    <div
                      key={song.id}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 12px', borderRadius: 12,
                        backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, overflow: 'hidden' }}>
                        <img
                          src={song.cover || 'https://placehold.co/100'}
                          alt=""
                          style={{ width: 42, height: 42, borderRadius: 8, objectFit: 'cover' }}
                        />
                        <div style={{ overflow: 'hidden' }}>
                          <p style={{ margin: 0, fontSize: '0.86rem', color: '#fff', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {song.title || song.id}
                          </p>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            Current Album: <strong style={{ color: currentAlbum ? '#1db954' : '#888' }}>{currentAlbum || 'None'}</strong>
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleToggleAlbumLink(song, selectedAlbumId)}
                        disabled={!selectedAlbumId || updatingSongId === song.id}
                        style={{
                          padding: '6px 14px', borderRadius: 20, border: 'none',
                          backgroundColor: 'var(--accent)',
                          color: '#000',
                          fontWeight: '800', fontSize: '0.72rem',
                          cursor: !selectedAlbumId ? 'not-allowed' : 'pointer',
                          transition: '0.15s'
                        }}
                      >
                        {updatingSongId === song.id ? 'Linking...' : 'Link to Album'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Create Album */}
      {activeTab === 'create' && (
        <div style={cardStyle}>
          <form onSubmit={handleCreateAlbum} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <label style={labelStyle}>
                <i className="fa-solid fa-key" style={iconLabelStyle}></i>
                Album Document ID <span style={{ color: 'var(--accent)' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. 3_album or aavesham_album"
                value={albumId}
                onChange={(e) => setAlbumId(e.target.value)}
                required
                className="mav-input"
                style={inputStyle}
              />
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                Stored directly as the Firestore Document ID
              </span>
            </div>

            <div>
              <label style={labelStyle}>
                <i className="fa-solid fa-compact-disc" style={iconLabelStyle}></i>
                Album Name <span style={{ color: 'var(--accent)' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. 3 or Aavesham"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="mav-input"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>
                <i className="fa-solid fa-user-astronaut" style={iconLabelStyle}></i>
                Primary Artist <span style={{ color: 'var(--accent)' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Anirudh Ravichander"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                required
                className="mav-input"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>
                <i className="fa-solid fa-calendar" style={iconLabelStyle}></i>
                Release Year
              </label>
              <input
                type="text"
                placeholder="e.g. 2026"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="mav-input"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>
                <i className="fa-solid fa-image" style={iconLabelStyle}></i>
                Album Cover Artwork <span style={{ color: 'var(--accent)' }}>*</span>
              </label>
              <label style={dropzoneStyle(!!imageFile)}>
                <input type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
                {imagePreview ? (
                  <img src={imagePreview} alt="Album Art" style={{ width: 56, height: 56, borderRadius: 10, objectFit: 'cover', border: '1px solid rgba(255,255,255,0.2)' }} />
                ) : (
                  <div style={{ width: 56, height: 56, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="fa-solid fa-image" style={{ fontSize: '1.4rem', color: 'rgba(255,255,255,0.4)' }}></i>
                  </div>
                )}
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#fff', fontWeight: '600' }}>
                    {imageFile ? imageFile.name : 'Select Album Cover'}
                  </p>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>JPG, PNG, WebP (Uploaded to Cloudinary)</span>
                </div>
              </label>
            </div>

            {createStatus && (
              <p style={{ margin: 0, fontSize: '0.82rem', color: createStatus.startsWith('Error') ? '#ff4d4d' : 'var(--accent)' }}>
                {createStatus}
              </p>
            )}

            <button type="submit" disabled={creating} className="mav-submit-btn" style={submitBtnStyle(creating)}>
              {creating ? 'Saving Album...' : 'Create Album'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

// Inline Styles
const iconBtnStyle = { width: 40, height: 40, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };
const tabButtonStyle = (active) => ({
  flex: 1, padding: '10px', borderRadius: 10, border: 'none',
  backgroundColor: active ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
  color: active ? '#000' : '#fff', fontWeight: '700', fontSize: '0.8rem', cursor: 'pointer',
  transition: 'background-color 0.2s'
});
const cardStyle = { backgroundColor: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20, padding: '20px', boxShadow: '0 16px 40px rgba(0, 0, 0, 0.5)' };
const labelStyle = { display: 'flex', alignItems: 'center', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 6, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' };
const iconLabelStyle = { color: 'var(--accent)', marginRight: '6px', fontSize: '0.8rem' };
const inputStyle = { width: '100%', height: 46, backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '0 14px', color: '#fff', outline: 'none', boxSizing: 'border-box', fontSize: '0.86rem' };
const dropzoneStyle = (hasFile) => ({
  display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', borderRadius: 14,
  border: hasFile ? '1.5px solid var(--accent)' : '1.5px dashed rgba(255,255,255,0.12)',
  backgroundColor: hasFile ? 'rgba(29, 185, 84, 0.05)' : 'rgba(255,255,255,0.02)', cursor: 'pointer'
});
const submitBtnStyle = (disabled) => ({
  height: 48, borderRadius: 14, border: 'none', backgroundColor: 'var(--accent)', color: '#000',
  fontWeight: '800', fontSize: '0.92rem', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1,
  boxShadow: '0 6px 20px rgba(29, 185, 84, 0.28)'
});

const manageAlbumStyles = `
  @keyframes slideUpSheet {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  @keyframes mavFadeIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* 🛡️ Hide Scrollbar Globally */
  .mav-hide-scrollbar::-webkit-scrollbar {
    display: none;
  }
  .mav-hide-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  .mav-icon-btn { transition: background-color 0.2s, transform 0.15s; }
  .mav-icon-btn:hover { background-color: rgba(255,255,255,0.1) !important; }
  .mav-icon-btn:active { transform: scale(0.92); }

  .mav-input { transition: border-color 0.2s, background-color 0.2s, box-shadow 0.2s; }
  .mav-input:hover { border-color: rgba(255,255,255,0.18); }
  .mav-input:focus { 
    border-color: var(--accent) !important; 
    background-color: rgba(255,255,255,0.06); 
    box-shadow: 0 0 0 3px rgba(29, 185, 84, 0.15);
  }

  .mav-select-panel { animation: mavFadeIn 0.15s ease-out; }
  .mav-select-option { transition: background-color 0.15s; }
  .mav-select-option:hover { background-color: rgba(255,255,255,0.08) !important; }

  .mav-submit-btn { transition: transform 0.15s, opacity 0.15s, box-shadow 0.15s; }
  .mav-submit-btn:not(:disabled):hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(29, 185, 84, 0.4); }
  .mav-submit-btn:not(:disabled):active { transform: translateY(0); }
`;