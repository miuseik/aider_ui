// urdf-loader 类型声明
declare module 'urdf-loader' {
  import * as THREE from 'three'
  
  export interface URDFJoint {
    isURDFJoint: boolean
    jointName: string
    jointIndex: number
    jointType: string
    limit?: {
      lower: number
      upper: number
    }
    setJointValue(value: number): void
    setMotorSpeed(speed: number): void
  }
  
  export interface URDFRobot extends THREE.Object3D {
    joints: {
      [key: string]: URDFJoint
    }
  }
  
  export default class URDFLoader {
    constructor(three: typeof THREE)
    
    manager: THREE.LoadingManager
    packages: { [key: string]: string }
    
    load(
      url: string,
      onLoad: (robot: URDFRobot) => void,
      onProgress?: (progress: any) => void,
      onError?: (error: any) => void
    ): void
    
    loadAsync(url: string): Promise<URDFRobot>
  }
}
