<template>
  <canvas ref="canvasRef" class="vrm-canvas"></canvas>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { VRMLoaderPlugin, VRM, VRMUtils } from '@pixiv/three-vrm'
import { VRMAnimationLoaderPlugin, createVRMAnimationClip } from '@pixiv/three-vrm-animation'
// Ignore Unsubscribe
type Unsubscribe = () => void

const canvasRef = ref<HTMLCanvasElement>()

let currentVrm: VRM | null = null
let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let renderFrameId: number | null = null
let clock = new THREE.Clock()
let lookAtTarget: THREE.Object3D | null = null

let currentMixer: THREE.AnimationMixer | null = null
let currentAnimationAction: THREE.AnimationAction | null = null

const emit = defineEmits<{
  modelLoaded: []
  modelClick: [{ x: number; y: number }]
  modelRightClick: [{ x: number; y: number }]
  modelInfoChanged: [{
    name: string;
    motionGroups: Record<string, Array<{ index: number; file: string }>>;
    expressions: string[]
  }]
  modelPositionChanged: [{ x: number; y: number }]
}>()

// ─── Vitality Managers ──────────────────────────────────────────────

/**
 * 眨眼管理器：随机触发，支持开闭眼过程
 */
class VRMBlinkManager {
  private timer = 0
  private state: 'idle' | 'closing' | 'opening' = 'idle'
  private blinkWeight = 0
  private interval = 3000

  update(deltaTime: number, vrm: VRM) {
    if (!vrm.expressionManager) return

    this.timer += deltaTime * 1000

    if (this.state === 'idle') {
      if (this.timer >= this.interval) {
        this.state = 'closing'
        this.timer = 0
      }
    } else if (this.state === 'closing') {
      this.blinkWeight += deltaTime * 12 // 快速闭眼
      if (this.blinkWeight >= 1) {
        this.blinkWeight = 1
        this.state = 'opening'
      }
    } else if (this.state === 'opening') {
      this.blinkWeight -= deltaTime * 8 // 稍慢开眼
      if (this.blinkWeight <= 0) {
        this.blinkWeight = 0
        this.state = 'idle'
        this.timer = 0
        this.interval = 2000 + Math.random() * 5000 // 下次眨眼间隔
      }
    }

    vrm.expressionManager.setValue('blink', this.blinkWeight)
  }
}

const blinkManager = new VRMBlinkManager()
class VRMIdleAnimator {
  private time = 0

  setupAPose(vrm: VRM) {
    const humanoid = vrm.humanoid
    if (!humanoid) return
    
    const setRotation = (name: string, x: number, y: number, z: number) => {
      const bone = humanoid.getNormalizedBoneNode(name as any)
      if (bone) bone.rotation.set(x, y, z)
    }
    
    // 将 T-pose (伸直) 调整为自然的 A-pose (手臂微微下垂)
    setRotation('leftUpperArm', 0, 0, -1.25)
    setRotation('rightUpperArm', 0, 0, 1.25)
    // 稍微弯曲手肘，显得更有活力
    setRotation('leftLowerArm', -0.15, 0, 0.1)
    setRotation('rightLowerArm', -0.15, 0, -0.1)
    // 手腕稍微放松
    setRotation('leftHand', -0.1, 0, 0)
    setRotation('rightHand', -0.1, 0, 0)
    
    // 肩膀微收
    setRotation('leftShoulder', 0, 0, 0.05)
    setRotation('rightShoulder', 0, 0, -0.05)
  }

  update(deltaTime: number, vrm: VRM) {
    this.time += deltaTime
    const humanoid = vrm.humanoid
    if (!humanoid) return
    
    // 基础呼吸循环: 约4秒一个周期
    const breathCycle = Math.sin(this.time * 1.5)
    
    // 复合正弦波制造出细微的随机身体摇晃感 (柏林噪声的廉价替代)
    const randomSwayX = Math.sin(this.time * 0.5) * 0.01 + Math.sin(this.time * 1.1) * 0.005
    const randomSwayZ = Math.cos(this.time * 0.4) * 0.01 + Math.cos(this.time * 1.3) * 0.005

    // 分配运动到核心骨骼
    const spine = humanoid.getNormalizedBoneNode('spine')
    const chest = humanoid.getNormalizedBoneNode('chest')
    const head = humanoid.getNormalizedBoneNode('head')

    if (chest) {
      chest.rotation.x = breathCycle * 0.015 + randomSwayX
      chest.rotation.z = randomSwayZ
    }
    if (spine) {
      spine.rotation.x = breathCycle * 0.01 + randomSwayX
      spine.rotation.z = randomSwayZ
    }
    if (head) {
      // 头部进行微弱的反向补偿，保持平衡感并显得更有神采
      head.rotation.x = randomSwayX * -0.5
      head.rotation.z = randomSwayZ * -0.5
    }
    
    // 让手臂也稍微跟随呼吸和轻微摆动
    const leftUpperArm = humanoid.getNormalizedBoneNode('leftUpperArm')
    const rightUpperArm = humanoid.getNormalizedBoneNode('rightUpperArm')
    
    if (leftUpperArm) {
      leftUpperArm.rotation.z = -1.25 + breathCycle * 0.01
    }
    if (rightUpperArm) {
      rightUpperArm.rotation.z = 1.25 - breathCycle * 0.01
    }
  }
}

