import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { StatusBar, Style } from '@capacitor/status-bar'
import type { Router } from 'vue-router'

/**
 * Everything that only makes sense inside a native shell lives here, behind
 * one `isNativePlatform()` guard. Called once from main.ts.
 */
export function registerNative(router: Router): void {
  // In the browser every one of these plugins is a no-op or a thrown
  // "not implemented" — bail before touching any of them.
  if (!Capacitor.isNativePlatform()) return

  // ── Android hardware / gesture back button ─────────────────────────
  // Without this listener, Android's back gesture closes the entire app
  // from ANY page — a fan three missions deep taps back once and loses
  // the app. Route back when vue-router has history, exit only at the root.
  App.addListener('backButton', () => {
    if (window.history.state?.back) {
      router.back()
    } else {
      App.exitApp()
    }
  })

  // Dark status bar content over the light shell header.
  StatusBar.setStyle({ style: Style.Light }).catch(() => {
    // Not supported on every device/OS combo; never worth crashing boot.
  })
}
