import React, { useState, useEffect, useRef } from 'react';
import { doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { downloadTrackToDevice, isTrackCachedOffline, getDownloadedSongsList } from '../utils/offlineStorage';
import { songMatchesArtist } from '../utils/artistMatch';
import { getSavedArtists } from '../utils/savedArtists';
import { getSavedAlbums } from '../utils/savedAlbums';
import { triggerHaptic } from '../utils/audioEffects';
import CachedImage from './CachedImage';

export default function LibraryView({ 
  songs, 
  artists, 
  albums = [],
  playlists, 
  playlistSongs, 
  currentTrack,
  isPlaying,
  onTogglePlay,
  onSelectTrack, 
  onCreatePlaylist, 
  onDeletePlaylist, 
  onRemoveSong,
  onAddSongToPlaylist,
  onRenamePlaylist,
  onSelectArtist,
  onSelectAlbum,
  activeTab,
  onActiveTabChange,
  selectedPlaylist,
  onSelectPlaylist,
  isOffline,
  likedSongIds = [],
  onOpenSongMenu
}) {
  // 🛠️ FIX: activeTab used to be local state seeded once from a one-shot
  // `initialTab` prop. Since this component fully remounts every time the
  // user leaves and re-enters the Library (see below), that local state was
  // wiped on every remount — so opening something from the Albums or
  // Artists tab and pressing the Android back button always dropped the
  // user back on the Playlists tab instead of wherever they actually were.
  // Lifting the tab selection up to App.jsx (and feeding it through the
  // back-button navigation snapshot there) means it survives both the
  // remount and the back-stack correctly.
  const setActiveTab = (tab) => onActiveTabChange && onActiveTabChange(tab);
  // 🛠️ FIX: selectedPlaylist used to be local state here too, which had the
  // exact same problem as activeTab above — worse, actually: opening a
  // playlist didn't change `currentView`/`selectedAlbum`/`selectedArtist`/
  // etc. at all, so App.jsx's back-button history stack never even saw it
  // as a navigation step. Pressing Android back while looking at a playlist
  // skipped straight past the playlist (and sometimes past Library itself)
  // to whatever screen came before it. Lifting this up to App.jsx and
  // including it in that same snapshot makes "open a playlist" a real,
  // poppable step in the sequence, so back closes the playlist first and
  // only then continues unwinding history — same as every other detail view.
  const setSelectedPlaylist = (playlist) => onSelectPlaylist && onSelectPlaylist(playlist);
  const [editingPlaylistId, setEditingPlaylistId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [activeMenuId, setActiveMenuId] = useState(null); 
  const [activeTrackMenuId, setActiveTrackMenuId] = useState(null);

  // 🎨 Dedicated Create Playlist Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createModalName, setCreateModalName] = useState('');
  const [selectedSongIdsForNew, setSelectedSongIdsForNew] = useState(new Set());
  const [createModalSearch, setCreateModalSearch] = useState('');

  // 🪄 Playlist 3-Dot Bottom Sheet Dialog & Sub-Modals
  const [actionSheetPlaylist, setActionSheetPlaylist] = useState(null);
  const [addSongsModalPlaylist, setAddSongsModalPlaylist] = useState(null);
  const [addSongsSearch, setAddSongsSearch] = useState('');
  const [renameModalPlaylist, setRenameModalPlaylist] = useState(null);
  const [renameModalName, setRenameModalName] = useState('');

  // 🌟 Search & Sort States for Library & Playlist Details
  const [librarySearch, setLibrarySearch] = useState('');
  const [librarySort, setLibrarySort] = useState('recent'); // 'recent' | 'az' | 'count'
  const [playlistSearch, setPlaylistSearch] = useState('');
  const [showPlaylistSearch, setShowPlaylistSearch] = useState(false);

  // 📌 Pinned Playlists State
  const [pinnedPlaylistIds, setPinnedPlaylistIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sonara_pinned_playlists') || '[]'); } catch { return []; }
  });

  const togglePinPlaylist = (playlistId) => {
    triggerHaptic(20);
    setPinnedPlaylistIds((prev) => {
      const isPinned = prev.includes(playlistId);
      const next = isPinned ? prev.filter(id => id !== playlistId) : [playlistId, ...prev];
      try { localStorage.setItem('sonara_pinned_playlists', JSON.stringify(next)); } catch (_) {}
      return next;
    });
    setActionSheetPlaylist(null);
  };

  // 🆕 Detail-view (album-style) state: per-track download status + header "•••" menu
  const [trackDownloadedMap, setTrackDownloadedMap] = useState({});
  const [showPlaylistHeaderMenu, setShowPlaylistHeaderMenu] = useState(false);

  useEffect(() => {
    const hasOpenSubModal = showCreateModal || addSongsModalPlaylist || renameModalPlaylist || 
      showPlaylistHeaderMenu || showPlaylistSearch || activeMenuId || activeTrackMenuId;
    if (!hasOpenSubModal) return;

    const handleSubModalBack = (e) => {
      e.preventDefault();
      if (showCreateModal) {
        setShowCreateModal(false);
      } else if (addSongsModalPlaylist) {
        setAddSongsModalPlaylist(null);
      } else if (renameModalPlaylist) {
        setRenameModalPlaylist(null);
      } else if (showPlaylistHeaderMenu) {
        setShowPlaylistHeaderMenu(false);
      } else if (showPlaylistSearch) {
        setShowPlaylistSearch(false);
      } else if (activeMenuId) {
        setActiveMenuId(null);
      } else if (activeTrackMenuId) {
        setActiveTrackMenuId(null);
      }
    };
    window.addEventListener('sonara_back_press', handleSubModalBack);
    return () => window.removeEventListener('sonara_back_press', handleSubModalBack);
  }, [showCreateModal, addSongsModalPlaylist, renameModalPlaylist, showPlaylistHeaderMenu, showPlaylistSearch, activeMenuId, activeTrackMenuId]);

  // Local feedback map to show "Downloading..." text inside individual playlist 3-dots menus
  const [playlistDownloadStatus, setPlaylistDownloadStatus] = useState({});

  // ─────────────────────────────────────────────────────────────
  // 🔀 PLAYLIST TRACK REORDERING (press-and-drag the grip handle)
  // ─────────────────────────────────────────────────────────────
  // Uses Pointer Events (not HTML5 drag-and-drop) because HTML5 DnD has no
  // touch support in mobile WebViews — it only ever worked with a mouse.
  // Pointer Events unify mouse + touch, so holding the ⋮⋮ grip and dragging
  // works the same in the browser and on-device via Capacitor.
  const [draggedIndex, setDraggedIndex] = useState(null);
  // 🆕 Live pointer offset (px) while a row is picked up. Applied as a CSS
  // transform on the dragged row so it follows the finger continuously,
  // instead of the old behavior of snapping the array around row-by-row.
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [displaySongs, setDisplaySongs] = useState([]);
  const isDraggingRef = useRef(false);
  const dragMetricsRef = useRef({ startY: 0, rowHeight: 64 });
  const rowRefs = useRef({});
  // 🛠️ FIX: `draggedIndex` (React state) is read inside the pointerUp/move
  // handlers, but state updates are asynchronous. If pointerup fires before
  // the pointerdown's setDraggedIndex(index) has actually re-rendered (very
  // common on a quick drag, or even a plain tap on the grip), the pointerUp
  // handler that's still attached is the STALE one from before the drag
  // started — so it reads draggedIndex as null, bails out early, and never
  // resets isDraggingRef.current back to false. Since every row's onClick
  // checks `if (!isDraggingRef.current)`, that left the ENTIRE playlist
  // permanently un-tappable after any drag/reorder. This ref tracks the
  // dragged index synchronously (no render delay) so pointerUp always sees
  // the true, current value.
  const draggedIndexRef = useRef(null);

  // 🛠️ FIX: Previously this only ever filtered the live `songs` array from
  // Firestore. On a fully offline cold start, `songs` can still be an empty
  // [] (no cached snapshot to read from yet), which made the Downloaded tab
  // look empty even though tracks were genuinely cached on-device. Merge in
  // the local-only record (built straight from localStorage) for anything
  // downloaded that isn't present in the live `songs` list yet.
  const trackedOfflineIds = new Set();
  const offlineDownloadedSongs = songs.filter((song) => {
    if (isTrackCachedOffline(song.id)) {
      trackedOfflineIds.add(song.id);
      return true;
    }
    return false;
  });
  getDownloadedSongsList().forEach((localSong) => {
    if (!trackedOfflineIds.has(localSong.id)) {
      offlineDownloadedSongs.push(localSong);
    }
  });

  const getPlaylistSongsWithMapping = (playlistId) => {
    const targetMappings = playlistSongs.filter(item => item.playlistId === playlistId);
    
    const enriched = targetMappings.map(mapping => {
      const songData = songs.find(s => {
        const sTitle = (s?.title || s?.name || '').toLowerCase();
        const mSongId = (mapping?.songId || '').toLowerCase();
        return mSongId === sTitle || mapping?.songId === s?.id;
      });
      return songData ? { ...songData, mappingId: mapping.id, orderPosition: mapping.orderPosition || 0 } : null;
    }).filter(Boolean);

    return enriched.sort((a, b) => a.orderPosition - b.orderPosition);
  };

  // 🆕 Audit per-track download status whenever a playlist is opened, mirroring AlbumDetailsView
  useEffect(() => {
    if (!selectedPlaylist) return;
    const tracks = getPlaylistSongsWithMapping(selectedPlaylist.id);
    const audit = {};
    tracks.forEach((s) => { audit[s.id] = isTrackCachedOffline(s.id); });
    setTrackDownloadedMap(audit);
  }, [selectedPlaylist, songs, playlistSongs]);

  // Keep the on-screen track order synced with Firestore, except while a
  // drag is actively in progress — otherwise the onSnapshot round-trip that
  // fires after committing the reorder would yank the list back and forth.
  useEffect(() => {
    if (!selectedPlaylist || isDraggingRef.current) return;
    setDisplaySongs(getPlaylistSongsWithMapping(selectedPlaylist.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlaylist, songs, playlistSongs]);

  // Playlists that have at least one locally cached track — these can be
  // opened and played (partially or fully) with zero network connection.
  const offlineAvailablePlaylists = playlists.filter((playlist) =>
    getPlaylistSongsWithMapping(playlist.id).some((song) => isTrackCachedOffline(song.id))
  );

  // 🆕 Only artists the user has explicitly saved (via the ✓ button on
  // ArtistDetailsView) show up in the Library — mirrors how saved albums work.
  const savedArtists = getSavedArtists(artists)
    .map((artist) => {
      const artistSongCount = songs.filter((song) => songMatchesArtist(song, artist.name)).length;
      return { ...artist, songCount: artistSongCount };
    });

  // 🆕 Only albums the user has explicitly saved (via the ✓ button on
  // AlbumDetailsView) show up here — same pattern as savedArtists above.
  const savedAlbums = getSavedAlbums(albums)
    .map((album) => {
      const albumTrackCount = songs.filter((song) => song.albumId === album.id).length;
      return { ...album, trackCount: albumTrackCount };
    });

  const handleInlineRenameSave = async (playlistId) => {
    if (!editingName.trim()) {
      setEditingPlaylistId(null);
      return;
    }
    try {
      const playlistRef = doc(db, 'playlists', playlistId);
      await updateDoc(playlistRef, { playlistName: editingName.trim() });
      if (selectedPlaylist && selectedPlaylist.id === playlistId) {
        setSelectedPlaylist(prev => ({ ...prev, playlistName: editingName.trim() }));
      }
    } catch (err) { console.error(err); } 
    finally { setEditingPlaylistId(null); }
  };

  // 🆕 BATCH PLAYLIST DOWNLOAD HANDLER
  const handleDownloadPlaylist = async (playlist) => {
    const playlistTracks = getPlaylistSongsWithMapping(playlist.id);
    if (playlistTracks.length === 0) {
      alert("This playlist has no songs to download.");
      return;
    }

    setPlaylistDownloadStatus(prev => ({ ...prev, [playlist.id]: 'loading' }));
    
    try {
      let downloadCount = 0;
      for (const track of playlistTracks) {
        // Only trigger native file download transfer cycles if track isn't already cached locally
        if (!isTrackCachedOffline(track.id)) {
          await downloadTrackToDevice(track);
          downloadCount++;
        }
      }
      alert(`Successfully backed up playlist items offline! (${downloadCount} new tracks saved)`);
    } catch (err) {
      console.error("Batch playlist extraction rejected:", err);
      alert("An error occurred while downloading the playlist elements.");
    } finally {
      setPlaylistDownloadStatus(prev => ({ ...prev, [playlist.id]: null }));
    }
  };

  // Grab the handle: record where the press started and how tall a row is.
  // The array itself is NOT reordered while dragging anymore (see below) —
  // only the live pointer offset changes, so the picked-up row can follow
  // the finger pixel-for-pixel instead of snapping row-by-row.
  const handleGripPointerDown = (e, index) => {
    e.stopPropagation();
    e.preventDefault();
    const row = rowRefs.current[displaySongs[index]?.mappingId];
    dragMetricsRef.current = {
      startY: e.clientY,
      rowHeight: row?.offsetHeight || 64,
    };
    isDraggingRef.current = true;
    draggedIndexRef.current = index;
    setDraggedIndex(index);
    setDragOffsetY(0);
    try { e.target.setPointerCapture(e.pointerId); } catch (_) { /* not supported */ }
  };

  // 🛠️ REWORKED: previously this snapped the array around by whole rows
  // every time the pointer crossed a row-height boundary, which felt like
  // the song was being swapped rather than picked up and carried. Now the
  // dragged row just tracks the raw pointer delta continuously (applied as
  // a CSS transform in the render below, 1:1 with the finger), and the
  // array order is only actually committed once, on drop.
  const handleGripPointerMove = (e) => {
    if (draggedIndexRef.current === null) return;
    e.preventDefault();
    setDragOffsetY(e.clientY - dragMetricsRef.current.startY);
  };

  // Drop: figure out how many rows the live offset corresponds to, commit
  // that single reorder to `displaySongs`, then persist to Firestore.
  // orderPosition is what getPlaylistSongsWithMapping sorts by, so this is
  // what makes the new order stick after the view re-syncs from onSnapshot.
  //
  // 🛠️ FIX (kept from before): this used to bail out early with
  // `if (draggedIndex === null) return;`, reading draggedIndex from React
  // state. Because state updates are asynchronous, a fast pointerdown→
  // pointerup sequence could fire pointerup before the pointerdown's
  // setDraggedIndex(index) had re-rendered — so this handler ran with its
  // STALE pre-drag closure (draggedIndex still null), returned immediately,
  // and never reached the isDraggingRef.current = false reset below.
  // isDraggingRef then stayed stuck `true` forever, and since every song
  // row's onClick checks `if (!isDraggingRef.current)`, NO song in the
  // playlist could be tapped to play again after that. draggedIndexRef (a
  // ref, updated synchronously in handleGripPointerDown) fixes the race,
  // and the dragging flag is now always reset unconditionally so this can
  // never get stuck again.
  const handleGripPointerUp = async () => {
    const originIndex = draggedIndexRef.current;
    draggedIndexRef.current = null;
    setDraggedIndex(null);

    setTimeout(() => { isDraggingRef.current = false; }, 50);

    if (originIndex === null) {
      setDragOffsetY(0);
      return; // plain tap, not an actual drag — nothing to persist
    }

    const { rowHeight } = dragMetricsRef.current;
    const rawTarget = originIndex + Math.round(dragOffsetY / (rowHeight || 64));
    const targetIndex = Math.min(Math.max(rawTarget, 0), displaySongs.length - 1);
    setDragOffsetY(0);

    if (targetIndex === originIndex) return; // dropped back where it started

    const finalOrder = [...displaySongs];
    const [moved] = finalOrder.splice(originIndex, 1);
    finalOrder.splice(targetIndex, 0, moved);
    setDisplaySongs(finalOrder);

    try {
      const batch = writeBatch(db);
      finalOrder.forEach((song, idx) => {
        if (song.mappingId) {
          batch.update(doc(db, 'playlistSongs', song.mappingId), { orderPosition: idx });
        }
      });
      await batch.commit();
    } catch (err) {
      console.error('Failed to save new playlist order:', err);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 🎨 PLAYLIST CREATOR & 3-DOT ACTION SHEET LOGIC & MODALS
  // ─────────────────────────────────────────────────────────────
  const handleFinalizeCreatePlaylist = () => {
    if (!createModalName.trim()) return;
    triggerHaptic(25);
    const initialTracks = songs.filter(s => selectedSongIdsForNew.has(s.id) || selectedSongIdsForNew.has(s.title || s.name));
    onCreatePlaylist(createModalName.trim(), initialTracks);
    setCreateModalName('');
    setSelectedSongIdsForNew(new Set());
    setCreateModalSearch('');
    setShowCreateModal(false);
  };

  const toggleSongForNewPlaylist = (song) => {
    triggerHaptic(15);
    const key = song.id || song.title || song.name;
    setSelectedSongIdsForNew(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleActionPlay = (playlist) => {
    triggerHaptic(20);
    const pSongs = getPlaylistSongsWithMapping(playlist.id);
    if (!pSongs || pSongs.length === 0) {
      alert("This playlist has no songs yet.");
      setActionSheetPlaylist(null);
      return;
    }
    onSelectTrack(pSongs[0], pSongs);
    setActionSheetPlaylist(null);
  };

  const handleActionShuffle = (playlist) => {
    triggerHaptic(20);
    const pSongs = getPlaylistSongsWithMapping(playlist.id);
    if (!pSongs || pSongs.length === 0) {
      alert("This playlist has no songs yet.");
      setActionSheetPlaylist(null);
      return;
    }
    const shuffled = [...pSongs].sort(() => Math.random() - 0.5);
    onSelectTrack(shuffled[0], shuffled);
    setActionSheetPlaylist(null);
  };

  const handleActionAddSongs = (playlist) => {
    triggerHaptic(20);
    setActionSheetPlaylist(null);
    setAddSongsModalPlaylist(playlist);
    setAddSongsSearch('');
  };

  const handleActionOpenRename = (playlist) => {
    triggerHaptic(20);
    setActionSheetPlaylist(null);
    setRenameModalPlaylist(playlist);
    setRenameModalName(playlist.playlistName || '');
  };

  const handleSaveRename = async () => {
    if (!renameModalName.trim() || !renameModalPlaylist) return;
    triggerHaptic(25);
    const newTitle = renameModalName.trim();
    if (onRenamePlaylist) {
      await onRenamePlaylist(renameModalPlaylist.id, newTitle);
    } else {
      try {
        const playlistRef = doc(db, 'playlists', renameModalPlaylist.id);
        await updateDoc(playlistRef, { playlistName: newTitle });
      } catch (err) {
        console.error(err);
      }
    }
    if (selectedPlaylist && selectedPlaylist.id === renameModalPlaylist.id) {
      setSelectedPlaylist(prev => ({ ...prev, playlistName: newTitle }));
    }
    setRenameModalPlaylist(null);
    setRenameModalName('');
  };

  const handleActionShare = async (playlist) => {
    triggerHaptic(20);
    setActionSheetPlaylist(null);
    const shareData = {
      title: playlist.playlistName,
      text: `Listen to "${playlist.playlistName}" on Sonara!`,
      url: window.location.href
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
        alert("Playlist details copied to clipboard!");
      }
    } catch (err) {
      console.log("Share dismissed:", err);
    }
  };

  const handleActionDelete = (playlist) => {
    triggerHaptic(30);
    if (window.confirm(`Are you sure you want to delete playlist "${playlist.playlistName}"? This action cannot be undone.`)) {
      onDeletePlaylist(playlist.id);
      if (selectedPlaylist && selectedPlaylist.id === playlist.id) {
        setSelectedPlaylist(null);
      }
    }
    setActionSheetPlaylist(null);
  };

  const getActionPlaylistThumb = (playlist) => {
    if (!playlist) return 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=200&auto=format&fit=crop';
    const assigned = getPlaylistSongsWithMapping(playlist.id);
    return assigned.length > 0
      ? (assigned[0].cover || assigned[0].image || assigned[0].imageUrl)
      : 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=200&auto=format&fit=crop';
  };

  const filteredSongsForCreate = songs.filter(song => {
    if (!createModalSearch.trim()) return true;
    const q = createModalSearch.toLowerCase();
    return (song.title || song.name || '').toLowerCase().includes(q) || (song.artist || '').toLowerCase().includes(q);
  });

  const filteredSongsForExisting = songs.filter(song => {
    if (!addSongsSearch.trim()) return true;
    const q = addSongsSearch.toLowerCase();
    return (song.title || song.name || '').toLowerCase().includes(q) || (song.artist || '').toLowerCase().includes(q);
  });

  const renderCreatePlaylistModal = () => {
    if (!showCreateModal) return null;
    const countSelected = selectedSongIdsForNew.size;

    return (
      <div className="sonara-modal-backdrop" onClick={() => setShowCreateModal(false)}>
        <div className="sonara-modal-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="sheet-drag-handle"></div>

          <div className="sonara-modal-header">
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-main)' }}>Create Playlist</h3>
            <button
              type="button"
              className="sonara-modal-close-btn"
              onClick={() => setShowCreateModal(false)}
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div className="sonara-modal-body">
            {/* Visual Cover Preview */}
            <div className="playlist-creator-art-preview">
              <div className="playlist-art-gradient">
                <i className="fa-solid fa-music"></i>
              </div>
              <div className="playlist-art-meta">
                <h4>{createModalName.trim() || 'My Playlist'}</h4>
                <p>{countSelected} track{countSelected !== 1 ? 's' : ''} selected</p>
              </div>
            </div>

            {/* Playlist Title Field */}
            <div className="creator-input-container">
              <i className="fa-solid fa-pen-nib creator-input-icon"></i>
              <input
                type="text"
                placeholder="Give your playlist a title..."
                value={createModalName}
                onChange={(e) => setCreateModalName(e.target.value)}
                autoFocus
                className="creator-text-input"
              />
              {createModalName && (
                <button type="button" onClick={() => setCreateModalName('')} className="creator-clear-btn">
                  <i className="fa-solid fa-xmark"></i>
                </button>
              )}
            </div>

            {/* Interactive Song Picker Section */}
            <div className="creator-songs-section">
              <div className="creator-songs-header">
                <span>Add Songs to Playlist ({countSelected})</span>
                {countSelected > 0 && (
                  <button type="button" onClick={() => setSelectedSongIdsForNew(new Set())} className="creator-clear-selection-btn">
                    Clear all
                  </button>
                )}
              </div>

              <div className="creator-songs-search">
                <i className="fa-solid fa-magnifying-glass"></i>
                <input
                  type="text"
                  placeholder="Search songs to add..."
                  value={createModalSearch}
                  onChange={(e) => setCreateModalSearch(e.target.value)}
                />
                {createModalSearch && (
                  <i className="fa-solid fa-xmark" onClick={() => setCreateModalSearch('')}></i>
                )}
              </div>

              <div className="creator-songs-list">
                {filteredSongsForCreate.length > 0 ? (
                  filteredSongsForCreate.map((song) => {
                    const songKey = song.id || song.title || song.name;
                    const isSelected = selectedSongIdsForNew.has(songKey);
                    return (
                      <div
                        key={song.id || song.title}
                        className={`creator-song-row ${isSelected ? 'selected' : ''}`}
                        onClick={() => toggleSongForNewPlaylist(song)}
                      >
                        <CachedImage
                          src={song.cover || song.image || song.imageUrl}
                          alt=""
                          className="creator-song-thumb"
                        />
                        <div className="creator-song-info">
                          <div className="creator-song-title">{song.title || song.name}</div>
                          <div className="creator-song-artist">{song.artist || 'Unknown Artist'}</div>
                        </div>
                        <div className={`creator-checkbox ${isSelected ? 'checked' : ''}`}>
                          {isSelected && <i className="fa-solid fa-check"></i>}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', margin: '20px 0' }}>
                    No songs found matching "{createModalSearch}"
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="sonara-modal-footer">
            <button
              type="button"
              className="sonara-modal-cancel-btn"
              onClick={() => setShowCreateModal(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="sonara-modal-primary-btn"
              disabled={!createModalName.trim()}
              onClick={handleFinalizeCreatePlaylist}
            >
              <i className="fa-solid fa-folder-plus"></i>
              <span>{countSelected > 0 ? `Create with ${countSelected} tracks` : 'Create Playlist'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderActionSheet = () => {
    if (!actionSheetPlaylist) return null;
    const targetTracks = getPlaylistSongsWithMapping(actionSheetPlaylist.id);
    const isDownloading = playlistDownloadStatus[actionSheetPlaylist.id] === 'loading';

    return (
      <div className="sonara-modal-backdrop" onClick={() => setActionSheetPlaylist(null)}>
        <div className="sonara-action-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="sheet-drag-handle"></div>

          <div className="action-sheet-header">
            <CachedImage
              src={getActionPlaylistThumb(actionSheetPlaylist)}
              alt=""
              className="action-sheet-thumb"
            />
            <div className="action-sheet-meta">
              <h3>{actionSheetPlaylist.playlistName}</h3>
              <p>Playlist • {targetTracks.length} tracks • By you</p>
            </div>
            <button className="action-sheet-close-btn" onClick={() => setActionSheetPlaylist(null)}>
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div className="action-sheet-options">
            <button className="action-sheet-row" onClick={() => handleActionPlay(actionSheetPlaylist)}>
              <div className="action-icon-circle accent">
                <i className="fa-solid fa-play"></i>
              </div>
              <div className="action-text">
                <div className="action-title">Play Playlist</div>
                <div className="action-sub">Start playing from the top</div>
              </div>
            </button>

            <button className="action-sheet-row" onClick={() => handleActionShuffle(actionSheetPlaylist)}>
              <div className="action-icon-circle purple">
                <i className="fa-solid fa-shuffle"></i>
              </div>
              <div className="action-text">
                <div className="action-title">Shuffle Play</div>
                <div className="action-sub">Listen in randomized order</div>
              </div>
            </button>

            <button className="action-sheet-row" onClick={() => togglePinPlaylist(actionSheetPlaylist.id)}>
              <div className="action-icon-circle yellow" style={{ background: 'rgba(234, 179, 8, 0.2)', color: '#facc15' }}>
                <i className="fa-solid fa-thumbtack"></i>
              </div>
              <div className="action-text">
                <div className="action-title">
                  {pinnedPlaylistIds.includes(actionSheetPlaylist.id) ? 'Unpin from Top' : 'Pin to Top'}
                </div>
                <div className="action-sub">
                  {pinnedPlaylistIds.includes(actionSheetPlaylist.id) ? 'Remove pinned priority' : 'Keep at the top of your library'}
                </div>
              </div>
            </button>

            <button className="action-sheet-row" onClick={() => handleActionAddSongs(actionSheetPlaylist)}>
              <div className="action-icon-circle green">
                <i className="fa-solid fa-plus"></i>
              </div>
              <div className="action-text">
                <div className="action-title">Add Songs</div>
                <div className="action-sub">Pick and append tracks from library</div>
              </div>
              <i className="fa-solid fa-chevron-right action-chevron"></i>
            </button>

            <button
              className="action-sheet-row"
              disabled={isDownloading}
              onClick={() => {
                const target = actionSheetPlaylist;
                setActionSheetPlaylist(null);
                handleDownloadPlaylist(target);
              }}
            >
              <div className="action-icon-circle blue">
                <i className={isDownloading ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-circle-down"}></i>
              </div>
              <div className="action-text">
                <div className="action-title">{isDownloading ? 'Downloading Playlist...' : 'Download Playlist'}</div>
                <div className="action-sub">Save all tracks for offline listening</div>
              </div>
            </button>

            <button className="action-sheet-row" onClick={() => handleActionOpenRename(actionSheetPlaylist)}>
              <div className="action-icon-circle orange">
                <i className="fa-solid fa-pen-to-square"></i>
              </div>
              <div className="action-text">
                <div className="action-title">Rename Playlist</div>
                <div className="action-sub">Change playlist name</div>
              </div>
            </button>

            <button className="action-sheet-row" onClick={() => handleActionShare(actionSheetPlaylist)}>
              <div className="action-icon-circle teal">
                <i className="fa-solid fa-arrow-up-from-bracket"></i>
              </div>
              <div className="action-text">
                <div className="action-title">Share Playlist</div>
                <div className="action-sub">Share details or copy link</div>
              </div>
            </button>

            <button className="action-sheet-row danger" onClick={() => handleActionDelete(actionSheetPlaylist)}>
              <div className="action-icon-circle red">
                <i className="fa-solid fa-trash-can"></i>
              </div>
              <div className="action-text">
                <div className="action-title" style={{ color: '#ff4d4d' }}>Delete Playlist</div>
                <div className="action-sub">Permanently delete playlist and its songs</div>
              </div>
            </button>
          </div>

          <div className="action-sheet-footer">
            <button className="action-sheet-dismiss-btn" onClick={() => setActionSheetPlaylist(null)}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderAddSongsModal = () => {
    if (!addSongsModalPlaylist) return null;
    const currentAssignedMappings = playlistSongs.filter(m => m.playlistId === addSongsModalPlaylist.id);
    const existingSongKeys = new Set(currentAssignedMappings.map(m => (m.songId || '').toLowerCase()));

    return (
      <div className="sonara-modal-backdrop" onClick={() => setAddSongsModalPlaylist(null)}>
        <div className="sonara-modal-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="sheet-drag-handle"></div>

          <div className="sonara-modal-header">
            <div style={{ minWidth: 0, flex: 1, paddingRight: '10px' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Add to "{addSongsModalPlaylist.playlistName}"
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Tap a song to add it to your playlist
              </p>
            </div>
            <button
              type="button"
              className="sonara-modal-close-btn"
              onClick={() => setAddSongsModalPlaylist(null)}
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div className="sonara-modal-body" style={{ maxHeight: '60vh' }}>
            <div className="creator-songs-search">
              <i className="fa-solid fa-magnifying-glass"></i>
              <input
                type="text"
                placeholder="Search songs to add..."
                value={addSongsSearch}
                onChange={(e) => setAddSongsSearch(e.target.value)}
                autoFocus
              />
              {addSongsSearch && (
                <i className="fa-solid fa-xmark" onClick={() => setAddSongsSearch('')}></i>
              )}
            </div>

            <div className="creator-songs-list" style={{ maxHeight: '42vh' }}>
              {filteredSongsForExisting.length > 0 ? (
                filteredSongsForExisting.map((song) => {
                  const songTitleKey = (song.title || song.name || '').toLowerCase();
                  const songIdKey = (song.id || '').toLowerCase();
                  const isAlreadyIn = existingSongKeys.has(songTitleKey) || existingSongKeys.has(songIdKey);

                  return (
                    <div
                      key={song.id || song.title}
                      className="creator-song-row"
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        triggerHaptic(15);
                        if (!isAlreadyIn && onAddSongToPlaylist) {
                          onAddSongToPlaylist(addSongsModalPlaylist.id, song);
                        }
                      }}
                    >
                      <CachedImage
                        src={song.cover || song.image || song.imageUrl}
                        alt=""
                        className="creator-song-thumb"
                      />
                      <div className="creator-song-info">
                        <div className="creator-song-title">{song.title || song.name}</div>
                        <div className="creator-song-artist">{song.artist || 'Unknown Artist'}</div>
                      </div>

                      {isAlreadyIn ? (
                        <span className="already-added-pill">
                          <i className="fa-solid fa-check"></i> Added
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="add-to-playlist-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            triggerHaptic(20);
                            if (onAddSongToPlaylist) {
                              onAddSongToPlaylist(addSongsModalPlaylist.id, song);
                            }
                          }}
                        >
                          <i className="fa-solid fa-plus"></i> Add
                        </button>
                      )}
                    </div>
                  );
                })
              ) : (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', margin: '20px 0' }}>
                  No songs match "{addSongsSearch}"
                </p>
              )}
            </div>
          </div>

          <div className="sonara-modal-footer">
            <button
              type="button"
              className="sonara-modal-primary-btn"
              style={{ flex: 1 }}
              onClick={() => setAddSongsModalPlaylist(null)}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderRenameModal = () => {
    if (!renameModalPlaylist) return null;

    return (
      <div className="sonara-modal-backdrop" style={{ alignItems: 'center' }} onClick={() => setRenameModalPlaylist(null)}>
        <div className="rename-modal-container" onClick={(e) => e.stopPropagation()}>
          <div style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 14px 0', fontSize: '1.15rem', fontWeight: '800', color: 'var(--text-main)' }}>
              Rename Playlist
            </h3>
            <input
              type="text"
              value={renameModalName}
              onChange={(e) => setRenameModalName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveRename(); }}
              autoFocus
              className="creator-text-input"
              style={{ height: '44px', marginBottom: '18px' }}
              placeholder="Playlist name..."
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="sonara-modal-cancel-btn"
                style={{ height: '42px' }}
                onClick={() => setRenameModalPlaylist(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="sonara-modal-primary-btn"
                style={{ height: '42px' }}
                disabled={!renameModalName.trim()}
                onClick={handleSaveRename}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderModals = () => (
    <>
      {renderCreatePlaylistModal()}
      {renderActionSheet()}
      {renderAddSongsModal()}
      {renderRenameModal()}
    </>
  );

  // ─────────────────────────────────────────────────────────────
  // SUBVIEW: EXPANDED PLAYLIST TRACK LIST (ONLINE)
  // ─────────────────────────────────────────────────────────────
  if (selectedPlaylist && !isOffline) {
    // Fall back to the live Firestore-derived mapping before the sync
    // effect has run for the first time (avoids a flash of "no songs").
    const liveMapping = getPlaylistSongsWithMapping(selectedPlaylist.id);
    const currentPlaylistSongs = displaySongs.length > 0 ? displaySongs : liveMapping;
    const playlistImg = currentPlaylistSongs.length > 0
      ? (currentPlaylistSongs[0].cover || currentPlaylistSongs[0].image || currentPlaylistSongs[0].imageUrl)
      : 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=400&auto=format&fit=crop';
    const isDownloadingThisPlaylist = playlistDownloadStatus[selectedPlaylist.id] === 'loading';
    const isPlaylistCurrentlyActiveAndPlaying = isPlaying && currentPlaylistSongs.some(track => currentTrack && track.id === currentTrack.id);

    const handleCloseDetail = () => {
      setSelectedPlaylist(null);
      setEditingPlaylistId(null);
      setActiveTrackMenuId(null);
      setShowPlaylistHeaderMenu(false);
    };

    const handleDownloadPlaylistTrack = async (e, song) => {
      e.stopPropagation();
      try {
        setTrackDownloadedMap(prev => ({ ...prev, [song.id]: 'loading' }));
        await downloadTrackToDevice(song);
        setTrackDownloadedMap(prev => ({ ...prev, [song.id]: true }));
      } catch {
        setTrackDownloadedMap(prev => ({ ...prev, [song.id]: false }));
      }
      setActiveTrackMenuId(null);
    };

    const handlePlaylistPlayClick = () => {
      if (currentPlaylistSongs.length === 0) return;
      const isSongFromPlaylistPlaying = currentPlaylistSongs.some(track => currentTrack && track.id === currentTrack.id);
      if (isSongFromPlaylistPlaying) {
        onTogglePlay?.();
      } else {
        onSelectTrack(currentPlaylistSongs[0], currentPlaylistSongs);
      }
    };

    // 🚀 Playlist Share Sheet Engine Hook (mirrors AlbumDetailsView's handleShareAlbum)
    const handleSharePlaylist = async () => {
      const shareData = {
        title: selectedPlaylist.playlistName,
        text: `Check out my playlist "${selectedPlaylist.playlistName}" on Sonara!`,
        url: window.location.href
      };
      try {
        if (navigator.share) {
          await navigator.share(shareData);
        } else {
          await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
          alert("Playlist share details copied to clipboard!");
        }
      } catch (err) {
        console.log("Playlist share sheet dismissed:", err);
      }
    };

    // Total playlist playtime calculation
    const totalPlaylistDurationSec = currentPlaylistSongs.reduce((sum, s) => sum + (s.duration || 0), 0);
    const formattedPlaylistDuration = totalPlaylistDurationSec > 0 ? (
      totalPlaylistDurationSec >= 3600
        ? `${Math.floor(totalPlaylistDurationSec / 3600)} hr ${Math.floor((totalPlaylistDurationSec % 3600) / 60)} min`
        : `${Math.floor(totalPlaylistDurationSec / 60)} min`
    ) : null;

    const displayedPlaylistSongs = currentPlaylistSongs.filter((song) => {
      if (!playlistSearch.trim()) return true;
      const q = playlistSearch.toLowerCase();
      return (song.title || song.name || '').toLowerCase().includes(q) || (song.artist || '').toLowerCase().includes(q);
    });

    return (
      <div className="mobile-content" style={{ width: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', padding: 0, paddingBottom: '160px', position: 'relative' }}>
        {/* 🌟 Dynamic Ambient Backdrop Glow */}
        <div className="ambient-backdrop-glow" style={{ '--ambient-glow-color': 'rgba(29, 185, 84, 0.32)' }}></div>

        <div style={{ padding: '0 20px', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0 10px 0' }}>
            <button onClick={handleCloseDetail} style={{ background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer', fontSize: '1.4rem', padding: 0 }}>
              <i className="fa-solid fa-arrow-left"></i>
            </button>
            <button
              onClick={() => setShowPlaylistSearch(!showPlaylistSearch)}
              style={{ background: 'none', border: 'none', color: showPlaylistSearch ? 'var(--accent)' : 'var(--text-muted, rgba(255, 255, 255, 0.75))', cursor: 'pointer', fontSize: '1.15rem', padding: 0 }}
              title="Search songs in playlist"
            >
              <i className="fa-solid fa-magnifying-glass"></i>
            </button>
          </div>

          <div style={{ width: '100%', display: 'flex', justifyContent: 'center', margin: '8px 0 24px 0' }}>
            <CachedImage src={playlistImg} alt={selectedPlaylist.playlistName} style={{ width: '220px', height: '220px', borderRadius: '14px', objectFit: 'cover', boxShadow: '0 20px 40px rgba(0,0,0,0.65)' }} />
          </div>

          <div style={{ marginBottom: '22px' }}>
            {editingPlaylistId === selectedPlaylist.id ? (
              <input
                autoFocus
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={() => handleInlineRenameSave(selectedPlaylist.id)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleInlineRenameSave(selectedPlaylist.id); }}
                style={{ width: '100%', boxSizing: 'border-box', margin: '0 0 10px 0', fontSize: '1.75rem', fontWeight: '700', color: 'var(--text-main)', letterSpacing: '-0.6px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--accent)', borderRadius: '8px', padding: '4px 8px', outline: 'none' }}
              />
            ) : (
              <h2 style={{ margin: '0 0 10px 0', fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-main)', letterSpacing: '-0.6px' }}>{selectedPlaylist.playlistName}</h2>
            )}
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>
              Playlist • {currentPlaylistSongs.length} tracks{formattedPlaylistDuration ? ` • ${formattedPlaylistDuration}` : ''}
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', position: 'relative' }}>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', color: 'var(--text-main)', fontSize: '1.25rem' }}>
              <button onClick={() => handleDownloadPlaylist(selectedPlaylist)} style={{ background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer', padding: 0, fontSize: 'inherit' }} title="Download entire playlist">
                <i className={isDownloadingThisPlaylist ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-download"}></i>
              </button>

              <button onClick={handleSharePlaylist} style={{ background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer', padding: 0, fontSize: 'inherit' }} title="Share playlist">
                <i className="fa-solid fa-arrow-up-from-bracket"></i>
              </button>

              <button
                onClick={() => {
                  triggerHaptic(20);
                  setAddSongsModalPlaylist(selectedPlaylist);
                  setAddSongsSearch('');
                }}
                style={{
                  background: 'var(--card-bg, rgba(255, 255, 255, 0.08))',
                  border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.12))',
                  borderRadius: '20px',
                  padding: '6px 14px',
                  color: 'var(--text-main)',
                  fontSize: '0.82rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
                title="Add songs to this playlist"
              >
                <i className="fa-solid fa-plus" style={{ color: 'var(--accent)' }}></i>
                <span>Add Songs</span>
              </button>

              <button
                onClick={() => {
                  triggerHaptic(15);
                  setActionSheetPlaylist(selectedPlaylist);
                }}
                style={{ background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer', padding: 0, fontSize: 'inherit' }}
                title="Playlist options"
              >
                <i className="fa-solid fa-ellipsis-vertical"></i>
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <button
                onClick={() => {
                  if (currentPlaylistSongs.length === 0) return;
                  const randIdx = Math.floor(Math.random() * currentPlaylistSongs.length);
                  onSelectTrack(currentPlaylistSongs[randIdx], currentPlaylistSongs);
                }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, fontSize: '1.25rem' }}
                title="Shuffle playlist"
              >
                <i className="fa-solid fa-shuffle"></i>
              </button>

              <button
                onClick={handlePlaylistPlayClick}
                className="pulse-play-btn"
                style={{ width: '54px', height: '54px', borderRadius: '50%', backgroundColor: 'var(--accent)', border: 'none', color: '#000000', fontSize: '1.45rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                title={isPlaylistCurrentlyActiveAndPlaying ? "Pause" : "Play playlist"}
              >
                <i className={isPlaylistCurrentlyActiveAndPlaying ? "fa-solid fa-pause" : "fa-solid fa-play"} style={{ marginLeft: isPlaylistCurrentlyActiveAndPlaying ? '0' : '4px' }}></i>
              </button>
            </div>
          </div>

          {/* 🌟 Inline Search Bar */}
          {showPlaylistSearch && (
            <div className="detail-inline-search-box">
              <input
                autoFocus
                type="text"
                placeholder="Filter songs in playlist..."
                value={playlistSearch}
                onChange={(e) => setPlaylistSearch(e.target.value)}
                className="detail-inline-search"
              />
              <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                <i className="fa-solid fa-magnifying-glass"></i>
              </span>
              {playlistSearch && (
                <button
                  type="button"
                  onClick={() => setPlaylistSearch('')}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              )}
            </div>
          )}
        </div>

        <div className="songs-vertical-grid" style={{ padding: '0 10px', position: 'relative', zIndex: 1 }}>
          {(() => {
            const rowHeight = dragMetricsRef.current.rowHeight || 64;
            const liveTargetIndex = draggedIndex !== null
              ? Math.min(Math.max(draggedIndex + Math.round(dragOffsetY / rowHeight), 0), displayedPlaylistSongs.length - 1)
              : null;

            return displayedPlaylistSongs.length > 0 ? displayedPlaylistSongs.map((song, index) => {
              const songImgSrc = song.cover || song.image || song.imageUrl;
              const songTitle = song.title || song.name;
              const isCurrent = currentTrack && song.id === currentTrack.id;
              const dlState = trackDownloadedMap[song.id];
              const isBeingDragged = draggedIndex === index;

              let rowTransform = 'translateY(0px)';
              let rowTransition = 'transform 0.18s ease, background 0.15s ease';

              if (isBeingDragged) {
                rowTransform = `translateY(${dragOffsetY}px) scale(1.02)`;
                rowTransition = 'none';
              } else if (draggedIndex !== null && liveTargetIndex !== null) {
                if (draggedIndex < liveTargetIndex && index > draggedIndex && index <= liveTargetIndex) {
                  rowTransform = `translateY(-${rowHeight}px)`;
                } else if (draggedIndex > liveTargetIndex && index < draggedIndex && index >= liveTargetIndex) {
                  rowTransform = `translateY(${rowHeight}px)`;
                }
              }

              return (
                <div
                  key={song.mappingId || song.id}
                  ref={(el) => { rowRefs.current[song.mappingId] = el; }}
                  className="song-list-item"
                  onClick={() => { if (!isDraggingRef.current) onSelectTrack(song, currentPlaylistSongs); }}
                  style={{
                    cursor: 'pointer', background: isBeingDragged ? 'rgba(255,255,255,0.08)' : isCurrent ? 'rgba(29, 185, 84, 0.08)' : 'transparent',
                    position: 'relative', overflow: 'visible',
                    boxShadow: isBeingDragged ? '0 12px 28px rgba(0,0,0,0.5)' : 'none',
                    zIndex: isBeingDragged ? 20 : 'auto',
                    borderRadius: '12px',
                    transform: rowTransform,
                    transition: rowTransition,
                    willChange: draggedIndex !== null ? 'transform' : 'auto',
                  }}
                >
                  {/* Reorder grip (shown when not filtering) or Numbered Index */}
                  {!playlistSearch.trim() ? (
                    <button
                      className="track-drag-handle"
                      onPointerDown={(e) => handleGripPointerDown(e, index)}
                      onPointerMove={handleGripPointerMove}
                      onPointerUp={handleGripPointerUp}
                      onPointerCancel={handleGripPointerUp}
                      onClick={(e) => e.stopPropagation()}
                      title="Drag to reorder"
                      style={{
                        background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)',
                        padding: '10px 4px 10px 0', cursor: isBeingDragged ? 'grabbing' : 'grab', touchAction: 'none',
                        display: 'flex', alignItems: 'center', fontSize: '0.95rem',
                      }}
                    >
                      <i className="fa-solid fa-grip-vertical"></i>
                    </button>
                  ) : null}

                  <div className="track-index-num">
                    {isCurrent && isPlaying ? (
                      <div className="playing-equalizer-container">
                        <span className="playing-equalizer-bar"></span>
                        <span className="playing-equalizer-bar"></span>
                        <span className="playing-equalizer-bar"></span>
                        <span className="playing-equalizer-bar"></span>
                      </div>
                    ) : (
                      <span>{String(index + 1).padStart(2, '0')}</span>
                    )}
                  </div>

                  <div className="list-img-wrapper"><CachedImage src={songImgSrc} alt={songTitle} className="list-track-thumb" /></div>
                  <div className="list-track-details" style={{ marginLeft: '4px' }}>
                    <h3 style={{ color: isCurrent ? 'var(--accent)' : 'var(--text-main, #ffffff)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {songTitle}
                      {dlState === true && <i className="fa-solid fa-circle-down" style={{ color: 'var(--accent)', fontSize: '0.75rem', marginLeft: '4px' }}></i>}
                    </h3>
                    <p>{song.artist}</p>
                  </div>

                  <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                    <button
                      className="track-options-btn"
                      onClick={() => onOpenSongMenu ? onOpenSongMenu(song, selectedPlaylist?.id) : setActiveTrackMenuId(activeTrackMenuId === song.id ? null : song.id)}
                      title="Track options"
                    >
                      <i className="fa-solid fa-ellipsis-vertical"></i>
                    </button>
                  </div>
                </div>
              );
            }) : (
              <div style={{ textAlign: 'center', padding: '48px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                  <i className="fa-solid fa-music" style={{ fontSize: '1.8rem', color: 'rgba(255, 255, 255, 0.3)' }}></i>
                </div>
                <h3 style={{ color: 'var(--text-main)', margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: '700' }}>
                  {playlistSearch ? `No songs match "${playlistSearch}".` : 'Your playlist is empty'}
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.84rem', margin: '0 0 20px 0', maxWidth: '260px' }}>
                  {playlistSearch ? 'Try a different search query.' : 'Add your favorite tracks to start listening.'}
                </p>
                {!playlistSearch && (
                  <button
                    onClick={() => {
                      triggerHaptic(20);
                      setAddSongsModalPlaylist(selectedPlaylist);
                      setAddSongsSearch('');
                    }}
                    className="sonara-modal-primary-btn"
                    style={{ padding: '0 24px', height: '42px', flex: 'none' }}
                  >
                    <i className="fa-solid fa-plus"></i>
                    <span>Add Songs</span>
                  </button>
                )}
              </div>
            );
          })()}
        </div>
        {renderModals()}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // SUBVIEW: EXPANDED PLAYLIST TRACK LIST (OFFLINE — downloaded tracks only)
  // ─────────────────────────────────────────────────────────────
  if (selectedPlaylist && isOffline) {
    const cachedPlaylistSongs = getPlaylistSongsWithMapping(selectedPlaylist.id)
      .filter((song) => isTrackCachedOffline(song.id));
    const playlistImg = cachedPlaylistSongs.length > 0
      ? (cachedPlaylistSongs[0].cover || cachedPlaylistSongs[0].image || cachedPlaylistSongs[0].imageUrl)
      : 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=400&auto=format&fit=crop';
    const isPlaylistCurrentlyActiveAndPlaying = isPlaying && cachedPlaylistSongs.some(track => currentTrack && track.id === currentTrack.id);

    const handlePlaylistPlayClick = () => {
      if (cachedPlaylistSongs.length === 0) return;
      const isSongFromPlaylistPlaying = cachedPlaylistSongs.some(track => currentTrack && track.id === currentTrack.id);
      if (isSongFromPlaylistPlaying) {
        onTogglePlay?.();
      } else {
        onSelectTrack(cachedPlaylistSongs[0], cachedPlaylistSongs);
      }
    };

    return (
      <div className="mobile-content" style={{ width: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', padding: 0, paddingBottom: '160px', position: 'relative' }}>
        {/* 🌟 Dynamic Ambient Backdrop Glow */}
        <div className="ambient-backdrop-glow" style={{ '--ambient-glow-color': 'rgba(29, 185, 84, 0.32)' }}></div>

        <div style={{ padding: '0 20px', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '14px 0 10px 0' }}>
            <button onClick={() => setSelectedPlaylist(null)} style={{ background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer', fontSize: '1.4rem', padding: 0 }}>
              <i className="fa-solid fa-arrow-left"></i>
            </button>
          </div>

          <div style={{ width: '100%', display: 'flex', justifyContent: 'center', margin: '8px 0 24px 0' }}>
            <CachedImage src={playlistImg} alt={selectedPlaylist.playlistName} style={{ width: '220px', height: '220px', borderRadius: '14px', objectFit: 'cover', boxShadow: '0 20px 40px rgba(0,0,0,0.65)' }} />
          </div>

          <div style={{ marginBottom: '22px' }}>
            <h2 style={{ margin: '0 0 10px 0', fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-main)', letterSpacing: '-0.6px' }}>{selectedPlaylist.playlistName}</h2>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>Playlist • {cachedPlaylistSongs.length} downloaded track{cachedPlaylistSongs.length !== 1 ? 's' : ''}</p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '24px' }}>
            <button onClick={handlePlaylistPlayClick} disabled={cachedPlaylistSongs.length === 0} className="pulse-play-btn" style={{ width: '54px', height: '54px', borderRadius: '50%', backgroundColor: 'var(--accent)', border: 'none', color: '#000000', fontSize: '1.45rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: cachedPlaylistSongs.length === 0 ? 'not-allowed' : 'pointer', opacity: cachedPlaylistSongs.length === 0 ? 0.4 : 1 }}>
              <i className={isPlaylistCurrentlyActiveAndPlaying ? "fa-solid fa-pause" : "fa-solid fa-play"} style={{ marginLeft: isPlaylistCurrentlyActiveAndPlaying ? '0' : '4px' }}></i>
            </button>
          </div>
        </div>

        <div className="songs-vertical-grid" style={{ padding: '0 10px', position: 'relative', zIndex: 1 }}>
          {cachedPlaylistSongs.length > 0 ? (
            cachedPlaylistSongs.map((song, idx) => {
              const isCurrent = currentTrack && song.id === currentTrack.id;
              return (
                <div key={song.id} className="song-list-item" onClick={() => onSelectTrack(song, cachedPlaylistSongs)} style={{ cursor: 'pointer', background: isCurrent ? 'rgba(29, 185, 84, 0.08)' : 'transparent', borderRadius: '12px' }}>
                  <div className="track-index-num">
                    {isCurrent && isPlaying ? (
                      <div className="playing-equalizer-container">
                        <span className="playing-equalizer-bar"></span>
                        <span className="playing-equalizer-bar"></span>
                        <span className="playing-equalizer-bar"></span>
                        <span className="playing-equalizer-bar"></span>
                      </div>
                    ) : (
                      <span>{String(idx + 1).padStart(2, '0')}</span>
                    )}
                  </div>

                  <div className="list-img-wrapper"><CachedImage src={song.cover || song.image || song.imageUrl} className="list-track-thumb" alt="" /></div>
                  <div className="list-track-details">
                    <h3 style={{ color: isCurrent ? 'var(--accent)' : 'var(--text-main, #ffffff)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {song.title || song.name}
                    </h3>
                    <p>{song.artist} • <span style={{ color: 'var(--accent)' }}>Saved Offline</span></p>
                  </div>
                </div>
              );
            })
          ) : (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '40px', fontSize: '0.9rem' }}>
              No songs from this playlist are downloaded yet.
            </p>
          )}
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // ROOT COMPONENT STRUCTURE SCREEN
  // ─────────────────────────────────────────────────────────────
  const filteredPlaylists = playlists.filter(p => {
    if (!librarySearch.trim()) return true;
    return (p.playlistName || '').toLowerCase().includes(librarySearch.toLowerCase());
  }).sort((a, b) => {
    const isPinnedA = pinnedPlaylistIds.includes(a.id);
    const isPinnedB = pinnedPlaylistIds.includes(b.id);
    if (isPinnedA && !isPinnedB) return -1;
    if (!isPinnedA && isPinnedB) return 1;

    if (librarySort === 'az') return (a.playlistName || '').localeCompare(b.playlistName || '');
    if (librarySort === 'count') {
      const countA = getPlaylistSongsWithMapping(a.id).length;
      const countB = getPlaylistSongsWithMapping(b.id).length;
      return countB - countA;
    }
    return 0;
  });

  const filteredSavedAlbums = savedAlbums.filter(a => {
    if (!librarySearch.trim()) return true;
    const q = librarySearch.toLowerCase();
    return (a.name || '').toLowerCase().includes(q) || (a.artist || '').toLowerCase().includes(q);
  }).sort((a, b) => {
    if (librarySort === 'az') return (a.name || '').localeCompare(b.name || '');
    if (librarySort === 'count') return (b.trackCount || 0) - (a.trackCount || 0);
    return 0;
  });

  const filteredSavedArtists = savedArtists.filter(a => {
    if (!librarySearch.trim()) return true;
    return (a.name || '').toLowerCase().includes(librarySearch.toLowerCase());
  }).sort((a, b) => {
    if (librarySort === 'az') return (a.name || '').localeCompare(b.name || '');
    if (librarySort === 'count') return (b.songCount || 0) - (a.songCount || 0);
    return 0;
  });

  return (
    <div className="mobile-content">
      <div className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 className="view-title">{isOffline ? 'Downloaded Only' : 'Your Library'}</h2>
        {!isOffline && (
          <button
            onClick={() => {
              triggerHaptic(20);
              setShowCreateModal(true);
            }}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '50%',
              width: '38px',
              height: '38px',
              color: 'var(--text-main)',
              fontSize: '1.05rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
              transition: 'transform 0.15s ease'
            }}
            title="Create Playlist"
          >
            <i className="fa-solid fa-plus"></i>
          </button>
        )}
      </div>

      {isOffline ? (
        <div className="library-tabs-container" style={{ display: 'flex', marginBottom: '20px' }}>
          <button style={{ background: 'var(--accent)', color: '#000000', border: 'none', padding: '8px 18px', borderRadius: '20px', fontWeight: '700' }}>
            📥 Downloaded
          </button>
        </div>
      ) : (
        <div className="library-tabs-container" style={{ display: 'flex', gap: '10px', marginBottom: '18px' }}>
          <button onClick={() => setActiveTab('playlists')} style={{ background: activeTab === 'playlists' ? 'var(--accent)' : 'var(--card-bg, rgba(255, 255, 255, 0.06))', color: activeTab === 'playlists' ? '#ffffff' : 'var(--text-main)', border: 'none', padding: '8px 18px', borderRadius: '20px', fontWeight: '600' }}>Playlists ({playlists.length})</button>
          <button onClick={() => setActiveTab('albums')} style={{ background: activeTab === 'albums' ? 'var(--accent)' : 'var(--card-bg, rgba(255, 255, 255, 0.06))', color: activeTab === 'albums' ? '#ffffff' : 'var(--text-main)', border: 'none', padding: '8px 18px', borderRadius: '20px', fontWeight: '600' }}>Albums ({savedAlbums.length})</button>
          <button onClick={() => setActiveTab('artists')} style={{ background: activeTab === 'artists' ? 'var(--accent)' : 'var(--card-bg, rgba(255, 255, 255, 0.06))', color: activeTab === 'artists' ? '#ffffff' : 'var(--text-main)', border: 'none', padding: '8px 18px', borderRadius: '20px', fontWeight: '600' }}>Artists ({savedArtists.length})</button>
        </div>
      )}

      {/* 🌟 Library Search & Sort Bar */}
      {!isOffline && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              type="text"
              placeholder={`Search ${activeTab}...`}
              value={librarySearch}
              onChange={(e) => setLibrarySearch(e.target.value)}
              style={{
                width: '100%', height: '38px', backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px',
                padding: '0 32px 0 34px', color: 'var(--text-main)', fontSize: '0.84rem', outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.8rem' }}></i>
            {librarySearch && (
              <i className="fa-solid fa-xmark" onClick={() => setLibrarySearch('')} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}></i>
            )}
          </div>
          <button
            onClick={() => {
              setLibrarySort(prev => prev === 'recent' ? 'az' : prev === 'az' ? 'count' : 'recent');
            }}
            style={{
              height: '38px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '12px', padding: '0 12px', color: 'var(--text-main)', fontSize: '0.78rem', fontWeight: '600',
              display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', flexShrink: 0
            }}
            title="Cycle sort order"
          >
            <i className="fa-solid fa-arrow-down-short-wide" style={{ color: 'var(--accent)' }}></i>
            <span>{librarySort === 'az' ? 'A-Z' : librarySort === 'count' ? 'Tracks' : 'Recent'}</span>
          </button>
        </div>
      )}

      <div className="library-display-panel">
        {isOffline ? (
          <>
            {/* 💾 Offline Storage Vault Banner */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '14px 16px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, rgba(29, 185, 84, 0.12) 0%, rgba(15, 23, 42, 0.6) 100%)',
                border: '1px solid rgba(29, 185, 84, 0.3)',
                marginBottom: '20px'
              }}
            >
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(29, 185, 84, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontSize: '1.2rem', flexShrink: 0 }}>
                <i className="fa-solid fa-hard-drive"></i>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.9rem', fontWeight: '800', color: 'var(--text-main)' }}>
                  Offline Vault: {offlineDownloadedSongs.length} Tracks
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  ~{(offlineDownloadedSongs.length * 3.8).toFixed(1)} MB stored • 100% playable offline
                </div>
              </div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '6px', background: 'rgba(29, 185, 84, 0.2)', color: 'var(--accent)', fontSize: '0.64rem', fontWeight: '800' }}>
                <i className="fa-solid fa-bolt"></i> READY
              </div>
            </div>

            {/* 📥 Downloaded playlists */}
            {offlineAvailablePlaylists.length > 0 && (
              <div style={{ marginBottom: '28px' }}>
                <h3 style={{ fontSize: '0.95rem', color: 'var(--text-main)', margin: '0 0 12px 0', fontWeight: '700' }}>Downloaded Playlists</h3>
                <div className="playlists-vertical-grid" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {offlineAvailablePlaylists.map((playlist) => {
                    const cachedTracks = getPlaylistSongsWithMapping(playlist.id).filter((s) => isTrackCachedOffline(s.id));
                    const playlistImg = cachedTracks.length > 0
                      ? (cachedTracks[0].cover || cachedTracks[0].image || cachedTracks[0].imageUrl)
                      : 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=200&auto=format&fit=crop';
                    return (
                      <div key={playlist.id} className="song-list-item" onClick={() => setSelectedPlaylist(playlist)} style={{ cursor: 'pointer', borderRadius: '12px' }}>
                        <div className="list-img-wrapper"><CachedImage src={playlistImg} alt="" className="list-track-thumb" /></div>
                        <div className="list-track-details">
                          <h3>{playlist.playlistName}</h3>
                          <p>{cachedTracks.length} downloaded song{cachedTracks.length !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 📥 Downloaded songs */}
            <h3 style={{ fontSize: '0.95rem', color: 'var(--text-main)', margin: '0 0 12px 0', fontWeight: '700' }}>Downloaded Songs</h3>
            <div className="songs-vertical-grid">
              {offlineDownloadedSongs.length > 0 ? (
                offlineDownloadedSongs.map((song) => {
                  const isCurrent = currentTrack && song.id === currentTrack.id;
                  return (
                    <div key={song.id} className="song-list-item" onClick={() => onSelectTrack(song, offlineDownloadedSongs)} style={{ cursor: 'pointer', borderRadius: '12px' }}>
                      <div className="list-img-wrapper">
                        <CachedImage src={song.cover || song.image || song.imageUrl} className="list-track-thumb" alt="" />
                      </div>
                      <div className="list-track-details">
                        <h3 style={{ color: isCurrent ? 'var(--accent)' : 'var(--text-main, #ffffff)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {isCurrent && (
                            <div className={`playing-equalizer-container ${!isPlaying ? 'animation-paused' : ''}`}>
                              <span className="playing-equalizer-bar"></span>
                              <span className="playing-equalizer-bar"></span>
                              <span className="playing-equalizer-bar"></span>
                              <span className="playing-equalizer-bar"></span>
                            </div>
                          )}
                          {song.title || song.name}
                        </h3>
                        <p>{song.artist} • <span style={{ color: 'var(--accent)' }}>Saved Offline</span></p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '40px', fontSize: '0.9rem' }}>No music tracks downloaded on this device yet.</p>
              )}
            </div>
          </>
        ) : activeTab === 'playlists' ? (
          <div className="playlists-vertical-grid" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* 💖 Liked Songs Fast Hub */}
            {likedSongIds && likedSongIds.length > 0 && !librarySearch.trim() && (
              <div
                onClick={() => {
                  triggerHaptic(20);
                  const likedList = (songs || []).filter(s => likedSongIds.includes(s.id));
                  if (likedList.length > 0) {
                    onSelectTrack(likedList[0], likedList);
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '12px 14px',
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg, rgba(88, 28, 135, 0.45) 0%, rgba(15, 23, 42, 0.6) 100%)',
                  border: '1px solid rgba(168, 85, 247, 0.3)',
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: '0 6px 18px rgba(0, 0, 0, 0.3)',
                  marginBottom: '4px'
                }}
              >
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #4f46e5 0%, #ec4899 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 4px 12px rgba(236, 72, 153, 0.35)'
                  }}
                >
                  <i className="fa-solid fa-heart" style={{ color: '#ffffff', fontSize: '1.4rem' }}></i>
                </div>
                <div style={{ flex: 1, marginLeft: '14px' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: '800', margin: 0, color: 'var(--text-main)' }}>Liked Songs</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
                    Auto-playlist • {likedSongIds.length} track{likedSongIds.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    triggerHaptic(20);
                    const likedList = (songs || []).filter(s => likedSongIds.includes(s.id));
                    if (likedList.length > 0) {
                      onSelectTrack(likedList[0], likedList);
                    }
                  }}
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: 'var(--accent)',
                    border: 'none',
                    color: '#000',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.95rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(29, 185, 84, 0.4)',
                    flexShrink: 0
                  }}
                >
                  <i className="fa-solid fa-play" style={{ marginLeft: '2px' }}></i>
                </button>
              </div>
            )}

            {filteredPlaylists.map((playlist) => {
              const assignedSongs = getPlaylistSongsWithMapping(playlist.id);
              const playlistImg = assignedSongs.length > 0 
                ? (assignedSongs[0].cover || assignedSongs[0].image || assignedSongs[0].imageUrl)
                : 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=200&auto=format&fit=crop';
              
              const isDownloadingPlaylist = playlistDownloadStatus[playlist.id] === 'loading';
              const isPinned = pinnedPlaylistIds.includes(playlist.id);

              return (
                <div key={playlist.id} className="song-list-item" onClick={() => setSelectedPlaylist(playlist)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', position: 'relative', overflow: 'visible', borderRadius: '14px', background: isPinned ? 'rgba(234, 179, 8, 0.08)' : 'var(--card-bg, rgba(255,255,255,0.02))', border: isPinned ? '1px solid rgba(234, 179, 8, 0.25)' : '1px solid var(--border-subtle, rgba(255,255,255,0.05))' }}>
                  <div className="list-img-wrapper" style={{ width: '60px', height: '60px' }}>
                    <CachedImage src={playlistImg} alt="" className="list-track-thumb" style={{ borderRadius: '10px', boxShadow: '0 4px 14px rgba(0,0,0,0.4)' }} />
                  </div>
                  <div className="list-track-details" style={{ marginLeft: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <h3 style={{ fontSize: '0.98rem', fontWeight: '700', margin: 0 }}>{playlist.playlistName}</h3>
                      {isPinned && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '1px 6px', borderRadius: '4px', background: 'rgba(234, 179, 8, 0.2)', color: '#facc15', fontSize: '0.62rem', fontWeight: '800' }}>
                          <i className="fa-solid fa-thumbtack"></i> PINNED
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Playlist • {assignedSongs.length} tracks • By you
                    </p>
                  </div>

                  <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                    <button
                      className="track-options-btn"
                      onClick={() => {
                        triggerHaptic(15);
                        setActionSheetPlaylist(playlist);
                      }}
                      style={{ padding: '10px' }}
                      title="Playlist options"
                    >
                      <i className="fa-solid fa-ellipsis-vertical"></i>
                    </button>
                  </div>
                </div>
              );
            })}
            {filteredPlaylists.length === 0 && (
              <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0', fontSize: '0.9rem' }}>
                {librarySearch ? `No playlists match "${librarySearch}".` : 'No playlists yet. Tap + to create one!'}
              </p>
            )}
          </div>
        ) : activeTab === 'albums' ? (
          <div className="albums-vertical-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filteredSavedAlbums.length > 0 ? (
              filteredSavedAlbums.map((album) => (
                <div
                  key={album.id}
                  className="song-list-item"
                  onClick={() => onSelectAlbum && onSelectAlbum(album)}
                  style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', borderRadius: '14px', background: 'var(--card-bg, rgba(255,255,255,0.02))', border: '1px solid var(--border-subtle, rgba(255,255,255,0.05))' }}
                >
                  <div className="list-img-wrapper" style={{ width: '60px', height: '60px' }}>
                    <CachedImage src={album.image} alt={album.name} className="list-track-thumb" style={{ borderRadius: '10px' }} />
                  </div>
                  <div className="list-track-details" style={{ marginLeft: '6px' }}>
                    <h3 style={{ color: 'var(--text-main)', fontSize: '0.96rem', fontWeight: '700' }}>{album.name}</h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Album • {album.artist} • {album.trackCount} {album.trackCount === 1 ? 'track' : 'tracks'}
                    </p>
                  </div>
                  <i className="fa-solid fa-chevron-right" style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginRight: '8px' }}></i>
                </div>
              ))
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '60px 24px 20px 24px' }}>
                <i className="fa-solid fa-compact-disc" style={{ fontSize: '2.2rem', color: 'var(--text-muted)', marginBottom: '16px' }}></i>
                <h3 style={{ color: 'var(--text-main)', margin: '0 0 8px 0', fontSize: '1rem' }}>No Saved Albums</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0, maxWidth: '260px' }}>
                  {librarySearch ? `No albums match "${librarySearch}".` : 'Open an album and tap the ✓ button to save it here.'}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="artists-vertical-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filteredSavedArtists.length > 0 ? (
              filteredSavedArtists.map((artist) => (
                <div
                  key={artist.id}
                  className="song-list-item"
                  onClick={() => onSelectArtist && onSelectArtist(artist)}
                  style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', borderRadius: '14px', background: 'var(--card-bg, rgba(255,255,255,0.02))', border: '1px solid var(--border-subtle, rgba(255,255,255,0.05))' }}
                >
                  <div className="list-img-wrapper" style={{ width: '60px', height: '60px' }}>
                    {artist.image ? (
                      <CachedImage src={artist.image} alt={artist.name} className="list-track-thumb" style={{ borderRadius: '50%' }} />
                    ) : (
                      <div
                        className="list-track-thumb"
                        style={{
                          borderRadius: '50%', backgroundColor: 'var(--accent)', color: '#000',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: '700', fontSize: '1.2rem'
                        }}
                      >
                        {(artist.name || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="list-track-details" style={{ marginLeft: '6px' }}>
                    <h3 style={{ color: 'var(--text-main)', fontSize: '0.96rem', fontWeight: '700' }}>{artist.name}</h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Artist • {artist.songCount} {artist.songCount === 1 ? 'song' : 'songs'}
                    </p>
                  </div>
                  <i className="fa-solid fa-chevron-right" style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginRight: '8px' }}></i>
                </div>
              ))
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '60px 24px 20px 24px' }}>
                <i className="fa-solid fa-user-large" style={{ fontSize: '2.2rem', color: 'var(--text-muted)', marginBottom: '16px' }}></i>
                <h3 style={{ color: 'var(--text-main)', margin: '0 0 8px 0', fontSize: '1rem' }}>No Saved Artists</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0, maxWidth: '260px' }}>
                  {librarySearch ? `No artists match "${librarySearch}".` : "Open an artist's profile and tap the ✓ button to save them here."}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {renderModals()}
    </div>
  );
}