<template>
  <div class="servo-manager">
    <!-- 连接设置 -->
    <div class="card connection-card">
      <h3>🔌 连接设置</h3>
      <div class="form-grid">
        <div class="form-group">
          <label>串口端口</label>
          <div class="port-select-wrapper">
            <select v-model="port" class="input-field">
              <option value="all">🔍 扫描所有串口 (All)</option>
              <option v-for="p in availablePorts" :key="p" :value="p">{{ p }}</option>
            </select>
            <button @click="refreshPorts" class="btn-refresh" title="刷新端口列表">
              🔄
            </button>
          </div>
        </div>

        <div class="form-group">
          <label>电机类型</label>
          <select v-model="servoType" class="input-field">
            <option value="st3215">ST3215 (飞特)</option>
            <option value="lx16a">LX-16A (幻尔)</option>
            <option value="robstride">RS-00 (灵足 CAN)</option>
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
          <el-row :gutter="16">
            <!-- 左边：ID信息和详细信息 -->
            <el-col :span="12">
              <div class="servo-info">
                <div class="servo-id">ID: {{ servo.id }}</div>
                <div class="servo-status online">● 在线</div>
                <div class="servo-mode">
                  <select v-model="servo.mode" @change="switchMode(servo)" class="mode-select">
                    <option value="position">位置模式</option>
                    <option value="speed">速度模式</option>
                  </select>
                </div>
              </div>
              <div class="servo-details-row">
                <ServoInfoDisplay 
                  :servo-id="servo.id" 
                  :port="servo.port || port"
                  v-model:info="servo.info"
                />
              </div>
            </el-col>
            
            <!-- 右边：控制和操作按钮 -->
            <el-col :span="12">
              <div class="servo-control" v-if="(servo.mode || 'position') === 'position'">
                <input 
                  type="range" 
                  v-model.number="servo.angle" 
                  min="-180"
                  max="180" 
                  @input="updateServoAngle(servo)"
                  class="angle-slider"
                />
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
              </div>
              <div class="servo-actions">
                <span class="speed-value" >{{ servo.speed || 0 }}</span>
                <button @click="stopServo(servo)" class="btn-stop" title="停止">
                  ⏹️
                </button>
                <button @click="resetServo(servo)" class="btn-icon" title="重置舵机">
                  🔄
                </button>
                <button @click="changeServoId(servo)" class="btn-icon" title="修改ID">
                  🔢
                </button>
              </div>
            </el-col>
          </el-row>
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
        <button @click="resetAllServos" class="btn btn-warning">
          🏠 一键归零
        </button>
      </div>
    </div>

    <!-- 机器人硬件信息 -->
    <div class="card robot-hardware-card">
      <div class="robot-header">
        <h3>🤖 机器人硬件信息</h3>
      </div>
      <div class="robot-layout" v-if="robotConfig">
        <!-- 左侧：左胳膊 -->
        <div class="robot-column left">
          <RobotPart 
            title="左胳膊"
            :servos="getPartServos('left_arm', robotConfig.left_bus?.left_arm)"
            part-name="left_arm"
            :scanning="scanning"
            @claim="claimSingleServo"
            @ping="pingServoByPart"
            @calibrate="calibrateServoByPart"
            @update-angle="handleUpdateAngle"
          />
        </div>

        <!-- 中间：头、脖子、身体、底盘 -->
        <div class="robot-column center">
          <RobotPart 
            title="头"
            :servos="[]"
            part-name="head"
            :scanning="scanning"
          />
          
          <RobotPart 
            title="脖子"
            :servos="getPartServos('neck', robotConfig.left_bus?.neck)"
            part-name="neck"
            :scanning="scanning"
            @claim="claimSingleServo"
            @ping="pingServoByPart"
            @calibrate="calibrateServoByPart"
            @update-angle="handleUpdateAngle"
          />
          
          <RobotPart 
            title="身体"
            :servos="getPartServos('lift_axis', robotConfig.base_lift_bus?.lift_axis)"
            part-name="lift_axis"
            :scanning="scanning"
            @claim="claimSingleServo"
            @ping="pingServoByPart"
            @calibrate="calibrateServoByPart"
            @update-angle="handleUpdateAngle"
          />
          
          <RobotPart 
            title="底盘"
            :servos="getPartServos('base', robotConfig.base_lift_bus?.base)"
            part-name="base"
            :scanning="scanning"
            @claim="claimSingleServo"
            @ping="pingServoByPart"
            @calibrate="calibrateServoByPart"
            @update-angle="handleUpdateAngle"
          />
        </div>

        <!-- 右侧：右胳膊 -->
        <div class="robot-column right">
          <RobotPart 
            title="右胳膊"
            :servos="getPartServos('right_arm', robotConfig.right_bus?.right_arm)"
            part-name="right_arm"
            :scanning="scanning"
            @claim="claimSingleServo"
            @ping="pingServoByPart"
            @calibrate="calibrateServoByPart"
            @update-angle="handleUpdateAngle"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, provide } from 'vue'
