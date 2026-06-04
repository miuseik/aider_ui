import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { toggleKeyboard, sendKeypress } from '@/api'

export function useKeyboard(isRobotEngaged, showConnectionWarning) {
  const isKeyboardEnabled = ref(false)
  const pressedKeys = new Set()

  const controlKeys = [
    'KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyQ', 'KeyE',
    'KeyZ', 'KeyX', 'KeyR', 'KeyT', 'KeyC',
    'KeyI', 'KeyK', 'KeyJ', 'KeyL', 'KeyU', 'KeyO',
    'KeyN', 'KeyM', 'KeyH', 'KeyY', 'Period',
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6',
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

  function handleKeyDown(event) {
    if (isControlKey(event.code)) {
      event.preventDefault()
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
