import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'

export function useRobot() {
  const isRobotEngaged = ref(false)
  const showWarning = ref(false)
  const warningTimeout = ref(null)

  const status = reactive({
    left_arm_connected: false,
    right_arm_connected: false,
    vrConnected: false,
    keyboardEnabled: false,
    robotEngaged: false,
    wsConnected: false
  })

  async function toggleRobotEngagement() {
    const action = isRobotEngaged.value ? 'disconnect' : 'connect'
    
    try {
      const response = await fetch('/api/robot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })
      const data = await response.json()
      
      if (data.success) {
        isRobotEngaged.value = !isRobotEngaged.value
        showWarning.value = false
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
      const data = await response.json()
      
      status.left_arm_connected = data.left_arm_connected
      status.right_arm_connected = data.right_arm_connected
      status.vrConnected = data.vrConnected
      status.keyboardEnabled = data.keyboardEnabled
      status.robotEngaged = data.robotEngaged
      
      isRobotEngaged.value = data.robotEngaged
      
      if (showWarning.value && isRobotEngaged.value) {
        showWarning.value = false
      }
    } catch (error) {
      console.error('Error fetching status:', error)
    }
  }

  return {
    isRobotEngaged,
    showWarning,
    status,
    toggleRobotEngagement,
    showConnectionWarning,
    updateStatus
  }
}
