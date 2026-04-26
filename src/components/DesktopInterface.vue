<template>
  <div class="desktop-interface">
    <VrInstructions 
      :status="status"
      :vr-server-url="vrServerUrl"
      @switch-vr="$emit('switch-vr')"
    />

    <KeyboardHelp 
      :is-keyboard-enabled="isKeyboardEnabled"
      @toggle="$emit('toggle-keyboard')"
    />
  </div>
</template>

<script setup>
import KeyboardHelp from './KeyboardHelp.vue'
import VrInstructions from './VrInstructions.vue'

defineProps({
  status: {
    type: Object,
    required: true
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

defineEmits(['toggle-keyboard', 'switch-vr'])
</script>

<style>
/* 样式从全局 styles.css 继承 */
</style>