import axios from 'axios'
import { ElMessage, ElMessageBox, ElLoading } from 'element-plus'
import { wsClient } from '@/utils/websocket.js'
import { useServoStore } from '@/stores/servo'
import { eventBus } from '@/utils/eventBus.js'
import ServoInfoDisplay from '@/components/ServoInfoDisplay.vue'
import RobotPart from '@/components/RobotPart.vue'
import * as api from '@/api'

const servoStore = useServoStore()

// API 基础 URL - 使用相对路径，通过 Vite 代理转发
const API_BASE = ''

// 连接设置
const port = ref('/dev/ttyACM0')
const servoType = ref('st3215')
const baudrate = ref(1000000)

// ✅ 监听电机类型变化，自动切换端口
watch(servoType, (newType) => {
  if (newType === 'robstride') {
    // RobStride 使用 CAN 接口
    port.value = 'can0'
  } else {
    // 其他类型使用串口
    if (port.value === 'can0') {
      port.value = '/dev/ttyACM0'
    }
  }
})

// 使用 Pinia 中的状态
const availablePorts = computed(() => servoStore.availablePorts)
const foundServos = computed({
  get: () => servoStore.scannedServos,
  set: (val) => servoStore.setScannedServos(val)
})

// 扫描设置
const startId = ref(1)
const endId = ref(50)
const scanning = ref(false)
const currentScanId = ref(0)

// 机器人配置
const robotConfig = ref(null)

// 是否有腿
const hasLegs = ref(false)

// 防抖定时器
let updateTimer = null

// 移除旧的处理器
let removeHandler = null

// 根据ID获取舵机信息（带状态）
const getServoById = (id) => {
  const servo = foundServos.value.find(s => s.id === id)
  return {
    id: id,
    online: !!servo,
    display: servo ? `ID:${servo.id}` : `ID:${id} 离线`
  }
}

// 根据部位获取舵机列表
const getServoByPart = (part, index) => {
  // 从配置文件读取映射
  if (!robotConfig.value) return { id: 0, online: false, display: '-' }
  
  const partMap = {
    'left_arm': Object.values(robotConfig.value.left_bus?.left_arm || {}),
    'right_arm': Object.values(robotConfig.value.right_bus?.right_arm || {}),
    'base': Object.values(robotConfig.value.left_bus?.base || {})
  }
  
  const ids = partMap[part]
  if (!ids || !ids[index - 1]) return { id: 0, online: false, display: '-' }
  
  const servoId = ids[index - 1]
  const servo = foundServos.value.find(s => s.id === servoId)
  return {
    id: servoId,
    online: !!servo,
    display: servo ? `ID:${servoId}` : `ID:${servoId} 离线`
  }
}

// 获取部位舵机配置（用于 RobotPart 组件）
const getPartServos = (partName, partConfig) => {
  if (!partConfig) return []
  
  // 如果是对象格式（胳膊、底盘）
  if (typeof partConfig === 'object' && !Array.isArray(partConfig)) {
    return partConfig
  }
  
  return []
}

provide('foundServos', foundServos)

onMounted(async () => {
  // 获取可用串口列表并同步到 Pinia
  await fetchAvailablePorts()
  // 获取机器人配置
  await fetchRobotConfig()
})

// 获取机器人配置
const fetchRobotConfig = async () => {
  try {
    const response = await api.getServoIds()
    if (response.code === 200) {
      robotConfig.value = response.data
    }
  } catch (error) {
    console.error('获取配置失败:', error)
  }
}

