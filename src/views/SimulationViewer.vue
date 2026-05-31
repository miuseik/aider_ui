<template>
  <Teleport to="body">
    <div v-if="visible" class="simulation-modal-overlay" @click.self="closeModal">
      <div class="simulation-modal">
        <!-- 标题栏 -->
        <div class="modal-header">
          <h3>🤖 AlohaMini 仿真</h3>
          <button class="close-btn" @click="closeModal">✕</button>
        </div>
        
        <!-- 3D 画布容器 -->
        <div ref="container" class="canvas-container"></div>
        
        <!-- 状态面板 -->
        <div class="status-panel">
          <div v-if="isConnected" class="status-connected">
            ✅ WebSocket 已连接
          </div>
          <div v-else class="status-disconnected">
            ❌ 未连接
          </div>
          <div class="joint-info" v-if="jointStates.length > 0">
            <p>关节数量: {{ jointStates.length }}</p>
            <p>最后更新: {{ lastUpdate }}</p>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import URDFLoader from 'urdf-loader'
import { wsClient } from '../utils/websocket.js'

// ========== Props ==========
const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close'])

// ========== 响应式变量 ==========
const container = ref(null)
const isConnected = ref(false)
const jointStates = ref([])
const lastUpdate = ref('')

// ========== Three.js 相关 ==========
let scene, camera, renderer, controls
let robot = null
let animationId = null
let rootGroup = null  // ✅ 根容器（用于坐标系统一）

// ✅ 底盘状态（与 PyBullet 保持一致）
let basePosition = { x: 0, y: 0, z: 0.45 }  // ✅ 底盘位置（Z=0.45m，与 URDF 高度一致）
let baseYaw = 0  // 底盘朝向（弧度）
const DT = 0.05  // 时间步长（与 PyBullet visualizer.py L412 一致）
const URDF_HEIGHT_OFFSET = 0.45  // URDF 升降轴基础偏移（与 visualizer.py L380 一致）

// ========== WebSocket 消息处理 ==========
let unregisterHandler = null
let wheelRotation = { wheel1: 0, wheel2: 0, wheel3: 0 }  // ✅ 累积轮子旋转角度

const handleMessage = (data) => {
  // 处理仿真更新消息
  if (data.type === 'simulation_update' && data.robot_type === 'aloha_mini') {
    updateRobotJoints(data.joints)
    
    // ✅ 1. 更新升降轴高度（与 visualizer.py L370-392 一致）
    if (data.lift_height !== undefined && robot) {
      const verticalJoint = robot.joints['vertical_move']
      if (verticalJoint) {
        // URDF 中 vertical_move 关节的基础偏移量
        // joint_value = height - URDF_HEIGHT_OFFSET
        const jointValue = data.lift_height - URDF_HEIGHT_OFFSET
        verticalJoint.setJointValue(jointValue)
      }
    }
    
    // ✅ 2. 更新底盘运动（与 visualizer.py L394-430 一致）
    if (data.base && robot) {
      const vx = data.base.x || 0
      const vy = data.base.y || 0
      const vTheta = data.base.theta || 0
      
      // 计算新朝向
      baseYaw += vTheta * DT
      
      // 将车身坐标系速度转换到世界坐标系（考虑当前朝向）
      const cosYaw = Math.cos(baseYaw)
      const sinYaw = Math.sin(baseYaw)
      
      // vx: 车身前后 → world_y
      // vy: 车身左右 → world_x
      const deltaX = (vy * cosYaw - vx * sinYaw) * DT
      const deltaY = (vx * cosYaw + vy * sinYaw) * DT
      
      // ✅ 将 PyBullet 的世界坐标直接应用到 Three.js（根容器已处理坐标系统一）
      // 现在 Three.js 的坐标系与 PyBullet 完全一致：
      // X = 左右, Y = 前后, Z = 上下
      basePosition.x += deltaX  // 左右
      basePosition.y += deltaY  // 前后
      // basePosition.z 保持 0.45m 不变（高度）
      
      // ✅ 移动整个机器人模型（现在坐标系已与 PyBullet 一致）
      // basePosition.x = 左右
      // basePosition.y = 前后
      // basePosition.z = 上下（高度）
      robot.position.set(basePosition.x, basePosition.y, basePosition.z)
      
      // ✅ 应用旋转（只需要设置 Z 轴 yaw，因为根容器已处理坐标系统一）
      robot.rotation.z = baseYaw
      
      // ✅ 3. 旋转轮子（根据速度累积角度）
      const baseSpeed = Math.sqrt(vx ** 2 + vy ** 2 + vTheta ** 2)
      if (baseSpeed > 0.01) {
        ;['wheel1', 'wheel2', 'wheel3'].forEach(wheelName => {
          const wheel = robot.joints[wheelName]
          if (wheel) {
            wheelRotation[wheelName] += baseSpeed * 0.2
            wheel.setJointValue(wheelRotation[wheelName])
          }
        })
      }
    }
    
    isConnected.value = true
    lastUpdate.value = new Date().toLocaleTimeString()
  }
}

// ========== 更新机器人关节 ==========
const updateRobotJoints = (joints) => {
  if (!robot) return
  
  jointStates.value = Object.keys(joints)
  
  // 遍历所有关节并设置角度
  for (const [jointName, angle] of Object.entries(joints)) {
    if (robot.joints[jointName]) {
      robot.joints[jointName].setJointValue(angle)
    }
  }
}

