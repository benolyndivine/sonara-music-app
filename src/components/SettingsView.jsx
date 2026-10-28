import React, { useState, useEffect, useRef } from 'react';
import { clearAllLocalCache, getTotalStorageUsage, runSmartStorageOptimization } from '../utils/offlineStorage';
import {
  STREAMING_QUALITY_OPTIONS,
  DOWNLOAD_QUALITY_OPTIONS,
  getStreamingQuality,
  setStreamingQuality,
  getDownloadQuality,
  setDownloadQuality,
  QUALITY_LABELS
} from '../utils/audioQuality';
import {
  triggerHaptic,
  requestScreenWakeLock,
  releaseScreenWakeLock,
  setPlaybackSpeedSetting,
  setEqPresetSetting,
  setSpatialAudioSetting,
  setNormalizeVolumeSetting,
  setOfflineOnlyModeSetting,
  setAutoplayInfiniteSetting,
  setHapticsSetting,
  getDolbyAtmosSetting,
  setDolbyAtmosSetting,
  getCustomEqBands,
  setCustomEqBands,
  getCrossfadeSetting,
  setCrossfadeSetting,
  getCrossfadeDurationSetting,
  setCrossfadeDurationSetting,
  getGaplessPlaybackSetting,
  setGaplessPlaybackSetting,
  getAutomixSetting,
  setAutomixSetting,
  EQ_BANDS,
  EQ_PRESET_CONFIGS,
  sonaraAudioEngine,
  NativeAudioEffects
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

const EQ_PRESETS = ['Flat', 'Bass Boost', 'Vocal Boost', 'Acoustic', 'Treble Boost', 'Dolby Cinema', 'Electronic', 'Off'];
const PLAYBACK_SPEEDS = ['0.8x', '0.9x', '1.0x', '1.2x', '1.5x'];
const SLEEP_TIMER_OPTIONS = ['Off', '15 min', '30 min', '45 min', '60 min', 'End of Song'];
const CROSSFADE_DURATIONS = ['Off', '3s', '5s', '8s', '12s'];

export default function SettingsView({
  contentRestrictions, setContentRestrictions,
  appTheme, setAppTheme,
  themeId = 'dark_emerald', onSelectTheme,
  motionEnabled, setMotionEnabled,
  lyricsSize, setLyricsSize,
  increaseContrast, setIncreaseContrast,
  automaticallySendDiagnostics, setAutomaticallySendDiagnostics,
  crossfadeEnabled, setCrossfadeEnabled,
  crossfadeDuration: crossfadeDurationProp, setCrossfadeDuration: setCrossfadeDurationProp,
  gaplessPlayback: gaplessPlaybackProp, setGaplessPlayback: setGaplessPlaybackProp,
  automixEnabled: automixEnabledProp, setAutomixEnabled: setAutomixEnabledProp,
  playbackSpeed = '1.0x', setPlaybackSpeed,
  normalizeVolume = true, setNormalizeVolume,
  offlineOnlyMode = false, setOfflineOnlyMode,
  autoplayInfinite = true, setAutoplayInfinite,
  spatialAudio = false, setSpatialAudio,
  dolbyAtmos: dolbyAtmosProp, setDolbyAtmos: setDolbyAtmosProp,
  hapticsEnabled = true, setHapticsEnabled,
  eqPreset = 'Flat', setEqPreset,
  sleepTimeLeft = null, onSetSleepTimer,
  songs = [],
  currentVersion = CURRENT_APP_VERSION,
  streamingQuality: streamingQualityProp,
  setStreamingQuality: setStreamingQualityProp,
  downloadQuality: downloadQualityProp,
  setDownloadQuality: setDownloadQualityProp,
  originIslandActive: originIslandActiveProp,
  setOriginIslandActive: setOriginIslandActiveProp,
  onBack
}) {
  const [cachedCount, setCachedCount] = useState(0);
  const [storageBytes, setStorageBytes] = useState(0);
  const [toastMessage, setToastMessage] = useState(null);
  const [isOptimizing, setIsOptimizing] = useState(false);

  // Audio Quality
  const [internalStreamingQuality, setInternalStreamingQuality] = useState(getStreamingQuality);
  const [internalDownloadQuality, setInternalDownloadQuality] = useState(getDownloadQuality);

  const streamingQuality = streamingQualityProp || internalStreamingQuality;
  const downloadQuality = downloadQualityProp || internalDownloadQuality;

  // Crossfade & Seamless Transition States
  const [crossfadeDuration, setCrossfadeDuration] = useState(() => {
    return crossfadeDurationProp || getCrossfadeDurationSetting();
  });
  const [gaplessPlayback, setGaplessPlaybackState] = useState(() => {
    return gaplessPlaybackProp !== undefined ? gaplessPlaybackProp : getGaplessPlaybackSetting();
  });
  const [automixEnabled, setAutomixEnabledState] = useState(() => {
    return automixEnabledProp !== undefined ? automixEnabledProp : getAutomixSetting();
  });

  const setGaplessPlayback = (val) => {
    setGaplessPlaybackState(val);
    setGaplessPlaybackSetting(val);
    setGaplessPlaybackProp?.(val);
  };

  const setAutomixEnabled = (val) => {
    setAutomixEnabledState(val);
    setAutomixSetting(val);
    setAutomixEnabledProp?.(val);
  };

  // Dolby Atmos & Equalizer State
  const [dolbyAtmos, setDolbyAtmosState] = useState(() => {
    return dolbyAtmosProp !== undefined ? dolbyAtmosProp : getDolbyAtmosSetting();
  });
  const [customBands, setCustomBands] = useState(getCustomEqBands);
  const spectrumBarsRef = useRef([]);

  useEffect(() => {
    if (dolbyAtmosProp !== undefined) {
      setDolbyAtmosState(dolbyAtmosProp);
    }
  }, [dolbyAtmosProp]);

  // Keep custom bands in sync when eqPreset prop changes
  useEffect(() => {
    if (eqPreset && EQ_PRESET_CONFIGS[eqPreset]) {
      setCustomBands([...EQ_PRESET_CONFIGS[eqPreset]]);
    }
  }, [eqPreset]);

  // Real-time Audio Spectrum loop for the live equalizer visualizer
  useEffect(() => {
    let animId;
    let isMounted = true;
    const updateSpectrum = () => {
      if (!isMounted) return;
      const data = sonaraAudioEngine.getFrequencyData();
      if (data && spectrumBarsRef.current) {
        const bars = spectrumBarsRef.current;
        for (let i = 0; i < bars.length; i++) {
          const el = bars[i];
          if (el) {
            const sampleIdx = Math.floor((i / bars.length) * (data.length / 2));
            const val = data[sampleIdx] || 0;
            const barHeight = Math.max(3, (val / 255) * 55);
            el.setAttribute('height', `${barHeight.toFixed(1)}`);
            el.setAttribute('y', `${(100 - barHeight).toFixed(1)}`);
          }
        }
      }
      animId = requestAnimationFrame(updateSpectrum);
    };
    animId = requestAnimationFrame(updateSpectrum);
    return () => {
      isMounted = false;
      cancelAnimationFrame(animId);
    };
  }, []);

  // Feature States
  const [smartCache, setSmartCache] = useState(() => localStorage.getItem('sonara_smart_cache') !== 'false');
  const [autoScrollLyrics, setAutoScrollLyrics] = useState(() => localStorage.getItem('sonara_lyrics_autoscroll') !== 'false');
  const [keepScreenAwake, setKeepScreenAwake] = useState(() => localStorage.getItem('sonara_keep_awake') === 'true');
  const [originIslandActive, setOriginIslandActiveState] = useState(() => {
    return originIslandActiveProp !== undefined ? originIslandActiveProp : (localStorage.getItem('sonara_origin_island_enabled') !== 'false');
  });

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
    setStreamingQuality(quality);
    setInternalStreamingQuality(quality);
    setStreamingQualityProp?.(quality);
    displayToast(`Streaming set to ${quality} (${STREAMING_BITRATES[quality] || ''})`);
  };

  const handleSelectDownloadQuality = (quality) => {
    triggerHaptic(20);
    setDownloadQuality(quality);
    setInternalDownloadQuality(quality);
    setDownloadQualityProp?.(quality);
    displayToast(`Download quality set to ${quality} (${DOWNLOAD_BITRATES[quality] || ''})`);
  };

  const handleSelectEq = (preset) => {
    triggerHaptic(25);
    setEqPresetSetting(preset);
    setEqPreset?.(preset);
    if (EQ_PRESET_CONFIGS[preset]) {
      const presetBands = [...EQ_PRESET_CONFIGS[preset]];
      setCustomBands(presetBands);
      setCustomEqBands(presetBands);
    }
    displayToast(preset === 'Off' ? 'Equalizer turned off (Bypass)' : `Equalizer profile: ${preset}`);
  };

  const handleBandSliderChange = (bandIndex, newValue) => {
    const val = parseFloat(newValue);
    const updated = [...customBands];
    updated[bandIndex] = val;
    setCustomBands(updated);
    setCustomEqBands(updated);
    setEqPreset?.('Custom');
    localStorage.setItem('sonara_eq_preset', 'Custom');
  };

  const handleToggleDolbyAtmos = (checked) => {
    triggerHaptic(25);
    setDolbyAtmosState(checked);
    setDolbyAtmosSetting(checked);
    setDolbyAtmosProp?.(checked);
    displayToast(checked ? 'Dolby Atmos 3D Surround Activated' : 'Dolby Atmos Surround Off');
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
    setCrossfadeDurationSetting(duration);
    setCrossfadeDurationProp?.(duration);
    if (duration === 'Off') {
      setCrossfadeEnabled?.(false);
      setCrossfadeSetting(false);
      displayToast('Crossfade turned off (Gapless transition active)');
    } else {
      setCrossfadeEnabled?.(true);
      setCrossfadeSetting(true);
      displayToast(`Crossfade transition: ${duration}`);
    }
  };

  const handleRunOptimization = async () => {
    triggerHaptic(25);
    setIsOptimizing(true);
    try {
      const res = await runSmartStorageOptimization({ songs });
      refreshStorageStats();
      displayToast(res.details || 'Storage optimized: Cache healthy');
    } catch (err) {
      console.warn('Storage optimization error:', err);
      displayToast('Storage scan completed');
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleToggleSmartCache = async (checked) => {
    triggerHaptic(20);
    setSmartCache(checked);
    localStorage.setItem('sonara_smart_cache', String(checked));
    if (checked) {
      setIsOptimizing(true);
      try {
        const res = await runSmartStorageOptimization({ songs });
        refreshStorageStats();
        displayToast(res.details || 'Smart Storage enabled: Cache healthy');
      } catch (_) {
        displayToast('Smart Storage enabled');
      } finally {
        setIsOptimizing(false);
      }
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
    setOriginIslandActiveState(checked);
    localStorage.setItem('sonara_origin_island_enabled', String(checked));
    setOriginIslandActiveProp?.(checked);
    displayToast(checked ? "Origin Island capsule activated" : "Origin Island capsule paused");
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

  // Equalizer interactive curve points
  const eqXCoords = [32, 96, 160, 224, 288];
  const eqYCoords = customBands.map(gain => {
    const clamped = Math.max(-12, Math.min(12, gain || 0));
    return 60 - (clamped / 12) * 44;
  });

  const eqPathD = `M 0,${eqYCoords[0].toFixed(1)} ` +
    `C 16,${eqYCoords[0].toFixed(1)} 20,${eqYCoords[0].toFixed(1)} ${eqXCoords[0]},${eqYCoords[0].toFixed(1)} ` +
    `C 64,${eqYCoords[0].toFixed(1)} 64,${eqYCoords[1].toFixed(1)} ${eqXCoords[1]},${eqYCoords[1].toFixed(1)} ` +
    `C 128,${eqYCoords[1].toFixed(1)} 128,${eqYCoords[2].toFixed(1)} ${eqXCoords[2]},${eqYCoords[2].toFixed(1)} ` +
    `C 192,${eqYCoords[2].toFixed(1)} 192,${eqYCoords[3].toFixed(1)} ${eqXCoords[3]},${eqYCoords[3].toFixed(1)} ` +
    `C 256,${eqYCoords[3].toFixed(1)} 256,${eqYCoords[4].toFixed(1)} ${eqXCoords[4]},${eqYCoords[4].toFixed(1)} ` +
    `C 304,${eqYCoords[4].toFixed(1)} 308,${eqYCoords[4].toFixed(1)} 320,${eqYCoords[4].toFixed(1)}`;

  const eqAreaD = `${eqPathD} L 320,120 L 0,120 Z`;

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

        {/* Smart Cache Toggle & Optimize Button */}
        <div className="settings-toggle-row" style={{ alignItems: 'center' }}>
          <div style={{ flex: 1, paddingRight: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
              <p style={{ margin: 0, color: '#ffffff', fontSize: '0.88rem', fontWeight: '700' }}>Smart Storage Optimization</p>
              <span style={{
                fontSize: '0.64rem',
                fontWeight: '700',
                padding: '2px 7px',
                borderRadius: '8px',
                backgroundColor: smartCache ? 'rgba(29, 185, 84, 0.16)' : 'rgba(255, 255, 255, 0.06)',
                color: smartCache ? 'var(--accent)' : 'var(--text-muted)',
                border: smartCache ? '1px solid rgba(29, 185, 84, 0.35)' : '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                {smartCache ? 'Active' : 'Paused'}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              Auto-purges corrupt or orphaned files & verifies disk integrity.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <button
              onClick={handleRunOptimization}
              disabled={isOptimizing}
              style={{
                backgroundColor: 'rgba(29, 185, 84, 0.12)',
                border: '1px solid rgba(29, 185, 84, 0.3)',
                color: 'var(--accent)',
                borderRadius: '10px',
                padding: '6px 12px',
                fontSize: '0.74rem',
                fontWeight: '700',
                cursor: isOptimizing ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s ease',
                fontFamily: "'Montserrat', sans-serif"
              }}
              title="Audit and optimize local storage now"
            >
              <i className={isOptimizing ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-wand-magic-sparkles"}></i>
              <span>{isOptimizing ? 'Scanning…' : 'Optimize'}</span>
            </button>
            <label className="settings-switch-label">
              <input
                type="checkbox"
                checked={smartCache}
                onChange={(e) => handleToggleSmartCache(e.target.checked)}
              />
              <span className="settings-switch-slider"></span>
            </label>
          </div>
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
          <div>
            <h3 className="settings-card-title">Equalizer & Audio Processing</h3>
            <span style={{ fontSize: '0.7rem', color: 'var(--accent)', fontWeight: '700' }}>Web Audio DSP Engine Active</span>
          </div>
        </div>
        <p className="settings-card-desc">
          Fine-tune real-time acoustics, 5-band frequency curves, and immersive 3D virtualizers.
        </p>

        {/* --- Interactive SVG Equalizer Graph Card --- */}
        <div className="eq-graph-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.74rem', fontWeight: '800', color: '#ffffff', letterSpacing: '0.5px' }}>
              REAL-TIME ACOUSTIC SPECTRUM
            </span>
            <span style={{ fontSize: '0.68rem', fontWeight: '700', color: 'var(--accent)', background: 'rgba(29, 185, 84, 0.12)', padding: '2px 8px', borderRadius: '10px' }}>
              {eqPreset}
            </span>
          </div>

          <svg className="eq-graph-svg" viewBox="0 0 320 120" preserveAspectRatio="none">
            <defs>
              <linearGradient id="eqCurveGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.4" />
                <stop offset="60%" stopColor="var(--accent)" stopOpacity="0.12" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.0" />
              </linearGradient>
              <linearGradient id="spectrumBarGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.32" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.05" />
              </linearGradient>
            </defs>

            {/* Grid Reference Lines (+12dB, 0dB, -12dB) */}
            <line x1="0" y1="16" x2="320" y2="16" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
            <line x1="0" y1="60" x2="320" y2="60" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
            <line x1="0" y1="104" x2="320" y2="104" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />

            {/* Vertical grid guides for the 5 bands */}
            {eqXCoords.map((x, idx) => (
              <line key={idx} x1={x} y1="8" x2={x} y2="112" stroke="rgba(255,255,255,0.04)" strokeDasharray="2 2" />
            ))}

            {/* Live Audio Spectrum Bars (Animated via Web Audio AnalyserNode) */}
            {Array.from({ length: 24 }).map((_, i) => {
              const barWidth = 9;
              const barX = 10 + i * 12.6;
              return (
                <rect
                  key={i}
                  ref={el => { spectrumBarsRef.current[i] = el; }}
                  x={barX}
                  y="97"
                  width={barWidth}
                  height="3"
                  rx="2"
                  fill="url(#spectrumBarGrad)"
                />
              );
            })}

            {/* Glowing Gradient Area Under Curve */}
            <path d={eqAreaD} fill="url(#eqCurveGradient)" />

            {/* Main Spline Curve */}
            <path
              d={eqPathD}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2.5"
              strokeLinecap="round"
              style={{ filter: 'drop-shadow(0 0 6px var(--accent))' }}
            />

            {/* Control Node Markers on Curve */}
            {eqXCoords.map((x, idx) => {
              const y = eqYCoords[idx];
              const gain = customBands[idx] || 0;
              return (
                <g key={idx}>
                  <circle
                    cx={x}
                    cy={y}
                    r="4.5"
                    fill="#ffffff"
                    stroke="var(--accent)"
                    strokeWidth="2"
                    style={{ filter: 'drop-shadow(0 0 5px var(--accent))' }}
                  />
                  <text
                    x={x}
                    y={y < 35 ? y + 14 : y - 8}
                    textAnchor="middle"
                    fill="rgba(255, 255, 255, 0.75)"
                    fontSize="8"
                    fontWeight="700"
                  >
                    {gain > 0 ? `+${gain}` : `${gain}`}
                  </text>
                </g>
              );
            })}

            {/* Axis labels */}
            <text x="4" y="14" fill="rgba(255,255,255,0.3)" fontSize="7" fontWeight="600">+12dB</text>
            <text x="4" y="58" fill="rgba(255,255,255,0.3)" fontSize="7" fontWeight="600">0dB</text>
            <text x="4" y="102" fill="rgba(255,255,255,0.3)" fontSize="7" fontWeight="600">-12dB</text>
          </svg>

          {/* 5 Vertical Band Faders */}
          <div className="eq-faders-container">
            {EQ_BANDS.map((band, idx) => {
              const gain = customBands[idx] || 0;
              const formattedGain = (gain > 0 ? `+${gain}` : `${gain}`) + ' dB';
              return (
                <div key={band.freq} className="eq-fader-col">
                  <span style={{
                    fontSize: '0.68rem',
                    fontWeight: '700',
                    color: gain !== 0 ? 'var(--accent)' : 'rgba(255,255,255,0.5)',
                    marginBottom: '4px'
                  }}>
                    {formattedGain}
                  </span>
                  <input
                    type="range"
                    min="-12"
                    max="12"
                    step="0.5"
                    value={gain}
                    onChange={(e) => handleBandSliderChange(idx, e.target.value)}
                    className="eq-fader-input"
                    aria-label={`${band.label} ${band.sub}`}
                  />
                  <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#ffffff', marginTop: '6px' }}>
                    {band.label}
                  </span>
                  <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                    {band.sub}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

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

        {/* Dolby Atmos 3D Surround Virtualizer Card */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(20, 20, 20, 0.7) 100%)',
          border: '1px solid rgba(245, 158, 11, 0.32)',
          borderRadius: '16px',
          padding: '16px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          boxShadow: dolbyAtmos ? '0 0 20px rgba(245, 158, 11, 0.15)' : 'none',
          transition: 'all 0.25s ease'
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span className="dolby-atmos-pill">
                <i className="fa-solid fa-volume-high"></i> DOLBY ATMOS
              </span>
              <span style={{ fontSize: '0.72rem', color: '#fbbf24', fontWeight: '700' }}>3D Surround</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.75rem', color: 'rgba(255,255,255,0.85)', lineHeight: '1.35' }}>
              Multi-dimensional cinema virtualizer with sub-harmonic bass, dialogue clarity, and overhead air expansion.
            </p>
          </div>
          <label className="settings-switch-label" style={{ flexShrink: 0 }}>
            <input
              type="checkbox"
              checked={dolbyAtmos}
              onChange={(e) => handleToggleDolbyAtmos(e.target.checked)}
            />
            <span
              className="settings-switch-slider"
              style={{ backgroundColor: dolbyAtmos ? '#f59e0b' : undefined }}
            ></span>
          </label>
        </div>

        {/* 3D Spatial Audio Immersion */}
        <div className="settings-toggle-row">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
              <p style={{ margin: 0, color: '#ffffff', fontSize: '0.88rem', fontWeight: '700' }}>3D Spatial Audio Immersion</p>
              <span style={{ fontSize: '0.62rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(29, 185, 84, 0.15)', color: 'var(--accent)', fontWeight: '700' }}>HAAS 3D</span>
            </div>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
              <p style={{ margin: 0, color: '#ffffff', fontSize: '0.88rem', fontWeight: '700' }}>Autoplay Similar Music</p>
              <span style={{ fontSize: '0.62rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(29, 185, 84, 0.15)', color: 'var(--accent)', fontWeight: '700' }}>SMART MATCH</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-muted)' }}>Continuously plays stylistically and acoustically matched songs when your queue ends.</p>
          </div>
          <label className="settings-switch-label">
            <input
              type="checkbox"
              checked={autoplayInfinite}
              onChange={(e) => {
                triggerHaptic(20);
                setAutoplayInfiniteSetting(e.target.checked);
                setAutoplayInfinite?.(e.target.checked);
                displayToast(`Similar music autoplay ${e.target.checked ? 'enabled' : 'disabled'}`);
              }}
            />
            <span className="settings-switch-slider"></span>
          </label>
        </div>

        {/* Volume Normalization */}
        <div className="settings-toggle-row">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
              <p style={{ margin: 0, color: '#ffffff', fontSize: '0.88rem', fontWeight: '700' }}>Volume Normalization</p>
              <span style={{ fontSize: '0.62rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(29, 185, 84, 0.15)', color: 'var(--accent)', fontWeight: '700' }}>-14 LUFS</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-muted)' }}>Maintains consistent loudness across different tracks using dynamics compression.</p>
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

        {/* Playback Speed / Tempo */}
        <p style={{ margin: '16px 0 8px 0', fontSize: '0.8rem', color: 'var(--accent)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
          Playback Tempo / Speed
        </p>
        <div className="settings-pill-row">
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
      </div>

      {/* ===================================================================
          5. CROSSFADE & GAPLESS TRANSITION
          =================================================================== */}
      <div className="settings-glass-card" style={{ position: 'relative', zIndex: 1 }}>
        <div className="settings-card-header">
          <div className="settings-card-icon">
            <i className="fa-solid fa-shuffle"></i>
          </div>
          <div>
            <h3 className="settings-card-title">Crossfade & Seamless Transitions</h3>
            <span style={{ fontSize: '0.7rem', color: crossfadeDuration !== 'Off' ? 'var(--accent)' : 'var(--text-muted)', fontWeight: '700' }}>
              {crossfadeDuration !== 'Off' ? `${crossfadeDuration} Dynamic Crossfade Active` : 'Gapless Cut Active'}
            </span>
          </div>
        </div>
        <p className="settings-card-desc">
          Seamlessly blends the end of the current song into the next track without silence or gaps.
        </p>

        {/* Crossfade Transition Curve Diagram */}
        <div style={{
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: '14px',
          padding: '12px 14px',
          marginBottom: '16px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#ffffff', letterSpacing: '0.4px' }}>
              ACOUSTIC BLEND CURVE
            </span>
            <span style={{ fontSize: '0.72rem', fontWeight: '800', color: crossfadeDuration !== 'Off' ? 'var(--accent)' : 'var(--text-muted)' }}>
              {crossfadeDuration === 'Off' ? 'Instant Cut (0s)' : `${crossfadeDuration} Overlap`}
            </span>
          </div>

          <svg viewBox="0 0 300 48" style={{ width: '100%', height: '48px', display: 'block' }}>
            {/* Outgoing Track Curve (Fading Out) */}
            <path
              d={crossfadeDuration === 'Off' ? "M 0,8 L 150,8 L 150,44 L 300,44" : "M 0,8 C 80,8 120,8 150,26 C 180,44 220,44 300,44"}
              fill="none"
              stroke="#ef4444"
              strokeWidth="2.5"
              strokeDasharray={crossfadeDuration === 'Off' ? "4 3" : "none"}
              style={{ filter: 'drop-shadow(0 0 4px rgba(239, 68, 68, 0.4))' }}
            />
            {/* Incoming Track Curve (Fading In) */}
            <path
              d={crossfadeDuration === 'Off' ? "M 0,44 L 150,44 L 150,8 L 300,8" : "M 0,44 C 80,44 120,44 150,26 C 180,8 220,8 300,8"}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2.5"
              strokeDasharray={crossfadeDuration === 'Off' ? "4 3" : "none"}
              style={{ filter: 'drop-shadow(0 0 4px var(--accent))' }}
            />
            {/* Center overlap marker */}
            <circle cx="150" cy="26" r="4" fill="#ffffff" stroke="var(--accent)" strokeWidth="2" />
            <text x="8" y="22" fill="rgba(255,255,255,0.4)" fontSize="7.5" fontWeight="700">CURRENT SONG</text>
            <text x="220" y="22" fill="rgba(255,255,255,0.4)" fontSize="7.5" fontWeight="700">NEXT SONG</text>
          </svg>
        </div>

        {/* Crossfade Duration Options */}
        <p style={{ margin: '0 0 8px 0', fontSize: '0.8rem', color: 'var(--accent)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
          Crossfade Duration
        </p>
        <div className="settings-pill-row" style={{ marginBottom: '16px' }}>
          {CROSSFADE_DURATIONS.map((dur) => {
            const isActive = crossfadeDuration === dur;
            return (
              <button
                key={dur}
                onClick={() => handleSelectCrossfadeDuration(dur)}
                className={`settings-pill-btn ${isActive ? 'active' : 'inactive'}`}
                style={{ minWidth: '55px', padding: '8px 8px' }}
              >
                <span>{dur}</span>
                <span className="settings-pill-sub">{dur === 'Off' ? 'Gapless' : 'Blend'}</span>
              </button>
            );
          })}
        </div>

        {/* Gapless Playback Toggle */}
        <div className="settings-toggle-row">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
              <p style={{ margin: 0, color: '#ffffff', fontSize: '0.88rem', fontWeight: '700' }}>Gapless Playback</p>
              <span style={{ fontSize: '0.62rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(29, 185, 84, 0.15)', color: 'var(--accent)', fontWeight: '700' }}>SEAMLESS</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              Eliminates dead air and latency between consecutive album tracks.
            </p>
          </div>
          <label className="settings-switch-label">
            <input
              type="checkbox"
              checked={gaplessPlayback}
              onChange={(e) => {
                triggerHaptic(20);
                setGaplessPlayback(e.target.checked);
                displayToast(`Gapless transition ${e.target.checked ? 'activated' : 'paused'}`);
              }}
            />
            <span className="settings-switch-slider"></span>
          </label>
        </div>

        {/* Automix Smart Blend Toggle */}
        <div className="settings-toggle-row" style={{ marginBottom: 0 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
              <p style={{ margin: 0, color: '#ffffff', fontSize: '0.88rem', fontWeight: '700' }}>Automix Smart Blending</p>
              <span style={{ fontSize: '0.62rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(29, 185, 84, 0.15)', color: 'var(--accent)', fontWeight: '700' }}>STUDIO</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              Applies smooth micro-fades and acoustic ramping when switching tracks manually.
            </p>
          </div>
          <label className="settings-switch-label">
            <input
              type="checkbox"
              checked={automixEnabled}
              onChange={(e) => {
                triggerHaptic(20);
                setAutomixEnabled(e.target.checked);
                displayToast(`Automix blending ${e.target.checked ? 'enabled' : 'disabled'}`);
              }}
            />
            <span className="settings-switch-slider"></span>
          </label>
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
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 className="settings-card-title">Vivo Origin Island & Status Bar</h3>
              <span style={{ backgroundColor: 'rgba(29, 185, 84, 0.15)', color: 'var(--accent)', fontSize: '0.66rem', fontWeight: '800', padding: '2px 8px', borderRadius: '10px' }}>
                BACKGROUND HUD
              </span>
            </div>
            <span style={{ fontSize: '0.7rem', color: originIslandActive ? 'var(--accent)' : 'var(--text-muted)', fontWeight: '700' }}>
              {originIslandActive ? 'Origin Island Active on Background & Notch' : 'Origin Island Off'}
            </span>
          </div>
        </div>
        <p className="settings-card-desc">
          When Sonara plays in the background, active playback automatically docks into your Vivo or iQOO phone's camera punch-hole Island with dynamic waves and controls (like iPhone Dynamic Island).
        </p>

        {/* Live Notch Capsule Preview */}
        <div style={{
          background: 'rgba(0, 0, 0, 0.35)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '14px',
          marginBottom: '16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '10px'
        }}>
          <span style={{ fontSize: '0.68rem', fontWeight: '800', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
            Vivo Origin Island Background Preview
          </span>

          {/* Miniature Capsule */}
          <div style={{
            width: '210px',
            height: '36px',
            borderRadius: '18px',
            background: 'rgba(10, 14, 20, 0.95)',
            border: originIslandActive ? '1px solid rgba(29, 185, 84, 0.4)' : '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: originIslandActive ? '0 0 16px rgba(29, 185, 84, 0.25)' : 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 12px',
            transition: 'all 0.3s ease'
          }}>
            <div style={{
              width: '22px',
              height: '22px',
              borderRadius: '50%',
              backgroundColor: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.55rem',
              color: '#000',
              fontWeight: '900'
            }}>
              <i className="fa-solid fa-music"></i>
            </div>
            <span style={{ fontSize: '0.7rem', color: '#fff', fontWeight: '700' }}>
              Origin Island • Active
            </span>
            <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
              <div style={{ width: '2px', height: '10px', background: originIslandActive ? 'var(--accent)' : 'rgba(255,255,255,0.3)', borderRadius: '1px' }}></div>
              <div style={{ width: '2px', height: '14px', background: originIslandActive ? 'var(--accent)' : 'rgba(255,255,255,0.3)', borderRadius: '1px' }}></div>
              <div style={{ width: '2px', height: '8px', background: originIslandActive ? 'var(--accent)' : 'rgba(255,255,255,0.3)', borderRadius: '1px' }}></div>
            </div>
          </div>
        </div>

        {/* Master Toggle */}
        <div className="settings-toggle-row">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
              <p style={{ margin: 0, color: '#ffffff', fontSize: '0.88rem', fontWeight: '700' }}>Origin Island Background Sync</p>
              <span style={{ fontSize: '0.62rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(29, 185, 84, 0.15)', color: 'var(--accent)', fontWeight: '700' }}>VIVO / iQOO</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              Broadcasts media controls to Vivo OriginOS status bar & camera notch when app is minimized.
            </p>
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

        {/* Vivo OriginOS & Android Background Service */}
        <div className="settings-toggle-row" style={{ marginBottom: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
              <p style={{ margin: 0, color: '#ffffff', fontSize: '0.88rem', fontWeight: '700' }}>System Island Broadcast</p>
              <span style={{ fontSize: '0.62rem', padding: '1px 6px', borderRadius: '4px', background: 'rgba(29, 185, 84, 0.15)', color: 'var(--accent)', fontWeight: '700' }}>ORIGIN / HYPEROS</span>
            </div>
            <p style={{ margin: 0, fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              Keeps background foreground media session synchronized with mobile notch capsules.
            </p>
          </div>
          <span style={{ fontSize: '0.74rem', color: 'var(--accent)', fontWeight: '800' }}>
            {originIslandActive ? 'ACTIVE' : 'PAUSED'}
          </span>
        </div>

        {/* Permission / Settings Helper Button */}
        <button
          onClick={() => {
            triggerHaptic(25);
            NativeAudioEffects.openOriginIslandSettings().catch(() => {});
          }}
          className="settings-action-btn"
          style={{
            width: '100%',
            padding: '10px 14px',
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '10px',
            color: '#ffffff',
            fontSize: '0.8rem',
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            cursor: 'pointer'
          }}
        >
          <i className="fa-solid fa-gear" style={{ color: 'var(--accent)' }}></i>
          Manage Origin Island & Notification Permissions
        </button>
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