// 认领舵机 - 扫描并更新配置
const claimServos = async () => {
  if (!robotConfig.value) {
    ElMessage.warning('请先加载配置')
    return
  }
  
  // 确认操作
  const confirmed = await ElMessageBox.confirm(
    '将扫描所有串口，自动识别舵机并更新配置文件。\n请确保所有舵机已连接并通电。',
    '认领舵机',
    {
      confirmButtonText: '开始扫描',
      cancelButtonText: '取消',
      type: 'warning'
    }
  )
  
  if (!confirmed) return
  
  scanning.value = true
  foundServos.value = []
  
  try {
    // 扫描左臂总线（新代码自动识别品牌）
    const leftResponse = await api.scanServos(robotConfig.value.left_bus.port, 1, 253)
    
    if (leftResponse.code === 200 && leftResponse.data?.servos) {
      foundServos.value = leftResponse.data.servos.map(servo => ({
        ...servo,
        angle: 0,
        speed: 0,
        mode: 'position'
      }))
    }
    
    // 扫描右臂总线
    const rightResponse = await api.scanServos(robotConfig.value.right_bus.port, 1, 253)
    
    if (rightResponse.code === 200 && rightResponse.data?.servos) {
      const rightServos = rightResponse.data.servos.map(servo => ({
        ...servo,
        angle: 0,
        speed: 0,
        mode: 'position'
      }))
      foundServos.value = [...foundServos.value, ...rightServos]
    }
    
    ElMessage.success(`扫描完成，找到 ${foundServos.value.length} 个舵机`)
    
    // 自动更新配置文件
    await saveServoConfig()
    
  } catch (error) {
    console.error('扫描失败:', error)
  } finally {
    scanning.value = false
  }
}

// 保存舵机配置到 server
const saveServoConfig = async () => {
  try {
    console.log('保存配置:', JSON.stringify(robotConfig.value, null, 2))
    const response = await api.putServoIds({
      config: robotConfig.value
    })
    
    if (response.code === 200) {
      ElMessage.success('配置已保存到 server')
      // 通知 Terminal 重载配置
      await notifyTerminalReload()
    }
  } catch (error) {
    console.error('保存配置失败:', error)
    ElMessage.error('保存配置失败')
  }
}

// 通知 Terminal 重载配置
const notifyTerminalReload = async () => {
  try {
    // 通过 WebSocket 发送 reload_config 命令
    wsClient.send({
      type: 'api_command',
      category: 'motor',
      action: 'reload_servo_config'
    })
    ElMessage.success('已通知 Terminal 重载配置')
  } catch (error) {
    console.error('通知 Terminal 失败:', error)
  }
}

// 认领单个舵机（根据部位和索引）
const claimSingleServo = async (part, index) => {
  if (!robotConfig.value) {
    ElMessage.warning('请先加载配置')
    return
  }
  
  const partMap = {
    'left_arm': robotConfig.value.left_bus?.left_arm,
    'right_arm': robotConfig.value.right_bus?.right_arm,
    'base': robotConfig.value.left_bus?.base,
    'neck': robotConfig.value.left_bus?.neck,
    'lift_axis': robotConfig.value.left_bus?.lift_axis
  }
  
  const partConfig = partMap[part]
  if (!partConfig) return
  
  const keys = Object.keys(partConfig)
  if (index > keys.length) return
  
  const key = keys[index - 1]
  const oldId = partConfig[key]
  
  const { value: newId } = await ElMessageBox.prompt(
    `当前 ID: ${oldId || '未设置'}\n\n请输入新的舵机 ID:`,
    '认领舵机',
    {
      confirmButtonText: '确认',
      cancelButtonText: '取消',
      inputPattern: /^\d+$/,
      inputErrorMessage: '请输入有效的数字 ID'
    }
  )
  
  if (newId) {
    const newIdNum = parseInt(newId)
    partConfig[key] = newIdNum
    
    ElMessage.success(`认领成功！ID: ${oldId || '无'} → ${newIdNum}`)
    
    await saveServoConfig()
  }
}

// Ping 舵机（小幅度摆动 3 秒）
const pingServo = async (servoId, port) => {
  if (!servoId) {
    ElMessage.warning('舵机 ID 无效')
    return
  }
  
  try {
    const response = await api.pingServo(servoId, port)
    
    if (response.code === 200) {
      ElMessage.success(`已发送 Ping 命令：舵机 ${servoId}`)
    }
  } catch (error) {
    console.error('Ping 失败:', error)
  }
}

