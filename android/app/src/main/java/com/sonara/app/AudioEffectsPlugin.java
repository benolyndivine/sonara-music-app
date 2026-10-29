package com.sonara.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.media.AudioDeviceInfo;
import android.media.AudioDeviceCallback;
import android.media.AudioManager;
import android.media.audiofx.AudioEffect;
import android.media.audiofx.BassBoost;
import android.media.audiofx.Equalizer;
import android.media.audiofx.LoudnessEnhancer;
import android.media.audiofx.Virtualizer;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Collections;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Native Android Audio Effects Engine for Sonara.
 * Directly attaches hardware DSP audio effects (Equalizer, 3D Spatial Virtualizer,
 * BassBoost, and LoudnessEnhancer) to active MediaPlayer and audio session streams.
 */
@CapacitorPlugin(name = "AudioEffects")
public class AudioEffectsPlugin extends Plugin {

    private static final String TAG = "AudioEffectsPlugin";
    private static AudioEffectsPlugin instance;

    // Active audio session IDs registered from MediaPlayer
    private static final Set<Integer> activeSessions = Collections.synchronizedSet(new HashSet<>());
    private static final Map<Integer, SessionEffects> sessionEffectsMap = new ConcurrentHashMap<>();

    // Frequency targets matching Sonara's 5-band UI: 60Hz, 250Hz, 1kHz, 4kHz, 12kHz
    private static final int[] FREQ_TARGETS = new int[]{ 60, 250, 1000, 4000, 12000 };

    // Cached state
    private static volatile float[] currentBands = new float[]{ 0f, 0f, 0f, 0f, 0f };
    private static volatile boolean spatialAudioEnabled = false;
    private static volatile boolean dolbyAtmosEnabled = false;
    private static volatile boolean normalizeVolumeEnabled = true;

    private BroadcastReceiver audioSessionReceiver;
    private AudioDeviceCallback audioDeviceCallback;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private static class SessionEffects {
        final int sessionId;
        Equalizer equalizer;
        Virtualizer virtualizer;
        BassBoost bassBoost;
        LoudnessEnhancer loudnessEnhancer;

        SessionEffects(int sessionId) {
            this.sessionId = sessionId;
        }

        void release() {
            if (equalizer != null) {
                try { equalizer.setEnabled(false); equalizer.release(); } catch (Exception ignored) {}
                equalizer = null;
            }
            if (virtualizer != null) {
                try { virtualizer.setEnabled(false); virtualizer.release(); } catch (Exception ignored) {}
                virtualizer = null;
            }
            if (bassBoost != null) {
                try { bassBoost.setEnabled(false); bassBoost.release(); } catch (Exception ignored) {}
                bassBoost = null;
            }
            if (loudnessEnhancer != null) {
                try { loudnessEnhancer.setEnabled(false); loudnessEnhancer.release(); } catch (Exception ignored) {}
                loudnessEnhancer = null;
            }
        }
    }

