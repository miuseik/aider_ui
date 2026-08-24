import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { toggleKeyboard, sendKeypress } from '@/api'

export function useKeyboard(isRobotEngaged, showConnectionWarning) {
  const isKeyboardEnabled = ref(false)
  const pressedKeys = new Set()

  const controlKeys = [
    'KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyQ', 'KeyE',
    'KeyZ', 'KeyX', 'KeyR', 'KeyT', 'KeyF', 'KeyG', 'KeyC',
    'KeyI', 'KeyK', 'KeyJ', 'KeyL', 'KeyU', 'KeyO',
    'KeyN', 'KeyM', 'KeyH', 'KeyY', 'KeyP', 'Slash', 'Period',
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6',
    'Digit7', 'Digit9', 'KeyV', 'KeyB',
    'Tab', 'Enter', 'Escape'
  ]

  const keyMap = {
    'KeyW': 'w', 'KeyS': 's', 'KeyA': 'a', 'KeyD': 'd',
    'KeyQ': 'q', 'KeyE': 'e',
    'KeyZ': 'z', 'KeyX': 'x', 'KeyR': 'r', 'KeyT': 't',
    'KeyF': 'f', 'KeyG': 'g',
    'KeyC': 'c',
    'KeyI': 'i', 'KeyK': 'k', 'KeyJ': 'j', 'KeyL': 'l',
    'KeyU': 'u', 'KeyO': 'o',
    'KeyN': 'n', 'KeyM': 'm', 'KeyH': 'h', 'KeyY': 'y',
    'KeyP': 'p', 'Slash': '/',
    'Period': '.',
    'ArrowUp': 'arrowup', 'ArrowDown': 'arrowdown',
    'ArrowLeft': 'arrowleft', 'ArrowRight': 'arrowright',
    'Digit7': '7', 'Digit9': '9',
    'Digit1': '1', 'Digit2': '2', 'Digit3': '3',
    'Digit4': '4', 'Digit5': '5', 'Digit6': '6',
    'KeyV': 'v', 'KeyB': 'b',
    'Tab': 'tab', 'Enter': 'enter',
    'Escape': 'esc'
  }

  async function toggleKeyboardControl() {
    const action = isKeyboardEnabled.value ? 'disable' : 'enable'
    
    try {
      const data = await toggleKeyboard(action)
      
      if (data.data?.success) {
        isKeyboardEnabled.value = !isKeyboardEnabled.value
      }
    } catch (error) {
      console.error('Error toggling keyboard control:', error)
    }
  }

  function isControlKey(code) {
    return controlKeys.includes(code)
  }

  async function sendKeyCommand(keyCode, action) {
    const key = keyMap[keyCode]
    if (!key) return

    try {
      await sendKeypress(key, action)
    } catch (error) {
      console.error('Error sending key command:', error)
    }
  }

  // 带修饰键的组合键（Ctrl/Cmd/Alt）属于浏览器/系统快捷键（如 Ctrl+R 刷新、
  // Ctrl+W 关页、Ctrl+T 新标签、Alt+Tab 切换），一律放行，不拦截、不发送机器人指令
  function hasModifier(event) {
    return event.ctrlKey || event.metaKey || event.altKey
  }

  function handleKeyDown(event) {
    // 组合键直接放行，保证浏览器原生快捷键可用
    if (hasModifier(event)) return

    // 仅在键盘控制已启用时，才拦截单键控制键并发送指令
    if (!isKeyboardEnabled.value) return
    if (!isControlKey(event.code)) return

    // 避免操作系统默认行为（如方向键滚动、Tab 跳焦、空格等）干扰机器人控制
    event.preventDefault()

    if (pressedKeys.has(event.code)) return
    pressedKeys.add(event.code)
    sendKeyCommand(event.code, 'press')
  }

  function handleKeyUp(event) {
    // 组合键直接放行
    if (hasModifier(event)) return

    if (!isKeyboardEnabled.value || !isControlKey(event.code)) return

    event.preventDefault()

    if (!pressedKeys.has(event.code)) return
    pressedKeys.delete(event.code)
    sendKeyCommand(event.code, 'release')
  }

  return {
    isKeyboardEnabled,
    toggleKeyboardControl,
    handleKeyDown,
    handleKeyUp
  }
}
