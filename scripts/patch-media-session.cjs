// scripts/patch-media-session.cjs
// Ensures @capgo/capacitor-media-session contains the necessary enhancements
// for rich Android notification center & lockscreen media controls (Spotify style)
// and background audio stability with WakeLock and ForegroundService compliance.

const fs = require('fs');
const path = require('path');

const pluginJavaPath = path.join(
  __dirname,
  '..',
  'node_modules',
  '@capgo',
  'capacitor-media-session',
  'android',
  'src',
  'main',
  'java',
  'com',
  'capgo',
  'mediasession',
  'MediaSessionPlugin.java'
);

const serviceJavaPath = path.join(
  __dirname,
  '..',
  'node_modules',
  '@capgo',
  'capacitor-media-session',
  'android',
  'src',
  'main',
  'java',
  'com',
  'capgo',
  'mediasession',
  'MediaSessionService.java'
);

if (fs.existsSync(pluginJavaPath)) {
  let content = fs.readFileSync(pluginJavaPath, 'utf8');

  // Accept state or playbackState
  if (!content.includes('String stateArg = call.getString("playbackState", null);')) {
    content = content.replace(
      'playbackState = call.getString("playbackState", playbackState);',
      `String stateArg = call.getString("playbackState", null);
        if (stateArg == null) {
            stateArg = call.getString("state", playbackState);
        }
        playbackState = stateArg != null ? stateArg : playbackState;`
    );
  }

  // Support local files & timeout in urlToBitmap
  if (!content.includes('url.startsWith("file://")')) {
    content = content.replace(
      'boolean httpUrl = url.startsWith("http");',
      `if (url.startsWith("file://")) {
            return BitmapFactory.decodeFile(url.substring(7));
        }

        if (url.startsWith("/") && !url.startsWith("//")) {
            return BitmapFactory.decodeFile(url);
        }

        boolean httpUrl = url.startsWith("http");`
    );
  }

  if (!content.includes('connection.setConnectTimeout(8000)')) {
    content = content.replace(
      'HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();',
      `HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
            connection.setConnectTimeout(8000);
            connection.setReadTimeout(8000);
            connection.setInstanceFollowRedirects(true);`
    );
  }

  if (!content.includes('FLAG_ACTIVITY_SINGLE_TOP')) {
    content = content.replace(
      'Intent launchIntent = new Intent(getActivity(), getActivity().getClass());',
      `Intent launchIntent = new Intent(getActivity(), getActivity().getClass());
            launchIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);`
    );
  }

  fs.writeFileSync(pluginJavaPath, content, 'utf8');
  console.log('[patch-media-session] MediaSessionPlugin.java verified/patched.');
}