    @Override
    public void load() {
        super.load();
        instance = this;

        Context context = getContext();
        if (context == null) return;

        // Listen for system and player session broadcasts
        try {
            IntentFilter filter = new IntentFilter();
            filter.addAction(AudioEffect.ACTION_OPEN_AUDIO_EFFECT_CONTROL_SESSION);
            filter.addAction(AudioEffect.ACTION_CLOSE_AUDIO_EFFECT_CONTROL_SESSION);

            audioSessionReceiver = new BroadcastReceiver() {
                @Override
                public void onReceive(Context ctx, Intent intent) {
                    if (intent == null) return;
                    String action = intent.getAction();
                    int sessionId = intent.getIntExtra(AudioEffect.EXTRA_AUDIO_SESSION, AudioEffect.ERROR_BAD_VALUE);
                    if (sessionId == AudioEffect.ERROR_BAD_VALUE || sessionId == 0) return;

                    if (AudioEffect.ACTION_OPEN_AUDIO_EFFECT_CONTROL_SESSION.equals(action)) {
                        attachAudioSession(sessionId);
                    } else if (AudioEffect.ACTION_CLOSE_AUDIO_EFFECT_CONTROL_SESSION.equals(action)) {
                        detachAudioSession(sessionId);
                    }
                }
            };

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                context.registerReceiver(audioSessionReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
            } else {
                context.registerReceiver(audioSessionReceiver, filter);
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not register audio session receiver: " + e.getMessage());
        }

        // Register audio routing changes to dynamically adapt Virtualizer (headphones vs phone speaker)
        try {
            AudioManager am = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
            if (am != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                audioDeviceCallback = new AudioDeviceCallback() {
                    @Override
                    public void onAudioDevicesAdded(AudioDeviceInfo[] addedDevices) {
                        mainHandler.post(() -> updateAllSessions());
                    }

                    @Override
                    public void onAudioDevicesRemoved(AudioDeviceInfo[] removedDevices) {
                        mainHandler.post(() -> updateAllSessions());
                    }
                };
                am.registerAudioDeviceCallback(audioDeviceCallback, mainHandler);
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not register audio device callback: " + e.getMessage());
        }

        // Apply any pending active sessions
        for (Integer sess : new HashSet<>(activeSessions)) {
            setupSessionEffects(sess);
        }
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        Context context = getContext();
        if (context != null && audioSessionReceiver != null) {
            try {
                context.unregisterReceiver(audioSessionReceiver);
            } catch (Exception ignored) {}
            audioSessionReceiver = null;
        }

        if (context != null && audioDeviceCallback != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                AudioManager am = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
                if (am != null) {
                    am.unregisterAudioDeviceCallback(audioDeviceCallback);
                }
            } catch (Exception ignored) {}
            audioDeviceCallback = null;
        }

        for (SessionEffects fx : sessionEffectsMap.values()) {
            fx.release();
        }
        sessionEffectsMap.clear();
        instance = null;
    }

    /**
     * Helper to detect if headphones or Bluetooth audio are connected
     */
    private boolean isHeadphonesOrBluetoothConnected() {
        Context context = getContext();
        if (context == null) return false;
        try {
            AudioManager am = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
            if (am == null) return false;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                AudioDeviceInfo[] devices = am.getDevices(AudioManager.GET_DEVICES_OUTPUTS);
                for (AudioDeviceInfo dev : devices) {
                    int type = dev.getType();
                    if (type == AudioDeviceInfo.TYPE_WIRED_HEADSET ||
                        type == AudioDeviceInfo.TYPE_WIRED_HEADPHONES ||
                        type == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP ||
                        type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO ||
                        type == AudioDeviceInfo.TYPE_USB_HEADSET ||
                        type == AudioDeviceInfo.TYPE_LINE_ANALOG ||
                        type == AudioDeviceInfo.TYPE_LINE_DIGITAL ||
                        type == AudioDeviceInfo.TYPE_AUX_LINE ||
                        type == AudioDeviceInfo.TYPE_HEARING_AID) {
                        return true;
                    }
                }
                return false;
            } else {
                return am.isWiredHeadsetOn() || am.isBluetoothA2dpOn();
            }
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Called directly by AudioPlayer when a MediaPlayer is prepared.
     */
    public static void attachAudioSession(int sessionId) {
        if (sessionId <= 0) return;
        Log.i(TAG, "Attaching native audio session: " + sessionId);
        activeSessions.add(sessionId);
        if (instance != null) {
            // Remove global session 0 so effects are never cascaded / doubled!
            instance.removeSessionEffects(0);
            instance.setupSessionEffects(sessionId);
        }
    }

    /**
     * Called directly by AudioPlayer when a MediaPlayer is released/stopped.
     */
    public static void detachAudioSession(int sessionId) {
        if (sessionId <= 0) return;
        Log.i(TAG, "Detaching native audio session: " + sessionId);
        activeSessions.remove(sessionId);
        if (instance != null) {
            instance.removeSessionEffects(sessionId);
        }
    }

    private synchronized void setupSessionEffects(int sessionId) {
        try {
            // Prevent setting up session 0 if active player sessions already exist
            if (sessionId == 0 && !activeSessions.isEmpty()) {
                return;
            }

            SessionEffects session = sessionEffectsMap.get(sessionId);
            if (session == null) {
                session = new SessionEffects(sessionId);

                // 1. Hardware Equalizer
                try {
                    session.equalizer = new Equalizer(1000, sessionId);
                } catch (Exception e) {
                    Log.w(TAG, "Equalizer init failed for session " + sessionId + ": " + e.getMessage());
                }

                // 2. Hardware 3D Spatial Virtualizer
                try {
                    session.virtualizer = new Virtualizer(1000, sessionId);
                } catch (Exception e) {
                    Log.w(TAG, "Virtualizer init failed for session " + sessionId + ": " + e.getMessage());
                }

                // 3. Hardware BassBoost for Dolby low-end acoustic punch
                try {
                    session.bassBoost = new BassBoost(1000, sessionId);
                } catch (Exception e) {
                    Log.w(TAG, "BassBoost init failed for session " + sessionId + ": " + e.getMessage());
                }

                // 4. Hardware LoudnessEnhancer for Dolby dynamic contouring & Normalization
                try {
                    session.loudnessEnhancer = new LoudnessEnhancer(sessionId);
                } catch (Exception e) {
                    Log.w(TAG, "LoudnessEnhancer init failed for session " + sessionId + ": " + e.getMessage());
                }

                sessionEffectsMap.put(sessionId, session);
            }

            applyAllEffectsToSession(session);
        } catch (Exception e) {
            Log.e(TAG, "Error in setupSessionEffects for session " + sessionId, e);
        }
    }

    private synchronized void removeSessionEffects(int sessionId) {
        SessionEffects session = sessionEffectsMap.remove(sessionId);
        if (session != null) {
            session.release();
        }
    }

    private void applyAllEffectsToSession(SessionEffects session) {
        if (session == null) return;
        applyEqualizer(session);
        applySpatialAudio(session);
        applyDolbyAtmos(session);
        applyLoudnessNormalization(session);
    }

    private void applyEqualizer(SessionEffects session) {
        Equalizer eq = session.equalizer;
        if (eq == null) return;

        try {
            short numBands = eq.getNumberOfBands();
            short[] range = eq.getBandLevelRange();
            if (range == null || range.length < 2) {
                range = new short[]{ -1500, 1500 };
            }

            boolean isFlat = true;
            for (float b : currentBands) {
                if (Math.abs(b) > 0.05f) {
                    isFlat = false;
                    break;
                }
            }

            for (short b = 0; b < numBands; b++) {
                int centerFreqHz = eq.getCenterFreq(b) / 1000;
                int closestIdx = 0;
                int minDiff = Integer.MAX_VALUE;
                for (int i = 0; i < FREQ_TARGETS.length; i++) {
                    int diff = Math.abs(centerFreqHz - FREQ_TARGETS[i]);
                    if (diff < minDiff) {
                        minDiff = diff;
                        closestIdx = i;
                    }
                }

                float gainDb = (closestIdx < currentBands.length) ? currentBands[closestIdx] : 0f;

                // When Dolby Atmos is active, add acoustic cinematic presence contouring
                // with dialogue clarity, sub-bass warmth, and spatial air without clipping
                if (dolbyAtmosEnabled) {
                    if (closestIdx == 0) gainDb += 1.5f;       // Sub-bass warmth (clean, non-clipping)
                    else if (closestIdx == 1) gainDb += 1.0f;  // Mid-bass body
                    else if (closestIdx == 3) gainDb += 2.5f;  // Vocal presence & dialogue clarity
                    else if (closestIdx == 4) gainDb += 3.0f;  // Spatial overhead air
                }

                short levelMb = (short) Math.round(gainDb * 100f);
                levelMb = (short) Math.max(range[0], Math.min(range[1], levelMb));
                eq.setBandLevel(b, levelMb);
            }

            eq.setEnabled(!isFlat || dolbyAtmosEnabled);
        } catch (Exception e) {
            Log.w(TAG, "Error applying Equalizer on session " + session.sessionId + ": " + e.getMessage());
        }
    }

    private void applySpatialAudio(SessionEffects session) {
        Virtualizer virt = session.virtualizer;
        if (virt == null) return;

        try {
            boolean isHeadphones = isHeadphonesOrBluetoothConnected();
            boolean enable = spatialAudioEnabled || (dolbyAtmosEnabled && isHeadphones);

            if (enable) {
                virt.setEnabled(true);

                if (isHeadphones) {
                    // Connected to earphones/headphones:
                    // Use a balanced strength (380 out of 1000) that gives a wide 3D concert stage
                    // without attenuating the center channel or causing comb-filtering volume drop!
                    if (virt.getStrengthSupported()) {
                        virt.setStrength((short) 380);
                    }
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        try {
                            virt.forceVirtualizationMode(Virtualizer.VIRTUALIZATION_MODE_BINAURAL);
                        } catch (Exception ignored) {}
                    }
                } else {
                    // Mobile phone internal speaker:
                    // NEVER force binaural mode on speakers — inverted phase cancels out center vocals & bass!
                    // Use transaural mode with subtle widening so volume stays 100% full and punchy.
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        try {
                            virt.forceVirtualizationMode(Virtualizer.VIRTUALIZATION_MODE_TRANSAURAL);
                        } catch (Exception ignored) {}
                    }
                    if (virt.getStrengthSupported()) {
                        virt.setStrength((short) 150);
                    }
                }
            } else {
                virt.setEnabled(false);
            }
        } catch (Exception e) {
            Log.w(TAG, "Error applying Virtualizer on session " + session.sessionId + ": " + e.getMessage());
        }
    }

