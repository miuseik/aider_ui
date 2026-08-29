 <template>
  <div class="robot-part">
    <div class="part-title">{{ title }}</div>
    <div class="servo-list">
      <template v-for="(servo, idx) in displayServos" :key="servo.key || idx">
        <!-- 有舵机：三行卡片 + 可选校准行 -->
        <div class="servo-item" v-if="servo.servoId" :class="{ 'is-feetech': servo.isFeetech }">
          <div class="label-row">
            <span class="servo-label">{{ servo.label || getServoLabel(servo.key) }}</span>
            <span class="angle">{{ getAngle(servo.servoId) }}°</span>
            <span class="slot" :class="getServoStatus(servo.servoId).online ? 'online' : 'offline'">
              {{ getServoStatus(servo.servoId).display }}
            </span>
          </div>
          <div class="slider-row">
            <button class="step-btn" @click="stepAngle(servo, -1)" title="-1°">◀</button>
            <input type="range" :value="getAngle(servo.servoId)"
              @input="e => { setAngle(servo.servoId, +e.target.value); updateAngle(servo) }"
              :min="getLimit(servo).min" :max="getLimit(servo).max" class="slider" :style="sliderStyle(servo.servoId)" />
            <button class="step-btn" @click="stepAngle(servo, 1)" title="+1°">▶</button>
          </div>
          <div class="input-row">
            <input type="number" class="angle-input"
              :value="getServoInput(servo.servoId)"
              @input="e => servoInputMap.set(servo.servoId, e.target.value)"
              :min="getLimit(servo).min" :max="getLimit(servo).max" step="0.1"
              @keydown.enter="confirmAngle(servo)" />
            <button class="btn-confirm" @click="confirmAngle(servo)" title="确认角度">✓</button>
          </div>
          <!-- 关节模式：限位显示 + 编辑 -->
          <div v-if="isJointPart" class="limit-row">
            <template v-if="!limitEditMap.has(servo.key)">
              <span class="limit-label">限位</span>
              <span class="limit-value">[{{ getLimit(servo).min }}°, {{ getLimit(servo).max }}°]</span>
              <button class="btn-limit" @click="startEditLimit(servo)" title="编辑限位">✎</button>
            </template>
            <template v-else>
              <input type="number" class="limit-input" v-model.number="limitEditMap.get(servo.key).min" step="1" />
              <span class="limit-sep">~</span>
              <input type="number" class="limit-input" v-model.number="limitEditMap.get(servo.key).max" step="1" />
              <button class="btn-limit save" @click="saveLimit(servo)" title="保存限位">✓</button>
              <button class="btn-limit" @click="limitEditMap.delete(servo.key)" title="取消">✕</button>
            </template>
          </div>
          <div class="btns-row">
            <el-tooltip content="认领：将该舵机 ID 绑定到当前关节位置" placement="top" :show-after="300">
              <button @click="$emit('claim', partName, idx + 1)" :disabled="scanning">🔍</button>
            </el-tooltip>
            <el-tooltip content="Ping：发送探测帧，检测舵机是否在线响应" placement="top" :show-after="300">
              <button @click="$emit('ping', partName, idx + 1)" :disabled="scanning" class="amber">📡</button>
            </el-tooltip>
            <el-tooltip content="校准：读取当前位置，作为该关节的角度基准" placement="top" :show-after="300">
              <button @click="$emit('calibrate', partName, idx + 1)" :disabled="scanning" class="purple">⚙️</button>
            </el-tooltip>
            <el-tooltip content="获取信息：读取电机型号、固件版本、实时位置等参数" placement="top" :show-after="300">
              <button @click="fetchServoInfo(servo.servoId)" :disabled="scanning || fetchingInfo" class="teal">📋</button>
            </el-tooltip>
            <el-tooltip v-if="!servo.isFeetech && showCalibration" content="设置零位：将当前位置设为电机零位参考点（写入电机 EEPROM）" placement="top" :show-after="300">
              <button
                @click="confirmSetZero(partName, servo.key, servo.servoId)"
                :disabled="!getServoStatus(servo.servoId).online || calibrating"
                class="green"
              >0️⃣</button>
            </el-tooltip>
          </div>
          <!-- Feetech 舵机：零位偏移量 + 记录按钮 -->
          <div v-if="servo.isFeetech && showCalibration" class="offset-row">
            <span class="offset-label">零位偏移</span>
            <span class="offset-value" :class="{ changed: servo.zeroOffset !== 0 }">
              {{ fmtOffset(servo.zeroOffset) }}°
            </span>
            <el-tooltip content="记录零位：读取当前位置，计算并记录零位偏移（写入校准文件）" placement="bottom" :show-after="300">
              <button
                class="btn-offset"
                :disabled="!getServoStatus(servo.servoId).online || calibrating"
                @click="emit('recordOffset', partName, servo.key, servo.servoId)"
              >
                记录零位
              </button>
            </el-tooltip>
          </div>
          <!-- 非 Feetech：设置零位 -->
          <div v-else-if="!servo.isFeetech && showCalibration" class="offset-row">
            <el-tooltip content="设置零位：将当前位置设为电机零位参考点（写入电机 EEPROM）" placement="bottom" :show-after="300">
              <button
                class="btn-offset motor-zero"
                :disabled="!getServoStatus(servo.servoId).online || calibrating"
                @click="emit('setZero', partName, servo.key, servo.servoId)"
              >
                设置零位
              </button>
            </el-tooltip>
          </div>
        </div>
        <!-- 无舵机：空占位 -->
        <div class="servo-item empty-card" v-else>
          <div class="label-row"><span class="servo-label muted">空</span><span class="slot empty">⚪</span></div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, inject, onMounted, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { eventBus } from '@/utils/eventBus.js'
