<script setup lang="ts">
/**
 * A fan's chosen avatar, or their initial.
 *
 * Avatars are staff-uploaded images and a fresh install has none, so the
 * monogram is the normal state rather than an error path. Resolution goes
 * through the avatar ID, not a stored URL: re-uploading the set must not
 * silently give somebody a different face.
 */
import { computed } from 'vue'
import { useProgressStore } from '../stores/progress'
import { useFanName } from '../composables/useFanName'
import { useTenantStore } from '../stores/tenant'

const props = withDefaults(defineProps<{ size?: 'sm' | 'lg' }>(), { size: 'sm' })

const progress = useProgressStore()
const tenant = useTenantStore()

const avatar = computed(
  () => tenant.settings.avatars.find((a) => a.id === progress.avatarId) ?? null,
)

const { initial } = useFanName()

const box = computed(() => (props.size === 'lg' ? 'size-14 text-lg' : 'size-7 text-[11px]'))
</script>

<template>
  <img
    v-if="avatar"
    :src="avatar.url"
    :alt="avatar.label"
    class="shrink-0 rounded-full object-cover"
    :class="box"
  />
  <span
    v-else
    class="flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700"
    :class="box"
    aria-hidden="true"
  >
    {{ initial }}
  </span>
</template>
