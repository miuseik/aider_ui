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
          <select v-model="port" class="input-field">
            <option value="/dev/ttyACM0">/dev/ttyACM0</option>
            <option value="/dev/ttyACM1">/dev/ttyACM1</option>
            <option value="/dev/ttyUSB0">/dev/ttyUSB0</option>
            <option value="/dev/ttyUSB1">/dev/ttyUSB1</option>
          </select>
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
          </div>
          <div class="servo-actions">
            <button 
              @click="pingServo(servo.id)"
              class="btn btn-sm btn-secondary"
            >
              Ping
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
import { wsClient } from '@/utils/websocket.js'

// API 基础 URL
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8443'

// 连接设置
const port = ref('/dev/ttyACM0')
const servoType = ref('st3215')
const baudrate = ref(1000000)

// 扫描设置
const startId = ref(1)
const endId = ref(20)
const scanning = ref(false)
const currentScanId = ref(0)

// 扫描结果
const foundServos = ref([])

// 移除旧的处理器
let removeHandler = null

onMounted(() => {
  // 注册 WebSocket 消息处理器
  removeHandler = wsClient.onMessage((data) => {
    if (data.type === 'scan_servos_response') {
      console.log('收到扫描结果:', data.result)
      foundServos.value = data.result || []
      scanning.value = false
    }
  })
})

onUnmounted(() => {
  // 清理处理器
  if (removeHandler) {
    removeHandler()
  }
})

// 扫描舵机
const scanServos = async () => {
  if (scanning.value) return
  
  scanning.value = true
  foundServos.value = []
  
  try {
    // 通过 HTTP API 发送扫描命令
    const response = await axios.post(`${API_BASE}/api/scan_servos`, {
      port: port.value,
      servo_type: servoType.value,
      start_id: startId.value,
      end_id: endId.value,
      baudrate: baudrate.value
    })
    
    if (!response.data.success) {
      alert('扫描失败: ' + (response.data.message || '未知错误'))
      scanning.value = false
    }
    // 等待 WebSocket 返回结果
    
  } catch (error) {
    console.error('扫描失败:', error)
    alert('扫描失败: ' + (error.response?.data?.message || error.message))
    scanning.value = false
  }
}

// Ping单个舵机
const pingServo = (id) => {
  alert(`Ping 舵机 ID=${id}`)
  // TODO: 实现实际的Ping功能
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

.action-buttons {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
</style>
