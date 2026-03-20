/**
 * Live2D Cubism Model 类
 * 基于官方 Cubism SDK for Web 实现
 */

// 临时类型定义，直到我们添加真正的 Cubism SDK 依赖
// 这些类型将在后续版本中被真实的 SDK 类型替换

// CubismFramework 类定义
class CubismFramework {
  static startUp(_allocator?: any): void {
    console.log('[CubismFramework] startUp');
  }
  static initialize(): void {
    console.log('[CubismFramework] initialize');
  }
  static dispose(): void {
    console.log('[CubismFramework] dispose');
  }
}

class CubismUserModel {
  getModel(): any { return null; }
  createRenderer(_width: number, _height: number): void {}
  getRenderer(): any { return null; }
  loadModel(_buffer: ArrayBuffer): void {}
  update(): void {}
  loadParameters(): void {}
  saveParameters(): void {}
  getModelMatrix(): any { return { scale: (_x: number, _y?: number) => {}, translate: (_x: number, _y: number) => {}, translateX: (_x: number) => {}, translateY: (_y: number) => {}, multiplyByMatrix: (_matrix: any) => {} }; }
}

class CubismModelSettingJson {
  constructor(_buffer: ArrayBuffer, _size: number) {}
  getModelFileName(): string { return ''; }
  getTextureCount(): number { return 0; }
  getTextureFileName(_index: number): string { return ''; }
  getMotionGroupCount(): number { return 0; }
  getMotionGroupName(_index: number): string { return ''; }
  getMotionCount(_groupName: string): number { return 0; }
  getMotionFileName(_groupName: string, _index: number): string { return ''; }
  getExpressionCount(): number { return 0; }
  getExpressionFileName(_index: number): string { return ''; }
  getPhysicsFileName(): string { return ''; }
  getPoseFileName(): string { return ''; }
  getLayoutMap(_map: any): void {}
  getLipSyncParameterCount(): number { return 0; }
  getLipSyncParameterId(_index: number): any { return null; }
}

class CubismRenderer_WebGL {
  startUp(_gl: WebGLRenderingContext): void {}
  initialize(_width: number, _height: number): void {}
  resize(_width: number, _height: number): void {}
  loadShaders(): void {}
  setMvpMatrix(_matrix: any): void {}
  drawModel(): void {}
  bindTexture(_index: number, _texture: WebGLTexture): void {}
  setIsPremultipliedAlpha(_premultiplied: boolean): void {}
}

class CubismMotionManager {
  addMotion(_groupName: string, _motion: any): void {}
  startMotion(_motion: any, _priority: number): void {}
  updateMotion(_model: any, _deltaTime: number): boolean { return false; }
  isFinished(): boolean { return true; }
  getMotion(_groupName: string, _index: number): any { return null; }
  stopAllMotions(): void {}
}

class CubismExpressionMotionManager {
  addMotion(_motion: any): void {}
  updateMotion(_model: any, _deltaTime: number): void {}
}

class CubismEyeBlink {
  constructor(_modelSetting: any) {}
  updateParameters(_model: any, _deltaTime: number): void {}
}

class CubismBreath {
  static create(): CubismBreath { return new CubismBreath(); }
  setParameters(_parameters: any): void {}
  updateParameters(_model: any, _deltaTime: number): void {}
}

class CubismPhysics {
  static create(_buffer: ArrayBuffer, _size: number): CubismPhysics { return new CubismPhysics(); }
  evaluate(_model: any, _deltaTime: number): void {}
}

class CubismPose {
  static create(_buffer: ArrayBuffer, _size: number): CubismPose { return new CubismPose(); }
  updateParameters(_model: any, _deltaTime: number): void {}
}

class CubismMatrix44 {
  scale(_x: number, _y?: number): void {}
  translate(_x: number, _y: number): void {}
  translateX(_x: number): void {}
  translateY(_y: number): void {}
  multiplyByMatrix(_matrix: any): void {}
}

class CubismMotion {
  static create(_buffer: ArrayBuffer, _size: number): CubismMotion { return new CubismMotion(); }
  setFinishedMotionHandler(_handler: () => void): void {}
}

class CubismExpressionMotion {
  static loadJson(_buffer: ArrayBuffer, _size: number): any { return {}; }
}

class CubismTargetPoint {
  update(_deltaTime: number): void {}
  getX(): number { return 0; }
  getY(): number { return 0; }
}

