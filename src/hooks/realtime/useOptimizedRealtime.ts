import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useJWTManager } from '../useJWTManager';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

interface UseOptimizedRealtimeOptions<T = any> {
  table: string;
  schema?: string;
  filter?: string;
  events?: RealtimeEvent[];
  onInsert?: (payload: RealtimePostgresChangesPayload<T>) => void;
  onUpdate?: (payload: RealtimePostgresChangesPayload<T>) => void;
  onDelete?: (payload: RealtimePostgresChangesPayload<T>) => void;
  onError?: (error: Error) => void;
  enabled?: boolean;
  reconnectOnTokenRefresh?: boolean;
}

interface RealtimeStatus {
  connected: boolean;
  subscribed: boolean;
  lastHeartbeat: number | null;
  reconnectAttempts: number;
  error: string | null;
}

/**
 * Hook otimizado para sincronização realtime com gestão inteligente de tokens JWT
 * 
 * Funcionalidades:
 * - Reconexão automática quando token é renovado
 * - Gestão eficiente de conexões WebSocket
 * - Debouncing de reconexões
 * - Status detalhado da conexão
 * - Cleanup automático de recursos
 */
export function useOptimizedRealtime<T = any>(options: UseOptimizedRealtimeOptions<T>) {
  const {
    table,
    schema = 'public',
    filter,
    events = ['*'],
    onInsert,
    onUpdate,
    onDelete,
    onError,
    enabled = true,
    reconnectOnTokenRefresh = true
  } = options;

  const { getValidToken, isAuthenticated, tokenInfo } = useJWTManager();
  
  const [status, setStatus] = useState<RealtimeStatus>({
    connected: false,
    subscribed: false,
    lastHeartbeat: null,
    reconnectAttempts: 0,
    error: null
  });

  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTokenRef = useRef<string | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Limpa recursos da conexão atual
   */
  const cleanup = useCallback(() => {
    if (channelRef.current) {
      console.log(`🧹 Cleaning up realtime channel: ${table}`);
      
      try {
        channelRef.current.unsubscribe();
      } catch (error) {
        console.warn('Error unsubscribing from channel:', error);
      }
      
      channelRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    setStatus(prev => ({
      ...prev,
      connected: false,
      subscribed: false,
      error: null
    }));
  }, [table]);

  /**
   * Configura heartbeat para monitorar conexão
   */
  const setupHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }

    heartbeatIntervalRef.current = setInterval(() => {
      setStatus(prev => ({
        ...prev,
        lastHeartbeat: Date.now()
      }));
    }, 30000); // Heartbeat a cada 30 segundos
  }, []);

  /**
   * Conecta ao canal realtime com token válido
   */
  const connect = useCallback(async () => {
    if (!enabled || !isAuthenticated()) {
      console.log(`⏸️ Realtime disabled or not authenticated for table: ${table}`);
      return;
    }

    try {
      // Obter token válido antes de conectar
      const token = await getValidToken();
      
      if (!token) {
        throw new Error('No valid token available');
      }

      // Se já existe uma conexão com o mesmo token, não reconectar
      if (channelRef.current && lastTokenRef.current === token) {
        console.log(`♻️ Reusing existing connection for table: ${table}`);
        return;
      }

      // Limpar conexão anterior se existir
      cleanup();

      console.log(`🔌 Connecting to realtime channel: ${table}`);
      
      // Criar nome único do canal
      const channelName = filter 
        ? `${schema}:${table}:${filter}`
        : `${schema}:${table}`;

      // Criar novo canal
      const channel = supabase.channel(channelName, {
        config: {
          broadcast: { self: true },
          presence: { key: 'user_id' }
        }
      });

      // Configurar listeners de eventos
      if (events.includes('*') || events.includes('INSERT')) {
        channel.on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema,
            table,
            filter
          },
          (payload) => {
            console.log(`📥 INSERT event on ${table}:`, payload);
            onInsert?.(payload as RealtimePostgresChangesPayload<T>);
          }
        );
      }

      if (events.includes('*') || events.includes('UPDATE')) {
        channel.on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema,
            table,
            filter
          },
          (payload) => {
            console.log(`📝 UPDATE event on ${table}:`, payload);
            onUpdate?.(payload as RealtimePostgresChangesPayload<T>);
          }
        );
      }

      if (events.includes('*') || events.includes('DELETE')) {
        channel.on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema,
            table,
            filter
          },
          (payload) => {
            console.log(`🗑️ DELETE event on ${table}:`, payload);
            onDelete?.(payload as RealtimePostgresChangesPayload<T>);
          }
        );
      }

      // Configurar listeners de status
      channel.on('system', {}, (payload) => {
        console.log(`🔔 System event on ${table}:`, payload);
        
        if (payload.extension === 'postgres_changes') {
          setStatus(prev => ({
            ...prev,
            connected: true,
            subscribed: true,
            error: null,
            reconnectAttempts: 0
          }));
        }
      });

      // Subscrever ao canal
      channel.subscribe((status, error) => {
        console.log(`📡 Subscription status for ${table}:`, status, error);
        
        if (status === 'SUBSCRIBED') {
          setStatus(prev => ({
            ...prev,
            connected: true,
            subscribed: true,
            error: null,
            reconnectAttempts: 0
          }));
          
          setupHeartbeat();
          lastTokenRef.current = token;
          
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          const errorMsg = error?.message || `Connection ${status.toLowerCase()}`;
          
          setStatus(prev => ({
            ...prev,
            connected: false,
            subscribed: false,
            error: errorMsg,
            reconnectAttempts: prev.reconnectAttempts + 1
          }));
          
          onError?.(new Error(errorMsg));
          
          // Tentar reconectar após delay exponencial
          const delay = Math.min(1000 * Math.pow(2, status.reconnectAttempts || 0), 30000);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log(`🔄 Attempting to reconnect to ${table} in ${delay}ms`);
            connect();
          }, delay);
        }
      });

      channelRef.current = channel;
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown connection error';
      
      console.error(`❌ Failed to connect to realtime for ${table}:`, error);
      
      setStatus(prev => ({
        ...prev,
        connected: false,
        subscribed: false,
        error: errorMsg,
        reconnectAttempts: prev.reconnectAttempts + 1
      }));
      
      onError?.(new Error(errorMsg));
    }
  }, [enabled, isAuthenticated, getValidToken, table, schema, filter, events, onInsert, onUpdate, onDelete, onError, cleanup, setupHeartbeat]);

  /**
   * Força reconexão manual
   */
  const reconnect = useCallback(() => {
    console.log(`🔄 Manual reconnect triggered for ${table}`);
    cleanup();
    connect();
  }, [cleanup, connect, table]);

  // Efeito principal - conectar quando habilitado e autenticado
  useEffect(() => {
    if (enabled && isAuthenticated()) {
      connect();
    } else {
      cleanup();
    }

    return cleanup;
  }, [enabled, isAuthenticated, connect, cleanup]);

  // Efeito para reconectar quando token é renovado
  useEffect(() => {
    if (!reconnectOnTokenRefresh) return;

    const currentToken = tokenInfo.hasToken ? 'present' : 'absent';
    const tokenChanged = lastTokenRef.current && lastTokenRef.current !== currentToken;
    
    if (tokenChanged && isAuthenticated()) {
      console.log(`🔑 Token refreshed, reconnecting realtime for ${table}`);
      reconnect();
    }
  }, [tokenInfo.lastRefresh, reconnectOnTokenRefresh, isAuthenticated, reconnect, table]);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    status,
    reconnect,
    disconnect: cleanup,
    
    // Informações de debug
    debug: {
      channelActive: !!channelRef.current,
      lastToken: lastTokenRef.current,
      tokenInfo,
      tableName: table
    }
  };
}

/**
 * Hook simplificado para sincronização de uma tabela específica
 */
export function useTableSync<T = any>(
  table: string,
  callbacks: {
    onInsert?: (data: T) => void;
    onUpdate?: (data: T) => void;
    onDelete?: (data: T) => void;
  },
  options?: Partial<UseOptimizedRealtimeOptions<T>>
) {
  return useOptimizedRealtime<T>({
    table,
    onInsert: callbacks.onInsert ? (payload) => callbacks.onInsert!(payload.new as T) : undefined,
    onUpdate: callbacks.onUpdate ? (payload) => callbacks.onUpdate!(payload.new as T) : undefined,
    onDelete: callbacks.onDelete ? (payload) => callbacks.onDelete!(payload.old as T) : undefined,
    ...options
  });
}