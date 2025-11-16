/**
 * Configuração centralizada de variáveis de ambiente
 * Valida e expõe todas as configurações necessárias para a aplicação
 */

interface RedisConfig {
  url?: string;
  host: string;
  port: number;
  password?: string;
  db: number;
  tls: boolean;
  enabled: boolean;
}

interface RateLimitConfig {
  enabled: boolean;
  redisEnabled: boolean;
  login: {
    windowMs: number;
    maxAttempts: number;
    blockDurationMs: number;
  };
  signup: {
    windowMs: number;
    maxAttempts: number;
    blockDurationMs: number;
  };
  passwordReset: {
    windowMs: number;
    maxAttempts: number;
    blockDurationMs: number;
  };
  googleOauth: {
    windowMs: number;
    maxAttempts: number;
    blockDurationMs: number;
  };
  api: {
    windowMs: number;
    maxAttempts: number;
    blockDurationMs: number;
  };
}

interface AppConfig {
  supabase: {
    url: string;
    anonKey: string;
    serviceRoleKey?: string;
  };
  redis: RedisConfig;
  rateLimit: RateLimitConfig;
  environment: 'development' | 'staging' | 'production';
  debug: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

class ConfigService {
  private config: AppConfig;

  constructor() {
    this.validateRequiredVars();
    this.config = this.loadConfig();
  }

  private validateRequiredVars(): void {
    const required = [
      'VITE_SUPABASE_URL',
      'VITE_SUPABASE_ANON_KEY'
    ];

    const missing = required.filter(key => !import.meta.env[key]);
    
    if (missing.length > 0) {
      throw new Error(`Variáveis de ambiente obrigatórias não encontradas: ${missing.join(', ')}`);
    }
  }

  private loadConfig(): AppConfig {
    return {
      supabase: {
        url: import.meta.env.VITE_SUPABASE_URL,
        anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        serviceRoleKey: import.meta.env.SUPABASE_SERVICE_ROLE_KEY
      },
      redis: {
        url: import.meta.env.REDIS_URL,
        host: import.meta.env.REDIS_HOST || 'localhost',
        port: parseInt(import.meta.env.REDIS_PORT || '6379'),
        password: import.meta.env.REDIS_PASSWORD,
        db: parseInt(import.meta.env.REDIS_DB || '0'),
        tls: import.meta.env.REDIS_TLS === 'true',
        enabled: import.meta.env.RATE_LIMIT_REDIS_ENABLED === 'true'
      },
      rateLimit: {
        enabled: import.meta.env.RATE_LIMIT_ENABLED !== 'false',
        redisEnabled: import.meta.env.RATE_LIMIT_REDIS_ENABLED === 'true',
        login: {
          windowMs: parseInt(import.meta.env.RATE_LIMIT_LOGIN_WINDOW_MS || '900000'), // 15 min
          maxAttempts: parseInt(import.meta.env.RATE_LIMIT_LOGIN_MAX_ATTEMPTS || '5'),
          blockDurationMs: parseInt(import.meta.env.RATE_LIMIT_LOGIN_BLOCK_DURATION_MS || '1800000') // 30 min
        },
        signup: {
          windowMs: parseInt(import.meta.env.RATE_LIMIT_SIGNUP_WINDOW_MS || '3600000'), // 1 hora
          maxAttempts: parseInt(import.meta.env.RATE_LIMIT_SIGNUP_MAX_ATTEMPTS || '3'),
          blockDurationMs: parseInt(import.meta.env.RATE_LIMIT_SIGNUP_BLOCK_DURATION_MS || '3600000') // 1 hora
        },
        passwordReset: {
          windowMs: parseInt(import.meta.env.RATE_LIMIT_PASSWORD_RESET_WINDOW_MS || '3600000'), // 1 hora
          maxAttempts: parseInt(import.meta.env.RATE_LIMIT_PASSWORD_RESET_MAX_ATTEMPTS || '3'),
          blockDurationMs: parseInt(import.meta.env.RATE_LIMIT_PASSWORD_RESET_BLOCK_DURATION_MS || '7200000') // 2 horas
        },
        googleOauth: {
          windowMs: parseInt(import.meta.env.RATE_LIMIT_GOOGLE_OAUTH_WINDOW_MS || '900000'), // 15 min
          maxAttempts: parseInt(import.meta.env.RATE_LIMIT_GOOGLE_OAUTH_MAX_ATTEMPTS || '10'),
          blockDurationMs: parseInt(import.meta.env.RATE_LIMIT_GOOGLE_OAUTH_BLOCK_DURATION_MS || '1800000') // 30 min
        },
        api: {
          windowMs: parseInt(import.meta.env.RATE_LIMIT_API_WINDOW_MS || '60000'), // 1 min
          maxAttempts: parseInt(import.meta.env.RATE_LIMIT_API_MAX_ATTEMPTS || '100'),
          blockDurationMs: parseInt(import.meta.env.RATE_LIMIT_API_BLOCK_DURATION_MS || '300000') // 5 min
        }
      },
      environment: (import.meta.env.VITE_ENVIRONMENT || 'development') as 'development' | 'staging' | 'production',
      debug: import.meta.env.VITE_DEBUG === 'true',
      logLevel: (import.meta.env.VITE_LOG_LEVEL || 'info') as 'debug' | 'info' | 'warn' | 'error'
    };
  }

  get(): AppConfig {
    return this.config;
  }

  getRedis(): RedisConfig {
    return this.config.redis;
  }

  getRateLimit(): RateLimitConfig {
    return this.config.rateLimit;
  }

  getSupabase() {
    return this.config.supabase;
  }

  isDevelopment(): boolean {
    return this.config.environment === 'development';
  }

  isProduction(): boolean {
    return this.config.environment === 'production';
  }

  isDebugEnabled(): boolean {
    return this.config.debug;
  }

  /**
   * Valida se a configuração Redis está completa
   */
  validateRedisConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const redis = this.config.redis;

    if (redis.enabled) {
      if (!redis.url && !redis.host) {
        errors.push('Redis URL ou HOST deve ser fornecido quando Redis está habilitado');
      }

      if (!redis.url && (!redis.port || redis.port < 1 || redis.port > 65535)) {
        errors.push('Redis PORT deve ser um número válido entre 1 e 65535');
      }

      if (redis.db < 0 || redis.db > 15) {
        errors.push('Redis DB deve ser um número entre 0 e 15');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Gera configuração de conexão Redis
   */
  getRedisConnectionConfig() {
    const redis = this.config.redis;
    
    if (redis.url) {
      return { url: redis.url };
    }

    return {
      host: redis.host,
      port: redis.port,
      password: redis.password || undefined,
      db: redis.db,
      ...(redis.tls && { tls: {} })
    };
  }
}

// Instância singleton
export const configService = new ConfigService();

// Exports para compatibilidade
export const config = configService.get();
export const redisConfig = configService.getRedis();
export const rateLimitConfig = configService.getRateLimit();
export const supabaseConfig = configService.getSupabase();

export default configService;