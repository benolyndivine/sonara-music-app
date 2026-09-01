/**
 * Shared time-synced lyrics helper.
 *
 * Lyrics are stored as plain text in Firestore (one line per row). This
 * module lets each line optionally carry a leading LRC-style timestamp,
 * e.g. "[00:12.50] Never gonna give you up" — same format used by most
 * karaoke/lyrics tools, so pasted .lrc files "just work".
 *
 * Lines with no timestamp are treated as unsynced. A lyrics block only
 * counts as "synced" once it has at least two timestamped lines (one alone
 * can't establish a timeline), so older plain-text lyrics keep rendering
 * exactly as before with zero migration needed.
 */

const TIMESTAMP_RE = /^\s*\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]\s*/;

/**
 * Parses a raw lyrics string into an array of { time, text } lines.
 * `time` is seconds (number) if the line had a timestamp, otherwise null.
 */
export function parseLyricsLines(rawText) {
  const text = rawText || '';
  return text.split('\n').map((rawLine) => {
    const match = rawLine.match(TIMESTAMP_RE);
    if (!match) {
      return { time: null, text: rawLine };
    }
    const minutes = parseInt(match[1], 10);
    const seconds = parseInt(match[2], 10);
    const fraction = match[3] ? parseFloat(`0.${match[3]}`) : 0;
    const time = minutes * 60 + seconds + fraction;
    return { time, text: rawLine.slice(match[0].length) };
  });
}

/**
 * Parses lyrics text and reports whether there's enough timestamp coverage
 * to drive karaoke-style highlighting.
 */
export function parseSyncedLyrics(rawText) {
  const lines = parseLyricsLines(rawText);
  const timestampedCount = lines.filter((l) => l.time !== null).length;
  return {
    lines,
    isSynced: timestampedCount >= 2,
  };
}

/**
 * Given synced lines and the current playback position (seconds), returns
 * the index of the line that should be highlighted as "now playing", or -1
 * if playback hasn't reached the first timestamp yet.
 */
export function getActiveLyricsLineIndex(lines, currentTimeSeconds) {
  let activeIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const { time } = lines[i];
    if (time === null) continue;
    if (time <= currentTimeSeconds) {
      activeIndex = i;
    } else {
      break;
    }
  }
  return activeIndex;
}

/** Formats seconds as an "mm:ss" LRC-style timestamp tag, e.g. "[03:07]". */
export function formatTimestampTag(seconds) {
  const total = Math.max(0, Math.floor(seconds || 0));
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `[${mins}:${secs < 10 ? '0' : ''}${secs}]`;
}
