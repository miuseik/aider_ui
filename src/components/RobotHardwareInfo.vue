<template>
  <div class="card robot-hardware-card">
    <div class="robot-header">
      <h3>🤖 机器人硬件信息</h3>
      <div class="header-actions" v-if="showCalibration">
        <el-tooltip content="一键记录全部：批量读取所有 Feetech 舵机当前位置并记录为零位偏移" placement="bottom" :show-after="300">
          <button
            class="btn btn-batch"
            :disabled="calibrating || feetechCount === 0"
            @click="$emit('batchCalibrate')"
          >
            {{ calibrating ? '校准中...' : '🔧 一键记录全部' }}
          </button>
        </el-tooltip>
        <el-tooltip content="重置偏移量：将所有零位偏移量归零（不可撤销）" placement="bottom" :show-after="300">
          <button
            class="btn btn-reset"
            :disabled="calibrating"
            @click="confirmReset"
          >
            ↩ 重置偏移量
          </button>
        </el-tooltip>
      </div>
    </div>

    <!-- 校准状态栏 -->
    <div v-if="calibrating" class="status-bar calibrating">
      ⏳ 正在读取舵机位置并计算偏移量...
    </div>
    <div v-else-if="lastResult" class="status-bar success">
      ✅ {{ lastResult }}
    </div>

    <!-- 外骨骼关节数据显示 -->
    <div v-if="exoJoints.length" class="exo-section">
      <div class="exo-section-header">
        <span class="exo-section-title">🦴 外骨骼关节角度 ({{ exoJoints.length }}路)</span>
        <el-tooltip content="一键归零：将所有外骨骼关节的当前位置设为零点（写入校准文件）" placement="bottom" :show-after="300">
          <button
            class="btn btn-exo-zero"
            :disabled="exoZeroing"
            @click="$emit('exoZero')"
          >
            {{ exoZeroing ? '归零中...' : '🎯 一键归零' }}
          </button>
        </el-tooltip>
      </div>
      <div class="exo-arms-row">
        <!-- 左臂 -->
        <div class="exo-arm-col">
          <div class="exo-arm-label">🦾 左臂</div>
          <div class="exo-joints">
            <div v-for="j in leftExoJoints" :key="j.channel" class="exo-bar-item" :class="{ disabled: !j.enabled }">
              <el-tooltip :content="`将 ch${j.channel} 当前位置设为零点（单通道归零）`" placement="right" :show-after="300">
                <button
                  class="btn-exo-zero-single"
                  :disabled="exoZeroingChannels.has(j.channel)"
                  @click="$emit('exoZeroChannel', j.channel)"
                >
                  {{ exoZeroingChannels.has(j.channel) ? '...' : '◎' }}
                </button>
              </el-tooltip>
              <span class="exo-tag ch-tag">ch{{ j.channel }}</span>
              <span class="exo-tag joint-tag">{{ j.name }}</span>
              <div class="exo-bar-track">
                <div
                  class="exo-bar-fill"
                  :class="{ negative: j.percent < 50 }"
                  :style="j.barStyle"
                ></div>
              </div>
              <span class="exo-bar-val">{{ j.displayAngle }}</span>
              <el-tooltip :content="`ch${j.channel} 设置：启用通道 / 反转方向`" placement="right" :show-after="300">
                <button
                  class="btn-exo-settings"
                  :class="{ active: isReversed(j.channel) }"
                  @click="openSettings(j.channel)"
                >⚙</button>
              </el-tooltip>
            </div>
          </div>
        </div>
        <!-- 右臂 -->
        <div class="exo-arm-col">
          <div class="exo-arm-label">🦾 右臂</div>
          <div class="exo-joints">
            <div v-for="j in rightExoJoints" :key="j.channel" class="exo-bar-item" :class="{ disabled: !j.enabled }">
              <el-tooltip :content="`将 ch${j.channel} 当前位置设为零点（单通道归零）`" placement="right" :show-after="300">
                <button
                  class="btn-exo-zero-single"
                  :disabled="exoZeroingChannels.has(j.channel)"
                  @click="$emit('exoZeroChannel', j.channel)"
                >
                  {{ exoZeroingChannels.has(j.channel) ? '...' : '◎' }}
                </button>
              </el-tooltip>
              <span class="exo-tag ch-tag">ch{{ j.channel }}</span>
              <span class="exo-tag joint-tag">{{ j.name }}</span>
              <div class="exo-bar-track">
                <div
                  class="exo-bar-fill"
                  :class="{ negative: j.percent < 50 }"
                  :style="j.barStyle"
                ></div>
              </div>
              <span class="exo-bar-val">{{ j.displayAngle }}</span>
              <el-tooltip :content="`ch${j.channel} 设置：启用通道 / 反转方向`" placement="right" :show-after="300">
                <button
                  class="btn-exo-settings"
                  :class="{ active: isReversed(j.channel) }"
                  @click="openSettings(j.channel)"
                >⚙</button>
              </el-tooltip>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 单通道设置弹窗 -->
    <div v-if="settingsChannel != null" class="exo-settings-overlay" @click.self="closeSettings">
      <div class="exo-settings-dialog">
        <div class="exo-settings-title">
          ⚙ ch{{ settingsChannel }}
          <template v-if="exoCalibration[settingsChannel]">
            · {{ exoCalibration[settingsChannel].joint_name }}
            · {{ exoCalibration[settingsChannel].arm }}臂
          </template>
        </div>
        <div class="exo-settings-body">
          <label class="exo-settings-row">
            <span class="exo-settings-label">启用此通道</span>
            <button
              class="exo-toggle"
              :class="{ on: settingsEnabled }"
              @click="settingsEnabled = !settingsEnabled"
            >
              <span class="exo-toggle-knob"></span>
            </button>
            <span class="exo-settings-hint">{{ settingsEnabled ? 'ON' : 'OFF' }}</span>
          </label>
          <label class="exo-settings-row">
            <span class="exo-settings-label">反转方向</span>
            <button
              class="exo-toggle"
              :class="{ on: settingsReverse }"
              @click="settingsReverse = !settingsReverse"
            >
              <span class="exo-toggle-knob"></span>
            </button>
            <span class="exo-settings-hint">{{ settingsReverse ? 'ON' : 'OFF' }}</span>
          </label>
        </div>
        <div class="exo-settings-actions">
          <button class="btn btn-exo-cancel" @click="closeSettings">取消</button>
          <button class="btn btn-exo-save" @click="saveSettings">保存</button>
        </div>
      </div>
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
          title="🌀 腰"
          :servos="getPartServos(robotConfig.waist)"
          part-name="waist"
          :scanning="scanning"
          :show-calibration="showCalibration"
          :calibrating="calibrating"
          @claim="(idx) => $emit('claim', 'waist', idx)"
          @ping="(idx) => $emit('ping', 'waist', idx)"
          @calibrate="(idx) => $emit('calibrate', 'waist', idx)"
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
import { computed, ref } from 'vue'
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
  /** 外骨骼原始角度数组 [ch0, ch1, ...] */
  exoAngles: { type: Array, default: () => [] },
  /** 外骨骼校准数据 { channel: { pot_zero, pot_min, pot_max, angle_min, angle_max, reverse, arm, joint_index, joint_name, enabled } } */
  exoCalibration: { type: Object, default: () => ({}) },
  /** 一键归零 loading 状态 */
  exoZeroing: { type: Boolean, default: false },
  /** 正在归零中的通道集合 (Set of channel numbers) */
  exoZeroingChannels: { type: Set, default: () => new Set() },
})

