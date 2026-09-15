import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

// Persistent cache for remote images (song covers, album/artist art, etc.)
// so they still render when the app is opened without a network connection.
//
// Native (Android via Capacitor): images are downloaded once into the app's
// Cache directory and served back via Capacitor.convertFileSrc().
// Web/PWA: images are stored in the browser's CacheStorage, which (unlike
// blob/object URLs) survives page reloads.

const CACHE_DIR_PREFIX = 'sonara_img_';
const WEB_CACHE_NAME = 'sonara-image-cache-v1';

// Tracks in-flight caching work so the same image is never downloaded twice
// in parallel (e.g. the same cover showing up in a row and a mini player).
const inFlight = new Map();

// Synchronous, in-memory record of the last resolved src for a given URL.
// Lets <CachedImage> skip straight to the known-good src on remount
// (e.g. navigating away from a page and back) instead of flashing back to
// the placeholder while it re-resolves asynchronously.
const resolvedMemoryCache = new Map();

// Web only: a blob: URL is only valid for the life of the tab, so once we've
// minted one for a given remote URL we keep reusing that exact string rather
// than creating a new one on every resolve — a fresh blob: URL forces the
// <img> to redecode even though the underlying bytes are identical, which is
// what previously looked like the cover "reloading" on every visit.
const webBlobUrlCache = new Map();

function hashUrl(url) {
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = (hash * 31 + url.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
}

function extensionFromUrl(url) {
  const clean = url.split('?')[0].split('#')[0];
  const match = /\.(png|jpe?g|webp|gif|avif)$/i.exec(clean);
  return match ? match[1].toLowerCase() : 'jpg';
}

function nativeFilename(url) {
  return `${CACHE_DIR_PREFIX}${hashUrl(url)}.${extensionFromUrl(url)}`;
}

async function getCachedNative(url) {
  const filename = nativeFilename(url);
  try {
    const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache });
    // getUri succeeds even for files that don't exist on some platforms, so verify with stat.
    await Filesystem.stat({ path: filename, directory: Directory.Cache });
    return Capacitor.convertFileSrc(uri);
  } catch (_) {
    return null;
  }
}

async function cacheNative(url) {
  const filename = nativeFilename(url);
  try {
    await Filesystem.downloadFile({ url, path: filename, directory: Directory.Cache });
    const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache });
    return Capacitor.convertFileSrc(uri);
  } catch (err) {
    console.warn('Image cache (native) failed for', url, err);
    return null;
  }
}

async function getCachedWeb(url) {
  if (webBlobUrlCache.has(url)) return webBlobUrlCache.get(url);
  if (typeof caches === 'undefined') return null;
  try {
    const cache = await caches.open(WEB_CACHE_NAME);
    const match = await cache.match(url);
    if (!match) return null;
    const blob = await match.blob();
    const objectUrl = URL.createObjectURL(blob);
    webBlobUrlCache.set(url, objectUrl); // reused on every future resolve for this url
    return objectUrl;
  } catch (_) {
    return null;
  }
}

async function cacheWeb(url) {
  if (typeof caches === 'undefined') return null;
  try {
    const cache = await caches.open(WEB_CACHE_NAME);
    const response = await fetch(url, { mode: 'cors' });
    if (!response || !response.ok) return null;
    await cache.put(url, response.clone());
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch (err) {
    console.warn('Image cache (web) failed for', url, err);
    return null;
  }
}

async function getCachedImage(url) {
  return Capacitor.isNativePlatform() ? getCachedNative(url) : getCachedWeb(url);
}

async function cacheImage(url) {
  return Capacitor.isNativePlatform() ? cacheNative(url) : cacheWeb(url);
}

/**
 * Ensures a remote image URL is (or becomes) cached on disk, without
 * blocking the caller. Safe to call repeatedly for the same URL.
 */
export function primeImageCache(url) {
  if (!url || typeof url !== 'string' || !/^https?:\/\//i.test(url)) return;
  if (inFlight.has(url)) return;
  const task = (async () => {
    const existing = await getCachedImage(url);
    if (existing) {
      resolvedMemoryCache.set(url, existing);
      return;
    }
    const cached = await cacheImage(url);
    if (cached) resolvedMemoryCache.set(url, cached);
  })().finally(() => inFlight.delete(url));
  inFlight.set(url, task);
}

/**
 * Synchronous lookup for whatever CachedImage last resolved for this URL, if
 * anything. Used to seed a remounting <CachedImage>'s initial state so it
 * doesn't flash back to a placeholder for images it already knows how to show.
 */
export function getResolvedFromMemory(url) {
  if (!url || typeof url !== 'string') return null;
  if (!/^https?:\/\//i.test(url)) return url; // local/bundled asset, data URI, etc.
  return resolvedMemoryCache.get(url) || null;
}

/**
 * Resolves the best src to render for a remote image right now:
 * - a cached local/blob src if one already exists on disk
 * - otherwise the remote URL itself while online (and kicks off caching
 *   in the background so it's available next time)
 * - null while offline with nothing cached yet
 */
export async function resolveImageSrc(url) {
  if (!url || typeof url !== 'string') return null;
  if (!/^https?:\/\//i.test(url)) return url; // local/bundled asset, data URI, etc.

  const memoized = resolvedMemoryCache.get(url);
  if (memoized) return memoized;

  const cached = await getCachedImage(url);
  if (cached) {
    resolvedMemoryCache.set(url, cached);
    return cached;
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) return null;

  // Online and not cached yet: show the remote URL now, cache for later.
  primeImageCache(url);
  resolvedMemoryCache.set(url, url);
  return url;
}

export function isImageCachingSupported() {
  return Capacitor.isNativePlatform() || typeof caches !== 'undefined';
}