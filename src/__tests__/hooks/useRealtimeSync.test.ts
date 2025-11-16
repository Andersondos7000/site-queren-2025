import { renderHook, act, waitFor } from '@testing-library/react'
import { useRealtimeSync, useConnectionStatus } from '../../hooks/realtime/useRealtimeSync'
import { createClient } from '@supabase/supabase-js'

// Mock do Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn()
}))

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>

describe('useRealtimeSync', () => {
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
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue({
          data: [
            { id: 1, name: 'Test Product 1' },
            { id: 2, name: 'Test Product 2' }
          ],
          error: null
        })
      })
    }

    mockCreateClient.mockReturnValue(mockSupabase)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('useRealtimeSync', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => 
        useRealtimeSync('products', {
          supabaseUrl: 'test-url',
          supabaseAnonKey: 'test-key'
        })
      )

      expect(result.current.data).toEqual([])
      expect(result.current.loading).toBe(true)
      expect(result.current.error).toBeNull()
      expect(result.current.isSubscribed).toBe(false)
    })

    it('should fetch initial data on mount', async () => {
      const { result } = renderHook(() => 
        useRealtimeSync('products', {
          supabaseUrl: 'test-url',
          supabaseAnonKey: 'test-key'
        })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.data).toHaveLength(2)
      expect(result.current.data[0]).toEqual({ id: 1, name: 'Test Product 1' })
      expect(result.current.error).toBeNull()
    })

    it('should handle fetch errors', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' }
        })
      })

      const { result } = renderHook(() => 
        useRealtimeSync('products', {
          supabaseUrl: 'test-url',
          supabaseAnonKey: 'test-key'
        })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.error).toBeTruthy()
      expect(result.current.data).toEqual([])
    })

    it('should subscribe to realtime changes', async () => {
      const { result } = renderHook(() => 
        useRealtimeSync('products', {
          supabaseUrl: 'test-url',
          supabaseAnonKey: 'test-key'
        })
      )

      await act(async () => {
        await result.current.subscribe()
      })

      expect(result.current.isSubscribed).toBe(true)
      expect(mockSupabase.channel).toHaveBeenCalledWith('products-changes')
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        expect.any(Function)
      )
      expect(mockChannel.subscribe).toHaveBeenCalled()
    })

    it('should unsubscribe from realtime changes', async () => {
      const { result } = renderHook(() => 
        useRealtimeSync('products', {
          supabaseUrl: 'test-url',
          supabaseAnonKey: 'test-key'
        })
      )

      await act(async () => {
        await result.current.subscribe()
        await result.current.unsubscribe()
      })

      expect(result.current.isSubscribed).toBe(false)
      expect(mockChannel.unsubscribe).toHaveBeenCalled()
    })

    it('should handle INSERT events', async () => {
      const { result } = renderHook(() => 
        useRealtimeSync('products', {
          supabaseUrl: 'test-url',
          supabaseAnonKey: 'test-key'
        })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      await act(async () => {
        await result.current.subscribe()
      })

      // Simular evento INSERT
      const insertCallback = mockChannel.on.mock.calls[0][2]
      act(() => {
        insertCallback({
          eventType: 'INSERT',
          new: { id: 3, name: 'New Product' },
          old: null
        })
      })

      expect(result.current.data).toHaveLength(3)
      expect(result.current.data[2]).toEqual({ id: 3, name: 'New Product' })
    })

    it('should handle UPDATE events', async () => {
      const { result } = renderHook(() => 
        useRealtimeSync('products', {
          supabaseUrl: 'test-url',
          supabaseAnonKey: 'test-key'
        })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      await act(async () => {
        await result.current.subscribe()
      })

      // Simular evento UPDATE
      const updateCallback = mockChannel.on.mock.calls[0][2]
      act(() => {
        updateCallback({
          eventType: 'UPDATE',
          new: { id: 1, name: 'Updated Product' },
          old: { id: 1, name: 'Test Product 1' }
        })
      })

      expect(result.current.data[0]).toEqual({ id: 1, name: 'Updated Product' })
    })

    it('should handle DELETE events', async () => {
      const { result } = renderHook(() => 
        useRealtimeSync('products', {
          supabaseUrl: 'test-url',
          supabaseAnonKey: 'test-key'
        })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      await act(async () => {
        await result.current.subscribe()
      })

      // Simular evento DELETE
      const deleteCallback = mockChannel.on.mock.calls[0][2]
      act(() => {
        deleteCallback({
          eventType: 'DELETE',
          new: null,
          old: { id: 1, name: 'Test Product 1' }
        })
      })

      expect(result.current.data).toHaveLength(1)
      expect(result.current.data.find(item => item.id === 1)).toBeUndefined()
    })

    it('should apply filters correctly', async () => {
      const { result } = renderHook(() => 
        useRealtimeSync('products', {
          supabaseUrl: 'test-url',
          supabaseAnonKey: 'test-key'
        }, {
          filters: { category: 'electronics' }
        })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(mockSupabase.from).toHaveBeenCalledWith('products')
      expect(mockSupabase.from().select).toHaveBeenCalled()
    })

    it('should handle custom select query', async () => {
      const { result } = renderHook(() => 
        useRealtimeSync('products', {
          supabaseUrl: 'test-url',
          supabaseAnonKey: 'test-key'
        }, {
          select: 'id, name, price'
        })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(mockSupabase.from().select).toHaveBeenCalledWith('id, name, price')
    })

    it('should call onInsert callback', async () => {
      const onInsert = jest.fn()
      
      const { result } = renderHook(() => 
        useRealtimeSync('products', {
          supabaseUrl: 'test-url',
          supabaseAnonKey: 'test-key'
        }, {
          onInsert
        })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      await act(async () => {
        await result.current.subscribe()
      })

      const insertCallback = mockChannel.on.mock.calls[0][2]
      const newRecord = { id: 3, name: 'New Product' }
      
      act(() => {
        insertCallback({
          eventType: 'INSERT',
          new: newRecord,
          old: null
        })
      })

      expect(onInsert).toHaveBeenCalledWith(newRecord)
    })

    it('should call onUpdate callback', async () => {
      const onUpdate = jest.fn()
      
      const { result } = renderHook(() => 
        useRealtimeSync('products', {
          supabaseUrl: 'test-url',
          supabaseAnonKey: 'test-key'
        }, {
          onUpdate
        })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      await act(async () => {
        await result.current.subscribe()
      })

      const updateCallback = mockChannel.on.mock.calls[0][2]
      const newRecord = { id: 1, name: 'Updated Product' }
      const oldRecord = { id: 1, name: 'Test Product 1' }
      
      act(() => {
        updateCallback({
          eventType: 'UPDATE',
          new: newRecord,
          old: oldRecord
        })
      })

      expect(onUpdate).toHaveBeenCalledWith(newRecord, oldRecord)
    })

    it('should call onDelete callback', async () => {
      const onDelete = jest.fn()
      
      const { result } = renderHook(() => 
        useRealtimeSync('products', {
          supabaseUrl: 'test-url',
          supabaseAnonKey: 'test-key'
        }, {
          onDelete
        })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      await act(async () => {
        await result.current.subscribe()
      })

      const deleteCallback = mockChannel.on.mock.calls[0][2]
      const oldRecord = { id: 1, name: 'Test Product 1' }
      
      act(() => {
        deleteCallback({
          eventType: 'DELETE',
          new: null,
          old: oldRecord
        })
      })

      expect(onDelete).toHaveBeenCalledWith(oldRecord)
    })
  })

  describe('useConnectionStatus', () => {
    it('should initialize with disconnected status', () => {
      const { result } = renderHook(() => 
        useConnectionStatus({
          supabaseUrl: 'test-url',
          supabaseAnonKey: 'test-key'
        })
      )

      expect(result.current.status).toBe('disconnected')
      expect(result.current.isConnected).toBe(false)
      expect(result.current.lastConnected).toBeNull()
    })

    it('should connect and update status', async () => {
      const { result } = renderHook(() => 
        useConnectionStatus({
          supabaseUrl: 'test-url',
          supabaseAnonKey: 'test-key'
        })
      )

      await act(async () => {
        await result.current.connect()
      })

      expect(result.current.status).toBe('connected')
      expect(result.current.isConnected).toBe(true)
      expect(result.current.lastConnected).toBeInstanceOf(Date)
    })

    it('should disconnect and update status', async () => {
      const { result } = renderHook(() => 
        useConnectionStatus({
          supabaseUrl: 'test-url',
          supabaseAnonKey: 'test-key'
        })
      )

      await act(async () => {
        await result.current.connect()
        await result.current.disconnect()
      })

      expect(result.current.status).toBe('disconnected')
      expect(result.current.isConnected).toBe(false)
    })

    it('should handle connection errors', async () => {
      mockSupabase.channel.mockImplementation(() => {
        throw new Error('Connection failed')
      })

      const { result } = renderHook(() => 
        useConnectionStatus({
          supabaseUrl: 'test-url',
          supabaseAnonKey: 'test-key'
        })
      )

      await act(async () => {
        await result.current.connect()
      })

      expect(result.current.status).toBe('error')
      expect(result.current.isConnected).toBe(false)
      expect(result.current.error).toBeTruthy()
    })

    it('should retry connection with exponential backoff', async () => {
      let connectionAttempts = 0
      mockSupabase.channel.mockImplementation(() => {
        connectionAttempts++
        if (connectionAttempts < 3) {
          throw new Error('Connection failed')
        }
        return mockChannel
      })

      const { result } = renderHook(() => 
        useConnectionStatus({
          supabaseUrl: 'test-url',
          supabaseAnonKey: 'test-key',
          maxReconnectAttempts: 5,
          reconnectInterval: 100
        })
      )

      await act(async () => {
        await result.current.connect()
      })

      // Aguardar tentativas de reconexão
      await waitFor(() => {
        expect(result.current.status).toBe('connected')
      }, { timeout: 2000 })

      expect(connectionAttempts).toBe(3)
      expect(result.current.reconnectAttempts).toBe(2)
    })

    it('should stop retrying after max attempts', async () => {
      mockSupabase.channel.mockImplementation(() => {
        throw new Error('Connection failed')
      })

      const { result } = renderHook(() => 
        useConnectionStatus({
          supabaseUrl: 'test-url',
          supabaseAnonKey: 'test-key',
          maxReconnectAttempts: 2,
          reconnectInterval: 100
        })
      )

      await act(async () => {
        await result.current.connect()
      })

      await waitFor(() => {
        expect(result.current.reconnectAttempts).toBe(2)
      }, { timeout: 1000 })

      expect(result.current.status).toBe('error')
      expect(result.current.isConnected).toBe(false)
    })
  })
})