import * as api from '@/api'

const props = defineProps({
  title: { type: String, required: true },
  servos: { type: [Array, Object], default: () => [] },
  partName: { type: String, required: true },
  scanning: { type: Boolean, default: false },
  /** 是否显示零位校准控件 */
  showCalibration: { type: Boolean, default: true },
  /** 是否正在校准中 */
  calibrating: { type: Boolean, default: false },
})

const emit = defineEmits(['claim', 'ping', 'calibrate', 'update-angle', 'recordOffset', 'setZero'])

// 注入 foundServos
const foundServos = inject('foundServos', { value: [] })

// 标零：带确认
const confirmSetZero = (partName, key, servoId) => {
  ElMessageBox.confirm(
    '确认将当前位置设置为电机的零位参考点？',
    '标零确认',
    { confirmButtonText: '确认', cancelButtonText: '取消', type: 'warning' }
  ).then(() => {
    emit('setZero', partName, key, servoId)
  }).catch(() => {})
}

// 用户手动拖动的角度（仅记录用户操作后的值）
const userAngleMap = ref(new Map())

// 获取角度：优先用户手动值，否则读取 foundServos 实时数据
const getAngle = (servoId) => {
  if (userAngleMap.value.has(servoId)) {
    return userAngleMap.value.get(servoId)
  }
  const found = foundServos.value.find(s => s.id === servoId)
  return found?.angle ?? 0
}

// 设置角度（用户拖动滑块）
const setAngle = (servoId, value) => {
  userAngleMap.value.set(servoId, value)
}

/** 滑块颜色：值越大越红（0°=绿, 满量程=红） */
const sliderStyle = (servoId) => {
  const angle = getAngle(servoId)
  const intensity = Math.min(Math.abs(angle) / 180, 1)
  const hue = Math.round((1 - intensity) * 140)
  const color = `hsl(${hue}, 80%, 50%)`
  return { accentColor: color, '--slider-color': color }
}

// ---- 关节模式：双臂/脖子/腰按 URDF 关节名控制（经 adapter，仿真同步）----
// 底盘轮/升降轴保持电机 ID 直控（连续旋转/电机角度，无关节概念）
const JOINT_PARTS = ['left_arm', 'right_arm', 'neck', 'waist']
const isJointPart = computed(() => JOINT_PARTS.includes(props.partName))

// 限位本地覆盖（编辑保存后立即生效，下次刷新 robotConfig 后以 yaml 为准）
const limitOverrideMap = ref(new Map())
const getLimit = (servo) => {
  const o = limitOverrideMap.value.get(servo.key)
  if (o) return o
  return {
    min: servo.minAngle ?? -180,
    max: servo.maxAngle ?? 180,
  }
}

