/**
 * 全局事件总线 - 用于组件间通信
 */
import { reactive } from 'vue'

export const eventBus = reactive({
  events: {},
  
  // 订阅事件
  on(event, callback) {
    console.log('[EventBus] 订阅事件:', event)
    if (!this.events[event]) {
      this.events[event] = []
    }
    this.events[event].push(callback)
    console.log('[EventBus] 当前订阅者数量:', this.events[event].length)
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
    console.log('[EventBus] 触发事件:', event, '参数:', args)
    if (!this.events[event]) {
      console.warn('[EventBus] 没有订阅者监听事件:', event)
      return
    }
    console.log('[EventBus] 找到', this.events[event].length, '个订阅者')
    this.events[event].forEach(callback => callback(...args))
  }
})
