import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { RealtimeSync } from '../../components/realtime/RealtimeSync'
import { RealtimeProvider } from '../../components/realtime/RealtimeProvider'
import { createClient } from '@supabase/supabase-js'

// Mock do Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn()
}))

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>

// Mock do hook useRealtime
const mockUseRealtime = {
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
  }))
}

// Mock do hook useRealtimeSync
const mockUseRealtimeSync = {
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
  unsubscribe: jest.fn()
}

jest.mock('../../components/realtime/RealtimeProvider', () => ({
  ...jest.requireActual('../../components/realtime/RealtimeProvider'),
  useRealtime: () => mockUseRealtime
}))

jest.mock('../../hooks/realtime/useRealtimeSync', () => ({
  useRealtimeSync: () => mockUseRealtimeSync
}))

const renderWithProvider = (component: React.ReactElement) => {
  const mockSupabase = {
    channel: jest.fn().mockReturnValue({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockResolvedValue({ error: null }),
      unsubscribe: jest.fn().mockResolvedValue({ error: null })
    }),
    removeAllChannels: jest.fn().mockResolvedValue({ error: null })
  }

  mockCreateClient.mockReturnValue(mockSupabase)

  return render(
    <RealtimeProvider
      config={{
        supabaseUrl: 'test-url',
        supabaseAnonKey: 'test-key'
      }}
    >
      {component}
    </RealtimeProvider>
  )
}