    private void applyDolbyAtmos(SessionEffects session) {
        BassBoost bb = session.bassBoost;
        if (bb != null) {
            try {
                if (dolbyAtmosEnabled) {
                    bb.setEnabled(true);
                    if (bb.getStrengthSupported()) {
                        // Strength 300 provides rich, warm cinema low-end without overdriving
                        // the audio pipeline or triggering the system limiter ducking
                        bb.setStrength((short) 300);
                    }
                } else {
                    bb.setEnabled(false);
                }
            } catch (Exception e) {
                Log.w(TAG, "Error applying BassBoost on session " + session.sessionId + ": " + e.getMessage());
            }
        }
    }

    private void applyLoudnessNormalization(SessionEffects session) {
        LoudnessEnhancer le = session.loudnessEnhancer;
        if (le == null) return;

        try {
            if (dolbyAtmosEnabled) {
                le.setEnabled(true);
                // +5.0 dB clean loudness boost ensures music is loud, full, and punchy on mobile
                le.setTargetGain(500);
            } else if (normalizeVolumeEnabled) {
                le.setEnabled(true);
                // +3.5 dB standard volume normalization
                le.setTargetGain(350);
            } else {
                le.setEnabled(false);
            }
        } catch (Exception e) {
            Log.w(TAG, "Error applying LoudnessEnhancer on session " + session.sessionId + ": " + e.getMessage());
        }
    }

