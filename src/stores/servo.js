import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getServoIds } from '@/api/servo.js'

export const useServoStore = defineStore('servo', () => {
  // 状态
  const scannedServos = ref([])
  const lastScanTime = ref(null)
  const availablePorts = ref([])

  // === /api/get-servo-ids 的全局缓存（App.vue 初始化时加载一次） ===
  const servoIdConfig = ref(null)          // 舵机 ID 配置（robotConfig）
  const servoIdConfigLoaded = ref(false)   // 是否已加载

  // 动作
  function setScannedServos(servos) {
    scannedServos.value = servos
    lastScanTime.value = new Date().toISOString()
  }

  function addOrUpdateServo(servo) {
    const index = scannedServos.value.findIndex(s => s.id === servo.id && s.port === servo.port)
    if (index !== -1) {
      scannedServos.value[index] = { ...scannedServos.value[index], ...servo }
    } else {
      scannedServos.value.push(servo)
    }
  }

  function removeServo(id, port) {
    scannedServos.value = scannedServos.value.filter(s => !(s.id === id && s.port === port))
  }

  function clearServos() {
    scannedServos.value = []
    lastScanTime.value = null
  }

  function setAvailablePorts(ports) {
    availablePorts.value = ports
  }

  /** 从后端获取舵机 ID 配置，存入 Pinia（仅首次调用生效） */
  async function fetchServoIdConfig() {
    if (servoIdConfigLoaded.value) return servoIdConfig.value
    try {
      const response = await getServoIds()
      if (response.code === 200) {
        servoIdConfig.value = response.data
        servoIdConfigLoaded.value = true
      }
    } catch (error) {
      console.error('获取舵机ID配置失败:', error)
    }
    return servoIdConfig.value
  }

  // 获取器
  const getServoById = (id, port) => {
    return scannedServos.value.find(s => s.id === id && s.port === port)
  }

  const getServosByPort = (port) => {
    return scannedServos.value.filter(s => s.port === port)
  }


  return {
    scannedServos,
    lastScanTime,
    availablePorts,
    servoIdConfig,
    servoIdConfigLoaded,
    setScannedServos,
    addOrUpdateServo,
    removeServo,
    clearServos,
    setAvailablePorts,
    fetchServoIdConfig,
    getServoById,
    getServosByPort
  }
})
