import { Geolocation } from '@capacitor/geolocation';
window.CyberpunkGeolocation = Geolocation;

import { StatusBar, Style } from '@capacitor/status-bar';
window.CyberpunkStatusBar = StatusBar;
if (window.Capacitor?.isNativePlatform?.()) {
  StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
  StatusBar.setBackgroundColor({ color: '#0b0c0f' }).catch(() => {});
  StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
}
