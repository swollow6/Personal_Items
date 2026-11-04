<script setup lang="ts">
import EmptyState from '../components/EmptyState.vue'
</script>
<template>
  <EmptyState title="这个页面走丢了" description="回到首页，继续记录你的生活。">
    <RouterLink to="/" class="button primary">返回首页</RouterLink>
  </EmptyState>
</template>
