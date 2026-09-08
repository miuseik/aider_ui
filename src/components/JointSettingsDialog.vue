<template>
  <el-dialog
    v-model="visible"
    :title="title"
    width="380px"
    append-to-body
    :close-on-click-modal="false"
  >
    <div class="joint-settings-body">
      <div class="joint-settings-row">
        <span class="joint-settings-label">取反方向</span>
        <el-switch
          v-model="reversed"
          active-text="ON"
          inactive-text="OFF"
          :disabled="saving"
        />
        <span class="joint-settings-hint">direction: {{ reversed ? '-1' : '+1' }}</span>
      </div>
      <div class="joint-settings-tip">
        写入 servo_ids.yaml 的 direction，Terminal 热更新后生效
      </div>
    </div>

    <template #footer>
      <el-button size="small" @click="visible = false">取消</el-button>
      <el-button size="small" type="primary" :loading="saving" @click="onSave">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import * as api from '@/api'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  /** 关节对象：{ key, servoId, direction } */
  servo: { type: Object, default: null },
  /** 部位键名（left_arm / right_arm / neck / waist ...） */
  partName: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue', 'saved'])

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const reversed = ref(false)
const saving = ref(false)

const title = computed(() => {
  if (!props.servo) return '⚙ 关节设置'
  const id = props.servo.servoId != null ? `　ID:${props.servo.servoId}` : ''
  return `⚙ ${props.servo.key}${id}`
})

// 打开时按该关节当前 direction 初始化开关（已取反=direction<0 → ON）
watch(
  () => [props.modelValue, props.servo],
  ([open, servo]) => {
    if (open && servo) {
      reversed.value = Number(servo.direction ?? 1) < 0
    }
  },
  { immediate: true },
)

async function onSave() {
  if (!props.servo) return
  const direction = reversed.value ? -1 : 1
  saving.value = true
  try {
    const res = await api.updateJointDirection(props.partName, props.servo.key, direction)
    if (res.code === 200) {
      ElMessage.success(
        `${props.servo.key} 方向已设为 ${direction < 0 ? '取反 (direction: -1)' : '正向 (direction: +1)'}`
      )
      emit('saved', { joint: props.servo.key, direction })
      visible.value = false
    } else {
      ElMessage.error(res.message || '保存失败')
    }
  } catch (err) {
    ElMessage.error('保存失败: ' + (err?.message || err))
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.joint-settings-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.joint-settings-label {
  font-size: 13px;
  min-width: 64px;
}
.joint-settings-hint {
  font-size: 12px;
  font-family: 'JetBrains Mono', monospace;
  opacity: 0.75;
}
.joint-settings-tip {
  margin-top: 10px;
  font-size: 12px;
  opacity: 0.6;
}
</style>
