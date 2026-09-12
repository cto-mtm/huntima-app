import { nextTick } from 'vue'
import { createRouter, createWebHistory, START_LOCATION } from 'vue-router'
import { useProgressStore } from '../stores/progress'
import { useSessionStore } from '../stores/session'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('../pages/HubPage.vue') },
    // `bare: true` renders without AppShell. The fan chrome (fixed header,
    // bottom nav) presumes a session; showing it before you have one offers
    // navigation into pages the guard will immediately bounce you out of.
    {
      path: '/welcome',
      name: 'entry',
      meta: { bare: true },
      component: () => import('../pages/EntryPage.vue'),
    },
    { path: '/welcome/profile', name: 'onboarding', component: () => import('../pages/OnboardingPage.vue') },
    {
      path: '/staff-login',
      name: 'staff-login',
      meta: { bare: true },
      component: () => import('../pages/StaffLoginPage.vue'),
    },
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
      path: '/admin/hunts',
      name: 'admin-hunts',
      meta: { bare: true, requiresAdmin: true },
      component: () => import('../pages/admin/AdminHuntsPage.vue'),
    },
    {
      path: '/admin/hunts/:id',
      name: 'admin-hunt-edit',
      meta: { bare: true, requiresAdmin: true },
      component: () => import('../pages/admin/AdminHuntEditPage.vue'),
    },
    {
      path: '/admin/branding',
      name: 'admin-branding',
      meta: { bare: true, requiresAdmin: true },
      component: () => import('../pages/admin/AdminBrandingPage.vue'),
    },
    // Catch-all 404. Required because Firebase Hosting rewrites every URL
    // to index.html — without this, typos render an empty RouterView.
    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('../pages/NotFoundPage.vue') },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

// ── SESSION GATE ────────────────────────────────────────────────────
// A fan arrives by scanning a QR code, so ANY route can be the entry
// point. Three tiers:
//   public      — reachable with no session at all
//   fan         — needs a guest session and a profile
//   admin       — needs a Firebase session carrying the verified `admin`
//                 custom claim
//
// The admin check here is convenience, not security: it decides what UI to
// render. The real gate is server-side token verification in
// functions/src/helpers/auth.ts. A client that forces its way to /admin
// sees a dashboard whose every privileged call returns 401/403.
const PUBLIC_ROUTES = new Set(['entry', 'staff-login', 'about', 'not-found'])

router.beforeEach(async (to) => {
  const session = useSessionStore()
  const progress = useProgressStore()
  const name = String(to.name ?? '')

  if (to.meta.requiresAdmin) {
    // Await Firebase restoring any existing session first, or a staff
    // member who simply reloads the page gets bounced to the login screen.
    await session.ensureAuthReady()
    return session.isAdmin ? true : { name: 'staff-login' }
  }

  if (name === 'staff-login') {
    await session.ensureAuthReady()
    return session.isAdmin ? { name: 'admin-branding' } : true
  }

  if (PUBLIC_ROUTES.has(name)) return true

  // Fan routes.
  if (!session.isGuest) return { name: 'entry' }
  if (!progress.hasProfile && name !== 'onboarding') return { name: 'onboarding' }
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
    const transition = start(() => {
      // Releasing the guard here lets vue-router commit the route *inside*
      // the transition callback, which is what the API requires: old page
      // snapshotted, route swapped, new page snapshotted, browser morphs.
      allowNavigation(true)
      return new Promise<void>((done) => {
        finishTransition = done
      })
    })

    // `finished` REJECTS when a transition is skipped or superseded — a
    // second tap during an animation, or a hidden tab. That is normal here,
    // and the navigation has already been allowed above, so the only thing
    // an unhandled rejection buys is InvalidStateError noise in the console
    // of anyone debugging something else.
    transition.finished.catch(() => {})
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
