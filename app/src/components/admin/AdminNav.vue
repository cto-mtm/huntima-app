<script setup lang="ts">
/**
 * The org console's top chrome: two floating buttons — the org mark (→ the
 * console dashboard) on the left, the fan profile on the right — plus a third
 * "menu" button that opens the full console nav in a modal (AdminNavModal).
 *
 * The old two-row bar (identity row + wrapping tab strip) is gone: on a phone
 * a console with five destinations reads better behind one menu than as a
 * strip of pills, and the floating buttons match the fan shell exactly. All
 * navigation and account actions now live in the modal.
 */
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import FanAvatar from '../FanAvatar.vue'
import TeamMark from '../TeamMark.vue'
import AppIcon from '../AppIcon.vue'
import AdminNavModal from './AdminNavModal.vue'
import { useTenantStore } from '../../stores/tenant'

const { t } = useI18n()
const tenant = useTenantStore()

const menuOpen = ref(false)
</script>

<template>
  <!-- Click-through container; only the buttons themselves are interactive.
       Inner max-w-5xl matches the console content column so the buttons align
       to its edges. -->
  <header class="pointer-events-none fixed inset-x-0 top-0 z-20 pt-safe px-safe">
    <div class="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
      <RouterLink
        :to="{ name: 'admin-hunts' }"
        :aria-label="tenant.settings.teamName"
        class="pointer-events-auto flex size-10 items-center justify-center rounded-full bg-surface/90 shadow-lg shadow-brand-900/15 ring-1 ring-brand-100 backdrop-blur-md transition-transform duration-150 active:scale-95"
      >
        <TeamMark />
      </RouterLink>

      <div class="flex items-center gap-2">
        <button
          type="button"
          :aria-label="t('hunts.menu')"
          class="pointer-events-auto flex size-10 items-center justify-center rounded-full bg-surface/90 text-brand-700 shadow-lg shadow-brand-900/15 ring-1 ring-brand-100 backdrop-blur-md transition-transform duration-150 active:scale-95"
          @click="menuOpen = true"
        >
          <AppIcon name="list" class="size-5" />
        </button>

        <RouterLink
          :to="{ name: 'profile' }"
          :aria-label="t('profile.title')"
          class="pointer-events-auto rounded-full bg-gradient-to-br from-accent-400 to-accent-alt-500 p-0.5 shadow-[0_2px_0_0_var(--color-accent-alt-600)] transition-transform duration-150 active:translate-y-[2px] active:shadow-none"
        >
          <FanAvatar class="ring-2 ring-surface" />
        </RouterLink>
      </div>
    </div>
  </header>

  <AdminNavModal v-if="menuOpen" @close="menuOpen = false" />
</template>
