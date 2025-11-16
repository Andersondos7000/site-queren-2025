// Hooks de monitoramento integrado
export { default as useIntegratedMonitoring } from './useIntegratedMonitoring';
export type {
  IntegratedMetrics,
  MonitoringAlert,
  MonitoringConfig,
  UseIntegratedMonitoringOptions,
  UseIntegratedMonitoringReturn
} from './useIntegratedMonitoring';

// Hook de monitoramento de ferramentas do navegador
export { default as useBrowserToolsMonitoring } from './useBrowserToolsMonitoring';
export type {
  BrowserToolsMetrics,
  ConsoleLog,
  ConsoleError,
  NetworkLog,
  NetworkError,
  PerformanceData,
  AccessibilityIssue,
  MonitoringOptions,
  MonitoringState
} from './useBrowserToolsMonitoring';

// Hook de monitoramento de latência em tempo real
export { default as useRealtimeLatencyMonitor } from './useRealtimeLatencyMonitor';
export type {
  LatencyMetric,
  LatencyStats,
  LatencyMonitorConfig
} from './useRealtimeLatencyMonitor';

// Hook de diagnóstico de formulários
export { default as useFormDiagnostics } from './useFormDiagnostics';
export type {
  FormDiagnosticData,
  FormValidationIssue,
  FormDiagnosticsConfig,
  UseFormDiagnosticsOptions,
  UseFormDiagnosticsReturn
} from './useFormDiagnostics';

// Utilitários e constantes
export const MONITORING_CONSTANTS = {
  DEFAULT_COLLECT_INTERVAL: 5000,
  DEFAULT_RETENTION_PERIOD: 60,
  DEFAULT_ALERT_THRESHOLDS: {
    ERROR_RATE: 0.05,
    RESPONSE_TIME: 1000,
    MEMORY_USAGE: 100,
    CONFLICT_COUNT: 5
  },
  PERFORMANCE_THRESHOLDS: {
    EXCELLENT: 90,
    GOOD: 70,
    FAIR: 50,
    POOR: 30
  }
} as const;

// Tipos utilitários
export type MonitoringSource = 'realtime' | 'browser' | 'system' | 'form';
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';
export type HealthStatus = 'healthy' | 'warning' | 'critical';

// Funções utilitárias
export const createMonitoringAlert = (
  type: 'error' | 'warning' | 'info',
  source: MonitoringSource,
  message: string,
  metadata?: Record<string, unknown>
): MonitoringAlert => ({
  id: `${source}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
  type,
  source,
  message,
  timestamp: new Date(),
  resolved: false,
  metadata
});

export const calculateHealthScore = (metrics: {
  errorRate: number;
  responseTime: number;
  memoryUsage: number;
  conflictCount: number;
}): number => {
  let score = 100;
  
  // Penalizar taxa de erro
  if (metrics.errorRate > 0.01) score -= 10;
  if (metrics.errorRate > 0.05) score -= 20;
  if (metrics.errorRate > 0.1) score -= 30;
  
  // Penalizar tempo de resposta
  if (metrics.responseTime > 500) score -= 10;
  if (metrics.responseTime > 1000) score -= 20;
  if (metrics.responseTime > 2000) score -= 30;
  
  // Penalizar uso de memória
  if (metrics.memoryUsage > 50) score -= 5;
  if (metrics.memoryUsage > 100) score -= 15;
  if (metrics.memoryUsage > 200) score -= 25;
  
  // Penalizar conflitos
  if (metrics.conflictCount > 0) score -= 5;
  if (metrics.conflictCount > 5) score -= 15;
  if (metrics.conflictCount > 10) score -= 25;
  
  return Math.max(0, Math.min(100, score));
};

export const getHealthStatusFromScore = (score: number): HealthStatus => {
  if (score >= MONITORING_CONSTANTS.PERFORMANCE_THRESHOLDS.GOOD) return 'healthy';
  if (score >= MONITORING_CONSTANTS.PERFORMANCE_THRESHOLDS.FAIR) return 'warning';
  return 'critical';
};

// Hook composto para monitoramento completo
export const useCompleteMonitoring = (options: {
  enableIntegrated?: boolean;
  enableBrowserTools?: boolean;
  enableLatencyMonitor?: boolean;
  enableFormDiagnostics?: boolean;
  form?: any;
}) => {
  const integrated = useIntegratedMonitoring({
    config: {
      enableRealtime: options.enableIntegrated ?? true,
      enableBrowserTools: options.enableBrowserTools ?? true
    }
  });
  
  const browserTools = useBrowserToolsMonitoring({
    enableConsoleLogs: options.enableBrowserTools ?? true,
    enableNetworkMonitoring: options.enableBrowserTools ?? true,
    enablePerformanceTracking: options.enableBrowserTools ?? true
  });
  
  const latencyMonitor = useRealtimeLatencyMonitor({
    enabled: options.enableLatencyMonitor ?? true
  });
  
  const formDiagnostics = options.form && options.enableFormDiagnostics 
    ? useFormDiagnostics({ form: options.form })
    : null;
  
  return {
    integrated,
    browserTools,
    latencyMonitor,
    formDiagnostics,
    
    // Controles unificados
    startAll: () => {
      integrated.startMonitoring();
      browserTools.startMonitoring();
      formDiagnostics?.startDiagnostics();
    },
    
    stopAll: () => {
      integrated.stopMonitoring();
      browserTools.stopMonitoring();
      formDiagnostics?.stopDiagnostics();
    },
    
    // Relatório unificado
    generateUnifiedReport: () => {
      return {
        timestamp: new Date().toISOString(),
        integrated: integrated.exportMetrics(),
        browserTools: browserTools.exportMetrics?.() || 'N/A',
        latency: latencyMonitor.stats,
        formDiagnostics: formDiagnostics?.exportDiagnostics() || 'N/A'
      };
    }
  };
};