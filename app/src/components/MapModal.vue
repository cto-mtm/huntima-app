<script setup lang="ts">
/**
 * A dismissible sheet that shows a map. The fan opens it from a mission's map
 * icon (that mission alone) or from the hub's "map" toggle (every located
 * mission), so this is only the CHROME — the backdrop, the panel, the close
 * button, the a11y wiring — and the caller passes the points in.
 *
 * Follows the same overlay contract as CaptureCelebration: it teleports to
 * <body>, traps the page scroll while open, closes on Escape and on a
 * backdrop click, and moves focus to the close control so a screen reader
 * lands inside the dialog rather than behind it.
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AppIcon from './AppIcon.vue'
import LeafletMap, { type MapPoint } from './LeafletMap.vue'

const props = defineProps<{ title: string; points: MapPoint[] }>()
const emit = defineEmits<{ close: []; select: [id: string] }>()

const { t } = useI18n()
const closeButton = ref<HTMLButtonElement | null>(null)

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') emit('close')
}

let previousOverflow = ''

onMounted(() => {
  previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  window.addEventListener('keydown', onKeydown)
  closeButton.value?.focus()
})

onBeforeUnmount(() => {
  document.body.style.overflow = previousOverflow
  window.removeEventListener('keydown', onKeydown)
})

// Selecting a pin should route AND dismiss — the map has done its job once it
// hands the fan to the mission.
function onSelect(id: string): void {
  emit('select', id)
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="map-modal" appear>
      <div
        class="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 pb-safe pt-safe backdrop-blur-sm sm:items-center sm:justify-center"
        @click.self="emit('close')"
      >
        <div
          class="flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-card bg-surface shadow-xl sm:max-w-lg sm:rounded-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="map-modal-title"
        >
          <header class="flex items-center justify-between gap-2 border-b border-brand-100 px-4 py-3">
            <h2 id="map-modal-title" class="text-sm font-bold uppercase tracking-wide text-brand-900">
              {{ props.title }}
            </h2>
            <button
              ref="closeButton"
              type="button"
              class="rounded-full p-1.5 text-muted transition-colors hover:bg-brand-50 hover:text-brand-900"
              :aria-label="t('common.close')"
              @click="emit('close')"
            >
              <AppIcon name="close" class="size-5" />
            </button>
          </header>

          <div class="min-h-[18rem] flex-1">
            <LeafletMap :points="props.points" @select="onSelect" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.map-modal-enter-active,
.map-modal-leave-active {
  transition: opacity 0.2s ease;
}
.map-modal-enter-from,
.map-modal-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .map-modal-enter-active,
  .map-modal-leave-active {
    transition: none;
  }
}
</style>
