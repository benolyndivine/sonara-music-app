import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { getDownloadQuality, getStreamingQuality, appendQualityParam, applyQualityToUrl, QUALITY_LABELS } from './audioQuality';
import { primeImageCache } from './imageCache';

// Global listeners for live download progress updates
const progressListeners = new Set();

export function subscribeToDownloadProgress(listener) {
  progressListeners.add(listener);
  return () => progressListeners.delete(listener);
}

function notifyProgress(progressMap) {
  progressListeners.forEach(listener => {
    try { listener(progressMap); } catch (e) { console.error(e); }
  });
}

// Active in-flight downloads: { [songId]: { progress: number, status: 'downloading' | 'completed' | 'error', title: string, artist: string, cover: string } }
let activeDownloads = {};

export function getActiveDownloads() {
  return { ...activeDownloads };
}

/**
 * Checks and requests runtime storage/audio permissions on native devices
 */
export async function requestStoragePermission() {
  if (!Capacitor.isNativePlatform()) return true;

  try {
    const status = await Filesystem.checkPermissions();
    if (status.publicStorage === 'granted') {
      return true;
    }
    const request = await Filesystem.requestPermissions();
    return request.publicStorage === 'granted';
  } catch (err) {
    console.warn('Storage permission request encountered an issue:', err);
    return true; // Fallback gracefully if permission check is handled by OS
  }
}

/**
 * Downloads a remote track file source stream to localized app directories on hybrid hardware with progress tracking
 */
export async function downloadTrackToDevice(song) {
  const rawAudioUrl = song.songUrl || song.audioUrl;
  const songTitle = song.title || song.name;
  if (!rawAudioUrl) throw new Error("No target streaming audio URL source registered for this track record.");

  // Request runtime permission before writing to device storage
  if (Capacitor.isNativePlatform()) {
    const hasPermission = await requestStoragePermission();
    if (!hasPermission) {
      throw new Error("Storage permission was denied by user.");
    }
  }

  const downloadQuality = getDownloadQuality();
  const audioUrl = applyQualityToUrl(rawAudioUrl, downloadQuality);

  // Initialize progress tracking
  activeDownloads[song.id] = {
    id: song.id,
    title: songTitle,
    artist: song.artist || 'Unknown Artist',
    cover: song.cover || song.image || song.imageUrl || null,
    progress: 5,
    status: 'downloading'
  };
  notifyProgress(activeDownloads);

  const saveMeta = (sizeBytes = 0) => {
    const meta = {
      id: song.id,
      title: songTitle,
      artist: song.artist || 'Unknown Artist',
      cover: song.cover || song.image || song.imageUrl || null,
      albumId: song.albumId || null,
      quality: downloadQuality,
      size: sizeBytes,
      downloadedAt: new Date().toISOString()
    };
    localStorage.setItem(`offline_meta_${song.id}`, JSON.stringify(meta));
    // Guarantee the cover art is cached alongside the audio, not just lazily on view.
    primeImageCache(meta.cover);
  };

  // Web / PWA browser environment: simulated fetch with readable stream
  if (!Capacitor.isNativePlatform()) {
    try {
      const response = await fetch(audioUrl);
      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      let loaded = 0;

      if (response.body && total > 0) {
        const reader = response.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          loaded += value.length;
          const pct = Math.min(95, Math.round((loaded / total) * 100));
          if (activeDownloads[song.id]) {
            activeDownloads[song.id].progress = pct;
            notifyProgress(activeDownloads);
          }
        }
      }

      saveMeta(total || 4500000);
      localStorage.setItem(`offline_track_${song.id}`, audioUrl);
      await cacheCanvasVideoIfPresent(song);

      if (activeDownloads[song.id]) {
        activeDownloads[song.id].progress = 100;
        activeDownloads[song.id].status = 'completed';
        notifyProgress(activeDownloads);
        setTimeout(() => {
          delete activeDownloads[song.id];
          notifyProgress(activeDownloads);
        }, 3000);
      }
      return audioUrl;
    } catch (error) {
      if (activeDownloads[song.id]) {
        activeDownloads[song.id].status = 'error';
        notifyProgress(activeDownloads);
      }
      localStorage.removeItem(`offline_meta_${song.id}`);
      throw error;
    }
  }

  // Native Capacitor filesystem execution
  try {
    const filename = `sonara_track_${song.id}.mp3`;

    let progressInterval = setInterval(() => {
      if (activeDownloads[song.id] && activeDownloads[song.id].progress < 90) {
        activeDownloads[song.id].progress += 15;
        notifyProgress(activeDownloads);
      }
    }, 300);

    const downloadResult = await Filesystem.downloadFile({
      url: audioUrl,
      path: filename,
      directory: Directory.Data,
      progress: true
    });

    clearInterval(progressInterval);

    let statSize = 0;
    try {
      const stat = await Filesystem.stat({
        path: filename,
        directory: Directory.Data
      });
      statSize = stat.size || 0;
    } catch (_) {}

    saveMeta(statSize);
    localStorage.setItem(`offline_track_${song.id}`, downloadResult.path);
    await cacheCanvasVideoIfPresent(song);

    if (activeDownloads[song.id]) {
      activeDownloads[song.id].progress = 100;
      activeDownloads[song.id].status = 'completed';
      notifyProgress(activeDownloads);
      setTimeout(() => {
        delete activeDownloads[song.id];
        notifyProgress(activeDownloads);
      }, 3000);
    }

    return downloadResult.path;
  } catch (error) {
    console.error(`Offline file caching failed for track: ${songTitle}`, error);
    if (activeDownloads[song.id]) {
      activeDownloads[song.id].status = 'error';
      notifyProgress(activeDownloads);
    }
    localStorage.removeItem(`offline_meta_${song.id}`);
    throw error;
  }
}

