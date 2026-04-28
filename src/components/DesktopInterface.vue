<template>
  <div class="desktop-interface">
    <KeyboardHelp
      :is-keyboard-enabled="isKeyboardEnabled"
      @toggle="$emit('toggle-keyboard')"
    />
  </div>
</template>

<script setup>
import KeyboardHelp from './KeyboardHelp.vue'

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
