 <template>
  <div class="robot-part">
    <div class="part-title">{{ title }}</div>
    <el-row :gutter="12" class="servo-slots">
      <el-col 
        v-for="(servo, index) in displayServos" 
        :key="servo.key || index"
        :span="24"
        class="servo-block"
      >
        <!-- ID 信息 -->
        <el-row :gutter="8" align="middle">
          <el-col :span="24">
            <div class="servo-label" v-if="servo.key">
              {{ getServoLabel(servo.key) }}
            </div>
            <div 
              v-if="servo.servoId"
              class="slot"
              :class="getServoStatus(servo.servoId).online ? 'online' : 'offline'"
            >
              {{ getServoStatus(servo.servoId).display }}
            </div>
            <div v-else class="slot empty">-</div>
          </el-col>
        </el-row>
        
        <!-- 按钮组 -->
        <el-row :gutter="8" align="middle" class="btn-row">
          <el-col :span="24" class="btn-group">
            <button 
              v-if="servo.servoId"
              @click="$emit('claim', partName, index + 1)" 
              class="btn-claim-single"
              :disabled="scanning"
            >
              🔍
            </button>
            <button 
              v-if="servo.servoId"
              @click="$emit('ping', partName, index + 1)" 
              class="btn-ping-single"
              :disabled="scanning"
            >
              📡
            </button>
            <button 
              v-if="servo.servoId"
              @click="$emit('calibrate', partName, index + 1)" 
              class="btn-calibrate-single"
              :disabled="scanning"
            >
              ⚙️
            </button>
          </el-col>
        </el-row>
        
        <!-- 滑动条 -->
        <el-row :gutter="8" align="middle" class="slider-row" v-if="servo.servoId">
          <el-col :span="20">
            <input 
              type="range" 
              :value="getAngle(servo.servoId)"
              @input="(e) => { setAngle(servo.servoId, parseInt(e.target.value)); updateAngle(servo.servoId) }"
              min="-180" 
              max="180" 
              class="angle-slider"
            />
          </el-col>
          <el-col :span="4" class="angle-value">
            <span>{{ getAngle(servo.servoId) }}°</span>
          </el-col>
        </el-row>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, computed, inject } from 'vue'

const props = defineProps({
  title: {
    type: String,
    required: true
  },
  servos: {
    type: Array,
    default: () => []
  },
  partName: {
    type: String,
    required: true
  },
  scanning: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['claim', 'ping', 'calibrate', 'update-angle'])

// 注入 foundServos
const foundServos = inject('foundServos', { value: [] })

// 每个舵机的角度状态（用 Map 存储）
const angleMap = ref(new Map())

// 获取或初始化角度
const getAngle = (servoId) => {
  if (!angleMap.value.has(servoId)) {
    angleMap.value.set(servoId, 0)
  }
  return angleMap.value.get(servoId)
}

// 设置角度
const setAngle = (servoId, value) => {
  angleMap.value.set(servoId, value)
}

// 更新角度（防抖）
let updateTimer = null
const updateAngle = (servoId) => {
  if (updateTimer) clearTimeout(updateTimer)
  
  updateTimer = setTimeout(() => {
    emit('update-angle', {
      servoId,
      angle: getAngle(servoId)
    })
  }, 100)
}

const displayServos = computed(() => {
  if (props.servos.length === 0) {
    return [{ key: 'empty', servoId: null }]
  }
  
  // 如果是对象格式（脖子、升降轴）
  if (props.servos[0]?.key) {
    return props.servos
  }
  
  // 如果是数组格式（胳膊、底盘）
  return Object.entries(props.servos).map(([key, config]) => ({
    key,
    servoId: typeof config === 'object' ? config.id : config
  }))
})

const getServoStatus = (servoId) => {
  const servo = foundServos.value.find(s => s.id === servoId)
  return {
    id: servoId,
    online: !!servo,
    display: servo ? `ID:${servoId}` : `ID:${servoId} 离线`
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
    'lift_axis': '升降轴'
  }
  return labelMap[key] || key
}
</script>

<style scoped>
.robot-part {
  margin-bottom: 16px;
}

.part-title {
  font-size: 14px;
  font-weight: 600;
  color: #ffffff;
  margin-bottom: 8px;
}

.servo-slots {
  margin-top: 8px;
}

.servo-block {
  margin-bottom: 12px;
  padding: 12px;
  background: #1e2128;
  border-radius: 8px;
  border: 1px solid #2d3139;
}

.servo-label {
  font-size: 13px;
  font-weight: 600;
  color: #60a5fa;
  margin-bottom: 6px;
  padding-bottom: 4px;
  border-bottom: 1px solid #2d3139;
}

.btn-group {
  display: flex;
  justify-content: center;
  gap: 12px;
}

.btn-row {
  margin: 8px 0;
}

.slider-row {
  margin: 8px 0;
}

.angle-slider {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: #2d3139;
  outline: none;
  -webkit-appearance: none;
}

.angle-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #3b82f6;
  cursor: pointer;
}

.angle-slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #3b82f6;
  cursor: pointer;
}

.angle-value {
  text-align: center;
  font-size: 13px;
  color: #9ca3af;
  font-family: 'JetBrains Mono', monospace;
}

.slot {
  flex: 1;
  padding: 8px 12px;
  background: #2d3139;
  border: 1px solid #3d4149;
  border-radius: 6px;
  color: #9ca3af;
  font-size: 13px;
  font-family: 'JetBrains Mono', monospace;
  text-align: center;
}

.slot.online {
  background: #065f46;
  border-color: #10b981;
  color: #ffffff;
}

.slot.offline {
  background: #7f1d1d;
  border-color: #ef4444;
  color: #fecaca;
}

.slot.empty {
  background: #1e2128;
  border-color: #2d3139;
  color: #6b7280;
}

.btn-claim-single,
.btn-ping-single,
.btn-calibrate-single {
  width: 32px;
  height: 32px;
  padding: 0;
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

.btn-claim-single {
  background: #3b82f6;
}

.btn-claim-single:hover:not(:disabled) {
  background: #2563eb;
  transform: scale(1.1);
}

.btn-ping-single {
  background: #f59e0b;
}

.btn-ping-single:hover:not(:disabled) {
  background: #d97706;
  transform: scale(1.1);
}

.btn-calibrate-single {
  background: #8b5cf6;
}

.btn-calibrate-single:hover:not(:disabled) {
  background: #7c3aed;
  transform: scale(1.1);
}

.btn-claim-single:disabled,
.btn-ping-single:disabled,
.btn-calibrate-single:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