// 根据部位 Ping 舵机
const pingServoByPart = async (part, index) => {
  if (!robotConfig.value) {
    ElMessage.warning('请先加载配置')
    return
  }
  
  const partMap = {
    'left_arm': robotConfig.value.left_bus?.left_arm,
    'right_arm': robotConfig.value.right_bus?.right_arm,
    'base': robotConfig.value.left_bus?.base,
    'neck': robotConfig.value.left_bus?.neck,
    'lift_axis': robotConfig.value.left_bus?.lift_axis
  }
  
  const partConfig = partMap[part]
  if (!partConfig) return
  
  const keys = Object.keys(partConfig)
  if (index > keys.length) return
  
  const key = keys[index - 1]
  const servoId = partConfig[key].id
  
  // 从扫描结果中找端口
  const foundServo = foundServos.value.find(s => s.id === servoId)
  const port = foundServo ? foundServo.port : '/dev/ttyACM0'
  
  await pingServo(servoId, port)
}

// 校准舵机零点（设置当前位置为 0 度）
const calibrateServo = async (servoId, port) => {
  if (!servoId) {
    ElMessage.warning('舵机 ID 无效')
    return
  }
  
  const confirmed = await ElMessageBox.confirm(
    `确定要将舵机 ID=${servoId} 的当前位置设置为 0 度吗？`,
    '校准零点',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    }
  )
  
  if (!confirmed) return
  
  try {
    const response = await api.calibrateMotor('left', `servo_${servoId}`, 0.0)
    
    if (response.code === 200) {
      ElMessage.success(`校准成功！舵机 ${servoId} 当前位置已设为 0 度`)
    }
  } catch (error) {
    console.error('校准失败:', error)
  }
}

// 根据部位校准舵机
const calibrateServoByPart = async (part, index) => {
  if (!robotConfig.value) {
    ElMessage.warning('请先加载配置')
    return
  }
  
  const partMap = {
    'left_arm': robotConfig.value.left_bus?.left_arm,
    'right_arm': robotConfig.value.right_bus?.right_arm,
    'base': robotConfig.value.left_bus?.base,
    'neck': robotConfig.value.left_bus?.neck,
    'lift_axis': robotConfig.value.left_bus?.lift_axis
  }
  
  const partConfig = partMap[part]
  if (!partConfig) return
  
  const keys = Object.keys(partConfig)
  if (index > keys.length) return
  
  const key = keys[index - 1]
  const servoId = partConfig[key].id
  
  // 从扫描结果中找端口
  const foundServo = foundServos.value.find(s => s.id === servoId)
  const port = foundServo ? foundServo.port : '/dev/ttyACM0'
  
  await calibrateServo(servoId, port)
}

// ==================== 工具方法 ====================

/**
 * 设置舵机角度（统一接口）
 */
const setServoAngle = async (servoId, angle, port) => {
  try {
    const response = await api.setServoAngle(servoId, angle, port)
    return response.code === 200
  } catch (error) {
    console.error(`设置舵机 ${servoId} 角度失败:`, error)
    return false
  }
}

/**
 * 设置舵机速度（统一接口）
 */
const setServoSpeed = async (servoId, speed, port) => {
  try {
    const response = await api.setServoSpeed(servoId, speed, port)
    return response.code === 200
  } catch (error) {
    console.error(`设置舵机 ${servoId} 速度失败:`, error)
    return false
  }
}

// 处理角度更新
const handleUpdateAngle = async ({ servoId, angle }) => {
  if (!servoId) return
  
  // 从扫描结果中找端口
  const foundServo = foundServos.value.find(s => s.id === servoId)
  const port = foundServo ? foundServo.port : '/dev/ttyACM0'
  
  const success = await setServoAngle(servoId, angle, port)
  
  // ✅ 如果设置成功，触发刷新事件
  if (success) {
    console.log('[ServoManager] 触发刷新事件:', `servo-info-refresh-${servoId}`)
    eventBus.emit(`servo-info-refresh-${servoId}`)
  }
}