// ========== 初始化 Three.js 场景 ==========
const initScene = () => {
  if (!container.value) return
  
  // 创建场景
  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x1a1a2e)
  
  // ✅ 创建根容器并旋转，使 Three.js 坐标系与 PyBullet 一致
  // PyBullet: X=左右, Y=前后, Z=上下
  // Three.js:  X=左右, Y=上下, Z=前后
  // 旋转：将 Three.js 的 Y轴旋转到 Z轴方向
  rootGroup = new THREE.Group()
  rootGroup.rotation.x = -Math.PI / 2  // 绕 X 轴旋转 -90°
  scene.add(rootGroup)
  
  // 创建相机
  const width = container.value.clientWidth
  const height = container.value.clientHeight
  camera = new THREE.PerspectiveCamera(60, width / height, 0.01, 100)
  camera.position.set(1.5, 1.0, 1.5)
  
  // 创建渲染器
  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(width, height)
  renderer.shadowMap.enabled = true
  container.value.appendChild(renderer.domElement)
  
  // 添加轨道控制器
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  
  // 添加光源
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
  scene.add(ambientLight)
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
  directionalLight.position.set(5, 10, 7)
  directionalLight.castShadow = true
  scene.add(directionalLight)
  
  // 添加网格地面（添加到根容器，自动匹配 PyBullet 坐标系）
  // GridHelper 默认在 XZ 平面，旋转后需要在 XY 平面
  const gridHelper = new THREE.GridHelper(5, 50, 0x444444, 0x222222)
  gridHelper.rotation.x = Math.PI / 2  // 旋转 90° 使其水平
  rootGroup.add(gridHelper)
  
  // 加载 URDF 模型
  loadURDF()
  
  // 开始动画循环
  animate()
}

// ========== 加载 URDF ==========
const loadURDF = () => {
  const loader = new URDFLoader()
  
  // 设置包路径映射（URDF 中的 package:// 路径）
  loader.packages = {
    '': '/URDF/aloha/'  // 空字符串表示默认路径
  }
  
  // 加载 Aloha URDF
  loader.load('/URDF/aloha/Aloha.urdf', (loadedRobot) => {
    robot = loadedRobot
    
    // ✅ 直接添加到根容器，无需手动旋转
    // 根容器已经处理了坐标系统一
    robot.position.set(0, 0, 0.45)  // Z=0.45m 是高度
    
    rootGroup.add(robot)
  }, 
  undefined,
  (error) => {
    console.error('❌ URDF 加载失败:', error)
  })
}

// ========== 动画循环 ==========
const animate = () => {
  animationId = requestAnimationFrame(animate)
  
  if (controls) {
    controls.update()
  }
  
  if (renderer && scene && camera) {
    renderer.render(scene, camera)
  }
}

// ========== 关闭弹窗 ==========
const closeModal = () => {
  emit('close')
}

// ========== 生命周期钩子 ==========
onMounted(() => {
  // ✅ 使用 wsClient.onMessage() 注册回调（正确的方式）
  unregisterHandler = wsClient.onMessage(handleMessage)
})

onUnmounted(() => {
  // 清理动画循环
  if (animationId) {
    cancelAnimationFrame(animationId)
  }
  
  // 清理 Three.js 资源
  if (renderer) {
    renderer.dispose()
  }
  
  // ✅ 取消注册消息处理器
  if (unregisterHandler) {
    unregisterHandler()
  }
})

// ========== 监听 visible 变化 ==========
watch(() => props.visible, (newVal) => {
  if (newVal && !scene) {
    // 首次打开时初始化场景
    setTimeout(() => {
      initScene()
    }, 100)
  } else if (!newVal) {
    // 关闭时暂停渲染（可选）
    if (animationId) {
      cancelAnimationFrame(animationId)
      animationId = null
    }
  }
})
</script>

<style scoped>
/* 遮罩层 */
.simulation-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(5px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

/* 弹窗主体 */
.simulation-modal {
  width: 80vw;
  height: 70vh;
  min-width: 800px;
  min-height: 600px;
  background: #0f0f1e;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(0, 255, 136, 0.3);
}

/* 标题栏 */
.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  background: rgba(26, 26, 46, 0.95);
  border-bottom: 1px solid rgba(0, 255, 136, 0.2);
}

.modal-header h3 {
  margin: 0;
  color: #00ff88;
  font-size: 18px;
  text-shadow: 0 0 10px rgba(0, 255, 136, 0.5);
}

.close-btn {
  background: transparent;
  border: none;
  color: white;
  font-size: 24px;
  cursor: pointer;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.3s;
}

.close-btn:hover {
  background: rgba(255, 68, 68, 0.2);
  color: #ff4444;
}

.canvas-container {
  flex: 1;
  width: 100%;
  position: relative;
}

.status-panel {
  position: absolute;
  top: 20px;
  left: 20px;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 20px;
  border-radius: 10px;
  min-width: 200px;
  z-index: 100;
}

.status-panel h3 {
  margin: 0 0 10px 0;
  color: #00ff88;
}

.status-connected {
  color: #00ff88;
  margin-bottom: 10px;
}

.status-disconnected {
  color: #ff4444;
  margin-bottom: 10px;
}

.joint-info {
  font-size: 14px;
  color: #cccccc;
}

.joint-info p {
  margin: 5px 0;
}
</style>
