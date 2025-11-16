import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useNetworkStatus } from '../useNetworkStatus';
import { useNotification } from '../useNotification';
import type { OfflineAction, QueuedAction, OfflineQueueConfig } from '../../types/realtime';

interface UseOfflineQueueReturn {
  queuedActions: QueuedAction[];
  queueSize: number;
  isProcessing: boolean;
  lastProcessedAt: Date | null;
  addToQueue: (action: OfflineAction) => Promise<void>;
  processQueue: () => Promise<void>;
  retryFailedActions: () => Promise<void>;
  clearQueue: (status?: 'all' | 'completed' | 'failed', table?: string) => Promise<void>;
  getQueuedActionsByType: (type: OfflineAction['type']) => QueuedAction[];
  getQueuedActionsByTable: (table: string) => QueuedAction[];
  getQueuedActionsByStatus: (status: QueuedAction['status']) => QueuedAction[];
  getQueuedActionsByPriority: (priority: OfflineAction['priority']) => QueuedAction[];
  // Propriedades adicionais para compatibilidade
  enqueueOperation: (operation: OfflineAction) => Promise<void>;
  queuedOperations: QueuedAction[];
  isOffline: boolean;
}

const DEFAULT_CONFIG: Required<OfflineQueueConfig> = {
  autoProcess: true,
  processInterval: 30000, // 30 segundos
  maxRetries: 3,
  retryDelay: 1000, // 1 segundo
  batchSize: 10
};

const STORAGE_KEY = 'offline_queue';

/**
 * Hook para gerenciar fila de ações offline com cache IndexedDB
 * Implementa padrão offline-first com sincronização automática
 */
