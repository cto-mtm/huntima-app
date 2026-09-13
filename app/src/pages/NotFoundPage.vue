<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import BaseButton from '../components/BaseButton.vue'

const { t } = useI18n()
</script>

<template>
  <section class="py-16 text-center">
    <h1 class="text-2xl font-extrabold text-brand-900">{{ t('notFound.title') }}</h1>
    <p class="mt-2 text-sm text-muted">{{ t('notFound.body') }}</p>
    <div class="mt-6">
      <!-- The landing page, not { name: 'home' }: a catch-all match has no
           tenantSlug param to inherit, so a named push would throw. -->
      <BaseButton @click="$router.push('/')">{{ t('notFound.home') }}</BaseButton>
    </div>
  </section>
</template>
