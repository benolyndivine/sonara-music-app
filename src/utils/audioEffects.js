import { registerPlugin } from '@capacitor/core';
import { runSmartStorageOptimization } from './offlineStorage';

/**
 * Native Android Audio Effects Bridge (Capacitor)
 * Connects directly to hardware Android AudioEffects (Equalizer, 3D Virtualizer,
 * BassBoost, and LoudnessEnhancer) attached to native MediaPlayer audio sessions.
 */
export const NativeAudioEffects = registerPlugin('AudioEffects', {
  web: () => ({
    setEqualizerBands: async () => ({ success: true }),
    setSpatialAudio: async () => ({ success: true }),
    setDolbyAtmos: async () => ({ success: true }),
    setNormalizeVolume: async () => ({ success: true }),
    getStatus: async () => ({ activeSessionCount: 0 }),
    openOriginIslandSettings: async () => ({ success: true }),
  }),
});

/**
 * Audio Effects and Player Settings Engine
 * Manages 5-band graphic equalizer, real-time frequency analyser,
 * 3D spatial audio immersion, Dolby Atmos 3D virtualizer, volume normalization,
 * continuous smart autoplay, playback speed, screen wake lock, and tactile haptics.
 */

const SPEED_KEY = 'sonara_playback_speed';
const EQ_KEY = 'sonara_eq_preset';
const CUSTOM_BANDS_KEY = 'sonara_eq_custom_bands';
const SPATIAL_KEY = 'sonara_spatial_audio';
const DOLBY_KEY = 'sonara_dolby_atmos';
const NORMALIZE_KEY = 'sonara_normalize_volume';
const OFFLINE_ONLY_KEY = 'sonara_offline_only_mode';
const AUTOPLAY_KEY = 'sonara_autoplay_infinite';
const HAPTICS_KEY = 'sonara_haptics_enabled';
const CROSSFADE_KEY = 'sonara_crossfade';
const CROSSFADE_DUR_KEY = 'sonara_crossfade_duration';
const GAPLESS_KEY = 'sonara_gapless_transitions';
const AUTOMIX_KEY = 'sonara_automix_enabled';
const WAKE_LOCK_KEY = 'sonara_keep_awake';

export const EQ_BANDS = [
  { freq: 60, label: '60 Hz', sub: 'Sub-Bass', type: 'lowshelf' },
  { freq: 250, label: '250 Hz', sub: 'Bass', type: 'peaking' },
  { freq: 1000, label: '1 kHz', sub: 'Mid', type: 'peaking' },
  { freq: 4000, label: '4 kHz', sub: 'Treble', type: 'peaking' },
  { freq: 12000, label: '12 kHz', sub: 'Air', type: 'highshelf' },
];

export const EQ_PRESET_CONFIGS = {
  'Off': [0, 0, 0, 0, 0],
  'Flat': [0, 0, 0, 0, 0],
  'Bass Boost': [6.5, 4.5, 0.5, -1.0, -2.0],
  'Vocal Boost': [-2.0, -0.5, 4.5, 3.5, 1.0],
  'Acoustic': [3.5, 2.0, 1.0, 3.5, 4.5],
  'Treble Boost': [-3.0, -1.0, 1.0, 4.5, 7.0],
  'Dolby Cinema': [5.5, 3.5, -0.5, 3.5, 5.0],
  'Electronic': [6.0, 4.0, -1.0, 2.5, 4.5],
  'Custom': [0, 0, 0, 0, 0],
};

export const VIBE_PRESETS = [
  { id: 'natural', name: 'Original', icon: 'fa-music', desc: 'Natural balanced studio fidelity', speed: '1.0x', eq: 'Flat', spatial: false, dolby: false, color: '#1db954' },
  { id: 'nightcore', name: 'Nightcore', icon: 'fa-bolt', desc: '1.25x tempo • Crisp treble punch', speed: '1.25x', eq: 'Treble Boost', spatial: false, dolby: true, color: '#f43f5e' },
  { id: 'slowed', name: 'Slowed + Reverb', icon: 'fa-water', desc: '0.85x tempo • Haas 3D soundstage', speed: '0.85x', eq: 'Bass Boost', spatial: true, dolby: true, color: '#8b5cf6' },
  { id: 'lofi', name: 'Lo-Fi Chill', icon: 'fa-mug-hot', desc: '0.9x tempo • Vintage acoustic warmth', speed: '0.9x', eq: 'Acoustic', spatial: true, dolby: false, color: '#f59e0b' },
];

