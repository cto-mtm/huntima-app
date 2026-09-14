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
  //   2. No history but not at a root (e.g. a QR deep-link opened the app
  //      straight on a mission page) → route UP to the nearest root rather
  //      than exiting. In brand context that root is the org hub; on a
  //      platform page it is the platform home. `{ name: 'home' }` needs a
  //      tenantSlug, so we resolve the target from the current route — a
  //      bare `{ name: 'home' }` here would throw on a platform page.
  //   3. No history AND already at a root → exit, the expected Android
  //      behaviour at a task's root.
  const ROOTS = new Set(['home', 'platform-home'])
  App.addListener('backButton', () => {
    const current = router.currentRoute.value
    if (window.history.state?.back) {
      router.back()
    } else if (ROOTS.has(String(current.name))) {
      App.exitApp()
    } else if (typeof current.params.tenantSlug === 'string') {
      void router.replace({ name: 'home', params: { tenantSlug: current.params.tenantSlug } })
    } else {
      void router.replace({ name: 'platform-home' })
    }
  })

  // Dark status bar content over the light shell header.
  StatusBar.setStyle({ style: Style.Light }).catch(() => {
    // Not supported on every device/OS combo; never worth crashing boot.
  })
}