/**
 * Best-effort caching of a track's 10s Canvas video for offline playback.
 * Never throws — a missing/failed video download should not block the audio download.
 */
async function cacheCanvasVideoIfPresent(song) {
  const videoUrl = song.canvasVideoUrl;
  if (!videoUrl) return;

  try {
    if (!Capacitor.isNativePlatform()) {
      // Web/PWA: mirror the audio pattern — store the remote URL as the "offline" source.
      localStorage.setItem(`offline_video_${song.id}`, videoUrl);
      return;
    }

    const filename = `sonara_canvas_${song.id}.mp4`;
    const downloadResult = await Filesystem.downloadFile({
      url: videoUrl,
      path: filename,
      directory: Directory.Data
    });
    localStorage.setItem(`offline_video_${song.id}`, downloadResult.path);
  } catch (err) {
    console.warn(`Canvas video caching skipped for "${song.title || song.id}":`, err);
    localStorage.removeItem(`offline_video_${song.id}`);
  }
}

/**
 * Returns true if a specific song ID matching key parameters exists within persistent cached maps
 */
export function isTrackCachedOffline(songId) {
  return localStorage.getItem(`offline_track_${songId}`) !== null;
}

/**
 * Returns true if this track's Canvas video has been cached for offline playback
 */
export function isCanvasVideoCachedOffline(songId) {
  return localStorage.getItem(`offline_video_${songId}`) !== null;
}

/**
 * Resolves the best available source for the 10s looping Canvas video:
 * - a locally cached file (native path converted via Capacitor, or the stored URL on web)
 * - otherwise the remote Cloudinary URL, but only while online
 * - null if there's nothing playable right now (no video, or offline with nothing cached)
 */
export function getCanvasVideoSource(song) {
  if (!song) return null;

  const cachedPath = localStorage.getItem(`offline_video_${song.id}`);
  if (cachedPath) {
    return Capacitor.isNativePlatform() ? Capacitor.convertFileSrc(cachedPath) : cachedPath;
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) return null;
  return song.canvasVideoUrl || null;
}

/**
 * Rebuilds the list of downloaded songs entirely from localStorage
 */
export function getDownloadedSongsList() {
  const results = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith('offline_track_')) continue;
    const songId = key.replace('offline_track_', '');
    const localPath = localStorage.getItem(key);
    const rawMeta = localStorage.getItem(`offline_meta_${songId}`);
    let meta = {};
    try { meta = rawMeta ? JSON.parse(rawMeta) : {}; } catch (_) { meta = {}; }

    results.push({
      id: songId,
      title: meta.title || 'Downloaded Track',
      artist: meta.artist || 'Unknown Artist',
      cover: meta.cover || null,
      albumId: meta.albumId || null,
      quality: meta.quality || 'High',
      size: meta.size || 0,
      downloadedAt: meta.downloadedAt || null,
      songUrl: localPath,
    });
  }
  return results;
}

/**
 * Calculates total storage used by downloaded music tracks
 */
export function getTotalStorageUsage() {
  let totalBytes = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith('offline_meta_')) continue;
    try {
      const meta = JSON.parse(localStorage.getItem(key));
      totalBytes += (meta.size || 4500000); // 4.5MB fallback estimate
    } catch (_) {}
  }
  return totalBytes;
}

/**
 * Deletes a single downloaded song from device filesystem and storage metadata
 */
