<template>
  <div class="servo-manager">
    <div class="header">
      <h2>🔍 飞特舵机扫描</h2>
      <p class="subtitle">扫描并查看在线舵机列表</p>
    </div>

    <!-- 连接设置 -->
    <div class="card connection-card">
      <h3>🔌 连接设置</h3>
      <div class="form-grid">
        <div class="form-group">
          <label>串口端口</label>
          <div class="port-select-wrapper">
            <select v-model="port" class="input-field">
              <option v-for="p in availablePorts" :key="p" :value="p">{{ p }}</option>
            </select>
            <button @click="refreshPorts" class="btn-refresh" title="刷新端口列表">
              🔄
            </button>
          </div>
        </div>

        <div class="form-group">
          <label>舵机类型</label>
          <select v-model="servoType" class="input-field">
            <option value="st3215">ST3215 (飞特)</option>
            <option value="lx16a">LX-16A (幻尔)</option>
          </select>
        </div>

        <div class="form-group">
          <label>波特率</label>
          <select v-model="baudrate" class="input-field">
            <option :value="1000000">1000000</option>
            <option :value="115200">115200</option>
            <option :value="57600">57600</option>
          </select>
        </div>
      </div>
    </div>

    <!-- 扫描控制 -->
    <div class="card scan-card">
      <h3>🔎 扫描范围</h3>
      <div class="scan-controls">
        <div class="form-group">
          <label>起始ID</label>
          <input 
            type="number" 
            v-model.number="startId" 
            min="1" 
            max="253"
            class="input-field"
          />
        </div>

        <div class="arrow">→</div>

        <div class="form-group">
          <label>结束ID</label>
          <input 
            type="number" 
            v-model.number="endId" 
            min="1" 
            max="253"
            class="input-field"
          />
        </div>

        <button 
          @click="scanServos" 
          :disabled="scanning"
          class="btn btn-primary"
        >
          {{ scanning ? '扫描中...' : '开始扫描' }}
        </button>
      </div>
    </div>

    <!-- 扫描结果 -->
    <div class="card result-card">
      <div class="result-header">
        <h3>📊 扫描结果</h3>
        <span class="count-badge">{{ foundServos.length }} 个舵机</span>
      </div>

      <div v-if="foundServos.length === 0 && !scanning" class="empty-state">
        <div class="icon">🤖</div>
        <p>未找到舵机，请检查连接后重新扫描</p>
      </div>

      <div v-if="scanning" class="scanning-state">
        <div class="spinner"></div>
        <p>正在扫描 ID {{ currentScanId }}...</p>
      </div>

      <div v-else-if="foundServos.length > 0" class="servo-list">
        <div 
          v-for="servo in foundServos" 
          :key="servo.id"
          class="servo-item"
        >
          <div class="servo-info">
            <div class="servo-id">ID: {{ servo.id }}</div>
            <div class="servo-status online">● 在线</div>
            <div class="servo-port">{{ servo.port || port }}</div>
            <div class="servo-mode">
              <select v-model="servo.mode" @change="switchMode(servo)" class="mode-select">
                <option value="position">位置模式</option>
                <option value="speed">速度模式</option>
              </select>
            </div>
          </div>
          <div class="servo-control" v-if="servo.mode === 'position'">
            <input 
              type="range" 
              v-model.number="servo.angle" 
              min="-180" 
              max="180" 
              @input="updateServoAngle(servo)"
              class="angle-slider"
            />
            <span class="angle-value">{{ servo.angle || 0 }}°</span>
          </div>
          <div class="servo-control" v-else>
            <input 
              type="range" 
              v-model.number="servo.speed" 
              min="-1000" 
              max="1000" 
              @input="updateServoSpeed(servo)"
              class="speed-slider"
            />
            <span class="speed-value">{{ servo.speed || 0 }}</span>
            <button @click="stopServo(servo)" class="btn-stop" title="停止">
              ⏹️
            </button>
          </div>
          <div class="servo-actions">
            <button @click="resetServo(servo)" class="btn-icon" title="重置舵机">
              🔄
            </button>
            <button @click="changeServoId(servo)" class="btn-icon" title="修改ID">
              🔢
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 快速操作 -->
    <div class="card actions-card" v-if="foundServos.length > 0">
      <h3>⚡ 快速操作</h3>
      <div class="action-buttons">
        <button @click="exportList" class="btn btn-secondary">
          📥 导出列表
        </button>
        <button @click="refreshScan" class="btn btn-primary">
          🔄 刷新扫描
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import { wsClient } from '@/utils/websocket.js'

