import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { useRealtimeContext } from '../../contexts/RealtimeContext';

export interface WebhookData {
  id: string;
  created_at: string;
  payload: any;
  status: 'pending' | 'processed' | 'error';
  error_message?: string;
  processed_at?: string;
  processed?: boolean;
  source?: string;
  event_type?: string;
  
  // Campos processados
  customer_name?: string;
  customer_document?: string;
  customer_email?: string;
  amount?: number;
  fee?: number;
  net_amount?: number;
  payment_method?: string;
  
  // Campos compatíveis com a tabela WebHooks.tsx
  evento?: string;
  ambiente?: string;
  pixQrCodeId?: string;
  pixQrCodeTipo?: string;
  pixQrCodeStatus?: string;
  clienteId?: string;
  clienteNome?: string;
  clienteTelefone?: string;
  clienteCpfCnpj?: string;
  clienteEmail?: string;
  clienteCep?: string;
  valorBrutoReais?: number;
  valorBrutoCentavos?: number;
  taxaReais?: number;
  taxaCentavos?: number;
  valorLiquidoReais?: number;
  percentualTaxa?: number;
  metodoPagamento?: string;
}

// Hook atualizado - 05/11/2025
export interface UseRealtimeWebhooksReturn {
  data: WebhookData[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  isConnected: boolean;
  connectionStatus: string;
}

export function useRealtimeWebhooks(): UseRealtimeWebhooksReturn {
  const [data, setData] = useState<WebhookData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  // Referências para evitar re-renders
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isInitializedRef = useRef(false);
  const { state, updateSyncCount, updateMetrics } = useRealtimeContext();
  
  // Função para processar payload do webhook - memoizada e estável
  const processWebhookPayload = useMemo(() => (webhook: any): WebhookData => {
    let processedData: Partial<WebhookData> = {
      id: webhook.id,
      created_at: webhook.created_at,
      payload: webhook.payload,
      status: webhook.status || 'pending',
      error_message: webhook.error_message,
      processed_at: webhook.processed_at,
      processed: webhook.processed || false,
      source: webhook.source || 'unknown',
      event_type: webhook.event_type || 'unknown'
    };

    try {
      const payload = typeof webhook.payload === 'string' 
        ? JSON.parse(webhook.payload) 
        : webhook.payload;

      if (payload) {
        // Processar payload do AbacatePay (billing.paid)
        // O payload pode ter o event diretamente ou dentro de um envelope
        const eventType = payload.event || payload.event_type || webhook.event_type;
        const eventData = payload.data || payload;
        
        if (eventType === 'billing.paid' && eventData) {
          const data = eventData;
          
          // Valores financeiros (AbacatePay sempre envia em centavos)
          // Converter de centavos para reais
          const amountCentavos = data.pixQrCode?.amount || data.payment?.amount || 0;
          const feeCentavos = data.payment?.fee || 0;
          
          // Converter centavos para reais (dividir por 100)
          // Se o valor já estiver em reais (tem casas decimais ou é < 1), não converter
          const amount = (amountCentavos >= 1 && Number.isInteger(amountCentavos)) 
            ? amountCentavos / 100 
            : amountCentavos;
          const fee = (feeCentavos >= 1 && Number.isInteger(feeCentavos)) 
            ? feeCentavos / 100 
            : feeCentavos;
          
          const netAmount = amount - fee;
          const percentualTaxa = amount > 0 ? (fee / amount) * 100 : 0;
          
          processedData.amount = amount;
          processedData.fee = fee;
          processedData.net_amount = netAmount;
          
          // Compatibilidade com WebHooks.tsx
          processedData.valorBrutoReais = amount;
          processedData.valorBrutoCentavos = amountCentavos;
          processedData.taxaReais = fee;
          processedData.taxaCentavos = feeCentavos;
          processedData.valorLiquidoReais = netAmount;
          processedData.percentualTaxa = percentualTaxa;
          
          // Evento e ambiente
          processedData.evento = eventType;
          processedData.ambiente = payload.devMode ? 'desenvolvimento' : 'produção';
          
          // ID do PIX QR Code (priorizar payment.id, depois pixQrCode.id)
          processedData.pixQrCodeId = data.payment?.id || data.pixQrCode?.id || 'N/A';
          processedData.pixQrCodeTipo = data.pixQrCode?.kind || data.payment?.method || 'N/A';
          processedData.pixQrCodeStatus = data.pixQrCode?.status || data.payment?.status || 'UNKNOWN';
          
          // Dados do cliente - AbacatePay envia em data.payment.customer
          let customer = null;
          let customerId = 'N/A';
          
          // Tentar primeiro: data.payment.customer (formato atual do AbacatePay)
          if (data.payment?.customer) {
            customer = data.payment.customer;
            customerId = data.payment.customer.id || 'N/A';
          } 
          // Tentar segundo: data.pixQrCode.customer.metadata (formato alternativo)
          else if (data.pixQrCode?.customer?.metadata) {
            customer = data.pixQrCode.customer.metadata;
            customerId = data.pixQrCode.customer.id || 'N/A';
          }
          // Tentar terceiro: data.pixQrCode.customer (sem metadata)
          else if (data.pixQrCode?.customer) {
            customer = data.pixQrCode.customer;
            customerId = data.pixQrCode.customer.id || 'N/A';
          }
          
          if (customer) {
            const name = customer.name || customer.full_name || 'N/A';
            const email = customer.email || 'N/A';
            const taxId = customer.taxId || customer.document || customer.cpf || customer.cnpj || 'N/A';
            const cellphone = customer.cellphone || customer.phone || customer.telefone || 'N/A';
            const zipCode = customer.zipCode || customer.cep || customer.postalCode || 'N/A';
            
            processedData.clienteId = customerId;
            processedData.customer_name = name;
            processedData.customer_email = email;
            processedData.customer_document = taxId;
            
            // Compatibilidade com WebHooks.tsx
            processedData.clienteNome = name;
            processedData.clienteEmail = email;
            processedData.clienteCpfCnpj = taxId;
            processedData.clienteTelefone = cellphone;
            processedData.clienteCep = zipCode;
          } else {
            processedData.customer_name = 'N/A';
            processedData.customer_email = 'N/A';
            processedData.customer_document = 'N/A';
            processedData.clienteId = 'N/A';
            processedData.clienteNome = 'N/A';
            processedData.clienteEmail = 'N/A';
            processedData.clienteCpfCnpj = 'N/A';
            processedData.clienteTelefone = 'N/A';
            processedData.clienteCep = 'N/A';
          }
          
          // Método de pagamento
          const method = data.payment?.method || data.pixQrCode?.kind || 'N/A';
          processedData.payment_method = method;
          processedData.metodoPagamento = method;
        } else {
          // Fallback para outros formatos de webhook (compatibilidade)
          const customer = payload.customer || payload.payer || {};
          const name = customer.name || customer.full_name || 'N/A';
          const email = customer.email || 'N/A';
          const document = customer.document || customer.cpf || customer.cnpj || 'N/A';
          
          processedData.customer_name = name;
          processedData.customer_document = document;
          processedData.customer_email = email;
          processedData.clienteNome = name;
          processedData.clienteEmail = email;
          processedData.clienteCpfCnpj = document;

          // Extrair valores financeiros
          const amount = payload.amount || payload.value || payload.total || 0;
          const fee = payload.fee || payload.tax || 0;
          const parsedAmount = typeof amount === 'number' ? amount : parseFloat(amount) || 0;
          const parsedFee = typeof fee === 'number' ? fee : parseFloat(fee) || 0;
          
          processedData.amount = parsedAmount;
          processedData.fee = parsedFee;
          processedData.net_amount = parsedAmount - parsedFee;
          processedData.valorBrutoReais = parsedAmount;
          processedData.taxaReais = parsedFee;
          processedData.valorLiquidoReais = parsedAmount - parsedFee;
          
          // Método de pagamento
          const method = payload.payment_method || payload.method || 'N/A';
          processedData.payment_method = method;
          processedData.metodoPagamento = method;
          
          // ID do pagamento
          processedData.pixQrCodeId = payload.id || payload.payment_id || 'N/A';
        }
      }
    } catch (err) {
      console.warn('Erro ao processar payload do webhook:', err);
    }

    return processedData as WebhookData;
  }, []);

  // ✅ CORREÇÃO: Função para carregar dados via Edge Function realtime-notifications/webhooks
  // Com fallback para consultas diretas do Supabase se a Edge Function não estiver disponível
  const fetchWebhooks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // ✅ Tentar primeiro via Edge Function
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórias');
      }
      
