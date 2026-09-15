/**
 * Shared artist-matching helper.
 *
 * Problem: song.artist is a free-text string in Firestore, and many tracks
 * credit more than one artist — e.g. "Anirudh Ravichander, Jonita Gandhi",
 * "Artist A feat. Artist B", "Artist A ft. Artist B", "Artist A x Artist B".
 * A strict `song.artist === artist.name` comparison only matches when the
 * artist is the ONLY name in that field, so any collaboration track silently
 * disappears from that artist's page even though they're clearly on it.
 *
 * This splits the song's artist string on common separators/credit markers
 * and checks each resulting name individually (case-insensitive, trimmed)
 * against the target artist name.
 */
export function splitArtistCredits(artistField) {
  if (!artistField) return [];
  return artistField
    .split(/,|&|\/|\||•|·|–|—|\band\b|\bfeat\.?|\bft\.?|\bvs\.?|\bx\b/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

// Lowercases, collapses all whitespace (including non-breaking spaces, tabs,
// odd unicode spacing that sometimes sneaks into Firestore text fields) down
// to single regular spaces, and trims.
function normalize(str) {
  return (str || '')
    .toLowerCase()
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function songMatchesArtist(song, artistName) {
  if (!song?.artist || !artistName) return false;
  const target = normalize(artistName);
  if (!target) return false;

  const normalizedField = normalize(song.artist);
  if (normalizedField === target) return true;

  // Try splitting on every separator we know about first (fast path).
  const credits = splitArtistCredits(song.artist).map((c) => normalize(c));
  if (credits.includes(target)) return true;

  // Fallback: whatever the separator actually is, check whether the artist's
  // name appears as a whole standalone chunk inside the field — bounded by
  // non-alphanumeric characters (or the start/end of the string) so a short
  // name doesn't false-match as a substring of a longer, different one.
  const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const boundaryMatch = new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, 'i');
  return boundaryMatch.test(normalizedField);
}