// ---- 限位编辑 ----
const limitEditMap = ref(new Map())  // key -> {min, max}
const startEditLimit = (servo) => {
  const { min, max } = getLimit(servo)
  limitEditMap.value.set(servo.key, { min, max })
}
const savingLimit = ref(false)
const saveLimit = async (servo) => {
  const e = limitEditMap.value.get(servo.key)
  if (!e) return
  const lo = Number(e.min), hi = Number(e.max)
  if (isNaN(lo) || isNaN(hi) || lo >= hi) {
    ElMessage.error('限位无效：下限必须小于上限')
    return
  }
  savingLimit.value = true
  try {
    const res = await api.updateJointLimits(props.partName, servo.key, lo, hi)
    if (res.code === 200) {
      limitOverrideMap.value.set(servo.key, { min: lo, max: hi })
      limitEditMap.value.delete(servo.key)
      ElMessage.success(`${servo.key} 限位已保存 [${lo}°, ${hi}°]`)
    } else {
      ElMessage.error(res.message || '保存失败')
    }
  } catch (err) {
    ElMessage.error('保存失败: ' + (err?.message || err))
  } finally {
    savingLimit.value = false
  }
}

// 箭头微调：按步长增减角度
const stepAngle = (servo, delta) => {
  const { min, max } = getLimit(servo)
  const current = getAngle(servo.servoId)
  const next = Math.max(min, Math.min(max, Math.round(current + delta)))
  setAngle(servo.servoId, next)
  updateAngle(servo)
}

// 精确输入
const servoInputMap = ref(new Map())
const getServoInput = (servoId) => {
  if (!servoInputMap.value.has(servoId)) {
    servoInputMap.value.set(servoId, String(getAngle(servoId)))
  }
  return servoInputMap.value.get(servoId)
}
const confirmAngle = (servo) => {
  const val = parseFloat(servoInputMap.value.get(servo.servoId))
  if (isNaN(val)) return
  const { min, max } = getLimit(servo)
  const clamped = Math.max(min, Math.min(max, val))
  setAngle(servo.servoId, clamped)
  servoInputMap.value.set(servo.servoId, String(clamped))
  updateAngle(servo)
}

// 📋 获取电机信息
const fetchingInfo = ref(false)
const fetchServoInfo = async (servoId) => {
  const found = foundServos.value.find(s => s.id === servoId)
  if (!found) return
  const port = found.port || 'can0'
  fetchingInfo.value = true
  try {
    const response = await api.getServoInfo(servoId, port)
    if (response.code === 200 && response.data) {
      eventBus.emit('servo-info-fetched', {
        servoId,
        angle: response.data.angle,
        online: response.data.online,
      })
    }
  } catch (err) {
    console.error('[RobotPart] get_info failed:', err)
  } finally {
    fetchingInfo.value = false
  }
}

// 更新角度（防抖）
let updateTimer = null
const updateAngle = (servo) => {
  if (updateTimer) clearTimeout(updateTimer)

  updateTimer = setTimeout(() => {
    // 关节模式：按 URDF 关节名走 adapter（软限位钳制，仿真+硬件同步）
    if (isJointPart.value) {
      api.setJointAngle(servo.key, getAngle(servo.servoId))
        .catch(err => console.error('[RobotPart] setJointAngle failed:', err))
      return
    }
    // 电机直控（底盘轮/升降轴）
    const found = foundServos.value.find(s => s.id === servo.servoId)
    emit('update-angle', {
      servoId: servo.servoId,
      angle: getAngle(servo.servoId),
      port: found?.port
    })
  }, 100)
}

// 监听 get_info 返回：清除用户手动值缓存，让实时数据 / foundServos 生效
const onHwClearAngle = (servoId) => {
  userAngleMap.value.delete(servoId)
  servoInputMap.value.delete(servoId)
}
onMounted(() => {
  eventBus.on('robot-hw-clear-angle', onHwClearAngle)
})
onUnmounted(() => {
  eventBus.off('robot-hw-clear-angle', onHwClearAngle)
})

