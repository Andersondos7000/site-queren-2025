/**
 * Configurações centralizadas do Agente de Reconciliação
 * Baseado no PRD v2.1 - Agente de Reconciliação AbacatePay <> Supabase
 */

import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

/**
 * Configurações do Agente de Reconciliação
 */
export const RECONCILIATION_CONFIG = {
  // Configurações de execução
  BATCH_SIZE: 100, // Máximo de pedidos por execução
  TIMEOUT_MS: 4 * 60 * 1000, // 4 minutos timeout total
  LOCK_TIMEOUT_MS: 5 * 60 * 1000, // 5 minutos timeout do lock
  
  // Configurações de retry
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
  RETRY_BACKOFF_FACTOR: 2,
  
  // Configurações de API
  API_TIMEOUT_MS: 30 * 1000, // 30 segundos por chamada API
  API_THROTTLE_MS: 100, // 100ms entre chamadas
  CIRCUIT_BREAKER_THRESHOLD: 0.5, // 50% de falhas para abrir circuit breaker
  
  // Configurações de busca
  PENDING_ORDER_AGE_HOURS: 1, // Buscar pedidos pendentes há mais de 1 hora
  
  // Configurações de logging
  LOG_LEVEL: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  LOG_FILE: 'logs/reconciliation.log',
  
  // Configurações de métricas
  METRICS_RETENTION_DAYS: 30,
  
  // Configurações de alertas
  ALERT_THRESHOLDS: {
    EXECUTION_TIME_MS: 3 * 60 * 1000, // 3 minutos
    API_ERROR_RATE: 0.1, // 10%
    PENDING_ORDERS_GROWTH: 50 // 50 pedidos
  }
} as const;

/**
 * Configurações específicas por ambiente
 */
export const getEnvironmentConfig = () => {
  const env = process.env.NODE_ENV || 'development';
  
  const configs = {
    development: {
      ...RECONCILIATION_CONFIG,
      BATCH_SIZE: 10, // Menor batch para desenvolvimento
      LOG_LEVEL: 'debug'
    },
    production: {
      ...RECONCILIATION_CONFIG,
      LOG_LEVEL: 'info'
    },
    test: {
      ...RECONCILIATION_CONFIG,
      BATCH_SIZE: 5,
      TIMEOUT_MS: 30 * 1000, // 30 segundos para testes
      LOG_LEVEL: 'error'
    }
  };
  
  return configs[env as keyof typeof configs] || configs.development;
};

/**
 * Validação de variáveis de ambiente obrigatórias
 */
export const validateEnvironment = (): void => {
  const requiredVars = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'ABACATEPAY_API_KEY'
  ];
  
  const missing = requiredVars.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Variáveis de ambiente obrigatórias não encontradas: ${missing.join(', ')}`);
  }
};