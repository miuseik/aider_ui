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
    // 连接/断开的明确响应（终端扫描硬件后回执，驱动按钮真实状态）
    if (data.type === 'robot_connect_response') {
      if (data.success) {
        ElMessage.success(data.message || '机器人连接成功')
        robotStore.setEngaged(true)
        robotStore.setConnecting(false)  // 结束 useRobot 轮询中的 connecting 状态
      } else {
        ElMessage.error(data.message || '机器人连接失败')
        robotStore.setEngaged(false)
        robotStore.setConnecting(false)
      }
    }
    // 机器人硬件信息推送 → 更新连接状态
    if (data.type === 'robot_hardware_info') {
      // 用 robot_connected（硬件已扫描）而非 is_engaged（电机使能）判断连接状态
      // 连接后先扫硬件再选择姿态使能，避免 is_engaged=false 覆盖乐观更新
      if (data.robot_connected !== undefined) {
        robotStore.setEngaged(!!data.robot_connected)
      }
      // 连接成功后自动获取可用姿态列表（仿真模式也需加载）
      if (data.robot_connected) {
        robotStore.setPoseLoading(true)
        wsClient.send({ type: 'api_command', action: 'list_poses' })
      }
      // 断开后不清理 poseList，保持姿态选择器可用（仿真模式）
      if (!data.robot_connected) {
        robotStore.setEngaged(false)
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
    // 控制模式同步（Server 广播）
    if (data.type === 'control_mode') {
      robotStore.setControlMode(data.mode || 'pure_vr')
      robotStore.setExoActive(!!data.exo_active)
    }
  })

  // WebSocket 重连后，如果之前机器人已连接，延迟重试姿态同步
  // （避免重连瞬间 Terminal 还没 ready）
  poseRetryTimer = setTimeout(() => {
    if (wsClient.isConnected && Object.keys(robotStore.poseList).length === 0) {
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
