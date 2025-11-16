/**
 * Sistema de Idempotência Global para Prevenir Chamadas Duplicadas
 * 
 * Protege contra:
 * - React StrictMode (desenvolvimento)
 * - Double-clicks do usuário
 * - Race conditions
 * - Múltiplas chamadas simultâneas
 */

interface PendingRequest {
  promise: Promise<any>;
  timestamp: number;
}

class IdempotencyManager {
  private pendingRequests = new Map<string, PendingRequest>();
  private readonly TIMEOUT_MS = 30000; // 30 segundos

  /**
   * Executa uma função com proteção de idempotência
   */
  async execute<T>(
    key: string,
    fn: () => Promise<T>,
    timeoutMs: number = this.TIMEOUT_MS
  ): Promise<T> {
    // Limpar requests expirados
    this.cleanupExpiredRequests();

    // Verificar se já existe uma requisição pendente
    const existing = this.pendingRequests.get(key);
    if (existing) {
      console.warn(`🔒 Idempotência: Reutilizando requisição existente para chave "${key}"`);
      return existing.promise;
    }

    // Criar nova requisição
    console.log(`🚀 Idempotência: Iniciando nova requisição para chave "${key}"`);
    const promise = fn().finally(() => {
      // Remover da lista quando completar
      this.pendingRequests.delete(key);
      console.log(`✅ Idempotência: Requisição completada para chave "${key}"`);
    });

    // Armazenar requisição pendente
    this.pendingRequests.set(key, {
      promise,
      timestamp: Date.now()
    });

    return promise;
  }

  /**
   * Gera chave de idempotência baseada nos dados
   */
  generateKey(data: any): string {
    const normalized = JSON.stringify(data, Object.keys(data).sort());
    return btoa(normalized).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
  }

  /**
   * Remove requisições expiradas
   */
  private cleanupExpiredRequests(): void {
    const now = Date.now();
    for (const [key, request] of this.pendingRequests.entries()) {
      if (now - request.timestamp > this.TIMEOUT_MS) {
        console.warn(`⏰ Idempotência: Removendo requisição expirada "${key}"`);
        this.pendingRequests.delete(key);
      }
    }
  }

  /**
   * Força limpeza de uma chave específica
   */
  clear(key: string): void {
    this.pendingRequests.delete(key);
    console.log(`🧹 Idempotência: Chave "${key}" removida manualmente`);
  }

  /**
   * Força limpeza de todas as requisições
   */
  clearAll(): void {
    this.pendingRequests.clear();
    console.log('🧹 Idempotência: Todas as requisições removidas');
  }

  /**
   * Status das requisições pendentes
   */
  getStatus(): { key: string; age: number }[] {
    const now = Date.now();
    return Array.from(this.pendingRequests.entries()).map(([key, request]) => ({
      key,
      age: now - request.timestamp
    }));
  }
}

// Instância singleton
export const idempotencyManager = new IdempotencyManager();

/**
 * Hook para usar idempotência em componentes React
 */
export function useIdempotency() {
  return {
    execute: idempotencyManager.execute.bind(idempotencyManager),
    generateKey: idempotencyManager.generateKey.bind(idempotencyManager),
    clear: idempotencyManager.clear.bind(idempotencyManager),
    getStatus: idempotencyManager.getStatus.bind(idempotencyManager)
  };
}

/**
 * Wrapper para chamadas de API com idempotência automática
 */
export async function idempotentApiCall<T>(
  endpoint: string,
  options: RequestInit,
  data?: any
): Promise<T> {
  const keyData = {
    endpoint,
    method: options.method || 'GET',
    body: options.body,
    data
  };
  
  const key = idempotencyManager.generateKey(keyData);
  
  return idempotencyManager.execute(key, async () => {
    const response = await fetch(endpoint, options);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }
    
    return response.json();
  });
}