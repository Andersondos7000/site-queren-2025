// Realtime Components Export
export { default as RealtimeProvider, useRealtime } from './RealtimeProvider'
export { default as RealtimeStatus } from './RealtimeStatus'
export { default as RealtimeSync } from './RealtimeSync'

// Novos componentes de feedback visual
export { default as SyncStatus, SyncDetails, TopBarSyncIndicator } from './SyncStatus'
export { default as ConflictResolver, ConflictCounter, useAutoConflictResolution } from './ConflictResolver'
export { 
  default as OfflineIndicator, 
  PendingChangesIndicator, 
  ConnectionQualityIndicator, 
  ConnectivityToast,
  useConnectivityDetection 
} from './OfflineIndicator'

// Context e hooks de estado global
export { 
  RealtimeProvider as GlobalRealtimeProvider, 
  useRealtimeContext, 
  useConflictMonitor, 
  useRealtimeMetrics 
} from '../../contexts/RealtimeContext'

// Re-export types from hooks
export type {
  RealtimeConfig,
  RealtimeMetrics,
  SyncOptions,
  ConnectionStatus,
  CartItem,
  Product,
  Order,
  Event,
  Ticket
} from '../../hooks/realtime'

// Types do contexto global
export type { 
  RealtimeState, 
  RealtimeConflict, 
  RealtimeAction 
} from '../../contexts/RealtimeContext'

// Component Props Types
export interface RealtimeStatusProps {
  showDetails?: boolean
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  className?: string
  style?: React.CSSProperties
  onStatusChange?: (status: string) => void
}

export interface RealtimeSyncProps {
  tables?: string[]
  autoSync?: boolean
  syncInterval?: number
  onSyncStart?: () => void
  onSyncComplete?: (results: SyncResult[]) => void
  onSyncError?: (error: Error) => void
  showProgress?: boolean
  className?: string
  style?: React.CSSProperties
}

export interface SyncResult {
  table: string
  success: boolean
  recordsAffected: number
  duration: number
  error?: string
}

export interface SyncProgress {
  table: string
  status: 'pending' | 'syncing' | 'completed' | 'error'
  progress: number
  recordsProcessed: number
  totalRecords: number
  startTime?: number
  endTime?: number
  error?: string
}

