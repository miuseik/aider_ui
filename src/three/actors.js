/**
 * 演员（可选模型）注册表与加载。
 *
 * 纯 three.js 模块，不依赖 Vue：加载进度通过 onProgress 回调上报，由调用方决定怎么显示。
 */
import * as THREE from 'three'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import URDFLoader from 'urdf-loader'
import { LOCAL_ROBOT_BASE } from '../api/motion'
import { BONE_MAP_MIXAMO, BONE_MAP_DAZ, whenManagerIdle } from './motionRetarget'

/** 可选演员 key（与 URL 参数 ?actor= 的取值一致） */
export const ACTOR_KEYS = ['skeleton', 'xbot', 'april', 'aider']

/** 可选演员：能重定向人体动作的模型，以及机器人本体 */
export const ACTORS = {
  xbot: { url: '/action/Xbot.glb', map: BONE_MAP_MIXAMO },
  april: { url: '/action/April Swimsuit Character/April Swimsuit.fbx', map: BONE_MAP_DAZ },
  // Aider 本体是 URDF（机器人关节，不是人体骨骼），没有对应骨骼可重定向，只作尺寸/形态参照
  aider: { url: `${LOCAL_ROBOT_BASE}/urdf/aider_pro.SLDASM.urdf`, urdf: true }
}

/**
 * 机器人类型注册表：页面上"机器人"下拉的取值。
 * 以后每加一个机器人：在 ACTORS 里加一条 urdf 条目 + 在这里登记即可，
 * 演员的关节数由各类型自己的关节映射表（aiderJoints.js 的 ARM_JOINTS）决定。
 */
export const ROBOT_TYPES = [{ value: 'aider', label: 'Aider' }]

/** 演员模型缓存（避免重复加载） */
const actorCache = {}

/** 该演员是否已经加载过（用于提示"首次加载较慢"） */
export function hasCachedActor(key) {
  return !!actorCache[key]
}

/**
 * 加载演员模型，返回一份可安全放进场景的克隆。
 * @param {string} key ACTORS 的 key
 * @param {(msg: string) => void} [onProgress] 加载进度文案回调
 */
export async function loadActorModel(key, onProgress) {
  if (actorCache[key]) return cloneSkinned(actorCache[key])
  const actorCfg = ACTORS[key]
  if (!actorCfg) return null
  let model
  if (actorCfg.urdf) {
    const loader = new URDFLoader()
    // URDF 里写的是 package://aider_pro01/meshes/xxx.STL
    // ⚠️ 值不要带尾斜杠：loader 内部是 packages[pkg] + '/' + relPath，带了会拼成 //meshes
    loader.packages = { aider_pro01: LOCAL_ROBOT_BASE }
    // 这些 STL 加起来 100MB+，解析要几十秒，把进度显示出来，不然看着像坏了
    loader.manager.onProgress = (_url, loaded, total) => {
      onProgress?.(`正在加载 Aider 模型…（${loaded}/${total} 个部件）`)
    }
    const robot = await loader.loadAsync(actorCfg.url)
    await whenManagerIdle(loader.manager)
    // URDF 是 Z-up、three 是 Y-up：外面套一层绕 X 轴 -90° 的组（关节都在 robot.joints 里）
    model = new THREE.Group()
    model.quaternion.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2)
    model.add(robot)
    // ⚠️ 千万别把 robot 塞进 userData：three 的 Object3D.copy 对 userData 做
    // JSON.parse(JSON.stringify(...))，克隆时会把整个机器人序列化 → 直接报
    // "Invalid string length"。要拿关节以后从场景里 traverse 找。
  } else if (/\.fbx$/i.test(actorCfg.url)) {
    model = await new FBXLoader().loadAsync(actorCfg.url)
  } else {
    const gltf = await new GLTFLoader().loadAsync(actorCfg.url)
    model = gltf.scene || gltf.scenes?.[0]
  }
  if (!model) return null
  model.userData.keepInCache = true
  actorCache[key] = model
  // 带蒙皮的模型必须用 SkeletonUtils.clone，普通 clone 会共享 skeleton 导致蒙皮错乱
  return cloneSkinned(model)
}