// API 基础 URL - 使用相对路径，通过 Vite 代理转发
const API_BASE = ''

// 连接设置
const port = ref('/dev/ttyACM0')
const servoType = ref('st3215')
const baudrate = ref(1000000)
const availablePorts = ref([])

// 扫描设置
const startId = ref(1)
const endId = ref(50)
const scanning = ref(false)
const currentScanId = ref(0)

// 扫描结果
const foundServos = ref([])

// 防抖定时器
let updateTimer = null

// 移除旧的处理器
let removeHandler = null

onMounted(async () => {
  // 获取可用串口列表
  await fetchAvailablePorts()
})

onUnmounted(() => {
  // 无需清理
})

// 扫描舵机
const scanServos = async () => {
  if (scanning.value) return
  
  scanning.value = true
  foundServos.value = []
  
  try {
    // 通过 HTTP API 发送扫描命令（Vite 代理会自动转发 /api 前缀）
    const response = await axios.post(`/api/scan_servos`, {
      port: port.value,
      servo_type: servoType.value,
      start_id: startId.value,
      end_id: endId.value,
      baudrate: baudrate.value
    })
    
    if (response.data.code === 200 && response.data.data?.servos) {
      // 为每个舵机添加端口、角度、速度和模式信息
      foundServos.value = response.data.data.servos.map(servo => ({
        ...servo,
        port: port.value,
        angle: 0,
        speed: 0,
        mode: 'position'  // 默认位置模式
      }))
      ElMessage.success(`扫描完成，找到 ${foundServos.value.length} 个舵机`)
    } else {
      ElMessage.error('扫描失败: ' + (response.data.message || '未知错误'))
    }
  } catch (error) {
    console.error('扫描失败:', error)
    ElMessage.error('扫描失败: ' + (error.response?.data?.message || error.message))
  } finally {
    scanning.value = false
  }
}

// 更新舵机角度（防抖：滑动停止后 100ms 发送）
const updateServoAngle = (servo) => {
  // 清除之前的定时器
  if (updateTimer) {
    clearTimeout(updateTimer)
  }
  
  // 设置新定时器
  updateTimer = setTimeout(async () => {
    try {
      const response = await axios.post('/api/servo/set_angle', {
        servo_id: servo.id,
        angle: servo.angle,
        port: servo.port
      })
      
      if (response.data.code === 200) {
        // 静默成功，不弹窗
      } else {
        ElMessage.error('设置失败: ' + (response.data.message || '未知错误'))
      }
    } catch (error) {
      console.error('设置角度失败:', error)
      ElMessage.error('设置失败: ' + (error.response?.data?.message || error.message))
    }
  }, 100)  // 100ms 防抖
}

// 切换舵机模式
const switchMode = async (servo) => {
  try {
    const action = servo.mode === 'position' ? 'set_position_mode' : 'set_speed_mode'
    const response = await axios.post('/api/servo/set_mode', {
      servo_id: servo.id,
      mode: servo.mode,
      port: servo.port
    })
    
    if (response.data.code === 200) {
      ElMessage.success(`舵机 ${servo.id} 已切换到${servo.mode === 'position' ? '位置' : '速度'}模式`)
    } else {
      ElMessage.error('切换失败: ' + (response.data.message || '未知错误'))
    }
  } catch (error) {
    console.error('切换模式失败:', error)
    ElMessage.error('切换失败: ' + (error.response?.data?.message || error.message))
  }
}

