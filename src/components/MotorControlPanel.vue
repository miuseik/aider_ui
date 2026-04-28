<template>
  <div class="motor-control-panel">
    <div class="panel-header">
      <h2>🔧 舵机电机管理</h2>
      <div class="header-actions">
        <button @click="refreshMotors" :disabled="loading" class="btn-refresh">
          {{ loading ? '刷新中...' : '🔄 刷新' }}
        </button>
      </div>
    </div>

    <!-- 机械臂选择标签 -->
    <div class="arm-tabs">
      <button 
        v-for="arm in ['left', 'right']" 
        :key="arm"
        @click="selectedArm = arm"
        :class="['tab-btn', { active: selectedArm === arm }]"
      >
        {{ arm === 'left' ? '🦾 左机械臂' : '🦿 右机械臂' }}
      </button>
    </div>

    <!-- 批量操作栏 -->
    <div class="batch-actions">
      <button @click="toggleAllTorque(true)" class="btn-enable-all">
        ⚡ 全部使能
      </button>
      <button @click="toggleAllTorque(false)" class="btn-disable-all">
        🔒 全部制动
      </button>
    </div>

    <!-- 电机列表 -->
    <div class="motors-list" v-if="filteredMotors.length > 0">
      <div 
        v-for="motor in filteredMotors" 
        :key="motor.name"
        class="motor-card"
        :class="{ 'online': motor.online, 'offline': !motor.online }"
      >
        <!-- 电机头部信息 -->
        <div class="motor-header">
          <div class="motor-info">
            <span class="motor-name">{{ motor.displayName || motor.name }}</span>
            <span class="motor-id">ID: {{ motor.id }}</span>
          </div>
          <div class="motor-status">
            <span :class="['status-badge', motor.online ? 'online' : 'offline']">
              {{ motor.online ? '● 在线' : '○ 离线' }}
            </span>
          </div>
        </div>

        <!-- 电机详细参数 -->
        <div class="motor-details" v-if="motor.online">
          <div class="detail-row">
            <span class="label">当前位置:</span>
            <span class="value">{{ motor.currentPosition?.toFixed(2) || 'N/A' }}°</span>
          </div>
          <div class="detail-row">
            <span class="label">目标位置:</span>
            <span class="value">{{ motor.targetPosition?.toFixed(2) || 'N/A' }}°</span>
          </div>
          <div class="detail-row">
            <span class="label">温度:</span>
            <span class="value" :class="getTempClass(motor.temperature)">
              {{ motor.temperature?.toFixed(1) || 'N/A' }}°C
            </span>
          </div>
          <div class="detail-row">
            <span class="label">电压:</span>
            <span class="value">{{ motor.voltage?.toFixed(2) || 'N/A' }}V</span>
          </div>
          <div class="detail-row">
            <span class="label">电流:</span>
            <span class="value">{{ motor.current?.toFixed(2) || 'N/A' }}A</span>
          </div>
          <div class="detail-row">
            <span class="label">扭矩:</span>
            <span class="value">{{ motor.torqueEnabled ? '✅ 使能' : '❌ 制动' }}</span>
          </div>
        </div>

        <!-- 电机控制按钮 -->
        <div class="motor-controls">
          <button 
            @click="toggleTorque(motor)"
            :class="['btn-torque', motor.torqueEnabled ? 'disable' : 'enable']"
            :disabled="!motor.online"
          >
            {{ motor.torqueEnabled ? '🔒 制动' : '⚡ 使能' }}
          </button>
          
          <button 
            @click="showCalibrateModal(motor)"
            class="btn-calibrate"
            :disabled="!motor.online"
          >
            🎯 校准
          </button>
          
          <button 
            @click="showControlModal(motor)"
            class="btn-control"
            :disabled="!motor.online"
          >
            🎮 控制
          </button>
          
          <button 
            @click="showEditIdModal(motor)"
            class="btn-edit-id"
            :disabled="!motor.online"
          >
            🔢 编辑ID
          </button>
        </div>
      </div>
    </div>

    <!-- 空状态提示 -->
    <div v-else class="empty-state">
      <p>{{ loading ? '正在加载电机列表...' : '未找到在线电机' }}</p>
      <button @click="refreshMotors" :disabled="loading" class="btn-retry">
        重试
      </button>
    </div>

    <!-- 校准对话框 -->
    <div v-if="calibrateModal.show" class="modal-overlay" @click.self="closeCalibrateModal">
      <div class="modal-content">
        <h3>校准电机: {{ calibrateModal.motor?.displayName }}</h3>
        <div class="form-group">
          <label>目标零点位置 (度):</label>
          <input 
            type="number" 
            v-model.number="calibrateModal.targetZero"
            step="0.1"
            class="input-number"
          />
        </div>
        <div class="modal-actions">
          <button @click="closeCalibrateModal" class="btn-cancel">取消</button>
          <button @click="executeCalibration" class="btn-confirm">确认校准</button>
        </div>
      </div>
    </div>

    <!-- 控制对话框 -->
    <div v-if="controlModal.show" class="modal-overlay" @click.self="closeControlModal">
      <div class="modal-content">
        <h3>控制电机: {{ controlModal.motor?.displayName }}</h3>
        <div class="form-group">
          <label>目标角度 (度):</label>
          <input 
            type="range" 
            v-model.number="controlModal.targetAngle"
            :min="controlModal.motor?.minAngle || -180"
            :max="controlModal.motor?.maxAngle || 180"
            step="0.1"
            class="input-range"
          />
          <div class="range-value">{{ controlModal.targetAngle?.toFixed(1) }}°</div>
        </div>
        <div class="modal-actions">
          <button @click="closeControlModal" class="btn-cancel">取消</button>
          <button @click="executeControl" class="btn-confirm">发送命令</button>
        </div>
      </div>
    </div>

    <!-- 编辑ID对话框 -->
    <div v-if="editIdModal.show" class="modal-overlay" @click.self="closeEditIdModal">
      <div class="modal-content">
        <h3>编辑电机ID: {{ editIdModal.motor?.displayName }}</h3>
        <div class="warning-box">
          ⚠️ 警告：修改ID后需要重新连接才能识别该电机！
        </div>
        <div class="form-group">
          <label>当前ID:</label>
          <div class="current-id">{{ editIdModal.motor?.id }}</div>
        </div>
        <div class="form-group">
          <label>新ID (1-254):</label>
          <input 
            type="number" 
            v-model.number="editIdModal.newId"
            min="1"
            max="254"
            step="1"
            class="input-number"
            placeholder="输入新ID"
          />
        </div>
        <div class="modal-actions">
          <button @click="closeEditIdModal" class="btn-cancel">取消</button>
          <button @click="executeEditId" class="btn-confirm btn-warning">确认修改</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || ''

