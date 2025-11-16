import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  AlertTriangle, 
  AlertCircle, 
  Info, 
  CheckCircle, 
  X, 
  RefreshCw,
  Bell,
  BellOff,
  Trash2,
  Clock
} from 'lucide-react';
import { useWebhookAlerts, WebhookAlert } from '@/hooks/useWebhookAlerts';

interface WebhookAlertsPanelProps {
  className?: string;
}

export const WebhookAlertsPanel: React.FC<WebhookAlertsPanelProps> = ({ 
  className = '' 
}) => {
  const {
    alerts,
    allAlerts,
    metrics,
    loading,
    error,
    thresholds,
    acknowledgeAlert,
    acknowledgeAllAlerts,
    clearAcknowledgedAlerts,
    refresh,
    hasUnacknowledgedAlerts,
    getCriticalAlertsCount
  } = useWebhookAlerts();

  const getAlertIcon = (type: WebhookAlert['type'], severity: WebhookAlert['severity']) => {
    if (severity === 'critical') {
      return <AlertTriangle className="h-4 w-4 text-red-600" />;
    }
    
    switch (type) {
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />;
      default:
        return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  const getSeverityColor = (severity: WebhookAlert['severity']) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getTypeColor = (type: WebhookAlert['type']) => {
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

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (minutes < 1) return 'Agora mesmo';
    if (minutes < 60) return `${minutes}min atrás`;
    if (hours < 24) return `${hours}h atrás`;
    return timestamp.toLocaleDateString('pt-BR');
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center p-6">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" />
          <span>Carregando alertas...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={`border-red-200 bg-red-50 ${className}`}>
        <CardHeader>
          <CardTitle className="text-red-700 flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2" />
            Erro no Sistema de Alertas
          </CardTitle>
          <CardDescription className="text-red-600">{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={refresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header com resumo */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center">
                <Bell className="h-5 w-5 mr-2" />
                Sistema de Alertas
                {hasUnacknowledgedAlerts() && (
                  <Badge variant="destructive" className="ml-2">
                    {alerts.length}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                Monitoramento automático de falhas e anomalias
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              {alerts.length > 0 && (
                <>
                  <Button 
                    onClick={acknowledgeAllAlerts} 
                    variant="outline" 
                    size="sm"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Reconhecer Todos
                  </Button>
                  <Button 
                    onClick={clearAcknowledgedAlerts} 
                    variant="outline" 
                    size="sm"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Limpar
                  </Button>
                </>
              )}
              <Button onClick={refresh} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Atualizar
              </Button>
            </div>
          </div>
        </CardHeader>
        
        {/* Métricas de alerta */}
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">
                {getCriticalAlertsCount()}
              </p>
              <p className="text-xs text-muted-foreground">Alertas Críticos</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">
                {metrics.currentErrorRate.toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground">Taxa de Erro</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">
                {metrics.averageResponseTime.toFixed(0)}ms
              </p>
              <p className="text-xs text-muted-foreground">Tempo Resposta</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">
                {metrics.consecutiveFailures}
              </p>
              <p className="text-xs text-muted-foreground">Falhas Seguidas</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status geral */}
      <Card>
        <CardContent className="p-4">
          {alerts.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-2" />
                <h3 className="text-lg font-medium text-green-800">
                  Sistema Funcionando Normalmente
                </h3>
                <p className="text-sm text-green-600">
                  Nenhum alerta ativo no momento
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-4">
              <div className="text-center">
                <AlertTriangle className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
                <h3 className="text-lg font-medium text-yellow-800">
                  {alerts.length} Alerta{alerts.length > 1 ? 's' : ''} Ativo{alerts.length > 1 ? 's' : ''}
                </h3>
                <p className="text-sm text-yellow-600">
                  Requer atenção imediata
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lista de alertas ativos */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Alertas Ativos</CardTitle>
            <CardDescription>
              Alertas que requerem ação imediata
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alerts.map((alert) => (
                <Alert 
                  key={alert.id} 
                  className={`${getTypeColor(alert.type)} border-l-4`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      {getAlertIcon(alert.type, alert.severity)}
                      <div className="flex-1">
                        <AlertTitle className="flex items-center space-x-2">
                          <span>{alert.title}</span>
                          <Badge 
                            variant="outline" 
                            className={getSeverityColor(alert.severity)}
                          >
                            {alert.severity.toUpperCase()}
                          </Badge>
                        </AlertTitle>
                        <AlertDescription className="mt-1">
                          {alert.message}
                        </AlertDescription>
                        <div className="flex items-center space-x-4 mt-2 text-xs text-muted-foreground">
                          <div className="flex items-center space-x-1">
                            <Clock className="h-3 w-3" />
                            <span>{formatTimestamp(alert.timestamp)}</span>
                          </div>
                          {alert.metadata && (
                            <div className="text-xs">
                              ID: {alert.id.slice(-8)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      onClick={() => acknowledgeAlert(alert.id)}
                      variant="ghost"
                      size="sm"
                      className="ml-2"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Configurações de threshold */}
      <Card>
        <CardHeader>
          <CardTitle>Configurações de Alerta</CardTitle>
          <CardDescription>
            Limites configurados para disparo de alertas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Taxa de Erro</span>
                <Badge variant="outline">{thresholds.errorRateThreshold}%</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Tempo de Resposta</span>
                <Badge variant="outline">{thresholds.responseTimeThreshold}ms</Badge>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Queda de Volume</span>
                <Badge variant="outline">{thresholds.volumeDropThreshold}%</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Falhas Consecutivas</span>
                <Badge variant="outline">{thresholds.consecutiveFailuresThreshold}</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Histórico de alertas (últimos reconhecidos) */}
      {allAlerts.filter(a => a.acknowledged).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BellOff className="h-5 w-5 mr-2" />
              Histórico Recente
            </CardTitle>
            <CardDescription>
              Últimos alertas reconhecidos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {allAlerts
                .filter(alert => alert.acknowledged)
                .slice(0, 5)
                .map((alert) => (
                  <div 
                    key={alert.id} 
                    className="flex items-center justify-between p-2 rounded-lg border bg-gray-50"
                  >
                    <div className="flex items-center space-x-3">
                      {getAlertIcon(alert.type, alert.severity)}
                      <div>
                        <p className="text-sm font-medium text-gray-700">
                          {alert.title}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatTimestamp(alert.timestamp)}
                        </p>
                      </div>
                    </div>
                    <Badge 
                      variant="outline" 
                      className="bg-green-100 text-green-800"
                    >
                      Resolvido
                    </Badge>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};