const displayServos = computed(() => {
  const entries = []

  if (props.servos && typeof props.servos === 'object' && !Array.isArray(props.servos)) {
    // 对象格式（脖子、升降轴、胳膊、底盘）
    for (const [key, config] of Object.entries(props.servos)) {
      const isObj = typeof config === 'object' && config !== null
      const servoId = isObj ? config.id : config
      const brand = (isObj && config.brand) || ''
      entries.push({
        key,
        servoId,
        brand: brand.toLowerCase(),
        isFeetech: brand.toLowerCase().startsWith('feetech'),
        zeroOffset: isObj ? (config.zero_offset ?? 0) : 0,
        minAngle: isObj ? (config.min_angle ?? -180) : -180,
        maxAngle: isObj ? (config.max_angle ?? 180) : 180,
        label: isObj ? (config.joint_name || '') : '',
      })
    }
  } else if (Array.isArray(props.servos)) {
    for (const item of props.servos) {
      if (item && item.key) {
        const brand = (item.brand || '').toLowerCase()
        entries.push({
          ...item,
          brand,
          isFeetech: brand.startsWith('feetech'),
          zeroOffset: item.zero_offset ?? 0,
          minAngle: item.min_angle ?? -180,
          maxAngle: item.max_angle ?? 180,
        })
      }
    }
  }

  if (entries.length === 0) {
    return [{ key: 'empty', servoId: null }]
  }
  return entries
})

const getServoStatus = (servoId) => {
  const servo = foundServos.value.find(s => s.id === servoId)
  // 优先使用 servo.online 字段，不存在时 fallback 到 !!servo（老数据兼容）
  const online = servo ? (servo.online !== undefined ? !!servo.online : true) : false
  return {
    id: servoId,
    online,
    display: online ? `ID:${servoId}` : `ID:${servoId} 离线`
  }
}

// 获取舵机中文标签
const getServoLabel = (key) => {
  const isRight = props.partName === 'right_arm'
  const prefix = isRight ? '🦿 右' : '🦾 左'
  
  const labelMap = {
    // 双臂通用关节名
    'shoulder_pan': `${prefix}肩旋转`,
    'shoulder_lift': `${prefix}肩升降`,
    'elbow_flex': `${prefix}肘弯曲`,
    'wrist_flex': `${prefix}手腕弯曲`,
    'wrist_roll': `${prefix}手腕旋转`,
    'gripper': `${prefix}夹爪`,
    // 底盘（正三角）
    'front_wheel': '⚙️ 前轮',
    'left_wheel': '⚙️ 左轮',
    'right_wheel': '⚙️ 右轮',
    // 其他
    'neck': '脖子',
    'lift_axis': '升降轴',
    'lift_Link': '升降轴',
    // 脖子 / 身体关节
    'head_Link': '🔧 脖子俯仰',
    'head_Link2': '🔧 脖子左右'
  }
  return labelMap[key] || key
}

/** 格式化偏移量 */
function fmtOffset(val) {
  if (val == null) return '0.00'
  const n = Number(val)
  return (n >= 0 ? '+' : '') + n.toFixed(2)
}
</script>

