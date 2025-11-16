import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface EdgeRealtimeEvent {
  type: 'connected' | 'webhooks_update' | 'notification' | 'error';
  data?: any;
  clientId?: string;
  timestamp: string;
}

interface UseEdgeFunctionRealtimeReturn {
  data: any[];
  isConnected: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  error: string | null;
  reconnect: () => void;
  disconnect: () => void;
}

export function useEdgeFunctionRealtime(): UseEdgeFunctionRealtimeReturn {
  const [data, setData] = useState<any[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [error, setError] = useState<string | null>(null);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const clientIdRef = useRef<string>(crypto.randomUUID());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    setIsConnected(false);
    setConnectionStatus('disconnected');
  }, []);

  const connect = useCallback(async () => {
    try {
      // Desconectar conexão existente
      disconnect();
      
      setConnectionStatus('connecting');
      setError(null);
      
      // Obter URL do Supabase
      const supabaseUrl = supabase.supabaseUrl;
      const eventSourceUrl = `${supabaseUrl}/functions/v1/realtime-notifications/sse?clientId=${clientIdRef.current}`;
      
      console.log('🔌 Conectando via SSE:', eventSourceUrl);
      
      const eventSource = new EventSource(eventSourceUrl);
      eventSourceRef.current = eventSource;
      
      eventSource.onopen = () => {
        console.log('✅ SSE conectado');
        setIsConnected(true);
        setConnectionStatus('connected');
        setError(null);
        reconnectAttemptsRef.current = 0;
      };
      
      eventSource.onmessage = (event) => {
        try {
          const eventData: EdgeRealtimeEvent = JSON.parse(event.data);
          console.log('📡 SSE evento recebido:', eventData);
          
          switch (eventData.type) {
            case 'connected':
              console.log('🎉 SSE confirmação de conexão:', eventData.clientId);
              break;
              
            case 'webhooks_update':
              if (eventData.data) {
                setData(eventData.data);
              }
              break;
              
            case 'notification':
              console.log('🔔 Notificação recebida:', eventData.data);
              // Recarregar dados quando receber notificação
              fetchLatestData();
              break;
              
            case 'error':
              console.error('❌ Erro SSE:', eventData.data);
              setError(eventData.data?.message || 'Erro desconhecido');
              break;
          }
        } catch (parseError) {
          console.error('❌ Erro ao parsear evento SSE:', parseError);
        }
      };
      
      eventSource.onerror = (event) => {
        console.error('❌ Erro na conexão SSE:', event);
        setIsConnected(false);
        setConnectionStatus('error');
        setError('Erro na conexão SSE');
        
        // Tentar reconectar com backoff exponencial
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.pow(2, reconnectAttemptsRef.current) * 1000; // 1s, 2s, 4s, 8s, 16s
          console.log(`🔄 Tentando reconectar em ${delay}ms (tentativa ${reconnectAttemptsRef.current + 1}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            connect();
          }, delay);
        } else {
          console.error('❌ Máximo de tentativas de reconexão atingido');
          setConnectionStatus('error');
        }
      };
      
    } catch (err) {
      console.error('❌ Erro ao conectar SSE:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      setConnectionStatus('error');
    }
  }, [disconnect]);

  const fetchLatestData = useCallback(async () => {
    try {
      const supabaseUrl = supabase.supabaseUrl;
      const response = await fetch(`${supabaseUrl}/functions/v1/realtime-notifications/webhooks?limit=50`, {
        headers: {
          'Authorization': `Bearer ${supabase.supabaseKey}`
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        setData(result.data || []);
      }
    } catch (err) {
      console.error('❌ Erro ao buscar dados:', err);
    }
  }, []);

  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    connect();
  }, [connect]);

  useEffect(() => {
    // Conectar automaticamente
    connect();
    
    // Buscar dados iniciais
    fetchLatestData();
    
    // Cleanup na desmontagem
    return () => {
      disconnect();
    };
  }, [connect, disconnect, fetchLatestData]);

  return {
    data,
    isConnected,
    connectionStatus,
    error,
    reconnect,
    disconnect
  };
}