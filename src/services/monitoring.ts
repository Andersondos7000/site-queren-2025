import { config } from 'dotenv';
config();

import winston from 'winston';
import { supabase } from '../lib/supabase';
import { getEnvironmentConfig } from '../config/reconciliation.config';

export interface MetricData {
  executionId: string;
  timestamp: Date;
  duration: number;
  ordersProcessed: number;
  ordersCorrected: number;
  errorsCount: number;
  apiCallsCount: number;
  apiSuccessRate: number;
  lockAcquisitionTime?: number;
  batchCorrections?: number;
}

export interface AlertThreshold {
  metric: string;
  operator: 'gt' | 'lt' | 'eq';
  value: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

export class MonitoringService {
  private logger: winston.Logger;
  private config: ReturnType<typeof getEnvironmentConfig>;
  private alertThresholds: AlertThreshold[];

  constructor() {
    this.config = getEnvironmentConfig();
    
    this.logger = winston.createLogger({
      level: this.config.LOG_LEVEL,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ 
          filename: 'logs/monitoring.log',
          maxsize: 10 * 1024 * 1024, // 10MB
          maxFiles: 5
        })
      ]
    });

    this.alertThresholds = [
      {
        metric: 'duration',
        operator: 'gt',
        value: 180000, // 3 minutos
        severity: 'medium',
        description: 'Execução demorou mais que 3 minutos'
      },
      {
        metric: 'apiSuccessRate',
        operator: 'lt',
        value: 0.9, // 90%
        severity: 'high',
        description: 'Taxa de sucesso da API abaixo de 90%'
      },
      {
        metric: 'errorsCount',
        operator: 'gt',
        value: 5,
        severity: 'medium',
        description: 'Mais de 5 erros em uma execução'
      },
      {
        metric: 'lockAcquisitionTime',
        operator: 'gt',
        value: 30000, // 30 segundos
        severity: 'low',
        description: 'Tempo para adquirir lock muito alto'
      }
    ];
  }

  /**
   * Registra métricas de uma execução
   */
  async recordMetrics(metrics: MetricData): Promise<void> {
    try {
      // Salvar no banco
      const { error } = await supabase
        .from('reconciliation_metrics')
        .insert({
          execution_id: metrics.executionId,
          timestamp: metrics.timestamp.toISOString(),
          duration_ms: metrics.duration,
          orders_processed: metrics.ordersProcessed,
          orders_corrected: metrics.ordersCorrected,
          errors_count: metrics.errorsCount,
          api_calls_count: metrics.apiCallsCount,
          api_success_rate: metrics.apiSuccessRate,
          lock_acquisition_time_ms: metrics.lockAcquisitionTime,
          batch_corrections: metrics.batchCorrections,
          metadata: {
            environment: process.env.NODE_ENV || 'development',
            version: process.env.npm_package_version || '1.0.0'
          }
        });

      if (error) {
        this.logger.error('Erro ao salvar métricas', { error: error.message });
        return;
      }

      // Log estruturado
      this.logger.info('Métricas registradas', {
        executionId: metrics.executionId,
        duration: `${metrics.duration}ms`,
        processed: metrics.ordersProcessed,
        corrected: metrics.ordersCorrected,
        errors: metrics.errorsCount,
        apiSuccessRate: `${(metrics.apiSuccessRate * 100).toFixed(1)}%`
      });

      // Verificar alertas
      await this.checkAlerts(metrics);

    } catch (error) {
      this.logger.error('Erro ao registrar métricas', { error });
    }
  }

  /**
   * Verifica se alguma métrica ultrapassou os thresholds
   */
  private async checkAlerts(metrics: MetricData): Promise<void> {
    const triggeredAlerts: Array<AlertThreshold & { value: number }> = [];

    for (const threshold of this.alertThresholds) {
      const metricValue = metrics[threshold.metric as keyof MetricData] as number;
      
      if (metricValue === undefined) continue;

      let triggered = false;
      switch (threshold.operator) {
        case 'gt':
          triggered = metricValue > threshold.value;
          break;
        case 'lt':
          triggered = metricValue < threshold.value;
          break;
        case 'eq':
          triggered = metricValue === threshold.value;
          break;
      }

      if (triggered) {
        triggeredAlerts.push({ ...threshold, value: metricValue });
      }
    }

    if (triggeredAlerts.length > 0) {
      await this.sendAlerts(metrics.executionId, triggeredAlerts);
    }
  }

  /**
   * Envia alertas para os canais configurados
   */
  private async sendAlerts(
    executionId: string, 
    alerts: Array<AlertThreshold & { value: number }>
  ): Promise<void> {
    try {
      // Salvar alertas no banco
      for (const alert of alerts) {
        const { error } = await supabase
          .from('reconciliation_alerts')
          .insert({
            execution_id: executionId,
            metric: alert.metric,
            threshold_value: alert.value,
            actual_value: alert.value,
            severity: alert.severity,
            description: alert.description,
            triggered_at: new Date().toISOString()
          });

        if (error) {
          this.logger.error('Erro ao salvar alerta', { error: error.message });
        }
      }

      // Log dos alertas
      this.logger.warn('Alertas disparados', {
        executionId,
        alerts: alerts.map(a => ({
          metric: a.metric,
          severity: a.severity,
          description: a.description,
          value: a.value
        }))
      });

      // Aqui você pode adicionar integração com:
      // - Slack/Discord webhooks
      // - Email notifications
      // - PagerDuty
      // - Etc.

    } catch (error) {
      this.logger.error('Erro ao enviar alertas', { error });
    }
  }

  /**
   * Obtém estatísticas das últimas execuções
   */
  async getExecutionStats(hours: number = 24): Promise<any> {
    try {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);

      const { data: metrics, error } = await supabase
        .from('reconciliation_metrics')
        .select('*')
        .gte('timestamp', since.toISOString())
        .order('timestamp', { ascending: false });

      if (error) {
        this.logger.error('Erro ao buscar estatísticas', { error: error.message });
        return null;
      }

      if (!metrics || metrics.length === 0) {
        return {
          totalExecutions: 0,
          avgDuration: 0,
          totalProcessed: 0,
          totalCorrected: 0,
          avgSuccessRate: 0,
          lastExecution: null
        };
      }

      const stats = {
        totalExecutions: metrics.length,
        avgDuration: Math.round(metrics.reduce((sum, m) => sum + m.duration_ms, 0) / metrics.length),
        totalProcessed: metrics.reduce((sum, m) => sum + m.orders_processed, 0),
        totalCorrected: metrics.reduce((sum, m) => sum + m.orders_corrected, 0),
        avgSuccessRate: metrics.reduce((sum, m) => sum + m.api_success_rate, 0) / metrics.length,
        lastExecution: metrics[0]?.timestamp,
        recentErrors: metrics.filter(m => m.errors_count > 0).length
      };

      return stats;

    } catch (error) {
      this.logger.error('Erro ao calcular estatísticas', { error });
      return null;
    }
  }

  /**
   * Verifica saúde do sistema
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    checks: Array<{ name: string; status: boolean; message?: string }>;
  }> {
    const checks = [];
    let overallStatus: 'healthy' | 'warning' | 'critical' = 'healthy';

    try {
      // Verificar conectividade com Supabase
      const { error: supabaseError } = await supabase
        .from('reconciliation_locks')
        .select('id')
        .limit(1);

      checks.push({
        name: 'Supabase Connection',
        status: !supabaseError,
        message: supabaseError?.message
      });

      if (supabaseError) overallStatus = 'critical';

      // Verificar última execução
      const stats = await this.getExecutionStats(1); // Última hora
      const hasRecentExecution = stats && stats.totalExecutions > 0;

      checks.push({
        name: 'Recent Execution',
        status: hasRecentExecution,
        message: hasRecentExecution ? 'OK' : 'Nenhuma execução na última hora'
      });

      if (!hasRecentExecution && overallStatus === 'healthy') {
        overallStatus = 'warning';
      }

      // Verificar alertas críticos recentes
      const { data: criticalAlerts } = await supabase
        .from('reconciliation_alerts')
        .select('*')
        .eq('severity', 'critical')
        .gte('triggered_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());

      const hasCriticalAlerts = criticalAlerts && criticalAlerts.length > 0;

      checks.push({
        name: 'Critical Alerts',
        status: !hasCriticalAlerts,
        message: hasCriticalAlerts ? `${criticalAlerts.length} alertas críticos` : 'OK'
      });

      if (hasCriticalAlerts) overallStatus = 'critical';

    } catch (error) {
      checks.push({
        name: 'Health Check',
        status: false,
        message: `Erro: ${error}`
      });
      overallStatus = 'critical';
    }

    return { status: overallStatus, checks };
  }
}