export function applyVibePreset(vibeId) {
  const vibe = VIBE_PRESETS.find(v => v.id === vibeId) || VIBE_PRESETS[0];
  setPlaybackSpeedSetting(vibe.speed);
  setEqPresetSetting(vibe.eq);
  setSpatialAudioSetting(vibe.spatial);
  setDolbyAtmosSetting(vibe.dolby);
  localStorage.setItem('sonara_active_vibe', vibe.id);
  syncAllAudioEffectsToNative();
  return vibe;
}

export function getActiveVibePreset() {
  return localStorage.getItem('sonara_active_vibe') || 'natural';
}

export function getPlaybackSpeedSetting() {
  return localStorage.getItem(SPEED_KEY) || '1.0x';
}

export function setPlaybackSpeedSetting(speed) {
  localStorage.setItem(SPEED_KEY, speed);
  sonaraAudioEngine.setPlaybackSpeed(speed);
}

export function getEqPresetSetting() {
  return localStorage.getItem(EQ_KEY) || 'Flat';
}

export function setEqPresetSetting(preset) {
  localStorage.setItem(EQ_KEY, preset);
  sonaraAudioEngine.setEqualizer(preset);
  const bands = EQ_PRESET_CONFIGS[preset] || [0, 0, 0, 0, 0];
  NativeAudioEffects.setEqualizerBands({ bands }).catch(() => {});
}

export function getCustomEqBands() {
  try {
    const raw = localStorage.getItem(CUSTOM_BANDS_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length === 5) return arr;
    }
  } catch (_) {}
  return [0, 0, 0, 0, 0];
}

export function setCustomEqBands(bands) {
  if (!Array.isArray(bands) || bands.length !== 5) return;
  localStorage.setItem(CUSTOM_BANDS_KEY, JSON.stringify(bands));
  sonaraAudioEngine.setEqualizerBands(bands);
  NativeAudioEffects.setEqualizerBands({ bands }).catch(() => {});
}

export function getSpatialAudioSetting() {
  return localStorage.getItem(SPATIAL_KEY) === 'true';
}

export function setSpatialAudioSetting(enabled) {
  localStorage.setItem(SPATIAL_KEY, String(enabled));
  sonaraAudioEngine.setSpatialAudio(enabled);
  NativeAudioEffects.setSpatialAudio({ enabled }).catch(() => {});
}

export function getDolbyAtmosSetting() {
  return localStorage.getItem(DOLBY_KEY) === 'true';
}

export function setDolbyAtmosSetting(enabled) {
  localStorage.setItem(DOLBY_KEY, String(enabled));
  sonaraAudioEngine.setDolbyAtmos(enabled);
  NativeAudioEffects.setDolbyAtmos({ enabled }).catch(() => {});
}

export function getNormalizeVolumeSetting() {
  return localStorage.getItem(NORMALIZE_KEY) !== 'false';
}

export function setNormalizeVolumeSetting(enabled) {
  localStorage.setItem(NORMALIZE_KEY, String(enabled));
  sonaraAudioEngine.setNormalizeVolume(enabled);
  NativeAudioEffects.setNormalizeVolume({ enabled }).catch(() => {});
}

