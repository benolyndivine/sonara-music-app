/**
 * Shared audio quality preference helpers — backed by localStorage.
 * Two independent settings:
 *
 *  - Streaming quality: which bitrate tier to request while playing a
 *    track live over the network.
 *  - Download quality: which bitrate tier to request when saving a track
 *    for offline playback.
 *
 * For Cloudinary-hosted audio assets (which power Sonara's streaming and downloads),
 * `applyQualityToUrl` dynamically injects Cloudinary's native audio bitrate
 * transformation (`br_96k`, `br_160k`, `br_256k`, `br_320k`).
 * For other audio CDNs/sources, it falls back to appending `quality=<tier>`.
 */

export const STREAMING_QUALITY_OPTIONS = ['Data Saver', 'Normal', 'High', 'Very High'];
export const DOWNLOAD_QUALITY_OPTIONS = ['Normal', 'High', 'Very High'];

export const QUALITY_BITRATES = {
  'Data Saver': '96k',
  'Normal': '160k',
  'High': '256k',
  'Very High': '320k'
};

export const QUALITY_LABELS = {
  'Data Saver': '96 kbps',
  'Normal': '160 kbps',
  'High': '256 kbps',
  'Very High': '320 kbps (Lossless)'
};

const STREAMING_KEY = 'sonara_streaming_quality';
const DOWNLOAD_KEY = 'sonara_download_quality';

const DEFAULT_STREAMING_QUALITY = 'High';
const DEFAULT_DOWNLOAD_QUALITY = 'High';

export function getStreamingQuality() {
  const stored = localStorage.getItem(STREAMING_KEY);
  return STREAMING_QUALITY_OPTIONS.includes(stored) ? stored : DEFAULT_STREAMING_QUALITY;
}

export function setStreamingQuality(quality) {
  if (!STREAMING_QUALITY_OPTIONS.includes(quality)) return;
  localStorage.setItem(STREAMING_KEY, quality);
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('sonara_streaming_quality_changed', { detail: { quality } }));
    } catch (_) {}
  }
}

export function getDownloadQuality() {
  const stored = localStorage.getItem(DOWNLOAD_KEY);
  return DOWNLOAD_QUALITY_OPTIONS.includes(stored) ? stored : DEFAULT_DOWNLOAD_QUALITY;
}

export function setDownloadQuality(quality) {
  if (!DOWNLOAD_QUALITY_OPTIONS.includes(quality)) return;
  localStorage.setItem(DOWNLOAD_KEY, quality);
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('sonara_download_quality_changed', { detail: { quality } }));
    } catch (_) {}
  }
}

/**
 * Appends `quality=<tier>` to a track URL's query string without
 * disturbing any params it already carries. Safe to call on any URL.
 */
export function appendQualityParam(url, quality) {
  if (!url || !quality) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}quality=${encodeURIComponent(quality)}`;
}

/**
 * Transforms an audio URL to match the exact bitrate quality tier:
 * - For Cloudinary URLs, injects or updates `br_<bitrate>` audio transformation
 *   (e.g., `br_96k`, `br_160k`, `br_256k`, `br_320k`), which dynamically transcodes
 *   the audio stream to the selected bitrate.
 * - For local file paths, blob URLs, and data URIs, returns them untouched.
 * - For generic remote URLs, appends `quality=<tier>`.
 */
export function applyQualityToUrl(url, quality) {
  if (!url) return url;
  const targetQuality = quality || DEFAULT_STREAMING_QUALITY;
  const bitrate = QUALITY_BITRATES[targetQuality] || '256k';

  // Do not touch local files, blob URLs, or relative paths
  if (
    url.startsWith('file:') ||
    url.startsWith('blob:') ||
    url.startsWith('data:') ||
    url.startsWith('cdvfile:') ||
    url.startsWith('/') ||
    url.startsWith('./')
  ) {
    return url;
  }

  // Cloudinary media CDN audio bitrate transformation
  const cldRegex = /^(https?:\/\/res\.cloudinary\.com\/[^/]+\/(?:video|auto|raw)\/upload\/)(.*)$/i;
  const match = url.match(cldRegex);
  if (match) {
    const prefix = match[1];
    let rest = match[2];
    if (/\bbr_\d+k\b/.test(rest)) {
      rest = rest.replace(/\bbr_\d+k\b/, `br_${bitrate}`);
    } else {
      rest = `br_${bitrate}/${rest}`;
    }
    return `${prefix}${rest}`;
  }

  return appendQualityParam(url, targetQuality);
}
