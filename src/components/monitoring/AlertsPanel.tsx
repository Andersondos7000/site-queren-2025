import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { ScrollArea } from '../ui/scroll-area';
import { 
  AlertTriangle, 
  CheckCircle, 
  Info, 
  X, 
  Bell, 
  BellOff,
  Filter,
  Download,
  Trash2,
  Clock,
  Database,
  Globe,
  Activity
} from 'lucide-react';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem
} from '../ui/dropdown-menu';
import { MonitoringAlert } from '../../hooks/monitoring/useIntegratedMonitoring';

interface AlertsPanelProps {
  alerts: MonitoringAlert[];
  onResolveAlert: (alertId: string) => void;
  onClearAlerts: () => void;
  className?: string;
  maxHeight?: string;
  showNotifications?: boolean;
  onExportAlerts?: () => void;
}

type AlertFilter = 'all' | 'unresolved' | 'error' | 'warning' | 'info' | 'realtime' | 'browser' | 'system';

const AlertsPanel: React.FC<AlertsPanelProps> = ({
  alerts,
  onResolveAlert,
  onClearAlerts,
  className,
  maxHeight = '400px',
  showNotifications = true,
  onExportAlerts
}) => {
  const [filter, setFilter] = useState<AlertFilter>('all');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [lastAlertCount, setLastAlertCount] = useState(0);

  // Filtrar alertas
  const filteredAlerts = alerts.filter(alert => {
    switch (filter) {
      case 'unresolved':
        return !alert.resolved;
      case 'error':
        return alert.type === 'error';
      case 'warning':
        return alert.type === 'warning';
      case 'info':
        return alert.type === 'info';
      case 'realtime':
        return alert.source === 'realtime';
      case 'browser':
        return alert.source === 'browser';
      case 'system':
        return alert.source === 'system';
      default:
        return true;
    }
  });

  // Estatísticas dos alertas
  const stats = {
    total: alerts.length,
    unresolved: alerts.filter(a => !a.resolved).length,
    errors: alerts.filter(a => a.type === 'error').length,
    warnings: alerts.filter(a => a.type === 'warning').length,
    info: alerts.filter(a => a.type === 'info').length,
    bySource: {
      realtime: alerts.filter(a => a.source === 'realtime').length,
      browser: alerts.filter(a => a.source === 'browser').length,
      system: alerts.filter(a => a.source === 'system').length
    }
  };

  // Notificação sonora para novos alertas
  useEffect(() => {
    if (showNotifications && soundEnabled && alerts.length > lastAlertCount) {
      const newAlerts = alerts.slice(lastAlertCount);
      const hasErrorOrWarning = newAlerts.some(a => a.type === 'error' || a.type === 'warning');
      
      if (hasErrorOrWarning) {
        // Reproduzir som de notificação (se suportado pelo navegador)
        try {
          const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTuR2O/Eeyw');
          audio.volume = 0.3;
          audio.play().catch(() => {});
        } catch (error) {
          // Ignorar erros de áudio
        }
      }
    }
    setLastAlertCount(alerts.length);
  }, [alerts.length, lastAlertCount, showNotifications, soundEnabled]);

  // Ícones por tipo de alerta
  const getAlertIcon = (type: MonitoringAlert['type']) => {
    switch (type) {
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  // Ícones por fonte
  const getSourceIcon = (source: MonitoringAlert['source']) => {
    switch (source) {
      case 'realtime':
        return <Database className="h-3 w-3" />;
      case 'browser':
        return <Globe className="h-3 w-3" />;
      case 'system':
        return <Activity className="h-3 w-3" />;
      default:
        return <Info className="h-3 w-3" />;
    }
  };

  // Cores por tipo
  const getAlertColor = (type: MonitoringAlert['type']) => {
    switch (type) {
      case 'error':
        return 'border-red-200 bg-red-50';
      case 'warning':
        return 'border-yellow-200 bg-yellow-50';
      case 'info':
        return 'border-blue-200 bg-blue-50';
      default:
        return 'border-gray-200 bg-gray-50';
    }
  };

  // Formatar tempo relativo
  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffSecs < 60) return `${diffSecs}s atrás`;
    if (diffMins < 60) return `${diffMins}m atrás`;
    if (diffHours < 24) return `${diffHours}h atrás`;
    return date.toLocaleDateString();
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Alertas do Sistema
            {stats.unresolved > 0 && (
              <Badge variant="destructive" className="ml-2">
                {stats.unresolved}
              </Badge>
            )}
          </CardTitle>
          
          <div className="flex items-center gap-2">
            {/* Filtros */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Filter className="h-4 w-4 mr-1" />
                  Filtrar
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Filtrar por Status</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={filter === 'all'}
                  onCheckedChange={() => setFilter('all')}
                >
                  Todos ({stats.total})
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={filter === 'unresolved'}
                  onCheckedChange={() => setFilter('unresolved')}
                >
                  Não Resolvidos ({stats.unresolved})
                </DropdownMenuCheckboxItem>
                
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Filtrar por Tipo</DropdownMenuLabel>
                <DropdownMenuCheckboxItem
                  checked={filter === 'error'}
                  onCheckedChange={() => setFilter('error')}
                >
                  Erros ({stats.errors})
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={filter === 'warning'}
                  onCheckedChange={() => setFilter('warning')}
                >
                  Avisos ({stats.warnings})
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={filter === 'info'}
                  onCheckedChange={() => setFilter('info')}
                >
                  Informações ({stats.info})
                </DropdownMenuCheckboxItem>
                
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Filtrar por Fonte</DropdownMenuLabel>
                <DropdownMenuCheckboxItem
                  checked={filter === 'realtime'}
                  onCheckedChange={() => setFilter('realtime')}
                >
                  Realtime ({stats.bySource.realtime})
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={filter === 'browser'}
                  onCheckedChange={() => setFilter('browser')}
                >
                  Browser ({stats.bySource.browser})
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={filter === 'system'}
                  onCheckedChange={() => setFilter('system')}
                >
                  Sistema ({stats.bySource.system})
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            {/* Configurações */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  {soundEnabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuCheckboxItem
                  checked={soundEnabled}
                  onCheckedChange={setSoundEnabled}
                >
                  Notificações Sonoras
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                {onExportAlerts && (
                  <DropdownMenuItem onClick={onExportAlerts}>
                    <Download className="h-4 w-4 mr-2" />
                    Exportar Alertas
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={onClearAlerts}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Limpar Todos
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        
        {/* Estatísticas Rápidas */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
            {stats.errors} erros
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
            {stats.warnings} avisos
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            {stats.info} informações
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <ScrollArea style={{ height: maxHeight }}>
          {filteredAlerts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
              <p className="text-lg font-medium">Nenhum alerta encontrado</p>
              <p className="text-sm">
                {filter === 'all' 
                  ? 'Sistema funcionando normalmente'
                  : `Nenhum alerta do tipo "${filter}" encontrado`
                }
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-3 rounded-lg border transition-all ${
                    alert.resolved 
                      ? 'opacity-60 border-gray-200 bg-gray-50' 
                      : getAlertColor(alert.type)
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="flex-shrink-0 mt-0.5">
                        {alert.resolved ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          getAlertIcon(alert.type)
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge 
                            variant="outline" 
                            className="flex items-center gap-1 text-xs"
                          >
                            {getSourceIcon(alert.source)}
                            {alert.source}
                          </Badge>
                          
                          <Badge 
                            variant={alert.type === 'error' ? 'destructive' : 
                                   alert.type === 'warning' ? 'secondary' : 'default'}
                            className="text-xs"
                          >
                            {alert.type}
                          </Badge>
                          
                          {alert.resolved && (
                            <Badge variant="outline" className="text-xs text-green-600">
                              Resolvido
                            </Badge>
                          )}
                        </div>
                        
                        <p className="text-sm font-medium text-gray-900 mb-1">
                          {alert.message}
                        </p>
                        
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatRelativeTime(alert.timestamp)}
                          
                          {alert.metadata && Object.keys(alert.metadata).length > 0 && (
                            <span className="ml-2">
                              • {Object.entries(alert.metadata).map(([key, value]) => 
                                `${key}: ${value}`
                              ).join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {!alert.resolved && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onResolveAlert(alert.id)}
                        className="flex-shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default AlertsPanel;