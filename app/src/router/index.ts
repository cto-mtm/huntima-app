import { nextTick } from 'vue'
import {
  createRouter,
  createWebHistory,
  isNavigationFailure,
  NavigationFailureType,
  START_LOCATION,
  type RouteRecordRaw,
} from 'vue-router'
import { isValidTenantSlug } from 'shared'
import { useSessionStore } from '../stores/session'
import { useTenantStore } from '../stores/tenant'
import { useMissionsStore } from '../stores/missions'
import { useOrgsStore } from '../stores/orgs'
import { closeCover, openCover, revealPage } from '../lib/pageTransition'
import { safeInternalPath } from '../lib/redirect'

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
/**
 * Route flags, declared so they are typed at every use rather than `unknown`.
 *
 * `layout` picks the chrome (App.vue routes to it), defaulting to the two-level
 * fan `AppShell` when absent:
 *   'app'     — the fan shell (header + bottom nav), platform or brand level
 *   'console' — the org console chrome (ConsoleShell owns the admin nav)
 *   'bare'    — out-of-app surfaces with no shell (sign-in, welcome, 404…)
 * `public` is reachable with no session; `requiresOrg` needs membership of the
 * slug in the path.
 */
declare module 'vue-router' {
  interface RouteMeta {
    layout?: 'app' | 'console' | 'bare'
    public?: boolean
    requiresOrg?: boolean
  }
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    // The marketing front door — signed-out ONLY. A poster, not the app, so
    // it stays bare (no shell). Anyone with a session is redirected to
    // `/home` by the guard below.
    {
      path: '/',
      name: 'landing',
      meta: { layout: 'bare' },
      component: () => import('../pages/LandingPage.vue'),
    },

    // ── Platform level — inside the unified shell, Huntima brand ────
    // The consumer home: your ongoing games and the hunts you run. Reached
    // by anyone with a session; the guard bounces the signed-out to `/`.
    { path: '/home', name: 'platform-home', component: () => import('../pages/HomePage.vue') },
    // The organizer door is no longer a separate page: fans and organizers
    // authenticate the same account at /signin. This alias survives for old
    // bookmarks and printed links, defaulting to the org picker as the
    // destination so /staff-login still means "in to manage a hunt".
    {
      path: '/staff-login',
      redirect: (to) => ({
        name: 'signin',
        query: { to: typeof to.query.to === 'string' ? to.query.to : '/orgs' },
      }),
    },
    // The org picker: which console does this account open?
    {
      path: '/orgs',
      name: 'orgs',
      meta: { layout: 'bare', public: true },
      component: () => import('../pages/OrgsPage.vue'),
    },

    // ── Consumer identity, global ───────────────────────────────────
    // A fan is a cross-club consumer: their account, trophy shelf and
    // profile belong to THEM, not to any org — so these live at the top
    // level and are reachable straight from the landing page, no QR code
    // required. Playing a hunt is what needs an org.
    {
      path: '/signin',
      name: 'signin',
      meta: { layout: 'bare', public: true },
      component: () => import('../pages/SignInPage.vue'),
    },
    { path: '/trophies', name: 'trophies', component: () => import('../pages/TrophyCasePage.vue') },
    { path: '/profile', name: 'profile', component: () => import('../pages/ProfilePage.vue') },

