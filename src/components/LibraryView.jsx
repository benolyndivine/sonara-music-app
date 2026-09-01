import React, { useState, useEffect, useRef } from 'react';
import { doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { downloadTrackToDevice, isTrackCachedOffline, getDownloadedSongsList } from '../utils/offlineStorage';
import { songMatchesArtist } from '../utils/artistMatch';
import { getSavedArtists } from '../utils/savedArtists';
import { getSavedAlbums } from '../utils/savedAlbums';

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
  onSelectArtist,
  onSelectAlbum,
  activeTab,
  onActiveTabChange,
  selectedPlaylist,
  onSelectPlaylist,
  isOffline
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
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [editingPlaylistId, setEditingPlaylistId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [activeMenuId, setActiveMenuId] = useState(null); 
  const [activeTrackMenuId, setActiveTrackMenuId] = useState(null);

  // 🆕 Detail-view (album-style) state: per-track download status + header "•••" menu
  const [trackDownloadedMap, setTrackDownloadedMap] = useState({});
  const [showPlaylistHeaderMenu, setShowPlaylistHeaderMenu] = useState(false);

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

    return (
      <div className="mobile-content" style={{ width: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', padding: 0, paddingBottom: '160px' }}>
        <div style={{ padding: '0 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '14px 0 10px 0' }}>
            <button onClick={handleCloseDetail} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', fontSize: '1.4rem', padding: 0 }}><i className="fa-solid fa-arrow-left"></i></button>
          </div>

          <div style={{ width: '100%', display: 'flex', justifyContent: 'center', margin: '10px 0 28px 0' }}>
            <img src={playlistImg} alt={selectedPlaylist.playlistName} style={{ width: '220px', height: '220px', borderRadius: '12px', objectFit: 'cover', boxShadow: '0 16px 36px rgba(0,0,0,0.6)' }} />
          </div>

          <div style={{ marginBottom: '22px' }}>
            {editingPlaylistId === selectedPlaylist.id ? (
              <input
                autoFocus
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={() => handleInlineRenameSave(selectedPlaylist.id)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleInlineRenameSave(selectedPlaylist.id); }}
                style={{ width: '100%', boxSizing: 'border-box', margin: '0 0 10px 0', fontSize: '1.75rem', fontWeight: '700', color: '#ffffff', letterSpacing: '-0.6px', background: 'rgba(255,255,255,0.06)', border: '1px solid var(--accent)', borderRadius: '8px', padding: '4px 8px', outline: 'none' }}
              />
            ) : (
              <h2 style={{ margin: '0 0 10px 0', fontSize: '1.75rem', fontWeight: '700', color: '#ffffff', letterSpacing: '-0.6px' }}>{selectedPlaylist.playlistName}</h2>
            )}
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>Playlist • {currentPlaylistSongs.length} tracks</p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', position: 'relative' }}>
            <div style={{ display: 'flex', gap: '24px', alignItems: 'center', color: '#ffffff', fontSize: '1.4rem' }}>
              <button onClick={() => handleDownloadPlaylist(selectedPlaylist)} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', padding: 0, fontSize: 'inherit' }}>
                <i className={isDownloadingThisPlaylist ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-download"}></i>
              </button>

              <button onClick={handleSharePlaylist} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', padding: 0, fontSize: 'inherit' }}>
                <i className="fa-solid fa-arrow-up-from-bracket"></i>
              </button>

              <div style={{ position: 'relative', display: 'inline-block' }}>
                <button onClick={() => setShowPlaylistHeaderMenu(!showPlaylistHeaderMenu)} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', padding: 0, fontSize: 'inherit' }}><i className="fa-solid fa-ellipsis-vertical"></i></button>
                {showPlaylistHeaderMenu && (
                  <div className="premium-dropdown-menu" style={{ left: '0', top: '30px', position: 'absolute', zIndex: 600 }}>
                    <button onClick={() => { setEditingName(selectedPlaylist.playlistName); setEditingPlaylistId(selectedPlaylist.id); setShowPlaylistHeaderMenu(false); }} className="dropdown-playlist-option" style={{ padding: '12px 14px', background: 'transparent', border: 'none', width: '100%', textAlign: 'left', color: '#ffffff', cursor: 'pointer', fontSize: '0.9rem' }}>Rename Playlist</button>
                    <button onClick={() => { if (window.confirm(`Delete playlist "${selectedPlaylist.playlistName}" completely?`)) { onDeletePlaylist(selectedPlaylist.id); handleCloseDetail(); } else { setShowPlaylistHeaderMenu(false); } }} className="dropdown-playlist-option" style={{ padding: '12px 14px', background: 'transparent', border: 'none', width: '100%', textAlign: 'left', color: '#ff4d4d', cursor: 'pointer', fontSize: '0.9rem' }}>Delete Playlist</button>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '22px' }}>
              <button onClick={handlePlaylistPlayClick} style={{ width: '54px', height: '54px', borderRadius: '50%', backgroundColor: 'var(--accent)', border: 'none', color: '#000000', fontSize: '1.45rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 6px 16px rgba(29, 185, 84, 0.35)' }}><i className={isPlaylistCurrentlyActiveAndPlaying ? "fa-solid fa-pause" : "fa-solid fa-play"} style={{ marginLeft: isPlaylistCurrentlyActiveAndPlaying ? '0' : '4px' }}></i></button>
            </div>
          </div>
        </div>

        <div className="songs-vertical-grid" style={{ padding: '0 10px' }}>
          {(() => {
            // Computed once per render (not per-row): where would the
            // dragged item land if dropped right now, given the live
            // pointer offset. Used below to open a gap in the list that
            // tracks the finger, iOS-reorder style.
            const rowHeight = dragMetricsRef.current.rowHeight || 64;
            const liveTargetIndex = draggedIndex !== null
              ? Math.min(Math.max(draggedIndex + Math.round(dragOffsetY / rowHeight), 0), currentPlaylistSongs.length - 1)
              : null;

            return currentPlaylistSongs.length > 0 ? currentPlaylistSongs.map((song, index) => {
            const songImgSrc = song.cover || song.image || song.imageUrl;
            const songTitle = song.title || song.name;
            const isCurrent = currentTrack && song.id === currentTrack.id;
            const dlState = trackDownloadedMap[song.id];
            const isBeingDragged = draggedIndex === index;

            // 🛠️ REWORKED DRAG VISUALS:
            // - The picked-up row translates by the raw pointer delta, so it
            //   travels smoothly with the finger instead of jumping row-by-row.
            // - Every OTHER row between its original spot and the live target
            //   slides out of the way by exactly one row height, opening a
            //   gap where the dragged row would land if released right now.
            // Nothing in the underlying array actually moves until drop (see
            // handleGripPointerUp), so this is purely a live visual preview.
            let rowTransform = 'translateY(0px)';
            let rowTransition = 'transform 0.18s ease, background 0.15s ease';

            if (isBeingDragged) {
              rowTransform = `translateY(${dragOffsetY}px) scale(1.02)`;
              rowTransition = 'none'; // 1:1 with the finger, no easing lag
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
                  cursor: 'pointer', background: isBeingDragged ? 'rgba(255,255,255,0.08)' : 'transparent',
                  position: 'relative', overflow: 'visible',
                  boxShadow: isBeingDragged ? '0 12px 28px rgba(0,0,0,0.5)' : 'none',
                  zIndex: isBeingDragged ? 20 : 'auto',
                  borderRadius: isBeingDragged ? '10px' : 0,
                  transform: rowTransform,
                  transition: rowTransition,
                  willChange: draggedIndex !== null ? 'transform' : 'auto',
                }}
              >
                {/* ⠿ Grip handle — press and hold this to pick the row up, drag it, and drop it in a new spot */}
                <button
                  className="track-drag-handle"
                  onPointerDown={(e) => handleGripPointerDown(e, index)}
                  onPointerMove={handleGripPointerMove}
                  onPointerUp={handleGripPointerUp}
                  onPointerCancel={handleGripPointerUp}
                  onClick={(e) => e.stopPropagation()}
                  title="Drag to reorder"
                  style={{
                    background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)',
                    padding: '10px 6px 10px 0', cursor: isBeingDragged ? 'grabbing' : 'grab', touchAction: 'none',
                    display: 'flex', alignItems: 'center', fontSize: '1rem',
                  }}
                >
                  <i className="fa-solid fa-grip-vertical"></i>
                </button>

                <div className="list-img-wrapper"><img src={songImgSrc} alt={songTitle} className="list-track-thumb" /></div>
                <div className="list-track-details" style={{ marginLeft: '4px' }}>
                  <h3 style={{ color: isCurrent ? 'var(--accent)' : '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {isCurrent && <div className={`playing-equalizer-container ${!isPlaying ? 'animation-paused' : ''}`}><span className="playing-equalizer-bar"></span><span className="playing-equalizer-bar"></span><span className="playing-equalizer-bar"></span><span className="playing-equalizer-bar"></span></div>}
                    {songTitle}
                    {dlState === true && <i className="fa-solid fa-circle-down" style={{ color: 'var(--accent)', fontSize: '0.75rem', marginLeft: '4px' }}></i>}
                  </h3>
                  <p>{song.artist}</p>
                </div>

                <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                  <button className="track-options-btn" onClick={() => setActiveTrackMenuId(activeTrackMenuId === song.id ? null : song.id)}><i className="fa-solid fa-ellipsis-vertical"></i></button>
                  {activeTrackMenuId === song.id && (
                    <div className="premium-dropdown-menu" style={{ right: '10px', top: '30px', position: 'absolute', zIndex: 500 }}>
                      <button onClick={(e) => handleDownloadPlaylistTrack(e, song)} className="dropdown-playlist-option" style={{ padding: '12px 14px', gap: '12px', display: 'flex', alignItems: 'center', background: 'transparent', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', color: dlState === true ? 'var(--accent)' : '#ffffff' }}>
                        <i className={dlState === 'loading' ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-arrow-down-to-line"} style={{ color: dlState === true ? 'var(--accent)' : 'rgba(255,255,255,0.6)' }}></i>
                        <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>{dlState === true ? 'Saved Offline' : dlState === 'loading' ? 'Downloading...' : 'Download Track'}</span>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); onRemoveSong(selectedPlaylist.id, song); setActiveTrackMenuId(null); }}
                        className="dropdown-playlist-option"
                        style={{ padding: '12px 14px', gap: '12px', display: 'flex', alignItems: 'center', background: 'transparent', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer', color: '#ff4d4d' }}
                      >
                        <i className="fa-solid fa-trash" style={{ color: '#ff4d4d' }}></i>
                        <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>Remove from Playlist</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          }) : (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '40px', fontSize: '0.9rem' }}>This playlist has no songs yet.</p>
          );
          })()}
        </div>
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
      <div className="mobile-content" style={{ width: '100%', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', padding: 0, paddingBottom: '160px' }}>
        <div style={{ padding: '0 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '14px 0 10px 0' }}>
            <button onClick={() => setSelectedPlaylist(null)} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', fontSize: '1.4rem', padding: 0 }}><i className="fa-solid fa-arrow-left"></i></button>
          </div>

          <div style={{ width: '100%', display: 'flex', justifyContent: 'center', margin: '10px 0 28px 0' }}>
            <img src={playlistImg} alt={selectedPlaylist.playlistName} style={{ width: '220px', height: '220px', borderRadius: '12px', objectFit: 'cover', boxShadow: '0 16px 36px rgba(0,0,0,0.6)' }} />
          </div>

          <div style={{ marginBottom: '22px' }}>
            <h2 style={{ margin: '0 0 10px 0', fontSize: '1.75rem', fontWeight: '700', color: '#ffffff', letterSpacing: '-0.6px' }}>{selectedPlaylist.playlistName}</h2>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>Playlist • {cachedPlaylistSongs.length} downloaded track{cachedPlaylistSongs.length !== 1 ? 's' : ''}</p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '24px' }}>
            <button onClick={handlePlaylistPlayClick} disabled={cachedPlaylistSongs.length === 0} style={{ width: '54px', height: '54px', borderRadius: '50%', backgroundColor: 'var(--accent)', border: 'none', color: '#000000', fontSize: '1.45rem', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: cachedPlaylistSongs.length === 0 ? 'not-allowed' : 'pointer', opacity: cachedPlaylistSongs.length === 0 ? 0.4 : 1, boxShadow: '0 6px 16px rgba(29, 185, 84, 0.35)' }}><i className={isPlaylistCurrentlyActiveAndPlaying ? "fa-solid fa-pause" : "fa-solid fa-play"} style={{ marginLeft: isPlaylistCurrentlyActiveAndPlaying ? '0' : '4px' }}></i></button>
          </div>
        </div>

        <div className="songs-vertical-grid" style={{ padding: '0 10px' }}>
          {cachedPlaylistSongs.length > 0 ? (
            cachedPlaylistSongs.map((song) => {
              const isCurrent = currentTrack && song.id === currentTrack.id;
              return (
                <div key={song.id} className="song-list-item" onClick={() => onSelectTrack(song, cachedPlaylistSongs)} style={{ cursor: 'pointer' }}>
                  <div className="list-img-wrapper"><img src={song.cover || song.image || song.imageUrl} className="list-track-thumb" alt="" /></div>
                  <div className="list-track-details">
                    <h3 style={{ color: isCurrent ? 'var(--accent)' : '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
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
  return (
    <div className="mobile-content">
      <div className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 className="view-title">{isOffline ? 'Downloaded Only' : 'Your Library'}</h2>
        {!isOffline && (
          <button onClick={() => setShowCreateForm(!showCreateForm)} style={{ backgroundColor: 'rgba(255, 255, 255, 0.08)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', color: '#ffffff', fontSize: '1.2rem', cursor: 'pointer' }}>+</button>
        )}
      </div>

      {showCreateForm && (
        <form onSubmit={(e) => {
          e.preventDefault();
          if(!newPlaylistName.trim()) return;
          onCreatePlaylist(newPlaylistName);
          setNewPlaylistName('');
          setShowCreateForm(false);
        }} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <input type="text" placeholder="Playlist name..." value={newPlaylistName} onChange={(e) => setNewPlaylistName(e.target.value)} style={{ flex: 1, height: '38px', backgroundColor: '#1a2232', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '0 12px', color: '#ffffff', outline: 'none' }} />
          <button type="submit" style={{ backgroundColor: 'var(--accent)', color: '#000000', border: 'none', borderRadius: '8px', padding: '0 16px', fontWeight: '600', cursor: 'pointer' }}>Create</button>
        </form>
      )}

      {isOffline ? (
        // 📴 OFFLINE: Playlists & Artists tabs are hidden — only Downloaded is reachable
        <div className="library-tabs-container" style={{ display: 'flex', marginBottom: '24px' }}>
          <button style={{ background: 'var(--accent)', color: '#000000', border: 'none', padding: '8px 18px', borderRadius: '20px', fontWeight: '700' }}>
            📥 Downloaded
          </button>
        </div>
      ) : (
        <div className="library-tabs-container" style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
          <button onClick={() => setActiveTab('playlists')} style={{ background: activeTab === 'playlists' ? 'var(--accent)' : 'rgba(255, 255, 255, 0.06)', color: activeTab === 'playlists' ? '#000000' : '#ffffff', border: 'none', padding: '8px 18px', borderRadius: '20px', fontWeight: '600' }}>Playlists</button>
          <button onClick={() => setActiveTab('albums')} style={{ background: activeTab === 'albums' ? 'var(--accent)' : 'rgba(255, 255, 255, 0.06)', color: activeTab === 'albums' ? '#000000' : '#ffffff', border: 'none', padding: '8px 18px', borderRadius: '20px', fontWeight: '600' }}>Albums</button>
          <button onClick={() => setActiveTab('artists')} style={{ background: activeTab === 'artists' ? 'var(--accent)' : 'rgba(255, 255, 255, 0.06)', color: activeTab === 'artists' ? '#000000' : '#ffffff', border: 'none', padding: '8px 18px', borderRadius: '20px', fontWeight: '600' }}>Artists</button>
        </div>
      )}

      <div className="library-display-panel">
        {isOffline ? (
          <>
            {/* 📥 Downloaded playlists — playable locally with no connection */}
            {offlineAvailablePlaylists.length > 0 && (
              <div style={{ marginBottom: '28px' }}>
                <h3 style={{ fontSize: '0.95rem', color: '#ffffff', margin: '0 0 12px 0', fontWeight: '700' }}>Downloaded Playlists</h3>
                <div className="playlists-vertical-grid" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {offlineAvailablePlaylists.map((playlist) => {
                    const cachedTracks = getPlaylistSongsWithMapping(playlist.id).filter((s) => isTrackCachedOffline(s.id));
                    const playlistImg = cachedTracks.length > 0
                      ? (cachedTracks[0].cover || cachedTracks[0].image || cachedTracks[0].imageUrl)
                      : 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=200&auto=format&fit=crop';
                    return (
                      <div key={playlist.id} className="song-list-item" onClick={() => setSelectedPlaylist(playlist)} style={{ cursor: 'pointer' }}>
                        <div className="list-img-wrapper"><img src={playlistImg} alt="" className="list-track-thumb" /></div>
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
            <h3 style={{ fontSize: '0.95rem', color: '#ffffff', margin: '0 0 12px 0', fontWeight: '700' }}>Downloaded Songs</h3>
            <div className="songs-vertical-grid">
              {offlineDownloadedSongs.length > 0 ? (
                offlineDownloadedSongs.map((song) => {
                  const isCurrent = currentTrack && song.id === currentTrack.id;
                  return (
                    <div key={song.id} className="song-list-item" onClick={() => onSelectTrack(song, offlineDownloadedSongs)} style={{ cursor: 'pointer' }}>
                      <div className="list-img-wrapper">
                        <img src={song.cover || song.image || song.imageUrl} className="list-track-thumb" alt="" />
                      </div>
                      <div className="list-track-details">
                        <h3 style={{ color: isCurrent ? 'var(--accent)' : '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
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
          <div className="playlists-vertical-grid" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {playlists.map((playlist) => {
              const assignedSongs = getPlaylistSongsWithMapping(playlist.id);
              const playlistImg = assignedSongs.length > 0 
                ? (assignedSongs[0].cover || assignedSongs[0].image || assignedSongs[0].imageUrl)
                : 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=200&auto=format&fit=crop';
              
              const isDownloadingPlaylist = playlistDownloadStatus[playlist.id] === 'loading';

              return (
                <div key={playlist.id} className="song-list-item" onClick={() => setSelectedPlaylist(playlist)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', position: 'relative', overflow: 'visible' }}>
                  <div className="list-img-wrapper">
                    <img src={playlistImg} alt="" className="list-track-thumb" />
                  </div>
                  <div className="list-track-details">
                    <h3>{playlist.playlistName}</h3>
                    <p>Playlist • {assignedSongs.length} songs</p>
                  </div>

                  <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                    <button className="track-options-btn" onClick={() => setActiveMenuId(activeMenuId === playlist.id ? null : playlist.id)} style={{ padding: '10px' }}>
                      <i className="fa-solid fa-ellipsis-vertical"></i>
                    </button>

                    {activeMenuId === playlist.id && (
                      <div className="premium-dropdown-menu" style={{ position: 'absolute', bottom: 'auto', top: '35px', right: 0, width: '180px', zIndex: 10 }}>
                        {/* 🆕 ADDED: BATCH DOWNLOAD OPTION ROW AT PLAYLIST ROOT */}
                        <button
                          onClick={() => {
                            setActiveMenuId(null);
                            handleDownloadPlaylist(playlist);
                          }}
                          disabled={isDownloadingPlaylist}
                          style={{ padding: '10px', background: 'none', border: 'none', color: 'var(--accent)', width: '100%', textAlign: 'left', cursor: 'pointer', display: 'flex', gap: '8px', alignItems: 'center' }}
                        >
                          <i className={isDownloadingPlaylist ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-circle-down"} style={{ fontSize: '0.85rem' }}></i> 
                          {isDownloadingPlaylist ? 'Downloading...' : 'Download Playlist'}
                        </button>

                        <button
                          onClick={() => {
                            setEditingName(playlist.playlistName);
                            setEditingPlaylistId(playlist.id);
                            setActiveMenuId(null);
                          }}
                          style={{ padding: '10px', background: 'none', border: 'none', color: '#fff', width: '100%', textAlign: 'left', cursor: 'pointer', display: 'flex', gap: '8px', alignItems: 'center' }}
                        >
                          <i className="fa-solid fa-pen" style={{ fontSize: '0.8rem' }}></i> Rename
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Delete playlist "${playlist.playlistName}" completely?`)) {
                              onDeletePlaylist(playlist.id);
                            }
                              setActiveMenuId(null);
                          }}
                          style={{ padding: '10px', background: 'none', border: 'none', color: '#ff4d4d', width: '100%', textAlign: 'left', cursor: 'pointer', display: 'flex', gap: '8px', alignItems: 'center' }}
                        >
                          <i className="fa-solid fa-trash" style={{ fontSize: '0.8rem' }}></i> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : activeTab === 'albums' ? (
          <div className="albums-vertical-list" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {savedAlbums.length > 0 ? (
              savedAlbums.map((album) => (
                <div
                  key={album.id}
                  className="song-list-item"
                  onClick={() => onSelectAlbum && onSelectAlbum(album)}
                  style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  <div className="list-img-wrapper">
                    <img src={album.image} alt={album.name} className="list-track-thumb" />
                  </div>
                  <div className="list-track-details">
                    <h3 style={{ color: '#ffffff' }}>{album.name}</h3>
                    <p>Album • {album.artist} • {album.trackCount} {album.trackCount === 1 ? 'track' : 'tracks'}</p>
                  </div>
                  <i className="fa-solid fa-chevron-right" style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginRight: '6px' }}></i>
                </div>
              ))
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '60px 24px 20px 24px' }}>
                <i className="fa-solid fa-compact-disc" style={{ fontSize: '2.2rem', color: 'var(--text-muted)', marginBottom: '16px' }}></i>
                <h3 style={{ color: '#ffffff', margin: '0 0 8px 0', fontSize: '1rem' }}>No Saved Albums</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0, maxWidth: '260px' }}>
                  Open an album and tap the ✓ button to save it here.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="artists-vertical-list" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {savedArtists.length > 0 ? (
              savedArtists.map((artist) => (
                <div
                  key={artist.id}
                  className="song-list-item"
                  onClick={() => onSelectArtist && onSelectArtist(artist)}
                  style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  <div className="list-img-wrapper">
                    {artist.image ? (
                      <img src={artist.image} alt={artist.name} className="list-track-thumb" style={{ borderRadius: '50%' }} />
                    ) : (
                      <div
                        className="list-track-thumb"
                        style={{
                          borderRadius: '50%', backgroundColor: 'var(--accent)', color: '#000',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: '700', fontSize: '1.1rem'
                        }}
                      >
                        {(artist.name || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="list-track-details">
                    <h3 style={{ color: '#ffffff' }}>{artist.name}</h3>
                    <p>Artist • {artist.songCount} {artist.songCount === 1 ? 'song' : 'songs'}</p>
                  </div>
                  <i className="fa-solid fa-chevron-right" style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginRight: '6px' }}></i>
                </div>
              ))
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '60px 24px 20px 24px' }}>
                <i className="fa-solid fa-user-large" style={{ fontSize: '2.2rem', color: 'var(--text-muted)', marginBottom: '16px' }}></i>
                <h3 style={{ color: '#ffffff', margin: '0 0 8px 0', fontSize: '1rem' }}>No Saved Artists</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0, maxWidth: '260px' }}>
                  Open an artist's profile and tap the ✓ button to save them here.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}