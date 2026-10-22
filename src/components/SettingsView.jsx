import React, { useState, useEffect } from 'react';
import { clearAllLocalCache, getTotalStorageUsage } from '../utils/offlineStorage';
import {
  STREAMING_QUALITY_OPTIONS,
  DOWNLOAD_QUALITY_OPTIONS,
  getStreamingQuality,
  setStreamingQuality,
  getDownloadQuality,
  setDownloadQuality,
} from '../utils/audioQuality';
import {
  triggerHaptic,
  runSmartCacheCleanup,
  requestScreenWakeLock,
  releaseScreenWakeLock,
  setPlaybackSpeedSetting,
  setEqPresetSetting,
  setSpatialAudioSetting,
  setNormalizeVolumeSetting,
  setOfflineOnlyModeSetting,
  setAutoplayInfiniteSetting,
  setHapticsSetting
} from '../utils/audioEffects';
import { DARK_THEMES, LIGHT_THEMES, APP_THEMES } from '../utils/themes';
import { CURRENT_APP_VERSION, CURRENT_APP_BUILD } from '../utils/updateService';

const STREAMING_BITRATES = {
  'Data Saver': '96 kbps',
  'Normal': '160 kbps',
  'High': '256 kbps',
  'Very High': '320 kbps (Lossless)'
};

const DOWNLOAD_BITRATES = {
  'Normal': '160 kbps',
  'High': '256 kbps',
  'Very High': '320 kbps (Lossless)'
};

const EQ_PRESETS = ['Off', 'Flat', 'Bass Boost', 'Vocal Boost', 'Acoustic', 'Treble Boost'];
const PLAYBACK_SPEEDS = ['0.8x', '0.9x', '1.0x', '1.2x', '1.5x'];
const SLEEP_TIMER_OPTIONS = ['Off', '15 min', '30 min', '45 min', '60 min', 'End of Song'];
const CROSSFADE_DURATIONS = ['Off', '3s', '5s', '8s'];

