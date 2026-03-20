/**
 * Cubism SDK 常量定义
 */

// Cubism 版本
export const CUBISM_VERSION = '5.3';
export const CUBISM_CORE_VERSION = 'latest';

// 渲染设置
export const RENDER_WIDTH = 800;
export const RENDER_HEIGHT = 600;
export const VIEW_SCALE = 1.0;
export const VIEW_MAX_SCALE = 2.0;
export const VIEW_MIN_SCALE = 0.8;

// 动作优先级
export const PRIORITY_NONE = 0;
export const PRIORITY_IDLE = 1;
export const PRIORITY_NORMAL = 2;
export const PRIORITY_FORCE = 3;

// 动作组名称
export const MOTION_GROUP_IDLE = 'Idle';
export const MOTION_GROUP_TAP_BODY = 'TapBody';
export const MOTION_GROUP_TAP_HEAD = 'TapHead';
export const MOTION_GROUP_TAP_FOOT = 'TapFoot';

// 表情组名称
export const EXPRESSION_GROUP_DEFAULT = 'Default';
export const EXPRESSION_GROUP_FUN = 'Fun';
export const EXPRESSION_GROUP_SAD = 'Sad';
export const EXPRESSION_GROUP_ANGRY = 'Angry';

// 口型同步参数
export const LIP_SYNC_PARAMS = [
  'ParamMouthOpenY',  // Cubism 4 标准参数
  'PARAM_MOUTH_OPEN_Y', // Cubism 2 标准参数
  'mouth_open_y',
  'MouthOpenY'
];

// 眼睛注视参数
export const EYE_PARAMS = {
  ANGLE_X: 'ParamAngleX',
  ANGLE_Y: 'ParamAngleY',
  ANGLE_Z: 'ParamAngleZ',
  BODY_ANGLE_X: 'ParamBodyAngleX',
  EYE_BALL_X: 'ParamEyeBallX',
  EYE_BALL_Y: 'ParamEyeBallY'
};

// 物理参数
export const PHYSICS_PATH = 'physics';
export const POSE_PATH = 'pose';

// 纹理设置
export const TEXTURE_PREMULTIPLIED_ALPHA = true;

// 性能设置
export const TARGET_FPS = 60;
export const FRAME_TIME = 1000 / TARGET_FPS;

// 文件扩展名
export const EXT_MODEL3_JSON = '.model3.json';
export const EXT_MOC3 = '.moc3';
export const EXT_MOTION = '.motion3.json';
export const EXT_EXPRESSION = '.exp3.json';
export const EXT_PHYSICS = '.physics3.json';
export const EXT_POSE = '.pose3.json';
export const EXT_TEXTURE = '.png';

// 调试设置
export const DEBUG_MODE = false;
export const DEBUG_LOG_PREFIX = '[CubismSDK]';

// 错误消息
export const ERROR_MESSAGES = {
  WEBGL_NOT_SUPPORTED: '当前浏览器不支持 WebGL',
  MODEL_LOAD_FAILED: '模型加载失败',
  TEXTURE_LOAD_FAILED: '纹理加载失败',
  MOTION_LOAD_FAILED: '动作加载失败',
  EXPRESSION_LOAD_FAILED: '表情加载失败',
  PHYSICS_LOAD_FAILED: '物理演算加载失败',
  POSE_LOAD_FAILED: '姿势加载失败'
};