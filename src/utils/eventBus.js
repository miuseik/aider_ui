/**
 * 全局事件总线 - 用于组件间通信
 */
import { reactive } from 'vue'

export const eventBus = reactive({
  events: {},
  
  // 订阅事件
  on(event, callback) {
    if (!this.events[event]) {
      this.events[event] = []
    }
    this.events[event].push(callback)
  },
  
  // 取消订阅
  off(event, callback) {
    if (!this.events[event]) return
    if (callback) {
      this.events[event] = this.events[event].filter(cb => cb !== callback)
    } else {
      delete this.events[event]
    }
  },
  
  // 发布事件
  emit(event, ...args) {
    if (!this.events[event]) return
    this.events[event].forEach(callback => callback(...args))
  }
})
