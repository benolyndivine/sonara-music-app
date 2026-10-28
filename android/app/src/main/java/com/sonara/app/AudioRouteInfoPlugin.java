package com.sonara.app;

import android.Manifest;
import android.bluetooth.BluetoothA2dp;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothHeadset;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
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
import com.getcapacitor.annotation.Permission;
import java.lang.reflect.Method;
import java.util.List;
import java.util.Set;

/**
 * Reports which audio output the phone is currently routed to — a Bluetooth
 * car/headset, a wired headset, or the built-in speaker — so the UI can show
 * "Connected to <device>" the same way Spotify does.
 */
@CapacitorPlugin(
    name = "AudioRouteInfo",
    permissions = {
        @Permission(
            alias = "bluetooth",
            strings = { Manifest.permission.BLUETOOTH_CONNECT }
        )
    }
)
public class AudioRouteInfoPlugin extends Plugin {

    private AudioDeviceCallback deviceCallback;
    private BluetoothAdapter bluetoothAdapter;
    private BluetoothA2dp bluetoothA2dp;
    private BluetoothHeadset bluetoothHeadset;
    private BroadcastReceiver audioRouteReceiver;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    @Override
    public void load() {
        super.load();

        Context context = getContext();
        if (context == null) return;

        // 1. Audio Device Callback (API 23+)
        AudioManager audioManager = getAudioManager();
        if (audioManager != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            deviceCallback = new AudioDeviceCallback() {
                @Override
                public void onAudioDevicesAdded(AudioDeviceInfo[] addedDevices) {
                    notifyRouteChangedWithDelay();
                }

                @Override
                public void onAudioDevicesRemoved(AudioDeviceInfo[] removedDevices) {
                    notifyRouteChangedWithDelay();
                }
            };
            audioManager.registerAudioDeviceCallback(deviceCallback, mainHandler);
        }

        // 2. Initialize Bluetooth Profile Proxies for precise device name retrieval
        try {
            BluetoothManager bm = (BluetoothManager) context.getSystemService(Context.BLUETOOTH_SERVICE);
            bluetoothAdapter = bm != null ? bm.getAdapter() : BluetoothAdapter.getDefaultAdapter();

            if (bluetoothAdapter != null) {
                bluetoothAdapter.getProfileProxy(context, new BluetoothProfile.ServiceListener() {
                    @Override
                    public void onServiceConnected(int profile, BluetoothProfile proxy) {
                        if (profile == BluetoothProfile.A2DP) {
                            bluetoothA2dp = (BluetoothA2dp) proxy;
                        } else if (profile == BluetoothProfile.HEADSET) {
                            bluetoothHeadset = (BluetoothHeadset) proxy;
                        }
                        notifyRouteChanged();
                    }

                    @Override
                    public void onServiceDisconnected(int profile) {
                        if (profile == BluetoothProfile.A2DP) {
                            bluetoothA2dp = null;
                        } else if (profile == BluetoothProfile.HEADSET) {
                            bluetoothHeadset = null;
                        }
                        notifyRouteChanged();
                    }
                }, BluetoothProfile.A2DP);

                bluetoothAdapter.getProfileProxy(context, new BluetoothProfile.ServiceListener() {
                    @Override
                    public void onServiceConnected(int profile, BluetoothProfile proxy) {
                        if (profile == BluetoothProfile.HEADSET) {
                            bluetoothHeadset = (BluetoothHeadset) proxy;
                        }
                        notifyRouteChanged();
                    }

                    @Override
                    public void onServiceDisconnected(int profile) {
                        if (profile == BluetoothProfile.HEADSET) {
                            bluetoothHeadset = null;
                        }
                        notifyRouteChanged();
                    }
                }, BluetoothProfile.HEADSET);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        // 3. BroadcastReceiver for Bluetooth & Wired Headset connection changes
        try {
            IntentFilter filter = new IntentFilter();
            filter.addAction(BluetoothDevice.ACTION_ACL_CONNECTED);
            filter.addAction(BluetoothDevice.ACTION_ACL_DISCONNECTED);
            filter.addAction(BluetoothA2dp.ACTION_CONNECTION_STATE_CHANGED);
            filter.addAction(BluetoothA2dp.ACTION_PLAYING_STATE_CHANGED);
            filter.addAction(BluetoothHeadset.ACTION_CONNECTION_STATE_CHANGED);
            filter.addAction(AudioManager.ACTION_AUDIO_BECOMING_NOISY);
            filter.addAction(Intent.ACTION_HEADSET_PLUG);

            audioRouteReceiver = new BroadcastReceiver() {
                @Override
                public void onReceive(Context ctx, Intent intent) {
                    notifyRouteChangedWithDelay();
                }
            };

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                context.registerReceiver(audioRouteReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
            } else {
                context.registerReceiver(audioRouteReceiver, filter);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();

        Context context = getContext();
        if (context != null && audioRouteReceiver != null) {
            try {
                context.unregisterReceiver(audioRouteReceiver);
            } catch (Exception ignored) {}
            audioRouteReceiver = null;
        }

        AudioManager audioManager = getAudioManager();
        if (audioManager != null && deviceCallback != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                audioManager.unregisterAudioDeviceCallback(deviceCallback);
            } catch (Exception ignored) {}
            deviceCallback = null;
        }

        if (bluetoothAdapter != null) {
            try {
                if (bluetoothA2dp != null) bluetoothAdapter.closeProfileProxy(BluetoothProfile.A2DP, bluetoothA2dp);
                if (bluetoothHeadset != null) bluetoothAdapter.closeProfileProxy(BluetoothProfile.HEADSET, bluetoothHeadset);
            } catch (Exception ignored) {}
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

    private void notifyRouteChangedWithDelay() {
        notifyRouteChanged();
        // Fire again after 350ms to allow Bluetooth audio routing to settle
        mainHandler.postDelayed(() -> notifyRouteChanged(), 350);
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
     * Resolves the human-readable device name of the active Bluetooth device
     * via A2DP profile, Headset profile, or paired/bonded devices.
     */
    private String getConnectedBluetoothDeviceName() {
        // 1. Query A2DP connected devices
        if (bluetoothA2dp != null) {
            try {
                List<BluetoothDevice> connected = bluetoothA2dp.getConnectedDevices();
                if (connected != null && !connected.isEmpty()) {
                    for (BluetoothDevice dev : connected) {
                        String name = getBtDeviceName(dev);
                        if (name != null && !name.isEmpty()) return name;
                    }
                }
            } catch (SecurityException ignored) {}
        }

        // 2. Query Headset connected devices
        if (bluetoothHeadset != null) {
            try {
                List<BluetoothDevice> connected = bluetoothHeadset.getConnectedDevices();
                if (connected != null && !connected.isEmpty()) {
                    for (BluetoothDevice dev : connected) {
                        String name = getBtDeviceName(dev);
                        if (name != null && !name.isEmpty()) return name;
                    }
                }
            } catch (SecurityException ignored) {}
        }

        // 3. Query bonded/paired devices checking active connection state
        if (bluetoothAdapter != null) {
            try {
                Set<BluetoothDevice> bonded = bluetoothAdapter.getBondedDevices();
                if (bonded != null) {
                    for (BluetoothDevice dev : bonded) {
                        try {
                            Method isConnectedMethod = dev.getClass().getMethod("isConnected");
                            boolean isConnected = (boolean) isConnectedMethod.invoke(dev);
                            if (isConnected) {
                                String name = getBtDeviceName(dev);
                                if (name != null && !name.isEmpty()) return name;
                            }
                        } catch (Exception ignored) {}
                    }
                }
            } catch (SecurityException ignored) {}
        }

        return null;
    }

    private String getBtDeviceName(BluetoothDevice device) {
        if (device == null) return null;
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                String alias = device.getAlias();
                if (alias != null && !alias.trim().isEmpty()) {
                    return alias.trim();
                }
            }
            String name = device.getName();
            if (name != null && !name.trim().isEmpty()) {
                return name.trim();
            }
        } catch (SecurityException ignored) {}
        return null;
    }

    /**
     * Inspects active routing: Bluetooth > Wired > Phone Speaker
     */
    private JSObject buildStatus() {
        JSObject result = new JSObject();
        AudioManager audioManager = getAudioManager();

        if (audioManager == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            result.put("connected", false);
            result.put("deviceType", "unsupported");
            result.put("deviceName", JSObject.NULL);
            result.put("name", JSObject.NULL);
            return result;
        }

        AudioDeviceInfo[] devices = audioManager.getDevices(AudioManager.GET_DEVICES_OUTPUTS);

        AudioDeviceInfo bluetoothAudioDevice = null;
        AudioDeviceInfo wiredDevice = null;
        boolean hasSpeaker = false;

        for (AudioDeviceInfo device : devices) {
            int type = device.getType();

            boolean isBluetooth =
                type == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP ||
                type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO ||
                (Build.VERSION.SDK_INT >= 28 && type == AudioDeviceInfo.TYPE_HEARING_AID) ||
                (Build.VERSION.SDK_INT >= 31 && type == AudioDeviceInfo.TYPE_BLE_HEADSET) ||
                (Build.VERSION.SDK_INT >= 31 && type == AudioDeviceInfo.TYPE_BLE_SPEAKER) ||
                (Build.VERSION.SDK_INT >= 33 && type == AudioDeviceInfo.TYPE_BLE_BROADCAST);

            boolean isWired =
                type == AudioDeviceInfo.TYPE_WIRED_HEADSET ||
                type == AudioDeviceInfo.TYPE_WIRED_HEADPHONES ||
                type == AudioDeviceInfo.TYPE_USB_HEADSET ||
                type == AudioDeviceInfo.TYPE_USB_DEVICE;

            if (isBluetooth && bluetoothAudioDevice == null) {
                bluetoothAudioDevice = device;
            } else if (isWired && wiredDevice == null) {
                wiredDevice = device;
            } else if (type == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER) {
                hasSpeaker = true;
            }
        }

        // Direct AudioManager checks (vital fallback for Vivo OriginOS, MIUI, ColorOS)
        boolean a2dpOn = false;
        boolean scoOn = false;
        try {
            a2dpOn = audioManager.isBluetoothA2dpOn();
            scoOn = audioManager.isBluetoothScoOn();
        } catch (Exception ignored) {}

        String btDeviceName = getConnectedBluetoothDeviceName();
        boolean isBluetoothActive = (bluetoothAudioDevice != null) || a2dpOn || scoOn || (btDeviceName != null);

        if (isBluetoothActive) {
            String finalName = btDeviceName;
            if (finalName == null || finalName.isEmpty()) {
                if (bluetoothAudioDevice != null) {
                    finalName = deviceLabel(bluetoothAudioDevice);
                }
            }
            if (finalName == null || finalName.isEmpty() || finalName.equalsIgnoreCase("Bluetooth device")) {
                if (bluetoothAudioDevice != null && bluetoothAudioDevice.getProductName() != null) {
                    String pName = bluetoothAudioDevice.getProductName().toString().trim();
                    if (!pName.isEmpty()) finalName = pName;
                }
            }
            if (finalName == null || finalName.isEmpty()) {
                finalName = "Bluetooth Audio";
            }

            result.put("connected", true);
            result.put("deviceType", "bluetooth");
            result.put("deviceName", finalName);
            result.put("name", finalName);
        } else if (wiredDevice != null) {
            result.put("connected", true);
            result.put("deviceType", "wired");
            String wiredName = deviceLabel(wiredDevice);
            result.put("deviceName", wiredName);
            result.put("name", wiredName);
        } else if (hasSpeaker) {
            result.put("connected", true);
            result.put("deviceType", "speaker");
            result.put("deviceName", "Phone Speaker");
            result.put("name", "Phone Speaker");
        } else {
            result.put("connected", false);
            result.put("deviceType", "unknown");
            result.put("deviceName", JSObject.NULL);
            result.put("name", JSObject.NULL);
        }

        return result;
    }

    private String deviceLabel(AudioDeviceInfo device) {
        if (device == null) return "Connected Device";
        CharSequence name = device.getProductName();
        if (name == null || name.toString().trim().isEmpty()) {
            return "Bluetooth device";
        }
        return name.toString().trim();
    }
}
