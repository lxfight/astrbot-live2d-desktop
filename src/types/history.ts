// 对话会话类型定义
export interface Conversation {
  id: number
  title: string
  created_at: number
  updated_at: number
  message_count: number
  is_active: 0 | 1
}

// 消息类型定义
export interface Message {
  id: number
  conversation_id: number
  sender: 'user' | 'ai'
  message_type: 'text' | 'image' | 'voice' | 'motion' | 'expression' | 'tts'
  content: string
  raw_data: string
  timestamp: number
}

// 日统计信息类型定义
export interface DailyStatistics {
  id?: number
  stat_date: string
  total_messages: number
  user_messages: number
  ai_messages: number
  text_messages: number
  image_messages: number
  voice_messages: number
  total_duration: number
  session_count: number
}

// 保存消息的参数类型
export interface SaveMessageParams {
  conversation_id: number
  sender: 'user' | 'ai'
  message_type: 'text' | 'image' | 'voice' | 'motion' | 'expression' | 'tts'
  content: string
  raw_data: string
  timestamp: number
}

// 更新统计的参数类型
export interface UpdateStatisticsParams {
  stat_date: string
  total_messages?: number
  user_messages?: number
  ai_messages?: number
  text_messages?: number
  image_messages?: number
  voice_messages?: number
  total_duration?: number
  session_count?: number
}
