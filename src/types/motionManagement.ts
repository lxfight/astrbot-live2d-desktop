export interface MotionType {
  id: string
  name: string
  description: string
  color: string
  iconKey?: string
}

export interface MotionAssignment {
  motionId: string
  motionName: string
  groupId: string
  index: number
  type: MotionType
}

export interface MotionTypeInfo {
  motions: MotionAssignment[]
  expressions: MotionAssignment[]
  idleMotions: MotionAssignment[]
  idleExpressions: MotionAssignment[]
}

// 预设动作类型 - 与适配器端保持一致
export const MOTION_TYPES: MotionType[] = [
  {
    id: 'idle',
    name: '待机',
    description: '空闲和等待时的动作',
    color: '#96ceb4',
    iconKey: 'clock'
  },
  {
    id: 'speaking',
    name: '说话',
    description: '说话和表达时的动作',
    color: '#74c0fc',
    iconKey: 'message-circle'
  },
  {
    id: 'thinking',
    name: '思考',
    description: '思考和疑惑的动作',
    color: '#45b7d1',
    iconKey: 'help-circle'
  },
  {
    id: 'happy',
    name: '开心',
    description: '表达喜悦和高兴的情绪',
    color: '#4ecdc4',
    iconKey: 'smile'
  },
  {
    id: 'surprised',
    name: '惊讶',
    description: '表达惊讶和意外',
    color: '#bc6c25',
    iconKey: 'zap'
  },
  {
    id: 'angry',
    name: '生气',
    description: '表达愤怒和不满的情绪',
    color: '#e03131',
    iconKey: 'frown'
  },
  {
    id: 'sad',
    name: '难过',
    description: '表达悲伤和难过',
    color: '#6c757d',
    iconKey: 'frown'
  },
  {
    id: 'agree',
    name: '肯定',
    description: '表达同意和肯定',
    color: '#51cf66',
    iconKey: 'thumbs-up'
  },
  {
    id: 'disagree',
    name: '否定',
    description: '表达不同意和否定',
    color: '#ff6b6b',
    iconKey: 'thumbs-down'
  },
  {
    id: 'question',
    name: '疑问',
    description: '表达疑问和询问',
    color: '#7950f2',
    iconKey: 'help-circle'
  },
  {
    id: 'welcome',
    name: '欢迎',
    description: '欢迎和打招呼',
    color: '#ff6b6b',
    iconKey: 'hand'
  },
  {
    id: 'thanks',
    name: '感谢',
    description: '表达感谢和致意',
    color: '#ffd43b',
    iconKey: 'heart'
  },
  {
    id: 'apology',
    name: '道歉',
    description: '表达歉意和道歉',
    color: '#ff8787',
    iconKey: 'flag'
  },
  {
    id: 'goodbye',
    name: '告别',
    description: '告别和送别',
    color: '#dda15e',
    iconKey: 'log-out'
  },
  {
    id: 'excited',
    name: '兴奋',
    description: '兴奋和激动的情绪',
    color: '#ff6348',
    iconKey: 'activity'
  }
]

export interface Live2DMotion {
  group: string
  index: number
  name: string
  file: string
}

export interface Live2DExpression {
  id: string
  name: string
  file: string
}
