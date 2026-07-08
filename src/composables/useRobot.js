import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { wsClient } from '@/utils/websocket'

export function useRobot() {
  const isRobotEngaged = ref(false)
  const showWarning = ref(false)
  const warningTimeout = ref(null)

  // ---- 姿态相关状态 ----
  const poseList = ref({})         // { poseName: { left: [...], right: [...] } }
  const currentPoseName = ref('')  // 当前选中的姿态名
  const poseLoading = ref(false)

  /**
   * 通过 WebSocket 向 Terminal 请求可用姿态列表
   */
  function fetchPoses() {
    if (!wsClient.isConnected) {
      console.warn('⚠️ WebSocket 未连接，无法获取姿态列表')
      return
    }
    poseLoading.value = true
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
    const action = isRobotEngaged.value ? 'disconnect' : 'connect'
    
    try {
      const response = await fetch('/api/robot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })
      const {data} = await response.json()
      
      if (data.success) {
        isRobotEngaged.value = !isRobotEngaged.value
        showWarning.value = false
        if (action === 'disconnect') {
          // 断开时清除姿态
          poseList.value = {}
          currentPoseName.value = ''
        }
        // 连接成功后，robot_hardware_info 会通过 WebSocket 推送，
        // 前端收到 robot_connected=true 后自动调用 fetchPoses()
      } else {
        ElMessage.error(action === 'connect' ? '连接机器人失败' : '断开机器人失败')
      }
    } catch (error) {
      console.error('Error toggling robot engagement:', error)
      ElMessage.error('与服务器通信错误')
    }
  }

  function showConnectionWarning() {
    if (!isRobotEngaged.value) {
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

      // 更新内部逻辑状态
      isRobotEngaged.value = !!businessData.robotEngaged
      if (showWarning.value && isRobotEngaged.value) showWarning.value = false

      return { data: businessData }
    } catch (error) {
      console.error('更新状态失败:', error)
      return { data: null }
    }
  }

  return {
    isRobotEngaged,
    showWarning,
    toggleRobotEngagement,
    showConnectionWarning,
    updateStatus,
    // 姿态相关
    poseList,
    currentPoseName,
    poseLoading,
    fetchPoses,
    gotoPose,
  }
}
