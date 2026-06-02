/**
 * 系统相关 API
 */

import request from '@/api/request.js'

/**
 * 获取系统状态
 */
export function getStatus() {
  return request.get('/status')
}

/**
 * 切换键盘控制
 * @param {string} action - 'enable' | 'disable'
 */
export function toggleKeyboard(action) {
  return request.post('/keyboard', { action })
}

/**
 * 发送按键事件
 * @param {string} key - 按键标识
 * @param {string} action - 'press' | 'release'
 */
export function sendKeypress(key, action) {
  return request.post('/keypress', { key, action })
}

/**
 * 切换机器人连接
 * @param {string} action - 'connect' | 'disconnect'
 */
export function toggleRobot(action) {
  return request.post('/robot', { action })
}

/**
 * 获取配置
 */
export function getConfig() {
  return request.get('/config')
}

/**
 * 保存配置
 * @param {Object} config - 配置对象
 */
export function saveConfig(config) {
  return request.post('/config', config)
}

/**
 * 重启系统
 */
export function restartSystem() {
  return request.post('/restart')
}
