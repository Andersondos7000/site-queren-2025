import { redisClient } from './redis/redisClientBrowser';
import { configService, rateLimitConfig } from './config/envConfig';

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  totalHits: number;
}

interface RateLimitConfig {
  windowMs: number;
  maxAttempts: number;
  blockDurationMs: number;
}

export class RateLimitClient {
  private fallbackStorage = new Map<string, { count: number; resetTime: number; blockedUntil?: number }>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Inicia limpeza automática do fallback storage
    this.startCleanup();
    
    // Log da configuração atual
    if (configService.isDebugEnabled()) {
      console.log('🔧 Rate Limit configurado:', {
        enabled: rateLimitConfig.enabled,
        redisEnabled: rateLimitConfig.redisEnabled,
        configs: rateLimitConfig
      });
    }
  }

  // Método para iniciar limpeza automática
  private startCleanup(): void {
    // Cleanup automático a cada 5 minutos
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, 5 * 60 * 1000);
  }

  private getOperationConfig(operation: string) {
    switch (operation) {
      case 'login':
        return rateLimitConfig.login;
      case 'signup':
        return rateLimitConfig.signup;
      case 'password_reset':
        return rateLimitConfig.passwordReset;
      case 'reset_password':
        return rateLimitConfig.passwordReset;
      case 'google_oauth':
        return rateLimitConfig.googleOauth;
      case 'api':
        return rateLimitConfig.api;
      default:
        return null;
    }
  }

  private async getBlockTtl(blockKey: string): Promise<number | null> {
    if (rateLimitConfig.redisEnabled) {
      try {
        return await redisClient.ttl(blockKey);
      } catch (error) {
        console.warn('⚠️ Erro ao obter TTL do Redis, usando fallback:', error);
      }
    }

    // Fallback: verificar no storage local
    const fallbackKey = blockKey.replace('rate_limit_block:', '');
    const entry = this.fallbackStorage.get(fallbackKey);
    if (entry?.blockedUntil) {
      const remaining = entry.blockedUntil - Date.now();
      return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
    }

    return 0;
  }

  private getKey(identifier: string, operation: string): string {
    return `rate_limit:${operation}:${identifier}`;
  }

  private getBlockKey(identifier: string, operation: string): string {
    return `rate_limit_block:${operation}:${identifier}`;
  }

  async checkRateLimit(identifier: string, operation: string): Promise<RateLimitResult> {
    // Verificar se rate limiting está habilitado
    if (!rateLimitConfig.enabled) {
      return {
        allowed: true,
        remaining: 999,
        resetTime: Date.now() + 60000,
        totalHits: 0
      };
    }

    const config = this.getOperationConfig(operation);
    if (!config) {
      throw new Error(`Configuração de rate limit não encontrada para operação: ${operation}`);
    }

    const key = this.getKey(identifier, operation);
    const blockKey = this.getBlockKey(identifier, operation);
    const now = Date.now();

    try {
      // Verificar se está bloqueado (Redis primeiro, fallback depois)
      const isBlocked = await this.isBlocked(blockKey);
      if (isBlocked) {
        const blockTtl = await this.getBlockTtl(blockKey);
        const resetTime = blockTtl ? now + (blockTtl * 1000) : now + config.blockDurationMs;
        
        return {
          allowed: false,
          remaining: 0,
          resetTime,
          totalHits: config.maxAttempts,
        };
      }

      // Verificar contador atual
      const currentCount = await this.getCurrentCount(key);
      const remaining = Math.max(0, config.maxAttempts - currentCount);

      if (currentCount >= config.maxAttempts) {
        // Bloquear usuário
        await this.blockUser(blockKey, config.blockDurationMs);
        
        return {
          allowed: false,
          remaining: 0,
          resetTime: now + config.blockDurationMs,
          totalHits: currentCount,
        };
      }

      // Calcular tempo de reset da janela atual
      const keyTtl = await this.getKeyTtl(key, config.windowMs);
      const resetTime = keyTtl > 0 ? now + (keyTtl * 1000) : now + config.windowMs;

      return {
        allowed: true,
        remaining,
        resetTime,
        totalHits: currentCount,
      };

    } catch (error) {
      console.error('❌ Erro ao verificar rate limit:', error);
      
      // Fallback para storage em memória
      return this.checkRateLimitFallback(identifier, operation, config);
    }
  }

  async recordFailedAttempt(identifier: string, operation: string): Promise<void> {
    if (!rateLimitConfig.enabled) return;

    const config = this.getOperationConfig(operation);
    if (!config) return;

    const key = this.getKey(identifier, operation);

    try {
      if (rateLimitConfig.redisEnabled) {
        // Tentar usar Redis primeiro
        await redisClient.incr(key);
        await redisClient.expire(key, Math.ceil(config.windowMs / 1000));
      } else {
        // Redis desabilitado, usar fallback diretamente sem lançar erro
        this.recordFailedAttemptFallback(identifier, operation, config);
        return;
      }
    } catch (error) {
      console.error('❌ Erro ao registrar tentativa falhada no Redis:', error);
      
      // Fallback para storage em memória
      this.recordFailedAttemptFallback(identifier, operation, config);
    }
  }

  async resetAttempts(identifier: string, operation: string): Promise<void> {
    const key = this.getKey(identifier, operation);
    const blockKey = this.getBlockKey(identifier, operation);

    try {
      if (rateLimitConfig.redisEnabled) {
        // Limpar tanto o contador quanto o bloqueio
        await Promise.all([
          redisClient.del(key),
          redisClient.del(blockKey)
        ]);
      }
    } catch (error) {
      console.error('❌ Erro ao resetar tentativas no Redis:', error);
    }
    
    // Sempre limpar fallback storage também
    this.fallbackStorage.delete(`${operation}:${identifier}`);
    this.fallbackStorage.delete(`block:${operation}:${identifier}`);
  }

  private async isBlocked(blockKey: string): Promise<boolean> {
    // Se Redis não estiver habilitado, usar diretamente o fallback
    if (!rateLimitConfig.redisEnabled) {
      const fallbackKey = blockKey.replace('rate_limit_block:', 'block:');
      const blocked = this.fallbackStorage.get(fallbackKey);
      return blocked ? (blocked.blockedUntil || 0) > Date.now() : false;
    }
    
    try {
      return await redisClient.exists(blockKey);
    } catch (error) {
      console.warn('⚠️ Erro ao verificar bloqueio no Redis:', error);
      
      // Fallback para verificação em memória
      const fallbackKey = blockKey.replace('rate_limit_block:', 'block:');
      const blocked = this.fallbackStorage.get(fallbackKey);
      return blocked ? (blocked.blockedUntil || 0) > Date.now() : false;
    }
  }

  private async getCurrentCount(key: string): Promise<number> {
    // Se Redis não estiver habilitado, usar diretamente o fallback
    if (!rateLimitConfig.redisEnabled) {
      const fallbackKey = key.replace('rate_limit:', '');
      const stored = this.fallbackStorage.get(fallbackKey);
      
      if (!stored) return 0;
      
      // Verificar se a janela expirou
      if (stored.resetTime <= Date.now()) {
        this.fallbackStorage.delete(fallbackKey);
        return 0;
      }
      
      return stored.count;
    }
    
    try {
      const count = await redisClient.get(key);
      return count ? parseInt(count, 10) : 0;
    } catch (error) {
      console.warn('⚠️ Erro ao obter contador do Redis:', error);
      
      // Fallback para contagem em memória
      const fallbackKey = key.replace('rate_limit:', '');
      const stored = this.fallbackStorage.get(fallbackKey);
      
      if (!stored) return 0;
      
      // Verificar se a janela expirou
      if (stored.resetTime <= Date.now()) {
        this.fallbackStorage.delete(fallbackKey);
        return 0;
      }
      
      return stored.count;
    }
  }

  private async getKeyTtl(key: string, defaultWindowMs: number): Promise<number> {
    // Se Redis não estiver habilitado, usar diretamente o fallback
    if (!rateLimitConfig.redisEnabled) {
      const fallbackKey = key.replace('rate_limit:', '');
      const entry = this.fallbackStorage.get(fallbackKey);
      if (entry) {
        const remaining = entry.resetTime - Date.now();
        return remaining > 0 ? Math.ceil(remaining / 1000) : Math.ceil(defaultWindowMs / 1000);
      }
      return Math.ceil(defaultWindowMs / 1000);
    }
    
    try {
      const ttl = await redisClient.ttl(key);
      return ttl > 0 ? ttl : Math.ceil(defaultWindowMs / 1000);
    } catch (error) {
      console.warn('⚠️ Erro ao obter TTL do Redis:', error);
      
      // Fallback: verificar no storage local
      const fallbackKey = key.replace('rate_limit:', '');
      const entry = this.fallbackStorage.get(fallbackKey);
      if (entry) {
        const remaining = entry.resetTime - Date.now();
        return remaining > 0 ? Math.ceil(remaining / 1000) : Math.ceil(defaultWindowMs / 1000);
      }
    }
    
    return Math.ceil(defaultWindowMs / 1000);
  }

  private async blockUser(blockKey: string, blockDurationMs: number): Promise<void> {
    // Sempre definir no fallback para garantir consistência
    const fallbackKey = blockKey.replace('rate_limit_block:', 'block:');
    this.fallbackStorage.set(fallbackKey, {
      count: 1,
      resetTime: Date.now() + blockDurationMs,
      blockedUntil: Date.now() + blockDurationMs
    });
    
    // Se Redis não estiver habilitado, não tenta usar
    if (!rateLimitConfig.redisEnabled) {
      return;
    }
    
    try {
      await redisClient.set(blockKey, '1', Math.ceil(blockDurationMs / 1000));
    } catch (error) {
      console.warn('⚠️ Erro ao bloquear usuário no Redis:', error);
      // Já temos o fallback configurado acima
    }
  }

  // Métodos de fallback para quando Redis não está disponível
  private checkRateLimitFallback(identifier: string, operation: string, config: any): RateLimitResult {
    const key = `${operation}:${identifier}`;
    const blockKey = `block:${operation}:${identifier}`;
    const now = Date.now();

    // Verificar bloqueio
    const blocked = this.fallbackStorage.get(blockKey);
    if (blocked && blocked.resetTime > now) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: blocked.resetTime,
        totalHits: config.maxAttempts,
      };
    }

    // Verificar contador
    const stored = this.fallbackStorage.get(key);
    let currentCount = 0;
    let resetTime = now + config.windowMs;

    if (stored) {
      if (stored.resetTime <= now) {
        // Janela expirou, resetar
        this.fallbackStorage.delete(key);
      } else {
        currentCount = stored.count;
        resetTime = stored.resetTime;
      }
    }

    const remaining = Math.max(0, config.maxAttempts - currentCount);

    if (currentCount >= config.maxAttempts) {
      // Bloquear usuário
      this.fallbackStorage.set(blockKey, {
        count: 1,
        resetTime: now + config.blockDurationMs,
        blockedUntil: now + config.blockDurationMs
      });

      return {
        allowed: false,
        remaining: 0,
        resetTime: now + config.blockDurationMs,
        totalHits: currentCount,
      };
    }

    return {
      allowed: true,
      remaining,
      resetTime,
      totalHits: currentCount,
    };
  }

  private recordFailedAttemptFallback(identifier: string, operation: string, config: any): void {
    const key = `${operation}:${identifier}`;
    const now = Date.now();
    const stored = this.fallbackStorage.get(key);

    if (stored && stored.resetTime > now) {
      // Incrementar contador existente
      stored.count++;
    } else {
      // Criar novo contador
      this.fallbackStorage.set(key, {
        count: 1,
        resetTime: now + config.windowMs
      });
    }
  }

  // Método para limpar dados expirados do fallback storage
  cleanupExpiredEntries(): void {
    const now = Date.now();
    
    for (const [key, value] of this.fallbackStorage.entries()) {
      if (value.resetTime <= now) {
        this.fallbackStorage.delete(key);
      }
    }
  }

  // Método para obter estatísticas
  async getStats(identifier: string, operation: string): Promise<{ current: number; blocked: boolean; resetTime: number } | null> {
    const key = this.getKey(identifier, operation);
    const blockKey = this.getBlockKey(identifier, operation);

    try {
      const [current, blocked] = await Promise.all([
        this.getCurrentCount(key),
        this.isBlocked(blockKey)
      ]);

      const now = Date.now();
      let resetTime = now;

      if (blocked) {
        const blockTtl = await this.getBlockTtl(blockKey);
        if (blockTtl) {
          resetTime = now + (blockTtl * 1000);
        }
      } else {
        const config = this.getOperationConfig(operation);
        if (config) {
          const keyTtl = await this.getKeyTtl(key, config.windowMs);
          if (keyTtl && keyTtl > 0) {
            resetTime = now + (keyTtl * 1000);
          }
        }
      }

      return {
        current,
        blocked,
        resetTime
      };
    } catch (error) {
      console.error('❌ Erro ao obter estatísticas:', error);
      return null;
    }
  }

  // Método para configurar rate limits customizados
  setConfig(operation: string, config: RateLimitConfig): void {
    // Implementação futura - atualmente não há propriedade configs
    // this.configs.set(operation, config);
    console.warn('Método setConfig não implementado completamente');
    console.error('Configuração personalizada de rate limit não suportada');
  }

  // Método para verificar saúde do sistema
  async healthCheck(): Promise<{ redis: boolean; fallback: boolean }> {
    const redisHealth = await redisClient.ping();
    const fallbackHealth = this.fallbackStorage.size >= 0; // Sempre true se o Map existe

    return {
      redis: redisHealth,
      fallback: fallbackHealth
    };
  }
}

// Singleton instance
export const rateLimitClient = new RateLimitClient();

export default rateLimitClient;