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
      <BaseButton @click="$router.push({ name: 'home' })">{{ t('notFound.home') }}</BaseButton>
    </div>
  </section>
</template>
