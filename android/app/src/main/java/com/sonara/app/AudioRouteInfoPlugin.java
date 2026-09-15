package com.sonara.app;

import android.content.Context;
import android.content.Intent;
import android.media.AudioDeviceCallback;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Reports which audio output the phone is currently routed to — a Bluetooth
 * car/headset, a wired headset, or the built-in speaker — so the UI can show
 * "Connected to <device>" the same way Spotify does. This intentionally does
 * NOT require the BLUETOOTH_CONNECT runtime permission: AudioManager already
 * exposes the routable/connected output devices without it (that permission
 * is only needed for scanning/pairing new devices, not for reading the
 * current audio route).
 */
@CapacitorPlugin(name = "AudioRouteInfo")
public class AudioRouteInfoPlugin extends Plugin {

    private AudioDeviceCallback deviceCallback;

    @Override
    public void load() {
        super.load();

        AudioManager audioManager = getAudioManager();
        if (audioManager == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            return;
        }

        deviceCallback = new AudioDeviceCallback() {
            @Override
            public void onAudioDevicesAdded(AudioDeviceInfo[] addedDevices) {
                notifyRouteChanged();
            }

            @Override
            public void onAudioDevicesRemoved(AudioDeviceInfo[] removedDevices) {
                notifyRouteChanged();
            }
        };
        audioManager.registerAudioDeviceCallback(deviceCallback, new Handler(Looper.getMainLooper()));
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        AudioManager audioManager = getAudioManager();
        if (audioManager != null && deviceCallback != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            audioManager.unregisterAudioDeviceCallback(deviceCallback);
        }
    }

    private AudioManager getAudioManager() {
        Context context = getContext();
        if (context == null) return null;
        return (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
    }

    private void notifyRouteChanged() {
        notifyListeners("audioRouteChanged", buildStatus());
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        call.resolve(buildStatus());
    }

    @PluginMethod
    public void openBluetoothSettings(PluginCall call) {
        Context context = getContext();
        if (context == null) {
            call.reject("No context available");
            return;
        }
        try {
            Intent intent = new Intent(android.provider.Settings.ACTION_BLUETOOTH_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
            call.resolve();
        } catch (Exception ex) {
            call.reject("Could not open Bluetooth settings", ex);
        }
    }

    /**
     * Picks the "most relevant" currently-connected output device, in the
     * order a person would care about: an actively-streaming Bluetooth
     * device (car stereo / headset) first, then a wired connection, then
     * whatever built-in output the phone would otherwise use.
     */
    private JSObject buildStatus() {
        JSObject result = new JSObject();
        AudioManager audioManager = getAudioManager();

        if (audioManager == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            result.put("connected", false);
            result.put("deviceType", "unsupported");
            result.put("deviceName", JSObject.NULL);
            return result;
        }

        AudioDeviceInfo[] devices = audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS);

        AudioDeviceInfo bluetoothDevice = null;
        AudioDeviceInfo wiredDevice = null;
        boolean hasSpeaker = false;

        for (AudioDeviceInfo device : devices) {
            int type = device.getType();

            boolean isBluetooth =
                type == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP ||
                type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO ||
                (Build.VERSION.SDK_INT >= 31 && type == AudioDeviceInfo.TYPE_BLE_HEADSET) ||
                (Build.VERSION.SDK_INT >= 31 && type == AudioDeviceInfo.TYPE_BLE_SPEAKER);

            boolean isWired =
                type == AudioDeviceInfo.TYPE_WIRED_HEADSET ||
                type == AudioDeviceInfo.TYPE_WIRED_HEADPHONES ||
                type == AudioDeviceInfo.TYPE_USB_HEADSET ||
                type == AudioDeviceInfo.TYPE_USB_DEVICE;

            if (isBluetooth && bluetoothDevice == null) {
                bluetoothDevice = device;
            } else if (isWired && wiredDevice == null) {
                wiredDevice = device;
            } else if (type == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER) {
                hasSpeaker = true;
            }
        }

        if (bluetoothDevice != null) {
            result.put("connected", true);
            result.put("deviceType", "bluetooth");
            result.put("deviceName", deviceLabel(bluetoothDevice));
        } else if (wiredDevice != null) {
            result.put("connected", true);
            result.put("deviceType", "wired");
            result.put("deviceName", deviceLabel(wiredDevice));
        } else if (hasSpeaker) {
            result.put("connected", true);
            result.put("deviceType", "speaker");
            result.put("deviceName", "Phone speaker");
        } else {
            result.put("connected", false);
            result.put("deviceType", "unknown");
            result.put("deviceName", JSObject.NULL);
        }

        return result;
    }

    private String deviceLabel(AudioDeviceInfo device) {
        CharSequence name = device.getProductName();
        if (name == null || name.toString().trim().isEmpty()) {
            return "Bluetooth device";
        }
        return name.toString().trim();
    }
}