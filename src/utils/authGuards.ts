/**
 * Sistema de Guards para Autenticação
 * Previne reentrância e loops infinitos em hooks e operações de auth
 */

interface AuthGuardState {
  isAuthenticating: boolean;
  isValidating: boolean;
  isRefreshing: boolean;
  isSigningOut: boolean;
  operationStartTime: number;
  operationTimeoutMs: number;
  maxConcurrentOperations: number;
  activeOperations: Set<string>;
}

interface AuthOperation {
  id: string;
  type: 'login' | 'logout' | 'refresh' | 'validate' | 'signup';
  startTime: number;
  timeout?: number;
}

class AuthGuards {
  private state: AuthGuardState = {
    isAuthenticating: false,
    isValidating: false,
    isRefreshing: false,
    isSigningOut: false,
    operationStartTime: 0,
    operationTimeoutMs: 30000, // 30 segundos timeout padrão
    maxConcurrentOperations: 3,
    activeOperations: new Set()
  };

  private operations: Map<string, AuthOperation> = new Map();
  private listeners: Set<(state: AuthGuardState) => void> = new Set();

  /**
   * Gera ID único para operação
   */
  private generateOperationId(): string {
    return `auth_op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Verifica se operação pode ser executada
   */
  private canExecuteOperation(type: AuthOperation['type']): boolean {
    // Verifica limite de operações concorrentes
    if (this.state.activeOperations.size >= this.state.maxConcurrentOperations) {
      console.warn(`[AuthGuards] Limite de operações concorrentes atingido: ${this.state.activeOperations.size}`);
      return false;
    }

    // Regras específicas por tipo
    switch (type) {
      case 'login':
        return !this.state.isAuthenticating && !this.state.isSigningOut;
      
      case 'logout':
        return !this.state.isSigningOut;
      
      case 'refresh':
        return !this.state.isRefreshing && !this.state.isSigningOut;
      
      case 'validate':
        return !this.state.isValidating && !this.state.isSigningOut;
      
      case 'signup':
        return !this.state.isAuthenticating && !this.state.isSigningOut;
      
      default:
        return true;
    }
  }

  /**
   * Inicia uma operação com guard
   */
  public async startOperation<T>(
    type: AuthOperation['type'],
    operation: () => Promise<T>,
    timeout?: number
  ): Promise<T> {
    const operationId = this.generateOperationId();
    
    // Verifica se pode executar
    if (!this.canExecuteOperation(type)) {
      throw new Error(`[AuthGuards] Operação ${type} bloqueada - ${this.getBlockReason(type)}`);
    }

    // Registra operação
    const authOperation: AuthOperation = {
      id: operationId,
      type,
      startTime: Date.now(),
      timeout: timeout || this.state.operationTimeoutMs
    };

    this.operations.set(operationId, authOperation);
    this.state.activeOperations.add(operationId);
    
    // Atualiza flags específicos
    this.updateStateFlags(type, true);
    this.notifyListeners();

    console.log(`[AuthGuards] Iniciando operação ${type} (${operationId})`);

    try {
      // Executa com timeout
      const result = await Promise.race([
        operation(),
        this.createTimeoutPromise(authOperation.timeout!)
      ]);

      console.log(`[AuthGuards] Operação ${type} concluída com sucesso (${operationId})`);
      return result;

    } catch (error) {
      console.error(`[AuthGuards] Operação ${type} falhou (${operationId}):`, error);
      throw error;

    } finally {
      // Limpa operação
      this.operations.delete(operationId);
      this.state.activeOperations.delete(operationId);
      this.updateStateFlags(type, false);
      this.notifyListeners();
    }
  }

  /**
   * Cria promise de timeout
   */
  private createTimeoutPromise<T>(timeoutMs: number): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`[AuthGuards] Operação timeout após ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }

  /**
   * Atualiza flags de estado específicos
   */
  private updateStateFlags(type: AuthOperation['type'], isActive: boolean): void {
    switch (type) {
      case 'login':
      case 'signup':
        this.state.isAuthenticating = isActive;
        break;
      case 'logout':
        this.state.isSigningOut = isActive;
        break;
      case 'refresh':
        this.state.isRefreshing = isActive;
        break;
      case 'validate':
        this.state.isValidating = isActive;
        break;
    }

    if (isActive) {
      this.state.operationStartTime = Date.now();
    }
  }

  /**
   * Obtém razão do bloqueio
   */
  private getBlockReason(type: AuthOperation['type']): string {
    const reasons = [];

    if (this.state.activeOperations.size >= this.state.maxConcurrentOperations) {
      reasons.push(`limite de operações (${this.state.maxConcurrentOperations})`);
    }

    switch (type) {
      case 'login':
        if (this.state.isAuthenticating) reasons.push('já autenticando');
        if (this.state.isSigningOut) reasons.push('fazendo logout');
        break;
      case 'logout':
        if (this.state.isSigningOut) reasons.push('já fazendo logout');
        break;
      case 'refresh':
        if (this.state.isRefreshing) reasons.push('já refreshing');
        if (this.state.isSigningOut) reasons.push('fazendo logout');
        break;
      case 'validate':
        if (this.state.isValidating) reasons.push('já validando');
        if (this.state.isSigningOut) reasons.push('fazendo logout');
        break;
    }

    return reasons.join(', ') || 'motivo desconhecido';
  }