<style scoped>
.robot-part { margin-bottom: 12px; }
.part-title { font-size: 13px; font-weight: 700; color: #fff; margin-bottom: 6px; }

.servo-list { display: flex; flex-direction: column; gap: 5px; }

.servo-item {
  background: #1a1c23; border: 1px solid #2d3139;
  border-radius: 6px; padding: 6px 8px;
}

/* 行1：标签左 + 角度中 + 状态右 */
.label-row {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 4px;
}
.servo-label { font-size: 12px; font-weight: 600; color: #60a5fa; }
.servo-label.muted { color: #6b7280; }

.angle {
  font-size: 11px; font-family: 'JetBrains Mono', monospace;
  color: #9ca3af;
}

/* 行2：滑条 + 左右箭头 */
.slider-row {
  display: flex; align-items: center; gap: 3px;
  margin-bottom: 4px;
}
.step-btn {
  width: 18px; height: 18px; padding: 0; border: none; border-radius: 3px;
  font-size: 9px; cursor: pointer; transition: all .15s;
  background: #2d3139; color: #9ca3af;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.step-btn:hover { background: #3b82f6; color: #fff; }
.slider {
  width: 100%; height: 4px; border-radius: 2px; background: #2d3139;
  outline: none; -webkit-appearance: none; cursor: pointer;
  accent-color: #3b82f6;
}
.slider::-webkit-slider-thumb {
  -webkit-appearance: none; width: 11px; height: 11px;
  border-radius: 50%; background: var(--slider-color, #3b82f6); cursor: pointer;
}

/* 行3：精确输入 */
.input-row {
  display: flex; align-items: center; gap: 3px;
  margin-bottom: 4px;
}
.angle-input {
  width: 100%; height: 22px; padding: 0 5px; border: 1px solid #2d3139;
  border-radius: 3px; background: #111318; color: #e2e8f0;
  font-size: 11px; font-family: 'JetBrains Mono', monospace; text-align: center;
  outline: none; transition: border-color .15s;
}
.angle-input:focus { border-color: #3b82f6; }
.angle-input::-webkit-inner-spin-button,
.angle-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.btn-confirm {
  width: 26px; height: 22px; padding: 0; border: 1px solid #059669;
  border-radius: 3px; background: transparent; color: #34d399;
  font-size: 12px; cursor: pointer; transition: all .15s;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.btn-confirm:hover { background: #059669; color: #fff; }

/* 行4：按钮 */
.btns-row { display: flex; gap: 4px; }
.btns-row button {
  width: 22px; height: 22px; padding: 0; border: none; border-radius: 3px;
  font-size: 11px; cursor: pointer; transition: all .15s;
  display: flex; align-items: center; justify-content: center;
  background: #3b82f6; color: #fff;
}
.btns-row button.amber { background: #f59e0b; }
.btns-row button.purple { background: #8b5cf6; }
.btns-row button.teal { background: #0d9488; }
.btns-row button.green { background: #22c55e; }
.btns-row button:disabled { opacity: .35; cursor: not-allowed; }
.btns-row button:not(:disabled):hover { transform: scale(1.15); }

/* 偏移量行 */
.offset-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  padding-top: 5px;
  border-top: 1px solid #2d3139;
  font-size: 11px;
}
.offset-row.hint {
  color: #6b7280;
  font-size: 10px;
  border-top-style: dashed;
}
.offset-label {
  color: #6b7280;
}
.offset-value {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 700;
  color: #9ca3af;
}
.offset-value.changed {
  color: #f59e0b;
}
.btn-offset {
  margin-left: auto;
  padding: 2px 8px;
  border: 1px solid #3b82f6;
  border-radius: 3px;
  background: transparent;
  color: #60a5fa;
  font-size: 10px;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.btn-offset:hover:not(:disabled) {
  background: #3b82f6;
  color: #fff;
}
.btn-offset.motor-zero {
  margin-left: 0;
  width: 100%;
  border-color: #059669;
  color: #34d399;
}
.btn-offset.motor-zero:hover:not(:disabled) {
  background: #059669;
  color: #fff;
}
.btn-offset:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

/* 限位行 */
.limit-row {
  display: flex; align-items: center; gap: 5px;
  margin-top: 5px; padding-top: 4px;
  border-top: 1px dashed #2d3139;
  font-size: 10px;
}
.limit-label { color: #6b7280; }
.limit-value {
  font-family: 'JetBrains Mono', monospace;
  color: #9ca3af; font-weight: 600;
}
.limit-sep { color: #6b7280; }
.limit-input {
  width: 52px; height: 20px; padding: 0 4px;
  border: 1px solid #2d3139; border-radius: 3px;
  background: #111318; color: #e2e8f0;
  font-size: 10px; font-family: 'JetBrains Mono', monospace;
  text-align: center; outline: none;
}
.limit-input:focus { border-color: #3b82f6; }
.limit-input::-webkit-inner-spin-button,
.limit-input::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
.btn-limit {
  margin-left: auto;
  padding: 1px 7px; border: 1px solid #4b5563; border-radius: 3px;
  background: transparent; color: #9ca3af;
  font-size: 10px; cursor: pointer; transition: all .15s;
}
.btn-limit:hover { border-color: #3b82f6; color: #60a5fa; }
.btn-limit.save { border-color: #059669; color: #34d399; margin-left: 0; }
.btn-limit.save:hover { background: #059669; color: #fff; }
.limit-row .btn-limit:not(.save) { margin-left: 0; }
.limit-row .btn-limit:first-of-type { margin-left: auto; }

/* Feetech 左边框标记 */
.servo-item.is-feetech {
  border-left: 3px solid #2563eb;
}

/* 状态标签 */
.slot {
  padding: 1px 6px; border-radius: 3px;
  font-size: 11px; font-family: 'JetBrains Mono', monospace;
  white-space: nowrap; flex-shrink: 0;
  background: #2d3139; border: 1px solid #3d4149; color: #9ca3af;
}
.slot.online { background: #065f46; border-color: #10b981; color: #fff; }
.slot.offline { background: #7f1d1d; border-color: #ef4444; color: #fecaca; }
.slot.empty { background: #1e2128; border-color: #2d3139; color: #6b7280; }
</style>
