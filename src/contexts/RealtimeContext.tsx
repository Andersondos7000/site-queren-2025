import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { ConnectionStatus } from '../hooks/realtime';

// Estados globais de sincronização
export interface RealtimeState {
  // Status de conexão geral
  isOnline: boolean;
  connectionStatus: ConnectionStatus;
  lastSync: Date | null;
  
  // Contadores de sincronização por domínio
  syncCounts: {
    cart: number;
    products: number;
    orders: number;
    events: number;
    stock: number;
  };
  
  // Conflitos detectados
  conflicts: RealtimeConflict[];
  
  // Métricas de performance
  metrics: {
    totalUpdates: number;
    averageLatency: number;
    errorCount: number;
    reconnectCount: number;
  };
  
  // Configurações
  settings: {
    enableOptimisticUpdates: boolean;
    enableRetry: boolean;
    maxRetries: number;
    retryDelay: number;
    enableConflictResolution: boolean;
  };
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

// Ações do reducer
export type RealtimeAction =
  | { type: 'SET_CONNECTION_STATUS'; payload: ConnectionStatus }
  | { type: 'SET_ONLINE_STATUS'; payload: boolean }
  | { type: 'UPDATE_SYNC_COUNT'; payload: { domain: keyof RealtimeState['syncCounts']; count: number } }
  | { type: 'ADD_CONFLICT'; payload: RealtimeConflict }
  | { type: 'RESOLVE_CONFLICT'; payload: { id: string; resolution: 'local' | 'server' | 'merge' } }
  | { type: 'UPDATE_METRICS'; payload: Partial<RealtimeState['metrics']> }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<RealtimeState['settings']> }
  | { type: 'RESET_CONFLICTS' }
  | { type: 'SET_LAST_SYNC'; payload: Date };

// Estado inicial
const initialState: RealtimeState = {
  isOnline: navigator.onLine,
  connectionStatus: 'connecting',
  lastSync: null,
  syncCounts: {
    cart: 0,
    products: 0,
    orders: 0,
    events: 0,
    stock: 0
  },
  conflicts: [],
  metrics: {
    totalUpdates: 0,
    averageLatency: 0,
    errorCount: 0,
    reconnectCount: 0
  },
  settings: {
    enableOptimisticUpdates: true,
    enableRetry: true,
    maxRetries: 3,
    retryDelay: 1000,
    enableConflictResolution: true
  }
};

// Reducer
function realtimeReducer(state: RealtimeState, action: RealtimeAction): RealtimeState {
  switch (action.type) {
    case 'SET_CONNECTION_STATUS':
      return {
        ...state,
        connectionStatus: action.payload,
        metrics: {
          ...state.metrics,
          reconnectCount: action.payload === 'reconnecting' 
            ? state.metrics.reconnectCount + 1 
            : state.metrics.reconnectCount
        }
      };
      
    case 'SET_ONLINE_STATUS':
      return {
        ...state,
        isOnline: action.payload
      };
      
    case 'UPDATE_SYNC_COUNT':
      return {
        ...state,
        syncCounts: {
          ...state.syncCounts,
          [action.payload.domain]: action.payload.count
        },
        lastSync: new Date(),
        metrics: {
          ...state.metrics,
          totalUpdates: state.metrics.totalUpdates + 1
        }
      };
      
    case 'ADD_CONFLICT':
      return {
        ...state,
        conflicts: [...state.conflicts, action.payload]
      };
      
    case 'RESOLVE_CONFLICT':
      return {
        ...state,
        conflicts: state.conflicts.map(conflict =>
          conflict.id === action.payload.id
            ? { ...conflict, resolved: true, resolution: action.payload.resolution }
            : conflict
        )
      };
      
    case 'UPDATE_METRICS':
      return {
        ...state,
        metrics: {
          ...state.metrics,
          ...action.payload
        }
      };
      
    case 'UPDATE_SETTINGS':
      return {
        ...state,
        settings: {
          ...state.settings,
          ...action.payload
        }
      };
      
    case 'RESET_CONFLICTS':
      return {
        ...state,
        conflicts: []
      };
      
    case 'SET_LAST_SYNC':
      return {
        ...state,
        lastSync: action.payload
      };
      
    default:
      return state;
  }
}

// Context
interface RealtimeContextType {
  state: RealtimeState;
  dispatch: React.Dispatch<RealtimeAction>;
  
  // Funções utilitárias
  updateSyncCount: (domain: keyof RealtimeState['syncCounts'], count: number) => void;
  addConflict: (conflict: Omit<RealtimeConflict, 'id' | 'timestamp' | 'resolved'>) => void;
  resolveConflict: (id: string, resolution: 'local' | 'server' | 'merge') => void;
  updateMetrics: (metrics: Partial<RealtimeState['metrics']>) => void;
  updateSettings: (settings: Partial<RealtimeState['settings']>) => void;
  resetConflicts: () => void;
  
  // Getters computados
  hasUnresolvedConflicts: boolean;
  isFullyConnected: boolean;
  totalSyncCount: number;
}

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined);

// Provider
interface RealtimeProviderProps {
  children: ReactNode;
  config?: {
    enableOptimisticUpdates?: boolean;
    enableRetry?: boolean;
    maxRetries?: number;
    retryDelay?: number;
    enableConflictResolution?: boolean;
  };
}

