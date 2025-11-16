import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { supabaseQueryWithTimeout } from '@/utils/supabaseTimeout';

export interface WebhookMetrics {
  totalWebhooks: number;
  successRate: number;
  failureRate: number;
  totalRevenue: number;
  totalOrders: number;
  totalCustomers: number;
  averageProcessingTime: number;
  // Métricas detalhadas do AbacatePay
  totalFees: number;
  netRevenue: number;
  averageFeePercentage: number;
  devModeTransactions: number;
  prodModeTransactions: number;
  pixTransactions: number;
  // Atividade recente com mais detalhes
  recentActivity: Array<{
    id: string;
    type: 'success' | 'failure';
    timestamp: string;
    amount?: number;
    fee?: number;
    netAmount?: number;
    customerName?: string;
    customerEmail?: string;
    customerTaxId?: string;
    paymentMethod?: string;
    environment?: 'dev' | 'prod';
    error?: string;
  }>;
  dailyStats: Array<{
    date: string;
    webhooks: number;
    revenue: number;
    fees: number;
    netRevenue: number;
    successRate: number;
    devTransactions: number;
    prodTransactions: number;
  }>;
  performanceMetrics: {
    p95ResponseTime: number;
    p99ResponseTime: number;
    errorRate: number;
    throughput: number;
  };
}

