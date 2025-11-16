// Tipos para sistema de sincronização realtime e resolução de conflitos

export interface DataConflict {
  id: string;
  table: string;
  recordId: string;
  field?: string;
  localValue?: any;
  remoteValue?: any;
  localData?: any;
  remoteData?: any;
  conflictFields?: string[];
  timestamp: Date;
  type: 'update_conflict' | 'version_conflict' | 'timestamp_conflict' | 'concurrent_update' | 'state_conflict' | 'delete_conflict' | 'concurrent_modification';
  priority?: 'low' | 'medium' | 'high';
  status: 'pending' | 'resolved' | 'ignored';
  metadata?: {
    localTimestamp?: Date;
    remoteTimestamp?: Date;
    localUser?: string;
    remoteUser?: string;
    userId?: string;
    conflictReason?: string;
  };
  resolvedAt?: Date;
  resolution?: string;
}

export interface ConflictData extends DataConflict {
  // Alias para compatibilidade
}

export type ConflictResolutionStrategy = 
  | 'manual'
  | 'local_wins'
  | 'remote_wins'
  | 'timestamp_wins'
  | 'merge'
  | 'custom'
  | 'latest'
  | 'server_wins'
  | 'use_latest';

export interface ConflictMonitorConfig {
  autoResolve?: boolean;
  strategy?: ConflictResolutionStrategy;
  checkInterval?: number;
  maxConflicts?: number;
  maxAutoResolve?: number;
  maxRetries?: number;
  ignoreFields?: string[];
  criticalFields?: string[];
  autoCleanup?: boolean;
  cleanupInterval?: number;
  customResolver?: (localData: any, remoteData: any, conflictFields: string[]) => Promise<any>;
}

export interface ConflictStats {
  total: number;
  byType: Record<string, number>;
  byPriority: Record<string, number>;
  averageResolutionTime: number;
}

export interface SyncMetrics {
  conflictCount: number;
  lastConflictAt: Date | null;
  resolutionSuccessRate: number;
}

export interface RealtimeConflict {
  id: string;
  type: 'cart' | 'stock' | 'order' | 'product';
  entityId: string;
  localData: any;
  serverData: any;
  timestamp: Date;
  resolved: boolean;
  resolution?: 'local' | 'server' | 'merge';
}

export interface RealtimeState {
  isConnected: boolean;
  lastSync: Date | null;
  conflicts: RealtimeConflict[];
  syncCounts: {
    products: number;
    orders: number;
    cart: number;
    inventory: number;
  };
  metrics: {
    totalSyncs: number;
    failedSyncs: number;
    averageLatency: number;
    lastError: string | null;
  };
}

export type RealtimeAction = 
  | { type: 'SET_CONNECTION'; payload: boolean }
  | { type: 'SET_LAST_SYNC'; payload: Date }
  | { type: 'ADD_CONFLICT'; payload: RealtimeConflict }
  | { type: 'RESOLVE_CONFLICT'; payload: { id: string; resolution: 'local' | 'server' | 'merge' } }
  | { type: 'UPDATE_SYNC_COUNT'; payload: { domain: keyof RealtimeState['syncCounts']; count: number } }
  | { type: 'UPDATE_METRICS'; payload: Partial<RealtimeState['metrics']> };

export interface ConflictResolverProps {
  className?: string;
  autoResolve?: boolean;
  autoResolveStrategy?: 'latest' | 'server_wins' | 'local_wins';
  compact?: boolean;
}

export interface ConflictItemProps {
  conflict: RealtimeConflict | DataConflict;
  isSelected: boolean;
  onSelect: () => void;
  onResolve: (resolution: 'local' | 'server' | 'merge') => void;
  isResolved?: boolean;
}

export interface UseConflictMonitorReturn {
  isMonitoring: boolean;
  conflictCount: number;
  lastConflictAt: Date | null;
  resolutionStrategy: ConflictResolutionStrategy;
  resolutionSuccessRate: number;
  detectConflict: (localData: any, remoteData: any) => Promise<DataConflict | null>;
  resolveConflict: (conflictId: string, strategy: ConflictResolutionStrategy) => Promise<void>;
  startMonitoring: () => void;
  stopMonitoring: () => void;
  getConflictStats: () => ConflictStats;
}

export interface OfflineQueueItem {
  id: string;
  operation: 'create' | 'update' | 'delete';
  table: string;
  data: any;
  timestamp: Date;
  retryCount: number;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
}

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  lastSync: Date | null;
  pendingOperations: number;
  failedOperations: number;
  syncProgress: number;
}

export interface NotificationOptions {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

// Tipos para sistema de fila offline
export interface OfflineAction {
  type: 'insert' | 'update' | 'delete' | 'upsert';
  table: string;
  data?: any;
  filter?: Record<string, any>;
  priority?: 'low' | 'normal' | 'high';
}

export interface QueuedAction extends OfflineAction {
  id: string;
  timestamp: Date;
  retryCount: number;
  maxRetries: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  lastAttempt?: Date;
}

export interface OfflineQueueConfig {
  autoProcess?: boolean;
  processInterval?: number;
  maxRetries?: number;
  retryDelay?: number;
  batchSize?: number;
}