/**
 * Tipos para o Agente de Reconciliação AbacatePay <> Supabase
 */

export interface Order {
  id: string;
  status: 'pending' | 'paid' | 'expired' | 'cancelled';
  customer_email: string;
  customer_name: string;
  total_amount: number;
  created_at: string;
  updated_at: string;
  abacatepay_charges?: AbacatePayCharge[];
}

export interface AbacatePayCharge {
  id: string;
  order_id: string;
  charge_id: string;
  amount: number;
  currency: string;
  status: string;
  payment_method?: string;
  customer_name?: string;
  customer_email?: string;
  customer_document?: string;
  description?: string;
  qr_code?: string;
  qr_code_url?: string;
  expires_at?: string;
  paid_at?: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
}

export interface AbacatePayStatus {
  id: string;
  status: 'pending' | 'paid' | 'expired' | 'cancelled' | 'failed';
  amount: number;
  currency: string;
  paid_at?: string;
  expires_at?: string;
  payment_method?: string;
  metadata?: Record<string, any>;
}

export interface ReconciliationMetrics {
  executionId: string;
  startTime: Date;
  endTime?: Date;
  ordersProcessed: number;
  ordersUpdated: number;
  apiCalls: number;
  apiErrors: number;
  success: boolean;
  errors: string[];
}

export interface ReconciliationAudit {
  id?: string;
  order_id: string;
  charge_id: string;
  old_status: string;
  new_status: string;
  reconciled_at?: string;
  execution_id: string;
}

export interface ReconciliationLock {
  id: string;
  locked_at: Date;
  expires_at: Date;
}

export interface ProcessOrderResult {
  orderId: string;
  chargeId: string;
  oldStatus: string;
  newStatus: string;
  updated: boolean;
  error?: string;
}

export interface CircuitBreakerState {
  failures: number;
  lastFailure?: Date;
  state: 'closed' | 'open' | 'half-open';
}

export interface RetryOptions {
  maxRetries: number;
  delayMs: number;
  backoffFactor: number;
}

export interface AlertThresholds {
  executionTimeMs: number;
  apiErrorRate: number;
  pendingOrdersGrowth: number;
}

export interface EnvironmentConfig {
  BATCH_SIZE: number;
  TIMEOUT_MS: number;
  LOCK_TIMEOUT_MS: number;
  MAX_RETRIES: number;
  RETRY_DELAY_MS: number;
  RETRY_BACKOFF_FACTOR: number;
  API_TIMEOUT_MS: number;
  API_THROTTLE_MS: number;
  CIRCUIT_BREAKER_THRESHOLD: number;
  PENDING_ORDER_AGE_HOURS: number;
  LOG_LEVEL: string;
  LOG_FILE: string;
  METRICS_RETENTION_DAYS: number;
  ALERT_THRESHOLDS: AlertThresholds;
}

export interface SchedulerStatus {
  running: boolean;
  nextExecution?: Date;
  lastExecution?: Date;
  lastResult?: 'success' | 'error';
}

export interface ReconciliationSummary {
  executionId: string;
  timestamp: Date;
  duration: number;
  ordersProcessed: number;
  ordersUpdated: number;
  successRate: number;
  errors: string[];
}

// Tipos para as funções SQL
export interface UpdateOrderWithAuditParams {
  p_order_id: string;
  p_new_status: string;
  p_execution_id: string;
  p_charge_id: string;
}

export interface CreateTicketsForOrderParams {
  p_order_id: string;
}