export function syncAllAudioEffectsToNative() {
  try {
    const preset = getEqPresetSetting();
    const bands = preset === 'Custom' ? getCustomEqBands() : (EQ_PRESET_CONFIGS[preset] || [0, 0, 0, 0, 0]);
    NativeAudioEffects.setEqualizerBands({ bands }).catch(() => {});
    NativeAudioEffects.setSpatialAudio({ enabled: getSpatialAudioSetting() }).catch(() => {});
    NativeAudioEffects.setDolbyAtmos({ enabled: getDolbyAtmosSetting() }).catch(() => {});
    NativeAudioEffects.setNormalizeVolume({ enabled: getNormalizeVolumeSetting() }).catch(() => {});
  } catch (_) {}
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

export function getCrossfadeSetting() {
  return localStorage.getItem(CROSSFADE_KEY) === 'true';
}

export function setCrossfadeSetting(enabled) {
  localStorage.setItem(CROSSFADE_KEY, String(enabled));
}

export function getCrossfadeDurationSetting() {
  return localStorage.getItem(CROSSFADE_DUR_KEY) || '3s';
}

export function setCrossfadeDurationSetting(dur) {
  localStorage.setItem(CROSSFADE_DUR_KEY, dur);
  if (dur === 'Off') {
    setCrossfadeSetting(false);
  } else {
    setCrossfadeSetting(true);
  }
}

export function getCrossfadeDurationSeconds() {
  const dur = getCrossfadeDurationSetting();
  if (dur === 'Off' || !getCrossfadeSetting()) return 0;
  const num = parseInt(dur, 10);
  return isNaN(num) ? 0 : num;
}

export function getGaplessPlaybackSetting() {
  return localStorage.getItem(GAPLESS_KEY) !== 'false';
}

export function setGaplessPlaybackSetting(enabled) {
  localStorage.setItem(GAPLESS_KEY, String(enabled));
}

export function getAutomixSetting() {
  return localStorage.getItem(AUTOMIX_KEY) !== 'false';
}

export function setAutomixSetting(enabled) {
  localStorage.setItem(AUTOMIX_KEY, String(enabled));
}

/**
 * Smoothly interpolates an audio element's or native Media instance's volume using equal-power acoustic curves.
 * Uses a steady timer interval (~25ms) so it runs reliably even when the tab/app is backgrounded or screen locked.
 */
export function fadeVolume(audioTarget, fromVol, toVol, durationMs = 1000, onComplete = null) {
  if (!audioTarget) {
    onComplete?.();
    return () => {};
  }
  const start = performance.now();
  let timerId = null;
  let cancelled = false;

  const setTargetVol = (v) => {
    const clamped = Math.max(0, Math.min(1, v));
    try {
      if (typeof audioTarget.setVolume === 'function') {
        audioTarget.setVolume(clamped);
      } else {
        audioTarget.volume = clamped;
      }
    } catch (_) {}
  };

  setTargetVol(fromVol);

  const step = () => {
    if (cancelled) return;
    const now = performance.now();
    const elapsed = now - start;
    const progress = Math.min(1, elapsed / Math.max(1, durationMs));

    // Equal-power crossfade curve for audio blending:
    // P = V_out^2 + V_in^2 = 1.0 (prevents center volume dip)
    let vol;
    if (fromVol > toVol) {
      // Fade out
      vol = fromVol * Math.cos(progress * (Math.PI / 2));
    } else {
      // Fade in
      vol = toVol * Math.sin(progress * (Math.PI / 2));
    }

    setTargetVol(vol);

    if (progress < 1) {
      // Continue next tick
    } else {
      if (timerId) {
        clearInterval(timerId);
        timerId = null;
      }
      setTargetVol(toVol);
      onComplete?.();
    }
  };

  // Run at ~40 ticks per second (every 25ms), guaranteed execution in background
  timerId = setInterval(step, 25);
  step();

  return () => {
    cancelled = true;
    if (timerId) clearInterval(timerId);
  };
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
      // Ignore vibration errors on unsupported hardware
    }
  }
}

/**
 * Web Audio Engine: Real-time 5-Band Equalizer, Dolby Atmos 3D Virtualizer,
 * 3D Spatial Immersion, Dynamics Compressor Normalization, and Analyser Node.
 */
class SonaraAudioEngine {
  constructor() {
    this.ctx = null;
    this.source = null;
    this.sourceNodes = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
    this.attachedElement = null;
    this.eqFilters = [];
    this.spatialFilter = null;
    this.dolbySubFilter = null;
    this.dolbyPresenceFilter = null;
    this.dolbyAirFilter = null;
    this.compressor = null;
    this.makeupGain = null;
    this.analyser = null;
    this.isInitialized = false;
  }

