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
  
  // 监听连接状态
  wsClient.onMessage((data) => {
    if (data.type === 'connected') {
      globalStatus.wsConnected = true
    } else if (data.type === 'disconnected' || data.type === 'error') {
      globalStatus.wsConnected = false
    }
  })
})

onUnmounted(() => {
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
