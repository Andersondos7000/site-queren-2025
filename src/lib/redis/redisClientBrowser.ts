/**
 * Mock do Redis Client para ambiente do navegador
 * Em produção, o rate limiting deve ser feito no backend
 */
export class RedisClientBrowser {
  private isConnected = false;

  constructor() {
    // Modo mock para browser - rate limiting local apenas para UX
    if (import.meta.env.DEV) {
      console.debug('🔧 RedisClient: modo mock ativo (desenvolvimento)');
    }
    this.isConnected = true;
  }

  async connect(): Promise<void> {
    this.isConnected = true;
    return Promise.resolve();
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    return Promise.resolve();
  }

  async get(key: string): Promise<string | null> {
    console.debug(`[Redis Mock] GET ${key}`);
    return null;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    console.debug(`[Redis Mock] SET ${key} = ${value} (TTL: ${ttlSeconds}s)`);
    return true;
  }

  async incr(key: string): Promise<number | null> {
    console.debug(`[Redis Mock] INCR ${key}`);
    return 1;
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    console.debug(`[Redis Mock] EXPIRE ${key} ${seconds}s`);
    return true;
  }

  async ttl(key: string): Promise<number | null> {
    console.debug(`[Redis Mock] TTL ${key}`);
    return -1;
  }

  async del(key: string): Promise<boolean> {
    console.debug(`[Redis Mock] DEL ${key}`);
    return true;
  }

  async exists(key: string): Promise<boolean> {
    console.debug(`[Redis Mock] EXISTS ${key}`);
    return false;
  }

  async mget(keys: string[]): Promise<(string | null)[]> {
    console.debug(`[Redis Mock] MGET ${keys.join(', ')}`);
    return keys.map(() => null);
  }

  async info(): Promise<string | null> {
    console.debug('[Redis Mock] INFO');
    return 'redis_version:mock\r\nconnected_clients:1\r\n';
  }

  async ping(): Promise<boolean> {
    return this.isConnected;
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  get isReady(): boolean {
    return this.isConnected;
  }
}

// Singleton instance para browser
export const redisClient = new RedisClientBrowser();
export default redisClient;