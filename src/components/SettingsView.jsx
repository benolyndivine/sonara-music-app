import React, { useState, useEffect } from 'react';
import { clearAllLocalCache } from '../utils/offlineStorage';
import {
  STREAMING_QUALITY_OPTIONS,
  DOWNLOAD_QUALITY_OPTIONS,
  getStreamingQuality,
  setStreamingQuality,
  getDownloadQuality,
  setDownloadQuality,
} from '../utils/audioQuality';

export default function SettingsView({
  contentRestrictions, setContentRestrictions,
  appTheme, setAppTheme,
  motionEnabled, setMotionEnabled,
  lyricsSize, setLyricsSize,
  increaseContrast, setIncreaseContrast,
  automaticallySendDiagnostics, setAutomaticallySendDiagnostics,
  crossfadeEnabled, setCrossfadeEnabled,
  songs = [],
  currentVersion = '1.0.0',
  onBack
}) {
  const [cachedCount, setCachedCount] = useState(0);

  const [streamingQuality, setStreamingQualityState] = useState(getStreamingQuality());
  const [downloadQuality, setDownloadQualityState] = useState(getDownloadQuality());

  const handleSelectStreamingQuality = (quality) => {
    setStreamingQualityState(quality);
    setStreamingQuality(quality);
  };

  const handleSelectDownloadQuality = (quality) => {
    setDownloadQualityState(quality);
    setDownloadQuality(quality);
  };

  useEffect(() => {
    let count = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('offline_track_')) count++;
    }
    setCachedCount(count);
  }, [songs]);

  const handleClearCacheClick = async () => {
    if (cachedCount === 0) {
      alert("No offline downloaded tracks found to clear.");
      return;
    }

    const confirmWipe = window.confirm(
      `Are you sure you want to delete all ${cachedCount} locally saved songs? You will need internet connectivity to stream them again.`
    );
    
    if (!confirmWipe) return;

    try {
      await clearAllLocalCache();
      setCachedCount(0);
      alert("Local downloaded audio storage cache has been completely cleared.");
    } catch (err) {
      console.error(err);
      alert("An issue occurred while clearing internal storage paths.");
    }
  };

  return (
    <div className="mobile-content set-hide-scrollbar" style={{ paddingBottom: '40px', overflowY: 'auto' }}>
      <style>{settingsScrollbarStyles}</style>

      <div className="view-header" style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
        <button className="back-arrow-btn" onClick={onBack} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}>
          <i className="fa-solid fa-arrow-left" style={{ fontSize: '1.25rem' }}></i>
        </button>
        <h2 className="view-title" style={{ margin: 0 }}>Settings</h2>
      </div>

      <section style={{ marginBottom: '28px', backgroundColor: 'rgba(255, 255, 255, 0.03)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
        <h3 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: '#ffffff', fontWeight: '700' }}>Local Storage Cache</h3>
        <p style={{ margin: '0 0 14px 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Manage your offline tracks space consumption.</p>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px' }}>
          <div>
            <p style={{ margin: '0 0 2px 0', fontSize: '0.9rem', color: '#ffffff', fontWeight: '600' }}>Downloaded Songs</p>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>{cachedCount} tracks available offline</p>
          </div>
          <button 
            onClick={handleClearCacheClick}
            style={{
              backgroundColor: '#ff4d4d', color: '#ffffff', border: 'none', borderRadius: '6px',
              padding: '8px 14px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer',
              transition: 'opacity 0.2s', opacity: cachedCount === 0 ? 0.4 : 1
            }}
          >
            Clear Downloads
          </button>
        </div>
      </section>

      <section style={{ marginBottom: '28px', backgroundColor: 'rgba(255, 255, 255, 0.03)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
        <h3 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: '#ffffff', fontWeight: '700' }}>Streaming Quality</h3>
        <p style={{ margin: '0 0 14px 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Higher quality sounds better but uses more data.</p>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {STREAMING_QUALITY_OPTIONS.map((quality) => (
            <button
              key={quality}
              onClick={() => handleSelectStreamingQuality(quality)}
              style={{
                flex: '1 1 auto', minWidth: '80px', padding: '10px 8px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                fontWeight: '600', fontSize: '0.85rem',
                backgroundColor: streamingQuality === quality ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
                color: streamingQuality === quality ? '#000000' : '#ffffff'
              }}
            >
              {quality}
            </button>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: '28px', backgroundColor: 'rgba(255, 255, 255, 0.03)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
        <h3 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: '#ffffff', fontWeight: '700' }}>Download Quality</h3>
        <p style={{ margin: '0 0 14px 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Higher quality downloads take up more storage space.</p>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {DOWNLOAD_QUALITY_OPTIONS.map((quality) => (
            <button
              key={quality}
              onClick={() => handleSelectDownloadQuality(quality)}
              style={{
                flex: '1 1 auto', minWidth: '80px', padding: '10px 8px', borderRadius: '10px', border: 'none', cursor: 'pointer',
                fontWeight: '600', fontSize: '0.85rem',
                backgroundColor: downloadQuality === quality ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
                color: downloadQuality === quality ? '#000000' : '#ffffff'
              }}
            >
              {quality}
            </button>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: '28px', backgroundColor: 'rgba(255, 255, 255, 0.03)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
        <h3 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: '#ffffff', fontWeight: '700' }}>Accent Color</h3>
        <p style={{ margin: '0 0 14px 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Choose the highlight color used across Sonara.</p>

        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
          {[
            { name: 'Green', hex: '#1db954' },
            { name: 'Blue', hex: '#3b82f6' },
            { name: 'Purple', hex: '#a855f7' },
            { name: 'Pink', hex: '#ec4899' },
            { name: 'Orange', hex: '#f97316' },
            { name: 'Red', hex: '#ef4444' },
          ].map((swatch) => (
            <button
              key={swatch.hex}
              onClick={() => setAppTheme(swatch.hex)}
              title={swatch.name}
              style={{
                width: '36px', height: '36px', borderRadius: '50%', backgroundColor: swatch.hex,
                border: appTheme === swatch.hex ? '3px solid #ffffff' : '3px solid transparent',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: appTheme === swatch.hex ? `0 0 0 2px ${swatch.hex}` : 'none'
              }}
            >
              {appTheme === swatch.hex && <i className="fa-solid fa-check" style={{ color: '#000', fontSize: '0.8rem' }}></i>}
            </button>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: '28px', backgroundColor: 'rgba(255, 255, 255, 0.03)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
        <h3 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: '#ffffff', fontWeight: '700' }}>Lyrics Text Size</h3>
        <p style={{ margin: '0 0 14px 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Adjust readability in the full lyrics view.</p>

        <div style={{ display: 'flex', gap: '10px' }}>
          {['Small', 'Normal', 'Large'].map((size) => (
            <button
              key={size}
              onClick={() => setLyricsSize(size)}
              style={{
                flex: 1, padding: '10px 0', borderRadius: '10px', border: 'none', cursor: 'pointer',
                fontWeight: '600', fontSize: '0.85rem',
                backgroundColor: lyricsSize === size ? 'var(--accent)' : 'rgba(255,255,255,0.06)',
                color: lyricsSize === size ? '#000000' : '#ffffff'
              }}
            >
              {size}
            </button>
          ))}
        </div>
      </section>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* 🌟 Crossfade / Gapless Playback Toggle */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <p style={{ margin: '0 0 2px 0', color: '#ffffff', fontSize: '0.95rem', fontWeight: '600' }}>Crossfade / Gapless Playback</p>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Blend song transitions seamlessly.</p>
          </div>
          <input 
            type="checkbox" 
            checked={!!crossfadeEnabled} 
            onChange={(e) => {
              setCrossfadeEnabled(e.target.checked);
              try { localStorage.setItem('sonara_crossfade', e.target.checked); } catch (err) {}
            }} 
            style={{ width: '20px', height: '20px', accentColor: 'var(--accent)', cursor: 'pointer' }} 
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ margin: '0 0 2px 0', color: '#ffffff', fontSize: '0.95rem', fontWeight: '600' }}>High Contrast Mode</p>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Maximizes workspace layout reading legibility.</p>
          </div>
          <input type="checkbox" checked={increaseContrast} onChange={(e) => setIncreaseContrast(e.target.checked)} style={{ width: '40px', height: '20px', cursor: 'pointer' }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ margin: '0 0 2px 0', color: '#ffffff', fontSize: '0.95rem', fontWeight: '600' }}>Enable Motion Effects</p>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Toggles fluent fluid transitions across subviews.</p>
          </div>
          <input type="checkbox" checked={motionEnabled} onChange={(e) => setMotionEnabled(e.target.checked)} style={{ width: '40px', height: '20px', cursor: 'pointer' }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ margin: '0 0 2px 0', color: '#ffffff', fontSize: '0.95rem', fontWeight: '600' }}>Content Restrictions</p>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Hide explicit and unverified metadata layers.</p>
          </div>
          <input type="checkbox" checked={contentRestrictions} onChange={(e) => setContentRestrictions(e.target.checked)} style={{ width: '40px', height: '20px', cursor: 'pointer' }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ margin: '0 0 2px 0', color: '#ffffff', fontSize: '0.95rem', fontWeight: '600' }}>Automated Diagnostics</p>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>Silently telemetry dispatch reports directly to core hubs.</p>
          </div>
          <input type="checkbox" checked={automaticallySendDiagnostics} onChange={(e) => setAutomaticallySendDiagnostics(e.target.checked)} style={{ width: '40px', height: '20px', cursor: 'pointer' }} />
        </div>

      </div>

      <div style={{ marginTop: '48px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px', textAlign: 'center' }}>
        <p style={{ margin: '0 0 4px 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Sonara Player System Infrastructure Framework</p>
        <p style={{ margin: 0, fontSize: '0.7rem', color: 'rgba(255,255,255,0.2)', fontWeight: '700', letterSpacing: '0.5px' }}>VERSION {currentVersion}</p>
      </div>
    </div>
  );
}

const settingsScrollbarStyles = `
  .set-hide-scrollbar::-webkit-scrollbar { display: none; }
  .set-hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
`;