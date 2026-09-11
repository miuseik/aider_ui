/**
 * 关节角序列播放器。
 *
 * 消费 Python 侧 IK 解算的逐帧关节角（度，arm1..8 × 双臂），
 * 直接驱动 URDF 模型关节 —— 数据就是真机指令本身，前端不做任何映射，
 * 预览与真机/仿真天然一致。
 *
 * 与 three 的 AnimationClip 播放并行使用（火柴人播 BVH clip，
 * 机器人播本序列），两者按相同 dt 推进、由外部 seek 同步。
 */
import * as THREE from 'three'

/**
 * @param {object} opts
 * @param {THREE.Object3D} opts.model 已放入场景的机器人模型（内含 URDF joints）
 * @param {string[]} opts.names 关节名列表（与 angles 每行顺序对应）
 * @param {number[][]} opts.angles 逐帧关节角（度）
 * @param {number} opts.frameTime 帧间隔（秒）
 */
export function createJointPlayer({ model, names, angles, frameTime }) {
  // 从模型里收集 URDF 关节（含名字 → joint 对象）
  const jmap = {}
  model.traverse((o) => {
    if (o.joints) {
      for (const [n, j] of Object.entries(o.joints)) jmap[n] = j
    }
  })

  const nFrames = angles.length
  const duration = nFrames * frameTime
  const state = { time: 0, playing: false, frame: 0 }

  function apply(frame) {
    const row = angles[frame]
    if (!row) return
    for (let i = 0; i < names.length; i++) {
      const j = jmap[names[i]]
      if (j) j.setJointValue(THREE.MathUtils.degToRad(row[i]))
    }
  }

  apply(0)

  return {
    duration,
    nFrames,
    /** 按 dt 推进并驱动关节（每帧由渲染循环调用） */
    update(dt) {
      if (!state.playing) return
      state.time = Math.min(state.time + dt, duration)
      state.frame = Math.min(nFrames - 1, Math.floor(state.time / frameTime))
      apply(state.frame)
    },
    /** 跳到指定时间（秒），立即摆出对应姿势 */
    seek(time) {
      state.time = Math.max(0, Math.min(time, duration))
      state.frame = Math.min(nFrames - 1, Math.floor(state.time / frameTime))
      apply(state.frame)
    },
    play() { state.playing = true },
    pause() { state.playing = false },
    get time() { return state.time },
    dispose() { state.playing = false },
  }
}