const idleAnimator = new VRMIdleAnimator()

// LipSync 状态与资源
let isLipSyncing = false
let lipSyncAnalyser: AnalyserNode | null = null
let lipSyncDataArray: Uint8Array | null = null
let lipSyncAudioContext: AudioContext | null = null

function updateVitality(deltaTime: number, vrm: VRM) {
  // 1. 眨眼
  blinkManager.update(deltaTime, vrm)

  // 2. 动画融合器或程序化闲置动画 (A-pose 维持、呼吸、自然摇晃)
  if (currentMixer && currentAnimationAction && currentAnimationAction.isRunning()) {
    // 如果有外部骨骼动画，则交由外部动画接管
  } else {
    idleAnimator.update(deltaTime, vrm)
  }

  // 3. 口型同步
  if (isLipSyncing && vrm.expressionManager && lipSyncAnalyser && lipSyncDataArray) {
    lipSyncAnalyser.getByteFrequencyData(lipSyncDataArray)
    let sum = 0
    for (let i = 0; i < lipSyncDataArray.length; i++) {
        sum += lipSyncDataArray[i]
    }
    const average = sum / lipSyncDataArray.length
    // 将平均频率映射到 Aa 权重 (经验值：average 0-128 -> 0-1.0)
    const aaWeight = Math.min(1.0, (average / 64) * 1.2)
    vrm.expressionManager.setValue('aa', aaWeight)
  }
}

// ─── Render Loop ───────────────────────────────────────────────────

function startRenderLoop() {
  if (renderFrameId !== null) {
    cancelAnimationFrame(renderFrameId)
  }
  
  const TARGET_FPS = 60
  const frameInterval = 1000 / TARGET_FPS
  let lastTime = performance.now()

  const renderFrame = (timestamp: number) => {
    renderFrameId = requestAnimationFrame(renderFrame)
    
    const elapsed = timestamp - lastTime
    if (elapsed >= frameInterval) {
      lastTime = timestamp - (elapsed % frameInterval)
      
      let deltaTime = clock.getDelta()
      
      // 防止因为加载卡顿导致的首帧 deltaTime 过大，使得物理系统(头发/衣服)爆炸
      if (deltaTime > 0.1) {
        deltaTime = 0.016
      }
      
      // 更新动画融合器
      if (currentMixer) {
        currentMixer.update(deltaTime)
      }

      if (currentVrm) {
        // 先手动更新活力动画
        updateVitality(deltaTime, currentVrm)
        // 再调用 VRM 更新 (处理 LookAt 和 SpringBones)
        currentVrm.update(deltaTime)
      }
      if (renderer && scene && camera) {
        renderer.render(scene, camera)
      }
    }
  }

  clock.start()
  renderFrameId = requestAnimationFrame(renderFrame)
}

function stopRenderLoop() {
  if (renderFrameId !== null) {
    cancelAnimationFrame(renderFrameId)
    renderFrameId = null
  }
}

