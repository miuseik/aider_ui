 <template>
  <div class="robot-part">
    <div class="part-title">{{ title }}</div>
    <div class="servo-list">
      <template v-for="(servo, idx) in displayServos" :key="servo.key || idx">
        <!-- 有舵机：三行卡片 -->
        <div class="servo-item" v-if="servo.servoId">
          <div class="label-row">
            <span class="servo-label">{{ getServoLabel(servo.key) }}</span>
            <span class="angle">{{ getAngle(servo.servoId) }}°</span>
            <span class="slot" :class="getServoStatus(servo.servoId).online ? 'online' : 'offline'">
              {{ getServoStatus(servo.servoId).display }}
            </span>
          </div>
          <div class="slider-row">
            <input type="range" :value="getAngle(servo.servoId)"
              @input="e => { setAngle(servo.servoId, +e.target.value); updateAngle(servo.servoId) }"
              min="-180" max="180" class="slider" />
          </div>
          <div class="btns-row">
            <button @click="$emit('claim', partName, idx + 1)" :disabled="scanning" title="认领">🔍</button>
            <button @click="$emit('ping', partName, idx + 1)" :disabled="scanning" title="Ping" class="amber">📡</button>
            <button @click="$emit('calibrate', partName, idx + 1)" :disabled="scanning" title="校准" class="purple">⚙️</button>
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
    'lift_axis': '升降轴',
    'lift_Link': '升降轴',
    // 脖子 / 身体关节
    'head_Link': '🔧 脖子俯仰',
    'head_Link2': '🔧 脖子左右'
  }
  return labelMap[key] || key
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

/* 行2：滑条通栏 */
.slider-row { margin-bottom: 4px; }
.slider {
  width: 100%; height: 4px; border-radius: 2px; background: #2d3139;
  outline: none; -webkit-appearance: none; cursor: pointer;
}
.slider::-webkit-slider-thumb {
  -webkit-appearance: none; width: 11px; height: 11px;
  border-radius: 50%; background: #3b82f6; cursor: pointer;
}

/* 行3：按钮 */
.btns-row { display: flex; gap: 4px; }
.btns-row button {
  width: 22px; height: 22px; padding: 0; border: none; border-radius: 3px;
  font-size: 11px; cursor: pointer; transition: all .15s;
  display: flex; align-items: center; justify-content: center;
  background: #3b82f6; color: #fff;
}
.btns-row button.amber { background: #f59e0b; }
.btns-row button.purple { background: #8b5cf6; }
.btns-row button:disabled { opacity: .35; cursor: not-allowed; }
.btns-row button:not(:disabled):hover { transform: scale(1.15); }

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
