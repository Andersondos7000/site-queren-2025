import { useState, useEffect, useCallback } from 'react';
import { useRealtimeMetrics } from '../../contexts/RealtimeContext';

// Tipos para integração com Browser Tools MCP
interface BrowserToolsMetrics {
  consoleLogs: ConsoleLog[];
  consoleErrors: ConsoleError[];
  networkLogs: NetworkLog[];
  networkErrors: NetworkError[];
  performanceMetrics: PerformanceData;
  accessibilityIssues: AccessibilityIssue[];
}

interface ConsoleLog {
  level: 'log' | 'info' | 'warn' | 'error';
  message: string;
  timestamp: number;
  args?: any[];
}

interface ConsoleError {
  message: string;
  source: string;
  lineno: number;
  colno: number;
  error?: Error;
  timestamp: number;
}

interface NetworkLog {
  url: string;
  method: string;
  status: number;
  statusText: string;
  responseTime: number;
  requestSize: number;
  responseSize: number;
  timestamp: number;
  headers: Record<string, string>;
}

interface NetworkError {
  url: string;
  method: string;
  error: string;
  timestamp: number;
}

interface PerformanceData {
  navigationTiming: PerformanceNavigationTiming;
  resourceTiming: PerformanceResourceTiming[];
  paintTiming: PerformancePaintTiming[];
  memoryInfo?: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
}

interface AccessibilityIssue {
  id: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical';
  description: string;
  help: string;
  helpUrl: string;
  nodes: {
    html: string;
    target: string[];
  }[];
}

interface MonitoringOptions {
  enableConsoleLogs?: boolean;
  enableNetworkMonitoring?: boolean;
  enablePerformanceTracking?: boolean;
  enableAccessibilityAudit?: boolean;
  collectInterval?: number; // em milissegundos
  maxLogEntries?: number;
}

interface MonitoringState {
  isActive: boolean;
  metrics: BrowserToolsMetrics;
  lastUpdate: Date | null;
  errorCount: number;
}