const emit = defineEmits(['claim', 'ping', 'calibrate', 'update-angle', 'batchCalibrate', 'recordOffset', 'resetAll', 'setZero', 'exoZero', 'exoZeroChannel', 'exoUpdateCalibration'])

// ================== 通道设置弹窗 ==================
const settingsChannel = ref(null)       // 当前打开的设置弹窗通道号 (null=关闭)
const settingsEnabled = ref(true)       // 弹窗中的启用开关状态
const settingsReverse = ref(false)      // 弹窗中的反转开关状态

function openSettings(ch) {
  const cal = props.exoCalibration[ch]
  settingsChannel.value = ch
  settingsEnabled.value = cal?.enabled !== false   // 默认启用
  settingsReverse.value = cal?.reverse || false
}

function closeSettings() {
  settingsChannel.value = null
}

function saveSettings() {
  const ch = settingsChannel.value
  if (ch == null) return
  emit('exoUpdateCalibration', {
    channel: ch,
    enabled: settingsEnabled.value,
    reverse: settingsReverse.value,
  })
  closeSettings()
}

/** 通道是否反转 */
function isReversed(ch) {
  return props.exoCalibration[ch]?.reverse || false
}

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

// ================== 外骨骼显示计算 ==================

/** 从原始电位器角度计算校准后角度 (与 ExoHandler._apply_calibration 一致) */
function calibratedAngle(ch, rawAngle) {
  const cal = props.exoCalibration[ch]
  if (!cal || cal.pot_zero == null) return rawAngle

  let angle
  if (rawAngle >= cal.pot_zero) {
    const span = cal.pot_max - cal.pot_zero
    angle = span < 0.001 ? 0 : Math.max(0, Math.min(1, (rawAngle - cal.pot_zero) / span)) * cal.angle_max
  } else {
    const span = cal.pot_zero - cal.pot_min
    angle = span < 0.001 ? 0 : -Math.max(0, Math.min(1, (cal.pot_zero - rawAngle) / span)) * Math.abs(cal.angle_min)
  }
  if (cal.reverse) angle = -angle
  return angle
}

