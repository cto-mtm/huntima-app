<script setup lang="ts">
/**
 * The payoff. A verified capture takes over the whole screen.
 *
 * ── Why this is an overlay and not a card ─────────────────────
 * It used to be a card in the page flow, below the photo. On a 740px phone
 * that put the single biggest moment in the product *under the fold, behind
 * the nav bar* — you had to scroll to find out you had won. Everything else
 * about the beat was already right; it was just happening somewhere nobody
 * was looking.
 *
 * So it teleports to <body> and covers everything: no shell, no nav, no
 * scrolling past it. The dark showcase ground is doing the same job it does
 * on the trophy shelf — gold and confetti need a dark room.
 *
 * ── It owns its own theatre ───────────────────────────────────
 * Confetti, the chest's opening beat and the ray sweep all live here rather
 * than in CapturePage, because they are this component's performance and
 * nothing else can meaningfully set them. CapturePage decides WHETHER a
 * celebration happens; this decides what one looks like.
 *
 * Every loop here is state-scoped in the strict sense of docs/animations.md:
 * the fan cannot sit in this state — it ends when they press one of the two
 * buttons — so the float, the halo and the rays die with it and do not count
 * against the ambient budget.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AppIcon from './AppIcon.vue'
import BaseButton from './BaseButton.vue'
import RewardChest from './reward/RewardChest.vue'
import RewardMedallion from './reward/RewardMedallion.vue'
import { useReducedMotion } from '../composables/useReducedMotion'

const props = defineProps<{
  /** The mission's own color, so the burst belongs to the thing just won. */
  missionColor: string
  /** This capture finished the whole hunt — a different size of event. */
  justCompleted: boolean
  count: number
  target: number
  /** Emulator notice: the verdict was not actually model-checked. */
  stubbed?: boolean
}>()

const emit = defineEmits<{ primary: []; secondary: [] }>()

const { t } = useI18n()
const reducedMotion = useReducedMotion()

const primaryButton = ref<InstanceType<typeof BaseButton> | null>(null)

/* ── Confetti ─────────────────────────────────────────────────
   Each piece is a DOM span whose arc lives in inline custom properties: a mid
   keyframe that rises and an end keyframe that falls past it, so "gravity" is
   faked entirely with transform. Colors come from the mission plus the brand
   tokens, so the burst re-skins with the tenant like everything else. */
interface ConfettiPiece {
  id: number
  style: Record<string, string>
}

const confetti = ref<ConfettiPiece[]>([])

function makeConfetti(color: string, count: number): ConfettiPiece[] {
  const palette = [color, 'var(--color-accent-400)', 'var(--color-accent-alt-500)', '#fff']
  // Full-screen now, so the pieces have to actually cross a screen: the throw
  // is measured in viewport units rather than the old card-sized pixels.
  const reach = Math.max(window.innerWidth, window.innerHeight) * 0.55

  return Array.from({ length: count }, (_, i) => {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5
    const distance = reach * (0.45 + Math.random() * 0.55)
    const rot = Math.round(Math.random() * 720 - 360)
    return {
      id: i,
      style: {
        width: `${6 + Math.round(Math.random() * 6)}px`,
        height: `${8 + Math.round(Math.random() * 8)}px`,
        backgroundColor: palette[i % palette.length],
        borderRadius: Math.random() > 0.6 ? '9999px' : '2px',
        animationDelay: `${Math.round(Math.random() * 160)}ms`,
        '--confetti-mid-x': `${(Math.cos(angle) * distance * 0.7).toFixed(1)}px`,
        '--confetti-mid-y': `${(Math.sin(angle) * distance * 0.7 - 40).toFixed(1)}px`,
        '--confetti-mid-rot': `${(rot * 0.6).toFixed(0)}deg`,
        '--confetti-end-x': `${(Math.cos(angle) * distance).toFixed(1)}px`,
        '--confetti-end-y': `${(Math.sin(angle) * distance + 90).toFixed(1)}px`,
        '--confetti-end-rot': `${rot.toFixed(0)}deg`,
      },
    }
  })
}

/**
 * The chest renders closed and opens a beat later. The beat matters: a chest
 * that is already open when you arrive is a picture of a chest, not an
 * opening. Under reduced motion the transition is dead, so this just flips it
 * to open a fraction late, which is unremarkable.
 */
const chestOpen = ref(false)
let chestTimer: ReturnType<typeof setTimeout> | null = null

const dots = computed(() => Math.min(props.target, 24))

function onKeydown(event: KeyboardEvent): void {
  // Escape takes the quiet exit, not the prize claim — a dismissal should
  // never be the thing that navigates somebody to a reward counter.
  if (event.key === 'Escape') emit('secondary')
}

let previousOverflow = ''

onMounted(() => {
  confetti.value = reducedMotion.value
    ? []
    : makeConfetti(props.missionColor, props.justCompleted ? 60 : 38)

  if (props.justCompleted) {
    chestTimer = setTimeout(() => {
      chestOpen.value = true
    }, 420)
  }

  // The page underneath must not scroll behind a full-screen moment.
  previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'

  window.addEventListener('keydown', onKeydown)
  // Move focus in, so a screen reader lands on the celebration rather than
  // staying on a capture button that is now behind an overlay.
  primaryButton.value?.$el?.focus?.()
})