async function loadModel(modelPath: string, initialPosition?: { x: number; y: number }) {
  if (!canvasRef.value) return

  // 1. Setup Three.js scene
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.value,
      alpha: true,
      antialias: true
    })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(window.devicePixelRatio)
    
    scene = new THREE.Scene()
    
    camera = new THREE.PerspectiveCamera(30.0, window.innerWidth / window.innerHeight, 0.1, 30.0)
    // 根据桌面宠物的视角要求，通过拉远相机来让模型看起来更小（取代直接缩放模型避免物理骨骼被破坏）
    camera.position.set(0.0, 1.0, 8.0) 

    const light = new THREE.DirectionalLight(0xffffff, 1.5)
    light.position.set(1.0, 1.0, 1.0).normalize()
    scene.add(light)
    
    renderer.outputColorSpace = THREE.SRGBColorSpace

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5)
    scene.add(ambientLight)
    
    lookAtTarget = new THREE.Object3D()
    scene.add(lookAtTarget)
  }

  // 2. Clear old VRM
  if (currentVrm) {
    scene!.remove(currentVrm.scene)
    currentVrm.scene.traverse((obj: any) => {
      if (obj.isMesh) {
        obj.geometry.dispose()
        if (obj.material.isMaterial) {
          cleanMaterial(obj.material)
        } else {
          for (const material of obj.material) cleanMaterial(material)
        }
      }
    })
    currentVrm = null
  }

  // 3. Load VRM
  const loader = new GLTFLoader()
  loader.crossOrigin = 'anonymous'

  loader.register((parser) => {
    return new VRMLoaderPlugin(parser)
  })

  try {
    console.log('[VRMCanvas] 开始加载 VRM:', modelPath)
    window.electron?.log?.info?.('[VRMCanvas] 开始加载 VRM', modelPath)
    
    const gltf = await loader.loadAsync(modelPath)
    if (!gltf) throw new Error('Failed to load VRM model (gltf is null)')
    
    const vrm = gltf.userData.vrm as VRM
    if (!vrm) throw new Error('No VRM instance found in gltf.userData')
    
    VRMUtils.removeUnnecessaryVertices(gltf.scene)
    VRMUtils.removeUnnecessaryJoints(gltf.scene)
    
    vrm.scene.traverse((obj: any) => {
      obj.frustumCulled = false
    })

    currentVrm = vrm
    scene!.add(vrm.scene)

    if (vrm.lookAt && lookAtTarget) {
      vrm.lookAt.target = lookAtTarget
      // 设置平滑追踪
      // 注意: VRMLookAt 本身没有公开的 smoothTime 属性在某些版本，但我们可以手动平滑 Target
    }
    
    // 初始化 A-pose 防止 T-pose 僵硬
    idleAnimator.setupAPose(vrm)
    
    // 加载默认动作文件，先尝试 Relax 或普通内置的
    void loadVRMA('model://motions/Relax.vrma').catch(() => {
       void loadVRMA('model://motions/VRMA_01.vrma').catch(() => {
          console.log('[VRMCanvas] 未找到默认闲置动画')
       })
    })
    
    // 注册定时随机闲置动作切换器
    startRandomMotionTimer()
    
    if (initialPosition) {
       setModelPosition(initialPosition.x, initialPosition.y)
    }

    startRenderLoop()

    emit('modelLoaded')
    
    const expressions = vrm.expressionManager?.expressions.map(e => e.expressionName) || []
    emit('modelInfoChanged', {
      name: 'VRM Model',
      motionGroups: {},
      expressions
    })
    console.log('[VRMCanvas] VRM 模型加载完毕并初始化')
  } catch(e: any) {
    console.error('[VRMCanvas] VRM load error', e)
    window.electron?.log?.error?.('[VRMCanvas] VRM load error', e.message || e, e.stack)
  }
}

function cleanMaterial(material: any) {
  material.dispose()
  if (material.map) material.map.dispose()
  if (material.lightMap) material.lightMap.dispose()
  if (material.bumpMap) material.bumpMap.dispose()
  if (material.normalMap) material.normalMap.dispose()
  if (material.specularMap) material.specularMap.dispose()
  if (material.envMap) material.envMap.dispose()
}

async function loadVRMA(vrmaUrl: string) {
  if (!currentVrm || !currentVrm.scene) return
  
  const loader = new GLTFLoader()
  loader.crossOrigin = 'anonymous'
  loader.register((parser) => new VRMAnimationLoaderPlugin(parser))
  
  const gltf = await loader.loadAsync(vrmaUrl)
  const vrmAnimations = gltf.userData.vrmAnimations
  if (vrmAnimations && vrmAnimations.length > 0) {
    const vrmAnimation = vrmAnimations[0]
    const clip = createVRMAnimationClip(vrmAnimation, currentVrm)
    
    if (!currentMixer) {
       currentMixer = new THREE.AnimationMixer(currentVrm.scene)
    }
    if (currentAnimationAction) {
       currentAnimationAction.stop()
    }
    
    // 如果想要平滑过渡可以修改为 crossFade
    currentAnimationAction = currentMixer.clipAction(clip)
    currentAnimationAction.setLoop(THREE.LoopRepeat, Infinity)
    currentAnimationAction.reset().fadeIn(0.5).play()
    
    console.log('[VRMCanvas] 成功加载并播放 VRMA 动画:', vrmaUrl)
  }
}

