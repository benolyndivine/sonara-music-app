/**
 * Shared "saved artist" helpers — backed by the same `saved_artist_{id}`
 * localStorage flag that ArtistDetailsView's ✓ button toggles. Keeping this
 * in one place means Library, the Profile drawer, and ArtistDetailsView
 * itself can never fall out of sync on what "saved" means.
 */
export function isArtistSaved(artistId) {
  return localStorage.getItem(`saved_artist_${artistId}`) === 'true';
}

export function setArtistSaved(artistId, saved) {
  localStorage.setItem(`saved_artist_${artistId}`, saved ? 'true' : 'false');
}

export function getSavedArtists(artists = []) {
  return artists.filter((artist) => isArtistSaved(artist.id));
}