/** 双向进度条百分比: 0%=angle_min, 50%=零位, 100%=angle_max */
function barPercent(ch, rawAngle) {
  if (rawAngle == null) return 50
  const cal = props.exoCalibration[ch]
  if (!cal || cal.pot_zero == null) {
    return ((rawAngle + 135) / 270) * 100
  }
  const ca = calibratedAngle(ch, rawAngle)
  const totalRange = Math.abs(cal.angle_max) + Math.abs(cal.angle_min)
  if (totalRange < 0.001) return 50
  return ((ca - cal.angle_min) / totalRange) * 100
}

/** 构建每个通道的显示数据 */
function buildJointData(ch, rawAngle) {
  const cal = props.exoCalibration[ch]
  const ca = calibratedAngle(ch, rawAngle)
  const pct = barPercent(ch, rawAngle)
  const barStyle = pct >= 50
    ? { left: '50%', width: (pct - 50) + '%' }
    : { left: pct + '%', width: (50 - pct) + '%' }
  const name = cal ? `${cal.joint_name || `ch${ch}`}` : `ch${ch}`
  return {
    channel: ch,
    name,
    rawAngle,
    calibrated: ca,
    displayAngle: ca.toFixed(1),
    percent: pct,
    barStyle,
    enabled: !!(cal && cal.enabled),
  }
}

/** 所有已启用且有数据的 exo 关节（排序后） */
const exoJoints = computed(() => {
  const angles = props.exoAngles
  if (!angles || !angles.length) return []
  const result = []
  for (const [chStr, cal] of Object.entries(props.exoCalibration)) {
    const ch = Number(chStr)
    if (ch >= angles.length) continue
    const raw = angles[ch]
    if (raw == null) continue
    result.push(buildJointData(ch, raw))
  }
  return result
})

/** 左臂 exo 关节，按 joint_index 排序 */
const leftExoJoints = computed(() => {
  return exoJoints.value
    .filter(j => props.exoCalibration[j.channel]?.arm === 'left')
    .sort((a, b) => (props.exoCalibration[a.channel]?.joint_index ?? 99) - (props.exoCalibration[b.channel]?.joint_index ?? 99))
})

