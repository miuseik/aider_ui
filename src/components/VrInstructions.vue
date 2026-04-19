<template>
  <div class="vr-instructions-section">
    <h2>🥽 VR 控制器使用说明</h2>
    <div class="instructions-content">
      <div class="instructions-image">
        <img src="/media/telegrip_instructions.jpg" alt="VR 控制器使用说明" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
      </div>
      <div class="instructions-text">
        <div class="instruction-item">
          <strong>设置：</strong>在头显浏览器中访问 <span style="font-family: monospace; background: rgba(255,255,255,0.2); padding: 2px 6px; border-radius: 4px;">{{ vrServerUrl }}</span> 并点击"开始"
        </div>
        <div class="instruction-item grip-button">
          <strong>握持按钮：</strong>只要按住握持按钮，机械臂夹爪尖端就会跟踪您的相对控制器移动
        </div>
        <div class="instruction-item trigger-button">
          <strong>扳机按钮：</strong>按住扳机按钮时夹爪保持闭合。松开扳机按钮以打开夹爪。
        </div>
        <div class="instruction-item">
          <strong>控制器方向：</strong>控制器的翻滚和俯仰将与机械臂腕部关节匹配
        </div>
      </div>
    </div>
    <div style="margin-top: 15px; text-align: center;">
      <button @click="$emit('switch-vr')" style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.4); color: white; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-size: 14px;">
        🥽 切换到 VR 视图
      </button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  vrServerUrl: {
    type: String,
    required: true
  }
})

defineEmits(['switch-vr'])
</script>

<style>
/* 样式从全局 styles.css 继承 */
</style>
