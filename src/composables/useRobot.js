import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { ElMessage } from 'element-plus'
import { wsClient } from '@/utils/websocket'
import { useRobotStore } from '@/stores/robot'

/**
 * 机器人连接 composable（状态存储在 Pinia store 中，跨页面持久化）
 */
export function useRobot() {
  const store = useRobotStore()
  const { isRobotEngaged, connecting, poseList, currentPoseName, poseLoading } = storeToRefs(store)
  const showWarning = ref(false)
  const warningTimeout = ref(null)
  const calibrating = ref(false)  // 标零中的 loading 状态
  const recoveringCan = ref(false)  // CAN 恢复中的 loading 状态
  const disablingAll = ref(false)  // 全部禁用中的 loading 状态
  const enablingAll = ref(false)   // 全部使能中的 loading 状态

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
    // 同步下拉框选中项，使其与机器人实际目标姿态一致
    store.setCurrentPoseName(poseName)
  }

  async function toggleRobotEngagement() {
    if (connecting.value) return  // 防止重复点击
    const action = isRobotEngaged.value ? 'disconnect' : 'connect'

    // === 断开流程：乐观更新即可 ===
    if (action === 'disconnect') {
      connecting.value = true
      try {
        const response = await fetch('/api/robot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'disconnect' })
        })
        const { data } = await response.json()
        if (data.success) {
          store.resetOnDisconnect()
          ElMessage.info('已断开机器人连接')
        } else {
          ElMessage.error('断开命令发送失败')
        }
      } catch (error) {
        console.error('断开机器人失败:', error)
        ElMessage.error('与服务器通信错误')
      } finally {
        connecting.value = false
      }
      return
    }

    // === 连接流程：按钮立即变「连接中…」 → 轮询 /api/status 直到 robot_connected === true ===
    connecting.value = true   // 立刻切换按钮为 loading + 「连接中…」
    showWarning.value = false

    try {
      const response = await fetch('/api/robot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'connect' })
      })
      const { data } = await response.json()

      if (!data.success) {
        ElMessage.error('连接命令发送失败')
        connecting.value = false
        return
      }

      // 命令已发往终端，开始轮询等待硬件真实连接
      const maxAttempts = 25   // 25 * 1s = 25 秒超时
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise(resolve => setTimeout(resolve, 1000))

        // App.vue 可能已通过 WS robot_connect_response 提前设置已连接，直接结束轮询
        if (isRobotEngaged.value) {
          connecting.value = false
          return
        }

        try {
          const statusResp = await fetch('/api/status')
          if (!statusResp.ok) continue
          const result = await statusResp.json()
          const biz = result.data || result
          // 终端推送的 robot_connected 为 true 时才认为连接成功
          if (biz.robot_connected || biz.robotEngaged) {
            store.setEngaged(true)
            connecting.value = false
            ElMessage.success('机器人连接成功')
            return
          }
        } catch (_) {
          // 单次轮询失败（服务端暂未 ready），继续重试
        }
      }

      // 超时
      ElMessage.error('连接超时，请确认硬件已上电后重试')
    } catch (error) {
      console.error('连接机器人失败:', error)
      ElMessage.error('与服务器通信错误')
    } finally {
      // 仅当尚未成功时才重置（成功分支已在 return 前设置 false）
      if (connecting.value) {
        connecting.value = false
        store.setEngaged(false)
      }
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

      // 不修改 store：store 是唯一数据源，仅由 toggleRobotEngagement + App.vue WS 监听更新
      // updateStatus 是纯查询函数，不产生副作用
      if (showWarning.value && isRobotEngaged.value) showWarning.value = false

      return { data: businessData }
    } catch (error) {
      console.error('更新状态失败:', error)
      return { data: null }
    }
  }

  /**
   * 重新标零掉圈电机：调用后端接口，自动移到零位 + 标零
   */
  async function recalibrateMultiturn() {
    if (calibrating.value) return
    calibrating.value = true
    try {
      const response = await fetch('/api/robot/recalibrate', {
        method: 'POST'
      })
      const json = await response.json()
      const data = json.data || {}
      if (data.success) {
        // 标零完成后提示用户重新连接
        ElMessage.success('标零完成！请重新连接机器人')
      } else {
        ElMessage.error(data.message || json.message || '标零失败')
      }
      return data
    } catch (error) {
      console.error('重新标零失败:', error)
      ElMessage.error('与服务器通信错误')
      return { success: false }
    } finally {
      calibrating.value = false
    }
  }

  /**
   * CAN 总线恢复：重置卡死的 USB CAN 适配器
   */
  async function canRecover() {
    if (recoveringCan.value) return
    recoveringCan.value = true
    try {
      const response = await fetch('/api/robot/can_recover', { method: 'POST' })
      const json = await response.json()
      const data = json.data || {}
      if (data.success) {
        ElMessage.success('CAN 总线恢复成功，请重新连接机器人')
      } else {
        const result = data.result || {}
        const failed = Object.entries(result).filter(([, ok]) => !ok).map(([k]) => k).join(', ')
        ElMessage.warning(failed ? `CAN 恢复部分失败: ${failed}` : (json.message || 'CAN 恢复失败'))
      }
      return data
    } catch (error) {
      console.error('CAN 恢复失败:', error)
      ElMessage.error('与服务器通信错误')
      return { success: false }
    } finally {
      recoveringCan.value = false
    }
  }

  /**
   * 全部禁用：失能所有电机（安全停机）
   */
  async function disableAllMotors() {
    if (disablingAll.value) return
    disablingAll.value = true
    try {
      const response = await fetch('/api/robot/disable_all_motors', { method: 'POST' })
      const json = await response.json()
      const data = json.data || {}
      if (data.success) {
        ElMessage.success('已发送全部禁用指令')
      } else {
        ElMessage.warning(json.message || '全部禁用失败')
      }
      return data
    } catch (error) {
      console.error('全部禁用失败:', error)
      ElMessage.error('与服务器通信错误')
      return { success: false }
    } finally {
      disablingAll.value = false
    }
  }

  /**
   * 全部使能：使能所有电机
   */
  async function enableAllMotors() {
    if (enablingAll.value) return
    enablingAll.value = true
    try {
      const response = await fetch('/api/robot/enable_all_motors', { method: 'POST' })
      const json = await response.json()
      const data = json.data || {}
      if (data.success) {
        ElMessage.success('已发送全部使能指令')
      } else {
        ElMessage.warning(json.message || '全部使能失败')
      }
      return data
    } catch (error) {
      console.error('全部使能失败:', error)
      ElMessage.error('与服务器通信错误')
      return { success: false }
    } finally {
      enablingAll.value = false
    }
  }

  return {
    isRobotEngaged,
    showWarning,
    connecting,
    calibrating,
    recoveringCan,
    toggleRobotEngagement,
    showConnectionWarning,
    updateStatus,
    recalibrateMultiturn,
    canRecover,
    disableAllMotors,
    enableAllMotors,
    poseList,
    currentPoseName,
    poseLoading,
    fetchPoses,
    gotoPose,
  }
}
