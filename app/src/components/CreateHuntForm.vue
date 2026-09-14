<script setup lang="ts">
/**
 * Start a hunt. One field.
 *
 * This is the consumer path and it deliberately never says "organization".
 * Starting a hunt used to mean founding one first — a second name, plus a web
 * address to argue with — before you could type a single mission. Somebody
 * planning a wedding hunt has one thing in mind, and being asked to create an
 * institution around it is the wrong question at the wrong moment.
 *
 * The address still exists, because a QR code has to point somewhere. It is
 * the ACCOUNT's address, not this hunt's: assigned once, on the first hunt,
 * shown here as a suggestion anyone can adjust, and never asked about again.
 * Clubs and venues, which do want a name of their own, go through the
 * organization door instead — see CreateOrgForm.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { slugRejection } from 'shared'
import BaseButton from './BaseButton.vue'
import { useOrgsStore, type CreateFailure } from '../stores/orgs'
import { fanPageUrl } from '../lib/publicUrl'

const { t } = useI18n()
const router = useRouter()
const orgs = useOrgsStore()

const name = ref('')
const creating = ref(false)
const error = ref<CreateFailure | null>(null)

/** Only asked on the very first hunt, and only if they open it. */
const editingHandle = ref(false)
const handle = ref('')

/** Already has a space: the address question is settled and never returns. */
const hasSpace = computed(() => orgs.personalSlug !== null)

type HandleState = 'idle' | 'checking' | 'free' | 'taken' | 'reserved' | 'format' | 'unknown'
const handleState = ref<HandleState>('idle')

let timer: ReturnType<typeof setTimeout> | null = null
let token = 0

watch(handle, (value) => {
  if (timer) clearTimeout(timer)
  const candidate = value.trim()
  if (!candidate) {
    handleState.value = 'idle'
    return
  }
  const local = slugRejection(candidate)
  if (local !== 'ok') {
    handleState.value = local
    return
  }
  handleState.value = 'checking'
  const mine = ++token
  timer = setTimeout(async () => {
    const result = await orgs.checkSlug(candidate)
    if (mine !== token) return
    if (!result) {
      handleState.value = 'unknown'
      return
    }
    handleState.value = result.available ? 'free' : (result.reason ?? 'taken')
  }, 400)
})

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
})

const blocked = computed(
  () =>
    editingHandle.value &&
    (handleState.value === 'taken' ||
      handleState.value === 'reserved' ||
      handleState.value === 'format'),
)

async function submit(): Promise<void> {
  error.value = null
  if (!name.value.trim() || blocked.value) return

  creating.value = true
  const chosen = editingHandle.value ? handle.value.trim() : undefined
  const result = await orgs.createHunt(name.value.trim(), chosen || undefined)
  creating.value = false

  if (!result.ok) {
    // A taken address is only reachable when the server ran out of candidates
    // for them, so open the field rather than reporting a dead end.
    if (result.reason === 'taken') editingHandle.value = true
    else error.value = result.reason
    return
  }

  // Straight into the missions: a hunt with no missions is not yet a hunt.
  void router.push({
    name: 'admin-hunt-edit',
    params: { tenantSlug: result.hunt.tenantSlug, id: result.hunt.campaignId },
  })
}
</script>

<template>
  <form class="space-y-3" @submit.prevent="submit">
    <div>
      <label for="hunt-name" class="block text-xs font-semibold text-brand-900">
        {{ t('orgs.huntNameLabel') }}
      </label>
      <input
        id="hunt-name"
        v-model="name"
        type="text"
        maxlength="80"
        :placeholder="t('orgs.huntNamePlaceholder')"
        class="mt-1 w-full rounded-xl border border-brand-200 bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand-500"
      />
    </div>

    <!-- The address, once, and only for an account that has none yet. -->
    <template v-if="!hasSpace">
      <button
        v-if="!editingHandle"
        type="button"
        class="text-xs font-semibold text-brand-600"
        @click="editingHandle = true"
      >
        {{ t('orgs.chooseAddress') }}
      </button>

      <div v-else>
        <label for="hunt-handle" class="block text-xs font-semibold text-brand-900">
          {{ t('orgs.addressLabel') }}
        </label>
        <div
          class="mt-1 flex items-center gap-1 rounded-xl border bg-surface px-3 py-2.5"
          :class="blocked ? 'border-red-400' : 'border-brand-200'"
        >
          <span class="text-sm text-muted" translate="no">/</span>
          <input
            id="hunt-handle"
            v-model="handle"
            type="text"
            maxlength="50"
            autocapitalize="none"
            autocorrect="off"
            spellcheck="false"
            class="w-full bg-transparent text-sm outline-none"
            translate="no"
          />
        </div>
        <p
          v-if="handleState !== 'idle'"
          class="mt-1 text-xs font-medium"
          :class="
            handleState === 'free'
              ? 'text-green-700'
              : handleState === 'checking' || handleState === 'unknown'
                ? 'text-muted'
                : 'text-red-600'
          "
        >
          {{ t(`orgs.slug.${handleState}`) }}
        </p>
        <p v-else class="mt-1 text-xs text-muted">{{ t('orgs.addressHelp') }}</p>
      </div>
    </template>

    <!-- Already has an address: state it, never ask again. -->
    <p v-else class="text-xs text-muted">
      {{ t('orgs.addressSettled', { url: fanPageUrl(orgs.personalSlug ?? '') }) }}
    </p>

    <BaseButton type="submit" size="lg" :disabled="creating || !name.trim() || blocked">
      {{ creating ? t('orgs.startingHunt') : t('orgs.startHunt') }}
    </BaseButton>

    <p v-if="error" class="text-xs font-medium text-red-600">
      {{ error === 'rate-limited' ? t('orgs.createRateLimited') : t('orgs.createFailed') }}
    </p>
  </form>
</template>
