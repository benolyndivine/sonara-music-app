import { registerPlugin, WebPlugin } from '@capacitor/core';

// Browsers have no reliable, permission-free way to tell "this audio is
// playing through a Bluetooth car stereo" vs. a laptop speaker, so on web
// this just reports "unsupported" rather than guessing. The native Android
// implementation (AudioRouteInfoPlugin.java) is the real source of truth.
class AudioRouteInfoWeb extends WebPlugin {
  async getStatus() {
    return { connected: false, deviceType: 'unsupported', deviceName: null };
  }

  async openBluetoothSettings() {
    // No web equivalent to Android's Bluetooth settings screen.
  }
}

const AudioRouteInfo = registerPlugin('AudioRouteInfo', {
  web: () => new AudioRouteInfoWeb(),
});

// Shared display helpers so MiniPlayer and FullPlayerView render the
// connectivity indicator identically.
export function getRouteIconClass(deviceType) {
  switch (deviceType) {
    case 'bluetooth':
      return 'fa-brands fa-bluetooth-b';
    case 'wired':
      return 'fa-solid fa-headphones';
    case 'speaker':
      return 'fa-solid fa-volume-high';
    default:
      return 'fa-solid fa-circle-question';
  }
}

export function getRouteLabel(audioRoute) {
  if (!audioRoute || audioRoute.deviceType === 'unsupported') return null;
  if (!audioRoute.connected) return 'Not connected';
  switch (audioRoute.deviceType) {
    case 'bluetooth':
      return audioRoute.deviceName || 'Bluetooth device';
    case 'wired':
      return audioRoute.deviceName || 'Wired headphones';
    case 'speaker':
      return 'Phone speaker';
    default:
      return audioRoute.deviceName || 'Connected';
  }
}

export default AudioRouteInfo;