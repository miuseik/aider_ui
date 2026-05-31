import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useServoStore = defineStore('servo', () => {
  // 状态
  const scannedServos = ref([])
  const lastScanTime = ref(null)
  const availablePorts = ref([])

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
    setScannedServos,
    addOrUpdateServo,
    removeServo,
    clearServos,
    setAvailablePorts,
    getServoById,
    getServosByPort
  }
})