    // ── Fan app, scoped to one org ──────────────────────────────────
    { path: '/:tenantSlug', name: 'home', component: () => import('../pages/HubPage.vue') },
    // `layout: 'bare'` renders without AppShell. The fan chrome (fixed header,
    // bottom nav) presumes a session; showing it before you have one offers
    // navigation into pages the guard will immediately bounce you out of.
    {
      path: '/:tenantSlug/welcome',
      name: 'entry',
      meta: { layout: 'bare', public: true },
      component: () => import('../pages/EntryPage.vue'),
    },
    { path: '/:tenantSlug/missions/:id', name: 'mission-detail', component: () => import('../pages/MissionDetailPage.vue') },
    { path: '/:tenantSlug/missions/:id/capture', name: 'mission-capture', component: () => import('../pages/CapturePage.vue') },
    { path: '/:tenantSlug/redeem', name: 'redeem', component: () => import('../pages/RedeemPage.vue') },
    {
      path: '/:tenantSlug/about',
      name: 'about',
      meta: { public: true },
      component: () => import('../pages/AboutPage.vue'),
    },

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
      meta: { layout: 'console', requiresOrg: true },
      component: () => import('../pages/admin/AdminHuntsPage.vue'),
    },
    {
      path: '/:tenantSlug/admin/hunts/:id',
      name: 'admin-hunt-edit',
      meta: { layout: 'console', requiresOrg: true },
      component: () => import('../pages/admin/AdminHuntEditPage.vue'),
    },
    {
      path: '/:tenantSlug/admin/hunts/:id/stats',
      name: 'admin-hunt-stats',
      meta: { layout: 'console', requiresOrg: true },
      component: () => import('../pages/admin/AdminHuntStatsPage.vue'),
    },
    {
      path: '/:tenantSlug/admin/branding',
      name: 'admin-branding',
      meta: { layout: 'console', requiresOrg: true },
      component: () => import('../pages/admin/AdminBrandingPage.vue'),
    },
    // Who can open this console. Adding and removing seats is owner-only,
    // enforced server-side; the page only decides what to draw.
    {
      path: '/:tenantSlug/admin/members',
      name: 'admin-members',
      meta: { layout: 'console', requiresOrg: true },
      component: () => import('../pages/admin/AdminMembersPage.vue'),
    },
    // ── Dev-only ────────────────────────────────────────────────────
    // The reward-art gallery (src/dev/RewardGallery.vue). Spread from a
    // conditional array rather than pushed later, so Vite's literal `false`
    // substitution for import.meta.env.DEV leaves `...[]` and Rollup drops
    // the dynamic import with it. Hidden is not the same as absent —
    // CLAUDE.md § Dev tooling.
    ...(import.meta.env.DEV
      ? ([
          {
            path: '/dev/rewards',
            name: 'dev-rewards',
            meta: { layout: 'bare', public: true },
            component: () => import('../dev/RewardGallery.vue'),
          },
        ] satisfies RouteRecordRaw[])
      : []),

    // Catch-all 404. Required because Firebase Hosting rewrites every URL
    // to index.html — without this, typos render an empty RouterView. Also
    // where malformed slugs land.
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      meta: { layout: 'bare', public: true },
      component: () => import('../pages/NotFoundPage.vue'),
    },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

