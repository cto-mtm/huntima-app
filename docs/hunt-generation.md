# Hunt mission generation prompt

A prompt for having an LLM draft the **missions** for a hunt — the ten-ish photo
tasks — so staff aren't writing them by hand every game, and so they don't feel
copy-pasted week to week.

It generates **only the missions**. Staff still create the hunt itself — its
name, badge target, and prize — in the editor; generation just fills the mission
list. That keeps the model out of anything with real-world stakes (prizes, win
conditions) and maps exactly onto the app's `PUT /t/:slug/admin/campaigns/:id/missions`
endpoint.

It's a plain prompt today: fill in the inputs, paste it into an LLM, get JSON,
review it, and load it via the hunt editor (or the seed). It's written to drop
straight into a **"Generate missions" button** later — see the last section.

---

## What it takes in

Everything is optional; more context yields better, less generic missions.

- **Team / venue context** — team name, ballpark, mascot, notable landmarks
  (statues, gates, the facade, a giant sign).
- **Player roster** — names, numbers, any photogenic traits (glasses, a beard,
  a leg kick). Used for a few *concrete* missions.
- **Vendors / concessions** — stand names and roughly where they are.
- **Existing missions** — the titles + hints of missions you've used before, so
  the model can avoid repeating them. This is the main anti-repetition lever.
- **How many missions** to write.

No badge target and no prize — those live on the hunt, and staff set them.

## What it gives back

JSON: a `missions` array of simple objects. The importer adds `id`, `order`,
`targetImageUrl: null`, `group: null` and `spot: null`, wraps `title`/`hint` as
`{ text }`, and validates the completed list with `missionListPayloadSchema`
before saving.

`group` (the level a mission belongs to) and `spot` (where it sits on the venue
map) are deliberately NOT generated. Both default to null in the schema, so a
payload without them still parses. Levels are a judgement about pacing a
specific hunt and pins are a judgement about a specific building — neither is
something a model can infer from a venue's name, and a wrong one is worse than
an absent one because it looks authored. Staff add both in the hunt editor.

```json
{
  "missions": [
    {
      "kind": "photo",
      "title": "Big Cup Energy",
      "hint": "The oversized soda cup at a concourse stand. You can't miss it.",
      "color": "#c8102e"
    }
  ]
}
```

Field limits (validated on import — keep the model inside them):

| Field | Rule |
|---|---|
| `missions` | 1–50 items; **8–12 is the sweet spot** for one game |
| `kind` | `"photo"` (near you / concourse) or `"spyglass"` (far away / on the field, needs zoom) |
| `title` | 1–200 chars, short and playful |
| `hint` | 1–200 chars, one clear actionable sentence |
| `color` | `#rrggbb` — the placeholder tile shown until a target photo is uploaded |

---

## Mission design rules (the important part)

**Mix concrete and generic targets.** Aim for roughly **one-third concrete,
two-thirds generic.**

- *Concrete* — tied to the data you passed: "Player #22 at the plate", "the
  [Vendor] stand sign", "the retired #14 banner". Specific, but they only work
  for that game and go stale fast.
- *Generic* — self-contained and reusable: "a player wearing glasses", "someone
  in a home jersey", "a hot dog with everything on it", "a fan doing the wave",
  "the biggest foam finger you can find". These are what keep hunts fresh across
  games, and they're checkable from the description alone.

**Vary the categories.** Don't make ten "find a sign" missions. Spread across:
people, food & drink, signage & branding, architecture & landmarks, action &
moments (a swing, a catch, the stretch), objects (glove, ball, pennant,
scoreboard), and the mascot.

**Don't repeat the past.** Given the existing missions, avoid reusing their
concepts, not just their exact wording. If prior hunts did "find the mascot,"
this batch finds something else — or frames the mascot in a new way.

**Everything must be judgeable from one photo.** A vision model scores the
capture, so describe *observable* things, not backstory or trivia. "A player
mid-swing" ✅. "The player who hit a walk-off in 2019" ❌.

**Safe and family-friendly.** Achievable from the stands or concourse — never
onto the field or anywhere staff-only. Kid-appropriate. Frame crowd/people shots
as fun ("someone in team colors"), never as singling out a stranger.

**Balance effort.** Most missions easy, a couple that take some looking.

---

## The prompt (copy this)

Replace the `{{…}}` placeholders. If you have nothing for a section, write
"(none provided)".

