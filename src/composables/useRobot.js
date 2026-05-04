import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'

export function useRobot() {
  const isRobotEngaged = ref(false)
  const showWarning = ref(false)
  const warningTimeout = ref(null)

  // 删除了 status 对象，因为现在所有数据都通过 updateStatus 实时返回

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
      if (!response.ok) throw new Error('Network response was not ok')
      
      const result = await response.json()
      console.log('✅ 获取到即时状态数据:', result)

      // 假设后端返回格式为 { code: 200, data: {...} } 或直接是 {...}
      // 这里我们兼容两种情况，提取出真正的业务数据
      const businessData = result.data || result

      // 仅更新内部必要的逻辑状态（如警告提示）
      isRobotEngaged.value = !!businessData.robotEngaged
      if (showWarning.value && isRobotEngaged.value) showWarning.value = false

      // 【关键】返回包含 data 属性的对象，方便前端解构
      return { data: businessData }
    } catch (error) {
      console.error('❌ 更新状态失败:', error)
      return { data: null }
    }
  }

  return {
    isRobotEngaged,
    showWarning,
    toggleRobotEngagement,
    showConnectionWarning,
    updateStatus
  }
}