// ── SESSION + TENANT GATE ───────────────────────────────────────────
// A fan arrives by scanning a QR code, so ANY route can be the entry
// point. Tiers:
//   public      — reachable with no session at all (`meta.public`, declared
//                 on the route itself: an allow-list of route NAMES here
//                 would be a second place to remember, and the route that
//                 gets forgotten is the one that starts bouncing people)
//   fan         — needs a guest session (or any signed-in account)
//   org console — needs a signed-in account that is a MEMBER of this org
//                 (tenants/{slug}/members/{uid}), or the platform operator
//                 claim
//
// The org check here is convenience, not security: it decides what UI to
// render. The real gate is server-side in functions/src/api.ts —
// requireMember() refuses every privileged call.
router.beforeEach(async (to, from) => {
  // ── Immediate feedback ──
  // Start closing the shutter the instant a section-change navigation begins,
  // so the async work below (auth restore, org load) and the lazy page-chunk
  // fetch happen behind a shutter that is ALREADY moving — the old order was
  // tap → silent freeze → animate. Hero navigations morph a shared element
  // instead, so they take no cover; the initial load, a re-tap of the current
  // route, and reduced motion get neither. Fire-and-forget: `beforeResolve`
  // awaits this same close (it is memoized) before the route commits.
  if (
    from !== START_LOCATION &&
    to.fullPath !== from.fullPath &&
    !isHeroNavigation(to.name, from.name) &&
    !matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    void closeCover()
  }

  const session = useSessionStore()
  const tenant = useTenantStore()
  const missions = useMissionsStore()
  const name = String(to.name ?? '')

  // ── Tenant scope ──
  // Entering any slugged route activates that org: cached brand applies
  // synchronously (no default-palette flash), then the API reconciles.
  // Leaving tenant scope restores the platform default theme so platform
  // pages never wear the last-visited club's colors. This is the ONLY place
  // the theme flips — the two-level shell (docs/shell-architecture.md) means
  // it happens exactly at the platform⇄brand boundary, never within a level.
  const slugParam = to.params.tenantSlug
  if (typeof slugParam === 'string') {
    if (!isValidTenantSlug(slugParam)) return { name: 'not-found' }
    tenant.activate(slugParam)
    missions.activate(slugParam)
  } else {
    tenant.deactivate()
  }

  // ── Landing ⇄ home ──
  // The marketing hero is for visitors with no session; anyone who can play
  // (guest, fan, operator) belongs on their home. Await auth restore only
  // when an account has been used here — a returning guest's role is already
  // in storage, so it costs them no Auth SDK.
  if (name === 'landing' || name === 'platform-home') {
    if (session.hasUsedAccount()) await session.ensureAuthReady()
    if (name === 'landing' && session.canPlay) return { name: 'platform-home' }
    if (name === 'platform-home' && !session.canPlay) return { name: 'landing' }
    return true
  }

  if (to.meta.requiresOrg) {
    // Await Firebase restoring any existing session first, or a staff
    // member who simply reloads the page gets bounced to the login screen.
    await session.ensureAuthReady()
    if (!session.user) {
      // Carry the destination: someone deep-linking an org console must land
      // back on it after signing in, not on the org picker.
      return { name: 'signin', query: { to: to.fullPath } }
    }
    const orgs = useOrgsStore()
    // Load the org list before deciding: the console reads the active tenant's
    // KIND (vocabulary) and PLAN (branding entitlement) from it, so an operator
    // — who bypasses the membership check below — still needs it loaded, or
    // their console would fall back to org/free for every tenant.
    await orgs.ensureLoaded()
    if (session.isAdmin) return true // platform operator bypasses membership
    if (typeof slugParam === 'string' && orgs.isMemberOf(slugParam)) return true
    // "Couldn't ask" is not "not a member": if the /me/orgs fetch failed
    // (offline, cold function, blip) `loaded` stays false, and ejecting a real
    // staff member to an equally-broken picker is worse than letting them
    // through — the server's requireMember is the real gate, so the console's
    // own authed calls will succeed for a member and 403 for a stranger.
    if (!orgs.loaded) return true
    return { name: 'orgs' }
  }

  if (name === 'signin') {
    await session.ensureAuthReady()
    // Already signed in (a fan OR an operator): skip the form and honor a
    // same-origin ?to= (a tenant hub, or /orgs from an organizer link), else
    // the consumer home, where ongoing games, hunts and trophies live.
    if (session.user) return safeInternalPath(to.query.to) ?? { name: 'platform-home' }
    return true
  }

  if (to.meta.public === true) return true

  // Fan routes. A guest and any signed-in account are equally entitled to
  // play — including org members and operators; running an org and playing
  // a hunt are two hats on one account, not two accounts.
  //
  // A fan's role is NOT restored from storage — it comes from a live Firebase
  // session — so on a refresh or a deep link this guard would otherwise run
  // first and bounce them to the entry screen. Wait for auth, but only if an
  // account has been used here: a guest must never pay for the Auth SDK.
  if (!session.canPlay && session.hasUsedAccount()) await session.ensureAuthReady()
  if (!session.canPlay) {
    const slug = typeof to.params.tenantSlug === 'string' ? to.params.tenantSlug : null
    // Inside an org: the tenant entry, where guest stays one tap away. On
    // the global consumer pages there is no org to be a guest OF — the
    // account sign-in is the door, with the destination carried through.
    return slug
      ? { name: 'entry', params: { tenantSlug: slug } }
      : { name: 'signin', query: { to: to.fullPath } }
  }
  return true
})

