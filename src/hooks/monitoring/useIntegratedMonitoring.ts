import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRealtimeContext } from '../../contexts/RealtimeContext';
import useBrowserToolsMonitoring from './useBrowserToolsMonitoring';
import { useRealtimeLatencyMonitor } from './useRealtimeLatencyMonitor';

// Tipos para o sistema integrado de monitoramento
export interface IntegratedMetrics {
  realtime: {
    connected: boolean;
    totalSyncs: number;
    conflictsCount: number;
    lastSyncTime: Date | null;
    syncsByType: {
      cart: number;
      stock: number;
      orders: number;
    };
    avgSyncLatency: number;
    p95Latency: number;
    p99Latency: number;
    maxLatency: number;
    minLatency: number;
  };
  browser: {
    active: boolean;
    consoleErrors: number;
    networkErrors: number;
    avgResponseTime: number;
    memoryUsage: number;
    performanceScore: number;
  };
  system: {
    overallHealth: 'healthy' | 'warning' | 'critical';
    uptime: number;
    errorRate: number;
    throughput: number;
  };
}

export interface MonitoringAlert {
  id: string;
  type: 'error' | 'warning' | 'info';
  source: 'realtime' | 'browser' | 'system';
  message: string;
  timestamp: Date;
  resolved: boolean;
  metadata?: Record<string, any>;
}

export interface MonitoringConfig {
  enableRealtime: boolean;
  enableBrowserTools: boolean;
  alertThresholds: {
    errorRate: number;
    responseTime: number;
    memoryUsage: number;
    conflictCount: number;
  };
  collectInterval: number;
  retentionPeriod: number; // em minutos
}

const DEFAULT_CONFIG: MonitoringConfig = {
  enableRealtime: true,
  enableBrowserTools: true,
  alertThresholds: {
    errorRate: 0.05, // 5%
    responseTime: 1000, // 1s
    memoryUsage: 100, // 100MB
    conflictCount: 5
  },
  collectInterval: 5000, // 5s
  retentionPeriod: 60 // 1 hora
};

export interface UseIntegratedMonitoringOptions {
  config?: Partial<MonitoringConfig>;
  onAlert?: (alert: MonitoringAlert) => void;
  onMetricsUpdate?: (metrics: IntegratedMetrics) => void;
}

export interface UseIntegratedMonitoringReturn {
  // Estado
  metrics: IntegratedMetrics;
  alerts: MonitoringAlert[];
  isMonitoring: boolean;
  config: MonitoringConfig;
  
  // Controles
  startMonitoring: () => void;
  stopMonitoring: () => void;
  updateConfig: (newConfig: Partial<MonitoringConfig>) => void;
  
  // Alertas
  resolveAlert: (alertId: string) => void;
  clearAlerts: () => void;
  getUnresolvedAlerts: () => MonitoringAlert[];
  
  // Métricas
  exportMetrics: () => string;
  resetMetrics: () => void;
  getHealthScore: () => number;
  
  // Monitoramento de Latência
  measureSyncLatency: (operation: string, metadata?: Record<string, any>) => { end: () => void } | null;
  latencyStats: any;
  
  // Utilitários
  takeSnapshot: () => Promise<{
    timestamp: Date;
    metrics: IntegratedMetrics;
    screenshot?: string;
  }>;
}