// Função para simular chamadas MCP (será substituída pela integração real)
const callBrowserToolsMCP = async (toolName: string, params?: any): Promise<any> => {
  // Esta é uma simulação - na implementação real, isso seria uma chamada para o MCP
  try {
    const response = await fetch(`/api/mcp/browser-tools/${toolName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params || {})
    });
    
    if (!response.ok) {
      throw new Error(`MCP call failed: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.warn(`Simulando dados para ${toolName} devido a erro:`, error);
    
    // Retornar dados simulados para desenvolvimento
    switch (toolName) {
      case 'getConsoleLogs':
        return {
          logs: [
            {
              level: 'info',
              message: 'Aplicação iniciada',
              timestamp: Date.now() - 10000
            },
            {
              level: 'warn',
              message: 'Aviso de performance',
              timestamp: Date.now() - 5000
            }
          ]
        };
      
      case 'getConsoleErrors':
        return {
          errors: [
            {
              message: 'TypeError: Cannot read property of undefined',
              source: 'app.js',
              lineno: 42,
              colno: 15,
              timestamp: Date.now() - 30000
            }
          ]
        };
      
      case 'getNetworkLogs':
        return {
          requests: [
            {
              url: '/api/products',
              method: 'GET',
              status: 200,
              statusText: 'OK',
              responseTime: 150,
              timestamp: Date.now() - 2000
            },
            {
              url: '/api/cart',
              method: 'POST',
              status: 201,
              statusText: 'Created',
              responseTime: 89,
              timestamp: Date.now() - 1000
            }
          ]
        };
      
      case 'getNetworkErrors':
        return {
          errors: [
            {
              url: '/api/unavailable',
              method: 'GET',
              error: 'Network timeout',
              timestamp: Date.now() - 15000
            }
          ]
        };
      
      case 'runAccessibilityAudit':
        return {
          violations: [
            {
              id: 'color-contrast',
              impact: 'serious',
              description: 'Elements must have sufficient color contrast',
              help: 'Ensure all text elements have sufficient color contrast',
              helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/color-contrast',
              nodes: [
                {
                  html: '<button class="btn-light">Click me</button>',
                  target: ['.btn-light']
                }
              ]
            }
          ]
        };
      
      default:
        return {};
    }
  }
};

export function useBrowserToolsMonitoring(options: MonitoringOptions = {}) {
  const {
    enableConsoleLogs = true,
    enableNetworkMonitoring = true,
    enablePerformanceTracking = true,
    enableAccessibilityAudit = false,
    collectInterval = 5000,
    maxLogEntries = 100
  } = options;

  const { recordLatency, recordError } = useRealtimeMetrics();
  
  const [state, setState] = useState<MonitoringState>({
    isActive: false,
    metrics: {
      consoleLogs: [],
      consoleErrors: [],
      networkLogs: [],
      networkErrors: [],
      performanceMetrics: {
        navigationTiming: {} as PerformanceNavigationTiming,
        resourceTiming: [],
        paintTiming: []
      },
      accessibilityIssues: []
    },
    lastUpdate: null,
    errorCount: 0
  });

  // Coletar logs do console
  const collectConsoleLogs = useCallback(async () => {
    if (!enableConsoleLogs) return;
    
    try {
      const result = await callBrowserToolsMCP('getConsoleLogs');
      const logs = result.logs || [];
      
      setState(prev => ({
        ...prev,
        metrics: {
          ...prev.metrics,
          consoleLogs: logs.slice(-maxLogEntries)
        }
      }));
    } catch (error) {
      console.error('Erro ao coletar logs do console:', error);
      setState(prev => ({ ...prev, errorCount: prev.errorCount + 1 }));
    }
  }, [enableConsoleLogs, maxLogEntries]);

  // Coletar erros do console
  const collectConsoleErrors = useCallback(async () => {
    if (!enableConsoleLogs) return;
    
    try {
      const result = await callBrowserToolsMCP('getConsoleErrors');
      const errors = result.errors || [];
      
      setState(prev => ({
        ...prev,
        metrics: {
          ...prev.metrics,
          consoleErrors: errors.slice(-maxLogEntries)
        }
      }));
      
      if (errors.length > 0) {
        recordError();
      }
    } catch (error) {
      console.error('Erro ao coletar erros do console:', error);
      setState(prev => ({ ...prev, errorCount: prev.errorCount + 1 }));
    }
  }, [enableConsoleLogs, maxLogEntries, recordError]);

  // Coletar logs de rede
  const collectNetworkLogs = useCallback(async () => {
    if (!enableNetworkMonitoring) return;
    
    try {
      const result = await callBrowserToolsMCP('getNetworkLogs');
      const requests = result.requests || [];
      
      // Calcular latência média
      if (requests.length > 0) {
        const avgLatency = requests.reduce((sum: number, req: any) => sum + req.responseTime, 0) / requests.length;
        recordLatency(avgLatency);
      }
      
      setState(prev => ({
        ...prev,
        metrics: {
          ...prev.metrics,
          networkLogs: requests.slice(-maxLogEntries)
        }
      }));
    } catch (error) {
      console.error('Erro ao coletar logs de rede:', error);
      setState(prev => ({ ...prev, errorCount: prev.errorCount + 1 }));
    }
  }, [enableNetworkMonitoring, maxLogEntries, recordLatency]);

  // Coletar erros de rede
  const collectNetworkErrors = useCallback(async () => {
    if (!enableNetworkMonitoring) return;
    
    try {
      const result = await callBrowserToolsMCP('getNetworkErrors');
      const errors = result.errors || [];
      
      setState(prev => ({
        ...prev,
        metrics: {
          ...prev.metrics,
          networkErrors: errors.slice(-maxLogEntries)
        }
      }));
      
      if (errors.length > 0) {
        recordError();
      }
    } catch (error) {
      console.error('Erro ao coletar erros de rede:', error);
      setState(prev => ({ ...prev, errorCount: prev.errorCount + 1 }));
    }
  }, [enableNetworkMonitoring, maxLogEntries, recordError]);

  // Coletar métricas de performance
  const collectPerformanceMetrics = useCallback(async () => {
    if (!enablePerformanceTracking) return;
    
    try {
      // Coletar métricas nativas do browser
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      const paints = performance.getEntriesByType('paint') as PerformancePaintTiming[];
      
      let memoryInfo;
      if ('memory' in performance) {
        memoryInfo = (performance as any).memory;
      }
      
      setState(prev => ({
        ...prev,
        metrics: {
          ...prev.metrics,
          performanceMetrics: {
            navigationTiming: navigation,
            resourceTiming: resources.slice(-50), // Últimos 50 recursos
            paintTiming: paints,
            memoryInfo
          }
        }
      }));
    } catch (error) {
      console.error('Erro ao coletar métricas de performance:', error);
      setState(prev => ({ ...prev, errorCount: prev.errorCount + 1 }));
    }
  }, [enablePerformanceTracking]);

  // Executar auditoria de acessibilidade
  const runAccessibilityAudit = useCallback(async () => {
    if (!enableAccessibilityAudit) return;
    
    try {
      const result = await callBrowserToolsMCP('runAccessibilityAudit');
      const violations = result.violations || [];
      
      setState(prev => ({
        ...prev,
        metrics: {
          ...prev.metrics,
          accessibilityIssues: violations
        }
      }));
    } catch (error) {
      console.error('Erro ao executar auditoria de acessibilidade:', error);
      setState(prev => ({ ...prev, errorCount: prev.errorCount + 1 }));
    }
  }, [enableAccessibilityAudit]);

  // Coletar todas as métricas
  const collectAllMetrics = useCallback(async () => {
    await Promise.all([
      collectConsoleLogs(),
      collectConsoleErrors(),
      collectNetworkLogs(),
      collectNetworkErrors(),
      collectPerformanceMetrics()
    ]);
    
    setState(prev => ({
      ...prev,
      lastUpdate: new Date()
    }));
  }, [
    collectConsoleLogs,
    collectConsoleErrors,
    collectNetworkLogs,
    collectNetworkErrors,
    collectPerformanceMetrics
  ]);

  // Iniciar monitoramento
  const startMonitoring = useCallback(() => {
    setState(prev => ({ ...prev, isActive: true }));
  }, []);

  // Parar monitoramento
  const stopMonitoring = useCallback(() => {
    setState(prev => ({ ...prev, isActive: false }));
  }, []);

  // Limpar logs
  const clearLogs = useCallback(async () => {
    try {
      await callBrowserToolsMCP('wipeLogs');
      setState(prev => ({
        ...prev,
        metrics: {
          consoleLogs: [],
          consoleErrors: [],
          networkLogs: [],
          networkErrors: [],
          performanceMetrics: {
            navigationTiming: {} as PerformanceNavigationTiming,
            resourceTiming: [],
            paintTiming: []
          },
          accessibilityIssues: []
        },
        errorCount: 0
      }));
    } catch (error) {
      console.error('Erro ao limpar logs:', error);
    }
  }, []);

  // Tirar screenshot
  const takeScreenshot = useCallback(async () => {
    try {
      const result = await callBrowserToolsMCP('takeScreenshot');
      return result.screenshot;
    } catch (error) {
      console.error('Erro ao tirar screenshot:', error);
      return null;
    }
  }, []);

  // Coletar métricas periodicamente quando ativo
  useEffect(() => {
    if (!state.isActive) return;

    const interval = setInterval(collectAllMetrics, collectInterval);
    
    // Coletar imediatamente ao iniciar
    collectAllMetrics();

    return () => clearInterval(interval);
  }, [state.isActive, collectAllMetrics, collectInterval]);

  // Executar auditoria de acessibilidade periodicamente (menos frequente)
  useEffect(() => {
    if (!state.isActive || !enableAccessibilityAudit) return;

    const interval = setInterval(runAccessibilityAudit, 30000); // A cada 30 segundos
    
    return () => clearInterval(interval);
  }, [state.isActive, enableAccessibilityAudit, runAccessibilityAudit]);

  return {
    // Estado
    isActive: state.isActive,
    metrics: state.metrics,
    lastUpdate: state.lastUpdate,
    errorCount: state.errorCount,
    
    // Controles
    startMonitoring,
    stopMonitoring,
    clearLogs,
    takeScreenshot,
    
    // Coleta manual
    collectAllMetrics,
    runAccessibilityAudit,
    
    // Métricas computadas
    totalErrors: state.metrics.consoleErrors.length + state.metrics.networkErrors.length,
    averageResponseTime: state.metrics.networkLogs.length > 0 
      ? state.metrics.networkLogs.reduce((sum, log) => sum + log.responseTime, 0) / state.metrics.networkLogs.length
      : 0,
    criticalAccessibilityIssues: state.metrics.accessibilityIssues.filter(issue => issue.impact === 'critical').length
  };
}

export default useBrowserToolsMonitoring;