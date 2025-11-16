import { useState, useEffect, useCallback, useRef } from 'react';
import { useOfflineQueue } from './useOfflineQueue';
import { useNetworkStatus } from '../useNetworkStatus';
import { appCache, apiCache } from '../../lib/indexeddb';
import { supabase } from '../../lib/supabase';
import type { OfflineAction } from '../../types/realtime';

interface OfflineFirstConfig {
  table: string;
  cacheKey?: string;
  cacheTTL?: number;
  enableOptimisticUpdates?: boolean;
  syncOnReconnect?: boolean;
  retryFailedActions?: boolean;
}

interface OfflineFirstReturn<T> {
  data: T[];
  isLoading: boolean;
  isOffline: boolean;
  isSyncing: boolean;
  lastSyncAt: Date | null;
  error: Error | null;
  
  // Operações CRUD
  create: (item: Omit<T, 'id'>) => Promise<T>;
  update: (id: string, updates: Partial<T>) => Promise<T>;
  delete: (id: string) => Promise<void>;
  
  // Controle de cache
  refresh: () => Promise<void>;
  clearCache: () => Promise<void>;
  
  // Status da fila
  queueSize: number;
  pendingActions: number;
}

/**
 * Hook para implementar padrão offline-first com cache IndexedDB
 * Combina cache local, fila de ações offline e sincronização automática
 */
