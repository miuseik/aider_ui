/**
 * Aider 关节映射与 URDF 显示辅助。
 *
 * ⚠️ 动作数据的解析/计算（骨架姿态、关节角序列）全部在 terminal 侧完成
 * （scripts/bvh_play.py），经 WS 送达；UI 只做可视化与交互 —— 本文件不跑任何
 * IK/解析/裁剪，只保留：
 *   ① BVH 骨骼 ↔ Aider 关节的对应关系表（供 hint 显示）
 *   ② 关节限位兜底表（运行时优先用 server 的 servo_ids.yaml）
 *   ③ URDF 关节限位放宽 / robot 节点查找（three.js 显示需要）
 *
 * 纯 three.js 模块，不依赖 Vue。
 */

/**
 * BVH 源骨骼 → Aider 关节映射。
 *
 * 语义与限位的权威来源（不要凭外观猜）：
 *   - 关节语义：aider_terminal/src/robots/aider/adapter.py 头部注释
 *       arm1=肩pan  arm2=肩lift  arm3=肘屈伸  arm4=前臂旋转
 *       arm5=腕roll  arm6=腕pitch  arm7=腕yaw  arm8=夹爪(arm12=-arm8 联动)
 *   - 真实限位：aider_server/sql/servo_ids.yaml 的 min_angle/max_angle（度），
 *     左右互为镜像（如左 arm2=[-3,90]、右 arm2=[-90,3]），证实"右侧取反"符号规则。
 * 因此对应关系是：肩→arm1+arm2、肘→arm3+arm4、腕→arm5+arm6+arm7。
 *
 * ⚠️ key 必须用 indexBones 的归一化名（小写、无符号），写 lShldr 会一个都匹配不上
 */
export const ARM_JOINTS = {
  lshldr: ['left_arm1', 'left_arm2'],
  lforearm: ['left_arm3', 'left_arm4'],
  lhand: ['left_arm5', 'left_arm6', 'left_arm7'],
  rshldr: ['right_arm1', 'right_arm2'],
  rforearm: ['right_arm3', 'right_arm4'],
  rhand: ['right_arm5', 'right_arm6', 'right_arm7']
}

/**
 * 内置限位兜底表（度），摘自 2026-09-11 时的 servo_ids.yaml。
 * 运行时优先用 /api/get-servo-ids 拉取的最新值（见 relaxJointLimits 的 limits 参数），
 * 后端不在时才落到这张表 —— 所以 yaml 改了限位后这张表过期也不影响正确性。
 */
export const JOINT_LIMITS_DEG = {
  left_arm1: [-135, 60], left_arm2: [-3, 90], left_arm3: [-54, 91], left_arm4: [-1, 136],
  left_arm5: [-90, 90], left_arm6: [-30, 30], left_arm7: [-30, 30],
  right_arm1: [-60, 136], right_arm2: [-90, 3], right_arm3: [-90, 54], right_arm4: [-136, 1],
  right_arm5: [-90, 90], right_arm6: [-30, 30], right_arm7: [-30, 30]
}

/** 该类型机器人映射到的关节总数（火柴人演员显示的"关节数"与此一致） */
export const ARM_JOINT_COUNT = Object.values(ARM_JOINTS).reduce((n, a) => n + a.length, 0)

const DEG2RAD = Math.PI / 180

/**
 * 把真实限位写进关节（URDF 里的 lower=upper=0 会让 setJointValue 永远钳在 0）。
 * @param {object} robot URDF robot 节点
 * @param {Record<string, [number, number]>} [limits] 关节限位表（度），
 *   一般传 /api/get-servo-ids 拉到的最新值；不传则用内置兜底表。
 */
export function relaxJointLimits(robot, limits = JOINT_LIMITS_DEG) {
  for (const [name, j] of Object.entries(robot.joints || {})) {
    const lim = limits[name]
    if (lim) {
      j.limit = { lower: lim[0] * DEG2RAD, upper: lim[1] * DEG2RAD }
    } else if (j.jointType === 'revolute' || j.jointType === 'prismatic' || j.jointType === 'continuous') {
      j.limit = { lower: -Math.PI * 2, upper: Math.PI * 2 }
    }
  }
}

/** 从模型里找出 URDF robot 节点（它身上挂着 joints 表） */
export function findUrdfRobot(root) {
  let robot = null
  root.traverse((o) => {
    if (!robot && o.joints && Object.keys(o.joints).length) robot = o
  })
  return robot
}
