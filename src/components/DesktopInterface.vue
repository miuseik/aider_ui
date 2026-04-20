<template>
  <div class="desktop-interface">
    <div class="desktop-header">
      <RobotStatus
        :status="status"
        :is-robot-engaged="isRobotEngaged"
        :show-warning="showWarning"
        @toggle="$emit('toggle-robot')"
      />

      <VrInstructions 
        :vr-server-url="vrServerUrl"
        @switch-vr="$emit('switch-vr')"
      />
    </div>

    <KeyboardHelp 
      :is-keyboard-enabled="isKeyboardEnabled"
      @toggle="$emit('toggle-keyboard')"
    />
  </div>
</template>

<script setup>
import RobotStatus from './RobotStatus.vue'
import KeyboardHelp from './KeyboardHelp.vue'
import VrInstructions from './VrInstructions.vue'

defineProps({
  status: {
    type: Object,
    required: true
  },
  isRobotEngaged: {
    type: Boolean,
    default: false
  },
  showWarning: {
    type: Boolean,
    default: false
  },
  vrServerUrl: {
    type: String,
    required: true
  },
  isKeyboardEnabled: {
    type: Boolean,
    default: false
  }
})

defineEmits(['toggle-robot', 'toggle-keyboard', 'switch-vr'])
</script>

<style>
/* 样式从全局 styles.css 继承 */
</style>
