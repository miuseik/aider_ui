/**
 * 通用防抖工具（项目自建，无第三方依赖）
 * 适用于任何需要"连续触发只在停止 wait 毫秒后执行一次"的场景。
 *
 * @param {Function} fn 需要防抖的函数
 * @param {number} wait 等待时间(ms)，默认 300
 * @returns {Function} 防抖后的函数，附带 .cancel() 用于取消待执行任务
 */
export function debounce(fn, wait = 300) {
  let timer = null
  const debounced = (...args) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = null
      fn(...args)
    }, wait)
  }
  debounced.cancel = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }
  return debounced
}