// 状态
const loading = ref(false)
const selectedArm = ref('left')
const motors = ref([])

// 对话框状态
const calibrateModal = ref({
  show: false,
  motor: null,
  targetZero: 0
})

const controlModal = ref({
  show: false,
  motor: null,
  targetAngle: 0
})

const editIdModal = ref({
  show: false,
  motor: null,
  newId: 1
})

// 过滤当前选中机械臂的电机
const filteredMotors = computed(() => {
  return motors.value.filter(m => m.arm === selectedArm.value)
})

// 获取电机列表
async function refreshMotors() {
  loading.value = true
  try {
    // TODO: 这里需要调用实际的后端API
    // const response = await axios.get(`${API_BASE_URL}/api/motors/list`)
    
    // 模拟数据（等待后端实现）
    await new Promise(resolve => setTimeout(resolve, 500))
    
    motors.value = [
      // 左机械臂
      {
        arm: 'left',
        name: 'shoulder_pan',
        displayName: '肩部旋转',
        id: 1,
        online: true,
        currentPosition: 0.0,
        targetPosition: 0.0,
        temperature: 35.5,
        voltage: 12.1,
        current: 0.5,
        torqueEnabled: true,
        minAngle: -180,
        maxAngle: 180
      },
      {
        arm: 'left',
        name: 'shoulder_lift',
        displayName: '肩部升降',
        id: 2,
        online: true,
        currentPosition: -90.0,
        targetPosition: -90.0,
        temperature: 36.2,
        voltage: 12.0,
        current: 0.8,
        torqueEnabled: true,
        minAngle: -120,
        maxAngle: 120
      },
      {
        arm: 'left',
        name: 'elbow_flex',
        displayName: '肘部弯曲',
        id: 3,
        online: true,
        currentPosition: 90.0,
        targetPosition: 90.0,
        temperature: 34.8,
        voltage: 12.2,
        current: 0.6,
        torqueEnabled: true,
        minAngle: -150,
        maxAngle: 150
      },
      {
        arm: 'left',
        name: 'wrist_flex',
        displayName: '腕部俯仰',
        id: 4,
        online: true,
        currentPosition: 45.0,
        targetPosition: 45.0,
        temperature: 33.5,
        voltage: 12.1,
        current: 0.4,
        torqueEnabled: true,
        minAngle: -90,
        maxAngle: 90
      },
      {
        arm: 'left',
        name: 'wrist_roll',
        displayName: '腕部旋转',
        id: 5,
        online: true,
        currentPosition: 0.0,
        targetPosition: 0.0,
        temperature: 32.8,
        voltage: 12.0,
        current: 0.3,
        torqueEnabled: true,
        minAngle: -180,
        maxAngle: 180
      },
      {
        arm: 'left',
        name: 'gripper',
        displayName: '夹持器',
        id: 6,
        online: true,
        currentPosition: 0.0,
        targetPosition: 0.0,
        temperature: 31.5,
        voltage: 12.1,
        current: 0.2,
        torqueEnabled: true,
        minAngle: 0,
        maxAngle: 100
      },
      // 右机械臂
      {
        arm: 'right',
        name: 'shoulder_pan',
        displayName: '肩部旋转',
        id: 7,
        online: true,
        currentPosition: 0.0,
        targetPosition: 0.0,
        temperature: 35.2,
        voltage: 12.0,
        current: 0.5,
        torqueEnabled: true,
        minAngle: -180,
        maxAngle: 180
      },
      {
        arm: 'right',
        name: 'shoulder_lift',
        displayName: '肩部升降',
        id: 8,
        online: true,
        currentPosition: -90.0,
        targetPosition: -90.0,
        temperature: 36.0,
        voltage: 12.1,
        current: 0.7,
        torqueEnabled: true,
        minAngle: -120,
        maxAngle: 120
      },
      {
        arm: 'right',
        name: 'elbow_flex',
        displayName: '肘部弯曲',
        id: 9,
        online: true,
        currentPosition: 90.0,
        targetPosition: 90.0,
        temperature: 34.5,
        voltage: 12.2,
        current: 0.6,
        torqueEnabled: true,
        minAngle: -150,
        maxAngle: 150
      },
      {
        arm: 'right',
        name: 'wrist_flex',
        displayName: '腕部俯仰',
        id: 10,
        online: true,
        currentPosition: 45.0,
        targetPosition: 45.0,
        temperature: 33.2,
        voltage: 12.0,
        current: 0.4,
        torqueEnabled: true,
        minAngle: -90,
        maxAngle: 90
      },
      {
        arm: 'right',
        name: 'wrist_roll',
        displayName: '腕部旋转',
        id: 11,
        online: true,
        currentPosition: 0.0,
        targetPosition: 0.0,
        temperature: 32.5,
        voltage: 12.1,
        current: 0.3,
        torqueEnabled: true,
        minAngle: -180,
        maxAngle: 180
      },
      {
        arm: 'right',
        name: 'gripper',
        displayName: '夹持器',
        id: 12,
        online: true,
        currentPosition: 0.0,
        targetPosition: 0.0,
        temperature: 31.2,
        voltage: 12.0,
        current: 0.2,
        torqueEnabled: true,
        minAngle: 0,
        maxAngle: 100
      }
    ]
  } catch (error) {
    console.error('获取电机列表失败:', error)
    alert('获取电机列表失败: ' + error.message)
  } finally {
    loading.value = false
  }
}

