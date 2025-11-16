import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { supabaseQueryWithTimeout } from '@/utils/supabaseTimeout';

export interface WebhookAlert {
  id: string;
  type: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  acknowledged: boolean;
  metadata?: Record<string, any>;
}

export interface AlertThresholds {
  errorRateThreshold: number; // Porcentagem de erro aceitável
  responseTimeThreshold: number; // Tempo de resposta em ms
  volumeDropThreshold: number; // Queda de volume em %
  consecutiveFailuresThreshold: number; // Falhas consecutivas
}

export interface AlertMetrics {
  currentErrorRate: number;
  averageResponseTime: number;
  volumeChange: number;
  consecutiveFailures: number;
  lastSuccessfulWebhook: Date | null;
  totalAlertsToday: number;
  criticalAlertsCount: number;
}

const DEFAULT_THRESHOLDS: AlertThresholds = {
  errorRateThreshold: 5, // 5% de erro
  responseTimeThreshold: 5000, // 5 segundos
  volumeDropThreshold: 50, // 50% de queda
  consecutiveFailuresThreshold: 3 // 3 falhas consecutivas
};

export const useWebhookAlerts = (
  thresholds: Partial<AlertThresholds> = {},
  checkInterval: number = 60000 // 1 minuto
) => {
  const [alerts, setAlerts] = useState<WebhookAlert[]>([]);
  const [metrics, setMetrics] = useState<AlertMetrics>({
    currentErrorRate: 0,
    averageResponseTime: 0,
    volumeChange: 0,
    consecutiveFailures: 0,
    lastSuccessfulWebhook: null,
    totalAlertsToday: 0,
    criticalAlertsCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Flag para evitar execuções simultâneas
  const isCheckingRef = useRef(false);
  
  // Debounce para evitar execuções excessivas
  const lastCheckTimeRef = useRef(0);
  const MIN_CHECK_INTERVAL = 5000; // 5 segundos mínimo entre verificações

  // Memoizar os thresholds para evitar recriação desnecessária
  const finalThresholds = useMemo(() => ({ ...DEFAULT_THRESHOLDS, ...thresholds }), [thresholds]);
  
  // Refs para estabilizar dependências e evitar loops
  const thresholdsRef = useRef(finalThresholds);
  thresholdsRef.current = finalThresholds;

  const generateAlert = useCallback((
    type: WebhookAlert['type'],
    severity: WebhookAlert['severity'],
    title: string,
    message: string,
    metadata?: Record<string, any>
  ): WebhookAlert => {
    return {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      title,
      message,
      timestamp: new Date(),
      severity,
      acknowledged: false,
      metadata
    };
  }, []);

  // Ref para generateAlert para evitar dependências circulares
  const generateAlertRef = useRef(generateAlert);
  generateAlertRef.current = generateAlert;

  const checkWebhookHealth = useCallback(async () => {
    // Evitar execuções simultâneas
    if (isCheckingRef.current) {
      return;
    }
    
    // Debounce - evitar execuções muito frequentes
    const now = Date.now();
    if (now - lastCheckTimeRef.current < MIN_CHECK_INTERVAL) {
      return;
    }
    
    isCheckingRef.current = true;
    lastCheckTimeRef.current = now;
    
    try {
      setError(null);
      
      // Buscar dados dos últimos 24 horas
      const last24Hours = new Date();
      last24Hours.setHours(last24Hours.getHours() - 24);

      const { data: recentOrders, error: ordersError } = await supabaseQueryWithTimeout(
        () => supabase
          .from('orders')
          .select('*')
          .not('payment_id', 'is', null)
          .gte('created_at', last24Hours.toISOString())
          .order('created_at', { ascending: false }),
        {
          timeout: 6000,
          retries: 1,
          errorMessage: 'Buscar orders para alertas'
        }
      );

      if (ordersError) throw ordersError;

      const orders = recentOrders || [];
      const newAlerts: WebhookAlert[] = [];

      // Calcular métricas atuais
      const totalOrders = orders.length;
      const successfulOrders = orders.filter(o => 
        o.status === 'paid' || o.payment_status === 'paid'
      );
      const failedOrders = orders.filter(o => 
        o.status === 'failed' || o.payment_status === 'failed'
      );

      const currentErrorRate = totalOrders > 0 ? (failedOrders.length / totalOrders) * 100 : 0;
      
      // Simular tempo de resposta (em produção, isso viria dos logs)
      const averageResponseTime = 1200 + Math.random() * 800; // 1.2s - 2s

      // Calcular mudança de volume (comparar com período anterior)
      const previous24Hours = new Date();
      previous24Hours.setHours(previous24Hours.getHours() - 48);
      previous24Hours.setHours(previous24Hours.getHours() + 24);

      const { data: previousOrders } = await supabaseQueryWithTimeout(
        () => supabase
          .from('orders')
          .select('id')
          .not('payment_id', 'is', null)
          .gte('created_at', previous24Hours.toISOString())
          .lt('created_at', last24Hours.toISOString()),
        {
          timeout: 5000,
          retries: 1,
          errorMessage: 'Buscar orders anteriores para comparação'
        }
      );

      const previousCount = previousOrders?.length || 0;
      const volumeChange = previousCount > 0 
        ? ((totalOrders - previousCount) / previousCount) * 100 
        : 0;

      // Calcular falhas consecutivas
      let consecutiveFailures = 0;
      for (const order of orders.slice(0, 10)) { // Últimos 10 pedidos
        if (order.status === 'failed' || order.payment_status === 'failed') {
          consecutiveFailures++;
        } else {
          break;
        }
      }

      // Última webhook bem-sucedida
      const lastSuccessfulWebhook = successfulOrders.length > 0 
        ? new Date(successfulOrders[0].created_at)
        : null;

      // Verificar condições de alerta

      // 1. Taxa de erro alta
      if (currentErrorRate > thresholdsRef.current.errorRateThreshold) {
        newAlerts.push(generateAlertRef.current(
          'error',
          currentErrorRate > 15 ? 'critical' : 'high',
          'Taxa de Erro Elevada',
          `Taxa de erro atual: ${currentErrorRate.toFixed(1)}% (limite: ${thresholdsRef.current.errorRateThreshold}%)`,
          { errorRate: currentErrorRate, threshold: thresholdsRef.current.errorRateThreshold }
        ));
      }

      // 2. Tempo de resposta alto
      if (averageResponseTime > thresholdsRef.current.responseTimeThreshold) {
        newAlerts.push(generateAlertRef.current(
          'warning',
          averageResponseTime > 10000 ? 'high' : 'medium',
          'Tempo de Resposta Elevado',
          `Tempo médio: ${averageResponseTime.toFixed(0)}ms (limite: ${thresholdsRef.current.responseTimeThreshold}ms)`,
          { responseTime: averageResponseTime, threshold: thresholdsRef.current.responseTimeThreshold }
        ));
      }

      // 3. Queda significativa de volume
      if (volumeChange < -thresholdsRef.current.volumeDropThreshold) {
        newAlerts.push(generateAlertRef.current(
          'warning',
          'medium',
          'Queda no Volume de Webhooks',
          `Volume reduziu ${Math.abs(volumeChange).toFixed(1)}% nas últimas 24h`,
          { volumeChange, threshold: thresholdsRef.current.volumeDropThreshold }
        ));
      }

      // 4. Falhas consecutivas
      if (consecutiveFailures >= thresholdsRef.current.consecutiveFailuresThreshold) {
        newAlerts.push(generateAlertRef.current(
          'error',
          consecutiveFailures >= 5 ? 'critical' : 'high',
          'Falhas Consecutivas Detectadas',
          `${consecutiveFailures} webhooks falharam consecutivamente`,
          { consecutiveFailures, threshold: thresholdsRef.current.consecutiveFailuresThreshold }
        ));
      }

      // 5. Sem webhooks por muito tempo
      const hoursSinceLastSuccess = lastSuccessfulWebhook 
        ? (Date.now() - lastSuccessfulWebhook.getTime()) / (1000 * 60 * 60)
        : 24;

      if (hoursSinceLastSuccess > 2) { // Mais de 2 horas sem webhook
        newAlerts.push(generateAlertRef.current(
          'error',
          hoursSinceLastSuccess > 6 ? 'critical' : 'high',
          'Webhook Inativo',
          `Nenhum webhook bem-sucedido há ${hoursSinceLastSuccess.toFixed(1)} horas`,
          { hoursSinceLastSuccess }
        ));
      }

      // Atualizar estado
      setAlerts(prevAlerts => {
        // Manter alertas não reconhecidos e adicionar novos
        const unacknowledgedAlerts = prevAlerts.filter(alert => !alert.acknowledged);
        return [...unacknowledgedAlerts, ...newAlerts];
      });

      setMetrics({
        currentErrorRate,
        averageResponseTime,
        volumeChange,
        consecutiveFailures,
        lastSuccessfulWebhook,
        totalAlertsToday: newAlerts.length,
        criticalAlertsCount: newAlerts.filter(a => a.severity === 'critical').length
      });

    } catch (err) {
      console.error('Erro ao verificar saúde dos webhooks:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
      isCheckingRef.current = false; // Resetar flag
    }
  }, []); // Removendo dependências para evitar loop infinito

  const acknowledgeAlert = useCallback((alertId: string) => {
    setAlerts(prevAlerts => 
      prevAlerts.map(alert => 
        alert.id === alertId 
          ? { ...alert, acknowledged: true }
          : alert
      )
    );
  }, []);

  const acknowledgeAllAlerts = useCallback(() => {
    setAlerts(prevAlerts => 
      prevAlerts.map(alert => ({ ...alert, acknowledged: true }))
    );
  }, []);

  const clearAcknowledgedAlerts = useCallback(() => {
    setAlerts(prevAlerts => 
      prevAlerts.filter(alert => !alert.acknowledged)
    );
  }, []);

  const getAlertsByType = useCallback((type: WebhookAlert['type']) => {
    return alerts.filter(alert => alert.type === type && !alert.acknowledged);
  }, [alerts]);

  const getAlertsBySeverity = useCallback((severity: WebhookAlert['severity']) => {
    return alerts.filter(alert => alert.severity === severity && !alert.acknowledged);
  }, [alerts]);

  const hasUnacknowledgedAlerts = useCallback(() => {
    return alerts.some(alert => !alert.acknowledged);
  }, [alerts]);

  const getCriticalAlertsCount = useCallback(() => {
    return alerts.filter(alert => 
      alert.severity === 'critical' && !alert.acknowledged
    ).length;
  }, [alerts]);

  // Usar useRef para estabilizar o checkInterval
  const checkIntervalRef = useRef(checkInterval);
  checkIntervalRef.current = checkInterval;

  // Verificação inicial
  useEffect(() => {
    checkWebhookHealth();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Verificação periódica - removendo checkInterval das dependências
  useEffect(() => {
    const interval = setInterval(() => {
      checkWebhookHealth();
    }, checkIntervalRef.current);
    
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    alerts: alerts.filter(alert => !alert.acknowledged), // Retornar apenas não reconhecidos
    allAlerts: alerts, // Todos os alertas
    metrics,
    loading,
    error,
    thresholds: finalThresholds,
    
    // Ações
    acknowledgeAlert,
    acknowledgeAllAlerts,
    clearAcknowledgedAlerts,
    refresh: checkWebhookHealth,
    
    // Utilitários
    getAlertsByType,
    getAlertsBySeverity,
    hasUnacknowledgedAlerts,
    getCriticalAlertsCount
  };
};