export async function deleteDownloadedSong(songId) {
  if (Capacitor.isNativePlatform()) {
    try {
      const filename = `sonara_track_${songId}.mp3`;
      await Filesystem.deleteFile({
        path: filename,
        directory: Directory.Data
      });
    } catch (_) {}
    try {
      const videoFilename = `sonara_canvas_${songId}.mp4`;
      await Filesystem.deleteFile({
        path: videoFilename,
        directory: Directory.Data
      });
    } catch (_) {}
  }
  localStorage.removeItem(`offline_track_${songId}`);
  localStorage.removeItem(`offline_meta_${songId}`);
  localStorage.removeItem(`offline_video_${songId}`);
}

/**
 * Resolves a safe binary player pathway reference asset link
 * Applies the user's selected streaming quality for remote tracks.
 */
export function getPlaybackSource(song, options = {}) {
  if (!song) return null;
  const localPath = localStorage.getItem(`offline_track_${song.id}`);
  if (localPath) return localPath;

  const remoteUrl = song.songUrl || song.audioUrl;
  if (!remoteUrl) return null;
  const quality = options.quality || getStreamingQuality();
  return applyQualityToUrl(remoteUrl, quality);
}

/**
 * Smart Storage Optimization:
 * - Scans and purges broken, empty, or orphaned offline metadata and tracks.
 * - On native Capacitor platforms: audits Directory.Data to ensure files referenced
 *   by localStorage exist, and purges any orphaned physical files left over from aborted downloads.
 * - Cleans up corrupted/stale image cache entries.
 * - Reconstructs missing track metadata where possible.
 */