// Utility functions for components
export const RealtimeUtils = {
  /**
   * Formatar tempo de uptime
   */
  formatUptime: (ms: number): string => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    } else {
      return `${seconds}s`
    }
  },

  /**
   * Obter cor baseada no status
   */
  getStatusColor: (status: string): { bg: string; text: string; border: string } => {
    switch (status) {
      case 'connected':
        return {
          bg: 'rgba(16, 185, 129, 0.9)',
          text: 'white',
          border: 'rgba(16, 185, 129, 0.3)'
        }
      case 'connecting':
        return {
          bg: 'rgba(245, 158, 11, 0.9)',
          text: 'white',
          border: 'rgba(245, 158, 11, 0.3)'
        }
      case 'disconnected':
        return {
          bg: 'rgba(107, 114, 128, 0.9)',
          text: 'white',
          border: 'rgba(107, 114, 128, 0.3)'
        }
      case 'error':
        return {
          bg: 'rgba(239, 68, 68, 0.9)',
          text: 'white',
          border: 'rgba(239, 68, 68, 0.3)'
        }
      default:
        return {
          bg: 'rgba(107, 114, 128, 0.9)',
          text: 'white',
          border: 'rgba(107, 114, 128, 0.3)'
        }
    }
  },

  /**
   * Obter ícone baseado no status
   */
  getStatusIcon: (status: string): string => {
    switch (status) {
      case 'connected':
        return '🟢'
      case 'connecting':
        return '🟡'
      case 'disconnected':
        return '⚫'
      case 'error':
        return '🔴'
      default:
        return '⚫'
    }
  },

  /**
   * Calcular performance baseada na duração média
   */
  getPerformanceLevel: (avgDuration: number): {
    level: 'excellent' | 'good' | 'slow'
    color: string
    icon: string
  } => {
    if (avgDuration < 100) {
      return { level: 'excellent', color: '#10b981', icon: '🟢' }
    } else if (avgDuration < 500) {
      return { level: 'good', color: '#f59e0b', icon: '🟡' }
    } else {
      return { level: 'slow', color: '#ef4444', icon: '🔴' }
    }
  },

  /**
   * Validar configuração de realtime
   */
  validateConfig: (config: Partial<RealtimeConfig>): boolean => {
    if (!config.supabaseUrl || !config.supabaseAnonKey) {
      console.error('Supabase URL and Anon Key are required')
      return false
    }
    
    if (config.reconnectInterval && config.reconnectInterval < 1000) {
      console.warn('Reconnect interval should be at least 1000ms')
    }
    
    if (config.maxReconnectAttempts && config.maxReconnectAttempts < 1) {
      console.warn('Max reconnect attempts should be at least 1')
    }
    
    return true
  },

  /**
   * Gerar ID único para sincronização
   */
  generateSyncId: (): string => {
    return `sync_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
  },

  /**
   * Debounce para evitar múltiplas sincronizações
   */
  debounce: <T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): ((...args: Parameters<T>) => void) => {
    let timeout: NodeJS.Timeout
    return (...args: Parameters<T>) => {
      clearTimeout(timeout)
      timeout = setTimeout(() => func(...args), wait)
    }
  },

  /**
   * Throttle para limitar frequência de sincronização
   */
  throttle: <T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): ((...args: Parameters<T>) => void) => {
    let inThrottle: boolean
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args)
        inThrottle = true
        setTimeout(() => inThrottle = false, limit)
      }
    }
  }
}

// Constants
export const REALTIME_CONSTANTS = {
  DEFAULT_RECONNECT_INTERVAL: 5000,
  DEFAULT_MAX_RECONNECT_ATTEMPTS: 10,
  DEFAULT_SYNC_INTERVAL: 30000,
  MIN_SYNC_INTERVAL: 1000,
  MAX_SYNC_INTERVAL: 300000,
  PERFORMANCE_THRESHOLDS: {
    EXCELLENT: 100,
    GOOD: 500
  },
  STATUS_ICONS: {
    CONNECTED: '🟢',
    CONNECTING: '🟡',
    DISCONNECTED: '⚫',
    ERROR: '🔴'
  },
  TABLE_ICONS: {
    products: '📦',
    orders: '🛒',
    events: '🎫',
    cart_items: '🛍️',
    users: '👤',
    categories: '📂'
  }
} as const

// Debug utilities
export const RealtimeDebug = {
  /**
   * Log de debug para realtime
   */
  log: (message: string, data?: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Realtime] ${message}`, data || '')
    }
  },

  /**
   * Log de erro para realtime
   */
  error: (message: string, error?: any) => {
    console.error(`[Realtime Error] ${message}`, error || '')
  },

  /**
   * Log de warning para realtime
   */
  warn: (message: string, data?: any) => {
    console.warn(`[Realtime Warning] ${message}`, data || '')
  },

  /**
   * Medir performance de operação
   */
  measurePerformance: <T>(operation: string, fn: () => T): T => {
    const start = performance.now()
    const result = fn()
    const end = performance.now()
    
    RealtimeDebug.log(`Performance: ${operation} took ${(end - start).toFixed(2)}ms`)
    
    return result
  },

  /**
   * Medir performance de operação assíncrona
   */
  measurePerformanceAsync: async <T>(operation: string, fn: () => Promise<T>): Promise<T> => {
    const start = performance.now()
    const result = await fn()
    const end = performance.now()
    
    RealtimeDebug.log(`Performance: ${operation} took ${(end - start).toFixed(2)}ms`)
    
    return result
  }
}