  /**
   * Verifica se operação específica está ativa
   */
  public isOperationActive(type: AuthOperation['type']): boolean {
    switch (type) {
      case 'login':
      case 'signup':
        return this.state.isAuthenticating;
      case 'logout':
        return this.state.isSigningOut;
      case 'refresh':
        return this.state.isRefreshing;
      case 'validate':
        return this.state.isValidating;
      default:
        return false;
    }
  }

  /**
   * Verifica se alguma operação está ativa
   */
  public hasActiveOperations(): boolean {
    return this.state.activeOperations.size > 0;
  }

  /**
   * Força cancelamento de operações antigas
   */
  public cancelStaleOperations(maxAgeMs: number = 60000): number {
    const now = Date.now();
    let canceledCount = 0;

    for (const [id, operation] of this.operations.entries()) {
      if (now - operation.startTime > maxAgeMs) {
        console.warn(`[AuthGuards] Cancelando operação stale: ${operation.type} (${id})`);
        this.operations.delete(id);
        this.state.activeOperations.delete(id);
        canceledCount++;
      }
    }

    if (canceledCount > 0) {
      // Reset flags se não há operações ativas
      if (this.state.activeOperations.size === 0) {
        this.resetAllFlags();
      }
      this.notifyListeners();
    }

    return canceledCount;
  }

  /**
   * Reset completo do estado
   */
  public resetState(): void {
    console.log('[AuthGuards] Resetando estado completo');
    
    this.operations.clear();
    this.state.activeOperations.clear();
    this.resetAllFlags();
    this.notifyListeners();
  }

  /**
   * Reset apenas flags booleanos
   */
  private resetAllFlags(): void {
    this.state.isAuthenticating = false;
    this.state.isValidating = false;
    this.state.isRefreshing = false;
    this.state.isSigningOut = false;
    this.state.operationStartTime = 0;
  }

  /**
   * Adiciona listener para mudanças de estado
   */
  public addStateListener(listener: (state: AuthGuardState) => void): () => void {
    this.listeners.add(listener);
    
    // Retorna função para remover listener
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notifica listeners sobre mudanças
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener({ ...this.state });
      } catch (error) {
        console.error('[AuthGuards] Erro ao notificar listener:', error);
      }
    });
  }

  /**
   * Obtém estado atual
   */
  public getState(): Readonly<AuthGuardState> {
    return { ...this.state };
  }

  /**
   * Obtém operações ativas
   */
  public getActiveOperations(): AuthOperation[] {
    return Array.from(this.operations.values());
  }

  /**
   * Configura timeout padrão
   */
  public setDefaultTimeout(timeoutMs: number): void {
    this.state.operationTimeoutMs = timeoutMs;
  }

  /**
   * Configura limite de operações concorrentes
   */
  public setMaxConcurrentOperations(max: number): void {
    this.state.maxConcurrentOperations = Math.max(1, max);
  }
}

// Singleton instance
export const authGuards = new AuthGuards();

// Hooks helpers para React
export const useAuthGuards = () => {
  const [state, setState] = React.useState(authGuards.getState());

  React.useEffect(() => {
    const unsubscribe = authGuards.addStateListener(setState);
    return unsubscribe;
  }, []);

  return {
    state,
    startOperation: authGuards.startOperation.bind(authGuards),
    isOperationActive: authGuards.isOperationActive.bind(authGuards),
    hasActiveOperations: authGuards.hasActiveOperations.bind(authGuards),
    resetState: authGuards.resetState.bind(authGuards)
  };
};

// Decorators para métodos
export function withAuthGuard(type: AuthOperation['type'], timeout?: number) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return authGuards.startOperation(
        type,
        () => originalMethod.apply(this, args),
        timeout
      );
    };

    return descriptor;
  };
}

// Utilitários
export const AuthGuardUtils = {
  /**
   * Wrapper para operações de login
   */
  login: <T>(operation: () => Promise<T>, timeout?: number) =>
    authGuards.startOperation('login', operation, timeout),

  /**
   * Wrapper para operações de logout
   */
  logout: <T>(operation: () => Promise<T>, timeout?: number) =>
    authGuards.startOperation('logout', operation, timeout),

  /**
   * Wrapper para operações de refresh
   */
  refresh: <T>(operation: () => Promise<T>, timeout?: number) =>
    authGuards.startOperation('refresh', operation, timeout),

  /**
   * Wrapper para operações de validação
   */
  validate: <T>(operation: () => Promise<T>, timeout?: number) =>
    authGuards.startOperation('validate', operation, timeout),

  /**
   * Verifica se é seguro executar operação
   */
  canExecute: (type: AuthOperation['type']) =>
    !authGuards.isOperationActive(type),

  /**
   * Aguarda até operação específica terminar
   */
  waitForOperation: async (type: AuthOperation['type'], maxWaitMs: number = 10000) => {
    const startTime = Date.now();
    
    while (authGuards.isOperationActive(type)) {
      if (Date.now() - startTime > maxWaitMs) {
        throw new Error(`[AuthGuards] Timeout aguardando operação ${type}`);
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
};

// Auto-cleanup de operações stale a cada minuto
setInterval(() => {
  const canceled = authGuards.cancelStaleOperations();
  if (canceled > 0) {
    console.log(`[AuthGuards] Auto-cleanup: ${canceled} operações canceladas`);
  }
}, 60000);