onBeforeUnmount(() => {
  if (chestTimer) clearTimeout(chestTimer)
  document.body.style.overflow = previousOverflow
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <!-- `appear` because this mounts already-true: the celebration is created
         at the moment it should be animating in, never toggled later. -->
    <Transition name="celebrate" appear>
    <div
      class="showcase fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden px-6 pb-safe pt-safe"
      role="dialog"
      aria-modal="true"
      aria-labelledby="celebration-title"
    >
      <!-- Rays. A repeating conic gradient turning very slowly behind the
           badge — the one thing that makes a full screen read as a
           celebration rather than as a page with a badge on it. Transform
           only, and it dies with the overlay. -->
      <div
        v-if="!reducedMotion"
        class="celebrate-rays pointer-events-none absolute left-1/2 top-[38%] size-[180vmax] -translate-x-1/2 -translate-y-1/2 opacity-40"
        style="
          background: repeating-conic-gradient(
            from 0deg,
            rgba(255, 255, 255, 0.11) 0deg 7deg,
            transparent 7deg 14deg
          );
        "
        aria-hidden="true"
      />

      <div class="relative flex w-full max-w-sm flex-col items-center text-center">
        <div class="relative flex size-32 items-center justify-center">
          <!-- Mission-colored halo, breathing via opacity. The glow itself is
               a static radial gradient, never an animated box-shadow. -->
          <span
            class="badge-halo absolute -inset-8 rounded-full opacity-50"
            :style="{ background: `radial-gradient(closest-side, ${props.missionColor}, transparent)` }"
            aria-hidden="true"
          />

          <!-- Finishing the hunt is a different size of event from earning a
               badge, so it gets a different object: the chest, opening
               (Recipe 19). A single badge keeps the badge — escalating every
               capture to treasure is how the last one stops meaning
               anything. -->
          <RewardChest
            v-if="props.justCompleted"
            :open="chestOpen"
            class="badge-pop relative block w-40"
          />
          <template v-else>
            <span class="badge-ring absolute inset-2 rounded-full bg-accent-400" aria-hidden="true" />
            <RewardMedallion
              shape="rosette"
              tier="gold"
              emblem="badge"
              :crest="props.missionColor"
              class="badge-pop relative size-32 drop-shadow-2xl"
            />
          </template>

          <!-- The burst fans out from the badge centre and arcs down past the
               screen edge. Empty under reduced motion. -->
          <span
            v-for="piece in confetti"
            :key="piece.id"
            class="confetti-piece pointer-events-none absolute left-1/2 top-1/2 -ml-1 -mt-1"
            :style="piece.style"
            aria-hidden="true"
          />
        </div>

        <!-- The loudest text moment in the app, on purpose. -->
        <h2
          id="celebration-title"
          class="display-title display-title--on-dark title-bounce mt-6 text-4xl"
        >
          {{ props.justCompleted ? t('capture.huntCompleteTitle') : t('capture.successTitle') }}
        </h2>
        <p class="mt-2 text-sm text-white/75">
          {{ props.justCompleted ? t('capture.huntCompleteBody') : t('capture.successBody') }}
        </p>

        <!-- The meter tick: every win visibly moves the count toward the
             prize. The newest dot pops in after the badge lands. -->
        <template v-if="props.target > 0">
          <p class="mt-7 text-xs font-bold uppercase tracking-widest text-white/60">
            {{ t('capture.progressCount', { count: props.count, target: props.target }) }}
          </p>
          <div class="mt-2 flex flex-wrap justify-center gap-1.5" aria-hidden="true">
            <span
              v-for="i in dots"
              :key="i"
              class="size-3 rounded-full"
              :class="[
                i <= props.count ? 'bg-tier-gold-500' : 'bg-white/20',
                i === props.count ? 'badge-dot-pop' : '',
              ]"
            />
          </div>
        </template>

        <p v-if="props.stubbed" class="mt-5 text-[11px] font-medium text-white/55">
          {{ t('capture.stubNotice') }}
        </p>

        <div class="mt-8 grid w-full gap-2.5">
          <BaseButton
            ref="primaryButton"
            size="lg"
            :icon="props.justCompleted ? 'prize' : 'missions'"
            @click="emit('primary')"
          >
            {{ props.justCompleted ? t('capture.claimPrize') : t('capture.keepGoing') }}
          </BaseButton>
          <!-- Secondary reads on the dark ground: the light `secondary`
               variant would be a white slab under a white headline. -->
          <button
            type="button"
            class="inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-base font-bold text-white/80 ring-1 ring-white/25 transition-transform duration-150 active:scale-[0.97]"
            @click="emit('secondary')"
          >
            <AppIcon :name="props.justCompleted ? 'missions' : 'trophies'" class="size-5" />
            {{ props.justCompleted ? t('capture.keepGoing') : t('capture.viewTrophies') }}
          </button>
        </div>
      </div>
    </div>
    </Transition>
  </Teleport>
</template>
