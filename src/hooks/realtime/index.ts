// Hooks de sincronização em tempo real
// Implementação da Ponte de Tempo Real conforme PRD

// Hook base para sincronização
export { useRealtimeSync, useConnectionStatus } from './useRealtimeSync';

// Hooks específicos por domínio
export { 
  useRealtimeCart, 
  useCartSync 
} from './useRealtimeCart';

export { 
  useRealtimeProducts, 
  useRealtimeCategories 
} from './useRealtimeProducts';

export { 
  useRealtimeStock 
} from './useRealtimeStock';

export { 
  useRealtimeOrders, 
  useOrdersDashboard, 
  useOrderTracking 
} from './useRealtimeOrders';

export { 
  useRealtimeEvents, 
  useRealtimeTickets, 
  useEventsDashboard 
} from './useRealtimeEvents';

// Tipos compartilhados
export type {
  RealtimeSyncOptions,
  RealtimeSyncReturn,
  ConnectionStatus
} from './useRealtimeSync';

// Re-exportar tipos específicos se necessário
export type {
  // Tipos do carrinho
  CartItem,
  CartSummary,
  UseRealtimeCartReturn
} from './useRealtimeCart';

export type {
  // Tipos de produtos
  Product,
  ProductSize,
  Category,
  ProductFilters,
  UseRealtimeProductsReturn
} from './useRealtimeProducts';

export type {
  // Tipos específicos de estoque
  ProductStock,
  StockAlert,
  StockMetrics
} from './useRealtimeStock';

export type {
  // Tipos de pedidos
  Order,
  OrderItem,
  OrderStatus,
  OrderFilters,
  UseRealtimeOrdersReturn
} from './useRealtimeOrders';

export type {
  // Tipos de eventos
  Event,
  Ticket,
  EventFilters,
  UseRealtimeEventsReturn
} from './useRealtimeEvents';

// Utilitários e helpers
export const RealtimeUtils = {
  /**
   * Verifica se uma conexão está saudável
   */
  isConnectionHealthy: (status: ConnectionStatus): boolean => {
    return status === 'connected';
  },

  /**
   * Formata erro de conexão para exibição
   */
  formatConnectionError: (error: Error | null): string => {
    if (!error) return '';
    
    if (error.message.includes('network')) {
      return 'Problema de conexão com a internet';
    }
    
    if (error.message.includes('unauthorized')) {
      return 'Sessão expirada. Faça login novamente';
    }
    
    return 'Erro de sincronização. Tentando reconectar...';
  },

  /**
   * Calcula delay para retry baseado no número de tentativas
   */
  calculateRetryDelay: (attempt: number): number => {
    return Math.min(1000 * Math.pow(2, attempt), 30000); // Max 30s
  },

  /**
   * Valida se dados estão sincronizados recentemente
   */
  isDataFresh: (lastUpdate: string, maxAgeMinutes: number = 5): boolean => {
    const lastUpdateTime = new Date(lastUpdate).getTime();
    const now = new Date().getTime();
    const maxAge = maxAgeMinutes * 60 * 1000;
    
    return (now - lastUpdateTime) < maxAge;
  }
};

// Configurações padrão
export const RealtimeConfig = {
  // Configurações de reconexão
  reconnect: {
    maxRetries: 5,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2
  },
  
  // Configurações de heartbeat
  heartbeat: {
    interval: 30000, // 30s
    timeout: 10000   // 10s
  },
  
  // Configurações de cache
  cache: {
    maxAge: 300000,  // 5 minutos
    maxSize: 1000    // máximo de itens
  },
  
  // Configurações de optimistic updates
  optimistic: {
    timeout: 5000,   // 5s para reverter se não confirmado
    maxPending: 10   // máximo de updates pendentes
  }
};

// Hook composto para sincronização completa da aplicação
export function useRealtimeApp() {
  const connectionStatus = useConnectionStatus();
  
  // Hooks principais sempre ativos
  const cart = useRealtimeCart();
  const products = useRealtimeProducts({ isActive: true });
  const categories = useRealtimeCategories();
  
  // Status geral da sincronização
  const isFullySynced = connectionStatus.isConnected && 
                       !cart.loading && 
                       !products.loading && 
                       !categories.loading;
  
  const hasErrors = !!(cart.error || products.error || categories.error);
  
  return {
    // Status geral
    isFullySynced,
    hasErrors,
    connectionStatus,
    
    // Hooks específicos
    cart,
    products,
    categories,
    
    // Ações globais
    refetchAll: () => {
      cart.refetch();
      products.refetch();
      categories.refetch();
    }
  };
}

// Hook para monitoramento de performance
export function useRealtimePerformance() {
  const connectionStatus = useConnectionStatus();
  
  // Métricas de performance
  const metrics = {
    connectionLatency: connectionStatus.lastPing || 0,
    isOptimal: connectionStatus.isConnected && (connectionStatus.lastPing || 0) < 100,
    connectionQuality: (() => {
      const latency = connectionStatus.lastPing || Infinity;
      if (latency < 50) return 'excellent';
      if (latency < 100) return 'good';
      if (latency < 200) return 'fair';
      return 'poor';
    })()
  };
  
  return {
    metrics,
    connectionStatus
  };
}

// Constantes para debugging
export const DEBUG = {
  ENABLE_LOGS: process.env.NODE_ENV === 'development',
  LOG_LEVELS: {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
  }
};

// Logger para debugging
export const RealtimeLogger = {
  error: (message: string, data?: any) => {
    if (DEBUG.ENABLE_LOGS) {
      console.error(`[Realtime Error] ${message}`, data);
    }
  },
  
  warn: (message: string, data?: any) => {
    if (DEBUG.ENABLE_LOGS) {
      console.warn(`[Realtime Warn] ${message}`, data);
    }
  },
  
  info: (message: string, data?: any) => {
    if (DEBUG.ENABLE_LOGS) {
      console.info(`[Realtime Info] ${message}`, data);
    }
  },
  
  debug: (message: string, data?: any) => {
    if (DEBUG.ENABLE_LOGS) {
      console.debug(`[Realtime Debug] ${message}`, data);
    }
  }
};