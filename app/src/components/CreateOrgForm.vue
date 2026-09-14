<script setup lang="ts">
/**
 * Claim an organization: a name, a web address, and you are in your console.
 *
 * Lives in two places on purpose — the consumer home (the "Your hunts" card)
 * and the org picker, which is where an organizer who signed in with no orgs
 * lands. One component so the two doors cannot drift apart, and so the slug
 * rules are enforced in exactly one form.
 *
 * The address is checked *while typing*, not on submit. Claiming a URL is the
 * one irreversible choice here (renames are a document move, deliberately
 * unsupported — see docs/platform-migration.md D1), so finding out it was
 * taken should never cost someone the name they had already settled on.
 */
import { onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { slugRejection } from 'shared'
import BaseButton from './BaseButton.vue'
import { useOrgsStore, type CreateFailure } from '../stores/orgs'

const { t } = useI18n()
const router = useRouter()
const orgs = useOrgsStore()

const name = ref('')
const slug = ref('')
/** Set once the address is hand-edited, so it stops tracking the name. */
const slugEdited = ref(false)

const creating = ref(false)
const createError = ref<CreateFailure | null>(null)

/**
 * What we currently know about the typed address. `unknown` is its own state:
 * offline or rate-limited means we could not ask, which must not read as
 * either available or taken. The create call is the real judge — it resolves a
 * collision atomically server-side.
 */
type SlugState = 'idle' | 'checking' | 'free' | 'taken' | 'reserved' | 'format' | 'unknown'
const slugState = ref<SlugState>('idle')

/** "Sarah & Tom's Wedding" → "sarah-toms-wedding". Best-effort; the organizer
 *  can edit the result, and shared's tenantSlugSchema is the real judge. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
}

watch(name, (value) => {
  if (!slugEdited.value) slug.value = slugify(value)
})

// One in-flight check at a time, and only after typing settles. A keystroke
// per request would spend the probe's rate limit on prefixes nobody claimed.
let timer: ReturnType<typeof setTimeout> | null = null
/** Guards against a slow answer for an old address overwriting a newer one. */
let checkToken = 0

watch(slug, (value) => {
  if (timer) clearTimeout(timer)
  createError.value = null

  const candidate = value.trim()
  if (!candidate) {
    slugState.value = 'idle'
    return
  }

  // Malformed and reserved are both answerable offline, from the same rules
  // the server applies — no round trip, and a reserved word gets told it is
  // reserved instead of being blamed on its length.
  const local = slugRejection(candidate)
  if (local !== 'ok') {
    slugState.value = local
    return
  }

  slugState.value = 'checking'
  const token = ++checkToken
  timer = setTimeout(async () => {
    const result = await orgs.checkSlug(candidate)
    if (token !== checkToken) return
    if (!result) {
      slugState.value = 'unknown'
      return
    }
    slugState.value = result.available ? 'free' : (result.reason ?? 'taken')
  }, 400)
})

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
})

async function submit(): Promise<void> {
  createError.value = null
  const candidate = slug.value.trim()
  const local = slugRejection(candidate)
  if (!name.value.trim() || local !== 'ok') {
    slugState.value = local === 'ok' ? slugState.value : local
    return
  }

  creating.value = true
  const result = await orgs.create(candidate, name.value.trim())
  creating.value = false

  if (!result.ok) {
    if (result.reason === 'taken') slugState.value = 'taken'
    else createError.value = result.reason
    return
  }

  // Straight into their new console — the hunt builder is the product.
  void router.push({ name: 'admin-hunts', params: { tenantSlug: candidate } })
}
</script>

<template>
  <form class="space-y-3" @submit.prevent="submit">
    <div>
      <label for="org-name" class="block text-xs font-semibold text-brand-900">
        {{ t('orgs.nameLabel') }}
      </label>
      <input
        id="org-name"
        v-model="name"
        type="text"
        maxlength="60"
        :placeholder="t('orgs.namePlaceholder')"
        class="mt-1 w-full rounded-xl border border-brand-200 bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500"
      />
    </div>

    <div>
      <label for="org-slug" class="block text-xs font-semibold text-brand-900">
        {{ t('orgs.slugLabel') }}
      </label>
      <div
        class="mt-1 flex items-center gap-1 rounded-xl border bg-surface px-3 py-2.5"
        :class="
          slugState === 'taken' || slugState === 'reserved' || slugState === 'format'
            ? 'border-red-400'
            : 'border-brand-200'
        "
      >
        <span class="text-sm text-muted" translate="no">/</span>
        <input
          id="org-slug"
          v-model="slug"
          type="text"
          maxlength="50"
          autocapitalize="none"
          autocorrect="off"
          spellcheck="false"
          class="w-full bg-transparent text-sm outline-none"
          translate="no"
          @input="slugEdited = true"
        />
      </div>

      <!-- One line, four possible readings. "Checking" and "couldn't check"
           are distinct from "taken" on purpose: an organizer must never read a
           network failure as a name being gone. -->
      <p
        v-if="slugState !== 'idle'"
        class="mt-1 text-xs font-medium"
        :class="
          slugState === 'free'
            ? 'text-green-700'
            : slugState === 'checking' || slugState === 'unknown'
              ? 'text-muted'
              : 'text-red-600'
        "
      >
        {{ t(`orgs.slug.${slugState}`) }}
      </p>
      <p v-else class="mt-1 text-xs text-muted">{{ t('orgs.slugHelp') }}</p>
    </div>

    <BaseButton
      type="submit"
      size="lg"
      :disabled="creating || !name.trim() || slugState === 'taken' || slugState === 'reserved' || slugState === 'format'"
    >
      {{ creating ? t('orgs.creating') : t('orgs.create') }}
    </BaseButton>

    <p v-if="createError" class="text-xs font-medium text-red-600">
      {{
        createError === 'rate-limited'
          ? t('orgs.createRateLimited')
          : createError === 'not-allowed'
            ? t('orgs.createNotAllowed')
            : t('orgs.createFailed')
      }}
    </p>
  </form>
</template>