export function RealtimeProvider({ children, config }: RealtimeProviderProps) {
  const [state, dispatch] = useReducer(realtimeReducer, {
    ...initialState,
    settings: {
      ...initialState.settings,
      ...config
    }
  });

  // Monitorar status online/offline
  useEffect(() => {
    const handleOnline = () => dispatch({ type: 'SET_ONLINE_STATUS', payload: true });
    const handleOffline = () => dispatch({ type: 'SET_ONLINE_STATUS', payload: false });

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Funções utilitárias
  const updateSyncCount = (domain: keyof RealtimeState['syncCounts'], count: number) => {
    dispatch({ type: 'UPDATE_SYNC_COUNT', payload: { domain, count } });
  };

  const addConflict = (conflictData: Omit<RealtimeConflict, 'id' | 'timestamp' | 'resolved'>) => {
    const conflict: RealtimeConflict = {
      ...conflictData,
      id: `conflict_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      timestamp: new Date(),
      resolved: false
    };
    dispatch({ type: 'ADD_CONFLICT', payload: conflict });
  };

  const resolveConflict = (id: string, resolution: 'local' | 'server' | 'merge') => {
    dispatch({ type: 'RESOLVE_CONFLICT', payload: { id, resolution } });
  };

  const updateMetrics = (metrics: Partial<RealtimeState['metrics']>) => {
    dispatch({ type: 'UPDATE_METRICS', payload: metrics });
  };

  const updateSettings = (settings: Partial<RealtimeState['settings']>) => {
    dispatch({ type: 'UPDATE_SETTINGS', payload: settings });
  };

  const resetConflicts = () => {
    dispatch({ type: 'RESET_CONFLICTS' });
  };

  // Getters computados
  const hasUnresolvedConflicts = state.conflicts.some(conflict => !conflict.resolved);
  const isFullyConnected = state.isOnline && state.connectionStatus === 'connected';
  const totalSyncCount = Object.values(state.syncCounts).reduce((sum, count) => sum + count, 0);

  const contextValue: RealtimeContextType = {
    state,
    dispatch,
    updateSyncCount,
    addConflict,
    resolveConflict,
    updateMetrics,
    updateSettings,
    resetConflicts,
    hasUnresolvedConflicts,
    isFullyConnected,
    totalSyncCount
  };

  return (
    <RealtimeContext.Provider value={contextValue}>
      {children}
    </RealtimeContext.Provider>
  );
}

// Hook para usar o contexto
export function useRealtimeContext() {
  const context = useContext(RealtimeContext);
  if (context === undefined) {
    throw new Error('useRealtimeContext deve ser usado dentro de um RealtimeProvider');
  }
  return context;
}

// Hook para monitoramento de conflitos
export function useConflictMonitor() {
  const { state, addConflict, resolveConflict } = useRealtimeContext();
  
  const detectConflict = (
    type: RealtimeConflict['type'],
    entityId: string,
    localData: any,
    serverData: any
  ) => {
    // Lógica simples de detecção de conflito baseada em timestamps
    const localTimestamp = new Date(localData.updated_at || localData.created_at);
    const serverTimestamp = new Date(serverData.updated_at || serverData.created_at);
    
    // Se os dados são diferentes e foram modificados em tempos próximos (< 5 segundos)
    const timeDiff = Math.abs(localTimestamp.getTime() - serverTimestamp.getTime());
    const hasConflict = timeDiff < 5000 && JSON.stringify(localData) !== JSON.stringify(serverData);
    
    if (hasConflict) {
      addConflict({
        type,
        entityId,
        localData,
        serverData
      });
      return true;
    }
    
    return false;
  };
  
  const autoResolveConflict = (conflictId: string, strategy: 'latest' | 'server_wins' | 'local_wins' = 'latest') => {
    const conflict = state.conflicts.find(c => c.id === conflictId);
    if (!conflict || conflict.resolved) return;
    
    let resolution: 'local' | 'server' | 'merge';
    
    switch (strategy) {
      case 'server_wins':
        resolution = 'server';
        break;
      case 'local_wins':
        resolution = 'local';
        break;
      case 'latest':
      default:
        const localTime = new Date(conflict.localData.updated_at || conflict.localData.created_at);
        const serverTime = new Date(conflict.serverData.updated_at || conflict.serverData.created_at);
        resolution = localTime > serverTime ? 'local' : 'server';
        break;
    }
    
    resolveConflict(conflictId, resolution);
  };
  
  return {
    conflicts: state.conflicts,
    hasUnresolvedConflicts: state.conflicts.some(c => !c.resolved),
    detectConflict,
    resolveConflict,
    autoResolveConflict
  };
}

// Hook para métricas de performance
export function useRealtimeMetrics() {
  const { state, updateMetrics } = useRealtimeContext();
  
  const recordLatency = (latency: number) => {
    const currentAvg = state.metrics.averageLatency;
    const currentCount = state.metrics.totalUpdates;
    const newAvg = currentCount === 0 ? latency : (currentAvg * currentCount + latency) / (currentCount + 1);
    
    updateMetrics({
      averageLatency: newAvg
    });
  };
  
  const recordError = () => {
    updateMetrics({
      errorCount: state.metrics.errorCount + 1
    });
  };
  
  return {
    metrics: state.metrics,
    recordLatency,
    recordError
  };
}

export default RealtimeContext;