/** 右臂 exo 关节，按 joint_index 排序 */
const rightExoJoints = computed(() => {
  return exoJoints.value
    .filter(j => props.exoCalibration[j.channel]?.arm === 'right')
    .sort((a, b) => (props.exoCalibration[a.channel]?.joint_index ?? 99) - (props.exoCalibration[b.channel]?.joint_index ?? 99))
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
.btn-batch-zero {
  background: linear-gradient(135deg, #059669, #047857);
  color: #fff;
}
.btn-batch-zero:not(:disabled):hover {
  box-shadow: 0 0 14px rgba(5,150,105,0.5);
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

/* ====== 外骨骼关节显示 ====== */
.exo-section {
  margin-bottom: 16px;
  padding: 10px 14px;
  background: #16181e;
  border: 1px solid #2d3139;
  border-radius: 8px;
}

.exo-section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.exo-section-title {
  font-size: 13px;
  font-weight: 600;
  color: #60a5fa;
}

.btn-exo-zero {
  padding: 5px 12px;
  border: 1px solid #d97706;
  border-radius: 5px;
  background: transparent;
  color: #fbbf24;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}
.btn-exo-zero:hover:not(:disabled) {
  background: #d97706;
  color: #fff;
  box-shadow: 0 0 10px rgba(217,119,6,0.4);
}
.btn-exo-zero:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-exo-zero-single {
  width: 20px;
  height: 20px;
  padding: 0;
  border: 1px solid #3d4149;
  border-radius: 50%;
  background: transparent;
  color: #6b7280;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}
.btn-exo-zero-single:hover:not(:disabled) {
  border-color: #fbbf24;
  color: #fbbf24;
  background: rgba(251, 191, 36, 0.1);
  box-shadow: 0 0 6px rgba(251, 191, 36, 0.3);
}
.btn-exo-zero-single:active:not(:disabled) {
  background: #d97706;
  color: #fff;
  border-color: #d97706;
}
.btn-exo-zero-single:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.exo-arms-row {
  display: flex;
  gap: 20px;
}

.exo-arm-col {
  flex: 1;
  min-width: 0;
}

.exo-arm-label {
  font-size: 12px;
  font-weight: 600;
  color: #9ca3af;
  margin-bottom: 4px;
  padding-bottom: 2px;
  border-bottom: 1px solid #2d3139;
}

.exo-joints {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.exo-bar-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* disabled 通道：整行灰显（开关仍可点击以重新启用） */
.exo-bar-item.disabled {
  opacity: 0.45;
}

.exo-tag {
  font-size: 10px;
  font-family: 'JetBrains Mono', monospace;
  padding: 1px 5px;
  border-radius: 3px;
  flex-shrink: 0;
  line-height: 1.4;
}

.ch-tag {
  background: rgba(255, 255, 255, 0.06);
  color: #6b7280;
  border: 1px solid rgba(255, 255, 255, 0.08);
  width: 36px;
  text-align: center;
}

.joint-tag {
  background: rgba(96, 165, 250, 0.1);
  color: #60a5fa;
  border: 1px solid rgba(96, 165, 250, 0.2);
  width: 38px;
  text-align: center;
}

.exo-bar-track {
  flex: 1;
  height: 5px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 3px;
  overflow: hidden;
  position: relative;
}

/* 中心线 (零位指示) */
.exo-bar-track::after {
  content: '';
  position: absolute;
  left: 50%;
  top: 0;
  width: 2px;
  height: 100%;
  background: rgba(255, 255, 255, 0.25);
  z-index: 1;
}

.exo-bar-fill {
  position: absolute;
  top: 0;
  height: 100%;
  background: linear-gradient(90deg, #22c55e, #16a34a);
  border-radius: 3px;
  transition: left 0.15s ease, width 0.15s ease;
}

.exo-bar-fill.negative {
  background: linear-gradient(90deg, #ef4444, #dc2626);
}

.exo-bar-val {
  font-size: 10px;
  font-family: 'JetBrains Mono', monospace;
  color: rgba(255, 255, 255, 0.4);
  width: 36px;
  text-align: right;
  flex-shrink: 0;
}

/* ====== 通道设置按钮 ====== */
.btn-exo-settings {
  width: 20px;
  height: 20px;
  padding: 0;
  border: 1px solid #3d4149;
  border-radius: 4px;
  background: transparent;
  color: #6b7280;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}
.btn-exo-settings:hover {
  border-color: #60a5fa;
  color: #60a5fa;
  background: rgba(96, 165, 250, 0.1);
}
.btn-exo-settings.active {
  border-color: #f59e0b;
  color: #f59e0b;
}

/* ====== 设置弹窗 ====== */
.exo-settings-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.exo-settings-dialog {
  background: #1e2128;
  border: 1px solid #3d4149;
  border-radius: 10px;
  padding: 20px;
  min-width: 280px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.exo-settings-title {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 16px;
  padding-bottom: 10px;
  border-bottom: 1px solid #2d3139;
}

.exo-settings-body {
  margin-bottom: 20px;
}

.exo-settings-row {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: default;
}

.exo-settings-label {
  font-size: 13px;
  color: #d1d5db;
  min-width: 72px;
}

.exo-settings-hint {
  font-size: 11px;
  font-family: 'JetBrains Mono', monospace;
  color: #9ca3af;
  width: 30px;
}

/* 开关 toggle */
.exo-toggle {
  width: 42px;
  height: 24px;
  border-radius: 12px;
  border: none;
  background: #3d4149;
  cursor: pointer;
  position: relative;
  transition: background 0.2s;
  padding: 0;
}
.exo-toggle.on {
  background: #f59e0b;
}
.exo-toggle-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s;
}
.exo-toggle.on .exo-toggle-knob {
  transform: translateX(18px);
}

.exo-settings-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn-exo-cancel {
  border: 1px solid #3d4149;
  background: transparent;
  color: #9ca3af;
}
.btn-exo-cancel:hover {
  background: #3d4149;
  color: #fff;
}

.btn-exo-save {
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: #fff;
}
.btn-exo-save:hover {
  box-shadow: 0 0 12px rgba(59, 130, 246, 0.4);
}
</style>
