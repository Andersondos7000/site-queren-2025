import React, { useEffect, useState, useCallback } from 'react';
import { useRealtimeContext, useRealtimeMetrics } from '../../contexts/RealtimeContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Activity, AlertTriangle, CheckCircle, Download, Play, Square, Wifi, WifiOff, Monitor, Settings } from 'lucide-react';
import MonitoringDashboard from './MonitoringDashboard';
import useBrowserToolsMonitoring from '../../hooks/monitoring/useBrowserToolsMonitoring';

// Tipos para métricas de performance
interface PerformanceMetrics {
  // Métricas de rede
  networkLatency: number;
  requestCount: number;
  errorRate: number;
  
  // Métricas de UI
  renderTime: number;
  componentUpdates: number;
  
  // Métricas de sincronização
  syncLatency: number;
  conflictCount: number;
  
  // Métricas do browser
  memoryUsage: number;
  cpuUsage: number;
}

interface NetworkLog {
  url: string;
  method: string;
  status: number;
  responseTime: number;
  timestamp: Date;
}

interface ConsoleError {
  message: string;
  stack?: string;
  timestamp: Date;
  level: 'error' | 'warn' | 'info';
}

interface PerformanceMonitorProps {
  className?: string;
  showFullDashboard?: boolean;
}

