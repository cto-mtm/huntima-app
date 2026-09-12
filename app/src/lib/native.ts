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
  // the app.
  //
  // Three cases:
  //   1. Router has history → go back.
  //   2. No history but we're NOT at the hub (e.g. a QR deep-link opened the
  //      app straight on a mission page, so window.history has no `back`) →
  //      route to the hub rather than exiting, so the first back press lands
  //      the fan somewhere sensible instead of dumping them out.
  //   3. No history AND already at the hub → exit, the expected Android
  //      behaviour at a task's root.
  App.addListener('backButton', () => {
    if (window.history.state?.back) {
      router.back()
    } else if (router.currentRoute.value.name !== 'home') {
      void router.replace({ name: 'home' })
    } else {
      App.exitApp()
    }
  })

  // Dark status bar content over the light shell header.
  StatusBar.setStyle({ style: Style.Light }).catch(() => {
    // Not supported on every device/OS combo; never worth crashing boot.
  })
}
