/**
 * Audio Effects and Player Settings Engine
 * Manages equalizer presets, playback speed, spatial immersion,
 * volume normalization, offline-only data shield, screen wake lock,
 * and tactile haptics.
 */

const SPEED_KEY = 'sonara_playback_speed';
const EQ_KEY = 'sonara_eq_preset';
const SPATIAL_KEY = 'sonara_spatial_audio';
const NORMALIZE_KEY = 'sonara_normalize_volume';
const OFFLINE_ONLY_KEY = 'sonara_offline_only_mode';
const AUTOPLAY_KEY = 'sonara_autoplay_infinite';
const HAPTICS_KEY = 'sonara_haptics_enabled';
const CROSSFADE_KEY = 'sonara_crossfade';
const CROSSFADE_DUR_KEY = 'sonara_crossfade_duration';
const WAKE_LOCK_KEY = 'sonara_keep_awake';

export const EQ_PRESET_CONFIGS = {
  'Off': { bass: 0, mid: 0, treble: 0 },
  'Flat': { bass: 0, mid: 0, treble: 0 },
  'Bass Boost': { bass: 7.0, mid: 1.0, treble: -1.0 },
  'Vocal Boost': { bass: -2.0, mid: 5.5, treble: 2.0 },
  'Acoustic': { bass: 3.5, mid: 2.0, treble: 4.5 },
  'Treble Boost': { bass: -3.0, mid: 1.0, treble: 7.0 },
};

export function getPlaybackSpeedSetting() {
  return localStorage.getItem(SPEED_KEY) || '1.0x';
}

export function setPlaybackSpeedSetting(speed) {
  localStorage.setItem(SPEED_KEY, speed);
}

export function getEqPresetSetting() {
  return localStorage.getItem(EQ_KEY) || 'Flat';
}

export function setEqPresetSetting(preset) {
  localStorage.setItem(EQ_KEY, preset);
}

export function getSpatialAudioSetting() {
  return localStorage.getItem(SPATIAL_KEY) === 'true';
}

export function setSpatialAudioSetting(enabled) {
  localStorage.setItem(SPATIAL_KEY, String(enabled));
}

export function getNormalizeVolumeSetting() {
  return localStorage.getItem(NORMALIZE_KEY) !== 'false';
}

export function setNormalizeVolumeSetting(enabled) {
  localStorage.setItem(NORMALIZE_KEY, String(enabled));
}

export function getOfflineOnlyModeSetting() {
  return localStorage.getItem(OFFLINE_ONLY_KEY) === 'true';
}

export function setOfflineOnlyModeSetting(enabled) {
  localStorage.setItem(OFFLINE_ONLY_KEY, String(enabled));
}

export function getAutoplayInfiniteSetting() {
  return localStorage.getItem(AUTOPLAY_KEY) !== 'false';
}

export function setAutoplayInfiniteSetting(enabled) {
  localStorage.setItem(AUTOPLAY_KEY, String(enabled));
}

export function getHapticsSetting() {
  return localStorage.getItem(HAPTICS_KEY) !== 'false';
}

export function setHapticsSetting(enabled) {
  localStorage.setItem(HAPTICS_KEY, String(enabled));
}

export function getKeepScreenAwakeSetting() {
  return localStorage.getItem(WAKE_LOCK_KEY) === 'true';
}

export function setKeepScreenAwakeSetting(enabled) {
  localStorage.setItem(WAKE_LOCK_KEY, String(enabled));
}

/**
 * Triggers a subtle tactile haptic vibration if enabled
 */
export function triggerHaptic(durationMs = 25) {
  if (!getHapticsSetting()) return;
  if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
    try {
      window.navigator.vibrate(durationMs);
    } catch {
      // Ignore vibration error on unsupported hardware
    }
  }
}

/**
 * Applies playback speed to HTML5 audio element cleanly without Web Audio hijacking
 * (Direct output ensures audio is NEVER silenced by cross-origin CORS policies)
 */
export function applyAudioEffectsToElement(audioElement, { speed = '1.0x' } = {}) {
  if (!audioElement) return;

  try {
    const rate = parseFloat(speed) || 1.0;
    audioElement.playbackRate = rate;
    audioElement.defaultPlaybackRate = rate;
    audioElement.volume = 1.0; // Ensure 100% full volume output
  } catch (err) {
    console.warn('Could not apply audio element playback rate:', err);
  }
}

/**
 * Applies playback rate to native media object (Cordova / Capacitor) safely
 * (Never call setVolume on Cordova media as it disrupts uninitialized Media instances)
 */
export function applyAudioEffectsToNative(mediaObject, { speed = '1.0x' } = {}) {
  if (!mediaObject) return;
  try {
    const rate = parseFloat(speed) || 1.0;
    if (rate !== 1.0 && typeof mediaObject.setRate === 'function') {
      mediaObject.setRate(rate);
    }
  } catch (err) {
    console.warn('Could not apply native media playback rate:', err);
  }
}

/**
 * Scans offline storage and cleans up broken / orphaned cache records
 */
export function runSmartCacheCleanup() {
  let cleanedCount = 0;
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('offline_track_')) {
        try {
          const val = JSON.parse(localStorage.getItem(key) || '{}');
          if (!val.id || (!val.localPath && !val.blobUrl && !val.base64 && !val.url)) {
            keysToRemove.push(key);
          }
        } catch {
          keysToRemove.push(key);
        }
      }
    }
    keysToRemove.forEach(k => {
      localStorage.removeItem(k);
      cleanedCount++;
    });
  } catch (err) {
    console.warn('Smart cache scan encountered an error:', err);
  }
  return cleanedCount;
}

// Screen Wake Lock API management
let wakeLockSentinel = null;

export async function requestScreenWakeLock() {
  if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
    try {
      wakeLockSentinel = await navigator.wakeLock.request('screen');
      wakeLockSentinel.addEventListener('release', () => {
        wakeLockSentinel = null;
      });
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export function releaseScreenWakeLock() {
  if (wakeLockSentinel) {
    try {
      wakeLockSentinel.release();
    } catch {
      // Ignore release failure
    }
    wakeLockSentinel = null;
  }
}
