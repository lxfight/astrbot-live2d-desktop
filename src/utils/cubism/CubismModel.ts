/**
 * Live2D Cubism Model 类
 * 基于官方 Cubism SDK for Web 实现
 */

// Cubism SDK 类型定义（临时类型，后续会替换为真实导入）
declare module 'live2dcubismcore' {
  export class CubismFramework {
    static startUp(): void;
    static initialize(): void;
    static dispose(): void;
  }
  
  export class CubismUserModel {
    constructor();
    loadModel(buffer: ArrayBuffer): void;
    createRenderer(width: number, height: number): void;
    getRenderer(): any;
    update(): void;
    getModel(): any;
    isHit(drawableId: number, x: number, y: number): boolean;
  }
  
  export class CubismModelSettingJson {
    constructor(buffer: ArrayBuffer, size: number);
    getModelFileName(): string;
    getTextureCount(): number;
    getTextureFileName(index: number): string;
    getMotionGroupCount(): number;
    getMotionGroupName(index: number): string;
    getMotionCount(groupName: string): number;
    getMotionFileName(groupName: string, index: number): string;
    getExpressionCount(): number;
    getExpressionFileName(index: number): string;
  }
}

// 临时类型定义，用于开发
interface CubismModelInfo {
  name: string;
  motionGroups: Record<string, Array<{ index: number; file: string }>>;
  expressions: string[];
}

interface ModelBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

export class CubismModel {
  // WebGL 上下文
  private gl: WebGLRenderingContext | null = null;
  private canvas: HTMLCanvasElement | null = null;
  
  // Cubism SDK 对象
  private userModel: any = null; // CubismUserModel
  private modelSetting: any = null; // CubismModelSettingJson
  
  // 状态
  private modelPath: string = '';
  private isInitialized: boolean = false;
  private isUpdating: boolean = false;
  
  // 口型同步相关
  private lipSyncContext: AudioContext | null = null;
  private lipSyncAnalyser: AnalyserNode | null = null;
  private lipSyncSource: MediaElementAudioSourceNode | null = null;
  private lipSyncAudioElement: HTMLAudioElement | null = null;
  private lipSyncFrameId: number | null = null;
  private lipSyncEndedHandler: (() => void) | null = null;
  private lipSyncValue: number = 0;
  
  // 眼睛注视相关
  private dragX: number = 0;
  private dragY: number = 0;
  
  // 动画相关
  private lastUpdateTime: number = 0;
  private deltaTime: number = 0;
  
  constructor() {
    console.log('[CubismModel] 构造函数');
  }
  
  /**
   * 加载模型
   */
  static async from(modelPath: string): Promise<CubismModel> {
    const instance = new CubismModel();
    await instance.load(modelPath);
    return instance;
  }
  
  /**
   * 加载模型文件
   */
  async load(modelPath: string): Promise<void> {
    this.modelPath = modelPath;
    
    try {
      console.log('[CubismModel] 开始加载模型:', modelPath);
      
      // TODO: 实现模型加载逻辑
      // 1. 加载 model3.json 文件
      // 2. 创建 CubismModelSettingJson
      // 3. 加载 moc3 文件
      // 4. 创建 CubismUserModel
      // 5. 加载纹理
      
      // 临时模拟加载
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log('[CubismModel] 模型加载完成:', modelPath);
    } catch (error) {
      console.error('[CubismModel] 模型加载失败:', error);
      throw error;
    }
  }
  
  /**
   * 初始化 WebGL
   */
  initWebGL(canvas: HTMLCanvasElement, initialPosition?: { x: number; y: number }): void {
    console.log('[CubismModel] 初始化 WebGL');
    
    this.canvas = canvas;
    
    // 获取 WebGL 上下文
    this.gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!this.gl) {
      throw new Error('无法获取 WebGL 上下文');
    }
    
    // TODO: 初始化 Cubism SDK
    // 1. 调用 CubismFramework.startUp()
    // 2. 调用 CubismFramework.initialize()
    // 3. 创建 CubismUserModel
    // 4. 创建渲染器
    
