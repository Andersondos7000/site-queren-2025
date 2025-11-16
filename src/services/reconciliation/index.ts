import { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import winston from 'winston';
import { 
  Order, 
  AbacatePayStatus, 
  ReconciliationMetrics, 
  ProcessOrderResult,
  CircuitBreakerState,
  RetryOptions
} from './types.js';
import { getEnvironmentConfig, validateEnvironment } from './config.js';
import { supabase } from '../../lib/supabase.js';

// Validar ambiente na inicialização
validateEnvironment();

const config = getEnvironmentConfig();

// Configuração do logger
const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: config.LOG_FILE }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Schemas de validação
const OrderSchema = z.object({
  id: z.string(),
  status: z.enum(['pending', 'paid', 'expired', 'cancelled']),
  customer_email: z.string(),
  customer_name: z.string(),
  total_amount: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
  abacatepay_charges: z.array(z.object({
    id: z.string(),
    charge_id: z.string(),
    amount: z.number(),
    status: z.string()
  })).optional()
});

const AbacatePayStatusSchema = z.object({
  id: z.string(),
  status: z.enum(['pending', 'paid', 'expired', 'cancelled', 'failed']),
  amount: z.number(),
  currency: z.string(),
  paid_at: z.string().optional(),
  expires_at: z.string().optional(),
  payment_method: z.string().optional(),
  metadata: z.record(z.any()).optional()
});

class ReconciliationAgent {
  private supabase: SupabaseClient;
  private abacatePayApiUrl: string;
  private abacatePayApiKey: string;
  private metrics: ReconciliationMetrics;
  private circuitBreaker: CircuitBreakerState;

  constructor() {
    this.initializeSupabase();
    this.initializeAbacatePay();
    this.initializeMetrics();
    this.initializeCircuitBreaker();
  }

  private initializeSupabase(): void {
    this.supabase = supabase;
  }

  private initializeAbacatePay(): void {
    this.abacatePayApiUrl = process.env.ABACATEPAY_API_URL || 'https://api.abacatepay.com';
    this.abacatePayApiKey = process.env.ABACATEPAY_TOKEN!;

    if (!this.abacatePayApiKey) {
      throw new Error('Credenciais do AbacatePay não encontradas');
    }
  }

  private initializeMetrics(): void {
    this.metrics = {
      executionId: crypto.randomUUID(),
      startTime: new Date(),
      ordersProcessed: 0,
      ordersUpdated: 0,
      apiCalls: 0,
      apiErrors: 0,
      success: false,
      errors: []
    };
  }

  private initializeCircuitBreaker(): void {
    this.circuitBreaker = {
      failures: 0,
      state: 'closed'
    };
  }