// 更新舵机速度（防抖：滑动停止后 100ms 发送）
const updateServoSpeed = (servo) => {
  // 清除之前的定时器
  if (updateTimer) {
    clearTimeout(updateTimer)
  }
  
  // 设置新定时器
  updateTimer = setTimeout(async () => {
    try {
      const response = await axios.post('/api/servo/set_speed', {
        servo_id: servo.id,
        speed: servo.speed,
        port: servo.port
      })
      
      if (response.data.code === 200) {
        // 静默成功
      } else {
        ElMessage.error('设置失败: ' + (response.data.message || '未知错误'))
      }
    } catch (error) {
      console.error('设置速度失败:', error)
      ElMessage.error('设置失败: ' + (error.response?.data?.message || error.message))
    }
  }, 100)  // 100ms 防抖
}

// 停止舵机
const stopServo = async (servo) => {
  try {
    const response = await axios.post('/api/servo/set_speed', {
      servo_id: servo.id,
      speed: 0,
      port: servo.port
    })
    
    if (response.data.code === 200) {
      servo.speed = 0
      ElMessage.success(`舵机 ${servo.id} 已停止`)
    } else {
      ElMessage.error('停止失败: ' + (response.data.message || '未知错误'))
    }
  } catch (error) {
    console.error('停止失败:', error)
    ElMessage.error('停止失败: ' + (error.response?.data?.message || error.message))
  }
}

// Ping单个舵机
const pingServo = (id) => {
  ElMessage.info(`Ping 舵机 ID=${id}`)
  // TODO: 实现实际的Ping功能
}

// 重置舵机
const resetServo = async (servo) => {
  const confirmed = await ElMessageBox.confirm(
    `确定要重置舵机 ID=${servo.id} 吗？\n重置后 ID 将变为 1，需要断电重启生效。`,
    '警告',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  )
  
  if (!confirmed) return
  
  try {
    const response = await axios.post('/api/servo/reset', {
      servo_id: servo.id,
      port: servo.port
    })
    
    if (response.data.code === 200) {
      ElMessage.success('重置成功，请断电重启舵机')
    } else {
      ElMessage.error('重置失败: ' + (response.data.message || '未知错误'))
    }
  } catch (error) {
    console.error('重置失败:', error)
    ElMessage.error('重置失败: ' + (error.response?.data?.message || error.message))
  }
}

// 修改舵机ID
const changeServoId = async (servo) => {
  const { value: newId } = await ElMessageBox.prompt(
    `请输入新的 ID (1-253):`,
    `修改舵机 ID=${servo.id}`,
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      inputPattern: /^[1-9][0-9]?$/,  // 1-99
      inputErrorMessage: 'ID 必须在 1-99 之间'
    }
  )
  
  if (!newId) return
  
  const confirmed = await ElMessageBox.confirm(
    `确定要将舵机 ID=${servo.id} 改为 ${newId} 吗？\n修改后需要断电重启生效。`,
    '警告',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  )
  
  if (!confirmed) return
  
  try {
    const response = await axios.post('/api/servo/set_id', {
      old_id: servo.id,
      new_id: parseInt(newId),
      port: servo.port
    })
    
    if (response.data.code === 200) {
      ElMessage.success('ID 修改成功，请断电重启舵机')
      // 从列表中移除该舵机
      foundServos.value = foundServos.value.filter(s => s.id !== servo.id)
    } else {
      ElMessage.error('修改失败: ' + (response.data.message || '未知错误'))
    }
  } catch (error) {
    console.error('修改ID失败:', error)
    ElMessage.error('修改失败: ' + (error.response?.data?.message || error.message))
  }
}