// 切换单个电机制动状态
async function toggleTorque(motor) {
  try {
    const enable = !motor.torqueEnabled
    const response = await axios.post(`${API_BASE_URL}/api/motor/torque`, {
      arm: motor.arm,
      motor: motor.name,
      enable: enable
    })
    
    if (response.data.success) {
      motor.torqueEnabled = enable
      alert(`电机 ${motor.displayName} 已${enable ? '使能' : '制动'}`)
    }
  } catch (error) {
    console.error('切换电机制动状态失败:', error)
    alert('操作失败: ' + (error.response?.data?.message || error.message))
  }
}

// 批量切换所有电机制动状态
async function toggleAllTorque(enable) {
  const action = enable ? '使能' : '制动'
  if (!confirm(`确定要${action}所有电机吗？`)) {
    return
  }
  
  try {
    for (const motor of filteredMotors.value) {
      if (motor.online) {
        await axios.post(`${API_BASE_URL}/api/motor/torque`, {
          arm: motor.arm,
          motor: motor.name,
          enable: enable
        })
        motor.torqueEnabled = enable
      }
    }
    alert(`已${action}所有在线电机`)
  } catch (error) {
    console.error('批量操作失败:', error)
    alert('批量操作失败: ' + error.message)
  }
}

// 显示校准对话框
function showCalibrateModal(motor) {
  calibrateModal.value = {
    show: true,
    motor: motor,
    targetZero: motor.currentPosition || 0
  }
}