      const limit = 1000;
      const url = `${supabaseUrl}/functions/v1/realtime-notifications/webhooks?limit=${limit}&offset=0`;
      
      console.log('🔍 Tentando buscar webhooks via Edge Function:', url);
      
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
            'apikey': supabaseKey
          }
        });

        if (response.ok) {
          const result = await response.json();
          console.log('✅ Resposta da Edge Function:', {
            webhooksCount: result.data?.length || 0,
            totalCount: result.count || 0,
            limit: result.limit,
            offset: result.offset
          });

          const webhooks = result.data || [];
          const processedWebhooks = webhooks.map(processWebhookPayload);
          setData(processedWebhooks);
          
          console.log(`✅ ${processedWebhooks.length} webhooks carregados via Edge Function`);
          
          // Atualizar métricas
          setTimeout(() => {
            updateSyncCount('orders', processedWebhooks.length);
            updateMetrics(prev => ({
              ...prev,
              totalUpdates: prev.totalUpdates + 1
            }));
          }, 0);
          
          return; // Sucesso - sair da função
        } else {
          console.warn('⚠️ Edge Function retornou erro, usando fallback para consulta direta:', response.status);
        }
      } catch (edgeFunctionError) {
        console.warn('⚠️ Edge Function não disponível, usando fallback para consulta direta:', edgeFunctionError);
      }
      
      // ✅ FALLBACK: Consulta direta do Supabase se a Edge Function falhar
      console.log('🔄 Usando consulta direta do Supabase como fallback...');

      const { data: webhooks, error: fetchError } = await supabase
        .from('webhooks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (fetchError) {
        throw fetchError;
      }

      const processedWebhooks = (webhooks || []).map(processWebhookPayload);
      setData(processedWebhooks);
      
      console.log(`✅ ${processedWebhooks.length} webhooks carregados via consulta direta (fallback)`);
      
      // Atualizar métricas do contexto de forma assíncrona
      setTimeout(() => {
        updateSyncCount('orders', processedWebhooks.length);
        updateMetrics(prev => ({
          ...prev,
          totalUpdates: prev.totalUpdates + 1
        }));
      }, 0);

    } catch (err) {
      console.error('❌ Erro ao carregar webhooks:', err);
      const error = err instanceof Error ? err : new Error('Erro ao carregar webhooks');
      setError(error);
      
      // Atualizar métricas de erro de forma assíncrona
      setTimeout(() => {
        updateMetrics(prev => ({
          ...prev,
          errorCount: prev.errorCount + 1
        }));
      }, 0);
    } finally {
      setLoading(false);
    }
  }, [processWebhookPayload, updateSyncCount, updateMetrics]);

  // Função para configurar subscription - estável e sem dependências problemáticas
  const setupSubscription = useCallback(() => {
    // Evitar recriar subscription desnecessariamente
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel('webhooks-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'webhooks'
        },
        (payload: RealtimePostgresChangesPayload<any>) => {
          console.log('Webhook realtime event:', payload);
          
          try {
            if (payload.eventType === 'INSERT') {
              const newWebhook = processWebhookPayload(payload.new);
              setData(prev => [newWebhook, ...prev]);
            } else if (payload.eventType === 'UPDATE') {
              const updatedWebhook = processWebhookPayload(payload.new);
              setData(prev => prev.map(item => 
                item.id === updatedWebhook.id ? updatedWebhook : item
              ));
            } else if (payload.eventType === 'DELETE') {
              setData(prev => prev.filter(item => item.id !== payload.old.id));
            }

            // Atualizar métricas de forma assíncrona para evitar loops
            setTimeout(() => {
              updateMetrics(prev => ({
                ...prev,
                totalUpdates: prev.totalUpdates + 1
              }));
            }, 0);

          } catch (err) {
            console.error('Erro ao processar evento realtime:', err);
            setTimeout(() => {
              updateMetrics(prev => ({
                ...prev,
                errorCount: prev.errorCount + 1
              }));
            }, 0);
          }
        }
      )
      .subscribe((status) => {
        console.log('Webhook subscription status:', status);
        setIsConnected(status === 'SUBSCRIBED');
        
        if (status === 'SUBSCRIBED') {
          setTimeout(() => {
            updateMetrics(prev => ({
              ...prev,
              reconnectCount: prev.reconnectCount + 1
            }));
          }, 0);
        }
      });

    channelRef.current = channel;
  }, [processWebhookPayload, updateMetrics]);

  // Efeito para carregar dados iniciais e configurar subscription - executado apenas uma vez
  useEffect(() => {
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      fetchWebhooks();
      setupSubscription();
    }

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []); // Array vazio - executa apenas uma vez

  // Função refetch - estável
  const refetch = useCallback(async () => {
    await fetchWebhooks();
  }, [fetchWebhooks]);

  return {
    data,
    loading,
    error,
    refetch,
    isConnected,
    connectionStatus: state.connectionStatus
  };
}