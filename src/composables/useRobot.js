import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { wsClient } from '@/utils/websocket'
import { useRobotStore } from '@/stores/robot'

/**
 * 机器人连接 composable（状态存储在 Pinia store 中，跨页面持久化）
 */
export function useRobot() {
  const store = useRobotStore()
  const showWarning = ref(false)
  const warningTimeout = ref(null)
  const connecting = ref(false)

  /**
   * 通过 WebSocket 向 Terminal 请求可用姿态列表
   */
  function fetchPoses() {
    if (!wsClient.isConnected) {
      return
    }
    store.setPoseLoading(true)
    wsClient.send({
      type: 'api_command',
      action: 'list_poses',
    })
  }

  /**
   * 通过 WebSocket 向 Terminal 发送 goto_pose 指令
   * @param {string} poseName - 姿态名（safe / default / zero / ...）
   * @param {string} arm - 'left' | 'right' | 'both'
   */
  function gotoPose(poseName, arm = 'both') {
    if (!wsClient.isConnected) {
      ElMessage.warning('WebSocket 未连接，无法切换姿态')
      return
    }
    if (!poseName) {
      ElMessage.warning('请选择姿态')
      return
    }
    wsClient.send({
      type: 'api_command',
      action: 'goto_pose',
      arm: arm,
      pose_name: poseName,
    })
  }

  async function toggleRobotEngagement() {
    if (connecting.value) return  // 防止重复点击
    const action = store.isRobotEngaged ? 'disconnect' : 'connect'

    connecting.value = true
    try {
      const response = await fetch('/api/robot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })
      const { data } = await response.json()

      if (data.success) {
        store.setEngaged(!store.isRobotEngaged)
        showWarning.value = false
        if (action === 'connect') {
          ElMessage.success('正在连接机器人，请稍候…')
        } else {
          store.resetOnDisconnect()
          ElMessage.info('已断开机器人连接')
        }
      } else {
        ElMessage.error(action === 'connect' ? '连接机器人失败' : '断开机器人失败')
      }
    } catch (error) {
      console.error('Error toggling robot engagement:', error)
      ElMessage.error('与服务器通信错误')
    } finally {
      connecting.value = false
    }
  }

  function showConnectionWarning() {
    if (!store.isRobotEngaged) {
      showWarning.value = true

      if (warningTimeout.value) {
        clearTimeout(warningTimeout.value)
      }

      warningTimeout.value = setTimeout(() => {
        showWarning.value = false
      }, 5000)
    }
  }

  async function updateStatus() {
    try {
      const response = await fetch('/api/status')
      if (!response.ok) throw new Error('Network response was not ok')

      const result = await response.json()
      const businessData = result.data || result

      store.setEngaged(!!businessData.robotEngaged)
      if (showWarning.value && store.isRobotEngaged) showWarning.value = false

      return { data: businessData }
    } catch (error) {
      console.error('更新状态失败:', error)
      return { data: null }
    }
  }

  return {
    isRobotEngaged: store.isRobotEngaged,
    showWarning,
    connecting,
    toggleRobotEngagement,
    showConnectionWarning,
    updateStatus,
    poseList: store.poseList,
    currentPoseName: store.currentPoseName,
    poseLoading: store.poseLoading,
    fetchPoses,
    gotoPose,
  }
}
