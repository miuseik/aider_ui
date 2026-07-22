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

  // ---- 控制模式 ----
  const controlMode = ref('pure_vr')      // 'pure_vr' | 'exo_vr_mixed'
  const exoActive = ref(false)            // 外骨骼启停（A键或前端切换）
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

  function setControlMode(mode) {
    controlMode.value = mode
  }

  function setExoActive(val) {
    exoActive.value = val
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
    controlMode,
    exoActive,
    poseList,
    currentPoseName,
    poseLoading,
    setEngaged,
    setConnecting,
    setControlMode,
    setExoActive,
    setPoseList,
    setPoseLoading,
    setCurrentPoseName,
    resetOnDisconnect,
  }
})
