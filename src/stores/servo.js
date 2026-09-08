import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getServoIds, listPorts } from '@/api/servo.js'

export const useServoStore = defineStore('servo', () => {
  // 状态
  const scannedServos = ref([])
  const lastScanTime = ref(null)
  const availablePorts = ref([])
  const portFetching = ref(false)  // 防止并发请求串口列表

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

  /**
   * 获取可用串口列表并缓存到 Pinia（全局共享，任何组件查询串口都走这里）。
   * 已有缓存时默认不再请求；force=true 强制刷新。
   * @param {boolean} force - 是否强制重新拉取
   * @returns {Promise<Array<string>>} 端口列表
   */
  async function fetchAvailablePorts(force = false) {
    if (availablePorts.value.length && !force) return availablePorts.value
    if (portFetching.value) return availablePorts.value
    portFetching.value = true
    try {
      const response = await listPorts()
      const ports = response.data?.ports || []
      // 补充 CAN 接口（舵机和电机同等重要）
      if (!ports.includes('can0')) {
        ports.push('can0')
      }
      setAvailablePorts(ports)
    } catch (error) {
      console.error('获取串口列表失败:', error)
      const defaultPorts = ['/dev/ttyACM0', 'can0', '/dev/ttyACM1', '/dev/ttyUSB0', '/dev/ttyUSB1']
      setAvailablePorts(defaultPorts)
    } finally {
      portFetching.value = false
    }
    return availablePorts.value
  }

  /** 从后端获取舵机 ID 配置，存入 Pinia（默认仅首次调用生效；force=true 强制重新拉取） */
  async function fetchServoIdConfig(force = false) {
    if (!force && servoIdConfigLoaded.value) return servoIdConfig.value
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
    fetchAvailablePorts,
    fetchServoIdConfig,
    getServoById,
    getServosByPort
  }
})
