/**
 * Configurações do Agente de Reconciliação
 */

export const RECONCILIATION_CONFIG = {
  // Configurações de execução
  CRON_SCHEDULE: '*/5 * * * *', // A cada 5 minutos
  EXECUTION_TIMEOUT: 4 * 60 * 1000, // 4 minutos em ms
  BATCH_SIZE: 100, // Máximo de pedidos por execução
  
  // Configurações de retry
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // 1 segundo
  BACKOFF_MULTIPLIER: 2,
  
  // Configurações de API
  API_TIMEOUT: 30000, // 30 segundos
  API_THROTTLE_DELAY: 100, // 100ms entre chamadas
  
  // Configurações de lock
  LOCK_TIMEOUT: 5 * 60 * 1000, // 5 minutos
  LOCK_RETRY_INTERVAL: 10000, // 10 segundos
  
  // Configurações de auditoria
  AUDIT_RETENTION_DAYS: 30,
  
  // Configurações de monitoramento
  LOG_LEVEL: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  METRICS_ENABLED: true,
  
  // Configurações de preços
  EXPECTED_TICKET_PRICE: 15000, // R$ 150,00 em centavos
  PRICE_TOLERANCE: 0.05, // 5% de tolerância
  
  // Configurações de tempo
  PENDING_ORDER_MIN_AGE: 60 * 60 * 1000, // 1 hora em ms
  PENDING_ORDER_MAX_AGE: 24 * 60 * 60 * 1000, // 24 horas em ms
} as const;

/**
 * Configurações específicas por ambiente
 */
export const getEnvironmentConfig = () => {
  const env = process.env.NODE_ENV || 'development';
  
  switch (env) {
    case 'production':
      return {
        ...RECONCILIATION_CONFIG,
        LOG_LEVEL: 'info',
        BATCH_SIZE: 100,
        CRON_SCHEDULE: '*/5 * * * *', // A cada 5 minutos
      };
      
    case 'staging':
      return {
        ...RECONCILIATION_CONFIG,
        LOG_LEVEL: 'debug',
        BATCH_SIZE: 50,
        CRON_SCHEDULE: '*/10 * * * *', // A cada 10 minutos
      };
      
    case 'development':
    default:
      return {
        ...RECONCILIATION_CONFIG,
        LOG_LEVEL: 'debug',
        BATCH_SIZE: 10,
        CRON_SCHEDULE: '*/15 * * * *', // A cada 15 minutos
      };
  }
};

/**
 * Validação de configuração
 */
export const validateConfig = (config: typeof RECONCILIATION_CONFIG) => {
  const errors: string[] = [];
  
  if (config.BATCH_SIZE <= 0) {
    errors.push('BATCH_SIZE deve ser maior que 0');
  }
  
  if (config.EXECUTION_TIMEOUT <= 0) {
    errors.push('EXECUTION_TIMEOUT deve ser maior que 0');
  }
  
  if (config.MAX_RETRIES < 0) {
    errors.push('MAX_RETRIES deve ser maior ou igual a 0');
  }
  
  if (config.EXPECTED_TICKET_PRICE <= 0) {
    errors.push('EXPECTED_TICKET_PRICE deve ser maior que 0');
  }
  
  if (config.PRICE_TOLERANCE < 0 || config.PRICE_TOLERANCE > 1) {
    errors.push('PRICE_TOLERANCE deve estar entre 0 e 1');
  }
  
  if (errors.length > 0) {
    throw new Error(`Configuração inválida: ${errors.join(', ')}`);
  }
  
  return true;
};