// 丰富的随机运动管理器
let randomMotionTimer: any = null
const possibleMotions = [
  'Blush.vrma', 'Clapping.vrma', 'Goodbye.vrma', 'Jump.vrma', 'LookAround.vrma', 
  'Relax.vrma', 'Sad.vrma', 'Sleepy.vrma', 'Surprised.vrma', 'Thinking.vrma', 
  'VRMA_01.vrma', 'VRMA_02.vrma', 'VRMA_03.vrma', 'VRMA_04.vrma', 'VRMA_05.vrma', 
  'VRMA_06.vrma', 'VRMA_07.vrma'
]

function startRandomMotionTimer() {
  if (randomMotionTimer) clearInterval(randomMotionTimer)
  
  // 每隔 20-40 秒随机触发一次其他动作
  const triggerRandomMotion = () => {
    const randomMotion = possibleMotions[Math.floor(Math.random() * possibleMotions.length)]
    console.log('[VRMCanvas] 尝试播放随机动作:', randomMotion)
    loadVRMA(`model://motions/${randomMotion}`).catch(() => {
      // 找不到就切回默认 Relax
      loadVRMA('model://motions/Relax.vrma').catch(() => {})
    })
    
    // 重新设置下一次的定时器
    const nextInterval = 20000 + Math.random() * 20000
    randomMotionTimer = setTimeout(triggerRandomMotion, nextInterval)
  }
  
  randomMotionTimer = setTimeout(triggerRandomMotion, 15000)
}

// === Interaction & Position Setup ===
let dragStartX = 0
let dragStartY = 0
let isDragging = false
let isDragStartedOnModel = false
let cursorOffsetX = 0
let cursorOffsetY = 0
const DRAG_THRESHOLD = 10

let isFullPassThroughMode = false
let dynamicPassThroughEnabled = true
let supportsDynamicPassThrough = false
let currentIgnoreMouseEvents = false
let passThroughFrameId: number | null = null
let pendingPassThroughEvent: MouseEvent | null = null
let lastPointerEvent: MouseEvent | null = null
let disposeDesktopBehaviorListener: Unsubscribe | null = null

function isPointInModel(x: number, y: number): boolean {
  if (!camera || !scene || !currentVrm || !canvasRef.value) return false
  const rect = canvasRef.value.getBoundingClientRect()
  const ndcX = (x / rect.width) * 2 - 1
  const ndcY = -(y / rect.height) * 2 + 1
  
  const raycaster = new THREE.Raycaster()
  raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera)
  const intersects = raycaster.intersectObject(currentVrm.scene, true)
  return intersects.length > 0
}

function handleMouseDown(event: MouseEvent) {
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect || !currentVrm) return

  const x = event.clientX - rect.left
  const y = event.clientY - rect.top

  const hitModel = isPointInModel(x, y)

  if (event.button === 0 && hitModel) {
    isDragging = false
    isDragStartedOnModel = true
    dragStartX = event.clientX
    dragStartY = event.clientY
    
    const pos = getModelPosition()
    if (pos) {
      cursorOffsetX = event.clientX - pos.x
      cursorOffsetY = event.clientY - pos.y
    }
    event.preventDefault()
  }
}

function handleMouseMove(event: MouseEvent) {
  if (!currentVrm) return

  if (event.buttons === 1 && isDragStartedOnModel) {
    const deltaX = event.clientX - dragStartX
    const deltaY = event.clientY - dragStartY

    if (!isDragging && Math.hypot(deltaX, deltaY) > DRAG_THRESHOLD) {
      isDragging = true
    }

    if (isDragging) {
      const newScreenX = event.clientX - cursorOffsetX
      const newScreenY = event.clientY - cursorOffsetY
      setModelPosition(newScreenX, newScreenY)
      
      emit('modelPositionChanged', { x: newScreenX, y: newScreenY })
      event.preventDefault()
    }
  }
}

function handleMouseUp(event: MouseEvent) {
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect || !currentVrm) return
  
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  
  const isHit = isPointInModel(x, y)
  
  if (!isDragging && isHit && isDragStartedOnModel) {
    event.stopPropagation()
    emit('modelClick', { x: event.clientX, y: event.clientY })
  }
  
  isDragging = false
  isDragStartedOnModel = false
}