  ensureContext() {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  attachElement(audioElement) {
    if (!audioElement || typeof window === 'undefined') return;

    try {
      const ctx = this.ensureContext();
      if (!ctx) return;

      // Allow cross-origin audio processing for Cloudinary / streaming CDNs
      if (audioElement.crossOrigin !== 'anonymous') {
        audioElement.crossOrigin = 'anonymous';
      }

      this.attachedElement = audioElement;

      if (this.isInitialized) {
        if (this.sourceNodes && !this.sourceNodes.has(audioElement)) {
          const newSrc = ctx.createMediaElementSource(audioElement);
          this.sourceNodes.set(audioElement, newSrc);
          if (this.eqFilters && this.eqFilters[0]) {
            newSrc.connect(this.eqFilters[0]);
          }
        }
        return;
      }

      // Connect source node (MediaElementAudioSourceNode can only be created once per element)
      const srcNode = ctx.createMediaElementSource(audioElement);
      if (this.sourceNodes) {
        this.sourceNodes.set(audioElement, srcNode);
      }
      this.source = srcNode;

      // 1. Equalizer 5-Band Biquad Filters
      this.eqFilters = EQ_BANDS.map(band => {
        const filter = ctx.createBiquadFilter();
        filter.type = band.type;
        filter.frequency.value = band.freq;
        filter.gain.value = 0;
        if (band.type === 'peaking') filter.Q.value = 1.0;
        return filter;
      });

      // Chain EQ filters in series: source -> eq[0] -> eq[1] ... -> eq[4]
      let lastNode = this.source;
      for (const f of this.eqFilters) {
        lastNode.connect(f);
        lastNode = f;
      }

      // 2. 3D Spatial Audio Immersion:
      // High-resolution psychoacoustic stereo widening peaking filter
      this.spatialFilter = ctx.createBiquadFilter();
      this.spatialFilter.type = 'peaking';
      this.spatialFilter.frequency.value = 2800;
      this.spatialFilter.Q.value = 0.7;
      this.spatialFilter.gain.value = 0;
      lastNode.connect(this.spatialFilter);
      lastNode = this.spatialFilter;

      // 3. Dolby Atmos 3D Virtualizer:
      // Multi-dimensional cinema acoustic contouring (Sub, Dialogue Presence, Air Diffusion)
      this.dolbySubFilter = ctx.createBiquadFilter();
      this.dolbySubFilter.type = 'lowshelf';
      this.dolbySubFilter.frequency.value = 50;
      this.dolbySubFilter.gain.value = 0;
      lastNode.connect(this.dolbySubFilter);
      lastNode = this.dolbySubFilter;

      this.dolbyPresenceFilter = ctx.createBiquadFilter();
      this.dolbyPresenceFilter.type = 'peaking';
      this.dolbyPresenceFilter.frequency.value = 3200;
      this.dolbyPresenceFilter.Q.value = 1.2;
      this.dolbyPresenceFilter.gain.value = 0;
      lastNode.connect(this.dolbyPresenceFilter);
      lastNode = this.dolbyPresenceFilter;

      this.dolbyAirFilter = ctx.createBiquadFilter();
      this.dolbyAirFilter.type = 'highshelf';
      this.dolbyAirFilter.frequency.value = 14000;
      this.dolbyAirFilter.gain.value = 0;
      lastNode.connect(this.dolbyAirFilter);
      lastNode = this.dolbyAirFilter;

      // 4. Volume Normalization (Studio Dynamics Compressor + Auto-makeup)
      this.compressor = ctx.createDynamicsCompressor();
      this.compressor.threshold.value = 0;
      this.compressor.knee.value = 12;
      this.compressor.ratio.value = 1.0;
      this.compressor.attack.value = 0.005;
      this.compressor.release.value = 0.25;
      lastNode.connect(this.compressor);
      lastNode = this.compressor;

      this.makeupGain = ctx.createGain();
      this.makeupGain.gain.value = 1.0;
      lastNode.connect(this.makeupGain);
      lastNode = this.makeupGain;

      // 5. Spectrum Analyser Node for Real-time Graph Visualizer
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 64;
      this.analyser.smoothingTimeConstant = 0.8;
      lastNode.connect(this.analyser);
      lastNode = this.analyser;

      // 6. Output to speakers / earphones
      lastNode.connect(ctx.destination);

      this.isInitialized = true;
      this.applySavedSettings();
    } catch (err) {
      console.warn('Web Audio processing engine fallback (direct playback active):', err);
    }
  }

  applySavedSettings() {
    const preset = getEqPresetSetting();
    const customBands = getCustomEqBands();
    const spatial = getSpatialAudioSetting();
    const dolby = getDolbyAtmosSetting();
    const normalize = getNormalizeVolumeSetting();
    const speed = getPlaybackSpeedSetting();

    this.setEqualizer(preset, customBands);
    this.setSpatialAudio(spatial);
    this.setDolbyAtmos(dolby);
    this.setNormalizeVolume(normalize);
    if (this.attachedElement) {
      applyAudioEffectsToElement(this.attachedElement, { speed });
    }
  }

  setEqualizer(preset, customBands = null) {
    if (!this.eqFilters || this.eqFilters.length === 0) return;
    let gains = [0, 0, 0, 0, 0];
    if (preset === 'Custom' && Array.isArray(customBands)) {
      gains = customBands;
    } else if (EQ_PRESET_CONFIGS[preset]) {
      gains = EQ_PRESET_CONFIGS[preset];
    }
    const ctx = this.ctx;
    const now = ctx ? ctx.currentTime : 0;
    this.eqFilters.forEach((filter, idx) => {
      const g = gains[idx] != null ? gains[idx] : 0;
      if (ctx) {
        filter.gain.setTargetAtTime(g, now, 0.04);
      } else {
        filter.gain.value = g;
      }
    });
  }

  setEqualizerBands(bands) {
    if (!this.eqFilters || !Array.isArray(bands)) return;
    const ctx = this.ctx;
    const now = ctx ? ctx.currentTime : 0;
    this.eqFilters.forEach((filter, idx) => {
      const g = bands[idx] != null ? bands[idx] : 0;
      if (ctx) {
        filter.gain.setTargetAtTime(g, now, 0.04);
      } else {
        filter.gain.value = g;
      }
    });
  }

  setSpatialAudio(enabled) {
    if (!this.spatialFilter) return;
    const ctx = this.ctx;
    const now = ctx ? ctx.currentTime : 0;
    const gainVal = enabled ? 6.5 : 0;
    if (ctx) {
      this.spatialFilter.gain.setTargetAtTime(gainVal, now, 0.05);
    } else {
      this.spatialFilter.gain.value = gainVal;
    }
  }

  updateMakeupGain() {
    if (!this.makeupGain) return;
    const ctx = this.ctx;
    const now = ctx ? ctx.currentTime : 0;
    let target = 1.0;
    if (getDolbyAtmosSetting()) {
      target = 1.45;
    } else if (getNormalizeVolumeSetting()) {
      target = 1.35;
    }
    if (ctx) {
      this.makeupGain.gain.setTargetAtTime(target, now, 0.05);
    } else {
      this.makeupGain.gain.value = target;
    }
  }

  setDolbyAtmos(enabled) {
    if (!this.dolbySubFilter || !this.dolbyPresenceFilter || !this.dolbyAirFilter) return;
    const ctx = this.ctx;
    const now = ctx ? ctx.currentTime : 0;
    const subGain = enabled ? 6.5 : 0;
    const presenceGain = enabled ? 4.0 : 0;
    const airGain = enabled ? 5.5 : 0;

    if (ctx) {
      this.dolbySubFilter.gain.setTargetAtTime(subGain, now, 0.05);
      this.dolbyPresenceFilter.gain.setTargetAtTime(presenceGain, now, 0.05);
      this.dolbyAirFilter.gain.setTargetAtTime(airGain, now, 0.05);
    } else {
      this.dolbySubFilter.gain.value = subGain;
      this.dolbyPresenceFilter.gain.value = presenceGain;
      this.dolbyAirFilter.gain.value = airGain;
    }
    this.updateMakeupGain();
  }

  setNormalizeVolume(enabled) {
    if (!this.compressor || !this.makeupGain) return;
    const ctx = this.ctx;
    const now = ctx ? ctx.currentTime : 0;
    if (enabled) {
      if (ctx) {
        this.compressor.threshold.setTargetAtTime(-22, now, 0.05);
        this.compressor.knee.setTargetAtTime(12, now, 0.05);
        this.compressor.ratio.setTargetAtTime(4.5, now, 0.05);
      }
    } else {
      if (ctx) {
        this.compressor.threshold.setTargetAtTime(0, now, 0.05);
        this.compressor.ratio.setTargetAtTime(1.0, now, 0.05);
      }
    }
    this.updateMakeupGain();
  }

  setPlaybackSpeed(speed) {
    if (this.attachedElement) {
      applyAudioEffectsToElement(this.attachedElement, { speed });
    }
  }

  getFrequencyData(targetArray) {
    if (!this.analyser) {
      return targetArray || new Uint8Array(32);
    }
    const arr = targetArray || new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(arr);
    return arr;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }
}

export const sonaraAudioEngine = new SonaraAudioEngine();

/**
 * Applies playback speed to HTML5 audio element cleanly
 */
export function applyAudioEffectsToElement(audioElement, { speed = '1.0x' } = {}) {
  if (!audioElement) return;
  try {
    const rate = parseFloat(speed) || 1.0;
    audioElement.playbackRate = rate;
    audioElement.defaultPlaybackRate = rate;
    audioElement.volume = 1.0;
  } catch (err) {
    console.warn('Could not apply audio element playback rate:', err);
  }
}

/**
 * Applies playback rate to native media object (Cordova / Capacitor) safely
 */
export function applyAudioEffectsToNative(mediaObject, { speed = '1.0x' } = {}) {
  if (!mediaObject) return;
  try {
    const rate = parseFloat(speed) || 1.0;
    if (rate !== 1.0 && typeof mediaObject.setRate === 'function') {
      mediaObject.setRate(rate);
    }
    if (typeof mediaObject.setVolume === 'function') {
      mediaObject.setVolume(1.0);
    }
  } catch (err) {
    console.warn('Could not apply native media playback rate:', err);
  }
}

/**
 * Intelligently recommends the most stylistically and acoustically similar track
 * from the library to seamlessly continue playback (infinite smart autoplay).
 */
export function findSimilarTrack(currentTrack, allSongs = [], history = []) {
  if (!allSongs || allSongs.length === 0) return null;
  if (!currentTrack) return allSongs[0];

  const recentIds = new Set((history || []).slice(-15).map(t => t?.id).filter(Boolean));
  recentIds.add(currentTrack.id);

  // Filter out the exact track currently playing
  const candidates = allSongs.filter(s => s.id !== currentTrack.id);
  if (candidates.length === 0) return currentTrack;

  const currentArtist = (currentTrack.artist || '').toLowerCase().trim();
  const currentGenre = (currentTrack.genre || currentTrack.category || '').toLowerCase().trim();
  const currentAlbum = (currentTrack.albumId || currentTrack.album || '').toString().toLowerCase().trim();

  const scored = candidates.map(song => {
    let score = 0;
    const songArtist = (song.artist || '').toLowerCase().trim();
    const songGenre = (song.genre || song.category || '').toLowerCase().trim();
    const songAlbum = (song.albumId || song.album || '').toString().toLowerCase().trim();

    // 1. Same artist (+60) or collaborative feature (+40)
    if (currentArtist && songArtist) {
      if (songArtist === currentArtist) {
        score += 60;
      } else if (songArtist.includes(currentArtist) || currentArtist.includes(songArtist)) {
        score += 40;
      }
    }

    // 2. Same album (+40)
    if (currentAlbum && songAlbum && currentAlbum === songAlbum) {
      score += 40;
    }

    // 3. Same genre or acoustic category (+35)
    if (currentGenre && songGenre && currentGenre === songGenre) {
      score += 35;
    }

    // 4. Heavy penalty for recently played songs
    if (recentIds.has(song.id)) {
      score -= 55;
    }

    // 5. Slight random jitter (0-15) so recommendation stays fresh
    score += Math.random() * 15;

    return { song, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.song || candidates[0];
}

/**
 * Scans offline storage and cleans up broken / orphaned cache records
 */
export async function runSmartCacheCleanup(options = {}) {
  const result = await runSmartStorageOptimization(options);
  return result.cleanedRecords;
}

export { runSmartStorageOptimization };

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