  /**
   * Executa o processo de reconciliação completo
   */
  async execute(): Promise<void> {
    logger.info('Iniciando processo de reconciliação', { 
      executionId: this.metrics.executionId 
    });

    try {
      // Verificar lock
      const hasLock = await this.acquireLock();
      if (!hasLock) {
        logger.warn('Processo já em execução, pulando esta execução');
        return;
      }

      // Buscar pedidos pendentes
      const pendingOrders = await this.fetchPendingOrders();
      logger.info(`Encontrados ${pendingOrders.length} pedidos pendentes`, {
        executionId: this.metrics.executionId
      });

      // Processar cada pedido
      for (const order of pendingOrders) {
        await this.processOrder(order);
        this.metrics.ordersProcessed++;
        
        // Throttling entre chamadas
        await this.sleep(100);
      }

      this.metrics.success = true;
      logger.info('Reconciliação concluída com sucesso', {
        executionId: this.metrics.executionId,
        metrics: this.getMetricsSummary()
      });

    } catch (error) {
      this.metrics.success = false;
      this.metrics.errors.push(error instanceof Error ? error.message : String(error));
      logger.error('Erro durante reconciliação', {
        executionId: this.metrics.executionId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    } finally {
      this.metrics.endTime = new Date();
      await this.releaseLock();
      await this.saveMetrics();
    }
  }

  /**
   * Busca pedidos pendentes no Supabase
   */
  private async fetchPendingOrders(): Promise<Order[]> {
    try {
      const cutoffTime = new Date(Date.now() - config.PENDING_ORDER_AGE_HOURS * 60 * 60 * 1000).toISOString();
      
      const { data, error } = await this.supabase
        .from('orders')
        .select(`
          id,
          status,
          customer_email,
          customer_name,
          total_amount,
          created_at,
          updated_at,
          abacatepay_charges (
            id,
            charge_id,
            amount,
            status
          )
        `)
        .eq('status', 'pending')
        .lt('created_at', cutoffTime)
        .limit(config.BATCH_SIZE);

      if (error) {
        throw new Error(`Erro ao buscar pedidos: ${error.message}`);
      }

      return (data || []).map(order => OrderSchema.parse(order));
    } catch (error) {
      logger.error('Erro ao buscar pedidos pendentes', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      throw error;
    }
  }

  /**
   * Processa um pedido individual
   */
  private async processOrder(order: any): Promise<void> {
    try {
      const chargeId = order.abacatepay_charges[0]?.charge_id;
      if (!chargeId) {
        logger.warn(`Pedido ${order.id} não possui charge_id`, {
          executionId: this.metrics.executionId,
          orderId: order.id
        });
        return;
      }

      // Consultar status no AbacatePay
      const abacatePayStatus = await this.fetchAbacatePayStatus(chargeId);
      
      // Verificar se precisa atualizar
      if (abacatePayStatus.status !== 'pending' && abacatePayStatus.status !== order.status) {
        await this.updateOrderStatus(order, abacatePayStatus);
        this.metrics.ordersUpdated++;
      }

    } catch (error) {
      this.metrics.errors.push(`Erro ao processar pedido ${order.id}: ${error instanceof Error ? error.message : String(error)}`);
      logger.error(`Erro ao processar pedido ${order.id}`, {
        executionId: this.metrics.executionId,
        orderId: order.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Consulta status no AbacatePay com retry e circuit breaker
   */
  private async fetchAbacatePayStatus(chargeId: string, retries = 3): Promise<any> {
    // Verificar circuit breaker
    if (this.circuitBreaker.state === 'open') {
      const timeSinceLastFailure = this.circuitBreaker.lastFailure ? 
        Date.now() - this.circuitBreaker.lastFailure.getTime() : 0;
      
      if (timeSinceLastFailure < 60000) { // 1 minuto
        logger.warn('Circuit breaker aberto, pulando chamada API', { chargeId });
        return null;
      } else {
        this.circuitBreaker.state = 'half-open';
      }
    }

    const retryOptions: RetryOptions = {
      maxRetries: config.MAX_RETRIES || retries,
      delayMs: config.RETRY_DELAY_MS || 1000,
      backoffFactor: config.RETRY_BACKOFF_FACTOR || 2
    };

    for (let attempt = 1; attempt <= retryOptions.maxRetries; attempt++) {
      try {
        this.metrics.apiCalls++;
        
        // Throttling entre chamadas
        if (attempt > 1) {
          await this.sleep(config.API_THROTTLE_MS || 100);
        }
        
        const response = await fetch(`${this.abacatePayApiUrl}/charges/${chargeId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${this.abacatePayApiKey}`,
            'Content-Type': 'application/json'
          },
          signal: AbortSignal.timeout(config.API_TIMEOUT_MS || 30000)
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const result = AbacatePayStatusSchema.parse(data);
        
        // Sucesso - resetar circuit breaker
        this.circuitBreaker.failures = 0;
        this.circuitBreaker.state = 'closed';
        
        return result;

      } catch (error) {
        this.metrics.apiErrors++;
        this.circuitBreaker.failures++;
        this.circuitBreaker.lastFailure = new Date();
        
        // Verificar se deve abrir circuit breaker
        const errorRate = this.metrics.apiErrors / this.metrics.apiCalls;
        if (errorRate >= (config.CIRCUIT_BREAKER_THRESHOLD || 0.5)) {
          this.circuitBreaker.state = 'open';
          logger.error('Circuit breaker aberto devido a alta taxa de erro', {
            errorRate,
            failures: this.circuitBreaker.failures
          });
        }
        
        logger.warn(`Tentativa ${attempt} falhou para charge ${chargeId}`, {
          executionId: this.metrics.executionId,
          chargeId,
          error: error instanceof Error ? error.message : String(error)
        });

        if (attempt === retryOptions.maxRetries) {
          logger.error(`Falha definitiva ao consultar charge ${chargeId}`, {
            error: error instanceof Error ? error.message : String(error)
          });
          return null;
        }

        // Backoff exponencial
        await this.sleep(retryOptions.delayMs * Math.pow(retryOptions.backoffFactor, attempt - 1));
      }
    }

    return null;
  }

  /**
   * Atualiza status do pedido no Supabase
   */
  private async updateOrderStatus(order: any, abacatePayStatus: any): Promise<void> {
    const { error: transactionError } = await this.supabase.rpc('update_order_with_audit', {
      p_order_id: order.id,
      p_old_status: order.status,
      p_new_status: abacatePayStatus.status,
      p_execution_id: this.metrics.executionId,
      p_charge_id: order.abacatepay_charges[0]?.charge_id
    });

    if (transactionError) {
      throw new Error(`Erro ao atualizar pedido: ${transactionError.message}`);
    }

    logger.info(`Pedido ${order.id} atualizado: ${order.status} → ${abacatePayStatus.status}`, {
      executionId: this.metrics.executionId,
      orderId: order.id,
      oldStatus: order.status,
      newStatus: abacatePayStatus.status
    });

    // Disparar fulfillment se necessário
    if (abacatePayStatus.status === 'paid') {
      await this.triggerFulfillment(order.id);
    }
  }

  /**
   * Dispara processo de fulfillment para pedidos pagos
   */
  private async triggerFulfillment(orderId: string): Promise<void> {
    try {
      // Aqui você implementaria a lógica de fulfillment
      // Por exemplo, criar tickets, enviar emails, etc.
      logger.info(`Fulfillment disparado para pedido ${orderId}`, {
        executionId: this.metrics.executionId,
        orderId
      });
    } catch (error) {
      logger.error(`Erro ao disparar fulfillment para pedido ${orderId}`, {
        executionId: this.metrics.executionId,
        orderId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Adquire lock otimista para evitar execuções concorrentes
   */
  private async acquireLock(): Promise<boolean> {
    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + config.LOCK_TIMEOUT_MS);
      
      // Primeiro, limpar locks expirados
      await this.supabase
        .from('reconciliation_locks')
        .delete()
        .lt('expires_at', now.toISOString());
      
      // Tentar adquirir lock
      const { data, error } = await this.supabase
        .from('reconciliation_locks')
        .insert({
          id: 'singleton',
          locked_at: now.toISOString(),
          expires_at: expiresAt.toISOString()
        })
        .select()
        .single();

      if (error) {
        // Se erro de conflito, lock já existe
        if (error.code === '23505') {
          logger.info('Lock já adquirido por outra instância');
          return false;
        }
        
        logger.error('Erro ao adquirir lock', { error: error.message });
        return false;
      }

      logger.info('Lock adquirido com sucesso', { 
        executionId: this.metrics.executionId,
        expiresAt: expiresAt.toISOString()
      });
      
      return true;
    } catch (error) {
      logger.error('Erro ao adquirir lock', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return false;
    }
  }

  /**
   * Libera o lock
   */
  private async releaseLock(): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('reconciliation_locks')
        .delete()
        .eq('id', 'singleton');

      if (error) {
        logger.error('Erro ao liberar lock', { error: error.message });
      } else {
        logger.info('Lock liberado com sucesso', { 
          executionId: this.metrics.executionId 
        });
      }
    } catch (error) {
      logger.error('Erro ao liberar lock', { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  /**
   * Salva métricas da execução
   */
  private async saveMetrics(): Promise<void> {
    try {
      const duration = this.metrics.endTime ? 
        this.metrics.endTime.getTime() - this.metrics.startTime.getTime() : null;
      
      const successRate = this.metrics.apiCalls > 0 ? 
        ((this.metrics.apiCalls - this.metrics.apiErrors) / this.metrics.apiCalls) : 1;

      const { error } = await this.supabase
        .from('reconciliation_metrics')
        .insert({
          execution_id: this.metrics.executionId,
          timestamp: this.metrics.startTime.toISOString(),
          duration_ms: duration,
          orders_processed: this.metrics.ordersProcessed,
          orders_corrected: this.metrics.ordersUpdated,
          errors_count: this.metrics.errors.length,
          api_calls_count: this.metrics.apiCalls,
          api_success_rate: successRate,
          lock_acquisition_time_ms: 0, // Pode ser implementado depois
          batch_corrections: this.metrics.ordersUpdated,
          metadata: {
            success: this.metrics.success,
            errors: this.metrics.errors,
            startTime: this.metrics.startTime.toISOString(),
            endTime: this.metrics.endTime?.toISOString()
          }
        });

      if (error) {
        logger.error('Erro ao salvar métricas', { error: error.message });
      }
    } catch (error) {
      logger.error('Erro ao salvar métricas', { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  /**
   * Retorna resumo das métricas
   */
  private getMetricsSummary() {
    const duration = this.metrics.endTime ? 
      this.metrics.endTime.getTime() - this.metrics.startTime.getTime() : 0;
    
    return {
      ordersProcessed: this.metrics.ordersProcessed,
      ordersUpdated: this.metrics.ordersUpdated,
      apiCalls: this.metrics.apiCalls,
      apiErrors: this.metrics.apiErrors,
      errorRate: this.metrics.apiCalls > 0 ? 
        (this.metrics.apiErrors / this.metrics.apiCalls * 100).toFixed(2) + '%' : '0%',
      durationMs: duration,
      success: this.metrics.success
    };
  }

  /**
   * Utilitário para sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export { ReconciliationAgent };