<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import BaseButton from '../components/BaseButton.vue'
import EmptyState from '../components/EmptyState.vue'

const { t } = useI18n()
</script>

<template>
  <section class="flex min-h-dvh flex-col justify-center">
    <EmptyState shape="ticket" :title="t('notFound.title')" :body="t('notFound.body')">
      <!-- The landing page, not { name: 'home' }: a catch-all match has no
           tenantSlug param to inherit, so a named push would throw. -->
      <BaseButton size="lg" @click="$router.push('/')">{{ t('notFound.home') }}</BaseButton>
    </EmptyState>
  </section>
</template>
