import React, { useState, useEffect, useRef } from 'react';
import { collection, doc, addDoc, deleteDoc, query, where, onSnapshot, getDocs, setDoc, getDoc } from 'firebase/firestore';
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
import { getPlaybackSource, isTrackCachedOffline, downloadTrackToDevice } from './utils/offlineStorage';
import { getStreamingQuality, appendQualityParam } from './utils/audioQuality';
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
import logo from './assets/logo3.png';
import './App.css';

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
const CURRENT_APP_VERSION = '1.2.1';

const shuffleArray = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
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

  const [currentView, setCurrentView] = useState('home');
  const [currentQueue, setCurrentQueue] = useState([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const wasOnlineRef = useRef(navigator.onLine);
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

  const [likedSongIds, setLikedSongIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('sonara_liked_songs') || '[]');
    } catch {
      return [];
    }
  });
  const [recentlyPlayed, setRecentlyPlayed] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('sonara_recently_played') || '[]');
    } catch {
      return [];
    }
  });
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

  const [increaseContrast, setIncreaseContrast] = useState(false);
  const [automaticallySendDiagnostics, setAutomaticallySendDiagnostics] = useState(true);

  const [contentRestrictions, setContentRestrictions] = useState(false);
  const [appTheme, setAppTheme] = useState('#1db954');
  const [motionEnabled, setMotionEnabled] = useState(true);
  const [lyricsSize, setLyricsSize] = useState('Normal');
  const [crossfadeEnabled, setCrossfadeEnabled] = useState(() => {
    try { return localStorage.getItem('sonara_crossfade') === 'true'; } catch { return false; }
  });

  const audioRef = useRef(null);
  const mediaRef = useRef(null);
  const loadedNativeTrackIdRef = useRef(null);
  const nativeProgressIntervalRef = useRef(null);
  const prefetchAudioRef = useRef(null);
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
      try {
        localStorage.setItem('sonara_liked_songs', JSON.stringify(updated));
      } catch (err) {
        console.warn('Failed to save liked songs:', err);
      }
      return updated;
    });
  };

  const recordRecentlyPlayed = (track) => {
    if (!track) return;
    setRecentlyPlayed((prev) => {
      const filtered = prev.filter(t => (t.id || t.title) !== (track.id || track.title));
      const updated = [track, ...filtered].slice(0, 20);
      try {
        localStorage.setItem('sonara_recently_played', JSON.stringify(updated));
      } catch (err) {
        console.warn('Failed to save recently played:', err);
      }
      return updated;
    });
  };

  useEffect(() => {
    if (songs.length === 0) return;
    setRecentlyPlayed(prev => {
      const filtered = prev.filter(item => songs.some(s => s.id === item.id));
      if (filtered.length !== prev.length) {
        try {
          localStorage.setItem('sonara_recently_played', JSON.stringify(filtered));
        } catch (err) {}
      }
      return filtered;
    });
  }, [songs]);

  useEffect(() => {
    const docRef = doc(db, 'settings', 'appVersion');
    const unsubAppVersion = onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.version && data.version !== CURRENT_APP_VERSION) {
            setUpdateInfo(data);
            setHasUnreadNotifications(true);
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

      const hasUpdateUnread = updateInfo && !clearedIds.includes('update_' + updateInfo.version) && !readIds.includes('update_' + updateInfo.version);

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
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: '#060c18' });
      } catch (err) {
        console.warn('Status bar overlay configuration failed:', err);
      }
    };

    configureStatusBar();
  }, []);

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

  const screenSnapshotRef = useRef({
    currentView, selectedAlbum, selectedArtist, selectedGenre, libraryActiveTab, selectedPlaylist
  });
  const navHistoryRef = useRef([]);
  const isBackNavigationRef = useRef(false);

  useEffect(() => {
    const nextSnapshot = { currentView, selectedAlbum, selectedArtist, selectedGenre, libraryActiveTab, selectedPlaylist };
    const prevSnapshot = screenSnapshotRef.current;

    const didChange =
      prevSnapshot.currentView !== nextSnapshot.currentView ||
      prevSnapshot.selectedAlbum !== nextSnapshot.selectedAlbum ||
      prevSnapshot.selectedArtist !== nextSnapshot.selectedArtist ||
      prevSnapshot.selectedGenre !== nextSnapshot.selectedGenre ||
      prevSnapshot.libraryActiveTab !== nextSnapshot.libraryActiveTab ||
      (prevSnapshot.selectedPlaylist?.id ?? null) !== (nextSnapshot.selectedPlaylist?.id ?? null);

    if (didChange) {
      if (isBackNavigationRef.current) {
        isBackNavigationRef.current = false;
      } else {
        navHistoryRef.current.push(prevSnapshot);
      }
    }
    screenSnapshotRef.current = nextSnapshot;
  }, [currentView, selectedAlbum, selectedArtist, selectedGenre, libraryActiveTab, selectedPlaylist]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const backButtonListener = CapacitorApp.addListener('backButton', () => {
      if (showQueueModal) {
        setShowQueueModal(false);
        return;
      }
      if (showFullPlayer) {
        setShowFullPlayer(false);
        return;
      }
      if (showDownloads) {
        setShowDownloads(false);
        return;
      }
      if (showNotifications) {
        setShowNotifications(false);
        return;
      }
      if (showSettings) {
        setShowSettings(false);
        return;
      }
      if (showUploadSong) {
        setShowUploadSong(false);
        return;
      }
      if (showManageAlbums) {
        setShowManageAlbums(false);
        return;
      }
      if (showManageArtists) {
        setShowManageArtists(false);
        return;
      }
      if (showManageLyrics) {
        setShowManageLyrics(false);
        return;
      }
      if (showManageGenres) {
        setShowManageGenres(false);
        return;
      }
      if (showManageSongs) {
        setShowManageSongs(false);
        return;
      }
      if (showManageCanvas) {
        setShowManageCanvas(false);
        return;
      }
      if (showProfile) {
        setShowProfile(false);
        return;
      }
      if (selectedPlaylist) {
        setSelectedPlaylist(null);
        return;
      }
      if (selectedAlbum) {
        setSelectedAlbum(null);
        return;
      }
      if (selectedArtist) {
        setSelectedArtist(null);
        return;
      }
      if (selectedGenre) {
        setSelectedGenre(null);
        return;
      }

      const previous = navHistoryRef.current.pop();
      if (previous) {
        isBackNavigationRef.current = true;
        setCurrentView(previous.currentView);
        setSelectedAlbum(previous.selectedAlbum);
        setSelectedArtist(previous.selectedArtist);
        setSelectedGenre(previous.selectedGenre);
        setLibraryActiveTab(previous.libraryActiveTab);
        setSelectedPlaylist(previous.selectedPlaylist);
      } else if (currentView !== 'home') {
        setCurrentView('home');
      } else {
        CapacitorApp.minimizeApp();
      }
    });

    return () => {
      backButtonListener.then((listener) => listener.remove());
    };
  }, [
    showQueueModal,
    showFullPlayer,
    showDownloads,
    showNotifications,
    showSettings,
    showUploadSong,
    showManageAlbums,
    showManageArtists,
    showManageLyrics,
    showManageGenres,
    showManageSongs,
    showManageCanvas,
    showProfile,
    selectedPlaylist,
    selectedAlbum,
    selectedArtist,
    selectedGenre,
    currentView
  ]);

  const audioStateRef = useRef({ songs, currentQueue, currentTrack, isShuffle, isRepeat, isPlaying });
  useEffect(() => {
    audioStateRef.current = { songs, currentQueue, currentTrack, isShuffle, isRepeat, isPlaying };
  }, [songs, currentQueue, currentTrack, isShuffle, isRepeat, isPlaying]);

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
      if (!currentUser) setLoading(false);
    });
    return () => unsubscribe();
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
          if (pos != null && pos >= dur - 1) {
            triggerNextTrackLogic();
          } else if (pos != null && pos >= 0) {
            setTrackProgress(pos);
          }
        }).catch(() => {});
        return;
      }

      const audio = audioRef.current;
      if (!audio) return;
      if (audio.ended || (audio.duration && audio.currentTime >= audio.duration - 0.5)) {
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

      try {
        try {
          const notifStatus = await BackgroundMode.checkNotificationsPermission();
          if (notifStatus?.status !== 'granted') {
            await BackgroundMode.requestNotificationsPermission();
          }
        } catch (checkErr) {
          console.warn('Notification permission check failed:', checkErr);
        }

        await BackgroundMode.enable({
          title: "Sonara",
          text: "Playing music...",
          icon: "icon",
          color: "1db954",
          hidden: false,
          bigText: true
        });

        await BackgroundMode.disableWebViewOptimizations();

        try {
          const battStatus = await BackgroundMode.checkBatteryOptimizations();
          if (battStatus?.enabled) {
            await BackgroundMode.requestDisableBatteryOptimizations();
          }
        } catch (battErr) {
          console.warn('Battery optimization request failed:', battErr);
        }

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

        bgListenerHandle = await BackgroundMode.addListener('appInBackground', async () => {
          try { await BackgroundMode.disableWebViewOptimizations(); } catch (_) {}
        });

        fgListenerHandle = await BackgroundMode.addListener('appInForeground', () => {
          const media = mediaRef.current;
          if (!media) return;
          const dur = typeof media.getDuration === 'function' ? media.getDuration() : -1;
          if (!dur || dur <= 0) return;
          media.getCurrentPosition().then((pos) => {
            if (pos != null && pos >= dur - 1) {
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
      if (!Capacitor.isNativePlatform() || !audioStateRef.current.isPlaying) return;
      const media = mediaRef.current;
      if (!media) return;
      const dur = typeof media.getDuration === 'function' ? media.getDuration() : -1;
      if (!dur || dur <= 0) return;
      media.getCurrentPosition().then((pos) => {
        if (pos != null && pos >= dur - 1) {
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

  const triggerNextTrackLogic = () => {
    const { songs: s, currentQueue: q, currentTrack: t, isShuffle: sh } = audioStateRef.current;
    const queue = q.length > 0 ? q : s;
    if (!queue.length) return;
    
    let next;
    if (sh) {
      if (queue.length > 1) {
        if (!shuffleBagRef.current || shuffleBagRef.current.length === 0) {
          const remainingIds = queue.filter(track => track.id !== t?.id).map(track => track.id);
          shuffleBagRef.current = shuffleArray(remainingIds);
        }
        const nextId = shuffleBagRef.current.shift();
        next = queue.find(track => track.id === nextId) || queue[0];
      } else {
        next = queue[0];
      }
    } else {
      const idx = queue.findIndex(track => track.id === t?.id);
      next = queue[(idx + 1) % queue.length];
    }
    handleTrackSelection(next, queue, false);
  };

  const triggerPrevTrackLogic = () => {
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

  const startNativeTrack = (track, autoplay = true) => {
    if (!track) return;
    const url = getPlaybackSource(track);
    if (!url) return;

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
    setTrackProgress(0);
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

    media.onSuccess.subscribe(() => {
      if (loadedNativeTrackIdRef.current !== track.id) return;
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

    if (Capacitor.isNativePlatform()) {
      MediaSession.setPlaybackState({ state: autoplay ? 'playing' : 'paused' }).catch(() => {});
    }

    if (autoplay) {
      media.play();
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
          }
        }).catch(() => {});
      }
    }, 500);
  };

  useEffect(() => {
    return () => {
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

    const fetchUserStatus = async () => {
      try {
        const userStatusRef = doc(db, 'users', user.uid);
        const userStatusSnap = await getDoc(userStatusRef);
        if (userStatusSnap.exists() && userStatusSnap.data().lastPlayedTrackId) {
          const savedTrackId = userStatusSnap.data().lastPlayedTrackId;
          setTimeout(() => {
            setSongs((latestSongs) => {
              const matched = latestSongs.find(s => s.id === savedTrackId);
              if (matched) {
                setCurrentTrack(matched);
                recordRecentlyPlayed(matched);
              }
              return latestSongs;
            });
          }, 500);
        }
      } catch (err) {
        console.warn('User profile sync initializing...');
      }
    };
    fetchUserStatus();

    return () => {
      unsubSongs();
      unsubChristianSongs();
      unsubAlbums();
      unsubArtists();
      unsubLyrics();
      unsubPlaylists();
      unsubPlaylistSongs();
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
    if (!currentTrack) return;
    const trackUrl = getPlaybackSource(currentTrack);
    if (!trackUrl) return;

    if (Capacitor.isNativePlatform()) {
      MediaSession.setMetadata({
        title:  currentTrack.title  || currentTrack.name  || 'Unknown Title',
        artist: currentTrack.artist || 'Unknown Artist',
        album:  currentTrack.album  || 'Sonara',
      })
        .then(async () => {
          await MediaSession.setPlaybackState({ state: isPlaying ? 'playing' : 'paused' });
        })
        .catch(err => console.warn('MediaSession sync error:', err));
      return;
    }

    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.setAttribute('playsinline', '');
      audioRef.current.setAttribute('webkit-playsinline', '');
    }

    const resolvedUrl = new URL(trackUrl, window.location.href).href;
    if (audioRef.current.src !== resolvedUrl) {
      lastTrackChangeAtRef.current = Date.now();

      audioRef.current.preload = 'auto';
      audioRef.current.src = trackUrl;
      setTrackProgress(0);
      setTrackDuration(0);

      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'playing';
      }
    }

    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title:  currentTrack.title  || currentTrack.name  || 'Unknown Title',
        artist: currentTrack.artist || '',
        album:  'Sonara',
      });
    }

    const handleTimeUpdate = () => {
      setTrackProgress(audioRef.current.currentTime);
    };

    const handleLoadedMetadata = () => {
      setTrackDuration(audioRef.current.duration);
    };

    const handleEnded = () => {
      const { isRepeat: r } = audioStateRef.current;
      if (r) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      } else {
        triggerNextTrackLogic();
      }
    };

    audioRef.current.addEventListener('timeupdate', handleTimeUpdate);
    audioRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);
    audioRef.current.addEventListener('ended', handleEnded);

    calculateAndPrefetchNextTrack();

    return () => {
      audioRef.current?.removeEventListener('timeupdate', handleTimeUpdate);
      audioRef.current?.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audioRef.current?.removeEventListener('ended', handleEnded);
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
        } else {
          mediaRef.current.pause();
        }
        MediaSession.setPlaybackState({ state: isPlaying ? 'playing' : 'paused' }).catch(() => {});
      }
      return;
    }

    if (!audioRef.current || !audioRef.current.src) return;

    if (isPlaying) {
      audioRef.current.play()
        .then(() => {
          if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
        })
        .catch(err => console.warn('Stream buffering:', err));
    } else {
      audioRef.current.pause();
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
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
        const nextUrl = appendQualityParam(rawNextUrl, getStreamingQuality());
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
    if (sleepTimeLeft === null) return;
    if (sleepTimeLeft <= 0) {
      setIsPlaying(false);
      setSleepTimeLeft(null);
      return;
    }
    sleepTimerRef.current = setTimeout(() => {
      setSleepTimeLeft(prev => prev - 1);
    }, 60000);
    return () => clearTimeout(sleepTimerRef.current);
  }, [sleepTimeLeft]);

  const togglePlayPause = () => setIsPlaying(prev => !prev);

  const handleSeekProgress = (newTime) => {
    setTrackProgress(newTime);

    if (Capacitor.isNativePlatform()) {
      mediaRef.current?.seekTo(newTime * 1000);
      const dur = typeof mediaRef.current?.getDuration === 'function' ? mediaRef.current.getDuration() : 0;
      if (dur > 0) {
        MediaSession.setPositionState({ duration: dur, playbackRate: 1.0, position: newTime }).catch(() => {});
      }
      return;
    }

    if (!audioRef.current) return;
    audioRef.current.currentTime = newTime;
  };

  const handleTrackSelection = async (track, customQueue = null, resetBag = true) => {
    if (!track) return;
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

  const handleLogout = async () => {
    setIsPlaying(false);
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
    if (Capacitor.isNativePlatform()) await FirebaseAuthentication.signOut();
    await signOut(auth);
  };

  const createPlaylist = async (name) => {
    if (!name.trim()) return;
    try {
      await addDoc(collection(db, 'playlists'), {
        playlistName: name,
        uid: user.uid,
        user: user.displayName || 'User',
        email: user.email,
        createdAt: new Date().toISOString(),
      });
      showToast(`Playlist "${name.trim()}" created!`, 'success', 'fa-folder-plus');
    } catch (err) { 
      console.error(err);
      showToast('Failed to create playlist', 'error', 'fa-circle-xmark');
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
    setSelectedAlbum(album);
    setSelectedArtist(null);
    setSelectedGenre(null);
    setCurrentView('home');
    setShowFullPlayer(false);
  };

  const handleGoToArtist = (track) => {
    if (!track?.artist) {
      showToast("This track isn't linked to an artist.", "info", "fa-circle-info");
      return;
    }
    const credits = splitArtistCredits(track.artist).map(c => c.toLowerCase());
    const artist = artists.find(a => credits.includes((a.name || '').toLowerCase()));
    if (!artist) {
      showToast("Artist profile couldn't be found.", "error", "fa-circle-xmark");
      return;
    }
    setSelectedArtist(artist);
    setSelectedAlbum(null);
    setSelectedGenre(null);
    setCurrentView('home');
    setShowFullPlayer(false);
  };

  const handleUpdateProfile = async (updates) => {
    if (!auth.currentUser) throw new Error("No signed-in user.");
    await updateProfile(auth.currentUser, updates);
    await auth.currentUser.reload();
    setUser({ ...auth.currentUser });
    showToast("Profile updated successfully!", "success", "fa-circle-check");
  };

  if (loading) {
    return (
      <div className="loading-screen-wrapper">
        <div className="loading-container">
          <img src={logo} className="loading-logo" alt="Loading..." />
          <div className="loading-pulse-ring"></div>
        </div>
      </div>
    );
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
      className={`mobile-container ${increaseContrast ? 'high-contrast-mode' : ''} ${!motionEnabled ? 'disable-animations' : ''}`}
      style={{ '--accent': appTheme }}
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
        onOpenProfile={() => setShowProfile(true)} 
        onOpenNotifications={() => setShowNotifications(true)} 
        onOpenDownloads={() => setShowDownloads(true)}
        hasUnreadNotifications={hasUnreadNotifications}
        onViewChange={(view) => {
          setCurrentView(view);
          setSelectedAlbum(null);
          setSelectedArtist(null);
          setSelectedGenre(null);
          setSelectedPlaylist(null);
        }} 
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

      {currentView === 'home' && (
        <main className="mobile-content" style={(selectedAlbum || selectedArtist || selectedGenre) ? { padding: 0 } : {}}>
          {!isOnline ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', textAlign: 'center', padding: '0 24px' }}>
              <i className="fa-solid fa-wifi" style={{ fontSize: '2.4rem', color: 'var(--text-muted)', marginBottom: '16px' }}></i>
              <h3 style={{ color: '#ffffff', margin: '0 0 8px 0' }}>No Internet Available</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
                Home needs a connection to load new content. Check your Library's Downloaded tab to play music offline.
              </p>
            </div>
          ) : selectedAlbum ? (
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
              onBack={() => setSelectedAlbum(null)}
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
              onSelectArtist={setSelectedArtist}
              onBack={() => setSelectedArtist(null)}
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
              onBack={() => setSelectedGenre(null)}
            />
          ) : (
            <>
              {/* 🌟 Recently Played Row */}
              {recentlyPlayed.length > 0 && (
                <section className="content-section" style={{ marginBottom: '20px' }}>
                  <div className="section-header-container">
                    <h2>Recently Played</h2>
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
                            <img src={songImg || 'https://placehold.co/150x150/0b111e/1db954.png'} alt={songTitle} />
                            <button
                              onClick={(e) => toggleLikeSong(song, e)}
                              style={{
                                position: 'absolute',
                                bottom: '8px',
                                right: '8px',
                                background: 'rgba(0,0,0,0.6)',
                                border: 'none',
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

              {/* 🌟 Moods & Genres Row */}
              <section className="content-section" style={{ marginBottom: '24px' }}>
                <div className="section-header-container">
                  <h2>Moods & Genres</h2>
                </div>
                <div className="horizontal-scroll">
                  {[
                    { name: 'Kollywood', bg: 'linear-gradient(135deg, #f43f5e, #be123c)' },
                    { name: 'Melody', bg: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' },
                    { name: 'Party', bg: 'linear-gradient(135deg, #a855f7, #6b21a8)' },
                    { name: 'Chill', bg: 'linear-gradient(135deg, #10b981, #047857)' },
                    { name: 'Devotional', bg: 'linear-gradient(135deg, #f59e0b, #d97706)' },
                    { name: 'Hip Hop', bg: 'linear-gradient(135deg, #ec4899, #db2777)' },
                    { name: 'Classical', bg: 'linear-gradient(135deg, #6366f1, #4f46e5)' },
                    { name: 'Folk', bg: 'linear-gradient(135deg, #14b8a6, #0d9488)' },
                    { name: 'Love', bg: 'linear-gradient(135deg, #f43f5e, #fb7185)' },
                    { name: 'Break Heart', bg: 'linear-gradient(135deg, #475569, #1e293b)' }
                  ].map((genre) => (
                    <div
                      key={genre.name}
                      onClick={() => setSelectedGenre(genre.name)}
                      style={{
                        minWidth: '130px', height: '84px', borderRadius: '12px', background: genre.bg,
                        padding: '12px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column',
                        justifyContent: 'flex-end', cursor: 'pointer', boxShadow: '0 8px 20px rgba(0,0,0,0.3)',
                        flexShrink: 0
                      }}
                    >
                      <span style={{ color: '#fff', fontWeight: '700', fontSize: '0.9rem' }}>{genre.name}</span>
                    </div>
                  ))}
                </div>
              </section>

              <SongRow
                title="Popular Songs"
                songs={songs}
                likedSongIds={likedSongIds}
                onToggleLike={toggleLikeSong}
                onSelectTrack={(track) => handleTrackSelection(track, songs)}
                onSeeAll={() => setCurrentView('all-songs')}
              />

              <section className="content-section" style={{ marginBottom: '24px' }}>
                <div className="section-header-container">
                  <h2>Popular Albums</h2>
                  <button className="see-all-action-btn" onClick={() => setCurrentView('all-albums')}>
                    See all
                  </button>
                </div>
                <div className="horizontal-scroll">
                  {albums.length > 0 ? (
                    albums.map((album) => (
                      <div 
                        key={album.id} 
                        className="song-card" 
                        onClick={() => setSelectedAlbum(album)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="img-container">
                          <img src={album.image} alt={album.name} />
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
                onSelectArtist={(artist) => setSelectedArtist(artist)}
                onSeeAll={() => setCurrentView('all-artists')}
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
          onBack={() => setCurrentView('home')}
        />
      )}

      {currentView === 'all-albums' && (
        <AllAlbumsView
          albums={albums}
          onSelectAlbum={(album) => {
            setSelectedAlbum(album);
            setCurrentView('home');
          }}
          onBack={() => setCurrentView('home')}
        />
      )}

      {currentView === 'all-artists' && (
        <AllArtistsView
          artists={artists}
          onSelectArtist={(artist) => {
            setSelectedArtist(artist);
            setCurrentView('home');
          }}
          onBack={() => setCurrentView('home')}
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
            onSelectAlbum={(album) => {
              setSelectedAlbum(album);
              setSelectedArtist(null);
              setSelectedGenre(null);
              setCurrentView('home');
            }}
            onSelectArtist={(artist) => {
              setSelectedArtist(artist);
              setSelectedAlbum(null);
              setSelectedGenre(null);
              setCurrentView('home');
            }}
            onAddSongToPlaylist={addSongToPlaylist}
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
          onSelectArtist={(artist) => {
            setSelectedArtist(artist);
            setSelectedAlbum(null);
            setSelectedGenre(null);
            setCurrentView('home');
          }}
          onSelectAlbum={(album) => {
            setSelectedAlbum(album);
            setSelectedArtist(null);
            setSelectedGenre(null);
            setCurrentView('home');
          }}
          activeTab={libraryActiveTab}
          onActiveTabChange={setLibraryActiveTab}
          selectedPlaylist={selectedPlaylist}
          onSelectPlaylist={setSelectedPlaylist}
          isOffline={!isOnline}
        />
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
            <button onClick={() => setShowQueueModal(false)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '1.2rem', cursor: 'pointer' }}>
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
                  <img src={img || 'https://placehold.co/100x100/0b111e/1db954.png'} alt="" style={{ width: '42px', height: '42px', borderRadius: '8px', objectFit: 'cover' }} />
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
          onClose={() => setShowFullPlayer(false)}
        />
      )}

      {showProfile && (
        <ProfileDrawerView
          user={user}
          artists={artists}
          currentVersion={CURRENT_APP_VERSION}
          updateInfo={updateInfo}
          onLogout={handleLogout}
          onNavigateSettings={() => setShowSettings(true)}
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
          onClose={() => setShowProfile(false)}
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
          onClose={() => setShowNotifications(false)}
        />
      )}

      {showDownloads && (
        <DownloadCenterView
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          onSelectTrack={handleTrackSelection}
          onClose={() => setShowDownloads(false)}
        />
      )}

      {showSettings && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: '#060c18', zIndex: 650, overflowY: 'auto',
          boxSizing: 'border-box',
          animation: 'slideUpSheet 0.28s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          <SettingsView
            contentRestrictions={contentRestrictions}
            setContentRestrictions={setContentRestrictions}
            appTheme={appTheme}
            setAppTheme={setAppTheme}
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
            currentVersion={CURRENT_APP_VERSION}
            songs={songs}
            onBack={() => setShowSettings(false)}
          />
        </div>
      )}

      {showUploadSong && (
        <UploadSongView
          user={user}
          onBack={() => setShowUploadSong(false)}
          onSongUploaded={(newSong) => setSongs((prev) => [newSong, ...prev])}
        />
      )}

      {showManageAlbums && (
        <ManageAlbumsView
          albums={albums}
          songs={songs}
          onBack={() => setShowManageAlbums(false)}
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
          onBack={() => setShowManageArtists(false)}
          onArtistCreated={(newArtist) => setArtists((prev) => [newArtist, ...prev])}
        />
      )}

      {showManageLyrics && (
        <ManageLyricsView
          songs={songs}
          lyrics={lyrics}
          onBack={() => setShowManageLyrics(false)}
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
          onBack={() => setShowManageGenres(false)}
          onGenreSaved={(updatedSong) => {
            setSongs((prev) => prev.map(s => s.id === updatedSong.id ? updatedSong : s));
            setCurrentTrack((prev) => (prev && prev.id === updatedSong.id) ? { ...prev, ...updatedSong } : prev);
          }}
        />
      )}

      {showManageSongs && (
        <ManageSongsAdminView
          songs={songs}
          onBack={() => setShowManageSongs(false)}
          onSongDeleted={(deletedId) => {
            setSongs((prev) => prev.filter(s => s.id !== deletedId));
          }}
        />
      )}

      {showManageCanvas && (
        <ManageCanvasVideosView
          songs={songs}
          onBack={() => setShowManageCanvas(false)}
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

      <BottomNavigation currentView={currentView} onViewChange={setCurrentView} isOnline={isOnline} />
    </div>
  );
}