export default function SettingsView({
  contentRestrictions, setContentRestrictions,
  appTheme, setAppTheme,
  themeId = 'dark_emerald', onSelectTheme,
  motionEnabled, setMotionEnabled,
  lyricsSize, setLyricsSize,
  increaseContrast, setIncreaseContrast,
  automaticallySendDiagnostics, setAutomaticallySendDiagnostics,
  crossfadeEnabled, setCrossfadeEnabled,
  playbackSpeed = '1.0x', setPlaybackSpeed,
  normalizeVolume = true, setNormalizeVolume,
  offlineOnlyMode = false, setOfflineOnlyMode,
  autoplayInfinite = true, setAutoplayInfinite,
  spatialAudio = false, setSpatialAudio,
  hapticsEnabled = true, setHapticsEnabled,
  eqPreset = 'Flat', setEqPreset,
  sleepTimeLeft = null, onSetSleepTimer,
  songs = [],
  currentVersion = CURRENT_APP_VERSION,
  onBack
}) {
  const [cachedCount, setCachedCount] = useState(0);
  const [storageBytes, setStorageBytes] = useState(0);
  const [toastMessage, setToastMessage] = useState(null);

  // Audio Quality
  const [streamingQuality, setStreamingQualityState] = useState(getStreamingQuality);
  const [downloadQuality, setDownloadQualityState] = useState(getDownloadQuality);

  // Feature States
  const [crossfadeDuration, setCrossfadeDuration] = useState(() => {
    return localStorage.getItem('sonara_crossfade_duration') || (crossfadeEnabled ? '3s' : 'Off');
  });
  const [smartCache, setSmartCache] = useState(() => localStorage.getItem('sonara_smart_cache') !== 'false');
  const [autoScrollLyrics, setAutoScrollLyrics] = useState(() => localStorage.getItem('sonara_lyrics_autoscroll') !== 'false');
  const [keepScreenAwake, setKeepScreenAwake] = useState(() => localStorage.getItem('sonara_keep_awake') === 'true');
  const [originIslandActive, setOriginIslandActive] = useState(() => localStorage.getItem('sonara_origin_island_enabled') !== 'false');

  const displayToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const refreshStorageStats = () => {
    let count = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('offline_track_')) count++;
    }
    setCachedCount(count);
    setStorageBytes(getTotalStorageUsage());
  };

  useEffect(() => {
    refreshStorageStats();
  }, [songs]);

  const handleSelectStreamingQuality = (quality) => {
    triggerHaptic(20);
    setStreamingQualityState(quality);
    setStreamingQuality(quality);
    displayToast(`Streaming set to ${quality} (${STREAMING_BITRATES[quality] || ''})`);
  };

  const handleSelectDownloadQuality = (quality) => {
    triggerHaptic(20);
    setDownloadQualityState(quality);
    setDownloadQuality(quality);
    displayToast(`Download quality set to ${quality} (${DOWNLOAD_BITRATES[quality] || ''})`);
  };

  const handleSelectEq = (preset) => {
    triggerHaptic(25);
    setEqPresetSetting(preset);
    setEqPreset?.(preset);
    displayToast(preset === 'Off' ? 'Equalizer turned off (Bypass)' : `Equalizer profile: ${preset}`);
  };

  const handleSelectPlaybackSpeed = (speed) => {
    triggerHaptic(25);
    setPlaybackSpeedSetting(speed);
    setPlaybackSpeed?.(speed);
    displayToast(`Playback tempo: ${speed}`);
  };

  const handleSelectSleepTimer = (timer) => {
    triggerHaptic(25);
    if (timer === 'Off') {
      onSetSleepTimer?.(null);
      displayToast('Sleep timer turned off');
    } else if (timer === 'End of Song') {
      onSetSleepTimer?.('end_of_song');
      displayToast('Playback will stop at the end of this song');
    } else {
      const mins = parseInt(timer, 10);
      onSetSleepTimer?.(mins);
      displayToast(`Sleep timer set: stopping in ${mins} minutes`);
    }
  };

  const handleSelectCrossfadeDuration = (duration) => {
    triggerHaptic(20);
    setCrossfadeDuration(duration);
    localStorage.setItem('sonara_crossfade_duration', duration);
    if (duration === 'Off') {
      setCrossfadeEnabled?.(false);
      localStorage.setItem('sonara_crossfade', 'false');
    } else {
      setCrossfadeEnabled?.(true);
      localStorage.setItem('sonara_crossfade', 'true');
    }
    displayToast(`Crossfade transition: ${duration}`);
  };

  const handleToggleSmartCache = (checked) => {
    triggerHaptic(20);
    setSmartCache(checked);
    localStorage.setItem('sonara_smart_cache', String(checked));
    if (checked) {
      const cleaned = runSmartCacheCleanup();
      refreshStorageStats();
      displayToast(cleaned > 0 ? `Smart Storage: Purged ${cleaned} orphaned cache records` : 'Smart Storage enabled: Cache healthy');
    } else {
      displayToast('Smart storage optimization paused');
    }
  };

  const handleToggleKeepAwake = async (checked) => {
    triggerHaptic(20);
    setKeepScreenAwake(checked);
    localStorage.setItem('sonara_keep_awake', String(checked));
    if (checked) {
      const success = await requestScreenWakeLock();
      displayToast(success ? "Screen will stay awake during playback" : "Screen wake-lock activated");
    } else {
      releaseScreenWakeLock();
      displayToast("Screen timeout restored to system default");
    }
  };

  const handleToggleAutoScroll = (checked) => {
    triggerHaptic(20);
    setAutoScrollLyrics(checked);
    localStorage.setItem('sonara_lyrics_autoscroll', String(checked));
    displayToast(checked ? "Synchronized lyrics auto-scroll active" : "Manual lyric scrolling active");
  };

  const handleToggleOriginIsland = (checked) => {
    triggerHaptic(20);
    setOriginIslandActive(checked);
    localStorage.setItem('sonara_origin_island_enabled', String(checked));
    displayToast(checked ? "Origin Island active on minimization" : "Background Island capsule paused");
  };

  const handleClearCacheClick = async () => {
    triggerHaptic(30);
    if (cachedCount === 0) {
      displayToast("No offline tracks to clear.");
      return;
    }

    const confirmWipe = window.confirm(
      `Delete all ${cachedCount} locally saved tracks? You will need internet connectivity to stream them again.`
    );
    if (!confirmWipe) return;

    try {
      await clearAllLocalCache();
      refreshStorageStats();
      displayToast("All downloaded tracks cleared!");
    } catch (err) {
      console.error(err);
      displayToast("Error clearing internal storage.");
    }
  };

  const handleClearSearchHistory = () => {
    triggerHaptic(25);
    try {
      localStorage.removeItem('sonara_recent_searches');
      displayToast("Search history & cache cleared!");
    } catch {
      displayToast("Search history cleared.");
    }
  };

  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb > 1024) return `${(mb / 1024).toFixed(2)} GB`;
    return `${mb.toFixed(1)} MB`;
  };

  // Compute active sleep timer label
  const isSleepTimerActive = sleepTimeLeft !== null;

  return (
    <div className="mobile-content set-hide-scrollbar" style={{ padding: 'calc(env(safe-area-inset-top, 0px) + 20px) 20px calc(env(safe-area-inset-bottom, 0px) + 80px)', overflowY: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none', position: 'relative' }}>
      <style>{settingsScrollbarStyles}</style>

      {/* 🌟 Ambient Backdrop Glow */}
      <div className="ambient-backdrop-glow" style={{ '--ambient-glow-color': 'rgba(29, 185, 84, 0.22)', top: '-25px' }}></div>

      {toastMessage && (
        <div style={{
          position: 'fixed', top: 'calc(env(safe-area-inset-top, 0px) + 24px)', left: '20px', right: '20px', zIndex: 9999,
          backgroundColor: '#0d2218', border: '1px solid var(--accent)', borderRadius: '14px',
          padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.6)', animation: 'slideDownToast 0.25s ease'
        }}>
          <i className="fa-solid fa-circle-check" style={{ color: 'var(--accent)', fontSize: '1rem' }}></i>
          <span style={{ fontSize: '0.84rem', fontWeight: '600', color: '#ffffff' }}>{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', position: 'relative', zIndex: 1 }}>
        <button
          onClick={() => {
            triggerHaptic(20);
            onBack();
          }}
          style={{
            width: '40px', height: '40px', borderRadius: '50%',
            backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)',
            color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', fontSize: '0.95rem'
          }}
          aria-label="Back"
        >
          <i className="fa-solid fa-arrow-left"></i>
        </button>

        <div style={{ textAlign: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800', color: '#ffffff', letterSpacing: '-0.3px' }}>
            Settings
          </h2>
          <span style={{ fontSize: '0.72rem', color: 'var(--accent)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            Preferences & Playback
          </span>
        </div>

        <div style={{ width: '40px' }}></div>
      </div>

      {/* ===================================================================
          1. OFFLINE STORAGE & DATA CACHE
          =================================================================== */}
      <div className="settings-glass-card" style={{ position: 'relative', zIndex: 1 }}>
        <div className="settings-card-header">
          <div className="settings-card-icon">
            <i className="fa-solid fa-hard-drive"></i>
          </div>
          <h3 className="settings-card-title">Local Storage & Cache</h3>
        </div>
        <p className="settings-card-desc">
          Manage offline storage footprint and downloaded lossless audio cache.
        </p>

        <div style={{
          backgroundColor: 'rgba(0, 0, 0, 0.25)', border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '14px', padding: '14px', marginBottom: '14px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div>
            <p style={{ margin: '0 0 2px 0', fontSize: '0.92rem', color: '#ffffff', fontWeight: '700' }}>
              Downloaded Songs
            </p>
            <p style={{ margin: 0, fontSize: '0.76rem', color: 'var(--text-muted)' }}>
              {cachedCount} {cachedCount === 1 ? 'track' : 'tracks'} ({formatBytes(storageBytes)})
            </p>
          </div>
          <button
            onClick={handleClearCacheClick}
            disabled={cachedCount === 0}
            style={{
              backgroundColor: cachedCount > 0 ? 'rgba(255, 77, 77, 0.15)' : 'rgba(255, 255, 255, 0.05)',
              border: cachedCount > 0 ? '1px solid rgba(255, 77, 77, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
              color: cachedCount > 0 ? '#ff4d4d' : 'rgba(255, 255, 255, 0.3)',
              borderRadius: '10px', padding: '8px 14px', fontSize: '0.8rem', fontWeight: '700',
              cursor: cachedCount > 0 ? 'pointer' : 'not-allowed', transition: 'all 0.2s ease'
            }}
          >
            Clear Downloads
          </button>
        </div>

        {/* Smart Cache Toggle */}
        <div className="settings-toggle-row">
          <div>
            <p style={{ margin: '0 0 2px 0', color: '#ffffff', fontSize: '0.88rem', fontWeight: '700' }}>Smart Storage Optimization</p>
            <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-muted)' }}>Automatically purge corrupt or orphaned track assets.</p>
          </div>
          <label className="settings-switch-label">
            <input
              type="checkbox"
              checked={smartCache}
              onChange={(e) => handleToggleSmartCache(e.target.checked)}
            />
            <span className="settings-switch-slider"></span>
          </label>
        </div>

        {/* Clear Search History */}
        <div className="settings-toggle-row">
          <div>
            <p style={{ margin: '0 0 2px 0', color: '#ffffff', fontSize: '0.88rem', fontWeight: '700' }}>Search History & Recent Tags</p>
            <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-muted)' }}>Delete saved search history tags from device.</p>
          </div>
          <button
            onClick={handleClearSearchHistory}
            style={{
              background: 'rgba(255, 255, 255, 0.06)', border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#ffffff', borderRadius: '8px', padding: '6px 12px', fontSize: '0.76rem',
              fontWeight: '700', cursor: 'pointer'
            }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* ===================================================================
          2. STREAMING AUDIO QUALITY & OFFLINE-ONLY SHIELD
          =================================================================== */}
      <div className="settings-glass-card" style={{ position: 'relative', zIndex: 1 }}>
        <div className="settings-card-header">
          <div className="settings-card-icon">
            <i className="fa-solid fa-wifi"></i>
          </div>
          <h3 className="settings-card-title">Streaming Quality</h3>
        </div>
        <p className="settings-card-desc">
          Select streaming bitrate. Higher bitrates deliver studio fidelity but use more bandwidth.
        </p>

        <div className="settings-pill-row" style={{ marginBottom: '14px' }}>
          {STREAMING_QUALITY_OPTIONS.map((quality) => {
            const isActive = streamingQuality === quality;
            return (
              <button
                key={quality}
                onClick={() => handleSelectStreamingQuality(quality)}
                className={`settings-pill-btn ${isActive ? 'active' : 'inactive'}`}
              >
                <span>{quality}</span>
                <span className="settings-pill-sub">{STREAMING_BITRATES[quality]}</span>
              </button>
            );
          })}
        </div>

        {/* Offline Mode Only Toggle */}
        <div className="settings-toggle-row">
          <div>
            <p style={{ margin: '0 0 2px 0', color: '#ffffff', fontSize: '0.88rem', fontWeight: '700' }}>Offline Mode Only (Strict Data Saver)</p>
            <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-muted)' }}>Only play downloaded songs; stops all cellular data streaming.</p>
          </div>
          <label className="settings-switch-label">
            <input
              type="checkbox"
              checked={offlineOnlyMode}
              onChange={(e) => {
                triggerHaptic(25);
                setOfflineOnlyModeSetting(e.target.checked);
                setOfflineOnlyMode?.(e.target.checked);
                displayToast(e.target.checked ? "Offline-only mode enabled" : "Cellular streaming enabled");
              }}
            />
            <span className="settings-switch-slider"></span>
          </label>
        </div>
      </div>

      {/* ===================================================================
          3. DOWNLOAD AUDIO QUALITY
          =================================================================== */}
      <div className="settings-glass-card" style={{ position: 'relative', zIndex: 1 }}>
        <div className="settings-card-header">
          <div className="settings-card-icon">
            <i className="fa-solid fa-download"></i>
          </div>
          <h3 className="settings-card-title">Download Quality</h3>
        </div>
        <p className="settings-card-desc">
          Audio quality used when caching songs to internal device storage.
        </p>

        <div className="settings-pill-row">
          {DOWNLOAD_QUALITY_OPTIONS.map((quality) => {
            const isActive = downloadQuality === quality;
            return (
              <button
                key={quality}
                onClick={() => handleSelectDownloadQuality(quality)}
                className={`settings-pill-btn ${isActive ? 'active' : 'inactive'}`}
              >
                <span>{quality}</span>
                <span className="settings-pill-sub">{DOWNLOAD_BITRATES[quality]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ===================================================================
          4. AUDIO PROCESSING, EQUALIZER & TEMPO (CONNECTED ENGINES)
          =================================================================== */}
      <div className="settings-glass-card" style={{ position: 'relative', zIndex: 1 }}>
        <div className="settings-card-header">
          <div className="settings-card-icon">
            <i className="fa-solid fa-sliders"></i>
          </div>
          <h3 className="settings-card-title">Equalizer & Audio Processing</h3>
        </div>
        <p className="settings-card-desc">
          Tune acoustics and playback speed to match your listening preferences.
        </p>

        {/* EQ Presets */}
        <p style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: 'var(--accent)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
          Equalizer Sound Profile
        </p>
        <div className="settings-pill-row" style={{ marginBottom: '16px' }}>
          {EQ_PRESETS.map((preset) => {
            const isActive = eqPreset === preset;
            return (
              <button
                key={preset}
                onClick={() => handleSelectEq(preset)}
                className={`settings-pill-btn ${isActive ? 'active' : 'inactive'}`}
                style={{ minWidth: '70px', padding: '8px 10px' }}
              >
                <span>{preset}</span>
              </button>
            );
          })}
        </div>

        {/* Playback Speed / Tempo */}
        <p style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: 'var(--accent)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
          Playback Tempo / Speed
        </p>
        <div className="settings-pill-row" style={{ marginBottom: '16px' }}>
          {PLAYBACK_SPEEDS.map((speed) => {
            const isActive = playbackSpeed === speed;
            return (
              <button
                key={speed}
                onClick={() => handleSelectPlaybackSpeed(speed)}
                className={`settings-pill-btn ${isActive ? 'active' : 'inactive'}`}
                style={{ minWidth: '55px', padding: '8px 6px' }}
              >
                <span>{speed}</span>
              </button>
            );
          })}
        </div>

        {/* 3D Spatial Audio Immersion */}
        <div className="settings-toggle-row">
          <div>
            <p style={{ margin: '0 0 2px 0', color: '#ffffff', fontSize: '0.88rem', fontWeight: '700' }}>3D Spatial Audio Immersion</p>
            <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-muted)' }}>Simulates wide concert-hall soundstage for stereo earphones.</p>
          </div>
          <label className="settings-switch-label">
            <input
              type="checkbox"
              checked={spatialAudio}
              onChange={(e) => {
                triggerHaptic(20);
                setSpatialAudioSetting(e.target.checked);
                setSpatialAudio?.(e.target.checked);
                displayToast(`3D Spatial Audio ${e.target.checked ? 'activated' : 'off'}`);
              }}
            />
            <span className="settings-switch-slider"></span>
          </label>
        </div>

        {/* Continuous Autoplay */}
        <div className="settings-toggle-row">
          <div>
            <p style={{ margin: '0 0 2px 0', color: '#ffffff', fontSize: '0.88rem', fontWeight: '700' }}>Autoplay Similar Music</p>
            <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-muted)' }}>Keep music playing with similar songs when your queue ends.</p>
          </div>
          <label className="settings-switch-label">
            <input
              type="checkbox"
              checked={autoplayInfinite}
              onChange={(e) => {
                triggerHaptic(20);
                setAutoplayInfiniteSetting(e.target.checked);
                setAutoplayInfinite?.(e.target.checked);
                displayToast(`Continuous autoplay ${e.target.checked ? 'enabled' : 'disabled'}`);
              }}
            />
            <span className="settings-switch-slider"></span>
          </label>
        </div>

        {/* Volume Normalization */}
        <div className="settings-toggle-row">
          <div>
            <p style={{ margin: '0 0 2px 0', color: '#ffffff', fontSize: '0.88rem', fontWeight: '700' }}>Volume Normalization</p>
            <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-muted)' }}>Maintains consistent loudness across different tracks.</p>
          </div>
          <label className="settings-switch-label">
            <input
              type="checkbox"
              checked={normalizeVolume}
              onChange={(e) => {
                triggerHaptic(20);
                setNormalizeVolumeSetting(e.target.checked);
                setNormalizeVolume?.(e.target.checked);
                displayToast(`Volume normalization ${e.target.checked ? 'enabled' : 'disabled'}`);
              }}
            />
            <span className="settings-switch-slider"></span>
          </label>
        </div>
      </div>

      {/* ===================================================================
          5. CROSSFADE & GAPLESS TRANSITION
          =================================================================== */}
      <div className="settings-glass-card" style={{ position: 'relative', zIndex: 1 }}>
        <div className="settings-card-header">
          <div className="settings-card-icon">
            <i className="fa-solid fa-shuffle"></i>
          </div>
          <h3 className="settings-card-title">Crossfade & Seamless Transitions</h3>
        </div>
        <p className="settings-card-desc">
          Seamlessly blends the end of the current song into the next track.
        </p>

        <div className="settings-pill-row">
          {CROSSFADE_DURATIONS.map((dur) => {
            const isActive = crossfadeDuration === dur;
            return (
              <button
                key={dur}
                onClick={() => handleSelectCrossfadeDuration(dur)}
                className={`settings-pill-btn ${isActive ? 'active' : 'inactive'}`}
              >
                <span>{dur}</span>
                <span className="settings-pill-sub">{dur === 'Off' ? 'No overlap' : 'Smooth blend'}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ===================================================================
          6. ORIGIN ISLAND & BACKGROUND MODE (VIVO / ANDROID)
          =================================================================== */}
      <div className="settings-glass-card" style={{ position: 'relative', zIndex: 1 }}>
        <div className="settings-card-header">
          <div className="settings-card-icon">
            <i className="fa-solid fa-mobile-screen"></i>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 className="settings-card-title">Origin Island Capsule</h3>
            <span style={{ backgroundColor: 'rgba(29, 185, 84, 0.15)', color: 'var(--accent)', fontSize: '0.66rem', fontWeight: '800', padding: '2px 8px', borderRadius: '10px' }}>
              NATIVE
            </span>
          </div>
        </div>
        <p className="settings-card-desc">
          Controls the real-time mini audio capsule in your phone's status island when Sonara is minimized.
        </p>

        <div className="settings-toggle-row">
          <div>
            <p style={{ margin: '0 0 2px 0', color: '#ffffff', fontSize: '0.88rem', fontWeight: '700' }}>Background Island Capsule</p>
            <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-muted)' }}>Displays artwork and playback controls on minimization.</p>
          </div>
          <label className="settings-switch-label">
            <input
              type="checkbox"
              checked={originIslandActive}
              onChange={(e) => handleToggleOriginIsland(e.target.checked)}
            />
            <span className="settings-switch-slider"></span>
          </label>
        </div>
      </div>

      {/* ===================================================================
          7. AUDIO OUTPUT & HARDWARE PIPELINE
          =================================================================== */}
      <div className="settings-glass-card" style={{ position: 'relative', zIndex: 1 }}>
        <div className="settings-card-header">
          <div className="settings-card-icon">
            <i className="fa-solid fa-headphones"></i>
          </div>
          <h3 className="settings-card-title">Audio Output Device</h3>
        </div>
        <div style={{
          backgroundColor: 'rgba(0, 0, 0, 0.25)', border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '14px', padding: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--accent)', boxShadow: '0 0 8px var(--accent)' }}></div>
            <div>
              <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: '700', color: '#ffffff' }}>Active System Audio Route</p>
              <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: 'var(--text-muted)' }}>44.1 kHz • 24-bit PCM Audio Pipeline</p>
            </div>
          </div>
          <span style={{ fontSize: '0.74rem', color: 'var(--accent)', fontWeight: '700' }}>Connected</span>
        </div>
      </div>

      {/* ===================================================================
          8. SLEEP TIMER (SYNCED WITH FULL PLAYER)
          =================================================================== */}
      <div className="settings-glass-card" style={{ position: 'relative', zIndex: 1 }}>
        <div className="settings-card-header" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="settings-card-icon">
              <i className="fa-regular fa-moon"></i>
            </div>
            <h3 className="settings-card-title">Sleep Timer</h3>
          </div>
          {isSleepTimerActive && (
            <span style={{
              backgroundColor: 'rgba(29, 185, 84, 0.16)',
              color: 'var(--accent)',
              fontSize: '0.7rem',
              fontWeight: '800',
              padding: '4px 10px',
              borderRadius: '12px',
              border: '1px solid rgba(29, 185, 84, 0.3)'
            }}>
              {sleepTimeLeft === 'end_of_song' ? 'Ends with song' : `${sleepTimeLeft}m remaining`}
            </span>
          )}
        </div>
        <p className="settings-card-desc">
          Automatically stops audio playback after a specified time interval.
        </p>

        <div className="settings-pill-row">
          {SLEEP_TIMER_OPTIONS.map((timer) => {
            let isActive = false;
            if (timer === 'Off') {
              isActive = sleepTimeLeft === null;
            } else if (timer === 'End of Song') {
              isActive = sleepTimeLeft === 'end_of_song';
            } else {
              const mins = parseInt(timer, 10);
              isActive = sleepTimeLeft === mins;
            }

            return (
              <button
                key={timer}
                onClick={() => handleSelectSleepTimer(timer)}
                className={`settings-pill-btn ${isActive ? 'active' : 'inactive'}`}
                style={{ minWidth: '70px', padding: '8px 10px' }}
              >
                <span>{timer}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ===================================================================
          9. 6-THEME STUDIO: 3 DARK THEMES & 3 LIGHT THEMES
          =================================================================== */}
      <div className="settings-glass-card" style={{ position: 'relative', zIndex: 1 }}>
        <div className="settings-card-header">
          <div className="settings-card-icon">
            <i className="fa-solid fa-palette"></i>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 className="settings-card-title">Theme & Color Studio</h3>
            <span style={{ backgroundColor: 'rgba(29, 185, 84, 0.15)', color: 'var(--accent)', fontSize: '0.66rem', fontWeight: '800', padding: '2px 8px', borderRadius: '10px' }}>
              6 THEMES
            </span>
          </div>
        </div>
        <p className="settings-card-desc">
          Choose from 3 crafted Dark themes and 3 clean Light themes to personalize your Sonara vibe.
        </p>

        {/* 🌙 Dark Themes Category (3 Themes) */}
        <div className="theme-category-header">
          <span className="theme-category-title">
            <i className="fa-solid fa-moon" style={{ color: 'var(--accent)' }}></i>
            Dark Themes
          </span>
          <span className="theme-category-badge">3 Modes</span>
        </div>
        <div className="theme-card-grid">
          {DARK_THEMES.map((theme) => {
            const isSelected = (themeId === theme.id) || (!themeId && appTheme === theme.accent);
            return (
              <div
                key={theme.id}
                onClick={() => {
                  triggerHaptic(25);
                  if (onSelectTheme) onSelectTheme(theme.id);
                  else setAppTheme?.(theme.accent);
                  displayToast(`Theme: ${theme.name}`);
                }}
                className={`theme-select-card ${isSelected ? 'active' : ''}`}
                style={{
                  background: isSelected ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.035)',
                  border: isSelected ? `2px solid ${theme.accent}` : '2px solid transparent'
                }}
              >
                <div
                  className="theme-preview-pill"
                  style={{
                    background: `linear-gradient(135deg, ${theme.appBg} 0%, ${theme.bgSurface} 100%)`,
                    border: isSelected ? `1.5px solid ${theme.accent}` : '1px solid rgba(255,255,255,0.1)'
                  }}
                >
                  <div className="theme-preview-accent-dot" style={{ backgroundColor: theme.accent }}>
                    {isSelected && <i className="fa-solid fa-check" style={{ color: '#000', fontSize: '0.55rem', fontWeight: '900' }}></i>}
                  </div>
                </div>
                <p className="theme-card-name">{theme.name}</p>
                <span className="theme-card-tag">{theme.tag}</span>
              </div>
            );
          })}
        </div>

        {/* ☀️ Light Themes Category (3 Themes) */}
        <div className="theme-category-header">
          <span className="theme-category-title">
            <i className="fa-solid fa-sun" style={{ color: 'var(--accent)' }}></i>
            Light Themes
          </span>
          <span className="theme-category-badge">3 Modes</span>
        </div>
        <div className="theme-card-grid">
          {LIGHT_THEMES.map((theme) => {
            const isSelected = (themeId === theme.id) || (!themeId && appTheme === theme.accent);
            return (
              <div
                key={theme.id}
                onClick={() => {
                  triggerHaptic(25);
                  if (onSelectTheme) onSelectTheme(theme.id);
                  else setAppTheme?.(theme.accent);
                  displayToast(`Theme: ${theme.name}`);
                }}
                className={`theme-select-card ${isSelected ? 'active' : ''}`}
                style={{
                  background: isSelected ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                  border: isSelected ? `2px solid ${theme.accent}` : '2px solid transparent'
                }}
              >
                <div
                  className="theme-preview-pill"
                  style={{
                    background: `linear-gradient(135deg, ${theme.appBg} 0%, ${theme.bgSurface} 100%)`,
                    border: isSelected ? `1.5px solid ${theme.accent}` : '1px solid rgba(255,255,255,0.2)'
                  }}
                >
                  <div className="theme-preview-accent-dot" style={{ backgroundColor: theme.accent }}>
                    {isSelected && <i className="fa-solid fa-check" style={{ color: '#ffffff', fontSize: '0.55rem', fontWeight: '900' }}></i>}
                  </div>
                </div>
                <p className="theme-card-name">{theme.name}</p>
                <span className="theme-card-tag">{theme.tag}</span>
              </div>
            );
          })}
        </div>

        {/* High Contrast */}
        <div className="settings-toggle-row">
          <div>
            <p style={{ margin: '0 0 2px 0', color: '#ffffff', fontSize: '0.88rem', fontWeight: '700' }}>High Contrast Palette</p>
            <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-muted)' }}>Maximizes text readability and borders.</p>
          </div>
          <label className="settings-switch-label">
            <input
              type="checkbox"
              checked={increaseContrast}
              onChange={(e) => {
                triggerHaptic(20);
                try { localStorage.setItem('sonara_increase_contrast', String(e.target.checked)); } catch {}
                setIncreaseContrast?.(e.target.checked);
              }}
            />
            <span className="settings-switch-slider"></span>
          </label>
        </div>

        {/* Motion Effects */}
        <div className="settings-toggle-row">
          <div>
            <p style={{ margin: '0 0 2px 0', color: '#ffffff', fontSize: '0.88rem', fontWeight: '700' }}>Fluid Motion Effects</p>
            <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-muted)' }}>Smooth spring transitions and modal slides.</p>
          </div>
          <label className="settings-switch-label">
            <input
              type="checkbox"
              checked={motionEnabled}
              onChange={(e) => {
                triggerHaptic(20);
                try { localStorage.setItem('sonara_motion_enabled', String(e.target.checked)); } catch {}
                setMotionEnabled?.(e.target.checked);
              }}
            />
            <span className="settings-switch-slider"></span>
          </label>
        </div>

        {/* Tactile Haptics */}
        <div className="settings-toggle-row">
          <div>
            <p style={{ margin: '0 0 2px 0', color: '#ffffff', fontSize: '0.88rem', fontWeight: '700' }}>Tactile Haptic Feedback</p>
            <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-muted)' }}>Subtle tactile vibration feedback on button presses.</p>
          </div>
          <label className="settings-switch-label">
            <input
              type="checkbox"
              checked={hapticsEnabled}
              onChange={(e) => {
                if (e.target.checked) triggerHaptic(35);
                setHapticsSetting(e.target.checked);
                setHapticsEnabled?.(e.target.checked);
                displayToast(`Haptics ${e.target.checked ? 'enabled' : 'disabled'}`);
              }}
            />
            <span className="settings-switch-slider"></span>
          </label>
        </div>
      </div>

      {/* ===================================================================
          10. LYRICS DISPLAY & SIZING
          =================================================================== */}
      <div className="settings-glass-card" style={{ position: 'relative', zIndex: 1 }}>
        <div className="settings-card-header">
          <div className="settings-card-icon">
            <i className="fa-solid fa-microphone-lines"></i>
          </div>
          <h3 className="settings-card-title">Lyrics Display</h3>
        </div>
        <p className="settings-card-desc">
          Adjust lyrics typography and synchronized scrolling behavior.
        </p>

        {/* Sizing Pills */}
        <div className="settings-pill-row" style={{ marginBottom: '14px' }}>
          {[
            { label: 'Small', desc: '14px' },
            { label: 'Normal', desc: '18px' },
            { label: 'Large', desc: '22px' }
          ].map((item) => {
            const isActive = lyricsSize === item.label;
            return (
              <button
                key={item.label}
                onClick={() => {
                  triggerHaptic(20);
                  try { localStorage.setItem('sonara_lyrics_size', item.label); } catch {}
                  setLyricsSize?.(item.label);
                }}
                className={`settings-pill-btn ${isActive ? 'active' : 'inactive'}`}
              >
                <span>{item.label}</span>
                <span className="settings-pill-sub">{item.desc}</span>
              </button>
            );
          })}
        </div>

        {/* Live Lyrics Preview Box */}
        <div style={{
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '12px',
          padding: '14px',
          marginBottom: '14px',
          textAlign: 'center'
        }}>
          <p style={{
            margin: 0,
            fontSize: lyricsSize === 'Small' ? '0.88rem' : lyricsSize === 'Large' ? '1.25rem' : '1.05rem',
            color: 'var(--accent)',
            fontWeight: '700',
            transition: 'font-size 0.2s ease',
            lineHeight: 1.4
          }}>
            ♪ En Iniya Pon Nilaave...
          </p>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Lyrics typography preview</span>
        </div>

        {/* Auto Scroll Toggle */}
        <div className="settings-toggle-row">
          <div>
            <p style={{ margin: '0 0 2px 0', color: '#ffffff', fontSize: '0.88rem', fontWeight: '700' }}>Synchronized Auto-Scroll</p>
            <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-muted)' }}>Follow current song lyric position automatically.</p>
          </div>
          <label className="settings-switch-label">
            <input
              type="checkbox"
              checked={autoScrollLyrics}
              onChange={(e) => handleToggleAutoScroll(e.target.checked)}
            />
            <span className="settings-switch-slider"></span>
          </label>
        </div>

        {/* Keep Screen On */}
        <div className="settings-toggle-row">
          <div>
            <p style={{ margin: '0 0 2px 0', color: '#ffffff', fontSize: '0.88rem', fontWeight: '700' }}>Keep Screen Awake</p>
            <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-muted)' }}>Prevent device sleep while reading lyrics.</p>
          </div>
          <label className="settings-switch-label">
            <input
              type="checkbox"
              checked={keepScreenAwake}
              onChange={(e) => handleToggleKeepAwake(e.target.checked)}
            />
            <span className="settings-switch-slider"></span>
          </label>
        </div>
      </div>

      {/* ===================================================================
          11. PRIVACY & CONTENT FILTER
          =================================================================== */}
      <div className="settings-glass-card" style={{ position: 'relative', zIndex: 1 }}>
        <div className="settings-card-header">
          <div className="settings-card-icon">
            <i className="fa-solid fa-shield-halved"></i>
          </div>
          <h3 className="settings-card-title">Privacy & Content Safety</h3>
        </div>

        <div className="settings-toggle-row">
          <div>
            <p style={{ margin: '0 0 2px 0', color: '#ffffff', fontSize: '0.88rem', fontWeight: '700' }}>Content Restrictions</p>
            <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-muted)' }}>Filter unverified tracks or explicit metadata.</p>
          </div>
          <label className="settings-switch-label">
            <input
              type="checkbox"
              checked={contentRestrictions}
              onChange={(e) => {
                triggerHaptic(20);
                try { localStorage.setItem('sonara_content_restrictions', String(e.target.checked)); } catch {}
                setContentRestrictions?.(e.target.checked);
              }}
            />
            <span className="settings-switch-slider"></span>
          </label>
        </div>

        <div className="settings-toggle-row">
          <div>
            <p style={{ margin: '0 0 2px 0', color: '#ffffff', fontSize: '0.88rem', fontWeight: '700' }}>Anonymous Diagnostics</p>
            <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-muted)' }}>Send anonymous crash logs to improve app stability.</p>
          </div>
          <label className="settings-switch-label">
            <input
              type="checkbox"
              checked={automaticallySendDiagnostics}
              onChange={(e) => {
                triggerHaptic(20);
                try { localStorage.setItem('sonara_diagnostics', String(e.target.checked)); } catch {}
                setAutomaticallySendDiagnostics?.(e.target.checked);
              }}
            />
            <span className="settings-switch-slider"></span>
          </label>
        </div>
      </div>

      {/* ===================================================================
          12. APP INFO FOOTER
          =================================================================== */}
      <div style={{ marginTop: '28px', textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <p style={{ margin: '0 0 4px 0', fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: '600' }}>
          Sonara Cloud Audio Engine
        </p>
        <p style={{ margin: 0, fontSize: '0.74rem', color: 'rgba(255,255,255,0.4)', fontWeight: '700', letterSpacing: '0.8px' }}>
          VERSION {currentVersion} • BUILD 2026.10
        </p>
      </div>
    </div>
  );
}

const settingsScrollbarStyles = `
  .set-hide-scrollbar,
  .set-hide-scrollbar * {
    -ms-overflow-style: none !important;
    scrollbar-width: none !important;
  }
  .set-hide-scrollbar::-webkit-scrollbar,
  .set-hide-scrollbar *::-webkit-scrollbar {
    display: none !important;
    width: 0 !important;
    height: 0 !important;
  }
`;