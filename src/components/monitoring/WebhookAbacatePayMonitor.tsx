import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Webhook, 
  CheckCircle, 
  XCircle, 
  Clock, 
  DollarSign, 
  Users, 
  ShoppingCart,
  Activity,
  ExternalLink,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  Bell
} from 'lucide-react';
import { useWebhookMetrics } from '@/hooks/useWebhookMetrics';
import { WebhookAlertsPanel } from './WebhookAlertsPanel';

const WebhookAbacatePayMonitor: React.FC = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const {
    metrics,
    loading,
    error,
    refresh
  } = useWebhookMetrics();

  // Debug logs para rastrear o ciclo de carregamento
  console.log('[WebhookAbacatePayMonitor] Render - loading:', loading, 'error:', error, 'metrics:', !!metrics);

  // Extrair dados do objeto metrics
  const recentActivity = metrics.recentActivity || [];
  const dailyStats = metrics.dailyStats || [];

  if (loading) {
    console.log('[WebhookAbacatePayMonitor] Exibindo estado de carregamento');
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin mr-2" />
        <span>Carregando métricas dos webhooks...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="text-red-700 flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2" />
            Erro ao Carregar Métricas
          </CardTitle>
          <CardDescription className="text-red-600">{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={refresh} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center">
            <Webhook className="h-6 w-6 mr-2" />
            Monitor AbacatePay Webhooks
          </h2>
          <p className="text-muted-foreground">
            Monitoramento em tempo real dos webhooks de pagamento
          </p>
        </div>
        <Button onClick={refresh} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview" className="flex items-center">
            <Activity className="h-4 w-4 mr-2" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="alerts" className="flex items-center">
            <Bell className="h-4 w-4 mr-2" />
            Alertas
          </TabsTrigger>
          <TabsTrigger value="details" className="flex items-center">
            <TrendingUp className="h-4 w-4 mr-2" />
            Detalhes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Métricas principais */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Webhooks</CardTitle>
                <Webhook className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.totalWebhooks}</div>
                <p className="text-xs text-muted-foreground">
                  Últimos 30 dias
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Taxa de Sucesso</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {metrics.successRate.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  {metrics.successfulWebhooks} sucessos
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Taxa de Falha</CardTitle>
                <XCircle className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {metrics.failureRate.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  {metrics.failedWebhooks} falhas
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tempo Médio</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {metrics.averageProcessingTime.toFixed(0)}ms
                </div>
                <p className="text-xs text-muted-foreground">
                  Processamento
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Métricas financeiras detalhadas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Receita Bruta</CardTitle>
                <DollarSign className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  R$ {metrics.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-muted-foreground">
                  Valor total processado
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Taxas Totais</CardTitle>
                <DollarSign className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  R$ {metrics.totalFees.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-muted-foreground">
                  {metrics.averageFeePercentage.toFixed(3)}% do bruto
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Receita Líquida</CardTitle>
                <DollarSign className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  R$ {metrics.netRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                <p className="text-xs text-muted-foreground">
                  Após descontar taxas
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Transações PIX</CardTitle>
                <Activity className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">{metrics.pixTransactions}</div>
                <p className="text-xs text-muted-foreground">
                  Pagamentos via PIX
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Métricas por ambiente */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ambiente Dev</CardTitle>
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">DEV</Badge>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{metrics.devModeTransactions}</div>
                <p className="text-xs text-muted-foreground">
                  Transações de teste
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ambiente Prod</CardTitle>
                <Badge variant="default" className="bg-green-100 text-green-800">PROD</Badge>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{metrics.prodModeTransactions}</div>
                <p className="text-xs text-muted-foreground">
                  Transações reais
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Clientes Únicos</CardTitle>
                <Users className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.totalCustomers}</div>
                <p className="text-xs text-muted-foreground">
                  Clientes únicos
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Atividade Recente Detalhada */}
          <Card>
            <CardHeader>
              <CardTitle>Atividade Recente</CardTitle>
              <CardDescription>
                Últimos webhooks processados com detalhes completos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {metrics.recentActivity.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    Nenhuma atividade recente encontrada
                  </p>
                ) : (
                  metrics.recentActivity.slice(0, 5).map((activity, index) => (
                    <div key={index} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Badge 
                            variant={activity.status === 'success' ? 'default' : 'destructive'}
                            className={activity.status === 'success' ? 'bg-green-100 text-green-800' : ''}
                          >
                            {activity.status === 'success' ? 'PAGO' : 'ERRO'}
                          </Badge>
                          <Badge 
                            variant="secondary" 
                            className={activity.environment === 'dev' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}
                          >
                            {activity.environment === 'dev' ? 'DEV' : 'PROD'}
                          </Badge>
                          <Badge variant="outline" className="bg-purple-50 text-purple-700">
                            {activity.paymentMethod}
                          </Badge>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {new Date(activity.timestamp).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="font-medium text-muted-foreground">Cliente</p>
                          <p className="font-semibold">{activity.customerName || 'N/A'}</p>
                          <p className="text-muted-foreground">{activity.customerEmail}</p>
                        </div>
                        
                        <div>
                          <p className="font-medium text-muted-foreground">Valor Bruto</p>
                          <p className="font-semibold text-green-600">
                            R$ {activity.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        
                        <div>
                          <p className="font-medium text-muted-foreground">Taxa</p>
                          <p className="font-semibold text-orange-600">
                            R$ {activity.fee.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        
                        <div>
                          <p className="font-medium text-muted-foreground">Valor Líquido</p>
                          <p className="font-semibold text-blue-600">
                            R$ {activity.netAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>
                      
                      {activity.orderId && (
                        <div className="pt-2 border-t">
                          <p className="text-xs text-muted-foreground">
                            ID do Pedido: <span className="font-mono">{activity.orderId}</span>
                          </p>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts">
          <WebhookAlertsPanel />
        </TabsContent>

        <TabsContent value="details" className="space-y-6">
          {/* Detalhes dos Clientes (LGPD Compliant) */}
          <Card>
            <CardHeader>
              <CardTitle>Detalhes dos Clientes Recentes</CardTitle>
              <CardDescription>
                Informações dos últimos clientes (dados sensíveis mascarados conforme LGPD)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {metrics.recentActivity.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  Nenhum cliente recente encontrado
                </p>
              ) : (
                <div className="space-y-4">
                  {metrics.recentActivity.slice(0, 10).map((activity, index) => (
                    <div key={index} className="border rounded-lg p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                          <p className="font-medium text-muted-foreground mb-1">Nome do Cliente</p>
                          <p className="font-semibold">{activity.customerName || 'Nome não informado'}</p>
                        </div>
                        
                        <div>
                          <p className="font-medium text-muted-foreground mb-1">Email</p>
                          <p className="font-mono text-sm">{activity.customerEmail}</p>
                        </div>
                        
                        <div>
                          <p className="font-medium text-muted-foreground mb-1">Documento (Mascarado)</p>
                          <p className="font-mono text-sm">
                            {activity.customerTaxId ? 
                              `***.***.***-${activity.customerTaxId.slice(-2)}` : 
                              'Não informado'
                            }
                          </p>
                        </div>
                      </div>
                      
                      <Separator className="my-3" />
                      
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="font-medium text-muted-foreground">Transação</p>
                          <div className="flex items-center space-x-2 mt-1">
                            <Badge 
                              variant={activity.status === 'success' ? 'default' : 'destructive'}
                              className={activity.status === 'success' ? 'bg-green-100 text-green-800' : ''}
                            >
                              {activity.status === 'success' ? 'PAGO' : 'ERRO'}
                            </Badge>
                            <Badge variant="outline" className="bg-purple-50 text-purple-700">
                              {activity.paymentMethod}
                            </Badge>
                          </div>
                        </div>
                        
                        <div>
                          <p className="font-medium text-muted-foreground">Ambiente</p>
                          <Badge 
                            variant="secondary" 
                            className={activity.environment === 'dev' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}
                          >
                            {activity.environment === 'dev' ? 'DESENVOLVIMENTO' : 'PRODUÇÃO'}
                          </Badge>
                        </div>
                        
                        <div>
                          <p className="font-medium text-muted-foreground">Valor Processado</p>
                          <p className="font-semibold text-green-600">
                            R$ {activity.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        
                        <div>
                          <p className="font-medium text-muted-foreground">Data/Hora</p>
                          <p className="text-sm">
                            {new Date(activity.timestamp).toLocaleString('pt-BR')}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Estatísticas diárias */}
          <Card>
            <CardHeader>
              <CardTitle>Estatísticas Diárias</CardTitle>
              <CardDescription>
                Últimos 7 dias de atividade
              </CardDescription>
            </CardHeader>
            <CardContent>
              {dailyStats.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">
                  Dados insuficientes para estatísticas diárias
                </p>
              ) : (
                <div className="space-y-4">
                  {dailyStats.map((stat, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">
                          {new Date(stat.date).toLocaleDateString('pt-BR', { 
                            weekday: 'long', 
                            day: 'numeric', 
                            month: 'short' 
                          })}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {stat.webhooks} webhooks • {stat.orders} pedidos
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-green-600">
                          R$ {stat.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        <Badge variant={stat.successRate >= 95 ? 'default' : 'destructive'}>
                          {stat.successRate.toFixed(1)}% sucesso
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Links úteis */}
          <Card>
            <CardHeader>
              <CardTitle>Links Úteis</CardTitle>
              <CardDescription>
                Acesso rápido ao Supabase Dashboard
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button variant="outline" className="justify-start" asChild>
                  <a 
                    href="https://supabase.com/dashboard/project/ojxmfxbflbfinodkhixk/editor/28557" 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Tabela Orders
                  </a>
                </Button>
                
                <Button variant="outline" className="justify-start" asChild>
                  <a 
                    href="https://supabase.com/dashboard/project/ojxmfxbflbfinodkhixk/editor/28558" 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Tabela Customers
                  </a>
                </Button>
                
                <Button variant="outline" className="justify-start" asChild>
                  <a 
                    href="https://supabase.com/dashboard/project/ojxmfxbflbfinodkhixk/functions/webhook-abacatepay/details" 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Edge Function
                  </a>
                </Button>
                
                <Button variant="outline" className="justify-start" asChild>
                  <a 
                    href="https://supabase.com/dashboard/project/ojxmfxbflbfinodkhixk/functions/webhook-abacatepay/logs" 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Logs da Function
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default WebhookAbacatePayMonitor;