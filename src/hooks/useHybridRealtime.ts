import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface WebhookData {
  id: string;
  status: string;
  amount: number;
  customer_name?: string;
  customer_email?: string;
  created_at: string;
  order_id?: string;
  payment_method?: string;
}

interface ConnectionStatus {
  websocket: 'connected' | 'disconnected' | 'error' | 'trying';
  sse: 'connected' | 'disconnected' | 'error' | 'trying';
  polling: 'active' | 'inactive';
  ultrahook: 'available' | 'unavailable';
}

interface UseHybridRealtimeReturn {
  data: WebhookData[];
  loading: boolean;
  error: string | null;
  connectionStatus: ConnectionStatus;
  activeMethod: 'websocket' | 'sse' | 'polling' | 'ultrahook';
  forceMethod: (method: 'websocket' | 'sse' | 'polling' | 'auto') => void;
  reconnect: () => void;
}

const POLLING_INTERVAL = 5000; // 5 segundos
const RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 30000]; // Backoff exponencial
const SSE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/realtime-notifications/sse`;

export function useHybridRealtime(): UseHybridRealtimeReturn {
  const [data, setData] = useState<WebhookData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeMethod, setActiveMethod] = useState<'websocket' | 'sse' | 'polling' | 'ultrahook'>('websocket');
  const [forcedMethod, setForcedMethod] = useState<'websocket' | 'sse' | 'polling' | 'auto'>('auto');
  
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    websocket: 'trying',
    sse: 'disconnected',
    polling: 'inactive',
    ultrahook: 'unavailable'
  });

  // Refs para controle
  const channelRef = useRef<RealtimeChannel | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  // Buscar dados iniciais
  const fetchInitialData = useCallback(async () => {
    try {
      const { data: webhooks, error: fetchError } = await supabase
        .from('webhooks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (fetchError) throw fetchError;

      setData(webhooks || []);
      setError(null);
    } catch (err) {
      console.error('Erro ao buscar dados iniciais:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, []);

  // WebSocket (Supabase Realtime)
  const connectWebSocket = useCallback(() => {
    if (forcedMethod !== 'auto' && forcedMethod !== 'websocket') return;

    setConnectionStatus(prev => ({ ...prev, websocket: 'trying' }));

    try {
      const channel = supabase
        .channel('hybrid-webhooks')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'webhooks'
        }, (payload) => {
          console.log('📡 WebSocket - Novo webhook:', payload);
          
          if (payload.eventType === 'INSERT') {
            setData(prev => [payload.new as WebhookData, ...prev.slice(0, 49)]);
          } else if (payload.eventType === 'UPDATE') {
            setData(prev => prev.map(item => 
              item.id === payload.new.id ? payload.new as WebhookData : item
            ));
          }
        })
        .subscribe((status) => {
          console.log('🔗 WebSocket Status:', status);
          
          if (status === 'SUBSCRIBED') {
            setConnectionStatus(prev => ({ ...prev, websocket: 'connected' }));
            setActiveMethod('websocket');
            setError(null);
            reconnectAttemptsRef.current = 0;
            
            // Parar outros métodos se WebSocket funcionar
            stopSSE();
            stopPolling();
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setConnectionStatus(prev => ({ ...prev, websocket: 'error' }));
            
            // Tentar SSE como fallback
            if (forcedMethod === 'auto') {
              setTimeout(connectSSE, 1000);
            }
          } else if (status === 'CLOSED') {
            setConnectionStatus(prev => ({ ...prev, websocket: 'disconnected' }));
            
            // Tentar reconectar ou usar fallback
            if (forcedMethod === 'auto') {
              scheduleReconnect();
            }
          }
        });

      channelRef.current = channel;
    } catch (err) {
      console.error('Erro ao conectar WebSocket:', err);
      setConnectionStatus(prev => ({ ...prev, websocket: 'error' }));
      
      if (forcedMethod === 'auto') {
        setTimeout(connectSSE, 1000);
      }
    }
  }, [forcedMethod]);

  // Server-Sent Events
  const connectSSE = useCallback(() => {
    if (forcedMethod !== 'auto' && forcedMethod !== 'sse') return;
    if (connectionStatus.websocket === 'connected') return; // Não usar se WebSocket estiver ativo

    setConnectionStatus(prev => ({ ...prev, sse: 'trying' }));

    try {
      const eventSource = new EventSource(SSE_URL);
      
      eventSource.onopen = () => {
        console.log('📡 SSE - Conectado');
        setConnectionStatus(prev => ({ ...prev, sse: 'connected' }));
        setActiveMethod('sse');
        setError(null);
        reconnectAttemptsRef.current = 0;
        
        // Parar polling se SSE funcionar
        stopPolling();
      };
      
      eventSource.onmessage = (event) => {
        try {
          const webhookData = JSON.parse(event.data);
          console.log('📡 SSE - Novo webhook:', webhookData);
          
          setData(prev => [webhookData, ...prev.slice(0, 49)]);
        } catch (err) {
          console.error('Erro ao processar evento SSE:', err);
        }
      };
      
      eventSource.onerror = (err) => {
        console.error('❌ SSE - Erro:', err);
        setConnectionStatus(prev => ({ ...prev, sse: 'error' }));
        
        // Usar polling como fallback final
        if (forcedMethod === 'auto') {
          setTimeout(startPolling, 1000);
        }
      };
      
      sseRef.current = eventSource;
    } catch (err) {
      console.error('Erro ao conectar SSE:', err);
      setConnectionStatus(prev => ({ ...prev, sse: 'error' }));
      
      if (forcedMethod === 'auto') {
        setTimeout(startPolling, 1000);
      }
    }
  }, [forcedMethod, connectionStatus.websocket]);

  // Polling HTTP
  const startPolling = useCallback(() => {
    if (forcedMethod !== 'auto' && forcedMethod !== 'polling') return;
    if (connectionStatus.websocket === 'connected' || connectionStatus.sse === 'connected') return;

    console.log('🔄 Iniciando polling HTTP');
    setConnectionStatus(prev => ({ ...prev, polling: 'active' }));
    setActiveMethod('polling');

    const poll = async () => {
      try {
        const { data: webhooks, error: fetchError } = await supabase
          .from('webhooks')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10);

        if (fetchError) throw fetchError;

        // Verificar se há novos webhooks
        const currentIds = data.map(item => item.id);
        const newWebhooks = webhooks?.filter(webhook => !currentIds.includes(webhook.id)) || [];
        
        if (newWebhooks.length > 0) {
          console.log(`🔄 Polling - ${newWebhooks.length} novos webhooks`);
          setData(prev => [...newWebhooks, ...prev].slice(0, 50));
        }

        setError(null);
      } catch (err) {
        console.error('Erro no polling:', err);
        setError(err instanceof Error ? err.message : 'Erro no polling');
      }
    };

    // Primeira execução imediata
    poll();
    
    // Configurar intervalo
    pollingIntervalRef.current = setInterval(poll, POLLING_INTERVAL);
  }, [forcedMethod, connectionStatus.websocket, connectionStatus.sse, data]);

  // Parar métodos
  const stopWebSocket = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }
    setConnectionStatus(prev => ({ ...prev, websocket: 'disconnected' }));
  }, []);

  const stopSSE = useCallback(() => {
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }
    setConnectionStatus(prev => ({ ...prev, sse: 'disconnected' }));
  }, []);

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setConnectionStatus(prev => ({ ...prev, polling: 'inactive' }));
  }, []);

  // Reconexão com backoff
  const scheduleReconnect = useCallback(() => {
    const delay = RECONNECT_DELAYS[Math.min(reconnectAttemptsRef.current, RECONNECT_DELAYS.length - 1)];
    reconnectAttemptsRef.current++;

    console.log(`🔄 Reagendando reconexão em ${delay}ms (tentativa ${reconnectAttemptsRef.current})`);

    reconnectTimeoutRef.current = setTimeout(() => {
      if (forcedMethod === 'auto') {
        // Tentar SSE primeiro, depois polling
        connectSSE();
      }
    }, delay);
  }, [forcedMethod, connectSSE]);

  // Forçar método específico
  const forceMethod = useCallback((method: 'websocket' | 'sse' | 'polling' | 'auto') => {
    console.log(`🎯 Forçando método: ${method}`);
    
    // Parar todos os métodos
    stopWebSocket();
    stopSSE();
    stopPolling();
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    setForcedMethod(method);
    reconnectAttemptsRef.current = 0;

    // Iniciar método específico
    setTimeout(() => {
      if (method === 'websocket') {
        connectWebSocket();
      } else if (method === 'sse') {
        connectSSE();
      } else if (method === 'polling') {
        startPolling();
      } else if (method === 'auto') {
        connectWebSocket(); // Começar com WebSocket
      }
    }, 100);
  }, [connectWebSocket, connectSSE, startPolling, stopWebSocket, stopSSE, stopPolling]);

  // Reconectar
  const reconnect = useCallback(() => {
    console.log('🔄 Reconectando...');
    reconnectAttemptsRef.current = 0;
    forceMethod(forcedMethod);
  }, [forceMethod, forcedMethod]);

  // Efeito principal
  useEffect(() => {
    fetchInitialData();
    
    // Iniciar com estratégia automática
    const timer = setTimeout(() => {
      connectWebSocket();
    }, 500);

    return () => {
      clearTimeout(timer);
      stopWebSocket();
      stopSSE();
      stopPolling();
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  // Verificar Ultrahook periodicamente (sem enviar webhooks de teste)
  useEffect(() => {
    const checkUltrahook = async () => {
      try {
        // Usar HEAD request ou OPTIONS para verificar sem criar webhook
        const response = await fetch('https://recebimento-webh-dev-abacatepay.ultrahook.com', {
          method: 'HEAD',
          mode: 'no-cors' // Evita erro de CORS, apenas verifica se o endpoint responde
        });
        
        // Se não der erro, considera disponível
        setConnectionStatus(prev => ({ 
          ...prev, 
          ultrahook: 'available' 
        }));
      } catch {
        // Se falhar, tenta verificar via Edge Function direto
        try {
          const testResponse = await fetch('https://ojxmfxbflbfinodkhixk.supabase.co/functions/v1/webhook-abacatepay', {
            method: 'OPTIONS'
          });
          setConnectionStatus(prev => ({ 
            ...prev, 
            ultrahook: testResponse.ok ? 'available' : 'unavailable' 
        }));
      } catch {
        setConnectionStatus(prev => ({ ...prev, ultrahook: 'unavailable' }));
        }
      }
    };

    checkUltrahook();
    const interval = setInterval(checkUltrahook, 60000); // Verificar a cada 60s (menos frequente)

    return () => clearInterval(interval);
  }, []);

  return {
    data,
    loading,
    error,
    connectionStatus,
    activeMethod,
    forceMethod,
    reconnect
  };
}