import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useRealtimeContext } from '../../contexts/RealtimeContext';

// Tipos para monitoramento de latência
export interface LatencyMetric {
  id: string;
  table: string;
  operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'SUBSCRIBE';
  startTime: number;
  endTime: number;
  latency: number;
  success: boolean;
  error?: string;
  userId?: string;
  timestamp: Date;
}

export interface LatencyStats {
  avgLatency: number;
  minLatency: number;
  maxLatency: number;
  p95Latency: number;
  p99Latency: number;
  totalOperations: number;
  successRate: number;
  byTable: Record<string, {
    avgLatency: number;
    operations: number;
    successRate: number;
  }>;
  byOperation: Record<string, {
    avgLatency: number;
    operations: number;
    successRate: number;
  }>;
  recentMetrics: LatencyMetric[];
}

export interface LatencyMonitorConfig {
  enabled: boolean;
  batchSize: number;
  flushInterval: number; // ms
  retentionPeriod: number; // minutes
  alertThreshold: number; // ms
  enableSupabaseMCP: boolean;
}

const DEFAULT_CONFIG: LatencyMonitorConfig = {
  enabled: true,
  batchSize: 20,
  flushInterval: 10000, // 10s
  retentionPeriod: 60, // 1 hora
  alertThreshold: 1000, // 1s
  enableSupabaseMCP: true
};

/**
 * Hook para monitoramento de latência de sincronização em tempo real
 * Integra com Supabase MCP para persistência e análise de métricas
 */
