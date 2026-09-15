import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  GoogleAuthProvider, 
  setPersistence, 
  browserLocalPersistence 
} from "firebase/auth";
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD2YLR69nbB9tHatBRe3Re2-EcNM5yl3vc",
  authDomain: "sonara-95818.web.app",
  projectId: "sonara-95818",
  storageBucket: "sonara-95818.appspot.com",
  messagingSenderId: "614356545369",
  appId: "1:614356545369:web:188faea4e2df79a2dba648"
};

// Initialize Firebase Core
const app = initializeApp(firebaseConfig);

// Initialize Services
// 🛠️ FIX: getFirestore(app) had no offline cache configured, so onSnapshot
// listeners had nothing to read from with zero network — opening the app
// fully offline left songs/playlists/playlistSongs stuck at [] forever,
// which made the Library's Downloaded tab look empty even though the
// tracks were still cached on-device. persistentLocalCache lets Firestore
// serve the last-synced data straight from IndexedDB while offline.
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});
const auth = getAuth(app);

// 🚀 THE FIX: Force local storage persistence so the state survives redirect jumps
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log("Auth persistence initialized to Local Storage successfully.");
  })
  .catch((err) => {
    console.error("Error setting persistence: ", err);
  });

const provider = new GoogleAuthProvider();
// Forces the user selection menu to prevent automatic silent drops
provider.setCustomParameters({ prompt: 'select_account' });

export { db, auth, provider };