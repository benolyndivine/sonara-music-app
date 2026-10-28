import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

export const CURRENT_APP_VERSION = '1.5.0';
export const CURRENT_APP_BUILD = '2026.10';

/**
 * Compare two semver strings (e.g., '1.4.2' vs '1.4.1').
 * Returns:
 *   1 if v1 > v2
 *  -1 if v1 < v2
 *   0 if v1 === v2
 */
export function compareSemver(v1, v2) {
  if (!v1 && !v2) return 0;
  if (!v1) return -1;
  if (!v2) return 1;

  const clean = (v) => v.toString().replace(/^v/i, '').trim();
  const parts1 = clean(v1).split('.').map((p) => parseInt(p, 10) || 0);
  const parts2 = clean(v2).split('.').map((p) => parseInt(p, 10) || 0);

  const maxLen = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < maxLen; i++) {
    const p1 = parts1[i] ?? 0;
    const p2 = parts2[i] ?? 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

/**
 * Returns true if remoteVersion is strictly newer than currentVersion.
 */
export function isNewerVersion(remoteVersion, currentVersion = CURRENT_APP_VERSION) {
  return compareSemver(remoteVersion, currentVersion) > 0;
}

/**
 * Perform a live check against Firestore: settings/appVersion
 */
export async function fetchUpdateFromDatabase() {
  try {
    const docRef = doc(db, 'settings', 'appVersion');
    const snap = await getDoc(docRef);

    if (snap.exists()) {
      const data = snap.data();
      const hasUpdate = isNewerVersion(data.version, CURRENT_APP_VERSION);
      return {
        success: true,
        exists: true,
        data,
        hasUpdate,
        version: data.version || '1.0.0',
        currentVersion: CURRENT_APP_VERSION,
        notes: data.notes || '',
        url: data.url || '',
        releaseDate: data.releaseDate || null,
        source: 'Firebase Firestore (settings/appVersion)',
        timestamp: Date.now()
      };
    } else {
      return {
        success: true,
        exists: false,
        hasUpdate: false,
        version: CURRENT_APP_VERSION,
        currentVersion: CURRENT_APP_VERSION,
        notes: 'No release record found in database.',
        source: 'Firebase Firestore (settings/appVersion)',
        timestamp: Date.now()
      };
    }
  } catch (err) {
    console.error('Failed to fetch update from database:', err);
    return {
      success: false,
      error: err.message || 'Network error connecting to database',
      hasUpdate: false,
      currentVersion: CURRENT_APP_VERSION,
      source: 'Firebase Firestore (settings/appVersion)',
      timestamp: Date.now()
    };
  }
}

/**
 * Admin helper to publish an app update version directly to Firestore
 */
export async function publishAppUpdateToDatabase({ version, notes, url, releaseDate }) {
  const docRef = doc(db, 'settings', 'appVersion');
  const payload = {
    version: version.trim(),
    notes: (notes || '').trim(),
    url: (url || '').trim(),
    releaseDate: releaseDate || new Date().toISOString().split('T')[0],
    updatedAt: Date.now()
  };
  await setDoc(docRef, payload, { merge: true });
  return payload;
}

/**
 * Dispatches an instant system notification (Android local notification or Web Notification)
 * when an update arrives from the database.
 */
export async function notifyAppUpdate(updateData) {
  if (!updateData || !updateData.version) return;

  // Prevent spamming the notification tray repeatedly for the exact same version
  const versionKey = `sonara_notified_sys_update_${updateData.version}`;
  try {
    if (localStorage.getItem(versionKey) === 'true') {
      return;
    }
  } catch {}

  const title = `🚀 Sonara Update Available: v${updateData.version}`;
  const body = updateData.notes
    ? `New update from database: ${updateData.notes}`
    : `Version v${updateData.version} is now available in the database. Tap to download!`;

  if (Capacitor.isNativePlatform()) {
    try {
      const permStatus = await LocalNotifications.checkPermissions();
      if (permStatus.display !== 'granted') {
        const req = await LocalNotifications.requestPermissions();
        if (req.display !== 'granted') return;
      }

      await LocalNotifications.schedule({
        notifications: [
          {
            id: 99101,
            title,
            body,
            largeBody: updateData.notes || 'Tap to download and install the latest APK update.',
            summaryText: 'Cloud Database Release',
            schedule: { at: new Date(Date.now() + 600) },
            sound: null,
            smallIcon: 'ic_launcher',
            extra: {
              version: updateData.version,
              url: updateData.url || ''
            }
          }
        ]
      });

      try {
        localStorage.setItem(versionKey, 'true');
      } catch {}
    } catch (err) {
      console.warn('Native LocalNotifications failed:', err);
    }
  } else if (typeof window !== 'undefined' && 'Notification' in window) {
    try {
      if (Notification.permission === 'granted') {
        new Notification(title, {
          body,
          icon: '/assets/logo3-Dd1xPj5q.png'
        });
        try {
          localStorage.setItem(versionKey, 'true');
        } catch {}
      } else if (Notification.permission !== 'denied') {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
          new Notification(title, {
            body,
            icon: '/assets/logo3-Dd1xPj5q.png'
          });
          try {
            localStorage.setItem(versionKey, 'true');
          } catch {}
        }
      }
    } catch (e) {
      console.warn('Web Notification failed:', e);
    }
  }
}

// Global action handler for tapping native update notification
if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
  try {
    LocalNotifications.addListener('localNotificationActionPerformed', (notificationAction) => {
      const url = notificationAction.notification?.extra?.url;
      if (url) {
        window.open(url, '_blank');
      }
    });
  } catch (err) {
    console.warn('Could not register local notification action listener:', err);
  }
}
