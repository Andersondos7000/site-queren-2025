// Testes dos componentes Realtime
export * from './RealtimeProvider.test'
export * from './RealtimeStatus.test'
export * from './RealtimeSync.test'

// Utilitários de teste para componentes realtime
export const realtimeTestUtils = {
  // Mock padrão do Supabase para testes
  createMockSupabase: () => ({
    channel: jest.fn().mockReturnValue({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockResolvedValue({ error: null }),
      unsubscribe: jest.fn().mockResolvedValue({ error: null })
    }),
    removeAllChannels: jest.fn().mockResolvedValue({ error: null })
  }),

  // Mock padrão do useRealtime
  createMockUseRealtime: (overrides = {}) => ({
    isConnected: true,
    connectionStatus: 'connected' as const,
    syncCount: 5,
    lastSync: new Date('2024-01-15T10:30:00Z'),
    channels: new Map([['products', {}], ['orders', {}]]),
    forceSync: jest.fn(),
    getMetrics: jest.fn(() => ({
      totalSyncs: 10,
      errorCount: 2,
      averageSyncDuration: 150.5,
      uptime: 3600000
    })),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    ...overrides
  }),

  // Mock padrão do useRealtimeSync
  createMockUseRealtimeSync: (overrides = {}) => ({
    data: {
      products: [{ id: 1, name: 'Product 1' }],
      orders: [{ id: 1, status: 'pending' }],
      events: [{ id: 1, title: 'Event 1' }],
      cart: [{ id: 1, quantity: 2 }]
    },
    loading: false,
    error: null,
    lastSync: new Date('2024-01-15T10:30:00Z'),
    syncCount: 5,
    sync: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    ...overrides
  }),

  // Helper para renderizar com RealtimeProvider
  renderWithRealtimeProvider: (component: React.ReactElement, config = {}) => {
    const { render } = require('@testing-library/react')
    const { RealtimeProvider } = require('../../components/realtime/RealtimeProvider')
    const { createClient } = require('@supabase/supabase-js')
    
    const mockSupabase = realtimeTestUtils.createMockSupabase()
    ;(createClient as jest.MockedFunction<typeof createClient>).mockReturnValue(mockSupabase)

    return render(
      <RealtimeProvider
        config={{
          supabaseUrl: 'test-url',
          supabaseAnonKey: 'test-key',
          ...config
        }}
      >
        {component}
      </RealtimeProvider>
    )
  },

  // Helper para simular eventos realtime
  simulateRealtimeEvent: (callback: Function, event: any) => {
    callback(event)
  },

  // Helper para aguardar sincronização
  waitForSync: async (timeout = 1000) => {
    const { waitFor } = require('@testing-library/react')
    return waitFor(() => {}, { timeout })
  },

  // Helper para simular delay
  delay: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

  // Constantes de teste
  TEST_CONSTANTS: {
    DEFAULT_SUPABASE_URL: 'test-url',
    DEFAULT_SUPABASE_KEY: 'test-key',
    DEFAULT_SYNC_INTERVAL: 5000,
    DEFAULT_TIMEOUT: 1000
  }
}

// Tipos para testes
export interface MockRealtimeContext {
  isConnected: boolean
  connectionStatus: 'connected' | 'disconnected' | 'connecting' | 'error'
  syncCount: number
  lastSync: Date | null
  channels: Map<string, any>
  forceSync: jest.MockedFunction<() => Promise<void>>
  getMetrics: jest.MockedFunction<() => any>
  subscribe: jest.MockedFunction<(table: string) => Promise<void>>
  unsubscribe: jest.MockedFunction<(table: string) => Promise<void>>
}

export interface MockRealtimeSyncHook {
  data: Record<string, any[] | null>
  loading: boolean
  error: { message: string } | null
  lastSync: Date | null
  syncCount: number
  sync: jest.MockedFunction<(options?: any) => Promise<void>>
  subscribe: jest.MockedFunction<(table: string) => void>
  unsubscribe: jest.MockedFunction<(table: string) => void>
}

// Setup global para testes
export const setupRealtimeTests = () => {
  // Mock do Supabase
  jest.mock('@supabase/supabase-js', () => ({
    createClient: jest.fn()
  }))

  // Mock do performance.now para testes de timing
  const mockPerformanceNow = jest.spyOn(performance, 'now')
  let performanceCallCount = 0
  mockPerformanceNow.mockImplementation(() => {
    performanceCallCount++
    return performanceCallCount * 100
  })

  // Mock do localStorage
  const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn()
  }
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock
  })

  // Mock do console para suprimir logs em testes
  const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})

  return {
    mockPerformanceNow,
    localStorageMock,
    consoleSpy,
    consoleWarnSpy,
    cleanup: () => {
      mockPerformanceNow.mockRestore()
      consoleSpy.mockRestore()
      consoleWarnSpy.mockRestore()
      jest.clearAllMocks()
    }
  }
}

// Cleanup para testes
export const cleanupRealtimeTests = () => {
  jest.clearAllMocks()
  jest.restoreAllMocks()
}