import { createClient, RedisClientType } from 'redis';
import { configService } from '../config/envConfig';

/**
 * Cliente Redis para gerenciar conexões e operações
 * Suporta configuração via URL ou parâmetros individuais
 */
export class RedisClient {
  private client: RedisClientType | null = null;
  private isConnected = false;

  constructor() {
    // Valida configuração Redis no boot
    const validation = configService.validateRedisConfig();
    if (!validation.valid) {
      console.warn('⚠️ Configuração Redis inválida:', validation.errors.join(', '));
    }
  }

  private initializeClient() {
    try {
      const config = configService.getRedisConnectionConfig();

      if (config.url) {
        this.client = createClient({ url: config.url });
      } else {
        this.client = createClient(config);
      }

      // Event listeners
      this.client.on('error', (err) => {
        console.error('❌ Redis Client Error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('🔗 Redis conectado');
        this.isConnected = true;
      });

      this.client.on('disconnect', () => {
        console.log('🔌 Redis desconectado');
        this.isConnected = false;
      });

    } catch (error) {
      console.error('❌ Erro ao inicializar cliente Redis:', error);
      this.client = null;
    }
  }

  async connect(): Promise<void> {
    if (this.isConnected && this.client?.isReady) {
      return Promise.resolve();
    }

    try {
      if (!this.client) {
        this.initializeClient();
      }

      if (this.client && !this.client.isReady) {
        await this.client.connect();
        this.isConnected = true;
      }
    } catch (error) {
      console.error('❌ Erro ao conectar Redis:', error);
      this.isConnected = false;
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client?.isReady) {
      await this.client.disconnect();
      this.isConnected = false;
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      await this.ensureConnection();
      return await this.client!.get(key);
    } catch (error) {
      console.error(`❌ Erro ao buscar chave ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    try {
      await this.ensureConnection();
      
      if (ttlSeconds) {
        await this.client!.setEx(key, ttlSeconds, value);
      } else {
        await this.client!.set(key, value);
      }
      
      return true;
    } catch (error) {
      console.error(`❌ Erro ao definir chave ${key}:`, error);
      return false;
    }
  }

  async incr(key: string): Promise<number | null> {
    try {
      await this.ensureConnection();
      return await this.client!.incr(key);
    } catch (error) {
      console.error(`❌ Erro ao incrementar chave ${key}:`, error);
      return null;
    }
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    try {
      await this.ensureConnection();
      const result = await this.client!.expire(key, seconds);
      return result === 1;
    } catch (error) {
      console.error(`❌ Erro ao definir expiração para chave ${key}:`, error);
      return false;
    }
  }

  async ttl(key: string): Promise<number | null> {
    try {
      await this.ensureConnection();
      return await this.client!.ttl(key);
    } catch (error) {
      console.error(`❌ Erro ao buscar TTL da chave ${key}:`, error);
      return null;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      await this.ensureConnection();
      const result = await this.client!.del(key);
      return result > 0;
    } catch (error) {
      console.error(`❌ Erro ao deletar chave ${key}:`, error);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.ensureConnection();
      const result = await this.client!.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`❌ Erro ao verificar existência da chave ${key}:`, error);
      return false;
    }
  }

  async mget(keys: string[]): Promise<(string | null)[]> {
    try {
      await this.ensureConnection();
      return await this.client!.mGet(keys);
    } catch (error) {
      console.error(`❌ Erro ao buscar múltiplas chaves:`, error);
      return keys.map(() => null);
    }
  }

  // Pipeline não está disponível no redis client v4 da mesma forma
  // Removendo método pipeline por enquanto

  private async ensureConnection(): Promise<void> {
    if (!this.isConnected || !this.client?.isReady) {
      await this.connect();
    }
  }

  // Método para verificar saúde da conexão
  async ping(): Promise<boolean> {
    try {
      await this.ensureConnection();
      const result = await this.client!.ping();
      return result === 'PONG';
    } catch (error) {
      console.error('❌ Erro no ping Redis:', error);
      return false;
    }
  }

  // Método para obter informações do Redis
  async info(): Promise<string | null> {
    try {
      await this.ensureConnection();
      return await this.client!.info();
    } catch (error) {
      console.error('❌ Erro ao obter info Redis:', error);
      return null;
    }
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }
}

// Singleton instance
export const redisClient = new RedisClient();
export default redisClient;