// 关闭校准对话框
function closeCalibrateModal() {
  calibrateModal.value.show = false
  calibrateModal.value.motor = null
}

// 执行校准
async function executeCalibration() {
  try {
    const motor = calibrateModal.value.motor
    const response = await axios.post(`${API_BASE_URL}/api/calibrate`, {
      arm: motor.arm,
      motor: motor.name,
      target_zero: calibrateModal.value.targetZero
    })
    
    if (response.data.success) {
      alert(`电机 ${motor.displayName} 校准成功！`)
      closeCalibrateModal()
      // 刷新列表
      await refreshMotors()
    }
  } catch (error) {
    console.error('校准失败:', error)
    alert('校准失败: ' + (error.response?.data?.message || error.message))
  }
}

// 显示控制对话框
function showControlModal(motor) {
  controlModal.value = {
    show: true,
    motor: motor,
    targetAngle: motor.currentPosition || 0
  }
}

// 关闭控制对话框
function closeControlModal() {
  controlModal.value.show = false
  controlModal.value.motor = null
}

// 执行控制
async function executeControl() {
  try {
    const motor = controlModal.value.motor
    const response = await axios.post(`${API_BASE_URL}/api/control_motor`, {
      arm: motor.arm,
      motor: motor.name,
      angle: controlModal.value.targetAngle
    })
    
    if (response.data.success) {
      alert(`电机 ${motor.displayName} 控制命令已发送！`)
      closeControlModal()
      // 刷新列表
      await refreshMotors()
    }
  } catch (error) {
    console.error('控制失败:', error)
    alert('控制失败: ' + (error.response?.data?.message || error.message))
  }
}

// 显示编辑ID对话框
function showEditIdModal(motor) {
  editIdModal.value = {
    show: true,
    motor: motor,
    newId: motor.id + 1 // 默认建议下一个ID
  }
}

// 关闭编辑ID对话框
function closeEditIdModal() {
  editIdModal.value.show = false
  editIdModal.value.motor = null
}

// 执行编辑ID
async function executeEditId() {
  const motor = editIdModal.value.motor
  const newId = editIdModal.value.newId
  
  // 验证ID范围
  if (!newId || newId < 1 || newId > 254) {
    alert('ID必须在1-254范围内！')
    return
  }
  
  // 二次确认
  if (!confirm(`确定要将电机 ${motor.displayName} 的ID从 ${motor.id} 修改为 ${newId} 吗？\n\n注意：修改后需要重新连接才能识别该电机！`)) {
    return
  }
  
  try {
    const response = await axios.post(`${API_BASE_URL}/api/motor/edit_id`, {
      arm: motor.arm,
      motor: motor.name,
      current_id: motor.id,
      new_id: newId
    })
    
    if (response.data.success) {
      alert(`电机 ${motor.displayName} 的ID已成功修改为 ${newId}！\n\n请断开连接后重新扫描以识别新ID。`)
      closeEditIdModal()
      // 刷新列表
      await refreshMotors()
    }
  } catch (error) {
    console.error('修改ID失败:', error)
    alert('修改ID失败: ' + (error.response?.data?.message || error.message))
  }
}