export const useRealtimeLatencyMonitor = (config: Partial<LatencyMonitorConfig> = {}) => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const { connectionStatus } = useRealtimeContext();
  
  const [metrics, setMetrics] = useState<LatencyMetric[]>([]);
  const [stats, setStats] = useState<LatencyStats | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(finalConfig.enabled);
  
  const metricsBuffer = useRef<LatencyMetric[]>([]);
  const flushInterval = useRef<NodeJS.Timeout | null>(null);
  const operationTimers = useRef<Map<string, number>>(new Map());

  // Função para iniciar medição de uma operação
  const startMeasurement = useCallback((operationId: string, table: string, operation: LatencyMetric['operation']) => {
    if (!isMonitoring) return;
    
    const startTime = performance.now();
    operationTimers.current.set(operationId, startTime);
    
    // Armazenar contexto da operação
    operationTimers.current.set(`${operationId}_context`, JSON.stringify({ table, operation }));
  }, [isMonitoring]);

  // Função para finalizar medição de uma operação
  const endMeasurement = useCallback(async (operationId: string, success: boolean, error?: string) => {
    if (!isMonitoring) return;
    
    const startTime = operationTimers.current.get(operationId);
    const contextStr = operationTimers.current.get(`${operationId}_context`);
    
    if (!startTime || !contextStr) return;
    
    const endTime = performance.now();
    const latency = endTime - startTime;
    const context = JSON.parse(contextStr);
    
    const metric: LatencyMetric = {
      id: operationId,
      table: context.table,
      operation: context.operation,
      startTime,
      endTime,
      latency,
      success,
      error,
      userId: (await supabase.auth.getUser()).data.user?.id,
      timestamp: new Date()
    };
    
    // Adicionar ao buffer
    metricsBuffer.current.push(metric);
    
    // Atualizar métricas locais
    setMetrics(prev => {
      const updated = [...prev, metric];
      // Manter apenas métricas recentes
      const cutoff = Date.now() - (finalConfig.retentionPeriod * 60 * 1000);
      return updated.filter(m => m.timestamp.getTime() > cutoff);
    });
    
    // Flush se buffer estiver cheio
    if (metricsBuffer.current.length >= finalConfig.batchSize) {
      await flushMetrics();
    }
    
    // Limpar timers
    operationTimers.current.delete(operationId);
    operationTimers.current.delete(`${operationId}_context`);
    
    // Alerta para latência alta
    if (latency > finalConfig.alertThreshold) {
      console.warn(`[LatencyMonitor] Alta latência detectada: ${latency.toFixed(2)}ms para ${context.operation} em ${context.table}`);
    }
  }, [isMonitoring, finalConfig.batchSize, finalConfig.retentionPeriod, finalConfig.alertThreshold]);

  // Função para fazer flush das métricas para o Supabase MCP
  const flushMetrics = useCallback(async () => {
    if (metricsBuffer.current.length === 0 || !finalConfig.enableSupabaseMCP) return;
    
    const metricsToSend = [...metricsBuffer.current];
    metricsBuffer.current = [];
    
    try {
      // Enviar métricas via Edge Function usando Supabase MCP
      const { data, error } = await supabase.functions.invoke('realtime-latency-monitor', {
        body: {
          metrics: metricsToSend,
          timestamp: new Date().toISOString()
        }
      });
      
      if (error) {
        console.error('[LatencyMonitor] Erro ao enviar métricas:', error);
        // Recolocar métricas no buffer em caso de erro
        metricsBuffer.current.unshift(...metricsToSend);
      }
    } catch (error) {
      console.error('[LatencyMonitor] Erro na comunicação com Supabase MCP:', error);
      // Recolocar métricas no buffer
      metricsBuffer.current.unshift(...metricsToSend);
    }
  }, [finalConfig.enableSupabaseMCP]);

  // Calcular estatísticas das métricas
  const calculateStats = useCallback((): LatencyStats => {
    if (metrics.length === 0) {
      return {
        avgLatency: 0,
        minLatency: 0,
        maxLatency: 0,
        p95Latency: 0,
        p99Latency: 0,
        totalOperations: 0,
        successRate: 0,
        byTable: {},
        byOperation: {},
        recentMetrics: []
      };
    }
    
    const latencies = metrics.map(m => m.latency).sort((a, b) => a - b);
    const successfulOps = metrics.filter(m => m.success).length;
    
    // Calcular percentis
    const p95Index = Math.floor(latencies.length * 0.95);
    const p99Index = Math.floor(latencies.length * 0.99);
    
    // Agrupar por tabela
    const byTable: Record<string, { avgLatency: number; operations: number; successRate: number }> = {};
    metrics.forEach(metric => {
      if (!byTable[metric.table]) {
        byTable[metric.table] = { avgLatency: 0, operations: 0, successRate: 0 };
      }
      byTable[metric.table].operations++;
      byTable[metric.table].avgLatency += metric.latency;
    });
    
    Object.keys(byTable).forEach(table => {
      const tableMetrics = metrics.filter(m => m.table === table);
      byTable[table].avgLatency = byTable[table].avgLatency / byTable[table].operations;
      byTable[table].successRate = tableMetrics.filter(m => m.success).length / tableMetrics.length;
    });
    
    // Agrupar por operação
    const byOperation: Record<string, { avgLatency: number; operations: number; successRate: number }> = {};
    metrics.forEach(metric => {
      if (!byOperation[metric.operation]) {
        byOperation[metric.operation] = { avgLatency: 0, operations: 0, successRate: 0 };
      }
      byOperation[metric.operation].operations++;
      byOperation[metric.operation].avgLatency += metric.latency;
    });
    
    Object.keys(byOperation).forEach(operation => {
      const opMetrics = metrics.filter(m => m.operation === operation);
      byOperation[operation].avgLatency = byOperation[operation].avgLatency / byOperation[operation].operations;
      byOperation[operation].successRate = opMetrics.filter(m => m.success).length / opMetrics.length;
    });
    
    return {
      avgLatency: latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length,
      minLatency: Math.min(...latencies),
      maxLatency: Math.max(...latencies),
      p95Latency: latencies[p95Index] || 0,
      p99Latency: latencies[p99Index] || 0,
      totalOperations: metrics.length,
      successRate: successfulOps / metrics.length,
      byTable,
      byOperation,
      recentMetrics: metrics.slice(-20) // Últimas 20 métricas
    };
  }, [metrics]);

  // Atualizar estatísticas quando métricas mudarem
  useEffect(() => {
    const newStats = calculateStats();
    setStats(newStats);
  }, [calculateStats]);

  // Configurar flush automático
  useEffect(() => {
    if (!isMonitoring) return;
    
    flushInterval.current = setInterval(flushMetrics, finalConfig.flushInterval);
    
    return () => {
      if (flushInterval.current) {
        clearInterval(flushInterval.current);
      }
    };
  }, [isMonitoring, flushMetrics, finalConfig.flushInterval]);

  // Flush ao desmontar componente
  useEffect(() => {
    return () => {
      flushMetrics();
    };
  }, [flushMetrics]);

  // Wrapper para operações monitoradas
  const monitoredOperation = useCallback(async <T>(
    operationFn: () => Promise<T>,
    table: string,
    operation: LatencyMetric['operation']
  ): Promise<T> => {
    const operationId = `${table}_${operation}_${Date.now()}_${Math.random()}`;
    
    startMeasurement(operationId, table, operation);
    
    try {
      const result = await operationFn();
      await endMeasurement(operationId, true);
      return result;
    } catch (error) {
      await endMeasurement(operationId, false, error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }, [startMeasurement, endMeasurement]);

  // Obter métricas do Supabase MCP
  const getHistoricalMetrics = useCallback(async (hours = 24): Promise<LatencyStats | null> => {
    if (!finalConfig.enableSupabaseMCP) return null;
    
    try {
      const { data, error } = await supabase.functions.invoke('realtime-latency-monitor', {
        method: 'GET',
        body: {
          action: 'get_stats',
          hours
        }
      });
      
      if (error) throw error;
      
      return data.stats;
    } catch (error) {
      console.error('[LatencyMonitor] Erro ao obter métricas históricas:', error);
      return null;
    }
  }, [finalConfig.enableSupabaseMCP]);

  // Controles de monitoramento
  const startMonitoring = useCallback(() => {
    setIsMonitoring(true);
  }, []);

  const stopMonitoring = useCallback(() => {
    setIsMonitoring(false);
    if (flushInterval.current) {
      clearInterval(flushInterval.current);
    }
  }, []);

  const clearMetrics = useCallback(() => {
    setMetrics([]);
    setStats(null);
    metricsBuffer.current = [];
  }, []);

  return {
    // Estado
    metrics,
    stats,
    isMonitoring,
    connectionStatus,
    
    // Controles
    startMonitoring,
    stopMonitoring,
    clearMetrics,
    
    // Medição
    startMeasurement,
    endMeasurement,
    monitoredOperation,
    
    // Dados históricos
    getHistoricalMetrics,
    flushMetrics
  };
};

export default useRealtimeLatencyMonitor;