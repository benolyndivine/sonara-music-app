import React, { useState, useEffect, useRef } from 'react';
import { collection, doc, addDoc, deleteDoc, query, where, onSnapshot, getDocs, setDoc, getDoc } from 'firebase/firestore';
import { GoogleAuthProvider, signInWithCredential, signInWithPopup, signOut, onAuthStateChanged, updateProfile } from 'firebase/auth';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app'; 
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { MediaSession } from '@capgo/capacitor-media-session';
import { BackgroundMode } from '@anuradev/capacitor-background-mode';
import { Media } from '@awesome-cordova-plugins/media';
import { db, auth, provider } from './firebase';
import { getPlaybackSource, isTrackCachedOffline } from './utils/offlineStorage';
import { getStreamingQuality, appendQualityParam } from './utils/audioQuality';
import { songMatchesArtist, splitArtistCredits } from './utils/artistMatch';
import Header from './components/Header';
import SongRow from './components/SongRow';
import ArtistRow from './components/ArtistRow';
import MiniPlayer from './components/MiniPlayer';
import BottomNavigation from './components/BottomNavigation';
import AllSongsView from './components/AllSongsView';
import AllAlbumsView from './components/AllAlbumsView'; 
import SearchView from './components/SearchView';
import LibraryView from './components/LibraryView';
import FullPlayerView from './components/FullPlayerView';
import ProfileDrawerView from './components/ProfileDrawerView';
import SettingsView from './components/SettingsView';
import AlbumDetailsView from './components/AlbumDetailsView'; 
import ArtistDetailsView from './components/ArtistDetailsView';
import logo from './assets/logo3.png';
import './App.css';

