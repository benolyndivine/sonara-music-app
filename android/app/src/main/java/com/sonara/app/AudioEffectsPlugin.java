package com.sonara.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.media.audiofx.AudioEffect;
import android.media.audiofx.BassBoost;
import android.media.audiofx.Equalizer;
import android.media.audiofx.LoudnessEnhancer;
import android.media.audiofx.Virtualizer;
import android.os.Build;
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

        // Try global output mix session 0
        try {
            setupSessionEffects(0);
        } catch (Throwable t) {
            Log.d(TAG, "Global mix session 0 not allowed on this device: " + t.getMessage());
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

        for (SessionEffects fx : sessionEffectsMap.values()) {
            fx.release();
        }
        sessionEffectsMap.clear();
        instance = null;
    }

    /**
     * Called directly by AudioPlayer when a MediaPlayer is prepared.
     */
    public static void attachAudioSession(int sessionId) {
        if (sessionId <= 0) return;
        Log.i(TAG, "Attaching native audio session: " + sessionId);
        activeSessions.add(sessionId);
        if (instance != null) {
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
                if (dolbyAtmosEnabled) {
                    if (closestIdx == 0) gainDb += 4.5f;       // Sub-bass warmth
                    else if (closestIdx == 1) gainDb += 2.0f;  // Mid-bass body
                    else if (closestIdx == 3) gainDb += 2.5f;  // Vocal presence
                    else if (closestIdx == 4) gainDb += 4.0f;  // Spatial air
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
            boolean enable = spatialAudioEnabled || dolbyAtmosEnabled;
            if (enable) {
                virt.setEnabled(true);
                if (virt.getStrengthSupported()) {
                    virt.setStrength((short) 1000);
                }
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    try {
                        virt.forceVirtualizationMode(Virtualizer.VIRTUALIZATION_MODE_BINAURAL);
                    } catch (Exception ignored) {}
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
                        bb.setStrength((short) 800);
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
                le.setTargetGain(650); // +6.5 dB dynamic acoustic contouring
            } else if (normalizeVolumeEnabled) {
                le.setEnabled(true);
                le.setTargetGain(350); // +3.5 dB standard volume normalization
            } else {
                le.setEnabled(false);
            }
        } catch (Exception e) {
            Log.w(TAG, "Error applying LoudnessEnhancer on session " + session.sessionId + ": " + e.getMessage());
        }
    }

    private void updateAllSessions() {
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