export async function runSmartStorageOptimization({ songs = [] } = {}) {
  let cleanedRecords = 0;
  let freedBytes = 0;
  let repairedRecords = 0;

  try {
    const trackKeys = new Set();
    const metaKeys = new Set();
    const videoKeys = new Set();
    const imgCacheKeys = new Set();

    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.startsWith('offline_track_')) trackKeys.add(k);
      else if (k.startsWith('offline_meta_')) metaKeys.add(k);
      else if (k.startsWith('offline_video_')) videoKeys.add(k);
      else if (k.startsWith('cached_img_')) imgCacheKeys.add(k);
    }

    // 1. Audit offline_track_* entries
    for (const trackKey of trackKeys) {
      const songId = trackKey.replace('offline_track_', '');
      const trackVal = localStorage.getItem(trackKey);

      // Broken or empty entry
      if (!trackVal || trackVal.trim() === '' || trackVal === 'null' || trackVal === 'undefined') {
        localStorage.removeItem(trackKey);
        localStorage.removeItem(`offline_meta_${songId}`);
        localStorage.removeItem(`offline_video_${songId}`);
        cleanedRecords++;
        continue;
      }

      // Native filesystem existence & integrity check
      if (Capacitor.isNativePlatform() && trackVal.includes('sonara_track_')) {
        try {
          const filename = `sonara_track_${songId}.mp3`;
          const stat = await Filesystem.stat({
            path: filename,
            directory: Directory.Data,
          });
          if (!stat || stat.size === 0) {
            await Filesystem.deleteFile({ path: filename, directory: Directory.Data }).catch(() => {});
            localStorage.removeItem(trackKey);
            localStorage.removeItem(`offline_meta_${songId}`);
            localStorage.removeItem(`offline_video_${songId}`);
            cleanedRecords++;
            continue;
          }
        } catch (statErr) {
          // File does not physically exist on disk
          localStorage.removeItem(trackKey);
          localStorage.removeItem(`offline_meta_${songId}`);
          localStorage.removeItem(`offline_video_${songId}`);
          cleanedRecords++;
          continue;
        }
      }

      // Ensure metadata exists for this track; if missing, repair it
      const metaKey = `offline_meta_${songId}`;
      const rawMeta = localStorage.getItem(metaKey);
      if (!rawMeta) {
        const songMatch = songs.find(s => s.id === songId);
        const repaired = {
          id: songId,
          title: songMatch?.title || songMatch?.name || 'Offline Track',
          artist: songMatch?.artist || 'Unknown Artist',
          cover: songMatch?.cover || songMatch?.image || songMatch?.imageUrl || null,
          albumId: songMatch?.albumId || null,
          quality: getDownloadQuality(),
          size: 4500000,
          downloadedAt: new Date().toISOString()
        };
        localStorage.setItem(metaKey, JSON.stringify(repaired));
        repairedRecords++;
      }
    }

    // 2. Audit orphaned offline_meta_* (meta exists without matching track)
    for (const metaKey of metaKeys) {
      const songId = metaKey.replace('offline_meta_', '');
      if (!localStorage.getItem(`offline_track_${songId}`)) {
        try {
          const parsed = JSON.parse(localStorage.getItem(metaKey) || '{}');
          freedBytes += (parsed.size || 0);
        } catch (_) {}
        localStorage.removeItem(metaKey);
        cleanedRecords++;
      }
    }

    // 3. Audit orphaned offline_video_*
    for (const videoKey of videoKeys) {
      const songId = videoKey.replace('offline_video_', '');
      const hasTrack = localStorage.getItem(`offline_track_${songId}`);
      const hasSong = songs.some(s => s.id === songId);
      if (!hasTrack && !hasSong) {
        if (Capacitor.isNativePlatform()) {
          try {
            await Filesystem.deleteFile({
              path: `sonara_canvas_${songId}.mp4`,
              directory: Directory.Data
            });
          } catch (_) {}
        }
        localStorage.removeItem(videoKey);
        cleanedRecords++;
      }
    }

    // 4. Native Orphan File Scavenger (files on disk with no localStorage reference)
    if (Capacitor.isNativePlatform()) {
      try {
        const dirResult = await Filesystem.readdir({
          path: '',
          directory: Directory.Data,
        });
        const files = dirResult.files || [];
        for (const file of files) {
          const filename = typeof file === 'string' ? file : file.name;
          if (!filename) continue;

          if (filename.startsWith('sonara_track_') && filename.endsWith('.mp3')) {
            const songId = filename.replace('sonara_track_', '').replace('.mp3', '');
            if (!localStorage.getItem(`offline_track_${songId}`)) {
              try {
                const stat = await Filesystem.stat({ path: filename, directory: Directory.Data });
                freedBytes += (stat.size || 0);
                await Filesystem.deleteFile({ path: filename, directory: Directory.Data });
                cleanedRecords++;
              } catch (_) {}
            }
          } else if (filename.startsWith('sonara_canvas_') && filename.endsWith('.mp4')) {
            const songId = filename.replace('sonara_canvas_', '').replace('.mp4', '');
            if (!localStorage.getItem(`offline_video_${songId}`)) {
              try {
                const stat = await Filesystem.stat({ path: filename, directory: Directory.Data });
                freedBytes += (stat.size || 0);
                await Filesystem.deleteFile({ path: filename, directory: Directory.Data });
                cleanedRecords++;
              } catch (_) {}
            }
          }
        }
      } catch (fsErr) {
        console.warn('Native storage directory scan skipped:', fsErr);
      }
    }

    // 5. Clean invalid / empty image cache entries
    for (const imgKey of imgCacheKeys) {
      const val = localStorage.getItem(imgKey);
      if (!val || val.length < 20) {
        localStorage.removeItem(imgKey);
        cleanedRecords++;
      }
    }
  } catch (err) {
    console.error('Smart storage optimization encountered an issue:', err);
  }

  const formatMb = (b) => (b / (1024 * 1024)).toFixed(1);
  let details = '';
  if (cleanedRecords > 0 && freedBytes > 0) {
    details = `Smart Storage: Purged ${cleanedRecords} orphaned item${cleanedRecords !== 1 ? 's' : ''} (${formatMb(freedBytes)} MB freed)`;
  } else if (cleanedRecords > 0) {
    details = `Smart Storage: Cleaned ${cleanedRecords} orphaned storage record${cleanedRecords !== 1 ? 's' : ''}`;
  } else if (repairedRecords > 0) {
    details = `Smart Storage: Repaired ${repairedRecords} track metadata record${repairedRecords !== 1 ? 's' : ''}`;
  } else {
    details = 'Smart Storage: Cache healthy & fully optimized';
  }

  return { cleanedRecords, freedBytes, repairedRecords, details };
}

/**
 * Wipes out all stored local tracking registry flags and deletes downloaded native files
 */
export async function clearAllLocalCache() {
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('offline_track_')) {
      keysToRemove.push(key);
    }
  }

  if (Capacitor.isNativePlatform()) {
    for (const key of keysToRemove) {
      const storedPath = localStorage.getItem(key);
      if (!storedPath) continue;
      try {
        const filename = storedPath.split('/').pop();
        await Filesystem.deleteFile({
          path: filename,
          directory: Directory.Data
        });
      } catch (e) {}
    }

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('offline_video_')) continue;
      const storedPath = localStorage.getItem(key);
      if (!storedPath) continue;
      try {
        const filename = storedPath.split('/').pop();
        await Filesystem.deleteFile({ path: filename, directory: Directory.Data });
      } catch (e) {}
    }
  }

  keysToRemove.forEach((key) => {
    const songId = key.replace('offline_track_', '');
    localStorage.removeItem(key);
    localStorage.removeItem(`offline_meta_${songId}`);
    localStorage.removeItem(`offline_video_${songId}`);
  });
}