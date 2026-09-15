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
import { useI18n } from 'vue-i18n'
import { useProgressStore } from '../stores/progress'
import { useFanName } from '../composables/useFanName'
import { useTenantStore } from '../stores/tenant'
import { avatarLabel, platformAvatarById } from '../lib/avatars'

const props = withDefaults(defineProps<{ size?: 'sm' | 'lg' }>(), { size: 'sm' })

const { t } = useI18n()
const progress = useProgressStore()
const tenant = useTenantStore()

// Platform set first (global consumer identity, resolves everywhere), then
// the active org's uploads (only resolvable inside that org — elsewhere an
// org avatar falls back to the monogram rather than a broken image).
const avatar = computed(
  () =>
    platformAvatarById(progress.avatarId) ??
    tenant.settings.avatars.find((a) => a.id === progress.avatarId) ??
    null,
)

// Translated for the platform set, verbatim for an org's upload.
const label = computed(() => (avatar.value ? avatarLabel(avatar.value, t) : ''))

const { initial } = useFanName()

const box = computed(() => (props.size === 'lg' ? 'size-14 text-lg' : 'size-8 text-xs'))
</script>

<template>
  <img
    v-if="avatar"
    :src="avatar.url"
    :alt="label"
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
