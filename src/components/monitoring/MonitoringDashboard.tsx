import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Alert, AlertDescription } from '../ui/alert';
import { Progress } from '../ui/progress';
import useBrowserToolsMonitoring from '../../hooks/monitoring/useBrowserToolsMonitoring';
import { useRealtimeContext } from '../../contexts/RealtimeContext';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Download, 
  Eye, 
  Globe, 
  Monitor, 
  Play, 
  Square, 
  Trash2, 
  Wifi, 
  WifiOff,
  Camera
} from 'lucide-react';

interface MonitoringDashboardProps {
  className?: string;
}

const MonitoringDashboard: React.FC<MonitoringDashboardProps> = ({ className }) => {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedTab, setSelectedTab] = useState('overview');
  
  const {
    isActive,
    metrics,
    lastUpdate,
    errorCount,
    totalErrors,
    averageResponseTime,
    criticalAccessibilityIssues,
    startMonitoring,
    stopMonitoring,
    clearLogs,
    takeScreenshot,
    collectAllMetrics,
    runAccessibilityAudit
  } = useBrowserToolsMonitoring({
    enableConsoleLogs: true,
    enableNetworkMonitoring: true,
    enablePerformanceTracking: true,
    enableAccessibilityAudit: true,
    collectInterval: 3000,
    maxLogEntries: 50
  });
  
  const { state: realtimeState } = useRealtimeContext();

  // Auto-refresh quando ativo
  useEffect(() => {
    if (!autoRefresh || !isActive) return;
    
    const interval = setInterval(() => {
      collectAllMetrics();
    }, 5000);
    
    return () => clearInterval(interval);
  }, [autoRefresh, isActive, collectAllMetrics]);

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('pt-BR');
  };

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'text-green-600';
    if (status >= 300 && status < 400) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'critical': return 'destructive';
      case 'serious': return 'destructive';
      case 'moderate': return 'secondary';
      case 'minor': return 'outline';
      default: return 'outline';
    }
  };

  const handleScreenshot = async () => {
    const screenshot = await takeScreenshot();
    if (screenshot) {
      // Criar link para download
      const link = document.createElement('a');
      link.href = screenshot;
      link.download = `screenshot-${Date.now()}.png`;
      link.click();
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header com controles */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Monitor className="h-6 w-6" />
            Monitoramento em Tempo Real
          </h2>
          
          <div className="flex items-center space-x-2">
            {realtimeState.isOnline ? (
              <Badge variant="outline" className="text-green-600">
                <Wifi className="h-3 w-3 mr-1" />
                Online
              </Badge>
            ) : (
              <Badge variant="destructive">
                <WifiOff className="h-3 w-3 mr-1" />
                Offline
              </Badge>
            )}
            
            {isActive ? (
              <Badge variant="default" className="bg-green-600">
                <Activity className="h-3 w-3 mr-1" />
                Ativo
              </Badge>
            ) : (
              <Badge variant="secondary">
                <Square className="h-3 w-3 mr-1" />
                Parado
              </Badge>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleScreenshot}
          >
            <Camera className="h-4 w-4 mr-2" />
            Screenshot
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={clearLogs}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Limpar
          </Button>
          
          {isActive ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={stopMonitoring}
            >
              <Square className="h-4 w-4 mr-2" />
              Parar
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={startMonitoring}
            >
              <Play className="h-4 w-4 mr-2" />
              Iniciar
            </Button>
          )}
        </div>
      </div>

      {/* Cards de métricas principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Erros</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{totalErrors}</div>
            <p className="text-xs text-muted-foreground">
              Console: {metrics.consoleErrors.length} | Rede: {metrics.networkErrors.length}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tempo de Resposta</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(averageResponseTime)}ms</div>
            <p className="text-xs text-muted-foreground">
              Média das últimas {metrics.networkLogs.length} requisições
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Acessibilidade</CardTitle>
            <Eye className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{criticalAccessibilityIssues}</div>
            <p className="text-xs text-muted-foreground">
              Problemas críticos encontrados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sincronização</CardTitle>
            <Activity className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{realtimeState.totalSyncCount}</div>
            <p className="text-xs text-muted-foreground">
              Conflitos: {realtimeState.conflictCount}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alertas */}
      {totalErrors > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Foram detectados {totalErrors} erros. Verifique as abas de Console e Rede para mais detalhes.
          </AlertDescription>
        </Alert>
      )}

      {criticalAccessibilityIssues > 0 && (
        <Alert>
          <Eye className="h-4 w-4" />
          <AlertDescription>
            Encontrados {criticalAccessibilityIssues} problemas críticos de acessibilidade.
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs com detalhes */}
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="console">Console</TabsTrigger>
          <TabsTrigger value="network">Rede</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="accessibility">Acessibilidade</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Status da Aplicação</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Monitoramento</span>
                  <Badge variant={isActive ? "default" : "secondary"}>
                    {isActive ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <span>Conectividade</span>
                  <Badge variant={realtimeState.isOnline ? "default" : "destructive"}>
                    {realtimeState.isOnline ? "Online" : "Offline"}
                  </Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <span>Última Atualização</span>
                  <span className="text-sm text-muted-foreground">
                    {lastUpdate ? formatTimestamp(lastUpdate.getTime()) : "Nunca"}
                  </span>
                </div>
                
                {metrics.performanceMetrics.memoryInfo && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span>Uso de Memória</span>
                      <span className="text-sm">
                        {Math.round(metrics.performanceMetrics.memoryInfo.usedJSHeapSize / 1024 / 1024)}MB
                      </span>
                    </div>
                    <Progress 
                      value={(metrics.performanceMetrics.memoryInfo.usedJSHeapSize / metrics.performanceMetrics.memoryInfo.jsHeapSizeLimit) * 100}
                      className="h-2"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Métricas de Sincronização</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Total de Sincronizações</span>
                  <span className="font-bold">{realtimeState.totalSyncCount}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span>Conflitos Detectados</span>
                  <span className="font-bold text-yellow-600">{realtimeState.conflictCount}</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span>Latência Média</span>
                  <span className="font-bold">{realtimeState.metrics.averageLatency}ms</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span>Taxa de Erro</span>
                  <span className="font-bold text-red-600">{realtimeState.metrics.errorRate}%</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="console" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Logs do Console ({metrics.consoleLogs.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {metrics.consoleLogs.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">Nenhum log encontrado</p>
                  ) : (
                    metrics.consoleLogs.map((log, index) => (
                      <div key={`${log.message}-${log.timestamp}-${index}`} className="flex items-start space-x-2 text-sm border-b pb-2">
                        <Badge variant="outline" className="text-xs">
                          {log.level}
                        </Badge>
                        <div className="flex-1">
                          <p className="font-mono">{log.message}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatTimestamp(log.timestamp)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Erros do Console ({metrics.consoleErrors.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {metrics.consoleErrors.length === 0 ? (
                    <div className="text-center py-4">
                      <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                      <p className="text-muted-foreground">Nenhum erro encontrado</p>
                    </div>
                  ) : (
                    metrics.consoleErrors.map((error, index) => (
                      <div key={`${error.message}-${error.timestamp}-${index}`} className="space-y-1 text-sm border-b pb-2">
                        <p className="font-mono text-red-600">{error.message}</p>
                        <p className="text-xs text-muted-foreground">
                          {error.source}:{error.lineno}:{error.colno}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatTimestamp(error.timestamp)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="network" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Requisições de Rede ({metrics.networkLogs.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {metrics.networkLogs.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">Nenhuma requisição encontrada</p>
                  ) : (
                    metrics.networkLogs.map((request, index) => (
                      <div key={`${request.url}-${request.timestamp}-${index}`} className="flex items-center justify-between text-sm border-b pb-2">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline" className="text-xs">
                              {request.method}
                            </Badge>
                            <span className={`font-bold ${getStatusColor(request.status)}`}>
                              {request.status}
                            </span>
                          </div>
                          <p className="font-mono text-xs truncate">{request.url}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatTimestamp(request.timestamp)} • {request.responseTime}ms
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Erros de Rede ({metrics.networkErrors.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {metrics.networkErrors.length === 0 ? (
                    <div className="text-center py-4">
                      <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                      <p className="text-muted-foreground">Nenhum erro de rede</p>
                    </div>
                  ) : (
                    metrics.networkErrors.map((error, index) => (
                      <div key={`${error.url}-${error.timestamp}-${index}`} className="space-y-1 text-sm border-b pb-2">
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline" className="text-xs">
                            {error.method}
                          </Badge>
                          <span className="text-red-600 font-bold">ERRO</span>
                        </div>
                        <p className="font-mono text-xs">{error.url}</p>
                        <p className="text-red-600">{error.error}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatTimestamp(error.timestamp)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Métricas de Performance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {metrics.performanceMetrics.navigationTiming.loadEventEnd && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">
                      {Math.round(metrics.performanceMetrics.navigationTiming.loadEventEnd - metrics.performanceMetrics.navigationTiming.navigationStart)}ms
                    </p>
                    <p className="text-xs text-muted-foreground">Tempo Total de Carregamento</p>
                  </div>
                  
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">
                      {Math.round(metrics.performanceMetrics.navigationTiming.domContentLoadedEventEnd - metrics.performanceMetrics.navigationTiming.navigationStart)}ms
                    </p>
                    <p className="text-xs text-muted-foreground">DOM Content Loaded</p>
                  </div>
                  
                  <div className="text-center">
                    <p className="text-2xl font-bold text-orange-600">
                      {Math.round(metrics.performanceMetrics.navigationTiming.responseEnd - metrics.performanceMetrics.navigationTiming.requestStart)}ms
                    </p>
                    <p className="text-xs text-muted-foreground">Tempo de Resposta</p>
                  </div>
                  
                  <div className="text-center">
                    <p className="text-2xl font-bold text-orange-600">
                      {metrics.performanceMetrics.resourceTiming.length}
                    </p>
                    <p className="text-xs text-muted-foreground">Recursos Carregados</p>
                  </div>
                </div>
              )}
              
              {metrics.performanceMetrics.paintTiming.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold">Paint Timing</h4>
                  {metrics.performanceMetrics.paintTiming.map((paint, index) => (
                    <div key={`${paint.name}-${paint.startTime}-${index}`} className="flex justify-between text-sm">
                      <span>{paint.name}</span>
                      <span className="font-mono">{Math.round(paint.startTime)}ms</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accessibility" className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Problemas de Acessibilidade</h3>
            <Button variant="outline" size="sm" onClick={runAccessibilityAudit}>
              <Eye className="h-4 w-4 mr-2" />
              Executar Auditoria
            </Button>
          </div>
          
          <div className="space-y-4">
            {metrics.accessibilityIssues.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nenhum problema encontrado</h3>
                  <p className="text-muted-foreground">Sua aplicação está seguindo as boas práticas de acessibilidade!</p>
                </CardContent>
              </Card>
            ) : (
              metrics.accessibilityIssues.map((issue, index) => (
                <Card key={`${issue.id || issue.description}-${index}`}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{issue.description}</CardTitle>
                      <Badge variant={getImpactColor(issue.impact)}>
                        {issue.impact}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm text-muted-foreground">{issue.help}</p>
                    
                    {issue.nodes.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-sm font-semibold">Elementos afetados:</p>
                        {issue.nodes.slice(0, 3).map((node, nodeIndex) => (
                          <div key={`${node.target || node.html}-${nodeIndex}`} className="bg-muted p-2 rounded text-xs font-mono">
                            {node.html}
                          </div>
                        ))}
                        {issue.nodes.length > 3 && (
                          <p className="text-xs text-muted-foreground">
                            +{issue.nodes.length - 3} elementos adicionais
                          </p>
                        )}
                      </div>
                    )}
                    
                    <div className="pt-2">
                      <a 
                        href={issue.helpUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline text-sm"
                      >
                        Saiba mais sobre como corrigir →
                      </a>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MonitoringDashboard;