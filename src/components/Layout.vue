<template>
  <div class="layout">
    <TopBar />
    <main class="content">
      <slot />
    </main>
  </div>
</template>

<script setup>
import TopBar from '../components/TopBar.vue'
</script>

<style scoped lang="scss">
.layout {
  min-height: 100vh;
  width: 100vw;
}

.content {
  padding-top: 60px; // 为 TopBar 留出空间
  min-height: calc(100vh - 60px);
}
</style>
