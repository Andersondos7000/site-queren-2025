import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Alert, AlertDescription } from '../ui/alert';
import { 
  Monitor, 
  Activity, 
  Settings, 
  AlertTriangle, 
  CheckCircle, 
  Wifi, 
  WifiOff,
  Database,
  Globe,
  Zap,
  BarChart3,
  Bell
} from 'lucide-react';

// Importar componentes de monitoramento
import { PerformanceMonitor } from './PerformanceMonitor';
import MonitoringDashboard from './MonitoringDashboard';
import AlertsPanel from './AlertsPanel';
import useIntegratedMonitoring from '../../hooks/monitoring/useIntegratedMonitoring';
import { useRealtimeContext } from '../../contexts/RealtimeContext';

interface MonitoringIntegrationProps {
  className?: string;
  defaultView?: 'overview' | 'performance' | 'realtime' | 'browser' | 'alerts' | 'full';
  enableNotifications?: boolean;
  onAlert?: (alert: any) => void;
}

const MonitoringIntegration: React.FC<MonitoringIntegrationProps> = ({
  className,
  defaultView = 'overview',
  enableNotifications = true,
  onAlert
}) => {
  const [activeView, setActiveView] = useState(defaultView);
  const [autoStart, setAutoStart] = useState(true);

  // Hook integrado de monitoramento
  const {
    metrics,
    alerts,
    isMonitoring,
    config,
    startMonitoring,
    stopMonitoring,
    updateConfig,
    resolveAlert,
    clearAlerts,
    getUnresolvedAlerts,
    exportMetrics,
    getHealthScore,
    takeSnapshot
  } = useIntegratedMonitoring({
    config: {
      enableRealtime: true,
      enableBrowserTools: true,
      collectInterval: 5000,
      alertThresholds: {
        errorRate: 0.05,
        responseTime: 1000,
        memoryUsage: 100,
        conflictCount: 3
      }
    },
    onAlert: (alert) => {
      if (enableNotifications) {
        onAlert?.(alert);
      }
    }
  });

  // Hook do contexto realtime para dados adicionais
  const { state: realtimeState } = useRealtimeContext();

  // Auto-iniciar monitoramento
  useEffect(() => {
    if (autoStart && !isMonitoring) {
      startMonitoring();
    }
  }, [autoStart, isMonitoring, startMonitoring]);

  // Calcular alertas não resolvidos
  const unresolvedAlerts = getUnresolvedAlerts();
  const healthScore = getHealthScore();
  
  // Determinar status geral baseado no health score
  const getOverallStatus = () => {
    if (healthScore >= 80) return { status: 'healthy' as const, label: 'Saudável' };
    if (healthScore >= 60) return { status: 'warning' as const, label: 'Atenção' };
    return { status: 'critical' as const, label: 'Crítico' };
  };

  const overallStatus = getOverallStatus();

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Status Geral */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Status Geral do Sistema
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Badge 
                variant={overallStatus.status === 'healthy' ? 'default' : 
                        overallStatus.status === 'warning' ? 'secondary' : 'destructive'}
                className="flex items-center gap-1"
              >
                {overallStatus.status === 'healthy' ? (
                  <><CheckCircle className="h-3 w-3" />{overallStatus.label}</>
                ) : (
                  <><AlertTriangle className="h-3 w-3" />{overallStatus.label}</>
                )}
              </Badge>
              
              <Badge variant="outline" className="flex items-center gap-1">
                {metrics.realtime.connected ? (
                  <><Wifi className="h-3 w-3" />Online</>
                ) : (
                  <><WifiOff className="h-3 w-3" />Offline</>
                )}
              </Badge>
              
              <Badge variant="outline">
                Score: {healthScore}/100
              </Badge>
            </div>
            
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Bell className="h-3 w-3" />
                {unresolvedAlerts.length} alertas
              </div>
              <div>
                Última sincronização: {metrics.realtime.lastSyncTime 
                  ? metrics.realtime.lastSyncTime.toLocaleTimeString()
                  : 'Nunca'
                }
              </div>
            </div>
          </div>
          
          {unresolvedAlerts.length > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {unresolvedAlerts.length} alertas não resolvidos. 
                <Button 
                  variant="link" 
                  className="p-0 h-auto ml-1"
                  onClick={() => setActiveView('alerts')}
                >
                  Ver detalhes
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Cards de Status dos Subsistemas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" 
              onClick={() => setActiveView('realtime')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Realtime</CardTitle>
            <Database className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.realtime.totalSyncs}
            </div>
            <p className="text-xs text-muted-foreground">
              Sincronizações • {metrics.realtime.conflictsCount} conflitos
            </p>
            <Badge 
              variant={metrics.realtime.connected ? 'default' : 'destructive'}
              className="mt-2"
            >
              {metrics.realtime.connected ? 'Conectado' : 'Desconectado'}
            </Badge>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" 
              onClick={() => setActiveView('browser')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Browser Tools</CardTitle>
            <Globe className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.browser.avgResponseTime}ms
            </div>
            <p className="text-xs text-muted-foreground">
              Latência média • {metrics.browser.consoleErrors + metrics.browser.networkErrors} erros
            </p>
            <Badge 
              variant={metrics.browser.active ? 'default' : 'secondary'}
              className="mt-2"
            >
              {metrics.browser.active ? 'Ativo' : 'Inativo'}
            </Badge>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" 
              onClick={() => setActiveView('performance')}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Performance</CardTitle>
            <Zap className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics.browser.memoryUsage}MB
            </div>
            <p className="text-xs text-muted-foreground">
              Uso de memória • Score: {metrics.browser.performanceScore}/100
            </p>
            <Badge 
              variant={isMonitoring ? 'default' : 'secondary'}
              className="mt-2"
            >
              {isMonitoring ? 'Monitorando' : 'Parado'}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Métricas Rápidas */}
      <Card>
        <CardHeader>
          <CardTitle>Métricas em Tempo Real</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {metrics.realtime.totalSyncs}
              </div>
              <div className="text-sm text-muted-foreground">Sincronizações</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">
                {metrics.browser.consoleErrors + metrics.browser.networkErrors}
              </div>
              <div className="text-sm text-muted-foreground">Erros</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {metrics.browser.avgResponseTime}ms
              </div>
              <div className="text-sm text-muted-foreground">Latência</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600">
                {metrics.browser.memoryUsage}MB
              </div>
              <div className="text-sm text-muted-foreground">Memória</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600">
                {healthScore}
              </div>
              <div className="text-sm text-muted-foreground">Score Saúde</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className={`monitoring-integration ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Monitor className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Centro de Monitoramento</h1>
          
          <div className="flex items-center gap-2">
            <Badge 
              variant={overallStatus.status === 'healthy' ? 'default' : 
                      overallStatus.status === 'warning' ? 'secondary' : 'destructive'}
            >
              {overallStatus.label} ({healthScore}/100)
            </Badge>
            
            {unresolvedAlerts.length > 0 && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <Bell className="h-3 w-3" />
                {unresolvedAlerts.length} alertas
              </Badge>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button 
            variant={isMonitoring ? 'default' : 'outline'} 
            size="sm"
            onClick={isMonitoring ? stopMonitoring : startMonitoring}
          >
            {isMonitoring ? 'Parar' : 'Iniciar'} Monitoramento
          </Button>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => takeSnapshot()}
          >
            Snapshot
          </Button>
          
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              const data = exportMetrics();
              const blob = new Blob([data], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `monitoring-metrics-${new Date().toISOString().split('T')[0]}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            Exportar
          </Button>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <Tabs value={activeView} onValueChange={setActiveView}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="realtime">Realtime</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="browser">Browser Tools</TabsTrigger>
          <TabsTrigger value="alerts" className="relative">
            Alertas
            {unresolvedAlerts.length > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 h-4 w-4 p-0 text-xs"
              >
                {unresolvedAlerts.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="full">Completo</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          {renderOverview()}
        </TabsContent>

        <TabsContent value="realtime" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Monitoramento Realtime
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {metrics.realtime.syncsByType.cart}
                    </div>
                    <div className="text-sm text-muted-foreground">Carrinho</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {metrics.realtime.syncsByType.stock}
                    </div>
                    <div className="text-sm text-muted-foreground">Estoque</div>
                  </div>
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">
                      {metrics.realtime.syncsByType.orders}
                    </div>
                    <div className="text-sm text-muted-foreground">Pedidos</div>
                  </div>
                </div>
                
                <div className="mt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Latência média de sync:</span>
                    <span className="font-mono">{metrics.realtime.avgSyncLatency}ms</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Total de sincronizações:</span>
                    <span className="font-mono">{metrics.realtime.totalSyncs}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Conflitos ativos:</span>
                    <span className="font-mono text-red-600">{metrics.realtime.conflictsCount}</span>
                  </div>
                </div>
                
                {metrics.realtime.conflictsCount > 0 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      {metrics.realtime.conflictsCount} conflitos de sincronização detectados.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="mt-6">
          <PerformanceMonitor showFullDashboard={false} />
        </TabsContent>

        <TabsContent value="browser" className="mt-6">
          <MonitoringDashboard />
        </TabsContent>

        <TabsContent value="alerts" className="mt-6">
          <AlertsPanel 
            alerts={alerts}
            onResolveAlert={resolveAlert}
            onClearAlerts={clearAlerts}
            onExportAlerts={() => {
              const alertsData = JSON.stringify(alerts, null, 2);
              const blob = new Blob([alertsData], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `monitoring-alerts-${new Date().toISOString().split('T')[0]}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          />
        </TabsContent>

        <TabsContent value="full" className="mt-6">
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <AlertsPanel 
                alerts={alerts}
                onResolveAlert={resolveAlert}
                onClearAlerts={clearAlerts}
                maxHeight="300px"
              />
              <Card>
                <CardHeader>
                  <CardTitle>Controles do Sistema</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>Status do Monitoramento:</span>
                    <Badge variant={isMonitoring ? 'default' : 'secondary'}>
                      {isMonitoring ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span>Score de Saúde:</span>
                    <Badge 
                      variant={healthScore >= 80 ? 'default' : healthScore >= 60 ? 'secondary' : 'destructive'}
                    >
                      {healthScore}/100
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span>Uptime do Sistema:</span>
                    <span className="font-mono text-sm">{Math.floor(metrics.system.uptime / 60)}m {metrics.system.uptime % 60}s</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span>Taxa de Erro:</span>
                    <span className="font-mono text-sm">{(metrics.system.errorRate * 100).toFixed(2)}%</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span>Throughput:</span>
                    <span className="font-mono text-sm">{metrics.system.throughput.toFixed(1)} sync/min</span>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            <PerformanceMonitor showFullDashboard={true} />
            <MonitoringDashboard />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MonitoringIntegration;