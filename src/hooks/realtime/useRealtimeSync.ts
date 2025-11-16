import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

// Tipo para resultado com tratamento de erro obrigatório
type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

// Status de conexão
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error' | 'reconnecting';

// Interface para configuração do hook
export interface RealtimeSyncOptions<T> {
  table: string;
  filter?: string;
  select?: string;
  orderBy?: string;
  limit?: number;
  enableOptimistic?: boolean;
  enableRetry?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  onUpdate?: (data: T) => void;
  onError?: (error: Error) => void;
  onConnectionChange?: (status: ConnectionStatus) => void;
}

// Interface para retorno do hook
export interface RealtimeSyncReturn<T> {
  data: T[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
  subscribe: () => void;
  unsubscribe: () => void;
  isConnected: boolean;
  connectionStatus: ConnectionStatus;
  optimisticUpdate: (item: Partial<T> & { id: string }, operation: 'insert' | 'update' | 'delete') => void;
  rollbackOptimistic: (id: string) => void;
  metrics: {
    totalUpdates: number;
    lastUpdate: Date | null;
    reconnectCount: number;
  };
}

// Interface para configuração do hook (compatibilidade)
interface UseRealtimeSyncOptions<T> extends RealtimeSyncOptions<T> {}

// Interface para retorno do hook (compatibilidade)
interface UseRealtimeSyncReturn<T> extends RealtimeSyncReturn<T> {}

/**
 * Hook principal para sincronização em tempo real com Supabase
 * Implementa padrões obrigatórios do PRD com tratamento robusto de erros
 */
export function useRealtimeSync<T = any>(options: UseRealtimeSyncOptions<T>): UseRealtimeSyncReturn<T> {
  const {
    table,
    filter,
    select = '*',
    orderBy,
    limit,
    enableOptimistic = true,
    enableRetry = true,
    maxRetries = 3,
    retryDelay = 1000,
    onUpdate,
    onError,
    onConnectionChange
  } = options;

  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [optimisticData, setOptimisticData] = useState<Map<string, { item: Partial<T> & { id: string }, operation: 'insert' | 'update' | 'delete' }>>(new Map());
  const [metrics, setMetrics] = useState({
    totalUpdates: 0,
    lastUpdate: null as Date | null,
    reconnectCount: 0
  });
  
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isSubscribedRef = useRef(false);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Função para atualizar status de conexão
  const updateConnectionStatus = useCallback((status: ConnectionStatus) => {
    setConnectionStatus(status);
    setIsConnected(status === 'connected');
    onConnectionChange?.(status);
  }, [onConnectionChange]);

  // Função para buscar dados iniciais
  const fetchInitialData = useCallback(async () => {
    console.log('[DEBUG useRealtimeSync] fetchInitialData iniciada', { table, filter, orderBy, limit });
    setLoading(true);
    setError(null);

    try {
      // Respeitar seleção personalizada (joins/colunas específicas)
      let query = supabase.from(table).select(select);
      console.log('[DEBUG useRealtimeSync] Query inicial criada para tabela:', table);

      // Apply filters
      if (filter) {
        console.log('[DEBUG useRealtimeSync] Aplicando filtros:', filter);
        // Parse filter string into individual filters
        const filters = typeof filter === 'string' ? filter.split(',') : filter;
        
        filters.forEach((filterItem: string) => {
          // Parse filter format: column=operator.value
          const [column, operatorAndValue] = filterItem.split('=');
          const [operator, value] = operatorAndValue.split('.');
          console.log('[DEBUG useRealtimeSync] Aplicando filtro:', { column, operator, value });
          
          if (operator === 'eq') {
            query = query.eq(column, value === 'true' ? true : value === 'false' ? false : value);
          } else if (operator === 'neq') {
            query = query.neq(column, value === 'true' ? true : value === 'false' ? false : value);
          } else if (operator === 'gt') {
            query = query.gt(column, value);
          } else if (operator === 'gte') {
            query = query.gte(column, value);
          } else if (operator === 'lt') {
            query = query.lt(column, value);
          } else if (operator === 'lte') {
            query = query.lte(column, value);
          } else if (operator === 'like') {
            query = query.like(column, value);
          } else if (operator === 'ilike') {
            query = query.ilike(column, value);
          } else if (operator === 'in') {
            query = query.in(column, value.split(','));
          }
        });
      }

      // Apply ordering
      if (orderBy) {
        console.log('[DEBUG useRealtimeSync] Aplicando ordenação:', orderBy);
        const [column, direction] = orderBy.split(':');
        query = query.order(column, { ascending: direction !== 'desc' });
      }

      // Apply limit
      if (limit) {
        console.log('[DEBUG useRealtimeSync] Aplicando limite:', limit);
        query = query.limit(limit);
      }

      console.log('[DEBUG useRealtimeSync] Executando query...');
      const { data, error } = await query;

      if (error) {
        console.error('[DEBUG useRealtimeSync] Erro na query:', error);
        throw error;
      }

      console.log('[DEBUG useRealtimeSync] Query executada com sucesso. Dados recebidos:', data?.length || 0, 'registros');
      console.log('[DEBUG useRealtimeSync] Primeiros 3 registros:', data?.slice(0, 3));

      setData(data || []);
      setMetrics(prev => ({ ...prev, lastUpdate: new Date() }));
      console.log('[DEBUG useRealtimeSync] Estado atualizado com sucesso');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('[DEBUG useRealtimeSync] Erro capturado:', errorMessage);
      setError(new Error(errorMessage));
      
      // Retry logic
      if (retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        console.log('[DEBUG useRealtimeSync] Tentando novamente em', retryDelay, 'ms. Tentativa:', retryCountRef.current);
        setTimeout(() => {
          fetchInitialData();
        }, retryDelay);
      } else {
        console.log('[DEBUG useRealtimeSync] Máximo de tentativas atingido:', maxRetries);
      }
    } finally {
      console.log('[DEBUG useRealtimeSync] fetchInitialData finalizada. Loading:', false);
      setLoading(false);
    }
  }, [table, filter, orderBy, limit, maxRetries, retryDelay]);

  // Função para optimistic updates
  const optimisticUpdate = useCallback((item: Partial<T> & { id: string }, operation: 'insert' | 'update' | 'delete') => {
    if (!enableOptimistic) return;
    
    const optimisticId = `optimistic_${item.id}_${Date.now()}`;
    
    setOptimisticData(prev => new Map(prev.set(optimisticId, { item, operation })));
    
    setData(currentData => {
      let updatedData = [...currentData];
      
      switch (operation) {
        case 'insert':
          updatedData.push({ ...item, __optimistic: true } as T);
          break;
          
        case 'update':
          const updateIndex = updatedData.findIndex((data: any) => data.id === item.id);
          if (updateIndex !== -1) {
            updatedData[updateIndex] = { ...updatedData[updateIndex], ...item, __optimistic: true };
          }
          break;
          
        case 'delete':
          updatedData = updatedData.filter((data: any) => data.id !== item.id);
          break;
      }
      
      return updatedData;
    });
    
    // Auto-rollback após 5 segundos se não confirmado
    setTimeout(() => {
      rollbackOptimistic(optimisticId);
    }, 5000);
    
  }, [enableOptimistic]);
  
  // Função para rollback de optimistic updates
  const rollbackOptimistic = useCallback((optimisticId: string) => {
    const optimisticItem = optimisticData.get(optimisticId);
    if (!optimisticItem) return;
    
    setOptimisticData(prev => {
      const newMap = new Map(prev);
      newMap.delete(optimisticId);
      return newMap;
    });
    
    // Evitar loop infinito - não refetch automaticamente
    // fetchInitialData();
  }, [optimisticData]);

  // Função para processar mudanças em tempo real
  const handleRealtimeChange = useCallback((payload: RealtimePostgresChangesPayload<T>) => {
    try {
      const { eventType, new: newRecord, old: oldRecord } = payload;
      
      // Remove optimistic updates confirmados
      if (newRecord && (newRecord as any).id) {
        setOptimisticData(prev => {
          const newMap = new Map(prev);
          for (const [key, value] of prev.entries()) {
            if (value.item.id === (newRecord as any).id) {
              newMap.delete(key);
            }
          }
          return newMap;
        });
      }
      
      setData(currentData => {
        let updatedData = [...currentData];
        
        switch (eventType) {
          case 'INSERT':
            if (newRecord) {
              // Evita duplicatas e remove versões otimistas
              updatedData = updatedData.filter((item: any) => 
                item.id !== (newRecord as any).id || item.__optimistic
              );
              updatedData.push(newRecord);
            }
            break;
            
          case 'UPDATE':
            if (newRecord) {
              const index = updatedData.findIndex((item: any) => item.id === (newRecord as any).id);
              if (index !== -1) {
                updatedData[index] = newRecord;
              }
            }
            break;
            
          case 'DELETE':
            if (oldRecord) {
              updatedData = updatedData.filter((item: any) => item.id !== (oldRecord as any).id);
            }
            break;
        }
        
        return updatedData;
      });
      
      // Atualizar métricas
      setMetrics(prev => ({
        ...prev,
        totalUpdates: prev.totalUpdates + 1,
        lastUpdate: new Date()
      }));
      
      // Callback personalizado para mudanças
      if (newRecord) {
        onUpdate?.(newRecord as T);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Erro ao processar mudança em tempo real');
      setError(error);
      onError?.(error);
    }
  }, [enableOptimistic, onUpdate, onError]);

  // Função para se inscrever no canal realtime
  const subscribe = useCallback(() => {
    if (isSubscribedRef.current || channelRef.current) {
      return;
    }

    try {
      const channelName = `realtime:${table}${filter ? `:${filter}` : ''}`;
      const channel = supabase.channel(channelName);
      
      // Configurar listener para mudanças na tabela
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table,
          ...(filter && { filter })
        },
        handleRealtimeChange
      );
      
      // Configurar listeners de status da conexão
      channel.on('system', {}, (payload) => {
        if (payload.status === 'SUBSCRIBED') {
          setIsConnected(true);
          setError(null);
        } else if (payload.status === 'CHANNEL_ERROR') {
          setIsConnected(false);
          const error = new Error(`Erro no canal realtime: ${payload.message || 'Desconhecido'}`);
          setError(error);
          onError?.(error);
        }
      });
      
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setIsConnected(true);
          isSubscribedRef.current = true;
        } else if (status === 'CHANNEL_ERROR') {
          setIsConnected(false);
          isSubscribedRef.current = false;
        }
      });
      
