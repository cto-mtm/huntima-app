import { defineStore } from 'pinia'
import { computed, onScopeDispose, ref, watch } from 'vue'
import {
  deriveClaimCode,
  HUNT_STATUS_BATCH,
  huntStatusesSchema,
  joinedHuntSchema,
  type HuntRef,
  type HuntStatus,
  type JoinedHunt,
} from 'shared'
import { useSessionStore } from './session'
import { useMissionsStore } from './missions'
import { reportFanEvent } from '../lib/analytics'
import { apiFetch, apiPost } from '../lib/api'

const STORAGE_KEY = 'huntima:progress'
/** Authenticated cross-device progress store. See helpers/fanProgress.ts. */
const PROGRESS_ENDPOINT = '/me/progress'
/** Public batch check of saved cards. See helpers/huntStatus.ts. */
const HUNT_STATUS_ENDPOINT = '/hunts/status'
/** How long an unchanged set of cards counts as freshly checked. */
const RECONCILE_COOLDOWN_MS = 5 * 60_000

/**
 * A hunt the fan has finished. This is what a "trophy" is: a past win, kept
 * across hunts. Distinct from `earned`, which is the in-progress badge set of
 * whatever hunt is loaded right now.
 */
interface WonHunt {
  campaignId: string
  name: string
  /** Epoch ms when the hunt was completed. */
  wonAt: number
  /** Which org's hunt this was — provenance for the trophy shelf. Absent on
   *  trophies recorded before the platform pivot. */
  tenantSlug?: string
}

interface PersistedProgress {
  nickname: string
  /** Avatar ID, not a URL: a re-upload must not reassign someone's face. */
  avatarId: string | null
  /**
   * Earned badges and redemption are keyed by campaign id, NOT global. A flat
   * list let a returning fan carry hunt A's badges into hunt B — inflating the
   * count so /redeem could show "you won" off the wrong hunt. Now switching the
   * live hunt starts that hunt clean.
   */
  earned: Record<string, string[]>
  claimed: Record<string, boolean>
  wonHunts: WonHunt[]
  /** Joined-but-maybe-unfinished hunts — the "ongoing games" on home. */
  joinedHunts: JoinedHunt[]
}

function parseWonHunts(value: unknown): WonHunt[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(
      (h): h is WonHunt =>
        typeof h === 'object' &&
        h !== null &&
        typeof (h as WonHunt).campaignId === 'string' &&
        typeof (h as WonHunt).name === 'string' &&
        typeof (h as WonHunt).wonAt === 'number',
    )
    .map((h) => ({
      campaignId: h.campaignId,
      name: h.name,
      wonAt: h.wonAt,
      // Optional provenance; drop anything that isn't a plain string.
      ...(typeof h.tenantSlug === 'string' ? { tenantSlug: h.tenantSlug } : {}),
    }))
}

/**
 * Reads the joined-hunt list back out of storage.
 *
 * Parsed with the SHARED schema rather than a hand-rolled type guard. A guard
 * that only checks `typeof` accepts what the contract rejects — a negative
 * badge target, a slug of any length, a campaign id the size of the document —
 * and this data is round-tripped to `/me/progress`, so the client would be the
 * one introducing values the server's own schema refuses. Rows that no longer
 * fit the contract are dropped, not repaired: a half-valid card is worse than
 * an absent one.
 */
function parseJoinedHunts(value: unknown): JoinedHunt[] {
  if (!Array.isArray(value)) return []
  return value
    .map((h) => joinedHuntSchema.safeParse(h))
    .filter((r): r is { success: true; data: JoinedHunt } => r.success)
    .map((r) => r.data)
}

function parseEarned(value: unknown): Record<string, string[]> {
  if (typeof value !== 'object' || value === null) return {}
  const out: Record<string, string[]> = {}
  for (const [id, list] of Object.entries(value)) {
    if (Array.isArray(list)) out[id] = list.filter((x): x is string => typeof x === 'string')
  }
  return out
}

function parseClaimed(value: unknown): Record<string, boolean> {
  if (typeof value !== 'object' || value === null) return {}
  const out: Record<string, boolean> = {}
  for (const [id, v] of Object.entries(value)) if (v === true) out[id] = true
  return out
}