// 一键归零
const resetAllServos = async () => {
  if (foundServos.value.length === 0) {
    ElMessage.warning('没有可归零的舵机')
    return
  }
  
  const confirmed = await ElMessageBox.confirm(
    `确定要将所有 ${foundServos.value.length} 个舵机归零吗？\n所有舵机将移动到 0° 位置。`,
    '一键归零',
    {
      confirmButtonText: '确定归零',
      cancelButtonText: '取消',
      type: 'warning'
    }
  )
  
  if (!confirmed) return
  
  // 开启 Loading
  const loading = ElLoading.service({
    lock: true,
    text: '正在逐个归零舵机...',
    background: 'rgba(0, 0, 0, 0.7)'
  })
  
  let successCount = 0
  let failCount = 0
  let index = 0
  
  // 使用定时器逐个发送
  const timer = setInterval(async () => {
    if (index >= foundServos.value.length) {
      clearInterval(timer)
      loading.close()
      
      if (failCount === 0) {
        ElMessage.success(`所有舵机已归零（${successCount} 个）`)
      } else {
        ElMessage.warning(`归零完成：成功 ${successCount} 个，失败 ${failCount} 个`)
      }
      return
    }
    
    const servo = foundServos.value[index]
    try {
      const success = await setServoAngle(servo.id, 0, servo.port)
      if (success) {
        successCount++
        // ✅ 触发刷新事件
        console.log('[ServoManager] 触发刷新事件:', `servo-info-refresh-${servo.id}`)
        eventBus.emit(`servo-info-refresh-${servo.id}`)
      } else {
        failCount++
      }
    } catch (error) {
      console.error(`舵机 ${servo.id} 归零失败:`, error)
      failCount++
    }
    
    index++
  }, 1000) // 每 100ms 发送一个指令
}

onUnmounted(() => {
  // 无需清理
})

// 扫描舵机
const scanServos = async () => {
  if (scanning.value) return
  
  scanning.value = true
  foundServos.value = []
  
  try {
    // 如果选择的是 'all'，则遍历所有可用端口
    const portsToScan = port.value === 'all' ? availablePorts.value : [port.value]
    let allFoundServos = []

    for (const currentPort of portsToScan) {
      try {
        // 新代码自动识别品牌，无需 servo_type
        const response = await axios.post(`/api/scan_servos`, {
          port: currentPort,
          start_id: startId.value,
          end_id: endId.value
        })
        
        if (response.data.code === 200 && response.data.data?.servos) {
          const servos = response.data.data.servos.map(servo => ({
            ...servo,
            angle: 0,
            speed: 0,
            mode: 'position'
          }))
          allFoundServos = [...allFoundServos, ...servos]
        }
      } catch (err) {
        console.warn(`端口 ${currentPort} 扫描失败:`, err)
      }
    }

    // 更新 Pinia 状态
    servoStore.setScannedServos(allFoundServos)
    ElMessage.success(`扫描完成，在 ${portsToScan.length} 个端口中共找到 ${allFoundServos.length} 个舵机`)
  } catch (error) {
    console.error('扫描失败:', error)
    ElMessage.error('扫描失败: ' + (error.response?.data?.message || error.message))
  } finally {
    scanning.value = false
  }
}

// 更新舵机角度（防抖：滑动停止后 500ms 发送）
const updateServoAngle = async(servo) => {
  // 清除之前的定时器
  if (updateTimer) {
    clearTimeout(updateTimer)
  }
  
  // 设置新定时器
  const success = await setServoAngle(servo.id, servo.angle, servo.port)
  
  // ✅ 如果设置成功，触发刷新事件
  if (success) {
    console.log('[ServoManager] 触发刷新事件:', `servo-info-refresh-${servo.id}`)
    eventBus.emit(`servo-info-refresh-${servo.id}`)
  }
}

// 切换舵机模式
const switchMode = async (servo) => {
  try {
    const response = await api.setServoMode(servo.id, servo.mode, servo.port)
    
    if (response.code === 200) {
      ElMessage.success(`舵机 ${servo.id} 已切换到${servo.mode === 'position' ? '位置' : '速度'}模式`)
    }
  } catch (error) {
    console.error('切换模式失败:', error)
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
    await setServoSpeed(servo.id, servo.speed, servo.port)
  }, 100)  // 100ms 防抖
}

