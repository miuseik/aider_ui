import { ref } from 'vue'

export function useKeyboard(isRobotEngaged, showConnectionWarning, simulationMode) {
  const isKeyboardEnabled = ref(false)
  const pressedKeys = new Set()

  const controlKeys = [
    'KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyQ', 'KeyE',
    'KeyZ', 'KeyX', 'KeyR', 'KeyT', 'KeyC',
    'KeyI', 'KeyK', 'KeyJ', 'KeyL', 'KeyU', 'KeyO',
    'KeyN', 'KeyM', 'KeyH', 'KeyY', 'Period',
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'Digit7', 'Digit9', 'KeyV', 'KeyB',
    'Tab', 'Enter', 'Escape'
  ]

  const keyMap = {
    'KeyW': 'w', 'KeyS': 's', 'KeyA': 'a', 'KeyD': 'd',
    'KeyQ': 'q', 'KeyE': 'e',
    'KeyZ': 'z', 'KeyX': 'x', 'KeyR': 'r', 'KeyT': 't',
    'KeyC': 'c',
    'KeyI': 'i', 'KeyK': 'k', 'KeyJ': 'j', 'KeyL': 'l',
    'KeyU': 'u', 'KeyO': 'o',
    'KeyN': 'n', 'KeyM': 'm', 'KeyH': 'h', 'KeyY': 'y',
    'Period': '.',
    'ArrowUp': 'arrowup', 'ArrowDown': 'arrowdown',
    'ArrowLeft': 'arrowleft', 'ArrowRight': 'arrowright',
    'Digit7': '7', 'Digit9': '9',
    'KeyV': 'v', 'KeyB': 'b',
    'Tab': 'tab', 'Enter': 'enter',
    'Escape': 'esc'
  }

  async function toggleKeyboardControl() {
    const action = isKeyboardEnabled.value ? 'disable' : 'enable'
    
    try {
      const response = await fetch('/api/keyboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      })
      const data = await response.json()
      
      if (data.success) {
        isKeyboardEnabled.value = !isKeyboardEnabled.value
      } else {
        alert('切换键盘控制失败')
      }
    } catch (error) {
      console.error('Error toggling keyboard control:', error)
      alert('与服务器通信错误')
    }
  }

  function isControlKey(code) {
    return controlKeys.includes(code)
  }

  async function sendKeyCommand(keyCode, action) {
    const key = keyMap[keyCode]
    if (!key) return

    try {
      await fetch('/api/keypress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, action })
      })
    } catch (error) {
      console.error('Error sending key command:', error)
    }
  }

  function handleKeyDown(event) {
    if (isControlKey(event.code)) {
      event.preventDefault()
    }

    // 仿真模式下不检查真机连接
    if (!simulationMode.value && isControlKey(event.code) && !isRobotEngaged.value) {
      showConnectionWarning()
      return
    }

    if (!isKeyboardEnabled.value || pressedKeys.has(event.code)) return

    if (isControlKey(event.code)) {
      pressedKeys.add(event.code)
      sendKeyCommand(event.code, 'press')
    }
  }

  function handleKeyUp(event) {
    if (isControlKey(event.code)) {
      event.preventDefault()
    }
    
    if (!isKeyboardEnabled.value || !pressedKeys.has(event.code)) return
    
    if (isControlKey(event.code)) {
      pressedKeys.delete(event.code)
      sendKeyCommand(event.code, 'release')
    }
  }

  return {
    isKeyboardEnabled,
    toggleKeyboardControl,
    handleKeyDown,
    handleKeyUp
  }
}