    private void updateAllSessions() {
        if (!activeSessions.isEmpty()) {
            removeSessionEffects(0);
        }
        for (SessionEffects s : sessionEffectsMap.values()) {
            applyAllEffectsToSession(s);
        }
    }

    // --- Plugin Methods exposed to JavaScript ---

    @PluginMethod
    public void setEqualizerBands(PluginCall call) {
        JSArray bandsArray = call.getArray("bands");
        if (bandsArray != null) {
            float[] newBands = new float[5];
            for (int i = 0; i < 5; i++) {
                try {
                    newBands[i] = (float) bandsArray.getDouble(i);
                } catch (Exception e) {
                    newBands[i] = 0f;
                }
            }
            currentBands = newBands;
            updateAllSessions();
        }
        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void setSpatialAudio(PluginCall call) {
        Boolean enabled = call.getBoolean("enabled", false);
        spatialAudioEnabled = Boolean.TRUE.equals(enabled);
        updateAllSessions();

        JSObject ret = new JSObject();
        ret.put("success", true);
        ret.put("spatialAudio", spatialAudioEnabled);
        call.resolve(ret);
    }

    @PluginMethod
    public void setDolbyAtmos(PluginCall call) {
        Boolean enabled = call.getBoolean("enabled", false);
        dolbyAtmosEnabled = Boolean.TRUE.equals(enabled);
        updateAllSessions();

        JSObject ret = new JSObject();
        ret.put("success", true);
        ret.put("dolbyAtmos", dolbyAtmosEnabled);
        call.resolve(ret);
    }

    @PluginMethod
    public void setNormalizeVolume(PluginCall call) {
        Boolean enabled = call.getBoolean("enabled", true);
        normalizeVolumeEnabled = Boolean.TRUE.equals(enabled);
        updateAllSessions();

        JSObject ret = new JSObject();
        ret.put("success", true);
        ret.put("normalizeVolume", normalizeVolumeEnabled);
        call.resolve(ret);
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("activeSessionCount", sessionEffectsMap.size());
        ret.put("spatialAudio", spatialAudioEnabled);
        ret.put("dolbyAtmos", dolbyAtmosEnabled);
        ret.put("normalizeVolume", normalizeVolumeEnabled);

        JSArray bands = new JSArray();
        try {
            for (float b : currentBands) bands.put((double) b);
        } catch (Exception ignored) {}
        ret.put("bands", bands);

        call.resolve(ret);
    }

    @PluginMethod
    public void openOriginIslandSettings(PluginCall call) {
        Context context = getContext();
        if (context == null) {
            call.reject("No context available");
            return;
        }
        try {
            Intent intent = new Intent(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS);
            intent.putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, context.getPackageName());
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            try {
                Intent fallback = new Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                fallback.setData(android.net.Uri.fromParts("package", context.getPackageName(), null));
                fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(fallback);
                call.resolve();
            } catch (Exception ex) {
                call.reject("Could not open notification settings", ex);
            }
        }
    }
}
