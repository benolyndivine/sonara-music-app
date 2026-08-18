import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';
import { getDownloadQuality, getStreamingQuality, appendQualityParam } from './audioQuality';

/**
 * Downloads a remote track file source stream to localized app directories on hybrid hardware
 */
export async function downloadTrackToDevice(song) {
  const rawAudioUrl = song.songUrl || song.audioUrl;
  const songTitle = song.title || song.name;
  if (!rawAudioUrl) throw new Error("No target streaming audio URL source registered for this track record.");

  // 🆕 Request the tier picked in Settings → Download Quality. Backends that
  // support per-request transcoding profiles honor `quality` immediately;
  // this is also the value we store alongside the file below so the
  // Downloaded tab / storage stats can show what quality is on disk.
  const downloadQuality = getDownloadQuality();
  const audioUrl = appendQualityParam(rawAudioUrl, downloadQuality);

  // 🛠️ FIX: Save the song's own display metadata alongside the download.
  // Previously the Library's Downloaded tab only ever showed
  // songs.filter(isTrackCachedOffline) — but `songs` comes from a Firestore
  // onSnapshot listener, which returns nothing on a fully offline cold
  // start (no cached data to read yet). Storing metadata here means the
  // Downloaded tab can render straight from localStorage with zero
  // dependency on Firestore ever having loaded.
  const meta = {
    id: song.id,
    title: songTitle,
    artist: song.artist || 'Unknown Artist',
    cover: song.cover || song.image || song.imageUrl || null,
    albumId: song.albumId || null,
    quality: downloadQuality,
  };
  localStorage.setItem(`offline_meta_${song.id}`, JSON.stringify(meta));

  // For standard desktop web browsers, fallback seamlessly to native cache tracking descriptors
  if (!Capacitor.isNativePlatform()) {
    localStorage.setItem(`offline_track_${song.id}`, audioUrl);
    return audioUrl;
  }

  try {
    const filename = `sonara_track_${song.id}.mp3`;

    // Initialize cross-origin background fetch execution
    const downloadResult = await Filesystem.downloadFile({
      url: audioUrl,
      path: filename,
      directory: Directory.Data
    });

    // Save mapping identifier key locally to allow instant zero-network lookups
    localStorage.setItem(`offline_track_${song.id}`, downloadResult.path);
    return downloadResult.path;
  } catch (error) {
    console.error(`Offline file caching failed for track: ${songTitle}`, error);
    localStorage.removeItem(`offline_meta_${song.id}`);
    throw error;
  }
}

/**
 * Returns true if a specific song ID matching key parameters exists within persistent cached maps
 */
export function isTrackCachedOffline(songId) {
  return localStorage.getItem(`offline_track_${songId}`) !== null;
}

/**
 * Rebuilds the list of downloaded songs entirely from localStorage — does
 * NOT depend on the live `songs` array from Firestore. This is what makes
 * the Library's Downloaded tab work on a fully offline cold start, before
 * any onSnapshot data has ever arrived.
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
      // Keep songUrl populated so anything expecting it still works —
      // getPlaybackSource() will still prefer the local file either way.
      songUrl: localPath,
    });
  }
  return results;
}

/**
 * Resolves a safe binary player pathway reference asset link
 */
export function getPlaybackSource(song) {
  if (!song) return null;
  const localPath = localStorage.getItem(`offline_track_${song.id}`);
  
  if (localPath) {
    // 🛠️ FIX: Native audio playback goes through the Cordova Media plugin
    // (Media.create), which talks directly to the OS media player and needs
    // a real filesystem path. Capacitor.convertFileSrc() produces a
    // WebView-only resource URL (capacitor://.../_capacitor_file_/...) meant
    // for <img>/<video> tags — Media.create() can't resolve that to a file,
    // so it silently failed to play anything that had been downloaded.
    // The raw path from Filesystem.downloadFile() is exactly what Media.create() expects.
    return localPath;
  }

  // 🆕 No local copy — streaming live over the network, so apply the tier
  // picked in Settings → Streaming Quality. Same `quality` query-param
  // convention as downloads (see downloadTrackToDevice above).
  const remoteUrl = song.songUrl || song.audioUrl;
  if (!remoteUrl) return null;
  return appendQualityParam(remoteUrl, getStreamingQuality());
}

/**
 * Wipes out all stored local tracking registry flags and deletes downloaded native files
 */
export async function clearAllLocalCache() {
  // 🛠️ FIX: This used to take an external `songsList` (the live Firestore
  // `songs` array) and loop over IT to figure out which native files to
  // delete. That's the wrong source of truth — if `songsList` was empty or
  // incomplete (e.g. opened while offline, before Firestore had loaded —
  // see the Downloaded-tab fix above), step 2 below still unconditionally
  // wiped every `offline_track_*` tracking key, so the app "forgot" those
  // downloads and they vanished from the Downloaded tab, while the actual
  // files silently stayed orphaned on disk since step 1 never found them.
  // Deriving the file list directly from localStorage (the actual record
  // of what's downloaded) keeps deletion and bookkeeping consistent no
  // matter what's loaded from Firestore at the time.
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('offline_track_')) {
      keysToRemove.push(key);
    }
  }

  // 1. Loop and wipe physical device binary files if running natively
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
      } catch (e) {
        // Safe to skip silently if the file wasn't downloaded or found inside local scopes
      }
    }
  }

  // 2. Clear out all offline tracker + metadata descriptors from localStorage
  keysToRemove.forEach((key) => {
    const songId = key.replace('offline_track_', '');
    localStorage.removeItem(key);
    localStorage.removeItem(`offline_meta_${songId}`);
  });
}