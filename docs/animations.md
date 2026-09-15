# Animation cookbook

Two primitives, no libraries:

1. **View Transitions API** (`document.startViewTransition`) — *between* pages,
   including Flutter-`Hero`-style shared elements.
2. **Vue `<Transition>` / `<TransitionGroup>`** — *within* a page (modals, toasts,
   list reorders).

Nothing else. Don't add GSAP, Motion One, or scroll-jacking.

All transition CSS lives in one file: [`app/src/assets/css/transitions.css`](../app/src/assets/css/transitions.css),
organized as numbered recipes. The router wrapper lives in
[`app/src/router/index.ts`](../app/src/router/index.ts) and should not need to
change when you add an animation.

---

## 1. Add a hero transition between two pages

The shared-element morph. Reference implementation:
`MissionCard.vue` → `MissionDetailPage.vue`.

**Step 1** — on the source element, set an inline dynamic `view-transition-name`:

```vue
<!-- MissionCard.vue -->
<div :style="{ viewTransitionName: `mission-${mission.id}` }" />
```

**Step 2** — on the target element on the destination page, set the *same* name:

```vue
<!-- MissionDetailPage.vue -->
<div :style="{ viewTransitionName: `mission-${mission.id}` }" />
```

**Step 3** — there is no step 3. The browser snapshots both, matches them by
name, and animates position, size and border-radius between them. Timing comes
from Recipe 2 in `transitions.css`.

Pair more than one element to morph more than one thing — the card title and the
detail heading share `mission-title-${mission.id}`, which shows the recipe works
on text, not just images.

> **Critical rule:** a `view-transition-name` must be unique across the document
> at the moment the transition starts. Never put a static name on an element
> inside a `v-for` — always derive it from the item's id. Two elements with the
> same name silently kill the whole transition.

---

## 2. Add a custom per-page transition

Worked example, already implemented in the scaffold as **Recipe 6**: the About
page slides in from the right instead of taking the default lift-in
(Recipe 1). Read it in `transitions.css` and copy the block for any other page.

**Step 1** — give that page's root element a stable transition name:

```vue
<!-- AboutPage.vue -->
<section style="view-transition-name: about-page">
```

**Step 2** — add keyframes and target the generated pseudo-elements in
`transitions.css`:

```css
@keyframes slide-from-right {
  from { transform: translateX(24px); opacity: 0; }
}
@keyframes fade-out {
  to { opacity: 0; }
}

::view-transition-new(about-page) {
  animation: 260ms cubic-bezier(0.4, 0, 0.2, 1) both slide-from-right;
}
::view-transition-old(about-page) {
  animation: 160ms cubic-bezier(0.4, 0, 0.2, 1) both fade-out;
}
```

Because the name is static, only one element may carry it at a time — fine for a
page root, never fine for a list item.

---

## 3. Animate a list reorder / insert / remove

Use `<TransitionGroup>`, which does the FLIP math for you. Demonstrated by the
"shuffle" button on `HubPage.vue`.

```vue
<TransitionGroup name="list" tag="div" class="grid gap-3">
  <MissionCard v-for="m in missions" :key="m.id" :mission="m" />
</TransitionGroup>
```

The `name="list"` prefix maps to the Recipe 4 classes already defined in
`transitions.css`: `.list-enter-from`, `.list-leave-to`, `.list-enter-active`,
`.list-leave-active`, and `.list-move` (the one that makes reorders glide).

`:key` must be a stable id. Using the array index defeats the whole mechanism —
Vue can't tell that an item moved rather than changed.

---

## 4. The rules

- **Animate only `transform` and `opacity`.** Anything else (width, top, filter,
  box-shadow) leaves the compositor and janks on a mid-range Android phone in a
  stadium concourse.
- **Durations 200–350ms.** Easing `cubic-bezier(0.4, 0, 0.2, 1)`. Longer feels
  broken on a device someone is holding one-handed while watching a game.
- **A payoff needs the whole screen.** The capture celebration is a
  full-screen overlay teleported to `<body>` (Recipe 20), not a card in the
  page flow. It was a card once: on a 740px phone that put the biggest moment
  in the product below the fold and behind the nav bar, so the fan had to
  scroll to find out they had won. Every beat was already right — it was
  happening where nobody was looking. If a moment is worth staging, it is
  worth being unmissable.
- **Celebration exception.** Reward moments — the capture celebration
  (Recipes 9 and 20) and the trophy gleam (Recipe 10) — may run up to ~900ms,
  staged as short beats. Like the scan loop (Recipe 7), they are flourishes layered
  *over* an already-committed state change, not state transitions: the badge
  is awarded before the confetti flies, so skipping them loses nothing. A
  reward state may also hold a gentle *state-scoped* loop while it is on
  screen (the badge float and halo breathe in Recipe 9) — scoped like the
  scan sweep, gone the moment the state is. They still animate only
  transform/opacity and die under reduced motion. Navigation and state
  transitions stay inside 200–350ms — the exception is for payoffs, never
  for anything a fan is waiting on.
- **A panel's height is not an animation.** Accordions (Recipe 18) change
  height instantly and animate only their *contents*, fading and lifting.
  Height, `grid-template-rows: 0fr->1fr` and `interpolate-size` all ask the
  browser to re-lay-out every child on every frame — a ten-card level does
  that at well under 60fps on the phone this app is actually used on, and the
  content *below* the accordion judders along with it. A panel that appears at
  full height with its contents easing in reads as deliberate; a janky height
  slide reads as broken.