export default function App() {
  const [user, setUser] = useState(null);
  const [songs, setSongs] = useState([]);
  const [artists, setArtists] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [playlistSongs, setPlaylistSongs] = useState([]);
  const [lyrics, setLyrics] = useState([]);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(true);

  const [albums, setAlbums] = useState([]);
  const [selectedAlbum, setSelectedAlbum] = useState(null); 
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [libraryActiveTab, setLibraryActiveTab] = useState('playlists');
  // 🛠️ FIX: was local state inside LibraryView, invisible to the back-button
  // history stack below — see the matching comment in LibraryView.jsx.
  // Lifting it up here means "open a playlist" becomes a real navigation
  // step that Android back can unwind, same as selectedAlbum/selectedArtist.
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);

  const [currentView, setCurrentView] = useState('home');
  const [currentQueue, setCurrentQueue] = useState([]);
  // 🌐 NETWORK CONNECTIVITY STATE — drives the offline UI + local-only playback
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const wasOnlineRef = useRef(navigator.onLine);
  const [showFullPlayer, setShowFullPlayer] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [sleepTimeLeft, setSleepTimeLeft] = useState(null);
  const [trackProgress, setTrackProgress] = useState(0);
  const [trackDuration, setTrackDuration] = useState(0);

  const [increaseContrast, setIncreaseContrast] = useState(false);
  const [automaticallySendDiagnostics, setAutomaticallySendDiagnostics] = useState(true);

  const [contentRestrictions, setContentRestrictions] = useState(false);
  const [appTheme, setAppTheme] = useState('#1db954'); // 🎨 Accent color hex, applied as --accent below
  const [motionEnabled, setMotionEnabled] = useState(true);
  const [lyricsSize, setLyricsSize] = useState('Normal');

  const audioRef = useRef(null);          // Web/PWA fallback: HTML5 <audio>
  const mediaRef = useRef(null);          // Native: Cordova Media instance
  const loadedNativeTrackIdRef = useRef(null); // Which track id is currently loaded into mediaRef
  const nativeProgressIntervalRef = useRef(null); // Polls native position/duration (no native timeupdate event exists)
  const prefetchAudioRef = useRef(null);
  const nextTrackRef = useRef(null);
  const sleepTimerRef = useRef(null);
  // Timestamp of the last track switch — used to ignore the spurious
  // 'pause' command some Android/Bluetooth media transports send during
  // the brief audio-focus renegotiation window right after a track change.
  const lastTrackChangeAtRef = useRef(0);
  const TRANSPORT_PAUSE_GRACE_MS = 700;

  // ─────────────────────────────────────────────────────────────
  // 🕘 NAVIGATION HISTORY STACK — records every screen-level state change
  // (bottom-tab view, album/artist detail, full player, profile drawer) in
  // the exact order the user visited them, no matter which control
  // triggered the change (bottom nav, header search icon, "See all",
  // tapping an album/artist from Home/Search/Library, opening the profile
  // drawer, expanding the player, etc). The Android hardware back button
  // below pops this stack one step at a time, so back always retraces the
  // user's actual navigation sequence instead of jumping to a fixed screen.
  // ─────────────────────────────────────────────────────────────
  const screenSnapshotRef = useRef({
    currentView, selectedAlbum, selectedArtist, showFullPlayer, showProfile, libraryActiveTab, selectedPlaylist,
  });
  const navHistoryRef = useRef([]); // stack of previous snapshots, oldest first
  const isBackNavigationRef = useRef(false); // true while applying a popped snapshot, so it isn't re-pushed

  useEffect(() => {
    const nextSnapshot = { currentView, selectedAlbum, selectedArtist, showFullPlayer, showProfile, libraryActiveTab, selectedPlaylist };
    const prevSnapshot = screenSnapshotRef.current;

    const didChange =
      prevSnapshot.currentView !== nextSnapshot.currentView ||
      prevSnapshot.selectedAlbum !== nextSnapshot.selectedAlbum ||
      prevSnapshot.selectedArtist !== nextSnapshot.selectedArtist ||
      prevSnapshot.showFullPlayer !== nextSnapshot.showFullPlayer ||
      prevSnapshot.showProfile !== nextSnapshot.showProfile ||
      prevSnapshot.libraryActiveTab !== nextSnapshot.libraryActiveTab ||
      // Compare by id, not object reference: renaming the open playlist
      // (handleInlineRenameSave) rebuilds the selectedPlaylist object with
      // a new reference but the same id — that's a metadata update, not a
      // navigation step, so it shouldn't push a new back-stack entry.
      (prevSnapshot.selectedPlaylist?.id ?? null) !== (nextSnapshot.selectedPlaylist?.id ?? null);

    if (didChange) {
      if (isBackNavigationRef.current) {
        // This change is the result of popping the stack in the back
        // button handler below — don't record it again as a forward step.
        isBackNavigationRef.current = false;
      } else {
        navHistoryRef.current.push(prevSnapshot);
      }
    }
    // Always resync the ref to the latest values, even when nothing worth
    // pushing to history changed (e.g. selectedPlaylist got a fresh object
    // reference from a rename) — otherwise a later, unrelated navigation
    // step would push this stale snapshot, and popping back into it later
    // would briefly show the pre-rename playlist name.
    screenSnapshotRef.current = nextSnapshot;
  }, [currentView, selectedAlbum, selectedArtist, showFullPlayer, showProfile, libraryActiveTab, selectedPlaylist]);

  // ─────────────────────────────────────────────────────────────
  // 📱 NATIVE MOBILE BACK BUTTON EVENT INTERCEPTOR
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const backButtonListener = CapacitorApp.addListener('backButton', () => {
      const previous = navHistoryRef.current.pop();

      if (previous) {
        isBackNavigationRef.current = true;
        setCurrentView(previous.currentView);
        setSelectedAlbum(previous.selectedAlbum);
        setSelectedArtist(previous.selectedArtist);
        setShowFullPlayer(previous.showFullPlayer);
        setShowProfile(previous.showProfile);
        setLibraryActiveTab(previous.libraryActiveTab);
        setSelectedPlaylist(previous.selectedPlaylist);
      } else {
        // Nothing earlier in the sequence — this is the first screen the
        // user landed on this session, so back does what Android expects.
        CapacitorApp.minimizeApp();
      }
    });

    return () => {
      backButtonListener.then((listener) => listener.remove());
    };
  }, []);

  // Mutable mirror of audio-relevant state to survive OS thread freezing and
  // background closure scopes (native playback callbacks read this instead
  // of closing over potentially-stale state).
  const audioStateRef = useRef({ songs, currentQueue, currentTrack, isShuffle, isRepeat, isPlaying });
  useEffect(() => {
    audioStateRef.current = { songs, currentQueue, currentTrack, isShuffle, isRepeat, isPlaying };
  }, [songs, currentQueue, currentTrack, isShuffle, isRepeat, isPlaying]);

  // ─────────────────────────────────────────────────────────────
  // 🌐 NETWORK CONNECTIVITY LISTENER
  // ─────────────────────────────────────────────────────────────
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

  // Block Home & Search while offline — bounce the user to the Library
  // (Downloaded tab) instead, since those views need a live connection.
  useEffect(() => {
    if (!isOnline && (currentView === 'home' || currentView === 'search')) {
      setCurrentView('library');
    }
  }, [isOnline, currentView]);

  // 🔁 When the connection comes back, take the user straight to Home —
  // regardless of which view they were stuck on while offline.
  useEffect(() => {
    if (isOnline && !wasOnlineRef.current) {
      setCurrentView('home');
    }
    wasOnlineRef.current = isOnline;
  }, [isOnline]);

  // ─────────────────────────────────────────────────────────────
  // 🔐 AUTH STATE LISTENER
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser ?? null);
      if (!currentUser) setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // ─────────────────────────────────────────────────────────────
  // 🔊 UNLOCK NATIVE AUDIO RIG
  // ─────────────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────
  // 👁️ VISIBILITY SELF-HEAL (covers regular web/PWA background/lock-screen case)
  // ─────────────────────────────────────────────────────────────
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
      // If the track actually finished while the tab/screen was inactive and
      // the 'ended' event never got a chance to update state, advance now.
      if (audio.ended || (audio.duration && audio.currentTime >= audio.duration - 0.5)) {
        triggerNextTrackLogic();
      } else if (audioStateRef.current.isPlaying && audio.paused) {
        // Resync: some mobile browsers silently pause background audio.
        audio.play().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // ─────────────────────────────────────────────────────────────
  // 🚀 BACKGROUND ENGINE AND MEDIA INTERCEPTOR WAKELOCKS
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let bgListenerHandle, fgListenerHandle;

    const initBackgroundServices = async () => {
      if (!Capacitor.isNativePlatform()) return;

      try {
        // 0. Request notification permission FIRST. On Android 13+ the
        //    persistent foreground-service notification requires POST_NOTIFICATIONS;
        //    without it, Android can silently kill the background service that
        //    keeps audio/JS alive once the screen turns off.
        try {
          const notifStatus = await BackgroundMode.checkNotificationsPermission();
          if (notifStatus?.status !== 'granted') {
            await BackgroundMode.requestNotificationsPermission();
          }
        } catch (permErr) {
          console.warn('Notification permission check failed:', permErr);
        }

        // 1. Force background engine alive flag and configure notification channel
        await BackgroundMode.enable({
          title: "Sonara",
          text: "Streaming your audio timeline...",
          icon: "icon",
          color: "1db954",
          hidden: true,
          bigText: true
        });

        // 2. 🚀 THE ACTUAL FIX for "next song doesn't play / playback pauses
        //    when the screen is off or the app is minimized":
        //    Stock Android suspends a WebView's JS event loop a few minutes
        //    after it's hidden. That freezes the audio element's 'timeupdate'
        //    and 'ended' events, so the queue never advances and play/pause
        //    commands stop being processed until you reopen the app.
        //    disableWebViewOptimizations() tells Android to keep this app's
        //    WebView thread running normally even while backgrounded.
        await BackgroundMode.disableWebViewOptimizations();

        // 3. Ask the OS to exempt us from Doze-mode battery throttling too
        //    (kicks in after ~40 min backgrounded on top of the WebView freeze).
        //    NOTE: the previous code called a method name that doesn't exist
        //    on this plugin ("disableBatteryOptimizations"), so this request
        //    was silently never sent.
        try {
          const battStatus = await BackgroundMode.checkBatteryOptimizations();
          if (battStatus?.enabled) {
            await BackgroundMode.requestDisableBatteryOptimizations();
          }
        } catch (battErr) {
          console.warn('Battery optimization request failed:', battErr);
        }

        // 4. Map Media Action Interceptors directly to persistent hardware refs
        await MediaSession.setActionHandler({ action: 'play' }, () => {
          setIsPlaying(true);
        });

        await MediaSession.setActionHandler({ action: 'pause' }, () => {
          // 🛠️ Ignore transport 'pause' commands that arrive in the split
          // second right after a track switch — that's the OS/Bluetooth
          // device reacting to the audio-focus blip of loading the new
          // track, not the user actually pressing pause.
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

        // 5. Some OEM Android skins (Xiaomi/MIUI, Oppo/ColorOS, Samsung) re-apply
        //    their own WebView throttling on top of stock Android whenever the
        //    app re-enters the background, so re-assert the override every time.
        bgListenerHandle = await BackgroundMode.addListener('appInBackground', async () => {
          try { await BackgroundMode.disableWebViewOptimizations(); } catch (_) {}
        });

        // 6. 🔄 Self-heal on resume: if the current track actually finished
        //    while the screen was off (event got dropped despite the fix
        //    above, e.g. on an older OS build), catch up the instant the app
        //    comes back to the foreground instead of sitting stuck on a dead track.
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

    // 🛠️ Native watchdog: the Cordova Media plugin's onSuccess callback can
    // occasionally be delayed by the JS bridge while backgrounded. Poll every
    // few seconds and force the queue forward if we detect the track actually
    // finished but the callback never arrived.
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

  // ─────────────────────────────────────────────────────────────
  // 🔮 REFACTORED MUTABLE MEDIA ADVANCEMENT LOOP 
  // ─────────────────────────────────────────────────────────────
  const triggerNextTrackLogic = () => {
    const { songs: s, currentQueue: q, currentTrack: t, isShuffle: sh } = audioStateRef.current;
    const queue = q.length > 0 ? q : s;
    if (!queue.length) return;
    
    let next;
    if (sh) {
      next = queue[Math.floor(Math.random() * queue.length)];
    } else {
      const idx = queue.findIndex(track => track.id === t?.id);
      next = queue[(idx + 1) % queue.length];
    }
    handleTrackSelection(next, queue);
  };

  const triggerPrevTrackLogic = () => {
    const { songs: s, currentQueue: q, currentTrack: t } = audioStateRef.current;
    const queue = q.length > 0 ? q : s;
    if (!queue.length) return;

    const idx = queue.findIndex(track => track.id === t?.id);
    const prev = queue[(idx - 1 + queue.length) % queue.length];
    handleTrackSelection(prev, queue);
  };

  // ─────────────────────────────────────────────────────────────
  // 🔊 NATIVE AUDIO ENGINE (Cordova Media — real OS-level playback,
  // independent of the WebView's JS thread getting frozen/throttled)
  // ─────────────────────────────────────────────────────────────
  const startNativeTrack = (track, autoplay = true) => {
    if (!track) return;
    // Prefer the locally downloaded copy if one exists, so playback keeps
    // working with no network connection; falls back to the remote URL.
    const url = getPlaybackSource(track);
    if (!url) return;

    // Tear down whatever was previously loaded
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

    // Fires when the track finishes playing naturally (real track-end,
    // not a pause/seek) — this is our native equivalent of the HTML5
    // 'ended' event, and it keeps firing even while the app is
    // backgrounded/screen-off since it's driven by the native player.
    media.onSuccess.subscribe(() => {
      if (loadedNativeTrackIdRef.current !== track.id) return; // stale callback from a since-replaced track
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

    // The Cordova Media plugin has no continuous position event, so we poll
    // it ourselves to keep the progress bar and lock-screen scrubber in sync.
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

  // Tear down the native player on unmount
  useEffect(() => {
    return () => {
      if (nativeProgressIntervalRef.current) clearInterval(nativeProgressIntervalRef.current);
      if (mediaRef.current) {
        try { mediaRef.current.stop(); } catch (_) {}
        try { mediaRef.current.release(); } catch (_) {}
      }
    };
  }, []);

  // ─────────────────────────────────────────────────────────────
  // 📦 FETCH DATA WATERFALL MATRIX
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const fetchAllData = async () => {
      try {
        const songsSnap = await getDocs(collection(db, 'songs'));
        let songsList = songsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        if (user.email === 'bright2013.br@gmail.com' || user.email === 'jebarejila2@gmail.com') {
          try {
            const christianSongsSnap = await getDocs(collection(db, 'christianSongs'));
            const christianSongsList = christianSongsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            songsList = [...songsList, ...christianSongsList];
          } catch (dbErr) {
            console.error('Restricted rules blocked reading christianSongs:', dbErr);
          }
        }

        setSongs(songsList);
        setCurrentQueue(songsList);

        try {
          const albumsSnap = await getDocs(collection(db, 'albums'));
          setAlbums(albumsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (albumErr) {
          console.error('Failed to load albums collection:', albumErr);
        }

        const artistsSnap = await getDocs(collection(db, 'artists'));
        setArtists(artistsSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        const lyricsSnap = await getDocs(collection(db, 'lyrics'));
        setLyrics(lyricsSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        const playlistsQuery = query(collection(db, 'playlists'), where('uid', '==', user.uid));
        const playlistsSnap = await getDocs(playlistsQuery);
        setPlaylists(playlistsSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        try {
          const userStatusRef = doc(db, 'users', user.uid);
          const userStatusSnap = await getDoc(userStatusRef);
          
          if (userStatusSnap.exists() && userStatusSnap.data().lastPlayedTrackId) {
            const savedTrackId = userStatusSnap.data().lastPlayedTrackId;
            const matchedTrack = songsList.find(s => s.id === savedTrackId);
            
            if (matchedTrack) {
              setCurrentTrack(matchedTrack);
            } else if (songsList.length > 0) {
              setCurrentTrack(songsList[0]);
            }
          } else if (songsList.length > 0) {
            setCurrentTrack(songsList[0]);
          }
        } catch (statusErr) {
          console.warn('Persistence fetch skipped, falling back to first song index:', statusErr);
          if (songsList.length > 0) setCurrentTrack(songsList[0]);
        }

      } catch (err) {
        console.error('Data waterfall sync exception logged:', err);
      } finally {
        setLoading(false); 
      }
    };

    fetchAllData();
  }, [user]);

  useEffect(() => {
    if (!user || loading) return;

    const playlistsQuery = query(collection(db, 'playlists'), where('uid', '==', user.uid));

    const unsubPlaylists = onSnapshot(playlistsQuery, (snap) => {
      setPlaylists(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubPlaylistSongs = onSnapshot(collection(db, 'playlistSongs'), (snap) => {
      setPlaylistSongs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubPlaylists(); unsubPlaylistSongs(); };
  }, [user, loading]);

  // ─────────────────────────────────────────────────────────────
  // 🎵 AUDIO ATTRIBUTES TRACK OVERLAY MOUNT CHANNEL
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentTrack) return;
    // Prefer the locally downloaded copy if one exists, so playback keeps
    // working with no network connection; falls back to the remote URL.
    const trackUrl = getPlaybackSource(currentTrack);
    if (!trackUrl) return;

    const rawArt = currentTrack.coverUrl || currentTrack.cover || currentTrack.image || currentTrack.imageUrl || '';
    const artworkUrl = rawArt.startsWith('http')
      ? rawArt
      : rawArt
        ? `${window.location.origin}/${rawArt.replace(/^\//, '')}`
        : 'https://placehold.co/512x512/0b111e/1db954.png';

    if (Capacitor.isNativePlatform()) {
      // 🚀 Native platforms use the Cordova Media plugin for real OS-level
      // playback (see startNativeTrack). That engine — creating/loading/
      // switching the actual audio — is driven entirely from the STREAM
      // SYSTEM SYNC effect below, since only that effect knows whether this
      // is a genuinely new track or just a play/pause toggle on the same one.
      // Here we only need to push the lock-screen/notification metadata.
      MediaSession.setMetadata({
        title:  currentTrack.title  || currentTrack.name  || 'Unknown Title',
        artist: currentTrack.artist || 'Unknown Artist',
        album:  'Sonara',
        artwork: [
          { src: artworkUrl, sizes: '96x96',   type: 'image/jpeg' },
          { src: artworkUrl, sizes: '128x128', type: 'image/jpeg' },
          { src: artworkUrl, sizes: '256x256', type: 'image/jpeg' },
          { src: artworkUrl, sizes: '512x512', type: 'image/jpeg' },
        ],
      })
        .then(() => MediaSession.setPlaybackState({ state: audioStateRef.current.isPlaying ? 'playing' : 'paused' }))
        .catch(err => console.warn('MediaSession metadata dropped:', err));
      return;
    }

    // ── Web / PWA fallback: HTML5 <audio> element ──
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.setAttribute('playsinline', '');
      audioRef.current.setAttribute('webkit-playsinline', '');
    }

    const resolvedUrl = new URL(trackUrl, window.location.href).href;
    if (audioRef.current.src !== resolvedUrl) {
      // Mark the switch time BEFORE mutating .src — some OS/Bluetooth media
      // transports fire a stray 'pause' the instant the audio element's
      // resource changes (audio focus renegotiation). We use this timestamp
      // to ignore that spurious command below instead of honoring it.
      lastTrackChangeAtRef.current = Date.now();

      audioRef.current.preload = 'auto';
      audioRef.current.src = trackUrl;
      // 🛠️ Intentionally NOT calling .load() here: setting .src already
      // triggers the browser's media-load algorithm. The extra explicit
      // .load() call caused a brief native pause/reset blip on some Android
      // WebViews during the transition, which the OS then echoed back to us
      // as a genuine transport 'pause' command — pausing the *next* song
      // right after it started.
      setTrackProgress(0);
      setTrackDuration(0);

      // Immediately reflect "playing" on the OS media session so there's no
      // ambiguous/"none" playback-state window for a transport control to
      // misinterpret while the new track buffers.
      if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = 'playing';
      }
    }

    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title:  currentTrack.title  || currentTrack.name  || 'Unknown Title',
        artist: currentTrack.artist || '',
        album:  'Sonara',
        artwork: [
          { src: artworkUrl, sizes: '96x96',   type: 'image/jpeg' },
          { src: artworkUrl, sizes: '128x128', type: 'image/jpeg' },
          { src: artworkUrl, sizes: '256x256', type: 'image/jpeg' },
          { src: artworkUrl, sizes: '512x512', type: 'image/jpeg' },
        ],
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

  // ─────────────────────────────────────────────────────────────
  // ▶️ STREAM SYSTEM SYNC ATTACHMENT CHANNEL
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentTrack) return;

    if (Capacitor.isNativePlatform()) {
      const isNewTrack = loadedNativeTrackIdRef.current !== currentTrack.id;

      if (isNewTrack) {
        // Genuinely different track — (re)create the native player for it.
        startNativeTrack(currentTrack, isPlaying);
      } else if (mediaRef.current) {
        // Same track — just toggle play/pause, don't recreate the player
        // (recreating it was the bug that restarted the song from 0 every
        // time you resumed after pausing).
        if (isPlaying) {
          mediaRef.current.play();
        } else {
          mediaRef.current.pause();
        }
        MediaSession.setPlaybackState({ state: isPlaying ? 'playing' : 'paused' }).catch(() => {});
      }
      return;
    }

    // ── Web / PWA fallback ──
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

  // ─────────────────────────────────────────────────────────────
  // 🌐 WEB MEDIA SESSION 
  // ─────────────────────────────────────────────────────────────
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
    if (Capacitor.isNativePlatform()) return; // no benefit on native — the Cordova Media plugin doesn't use this hidden <audio> element
    const queue = currentQueue.length > 0 ? currentQueue : songs;
    if (!queue.length || !currentTrack) return;

    let next = null;
    if (isShuffle) {
      next = queue[Math.floor(Math.random() * queue.length)];
    } else {
      const idx = queue.findIndex(s => s.id === currentTrack.id);
      next = queue[(idx + 1) % queue.length];
    }

    if (next && isOnline && !isTrackCachedOffline(next.id)) {
      nextTrackRef.current = next;
      const rawNextUrl = next.songUrl || next.audioUrl;
      if (rawNextUrl) {
        // 🆕 Prefetch at the same tier Settings → Streaming Quality will
        // actually play it at, so we don't warm the cache with the wrong file.
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

  // ─────────────────────────────────────────────────────────────
  // 😴 SLEEP TIMER
  // ─────────────────────────────────────────────────────────────
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

  const handleTrackSelection = async (track, customQueue = null) => {
    if (!track) return;
    setCurrentQueue(customQueue?.length ? customQueue : songs);
    setCurrentTrack(track);
    setIsPlaying(true);

    if (user && isOnline) {
      try {
        const userStatusRef = doc(db, 'users', user.uid);
        await setDoc(userStatusRef, { lastPlayedTrackId: track.id }, { merge: true });
      } catch (err) {
        console.error('Failed to sync lastPlayedTrackId:', err);
      }
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 🔑 AUTH
  // ─────────────────────────────────────────────────────────────
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
    } catch (err) { console.error(err); }
  };

  const deletePlaylist = async (playlistId) => {
    try {
      await deleteDoc(doc(db, 'playlists', playlistId));
      for (const m of playlistSongs.filter(m => m.playlistId === playlistId)) {
        await deleteDoc(doc(db, 'playlistSongs', m.id));
      }
    } catch (err) { console.error(err); }
  };

  const addSongToPlaylist = async (playlistId, song) => {
    const songId = song.title || song.name;
    if (!songId) return;
    if (playlistSongs.find(m => m.playlistId === playlistId && m.songId === songId)) {
      return alert('Song already in this playlist!');
    }
    try {
      await addDoc(collection(db, 'playlistSongs'), { playlistId, songId });
      alert('Added to playlist!');
    } catch (err) { console.error(err); }
  };

  const removeSongFromPlaylist = async (playlistId, song) => {
    const songId = song.title || song.name;
    const match = playlistSongs.find(m => m.playlistId === playlistId && m.songId === songId);
    if (!match) return;
    try {
      await deleteDoc(doc(db, 'playlistSongs', match.id));
    } catch (err) { console.error(err); }
  };

  // 🆕 Navigates from the FullPlayerView "Go to Album" action to the real
  // AlbumDetailsView, closing the player sheet so the album is visible.
  const handleGoToAlbum = (track) => {
    if (!track?.albumId) {
      alert("This track isn't linked to an album.");
      return;
    }
    const album = albums.find(a => a.id === track.albumId);
    if (!album) {
      alert("Album details couldn't be found.");
      return;
    }
    setSelectedAlbum(album);
    setSelectedArtist(null);
    setCurrentView('home');
    setShowFullPlayer(false);
  };

  // 🆕 Navigates from the FullPlayerView "View Artist Profile" action to the
  // real ArtistDetailsView, closing the player sheet so the artist is visible.
  const handleGoToArtist = (track) => {
    if (!track?.artist) {
      alert("This track isn't linked to an artist.");
      return;
    }
    const credits = splitArtistCredits(track.artist).map(c => c.toLowerCase());
    const artist = artists.find(a => credits.includes((a.name || '').toLowerCase()));
    if (!artist) {
      alert("Artist profile couldn't be found.");
      return;
    }
    setSelectedArtist(artist);
    setSelectedAlbum(null);
    setCurrentView('home');
    setShowFullPlayer(false);
  };

  // 🆕 Updates the signed-in user's Firebase Auth profile (display name /
  // photo). Firebase doesn't re-fire onAuthStateChanged for profile edits,
  // so we manually refresh the local `user` state afterward.
  const handleUpdateProfile = async (updates) => {
    if (!auth.currentUser) throw new Error("No signed-in user.");
    await updateProfile(auth.currentUser, updates);
    await auth.currentUser.reload();
    setUser({ ...auth.currentUser });
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
      {currentView !== 'settings' && (
        <Header user={user} onOpenProfile={() => setShowProfile(true)} onViewChange={setCurrentView} />
      )}

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
        <main className="mobile-content" style={(selectedAlbum || selectedArtist) ? { padding: 0 } : {}}>
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
              onTogglePlay={togglePlayPause}
              onSelectTrack={handleTrackSelection}
              onBack={() => setSelectedAlbum(null)}
            />
          ) : selectedArtist ? (
            <ArtistDetailsView
              artist={selectedArtist}
              songs={songs}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              isShuffle={isShuffle}
              onToggleShuffle={() => setIsShuffle(!isShuffle)}
              onTogglePlay={togglePlayPause}
              onSelectTrack={handleTrackSelection}
              onBack={() => setSelectedArtist(null)}
            />
          ) : (
            <>
              <SongRow
                title="Popular Songs"
                songs={songs}
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
            onSelectTrack={(track) => handleTrackSelection(track, songs)}
            onSelectAlbum={(album) => {
              setSelectedAlbum(album);
              setSelectedArtist(null);
              setCurrentView('home');
            }}
            onSelectArtist={(artist) => {
              setSelectedArtist(artist);
              setSelectedAlbum(null);
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
          onTogglePlay={togglePlayPause}
          onSelectTrack={handleTrackSelection}
          onCreatePlaylist={createPlaylist}
          onDeletePlaylist={deletePlaylist}
          onRemoveSong={removeSongFromPlaylist}
          onSelectArtist={(artist) => {
            setSelectedArtist(artist);
            setSelectedAlbum(null);
            setCurrentView('home');
          }}
          onSelectAlbum={(album) => {
            setSelectedAlbum(album);
            setSelectedArtist(null);
            setCurrentView('home');
          }}
          activeTab={libraryActiveTab}
          onActiveTabChange={setLibraryActiveTab}
          selectedPlaylist={selectedPlaylist}
          onSelectPlaylist={setSelectedPlaylist}
          isOffline={!isOnline}
        />
      )}

      {currentView === 'settings' && (
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
          onBack={() => setCurrentView('home')}
        />
      )}

      {currentView !== 'settings' && (
        <MiniPlayer
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          onTogglePlay={togglePlayPause}
          onNext={triggerNextTrackLogic}
          onPrev={triggerPrevTrackLogic}
          onExpand={() => setShowFullPlayer(true)}
        />
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
          onToggleShuffle={() => setIsShuffle(!isShuffle)}
          onToggleRepeat={() => setIsRepeat(!isRepeat)}
          onSetSleepTimer={setSleepTimeLeft}
          onAddSongToPlaylist={addSongToPlaylist}
          onGoToAlbum={handleGoToAlbum}
          onGoToArtist={handleGoToArtist}
          onClose={() => setShowFullPlayer(false)}
        />
      )}

      {showProfile && (
        <ProfileDrawerView
          user={user}
          artists={artists}
          onLogout={handleLogout}
          onNavigateSettings={() => {
            setCurrentView('settings');
            setShowProfile(false);
          }}
          onGoToSavedArtists={() => {
            setLibraryActiveTab('artists');
            setCurrentView('library');
            setShowProfile(false);
          }}
          onUpdateProfile={handleUpdateProfile}
          onClose={() => setShowProfile(false)}
        />
      )}

      {currentView !== 'settings' && (
        <BottomNavigation currentView={currentView} onViewChange={setCurrentView} isOnline={isOnline} />
      )}
    </div>
  );
}