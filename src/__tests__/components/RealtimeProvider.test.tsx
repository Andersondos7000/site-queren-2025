import React from 'react'
import { render, screen, waitFor, act } from '@testing-library/react'
import { RealtimeProvider, useRealtime } from '../../components/realtime/RealtimeProvider'
import { createClient } from '@supabase/supabase-js'

// Mock do Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn()
}))

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>

// Componente de teste para usar o hook
const TestComponent: React.FC = () => {
  const {
    isConnected,
    connectionStatus,
    syncCount,
    lastSync,
    channels,
    subscribe,
    unsubscribe,
    forceSync,
    getMetrics
  } = useRealtime()

  const metrics = getMetrics()
  const handleData = jest.fn();

  return (
    <div>
      <div data-testid="connection-status">{connectionStatus}</div>
      <div data-testid="is-connected">{isConnected.toString()}</div>
      <div data-testid="sync-count">{syncCount}</div>
      <div data-testid="channels-count">{channels.size}</div>
      <div data-testid="total-syncs">{metrics.totalSyncs}</div>
      <div data-testid="error-count">{metrics.errorCount}</div>
      <div data-testid="avg-duration">{metrics.averageSyncDuration.toFixed(2)}</div>
      
      <button 
        data-testid="subscribe-btn" 
        onClick={() => subscribe('products', handleData)}
      >
        Subscribe
      </button>
      
      <button 
        data-testid="unsubscribe-btn" 
        onClick={() => unsubscribe('products')}
      >
        Unsubscribe
      </button>
      
      <button 
        data-testid="force-sync-btn" 
        onClick={() => forceSync()}
      >
        Force Sync
      </button>
    </div>
  )
}

