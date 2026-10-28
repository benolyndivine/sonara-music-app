import React, { useState, useEffect, useRef, useMemo } from 'react';
import { collection, doc, addDoc, deleteDoc, query, where, onSnapshot, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { GoogleAuthProvider, signInWithCredential, signInWithPopup, signOut, onAuthStateChanged, updateProfile } from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app'; 
import { StatusBar, Style } from '@capacitor/status-bar';
import { Filesystem } from '@capacitor/filesystem';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { MediaSession } from '@capgo/capacitor-media-session';
import { BackgroundMode } from '@anuradev/capacitor-background-mode';
import { Media } from '@awesome-cordova-plugins/media';
import { db, auth, provider } from './firebase';
import { getPlaybackSource, isTrackCachedOffline, downloadTrackToDevice, runSmartStorageOptimization } from './utils/offlineStorage';
import AudioRouteInfo from './utils/audioRoute';
import { getStreamingQuality, setStreamingQuality, getDownloadQuality, setDownloadQuality, applyQualityToUrl } from './utils/audioQuality';
import { songMatchesArtist, splitArtistCredits } from './utils/artistMatch';
import Header from './components/Header';
import SongRow from './components/SongRow';
import ArtistRow from './components/ArtistRow';
import MiniPlayer from './components/MiniPlayer';
import BottomNavigation from './components/BottomNavigation';
import AllSongsView from './components/AllSongsView';
import AllAlbumsView from './components/AllAlbumsView'; 
import AllArtistsView from './components/AllArtistsView';
import SearchView from './components/SearchView';
import LibraryView from './components/LibraryView';
import FullPlayerView from './components/FullPlayerView';
import ProfileDrawerView from './components/ProfileDrawerView';
import NotificationCenter from './components/NotificationCenter';
import UpdateAvailableBanner from './components/UpdateAvailableBanner';
import DownloadCenterView from './components/DownloadCenterView';
import SettingsView from './components/SettingsView';
import AlbumDetailsView from './components/AlbumDetailsView'; 
import ArtistDetailsView from './components/ArtistDetailsView';
import UploadSongView from './components/UploadSongView';
import ManageAlbumsView from './components/ManageAlbumsView';
import ManageArtistsView from './components/ManageArtistsView';
import ManageLyricsView from './components/ManageLyricsView';
import ManageGenresView from './components/ManageGenresView';
import ManageSongsAdminView from './components/ManageSongsAdminView';
import ManageCanvasVideosView from './components/ManageCanvasVideosView';
import GenreDetailsView from './components/GenreDetailsView';
import CachedImage from './components/CachedImage';
import SongActionSheet from './components/SongActionSheet';
import {
  getPlaybackSpeedSetting, setPlaybackSpeedSetting,
  getNormalizeVolumeSetting, setNormalizeVolumeSetting,
  getOfflineOnlyModeSetting, setOfflineOnlyModeSetting,
  getAutoplayInfiniteSetting, setAutoplayInfiniteSetting,
  getSpatialAudioSetting, setSpatialAudioSetting,
  getDolbyAtmosSetting, setDolbyAtmosSetting,
  getHapticsSetting, setHapticsSetting,
  getEqPresetSetting, setEqPresetSetting,
  getCrossfadeSetting, setCrossfadeSetting,
  getCrossfadeDurationSetting, setCrossfadeDurationSetting,
  getCrossfadeDurationSeconds,
  getGaplessPlaybackSetting, setGaplessPlaybackSetting,
  getAutomixSetting, setAutomixSetting,
  fadeVolume,
  findSimilarTrack,
  getKeepScreenAwakeSetting, requestScreenWakeLock, releaseScreenWakeLock,
  applyAudioEffectsToElement, applyAudioEffectsToNative,
  triggerHaptic,
  sonaraAudioEngine,
  syncAllAudioEffectsToNative
} from './utils/audioEffects';
import { APP_THEMES, getSavedThemeId, getThemeById, saveThemeId } from './utils/themes';
import { CURRENT_APP_VERSION, isNewerVersion, notifyAppUpdate } from './utils/updateService';
import logo from './assets/logo3.png';
import './App.css';

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

const shuffleArray = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export default function App() {
  const [user, setUser] = useState(() => auth.currentUser || null);
  const [authResolved, setAuthResolved] = useState(false);
  const [isSyncingAccount, setIsSyncingAccount] = useState(false);
  const [loading, setLoading] = useState(false);
  const [songs, setSongs] = useState([]);
  const [artists, setArtists] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [playlistSongs, setPlaylistSongs] = useState([]);
  const [lyrics, setLyrics] = useState([]);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const [albums, setAlbums] = useState([]);
  const [selectedAlbum, setSelectedAlbum] = useState(null); 
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [selectedGenre, setSelectedGenre] = useState(null);
  const [libraryActiveTab, setLibraryActiveTab] = useState('playlists');
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [actionSheetSong, setActionSheetSong] = useState(null);
  const [actionSheetPlaylistId, setActionSheetPlaylistId] = useState(null);

  const [currentView, setCurrentView] = useState('home');
  const [homeFilter, setHomeFilter] = useState('All');
  const [currentQueue, setCurrentQueue] = useState([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const wasOnlineRef = useRef(navigator.onLine);

  const greetingText = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);
  // 🎧 Which output the phone is currently routed to — a Bluetooth car/
  // headset, a wired connection, or the built-in speaker. Powers the
  // "Connected to ..." indicator in MiniPlayer / FullPlayerView.
  const [audioRoute, setAudioRoute] = useState({ connected: false, deviceType: 'unknown', deviceName: null });
  const [showFullPlayer, setShowFullPlayer] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showDownloads, setShowDownloads] = useState(false);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showUploadSong, setShowUploadSong] = useState(false);
  const [showManageAlbums, setShowManageAlbums] = useState(false);
  const [showManageArtists, setShowManageArtists] = useState(false);
  const [showManageLyrics, setShowManageLyrics] = useState(false);
  const [showManageGenres, setShowManageGenres] = useState(false);
  const [showManageSongs, setShowManageSongs] = useState(false);
  const [showManageCanvas, setShowManageCanvas] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);

  // 🔄 SYNC FIX: Liked Songs and Recently Played used to live only in this
  // device's localStorage, so they never followed the account — a different
  // device (or a different Google account on the same device) saw an empty
  // list, and edits made on one device never appeared on another. Both are
  // now mirrored to Firestore under `users/{uid}` and kept live with
  // onSnapshot below, so any update (like/unlike, new play) is fully synced
  // across every signed-in session for that account in real time. Firestore's
  // persistentLocalCache (see firebase.js) still lets this work offline —
  // writes queue locally and flush to the server (then to other devices)
  // once the connection returns.
  const [likedSongIds, setLikedSongIds] = useState([]);
  // Raw synced entries: [{ songId, playedAt }]. The displayable `recentlyPlayed`
  // (full song objects) is derived below from these ids + the live `songs` list.
  const [recentlyPlayedEntries, setRecentlyPlayedEntries] = useState([]);
  const recentlyPlayed = useMemo(() => {
    return recentlyPlayedEntries
      .map((entry) => songs.find((s) => s.id === entry.songId))
      .filter(Boolean)
      .slice(0, 20);
  }, [recentlyPlayedEntries, songs]);
  const initialTrackAppliedRef = useRef(false);
  const [showQueueModal, setShowQueueModal] = useState(false);

  const [updateInfo, setUpdateInfo] = useState(null);
  const [dismissedUpdateVersion, setDismissedUpdateVersion] = useState(() => {
    try { return localStorage.getItem('sonara_dismissed_update_version') || null; } catch { return null; }
  });
  const handleDismissUpdateBanner = (version) => {
    setDismissedUpdateVersion(version);
    try { localStorage.setItem('sonara_dismissed_update_version', version); } catch {}
  };
  const [toast, setToast] = useState(null);
  const toastTimeoutRef = useRef(null);

  const showToast = (message, type = 'success', icon = null) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, type, icon });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 2800);
  };

  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [sleepTimeLeft, setSleepTimeLeft] = useState(null);
  const [trackProgress, setTrackProgress] = useState(0);
  const [trackDuration, setTrackDuration] = useState(0);

  const [increaseContrast, setIncreaseContrastState] = useState(() => localStorage.getItem('sonara_increase_contrast') === 'true');
  const setIncreaseContrast = (val) => {
    setIncreaseContrastState(val);
    try { localStorage.setItem('sonara_increase_contrast', String(val)); } catch {}
  };

  const [automaticallySendDiagnostics, setAutomaticallySendDiagnosticsState] = useState(() => localStorage.getItem('sonara_diagnostics') !== 'false');
  const setAutomaticallySendDiagnostics = (val) => {
    setAutomaticallySendDiagnosticsState(val);
    try { localStorage.setItem('sonara_diagnostics', String(val)); } catch {}
  };

  const [contentRestrictions, setContentRestrictionsState] = useState(() => localStorage.getItem('sonara_content_restrictions') === 'true');
  const setContentRestrictions = (val) => {
    setContentRestrictionsState(val);
    try { localStorage.setItem('sonara_content_restrictions', String(val)); } catch {}
  };
  const [themeId, setThemeId] = useState(getSavedThemeId);
  const currentTheme = useMemo(() => getThemeById(themeId), [themeId]);
  const [appTheme, setAppTheme] = useState(() => currentTheme.accent);

  const handleSelectTheme = (newThemeId) => {
    setThemeId(newThemeId);
    saveThemeId(newThemeId);
    const chosen = getThemeById(newThemeId);
    setAppTheme(chosen.accent);
  };

  const [motionEnabled, setMotionEnabledState] = useState(() => localStorage.getItem('sonara_motion_enabled') !== 'false');
  const setMotionEnabled = (val) => {
    setMotionEnabledState(val);
    try { localStorage.setItem('sonara_motion_enabled', String(val)); } catch {}
  };

  const [lyricsSize, setLyricsSizeState] = useState(() => localStorage.getItem('sonara_lyrics_size') || 'Normal');
  const setLyricsSize = (val) => {
    setLyricsSizeState(val);
    try { localStorage.setItem('sonara_lyrics_size', val); } catch {}
  };

  const [crossfadeEnabled, setCrossfadeEnabledState] = useState(getCrossfadeSetting);
  const setCrossfadeEnabled = (val) => {
    setCrossfadeEnabledState(val);
    setCrossfadeSetting(val);
  };

  const [crossfadeDuration, setCrossfadeDurationState] = useState(getCrossfadeDurationSetting);
  const setCrossfadeDuration = (val) => {
    setCrossfadeDurationState(val);
    setCrossfadeDurationSetting(val);
    setCrossfadeEnabledState(val !== 'Off');
  };

  const [gaplessPlayback, setGaplessPlaybackState] = useState(getGaplessPlaybackSetting);
  const setGaplessPlayback = (val) => {
    setGaplessPlaybackState(val);
    setGaplessPlaybackSetting(val);
  };

  const [automixEnabled, setAutomixEnabledState] = useState(getAutomixSetting);
  const setAutomixEnabled = (val) => {
    setAutomixEnabledState(val);
    setAutomixSetting(val);
  };

  const [dolbyAtmos, setDolbyAtmosState] = useState(getDolbyAtmosSetting);
  const setDolbyAtmos = (val) => {
    setDolbyAtmosState(val);
    setDolbyAtmosSetting(val);
  };

  const [originIslandActive, setOriginIslandActiveState] = useState(() => {
    try { return localStorage.getItem('sonara_origin_island_enabled') !== 'false'; } catch { return true; }
  });
  const setOriginIslandActive = (val) => {
    setOriginIslandActiveState(val);
    try { localStorage.setItem('sonara_origin_island_enabled', String(val)); } catch {}
  };

  // 🎛️ Dynamic Audio Engine Settings
  const [playbackSpeed, setPlaybackSpeedState] = useState(getPlaybackSpeedSetting);
  const setPlaybackSpeed = (val) => {
    setPlaybackSpeedState(val);
    setPlaybackSpeedSetting(val);
  };

  const [normalizeVolume, setNormalizeVolumeState] = useState(getNormalizeVolumeSetting);
  const setNormalizeVolume = (val) => {
    setNormalizeVolumeState(val);
    setNormalizeVolumeSetting(val);
  };

  const [offlineOnlyMode, setOfflineOnlyModeState] = useState(getOfflineOnlyModeSetting);
  const setOfflineOnlyMode = (val) => {
    setOfflineOnlyModeState(val);
    setOfflineOnlyModeSetting(val);
  };

  const [autoplayInfinite, setAutoplayInfiniteState] = useState(getAutoplayInfiniteSetting);
  const setAutoplayInfinite = (val) => {
    setAutoplayInfiniteState(val);
    setAutoplayInfiniteSetting(val);
  };

  const [spatialAudio, setSpatialAudioState] = useState(getSpatialAudioSetting);
  const setSpatialAudio = (val) => {
    setSpatialAudioState(val);
    setSpatialAudioSetting(val);
  };

  const [hapticsEnabled, setHapticsEnabledState] = useState(getHapticsSetting);
  const setHapticsEnabled = (val) => {
    setHapticsEnabledState(val);
    setHapticsSetting(val);
  };

  const [eqPreset, setEqPresetState] = useState(getEqPresetSetting);
  const setEqPreset = (val) => {
    setEqPresetState(val);
    setEqPresetSetting(val);
  };

  const [streamingQuality, setStreamingQualityState] = useState(getStreamingQuality);
  const setStreamingQualityVal = (val) => {
    setStreamingQualityState(val);
    setStreamingQuality(val);
  };

  const [downloadQuality, setDownloadQualityState] = useState(getDownloadQuality);
  const setDownloadQualityVal = (val) => {
    setDownloadQualityState(val);
    setDownloadQuality(val);
  };

  useEffect(() => {
    syncAllAudioEffectsToNative();
    if (audioRef.current) {
      sonaraAudioEngine.attachElement(audioRef.current);
    }
  }, []);

  useEffect(() => {
    // Smart Storage Optimization: automatically purge corrupt/orphaned cache on app startup
    const isSmartStorage = localStorage.getItem('sonara_smart_cache') !== 'false';
    if (isSmartStorage) {
      runSmartStorageOptimization({ songs }).catch(() => {});
    }
  }, [songs.length > 0]);

  useEffect(() => {
    const handleQualityChange = (e) => {
      const newQuality = e.detail?.quality;
      if (!newQuality) return;
      setStreamingQualityState(newQuality);

      // If active track is streaming live over network, seamlessly update source
      if (currentTrack && !isTrackCachedOffline(currentTrack.id)) {
        const nextUrl = getPlaybackSource(currentTrack, { quality: newQuality });
        if (Capacitor.isNativePlatform()) {
          if (mediaRef.current && isPlaying) {
            mediaRef.current.getCurrentPosition((pos) => {
              const resumeSec = (pos > 0) ? pos : 0;
              startNativeTrack(currentTrack, true, resumeSec);
            });
          }
        } else if (audioRef.current && nextUrl) {
          const curTime = audioRef.current.currentTime || 0;
          const wasPlaying = !audioRef.current.paused;
          if (audioRef.current.src !== nextUrl) {
            audioRef.current.src = nextUrl;
            audioRef.current.currentTime = curTime;
            if (wasPlaying) {
              audioRef.current.play().catch(console.warn);
            }
          }
        }
      }
    };

    const handleDownloadQualityChange = (e) => {
      if (e.detail?.quality) setDownloadQualityState(e.detail.quality);
    };

    window.addEventListener('sonara_streaming_quality_changed', handleQualityChange);
    window.addEventListener('sonara_download_quality_changed', handleDownloadQualityChange);
    return () => {
      window.removeEventListener('sonara_streaming_quality_changed', handleQualityChange);
      window.removeEventListener('sonara_download_quality_changed', handleDownloadQualityChange);
    };
  }, [currentTrack, isPlaying]);

  useEffect(() => {
    if (getKeepScreenAwakeSetting()) {
      requestScreenWakeLock();
    }
    return () => releaseScreenWakeLock();
  }, []);

  const audioRef = useRef(null);
  const mediaRef = useRef(null);
  const loadedNativeTrackIdRef = useRef(null);
  const nativeProgressIntervalRef = useRef(null);
  const prefetchAudioRef = useRef(null);
  const crossfadeAudioRef = useRef(null);
  const isCrossfadingRef = useRef(false);
  const fadingOutgoingAudioRef = useRef(null);
  const fadingNativeMediaRef = useRef(null);
  const fadeCancelRef = useRef(null);
  const nextTrackRef = useRef(null);
  const sleepTimerRef = useRef(null);
  const lastTrackChangeAtRef = useRef(0);
  const TRANSPORT_PAUSE_GRACE_MS = 700;

  const shuffleBagRef = useRef([]);
  const playHistoryRef = useRef([]);

  const toggleLikeSong = (song, e) => {
    if (e) e.stopPropagation();
    const songId = song.id || song.title || song.name;
    setLikedSongIds((prev) => {
      let updated;
      if (prev.includes(songId)) {
        updated = prev.filter(id => id !== songId);
        showToast("Removed from Liked Songs", "info", "fa-heart-crack");
      } else {
        updated = [...prev, songId];
        showToast("Added to Liked Songs", "success", "fa-heart");
      }
      // 🔄 Write straight to Firestore so every signed-in device for this
      // account sees the like/unlike immediately via the onSnapshot listener
      // below. Firestore's offline cache queues this write if we're offline
      // and flushes it (and syncs it out to other devices) once back online.
      if (user) {
        const userStatusRef = doc(db, 'users', user.uid);
        setDoc(userStatusRef, { likedSongIds: updated }, { merge: true })
          .catch(err => console.warn('Failed to sync liked songs:', err));
      }
      return updated;
    });
  };

  const recordRecentlyPlayed = (track) => {
    if (!track?.id) return;
    setRecentlyPlayedEntries((prev) => {
      const filtered = prev.filter(entry => entry.songId !== track.id);
      const updated = [{ songId: track.id, playedAt: Date.now() }, ...filtered].slice(0, 20);
      // 🔄 Same account-wide sync as liked songs: every play updates
      // Firestore, so "Recently Played" reflects listening from any device
      // signed into this account, not just the one currently playing.
      if (user) {
        const userStatusRef = doc(db, 'users', user.uid);
        setDoc(userStatusRef, { recentlyPlayed: updated }, { merge: true })
          .catch(err => console.warn('Failed to sync recently played:', err));
      }
      return updated;
    });
  };

  useEffect(() => {
    const docRef = doc(db, 'settings', 'appVersion');
    const unsubAppVersion = onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.version && isNewerVersion(data.version, CURRENT_APP_VERSION)) {
            setUpdateInfo(data);
            setHasUnreadNotifications(true);
            notifyAppUpdate(data);
          } else {
            setUpdateInfo(null);
          }
        }
      },
      (err) => {
        console.warn('App update listener failed:', err);
      }
    );

    return () => unsubAppVersion();
  }, []);

  const updateUnreadNotificationStatus = (songList = songs) => {
    try {
      const readIds = JSON.parse(localStorage.getItem('sonara_read_notifications') || '[]');
      const clearedIds = JSON.parse(localStorage.getItem('sonara_cleared_notifications') || '[]');
      const now = Date.now();
      
      const unreadRecentSongExists = songList.some((song) => {
        if (clearedIds.includes(song.id) || readIds.includes(song.id)) return false;
        let time = 0;
        if (song.createdAt?.seconds) time = song.createdAt.seconds * 1000;
        else if (song.createdAt?.toMillis) time = song.createdAt.toMillis();
        else if (song.uploadedAt) time = new Date(song.uploadedAt).getTime();
        else if (song.createdAt) time = new Date(song.createdAt).getTime();

        return time > 0 && (now - time) <= TWO_DAYS_MS;
      });

      const hasUpdateUnread = updateInfo && isNewerVersion(updateInfo.version, CURRENT_APP_VERSION) && !clearedIds.includes('update_' + updateInfo.version) && !readIds.includes('update_' + updateInfo.version);

      setHasUnreadNotifications(unreadRecentSongExists || !!hasUpdateUnread);
    } catch {
      setHasUnreadNotifications(false);
    }
  };

  useEffect(() => {
    updateUnreadNotificationStatus(songs);
  }, [songs, updateInfo]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const configureStatusBar = async () => {
      try {
        await StatusBar.setOverlaysWebView({ overlay: true });
        const isLightTheme = themeId && themeId.includes('light');
        await StatusBar.setStyle({ style: isLightTheme ? Style.Light : Style.Dark });
      } catch (err) {
        console.warn('Status bar overlay configuration failed:', err);
      }
    };

    configureStatusBar();
  }, [themeId]);

  const ensureStoragePermission = async () => {
    if (!Capacitor.isNativePlatform()) return true;
    try {
      const status = await Filesystem.checkPermissions();
      if (status.publicStorage === 'granted') return true;
      const requested = await Filesystem.requestPermissions();
      return requested.publicStorage === 'granted';
    } catch (err) {
      console.warn('Storage permission request failed:', err);
      return true;
    }
  };

  const handleDownloadSong = async (song) => {
    const hasPermission = await ensureStoragePermission();
    if (!hasPermission) {
      showToast("Storage permission is required to save songs offline.", "error", "fa-triangle-exclamation");
      return;
    }
    try {
      await downloadTrackToDevice(song);
      showToast(`"${song.title || song.name}" saved offline!`, "success", "fa-circle-down");
    } catch (err) {
      console.error('Download failed:', err);
      showToast("Failed to download track.", "error", "fa-circle-xmark");
    }
  };

  // 🧭 Unified Navigation & History Stack Architecture
  const tabHistoryRef = useRef([]);
  const detailHistoryRef = useRef([]);
  const detailOriginViewRef = useRef(null);
  const lastBackPressTimeRef = useRef(0);

  const openDetailView = ({ album = null, artist = null, genre = null, playlist = null }) => {
    // If a detail view is already active (e.g. browsing an album and clicked an artist),
    // save the current detail view on the stack so back button returns to the previous detail view.
    if (selectedAlbum || selectedArtist || selectedGenre || selectedPlaylist) {
      detailHistoryRef.current.push({
        selectedAlbum,
        selectedArtist,
        selectedGenre,
        selectedPlaylist,
        currentView
      });
    } else {
      // First detail view opened — save the origin view (e.g. 'search', 'library', 'all-albums', 'home')
      detailOriginViewRef.current = currentView;
    }
    setSelectedAlbum(album);
    setSelectedArtist(artist);
    setSelectedGenre(genre);
    setSelectedPlaylist(playlist);
    try { window.history.pushState({ sonaraNav: true }, ''); } catch (_) {}
  };

  const handleAppBack = () => {
    // Step 0: Dispatch custom back event to give nested sub-modals and dropdowns first priority
    const customEvent = new CustomEvent('sonara_back_press', { cancelable: true });
    const isHandled = !window.dispatchEvent(customEvent);
    if (isHandled) {
      triggerHaptic(15);
      return true;
    }

    // Step 1: Song 3-dot Context Action Sheet
    if (actionSheetSong || actionSheetPlaylistId) {
      triggerHaptic(15);
      setActionSheetSong(null);
      setActionSheetPlaylistId(null);
      return true;
    }

    // Step 2: Full-screen Admin screens
    if (showUploadSong) { triggerHaptic(15); setShowUploadSong(false); return true; }
    if (showManageAlbums) { triggerHaptic(15); setShowManageAlbums(false); return true; }
    if (showManageArtists) { triggerHaptic(15); setShowManageArtists(false); return true; }
    if (showManageLyrics) { triggerHaptic(15); setShowManageLyrics(false); return true; }
    if (showManageGenres) { triggerHaptic(15); setShowManageGenres(false); return true; }
    if (showManageSongs) { triggerHaptic(15); setShowManageSongs(false); return true; }
    if (showManageCanvas) { triggerHaptic(15); setShowManageCanvas(false); return true; }

    // Step 3: Top-level Overlays (Settings, Downloads, Notifications, Profile, Queue, About)
    if (showAboutModal) { triggerHaptic(15); setShowAboutModal(false); return true; }
    if (showQueueModal) { triggerHaptic(15); setShowQueueModal(false); return true; }
    if (showDownloads) { triggerHaptic(15); setShowDownloads(false); return true; }
    if (showNotifications) { triggerHaptic(15); setShowNotifications(false); return true; }
    if (showSettings) { triggerHaptic(15); setShowSettings(false); return true; }
    if (showProfile) { triggerHaptic(15); setShowProfile(false); return true; }

    // Step 4: Full Player Overlay (slide down to mini player)
    if (showFullPlayer) {
      triggerHaptic(20);
      setShowFullPlayer(false);
      return true;
    }

    // Step 5: Detail View History (e.g. from Artist back to Album)
    if (detailHistoryRef.current.length > 0) {
      const prev = detailHistoryRef.current.pop();
      triggerHaptic(20);
      setSelectedAlbum(prev.selectedAlbum);
      setSelectedArtist(prev.selectedArtist);
      setSelectedGenre(prev.selectedGenre);
      setSelectedPlaylist(prev.selectedPlaylist);
      if (prev.currentView && prev.currentView !== currentView) {
        setCurrentView(prev.currentView);
      }
      return true;
    }

    // Step 6: Active Detail Item (Album, Artist, Genre, Playlist) -> return to origin view
    if (selectedAlbum || selectedArtist || selectedGenre || selectedPlaylist) {
      triggerHaptic(20);
      setSelectedAlbum(null);
      setSelectedArtist(null);
      setSelectedGenre(null);
      setSelectedPlaylist(null);
      if (detailOriginViewRef.current) {
        setCurrentView(detailOriginViewRef.current);
        detailOriginViewRef.current = null;
      }
      return true;
    }

    // Step 7: Sub-views ('all-songs', 'all-albums', 'all-artists') -> return to previous view or home
    if (currentView === 'all-songs' || currentView === 'all-albums' || currentView === 'all-artists') {
      triggerHaptic(20);
      const prev = tabHistoryRef.current.pop() || 'home';
      setCurrentView(prev);
      return true;
    }

    // Step 8: Tab History (e.g. from Library back to Search, from Search back to Home)
    if (tabHistoryRef.current.length > 0) {
      const prev = tabHistoryRef.current.pop();
      if (prev && prev !== currentView) {
        triggerHaptic(20);
        setCurrentView(prev);
        return true;
      }
    }

    // If on search or library and tab history is empty, return to home:
    if (currentView !== 'home') {
      triggerHaptic(20);
      setCurrentView('home');
      return true;
    }

    // Step 9: At Root Home Screen: Standard Android Double-Back to Minimize
    const now = Date.now();
    if (now - lastBackPressTimeRef.current < 2000) {
      if (Capacitor.isNativePlatform()) {
        CapacitorApp.minimizeApp();
      }
    } else {
      lastBackPressTimeRef.current = now;
      triggerHaptic(30);
      showToast("Press back again to exit", "info", "fa-arrow-right-from-bracket");
    }
    return true;
  };

  const handleTabChange = (view) => {
    if (view === currentView && !selectedAlbum && !selectedArtist && !selectedGenre && !selectedPlaylist) {
      return;
    }
    if (view !== currentView) {
      tabHistoryRef.current.push(currentView);
      setCurrentView(view);
      try { window.history.pushState({ sonaraNav: true }, ''); } catch (_) {}
    }
    setSelectedAlbum(null);
    setSelectedArtist(null);
    setSelectedGenre(null);
    setSelectedPlaylist(null);
    detailHistoryRef.current = [];
    detailOriginViewRef.current = null;
  };

  // 📱 Android Hardware Navigation Bar Back Button & Gesture Handler
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let listenerHandle = null;
    const registerListener = async () => {
      listenerHandle = await CapacitorApp.addListener('backButton', () => {
        handleAppBack();
      });
    };

    registerListener();

    return () => {
      if (listenerHandle) {
        listenerHandle.remove();
      }
    };
  }, [
    actionSheetSong, actionSheetPlaylistId,
    showUploadSong, showManageAlbums, showManageArtists, showManageLyrics, showManageGenres, showManageSongs, showManageCanvas,
    showAboutModal, showQueueModal, showDownloads, showNotifications, showSettings, showProfile, showFullPlayer,
    selectedAlbum, selectedArtist, selectedGenre, selectedPlaylist, currentView
  ]);

  // 🌐 Web Browser & PWA Popstate / Back Button Support
  useEffect(() => {
    const handlePopState = () => {
      handleAppBack();
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [
    actionSheetSong, actionSheetPlaylistId,
    showUploadSong, showManageAlbums, showManageArtists, showManageLyrics, showManageGenres, showManageSongs, showManageCanvas,
    showAboutModal, showQueueModal, showDownloads, showNotifications, showSettings, showProfile, showFullPlayer,
    selectedAlbum, selectedArtist, selectedGenre, selectedPlaylist, currentView
  ]);

  const audioStateRef = useRef({
    songs,
    currentQueue,
    currentTrack,
    isShuffle,
    isRepeat,
    isPlaying,
    autoplayInfinite,
    crossfadeEnabled,
    crossfadeDuration,
    gaplessPlayback,
    automixEnabled
  });
  useEffect(() => {
    audioStateRef.current = {
      songs,
      currentQueue,
      currentTrack,
      isShuffle,
      isRepeat,
      isPlaying,
      autoplayInfinite,
      crossfadeEnabled,
      crossfadeDuration,
      gaplessPlayback,
      automixEnabled
    };
  }, [songs, currentQueue, currentTrack, isShuffle, isRepeat, isPlaying, autoplayInfinite, crossfadeEnabled, crossfadeDuration, gaplessPlayback, automixEnabled]);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  useEffect(() => {
    if (!isOnline && (currentView === 'home' || currentView === 'search')) {
      setCurrentView('library');
    }
  }, [isOnline, currentView]);

  useEffect(() => {
    if (isOnline && !wasOnlineRef.current) {
      setCurrentView('home');
    }
    wasOnlineRef.current = isOnline;
  }, [isOnline]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser ?? null);
      setAuthResolved(true);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let listenerHandle;
    let cancelled = false;

    const refreshRoute = () => {
      AudioRouteInfo.getStatus()
        .then((status) => {
          if (!cancelled && status) {
            setAudioRoute(status);
          }
        })
        .catch(() => {});
    };

    refreshRoute();

    if (Capacitor.isNativePlatform() && AudioRouteInfo.checkPermissions) {
      AudioRouteInfo.checkPermissions()
        .then((perm) => {
          if (perm && perm.bluetooth !== 'granted' && AudioRouteInfo.requestPermissions) {
            AudioRouteInfo.requestPermissions().then(() => refreshRoute()).catch(() => {});
          }
        })
        .catch(() => {});
    }

    AudioRouteInfo.addListener('audioRouteChanged', (status) => {
      if (!cancelled && status) {
        setAudioRoute(status);
      }
    }).then((handle) => { listenerHandle = handle; });

    // Periodic gentle refresh every 3 seconds so Bluetooth connect/disconnect from Android quick-settings shade reflects immediately
    const pollTimer = setInterval(refreshRoute, 3000);

    const onVisibilityChange = () => {
      if (!document.hidden) refreshRoute();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      listenerHandle?.remove();
      clearInterval(pollTimer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;
    const unlock = () => {
      if (audioRef.current && audioRef.current.paused) {
        const playPromise = audioRef.current.play();
        if (playPromise !== undefined) {
          playPromise.then(() => audioRef.current.pause()).catch(() => {});
        }
      }
    };
    document.addEventListener('touchstart', unlock, { once: true });
    document.addEventListener('click', unlock, { once: true });
    return () => {
      document.removeEventListener('touchstart', unlock);
      document.removeEventListener('click', unlock);
    };
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;

      if (Capacitor.isNativePlatform()) {
        const media = mediaRef.current;
        if (!media) return;
        const dur = typeof media.getDuration === 'function' ? media.getDuration() : -1;
        if (!dur || dur <= 0) return;
        media.getCurrentPosition().then((pos) => {
          if (!isCrossfadingRef.current && pos != null && pos >= dur - 1 && (Date.now() - lastTrackChangeAtRef.current > 10000)) {
            triggerNextTrackLogic();
          } else if (pos != null && pos >= 0) {
            setTrackProgress(pos);
          }
        }).catch(() => {});
        return;
      }

      const audio = audioRef.current;
      if (!audio) return;
      if (!isCrossfadingRef.current && (audio.ended || (audio.duration && audio.currentTime >= audio.duration - 0.5)) && (Date.now() - lastTrackChangeAtRef.current > 10000)) {
        triggerNextTrackLogic();
      } else if (audioStateRef.current.isPlaying && audio.paused) {
        audio.play().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    let bgListenerHandle, fgListenerHandle;

    const initBackgroundServices = async () => {
      if (!Capacitor.isNativePlatform()) return;

      // 🚗 BT METADATA FIX: these MediaSession action handlers used to be
      // registered *after* the notification-permission request and the
      // battery-optimization dialog below — both of which `await` on the
      // user interacting with a system prompt and can block for a long time
      // (or forever, if the person ignores the dialog). If a song is played
      // before these handlers exist, the native MediaSessionService computes
      // an empty "available actions" set for the very first PlaybackState it
      // sends. Some car head units (this one included, going by the Harman
      // screenshot) treat a player with zero reported actions as not a real
      // "now playing" source and refuse to show its title/artist even after
      // the handlers register a moment later — while still relaying the raw
      // Bluetooth audio position/duration, which is exactly the "duration
      // shows but title says Not Provided" symptom being reported. Doing
      // this registration first, synchronously, fixes that race.
      try {
        await MediaSession.setActionHandler({ action: 'play' }, () => {
          setIsPlaying(true);
        });

        await MediaSession.setActionHandler({ action: 'pause' }, () => {
          if (Date.now() - lastTrackChangeAtRef.current < TRANSPORT_PAUSE_GRACE_MS) {
            return;
          }
          setIsPlaying(false);
        });

        await MediaSession.setActionHandler({ action: 'nexttrack' }, () => {
          triggerNextTrackLogic();
        });

        await MediaSession.setActionHandler({ action: 'previoustrack' }, () => {
          triggerPrevTrackLogic();
        });

        await MediaSession.setActionHandler({ action: 'seekto' }, (details) => {
          if (details?.seekTime != null) handleSeekProgress(details.seekTime);
        });

        await MediaSession.setActionHandler({ action: 'stop' }, () => {
          setIsPlaying(false);
        });
      } catch (err) {
        console.error('Failed to register MediaSession action handlers:', err);
      }

      try {
        try {
          const notifStatus = await BackgroundMode.checkNotificationsPermission();
          if (notifStatus?.status !== 'granted' && notifStatus?.notifications !== 'granted') {
            await BackgroundMode.requestNotificationsPermission();
          }
        } catch (checkErr) {
          console.warn('Notification permission check failed:', checkErr);
        }

        // MediaSessionService handles native foreground media playback and notifications.
        // BackgroundMode.enable() is not needed and avoiding it prevents its 20-second timeout crash.
        await BackgroundMode.disableWebViewOptimizations();

        try {
          const battStatus = await BackgroundMode.checkBatteryOptimizations();
          if (battStatus?.enabled) {
            await BackgroundMode.requestDisableBatteryOptimizations();
          }
        } catch (battErr) {
          console.warn('Battery optimization request failed:', battErr);
        }

        bgListenerHandle = await BackgroundMode.addListener('appInBackground', async () => {
          try { await BackgroundMode.disableWebViewOptimizations(); } catch (_) {}
          // Re-assert MediaSession on minimization to ensure Vivo Origin Island & Android Smart Island display the live capsule
          try {
            const { currentTrack: t, isPlaying: p } = audioStateRef.current;
            if (t && localStorage.getItem('sonara_origin_island_enabled') !== 'false') {
              updateMediaSession(t, p);
            }
          } catch (_) {}
        });

        fgListenerHandle = await BackgroundMode.addListener('appInForeground', () => {
          const media = mediaRef.current;
          if (!media) return;
          const dur = typeof media.getDuration === 'function' ? media.getDuration() : -1;
          if (!dur || dur <= 0) return;
          media.getCurrentPosition().then((pos) => {
            if (!isCrossfadingRef.current && pos != null && pos >= dur - 1 && (Date.now() - lastTrackChangeAtRef.current > 10000)) {
              triggerNextTrackLogic();
            }
          }).catch(() => {});
        });

      } catch (err) {
        console.error('Failed to register hardware media channels:', err);
      }
    };

    initBackgroundServices();

    const nativeWatchdogInterval = setInterval(() => {
      if (!Capacitor.isNativePlatform() || !audioStateRef.current.isPlaying || isCrossfadingRef.current) return;
      if (Date.now() - lastTrackChangeAtRef.current < 10000) return;
      const media = mediaRef.current;
      if (!media) return;
      const dur = typeof media.getDuration === 'function' ? media.getDuration() : -1;
      if (!dur || dur <= 0) return;
      media.getCurrentPosition().then((pos) => {
        if (!isCrossfadingRef.current && pos != null && pos >= dur - 1) {
          triggerNextTrackLogic();
        }
      }).catch(() => {});
    }, 3000);

    return () => {
      clearInterval(nativeWatchdogInterval);
      bgListenerHandle?.remove();
      fgListenerHandle?.remove();
    };
  }, []);

  const peekNextTrack = () => {
    const { songs: s, currentQueue: q, currentTrack: t, isShuffle: sh, autoplayInfinite: autoInf } = audioStateRef.current;
    const queue = q.length > 0 ? q : s;
    if (!queue.length) return null;

    if (sh) {
      if (queue.length > 1) {
        if (!shuffleBagRef.current || shuffleBagRef.current.length === 0) {
          if (!autoInf) return null;
          return findSimilarTrack(t, s, playHistoryRef.current) || queue[0];
        }
        const nextId = shuffleBagRef.current[0];
        return queue.find(track => track.id === nextId) || queue[0];
      } else {
        if (!autoInf) return null;
        return findSimilarTrack(t, s, playHistoryRef.current) || queue[0];
      }
    } else {
      const idx = queue.findIndex(track => track.id === t?.id);
      if (idx === queue.length - 1) {
        if (!autoInf) return null;
        return findSimilarTrack(t, s, playHistoryRef.current) || queue[0];
      }
      return queue[(idx + 1) % queue.length];
    }
  };

  const cleanupFadingAudio = () => {
    isCrossfadingRef.current = false;
    if (fadeCancelRef.current) {
      try { fadeCancelRef.current(); } catch (_) {}
      fadeCancelRef.current = null;
    }
    if (fadingOutgoingAudioRef.current) {
      const out = fadingOutgoingAudioRef.current;
      fadingOutgoingAudioRef.current = null;
      try {
        out.onended = null;
        out.ontimeupdate = null;
        out.onloadedmetadata = null;
        out.onerror = null;
        out.pause();
        out.currentTime = 0;
        out.removeAttribute('src');
        out.load();
        out.volume = 1.0;
      } catch (_) {}
    }
    if (fadingNativeMediaRef.current) {
      const out = fadingNativeMediaRef.current;
      fadingNativeMediaRef.current = null;
      try {
        if (out.onSuccess && typeof out.onSuccess.unsubscribe === 'function') {
          out.onSuccess.unsubscribe();
        }
        out.successCallback = null;
        if (out._objectInstance) out._objectInstance.successCallback = null;
        out.stop();
        out.release();
      } catch (_) {}
    }
  };

  const startNativeCrossfade = async (durationSec) => {
    const next = peekNextTrack();
    if (!next) {
      isCrossfadingRef.current = false;
      return;
    }

    const nextUrl = getPlaybackSource(next, { quality: streamingQuality });
    if (!nextUrl) {
      isCrossfadingRef.current = false;
      return;
    }

    const fadeMs = durationSec * 1000;
    const outgoingMedia = mediaRef.current;
    fadingNativeMediaRef.current = outgoingMedia;

    // Disconnect completion callbacks on outgoing media so stopping it never triggers track skip
    if (outgoingMedia) {
      try {
        if (outgoingMedia.onSuccess && typeof outgoingMedia.onSuccess.unsubscribe === 'function') {
          outgoingMedia.onSuccess.unsubscribe();
        }
        outgoingMedia.successCallback = null;
        if (outgoingMedia._objectInstance) {
          outgoingMedia._objectInstance.successCallback = null;
        }
      } catch (_) {}
    }

    let incomingMedia;
    try {
      incomingMedia = Media.create(nextUrl);
    } catch (err) {
      console.warn('Native crossfade Media.create error:', err);
      isCrossfadingRef.current = false;
      return;
    }

    try { incomingMedia.setVolume(0); } catch (_) {}
    incomingMedia.play();

    let cancelOut = () => {};
    if (outgoingMedia) {
      cancelOut = fadeVolume(outgoingMedia, 1.0, 0, fadeMs, () => {
        try {
          if (outgoingMedia.onSuccess && typeof outgoingMedia.onSuccess.unsubscribe === 'function') {
            outgoingMedia.onSuccess.unsubscribe();
          }
          outgoingMedia.successCallback = null;
          if (outgoingMedia._objectInstance) {
            outgoingMedia._objectInstance.successCallback = null;
          }
          outgoingMedia.stop();
          outgoingMedia.release();
        } catch (_) {}
        if (fadingNativeMediaRef.current === outgoingMedia) {
          fadingNativeMediaRef.current = null;
        }
      });
    }

    const cancelIn = fadeVolume(incomingMedia, 0, 1.0, fadeMs, () => {
      isCrossfadingRef.current = false;
    });

    fadeCancelRef.current = () => {
      cancelOut();
      cancelIn();
    };

    mediaRef.current = incomingMedia;
    loadedNativeTrackIdRef.current = next.id;
    lastTrackChangeAtRef.current = Date.now();
    setTrackProgress(0);
    setTrackDuration(0);

    const thisTrackId = next.id;
    incomingMedia.onSuccess.subscribe(() => {
      if (loadedNativeTrackIdRef.current !== thisTrackId) return;
      if (isCrossfadingRef.current) return;
      if (Date.now() - lastTrackChangeAtRef.current < 10000) return;
      const { isRepeat: r } = audioStateRef.current;
      if (r) {
        startNativeTrack(next, true);
      } else {
        triggerNextTrackLogic();
      }
    });

    if (typeof incomingMedia.onError?.subscribe === 'function') {
      incomingMedia.onError.subscribe((err) => console.error('Native crossfade audio playback error:', err));
    }

    // Reset progress tracking interval and re-bind strictly to incomingMedia
    if (nativeProgressIntervalRef.current) {
      clearInterval(nativeProgressIntervalRef.current);
      nativeProgressIntervalRef.current = null;
    }

    nativeProgressIntervalRef.current = setInterval(() => {
      const m = mediaRef.current;
      if (!m) return;

      const dur = typeof m.getDuration === 'function' ? m.getDuration() : -1;
      if (dur && dur > 0) setTrackDuration(dur);

      if (typeof m.getCurrentPosition === 'function') {
        m.getCurrentPosition().then((pos) => {
          if (pos != null && pos >= 0) {
            setTrackProgress(pos);
            if (Capacitor.isNativePlatform() && dur > 0) {
              MediaSession.setPositionState({ duration: dur, playbackRate: 1.0, position: pos }).catch(() => {});
            }

            // Crossfade check for incoming track (must play >= 15s to prevent immediate chained triggers)
            const { crossfadeEnabled: cfOn, crossfadeDuration: cfDur, isRepeat: r } = audioStateRef.current;
            if (cfOn && cfDur !== 'Off' && !r && !isCrossfadingRef.current && dur > 8 && (Date.now() - lastTrackChangeAtRef.current > 15000)) {
              const durSec = parseInt(cfDur, 10) || 0;
              const timeLeft = dur - pos;
              if (durSec > 0 && timeLeft <= durSec && timeLeft > 0.4) {
                isCrossfadingRef.current = true;
                startNativeCrossfade(durSec);
              }
            }
          }
        }).catch(() => {});
      }
    }, 500);

    syncAllAudioEffectsToNative();

    if (currentTrack && currentTrack.id !== next.id) {
      playHistoryRef.current.push(currentTrack);
      if (playHistoryRef.current.length > 50) playHistoryRef.current.shift();
    }
    setCurrentTrack(next);
    setIsPlaying(true);
    recordRecentlyPlayed(next);
    updateMediaSession(next, true);
  };

  const startWebCrossfade = async (durationSec) => {
    const next = peekNextTrack();
    if (!next) {
      isCrossfadingRef.current = false;
      return;
    }

    const nextUrl = getPlaybackSource(next, { quality: streamingQuality });
    if (!nextUrl) {
      isCrossfadingRef.current = false;
      return;
    }
    const resolvedNextUrl = new URL(nextUrl, window.location.href).href;
    const fadeMs = durationSec * 1000;

    if (!crossfadeAudioRef.current) {
      crossfadeAudioRef.current = new Audio();
      crossfadeAudioRef.current.crossOrigin = 'anonymous';
      crossfadeAudioRef.current.setAttribute('playsinline', '');
      crossfadeAudioRef.current.setAttribute('webkit-playsinline', '');
    }

    const outgoingAudio = audioRef.current;
    const incomingAudio = crossfadeAudioRef.current;

    // Disconnect event listeners on outgoing element immediately so it can never trigger track skips
    if (outgoingAudio) {
      outgoingAudio.onended = null;
      outgoingAudio.ontimeupdate = null;
      outgoingAudio.onloadedmetadata = null;
      outgoingAudio.onerror = null;
    }

    if (fadingOutgoingAudioRef.current && fadingOutgoingAudioRef.current !== outgoingAudio) {
      try {
        fadingOutgoingAudioRef.current.onended = null;
        fadingOutgoingAudioRef.current.ontimeupdate = null;
        fadingOutgoingAudioRef.current.onloadedmetadata = null;
        fadingOutgoingAudioRef.current.onerror = null;
        fadingOutgoingAudioRef.current.pause();
        fadingOutgoingAudioRef.current.currentTime = 0;
        fadingOutgoingAudioRef.current.removeAttribute('src');
        fadingOutgoingAudioRef.current.load();
        fadingOutgoingAudioRef.current.volume = 1.0;
      } catch (_) {}
    }
    fadingOutgoingAudioRef.current = outgoingAudio;

    incomingAudio.src = resolvedNextUrl;
    incomingAudio.currentTime = 0;
    incomingAudio.volume = 0;

    sonaraAudioEngine.attachElement(incomingAudio);
    sonaraAudioEngine.resume();

    try {
      await incomingAudio.play();
    } catch (err) {
      console.warn('Crossfade incoming playback failed:', err);
      isCrossfadingRef.current = false;
      return;
    }

    // SWAP primary audio reference to incomingAudio BEFORE state update
    audioRef.current = incomingAudio;
    crossfadeAudioRef.current = outgoingAudio;
    lastTrackChangeAtRef.current = Date.now();
    setTrackProgress(0);
    setTrackDuration(0);

    // Start equal-power fade out on outgoingAudio
    let cancelOut = () => {};
    if (outgoingAudio) {
      cancelOut = fadeVolume(outgoingAudio, outgoingAudio.volume || 1.0, 0, fadeMs, () => {
        try {
          outgoingAudio.onended = null;
          outgoingAudio.ontimeupdate = null;
          outgoingAudio.onloadedmetadata = null;
          outgoingAudio.onerror = null;
          outgoingAudio.pause();
          outgoingAudio.currentTime = 0;
          outgoingAudio.removeAttribute('src');
          outgoingAudio.load();
          outgoingAudio.volume = 1.0;
        } catch (_) {}
        if (fadingOutgoingAudioRef.current === outgoingAudio) {
          fadingOutgoingAudioRef.current = null;
        }
      });
    }

    // Start equal-power fade in on incomingAudio
    const cancelIn = fadeVolume(incomingAudio, 0, 1.0, fadeMs, () => {
      isCrossfadingRef.current = false;
    });

    fadeCancelRef.current = () => {
      cancelOut();
      cancelIn();
    };

    if (currentTrack && currentTrack.id !== next.id) {
      playHistoryRef.current.push(currentTrack);
      if (playHistoryRef.current.length > 50) playHistoryRef.current.shift();
    }
    setCurrentTrack(next);
    setIsPlaying(true);
    recordRecentlyPlayed(next);
    updateMediaSession(next, true);
  };

  const startCrossfadeTransition = async (durationSec) => {
    if (Capacitor.isNativePlatform()) {
      return startNativeCrossfade(durationSec);
    } else {
      return startWebCrossfade(durationSec);
    }
  };

  const triggerNextTrackLogic = () => {
    cleanupFadingAudio();
    const { songs: s, currentQueue: q, currentTrack: t, isShuffle: sh, autoplayInfinite: autoInf } = audioStateRef.current;
    const queue = q.length > 0 ? q : s;
    if (!queue.length) return;
    
    let next;
    if (sh) {
      if (queue.length > 1) {
        if (!shuffleBagRef.current || shuffleBagRef.current.length === 0) {
          if (!autoInf) {
            setIsPlaying(false);
            return;
          }
          const similar = findSimilarTrack(t, s, playHistoryRef.current);
          if (similar && similar.id !== t?.id) {
            next = similar;
          } else {
            const remainingIds = queue.filter(track => track.id !== t?.id).map(track => track.id);
            shuffleBagRef.current = shuffleArray(remainingIds);
            const nextId = shuffleBagRef.current.shift();
            next = queue.find(track => track.id === nextId) || queue[0];
          }
        } else {
          const nextId = shuffleBagRef.current.shift();
          next = queue.find(track => track.id === nextId) || queue[0];
        }
      } else {
        if (!autoInf) {
          setIsPlaying(false);
          return;
        }
        next = findSimilarTrack(t, s, playHistoryRef.current) || queue[0];
      }
    } else {
      const idx = queue.findIndex(track => track.id === t?.id);
      if (idx === queue.length - 1) {
        if (!autoInf) {
          setIsPlaying(false);
          return;
        }
        next = findSimilarTrack(t, s, playHistoryRef.current) || queue[0];
      } else {
        next = queue[(idx + 1) % queue.length];
      }
    }
    if (next) {
      handleTrackSelection(next, queue, false);
    }
  };

  const triggerPrevTrackLogic = () => {
    cleanupFadingAudio();
    const { songs: s, currentQueue: q, currentTrack: t } = audioStateRef.current;
    const queue = q.length > 0 ? q : s;
    if (!queue.length) return;

    if (playHistoryRef.current.length > 0) {
      const prevTrack = playHistoryRef.current.pop();
      if (prevTrack && queue.some(track => track.id === prevTrack.id)) {
        setCurrentTrack(prevTrack);
        setIsPlaying(true);
        recordRecentlyPlayed(prevTrack);
        if (user && isOnline) {
          const userStatusRef = doc(db, 'users', user.uid);
          setDoc(userStatusRef, { lastPlayedTrackId: prevTrack.id }, { merge: true })
            .catch(err => console.error('Failed to sync lastPlayedTrackId:', err));
        }
        return;
      }
    }

    const idx = queue.findIndex(track => track.id === t?.id);
    const prev = queue[(idx - 1 + queue.length) % queue.length];
    handleTrackSelection(prev, queue, false);
  };

  const toggleShuffle = () => {
    setIsShuffle(prev => {
      const nextVal = !prev;
      if (nextVal) {
        const queue = currentQueue.length > 0 ? currentQueue : songs;
        const remainingIds = queue.filter(track => track.id !== currentTrack?.id).map(track => track.id);
        shuffleBagRef.current = shuffleArray(remainingIds);
      }
      return nextVal;
    });
  };

  const updateMediaSession = async (track, playing) => {
    if (!track) {
      if (Capacitor.isNativePlatform()) {
        try {
          await MediaSession.setPlaybackState({ playbackState: 'none', state: 'none' });
        } catch (_) {}
      } else if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'none';
      }
      return;
    }

    const coverUrl = track.cover || track.image || track.imageUrl;
    const artworkList = coverUrl ? [{ src: coverUrl, sizes: '512x512', type: 'image/jpeg' }] : [];
    const title = track.title || track.name || 'Unknown Title';
    const artist = track.artist || 'Unknown Artist';
    const album = track.album || 'Sonara';

    if (Capacitor.isNativePlatform()) {
      try {
        await MediaSession.setMetadata({
          title,
          artist,
          album,
          artwork: artworkList,
        });
        await MediaSession.setPlaybackState({
          playbackState: playing ? 'playing' : 'paused',
          state: playing ? 'playing' : 'paused',
        });
      } catch (err) {
        console.warn('MediaSession sync error:', err);
      }
    } else if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title,
          artist,
          album,
          artwork: artworkList,
        });
        navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
      } catch (err) {
        console.warn('Web mediaSession sync error:', err);
      }
    }
  };

  const startNativeTrack = (track, autoplay = true, seekTime = 0) => {
    if (!track) return;
    const url = getPlaybackSource(track, { quality: streamingQuality });
    if (!url) return;

    cleanupFadingAudio();
    if (mediaRef.current) {
      try { mediaRef.current.stop(); } catch (_) {}
      try { mediaRef.current.release(); } catch (_) {}
      mediaRef.current = null;
    }
    if (nativeProgressIntervalRef.current) {
      clearInterval(nativeProgressIntervalRef.current);
      nativeProgressIntervalRef.current = null;
    }

    lastTrackChangeAtRef.current = Date.now();
    setTrackProgress(seekTime || 0);
    setTrackDuration(0);
    loadedNativeTrackIdRef.current = track.id;

    let media;
    try {
      media = Media.create(url);
    } catch (err) {
      console.error('Failed to create native media instance:', err);
      return;
    }
    mediaRef.current = media;
    syncAllAudioEffectsToNative();

    media.onSuccess.subscribe(() => {
      if (loadedNativeTrackIdRef.current !== track.id) return;
      if (isCrossfadingRef.current) return;
      if (Date.now() - lastTrackChangeAtRef.current < 10000) return;
      const { isRepeat: r } = audioStateRef.current;
      if (r) {
        startNativeTrack(track, true);
      } else {
        triggerNextTrackLogic();
      }
    });

    if (typeof media.onError?.subscribe === 'function') {
      media.onError.subscribe((err) => console.error('Native audio playback error:', err));
    }

    updateMediaSession(track, autoplay);

    if (autoplay) {
      media.play();
      if (seekTime > 0 && typeof media.seekTo === 'function') {
        setTimeout(() => {
          try { media.seekTo(seekTime * 1000); } catch (_) {}
        }, 150);
      }
    }

    nativeProgressIntervalRef.current = setInterval(() => {
      const m = mediaRef.current;
      if (!m) return;

      const dur = typeof m.getDuration === 'function' ? m.getDuration() : -1;
      if (dur && dur > 0) setTrackDuration(dur);

      if (typeof m.getCurrentPosition === 'function') {
        m.getCurrentPosition().then((pos) => {
          if (pos != null && pos >= 0) {
            setTrackProgress(pos);
            if (Capacitor.isNativePlatform() && dur > 0) {
              MediaSession.setPositionState({ duration: dur, playbackRate: 1.0, position: pos }).catch(() => {});
            }

            // Native Crossfade transition check (only when playing for at least 15s)
            const { crossfadeEnabled: cfOn, crossfadeDuration: cfDur, isRepeat: r } = audioStateRef.current;
            if (cfOn && cfDur !== 'Off' && !r && !isCrossfadingRef.current && dur > 8 && (Date.now() - lastTrackChangeAtRef.current > 15000)) {
              const durSec = parseInt(cfDur, 10) || 0;
              const timeLeft = dur - pos;
              if (durSec > 0 && timeLeft <= durSec && timeLeft > 0.4) {
                isCrossfadingRef.current = true;
                startNativeCrossfade(durSec);
              }
            }
          }
        }).catch(() => {});
      }
    }, 500);
  };

  useEffect(() => {
    return () => {
      cleanupFadingAudio();
      if (nativeProgressIntervalRef.current) clearInterval(nativeProgressIntervalRef.current);
      if (mediaRef.current) {
        try { mediaRef.current.stop(); } catch (_) {}
        try { mediaRef.current.release(); } catch (_) {}
      }
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    initialTrackAppliedRef.current = false;
    setLikedSongIds([]);
    setRecentlyPlayedEntries([]);

    const christianAllowedEmails = [
      'bright2013.br@gmail.com',
      'jebarejila2@gmail.com'
    ];

    let unsubChristianSongs = () => {};
    let generalSongsList = [];
    let christianSongsList = [];

    const updateCombinedSongs = () => {
      const combined = [...generalSongsList, ...christianSongsList];
      setSongs(combined);
      setCurrentQueue((prev) => (prev.length === 0 ? combined : prev));
      updateUnreadNotificationStatus(combined);
      setLoading(false);
    };

    const unsubSongs = onSnapshot(collection(db, 'songs'), (snap) => {
      generalSongsList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      updateCombinedSongs();
    }, (err) => {
      console.error('Songs listener error:', err);
      setLoading(false);
    });

    if (christianAllowedEmails.includes(user.email)) {
      unsubChristianSongs = onSnapshot(collection(db, 'christianSongs'), (snap) => {
        christianSongsList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        updateCombinedSongs();
      }, (err) => {
        console.error('Christian songs listener error:', err);
      });
    }

    const unsubAlbums = onSnapshot(collection(db, 'albums'), (snap) => {
      setAlbums(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubArtists = onSnapshot(collection(db, 'artists'), (snap) => {
      setArtists(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubLyrics = onSnapshot(collection(db, 'lyrics'), (snap) => {
      setLyrics(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const playlistsQuery = query(collection(db, 'playlists'), where('uid', '==', user.uid));
    const unsubPlaylists = onSnapshot(playlistsQuery, (snap) => {
      setPlaylists(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubPlaylistSongs = onSnapshot(collection(db, 'playlistSongs'), (snap) => {
      setPlaylistSongs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 🔄 SYNC FIX: this used to be a one-time getDoc, so liked songs / recently
    // played / last-played-track were only ever read once at login and never
    // updated again unless the app was reloaded. Switching to onSnapshot means
    // any change made from *another* signed-in device for this same account —
    // a like, an unlike, a new play — streams in live and updates this session
    // too, in addition to the writes this session makes itself.
    const userStatusRef = doc(db, 'users', user.uid);
    const unsubUserStatus = onSnapshot(userStatusRef, (snap) => {
      const data = snap.exists() ? snap.data() : null;
      setLikedSongIds(data?.likedSongIds || []);
      setRecentlyPlayedEntries(data?.recentlyPlayed || []);

      // Only apply the "resume last played track" behavior once per app
      // session — otherwise a track played from another device would keep
      // yanking playback out from under the person actively listening here.
      if (!initialTrackAppliedRef.current && data?.lastPlayedTrackId) {
        initialTrackAppliedRef.current = true;
        const savedTrackId = data.lastPlayedTrackId;
        setTimeout(() => {
          setSongs((latestSongs) => {
            const matched = latestSongs.find(s => s.id === savedTrackId);
            if (matched) setCurrentTrack(matched);
            return latestSongs;
          });
        }, 500);
      }
    }, (err) => {
      console.warn('User profile sync error:', err);
    });

    return () => {
      unsubSongs();
      unsubChristianSongs();
      unsubAlbums();
      unsubArtists();
      unsubLyrics();
      unsubPlaylists();
      unsubPlaylistSongs();
      unsubUserStatus();
    };
  }, [user]);

  // Keep the actively-playing track's Canvas video fields in sync with the live
  // `songs` list. `currentTrack` is a snapshot captured when playback started, so
  // without this it never sees a canvasVideoUrl added afterwards (e.g. via the
  // Manage Canvas Videos admin screen, or the Firestore realtime listener updating
  // `songs` from another session) and FullPlayerView keeps showing "no video".
  useEffect(() => {
    if (!currentTrack) return;
    const latest = songs.find(s => s.id === currentTrack.id);
    if (!latest) return;
    if (latest.canvasVideoUrl !== currentTrack.canvasVideoUrl || latest.canvasStatus !== currentTrack.canvasStatus) {
      setCurrentTrack((prev) =>
        prev && prev.id === latest.id
          ? { ...prev, canvasVideoUrl: latest.canvasVideoUrl, canvasStatus: latest.canvasStatus }
          : prev
      );
    }
  }, [songs, currentTrack]);

  useEffect(() => {
    if (!currentTrack) {
      updateMediaSession(null, false);
      return;
    }
    const trackUrl = getPlaybackSource(currentTrack, { quality: streamingQuality });
    if (!trackUrl) return;

    if (Capacitor.isNativePlatform()) {
      updateMediaSession(currentTrack, isPlaying);
      return;
    }

    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.crossOrigin = 'anonymous';
      audioRef.current.setAttribute('playsinline', '');
      audioRef.current.setAttribute('webkit-playsinline', '');
    }

    // Attach to Web Audio DSP Engine (EQ, 3D Spatial, Dolby Atmos, and Compressor Normalization)
    sonaraAudioEngine.attachElement(audioRef.current);

    const resolvedUrl = new URL(trackUrl, window.location.href).href;
    if (audioRef.current.src !== resolvedUrl) {
      lastTrackChangeAtRef.current = Date.now();

      audioRef.current.preload = 'auto';
      audioRef.current.src = trackUrl;
      setTrackProgress(0);
      setTrackDuration(0);
    }

    updateMediaSession(currentTrack, isPlaying);

    const boundAudio = audioRef.current;

    const handleTimeUpdate = (e) => {
      if (e?.target && e.target !== audioRef.current) return;
      const audio = audioRef.current;
      if (!audio) return;
      setTrackProgress(audio.currentTime);

      // Check for Crossfade transition (only after track has played for at least 15s)
      const { crossfadeEnabled: cfOn, crossfadeDuration: cfDur, isRepeat: r } = audioStateRef.current;
      if (cfOn && cfDur !== 'Off' && !r && !isCrossfadingRef.current && audio.duration > 8 && (Date.now() - lastTrackChangeAtRef.current > 15000)) {
        const durSec = parseInt(cfDur, 10) || 0;
        const timeLeft = audio.duration - audio.currentTime;
        if (durSec > 0 && timeLeft <= durSec && timeLeft > 0.4) {
          isCrossfadingRef.current = true;
          startCrossfadeTransition(durSec);
        }
      }
    };

    const handleLoadedMetadata = (e) => {
      if (e?.target && e.target !== audioRef.current) return;
      setTrackDuration(audioRef.current.duration);
    };

    const handleEnded = (e) => {
      if (e?.target && e.target !== audioRef.current) return;
      if (isCrossfadingRef.current) return;
      if (Date.now() - lastTrackChangeAtRef.current < 10000) return;
      if (sleepTimeLeft === 'end_of_song' || sleepTimeLeft === 0) {
        setIsPlaying(false);
        setSleepTimeLeft(null);
        showToast("Sleep timer completed — playback paused", "info", "fa-moon");
        return;
      }
      const { isRepeat: r } = audioStateRef.current;
      if (r) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      } else {
        triggerNextTrackLogic();
      }
    };

    boundAudio.addEventListener('timeupdate', handleTimeUpdate);
    boundAudio.addEventListener('loadedmetadata', handleLoadedMetadata);
    boundAudio.addEventListener('ended', handleEnded);

    calculateAndPrefetchNextTrack();

    return () => {
      boundAudio?.removeEventListener('timeupdate', handleTimeUpdate);
      boundAudio?.removeEventListener('loadedmetadata', handleLoadedMetadata);
      boundAudio?.removeEventListener('ended', handleEnded);
    };
  }, [currentTrack]);

  useEffect(() => {
    if (!currentTrack) return;

    if (Capacitor.isNativePlatform()) {
      const isNewTrack = loadedNativeTrackIdRef.current !== currentTrack.id;

      if (isNewTrack) {
        startNativeTrack(currentTrack, isPlaying);
      } else if (mediaRef.current) {
        if (isPlaying) {
          mediaRef.current.play();
          if (fadingNativeMediaRef.current) {
            try { fadingNativeMediaRef.current.play(); } catch (_) {}
          }
        } else {
          mediaRef.current.pause();
          if (fadingNativeMediaRef.current) {
            try { fadingNativeMediaRef.current.pause(); } catch (_) {}
          }
        }
        MediaSession.setPlaybackState({
          playbackState: isPlaying ? 'playing' : 'paused',
          state: isPlaying ? 'playing' : 'paused',
        }).catch(() => {});
      }
      return;
    }

    if (!audioRef.current || !audioRef.current.src) return;

    if (isPlaying) {
      sonaraAudioEngine.attachElement(audioRef.current);
      sonaraAudioEngine.resume();
      audioRef.current.play()
        .then(() => {
          if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
        })
        .catch(err => console.warn('Stream buffering:', err));
      if (fadingOutgoingAudioRef.current) {
        try { fadingOutgoingAudioRef.current.play(); } catch (_) {}
      }
    } else {
      audioRef.current.pause();
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
      if (fadingOutgoingAudioRef.current) {
        try { fadingOutgoingAudioRef.current.pause(); } catch (_) {}
      }
    }
  }, [isPlaying, currentTrack]);

  useEffect(() => {
    if (!('mediaSession' in navigator) || Capacitor.isNativePlatform()) return;

    navigator.mediaSession.setActionHandler('play', () => setIsPlaying(true));
    navigator.mediaSession.setActionHandler('pause', () => {
      if (Date.now() - lastTrackChangeAtRef.current < TRANSPORT_PAUSE_GRACE_MS) {
        return;
      }
      setIsPlaying(false);
    });
    navigator.mediaSession.setActionHandler('nexttrack', () => triggerNextTrackLogic());
    navigator.mediaSession.setActionHandler('previoustrack', () => triggerPrevTrackLogic());
    navigator.mediaSession.setActionHandler('seekto', (d) => { if (d?.seekTime != null) handleSeekProgress(d.seekTime); });
  }, []);

  const calculateAndPrefetchNextTrack = () => {
    if (Capacitor.isNativePlatform()) return;
    const queue = currentQueue.length > 0 ? currentQueue : songs;
    if (!queue.length || !currentTrack) return;

    let next = null;
    if (isShuffle) {
      if (shuffleBagRef.current && shuffleBagRef.current.length > 0) {
        const nextId = shuffleBagRef.current[0];
        next = queue.find(s => s.id === nextId);
      } else if (queue.length > 1) {
        const pool = queue.filter(s => s.id !== currentTrack.id);
        next = pool[0];
      }
    } else {
      const idx = queue.findIndex(s => s.id === currentTrack.id);
      next = queue[(idx + 1) % queue.length];
    }

    if (next && isOnline && !isTrackCachedOffline(next.id)) {
      nextTrackRef.current = next;
      const rawNextUrl = next.songUrl || next.audioUrl;
      if (rawNextUrl) {
        const nextUrl = applyQualityToUrl(rawNextUrl, streamingQuality);
        if (!prefetchAudioRef.current) prefetchAudioRef.current = new Audio();
        prefetchAudioRef.current.src = nextUrl;
        prefetchAudioRef.current.preload = 'auto';
        prefetchAudioRef.current.load();
      }
    }
  };

  useEffect(() => {
    calculateAndPrefetchNextTrack();
  }, [currentQueue, songs, isShuffle, isRepeat, isOnline]);

  useEffect(() => {
    if (sleepTimeLeft === null || sleepTimeLeft === 'end_of_song') return;
    if (sleepTimeLeft <= 0) {
      setIsPlaying(false);
      setSleepTimeLeft(null);
      showToast("Sleep timer completed — music paused", "info", "fa-moon");
      return;
    }
    sleepTimerRef.current = setTimeout(() => {
      setSleepTimeLeft(prev => typeof prev === 'number' ? prev - 1 : prev);
    }, 60000);
    return () => clearTimeout(sleepTimerRef.current);
  }, [sleepTimeLeft]);

  const togglePlayPause = () => setIsPlaying(prev => !prev);

  const handleSeekProgress = (newTime) => {
    cleanupFadingAudio();
    setTrackProgress(newTime);

    if (Capacitor.isNativePlatform()) {
      mediaRef.current?.seekTo(newTime * 1000);
      const dur = typeof mediaRef.current?.getDuration === 'function' ? mediaRef.current.getDuration() : 0;
      if (dur > 0) {
        const rate = parseFloat(playbackSpeed) || 1.0;
        MediaSession.setPositionState({ duration: dur, playbackRate: rate, position: newTime }).catch(() => {});
      }
      return;
    }

    if (!audioRef.current) return;
    audioRef.current.currentTime = newTime;
  };

  // 🎛️ Actively apply playback speed to audio engines
  useEffect(() => {
    applyAudioEffectsToElement(audioRef.current, { speed: playbackSpeed });
    if (mediaRef.current && playbackSpeed !== '1.0x') {
      applyAudioEffectsToNative(mediaRef.current, { speed: playbackSpeed });
    }
  }, [playbackSpeed, currentTrack, isPlaying]);

  const handleTrackSelection = async (track, customQueue = null, resetBag = true) => {
    if (!track) return;
    cleanupFadingAudio();

    // 🛡️ Strict Offline Only Mode enforcement
    if (offlineOnlyMode && !isTrackCachedOffline(track.id)) {
      showToast("Offline Mode Active — track is not cached on device", "info", "fa-cloud-slash");
      triggerHaptic(40);
      return;
    }
    triggerHaptic(20);

    const newQueue = customQueue?.length ? customQueue : songs;
    setCurrentQueue(newQueue);
    
    if (currentTrack && currentTrack.id !== track.id) {
      playHistoryRef.current.push(currentTrack);
      if (playHistoryRef.current.length > 50) playHistoryRef.current.shift();
    }
    
    setCurrentTrack(track);
    setIsPlaying(true);
    recordRecentlyPlayed(track);

    if (resetBag) {
      const remainingIds = newQueue.filter(t => t.id !== track.id).map(t => t.id);
      shuffleBagRef.current = shuffleArray(remainingIds);
    }

    if (user && isOnline) {
      try {
        const userStatusRef = doc(db, 'users', user.uid);
        await setDoc(userStatusRef, { lastPlayedTrackId: track.id }, { merge: true });
      } catch (err) {
        console.warn('User profile sync initializing...');
      }
    }
  };

  const handleLogin = async () => {
    setLoading(true);
    try {
      if (Capacitor.isNativePlatform()) {
        const result = await FirebaseAuthentication.signInWithGoogle();
        const credential = GoogleAuthProvider.credential(result.credential?.idToken);
        const { user: u } = await signInWithCredential(auth, credential);
        setUser(u);
      } else {
        const result = await signInWithPopup(auth, provider);
        if (result?.user) setUser(result.user);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncAccountData = async () => {
    if (!user?.uid) return;
    setIsSyncingAccount(true);
    try {
      // 1. Flush local likes, recently played, and current track to Firestore
      const userStatusRef = doc(db, 'users', user.uid);
      await setDoc(userStatusRef, {
        likedSongIds: likedSongIds || [],
        recentlyPlayed: recentlyPlayedEntries || [],
        lastPlayedTrackId: currentTrack?.id || null,
        syncedAt: new Date().toISOString()
      }, { merge: true });

      // 2. Fetch fresh document from Firestore and sync state
      const snap = await getDoc(userStatusRef);
      if (snap.exists()) {
        const data = snap.data();
        if (data.likedSongIds) setLikedSongIds(data.likedSongIds);
        if (data.recentlyPlayed) setRecentlyPlayedEntries(data.recentlyPlayed);
      }
      showToast("Account data synced with cloud!", "success", "fa-cloud-arrow-up");
    } catch (err) {
      console.error("Account sync error:", err);
      showToast("Account sync failed", "error", "fa-triangle-exclamation");
    } finally {
      setIsSyncingAccount(false);
    }
  };

  const handleLogout = async () => {
    // 1. Explicitly stop HTML5 Audio if playing
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.src = '';
      } catch (_) {}
    }

    // 2. Explicitly stop and release Native Cordova/Capacitor Audio if playing
    if (mediaRef.current) {
      try { mediaRef.current.stop(); } catch (_) {}
      try { mediaRef.current.release(); } catch (_) {}
      mediaRef.current = null;
    }

    // 3. Reset Android MediaSession and disable background mode
    if (Capacitor.isNativePlatform()) {
      try { await MediaSession.setPlaybackState({ playbackState: 'paused' }); } catch (_) {}
      try { await BackgroundMode.disable(); } catch (_) {}
    }

    // 4. Reset playback state immediately
    setIsPlaying(false);
    setCurrentTrack(null);
    setTrackProgress(0);
    setTrackDuration(0);
    setShowFullPlayer(false);
    initialTrackAppliedRef.current = false;

    // 5. Sync this account's latest data to Firestore before signing out
    if (user?.uid) {
      try {
        const userStatusRef = doc(db, 'users', user.uid);
        await setDoc(userStatusRef, {
          likedSongIds: likedSongIds || [],
          recentlyPlayed: recentlyPlayedEntries || [],
          lastPlayedTrackId: currentTrack?.id || null,
          syncedAt: new Date().toISOString()
        }, { merge: true });
      } catch (err) {
        console.warn('Sync on logout failed:', err);
      }
    }

    // 6. Clear this account's synced data from local state immediately so it
    // doesn't flash on screen if a different account signs in on this device.
    setLikedSongIds([]);
    setRecentlyPlayedEntries([]);
    setPlaylists([]);
    setPlaylistSongs([]);

    // 7. Close all drawers, overlays, and modals
    setShowProfile(false);
    setShowNotifications(false);
    setShowDownloads(false);
    setShowSettings(false);
    setShowUploadSong(false);
    setShowManageAlbums(false);
    setShowManageArtists(false);
    setShowManageLyrics(false);
    setShowManageGenres(false);
    setShowManageSongs(false);
    setShowManageCanvas(false);
    setShowAboutModal(false);
    setShowQueueModal(false);

    // 8. Sign out from Firebase
    if (Capacitor.isNativePlatform()) await FirebaseAuthentication.signOut();
    await signOut(auth);
  };

  const createPlaylist = async (name, initialSongs = []) => {
    if (!name.trim()) return;
    try {
      const docRef = await addDoc(collection(db, 'playlists'), {
        playlistName: name.trim(),
        uid: user.uid,
        user: user.displayName || 'User',
        email: user.email,
        createdAt: new Date().toISOString(),
      });
      if (Array.isArray(initialSongs) && initialSongs.length > 0) {
        for (let i = 0; i < initialSongs.length; i++) {
          const song = initialSongs[i];
          const songId = song.title || song.name;
          if (songId) {
            await addDoc(collection(db, 'playlistSongs'), {
              playlistId: docRef.id,
              songId,
              orderPosition: i
            });
          }
        }
      }
      showToast(
        `Playlist "${name.trim()}" created${initialSongs.length > 0 ? ` with ${initialSongs.length} track${initialSongs.length > 1 ? 's' : ''}` : ''}!`,
        'success',
        'fa-folder-plus'
      );
    } catch (err) { 
      console.error(err);
      showToast('Failed to create playlist', 'error', 'fa-circle-xmark');
    }
  };

  const renamePlaylist = async (playlistId, newName) => {
    if (!newName?.trim()) return;
    try {
      await updateDoc(doc(db, 'playlists', playlistId), {
        playlistName: newName.trim(),
        updatedAt: new Date().toISOString(),
      });
      showToast(`Playlist renamed to "${newName.trim()}"`, 'success', 'fa-pen-to-square');
    } catch (err) {
      console.error(err);
      showToast('Failed to rename playlist', 'error', 'fa-circle-xmark');
    }
  };

  const deletePlaylist = async (playlistId) => {
    try {
      await deleteDoc(doc(db, 'playlists', playlistId));
      for (const m of playlistSongs.filter(m => m.playlistId === playlistId)) {
        await deleteDoc(doc(db, 'playlistSongs', m.id));
      }
      showToast('Playlist deleted', 'info', 'fa-trash-can');
    } catch (err) { console.error(err); }
  };

  const addSongToPlaylist = async (playlistId, song) => {
    const songId = song.title || song.name;
    if (!songId) return;
    if (playlistSongs.find(m => m.playlistId === playlistId && m.songId === songId)) {
      showToast('Song already in this playlist', 'info', 'fa-circle-info');
      return;
    }
    try {
      await addDoc(collection(db, 'playlistSongs'), { playlistId, songId });
      showToast('Added to playlist!', 'success', 'fa-circle-check');
    } catch (err) { 
      console.error(err);
      showToast('Failed to add to playlist', 'error', 'fa-circle-xmark');
    }
  };

  const removeSongFromPlaylist = async (playlistId, song) => {
    const songId = song.title || song.name;
    const match = playlistSongs.find(m => m.playlistId === playlistId && m.songId === songId);
    if (!match) return;
    try {
      await deleteDoc(doc(db, 'playlistSongs', match.id));
      showToast('Removed from playlist', 'info', 'fa-trash-can');
    } catch (err) { console.error(err); }
  };

  const handleGoToAlbum = (track) => {
    if (!track?.albumId) {
      showToast("This track isn't linked to an album.", "info", "fa-circle-info");
      return;
    }
    const album = albums.find(a => a.id === track.albumId);
    if (!album) {
      showToast("Album details couldn't be found.", "error", "fa-circle-xmark");
      return;
    }
    openDetailView({ album });
    setShowFullPlayer(false);
  };

  const handleGoToArtist = (track) => {
    if (!track?.artist && typeof track !== 'string') {
      showToast("This track isn't linked to an artist.", "info", "fa-circle-info");
      return;
    }
    const artistName = typeof track === 'string' ? track : track.artist;
    const credits = splitArtistCredits(artistName).map(c => c.toLowerCase());
    const artist = artists.find(a => credits.includes((a.name || '').toLowerCase()) || (a.name || '').toLowerCase() === artistName.toLowerCase());
    if (!artist) {
      const partial = artists.find(a => artistName.toLowerCase().includes((a.name || '').toLowerCase()));
      if (partial) {
        openDetailView({ artist: partial });
        setShowFullPlayer(false);
        return;
      }
      showToast("Artist profile couldn't be found.", "error", "fa-circle-xmark");
      return;
    }
    openDetailView({ artist });
    setShowFullPlayer(false);
  };

  const handlePlayNext = (trackOrTracks) => {
    if (!trackOrTracks) return;
    const items = Array.isArray(trackOrTracks) ? trackOrTracks : [trackOrTracks];
    if (items.length === 0) return;
    setCurrentQueue((prev) => {
      const idx = prev.findIndex(t => t.id === currentTrack?.id);
      if (idx !== -1) {
        const next = [...prev];
        next.splice(idx + 1, 0, ...items);
        return next;
      }
      return [...items, ...prev];
    });
    showToast(
      items.length === 1 
        ? `Playing next: ${items[0].title || items[0].name}` 
        : `Playing next: ${items.length} tracks`,
      'info',
      'fa-forward-step'
    );
  };

  const handleAddToQueue = (trackOrTracks) => {
    if (!trackOrTracks) return;
    const items = Array.isArray(trackOrTracks) ? trackOrTracks : [trackOrTracks];
    if (items.length === 0) return;
    setCurrentQueue((prev) => [...prev, ...items]);
    showToast(
      items.length === 1 
        ? `Added to queue: ${items[0].title || items[0].name}` 
        : `Added ${items.length} tracks to queue`,
      'success',
      'fa-layer-group'
    );
  };

  const handleOpenSongMenu = (song, playlistId = null) => {
    setActionSheetSong(song);
    setActionSheetPlaylistId(playlistId);
  };

  const handleUpdateProfile = async (updates) => {
    if (!auth.currentUser) throw new Error("No signed-in user.");
    await updateProfile(auth.currentUser, updates);
    await auth.currentUser.reload();
    setUser({ ...auth.currentUser });
    showToast("Profile updated successfully!", "success", "fa-circle-check");
  };

  if (!authResolved && !user) {
    return <div style={{ position: 'fixed', inset: 0, backgroundColor: '#060c18' }}></div>;
  }

  if (!user) {
    return (
      <div className="login-screen-wrapper">
        <div className="login-content">
          <img src={logo} className="login-branded-logo" alt="Sonara" />
          <h1 className="login-title">Sonara</h1>
          <p className="login-subtitle">Music for your mood. Discover, stream, and curate your ultimate vibe.</p>
          <button className="login-google-btn" onClick={handleLogin}>Continue with Google</button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`mobile-container theme-mode-${currentTheme.type} ${increaseContrast ? 'high-contrast-mode' : ''} ${!motionEnabled ? 'disable-animations' : ''}`}
      style={{
        '--accent': currentTheme.accent,
        '--app-bg': currentTheme.appBg,
        '--bg-dark': currentTheme.bgDark,
        '--bg-surface': currentTheme.bgSurface,
        '--text-main': currentTheme.textMain,
        '--text-muted': currentTheme.textMuted,
        '--nav-bg': currentTheme.navBg,
        '--mini-player-bg': currentTheme.miniPlayerBg,
        '--header-bg': currentTheme.headerBg,
        '--card-bg': currentTheme.cardBg,
        '--border-subtle': currentTheme.borderSubtle
      }}
    >
      <UpdateAvailableBanner
        updateInfo={dismissedUpdateVersion === updateInfo?.version ? null : updateInfo}
        currentVersion={CURRENT_APP_VERSION}
        onDismiss={handleDismissUpdateBanner}
      />
      {/* 🍞 In-App UI Feedback Toast Notification */}
      {toast && (
        <div
          style={{
            position: 'absolute',
            top: '74px',
            left: '20px',
            right: '20px',
            zIndex: 9999,
            backgroundColor: toast.type === 'error' ? '#2d1416' : toast.type === 'info' ? '#141d2d' : '#0d2218',
            border: `1px solid ${toast.type === 'error' ? '#ff4d4d' : toast.type === 'info' ? '#3b82f6' : 'var(--accent)'}`,
            borderRadius: '16px',
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.65)',
            animation: 'slideDownToast 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          <i
            className={`fa-solid ${toast.icon || (toast.type === 'error' ? 'fa-circle-xmark' : toast.type === 'info' ? 'fa-circle-info' : 'fa-circle-check')}`}
            style={{
              fontSize: '1.15rem',
              color: toast.type === 'error' ? '#ff4d4d' : toast.type === 'info' ? '#60a5fa' : 'var(--accent)'
            }}
          ></i>
          <span style={{ fontSize: '0.86rem', fontWeight: '600', color: '#ffffff', flex: 1 }}>
            {toast.message}
          </span>
        </div>
      )}

      <Header 
        user={user} 
        onOpenProfile={() => {
          setShowProfile(true);
          try { window.history.pushState({ sonaraNav: true }, ''); } catch (_) {}
        }} 
        onOpenNotifications={() => {
          setShowNotifications(true);
          try { window.history.pushState({ sonaraNav: true }, ''); } catch (_) {}
        }} 
        onOpenDownloads={() => {
          setShowDownloads(true);
          try { window.history.pushState({ sonaraNav: true }, ''); } catch (_) {}
        }}
        hasUnreadNotifications={hasUnreadNotifications}
        onViewChange={handleTabChange} 
      />

      {!isOnline && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          backgroundColor: '#3a1414', color: '#ff8f8f', fontSize: '0.78rem', fontWeight: '600',
          padding: '8px 12px', textAlign: 'center', flexShrink: 0
        }}>
          <i className="fa-solid fa-wifi" style={{ position: 'relative' }}></i>
          No internet connection — showing downloaded content only
        </div>
      )}

      {/* 🌟 Top-Level Detail View Layer (Album, Artist, Genre) */}
      {(selectedAlbum || selectedArtist || selectedGenre) ? (
        <main className="mobile-content" style={{ padding: 0 }}>
          {selectedAlbum ? (
            <AlbumDetailsView
              album={selectedAlbum}
              songs={songs}
              artists={artists}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              isShuffle={isShuffle}
              onToggleShuffle={toggleShuffle}
              onTogglePlay={togglePlayPause}
              onSelectTrack={handleTrackSelection}
              onSelectArtist={(artist) => openDetailView({ artist })}
              onOpenSongMenu={handleOpenSongMenu}
              onAddToQueue={handleAddToQueue}
              onPlayNext={handlePlayNext}
              playlists={playlists}
              onAddSongToPlaylist={addSongToPlaylist}
              onBack={handleAppBack}
            />
          ) : selectedArtist ? (
            <ArtistDetailsView
              artist={selectedArtist}
              songs={songs}
              artists={artists}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              isShuffle={isShuffle}
              onToggleShuffle={toggleShuffle}
              onTogglePlay={togglePlayPause}
              onSelectTrack={handleTrackSelection}
              onSelectArtist={(artist) => openDetailView({ artist })}
              likedSongIds={likedSongIds}
              onToggleLike={toggleLikeSong}
              onOpenSongMenu={handleOpenSongMenu}
              onBack={handleAppBack}
            />
          ) : selectedGenre ? (
            <GenreDetailsView
              genreName={selectedGenre}
              songs={songs}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              likedSongIds={likedSongIds}
              onToggleLike={toggleLikeSong}
              onSelectTrack={handleTrackSelection}
              onOpenSongMenu={handleOpenSongMenu}
              onBack={handleAppBack}
            />
          ) : null}
        </main>
      ) : (
        <>
          {currentView === 'home' && (
            <main className="mobile-content">
              {!isOnline ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', textAlign: 'center', padding: '0 24px' }}>
                  <i className="fa-solid fa-wifi" style={{ fontSize: '2.4rem', color: 'var(--text-muted)', marginBottom: '16px' }}></i>
                  <h3 style={{ color: '#ffffff', margin: '0 0 8px 0' }}>No Internet Available</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
                    Home needs a connection to load new content. Check your Library's Downloaded tab to play music offline.
                  </p>
                </div>
              ) : (
                <>
                  {/* 🌟 Dynamic Greeting Header */}
                  <div className="home-greeting-container">
                    <div className="home-greeting-subtitle">
                      <i className="fa-solid fa-wand-magic-sparkles"></i> Welcome to Sonara
                    </div>
                    <h1 className="home-greeting-title">
                      {greetingText}{user?.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}
                    </h1>
                  </div>

                  {/* 🌟 Quick Filter Chips */}
                  <div className="quick-filters-scroll">
                    {[
                      { id: 'All', label: 'All', icon: 'fa-globe' },
                      { id: 'Trending', label: 'Trending', icon: 'fa-arrow-trend-up' },
                      { id: 'Melody', label: 'Melody', icon: 'fa-headphones' },
                      { id: 'Party', label: 'Party', icon: 'fa-champagne-glasses' },
                      { id: 'Kollywood', label: 'Kollywood', icon: 'fa-fire' },
                      { id: 'Chill', label: 'Chill', icon: 'fa-mug-hot' },
                      { id: 'Devotional', label: 'Devotional', icon: 'fa-hands-praying' },
                      { id: 'Love', label: 'Love', icon: 'fa-heart' }
                    ].map((chip) => (
                      <button
                        key={chip.id}
                        onClick={() => {
                          if (chip.id === 'All') {
                            setHomeFilter('All');
                          } else if (chip.id === 'Trending') {
                            setHomeFilter(homeFilter === 'Trending' ? 'All' : 'Trending');
                          } else {
                            openDetailView({ genre: chip.id });
                          }
                        }}
                        className={`quick-filter-chip ${homeFilter === chip.id ? 'active' : ''}`}
                      >
                        <i className={`fa-solid ${chip.icon}`}></i>
                        {chip.label}
                      </button>
                    ))}
                  </div>

              {/* 🌟 Recently Played Row */}
              {recentlyPlayed.length > 0 && (
                <section className="content-section" style={{ marginBottom: '22px' }}>
                  <div className="section-header-container">
                    <h2>Recently Played</h2>
                    <button
                      onClick={() => handleTrackSelection(recentlyPlayed[0], recentlyPlayed)}
                      style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '0.82rem', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
                    >
                      <i className="fa-solid fa-play" style={{ fontSize: '0.72rem' }}></i> Play All
                    </button>
                  </div>
                  <div className="horizontal-scroll">
                    {recentlyPlayed.map((song, idx) => {
                      const songImg = song.cover || song.image || song.imageUrl || song.coverUrl;
                      const songTitle = song.title || song.name || 'Untitled';
                      const isLiked = likedSongIds.includes(song.id || songTitle);
                      return (
                        <div
                          key={`${song.id || idx}-recent`}
                          className="song-card"
                          onClick={() => handleTrackSelection(song, songs)}
                          style={{ cursor: 'pointer', position: 'relative' }}
                        >
                          <div className="img-container" style={{ position: 'relative' }}>
                            <CachedImage src={songImg || 'https://placehold.co/150x150/0b111e/1db954.png'} alt={songTitle} />
                            <button
                              onClick={(e) => toggleLikeSong(song, e)}
                              style={{
                                position: 'absolute',
                                bottom: '8px',
                                right: '8px',
                                background: 'rgba(0,0,0,0.65)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '50%',
                                width: '30px',
                                height: '30px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                color: isLiked ? 'var(--accent)' : '#fff'
                              }}
                            >
                              <i className={`fa-${isLiked ? 'solid' : 'regular'} fa-heart`} style={{ fontSize: '0.9rem' }}></i>
                            </button>
                          </div>
                          <h3>{songTitle}</h3>
                          <p>{song.artist || 'Unknown'}</p>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* 🌟 Upgraded Moods & Genres Mesh Cards */}
              <section className="content-section" style={{ marginBottom: '26px' }}>
                <div className="section-header-container">
                  <h2>Moods & Genres</h2>
                </div>
                <div className="horizontal-scroll">
                  {[
                    { name: 'Kollywood', bg: 'linear-gradient(135deg, #f43f5e 0%, #be123c 60%, #881337 100%)', icon: 'fa-fire', tag: 'Trending' },
                    { name: 'Melody', bg: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 60%, #1e3a8a 100%)', icon: 'fa-headphones', tag: 'Vibe' },
                    { name: 'Party', bg: 'linear-gradient(135deg, #c084fc 0%, #9333ea 60%, #581c87 100%)', icon: 'fa-champagne-glasses', tag: 'Dance' },
                    { name: 'Chill', bg: 'linear-gradient(135deg, #34d399 0%, #059669 60%, #064e3b 100%)', icon: 'fa-mug-hot', tag: 'Relax' },
                    { name: 'Love', bg: 'linear-gradient(135deg, #fb7185 0%, #e11d48 60%, #9f1239 100%)', icon: 'fa-heart', tag: 'Romance' },
                    { name: 'Devotional', bg: 'linear-gradient(135deg, #fbbf24 0%, #d97706 60%, #78350f 100%)', icon: 'fa-hands-praying', tag: 'Peace' },
                    { name: 'Hip Hop', bg: 'linear-gradient(135deg, #f472b6 0%, #db2777 60%, #831843 100%)', icon: 'fa-bolt', tag: 'Beats' },
                    { name: 'Classical', bg: 'linear-gradient(135deg, #818cf8 0%, #4f46e5 60%, #312e81 100%)', icon: 'fa-music', tag: 'Acoustic' },
                    { name: 'Folk', bg: 'linear-gradient(135deg, #2dd4bf 0%, #0d9488 60%, #134e4a 100%)', icon: 'fa-guitar', tag: 'Tradition' },
                    { name: 'Break Heart', bg: 'linear-gradient(135deg, #94a3b8 0%, #475569 60%, #1e293b 100%)', icon: 'fa-heart-crack', tag: 'Sad' }
                  ].map((genre) => (
                    <div
                      key={genre.name}
                      onClick={() => openDetailView({ genre: genre.name })}
                      className="genre-mesh-card"
                      style={{ background: genre.bg }}
                    >
                      <i className={`fa-solid ${genre.icon} genre-mesh-card-icon`}></i>
                      <span className="genre-mesh-badge">{genre.tag}</span>
                      <span className="genre-mesh-title">{genre.name}</span>
                    </div>
                  ))}
                </div>
              </section>

              <SongRow
                title={homeFilter === 'Trending' ? "Trending Hits" : "Popular Songs"}
                songs={songs}
                likedSongIds={likedSongIds}
                onToggleLike={toggleLikeSong}
                onSelectTrack={(track) => handleTrackSelection(track, songs)}
                onSeeAll={() => {
                  tabHistoryRef.current.push(currentView);
                  setCurrentView('all-songs');
                  try { window.history.pushState({ sonaraNav: true }, ''); } catch (_) {}
                }}
              />

              <section className="content-section" style={{ marginBottom: '24px' }}>
                <div className="section-header-container">
                  <h2>Popular Albums</h2>
                  <button
                    className="see-all-action-btn"
                    onClick={() => {
                      tabHistoryRef.current.push(currentView);
                      setCurrentView('all-albums');
                      try { window.history.pushState({ sonaraNav: true }, ''); } catch (_) {}
                    }}
                  >
                    See all
                  </button>
                </div>
                <div className="horizontal-scroll">
                  {albums.length > 0 ? (
                    albums.map((album) => (
                      <div 
                        key={album.id} 
                        className="song-card" 
                        onClick={() => openDetailView({ album })}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="img-container">
                          <CachedImage src={album.image} alt={album.name} />
                        </div>
                        <h3>{album.name}</h3>
                        <p>{album.artist}</p>
                      </div>
                    ))
                  ) : (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '10px 0' }}>No albums loaded.</p>
                  )}
                </div>
              </section>

              <ArtistRow
                title="Popular Artists"
                artists={artists}
                onSelectArtist={(artist) => openDetailView({ artist })}
                onSeeAll={() => {
                  tabHistoryRef.current.push(currentView);
                  setCurrentView('all-artists');
                  try { window.history.pushState({ sonaraNav: true }, ''); } catch (_) {}
                }}
              />
            </>
          )}
        </main>
      )}

      {currentView === 'all-songs' && (
        <AllSongsView
          songs={songs}
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          likedSongIds={likedSongIds}
          onToggleLike={toggleLikeSong}
          onSelectTrack={(track) => handleTrackSelection(track, songs)}
          onOpenSongMenu={handleOpenSongMenu}
          onBack={handleAppBack}
        />
      )}

      {currentView === 'all-albums' && (
        <AllAlbumsView
          albums={albums}
          onSelectAlbum={(album) => openDetailView({ album })}
          onBack={handleAppBack}
        />
      )}

      {currentView === 'all-artists' && (
        <AllArtistsView
          artists={artists}
          onSelectArtist={(artist) => openDetailView({ artist })}
          onBack={handleAppBack}
        />
      )}

      {currentView === 'search' && (
        !isOnline ? (
          <div className="mobile-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', textAlign: 'center', padding: '0 24px' }}>
            <i className="fa-solid fa-wifi" style={{ fontSize: '2.4rem', color: 'var(--text-muted)', marginBottom: '16px' }}></i>
            <h3 style={{ color: '#ffffff', margin: '0 0 8px 0' }}>No Internet Available</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
              Search needs a connection to look up your catalog. Check your Library's Downloaded tab to play music offline.
            </p>
          </div>
        ) : (
          <SearchView
            songs={songs}
            playlists={playlists}
            playlistSongs={playlistSongs}
            albums={albums} 
            artists={artists}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            likedSongIds={likedSongIds}
            onToggleLike={toggleLikeSong}
            onSelectTrack={(track) => handleTrackSelection(track, songs)}
            onSelectAlbum={(album) => openDetailView({ album })}
            onSelectArtist={(artist) => openDetailView({ artist })}
            onAddSongToPlaylist={addSongToPlaylist}
            onOpenSongMenu={handleOpenSongMenu}
          />
        )
      )}

      {currentView === 'library' && (
        <LibraryView
          songs={songs}
          artists={artists}
          albums={albums}
          playlists={playlists}
          playlistSongs={playlistSongs}
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          isShuffle={isShuffle}
          onToggleShuffle={toggleShuffle}
          onTogglePlay={togglePlayPause}
          onSelectTrack={handleTrackSelection}
          onCreatePlaylist={createPlaylist}
          onDeletePlaylist={deletePlaylist}
          onRemoveSong={removeSongFromPlaylist}
          onAddSongToPlaylist={addSongToPlaylist}
          onRenamePlaylist={renamePlaylist}
          onOpenSongMenu={handleOpenSongMenu}
          onSelectArtist={(artist) => openDetailView({ artist })}
          onSelectAlbum={(album) => openDetailView({ album })}
          activeTab={libraryActiveTab}
          onActiveTabChange={setLibraryActiveTab}
          selectedPlaylist={selectedPlaylist}
          onSelectPlaylist={(p) => {
            if (typeof p === 'function') {
              setSelectedPlaylist(p);
            } else if (p) {
              openDetailView({ playlist: p });
            } else {
              handleAppBack();
            }
          }}
          isOffline={!isOnline}
        />
      )}
        </>
      )}





      {/* 🌟 Mini Player with Swipe Gestures */}
      <div
        onTouchStart={(e) => {
          window._touchStartX = e.touches[0].clientX;
          window._touchStartY = e.touches[0].clientY;
        }}
        onTouchEnd={(e) => {
          if (!window._touchStartX || !window._touchStartY) return;
          const diffX = e.changedTouches[0].clientX - window._touchStartX;
          const diffY = e.changedTouches[0].clientY - window._touchStartY;
          if (Math.abs(diffX) > Math.abs(diffY)) {
            if (diffX > 50) triggerPrevTrackLogic();
            else if (diffX < -50) triggerNextTrackLogic();
          } else {
            if (diffY > 50) setCurrentTrack(null);
          }
          window._touchStartX = null;
          window._touchStartY = null;
        }}
      >
        <MiniPlayer
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          trackProgress={trackProgress}
          trackDuration={trackDuration}
          audioRoute={audioRoute}
          likedSongIds={likedSongIds}
          onToggleLike={toggleLikeSong}
          onTogglePlay={togglePlayPause}
          onNext={triggerNextTrackLogic}
          onPrev={triggerPrevTrackLogic}
          onExpand={() => setShowFullPlayer(true)}
        />
      </div>

      {/* 🌟 Queue View Modal */}
      {showQueueModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 9999,
          display: 'flex', flexDirection: 'column', padding: '24px 20px',
          boxSizing: 'border-box', animation: 'slideUpSheet 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ color: '#fff', margin: 0, fontSize: '1.25rem' }}>Up Next / Queue</h2>
            <button onClick={handleAppBack} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer' }}>
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {(currentQueue.length > 0 ? currentQueue : songs).map((track, i) => {
              const isCurrent = currentTrack?.id === track.id;
              const img = track.cover || track.image || track.imageUrl || track.coverUrl;
              return (
                <div
                  key={`${track.id || i}-queue`}
                  onClick={() => handleTrackSelection(track, currentQueue)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '10px', borderRadius: '12px',
                    backgroundColor: isCurrent ? 'rgba(29, 185, 84, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                    border: isCurrent ? '1px solid var(--accent)' : '1px solid rgba(255, 255, 255, 0.06)',
                    cursor: 'pointer'
                  }}
                >
                  <CachedImage src={img || 'https://placehold.co/100x100/0b111e/1db954.png'} alt="" style={{ width: '42px', height: '42px', borderRadius: '8px', objectFit: 'cover' }} />
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <p style={{ margin: '0 0 2px 0', fontSize: '0.9rem', color: isCurrent ? 'var(--accent)' : '#fff', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {track.title || track.name}
                    </p>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {track.artist || 'Unknown'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showFullPlayer && (
        <FullPlayerView
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          playlists={playlists}
          lyrics={lyrics}
          isShuffle={isShuffle}
          isRepeat={isRepeat}
          sleepTimeLeft={sleepTimeLeft}
          trackProgress={trackProgress}
          trackDuration={trackDuration}
          lyricsSize={lyricsSize}
          audioRoute={audioRoute}
          streamingQuality={streamingQuality}
          downloadQuality={downloadQuality}
          dolbyAtmos={dolbyAtmos}
          spatialAudio={spatialAudio}
          isLiked={Boolean(currentTrack && likedSongIds.includes(currentTrack.id))}
          onToggleLike={(e) => toggleLikeSong(currentTrack, e)}
          onTogglePlay={togglePlayPause}
          onNext={triggerNextTrackLogic}
          onPrev={triggerPrevTrackLogic}
          onSeekProgress={handleSeekProgress}
          onToggleShuffle={toggleShuffle}
          onToggleRepeat={() => setIsRepeat(!isRepeat)}
          onSetSleepTimer={setSleepTimeLeft}
          onAddSongToPlaylist={addSongToPlaylist}
          onGoToAlbum={handleGoToAlbum}
          onGoToArtist={handleGoToArtist}
          onOpenQueue={() => setShowQueueModal(true)}
          onClose={handleAppBack}
        />
      )}

      {showProfile && (
        <ProfileDrawerView
          user={user}
          artists={artists}
          playlists={playlists}
          currentVersion={CURRENT_APP_VERSION}
          updateInfo={updateInfo}
          onLogout={handleLogout}
          onSyncAccount={handleSyncAccountData}
          isSyncingAccount={isSyncingAccount}
          onNavigateSettings={() => setShowSettings(true)}
          onOpenDownloads={() => setShowDownloads(true)}
          onGoToSavedArtists={() => {
            setLibraryActiveTab('artists');
            setCurrentView('library');
            setShowProfile(false);
          }}
          onOpenUploadSong={() => setShowUploadSong(true)}
          onOpenManageAlbums={() => setShowManageAlbums(true)}
          onOpenManageArtists={() => setShowManageArtists(true)}
          onOpenManageLyrics={() => setShowManageLyrics(true)}
          onOpenManageGenres={() => setShowManageGenres(true)}
          onOpenManageSongs={() => setShowManageSongs(true)}
          onOpenManageCanvas={() => setShowManageCanvas(true)}
          onUpdateProfile={handleUpdateProfile}
          showAboutModal={showAboutModal}
          setShowAboutModal={setShowAboutModal}
          onClose={handleAppBack}
        />
      )}

      {showNotifications && (
        <NotificationCenter
          songs={songs}
          albums={albums}
          artists={artists}
          updateInfo={updateInfo}
          onSelectTrack={handleTrackSelection}
          onNotificationsRead={() => updateUnreadNotificationStatus(songs)}
          onNavigateHome={() => {
            setCurrentView('home');
            setShowNotifications(false);
          }}
          onClose={handleAppBack}
        />
      )}

      {showDownloads && (
        <DownloadCenterView
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          downloadQuality={downloadQuality}
          onSelectTrack={handleTrackSelection}
          onTogglePlay={togglePlayPause}
          onOpenSettings={() => {
            setShowDownloads(false);
            setShowSettings(true);
          }}
          onClose={handleAppBack}
        />
      )}

      {showSettings && (
        <div 
          className="settings-view-wrapper set-hide-scrollbar"
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'var(--bg-dark, #05070c)', zIndex: 700, overflowY: 'auto',
            scrollbarWidth: 'none', msOverflowStyle: 'none',
            boxSizing: 'border-box',
            animation: 'slideUpSheet 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          <SettingsView
            contentRestrictions={contentRestrictions}
            setContentRestrictions={setContentRestrictions}
            appTheme={appTheme}
            setAppTheme={setAppTheme}
            themeId={themeId}
            onSelectTheme={handleSelectTheme}
            motionEnabled={motionEnabled}
            setMotionEnabled={setMotionEnabled}
            lyricsSize={lyricsSize}
            setLyricsSize={setLyricsSize}
            increaseContrast={increaseContrast}
            setIncreaseContrast={setIncreaseContrast}
            automaticallySendDiagnostics={automaticallySendDiagnostics}
            setAutomaticallySendDiagnostics={setAutomaticallySendDiagnostics}
            crossfadeEnabled={crossfadeEnabled}
            setCrossfadeEnabled={setCrossfadeEnabled}
            crossfadeDuration={crossfadeDuration}
            setCrossfadeDuration={setCrossfadeDuration}
            gaplessPlayback={gaplessPlayback}
            setGaplessPlayback={setGaplessPlayback}
            automixEnabled={automixEnabled}
            setAutomixEnabled={setAutomixEnabled}
            dolbyAtmos={dolbyAtmos}
            setDolbyAtmos={setDolbyAtmos}
            playbackSpeed={playbackSpeed}
            setPlaybackSpeed={setPlaybackSpeed}
            normalizeVolume={normalizeVolume}
            setNormalizeVolume={setNormalizeVolume}
            offlineOnlyMode={offlineOnlyMode}
            setOfflineOnlyMode={setOfflineOnlyMode}
            autoplayInfinite={autoplayInfinite}
            setAutoplayInfinite={setAutoplayInfinite}
            spatialAudio={spatialAudio}
            setSpatialAudio={setSpatialAudio}
            hapticsEnabled={hapticsEnabled}
            setHapticsEnabled={setHapticsEnabled}
            eqPreset={eqPreset}
            setEqPreset={setEqPreset}
            sleepTimeLeft={sleepTimeLeft}
            onSetSleepTimer={setSleepTimeLeft}
            streamingQuality={streamingQuality}
            setStreamingQuality={setStreamingQualityVal}
            downloadQuality={downloadQuality}
            setDownloadQuality={setDownloadQualityVal}
            originIslandActive={originIslandActive}
            setOriginIslandActive={setOriginIslandActive}
            currentVersion={CURRENT_APP_VERSION}
            songs={songs}
            onBack={handleAppBack}
          />
        </div>
      )}

      {showUploadSong && (
        <UploadSongView
          user={user}
          onBack={handleAppBack}
          onSongUploaded={(newSong) => setSongs((prev) => [newSong, ...prev])}
        />
      )}

      {showManageAlbums && (
        <ManageAlbumsView
          albums={albums}
          songs={songs}
          onBack={handleAppBack}
          onAlbumCreated={(newAlbum) => setAlbums((prev) => [newAlbum, ...prev])}
          onSongUpdated={(updatedSong) => {
            setSongs((prev) => prev.map(s => s.id === updatedSong.id ? updatedSong : s));
            setCurrentTrack((prev) => (prev && prev.id === updatedSong.id) ? { ...prev, ...updatedSong } : prev);
          }}
        />
      )}

      {showManageArtists && (
        <ManageArtistsView
          artists={artists}
          onBack={handleAppBack}
          onArtistCreated={(newArtist) => setArtists((prev) => [newArtist, ...prev])}
        />
      )}

      {showManageLyrics && (
        <ManageLyricsView
          songs={songs}
          lyrics={lyrics}
          onBack={handleAppBack}
          onLyricsSaved={(savedLyric) => {
            setLyrics((prev) => {
              const idx = prev.findIndex(l => l.id === savedLyric.id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = savedLyric;
                return next;
              }
              return [...prev, savedLyric];
            });
          }}
        />
      )}

      {showManageGenres && (
        <ManageGenresView
          songs={songs}
          onBack={handleAppBack}
          onGenreSaved={(updatedSong) => {
            setSongs((prev) => prev.map(s => s.id === updatedSong.id ? updatedSong : s));
            setCurrentTrack((prev) => (prev && prev.id === updatedSong.id) ? { ...prev, ...updatedSong } : prev);
          }}
        />
      )}

      {showManageSongs && (
        <ManageSongsAdminView
          songs={songs}
          onBack={handleAppBack}
          onSongDeleted={(deletedId) => {
            setSongs((prev) => prev.filter(s => s.id !== deletedId));
          }}
        />
      )}

      {showManageCanvas && (
        <ManageCanvasVideosView
          songs={songs}
          onBack={handleAppBack}
          onSongUpdated={(updatedSong) => {
            setSongs((prev) => prev.map(s => s.id === updatedSong.id ? updatedSong : s));
            // Keep the currently-playing track in sync too, otherwise FullPlayerView
            // keeps holding the stale copy (without canvasVideoUrl) that was captured
            // when playback started, and the Canvas video never shows up there even
            // though the upload succeeded and `songs` was updated.
            setCurrentTrack((prev) => (prev && prev.id === updatedSong.id) ? { ...prev, ...updatedSong } : prev);
          }}
        />
      )}

      {actionSheetSong && (
        <SongActionSheet
          song={actionSheetSong}
          onClose={() => {
            setActionSheetSong(null);
            setActionSheetPlaylistId(null);
          }}
          onSelectTrack={(track) => handleTrackSelection(track, songs)}
          onPlayNext={handlePlayNext}
          onAddToQueue={handleAddToQueue}
          isLiked={likedSongIds.includes(actionSheetSong.id)}
          onToggleLike={toggleLikeSong}
          playlists={playlists}
          playlistSongs={playlistSongs}
          onAddToPlaylist={addSongToPlaylist}
          onGoToAlbum={handleGoToAlbum}
          onGoToArtist={handleGoToArtist}
          onRemoveFromPlaylist={removeSongFromPlaylist}
          currentPlaylistId={actionSheetPlaylistId}
        />
      )}

      <BottomNavigation currentView={currentView} onViewChange={handleTabChange} isOnline={isOnline} />
    </div>
  );
}