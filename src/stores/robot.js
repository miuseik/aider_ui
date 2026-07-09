import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * 机器人连接状态 - 全局 Pinia Store
 * 解决切换页面后 isRobotEngaged 丢失的问题
 */
export const useRobotStore = defineStore('robot', () => {
  // ---- 核心状态 ----
  const isRobotEngaged = ref(false)
  const connecting = ref(false)    // 连接/断开操作进行中

  // ---- 姿态相关 ----
  const poseList = ref({})         // { poseName: { left: [...], right: [...] } }
  const currentPoseName = ref('')  // 当前选中的姿态名
  const poseLoading = ref(false)

  // ---- 操作 ----
  function setEngaged(val) {
    isRobotEngaged.value = val
  }

  function setConnecting(val) {
    connecting.value = val
  }

  function setPoseList(poses) {
    poseList.value = poses || {}
  }

  function setPoseLoading(val) {
    poseLoading.value = val
  }

  function setCurrentPoseName(name) {
    currentPoseName.value = name
  }

  /** 断开时清除姿态缓存 */
  function resetOnDisconnect() {
    isRobotEngaged.value = false
    poseList.value = {}
    currentPoseName.value = ''
  }

  return {
    isRobotEngaged,
    connecting,
    poseList,
    currentPoseName,
    poseLoading,
    setEngaged,
    setConnecting,
    setPoseList,
    setPoseLoading,
    setCurrentPoseName,
    resetOnDisconnect,
  }
})
