import { renderHook, act } from '@testing-library/react';
import { useOfflineFirst } from '../../hooks/realtime/useOfflineFirst';
import { supabase } from '../../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

// Mock Supabase
jest.mock('../../lib/supabase');

const mockSupabase = supabase as jest.Mocked<typeof supabase>;
const mockChannel = {
  on: jest.fn().mockReturnThis(),
  subscribe: jest.fn().mockReturnThis(),
  unsubscribe: jest.fn().mockReturnThis(),
  send: jest.fn().mockResolvedValue({ status: 'ok' })
} as unknown as jest.Mocked<RealtimeChannel>;

describe('Supabase Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Supabase client methods
    mockSupabase.channel = jest.fn().mockReturnValue(mockChannel);
    mockSupabase.from = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
      subscribe: jest.fn().mockReturnValue(mockChannel)
    });
    
    mockSupabase.functions = {
      invoke: jest.fn().mockResolvedValue({ data: null, error: null })
    } as any;
  });

  describe('Realtime Subscriptions', () => {
    it('should establish realtime connection on mount', async () => {
      const { result } = renderHook(() => useOfflineFirst({
        table: 'products',
        primaryKey: 'id',
        enableRealtime: true
      }));

      await act(async () => {
        // Wait for subscription to be established
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(mockSupabase.channel).toHaveBeenCalledWith('products-changes');
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'products'
        },
        expect.any(Function)
      );
      expect(mockChannel.subscribe).toHaveBeenCalled();
    });

    it('should handle INSERT events from realtime', async () => {
      const { result } = renderHook(() => useOfflineFirst({
        table: 'products',
        primaryKey: 'id',
        enableRealtime: true
      }));

      // Get the callback function passed to channel.on
      const realtimeCallback = mockChannel.on.mock.calls[0][2];

      await act(async () => {
        realtimeCallback({
          eventType: 'INSERT',
          new: {
            id: 'product-1',
            name: 'New Product',
            price: 100,
            created_at: new Date().toISOString()
          },
          old: {},
          schema: 'public',
          table: 'products'
        });
      });

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data[0]).toMatchObject({
        id: 'product-1',
        name: 'New Product',
        price: 100
      });
    });

    it('should handle UPDATE events from realtime', async () => {
      const { result } = renderHook(() => useOfflineFirst({
        table: 'products',
        primaryKey: 'id',
        enableRealtime: true
      }));

      // Add initial data
      await act(async () => {
        await result.current.create({
          id: 'product-1',
          name: 'Original Product',
          price: 100
        });
      });

      const realtimeCallback = mockChannel.on.mock.calls[0][2];

      await act(async () => {
        realtimeCallback({
          eventType: 'UPDATE',
          new: {
            id: 'product-1',
            name: 'Updated Product',
            price: 150,
            updated_at: new Date().toISOString()
          },
          old: {
            id: 'product-1',
            name: 'Original Product',
            price: 100
          },
          schema: 'public',
          table: 'products'
        });
      });

      expect(result.current.data[0]).toMatchObject({
        id: 'product-1',
        name: 'Updated Product',
        price: 150
      });
    });

    it('should handle DELETE events from realtime', async () => {
      const { result } = renderHook(() => useOfflineFirst({
        table: 'products',
        primaryKey: 'id',
        enableRealtime: true
      }));

      // Add initial data
      await act(async () => {
        await result.current.create({
          id: 'product-1',
          name: 'Product to Delete',
          price: 100
        });
      });

      const realtimeCallback = mockChannel.on.mock.calls[0][2];

      await act(async () => {
        realtimeCallback({
          eventType: 'DELETE',
          new: {},
          old: {
            id: 'product-1',
            name: 'Product to Delete',
            price: 100
          },
          schema: 'public',
          table: 'products'
        });
      });

      expect(result.current.data).toHaveLength(0);
    });

    it('should cleanup subscription on unmount', async () => {
      const { unmount } = renderHook(() => useOfflineFirst({
        table: 'products',
        primaryKey: 'id',
        enableRealtime: true
      }));

      unmount();

      expect(mockChannel.unsubscribe).toHaveBeenCalled();
    });
  });

  describe('Edge Functions Integration', () => {
    it('should call sync-cart edge function for cart operations', async () => {
      const { result } = renderHook(() => useOfflineFirst({
        table: 'cart_items',
        primaryKey: 'id',
        edgeFunction: 'sync-cart'
      }));

      await act(async () => {
        await result.current.create({
          id: 'cart-item-1',
          product_id: 'product-1',
          quantity: 2,
          user_id: 'user-1'
        });
      });

      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('sync-cart', {
        body: {
          action: 'create',
          data: {
            id: 'cart-item-1',
            product_id: 'product-1',
            quantity: 2,
            user_id: 'user-1'
          }
        }
      });
    });

    it('should call stock-monitor edge function for stock updates', async () => {
      // DEPRECATED: product_sizes table removed
      // TODO: Update test to use products.sizes array instead
      const { result } = renderHook(() => useOfflineFirst({
        table: 'products', // Using products table instead
        primaryKey: 'id',
        edgeFunction: 'stock-monitor'
      }));

      await act(async () => {
        // DEPRECATED: Simplified test data without product_sizes fields
        await result.current.update('product-1', {
          name: 'Updated Product',
          sizes: ['S', 'M', 'L'] // Using sizes array
        });
      });

      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('stock-monitor', {
        body: {
          action: 'update',
          id: 'product-1',
          data: {
            quantity: 5,
            reserved: 2
          }
        }
      });
    });

    it('should call conflict-resolver edge function for conflicts', async () => {
      const { result } = renderHook(() => useOfflineFirst({
        table: 'products',
        primaryKey: 'id',
        conflictResolution: 'server'
      }));

      // Simulate conflict
      await act(async () => {
        result.current.handleConflict({
          id: 'product-1',
          localData: {
            name: 'Local Name',
            price: 100,
            version: 1
          },
          serverData: {
            name: 'Server Name',
            price: 150,
            version: 2
          },
          conflictType: 'concurrent_update'
        });
      });

      expect(mockSupabase.functions.invoke).toHaveBeenCalledWith('conflict-resolver', {
        body: {
          table: 'products',
          id: 'product-1',
          localData: {
            name: 'Local Name',
            price: 100,
            version: 1
          },
          serverData: {
            name: 'Server Name',
            price: 150,
            version: 2
          },
          strategy: 'server'
        }
      });
    });

    it('should handle edge function errors gracefully', async () => {
      mockSupabase.functions.invoke.mockResolvedValue({
        data: null,
        error: { message: 'Function execution failed' }
      });

      const { result } = renderHook(() => useOfflineFirst({
        table: 'products',
        primaryKey: 'id',
        edgeFunction: 'sync-products'
      }));

      await act(async () => {
        await result.current.create({
          id: 'product-1',
          name: 'Test Product',
          price: 100
        });
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.error?.message).toContain('Function execution failed');
    });
  });

  describe('RLS (Row Level Security) Integration', () => {
    it('should respect RLS policies for data access', async () => {
      const { result } = renderHook(() => useOfflineFirst({
        table: 'user_orders',
        primaryKey: 'id',
        userId: 'user-1'
      }));

      // Mock RLS filtering
      mockSupabase.from().select().eq.mockResolvedValue({
        data: [
          { id: 'order-1', user_id: 'user-1', total: 100 },
          // order-2 with user-2 should be filtered out by RLS
        ],
        error: null
      });

      await act(async () => {
        await result.current.readAll();
      });

      expect(result.current.data).toHaveLength(1);
      expect(result.current.data[0].user_id).toBe('user-1');
    });

    it('should handle RLS policy violations', async () => {
      const { result } = renderHook(() => useOfflineFirst({
        table: 'admin_settings',
        primaryKey: 'id',
        userId: 'regular-user'
      }));

      // Mock RLS policy violation
      mockSupabase.from().insert.mockResolvedValue({
        data: null,
        error: {
          code: '42501',
          message: 'new row violates row-level security policy'
        }
      });

      await act(async () => {
        await result.current.create({
          id: 'setting-1',
          key: 'admin_setting',
          value: 'test'
        });
      });

      expect(result.current.error).toBeTruthy();
      expect(result.current.error?.message).toContain('row-level security policy');
    });
  });

  describe('Database Triggers Integration', () => {
    it('should handle trigger-generated events', async () => {
      const { result } = renderHook(() => useOfflineFirst({
        table: 'products',
        primaryKey: 'id',
        enableRealtime: true
      }));

      const realtimeCallback = mockChannel.on.mock.calls[0][2];

      // Simulate trigger that updates related data
      await act(async () => {
        realtimeCallback({
          eventType: 'UPDATE',
          new: {
            id: 'product-1',
            name: 'Product',
            price: 100,
            stock_count: 10,
            // Trigger added these fields
            search_vector: 'product:1',
            updated_at: new Date().toISOString()
          },
          old: {
            id: 'product-1',
            name: 'Product',
            price: 100,
            stock_count: 15
          },
          schema: 'public',
          table: 'products'
        });
      });

      expect(result.current.data[0]).toMatchObject({
        id: 'product-1',
        stock_count: 10,
        search_vector: 'product:1'
      });
    });

    it('should handle cascade delete events', async () => {
      const { result: productHook } = renderHook(() => useOfflineFirst({
        table: 'products',
        primaryKey: 'id',
        enableRealtime: true
      }));

      // DEPRECATED: product_sizes table removed
      // TODO: Update test to use products.sizes array instead
      const { result: stockHook } = renderHook(() => useOfflineFirst({
        table: 'products', // Using products table instead
        primaryKey: 'id',
        enableRealtime: true
      }));

      // Add initial data
      await act(async () => {
        await productHook.current.create({
          id: 'product-1',
          name: 'Product to Delete'
        });
        // DEPRECATED: Simplified test data without product_sizes
        await stockHook.current.create({
          id: 'product-2',
          name: 'Stock Product',
          sizes: ['M', 'L'] // Using sizes array
        });
      });

      // Simulate cascade delete
      const productCallback = mockChannel.on.mock.calls[0][2];
      const stockCallback = mockChannel.on.mock.calls[1][2];

      await act(async () => {
        // Product deleted first
        productCallback({
          eventType: 'DELETE',
          old: { id: 'product-1', name: 'Product to Delete' },
          new: {},
          schema: 'public',
          table: 'products'
        });

        // DEPRECATED: Simplified cascade delete test
        stockCallback({
          eventType: 'DELETE',
          old: { id: 'product-2', name: 'Stock Product' },
          new: {},
          schema: 'public',
          table: 'products'
        });
      });

      expect(productHook.current.data).toHaveLength(0);
      expect(stockHook.current.data).toHaveLength(0);
    });
  });

  describe('Connection Management', () => {
    it('should handle connection drops gracefully', async () => {
      const { result } = renderHook(() => useOfflineFirst({
        table: 'products',
        primaryKey: 'id',
        enableRealtime: true
      }));

      // Simulate connection drop
      await act(async () => {
        mockChannel.subscribe.mockRejectedValue(new Error('Connection lost'));
        
        // Trigger reconnection
        result.current.reconnectRealtime();
        
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Should attempt to resubscribe
      expect(mockChannel.subscribe).toHaveBeenCalledTimes(2);
    });

    it('should implement exponential backoff for reconnection', async () => {
      const { result } = renderHook(() => useOfflineFirst({
        table: 'products',
        primaryKey: 'id',
        enableRealtime: true,
        reconnectOptions: {
          maxRetries: 3,
          initialDelay: 100
        }
      }));

      const startTime = Date.now();
      let reconnectTimes: number[] = [];

      // Mock failed connections
      mockChannel.subscribe
        .mockRejectedValueOnce(new Error('Connection failed'))
        .mockRejectedValueOnce(new Error('Connection failed'))
        .mockRejectedValueOnce(new Error('Connection failed'))
        .mockResolvedValue(mockChannel);

      await act(async () => {
        // Override reconnect to capture timing
        const originalReconnect = result.current.reconnectRealtime;
        result.current.reconnectRealtime = jest.fn().mockImplementation(async () => {
          reconnectTimes.push(Date.now() - startTime);
          return originalReconnect();
        });

        // Trigger initial connection failure
        result.current.reconnectRealtime();
        
        await new Promise(resolve => setTimeout(resolve, 2000));
      });

      // Should have exponential backoff
      expect(reconnectTimes).toHaveLength(4); // Initial + 3 retries
      expect(reconnectTimes[1] - reconnectTimes[0]).toBeGreaterThanOrEqual(100);
      expect(reconnectTimes[2] - reconnectTimes[1]).toBeGreaterThanOrEqual(200);
      expect(reconnectTimes[3] - reconnectTimes[2]).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Performance Monitoring', () => {
    it('should track realtime message latency', async () => {
      const { result } = renderHook(() => useOfflineFirst({
        table: 'products',
        primaryKey: 'id',
        enableRealtime: true,
        enableMetrics: true
      }));

      const realtimeCallback = mockChannel.on.mock.calls[0][2];
      const messageTimestamp = Date.now() - 50; // 50ms ago

      await act(async () => {
        realtimeCallback({
          eventType: 'INSERT',
          new: {
            id: 'product-1',
            name: 'New Product',
            server_timestamp: messageTimestamp
          },
          old: {},
          schema: 'public',
          table: 'products'
        });
      });

      expect(result.current.metrics.realtimeLatency).toBeGreaterThanOrEqual(50);
    });

    it('should track sync performance metrics', async () => {
      const { result } = renderHook(() => useOfflineFirst({
        table: 'products',
        primaryKey: 'id',
        enableMetrics: true
      }));

      const startTime = performance.now();

      await act(async () => {
        await result.current.create({
          id: 'product-1',
          name: 'Test Product',
          price: 100
        });
      });

      const endTime = performance.now();

      expect(result.current.metrics.syncLatency).toBeLessThan(endTime - startTime + 10);
      expect(result.current.metrics.operationCount).toBe(1);
    });
  });
});