describe('RealtimeProvider', () => {
  let mockSupabase: any
  let mockChannel: any

  beforeEach(() => {
    mockChannel = {
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockResolvedValue({ error: null }),
      unsubscribe: jest.fn().mockResolvedValue({ error: null })
    }

    mockSupabase = {
      channel: jest.fn().mockReturnValue(mockChannel),
      removeAllChannels: jest.fn().mockResolvedValue({ error: null })
    }

    mockCreateClient.mockReturnValue(mockSupabase)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should render children and provide context', () => {
    render(
      <RealtimeProvider
        config={{
          supabaseUrl: 'test-url',
          supabaseAnonKey: 'test-key'
        }}
      >
        <TestComponent />
      </RealtimeProvider>
    )

    expect(screen.getByTestId('connection-status')).toHaveTextContent('disconnected')
    expect(screen.getByTestId('is-connected')).toHaveTextContent('false')
    expect(screen.getByTestId('sync-count')).toHaveTextContent('0')
    expect(screen.getByTestId('channels-count')).toHaveTextContent('0')
  })

  it('should initialize Supabase client with correct config', () => {
    render(
      <RealtimeProvider
        config={{
          supabaseUrl: 'test-url',
          supabaseAnonKey: 'test-key'
        }}
      >
        <TestComponent />
      </RealtimeProvider>
    )

    expect(mockCreateClient).toHaveBeenCalledWith('test-url', 'test-key')
  })

  it('should subscribe to a channel', async () => {
    render(
      <RealtimeProvider
        config={{
          supabaseUrl: 'test-url',
          supabaseAnonKey: 'test-key'
        }}
      >
        <TestComponent />
      </RealtimeProvider>
    )

    const subscribeBtn = screen.getByTestId('subscribe-btn')
    
    await act(async () => {
      subscribeBtn.click()
    })

    expect(mockSupabase.channel).toHaveBeenCalledWith('products-changes')
    expect(mockChannel.on).toHaveBeenCalledWith(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'products' },
      expect.any(Function)
    )
    expect(mockChannel.subscribe).toHaveBeenCalled()
    
    await waitFor(() => {
      expect(screen.getByTestId('channels-count')).toHaveTextContent('1')
    })
  })

  it('should unsubscribe from a channel', async () => {
    render(
      <RealtimeProvider
        config={{
          supabaseUrl: 'test-url',
          supabaseAnonKey: 'test-key'
        }}
      >
        <TestComponent />
      </RealtimeProvider>
    )

    const subscribeBtn = screen.getByTestId('subscribe-btn')
    const unsubscribeBtn = screen.getByTestId('unsubscribe-btn')
    
    // Primeiro inscrever
    await act(async () => {
      subscribeBtn.click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('channels-count')).toHaveTextContent('1')
    })

    // Depois desinscrever
    await act(async () => {
      unsubscribeBtn.click()
    })

    expect(mockChannel.unsubscribe).toHaveBeenCalled()
    
    await waitFor(() => {
      expect(screen.getByTestId('channels-count')).toHaveTextContent('0')
    })
  })

  it('should handle force sync', async () => {
    render(
      <RealtimeProvider
        config={{
          supabaseUrl: 'test-url',
          supabaseAnonKey: 'test-key'
        }}
      >
        <TestComponent />
      </RealtimeProvider>
    )

    const forceSyncBtn = screen.getByTestId('force-sync-btn')
    
    await act(async () => {
      forceSyncBtn.click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('sync-count')).toHaveTextContent('1')
    })
  })

  it('should update connection status on successful subscription', async () => {
    render(
      <RealtimeProvider
        config={{
          supabaseUrl: 'test-url',
          supabaseAnonKey: 'test-key'
        }}
      >
        <TestComponent />
      </RealtimeProvider>
    )

    const subscribeBtn = screen.getByTestId('subscribe-btn')
    
    await act(async () => {
      subscribeBtn.click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('connection-status')).toHaveTextContent('connected')
      expect(screen.getByTestId('is-connected')).toHaveTextContent('true')
    })
  })

  it('should handle subscription errors', async () => {
    mockChannel.subscribe.mockResolvedValue({ error: { message: 'Subscription failed' } })

    render(
      <RealtimeProvider
        config={{
          supabaseUrl: 'test-url',
          supabaseAnonKey: 'test-key'
        }}
      >
        <TestComponent />
      </RealtimeProvider>
    )

    const subscribeBtn = screen.getByTestId('subscribe-btn')
    
    await act(async () => {
      subscribeBtn.click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('connection-status')).toHaveTextContent('error')
      expect(screen.getByTestId('error-count')).toHaveTextContent('1')
    })
  })

  it('should track sync metrics correctly', async () => {
    render(
      <RealtimeProvider
        config={{
          supabaseUrl: 'test-url',
          supabaseAnonKey: 'test-key'
        }}
      >
        <TestComponent />
      </RealtimeProvider>
    )

    const forceSyncBtn = screen.getByTestId('force-sync-btn')
    
    // Executar múltiplas sincronizações
    await act(async () => {
      forceSyncBtn.click()
    })
    
    await act(async () => {
      forceSyncBtn.click()
    })
    
    await act(async () => {
      forceSyncBtn.click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('total-syncs')).toHaveTextContent('3')
      expect(screen.getByTestId('sync-count')).toHaveTextContent('3')
    })
  })

  it('should handle realtime events correctly', async () => {
    let realtimeCallback: any
    
    mockChannel.on.mockImplementation((event, config, callback) => {
      realtimeCallback = callback
      return mockChannel
    })

    render(
      <RealtimeProvider
        config={{
          supabaseUrl: 'test-url',
          supabaseAnonKey: 'test-key'
        }}
      >
        <TestComponent />
      </RealtimeProvider>
    )

    const subscribeBtn = screen.getByTestId('subscribe-btn')
    
    await act(async () => {
      subscribeBtn.click()
    })

    // Simular evento realtime
    await act(async () => {
      realtimeCallback({
        eventType: 'INSERT',
        new: { id: 1, name: 'New Product' },
        old: null
      })
    })

    await waitFor(() => {
      expect(screen.getByTestId('sync-count')).toHaveTextContent('1')
    })
  })

  it('should cleanup channels on unmount', async () => {
    const { unmount } = render(
      <RealtimeProvider
        config={{
          supabaseUrl: 'test-url',
          supabaseAnonKey: 'test-key'
        }}
      >
        <TestComponent />
      </RealtimeProvider>
    )

    const subscribeBtn = screen.getByTestId('subscribe-btn')
    
    await act(async () => {
      subscribeBtn.click()
    })

    unmount()

    expect(mockSupabase.removeAllChannels).toHaveBeenCalled()
  })

  it('should render debug panel when enabled', () => {
    render(
      <RealtimeProvider
        config={{
          supabaseUrl: 'test-url',
          supabaseAnonKey: 'test-key'
        }}
        enableDebug={true}
      >
        <TestComponent />
      </RealtimeProvider>
    )

    expect(screen.getByText('Realtime Debug Panel')).toBeInTheDocument()
    expect(screen.getByText('Connection Status:')).toBeInTheDocument()
    expect(screen.getByText('Sync Metrics:')).toBeInTheDocument()
  })

  it('should not render debug panel when disabled', () => {
    render(
      <RealtimeProvider
        config={{
          supabaseUrl: 'test-url',
          supabaseAnonKey: 'test-key'
        }}
        enableDebug={false}
      >
        <TestComponent />
      </RealtimeProvider>
    )

    expect(screen.queryByText('Realtime Debug Panel')).not.toBeInTheDocument()
  })

  it('should handle multiple channel subscriptions', async () => {
    const TestMultipleChannels: React.FC = () => {
      const { subscribe, channels } = useRealtime()
      const handleData = jest.fn();

      return (
        <div>
          <div data-testid="channels-count">{channels.size}</div>
          <button 
            data-testid="subscribe-products" 
            onClick={() => subscribe('products', handleData)}
          >
            Subscribe Products
          </button>
          <button 
            data-testid="subscribe-orders" 
            onClick={() => subscribe('orders', handleData)}
          >
            Subscribe Orders
          </button>
        </div>
      )
    }

    render(
      <RealtimeProvider
        config={{
          supabaseUrl: 'test-url',
          supabaseAnonKey: 'test-key'
        }}
      >
        <TestMultipleChannels />
      </RealtimeProvider>
    )

    const subscribeProductsBtn = screen.getByTestId('subscribe-products')
    const subscribeOrdersBtn = screen.getByTestId('subscribe-orders')
    
    await act(async () => {
      subscribeProductsBtn.click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('channels-count')).toHaveTextContent('1')
    })

    await act(async () => {
      subscribeOrdersBtn.click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('channels-count')).toHaveTextContent('2')
    })

    expect(mockSupabase.channel).toHaveBeenCalledWith('products-changes')
    expect(mockSupabase.channel).toHaveBeenCalledWith('orders-changes')
  })

  it('should throw error when used outside provider', () => {
    // Suprimir console.error para este teste
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => {
      render(<TestComponent />)
    }).toThrow('useRealtime must be used within a RealtimeProvider')

    consoleSpy.mockRestore()
  })

  it('should calculate average sync duration correctly', async () => {
    // Mock performance.now para controlar timing
    const mockPerformanceNow = jest.spyOn(performance, 'now')
    let callCount = 0
    
    mockPerformanceNow.mockImplementation(() => {
      callCount++
      return callCount * 100 // Simular 100ms por sync
    })

    render(
      <RealtimeProvider
        config={{
          supabaseUrl: 'test-url',
          supabaseAnonKey: 'test-key'
        }}
      >
        <TestComponent />
      </RealtimeProvider>
    )

    const forceSyncBtn = screen.getByTestId('force-sync-btn')
    
    // Executar duas sincronizações
    await act(async () => {
      forceSyncBtn.click()
    })
    
    await act(async () => {
      forceSyncBtn.click()
    })

    await waitFor(() => {
      expect(screen.getByTestId('avg-duration')).toHaveTextContent('100.00')
    })

    mockPerformanceNow.mockRestore()
  })
})