describe('RealtimeSync', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseRealtime.forceSync.mockClear()
    mockUseRealtimeSync.sync.mockClear()
    
    // Reset mocks to default state
    mockUseRealtimeSync.loading = false
    mockUseRealtimeSync.error = null
    mockUseRealtime.isConnected = true
    mockUseRealtime.connectionStatus = 'connected'
  })

  it('should render sync interface correctly', () => {
    renderWithProvider(<RealtimeSync />)

    expect(screen.getByText('Realtime Sync')).toBeInTheDocument()
    expect(screen.getByText('Auto Sync')).toBeInTheDocument()
    expect(screen.getByText('Sync All')).toBeInTheDocument()
    expect(screen.getByText('Last sync:')).toBeInTheDocument()
  })

  it('should show sync statistics', () => {
    renderWithProvider(<RealtimeSync />)

    expect(screen.getByText('Total: 10')).toBeInTheDocument()
    expect(screen.getByText('Errors: 2')).toBeInTheDocument()
    expect(screen.getByText('Avg: 150.50ms')).toBeInTheDocument()
    expect(screen.getByText('Uptime: 1h 0m')).toBeInTheDocument()
  })

  it('should show table sync progress', () => {
    renderWithProvider(<RealtimeSync />)

    expect(screen.getByText('products')).toBeInTheDocument()
    expect(screen.getByText('orders')).toBeInTheDocument()
    expect(screen.getByText('events')).toBeInTheDocument()
    expect(screen.getByText('cart')).toBeInTheDocument()
    
    // Verificar status de sincronização
    expect(screen.getAllByText('✅ Synced')).toHaveLength(4)
  })

  it('should handle auto sync toggle', () => {
    renderWithProvider(<RealtimeSync />)

    const autoSyncToggle = screen.getByRole('checkbox')
    expect(autoSyncToggle).toBeChecked() // Default é true

    fireEvent.click(autoSyncToggle)
    expect(autoSyncToggle).not.toBeChecked()

    fireEvent.click(autoSyncToggle)
    expect(autoSyncToggle).toBeChecked()
  })

  it('should call sync when Sync All button is clicked', async () => {
    renderWithProvider(<RealtimeSync />)

    const syncButton = screen.getByText('Sync All')
    fireEvent.click(syncButton)

    expect(mockUseRealtimeSync.sync).toHaveBeenCalledWith({
      tables: ['products', 'orders', 'events', 'cart']
    })
  })

  it('should show loading state during sync', () => {
    mockUseRealtimeSync.loading = true

    renderWithProvider(<RealtimeSync />)

    expect(screen.getByText('Syncing...')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /syncing/i })).toBeDisabled()
  })

  it('should show error state', () => {
    mockUseRealtimeSync.error = { message: 'Sync failed' }

    renderWithProvider(<RealtimeSync />)

    expect(screen.getByText('Error: Sync failed')).toBeInTheDocument()
  })

  it('should show disconnected state', () => {
    mockUseRealtime.isConnected = false
    mockUseRealtime.connectionStatus = 'disconnected'

    renderWithProvider(<RealtimeSync />)

    expect(screen.getByText('⚫ Disconnected')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sync all/i })).toBeDisabled()
  })

  it('should show connecting state', () => {
    mockUseRealtime.isConnected = false
    mockUseRealtime.connectionStatus = 'connecting'

    renderWithProvider(<RealtimeSync />)

    expect(screen.getByText('🟡 Connecting')).toBeInTheDocument()
  })

  it('should show error connection state', () => {
    mockUseRealtime.isConnected = false
    mockUseRealtime.connectionStatus = 'error'

    renderWithProvider(<RealtimeSync />)

    expect(screen.getByText('🔴 Error')).toBeInTheDocument()
  })

  it('should sync individual tables', async () => {
    renderWithProvider(<RealtimeSync />)

    const productsSyncButton = screen.getAllByText('Sync')[0]
    fireEvent.click(productsSyncButton)

    expect(mockUseRealtimeSync.sync).toHaveBeenCalledWith({
      tables: ['products']
    })
  })

  it('should show table loading states', () => {
    mockUseRealtimeSync.loading = true

    renderWithProvider(<RealtimeSync />)

    // Todos os botões de sync individual devem estar desabilitados
    const syncButtons = screen.getAllByText('Sync')
    syncButtons.forEach(button => {
      expect(button).toBeDisabled()
    })
  })

  it('should show table error states', () => {
    mockUseRealtimeSync.data = {
      products: null, // Erro na sincronização
      orders: [{ id: 1, status: 'pending' }],
      events: [{ id: 1, title: 'Event 1' }],
      cart: [{ id: 1, quantity: 2 }]
    }

    renderWithProvider(<RealtimeSync />)

    expect(screen.getByText('❌ Error')).toBeInTheDocument()
    expect(screen.getAllByText('✅ Synced')).toHaveLength(3)
  })

  it('should show never synced state', () => {
    mockUseRealtimeSync.lastSync = null

    renderWithProvider(<RealtimeSync />)

    expect(screen.getByText('Never synced')).toBeInTheDocument()
  })

  it('should format last sync time correctly', () => {
    renderWithProvider(<RealtimeSync />)

    expect(screen.getByText(/Jan 15, 2024/)).toBeInTheDocument()
  })

  it('should handle auto sync when enabled', async () => {
    jest.useFakeTimers()
    
    renderWithProvider(<RealtimeSync autoSyncInterval={5000} />)

    // Avançar o timer
    jest.advanceTimersByTime(5000)

    await waitFor(() => {
      expect(mockUseRealtimeSync.sync).toHaveBeenCalled()
    })

    jest.useRealTimers()
  })

  it('should not auto sync when disabled', async () => {
    jest.useFakeTimers()
    
    renderWithProvider(<RealtimeSync autoSyncInterval={5000} />)

    // Desabilitar auto sync
    const autoSyncToggle = screen.getByRole('checkbox')
    fireEvent.click(autoSyncToggle)

    // Avançar o timer
    jest.advanceTimersByTime(5000)

    expect(mockUseRealtimeSync.sync).not.toHaveBeenCalled()

    jest.useRealTimers()
  })

  it('should clear auto sync interval on unmount', () => {
    jest.useFakeTimers()
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval')
    
    const { unmount } = renderWithProvider(<RealtimeSync autoSyncInterval={5000} />)
    
    unmount()
    
    expect(clearIntervalSpy).toHaveBeenCalled()
    
    clearIntervalSpy.mockRestore()
    jest.useRealTimers()
  })

  it('should show custom tables when provided', () => {
    const customTables = ['users', 'settings']
    
    renderWithProvider(<RealtimeSync tables={customTables} />)

    expect(screen.getByText('users')).toBeInTheDocument()
    expect(screen.getByText('settings')).toBeInTheDocument()
    expect(screen.queryByText('products')).not.toBeInTheDocument()
  })

  it('should handle empty data gracefully', () => {
    mockUseRealtimeSync.data = {
      products: [],
      orders: [],
      events: [],
      cart: []
    }

    renderWithProvider(<RealtimeSync />)

    expect(screen.getAllByText('✅ Synced')).toHaveLength(4)
  })

  it('should show sync count correctly', () => {
    mockUseRealtimeSync.syncCount = 0

    renderWithProvider(<RealtimeSync />)

    expect(screen.getByText('Total: 10')).toBeInTheDocument() // Do metrics
  })

  it('should format uptime correctly', () => {
    const uptimeTests = [
      { uptime: 30000, expected: '30s' },
      { uptime: 90000, expected: '1m 30s' },
      { uptime: 3661000, expected: '1h 1m' },
      { uptime: 90061000, expected: '25h 1m' }
    ]

    uptimeTests.forEach(({ uptime, expected }) => {
      mockUseRealtime.getMetrics.mockReturnValue({
        totalSyncs: 10,
        errorCount: 2,
        averageSyncDuration: 150.5,
        uptime
      })

      const { unmount } = renderWithProvider(<RealtimeSync />)

      expect(screen.getByText(`Uptime: ${expected}`)).toBeInTheDocument()
      
      unmount()
    })
  })

  it('should be accessible', () => {
    renderWithProvider(<RealtimeSync />)

    const autoSyncToggle = screen.getByRole('checkbox')
    expect(autoSyncToggle).toHaveAccessibleName('Auto Sync')

    const syncButton = screen.getByRole('button', { name: /sync all/i })
    expect(syncButton).toBeInTheDocument()

    const individualSyncButtons = screen.getAllByRole('button', { name: /sync/i })
    expect(individualSyncButtons.length).toBeGreaterThan(1)
  })

  it('should handle keyboard navigation', () => {
    renderWithProvider(<RealtimeSync />)

    const syncButton = screen.getByRole('button', { name: /sync all/i })
    
    fireEvent.keyDown(syncButton, { key: 'Enter' })
    expect(mockUseRealtimeSync.sync).toHaveBeenCalled()
  })

  it('should show progress indicators during sync', () => {
    mockUseRealtimeSync.loading = true

    renderWithProvider(<RealtimeSync />)

    // Verificar se há indicadores de progresso
    expect(screen.getByText('Syncing...')).toBeInTheDocument()
    
    // Verificar se os status das tabelas mostram loading
    const loadingIndicators = screen.getAllByText('⏳ Syncing')
    expect(loadingIndicators.length).toBeGreaterThan(0)
  })

  it('should handle sync completion', async () => {
    let resolveSyncPromise: () => void
    const syncPromise = new Promise<void>((resolve) => {
      resolveSyncPromise = resolve
    })
    
    mockUseRealtimeSync.sync.mockReturnValue(syncPromise)
    mockUseRealtimeSync.loading = true

    renderWithProvider(<RealtimeSync />)

    const syncButton = screen.getByText('Syncing...')
    expect(syncButton).toBeDisabled()

    // Simular conclusão da sincronização
    mockUseRealtimeSync.loading = false
    resolveSyncPromise!()

    await waitFor(() => {
      expect(screen.getByText('Sync All')).not.toBeDisabled()
    })
  })

  it('should show retry button on error', () => {
    mockUseRealtimeSync.error = { message: 'Network error' }

    renderWithProvider(<RealtimeSync />)

    expect(screen.getByText('Retry')).toBeInTheDocument()
  })

  it('should retry sync when retry button is clicked', () => {
    mockUseRealtimeSync.error = { message: 'Network error' }

    renderWithProvider(<RealtimeSync />)

    const retryButton = screen.getByText('Retry')
    fireEvent.click(retryButton)

    expect(mockUseRealtimeSync.sync).toHaveBeenCalled()
  })
})