// 根据温度获取样式类
function getTempClass(temp) {
  if (!temp) return ''
  if (temp > 60) return 'temp-high'
  if (temp > 45) return 'temp-medium'
  return 'temp-normal'
}

// 组件挂载时加载数据
onMounted(() => {
  refreshMotors()
})
</script>

<style scoped>
.motor-control-panel {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 2px solid #e0e0e0;
}

.panel-header h2 {
  margin: 0;
  font-size: 24px;
  color: #333;
}

.btn-refresh {
  padding: 10px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s;
}

.btn-refresh:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-refresh:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 机械臂标签 */
.arm-tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.tab-btn {
  flex: 1;
  padding: 12px 24px;
  background: #f5f5f5;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.3s;
}

.tab-btn.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-color: transparent;
}

.tab-btn:hover:not(.active) {
  background: #e8e8e8;
}

/* 批量操作 */
.batch-actions {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.btn-enable-all, .btn-disable-all {
  flex: 1;
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s;
}

.btn-enable-all {
  background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
  color: white;
}

.btn-enable-all:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(17, 153, 142, 0.4);
}

.btn-disable-all {
  background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%);
  color: white;
}

.btn-disable-all:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(235, 51, 73, 0.4);
}

/* 电机列表 */
.motors-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 15px;
}

.motor-card {
  background: white;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  padding: 15px;
  transition: all 0.3s;
}

.motor-card.online {
  border-color: #4caf50;
}

.motor-card.offline {
  border-color: #f44336;
  opacity: 0.6;
}

.motor-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.motor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid #e0e0e0;
}

.motor-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.motor-name {
  font-size: 16px;
  font-weight: bold;
  color: #333;
}

.motor-id {
  font-size: 12px;
  color: #666;
}

.status-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
}

.status-badge.online {
  background: #e8f5e9;
  color: #2e7d32;
}

.status-badge.offline {
  background: #ffebee;
  color: #c62828;
}

/* 电机详情 */
.motor-details {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 12px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px dashed #e0e0e0;
}

.detail-row .label {
  font-size: 13px;
  color: #666;
}

.detail-row .value {
  font-size: 13px;
  font-weight: bold;
  color: #333;
}

.temp-normal {
  color: #4caf50;
}

.temp-medium {
  color: #ff9800;
}

.temp-high {
  color: #f44336;
}

/* 电机控制按钮 */
.motor-controls {
  display: flex;
  gap: 8px;
}

.motor-controls button {
  flex: 1;
  padding: 8px 12px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.3s;
}

.btn-torque.enable {
  background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
  color: white;
}

.btn-torque.disable {
  background: linear-gradient(135deg, #eb3349 0%, #f45c43 100%);
  color: white;
}

.btn-calibrate {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-control {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: white;
}

.btn-edit-id {
  background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
  color: white;
}

.motor-controls button:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.motor-controls button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 60px 20px;
  color: #666;
}

.empty-state p {
  font-size: 16px;
  margin-bottom: 20px;
}

.btn-retry {
  padding: 10px 30px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
}

.btn-retry:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-retry:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 对话框 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 30px;
  border-radius: 12px;
  min-width: 400px;
  max-width: 500px;
}

.modal-content h3 {
  margin: 0 0 20px 0;
  color: #333;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  color: #666;
  font-size: 14px;
}

.input-number {
  width: 100%;
  padding: 10px;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  font-size: 16px;
}

.input-range {
  width: 100%;
  margin-bottom: 10px;
}

.range-value {
  text-align: center;
  font-size: 18px;
  font-weight: bold;
  color: #667eea;
}

.modal-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.btn-cancel, .btn-confirm {
  padding: 10px 24px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.3s;
}

.btn-cancel {
  background: #f5f5f5;
  color: #666;
}

.btn-cancel:hover {
  background: #e0e0e0;
}

.btn-confirm {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-confirm.btn-warning {
  background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
}

.btn-confirm:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.warning-box {
  background: #fff3cd;
  border: 2px solid #ffc107;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 20px;
  color: #856404;
  font-size: 14px;
  line-height: 1.5;
}

.current-id {
  padding: 10px;
  background: #f8f9fa;
  border: 2px solid #e0e0e0;
  border-radius: 6px;
  font-size: 18px;
  font-weight: bold;
  color: #667eea;
  text-align: center;
}
</style>