// 停止舵机
const stopServo = async (servo) => {
  const success = await setServoSpeed(servo.id, 0, servo.port)
  
  if (success) {
    servo.speed = 0
    ElMessage.success(`舵机 ${servo.id} 已停止`)
  }
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
    const response = await api.resetServo(servo.id, servo.port)
    
    if (response.code === 200) {
      ElMessage.success('重置成功，请断电重启舵机')
    }
  } catch (error) {
    console.error('重置失败:', error)
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
    const response = await api.setServoId(servo.id, parseInt(newId), servo.port)
    
    if (response.code === 200) {
      ElMessage.success('ID 修改成功，请断电重启舵机')
      // 从列表中移除该舵机
      foundServos.value = foundServos.value.filter(s => s.id !== servo.id)
    }
  } catch (error) {
    console.error('修改ID失败:', error)
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


    const response = await api.listPorts()
     // ✅ 添加 CAN 接口
    if (!ports.includes('can0')) {
      ports.unshift('can0')  // 放在最前面
    }
    const ports = response.data?.ports || []
    servoStore.setAvailablePorts(ports)
    if (ports.length > 0 && port.value === '/dev/ttyACM0') {
      port.value = ports[0]
    }
  } catch (error) {
    console.error('获取串口列表失败:', error)
    const defaultPorts = ['can0', '/dev/ttyACM0', '/dev/ttyACM1', '/dev/ttyUSB0', '/dev/ttyUSB1']
    servoStore.setAvailablePorts(defaultPorts)
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

.btn-warning {
  background: #f59e0b;
  color: #ffffff;
}

.btn-warning:hover {
  background: #d97706;
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
  padding: 16px;
  background: #16181d;
  border: 1px solid #2d3139;
  border-radius: 8px;
  transition: all 0.2s;
  cursor: pointer;
}

.servo-item:hover {
  border-color: #3b82f6;
  background: #1a1c23;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
}

.servo-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.servo-details-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 8px;
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

.servo-details {
  display: flex;
  gap: 12px;
  margin-top: 4px;
  font-size: 11px;
  color: #9ca3af;
  font-family: 'JetBrains Mono', monospace;
}

.servo-details span {
  white-space: nowrap;
}

.btn-fetch-info {
  background: transparent;
  border: none;
  font-size: 18px;
  cursor: pointer;
  padding: 4px;
  margin-left: 8px;
  transition: transform 0.2s;
}

.btn-fetch-info:hover {
  transform: scale(1.2);
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

.servo-control {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.angle-slider,
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

/* 机器人硬件信息 */
.robot-hardware-card {
  margin-top: 20px;
}

.robot-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.btn-claim {
  padding: 8px 16px;
  background: #3b82f6;
  border: none;
  border-radius: 6px;
  color: #ffffff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-claim:hover:not(:disabled) {
  background: #2563eb;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.btn-claim:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.robot-layout {
  display: flex;
  gap: 16px;
  justify-content: center;
  align-items: flex-start;
}

.robot-column {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
  max-width: 300px;
}

.robot-column.center {
  flex: 1.5;
}

.robot-legs {
  display: flex;
  gap: 16px;
  justify-content: center;
  width: 100%;
  margin-top: 8px;
}

.robot-part {
  background: #16181d;
  border: 1px solid #2d3139;
  border-radius: 8px;
  padding: 12px;
  text-align: center;
  height: fit-content;
}

.part-title {
  font-size: 14px;
  font-weight: 600;
  color: #ffffff;
  margin-bottom: 8px;
}

.servo-slots {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
}

.slot-wrapper {
  display: flex;
  gap: 8px;
  align-items: center;
  width: 100%;
}

.btn-claim-single {
  width: 32px;
  height: 32px;
  padding: 0;
  background: #3b82f6;
  border: none;
  border-radius: 4px;
  color: #ffffff;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.btn-claim-single:hover:not(:disabled) {
  background: #2563eb;
  transform: scale(1.1);
}

.btn-claim-single:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-ping-single {
  width: 32px;
  height: 32px;
  padding: 0;
  background: #f59e0b;
  border: none;
  border-radius: 4px;
  color: #ffffff;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.btn-ping-single:hover:not(:disabled) {
  background: #d97706;
  transform: scale(1.1);
}

.btn-ping-single:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-calibrate-single {
  width: 32px;
  height: 32px;
  padding: 0;
  background: #8b5cf6;
  border: none;
  border-radius: 4px;
  color: #ffffff;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.btn-calibrate-single:hover:not(:disabled) {
  background: #7c3aed;
  transform: scale(1.1);
}

.btn-calibrate-single:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.slot {
  background: #2d3139;
  border: 1px solid #3d4149;
  border-radius: 4px;
  padding: 6px 12px;
  font-size: 12px;
  font-family: 'JetBrains Mono', monospace;
  width: 100%;
  transition: all 0.3s;
}

.slot.online {
  color: #22c55e;
  border-color: #22c55e;
  background: rgba(34, 197, 94, 0.1);
}

.slot.offline {
  color: #ef4444;
  border-color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

.slot.empty {
  color: #6b7280;
}
</style>
