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
page slides in from the right instead of cross-fading. Read it in
`transitions.css` and copy the block for any other page.

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
