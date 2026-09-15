/**
 * Shared audio quality preference helpers — backed by localStorage, same
 * pattern as savedArtists.js. Two independent settings:
 *
 *  - Streaming quality: which bitrate tier to request while playing a
 *    track live over the network.
 *  - Download quality: which bitrate tier to request when saving a track
 *    for offline playback.
 *
 * Sonara's current track records only carry a single `songUrl`/`audioUrl`
 * per song (no separate low/high bitrate files), so there's nothing to
 * switch between locally yet. To make the setting meaningful today rather
 * than a no-op toggle, the selected tier is sent to the CDN/streaming
 * backend as a `quality` query param on every request — servers that
 * support per-request transcoding profiles can honor it immediately, and
 * once Sonara's backend serves real per-quality file variants this is the
 * single choke point that will need to change.
 */

export const STREAMING_QUALITY_OPTIONS = ['Data Saver', 'Normal', 'High', 'Very High'];
export const DOWNLOAD_QUALITY_OPTIONS = ['Normal', 'High', 'Very High'];

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
}

export function getDownloadQuality() {
  const stored = localStorage.getItem(DOWNLOAD_KEY);
  return DOWNLOAD_QUALITY_OPTIONS.includes(stored) ? stored : DEFAULT_DOWNLOAD_QUALITY;
}

export function setDownloadQuality(quality) {
  if (!DOWNLOAD_QUALITY_OPTIONS.includes(quality)) return;
  localStorage.setItem(DOWNLOAD_KEY, quality);
}

/**
 * Appends `quality=<tier>` to a track URL's query string without
 * disturbing any params it already carries. Safe to call on any URL —
 * relative, absolute, or already-querystring'd.
 */
export function appendQualityParam(url, quality) {
  if (!url || !quality) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}quality=${encodeURIComponent(quality)}`;
}