/**
 * Merge helpers for reconciling this device's progress with the account copy
 * pulled from the server. The rule everywhere is UNION, never clobber: a fan
 * who played as a guest and then signed in must keep both sides — losing a
 * trophy to a sync is worse than the sync not existing.
 */
function mergeEarned(
  a: Record<string, string[]>,
  b: Record<string, string[]>,
): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
    out[id] = [...new Set([...(a[id] ?? []), ...(b[id] ?? [])])]
  }
  return out
}

function mergeClaimed(
  a: Record<string, boolean>,
  b: Record<string, boolean>,
): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (a[id] === true || b[id] === true) out[id] = true
  }
  return out
}

function mergeWonHunts(a: WonHunt[], b: WonHunt[]): WonHunt[] {
  const byId = new Map<string, WonHunt>()
  for (const hunt of [...a, ...b]) {
    const existing = byId.get(hunt.campaignId)
    // Keep the EARLIEST win: the first time this hunt was actually finished,
    // not whichever device happened to sync last.
    if (!existing || hunt.wonAt < existing.wonAt) byId.set(hunt.campaignId, hunt)
  }
  return [...byId.values()]
}

/** Keyed by SLUG, not campaign id: "ongoing games" is a per-brand list — a
 *  club that publishes a new hunt replaces the fan's card for that club
 *  rather than stacking a second. Newest join wins so the snapshot (team
 *  name, current campaign, badge target) tracks the live hunt. */
function mergeJoinedHunts(a: JoinedHunt[], b: JoinedHunt[]): JoinedHunt[] {
  const bySlug = new Map<string, JoinedHunt>()
  for (const hunt of [...a, ...b]) {
    const existing = bySlug.get(hunt.tenantSlug)
    if (!existing || hunt.joinedAt > existing.joinedAt) bySlug.set(hunt.tenantSlug, hunt)
  }
  return [...bySlug.values()]
}

/** Identity of a card for a status check: the org plus the campaign it
 *  snapshotted. JSON so no separator can collide with an id. */
function cardKey({ tenantSlug, campaignId }: HuntRef): string {
  return JSON.stringify([tenantSlug, campaignId])
}

/** The card with no `closed` flag — an open card. */
function openCard(hunt: JoinedHunt): JoinedHunt {
  const open = { ...hunt }
  delete open.closed
  return open
}

function load(): PersistedProgress {
  const empty: PersistedProgress = {
    nickname: '',
    avatarId: null,
    earned: {},
    claimed: {},
    wonHunts: [],
    joinedHunts: [],
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return empty
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return {
      nickname: typeof parsed.nickname === 'string' ? parsed.nickname : '',
      // Avatars used to be emoji. An old value is not an ID of anything,
      // so it resolves to the monogram rather than a broken image.
      avatarId: typeof parsed.avatarId === 'string' ? parsed.avatarId : null,
      // Old saves had a flat `earnedIds`/`redeemed` with no campaign to attach
      // them to — they are dropped on migration rather than mis-assigned. The
      // name, avatar and trophy shelf survive.
      earned: parseEarned(parsed.earned),
      claimed: parseClaimed(parsed.claimed),
      wonHunts: parseWonHunts(parsed.wonHunts),
      joinedHunts: parseJoinedHunts(parsed.joinedHunts),
    }
  } catch {
    // Corrupt or unavailable storage — start clean rather than crash on boot.
    return empty
  }
}

export type { WonHunt }

/**
 * The fan's session: who they are and what they've collected.
 *
 * SEAM: this is device-local by design for now, which means a fan who
 * switches phones or clears data loses progress, and the claim code is
 * trivially forgeable. Both are acceptable for a shell and unacceptable for
 * a real prize — server-side sessions are a prerequisite for redemption.
 */
