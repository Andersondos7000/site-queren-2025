/**
 * Interceptor HTTP Seguro para Autenticação
 * Previne loops infinitos com lock, exponential backoff e rate limiting
 */

import { createClient } from '@supabase/supabase-js';

interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  jitter: boolean;
}

interface AuthState {
  isRefreshing: boolean;
  refreshPromise: Promise<any> | null;
  failedQueue: Array<{
    resolve: (token: string) => void;
    reject: (error: any) => void;
  }>;
  retryCount: number;
  lastRetryTime: number;
  rateLimitUntil: number;
}

class AuthInterceptor {
  private authState: AuthState = {
    isRefreshing: false,
    refreshPromise: null,
    failedQueue: [],
    retryCount: 0,
    lastRetryTime: 0,
    rateLimitUntil: 0
  };

  private retryConfig: RetryConfig = {
    maxRetries: 3,
    baseDelay: 1000, // 1 segundo
    maxDelay: 30000, // 30 segundos
    jitter: true
  };

  private supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY
  );

  /**
   * Calcula delay com exponential backoff + jitter
   */
  private calculateDelay(attempt: number): number {
    const exponentialDelay = Math.min(
      this.retryConfig.baseDelay * Math.pow(2, attempt),
      this.retryConfig.maxDelay
    );

    if (this.retryConfig.jitter) {
      // Adiciona jitter de ±25%
      const jitterRange = exponentialDelay * 0.25;
      const jitter = (Math.random() - 0.5) * 2 * jitterRange;
      return Math.max(100, exponentialDelay + jitter);
    }

    return exponentialDelay;
  }

  /**
   * Verifica se está em rate limit
   */
  private isRateLimited(): boolean {
    return Date.now() < this.authState.rateLimitUntil;
  }

  /**
   * Aplica rate limit progressivo
   */
  private applyRateLimit(): void {
    const now = Date.now();
    const timeSinceLastRetry = now - this.authState.lastRetryTime;
    
    // Se tentativas muito frequentes, aumenta o rate limit
    if (timeSinceLastRetry < 5000 && this.authState.retryCount > 2) {
      this.authState.rateLimitUntil = now + (this.authState.retryCount * 10000);
      console.warn(`[AuthInterceptor] Rate limit aplicado até ${new Date(this.authState.rateLimitUntil)}`);
    }
  }

  /**
   * Refresh token com lock para evitar múltiplas chamadas simultâneas
   */
  private async refreshTokenWithLock(): Promise<string> {
    // Se já está refreshing, retorna a promise existente
    if (this.authState.isRefreshing && this.authState.refreshPromise) {
      console.log('[AuthInterceptor] Aguardando refresh em andamento...');
      return this.authState.refreshPromise;
    }

    // Verifica rate limit
    if (this.isRateLimited()) {
      const waitTime = this.authState.rateLimitUntil - Date.now();
      throw new Error(`Rate limited. Aguarde ${Math.ceil(waitTime / 1000)}s`);
    }

    // Inicia novo refresh
    this.authState.isRefreshing = true;
    this.authState.lastRetryTime = Date.now();
    this.authState.retryCount++;

    this.authState.refreshPromise = this.performRefresh();

    try {
      const result = await this.authState.refreshPromise;
      
      // Sucesso - reset counters
      this.authState.retryCount = 0;
      this.authState.rateLimitUntil = 0;
      
      // Processa fila de requisições pendentes
      this.processFailedQueue(result);
      
      return result;
    } catch (error) {
      // Falha - aplica rate limit e rejeita fila
      this.applyRateLimit();
      this.processFailedQueue(null, error);
      throw error;
    } finally {
      // Limpa estado
      this.authState.isRefreshing = false;
      this.authState.refreshPromise = null;
    }
  }

  /**
   * Executa o refresh do token
   */
  private async performRefresh(): Promise<string> {
    console.log('[AuthInterceptor] Iniciando refresh do token...');
    
    const { data, error } = await this.supabase.auth.refreshSession();
    
    if (error || !data.session?.access_token) {
      console.error('[AuthInterceptor] Falha no refresh:', error?.message);
      
      // Se refresh token inválido, força logout
      if (error?.message?.includes('refresh_token_not_found') || 
          error?.message?.includes('invalid_refresh_token')) {
        console.warn('[AuthInterceptor] Refresh token inválido, forçando logout...');
        await this.supabase.auth.signOut();
        window.location.href = '/login';
      }
      
      throw new Error(`Refresh failed: ${error?.message || 'Unknown error'}`);
    }

    console.log('[AuthInterceptor] Token refreshed com sucesso');
    return data.session.access_token;
  }

  /**
   * Processa fila de requisições que falharam por token expirado
   */
  private processFailedQueue(token: string | null, error?: any): void {
    this.authState.failedQueue.forEach(({ resolve, reject }) => {
      if (token) {
        resolve(token);
      } else {
        reject(error || new Error('Token refresh failed'));
      }
    });
    
    this.authState.failedQueue = [];
  }

  /**
   * Adiciona requisição à fila de espera
   */
  private queueFailedRequest(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.authState.failedQueue.push({ resolve, reject });
    });
  }

  /**
   * Intercepta requisições HTTP para adicionar token e tratar 401
   */
  public async interceptRequest(
    url: string, 
    options: RequestInit = {}
  ): Promise<Response> {
    // Adiciona token atual se disponível
    const { data: { session } } = await this.supabase.auth.getSession();
    
    if (session?.access_token) {
      options.headers = {
        ...options.headers,
        'Authorization': `Bearer ${session.access_token}`
      };
    }

    // Executa requisição
    let response = await fetch(url, options);

    // Se 401, tenta refresh uma vez
    if (response.status === 401 && session) {
      console.log('[AuthInterceptor] 401 detectado, tentando refresh...');
      
      try {
        let newToken: string;
        
        if (this.authState.isRefreshing) {
          // Se já está refreshing, entra na fila
          newToken = await this.queueFailedRequest();
        } else {
          // Inicia novo refresh
          newToken = await this.refreshTokenWithLock();
        }

        // Retry da requisição com novo token
        const retryOptions = {
          ...options,
          headers: {
            ...options.headers,
            'Authorization': `Bearer ${newToken}`
          }
        };

        response = await fetch(url, retryOptions);
        console.log('[AuthInterceptor] Requisição refeita com sucesso');
        
      } catch (refreshError) {
        console.error('[AuthInterceptor] Falha no refresh, redirecionando para login:', refreshError);
        
        // Se refresh falhou definitivamente, redireciona para login
        if (!this.isRateLimited()) {
          await this.supabase.auth.signOut();
          window.location.href = '/login';
        }
        
        throw refreshError;
      }
    }

    return response;
  }

  /**
   * Wrapper para fetch com interceptação automática
   */
  public async fetch(url: string, options?: RequestInit): Promise<Response> {
    const maxRetries = this.retryConfig.maxRetries;
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.interceptRequest(url, options);
      } catch (error) {
        lastError = error as Error;
        
        // Se não é erro de rede/temporário, não retry
        if (!this.shouldRetry(error as Error, attempt)) {
          throw error;
        }

        // Se não é a última tentativa, aguarda delay
        if (attempt < maxRetries) {
          const delay = this.calculateDelay(attempt);
          console.log(`[AuthInterceptor] Tentativa ${attempt + 1} falhou, aguardando ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError!;
  }

  /**
   * Determina se deve fazer retry baseado no erro
   */
  private shouldRetry(error: Error, attempt: number): boolean {
    // Não retry se já excedeu tentativas
    if (attempt >= this.retryConfig.maxRetries) {
      return false;
    }

    // Não retry para erros de autenticação definitivos
    if (error.message.includes('invalid_credentials') ||
        error.message.includes('user_not_found') ||
        error.message.includes('invalid_refresh_token')) {
      return false;
    }

    // Retry para erros de rede/temporários
    return error.message.includes('fetch') ||
           error.message.includes('network') ||
           error.message.includes('timeout') ||
           error.message.includes('Rate limited');
  }

  /**
   * Reset manual do estado (para testes ou recovery)
   */
  public resetState(): void {
    this.authState = {
      isRefreshing: false,
      refreshPromise: null,
      failedQueue: [],
      retryCount: 0,
      lastRetryTime: 0,
      rateLimitUntil: 0
    };
    console.log('[AuthInterceptor] Estado resetado');
  }

  /**
   * Obtém métricas do interceptor
   */
  public getMetrics() {
    return {
      isRefreshing: this.authState.isRefreshing,
      retryCount: this.authState.retryCount,
      queueSize: this.authState.failedQueue.length,
      isRateLimited: this.isRateLimited(),
      rateLimitUntil: this.authState.rateLimitUntil
    };
  }
}

// Singleton instance
export const authInterceptor = new AuthInterceptor();

// Helper para uso direto
export const secureRequest = (url: string, options?: RequestInit) => 
  authInterceptor.fetch(url, options);