- **Glows never animate box-shadow.** A "pulsing glow" is a static shadow or
  radial gradient on an element whose *opacity* animates (the one-away
  beacon, the badge halo). Same look, still compositor-only.
- **Calm concourse, loud goal horn.** The celebration budget only reads if the
  ambient UI stays quiet. Exactly ONE ambient layer is sanctioned: the one-away
  beacon (Recipe 11), which earns its pulse by marking the near-win. Don't add
  per-element ambient loops beyond it. The app-wide backdrop drift used to hold
  the second slot and was retired (Recipe 12) — four blobs and two oversized
  stroked icons wandering behind a mission list read as clip-art, not as
  atmosphere, and the backdrop is now a static tinted wash. Static decor is
  always fine; motion is what has to earn its place.
- **Scoping a loop to a state does not make it state-scoped.** The test is
  whether the fan can sit in that state indefinitely. The scan sweep marks an
  operation they are waiting on and dies with it; the badge float rides a
  reward that passes. A loop running through a RESTING state — the capture
  page while someone composes a shot — is ambient in everything but name, and
  counts against the two above. Recipe 17 is the worked example: the same
  brackets now breathe a few times to say where to aim, then settle.
- **The fixed chrome opts out of the page transition.** AppShell's header,
  bottom nav, and backdrop each carry a static `view-transition-name`
  (`app-header`, `app-nav`, `app-backdrop`), which removes them from the root
  group — Recipe 1's lift moves the page content while the chrome holds
  still. Static names are safe there because AppShell renders exactly once;
  the active-tab pill's move between tabs comes free from the nav being its
  own group.
- **Splitting into named groups also splits the stacking.** Once an element
  has its own `view-transition-name` it is snapshotted into its own group, and
  the groups paint in name-declaration order — NOT the live DOM z-index the
  static layout uses. This bit the backdrop: it sits under the content by DOM
  order at rest, but mid-lift (content on its own transformed layer) its
  snapshot painted on top. Recipe 1b fixes it by giving the groups explicit
  `z-index` (`::view-transition-group(app-backdrop) { z-index: 0 }`, root 10,
  chrome 20). Rule of thumb: if you give a background/foreground element its
  own name, also rank its group, and keep that ranking in sync with the DOM
  z-index classes in AppShell.vue.
- **A named static element must be told NOT to fade.** A group with no
  animation of its own inherits the default cross-fade. For the backdrop,
  header and nav — identical before and after a navigation — that cross-fade
  between two identical snapshots reads as a flicker, and the frozen snapshot
  also pauses the backdrop's drift. Recipe 1c sets `animation: none` on their
  old/new pseudo-elements (old hidden, new at full opacity) so they hold a
  single frame and swap seamlessly; the live drift resumes the moment the
  transition ends. The chrome is meant to "hold still" — that means no
  transition on it at all, not a subtle one.
- **The navigation cover runs only when a view transition does.** The
  full-screen shutter (Recipe 14, `PageCover.vue`) masks the backdrop's
  snapshot swap, and the router raises it *only* on the view-transition path:
  a plain navigation swaps the DOM in one atomic frame no cover could
  intercept, and under reduced motion a full-screen shutter is itself the
  flash the setting forbids. `router.onError` lowers it if a navigation dies
  midway — a stuck cover is a blank app.
- **One navigation, ONE animation system.** The shutter and the View
  Transitions API must never run together, and the router picks between them:
  hero navigations (inside the mission flow, where a thumbnail really becomes
  the next page's header) get the view transition and no cover; every other
  move gets the shutter and no view transition. This is correctness, not
  taste — a view transition replaces every element it captures with a frozen
  snapshot, so a cover animating underneath one animates where nobody can see
  it, then snaps to wherever it got to when the transition ends. A
  full-screen cover also makes a morph pointless: once it is shut there is
  nothing to see. Measured, separating them took the worst frame on a tab
  change from ~55-72ms down to ~33ms.
- **Wait for `transitionend`, not a stopwatch.** The router awaits the
  shutter's close before letting the route commit, and the close ends when
  the blades say so. A timer does not work: the class that starts the
  transition lands on Vue's next render while the router is resolving a route
  (often fetching a lazy chunk) across the same window, so the clocks drift —
  a 280ms timer caught the blades about three quarters shut and reversed
  them.
- **Names unique per page**, always derived from ids inside lists.
- **Always test with reduced motion on.** Recipe 3 kills every animation under
  `prefers-reduced-motion: reduce`, and the router skips the transition entirely.
  The app must still be fully usable and correct — the animation is never the
  thing that commits a state change.
- **Never nest `startViewTransition` calls**, and never call it outside the
  router guard. A second call while one is running aborts the first and leaves
  stale snapshots on screen.
- **Every recipe must look acceptable if it simply cross-fades**, because that is
  the automatic fallback whenever the browser can't match names.

---

## 5. Platform support

| Engine | View Transitions |
|---|---|
| Chromium (desktop, Android Chrome, **Android WebView**) | since 111 |
| Safari / **iOS WKWebView** | since iOS 18 / Safari 18 |
| Firefox | since 141 |

On anything older, `document.startViewTransition` is `undefined`, the router
guard returns early, and navigation is instant. That is the designed degradation
path, not a bug to work around — it is also exactly what reduced-motion users
get, so it's a first-class state, not an edge case.

Vue's `<Transition>` / `<TransitionGroup>` (Recipe 4) are plain CSS transitions
and work everywhere.