// 导出列表
const exportList = () => {
  const data = JSON.stringify(foundServos.value, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `servos_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// 刷新扫描
const refreshScan = () => {
  scanServos()
}

// 获取可用串口列表
const fetchAvailablePorts = async () => {
  try {
    const response = await axios.get('/api/list_ports')
    availablePorts.value = response.data.data?.ports || []
    if (availablePorts.value.length > 0) {
      port.value = availablePorts.value[0]
    }
  } catch (error) {
    console.error('获取串口列表失败:', error)
    availablePorts.value = ['/dev/ttyACM0', '/dev/ttyACM1', '/dev/ttyUSB0', '/dev/ttyUSB1']
  }
}

// 刷新端口列表
const refreshPorts = async () => {
  await fetchAvailablePorts()
}
</script>

<style scoped>
.servo-manager {
  padding: 24px;
  max-width: 900px;
  margin: 0 auto;
}

.header {
  margin-bottom: 32px;
}

.header h2 {
  font-size: 28px;
  font-weight: 700;
  color: #ffffff;
  margin: 0 0 8px 0;
}

.subtitle {
  color: #8b92a8;
  font-size: 14px;
  margin: 0;
}

.card {
  background: #1e2128;
  border: 1px solid #2d3139;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 20px;
}

.card h3 {
  font-size: 18px;
  font-weight: 600;
  color: #ffffff;
  margin: 0 0 16px 0;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 13px;
  color: #8b92a8;
  font-weight: 500;
}

.input-field {
  padding: 10px 14px;
  background: #16181d;
  border: 1px solid #2d3139;
  border-radius: 8px;
  color: #ffffff;
  font-size: 14px;
  font-family: 'JetBrains Mono', monospace;
  transition: all 0.2s;
}

.input-field:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.port-select-wrapper {
  display: flex;
  gap: 8px;
  align-items: center;
}

.port-select-wrapper select {
  flex: 1;
}

.btn-refresh {
  padding: 10px 14px;
  background: #2d3139;
  border: 1px solid #3d4149;
  border-radius: 8px;
  color: #ffffff;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-refresh:hover {
  background: #3d4149;
  border-color: #3b82f6;
  transform: rotate(180deg);
}

.scan-controls {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  flex-wrap: wrap;
}

.arrow {
  color: #8b92a8;
  font-size: 20px;
  padding-bottom: 10px;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #3b82f6;
  color: #ffffff;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
}

.btn-secondary {
  background: #2d3139;
  color: #ffffff;
}

.btn-secondary:hover {
  background: #3d4149;
}

.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.count-badge {
  background: #3b82f6;
  color: #ffffff;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 600;
}

.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #8b92a8;
}

.empty-state .icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.scanning-state {
  text-align: center;
  padding: 40px 20px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #2d3139;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.servo-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.servo-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: #16181d;
  border: 1px solid #2d3139;
  border-radius: 8px;
  transition: all 0.2s;
}

.servo-item:hover {
  border-color: #3b82f6;
  background: #1a1c23;
}

.servo-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.servo-id {
  font-family: 'JetBrains Mono', monospace;
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
}

.servo-status {
  font-size: 13px;
  font-weight: 500;
}

.servo-status.online {
  color: #22c55e;
}

.servo-port {
  font-size: 11px;
  color: #6b7280;
  font-family: 'JetBrains Mono', monospace;
  margin-top: 2px;
}

.servo-mode {
  margin-top: 4px;
}

.mode-select {
  padding: 4px 8px;
  background: #2d3139;
  border: 1px solid #3d4149;
  border-radius: 4px;
  color: #ffffff;
  font-size: 12px;
  cursor: pointer;
  outline: none;
}

.mode-select:focus {
  border-color: #3b82f6;
}

.servo-actions {
  display: flex;
  gap: 8px;
}

.btn-icon {
  width: 36px;
  height: 36px;
  padding: 0;
  background: #2d3139;
  border: 1px solid #3d4149;
  border-radius: 6px;
  color: #ffffff;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-icon:hover {
  background: #3d4149;
  border-color: #3b82f6;
  transform: scale(1.1);
}

.speed-slider {
  flex: 1;
  height: 6px;
  -webkit-appearance: none;
  appearance: none;
  background: #2d3139;
  border-radius: 3px;
  outline: none;
}

.speed-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  background: #ef4444;
  border-radius: 50%;
  cursor: pointer;
}

.speed-value {
  min-width: 60px;
  text-align: right;
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  font-weight: 600;
  color: #ef4444;
}

.btn-stop {
  width: 32px;
  height: 32px;
  padding: 0;
  background: #dc2626;
  border: none;
  border-radius: 6px;
  color: #ffffff;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 8px;
}

.btn-stop:hover {
  background: #b91c1c;
  transform: scale(1.1);
}

.action-buttons {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
</style>
