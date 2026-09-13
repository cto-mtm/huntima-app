import { nextTick } from 'vue'
import { createRouter, createWebHistory, START_LOCATION } from 'vue-router'
import { isValidTenantSlug } from 'shared'
import { useSessionStore } from '../stores/session'
import { useTenantStore } from '../stores/tenant'
import { useMissionsStore } from '../stores/missions'
import { useOrgsStore } from '../stores/orgs'
import { isNavigating } from '../lib/pageTransition'

/**
 * Multi-tenant routing: the fan app lives under `/:tenantSlug` — the brand
 * page (`huntima.app/louisville-bats`) IS the app. Platform surfaces
 * (landing, org picker, staff login) live at reserved top-level paths;
 * `RESERVED_SLUGS` in `shared` guarantees no org can ever claim one.
 *
 * Every in-app navigation is by route NAME. vue-router carries the current
 * `tenantSlug` param into named navigations, so pages never thread the slug
 * by hand — they say `{ name: 'home' }` and stay inside their org.
 */
const router = createRouter({
  history: createWebHistory(),
  routes: [
    // Platform landing. Minimal by design in Phase 1 (the front door is a QR
    // code on a jumbotron); becomes discovery in Phase 3.
    {
      path: '/',
      name: 'landing',
      meta: { bare: true },
      component: () => import('../pages/LandingPage.vue'),
    },
    {
      path: '/staff-login',
      name: 'staff-login',
      meta: { bare: true },
      component: () => import('../pages/StaffLoginPage.vue'),
    },
    // The org picker: which console does this account open?
    {
      path: '/orgs',
      name: 'orgs',
      meta: { bare: true },
      component: () => import('../pages/OrgsPage.vue'),
    },

    // ── Fan app, scoped to one org ──────────────────────────────────
    { path: '/:tenantSlug', name: 'home', component: () => import('../pages/HubPage.vue') },
    // `bare: true` renders without AppShell. The fan chrome (fixed header,
    // bottom nav) presumes a session; showing it before you have one offers
    // navigation into pages the guard will immediately bounce you out of.
    {
      path: '/:tenantSlug/welcome',
      name: 'entry',
      meta: { bare: true },
      component: () => import('../pages/EntryPage.vue'),
    },
    {
      path: '/:tenantSlug/signin',
      name: 'signin',
      meta: { bare: true },
      component: () => import('../pages/FanSignInPage.vue'),
    },
    { path: '/:tenantSlug/profile', name: 'profile', component: () => import('../pages/ProfilePage.vue') },
    { path: '/:tenantSlug/missions/:id', name: 'mission-detail', component: () => import('../pages/MissionDetailPage.vue') },
    { path: '/:tenantSlug/missions/:id/capture', name: 'mission-capture', component: () => import('../pages/CapturePage.vue') },
    { path: '/:tenantSlug/trophies', name: 'trophies', component: () => import('../pages/TrophyCasePage.vue') },
    { path: '/:tenantSlug/redeem', name: 'redeem', component: () => import('../pages/RedeemPage.vue') },
    { path: '/:tenantSlug/about', name: 'about', component: () => import('../pages/AboutPage.vue') },

    // ── Org console, under the same slug ────────────────────────────
    {
      path: '/:tenantSlug/admin',
      // Hunts is the working surface staff return to; branding is set once
      // and rarely revisited. So /admin lands on the hunt list.
      redirect: (to) => ({ name: 'admin-hunts', params: to.params }),
    },
    {
      path: '/:tenantSlug/admin/hunts',
      name: 'admin-hunts',
      meta: { bare: true, requiresOrg: true },
      component: () => import('../pages/admin/AdminHuntsPage.vue'),
    },
    {
      path: '/:tenantSlug/admin/hunts/:id',
      name: 'admin-hunt-edit',
      meta: { bare: true, requiresOrg: true },
      component: () => import('../pages/admin/AdminHuntEditPage.vue'),
    },
    {
      path: '/:tenantSlug/admin/hunts/:id/stats',
      name: 'admin-hunt-stats',
      meta: { bare: true, requiresOrg: true },
      component: () => import('../pages/admin/AdminHuntStatsPage.vue'),
    },
    {
      path: '/:tenantSlug/admin/branding',
      name: 'admin-branding',
      meta: { bare: true, requiresOrg: true },
      component: () => import('../pages/admin/AdminBrandingPage.vue'),
    },
    // Catch-all 404. Required because Firebase Hosting rewrites every URL
    // to index.html — without this, typos render an empty RouterView. Also
    // where malformed slugs land.
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      meta: { bare: true },
      component: () => import('../pages/NotFoundPage.vue'),
    },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

// ── SESSION + TENANT GATE ───────────────────────────────────────────
// A fan arrives by scanning a QR code, so ANY route can be the entry
// point. Tiers:
//   public      — reachable with no session at all
//   fan         — needs a guest session (or any signed-in account)
//   org console — needs a signed-in account that is a MEMBER of this org
//                 (tenants/{slug}/members/{uid}), or the platform operator
//                 claim
//
// The org check here is convenience, not security: it decides what UI to
// render. The real gate is server-side in functions/src/api.ts —
// requireMember() refuses every privileged call.
const PUBLIC_ROUTES = new Set(['landing', 'orgs', 'entry', 'signin', 'staff-login', 'about', 'not-found'])

router.beforeEach(async (to) => {
  const session = useSessionStore()
  const tenant = useTenantStore()
  const missions = useMissionsStore()
  const name = String(to.name ?? '')

  // ── Tenant scope ──
  // Entering any slugged route activates that org: cached brand applies
  // synchronously (no default-palette flash), then the API reconciles.
  // Leaving tenant scope restores the platform default theme so /orgs and
  // the landing page never wear the last-visited club's colors.
  const slugParam = to.params.tenantSlug
  if (typeof slugParam === 'string') {
    if (!isValidTenantSlug(slugParam)) return { name: 'not-found' }
    tenant.activate(slugParam)
    missions.activate(slugParam)
  } else {
    tenant.deactivate()
  }

  if (to.meta.requiresOrg) {
    // Await Firebase restoring any existing session first, or a staff
    // member who simply reloads the page gets bounced to the login screen.
    await session.ensureAuthReady()
    if (!session.user) {
      // Carry the destination: someone deep-linking an org console must land
      // back on it after signing in, not on the org picker.
      return { name: 'staff-login', query: { to: to.fullPath } }
    }
    if (session.isAdmin) return true // platform operator bypasses membership
    const orgs = useOrgsStore()
    await orgs.ensureLoaded()
    if (typeof slugParam === 'string' && orgs.isMemberOf(slugParam)) return true
    return { name: 'orgs' }
  }

  if (name === 'signin' || name === 'staff-login') {
    await session.ensureAuthReady()
    if (name === 'signin')
      return session.isFan
        ? { name: 'home', params: { tenantSlug: String(to.params.tenantSlug ?? '') } }
        : true
    return session.isAdmin ? { name: 'orgs' } : true
  }

  if (PUBLIC_ROUTES.has(name)) return true

  // Fan routes. A guest and any signed-in account are equally entitled to
  // play — including org members and operators; running an org and playing
  // a hunt are two hats on one account, not two accounts.
  //
  // A fan's role is NOT restored from storage — it comes from a live Firebase
  // session — so on a refresh or a deep link this guard would otherwise run
  // first and bounce them to the entry screen. Wait for auth, but only if an
  // account has been used here: a guest must never pay for the Auth SDK.
  if (!session.canPlay && session.hasUsedAccount()) await session.ensureAuthReady()
  // Only the slug crosses into the entry route — a mission id from a deep
  // link is not an entry param, and passing it would log a router warning.
  if (!session.canPlay)
    return { name: 'entry', params: { tenantSlug: String(to.params.tenantSlug ?? '') } }
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

  // Raise the full-screen cover — but ONLY on the view-transition path. It
  // exists to mask the ambient backdrop's snapshot swap during the
  // transition; the two paths above have no transition, their DOM swap is a
  // single atomic frame no cover could intercept, and under reduced motion a
  // full-screen veil is itself exactly the flash that setting asks us not to
  // show. afterEach lowers it once the new page has painted; router.onError
  // is the safety net for a navigation that dies in between. See
  // lib/pageTransition.ts and components/PageCover.vue.
  isNavigating.value = true

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
  // Let RouterView render the new component before we do anything that
  // depends on the new page being on screen.
  await nextTick()

  if (finishTransition) {
    finishTransition()
    finishTransition = null
  }

  // Lower the cover on the NEXT frame, after the new page has painted, so the
  // reveal fades to a settled page rather than a mid-render one. A rAF is
  // enough; the cover's own CSS transition carries the fade-out.
  requestAnimationFrame(() => {
    isNavigating.value = false
  })
})

// afterEach fires for confirmed AND failed (aborted/cancelled) navigations,
// but never for one that ERRORS — say, a guard throwing after beforeResolve
// raised the cover. Lower it here too, or the app would sit behind an opaque
// veil forever: a stuck cover is a blank app.
router.onError(() => {
  isNavigating.value = false
})

export default router
