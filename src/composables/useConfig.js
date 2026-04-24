import { reactive, computed, ref } from 'vue'

export function useConfig() {
  const config = reactive({
    robot: {
      left_arm: { name: '', port: '' },
      right_arm: { name: '', port: '' },
      vr_to_robot_scale: 1.0,
      send_interval: 0.05
    },
    network: {
      https_port: 8442,
      websocket_port: 8442,
      host_ip: '0.0.0.0'
    },
    control: {
      keyboard: {
        pos_step: 0.01,
        angle_step: 5
      }
    }
  })

  const saving = ref(false)
  const restarting = ref(false)

  const vrServerUrl = computed(() => window.location.origin + '/')
  const sendIntervalMs = computed({
    get: () => config.robot.send_interval * 1000,
    set: (val) => { config.robot.send_interval = val / 1000 }
  })

  async function loadConfiguration() {
    try {
      const response = await fetch('/api/config')
      const data = await response.json()
      Object.assign(config, data)
    } catch (error) {
      console.error('Error loading configuration:', error)
      alert('加载配置失败')
    }
  }

  async function saveConfiguration() {
    saving.value = true
    try {
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })
      const data = await response.json()
      if (data.success) {
        alert('配置保存成功！请使用重启按钮应用更改。')
      } else {
        alert('保存配置失败: ' + (data.error || '未知错误'))
      }
    } catch (error) {
      console.error('Error saving configuration:', error)
      alert('保存配置失败')
    } finally {
      saving.value = false
    }
  }

  async function restartSystem() {
    if (!confirm('确定要重启系统吗？这将暂时断开所有设备。')) return
    
    restarting.value = true
    try {
      const response = await fetch('/api/restart', { method: 'POST' })
      if (response.ok) {
        alert('系统正在重启...页面将在几秒后自动重新加载。')
        setTimeout(() => window.location.reload(), 5000)
      } else {
        alert('重启系统失败。请手动重启。')
      }
    } catch (error) {
      console.error('Error restarting system:', error)
      alert('与服务器通信错误。请手动重启。')
    } finally {
      restarting.value = false
    }
  }

  return {
    config,
    saving,
    restarting,
    vrServerUrl,
    sendIntervalMs,
    loadConfiguration,
    saveConfiguration,
    restartSystem
  }
}