export function useOfflineFirst<T extends { id: string }>(
  config: OfflineFirstConfig
): OfflineFirstReturn<T> {
  const {
    table,
    cacheKey = table,
    cacheTTL = 24 * 60 * 60 * 1000, // 24 horas
    enableOptimisticUpdates = true,
    syncOnReconnect = true,
    retryFailedActions = true
  } = config;

  const { isOnline } = useNetworkStatus();
  const {
    queuedActions,
    queueSize,
    isProcessing,
    addToQueue,
    processQueue,
    retryFailedActions: retryQueue
  } = useOfflineQueue({
    autoProcess: true,
    processInterval: 30000
  });

  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [error, setError] = useState<Error | null>(null);
  
  const lastOnlineRef = useRef(isOnline);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Carregar dados do cache ou servidor
  const loadData = useCallback(async (forceRefresh = false) => {
    try {
      setIsLoading(true);
      setError(null);

      // Tentar carregar do cache primeiro
      if (!forceRefresh) {
        const cachedData = await appCache.get<T[]>(table, cacheKey);
        if (cachedData) {
          setData(cachedData);
          setIsLoading(false);
          
          // Se offline, usar apenas dados do cache
          if (!isOnline) {
            return;
          }
        }
      }

      // Se online, buscar dados atualizados do servidor
      if (isOnline) {
        setIsSyncing(true);
        
        const { data: serverData, error: fetchError } = await supabase
          .from(table)
          .select('*')
          .order('created_at', { ascending: false });

        if (fetchError) {
          throw fetchError;
        }

        if (serverData) {
          // Atualizar cache
          await appCache.set(table, cacheKey, serverData, cacheTTL);
          
          // Aplicar ações pendentes otimisticamente
          const dataWithPendingActions = applyPendingActions(serverData);
          setData(dataWithPendingActions);
          setLastSyncAt(new Date());
        }
      }
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      setError(err as Error);
      
      // Em caso de erro, tentar usar dados do cache
      const cachedData = await appCache.get<T[]>(table, cacheKey);
      if (cachedData) {
        setData(cachedData);
      }
    } finally {
      setIsLoading(false);
      setIsSyncing(false);
    }
  }, [table, cacheKey, cacheTTL, isOnline]);

  // Aplicar ações pendentes aos dados para updates otimistas
  const applyPendingActions = useCallback((baseData: T[]): T[] => {
    if (!enableOptimisticUpdates) {
      return baseData;
    }

    const pendingActions = queuedActions.filter(
      action => action.table === table && action.status === 'pending'
    );

    let result = [...baseData];

    pendingActions.forEach(action => {
      switch (action.type) {
        case 'insert':
          // Adicionar item temporário com ID gerado
          const tempItem = {
            ...action.data,
            id: action.id, // Usar ID da ação como temporário
            _isPending: true
          } as T & { _isPending?: boolean };
          result = [tempItem, ...result];
          break;

        case 'update':
          if (action.filter?.id) {
            result = result.map(item => 
              item.id === action.filter!.id 
                ? { ...item, ...action.data, _isPending: true }
                : item
            );
          }
          break;

        case 'delete':
          if (action.filter?.id) {
            result = result.filter(item => item.id !== action.filter!.id);
          }
          break;
      }
    });

    return result;
  }, [enableOptimisticUpdates, queuedActions, table]);

  // Criar novo item
  const create = useCallback(async (item: Omit<T, 'id'>): Promise<T> => {
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const newItem = { ...item, id: tempId } as T;

    if (isOnline) {
      try {
        const { data: createdItem, error } = await supabase
          .from(table)
          .insert(item)
          .select()
          .single();

        if (error) throw error;

        // Atualizar cache
        const updatedData = [createdItem, ...data.filter(d => d.id !== tempId)];
        setData(updatedData);
        await appCache.set(table, cacheKey, updatedData, cacheTTL);

        return createdItem;
      } catch (error) {
        // Se falhar, adicionar à fila offline
        await addToQueue({
          type: 'insert',
          table,
          data: item,
          priority: 'normal'
        });
        
        // Update otimista
        if (enableOptimisticUpdates) {
          setData(prev => [newItem, ...prev]);
        }
        
        throw error;
      }
    } else {
      // Offline: adicionar à fila e fazer update otimista
      await addToQueue({
        type: 'insert',
        table,
        data: item,
        priority: 'normal'
      });

      if (enableOptimisticUpdates) {
        const updatedData = [newItem, ...data];
        setData(updatedData);
        await appCache.set(table, cacheKey, updatedData, cacheTTL);
      }

      return newItem;
    }
  }, [isOnline, table, data, cacheKey, cacheTTL, addToQueue, enableOptimisticUpdates]);

  // Atualizar item
  const update = useCallback(async (id: string, updates: Partial<T>): Promise<T> => {
    const existingItem = data.find(item => item.id === id);
    if (!existingItem) {
      throw new Error('Item não encontrado');
    }

    const updatedItem = { ...existingItem, ...updates };

    if (isOnline) {
      try {
        const { data: serverUpdatedItem, error } = await supabase
          .from(table)
          .update(updates)
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;

        // Atualizar cache
        const updatedData = data.map(item => 
          item.id === id ? serverUpdatedItem : item
        );
        setData(updatedData);
        await appCache.set(table, cacheKey, updatedData, cacheTTL);

        return serverUpdatedItem;
      } catch (error) {
        // Se falhar, adicionar à fila offline
        await addToQueue({
          type: 'update',
          table,
          data: updates,
          filter: { id },
          priority: 'normal'
        });
        
        // Update otimista
        if (enableOptimisticUpdates) {
          const updatedData = data.map(item => 
            item.id === id ? updatedItem : item
          );
          setData(updatedData);
          await appCache.set(table, cacheKey, updatedData, cacheTTL);
        }
        
        throw error;
      }
    } else {
      // Offline: adicionar à fila e fazer update otimista
      await addToQueue({
        type: 'update',
        table,
        data: updates,
        filter: { id },
        priority: 'normal'
      });

      if (enableOptimisticUpdates) {
        const updatedData = data.map(item => 
          item.id === id ? updatedItem : item
        );
        setData(updatedData);
        await appCache.set(table, cacheKey, updatedData, cacheTTL);
      }

      return updatedItem;
    }
  }, [isOnline, table, data, cacheKey, cacheTTL, addToQueue, enableOptimisticUpdates]);

  // Deletar item
  const deleteItem = useCallback(async (id: string): Promise<void> => {
    if (isOnline) {
      try {
        const { error } = await supabase
          .from(table)
          .delete()
          .eq('id', id);

        if (error) throw error;

        // Atualizar cache
        const updatedData = data.filter(item => item.id !== id);
        setData(updatedData);
        await appCache.set(table, cacheKey, updatedData, cacheTTL);
      } catch (error) {
        // Se falhar, adicionar à fila offline
        await addToQueue({
          type: 'delete',
          table,
          filter: { id },
          priority: 'high' // Deletes têm prioridade alta
        });
        
        // Update otimista
        if (enableOptimisticUpdates) {
          const updatedData = data.filter(item => item.id !== id);
          setData(updatedData);
          await appCache.set(table, cacheKey, updatedData, cacheTTL);
        }
        
        throw error;
      }
    } else {
      // Offline: adicionar à fila e fazer update otimista
      await addToQueue({
        type: 'delete',
        table,
        filter: { id },
        priority: 'high'
      });

      if (enableOptimisticUpdates) {
        const updatedData = data.filter(item => item.id !== id);
        setData(updatedData);
        await appCache.set(table, cacheKey, updatedData, cacheTTL);
      }
    }
  }, [isOnline, table, data, cacheKey, cacheTTL, addToQueue, enableOptimisticUpdates]);

  // Atualizar dados do servidor
  const refresh = useCallback(async () => {
    await loadData(true);
  }, [loadData]);

  // Limpar cache
  const clearCache = useCallback(async () => {
    await appCache.delete(table, cacheKey);
    await apiCache.clearAll();
  }, [table, cacheKey]);

  // Carregar dados na inicialização
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Sincronizar quando volta online
  useEffect(() => {
    const wasOffline = !lastOnlineRef.current;
    const isNowOnline = isOnline;
    
    if (wasOffline && isNowOnline && syncOnReconnect) {
      // Debounce para evitar múltiplas sincronizações
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
      
      syncTimeoutRef.current = setTimeout(async () => {
        try {
          // Processar fila de ações pendentes
          await processQueue();
          
          // Tentar novamente ações falhadas se habilitado
          if (retryFailedActions) {
            await retryQueue();
          }
          
          // Atualizar dados do servidor
          await refresh();
        } catch (error) {
          console.error('Erro na sincronização:', error);
        }
      }, 1000); // 1 segundo de debounce
    }
    
    lastOnlineRef.current = isOnline;
    
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [isOnline, syncOnReconnect, processQueue, retryFailedActions, retryQueue, refresh]);

  // Aplicar ações pendentes quando a fila muda
  useEffect(() => {
    if (enableOptimisticUpdates && data.length > 0) {
      const updatedData = applyPendingActions(data);
      if (JSON.stringify(updatedData) !== JSON.stringify(data)) {
        setData(updatedData);
      }
    }
  }, [queuedActions, enableOptimisticUpdates, applyPendingActions]);

  const pendingActions = queuedActions.filter(
    action => action.table === table && action.status === 'pending'
  ).length;

  return {
    data,
    isLoading,
    isOffline: !isOnline,
    isSyncing: isSyncing || isProcessing,
    lastSyncAt,
    error,
    create,
    update,
    delete: deleteItem,
    refresh,
    clearCache,
    queueSize,
    pendingActions
  };
}