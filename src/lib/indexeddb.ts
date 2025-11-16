/**
 * Sistema de cache IndexedDB para suporte offline-first
 * Implementa padrões de cache em camadas com TTL e compressão
 */

interface CacheItem<T = any> {
  key: string;
  data: T;
  timestamp: number;
  ttl?: number; // Time to live em milliseconds
  version: string;
  compressed?: boolean;
}

interface CacheConfig {
  dbName: string;
  version: number;
  stores: string[];
  defaultTTL?: number; // TTL padrão em milliseconds
  maxSize?: number; // Tamanho máximo do cache em MB
  enableCompression?: boolean;
}

class IndexedDBCache {
  private db: IDBDatabase | null = null;
  private config: Required<CacheConfig>;
  private initPromise: Promise<void> | null = null;

  constructor(config: CacheConfig) {
    this.config = {
      defaultTTL: 24 * 60 * 60 * 1000, // 24 horas
      maxSize: 50, // 50MB
      enableCompression: true,
      ...config
    };
  }

  /**
   * Inicializar conexão com IndexedDB
   */
  private async init(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.config.dbName, this.config.version);

      request.onerror = () => {
        reject(new Error(`Erro ao abrir IndexedDB: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Criar stores necessários
        this.config.stores.forEach(storeName => {
          if (!db.objectStoreNames.contains(storeName)) {
            const store = db.createObjectStore(storeName, { keyPath: 'key' });
            store.createIndex('timestamp', 'timestamp', { unique: false });
            store.createIndex('version', 'version', { unique: false });
          }
        });
      };
    });

    return this.initPromise;
  }

  /**
   * Comprimir dados usando algoritmo simples
   */
  private compress(data: any): string {
    if (!this.config.enableCompression) {
      return JSON.stringify(data);
    }
    
    try {
      const jsonString = JSON.stringify(data);
      // Implementação simples de compressão (pode ser melhorada com LZ-string)
      return btoa(jsonString);
    } catch (error) {
      console.warn('Erro na compressão, usando dados não comprimidos:', error);
      return JSON.stringify(data);
    }
  }

  /**
   * Descomprimir dados
   */
  private decompress(compressedData: string, isCompressed: boolean = false): any {
    try {
      if (!isCompressed || !this.config.enableCompression) {
        return JSON.parse(compressedData);
      }
      
      const decompressed = atob(compressedData);
      return JSON.parse(decompressed);
    } catch (error) {
      console.warn('Erro na descompressão:', error);
      return null;
    }
  }

  /**
   * Verificar se item está expirado
   */
  private isExpired(item: CacheItem): boolean {
    if (!item.ttl) return false;
    return Date.now() - item.timestamp > item.ttl;
  }

  /**
   * Obter transação para store
   */
  private getTransaction(storeName: string, mode: IDBTransactionMode = 'readonly'): IDBTransaction {
    if (!this.db) {
      throw new Error('IndexedDB não inicializado');
    }
    return this.db.transaction([storeName], mode);
  }

  /**
   * Armazenar item no cache
   */
  async set<T>(storeName: string, key: string, data: T, ttl?: number): Promise<void> {
    await this.init();
    
    const item: CacheItem<string> = {
      key,
      data: this.compress(data),
      timestamp: Date.now(),
      ttl: ttl || this.config.defaultTTL,
      version: this.config.version.toString(),
      compressed: this.config.enableCompression
    };

    return new Promise((resolve, reject) => {
      const transaction = this.getTransaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(item);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Erro ao armazenar item: ${request.error?.message}`));
    });
  }

  /**
   * Obter item do cache
   */
  async get<T>(storeName: string, key: string): Promise<T | null> {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.getTransaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => {
        const item = request.result as CacheItem<string> | undefined;
        
        if (!item) {
          resolve(null);
          return;
        }

        // Verificar se expirou
        if (this.isExpired(item)) {
          // Remover item expirado
          this.delete(storeName, key).catch(console.warn);
          resolve(null);
          return;
        }

        // Descomprimir e retornar dados
        const data = this.decompress(item.data, item.compressed);
        resolve(data);
      };

      request.onerror = () => reject(new Error(`Erro ao obter item: ${request.error?.message}`));
    });
  }

  /**
   * Verificar se item existe no cache
   */
  async has(storeName: string, key: string): Promise<boolean> {
    const item = await this.get(storeName, key);
    return item !== null;
  }

  /**
   * Remover item do cache
   */
  async delete(storeName: string, key: string): Promise<void> {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.getTransaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Erro ao remover item: ${request.error?.message}`));
    });
  }

  /**
   * Limpar store específico
   */
  async clear(storeName: string): Promise<void> {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.getTransaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Erro ao limpar store: ${request.error?.message}`));
    });
  }

  /**
   * Obter todas as chaves de um store
   */
  async keys(storeName: string): Promise<string[]> {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.getTransaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAllKeys();

      request.onsuccess = () => {
        resolve(request.result as string[]);
      };

      request.onerror = () => reject(new Error(`Erro ao obter chaves: ${request.error?.message}`));
    });
  }

  /**
   * Obter tamanho aproximado do cache em bytes
   */
  async getSize(storeName: string): Promise<number> {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.getTransaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        const items = request.result as CacheItem[];
        const totalSize = items.reduce((size, item) => {
          return size + JSON.stringify(item).length * 2; // Aproximação em bytes
        }, 0);
        resolve(totalSize);
      };

      request.onerror = () => reject(new Error(`Erro ao calcular tamanho: ${request.error?.message}`));
    });
  }

  /**
   * Limpar itens expirados
   */
  async cleanup(storeName: string): Promise<number> {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.getTransaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();
      let removedCount = 0;

      request.onsuccess = () => {
        const items = request.result as CacheItem[];
        const expiredItems = items.filter(item => this.isExpired(item));
        
        const deletePromises = expiredItems.map(item => {
          return new Promise<void>((resolveDelete) => {
            const deleteRequest = store.delete(item.key);
            deleteRequest.onsuccess = () => {
              removedCount++;
              resolveDelete();
            };
            deleteRequest.onerror = () => resolveDelete(); // Continuar mesmo com erro
          });
        });

        Promise.all(deletePromises).then(() => {
          resolve(removedCount);
        });
      };

      request.onerror = () => reject(new Error(`Erro na limpeza: ${request.error?.message}`));
    });
  }

  /**
   * Fechar conexão com IndexedDB
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initPromise = null;
    }
  }
}

// Instância singleton para cache de dados da aplicação
export const appCache = new IndexedDBCache({
  dbName: 'queren_app_cache',
  version: 1,
  stores: ['products', 'cart', 'orders', 'user_data', 'api_responses'],
  defaultTTL: 24 * 60 * 60 * 1000, // 24 horas
  maxSize: 50, // 50MB
  enableCompression: true
});

// Instância para cache de imagens e assets
export const assetCache = new IndexedDBCache({
  dbName: 'queren_asset_cache',
  version: 1,
  stores: ['images', 'documents', 'media'],
  defaultTTL: 7 * 24 * 60 * 60 * 1000, // 7 dias
  maxSize: 100, // 100MB
  enableCompression: false // Assets já são comprimidos
});

// Utilitários para cache de API
export class APICache {
  private cache: IndexedDBCache;
  
  constructor(cache: IndexedDBCache = appCache) {
    this.cache = cache;
  }

  /**
   * Gerar chave de cache para requisição
   */
  private getCacheKey(url: string, params?: Record<string, any>): string {
    const paramString = params ? JSON.stringify(params) : '';
    return `api_${btoa(url + paramString)}`;
  }

  /**
   * Armazenar resposta da API
   */
  async setResponse(url: string, data: any, params?: Record<string, any>, ttl?: number): Promise<void> {
    const key = this.getCacheKey(url, params);
    await this.cache.set('api_responses', key, {
      url,
      params,
      data,
      cachedAt: Date.now()
    }, ttl);
  }

  /**
   * Obter resposta da API do cache
   */
  async getResponse<T>(url: string, params?: Record<string, any>): Promise<T | null> {
    const key = this.getCacheKey(url, params);
    const cached = await this.cache.get<{
      url: string;
      params?: Record<string, any>;
      data: T;
      cachedAt: number;
    }>('api_responses', key);
    
    return cached ? cached.data : null;
  }

  /**
   * Invalidar cache de uma URL específica
   */
  async invalidate(url: string, params?: Record<string, any>): Promise<void> {
    const key = this.getCacheKey(url, params);
    await this.cache.delete('api_responses', key);
  }

  /**
   * Limpar todo o cache de API
   */
  async clearAll(): Promise<void> {
    await this.cache.clear('api_responses');
  }
}

export const apiCache = new APICache();

// Cleanup automático a cada hora
if (typeof window !== 'undefined') {
  setInterval(async () => {
    try {
      const removedApp = await appCache.cleanup('api_responses');
      const removedAssets = await assetCache.cleanup('images');
      
      if (removedApp > 0 || removedAssets > 0) {
        console.log(`Cache cleanup: removidos ${removedApp + removedAssets} itens expirados`);
      }
    } catch (error) {
      console.warn('Erro no cleanup automático do cache:', error);
    }
  }, 60 * 60 * 1000); // 1 hora
}