export const useIntegratedMonitoring = ({
  config: userConfig = {},
  onAlert,
  onMetricsUpdate
}: UseIntegratedMonitoringOptions = {}): UseIntegratedMonitoringReturn => {
  // Estado local
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [alerts, setAlerts] = useState<MonitoringAlert[]>([]);
  const [config, setConfig] = useState<MonitoringConfig>({
    ...DEFAULT_CONFIG,
    ...userConfig
  });
  const [startTime] = useState(Date.now());
  const [metricsHistory, setMetricsHistory] = useState<IntegratedMetrics[]>([]);

  // Hooks dos sistemas de monitoramento
  const { state: realtimeState, isFullyConnected } = useRealtimeContext();
  const {
    isActive: browserActive,
    metrics: browserMetrics,
    totalErrors: browserErrors,
    averageResponseTime: browserAvgResponse,
    startMonitoring: startBrowserMonitoring,
    stopMonitoring: stopBrowserMonitoring,
    takeScreenshot
  } = useBrowserToolsMonitoring({
    enableConsoleLogs: config.enableBrowserTools,
    enableNetworkMonitoring: config.enableBrowserTools,
    enablePerformanceTracking: config.enableBrowserTools,
    collectInterval: config.collectInterval
  });

  // Hook de monitoramento de latência
  const { 
    startMeasurement, 
    endMeasurement, 
    stats: latencyStats, 
    isMonitoring: isLatencyMonitoring 
  } = useRealtimeLatencyMonitor({
    enabled: config.enableRealtime,
    batchSize: 10,
    flushInterval: 15000
  });

  // Calcular métricas integradas
  const metrics = useMemo((): IntegratedMetrics => {
    const totalSyncs = realtimeState.syncCounts.cart + 
                      realtimeState.syncCounts.stock + 
                      realtimeState.syncCounts.orders;
    
    const memoryUsage = browserMetrics?.performanceMetrics?.memoryInfo
      ? Math.round(browserMetrics.performanceMetrics.memoryInfo.usedJSHeapSize / 1024 / 1024)
      : 0;
    
    const networkErrors = browserMetrics?.networkErrors?.length || 0;
    const consoleErrors = browserMetrics?.consoleErrors?.length || 0;
    
    // Calcular score de performance (0-100)
    let performanceScore = 100;
    if (browserAvgResponse > 500) performanceScore -= 20;
    if (browserAvgResponse > 1000) performanceScore -= 20;
    if (memoryUsage > 50) performanceScore -= 15;
    if (memoryUsage > 100) performanceScore -= 15;
    if (networkErrors > 0) performanceScore -= 10;
    if (consoleErrors > 0) performanceScore -= 10;
    if (realtimeState.conflicts.length > 0) performanceScore -= 10;
    
    performanceScore = Math.max(0, performanceScore);
    
    // Calcular saúde geral do sistema
    let overallHealth: 'healthy' | 'warning' | 'critical' = 'healthy';
    const issues = [];
    
    if (!isFullyConnected) issues.push('realtime-disconnected');
    if (realtimeState.conflicts.length >= config.alertThresholds.conflictCount) issues.push('high-conflicts');
    if (browserAvgResponse >= config.alertThresholds.responseTime) issues.push('high-latency');
    if (memoryUsage >= config.alertThresholds.memoryUsage) issues.push('high-memory');
    if ((networkErrors + consoleErrors) / Math.max(totalSyncs, 1) >= config.alertThresholds.errorRate) issues.push('high-error-rate');
    
    if (issues.length >= 3) overallHealth = 'critical';
    else if (issues.length >= 1) overallHealth = 'warning';
    
    return {
      realtime: {
        connected: isFullyConnected,
        totalSyncs,
        conflictsCount: realtimeState.conflicts.length,
        lastSyncTime: realtimeState.lastSync,
        syncsByType: {
          cart: realtimeState.syncCounts.cart,
          stock: realtimeState.syncCounts.stock,
          orders: realtimeState.syncCounts.orders
        },
        avgSyncLatency: latencyStats?.avgLatency || 0,
        p95Latency: latencyStats?.p95Latency || 0,
        p99Latency: latencyStats?.p99Latency || 0,
        maxLatency: latencyStats?.maxLatency || 0,
        minLatency: latencyStats?.minLatency || 0
      },
      browser: {
        active: browserActive,
        consoleErrors,
        networkErrors,
        avgResponseTime: browserAvgResponse,
        memoryUsage,
        performanceScore
      },
      system: {
        overallHealth,
        uptime: Math.round((Date.now() - startTime) / 1000),
        errorRate: (networkErrors + consoleErrors) / Math.max(totalSyncs, 1),
        throughput: totalSyncs / Math.max((Date.now() - startTime) / 1000 / 60, 1) // syncs por minuto
      }
    };
  }, [realtimeState, isFullyConnected, browserMetrics, browserActive, browserErrors, browserAvgResponse, config.alertThresholds, startTime]);

  // Detectar e criar alertas
  useEffect(() => {
    if (!isMonitoring) return;
    
    const newAlerts: MonitoringAlert[] = [];
    
    // Alertas de Realtime
    if (!metrics.realtime.connected) {
      newAlerts.push({
        id: `realtime-disconnected-${Date.now()}`,
        type: 'error',
        source: 'realtime',
        message: 'Conexão realtime perdida',
        timestamp: new Date(),
        resolved: false
      });
    }
    
    if (metrics.realtime.conflictsCount >= config.alertThresholds.conflictCount) {
      newAlerts.push({
        id: `high-conflicts-${Date.now()}`,
        type: 'warning',
        source: 'realtime',
        message: `${metrics.realtime.conflictsCount} conflitos de sincronização detectados`,
        timestamp: new Date(),
        resolved: false,
        metadata: { conflictCount: metrics.realtime.conflictsCount }
      });
    }
    
    // Alertas de Browser
    if (metrics.browser.avgResponseTime >= config.alertThresholds.responseTime) {
      newAlerts.push({
        id: `high-latency-${Date.now()}`,
        type: 'warning',
        source: 'browser',
        message: `Latência alta detectada: ${metrics.browser.avgResponseTime}ms`,
        timestamp: new Date(),
        resolved: false,
        metadata: { responseTime: metrics.browser.avgResponseTime }
      });
    }
    
    if (metrics.browser.memoryUsage >= config.alertThresholds.memoryUsage) {
      newAlerts.push({
        id: `high-memory-${Date.now()}`,
        type: 'warning',
        source: 'browser',
        message: `Uso de memória alto: ${metrics.browser.memoryUsage}MB`,
        timestamp: new Date(),
        resolved: false,
        metadata: { memoryUsage: metrics.browser.memoryUsage }
      });
    }
    
    // Alertas de Sistema
    if (metrics.system.errorRate >= config.alertThresholds.errorRate) {
      newAlerts.push({
        id: `high-error-rate-${Date.now()}`,
        type: 'error',
        source: 'system',
        message: `Taxa de erro alta: ${(metrics.system.errorRate * 100).toFixed(1)}%`,
        timestamp: new Date(),
        resolved: false,
        metadata: { errorRate: metrics.system.errorRate }
      });
    }
    
    // Adicionar novos alertas (evitar duplicatas)
    if (newAlerts.length > 0) {
      setAlerts(prev => {
        const existingIds = new Set(prev.map(a => a.id));
        const uniqueNewAlerts = newAlerts.filter(a => !existingIds.has(a.id));
        
        // Notificar sobre novos alertas
        uniqueNewAlerts.forEach(alert => {
          onAlert?.(alert);
        });
        
        return [...prev, ...uniqueNewAlerts];
      });
    }
  }, [metrics, isMonitoring, config.alertThresholds, onAlert]);

  // Atualizar histórico de métricas
  useEffect(() => {
    if (!isMonitoring) return;
    
    const interval = setInterval(() => {
      setMetricsHistory(prev => {
        const newHistory = [...prev, metrics];
        
        // Manter apenas dados dentro do período de retenção
        const cutoffTime = Date.now() - (config.retentionPeriod * 60 * 1000);
        return newHistory.filter(m => 
          m.realtime.lastSyncTime && m.realtime.lastSyncTime.getTime() > cutoffTime
        );
      });
      
      onMetricsUpdate?.(metrics);
    }, config.collectInterval);
    
    return () => clearInterval(interval);
  }, [metrics, isMonitoring, config.collectInterval, config.retentionPeriod, onMetricsUpdate]);

  // Controles de monitoramento
  const startMonitoring = useCallback(() => {
    setIsMonitoring(true);
    if (config.enableBrowserTools) {
      startBrowserMonitoring();
    }
  }, [config.enableBrowserTools, startBrowserMonitoring]);

  const stopMonitoring = useCallback(() => {
    setIsMonitoring(false);
    if (config.enableBrowserTools) {
      stopBrowserMonitoring();
    }
  }, [config.enableBrowserTools, stopBrowserMonitoring]);

  const updateConfig = useCallback((newConfig: Partial<MonitoringConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
  }, []);

  // Gestão de alertas
  const resolveAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId ? { ...alert, resolved: true } : alert
    ));
  }, []);

  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  const getUnresolvedAlerts = useCallback(() => {
    return alerts.filter(alert => !alert.resolved);
  }, [alerts]);

  // Utilitários de métricas
  const exportMetrics = useCallback(() => {
    const exportData = {
      timestamp: new Date().toISOString(),
      currentMetrics: metrics,
      alerts: alerts,
      config: config,
      history: metricsHistory
    };
    
    return JSON.stringify(exportData, null, 2);
  }, [metrics, alerts, config, metricsHistory]);

  const resetMetrics = useCallback(() => {
    setMetricsHistory([]);
    setAlerts([]);
  }, []);

  const getHealthScore = useCallback(() => {
    const weights = {
      realtime: 0.4,
      browser: 0.4,
      system: 0.2
    };
    
    let realtimeScore = 100;
    if (!metrics.realtime.connected) realtimeScore -= 50;
    if (metrics.realtime.conflictsCount > 0) realtimeScore -= 25;
    
    const browserScore = metrics.browser.performanceScore;
    
    let systemScore = 100;
    if (metrics.system.overallHealth === 'warning') systemScore = 60;
    if (metrics.system.overallHealth === 'critical') systemScore = 20;
    
    return Math.round(
      realtimeScore * weights.realtime +
      browserScore * weights.browser +
      systemScore * weights.system
    );
  }, [metrics]);

  const takeSnapshot = useCallback(async () => {
    const screenshot = await takeScreenshot();
    
    return {
      timestamp: new Date(),
      metrics: { ...metrics },
      screenshot
    };
  }, [metrics, takeScreenshot]);

  // Função para medir latência de sincronização
  const measureSyncLatency = useCallback((operation: string, metadata?: Record<string, any>) => {
    if (!config.enableRealtime || !isLatencyMonitoring) return null;
    
    const measurementId = startMeasurement({
      operation,
      metadata: {
        timestamp: Date.now(),
        connectionStatus: isFullyConnected ? 'connected' : 'disconnected',
        ...metadata
      }
    });
    
    return {
      end: () => endMeasurement(measurementId)
    };
  }, [startMeasurement, endMeasurement, config.enableRealtime, isLatencyMonitoring, isFullyConnected]);

  return {
    // Estado
    metrics,
    alerts,
    isMonitoring,
    config,
    
    // Controles
    startMonitoring,
    stopMonitoring,
    updateConfig,
    
    // Alertas
    resolveAlert,
    clearAlerts,
    getUnresolvedAlerts,
    
    // Métricas
    exportMetrics,
    resetMetrics,
    getHealthScore,
    
    // Monitoramento de Latência
    measureSyncLatency,
    latencyStats,
    
    // Utilitários
    takeSnapshot
  };
};

export default useIntegratedMonitoring;