function handleContextMenu(event: MouseEvent) {
  event.preventDefault()
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect || !currentVrm) return
  
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  
  if (isPointInModel(x, y)) {
    event.stopPropagation()
    emit('modelRightClick', { x: event.clientX, y: event.clientY })
  }
}

function handleResize() {
  if (renderer && camera) {
    renderer.setSize(window.innerWidth, window.innerHeight)
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
  }
}

// 眼神追踪目标平滑位置
const smoothedLookAtTarget = new THREE.Vector3()

function handleWindowMouseMove(event: MouseEvent) {
  if (currentVrm && lookAtTarget && camera) {
    const x = (event.clientX / window.innerWidth) * 2 - 1
    const y = -(event.clientY / window.innerHeight) * 2 + 1
    
    // 目标位置
    const targetX = x * 3
    const targetY = y * 3 + 1.2
    
    // 平滑插值 (Lerp)
    smoothedLookAtTarget.lerp(new THREE.Vector3(targetX, targetY, camera.position.z), 0.1)
    lookAtTarget.position.copy(smoothedLookAtTarget)
  }

  // Passthrough logic
  lastPointerEvent = event
  pendingPassThroughEvent = event
  if (passThroughFrameId === null) {
    passThroughFrameId = requestAnimationFrame(() => {
      passThroughFrameId = null
      const latestEvent = pendingPassThroughEvent
      pendingPassThroughEvent = null
      if (latestEvent) {
        void setMousePassthrough(shouldIgnoreMouseEvents(latestEvent))
      }
    })
  }
}

function isPointOnInteractiveUI(clientX: number, clientY: number): boolean {
  const element = document.elementFromPoint(clientX, clientY) as HTMLElement | null
  if (!element) return false

  return Boolean(
    element.closest('.bubble') ||
    element.closest('.radial-menu-container') ||
    element.closest('.input-panel-container') ||
    element.closest('.recording-toast') ||
    element.closest('.model-status-toast') ||
    element.closest('.empty-state')
  )
}

function shouldIgnoreMouseEvents(event: MouseEvent): boolean {
  if (isFullPassThroughMode) return true
  if (!dynamicPassThroughEnabled || !supportsDynamicPassThrough) return false
  if (!canvasRef.value || !currentVrm) return true
  
  if (isPointOnInteractiveUI(event.clientX, event.clientY)) return false
  
  const rect = canvasRef.value.getBoundingClientRect()
  return !isPointInModel(event.clientX - rect.left, event.clientY - rect.top)
}

async function setMousePassthrough(ignoreMouseEvents: boolean) {
  if (currentIgnoreMouseEvents === ignoreMouseEvents) return
  currentIgnoreMouseEvents = ignoreMouseEvents
  try {
    await window.electron.desktopBehavior.setMousePassthrough(ignoreMouseEvents)
  } catch (e) {}
}

async function applyDesktopBehaviorSnapshot(snapshot: any) {
  isFullPassThroughMode = snapshot.preferences.fullPassThrough
  dynamicPassThroughEnabled = snapshot.preferences.dynamicPassThrough
  if (!currentVrm || !lastPointerEvent) {
    await setMousePassthrough(false)
  } else {
    await setMousePassthrough(shouldIgnoreMouseEvents(lastPointerEvent))
  }
}

let modelScreenX = window.innerWidth / 2
let modelScreenY = window.innerHeight / 2

function setModelPosition(x: number, y: number) {
  modelScreenX = x
  modelScreenY = y
  if (!currentVrm || !camera) return
  const ndcX = (x / window.innerWidth) * 2 - 1
  const ndcY = -(y / window.innerHeight) * 2 + 1
  
  const vector = new THREE.Vector3(ndcX, ndcY, 0.5)
  vector.unproject(camera)
  const dir = vector.sub(camera.position).normalize()
  const distance = -camera.position.z / dir.z
  const pos = camera.position.clone().add(dir.multiplyScalar(distance))
  
  currentVrm.scene.position.copy(pos)
}

function getModelPosition() {
  return { x: modelScreenX, y: modelScreenY }
}

function getModelInfo() {
  return { 
    name: 'VRM Model', 
    motionGroups: {}, 
    expressions: currentVrm?.expressionManager?.expressions.map(e => e.expressionName) || [] 
  }
}

