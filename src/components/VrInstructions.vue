<template>
  <div class="vr-instructions-section">
    <h2>🥽 VR 控制器使用说明</h2>
    <div class="instructions-content">
      <div class="instructions-image">
        <img src="/media/telegrip_instructions.jpg" alt="VR 控制器使用说明">
      </div>
      <div class="instructions-text">
        <div class="instruction-item">
          <strong>设置：</strong>在头显浏览器中访问 <code>{{ vrServerUrl }}</code> 并点击“开始”
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
    <div style="margin-top: 16px; text-align: center;">
      <el-button type="primary" size="large" @click="$emit('switch-vr')">
        <el-icon><Monitor /></el-icon>
        切换到 VR 视图
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { Monitor } from '@element-plus/icons-vue'

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