// 临时的 csmVector 类
class csmVector<T> {
  private items: T[] = [];
  
  pushBack(item: T): void {
    this.items.push(item);
  }
  
  getSize(): number {
    return this.items.length;
  }
  
  at(index: number): T {
    return this.items[index];
  }
}

// 临时的 csmMap 类
class csmMap<K, V> {
  private map = new Map<K, V>();
  
  isExist(key: K): boolean {
    return this.map.has(key);
  }
  
  getValue(key: K): V {
    return this.map.get(key)!;
  }
  
  setValue(key: K, value: V): void {
    this.map.set(key, value);
  }
}

// 临时的 csmString 类（暂时未使用）
// class csmString {
//   s: string = '';
//   constructor(s: string) { this.s = s; }
// }

// 临时的 ICubismModelSetting 接口
interface ICubismModelSetting {
  getModelFileName(): string;
  getTextureCount(): number;
  getTextureFileName(index: number): string;
  getMotionGroupCount(): number;
  getMotionGroupName(index: number): string;
  getMotionCount(groupName: string): number;
  getMotionFileName(groupName: string, index: number): string;
  getExpressionCount(): number;
  getExpressionFileName(index: number): string;
  getPhysicsFileName(): string;
  getPoseFileName(): string;
  getLayoutMap(map: any): void;
  getLipSyncParameterCount(): number;
  getLipSyncParameterId(index: number): any;
}

// 临时的 CubismIdHandle 类型
type CubismIdHandle = any;

// 导入分配器
import { createCubismAllocator } from './CubismAllocator';

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

// 加载状态枚举
enum LoadStep {
  LoadAssets,      // 加载配置文件
  LoadModel,       // 加载模型文件
  WaitLoadModel,   // 等待模型加载
  LoadExpression,  // 加载表情
  WaitLoadExpression, // 等待表情加载
  LoadPhysics,     // 加载物理
  WaitLoadPhysics, // 等待物理加载
  LoadPose,        // 加载姿势
  WaitLoadPose,    // 等待姿势加载
  SetupEyeBlink,   // 设置眼睛眨动
  SetupBreath,     // 设置呼吸效果
  LoadUserData,    // 加载用户数据
  WaitLoadUserData, // 等待用户数据加载
  SetupEyeBlinkIds, // 设置眼睛眨动ID
  SetupLipSyncIds,  // 设置口型同步ID
  SetupLayout,      // 设置布局
  LoadMotion,       // 加载动作
  WaitLoadMotion,   // 等待动作加载
  CompleteInitialize, // 初始化完成
  CompleteSetupModel, // 模型设置完成
  LoadTexture,      // 加载纹理
  WaitLoadTexture,  // 等待纹理加载
  CompleteSetup     // 完成设置
}

export class CubismModel {
  // WebGL 上下文
  private gl: WebGLRenderingContext | null = null;
  private canvas: HTMLCanvasElement | null = null;
  
  // Cubism SDK 对象
  private userModel: CubismUserModel | null = null;
  private modelSetting: ICubismModelSetting | null = null;
  private renderer: CubismRenderer_WebGL | null = null;
  
  // 动画和效果组件
  private motionManager: CubismMotionManager | null = null;
  private expressionManager: CubismExpressionMotionManager | null = null;
  private eyeBlink: CubismEyeBlink | null = null;
  private breath: CubismBreath | null = null;
  private physics: CubismPhysics | null = null;
  private pose: CubismPose | null = null;
  
  // 状态
  private modelPath: string = '';
  private modelHomeDir: string = '';
  private state: LoadStep = LoadStep.LoadAssets;
  private isInitialized: boolean = false;
  private isUpdating: boolean = false; // 用于防止并发更新
  
  // Getter for state (to avoid unused warning)
  getState(): LoadStep {
    return this.state;
  }
  
  // 口型同步相关
  private lipSyncContext: AudioContext | null = null;
  private lipSyncAnalyser: AnalyserNode | null = null;
  private lipSyncSource: MediaElementAudioSourceNode | null = null;
  private lipSyncAudioElement: HTMLAudioElement | null = null;
  private lipSyncFrameId: number | null = null;
  private lipSyncEndedHandler: (() => void) | null = null;
  private lipSyncValue: number = 0;
  private lipSyncIds: csmVector<CubismIdHandle> | null = null;
  
