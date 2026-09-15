<script setup lang="ts">
/**
 * The consumer home — platform level, inside the unified shell.
 *
 * "What's going on for ME", and ONLY that: the hunts this fan has in progress.
 * A brand's hub answers "what's going on HERE".
 *
 * It used to carry the organizer card too — the list of orgs this account runs
 * and the form to create another. That conflated two hats on one screen. An
 * account can manage one org and play in another, which is the platform's
 * premise, and somebody who lands here is wearing the player hat. For an
 * operator it was worse than untidy: `/me/orgs` returns every org on the
 * platform to that claim, so the fan home was quietly rendering a support
 * console. Organizing lives at `/orgs`, one link away below.
 *
 * Reachable by anyone with a session (guest or signed in); the router guard
 * sends the signed-out to the marketing landing instead.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import AppIcon from '../components/AppIcon.vue'
import EmptyState from '../components/EmptyState.vue'
import { useProgressStore } from '../stores/progress'
import { useSessionStore } from '../stores/session'
import { useFanName } from '../composables/useFanName'

const { t } = useI18n()
const router = useRouter()
const progress = useProgressStore()
const session = useSessionStore()
const { displayName } = useFanName()

/** Earned badges toward each ongoing hunt's target — from the same
 *  per-campaign map the hub uses, so the count matches once re-entered. */
function earnedCount(campaignId: string): number {
  return progress.earned[campaignId]?.length ?? 0
}

function enter(slug: string): void {
  void router.push(`/${slug}`)
}

// Organizing needs an accountable owner, so a guest is sent to sign in first
// and carried on to the organizer hub afterwards. The link itself stays
// visible to them: it is how someone who came to play discovers they can run
// one, which is the funnel the whole consumer tier depends on.
const canOrganize = computed(() => session.isFan || session.isAdmin)
const organizerTarget = computed(() =>
  canOrganize.value ? { name: 'orgs' } : { name: 'signin', query: { to: '/orgs' } },
)
</script>

<template>
  <section class="py-5">
    <h1 class="display-title display-title--sm text-3xl">
      {{ t('hub.greeting', { nickname: displayName }) }}
    </h1>
    <div
      class="mt-1.5 h-1.5 w-16 -skew-x-12 rounded-full bg-gradient-to-r from-accent-400 to-accent-alt-500"
      aria-hidden="true"
    />

    <!-- ── Ongoing hunts ───────────────────────────────────────── -->
    <h2 class="mt-7 text-xl font-extrabold uppercase italic tracking-tight text-brand-900">
      {{ t('home.ongoingHeading') }}
    </h2>

    <!-- Deliberately no CTA: the only way into a hunt is a QR code at a
         venue, so an invented button here would lead nowhere. The body says
         what to do instead. -->
    <EmptyState
      v-if="!progress.ongoing.length"
      shape="pin"
      :title="t('home.ongoingEmptyTitle')"
      :body="t('home.ongoingEmpty')"
    />

    <ul v-else class="mt-3 grid gap-2.5">
      <li
        v-for="hunt in progress.ongoing"
        :key="hunt.tenantSlug"
        class="flex items-center gap-3 rounded-card bg-surface p-3.5 shadow-md shadow-brand-900/5 ring-1 ring-brand-100"
      >
        <div
          class="flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent-400 to-accent-alt-500 text-white shadow-md shadow-accent-600/30"
          aria-hidden="true"
        >
          <AppIcon name="missions" class="size-6" />
        </div>
        <div class="min-w-0 flex-1">
          <h3 class="truncate font-bold text-brand-900" translate="no">{{ hunt.teamName }}</h3>
          <p class="mt-0.5 text-xs font-semibold text-muted">
            {{ t('home.badgeProgress', { count: earnedCount(hunt.campaignId), target: hunt.badgeTarget }) }}
          </p>
        </div>
        <button
          type="button"
          class="shrink-0 rounded-full bg-brand-600 px-4 py-2 text-xs font-bold text-white active:scale-[0.96]"
          @click="enter(hunt.tenantSlug)"
        >
          {{ t('home.continue') }}
        </button>
      </li>
    </ul>

    <!-- ── The other hat, one link wide ────────────────────────── -->
    <!-- Deliberately a line and not a card: this page belongs to the player.
         Everything about running a hunt lives at /orgs. -->
    <RouterLink
      :to="organizerTarget"
      class="mt-8 inline-block text-sm font-semibold text-brand-600"
    >
      {{ t('home.organizerLink') }}
    </RouterLink>
  </section>
</template>
