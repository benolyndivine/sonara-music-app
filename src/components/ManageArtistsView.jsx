import React, { useState } from 'react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { uploadToCloudinary } from '../services/cloudinaryService';

export default function ManageArtistsView({ artists = [], onBack, onArtistCreated }) {
  const [activeTab, setActiveTab] = useState('create'); // 'create' | 'list'
  const [name, setName] = useState('');
  const [docId, setDocId] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [creating, setCreating] = useState(false);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleNameChange = (val) => {
    setName(val);
    if (!docId || docId === name) {
      setDocId(val);
    }
  };

  const handleCreateArtist = async (e) => {
    e.preventDefault();
    if (!name.trim() || !imageFile) {
      alert('Please provide an artist name and select a profile image.');
      return;
    }

    const documentKey = (docId || name).trim();
    if (!documentKey) return;

    setCreating(true);
    setStatus('Uploading artist image to Cloudinary...');

    try {
      const imageUrl = await uploadToCloudinary(imageFile, 'image');
      setStatus('Saving artist to Firebase...');

      const artistData = {
        name: name.trim(),
        image: imageUrl,
      };

      await setDoc(doc(db, 'artists', documentKey), artistData);

      setStatus('Artist profile created successfully!');
      onArtistCreated?.({ id: documentKey, ...artistData });

      setName('');
      setDocId('');
      setImageFile(null);
      setImagePreview(null);
      setTimeout(() => setStatus(''), 4000);
    } catch (err) {
      console.error('Artist creation error:', err);
      setStatus(`Error: ${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  const filteredArtists = artists.filter(a =>
    (a.name || a.id || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      className="mart-hide-scrollbar"
      style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: '#05070c', zIndex: 650, padding: '24px 20px 48px',
        display: 'flex', flexDirection: 'column', boxSizing: 'border-box', overflowY: 'auto',
        animation: 'slideUpSheet 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      <style>{manageArtistStyles}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <button onClick={onBack} className="mart-icon-btn" style={iconBtnStyle}>
          <i className="fa-solid fa-chevron-left"></i>
        </button>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: '#fff', letterSpacing: '-0.3px' }}>
            Artists Manager
          </h2>
          <span style={{ fontSize: '0.72rem', color: 'var(--accent)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            Admin Studio
          </span>
        </div>
        <div style={{ width: 40 }}></div>
      </div>

      {/* Tab Controls */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button
          type="button"
          onClick={() => setActiveTab('create')}
          style={tabButtonStyle(activeTab === 'create')}
        >
          Add New Artist
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('list')}
          style={tabButtonStyle(activeTab === 'list')}
        >
          View Artists ({artists.length})
        </button>
      </div>

      {/* Tab 1: Create Artist */}
      {activeTab === 'create' && (
        <div style={cardStyle}>
          <form onSubmit={handleCreateArtist} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <label style={labelStyle}>
                <i className="fa-solid fa-user" style={iconLabelStyle}></i>
                Artist Name <span style={{ color: 'var(--accent)' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. A. R. Rahman"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                required
                className="mart-input"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>
                <i className="fa-solid fa-key" style={iconLabelStyle}></i>
                Firestore Document Key
              </label>
              <input
                type="text"
                placeholder="e.g. A. R. Rahman"
                value={docId}
                onChange={(e) => setDocId(e.target.value)}
                className="mart-input"
                style={inputStyle}
              />
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                Document ID in the <code>artists</code> collection (defaults to artist name)
              </span>
            </div>

            <div>
              <label style={labelStyle}>
                <i className="fa-solid fa-image" style={iconLabelStyle}></i>
                Artist Profile Image <span style={{ color: 'var(--accent)' }}>*</span>
              </label>
              <label style={dropzoneStyle(!!imageFile)}>
                <input type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
                {imagePreview ? (
                  <img src={imagePreview} alt="Artist Preview" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent)' }} />
                ) : (
                  <div style={{ width: 56, height: 56, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="fa-solid fa-camera" style={{ fontSize: '1.3rem', color: 'rgba(255,255,255,0.4)' }}></i>
                  </div>
                )}
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#fff', fontWeight: '600' }}>
                    {imageFile ? imageFile.name : 'Select Profile Photo'}
                  </p>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>JPG, PNG, WebP (Cloudinary preset)</span>
                </div>
              </label>
            </div>

            {status && (
              <p style={{ margin: 0, fontSize: '0.82rem', color: status.startsWith('Error') ? '#ff4d4d' : 'var(--accent)' }}>
                {status}
              </p>
            )}

            <button type="submit" disabled={creating} className="mart-submit-btn" style={submitBtnStyle(creating)}>
              {creating ? 'Creating Profile...' : 'Create Artist Profile'}
            </button>
          </form>
        </div>
      )}

      {/* Tab 2: Existing Artists List */}
      {activeTab === 'list' && (
        <div style={cardStyle}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>
              <i className="fa-solid fa-magnifying-glass" style={iconLabelStyle}></i>
              Search Artists
            </label>
            <input
              type="text"
              placeholder="Search artist name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mart-input"
              style={inputStyle}
            />
          </div>

          <div className="mart-hide-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: '380px', overflowY: 'auto' }}>
            {filteredArtists.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', padding: '20px 0' }}>
                No matching artists found.
              </p>
            ) : (
              filteredArtists.map((artist) => (
                <div
                  key={artist.id}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px', borderRadius: 12,
                    backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, overflow: 'hidden' }}>
                    <img
                      src={artist.image || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?q=80&w=150'}
                      alt=""
                      style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                    <div style={{ overflow: 'hidden' }}>
                      <p style={{ margin: 0, fontSize: '0.88rem', color: '#fff', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {artist.name || artist.id}
                      </p>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        Doc ID: {artist.id}
                      </span>
                    </div>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--accent)', backgroundColor: 'rgba(29, 185, 84, 0.1)', padding: '4px 10px', borderRadius: 12, fontWeight: '700' }}>
                    Active
                  </span>
                </div>
              ))
            )}
          </div>
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

const manageArtistStyles = `
  @keyframes slideUpSheet {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  .mart-hide-scrollbar::-webkit-scrollbar {
    display: none;
  }
  .mart-hide-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .mart-icon-btn { transition: background-color 0.2s, transform 0.15s; }
  .mart-icon-btn:hover { background-color: rgba(255,255,255,0.1) !important; }
  .mart-icon-btn:active { transform: scale(0.92); }

  .mart-input { transition: border-color 0.2s, background-color 0.2s, box-shadow 0.2s; }
  .mart-input:hover { border-color: rgba(255,255,255,0.18); }
  .mart-input:focus { 
    border-color: var(--accent) !important; 
    background-color: rgba(255,255,255,0.06); 
    box-shadow: 0 0 0 3px rgba(29, 185, 84, 0.15);
  }
  .mart-submit-btn { transition: transform 0.15s, opacity 0.15s, box-shadow 0.15s; }
  .mart-submit-btn:not(:disabled):hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(29, 185, 84, 0.4); }
  .mart-submit-btn:not(:disabled):active { transform: translateY(0); }
`;