  // 眼睛注视相关
  private dragX: number = 0;
  private dragY: number = 0;
  private dragManager: any = null; // CubismTargetPoint
  
  // 动画相关
  private lastUpdateTime: number = 0;
  private deltaTime: number = 0;
  private userTimeSeconds: number = 0;
  
  // 模型参数ID
  private idParamAngleX: CubismIdHandle | null = null;
  private idParamAngleY: CubismIdHandle | null = null;
  private idParamAngleZ: CubismIdHandle | null = null;
  private idParamBodyAngleX: CubismIdHandle | null = null;
  private idParamEyeBallX: CubismIdHandle | null = null;
  private idParamEyeBallY: CubismIdHandle | null = null;
  
  // 纹理相关
  private textureCount: number = 0; // 纹理总数
  private loadedTextureCount: number = 0; // 已加载纹理数
  
  // Getter for texture count (to avoid unused warning)
  getTextureCount(): number {
    return this.textureCount;
  }
  
  // 动作相关
  private allMotionCount: number = 0; // 所有动作总数
  // private motionCount: number = 0; // 暂时未使用
  
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
    
    // 检查是否为 Cubism 3 模型
    const normalizedPath = modelPath.toLowerCase();
    const isCubism2Model = normalizedPath.endsWith('.model.json') && !normalizedPath.endsWith('.model3.json');
    
    if (isCubism2Model) {
      throw new Error('当前版本不支持 Cubism 2（.model.json）模型，请使用 .model3.json 模型。');
    }
    
