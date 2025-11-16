import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { RealtimeStatus } from '../../components/realtime/RealtimeStatus'
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
    uptime: 3600000 // 1 hora
  }))
}

jest.mock('../../components/realtime/RealtimeProvider', () => ({
  ...jest.requireActual('../../components/realtime/RealtimeProvider'),
  useRealtime: () => mockUseRealtime
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

describe('RealtimeStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseRealtime.forceSync.mockClear()
  })

  it('should render connection status correctly', () => {
    renderWithProvider(<RealtimeStatus />)

    expect(screen.getByText('Realtime Status')).toBeInTheDocument()
    expect(screen.getByText('Connected')).toBeInTheDocument()
    expect(screen.getByText('2 channels active')).toBeInTheDocument()
    expect(screen.getByText('5 syncs')).toBeInTheDocument()
  })

  it('should display last sync time correctly', () => {
    renderWithProvider(<RealtimeStatus />)

    // Verificar se a data está sendo exibida (formato pode variar)
    expect(screen.getByText(/Jan 15, 2024/)).toBeInTheDocument()
  })

  it('should show disconnected status', () => {
    mockUseRealtime.isConnected = false
    mockUseRealtime.connectionStatus = 'disconnected'

    renderWithProvider(<RealtimeStatus />)

    expect(screen.getByText('Disconnected')).toBeInTheDocument()
  })

  it('should show error status', () => {
    mockUseRealtime.isConnected = false
    mockUseRealtime.connectionStatus = 'error'

    renderWithProvider(<RealtimeStatus />)

    expect(screen.getByText('Error')).toBeInTheDocument()
  })

  it('should show connecting status', () => {
    mockUseRealtime.isConnected = false
    mockUseRealtime.connectionStatus = 'connecting'

    renderWithProvider(<RealtimeStatus />)

    expect(screen.getByText('Connecting')).toBeInTheDocument()
  })

  it('should expand to show detailed metrics', () => {
    renderWithProvider(<RealtimeStatus />)

    const expandButton = screen.getByRole('button')
    fireEvent.click(expandButton)

    expect(screen.getByText('Total Syncs: 10')).toBeInTheDocument()
    expect(screen.getByText('Errors: 2')).toBeInTheDocument()
    expect(screen.getByText('Avg Duration: 150.50ms')).toBeInTheDocument()
    expect(screen.getByText('Uptime: 1h 0m')).toBeInTheDocument()
  })

  it('should collapse detailed metrics', () => {
    renderWithProvider(<RealtimeStatus />)

    const expandButton = screen.getByRole('button')
    
    // Expandir
    fireEvent.click(expandButton)
    expect(screen.getByText('Total Syncs: 10')).toBeInTheDocument()
    
    // Colapsar
    fireEvent.click(expandButton)
    expect(screen.queryByText('Total Syncs: 10')).not.toBeInTheDocument()
  })

  it('should call forceSync when sync button is clicked', async () => {
    renderWithProvider(<RealtimeStatus />)

    const expandButton = screen.getByRole('button')
    fireEvent.click(expandButton)

    const syncButton = screen.getByText('Force Sync')
    fireEvent.click(syncButton)

    expect(mockUseRealtime.forceSync).toHaveBeenCalledTimes(1)
  })

  it('should show sync button as loading during sync', async () => {
    let resolveForceSyncPromise: () => void
    const forceSyncPromise = new Promise<void>((resolve) => {
      resolveForceSyncPromise = resolve
    })
    
    mockUseRealtime.forceSync.mockReturnValue(forceSyncPromise)

    renderWithProvider(<RealtimeStatus />)

    const expandButton = screen.getByRole('button')
    fireEvent.click(expandButton)

    const syncButton = screen.getByText('Force Sync')
    fireEvent.click(syncButton)

    expect(screen.getByText('Syncing...')).toBeInTheDocument()

    // Resolver a promise
    resolveForceSyncPromise!()
    await waitFor(() => {
      expect(screen.getByText('Force Sync')).toBeInTheDocument()
    })
  })

  it('should format uptime correctly for different durations', () => {
    // Testar diferentes durações
    const testCases = [
      { uptime: 30000, expected: '30s' }, // 30 segundos
      { uptime: 90000, expected: '1m 30s' }, // 1 minuto e 30 segundos
      { uptime: 3661000, expected: '1h 1m' }, // 1 hora e 1 minuto
      { uptime: 90061000, expected: '25h 1m' } // 25 horas e 1 minuto
    ]

    testCases.forEach(({ uptime, expected }) => {
      mockUseRealtime.getMetrics.mockReturnValue({
        totalSyncs: 10,
        errorCount: 2,
        averageSyncDuration: 150.5,
        uptime
      })

      const { unmount } = renderWithProvider(<RealtimeStatus />)

      const expandButton = screen.getByRole('button')
      fireEvent.click(expandButton)

      expect(screen.getByText(`Uptime: ${expected}`)).toBeInTheDocument()
      
      unmount()
    })
  })

  it('should handle zero channels', () => {
    mockUseRealtime.channels = new Map()

    renderWithProvider(<RealtimeStatus />)

    expect(screen.getByText('No active channels')).toBeInTheDocument()
  })

  it('should handle single channel', () => {
    mockUseRealtime.channels = new Map([['products', {}]])

    renderWithProvider(<RealtimeStatus />)

    expect(screen.getByText('1 channel active')).toBeInTheDocument()
  })

  it('should handle null lastSync', () => {
    mockUseRealtime.lastSync = null

    renderWithProvider(<RealtimeStatus />)

    expect(screen.getByText('Never synced')).toBeInTheDocument()
  })

  it('should show correct status colors', () => {
    const statusTests = [
      { status: 'connected', expectedClass: 'text-green-600' },
      { status: 'disconnected', expectedClass: 'text-gray-500' },
      { status: 'connecting', expectedClass: 'text-yellow-600' },
      { status: 'error', expectedClass: 'text-red-600' }
    ] as const

    statusTests.forEach(({ status, expectedClass }) => {
      mockUseRealtime.connectionStatus = status
      mockUseRealtime.isConnected = status === 'connected'

      const { unmount } = renderWithProvider(<RealtimeStatus />)

      const statusElement = screen.getByText(
        status.charAt(0).toUpperCase() + status.slice(1)
      )
      expect(statusElement).toHaveClass(expectedClass)
      
      unmount()
    })
  })

  it('should show correct status icons', () => {
    const iconTests = [
      { status: 'connected', expectedIcon: '🟢' },
      { status: 'disconnected', expectedIcon: '⚫' },
      { status: 'connecting', expectedIcon: '🟡' },
      { status: 'error', expectedIcon: '🔴' }
    ] as const

    iconTests.forEach(({ status, expectedIcon }) => {
      mockUseRealtime.connectionStatus = status
      mockUseRealtime.isConnected = status === 'connected'

      const { unmount } = renderWithProvider(<RealtimeStatus />)

      expect(screen.getByText(expectedIcon)).toBeInTheDocument()
      
      unmount()
    })
  })

  it('should handle zero sync count', () => {
    mockUseRealtime.syncCount = 0

    renderWithProvider(<RealtimeStatus />)

    expect(screen.getByText('0 syncs')).toBeInTheDocument()
  })

  it('should handle high sync count', () => {
    mockUseRealtime.syncCount = 1000

    renderWithProvider(<RealtimeStatus />)

    expect(screen.getByText('1000 syncs')).toBeInTheDocument()
  })

  it('should format average duration with correct precision', () => {
    const durationTests = [
      { duration: 0, expected: '0.00ms' },
      { duration: 1.234, expected: '1.23ms' },
      { duration: 100.999, expected: '101.00ms' },
      { duration: 1500.5, expected: '1500.50ms' }
    ]

    durationTests.forEach(({ duration, expected }) => {
      mockUseRealtime.getMetrics.mockReturnValue({
        totalSyncs: 10,
        errorCount: 2,
        averageSyncDuration: duration,
        uptime: 3600000
      })

      const { unmount } = renderWithProvider(<RealtimeStatus />)

      const expandButton = screen.getByRole('button')
      fireEvent.click(expandButton)

      expect(screen.getByText(`Avg Duration: ${expected}`)).toBeInTheDocument()
      
      unmount()
    })
  })

  it('should handle error count display', () => {
    mockUseRealtime.getMetrics.mockReturnValue({
      totalSyncs: 10,
      errorCount: 0,
      averageSyncDuration: 150.5,
      uptime: 3600000
    })

    renderWithProvider(<RealtimeStatus />)

    const expandButton = screen.getByRole('button')
    fireEvent.click(expandButton)

    expect(screen.getByText('Errors: 0')).toBeInTheDocument()
  })

  it('should be accessible', () => {
    renderWithProvider(<RealtimeStatus />)

    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(button)
    expect(button).toHaveAttribute('aria-expanded', 'true')
  })

  it('should handle keyboard navigation', () => {
    renderWithProvider(<RealtimeStatus />)

    const button = screen.getByRole('button')
    
    // Testar Enter
    fireEvent.keyDown(button, { key: 'Enter' })
    expect(button).toHaveAttribute('aria-expanded', 'true')
    
    // Testar Space
    fireEvent.keyDown(button, { key: ' ' })
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })
})