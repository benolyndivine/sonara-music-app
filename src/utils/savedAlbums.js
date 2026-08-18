/**
 * Shared "saved album" helpers — backed by the same `saved_album_{id}`
 * localStorage flag that AlbumDetailsView's ✓ button toggles. Keeping this
 * in one place means Library and AlbumDetailsView itself can never fall
 * out of sync on what "saved" means. Mirrors utils/savedArtists.js.
 */
export function isAlbumSaved(albumId) {
  return localStorage.getItem(`saved_album_${albumId}`) === 'true';
}

export function setAlbumSaved(albumId, saved) {
  localStorage.setItem(`saved_album_${albumId}`, saved ? 'true' : 'false');
}

export function getSavedAlbums(albums = []) {
  return albums.filter((album) => isAlbumSaved(album.id));
}