    try {
      console.log('[CubismModel] 开始加载模型:', modelPath);
      
      // 设置模型主目录
      this.modelHomeDir = modelPath.substring(0, modelPath.lastIndexOf('/') + 1);
      
      // 步骤1：加载 model3.json 配置文件
      this.state = LoadStep.LoadAssets;
      const modelSettingBuffer = await this.loadFileAsArrayBuffer(modelPath);
      
      // 创建模型设置对象
      this.modelSetting = new CubismModelSettingJson(
        modelSettingBuffer, 
        modelSettingBuffer.byteLength
      );
      
      // 步骤2：加载模型文件
      this.state = LoadStep.LoadModel;
      const modelFileName = this.modelSetting.getModelFileName();
      if (!modelFileName) {
        throw new Error('模型配置文件中未指定模型文件名');
      }
      
      const modelFilePath = this.modelHomeDir + modelFileName;
      console.log('[CubismModel] 加载模型文件:', modelFilePath);
      
      const modelBuffer = await this.loadFileAsArrayBuffer(modelFilePath);
      
      // 步骤3：创建 CubismUserModel
      this.userModel = new CubismUserModel();
      
      // 加载模型数据
      this.userModel.loadModel(modelBuffer);
      
      // 步骤4：创建渲染器
      this.state = LoadStep.CompleteInitialize;
      this.userModel.createRenderer(800, 600); // 默认尺寸，会在 initWebGL 中调整
      this.renderer = this.userModel.getRenderer();
      
      // 步骤5：设置模型参数ID
      this.setupModelParameters();
      
      // 步骤6：加载表情
      this.state = LoadStep.LoadExpression;
      await this.loadExpressions();
      
      // 步骤7：加载物理
      this.state = LoadStep.LoadPhysics;
      await this.loadPhysics();
      
      // 步骤8：加载姿势
      this.state = LoadStep.LoadPose;
      await this.loadPose();
      
      // 步骤9：设置眼睛眨动
      this.state = LoadStep.SetupEyeBlink;
      this.setupEyeBlink();
      
      // 步骤10：设置呼吸效果
      this.state = LoadStep.SetupBreath;
      this.setupBreath();
      
      // 步骤11：设置口型同步ID
      this.state = LoadStep.SetupLipSyncIds;
      this.setupLipSyncIds();
      
      // 步骤12：加载动作
      this.state = LoadStep.LoadMotion;
      await this.loadMotions();
      
      // 步骤13：设置布局
      this.state = LoadStep.SetupLayout;
      this.setupLayout();
      
      // 步骤14：加载纹理
      this.state = LoadStep.LoadTexture;
      await this.loadTextures();
      
      this.state = LoadStep.CompleteSetup;
      this.isInitialized = true;
      
      console.log('[CubismModel] 模型加载完成:', modelPath);
      
    } catch (error) {
      console.error('[CubismModel] 模型加载失败:', error);
      throw error;
    }
  }
  
  /**
   * 从文件加载 ArrayBuffer
   */
  private async loadFileAsArrayBuffer(filePath: string): Promise<ArrayBuffer> {
    const response = await fetch(filePath);
    if (!response.ok) {
      throw new Error(`无法加载文件: ${filePath} (${response.status})`);
    }
    return await response.arrayBuffer();
  }
  
  /**
   * 设置模型参数ID
   */
  private setupModelParameters(): void {
    if (!this.userModel) return;
    
    // 获取模型参数ID
    const model = this.userModel.getModel();
    if (!model) return;
    
    // 设置眼睛注视参数ID
    this.idParamAngleX = model.getParameterIndex('ParamAngleX');
    this.idParamAngleY = model.getParameterIndex('ParamAngleY');
    this.idParamAngleZ = model.getParameterIndex('ParamAngleZ');
    this.idParamBodyAngleX = model.getParameterIndex('ParamBodyAngleX');
    this.idParamEyeBallX = model.getParameterIndex('ParamEyeBallX');
    this.idParamEyeBallY = model.getParameterIndex('ParamEyeBallY');
  }
  
  /**
   * 加载表情
   */
  private async loadExpressions(): Promise<void> {
    if (!this.modelSetting || !this.userModel) return;
    
    const expressionCount = this.modelSetting.getExpressionCount();
    if (expressionCount === 0) {
      console.log('[CubismModel] 无表情文件');
      return;
    }
    
    console.log(`[CubismModel] 加载 ${expressionCount} 个表情`);
    
    // 创建表情管理器
    this.expressionManager = new CubismExpressionMotionManager();
    
    // 加载每个表情
    for (let i = 0; i < expressionCount; i++) {
      const expressionFileName = this.modelSetting.getExpressionFileName(i);
      if (!expressionFileName) continue;
      
      const expressionPath = this.modelHomeDir + expressionFileName;
      
      try {
        const expressionBuffer = await this.loadFileAsArrayBuffer(expressionPath);
        const expression = CubismExpressionMotion.loadJson(expressionBuffer, expressionBuffer.byteLength);
        this.expressionManager.addMotion(expression);
      } catch (error) {
        console.warn(`[CubismModel] 表情加载失败: ${expressionPath}`, error);
      }
    }
  }
  
  /**
   * 加载物理
   */
  private async loadPhysics(): Promise<void> {
    if (!this.modelSetting || !this.userModel) return;
    
    const physicsFileName = this.modelSetting.getPhysicsFileName();
    if (!physicsFileName) {
      console.log('[CubismModel] 无物理文件');
      return;
    }
    
    const physicsPath = this.modelHomeDir + physicsFileName;
    console.log('[CubismModel] 加载物理:', physicsPath);
    
    try {
      const physicsBuffer = await this.loadFileAsArrayBuffer(physicsPath);
      this.physics = CubismPhysics.create(physicsBuffer, physicsBuffer.byteLength);
    } catch (error) {
      console.warn('[CubismModel] 物理加载失败:', error);
    }
  }
  
  /**
   * 加载姿势
   */
  private async loadPose(): Promise<void> {
    if (!this.modelSetting || !this.userModel) return;
    
    const poseFileName = this.modelSetting.getPoseFileName();
    if (!poseFileName) {
      console.log('[CubismModel] 无姿势文件');
      return;
    }
    
    const posePath = this.modelHomeDir + poseFileName;
    console.log('[CubismModel] 加载姿势:', posePath);
    
    try {
      const poseBuffer = await this.loadFileAsArrayBuffer(posePath);
      this.pose = CubismPose.create(poseBuffer, poseBuffer.byteLength);
    } catch (error) {
      console.warn('[CubismModel] 姿势加载失败:', error);
    }
  }
  
  /**
   * 设置眼睛眨动
   */
  private setupEyeBlink(): void {
    if (!this.modelSetting || !this.userModel) return;
    
    // 创建眼睛眨动效果
    this.eyeBlink = new CubismEyeBlink(this.modelSetting);
    console.log('[CubismModel] 设置眼睛眨动');
  }
  
  /**
   * 设置呼吸效果
   */
  private setupBreath(): void {
    if (!this.userModel) return;
    
    // 创建呼吸效果
    this.breath = CubismBreath.create();
    
    // 设置呼吸参数
    const breathParameters = new csmVector();
    breathParameters.pushBack({
      parameterId: this.idParamAngleX || 'ParamAngleX',
      offset: 0.0,
      peak: 0.0,
      cycle: 6.5345,
      weight: 1.0
    });
    
    this.breath.setParameters(breathParameters);
    console.log('[CubismModel] 设置呼吸效果');
  }
  
  /**
   * 设置口型同步ID
   */
  private setupLipSyncIds(): void {
    if (!this.modelSetting || !this.userModel) return;
    
    // 获取口型同步参数ID
    this.lipSyncIds = new csmVector<CubismIdHandle>();
    
    const lipSyncParamCount = this.modelSetting.getLipSyncParameterCount();
    for (let i = 0; i < lipSyncParamCount; i++) {
      const paramId = this.modelSetting.getLipSyncParameterId(i);
      this.lipSyncIds.pushBack(paramId);
    }
    
    console.log(`[CubismModel] 设置 ${lipSyncParamCount} 个口型同步参数`);
  }
  
  /**
   * 加载动作
   */
  private async loadMotions(): Promise<void> {
    if (!this.modelSetting || !this.userModel) return;
    
    // 创建动作管理器
    this.motionManager = new CubismMotionManager();
    
    const motionGroupCount = this.modelSetting.getMotionGroupCount();
    if (motionGroupCount === 0) {
      console.log('[CubismModel] 无动作文件');
      return;
    }
    
    console.log(`[CubismModel] 加载 ${motionGroupCount} 个动作组`);
    
    // 加载每个动作组
    for (let i = 0; i < motionGroupCount; i++) {
      const groupName = this.modelSetting.getMotionGroupName(i);
      const motionCount = this.modelSetting.getMotionCount(groupName);
      
      for (let j = 0; j < motionCount; j++) {
        const motionFileName = this.modelSetting.getMotionFileName(groupName, j);
        if (!motionFileName) continue;
        
        const motionPath = this.modelHomeDir + motionFileName;
        
        try {
          const motionBuffer = await this.loadFileAsArrayBuffer(motionPath);
          const motion = CubismMotion.create(motionBuffer, motionBuffer.byteLength);
          
          // 设置动作回调
          motion.setFinishedMotionHandler(() => {
            console.log(`[CubismModel] 动作完成: ${groupName}[${j}]`);
          });
          
          this.motionManager.addMotion(groupName, motion);
          this.allMotionCount++;
        } catch (error) {
          console.warn(`[CubismModel] 动作加载失败: ${motionPath}`, error);
        }
      }
    }
    
    console.log(`[CubismModel] 共加载 ${this.allMotionCount} 个动作`);
  }
  
  /**
   * 设置布局
   */
  private setupLayout(): void {
    if (!this.modelSetting || !this.userModel) return;
    
    // 设置布局矩阵
    const layoutMap = new csmMap<string, number>();
    this.modelSetting.getLayoutMap(layoutMap);
    
    // 应用布局
    const modelMatrix = new CubismMatrix44();
    
    if (layoutMap.isExist('Width')) {
      const width = layoutMap.getValue('Width');
      modelMatrix.scale(width, width);
    }
    
    if (layoutMap.isExist('CenterX')) {
      const centerX = layoutMap.getValue('CenterX');
      modelMatrix.translateX(centerX);
    }
    
    if (layoutMap.isExist('CenterY')) {
      const centerY = layoutMap.getValue('CenterY');
      modelMatrix.translateY(centerY);
    }
    
    // 应用布局矩阵到模型
    this.userModel.getModelMatrix().multiplyByMatrix(modelMatrix);
    
    console.log('[CubismModel] 布局设置完成');
  }
  
  /**
   * 加载纹理
   */
  private async loadTextures(): Promise<void> {
    if (!this.modelSetting || !this.renderer) return;
    
    const textureCount = this.modelSetting.getTextureCount();
    if (textureCount === 0) {
      console.log('[CubismModel] 无纹理');
      return;
    }
    
    console.log(`[CubismModel] 加载 ${textureCount} 个纹理`);
    
    this.textureCount = textureCount;
    this.loadedTextureCount = 0;
    
    // 加载每个纹理
    for (let i = 0; i < textureCount; i++) {
      const textureFileName = this.modelSetting.getTextureFileName(i);
      if (!textureFileName) {
        this.loadedTextureCount++;
        continue;
      }
      
      const texturePath = this.modelHomeDir + textureFileName;
      
      try {
        // 加载纹理图像
        const texture = await this.loadTexture(texturePath);
        
        // 绑定纹理到渲染器
        this.renderer.bindTexture(i, texture);
        this.loadedTextureCount++;
        
        console.log(`[CubismModel] 纹理 ${i} 加载完成: ${texturePath}`);
      } catch (error) {
        console.warn(`[CubismModel] 纹理加载失败: ${texturePath}`, error);
        this.loadedTextureCount++;
      }
    }
    
    // 设置预乘 alpha
    this.renderer.setIsPremultipliedAlpha(true);
  }
  
  /**
   * 加载纹理图像
   */
  private async loadTexture(texturePath: string): Promise<WebGLTexture> {
    if (!this.gl) {
      throw new Error('WebGL 上下文未初始化');
    }
    
    return new Promise<WebGLTexture>((resolve, reject) => {
      const image = new Image();
      
      image.onload = () => {
        try {
          const texture = this.gl!.createTexture();
          if (!texture) {
            reject(new Error('创建纹理失败'));
            return;
          }
          
          this.gl!.bindTexture(this.gl!.TEXTURE_2D, texture);
          this.gl!.texImage2D(
            this.gl!.TEXTURE_2D, 
            0, 
            this.gl!.RGBA, 
            this.gl!.RGBA, 
            this.gl!.UNSIGNED_BYTE, 
            image
          );
          
          // 设置纹理参数
          this.gl!.texParameteri(this.gl!.TEXTURE_2D, this.gl!.TEXTURE_WRAP_S, this.gl!.CLAMP_TO_EDGE);
          this.gl!.texParameteri(this.gl!.TEXTURE_2D, this.gl!.TEXTURE_WRAP_T, this.gl!.CLAMP_TO_EDGE);
          this.gl!.texParameteri(this.gl!.TEXTURE_2D, this.gl!.TEXTURE_MIN_FILTER, this.gl!.LINEAR);
          this.gl!.texParameteri(this.gl!.TEXTURE_2D, this.gl!.TEXTURE_MAG_FILTER, this.gl!.LINEAR);
          
          resolve(texture);
        } catch (error) {
          reject(error);
        }
      };
      
      image.onerror = () => {
        reject(new Error(`无法加载纹理: ${texturePath}`));
      };
      
      image.src = texturePath;
    });
  }
  
  /**
   * 初始化 WebGL
   */
  initWebGL(canvas: HTMLCanvasElement, initialPosition?: { x: number; y: number }): void {
    console.log('[CubismModel] 初始化 WebGL');
    
    this.canvas = canvas;
    
    // 获取 WebGL 上下文
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) {
      throw new Error('无法获取 WebGL 上下文');
    }
    this.gl = gl as WebGLRenderingContext;
    
    // 初始化 Cubism SDK
    this.initializeCubismSDK();
    
    // 设置画布尺寸
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // 初始化渲染器
    if (this.userModel && this.renderer && this.gl) {
      this.renderer.startUp(this.gl);
      this.renderer.initialize(canvas.width, canvas.height);
      this.renderer.loadShaders();
    }
    
    // 设置模型初始位置和大小
    this.setupModelTransform(initialPosition);
    
    this.isInitialized = true;
    console.log('[CubismModel] WebGL 初始化完成');
  }
  
  /**
   * 初始化 Cubism SDK
   */
  private initializeCubismSDK(): void {
    console.log('[CubismModel] 初始化 Cubism SDK');
    
    // 创建分配器
    const allocator = createCubismAllocator();
    
    // 启动 Cubism Framework
    CubismFramework.startUp(allocator);
    
    // 初始化 Cubism Framework
    CubismFramework.initialize();
    
    console.log('[CubismModel] Cubism SDK 初始化完成');
  }
  
  /**
   * 设置模型变换
   */
  private setupModelTransform(initialPosition?: { x: number; y: number }): void {
    if (!this.canvas || !this.userModel || !this.renderer) return;
    
    const width = this.canvas.width;
    const height = this.canvas.height;
    
    // 调整渲染器大小
    this.renderer.resize(width, height);
    
    // 计算模型缩放
    const modelWidth = this.userModel.getModel().getCanvasWidth();
    const modelHeight = this.userModel.getModel().getCanvasHeight();
    
    const scale = Math.min(
      width / modelWidth,
      height / modelHeight
    ) * 0.3; // 缩放系数：0.3 = 占屏幕 30%
    
    // 设置模型矩阵
    const modelMatrix = this.userModel.getModelMatrix();
    modelMatrix.scale(scale, scale);
    
    // 设置模型位置
    if (initialPosition) {
      // 使用传入的初始位置
      const centerX = (initialPosition.x - width / 2) / scale;
      const centerY = (height - initialPosition.y - height / 2) / scale;
      modelMatrix.translate(centerX, centerY);
      console.log('[CubismModel] 使用保存的位置:', initialPosition);
    } else {
      // 使用默认中心位置
      modelMatrix.translate(0, 0);
      console.log('[CubismModel] 使用默认中心位置');
    }
    
    // 创建拖拽管理器
    this.dragManager = new CubismTargetPoint();
    
    console.log(`[CubismModel] 模型变换设置完成: 缩放=${scale.toFixed(2)}, 画布=${width}x${height}`);
  }
  
  /**
   * 更新模型
   */
  update(): void {
    if (!this.isInitialized || !this.userModel || !this.userModel.getModel() || this.isUpdating) return;
    
    this.isUpdating = true;
    
    const now = performance.now() / 1000; // 转换为秒
    this.deltaTime = now - this.lastUpdateTime;
    this.lastUpdateTime = now;
    this.userTimeSeconds += this.deltaTime;
    
    const deltaTimeSeconds = this.deltaTime;
    
    // 更新拖拽管理器
    if (this.dragManager) {
      this.dragManager.update(deltaTimeSeconds);
      this.dragX = this.dragManager.getX();
      this.dragY = this.dragManager.getY();
    }
    
    // 加载上次保存的参数状态
    this.userModel.loadParameters();
    
    // 更新动作
    let motionUpdated = false;
    if (this.motionManager) {
      if (this.motionManager.isFinished()) {
        // 如果没有动作在播放，播放随机待机动作
        this.startRandomMotion('Idle', 1);
      } else {
        motionUpdated = this.motionManager.updateMotion(this.userModel.getModel(), deltaTimeSeconds);
      }
    }
    
    // 保存当前参数状态
    this.userModel.saveParameters();
    
    // 更新眼睛眨动
    if (!motionUpdated && this.eyeBlink) {
      this.eyeBlink.updateParameters(this.userModel.getModel(), deltaTimeSeconds);
    }
    
    // 更新表情
    if (this.expressionManager) {
      this.expressionManager.updateMotion(this.userModel.getModel(), deltaTimeSeconds);
    }
    
    // 更新眼睛注视（拖拽）
    this.userModel.getModel().addParameterValueById(this.idParamAngleX, this.dragX * 30);
    this.userModel.getModel().addParameterValueById(this.idParamAngleY, this.dragY * 30);
    this.userModel.getModel().addParameterValueById(this.idParamAngleZ, this.dragX * this.dragY * -30);
    
    // 更新身体角度
    this.userModel.getModel().addParameterValueById(this.idParamBodyAngleX, this.dragX * 10);
    
    // 更新眼睛位置
    this.userModel.getModel().addParameterValueById(this.idParamEyeBallX, this.dragX);
    this.userModel.getModel().addParameterValueById(this.idParamEyeBallY, this.dragY);
    
    // 更新呼吸效果
    if (this.breath) {
      this.breath.updateParameters(this.userModel.getModel(), deltaTimeSeconds);
    }
    
    // 更新物理
    if (this.physics) {
      this.physics.evaluate(this.userModel.getModel(), deltaTimeSeconds);
    }
    
    // 更新口型同步
    if (this.lipSyncValue > 0 && this.lipSyncIds) {
      for (let i = 0; i < this.lipSyncIds.getSize(); i++) {
        this.userModel.getModel().addParameterValueById(this.lipSyncIds.at(i), this.lipSyncValue, 0.8);
      }
    }
    
    // 更新姿势
    if (this.pose) {
      this.pose.updateParameters(this.userModel.getModel(), deltaTimeSeconds);
    }
    
    // 更新模型
    this.userModel.update();
    
    this.isUpdating = false;
  }
  
  /**
   * 渲染模型
   */
  render(): void {
    if (!this.isInitialized || !this.gl || !this.userModel || !this.renderer) return;
    
    // 清除画布（透明背景）
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    
    // 设置视口
    if (this.canvas) {
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
    
    // 设置 MVP 矩阵
    const projectionMatrix = new CubismMatrix44();
    if (this.canvas) {
      projectionMatrix.scale(this.canvas.width / this.userModel.getModel().getCanvasWidth(), 
                           this.canvas.height / this.userModel.getModel().getCanvasHeight());
    }
    
    this.renderer.setMvpMatrix(projectionMatrix);
    
    // 渲染模型
    this.renderer.drawModel();
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
  motion(group: string, index: number = 0, priority: number = 2): void {
    if (!this.motionManager || !this.userModel) return;
    
    console.log(`[CubismModel] 播放动作: ${group}[${index}]`);
    
    // 获取动作
    const motion = this.motionManager.getMotion(group, index);
    if (!motion) {
      console.warn(`[CubismModel] 动作未找到: ${group}[${index}]`);
      return;
    }
    
    // 开始播放动作
    this.motionManager.startMotion(motion, priority);
  }
  
  /**
   * 播放随机动作
   */
  startRandomMotion(groupName: string, priority: number): void {
    if (!this.modelSetting || !this.motionManager) return;
    
    const motionCount = this.modelSetting.getMotionCount(groupName);
    if (motionCount === 0) {
      console.warn(`[CubismModel] 动作组为空: ${groupName}`);
      return;
    }
    
    // 随机选择一个动作
    const motionIndex = Math.floor(Math.random() * motionCount);
    this.motion(groupName, motionIndex, priority);
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
      if (!analyser) {
        console.warn('[CubismModel] 口型同步分析器未初始化');
        return;
      }
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
    if (!this.modelSetting) {
      return {
        name: this.modelPath.split('/').filter(Boolean).pop()?.replace(/\.(model|model3)\.json$/, '') || 'unknown',
        motionGroups: {},
        expressions: []
      };
    }
    
    // 获取动作组信息
    const motionGroups: Record<string, Array<{ index: number; file: string }>> = {};
    const motionGroupCount = this.modelSetting.getMotionGroupCount();
    
    for (let i = 0; i < motionGroupCount; i++) {
      const groupName = this.modelSetting.getMotionGroupName(i);
      const motionCount = this.modelSetting.getMotionCount(groupName);
      const motions: Array<{ index: number; file: string }> = [];
      
      for (let j = 0; j < motionCount; j++) {
        const motionFileName = this.modelSetting.getMotionFileName(groupName, j);
        motions.push({
          index: j,
          file: motionFileName || `motion_${j}`
        });
      }
      
      motionGroups[groupName] = motions;
    }
    
    // 获取表情信息
    const expressions: string[] = [];
    const expressionCount = this.modelSetting.getExpressionCount();
    
    for (let i = 0; i < expressionCount; i++) {
      const expressionFileName = this.modelSetting.getExpressionFileName(i);
      const expressionName = expressionFileName?.replace(/\.(exp3\.json|json)$/, '') || `expression_${i}`;
      expressions.push(expressionName);
    }
    
    // 提取模型名称
    const modelName = this.modelPath.split('/').filter(Boolean).pop()?.replace(/\.(model|model3)\.json$/, '') || 'unknown';
    
    return {
      name: modelName,
      motionGroups,
      expressions
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
    
    // 销毁动作管理器
    if (this.motionManager) {
      this.motionManager = null;
    }
    
    // 销毁表情管理器
    if (this.expressionManager) {
      this.expressionManager = null;
    }
    
    // 销毁眼睛眨动
    if (this.eyeBlink) {
      this.eyeBlink = null;
    }
    
    // 销毁呼吸效果
    if (this.breath) {
      this.breath = null;
    }
    
    // 销毁物理
    if (this.physics) {
      this.physics = null;
    }
    
    // 销毁姿势
    if (this.pose) {
      this.pose = null;
    }
    
    // 销毁渲染器
    if (this.renderer) {
      this.renderer = null;
    }
    
    // 销毁模型
    if (this.userModel) {
      this.userModel = null;
    }
    
    // 销毁模型设置
    if (this.modelSetting) {
      this.modelSetting = null;
    }
    
    // 清理口型同步
    this.destroyLipSyncPipeline();
    
    this.isInitialized = false;
    this.state = LoadStep.LoadAssets;
    
    console.log('[CubismModel] 模型销毁完成');
  }
  
  /**
   * 销毁全局资源
   */
  static destroyGlobal(): void {
    console.log('[CubismModel] 销毁全局资源');
    
    // 销毁 Cubism Framework
    CubismFramework.dispose();
  }
}