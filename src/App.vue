<template>
  <router-view />
</template>

<script setup>
import { onMounted, onUnmounted, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { wsClient } from './utils/websocket'
import { useServoStore } from '@/stores/servo'
import { useRobotStore } from '@/stores/robot'

// 全局 WebSocket 状态
const globalStatus = reactive({
  wsConnected: false
})

// 暴露给子组件使用
window.__globalStatus = globalStatus

// 全局 WebSocket 消息监听清理函数
let globalWsUnsubscribe = null
// 保存 setTimeout ID 用于清理
let poseRetryTimer = null

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

  // === 应用初始化：预加载舵机 ID 配置到 Pinia ===
  const servoStore = useServoStore()
  servoStore.fetchServoIdConfig()

  // === 全局机器人状态监听（跨页面持久化） ===
  const robotStore = useRobotStore()
  globalWsUnsubscribe = wsClient.onMessage((data) => {
    // 机器人硬件信息推送 → 更新连接状态
    if (data.type === 'robot_hardware_info') {
      if (data.is_engaged !== undefined) {
        robotStore.setEngaged(!!data.is_engaged)
      }
      // 机器人连接成功后自动获取可用姿态列表
      if (data.robot_connected) {
        robotStore.setPoseLoading(true)
        wsClient.send({ type: 'api_command', action: 'list_poses' })
      }
      // 机器人断开后清除姿态缓存
      if (!data.robot_connected && data.is_engaged === false) {
        robotStore.resetOnDisconnect()
      }
    }
    // 姿态列表响应
    if (data.type === 'list_poses_response') {
      robotStore.setPoseList(data.poses || {})
      robotStore.setPoseLoading(false)
    }
    // goto_pose 响应
    if (data.type === 'goto_pose_response') {
      if (data.success) {
        ElMessage.success(data.message || '姿态切换成功')
      } else {
        ElMessage.error(data.message || '姿态切换失败')
      }
    }
  })

  // WebSocket 重连后，如果之前机器人已连接，延迟重试姿态同步
  // （避免重连瞬间 Terminal 还没 ready）
  poseRetryTimer = setTimeout(() => {
    if (wsClient.isConnected && robotStore.isRobotEngaged && Object.keys(robotStore.poseList).length === 0) {
      robotStore.setPoseLoading(true)
      wsClient.send({ type: 'api_command', action: 'list_poses' })
    }
  }, 3000)
})

onUnmounted(() => {
  // 清理定时器
  if (window.__wsCheckInterval) {
    clearInterval(window.__wsCheckInterval)
  }
  if (poseRetryTimer) {
    clearTimeout(poseRetryTimer)
    poseRetryTimer = null
  }
  // 取消全局 WebSocket 消息监听
  if (globalWsUnsubscribe) {
    globalWsUnsubscribe()
    globalWsUnsubscribe = null
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
