<template>
  <div class="card robot-hardware-card">
    <div class="robot-header">
      <h3>🤖 机器人硬件信息</h3>
      <div class="header-actions" v-if="showCalibration">
        <button
          class="btn btn-batch"
          :disabled="calibrating || feetechCount === 0"
          @click="$emit('batchCalibrate')"
        >
          {{ calibrating ? '校准中...' : '🔧 一键记录全部' }}
        </button>
        <button
          class="btn btn-reset"
          :disabled="calibrating"
          @click="confirmReset"
        >
          ↩ 重置偏移量
        </button>
      </div>
    </div>

    <!-- 校准状态栏 -->
    <div v-if="calibrating" class="status-bar calibrating">
      ⏳ 正在读取舵机位置并计算偏移量...
    </div>
    <div v-else-if="lastResult" class="status-bar success">
      ✅ {{ lastResult }}
    </div>

    <div class="robot-layout" v-if="robotConfig">
      <div class="robot-column left">
        <RobotPart 
          title="🦾 左胳膊"
          :servos="getPartServos(robotConfig.left_arm)"
          part-name="left_arm"
          :scanning="scanning"
          :show-calibration="showCalibration"
          :calibrating="calibrating"
          @claim="(idx) => $emit('claim', 'left_arm', idx)"
          @ping="(idx) => $emit('ping', 'left_arm', idx)"
          @calibrate="(idx) => $emit('calibrate', 'left_arm', idx)"
          @update-angle="$emit('update-angle', $event)"
          @record-offset="onRecordOffset"
          @set-zero="onSetZero"
        />
      </div>

      <div class="robot-column center">
        <RobotPart 
          title="🧠 头"
          :servos="[]"
          part-name="head"
          :scanning="scanning"
          :show-calibration="false"
        />
        <RobotPart 
          title="🔗 脖子"
          :servos="getPartServos(robotConfig.neck)"
          part-name="neck"
          :scanning="scanning"
          :show-calibration="showCalibration"
          :calibrating="calibrating"
          @claim="(idx) => $emit('claim', 'neck', idx)"
          @ping="(idx) => $emit('ping', 'neck', idx)"
          @calibrate="(idx) => $emit('calibrate', 'neck', idx)"
          @update-angle="$emit('update-angle', $event)"
          @record-offset="onRecordOffset"
          @set-zero="onSetZero"
        />
        <RobotPart 
          title="🦴 身体"
          :servos="getPartServos(robotConfig.lift_axis)"
          part-name="lift_axis"
          :scanning="scanning"
          :show-calibration="showCalibration"
          :calibrating="calibrating"
          @claim="(idx) => $emit('claim', 'lift_axis', idx)"
          @ping="(idx) => $emit('ping', 'lift_axis', idx)"
          @calibrate="(idx) => $emit('calibrate', 'lift_axis', idx)"
          @update-angle="$emit('update-angle', $event)"
          @record-offset="onRecordOffset"
          @set-zero="onSetZero"
        />
        <RobotPart 
          title="🦿 底盘"
          :servos="getPartServos(robotConfig.base)"
          part-name="base"
          :scanning="scanning"
          :show-calibration="showCalibration"
          :calibrating="calibrating"
          @claim="(idx) => $emit('claim', 'base', idx)"
          @ping="(idx) => $emit('ping', 'base', idx)"
          @calibrate="(idx) => $emit('calibrate', 'base', idx)"
          @update-angle="$emit('update-angle', $event)"
          @record-offset="onRecordOffset"
          @set-zero="onSetZero"
        />
      </div>

      <div class="robot-column right">
        <RobotPart 
          title="🦾 右胳膊"
          :servos="getPartServos(robotConfig.right_arm)"
          part-name="right_arm"
          :scanning="scanning"
          :show-calibration="showCalibration"
          :calibrating="calibrating"
          @claim="(idx) => $emit('claim', 'right_arm', idx)"
          @ping="(idx) => $emit('ping', 'right_arm', idx)"
          @calibrate="(idx) => $emit('calibrate', 'right_arm', idx)"
          @update-angle="$emit('update-angle', $event)"
          @record-offset="onRecordOffset"
          @set-zero="onSetZero"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ElMessageBox } from 'element-plus'
import RobotPart from './RobotPart.vue'

const props = defineProps({
  robotConfig: { type: Object, default: null },
  scanning: { type: Boolean, default: false },
  /** 是否显示校准功能 */
  showCalibration: { type: Boolean, default: true },
  /** 是否正在校准中 */
  calibrating: { type: Boolean, default: false },
  /** 上次校准结果文本 */
  lastResult: { type: String, default: '' },
})

const emit = defineEmits(['claim', 'ping', 'calibrate', 'update-angle', 'batchCalibrate', 'recordOffset', 'resetAll', 'setZero'])

function getPartServos(partConfig) {
  if (!partConfig) return []
  if (typeof partConfig === 'object' && !Array.isArray(partConfig)) {
    return partConfig
  }
  return []
}

/** 统计 Feetech 关节数量 */
const feetechCount = computed(() => {
  if (!props.robotConfig) return 0
  let count = 0
  for (const partKey of Object.keys(props.robotConfig)) {
    const part = props.robotConfig[partKey]
    if (!part || typeof part !== 'object' || Array.isArray(part)) continue
    for (const joint of Object.values(part)) {
      if (joint && typeof joint === 'object') {
        const brand = (joint.brand || '').toLowerCase()
        if (brand.startsWith('feetech')) count++
      }
    }
  }
  return count
})

/** 转发 RobotPart 的 recordOffset 事件 */
function onRecordOffset(partName, jointKey, servoId) {
  emit('recordOffset', { partName, jointKey, servoId })
}

/** 转发 RobotPart 的 setZero 事件 */
function onSetZero(partName, jointKey, servoId) {
  emit('setZero', { partName, jointKey, servoId })
}

async function confirmReset() {
  try {
    await ElMessageBox.confirm(
      '确定要将所有零位偏移量重置为 0 吗？\n\n此操作不可撤销。',
      '重置偏移量',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' },
    )
    emit('resetAll')
  } catch {
    // cancelled
  }
}
</script>

<style scoped>
.card {
  background: #1e2128;
  border: 1px solid #2d3139;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 20px;
}
.robot-hardware-card {
  margin-top: 20px;
}
.robot-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 10px;
}
.robot-header h3 {
  font-size: 18px;
  font-weight: 600;
  color: #ffffff;
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.btn {
  padding: 8px 14px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}
.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.btn-batch {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: #fff;
}
.btn-batch:not(:disabled):hover {
  box-shadow: 0 0 14px rgba(59,130,246,0.5);
}
.btn-reset {
  background: #2d3139;
  color: #9ca3af;
  border: 1px solid #3d4149;
}
.btn-reset:not(:disabled):hover {
  background: #3d4149;
  color: #fff;
}

.status-bar {
  padding: 10px 14px;
  border-radius: 6px;
  margin-bottom: 14px;
  font-size: 13px;
}
.status-bar.calibrating {
  background: rgba(59,130,246,0.1);
  color: #60a5fa;
  border: 1px solid rgba(59,130,246,0.3);
  animation: pulse 1.5s ease-in-out infinite;
}
.status-bar.success {
  background: rgba(16,185,129,0.1);
  color: #34d399;
  border: 1px solid rgba(16,185,129,0.3);
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
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
</style>