// ── NAVIGATION ANIMATION ────────────────────────────────────────────
// Exactly ONE of two systems runs per navigation, chosen here. They must
// never overlap: a view transition swaps every captured element for a frozen
// snapshot, so a shutter animating underneath one is animating where nobody
// can see it. See lib/pageTransition.ts for the full account.
//
//   HERO navigations — inside the mission flow, where a thumbnail really does
//   become the next page's header. These get the View Transitions API and no
//   cover, because the morph is the entire point and an opaque cover would
//   hide it.
//
//   EVERYTHING ELSE — tab to tab, level to level. These get the shutter and
//   no view transition: there is no shared element to morph, and the blades
//   are the transition.
//
// Pages opt into specific effects purely via CSS in
// assets/css/transitions.css — this file never changes per-page.
//
// Never call document.startViewTransition anywhere else in the app.
// See docs/animations.md.

/**
 * Routes that share `view-transition-name` pairs with each other: the hub's
 * mission cards morph into the mission page's header (Recipe 2), and capture
 * continues the same mission. A navigation BETWEEN any two of these is a hero
 * navigation; anything else is a section change.
 */
const HERO_ROUTES = new Set(['home', 'mission-detail', 'mission-capture'])

function isHeroNavigation(toName: unknown, fromName: unknown): boolean {
  return (
    typeof toName === 'string' &&
    typeof fromName === 'string' &&
    HERO_ROUTES.has(toName) &&
    HERO_ROUTES.has(fromName)
  )
}

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

router.beforeResolve(async (to, from) => {
  if (from === START_LOCATION) return true // initial load: nothing to morph from

  // Reduced motion gets neither system: no morph, and no full-screen shutter,
  // which is itself exactly the flash that setting asks us not to show.
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return true

  const start = getStartViewTransition()

  // ── Shutter path ──────────────────────────────────────────────────
  // Also the fallback when the browser has no View Transitions API: the
  // blades are plain CSS, so an unsupported browser now gets the same
  // transition instead of a hard cut.
  if (!start || !isHeroNavigation(to.name, from.name)) {
    // Any view transition still open (a hero nav interrupted by a tab tap)
    // is closed out, or its snapshot is stranded on screen.
    finishTransition?.()
    finishTransition = null
    // AWAIT the close: the route must not commit until the screen is
    // covered, or the swap shows through. afterEach opens the blades once
    // the new page has painted.
    await closeCover()
    return true
  }

  // ── Hero path ─────────────────────────────────────────────────────
  // No cover here: the morph is the whole point and a cover would hide it.

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

router.afterEach(async (_to, _from, failure) => {
  // Let RouterView render the new component before we do anything that
  // depends on the new page being on screen.
  await nextTick()

  if (finishTransition) {
    finishTransition()
    finishTransition = null
  }

  // A guard that returned a redirect CANCELS this navigation and immediately
  // starts another; that successor keeps the shutter shut (closeCover is
  // memoized) and reveals when it lands. Revealing here too would blink the
  // cover open in the gap between them. Any other outcome — success, or a
  // duplicate/aborted nav with no successor — must reveal, or a shutter that
  // this navigation opened would stay stuck shut.
  if (isNavigationFailure(failure, NavigationFailureType.cancelled)) return

  // Hand back to the shutter once Vue has painted. How long it then holds
  // before opening is lib/pageTransition.ts's business, not the router's —
  // the router only knows WHEN the new page is ready.
  requestAnimationFrame(revealPage)
})

// afterEach fires for confirmed AND failed (aborted/cancelled) navigations,
// but never for one that ERRORS — say, a guard throwing after beforeResolve
// raised the cover. Lower it here too, or the app would sit behind an opaque
// veil forever: a stuck cover is a blank app.
router.onError(() => {
  openCover()
})

export default router