      channelRef.current = channel;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Erro ao se inscrever no canal realtime');
      setError(error);
      setIsConnected(false);
      onError?.(error);
    }
  }, [table, filter, handleRealtimeChange, onError]);

  // Função para cancelar inscrição
  const unsubscribe = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
      isSubscribedRef.current = false;
      setIsConnected(false);
    }
  }, []);

  // Função para recarregar dados
  const refetch = useCallback(() => {
    // Evitar loop infinito - usar uma versão simplificada
    const simpleRefetch = async () => {
      try {
        setLoading(true);
        let query = supabase.from(table).select(select);
        
        if (filter) {
          const filterParts = filter.split(',');
          filterParts.forEach(filterPart => {
            // Formato esperado: column=operator.value
            const [column, operatorAndValue] = filterPart.split('=');
            const [operator, value] = operatorAndValue.split('.');
            if (column && operator && value) {
              // Mapear operadores conhecidos
              switch (operator) {
                case 'eq':
                  query = query.eq(column, value === 'true' ? true : value === 'false' ? false : value);
                  break;
                case 'neq':
                  query = query.neq(column, value === 'true' ? true : value === 'false' ? false : value);
                  break;
                case 'gt':
                  query = query.gt(column, value);
                  break;
                case 'gte':
                  query = query.gte(column, value);
                  break;
                case 'lt':
                  query = query.lt(column, value);
                  break;
                case 'lte':
                  query = query.lte(column, value);
                  break;
                case 'like':
                  query = query.like(column, value);
                  break;
                case 'ilike':
                  query = query.ilike(column, value);
                  break;
                case 'in':
                  query = query.in(column, value.split(','));
                  break;
                default:
                  // Fallback genérico
                  query = query.filter(column, operator as any, value);
              }
            }
          });
        }
        
        if (orderBy) {
          const [column, ascending = 'asc'] = orderBy.split(':');
          query = query.order(column, { ascending: ascending === 'asc' });
        }
        
        if (limit) {
          query = query.limit(limit);
        }

        const { data: refetchData, error: refetchError } = await query;
        
        if (!refetchError) {
          setData(refetchData || []);
        }
      } catch (err) {
        console.error('Erro no refetch:', err);
      } finally {
        setLoading(false);
      }
    };
    
    simpleRefetch();
  }, [table, select, filter, orderBy, limit]);

  // useEffect principal
  useEffect(() => {
    fetchInitialData();
    subscribe();
    
    return () => {
      unsubscribe();
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, []);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      unsubscribe();
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [unsubscribe]);
  
  // Cleanup de timeouts quando componente desmonta
  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, []);

  return {
    data,
    loading,
    error,
    refetch,
    subscribe,
    unsubscribe,
    isConnected,
    connectionStatus,
    optimisticUpdate,
    rollbackOptimistic,
    metrics
  };
}

// Hook para status de conexão e métricas
export function useConnectionStatus() {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [latency, setLatency] = useState(0);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [lastSync, setLastSync] = useState<Date>(new Date());
  
  useEffect(() => {
    // Monitorar status da conexão Supabase
    const checkConnection = async () => {
      const startTime = Date.now();
      try {
        setConnectionStatus('connecting');
        const { error } = await supabase.from('products').select('id').limit(1);
        const endTime = Date.now();
        
        if (!error) {
          setIsConnected(true);
          setConnectionStatus('connected');
          setLatency(endTime - startTime);
          setLastSync(new Date());
          setReconnectAttempts(0);
        } else {
          setIsConnected(false);
          setConnectionStatus('error');
          setReconnectAttempts(prev => prev + 1);
        }
      } catch {
        setIsConnected(false);
        setConnectionStatus('disconnected');
        setReconnectAttempts(prev => prev + 1);
      }
    };
    
    // Verificar conexão a cada 30 segundos
    const interval = setInterval(checkConnection, 30000);
    checkConnection(); // Verificação inicial
    
    return () => clearInterval(interval);
  }, []);
  
  return {
    isConnected,
    connectionStatus,
    latency,
    reconnectAttempts,
    lastSync
  };
}