```text
You are writing the missions for a photo scavenger hunt played by families at a
live sports game. Players walk the concourse and stands and photograph things to
earn badges. Write ONLY the list of missions — not the hunt's name, its win
condition, or its prize.

Produce a single JSON object and NOTHING else — no prose, no markdown fence —
matching exactly:

{
  "missions": [
    { "kind": "photo" | "spyglass", "title": string (<=200), "hint": string (<=200), "color": "#rrggbb" }
  ]
}

Rules:
- Produce {{MISSION_COUNT}} missions.
- Mix ~1/3 CONCRETE missions (drawn from the roster / vendors / landmarks below)
  with ~2/3 GENERIC missions (self-contained, reusable, e.g. "a player wearing
  glasses", "a hot dog with everything", "a fan in a home jersey").
- Vary the categories: people, food & drink, signage, architecture, action,
  objects, mascot. Do not repeat a category more than twice.
- Each mission must be judgeable from a single photo — describe observable
  things, no trivia or backstory.
- Family-friendly and safe: reachable from the stands/concourse, never on the
  field, never singling out an identifiable stranger.
- kind = "spyglass" only for far-away / on-field subjects that need zoom;
  otherwise "photo".
- Give each mission a distinct #rrggbb color.
- DO NOT reuse the concepts or wording of the existing missions listed below.

TEAM / VENUE CONTEXT:
{{TEAM_CONTEXT}}

PLAYER ROSTER:
{{PLAYER_ROSTER}}

VENDORS / CONCESSIONS:
{{VENDORS}}

VENUE LANDMARKS:
{{VENUE_LANDMARKS}}

EXISTING MISSIONS (avoid repeating these — titles and hints):
{{EXISTING_MISSIONS}}

Return only the JSON object.
```

---

## Verification caveat (read this)

Generated missions have **no target photo** (`targetImageUrl: null`). Today the
verifier treats a mission with no target as **hint-only and auto-passes it** —
see `functions/src/helpers/vision.ts` (the stub path). So a batch of freshly
generated missions is effectively **honor-system**: every capture earns the
badge without real checking.

Two ways to make generated missions genuinely verified:

1. **Upload a target photo** per mission in the hunt editor (best for concrete
   missions). Then the existing image-to-image check applies.
2. **Add a hint-only verification path** (a seam, not built): send just the
   fan's photo + the mission hint to the model and ask "does this photo show
   [hint]?". This is what makes *generic* missions ("a player with glasses")
   truly checkable without a staged target image — and it's the natural
   companion to auto-generated missions. It belongs in `vision.ts` alongside the
   image-to-image path.

If you want generated missions to be real missions rather than a checklist, (2)
is the follow-up to schedule.

---

## Later: the "Generate missions" button

The intended flow, kept as a seam for now (don't build it speculatively — same
reasoning as the other seams in `docs/architecture.md`):

- A **"Generate missions"** button **inside the hunt editor** (the hunt already
  exists as a draft with its name/target/prize). Optional small form: how many,
  and roster / vendors text (or pulled from tenant config once that exists).
- It calls a **server-side** function endpoint (the model key stays on the
  server, exactly like the Gemini verify key — never in the bundle). The function
  fills this prompt's placeholders with the form inputs **plus the existing
  missions read from Firestore**, calls the model, and returns the `missions`
  JSON.
- The importer completes each mission (`id`, `order`, `targetImageUrl: null`,
  `group: null`, `spot: null`, `{ text }` wrapping) and validates the list
  with `missionListPayloadSchema`
  before anything is shown, so a malformed generation fails loudly instead of
  writing junk.
- The missions populate the **editor's draft** (append to, or replace, what's
  there) for staff to review, reword, reorder, and add target photos — then the
  existing **Save missions** commits them. Generation drafts, humans publish.

Implementation notes for whoever builds it:
- Keep it **provider-agnostic**. This prompt and the `missions` JSON shape are the
  stable interface; only the API call differs between providers. Wrap generation
  in one small server-side function — mirroring `verifyCapture` in `vision.ts` —
  with the provider chosen by env, so switching models never touches the prompt,
  the schema, or the callers.
- **Default to Gemini.** The app already calls it for capture verification, so
  the key (`GEMINI_API_KEY`) and the server-side call pattern already exist in
  `vision.ts` — reuse them. Claude or OpenAI drop in behind the same wrapper
  later with no change to this prompt.
- Force **structured JSON output** so you parse a validated object, not free
  text. Every provider offers this under a different name: Gemini via
  `generationConfig.responseMimeType: 'application/json'` plus a `responseSchema`
  (the app already uses the mime-type half in `vision.ts`); Anthropic and OpenAI
  via a forced tool/function call. Same JSON shape either way — always re-validate
  the completed list with `missionListPayloadSchema` before trusting it, because a
  model can still return the wrong shape.
- The big static rules block is a good candidate for **prompt caching** where the
  provider supports it.
- Confirm exact model IDs, parameters, and the structured-output mechanism
  against the chosen provider's current API reference at build time — don't
  hardcode them from memory.