export const useProgressStore = defineStore('progress', () => {
  const session = useSessionStore()
  const missionsStore = useMissionsStore()
  const initial = load()

  const nickname = ref(initial.nickname)
  const avatarId = ref<string | null>(initial.avatarId)
  /** Per-campaign badge sets and redemption. Dev tooling writes these directly. */
  const earned = ref<Record<string, string[]>>(initial.earned)
  const claimed = ref<Record<string, boolean>>(initial.claimed)
  const wonHunts = ref<WonHunt[]>(initial.wonHunts)
  const joinedHunts = ref<JoinedHunt[]>(initial.joinedHunts)

  /** The hunt in play. Everything current-hunt is scoped to this. */
  const campaignId = computed(() => missionsStore.campaignId)

  const hasProfile = computed(() => nickname.value.trim().length >= 2)

  const earnedIds = computed(() => earned.value[campaignId.value] ?? [])
  const redeemed = computed(() => claimed.value[campaignId.value] === true)
  const earnedCount = computed(() => earnedIds.value.length)
  // The CAMPAIGN is authoritative for how many badges win, not tenant config —
  // the server ships badgeTarget alongside the missions, and a trophy case
  // showing six slots while /redeem unlocks at five is the kind of bug a fan
  // notices at the counter.
  //
  // Only a loaded, published hunt can be complete, and a campaign id is set
  // only by one (whose badge target the contract makes positive). Before a
  // load the target is 0, so `0 >= 0` used to read as a win — which put a
  // "claim your prize" button on the trophy case after a plain reload.
  const isComplete = computed(
    () => campaignId.value !== '' && earnedCount.value >= missionsStore.badgeTarget,
  )
  const remaining = computed(() => Math.max(0, missionsStore.badgeTarget - earnedCount.value))

  const hasBadge = computed(() => (id: string) => earnedIds.value.includes(id))

  /** Won hunts, newest first — the trophy shelf. */
  const trophies = computed(() => [...wonHunts.value].sort((a, b) => b.wonAt - a.wonAt))

  /** Ongoing games for the platform home, newest first, finished ones
   *  dropped. Keyed by CAMPAIGN id, not slug: a club whose last hunt you won
   *  can publish a NEW one, and re-joining updates the card's campaignId — so
   *  the fresh hunt reappears as ongoing while the won one stays a trophy.
   *  Closed cards (the hunt ended, or the org is gone) drop out too: a
   *  Continue button must lead somewhere playable. They stay in
   *  `joinedHunts`, so the collection keeps the history. */
  const ongoing = computed(() => {
    const wonCampaigns = new Set(wonHunts.value.map((h) => h.campaignId))
    return [...joinedHunts.value]
      .filter((h) => !h.closed && !wonCampaigns.has(h.campaignId))
      .sort((a, b) => b.joinedAt - a.joinedAt)
  })

  /**
   * Four-digit claim code, derived from the participant id so it is stable
   * across reloads without a server round trip — and identical to the code the
   * console shows next to this fan on the finisher wall, so staff can match a
   * winner at the counter (`deriveClaimCode` is the shared definition).
   *
   * Prefer the account uid when signed in: it is stable across a browser
   * reinstall, where the device id is not — the same participant id sent on a
   * capture (see CapturePage.vue).
   *
   * SEAM: derived, not issued — anyone can compute another fan's code. A real
   * deployment must have the server mint and invalidate these.
   */
  const claimCode = computed(() => deriveClaimCode(`${session.user?.uid ?? session.deviceId}`))

  function setProfile(name: string, nextAvatarId: string | null): void {
    nickname.value = name.trim()
    avatarId.value = nextAvatarId
  }

  /** Idempotent: re-capturing a mission must not inflate the badge count. */
  function awardBadge(missionId: string): void {
    const id = campaignId.value
    const list = earned.value[id] ?? []
    if (list.includes(missionId)) return
    earned.value = { ...earned.value, [id]: [...list, missionId] }
  }

  /** Marks the current hunt's prize as redeemed on this device. */
  function markRedeemed(): void {
    claimed.value = { ...claimed.value, [campaignId.value]: true }
  }

  /**
   * Records a finished hunt as a trophy. Idempotent per hunt: completing the
   * same hunt again (or a reload while complete) must not add a second trophy.
   * The seed/fallback hunt is skipped by the caller — it has no real name.
   */
  function recordWin(id: string, huntName: string, tenantSlug?: string): void {
    if (!id || wonHunts.value.some((h) => h.campaignId === id)) return
    wonHunts.value = [
      ...wonHunts.value,
      {
        campaignId: id,
        name: huntName,
        wonAt: Date.now(),
        ...(tenantSlug ? { tenantSlug } : {}),
      },
    ]
  }

  /**
   * Records (or refreshes) a joined hunt — an "ongoing game" on home. Called
   * when the fan lands on a real published hub. Keyed by slug: re-entering
   * the same club updates the snapshot (new campaign, new badge target)
   * rather than stacking a duplicate. A no-op once nothing changed, so the
   * deep-watch persist doesn't fire on every hub visit.
   */
  function recordJoin(hunt: JoinedHunt): void {
    const existing = joinedHunts.value.find((h) => h.tenantSlug === hunt.tenantSlug)
    if (
      existing &&
      !existing.closed &&
      existing.campaignId === hunt.campaignId &&
      existing.teamName === hunt.teamName &&
      existing.badgeTarget === hunt.badgeTarget
    ) {
      return
    }
    // Preserve the ORIGINAL joinedAt for an existing card (ordering by first
    // encounter reads better than jumping to the top on every revisit),
    // while taking the fresh campaign/name/target snapshot. The new record
    // carries no `closed`: landing on a live hub is proof it is open.
    const joinedAt = existing?.joinedAt ?? hunt.joinedAt
    joinedHunts.value = [
      ...joinedHunts.value.filter((h) => h.tenantSlug !== hunt.tenantSlug),
      { ...openCard(hunt), joinedAt },
    ]
  }

  /**
   * Rewrites the `closed` flag on saved cards from what the server knows.
   * Only cards whose flag actually changes are replaced, so an all-live check
   * is a no-op for the persist/sync watcher below.
   */
  function applyClosures(match: (hunt: JoinedHunt) => JoinedHunt['closed'] | null): void {
    let changed = false
    const next = joinedHunts.value.map((hunt) => {
      const verdict = match(hunt)
      // null = no information about this card; leave it alone.
      if (verdict === null || verdict === hunt.closed) return hunt
      changed = true
      return verdict ? { ...hunt, closed: verdict } : openCard(hunt)
    })
    if (changed) joinedHunts.value = next
  }

  /**
   * The fan reached an org's page and the server answered definitively:
   * `gone` for a 404 on the org, `ended` for an org with nothing published.
   * Callers must only pass a real server answer — never a network failure: a
   * fan in a concrete concourse is offline, not looking at a dead hunt.
   */
  function closeJoin(tenantSlug: string, reason: NonNullable<JoinedHunt['closed']>): void {
    applyClosures((hunt) => {
      if (hunt.tenantSlug !== tenantSlug) return null
      // The org 404 and the empty mission list race on the same page load;
      // an unknown slug also answers "nothing published". Gone is the
      // stronger fact, so the later, weaker answer must not overwrite it.
      if (reason === 'ended' && hunt.closed === 'gone') return null
      return reason
    })
  }

  /** Asks the server about these cards, in batches of its cap. Whatever
   *  comes back is returned even if a batch failed: a partial answer is
   *  still true for the cards it covers. */
  async function fetchVerdicts(refs: HuntRef[]): Promise<Map<string, HuntStatus>> {
    const batches = Array.from({ length: Math.ceil(refs.length / HUNT_STATUS_BATCH) }, (_, i) =>
      refs.slice(i * HUNT_STATUS_BATCH, (i + 1) * HUNT_STATUS_BATCH),
    )
    const results = await Promise.all(
      batches.map((hunts) => apiPost<unknown>(HUNT_STATUS_ENDPOINT, { hunts })),
    )
    const verdicts = new Map<string, HuntStatus>()
    for (const result of results) {
      if (!result.ok) continue
      const parsed = huntStatusesSchema.safeParse(result.data)
      if (!parsed.success) continue
      for (const s of parsed.data.statuses) verdicts.set(cardKey(s), s.status)
    }
    return verdicts
  }

  /** The last check that answered for every card: when, and which cards. */
  let lastReconciled: { at: number; signature: string } | null = null
  let reconciling: Promise<void> | null = null

  /**
   * Checks every saved card against the server so home never offers a
   * Continue into "no team here". Fire-and-forget and failure-silent: on a
   * network error the cards keep their last known state, which is the right
   * thing to show offline.
   *
   * Throttled: the same set of cards is re-checked at most once per cooldown,
   * while a changed set (a new join, cards merged in from the account) is
   * checked straight away. Only a check that answered for every card starts
   * the cooldown, so anything left unanswered is retried on the next visit.
   *
   * Concurrent callers share one run, and that run loops until the set it
   * checked is still the current one — cards merged in mid-check are not
   * left waiting for the next visit.
   */
  function reconcileJoined(): Promise<void> {
    reconciling ??= (async () => {
      for (;;) {
        const refs = [...joinedHunts.value]
          .sort((a, b) => b.joinedAt - a.joinedAt)
          .map(({ tenantSlug, campaignId }) => ({ tenantSlug, campaignId }))
        const signature = JSON.stringify(refs.map(cardKey))
        const fresh =
          lastReconciled?.signature === signature &&
          Date.now() - lastReconciled.at < RECONCILE_COOLDOWN_MS
        if (!refs.length || fresh) return

        const verdicts = await fetchVerdicts(refs)
        applyClosures((hunt) => {
          const status = verdicts.get(cardKey(hunt))
          if (!status) return null
          return status === 'live' ? undefined : status
        })
        if (!refs.every((ref) => verdicts.has(cardKey(ref)))) return
        lastReconciled = { at: Date.now(), signature }
      }
    })().finally(() => {
      reconciling = null
    })
    return reconciling
  }

  function reset(): void {
    nickname.value = ''
    avatarId.value = null
    earned.value = {}
    claimed.value = {}
    wonHunts.value = []
    joinedHunts.value = []
  }

  // ── Cross-device sync (signed-in fans only) ──────────────────────────
  // Progress is device-local for guests. A signed-in fan gets it made durable
  // under their uid so trophies follow them to a new phone. This is the fan's
  // OWN self-reported progress — continuity, not a trusted ledger — so it
  // never gains authority a forgeable localStorage value did not already have.
  // See stores/session.ts, firebase helpers/fanProgress.ts, docs/architecture.

  function currentPayload(): PersistedProgress {
    return {
      nickname: nickname.value,
      avatarId: avatarId.value,
      earned: earned.value,
      claimed: claimed.value,
      wonHunts: wonHunts.value,
      joinedHunts: joinedHunts.value,
    }
  }

  /** Fire-and-forget: a fan must never wait on, or fail because of, a sync. */
  async function pushToAccount(): Promise<void> {
    const token = await session.getIdToken()
    if (!token) return
    void apiFetch(PROGRESS_ENDPOINT, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(currentPayload()),
    })
  }

  let pushTimer: ReturnType<typeof setTimeout> | null = null
  /** Coalesce the burst of writes from awarding a badge (or a merge) into one
   *  request — 800ms is imperceptible and collapses a five-badge spree. */
  function schedulePush(): void {
    if (pushTimer) clearTimeout(pushTimer)
    pushTimer = setTimeout(() => {
      pushTimer = null
      void pushToAccount()
    }, 800)
  }

  // Clear a pending debounce if the store's scope is torn down (tests, HMR)
  // so the timer can't fire against a disposed store.
  onScopeDispose(() => {
    if (pushTimer) clearTimeout(pushTimer)
  })

  /**
   * On sign-in: pull the account copy, MERGE it into whatever is on this
   * device (never clobber — a guest who then signs in keeps both sides), then
   * push the reconciled result so the server and every device converge. The
   * merge also covers first sign-in: the server has nothing, so this device's
   * play is uploaded as-is.
   */
  async function hydrateFromAccount(): Promise<void> {
    const token = await session.getIdToken()
    if (!token) return

    const result = await apiFetch<{ progress: unknown }>(PROGRESS_ENDPOINT, {
      headers: { Authorization: `Bearer ${token}` },
    })
    // A failed pull must not wipe local progress or upload a half-read state.
    if (!result.ok) return

    const remote = result.data.progress
    if (remote && typeof remote === 'object') {
      // Parse defensively with the same helpers used for localStorage — a doc
      // from an older shape is coerced, never trusted whole.
      const r = remote as Record<string, unknown>
      nickname.value = nickname.value.trim() || (typeof r.nickname === 'string' ? r.nickname : '')
      avatarId.value = avatarId.value ?? (typeof r.avatarId === 'string' ? r.avatarId : null)
      earned.value = mergeEarned(earned.value, parseEarned(r.earned))
      claimed.value = mergeClaimed(claimed.value, parseClaimed(r.claimed))
      wonHunts.value = mergeWonHunts(wonHunts.value, parseWonHunts(r.wonHunts))
      joinedHunts.value = mergeJoinedHunts(joinedHunts.value, parseJoinedHunts(r.joinedHunts))
      // Cards from another device carry THAT device's last check, which may
      // be stale in either direction — re-derive them from the server. The
      // cooldown is cleared first: a merged card can bring a different
      // `closed` flag under the same org and campaign, so an unchanged card
      // list is no proof the flags are fresh.
      lastReconciled = null
      void reconcileJoined()
    }

    // Explicit (not scheduled): converge immediately, and cover the empty-server
    // first-sign-in case where no ref changed and the watch below would not fire.
    void pushToAccount()
  }

  // Hydrate when a real fan account becomes active — never for guests (no uid)
  // and never for admins (staff testing is not a fan session). Fires when the
  // async auth listener resolves the account after boot.
  watch(
    () => (session.isFan ? (session.user?.uid ?? null) : null),
    (uid) => {
      if (uid) void hydrateFromAccount()
    },
    { immediate: true },
  )

  // The moment the badge target is first reached on a real published hunt:
  // report the aggregate completion, and keep the hunt as a trophy.
  // `isComplete` already implies a real published hunt; the slug check only
  // narrows the type.
  //
  // Gated on the win being GENUINELY new. Every load of a finished hunt is a
  // false→true transition (isComplete requires a loaded hunt), and so is
  // hydrateFromAccount merging in a hunt already finished on another device — and
  // reportFanEvent is a fire-and-forget aggregate counter with no server-side
  // dedupe, so an already-won hunt must not report a second completion. By the
  // time this flushes, mergeWonHunts has folded the account's trophy in, so the
  // wonHunts check sees it. recordWin is itself idempotent.
  watch(isComplete, (complete) => {
    const id = campaignId.value
    const slug = missionsStore.slug
    if (!complete || !slug || wonHunts.value.some((h) => h.campaignId === id)) return
    reportFanEvent(slug, id, 'completion')
    recordWin(id, missionsStore.name, slug)
  })

  watch(
    [nickname, avatarId, earned, claimed, wonHunts, joinedHunts],
    () => {
      const payload: PersistedProgress = {
        nickname: nickname.value,
        avatarId: avatarId.value,
        earned: earned.value,
        claimed: claimed.value,
        wonHunts: wonHunts.value,
        joinedHunts: joinedHunts.value,
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
      } catch {
        // Private browsing. Progress stays in memory for this session.
      }

      // A signed-in fan's progress also lives on the server, so it survives a
      // new phone. Debounced and fire-and-forget; guests never reach here.
      if (session.isFan) schedulePush()
    },
    { deep: true },
  )

  return {
    nickname,
    avatarId,
    earned,
    claimed,
    wonHunts,
    // Exposed for the collection page, which needs EVERY hunt this fan has
    // touched — not just the unfinished ones `ongoing` keeps. A finished
    // hunt is the most interesting row in a collection.
    joinedHunts,
    hasProfile,
    earnedIds,
    redeemed,
    earnedCount,
    isComplete,
    remaining,
    hasBadge,
    trophies,
    ongoing,
    claimCode,
    setProfile,
    recordJoin,
    closeJoin,
    reconcileJoined,
    awardBadge,
    markRedeemed,
    recordWin,
    reset,
  }
})
