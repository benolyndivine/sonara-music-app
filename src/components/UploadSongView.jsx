import React, { useState, useRef, useEffect } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { uploadToCloudinary } from '../services/cloudinaryService';

const MAX_AUDIO_MB = 50;
const TITLE_MAX = 60;
const ARTIST_MAX = 40;

const CATEGORY_OPTIONS = [
  { value: 'songs', label: 'General Public Catalog', hint: '/songs', icon: 'fa-globe' },
  { value: 'christianSongs', label: 'Christian Songs', hint: '/christianSongs', icon: 'fa-cross' },
];

export default function UploadSongView({ user, onBack, onSongUploaded }) {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [songFile, setSongFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [targetCollection, setTargetCollection] = useState('songs');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(null);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [dragTarget, setDragTarget] = useState(null);
  const [categoryOpen, setCategoryOpen] = useState(false);

  const formRef = useRef(null);
  const successTimeout = useRef(null);
  const categoryRef = useRef(null);

  useEffect(() => {
    if (!categoryOpen) return;
    const handleClickOutside = (e) => {
      if (categoryRef.current && !categoryRef.current.contains(e.target)) {
        setCategoryOpen(false);
      }
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') setCategoryOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [categoryOpen]);

  const clearFieldError = (key) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const applyCoverFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setFieldErrors((prev) => ({ ...prev, cover: "File must be an image (PNG, JPG, WebP)." }));
      return;
    }
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    clearFieldError('cover');
  };

  const applySongFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith('audio/')) {
      setFieldErrors((prev) => ({ ...prev, song: "File must be an audio track (MP3, WAV)." }));
      return;
    }
    if (file.size > MAX_AUDIO_MB * 1024 * 1024) {
      setFieldErrors((prev) => ({ ...prev, song: `File size exceeds the ${MAX_AUDIO_MB}MB limit.` }));
      return;
    }
    setSongFile(file);
    clearFieldError('song');
  };

  const handleCoverChange = (e) => applyCoverFile(e.target.files[0]);
  const handleSongChange = (e) => applySongFile(e.target.files[0]);

  const removeSong = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setSongFile(null);
  };

  const removeCover = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setCoverFile(null);
    setCoverPreview(null);
  };

  const makeDropHandlers = (kind, apply) => ({
    onDragOver: (e) => {
      e.preventDefault();
      setDragTarget(kind);
    },
    onDragLeave: (e) => {
      e.preventDefault();
      setDragTarget((cur) => (cur === kind ? null : cur));
    },
    onDrop: (e) => {
      e.preventDefault();
      setDragTarget(null);
      const file = e.dataTransfer.files?.[0];
      apply(file);
    },
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (successTimeout.current) clearTimeout(successTimeout.current);

    const errs = {};
    if (!title.trim()) errs.title = 'Song title is required.';
    if (!artist.trim()) errs.artist = 'Artist name is required.';
    if (!songFile) errs.song = 'Select an audio track file.';
    if (!coverFile) errs.cover = 'Select a cover image.';

    if (Object.keys(errs).length) {
      setFieldErrors(errs);
      setStatus({ type: 'error', message: 'Please complete all required fields.' });
      return;
    }

    setLoading(true);
    setStep('media');
    setStatus({ type: 'loading', message: 'Uploading audio & artwork to Cloudinary…' });

    try {
      const [coverUrl, songUrl] = await Promise.all([
        uploadToCloudinary(coverFile, 'image'),
        uploadToCloudinary(songFile, 'video'),
      ]);

      setStep('metadata');
      setStatus({ type: 'loading', message: 'Saving track metadata to Firebase…' });

      const songData = {
        title: title.trim(),
        artist: artist.trim(),
        cover: coverUrl,
        songUrl: songUrl,
        uploadedBy: user?.email || 'admin',
        createdAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, targetCollection), songData);

      setStep(null);
      setStatus({ type: 'success', message: `“${songData.title}” was uploaded successfully!` });
      onSongUploaded?.({ id: docRef.id, ...songData });

      setTitle('');
      setArtist('');
      setSongFile(null);
      setCoverFile(null);
      setCoverPreview(null);
      setFieldErrors({});
      formRef.current?.reset();

      successTimeout.current = setTimeout(() => {
        setStatus({ type: '', message: '' });
      }, 4500);
    } catch (err) {
      console.error('Upload Error:', err);
      setStep(null);
      setStatus({ type: 'error', message: err.message || 'Failed to upload song. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const selectedCategory = CATEGORY_OPTIONS.find((o) => o.value === targetCollection);

  return (
    <div
      className="usv-hide-scrollbar"
      style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: '#05070c', zIndex: 650, padding: '24px 20px 48px',
        display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
        overflowY: 'auto',
        animation: 'slideUpSheet 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      <style>{uploadSongStyles}</style>

      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
        <button
          onClick={onBack}
          className="usv-icon-btn"
          aria-label="Go back"
          style={{
            width: '40px', height: '40px', borderRadius: '50%',
            backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.08)',
            color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: '0.95rem'
          }}
        >
          <i className="fa-solid fa-chevron-left"></i>
        </button>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: '#ffffff', letterSpacing: '-0.3px' }}>
            Upload Track
          </h2>
          <span style={{ fontSize: '0.72rem', color: 'var(--accent)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            Admin Studio
          </span>
        </div>
        <div style={{ width: '40px' }}></div>
      </div>

      {/* Main Form Container */}
      <div style={{
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid rgba(255, 255, 255, 0.06)',
        borderRadius: '20px',
        padding: '24px 20px',
        boxShadow: '0 16px 40px rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(12px)'
      }}>
        <form ref={formRef} onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>

          {/* Song Title */}
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <label style={labelStyle}>
                <i className="fa-solid fa-heading" style={iconLabelStyle}></i>
                Song Title <span style={{ color: 'var(--accent)' }}>*</span>
              </label>
              <span style={counterStyle(title.length, TITLE_MAX)}>{title.length}/{TITLE_MAX}</span>
            </div>
            <input
              type="text"
              placeholder="e.g. Midnight Waves"
              value={title}
              maxLength={TITLE_MAX}
              onChange={(e) => { setTitle(e.target.value); clearFieldError('title'); }}
              className="usv-input"
              style={inputStyle(fieldErrors.title)}
            />
            {fieldErrors.title && <p style={errorTextStyle}>{fieldErrors.title}</p>}
          </div>

          {/* Artist Name */}
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <label style={labelStyle}>
                <i className="fa-solid fa-microphone-lines" style={iconLabelStyle}></i>
                Artist Name <span style={{ color: 'var(--accent)' }}>*</span>
              </label>
              <span style={counterStyle(artist.length, ARTIST_MAX)}>{artist.length}/{ARTIST_MAX}</span>
            </div>
            <input
              type="text"
              placeholder="e.g. Benolynd"
              value={artist}
              maxLength={ARTIST_MAX}
              onChange={(e) => { setArtist(e.target.value); clearFieldError('artist'); }}
              className="usv-input"
              style={inputStyle(fieldErrors.artist)}
            />
            {fieldErrors.artist && <p style={errorTextStyle}>{fieldErrors.artist}</p>}
          </div>

          {/* Target Collection */}
          <div ref={categoryRef}>
            <label style={labelStyle}>
              <i className="fa-solid fa-layer-group" style={iconLabelStyle}></i>
              Target Collection
            </label>
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className="usv-input usv-select-trigger"
                onClick={() => setCategoryOpen((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={categoryOpen}
                style={{
                  ...inputStyle(), cursor: 'pointer', paddingRight: '38px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  borderColor: categoryOpen ? 'var(--accent)' : 'rgba(255, 255, 255, 0.08)'
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ffffff' }}>
                  <i className={`fa-solid ${selectedCategory?.icon || 'fa-folder'}`} style={{ color: 'var(--accent)', fontSize: '0.85rem' }}></i>
                  {selectedCategory?.label}
                </span>
                <i className="fa-solid fa-chevron-down" style={{
                  color: 'var(--text-muted)', fontSize: '0.75rem',
                  transform: categoryOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s'
                }}></i>
              </button>

              {categoryOpen && (
                <ul role="listbox" className="usv-select-panel" style={{
                  position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 30,
                  backgroundColor: '#0c1017', border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px', padding: '6px', margin: 0, listStyle: 'none',
                  boxShadow: '0 12px 30px rgba(0, 0, 0, 0.7)'
                }}>
                  {CATEGORY_OPTIONS.map((opt) => {
                    const selected = opt.value === targetCollection;
                    return (
                      <li key={opt.value} role="option" aria-selected={selected}>
                        <button
                          type="button"
                          className="usv-select-option"
                          onClick={() => { setTargetCollection(opt.value); setCategoryOpen(false); }}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '10px 12px', borderRadius: '8px', border: 'none',
                            backgroundColor: selected ? 'rgba(29, 185, 84, 0.12)' : 'transparent',
                            cursor: 'pointer', textAlign: 'left'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <i className={`fa-solid ${opt.icon}`} style={{ color: selected ? 'var(--accent)' : 'var(--text-muted)', fontSize: '0.9rem' }}></i>
                            <div>
                              <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: selected ? 'var(--accent)' : '#ffffff' }}>
                                {opt.label}
                              </span>
                              <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                {opt.hint}
                              </span>
                            </div>
                          </div>
                          {selected && <i className="fa-solid fa-check" style={{ color: 'var(--accent)', fontSize: '0.8rem' }}></i>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Audio Upload Box */}
          <div>
            <label style={labelStyle}>
              <i className="fa-solid fa-music" style={iconLabelStyle}></i>
              Audio Track (MP3 / WAV) <span style={{ color: 'var(--accent)' }}>*</span>
            </label>
            <label
              className="usv-dropzone"
              {...makeDropHandlers('song', applySongFile)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                padding: '20px 16px', borderRadius: '14px', position: 'relative',
                border: fieldErrors.song
                  ? '1.5px solid #ff4d4d'
                  : songFile ? '1.5px solid var(--accent)' : dragTarget === 'song' ? '1.5px dashed var(--accent)' : '1.5px dashed rgba(255, 255, 255, 0.12)',
                backgroundColor: songFile ? 'rgba(29, 185, 84, 0.05)' : dragTarget === 'song' ? 'rgba(29, 185, 84, 0.04)' : 'rgba(255, 255, 255, 0.02)',
                cursor: 'pointer'
              }}
            >
              <input type="file" accept="audio/*" onChange={handleSongChange} style={{ display: 'none' }} />
              {songFile && (
                <button type="button" onClick={removeSong} className="usv-remove-btn" aria-label="Remove audio">
                  <i className="fa-solid fa-xmark"></i>
                </button>
              )}
              <div style={{
                width: '46px', height: '46px', borderRadius: '50%',
                backgroundColor: songFile ? 'rgba(29, 185, 84, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px'
              }}>
                <i className={songFile ? "fa-solid fa-circle-check" : "fa-solid fa-file-audio"} style={{
                  fontSize: '1.3rem', color: songFile ? 'var(--accent)' : 'rgba(255, 255, 255, 0.4)'
                }}></i>
              </div>
              <span style={{ fontSize: '0.86rem', color: songFile ? '#ffffff' : 'rgba(255, 255, 255, 0.8)', fontWeight: '600', textAlign: 'center', maxWidth: '90%', wordBreak: 'break-word' }}>
                {songFile ? songFile.name : dragTarget === 'song' ? 'Drop audio file here' : 'Click or drop audio track'}
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                {songFile ? `${(songFile.size / (1024 * 1024)).toFixed(2)} MB • Ready to upload` : `Max size ${MAX_AUDIO_MB}MB`}
              </span>
            </label>
            {fieldErrors.song && <p style={errorTextStyle}>{fieldErrors.song}</p>}
          </div>

          {/* Cover Art Upload Box */}
          <div>
            <label style={labelStyle}>
              <i className="fa-solid fa-image" style={iconLabelStyle}></i>
              Cover Artwork (JPG / PNG / WEBP) <span style={{ color: 'var(--accent)' }}>*</span>
            </label>
            <label
              className="usv-dropzone"
              {...makeDropHandlers('cover', applyCoverFile)}
              style={{
                display: 'flex', alignItems: 'center', gap: '14px', position: 'relative',
                padding: '12px 14px', borderRadius: '14px',
                border: fieldErrors.cover
                  ? '1.5px solid #ff4d4d'
                  : coverFile ? '1.5px solid var(--accent)' : dragTarget === 'cover' ? '1.5px dashed var(--accent)' : '1.5px dashed rgba(255, 255, 255, 0.12)',
                backgroundColor: coverFile ? 'rgba(29, 185, 84, 0.05)' : dragTarget === 'cover' ? 'rgba(29, 185, 84, 0.04)' : 'rgba(255, 255, 255, 0.02)',
                cursor: 'pointer'
              }}
            >
              <input type="file" accept="image/*" onChange={handleCoverChange} style={{ display: 'none' }} />
              {coverPreview ? (
                <img src={coverPreview} alt="Cover preview" style={{ width: '52px', height: '52px', borderRadius: '10px', objectFit: 'cover', border: '1px solid rgba(255,255,255,0.2)', flexShrink: 0 }} />
              ) : (
                <div style={{ width: '52px', height: '52px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <i className="fa-solid fa-cloud-arrow-up" style={{ color: 'rgba(255, 255, 255, 0.3)', fontSize: '1.1rem' }}></i>
                </div>
              )}
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <p style={{ margin: 0, fontSize: '0.85rem', color: coverFile ? '#ffffff' : 'rgba(255, 255, 255, 0.8)', fontWeight: '600', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                  {coverFile ? coverFile.name : dragTarget === 'cover' ? 'Drop artwork image here' : 'Choose cover image'}
                </p>
                <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)' }}>Square aspect ratio recommended</p>
              </div>
              {coverFile && (
                <button type="button" onClick={removeCover} className="usv-remove-btn" aria-label="Remove cover" style={{ position: 'static', marginLeft: '4px' }}>
                  <i className="fa-solid fa-xmark"></i>
                </button>
              )}
            </label>
            {fieldErrors.cover && <p style={errorTextStyle}>{fieldErrors.cover}</p>}
          </div>

          {/* Progress Indicator */}
          {loading && (
            <div style={{ display: 'flex', gap: '10px', marginTop: '-4px' }}>
              <ProgressPip active={step === 'media'} done={step === 'metadata'} label="1. Cloudinary Assets" />
              <ProgressPip active={step === 'metadata'} done={false} label="2. Firestore Doc" />
            </div>
          )}

          {/* Status Message Display */}
          {status.message && (
            <div
              key={status.message}
              className="usv-status"
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '12px 14px', borderRadius: '12px',
                backgroundColor: status.type === 'error' ? 'rgba(255, 77, 77, 0.1)' : status.type === 'success' ? 'rgba(29, 185, 84, 0.1)' : 'rgba(255, 255, 255, 0.04)',
                border: `1px solid ${status.type === 'error' ? 'rgba(255, 77, 77, 0.3)' : status.type === 'success' ? 'rgba(29, 185, 84, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
                fontSize: '0.82rem', color: status.type === 'error' ? '#ff4d4d' : status.type === 'success' ? '#1db954' : '#ffffff'
              }}
            >
              {status.type === 'loading' && <i className="fa-solid fa-spinner fa-spin"></i>}
              {status.type === 'success' && <i className="fa-solid fa-circle-check"></i>}
              {status.type === 'error' && <i className="fa-solid fa-circle-exclamation"></i>}
              <span>{status.message}</span>
            </div>
          )}

          {/* Publish Action Button */}
          <button
            type="submit"
            disabled={loading}
            className="usv-submit-btn"
            style={{
              height: '50px', marginTop: '6px', borderRadius: '14px', border: 'none',
              backgroundColor: 'var(--accent)', color: '#000000', fontWeight: '800', fontSize: '0.95rem',
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              boxShadow: '0 6px 20px rgba(29, 185, 84, 0.28)'
            }}
          >
            {loading ? (
              <>
                <i className="fa-solid fa-spinner fa-spin"></i>
                <span>{step === 'metadata' ? 'Saving to Database…' : 'Publishing to Cloud…'}</span>
              </>
            ) : (
              <>
                <i className="fa-solid fa-arrow-up-from-bracket"></i>
                <span>Publish Song</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

function ProgressPip({ active, done, label }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
      <div
        className={active && !done ? 'usv-pip-pulse' : ''}
        style={{
          height: '3px', borderRadius: '2px',
          backgroundColor: done ? 'var(--accent)' : active ? 'var(--accent)' : 'rgba(255,255,255,0.08)',
          opacity: active && !done ? 1 : done ? 0.9 : 0.4
        }}
      />
      <span style={{ fontSize: '0.65rem', color: active || done ? 'var(--accent)' : 'var(--text-muted)', fontWeight: '700' }}>
        {label}
      </span>
    </div>
  );
}

const labelStyle = {
  display: 'flex',
  alignItems: 'center',
  fontSize: '0.72rem',
  color: 'var(--text-muted)',
  marginBottom: '6px',
  fontWeight: '700',
  letterSpacing: '0.5px',
  textTransform: 'uppercase'
};

const iconLabelStyle = {
  color: 'var(--accent)',
  marginRight: '6px',
  fontSize: '0.8rem'
};

const inputStyle = (hasError) => ({
  width: '100%',
  height: '46px',
  backgroundColor: 'rgba(255, 255, 255, 0.04)',
  border: hasError ? '1px solid #ff4d4d' : '1px solid rgba(255, 255, 255, 0.08)',
  borderRadius: '12px',
  padding: '0 14px',
  color: '#ffffff',
  fontSize: '0.88rem',
  outline: 'none',
  boxSizing: 'border-box'
});

const errorTextStyle = {
  margin: '6px 2px 0',
  fontSize: '0.72rem',
  color: '#ff4d4d',
  fontWeight: '600'
};

const counterStyle = (count, max) => ({
  fontSize: '0.68rem',
  color: count >= max ? '#ff4d4d' : 'var(--text-muted)',
  fontWeight: '600'
});

const uploadSongStyles = `
  @keyframes slideUpSheet {
    from { transform: translateY(20px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
  @keyframes usvFadeIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes usvPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.35; }
  }

  /* 🛡️ Hide Scrollbar Globally inside Upload View */
  .usv-hide-scrollbar::-webkit-scrollbar {
    display: none;
  }
  .usv-hide-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  .usv-icon-btn { transition: background-color 0.2s, transform 0.15s; }
  .usv-icon-btn:hover { background-color: rgba(255,255,255,0.1) !important; }
  .usv-icon-btn:active { transform: scale(0.92); }

  .usv-input { transition: border-color 0.2s, background-color 0.2s, box-shadow 0.2s; }
  .usv-input:hover { border-color: rgba(255,255,255,0.18); }
  .usv-input:focus { 
    border-color: var(--accent) !important; 
    background-color: rgba(255,255,255,0.06); 
    box-shadow: 0 0 0 3px rgba(29, 185, 84, 0.15);
  }

  .usv-dropzone { transition: border-color 0.2s, background-color 0.2s, transform 0.15s; }
  .usv-dropzone:hover { border-color: var(--accent); transform: translateY(-1px); }

  .usv-select-trigger:hover { border-color: rgba(255,255,255,0.25); }
  .usv-select-panel { animation: usvFadeIn 0.15s ease-out; }
  .usv-select-option { transition: background-color 0.15s; }
  .usv-select-option:hover { background-color: rgba(255,255,255,0.06) !important; }

  .usv-remove-btn {
    position: absolute; top: 8px; right: 8px;
    width: 24px; height: 24px; border-radius: 50%;
    background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.15);
    color: #fff; font-size: 0.7rem;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: background-color 0.15s, transform 0.15s;
  }
  .usv-remove-btn:hover { background: rgba(255,77,77,0.4); border-color: rgba(255,77,77,0.6); }
  .usv-remove-btn:active { transform: scale(0.9); }

  .usv-status { animation: usvFadeIn 0.2s ease-out; }
  .usv-pip-pulse { animation: usvPulse 1.2s ease-in-out infinite; }

  .usv-submit-btn { transition: transform 0.15s, opacity 0.15s, box-shadow 0.15s; }
  .usv-submit-btn:not(:disabled):hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(29, 185, 84, 0.4); }
  .usv-submit-btn:not(:disabled):active { transform: translateY(0); }

  .usv-input:focus-visible, .usv-dropzone:focus-within, .usv-icon-btn:focus-visible, .usv-remove-btn:focus-visible, .usv-submit-btn:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
`;