    this.isInitialized = true;
    console.log('[CubismModel] WebGL 初始化完成');
  }
  
  /**
   * 更新模型
   */
  update(): void {
    if (!this.isInitialized || !this.userModel) return;
    
    const now = performance.now() / 1000; // 转换为秒
    this.deltaTime = now - this.lastUpdateTime;
    this.lastUpdateTime = now;
    
    // TODO: 更新模型状态
    // 1. 更新动作
    // 2. 更新表情
    // 3. 更新眼睛注视
    // 4. 更新口型同步
    // 5. 更新物理
    // 6. 更新呼吸
    
    // this.userModel.update();
  }
  
  /**
   * 渲染模型
   */
  render(): void {
    if (!this.isInitialized || !this.gl || !this.userModel) return;
    
    // TODO: 渲染模型
    // 1. 清除画布
    // 2. 设置视口
    // 3. 渲染模型
    
    // 清除画布（透明背景）
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  }
  
  /**
   * 让模型注视指定屏幕坐标
   */
  focus(x: number, y: number): void {
    if (!this.canvas) return;
    
    // 转换为标准化坐标 (-1 到 1)
    this.dragX = (x / this.canvas.width) * 2 - 1;
    this.dragY = (y / this.canvas.height) * 2 - 1;
    
    // TODO: 更新模型的眼睛注视参数
  }
  
  /**
   * 播放动作
   */
  motion(group: string, index: number = 0, priority?: number): void {
    console.log(`[CubismModel] 播放动作: ${group}[${index}]`);
    
    // TODO: 实现动作播放逻辑
  }
  
  /**
   * 设置表情
   */
  expression(expressionId: string | number): void {
    console.log(`[CubismModel] 设置表情: ${expressionId}`);
    
    // TODO: 实现表情切换逻辑
  }
  
  /**
   * 开始口型同步
   */
  startLipSync(audioElement: HTMLAudioElement): void {
    console.log('[CubismModel] 开始口型同步');
    
    this.stopLipSync();
    
    try {
      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextCtor) {
        console.warn('[CubismModel] 当前环境不支持 AudioContext');
        return;
      }
      
      if (!this.lipSyncContext || this.lipSyncAudioElement !== audioElement) {
        this.destroyLipSyncPipeline();
        this.lipSyncContext = new AudioContextCtor();
        this.lipSyncAnalyser = this.lipSyncContext.createAnalyser();
        this.lipSyncAnalyser.fftSize = 256;
        this.lipSyncSource = this.lipSyncContext.createMediaElementSource(audioElement);
        this.lipSyncSource.connect(this.lipSyncAnalyser);
        this.lipSyncAnalyser.connect(this.lipSyncContext.destination);
        this.lipSyncAudioElement = audioElement;
      }
      
      if (this.lipSyncContext.state === 'suspended') {
        void this.lipSyncContext.resume().catch(() => {
          // ignore resume failure
        });
      }
      
      const analyser = this.lipSyncAnalyser;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      // 口型同步动画循环
      const updateLipSync = () => {
        if (audioElement.paused || audioElement.ended) {
          this.lipSyncValue = 0;
          return;
        }
        
        // 获取音频频率数据
        analyser.getByteFrequencyData(dataArray);
        
        // 计算平均音量（0-255）
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        
        // 将音量映射到口型开合度（0-1）
        this.lipSyncValue = Math.min(average / 128, 1.0);
        
        // 继续下一帧
        this.lipSyncFrameId = requestAnimationFrame(updateLipSync);
      };
      
      updateLipSync();
      
      this.lipSyncEndedHandler = () => {
        this.stopLipSync();
      };
      audioElement.addEventListener('ended', this.lipSyncEndedHandler);
      
    } catch (error) {
      console.error('[CubismModel] 口型同步初始化失败:', error);
    }
  }
  
  /**
   * 停止口型同步
   */
  stopLipSync(): void {
    if (this.lipSyncFrameId !== null) {
      cancelAnimationFrame(this.lipSyncFrameId);
      this.lipSyncFrameId = null;
    }
    
    if (this.lipSyncAudioElement && this.lipSyncEndedHandler) {
      this.lipSyncAudioElement.removeEventListener('ended', this.lipSyncEndedHandler);
    }
    
    this.lipSyncEndedHandler = null;
    this.lipSyncValue = 0;
  }
  
  private destroyLipSyncPipeline(): void {
    this.stopLipSync();
    
    if (this.lipSyncSource) {
      try {
        this.lipSyncSource.disconnect();
      } catch {
        // ignore disconnect failure
      }
      this.lipSyncSource = null;
    }
    
    if (this.lipSyncAnalyser) {
      try {
        this.lipSyncAnalyser.disconnect();
      } catch {
        // ignore disconnect failure
      }
      this.lipSyncAnalyser = null;
    }
    
    if (this.lipSyncContext) {
      void this.lipSyncContext.close().catch(() => {
        // ignore close failure
      });
      this.lipSyncContext = null;
    }
    
    this.lipSyncAudioElement = null;
  }
  
  /**
   * 获取模型信息
   */
  getModelInfo(): CubismModelInfo {
    // TODO: 实现模型信息获取逻辑
    return {
      name: this.modelPath.split('/').filter(Boolean).pop()?.replace(/\.(model|model3)\.json$/, '') || 'unknown',
      motionGroups: {},
      expressions: []
    };
  }
  
  /**
   * 获取模型边界
   */
  getModelBounds(): ModelBounds | null {
    if (!this.canvas) return null;
    
    // TODO: 计算模型实际边界
    const width = 200; // 临时值
    const height = 200; // 临时值
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    
    return {
      left: centerX - width / 2,
      right: centerX + width / 2,
      top: centerY - height / 2,
      bottom: centerY + height / 2,
      width,
      height,
    };
  }
  
  /**
   * 调整画布大小
   */
  resize(width: number, height: number): void {
    if (!this.canvas) return;
    
    this.canvas.width = width;
    this.canvas.height = height;
    
    if (this.gl) {
      this.gl.viewport(0, 0, width, height);
    }
    
    console.log(`[CubismModel] 画布大小调整为: ${width}x${height}`);
  }
  
  /**
   * 检查点是否在模型内
   */
  isPointInModel(x: number, y: number): boolean {
    const bounds = this.getModelBounds();
    if (!bounds) return false;
    
    return x >= bounds.left && x <= bounds.right && 
           y >= bounds.top && y <= bounds.bottom;
  }
  
  /**
   * 获取纹理源（用于颜色提取）
   */
  getTextureSource(): HTMLImageElement | null {
    // TODO: 实现纹理获取逻辑
    return null;
  }
  
  /**
   * 销毁模型
   */
  destroy(): void {
    console.log('[CubismModel] 销毁模型');
    
    this.stopLipSync();
    
    // TODO: 清理 Cubism SDK 资源
    // 1. 销毁渲染器
    // 2. 销毁模型
    // 3. 释放纹理
    
    this.isInitialized = false;
    this.userModel = null;
    this.modelSetting = null;
  }
  
  /**
   * 销毁全局资源
   */
  static destroyGlobal(): void {
    console.log('[CubismModel] 销毁全局资源');
    
    // TODO: 调用 CubismFramework.dispose()
  }
}