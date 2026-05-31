<template>
  <div class="app-layout">
    <div class="top">
    <TopBar />
    </div>
    <main class="main-content">
      <router-view/>
    </main>
    <AppFooter/>
  </div>
</template>

<script setup>
import TopBar from './TopBar.vue'
import AppFooter from './AppFooter.vue'
</script>

<style lang="scss" scoped>
.app-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}
.top{
  height: 60px;
}
.main-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}
</style>
