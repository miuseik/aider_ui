<template>
  <router-view />
</template>

<script setup>
import { onMounted, onUnmounted, reactive } from 'vue'
import { wsClient } from './utils/websocket'

// 全局 WebSocket 状态
const globalStatus = reactive({
  wsConnected: false
})

// 暴露给子组件使用
window.__globalStatus = globalStatus

onMounted(() => {
  // 全局初始化 WebSocket
  wsClient.connect()
  
  // 初始状态同步
  globalStatus.wsConnected = wsClient.isConnected
  
  // 定时检查连接状态（每500ms）
  const checkInterval = setInterval(() => {
    globalStatus.wsConnected = wsClient.isConnected
  }, 500)
  
  // 保存 interval ID 以便清理
  window.__wsCheckInterval = checkInterval
})

onUnmounted(() => {
  // 清理定时器
  if (window.__wsCheckInterval) {
    clearInterval(window.__wsCheckInterval)
  }
  wsClient.disconnect()
})
</script>

<style>
/* 全局样式 */
body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
</style>