export function useOfflineQueue(config: OfflineQueueConfig = {}): UseOfflineQueueReturn {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const { isOnline } = useNetworkStatus();
  const { showNotification } = useNotification();
  
  const [queuedActions, setQueuedActions] = useState<QueuedAction[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastProcessedAt, setLastProcessedAt] = useState<Date | null>(null);
  
  const processIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializedRef = useRef(false);

  // Carregar fila do localStorage na inicialização
  useEffect(() => {
    if (isInitializedRef.current) return;
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as QueuedAction[];
        // Migrar formato antigo se necessário
        const migrated = parsed.map(action => ({
          ...action,
          priority: action.priority || 'normal',
          status: action.status || 'pending',
          timestamp: new Date(action.timestamp),
          lastAttempt: action.lastAttempt ? new Date(action.lastAttempt) : undefined
        }));
        setQueuedActions(migrated);
      }
    } catch (error) {
      console.warn('Erro ao carregar fila offline:', error);
      setQueuedActions([]);
    }
    
    isInitializedRef.current = true;
  }, []);

  // Persistir fila no localStorage
  const persistQueue = useCallback((actions: QueuedAction[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(actions));
    } catch (error) {
      console.warn('Erro ao persistir fila offline:', error);
    }
  }, []);

  // Gerar ID único para ação
  const generateActionId = useCallback(() => {
    return `action_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }, []);

  // Determinar prioridade baseada no tipo de ação
  const getActionPriority = useCallback((type: OfflineAction['type']): OfflineAction['priority'] => {
    switch (type) {
      case 'delete':
        return 'high';
      case 'update':
        return 'normal';
      case 'insert':
      case 'upsert':
      default:
        return 'normal';
    }
  }, []);

  // Adicionar ação à fila
  const addToQueue = useCallback(async (action: OfflineAction) => {
    const queuedAction: QueuedAction = {
      ...action,
      id: generateActionId(),
      timestamp: new Date(),
      retryCount: 0,
      maxRetries: finalConfig.maxRetries,
      status: 'pending',
      priority: action.priority || getActionPriority(action.type)
    };

    setQueuedActions(prev => {
      const updated = [...prev, queuedAction];
      persistQueue(updated);
      return updated;
    });
  }, [generateActionId, getActionPriority, finalConfig.maxRetries, persistQueue]);

  // Processar uma ação específica
  const processAction = useCallback(async (action: QueuedAction): Promise<boolean> => {
    try {
      let query = supabase.from(action.table);
      
      switch (action.type) {
        case 'insert':
          const insertResult = await query.insert(action.data);
          if (insertResult.error) throw insertResult.error;
          break;
          
        case 'update':
          let updateQuery = query.update(action.data);
          if (action.filter) {
            Object.entries(action.filter).forEach(([key, value]) => {
              updateQuery = updateQuery.eq(key, value);
            });
          }
          const updateResult = await updateQuery;
          if (updateResult.error) throw updateResult.error;
          break;
          
        case 'delete':
          let deleteQuery = query.delete();
          if (action.filter) {
            Object.entries(action.filter).forEach(([key, value]) => {
              deleteQuery = deleteQuery.eq(key, value);
            });
          }
          const deleteResult = await deleteQuery;
          if (deleteResult.error) throw deleteResult.error;
          break;
          
        case 'upsert':
          const upsertResult = await query.upsert(action.data);
          if (upsertResult.error) throw upsertResult.error;
          break;
          
        default:
          throw new Error(`Tipo de ação não suportado: ${action.type}`);
      }
      
      return true;
    } catch (error) {
      console.error(`Erro ao processar ação ${action.id}:`, error);
      
      // Mostrar notificação de erro específica
      if (error.code === '23505') {
        showNotification(`Erro de validação: ${error.message}`, {
          type: 'error',
          duration: 5000
        });
      }
      
      return false;
    }
  }, [showNotification]);

  // Aplicar backoff exponencial
  const applyBackoff = useCallback(async (retryCount: number) => {
    const delay = finalConfig.retryDelay * Math.pow(2, retryCount);
    await new Promise(resolve => setTimeout(resolve, delay));
  }, [finalConfig.retryDelay]);

  // Processar fila completa
  const processQueue = useCallback(async () => {
    if (isProcessing || !isOnline) return;
    
    setIsProcessing(true);
    
    try {
      // Ordenar por prioridade e timestamp
      const sortedActions = [...queuedActions]
        .filter(action => action.status === 'pending')
        .sort((a, b) => {
          const priorityOrder = { high: 3, normal: 2, low: 1 };
          const aPriority = priorityOrder[a.priority || 'normal'];
          const bPriority = priorityOrder[b.priority || 'normal'];
          
          if (aPriority !== bPriority) {
            return bPriority - aPriority; // Prioridade alta primeiro
          }
          
          return a.timestamp.getTime() - b.timestamp.getTime(); // Mais antigo primeiro
        })
        .slice(0, finalConfig.batchSize);

      const updatedActions = [...queuedActions];
      
      for (const action of sortedActions) {
        const actionIndex = updatedActions.findIndex(a => a.id === action.id);
        if (actionIndex === -1) continue;
        
        // Marcar como processando
        updatedActions[actionIndex] = {
          ...updatedActions[actionIndex],
          status: 'processing',
          lastAttempt: new Date()
        };
        
        const success = await processAction(action);
        
        if (success) {
          // Remover ação processada com sucesso
          updatedActions.splice(actionIndex, 1);
        } else {
          // Incrementar contador de retry
          const updatedAction = {
            ...updatedActions[actionIndex],
            retryCount: updatedActions[actionIndex].retryCount + 1,
            status: 'failed' as const
          };
          
          // Remover se excedeu tentativas máximas
          if (updatedAction.retryCount >= updatedAction.maxRetries) {
            updatedActions.splice(actionIndex, 1);
            showNotification('Ação falhou após 3 tentativas e foi removida da fila', {
              type: 'error',
              duration: 5000
            });
          } else {
            updatedActions[actionIndex] = updatedAction;
          }
        }
      }
      
      setQueuedActions(updatedActions);
      persistQueue(updatedActions);
      setLastProcessedAt(new Date());
      
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, isOnline, queuedActions, finalConfig.batchSize, processAction, persistQueue, showNotification]);

  // Tentar novamente ações falhadas
  const retryFailedActions = useCallback(async () => {
    const failedActions = queuedActions.filter(action => action.status === 'failed');
    
    const updatedActions = queuedActions.map(action => {
      if (action.status === 'failed') {
        return {
          ...action,
          status: 'pending' as const
        };
      }
      return action;
    });
    
    setQueuedActions(updatedActions);
    persistQueue(updatedActions);
    
    // Aplicar backoff para ações com múltiplas tentativas
    for (const action of failedActions) {
      if (action.retryCount > 0) {
        await applyBackoff(action.retryCount);
      }
    }
    
    await processQueue();
  }, [queuedActions, persistQueue, applyBackoff, processQueue]);

  // Limpar fila
  const clearQueue = useCallback(async (status: 'all' | 'completed' | 'failed' = 'all', table?: string) => {
    let filtered = queuedActions;
    
    if (status !== 'all') {
      filtered = filtered.filter(action => action.status !== status);
    } else {
      filtered = [];
    }
    
    if (table) {
      filtered = queuedActions.filter(action => action.table !== table);
    }
    
    setQueuedActions(filtered);
    persistQueue(filtered);
  }, [queuedActions, persistQueue]);

  // Filtros de consulta
  const getQueuedActionsByType = useCallback((type: OfflineAction['type']) => {
    return queuedActions.filter(action => action.type === type);
  }, [queuedActions]);

  const getQueuedActionsByTable = useCallback((table: string) => {
    return queuedActions.filter(action => action.table === table);
  }, [queuedActions]);

  const getQueuedActionsByStatus = useCallback((status: QueuedAction['status']) => {
    return queuedActions.filter(action => action.status === status);
  }, [queuedActions]);

  const getQueuedActionsByPriority = useCallback((priority: OfflineAction['priority']) => {
    return queuedActions.filter(action => action.priority === priority);
  }, [queuedActions]);

  // Processamento automático
  useEffect(() => {
    if (!finalConfig.autoProcess) return;
    
    if (isOnline && queuedActions.length > 0) {
      // Processar imediatamente quando volta online
      processQueue();
      
      // Configurar processamento periódico
      if (processIntervalRef.current) {
        clearInterval(processIntervalRef.current);
      }
      
      processIntervalRef.current = setInterval(() => {
        if (isOnline && queuedActions.length > 0) {
          processQueue();
        }
      }, finalConfig.processInterval);
    } else {
      // Parar processamento quando offline
      if (processIntervalRef.current) {
        clearInterval(processIntervalRef.current);
        processIntervalRef.current = null;
      }
    }
    
    return () => {
      if (processIntervalRef.current) {
        clearInterval(processIntervalRef.current);
      }
    };
  }, [finalConfig.autoProcess, finalConfig.processInterval, isOnline, queuedActions.length, processQueue]);

  return {
    queuedActions,
    queueSize: queuedActions.length,
    isProcessing,
    lastProcessedAt,
    addToQueue,
    processQueue,
    retryFailedActions,
    clearQueue,
    getQueuedActionsByType,
    getQueuedActionsByTable,
    getQueuedActionsByStatus,
    getQueuedActionsByPriority,
    // Propriedades adicionais para compatibilidade
    enqueueOperation: addToQueue,
    queuedOperations: queuedActions,
    isOffline: !isOnline
  };
}