function setExpression(expName: string) {
  if (!currentVrm || !currentVrm.expressionManager) return
  // 先重置所有表情（除了眨眼和口型，由 Manager 托管的）
  currentVrm.expressionManager.expressions.forEach(exp => {
      // 这里的策略是只重置用户手动设置的非基础表情
      if (!['blink', 'aa', 'ee', 'ii', 'oo', 'uu'].includes(exp.expressionName)) {
        currentVrm!.expressionManager!.setValue(exp.expressionName, 0)
      }
  })
  currentVrm.expressionManager.setValue(expName, 1)
}

function playMotion() {}
function playRandomMotion() {
  if (!currentVrm || !currentVrm.expressionManager) return
  
  const expressions = currentVrm.expressionManager.expressions
    .map(e => e.expressionName)
    .filter(name => !['blink', 'aa', 'ee', 'ii', 'oo', 'uu', 'neutral'].includes(name.toLowerCase()))
    
  if (expressions.length === 0) return
  
  const randomExp = expressions[Math.floor(Math.random() * expressions.length)]
  setExpression(randomExp)
  
  // 3秒后恢复
  setTimeout(() => {
    if (currentVrm?.expressionManager) {
        setExpression('neutral')
    }
  }, 3000)
}
function getModelBounds() { return null }
function getModelOverlayBounds() { return null }

onMounted(async () => {
  if (canvasRef.value) {
    canvasRef.value.addEventListener('mousedown', handleMouseDown)
    canvasRef.value.addEventListener('mousemove', handleMouseMove)
    canvasRef.value.addEventListener('mouseup', handleMouseUp)
    canvasRef.value.addEventListener('contextmenu', handleContextMenu)
    window.addEventListener('mousemove', handleWindowMouseMove)
    window.addEventListener('resize', handleResize)
    
    try {
      const caps = await window.electron.window.getPlatformCapabilities()
      supportsDynamicPassThrough = caps.mousePassthroughForward
    } catch {}
    
    try {
      const snap = await window.electron.desktopBehavior.getSnapshot()
      await applyDesktopBehaviorSnapshot(snap)
    } catch {}
    
    disposeDesktopBehaviorListener = window.electron.desktopBehavior.onSnapshotChanged(snap => applyDesktopBehaviorSnapshot(snap))
  }
})

onUnmounted(() => {
  stopRenderLoop()
  if (canvasRef.value) {
    canvasRef.value.removeEventListener('mousedown', handleMouseDown)
    canvasRef.value.removeEventListener('mousemove', handleMouseMove)
    canvasRef.value.removeEventListener('mouseup', handleMouseUp)
    canvasRef.value.removeEventListener('contextmenu', handleContextMenu)
  }
  window.removeEventListener('mousemove', handleWindowMouseMove)
  window.removeEventListener('resize', handleResize)
  disposeDesktopBehaviorListener?.()
  if (renderer) renderer.dispose()
  
  // 清理音频资源
  if (lipSyncAudioContext) {
    lipSyncAudioContext.close().catch(() => {})
    lipSyncAudioContext = null
  }
})

defineExpose({
  loadModel,
  getModelInfo,
  playMotion,
  setExpression,
  playRandomMotion,
  getModelPosition,
  setModelPosition,
  getModelBounds,
  getModelOverlayBounds,
  getTextureSource: () => null,
  getTextureSources: () => [],
  startLipSync: (audioElement: HTMLAudioElement) => {
    try {
      if (!lipSyncAudioContext) {
        const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext
        lipSyncAudioContext = new AudioContextCtor()
        lipSyncAnalyser = lipSyncAudioContext.createAnalyser()
        lipSyncAnalyser.fftSize = 256
        const source = lipSyncAudioContext.createMediaElementSource(audioElement)
        source.connect(lipSyncAnalyser)
        lipSyncAnalyser.connect(lipSyncAudioContext.destination)
        lipSyncDataArray = new Uint8Array(lipSyncAnalyser.frequencyBinCount)
      }
      
      if (lipSyncAudioContext.state === 'suspended') {
        lipSyncAudioContext.resume().catch(() => {})
      }
      
      isLipSyncing = true
    } catch (err) {
      console.warn('[VRMCanvas] 启动口型同步失败:', err)
    }
  },
  stopLipSync: () => {
    isLipSyncing = false
    if (currentVrm?.expressionManager) {
      currentVrm.expressionManager.setValue('aa', 0)
    }
  }
})
</script>
<style scoped>
.vrm-canvas {
  width: 100%;
  height: 100%;
  display: block;
  pointer-events: auto;
}
</style>
