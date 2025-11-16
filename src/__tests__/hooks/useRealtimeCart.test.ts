import { renderHook, act, waitFor } from '@testing-library/react'
import { useRealtimeCart, useCartSync } from '../../hooks/realtime/useRealtimeCart'
import { createClient } from '@supabase/supabase-js'

// Mock do Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn()
}))

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

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>

describe('useRealtimeCart', () => {
  let mockSupabase: any
  let mockChannel: any

  const mockCartItems = [
    {
      id: '1',
      user_id: 'user-1',
      product_id: 'prod-1',
      quantity: 2,
      price: 29.99,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    },
    {
      id: '2',
      user_id: 'user-1',
      product_id: 'prod-2',
      quantity: 1,
      price: 49.99,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    }
  ]

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
          data: mockCartItems,
          error: null
        }),
        insert: jest.fn().mockResolvedValue({
          data: [mockCartItems[0]],
          error: null
        }),
        update: jest.fn().mockResolvedValue({
          data: [{ ...mockCartItems[0], quantity: 3 }],
          error: null
        }),
        delete: jest.fn().mockResolvedValue({
          data: [mockCartItems[0]],
          error: null
        }),
        eq: jest.fn().mockReturnThis(),
        match: jest.fn().mockReturnThis()
      }),
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'user-1' } },
          error: null
        })
      }
    }

    mockCreateClient.mockReturnValue(mockSupabase)
    localStorageMock.getItem.mockReturnValue(null)
  })

  afterEach(() => {
    jest.clearAllMocks()
    localStorageMock.getItem.mockClear()
    localStorageMock.setItem.mockClear()
    localStorageMock.removeItem.mockClear()
  })

  describe('useRealtimeCart', () => {
    it('should initialize with empty cart', () => {
      const { result } = renderHook(() => 
        useRealtimeCart({
          supabaseUrl: 'test-url',
          supabaseAnonKey: 'test-key'
        })
      )

      expect(result.current.items).toEqual([])
      expect(result.current.loading).toBe(true)
      expect(result.current.error).toBeNull()
      expect(result.current.summary.totalItems).toBe(0)
      expect(result.current.summary.totalPrice).toBe(0)
    })

    it('should load cart items on mount', async () => {
      const { result } = renderHook(() => 
        useRealtimeCart({
          supabaseUrl: 'test-url',
          supabaseAnonKey: 'test-key'
        })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.items).toHaveLength(2)
      expect(result.current.summary.totalItems).toBe(3) // 2 + 1
      expect(result.current.summary.totalPrice).toBe(109.97) // (29.99 * 2) + 49.99
    })

    it('should add item to cart', async () => {
      const { result } = renderHook(() => 
        useRealtimeCart({
          supabaseUrl: 'test-url',
          supabaseAnonKey: 'test-key'
        })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      await act(async () => {
        await result.current.addItem('prod-3', 1, 19.99)
      })

      expect(mockSupabase.from).toHaveBeenCalledWith('cart_items')
      expect(mockSupabase.from().insert).toHaveBeenCalledWith({
        product_id: 'prod-3',
        quantity: 1,
        price: 19.99
      })
    })

    it('should update item quantity', async () => {
      const { result } = renderHook(() => 
        useRealtimeCart({
          supabaseUrl: 'test-url',
          supabaseAnonKey: 'test-key'
        })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      await act(async () => {
        await result.current.updateQuantity('1', 5)
      })

      expect(mockSupabase.from().update).toHaveBeenCalledWith({
        quantity: 5,
        updated_at: expect.any(String)
      })
      expect(mockSupabase.from().eq).toHaveBeenCalledWith('id', '1')
    })

    it('should remove item from cart', async () => {
      const { result } = renderHook(() => 
        useRealtimeCart({
          supabaseUrl: 'test-url',
          supabaseAnonKey: 'test-key'
        })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      await act(async () => {
        await result.current.removeItem('1')
      })

      expect(mockSupabase.from().delete).toHaveBeenCalled()
      expect(mockSupabase.from().eq).toHaveBeenCalledWith('id', '1')
    })

    it('should clear entire cart', async () => {
      const { result } = renderHook(() => 
        useRealtimeCart({
          supabaseUrl: 'test-url',
          supabaseAnonKey: 'test-key'
        })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      await act(async () => {
        await result.current.clearCart()
      })

      expect(mockSupabase.from().delete).toHaveBeenCalled()
      expect(mockSupabase.from().match).toHaveBeenCalledWith({ user_id: 'user-1' })
    })

    it('should handle realtime INSERT events', async () => {
      const { result } = renderHook(() => 
        useRealtimeCart({
          supabaseUrl: 'test-url',
          supabaseAnonKey: 'test-key'
        })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Simular evento INSERT
      const insertCallback = mockChannel.on.mock.calls[0][2]
      const newItem = {
        id: '3',
        user_id: 'user-1',
        product_id: 'prod-3',
        quantity: 1,
        price: 19.99,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      act(() => {
        insertCallback({
          eventType: 'INSERT',
          new: newItem,
          old: null
        })
      })

      expect(result.current.items).toHaveLength(3)
      expect(result.current.items[2]).toEqual(newItem)
      expect(result.current.summary.totalItems).toBe(4)
    })

    it('should handle realtime UPDATE events', async () => {
      const { result } = renderHook(() => 
        useRealtimeCart({
          supabaseUrl: 'test-url',
          supabaseAnonKey: 'test-key'
        })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Simular evento UPDATE
      const updateCallback = mockChannel.on.mock.calls[0][2]
      const updatedItem = {
        ...mockCartItems[0],
        quantity: 5
      }

      act(() => {
        updateCallback({
          eventType: 'UPDATE',
          new: updatedItem,
          old: mockCartItems[0]
        })
      })

      const updatedCartItem = result.current.items.find(item => item.id === '1')
      expect(updatedCartItem?.quantity).toBe(5)
      expect(result.current.summary.totalItems).toBe(6) // 5 + 1
    })

    it('should handle realtime DELETE events', async () => {
      const { result } = renderHook(() => 
        useRealtimeCart({
          supabaseUrl: 'test-url',
          supabaseAnonKey: 'test-key'
        })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Simular evento DELETE
      const deleteCallback = mockChannel.on.mock.calls[0][2]

      act(() => {
        deleteCallback({
          eventType: 'DELETE',
          new: null,
          old: mockCartItems[0]
        })
      })

      expect(result.current.items).toHaveLength(1)
      expect(result.current.items.find(item => item.id === '1')).toBeUndefined()
      expect(result.current.summary.totalItems).toBe(1)
    })

    it('should calculate cart summary correctly', async () => {
      const { result } = renderHook(() => 
        useRealtimeCart({
          supabaseUrl: 'test-url',
          supabaseAnonKey: 'test-key'
        })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      const { summary } = result.current
      
      expect(summary.totalItems).toBe(3) // 2 + 1
      expect(summary.totalPrice).toBe(109.97) // (29.99 * 2) + 49.99
      expect(summary.uniqueItems).toBe(2)
      expect(summary.averageItemPrice).toBe(54.985) // 109.97 / 2
    })

    it('should handle errors gracefully', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' }
        })
      })

      const { result } = renderHook(() => 
        useRealtimeCart({
          supabaseUrl: 'test-url',
          supabaseAnonKey: 'test-key'
        })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.error).toBeTruthy()
      expect(result.current.items).toEqual([])
    })

    it('should call onItemAdded callback', async () => {
      const onItemAdded = jest.fn()
      
      const { result } = renderHook(() => 
        useRealtimeCart({
          supabaseUrl: 'test-url',
          supabaseAnonKey: 'test-key'
        }, {
          onItemAdded
        })
      )

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      const insertCallback = mockChannel.on.mock.calls[0][2]
      const newItem = {
        id: '3',
        user_id: 'user-1',
        product_id: 'prod-3',
        quantity: 1,
        price: 19.99,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }

      act(() => {
        insertCallback({
          eventType: 'INSERT',
          new: newItem,
          old: null
        })
      })

      expect(onItemAdded).toHaveBeenCalledWith(newItem)
    })
  })

  describe('useCartSync', () => {
    beforeEach(() => {
      // Mock do BroadcastChannel
      global.BroadcastChannel = jest.fn().mockImplementation(() => ({
        postMessage: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        close: jest.fn()
      }))
    })

    it('should initialize with empty sync state', () => {
      const { result } = renderHook(() => 
        useCartSync({
          supabaseUrl: 'test-url',
          supabaseAnonKey: 'test-key'
        })
      )

      expect(result.current.lastSync).toBeNull()
      expect(result.current.syncInProgress).toBe(false)
      expect(result.current.conflictCount).toBe(0)
    })

    it('should sync cart with localStorage', async () => {
      const cartData = JSON.stringify(mockCartItems)
      localStorageMock.getItem.mockReturnValue(cartData)

      const { result } = renderHook(() => 
        useCartSync({
          supabaseUrl: 'test-url',
          supabaseAnonKey: 'test-key'
        })
      )

      await act(async () => {
        await result.current.syncWithLocal()
      })

      expect(localStorageMock.getItem).toHaveBeenCalledWith('cart_items')
      expect(result.current.lastSync).toBeInstanceOf(Date)
    })

    it('should backup cart to localStorage', async () => {
      const { result } = renderHook(() => 
        useCartSync({
          supabaseUrl: 'test-url',
          supabaseAnonKey: 'test-key'
        })
      )

      await act(async () => {
        await result.current.backupToLocal(mockCartItems)
      })

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'cart_items',
        JSON.stringify(mockCartItems)
      )
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'cart_backup_timestamp',
        expect.any(String)
      )
    })

    it('should restore cart from localStorage', async () => {
      const cartData = JSON.stringify(mockCartItems)
      localStorageMock.getItem.mockReturnValue(cartData)

      const { result } = renderHook(() => 
        useCartSync({
          supabaseUrl: 'test-url',
          supabaseAnonKey: 'test-key'
        })
      )

      const restoredItems = await act(async () => {
        return await result.current.restoreFromLocal()
      })

      expect(restoredItems).toEqual(mockCartItems)
      expect(localStorageMock.getItem).toHaveBeenCalledWith('cart_items')
    })

    it('should handle sync conflicts', async () => {
      const onConflict = jest.fn().mockResolvedValue('merge')
      
      const { result } = renderHook(() => 
        useCartSync({
          supabaseUrl: 'test-url',
          supabaseAnonKey: 'test-key'
        }, {
          onConflict
        })
      )

      // Simular conflito
      const localItems = [{ ...mockCartItems[0], quantity: 5 }]
      const remoteItems = [{ ...mockCartItems[0], quantity: 3 }]

      await act(async () => {
        await result.current.resolveConflicts(localItems, remoteItems)
      })

      expect(onConflict).toHaveBeenCalled()
      expect(result.current.conflictCount).toBe(1)
    })

    it('should broadcast changes to other tabs', async () => {
      const mockBroadcastChannel = {
        postMessage: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        close: jest.fn()
      }
      
      global.BroadcastChannel = jest.fn().mockReturnValue(mockBroadcastChannel)

      const { result } = renderHook(() => 
        useCartSync({
          supabaseUrl: 'test-url',
          supabaseAnonKey: 'test-key'
        })
      )

      await act(async () => {
        await result.current.broadcastChange({
          type: 'ITEM_ADDED',
          item: mockCartItems[0]
        })
      })

      expect(mockBroadcastChannel.postMessage).toHaveBeenCalledWith({
        type: 'ITEM_ADDED',
        item: mockCartItems[0],
        timestamp: expect.any(Number)
      })
    })

    it('should handle offline mode', async () => {
      // Simular modo offline
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      })

      const { result } = renderHook(() => 
        useCartSync({
          supabaseUrl: 'test-url',
          supabaseAnonKey: 'test-key'
        })
      )

      expect(result.current.isOnline).toBe(false)

      await act(async () => {
        await result.current.syncWithLocalStorage()
      })

      // Em modo offline, deve usar apenas localStorage
      expect(localStorageMock.getItem).toHaveBeenCalled()
    })
  })
})