export function PerformanceMonitor({ 
  className, 
  showFullDashboard = false 
}: PerformanceMonitorProps = {}) {
  const { state, updateMetrics } = useRealtimeContext();
  const { recordLatency, recordError } = useRealtimeMetrics();
  
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    networkLatency: 0,
    requestCount: 0,
    errorRate: 0,
    renderTime: 0,
    componentUpdates: 0,
    syncLatency: 0,
    conflictCount: 0,
    memoryUsage: 0,
    cpuUsage: 0
  });
  
  const [networkLogs, setNetworkLogs] = useState<NetworkLog[]>([]);
  const [consoleErrors, setConsoleErrors] = useState<ConsoleError[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [activeTab, setActiveTab] = useState('summary');
  
  // Integração com Browser Tools MCP
  const {
    isActive: mcpIsActive,
    metrics: mcpMetrics,
    totalErrors: mcpTotalErrors,
    averageResponseTime: mcpAvgResponseTime,
    startMonitoring: mcpStartMonitoring,
    stopMonitoring: mcpStopMonitoring
  } = useBrowserToolsMonitoring({
    enableConsoleLogs: true,
    enableNetworkMonitoring: true,
    enablePerformanceTracking: true,
    collectInterval: 2000
  });

  // Função para coletar logs de rede usando Browser Tools MCP
  const collectNetworkLogs = useCallback(async () => {
    try {
      // Simular chamada para Browser Tools MCP
      // Em uma implementação real, isso seria uma chamada para o MCP
      const response = await fetch('/api/browser-tools/network-logs');
      if (response.ok) {
        const logs = await response.json();
        setNetworkLogs(logs);
        
        // Calcular métricas de rede
        const avgLatency = logs.reduce((sum: number, log: any) => sum + log.responseTime, 0) / logs.length;
        const errorCount = logs.filter((log: any) => log.status >= 400).length;
        const errorRate = logs.length > 0 ? (errorCount / logs.length) * 100 : 0;
        
        setMetrics(prev => ({
          ...prev,
          networkLatency: avgLatency || 0,
          requestCount: logs.length,
          errorRate
        }));
        
        recordLatency(avgLatency || 0);
        if (errorCount > 0) {
          recordError();
        }
      }
    } catch (error) {
      console.error('Erro ao coletar logs de rede:', error);
    }
  }, [recordLatency, recordError]);

  // Função para coletar erros do console
  const collectConsoleErrors = useCallback(async () => {
    try {
      // Simular chamada para Browser Tools MCP
      const response = await fetch('/api/browser-tools/console-errors');
      if (response.ok) {
        const errors = await response.json();
        setConsoleErrors(errors);
      }
    } catch (error) {
      console.error('Erro ao coletar erros do console:', error);
    }
  }, []);

  // Função para coletar métricas de performance do browser
  const collectBrowserMetrics = useCallback(() => {
    if ('performance' in window && 'memory' in (performance as any)) {
      const memory = (performance as any).memory;
      const memoryUsage = (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100;
      
      setMetrics(prev => ({
        ...prev,
        memoryUsage
      }));
    }
    
    // Medir tempo de renderização
    const renderStart = performance.now();
    requestAnimationFrame(() => {
      const renderTime = performance.now() - renderStart;
      setMetrics(prev => ({
        ...prev,
        renderTime
      }));
    });
  }, []);

  // Atualizar métricas de sincronização baseadas no contexto
  useEffect(() => {
    setMetrics(prev => ({
      ...prev,
      syncLatency: state.metrics.averageLatency,
      conflictCount: state.conflicts.length
    }));
  }, [state.metrics.averageLatency, state.conflicts.length]);

  // Iniciar/parar monitoramento
  const toggleMonitoring = useCallback(() => {
    if (isMonitoring) {
      setIsMonitoring(false);
      mcpStopMonitoring();
      console.log('⏹️ Parando monitoramento de performance...');
    } else {
      setIsMonitoring(true);
      mcpStartMonitoring();
      console.log('🚀 Iniciando monitoramento de performance...');
    }
  }, [isMonitoring, mcpStartMonitoring, mcpStopMonitoring]);

  // Coletar métricas periodicamente quando monitoramento está ativo
  useEffect(() => {
    if (!isMonitoring) return;

    const interval = setInterval(() => {
      collectNetworkLogs();
      collectConsoleErrors();
      collectBrowserMetrics();
    }, 5000); // Coletar a cada 5 segundos

    return () => clearInterval(interval);
  }, [isMonitoring, collectNetworkLogs, collectConsoleErrors, collectBrowserMetrics]);

  // Função para exportar métricas
  const exportMetrics = useCallback(() => {
    const data = {
      timestamp: new Date().toISOString(),
      metrics,
      networkLogs: networkLogs.slice(-50), // Últimos 50 logs
      consoleErrors: consoleErrors.slice(-20), // Últimos 20 erros
      realtimeState: {
        connectionStatus: state.connectionStatus,
        isOnline: state.isOnline,
        syncCounts: state.syncCounts,
        conflicts: state.conflicts.length,
        totalUpdates: state.metrics.totalUpdates
      }
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `performance-metrics-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [metrics, networkLogs, consoleErrors, state]);

  // Renderizar dashboard completo se solicitado
  if (showFullDashboard) {
    return (
      <div className={className}>
        <MonitoringDashboard />
      </div>
    );
  }

  return (
    <div className={`performance-monitor ${className || ''}`}>
      <div className="monitor-header">
        <h3 className="flex items-center gap-2">
          <Monitor className="h-5 w-5" />
          Monitor de Performance
        </h3>
        <div className="monitor-controls">
          {mcpIsActive && (
            <span className="badge badge-mcp">
              <Settings className="h-3 w-3 mr-1" />
              MCP Ativo
            </span>
          )}
          <button 
            onClick={toggleMonitoring}
            className={`btn ${isMonitoring ? 'btn-danger' : 'btn-success'}`}
          >
            {isMonitoring ? (
              <><Square className="h-4 w-4 mr-1" />Parar</>
            ) : (
              <><Play className="h-4 w-4 mr-1" />Iniciar</>
            )} Monitoramento
          </button>
          <button onClick={exportMetrics} className="btn btn-secondary hover:bg-gray-300">
            <Download className="h-4 w-4 mr-1" />
            Exportar Métricas
          </button>
        </div>
      </div>

      <div className="tabs-container">
        <div className="tabs-list">
          <button 
            className={`tab-trigger ${activeTab === 'summary' ? 'active' : ''}`}
            onClick={() => setActiveTab('summary')}
          >
            Resumo
          </button>
          <button 
            className={`tab-trigger ${activeTab === 'detailed' ? 'active' : ''}`}
            onClick={() => setActiveTab('detailed')}
          >
            Detalhado
          </button>
          <button 
            className={`tab-trigger ${activeTab === 'mcp' ? 'active' : ''}`}
            onClick={() => setActiveTab('mcp')}
          >
            MCP Dashboard
          </button>
        </div>

        {activeTab === 'summary' && (
          <div className="tab-content">

            <div className="metrics-grid">
              <div className="metric-card">
                <h4><Activity className="h-4 w-4 text-blue-500" />Rede</h4>
                <div className="metric-value">
                  {mcpIsActive ? Math.round(mcpAvgResponseTime) : metrics.networkLatency.toFixed(0)}ms
                </div>
                <div className="metric-label">Latência Média</div>
                <div className="metric-secondary">
                  {mcpIsActive ? mcpMetrics?.networkLogs?.length || 0 : metrics.requestCount} requisições | 
                  {mcpIsActive ? 
                    (mcpMetrics?.networkErrors?.length || 0) : 
                    metrics.errorRate.toFixed(1)
                  }% erros
                </div>
              </div>

              <div className="metric-card">
                <h4><AlertTriangle className="h-4 w-4 text-red-500" />Erros</h4>
                <div className="metric-value text-red-600">
                  {mcpIsActive ? mcpTotalErrors : consoleErrors.length}
                </div>
                <div className="metric-label">Total de Erros</div>
                <div className="metric-secondary">
                  Console + Rede
                </div>
              </div>

              <div className="metric-card">
                <h4><CheckCircle className="h-4 w-4 text-green-500" />Renderização</h4>
                <div className="metric-value">{metrics.renderTime.toFixed(1)}ms</div>
                <div className="metric-label">Tempo de Render</div>
                <div className="metric-secondary">
                  {metrics.componentUpdates} atualizações
                </div>
              </div>

              <div className="metric-card">
                <h4><Activity className="h-4 w-4 text-orange-500" />Memória</h4>
                <div className="metric-value">
                  {mcpIsActive && mcpMetrics?.performanceMetrics?.memoryInfo
                    ? Math.round(mcpMetrics.performanceMetrics.memoryInfo.usedJSHeapSize / 1024 / 1024)
                    : metrics.memoryUsage.toFixed(1)
                  }{mcpIsActive && mcpMetrics?.performanceMetrics?.memoryInfo ? 'MB' : '%'}
                </div>
                <div className="metric-label">Uso de Memória</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'detailed' && (
          <div className="tab-content">

            <div className="logs-grid">
              <div className="logs-section">
                <h4>Logs Recentes ({networkLogs.length})</h4>
                <div className="logs-list">
                  {networkLogs.length === 0 ? (
                    <p className="no-data">Nenhum log disponível</p>
                  ) : (
                    networkLogs.slice(-10).map((log, index) => (
                      <div key={`${log.url}-${log.timestamp.getTime()}-${index}`} className="log-item">
                        <div className="log-message">{log.url} - {log.method}</div>
                        <div className="log-timestamp">
                          {log.timestamp.toLocaleTimeString()} • {log.status} • {log.responseTime}ms
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="errors-section">
                <h4>Erros Recentes ({consoleErrors.length})</h4>
                <div className="errors-list">
                  {consoleErrors.length === 0 ? (
                    <div className="no-errors">
                      <CheckCircle className="h-8 w-8 text-green-500" />
                      <p>Nenhum erro detectado</p>
                    </div>
                  ) : (
                    consoleErrors.slice(-5).map((error, index) => (
                      <div key={`${error.message}-${error.timestamp.getTime()}-${index}`} className={`error-item error-${error.level}`}>
                        <div className="error-message">{error.message}</div>
                        <div className="error-timestamp">
                          {error.timestamp.toLocaleTimeString()}
                        </div>
                        {error.stack && (
                          <details className="error-stack">
                            <summary>Stack trace</summary>
                            <pre>{error.stack}</pre>
                          </details>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'mcp' && (
          <div className="tab-content">
            <MonitoringDashboard className="border-0 shadow-none" />
          </div>
        )}
      </div>

      <style jsx>{`
        .performance-monitor {
          padding: 1rem;
          background: #f8f9fa;
          border-radius: 8px;
          margin: 1rem 0;
        }
        
        .monitor-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }
        
        .monitor-controls {
          display: flex;
          gap: 0.5rem;
          align-items: center;
        }
        
        .badge-mcp {
          display: flex;
          align-items: center;
          padding: 0.25rem 0.5rem;
          background: #e3f2fd;
          color: #1976d2;
          border-radius: 4px;
          font-size: 0.75rem;
          border: 1px solid #bbdefb;
        }
        
        .btn {
          display: flex;
          align-items: center;
          padding: 0.5rem 1rem;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 0.875rem;
        }
        
        .btn-success { background: #28a745; color: white; }
        .btn-danger { background: #dc3545; color: white; }
        .btn-secondary { background: #6c757d; color: white; }
        
        .tabs-container {
          background: white;
          border-radius: 6px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .tabs-list {
          display: flex;
          border-bottom: 1px solid #e9ecef;
        }
        
        .tab-trigger {
          padding: 0.75rem 1rem;
          border: none;
          background: none;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          font-size: 0.875rem;
        }
        
        .tab-trigger.active {
          border-bottom-color: #007bff;
          color: #007bff;
          font-weight: 500;
        }
        
        .tab-content {
          padding: 1rem;
        }
        
        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-bottom: 1rem;
        }
        
        .metric-card {
          background: #f8f9fa;
          padding: 1rem;
          border-radius: 6px;
          border: 1px solid #e9ecef;
        }
        
        .metric-card h4 {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin: 0 0 0.5rem 0;
          color: #495057;
          font-size: 0.875rem;
          text-transform: uppercase;
        }
        
        .metric-value {
          font-size: 1.5rem;
          font-weight: bold;
          color: #007bff;
        }
        
        .metric-value.text-red-600 {
          color: #dc3545;
        }
        
        .metric-label {
          font-size: 0.75rem;
          color: #6c757d;
          margin-bottom: 0.25rem;
        }
        
        .metric-secondary {
          font-size: 0.75rem;
          color: #6c757d;
        }
        
        .logs-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }
        
        .logs-section, .errors-section {
          background: #f8f9fa;
          padding: 1rem;
          border-radius: 6px;
          border: 1px solid #e9ecef;
        }
        
        .logs-list, .errors-list {
          max-height: 300px;
          overflow-y: auto;
        }
        
        .log-item, .error-item {
          padding: 0.5rem;
          margin: 0.25rem 0;
          border-radius: 4px;
          border-left: 4px solid #007bff;
          background: white;
        }
        
        .error-item {
          border-left-color: #dc3545;
        }
        
        .error-error {
          background: #f8d7da;
          border-color: #dc3545;
        }
        
        .error-warn {
          background: #fff3cd;
          border-color: #ffc107;
        }
        
        .log-message, .error-message {
          font-size: 0.875rem;
          margin-bottom: 0.25rem;
          font-family: monospace;
        }
        
        .log-timestamp, .error-timestamp {
          font-size: 0.75rem;
          color: #6c757d;
        }
        
        .no-data, .no-errors {
          text-align: center;
          padding: 2rem;
          color: #6c757d;
        }
        
        .no-errors {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
        }
        
        .error-stack {
          margin-top: 0.5rem;
        }
        
        .error-stack summary {
          cursor: pointer;
          font-size: 0.75rem;
          color: #6c757d;
        }
        
        .error-stack pre {
          margin-top: 0.5rem;
          padding: 0.5rem;
          background: #f8f9fa;
          border-radius: 4px;
          font-size: 0.75rem;
          overflow-x: auto;
        }
      `}</style>
    </div>
  );
}

export default PerformanceMonitor;