if (fs.existsSync(serviceJavaPath)) {
  let content = fs.readFileSync(serviceJavaPath, 'utf8');

  // Ensure PowerManager import
  if (!content.includes('import android.os.PowerManager;')) {
    content = content.replace(
      'import androidx.media.session.MediaButtonReceiver;',
      `import android.content.Context;
import android.os.PowerManager;
import androidx.media.session.MediaButtonReceiver;`
    );
  }

  // Ensure SystemClock import
  if (!content.includes('import android.os.SystemClock;')) {
    content = content.replace(
      'import android.os.PowerManager;',
      `import android.os.PowerManager;
import android.os.SystemClock;`
    );
  }

  // Small icon resolution (ic_notification) & Category Transport for status bar capsules / Origin Island
  if (!content.includes('getResources().getIdentifier("ic_notification"')) {
    content = content.replace(
      '.setSmallIcon(R.drawable.ic_baseline_volume_up_24)',
      `int smallIcon = getResources().getIdentifier("ic_notification", "drawable", getPackageName());
        if (smallIcon == 0) {
            smallIcon = getResources().getIdentifier("ic_stat_name", "drawable", getPackageName());
        }
        if (smallIcon == 0) {
            smallIcon = R.drawable.ic_baseline_volume_up_24;
        }

        notificationStyle = new MediaStyle().setMediaSession(mediaSession.getSessionToken());
        notificationBuilder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setStyle(notificationStyle)
            .setSmallIcon(smallIcon)
            .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOnlyAlertOnce(true)`
    );
  } else if (!content.includes('.setCategory(NotificationCompat.CATEGORY_TRANSPORT)')) {
    content = content.replace(
      '.setSmallIcon(smallIcon)',
      `.setSmallIcon(smallIcon)
            .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOnlyAlertOnce(true)`
    );
  }

  // Ensure high priority notification channel for Vivo Origin Island & status bar
  if (content.includes('NotificationChannel(CHANNEL_ID, "Playback", NotificationManager.IMPORTANCE_LOW)')) {
    content = content.replace(
      'NotificationChannel(CHANNEL_ID, "Playback", NotificationManager.IMPORTANCE_LOW);',
      'NotificationChannel(CHANNEL_ID, "Playback", NotificationManager.IMPORTANCE_DEFAULT);\n            channel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);'
    );
  }

  // MediaSession flags for transport controls
  if (!content.includes('FLAG_HANDLES_TRANSPORT_CONTROLS')) {
    content = content.replace(
      'mediaSession.setActive(true);',
      `mediaSession.setFlags(MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS | MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS);
        mediaSession.setActive(true);`
    );
  }

  // Rich metadata art & display keys for Origin Island / OEM lockscreen capsules
  if (!content.includes('MediaMetadataCompat.METADATA_KEY_DISPLAY_TITLE')) {
    if (content.includes('MediaMetadataCompat.METADATA_KEY_ART')) {
      content = content.replace(
        '.putString(MediaMetadataCompat.METADATA_KEY_ALBUM, album);',
        `.putString(MediaMetadataCompat.METADATA_KEY_ALBUM, album)
                .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_TITLE, title)
                .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_SUBTITLE, artist != null && !artist.isEmpty() ? artist : album)
                .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_DESCRIPTION, album);`
      );
    } else {
      content = content.replace(
        `.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, artwork)
                .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, duration);`,
        `if (artwork != null) {
                  mediaMetadataBuilder
                      .putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, artwork)
                      .putBitmap(MediaMetadataCompat.METADATA_KEY_ART, artwork)
                      .putBitmap(MediaMetadataCompat.METADATA_KEY_DISPLAY_ICON, artwork);
              }

              mediaMetadataBuilder
                  .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_TITLE, title)
                  .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_SUBTITLE, artist != null && !artist.isEmpty() ? artist : album)
                  .putString(MediaMetadataCompat.METADATA_KEY_DISPLAY_DESCRIPTION, album)
                  .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, duration);`
      );
    }
  }

  // SystemClock elapsed real-time for dynamic island progress sync
  if (!content.includes('SystemClock.elapsedRealtime()')) {
    content = content.replace(
      'playbackStateBuilder.setState(playbackState, position, playbackSpeed);',
      'playbackStateBuilder.setState(playbackState, position, playbackSpeed, SystemClock.elapsedRealtime());'
    );
  }

  // Clean title & artist in notification
  if (!content.includes('.setOngoing(playbackState == PlaybackStateCompat.STATE_PLAYING)')) {
    content = content.replace(
      'notificationBuilder.setContentTitle(title).setContentText(artist + " - " + album).setLargeIcon(artwork);',
      `notificationBuilder
                .setContentTitle(title)
                .setContentText(artist != null && !artist.isEmpty() ? artist : album);

            if (album != null && !album.isEmpty() && !album.equals(artist)) {
                notificationBuilder.setSubText(album);
            }

            if (artwork != null) {
                notificationBuilder.setLargeIcon(artwork);
            }

            notificationBuilder
                .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setOngoing(playbackState == PlaybackStateCompat.STATE_PLAYING);`
    );
  }

  // WakeLock & onCreate & early startForeground
  if (!content.includes('private PowerManager.WakeLock wakeLock;')) {
    const target = `    public void destroy() {
        stopForeground(true);
        stopSelf();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (mediaSession != null) {
            MediaButtonReceiver.handleIntent(mediaSession, intent);
        }
        return super.onStartCommand(intent, flags, startId);
    }

    public void setPlaybackState(int newPlaybackState) {
        if (playbackState != newPlaybackState) {
            playbackState = newPlaybackState;
            playbackStateUpdate = true;
            possibleActionsUpdate = true;
        }
    }`;

    const replacement = `    private PowerManager.WakeLock wakeLock;

    private void acquireWakeLock() {
        try {
            if (wakeLock == null) {
                PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                if (pm != null) {
                    wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, TAG + ":wakelock");
                    wakeLock.setReferenceCounted(false);
                }
            }
            if (wakeLock != null && !wakeLock.isHeld()) {
                wakeLock.acquire();
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed to acquire wake lock", e);
        }
    }

    private void releaseWakeLock() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed to release wake lock", e);
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        notificationManager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && notificationManager != null) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Playback", NotificationManager.IMPORTANCE_DEFAULT);
            channel.setDescription("Music playback controls");
            channel.setShowBadge(false);
            channel.setSound(null, null);
            channel.setLockscreenVisibility(NotificationCompat.VISIBILITY_PUBLIC);
            notificationManager.createNotificationChannel(channel);
        }
    }

    public void destroy() {
        releaseWakeLock();
        stopForeground(true);
        stopSelf();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (mediaSession != null) {
            MediaButtonReceiver.handleIntent(mediaSession, intent);
        }

        try {
            if (notificationBuilder != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    startForeground(NOTIFICATION_ID, notificationBuilder.build(), ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
                } else {
                    startForeground(NOTIFICATION_ID, notificationBuilder.build());
                }
            } else {
                int smallIcon = getResources().getIdentifier("ic_notification", "drawable", getPackageName());
                if (smallIcon == 0) smallIcon = R.drawable.ic_baseline_volume_up_24;
                NotificationCompat.Builder earlyBuilder = new NotificationCompat.Builder(this, CHANNEL_ID)
                    .setSmallIcon(smallIcon)
                    .setContentTitle("Sonara")
                    .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
                    .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                    .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                    .setOngoing(true);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    startForeground(NOTIFICATION_ID, earlyBuilder.build(), ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
                } else {
                    startForeground(NOTIFICATION_ID, earlyBuilder.build());
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "Early startForeground call failed", e);
        }

        return super.onStartCommand(intent, flags, startId);
    }

    public void setPlaybackState(int newPlaybackState) {
        if (playbackState != newPlaybackState) {
            playbackState = newPlaybackState;
            playbackStateUpdate = true;
            possibleActionsUpdate = true;

            if (playbackState == PlaybackStateCompat.STATE_PLAYING) {
                acquireWakeLock();
            } else {
                releaseWakeLock();
            }
        }
    }`;

    content = content.replace(target, replacement);
  }

  fs.writeFileSync(serviceJavaPath, content, 'utf8');
  console.log('[patch-media-session] MediaSessionService.java verified/patched.');
}
