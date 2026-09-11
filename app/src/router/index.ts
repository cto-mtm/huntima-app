import { nextTick } from 'vue'
import { createRouter, createWebHistory, START_LOCATION } from 'vue-router'
import { useProgressStore } from '../stores/progress'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('../pages/HubPage.vue') },
    { path: '/welcome', name: 'onboarding', component: () => import('../pages/OnboardingPage.vue') },
    { path: '/missions/:id', name: 'mission-detail', component: () => import('../pages/MissionDetailPage.vue') },
    { path: '/missions/:id/capture', name: 'mission-capture', component: () => import('../pages/CapturePage.vue') },
    { path: '/trophies', name: 'trophies', component: () => import('../pages/TrophyCasePage.vue') },
    { path: '/redeem', name: 'redeem', component: () => import('../pages/RedeemPage.vue') },
    { path: '/about', name: 'about', component: () => import('../pages/AboutPage.vue') },
    // Admin lives in the same SPA so the branding preview can render the
    // real fan components. meta.admin swaps AppShell for a plain layout —
    // the fan chrome (fixed bottom nav, safe-area header) fights a
    // dashboard. SEAM: there is no auth on this route. It is safe today
    // only because branding is device-local; the moment it writes to the
    // API it needs a real guard.
    {
      path: '/admin',
      redirect: { name: 'admin-branding' },
    },
    {
      path: '/admin/branding',
      name: 'admin-branding',
      meta: { admin: true },
      component: () => import('../pages/admin/AdminBrandingPage.vue'),
    },
    // Catch-all 404. Required because Firebase Hosting rewrites every URL
    // to index.html — without this, typos render an empty RouterView.
    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('../pages/NotFoundPage.vue') },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

// ── ONBOARDING GATE ─────────────────────────────────────────────────
// A fan arrives by scanning a QR code, so any route can be the entry
// point. Anything that shows personal progress needs a nickname first.
const PUBLIC_ROUTES = new Set(['onboarding', 'about', 'not-found', 'admin-branding'])

router.beforeEach((to) => {
  const progress = useProgressStore()
  if (!progress.hasProfile && !PUBLIC_ROUTES.has(String(to.name))) {
    return { name: 'onboarding', query: { next: to.fullPath } }
  }
  return true
})

// ── VIEW TRANSITION WRAPPER ─────────────────────────────────────────
// Every navigation becomes a view transition when the browser supports
// it. Pages opt into specific effects purely via CSS in
// assets/css/transitions.css — this file never changes per-page.
//
// Never call document.startViewTransition anywhere else in the app.
// See docs/animations.md.

type StartViewTransition = (callback: () => void | Promise<void>) => { finished: Promise<void> }

// Feature-detected through a cast so this compiles on TS lib versions that
// predate the View Transitions typings.
function getStartViewTransition(): StartViewTransition | null {
  const doc = document as Document & { startViewTransition?: StartViewTransition }
  return typeof doc.startViewTransition === 'function' ? doc.startViewTransition.bind(doc) : null
}

/**
 * Held between the two hooks below: beforeResolve opens the transition and
 * parks it here; afterEach closes it once Vue has painted the new page.
 */
let finishTransition: (() => void) | null = null

router.beforeResolve((_to, from) => {
  if (from === START_LOCATION) return true // initial load: nothing to morph from

  const start = getStartViewTransition()
  if (!start) return true // unsupported browser: navigate plainly
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return true

  // Any transition still open (rapid taps) is abandoned rather than nested —
  // nesting aborts the first and strands its snapshot on screen.
  finishTransition?.()

  return new Promise<boolean>((allowNavigation) => {
    start(() => {
      // Releasing the guard here lets vue-router commit the route *inside*
      // the transition callback, which is what the API requires: old page
      // snapshotted, route swapped, new page snapshotted, browser morphs.
      allowNavigation(true)
      return new Promise<void>((done) => {
        finishTransition = done
      })
    })
  })
})

router.afterEach(async () => {
  if (!finishTransition) return
  // One tick for RouterView to render the new component, so the browser
  // snapshots the new page rather than the old one.
  await nextTick()
  finishTransition()
  finishTransition = null
})

export default router