export const useWebhookMetrics = (refreshInterval: number = 30000) => {
  const [metrics, setMetrics] = useState<WebhookMetrics>({
    totalWebhooks: 0,
    successRate: 0,
    failureRate: 0,
    totalRevenue: 0,
    totalOrders: 0,
    totalCustomers: 0,
    averageProcessingTime: 0,
    totalFees: 0,
    netRevenue: 0,
    averageFeePercentage: 0,
    devModeTransactions: 0,
    prodModeTransactions: 0,
    pixTransactions: 0,
    recentActivity: [],
    dailyStats: [],
    performanceMetrics: {
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      errorRate: 0,
      throughput: 0,
    },
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Flag para evitar execuções simultâneas
  const isLoadingRef = useRef(false);

  const fetchMetrics = useCallback(async () => {
    // Evitar execuções simultâneas
    if (isLoadingRef.current) {
      console.log('[useWebhookMetrics] Execução já em andamento, pulando...');
      return;
    }
    
    console.log('[useWebhookMetrics] Iniciando fetchMetrics...');
    isLoadingRef.current = true;
    try {
      setLoading(true);
      setError(null);
      
      console.log('[useWebhookMetrics] Buscando dados do Supabase...');

      // Buscar webhooks do AbacatePay (últimos 30 dias) com timeout
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: webhooks, error: webhooksError } = await supabaseQueryWithTimeout(
        () => supabase
          .from('webhooks')
          .select('*')
          .eq('source', 'abacatepay')
          .gte('created_at', thirtyDaysAgo.toISOString())
          .order('created_at', { ascending: false }),
        {
          timeout: 8000,
          retries: 1,
          errorMessage: 'Buscar webhooks'
        }
      );

      if (webhooksError) throw webhooksError;

      // Buscar pedidos relacionados para complementar dados com timeout
      const { data: orders, error: ordersError } = await supabaseQueryWithTimeout(
        () => supabase
          .from('orders')
          .select(`
            id,
            status,
            total_amount,
            payment_id,
            payment_method,
            payment_status,
            created_at,
            customer_id,
            customer_data,
            customers (
              id,
              email,
              name
            )
          `)
          .not('payment_id', 'is', null)
          .gte('created_at', thirtyDaysAgo.toISOString())
          .order('created_at', { ascending: false }),
        {
          timeout: 8000,
          retries: 1,
          errorMessage: 'Buscar orders'
        }
      );

      if (ordersError) throw ordersError;

      // Processar dados dos webhooks
      const processedWebhooks = webhooks?.map(webhook => {
        const payload = webhook.payload;
        let processedData = {
          id: webhook.id,
          timestamp: webhook.created_at,
          processed: webhook.processed,
          error: webhook.error_message,
          event: payload?.event,
          environment: payload?.devMode ? 'dev' : 'prod',
          amount: 0,
          fee: 0,
          netAmount: 0,
          customerName: '',
          customerEmail: '',
          customerTaxId: '',
          paymentMethod: '',
        };

        // Processar payload do AbacatePay (billing.paid)
        if (payload?.event === 'billing.paid' && payload?.data) {
          const data = payload.data;
          
          // Valores financeiros (converter de centavos para reais)
          processedData.amount = (data.pixQrCode?.amount || data.payment?.amount || 0) / 100;
          processedData.fee = (data.payment?.fee || 0) / 100;
          processedData.netAmount = processedData.amount - processedData.fee;
          
          // Dados do cliente
          if (data.pixQrCode?.customer?.metadata) {
            const customer = data.pixQrCode.customer.metadata;
            processedData.customerName = customer.name || '';
            processedData.customerEmail = customer.email || '';
            processedData.customerTaxId = customer.taxId || '';
          }
          
          // Método de pagamento
          processedData.paymentMethod = data.payment?.method || data.pixQrCode?.kind || '';
        }

        return processedData;
      }) || [];

      // Calcular métricas básicas
      const totalWebhooks = processedWebhooks.length;
      const successfulWebhooks = processedWebhooks.filter(w => w.processed && !w.error);
      const failedWebhooks = processedWebhooks.filter(w => !w.processed || w.error);
      
      const successRate = totalWebhooks > 0 ? (successfulWebhooks.length / totalWebhooks) * 100 : 0;
      const failureRate = 100 - successRate;

      // Calcular métricas financeiras
      const totalRevenue = processedWebhooks.reduce((sum, w) => sum + (w.amount || 0), 0);
      const totalFees = processedWebhooks.reduce((sum, w) => sum + (w.fee || 0), 0);
      const netRevenue = totalRevenue - totalFees;
      const averageFeePercentage = totalRevenue > 0 ? (totalFees / totalRevenue) * 100 : 0;

      // Contar transações por ambiente
      const devModeTransactions = processedWebhooks.filter(w => w.environment === 'dev').length;
      const prodModeTransactions = processedWebhooks.filter(w => w.environment === 'prod').length;
      const pixTransactions = processedWebhooks.filter(w => w.paymentMethod === 'PIX').length;

      // Contar clientes únicos
      const uniqueCustomers = new Set(
        processedWebhooks
          .filter(w => w.customerEmail)
          .map(w => w.customerEmail)
      ).size;

      // Atividade recente (últimos 10 eventos) com dados detalhados
      const recentActivity = processedWebhooks.slice(0, 10).map(webhook => ({
        id: webhook.id,
        status: (webhook.processed && !webhook.error) ? 'success' as const : 'error' as const,
        timestamp: webhook.timestamp,
        amount: webhook.amount,
        fee: webhook.fee,
        netAmount: webhook.netAmount,
        customerName: webhook.customerName,
        customerEmail: webhook.customerEmail,
        customerTaxId: webhook.customerTaxId,
        paymentMethod: webhook.paymentMethod,
        environment: webhook.environment as 'dev' | 'prod',
      }));

      // Estatísticas diárias (últimos 7 dias)
      const dailyStats = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const dayWebhooks = processedWebhooks.filter(w => 
          w.timestamp.startsWith(dateStr)
        );
        
        const daySuccessful = dayWebhooks.filter(w => w.processed && !w.error);
        const dayRevenue = dayWebhooks.reduce((sum, w) => sum + (w.amount || 0), 0);
        const dayFees = dayWebhooks.reduce((sum, w) => sum + (w.fee || 0), 0);
        const dayNetRevenue = dayRevenue - dayFees;
        const daySuccessRate = dayWebhooks.length > 0 ? (daySuccessful.length / dayWebhooks.length) * 100 : 0;
        const dayDevTransactions = dayWebhooks.filter(w => w.environment === 'dev').length;
        const dayProdTransactions = dayWebhooks.filter(w => w.environment === 'prod').length;

        dailyStats.push({
          date: dateStr,
          webhooks: dayWebhooks.length,
          revenue: dayRevenue,
          fees: dayFees,
          netRevenue: dayNetRevenue,
          successRate: daySuccessRate,
          devTransactions: dayDevTransactions,
          prodTransactions: dayProdTransactions,
        });
      }

      // Métricas de performance (simuladas - em produção viriam de logs)
      const performanceMetrics = {
        p95ResponseTime: Math.random() * 500 + 200, // 200-700ms
        p99ResponseTime: Math.random() * 800 + 500, // 500-1300ms
        errorRate: failureRate,
        throughput: totalWebhooks / 30, // webhooks por dia
      };

      setMetrics({
        totalWebhooks,
        successRate,
        failureRate,
        totalRevenue,
        totalOrders: orders?.length || 0,
        totalCustomers: uniqueCustomers,
        averageProcessingTime: performanceMetrics.p95ResponseTime,
        totalFees,
        netRevenue,
        averageFeePercentage,
        devModeTransactions,
        prodModeTransactions,
        pixTransactions,
        recentActivity,
        dailyStats,
        performanceMetrics,
      });

      console.log('[useWebhookMetrics] Métricas calculadas com sucesso:', {
        totalWebhooks,
        totalOrders: orders?.length || 0,
        successRate,
        failureRate
      });

    } catch (err) {
      console.error('[useWebhookMetrics] Erro ao buscar métricas de webhook:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      console.log('[useWebhookMetrics] Finalizando fetchMetrics, setLoading(false)');
      setLoading(false);
      isLoadingRef.current = false; // Liberar flag
    }
  }, []); // Dependências vazias para evitar recriação

  const refresh = useCallback(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  useEffect(() => {
    fetchMetrics();
    
    // Configurar refresh automático
    const interval = setInterval(fetchMetrics, refreshInterval);
    
    return () => clearInterval(interval);
  }, [fetchMetrics, refreshInterval]);

  return {
    metrics,
    loading,
    error,
    refresh,
  };
};