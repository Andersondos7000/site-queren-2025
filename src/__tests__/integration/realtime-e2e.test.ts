import { renderHook, act } from '@testing-library/react';
import { useOfflineFirst } from '../../hooks/realtime/useOfflineFirst';
import { useOfflineQueue } from '../../hooks/realtime/useOfflineQueue';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { appCache, apiCache } from '../../lib/indexeddb';
import { supabase } from '../../lib/supabase';

// Mock all dependencies
jest.mock('../../hooks/useNetworkStatus');
jest.mock('../../lib/indexeddb');
jest.mock('../../lib/supabase');

const mockUseNetworkStatus = useNetworkStatus as jest.MockedFunction<typeof useNetworkStatus>;
const mockAppCache = appCache as jest.Mocked<typeof appCache>;
const mockApiCache = apiCache as jest.Mocked<typeof apiCache>;
const mockSupabase = supabase as jest.Mocked<typeof supabase>;

describe('Realtime System E2E Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    
    // Default to online state
    mockUseNetworkStatus.mockReturnValue({
      isOnline: true,
      connectionType: 'wifi',
      effectiveType: '4g',
      downlink: 10,
      rtt: 50,
      saveData: false
    });

    // Mock Supabase methods
    mockSupabase.from = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null })
    });
  });

  describe('Complete Shopping Cart Flow', () => {
    it('should handle complete cart lifecycle with realtime sync', async () => {
      const { result: cartHook } = renderHook(() => useOfflineFirst({
        table: 'cart_items',
        primaryKey: 'id'
      }));

      // DEPRECATED: product_sizes table removed
      // TODO: Update test to use products.sizes array instead
      const { result: stockHook } = renderHook(() => useOfflineFirst({
        table: 'products', // Using products table instead
        primaryKey: 'id'
      }));

      // 1. Add item to cart
      await act(async () => {
        await cartHook.current.create({
          id: 'cart-item-1',
          product_id: 'product-1',
          quantity: 2,
          user_id: 'user-1'
        });
      });

      expect(cartHook.current.data).toHaveLength(1);

      // 2. Update stock in realtime
      await act(async () => {
        await stockHook.current.update('product-1', {
          quantity: 8, // Reduced from 10
          reserved: 2  // Reserved for cart
        });
      });

      // 3. Simulate another user adding same product
      await act(async () => {
        stockHook.current.handleRealtimeUpdate({
          eventType: 'UPDATE',
          new: {
            product_id: 'product-1',
            quantity: 6, // Another user took 2
            reserved: 4  // Total reserved now 4
          },
          old: {
            product_id: 'product-1',
            quantity: 8,
            reserved: 2
          }
        });
      });

      expect(stockHook.current.data.find(item => item.product_id === 'product-1')?.quantity)
        .toBe(6);

      // 4. Update cart quantity (should check stock)
      await act(async () => {
        await cartHook.current.update('cart-item-1', {
          quantity: 5 // Trying to increase beyond available
        });
      });

      // Should handle stock validation
      expect(cartHook.current.error).toBeTruthy();
    });

    it('should handle checkout process with conflict resolution', async () => {
      const { result: cartHook } = renderHook(() => useOfflineFirst({
        table: 'cart_items',
        primaryKey: 'id'
      }));

      const { result: orderHook } = renderHook(() => useOfflineFirst({
        table: 'orders',
        primaryKey: 'id'
      }));

      // Setup cart with items
      await act(async () => {
        await cartHook.current.create({
          id: 'cart-item-1',
          product_id: 'product-1',
          quantity: 2,
          price: 50
        });
        await cartHook.current.create({
          id: 'cart-item-2',
          product_id: 'product-2',
          quantity: 1,
          price: 100
        });
      });

      // Go offline during checkout
      mockUseNetworkStatus.mockReturnValue({
        isOnline: false,
        connectionType: 'none',
        effectiveType: 'slow-2g',
        downlink: 0,
        rtt: 0,
        saveData: false
      });

      // Create order offline
      await act(async () => {
        await orderHook.current.create({
          id: 'order-1',
          user_id: 'user-1',
          total: 200,
          status: 'pending',
          items: cartHook.current.data
        });
      });

      expect(orderHook.current.syncStatus.pendingChanges).toBe(1);

      // Go back online
      mockUseNetworkStatus.mockReturnValue({
        isOnline: true,
        connectionType: 'wifi',
        effectiveType: '4g',
        downlink: 10,
        rtt: 50,
        saveData: false
      });

      // Simulate server conflict (stock changed)
      await act(async () => {
        orderHook.current.handleServerResponse({
          id: 'order-1',
          status: 'failed',
          error: 'Insufficient stock for product-1'
        });
      });

      expect(orderHook.current.conflicts).toHaveLength(1);
    });
  });

  describe('Multi-User Collaboration', () => {
    it('should handle concurrent edits from multiple users', async () => {
      const { result: user1Hook } = renderHook(() => useOfflineFirst({
        table: 'products',
        primaryKey: 'id',
        userId: 'user-1'
      }));

      const { result: user2Hook } = renderHook(() => useOfflineFirst({
        table: 'products',
        primaryKey: 'id',
        userId: 'user-2'
      }));

      // Both users start with same data
      const initialProduct = {
        id: 'product-1',
        name: 'Shared Product',
        price: 100,
        description: 'Initial description'
      };

      mockAppCache.get.mockResolvedValue(initialProduct);

      // User 1 updates name
      await act(async () => {
        await user1Hook.current.update('product-1', {
          name: 'User 1 Product'
        });
      });

      // User 2 updates price (concurrent)
      await act(async () => {
        await user2Hook.current.update('product-1', {
          price: 150
        });
      });

      // Simulate realtime updates
      await act(async () => {
        // User 1 receives User 2's change
        user1Hook.current.handleRealtimeUpdate({
          eventType: 'UPDATE',
          new: { id: 'product-1', price: 150, lastModifiedBy: 'user-2' },
          old: { id: 'product-1', price: 100 }
        });

        // User 2 receives User 1's change
        user2Hook.current.handleRealtimeUpdate({
          eventType: 'UPDATE',
          new: { id: 'product-1', name: 'User 1 Product', lastModifiedBy: 'user-1' },
          old: { id: 'product-1', name: 'Shared Product' }
        });
      });

      // Both should have merged changes
      const user1Data = user1Hook.current.data.find(item => item.id === 'product-1');
      const user2Data = user2Hook.current.data.find(item => item.id === 'product-1');

      expect(user1Data?.name).toBe('User 1 Product');
      expect(user1Data?.price).toBe(150);
      expect(user2Data?.name).toBe('User 1 Product');
      expect(user2Data?.price).toBe(150);
    });

    it('should handle user presence and activity indicators', async () => {
      const { result } = renderHook(() => useOfflineFirst({
        table: 'products',
        primaryKey: 'id',
        enablePresence: true
      }));

      // Simulate other users joining
      await act(async () => {
        result.current.handlePresenceUpdate({
          event: 'join',
          user: {
            id: 'user-2',
            name: 'John Doe',
            avatar: 'avatar-url'
          },
          timestamp: Date.now()
        });
      });

      expect(result.current.activeUsers).toHaveLength(1);

      // Simulate user editing
      await act(async () => {
        result.current.handlePresenceUpdate({
          event: 'editing',
          user: { id: 'user-2' },
          resource: { type: 'product', id: 'product-1' },
          timestamp: Date.now()
        });
      });

      expect(result.current.editingUsers['product-1']).toContain('user-2');

      // Simulate user leaving
      await act(async () => {
        result.current.handlePresenceUpdate({
          event: 'leave',
          user: { id: 'user-2' },
          timestamp: Date.now()
        });
      });

      expect(result.current.activeUsers).toHaveLength(0);
    });
  });

  describe('Network Resilience', () => {
    it('should handle intermittent connectivity gracefully', async () => {
      const { result } = renderHook(() => useOfflineFirst({
        table: 'products',
        primaryKey: 'id'
      }));

      // Start online
      expect(result.current.syncStatus.isOnline).toBe(true);

      // Create some data
      await act(async () => {
        await result.current.create({
          id: 'product-1',
          name: 'Test Product',
          price: 100
        });
      });

      // Go offline
      mockUseNetworkStatus.mockReturnValue({
        isOnline: false,
        connectionType: 'none',
        effectiveType: 'slow-2g',
        downlink: 0,
        rtt: 0,
        saveData: false
      });

      // Make changes offline
      await act(async () => {
        await result.current.update('product-1', { price: 150 });
        await result.current.create({
          id: 'product-2',
          name: 'Offline Product',
          price: 200
        });
      });

      expect(result.current.syncStatus.pendingChanges).toBe(2);

      // Simulate poor connectivity (slow reconnection)
      mockUseNetworkStatus.mockReturnValue({
        isOnline: true,
        connectionType: 'cellular',
        effectiveType: 'slow-2g',
        downlink: 0.5,
        rtt: 2000,
        saveData: true
      });

      // Should throttle sync attempts
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 500));
      });

      expect(result.current.syncStatus.isSyncing).toBe(true);
      expect(result.current.syncStatus.pendingChanges).toBeGreaterThan(0);

      // Full connectivity restored
      mockUseNetworkStatus.mockReturnValue({
        isOnline: true,
        connectionType: 'wifi',
        effectiveType: '4g',
        downlink: 10,
        rtt: 50,
        saveData: false
      });

      // Should complete sync
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 1000));
      });

      expect(result.current.syncStatus.pendingChanges).toBe(0);
    });

    it('should handle sync failures with exponential backoff', async () => {
      const { result } = renderHook(() => useOfflineQueue({
        maxRetries: 3,
        retryDelay: 100,
        processAction: jest.fn().mockRejectedValue(new Error('Sync failed'))
      }));

      const startTime = Date.now();
      let retryTimes: number[] = [];

      // Mock to capture retry times
      const originalProcessAction = result.current.processAction;
      result.current.processAction = jest.fn().mockImplementation(async () => {
        retryTimes.push(Date.now() - startTime);
        throw new Error('Sync failed');
      });

      await act(async () => {
        result.current.addAction({
          id: 'action-1',
          type: 'insert',
          table: 'products',
          data: { name: 'Test Product' },
          timestamp: Date.now()
        });

        // Wait for all retries
        await new Promise(resolve => setTimeout(resolve, 2000));
      });

      // Should have exponential backoff
      expect(retryTimes).toHaveLength(4); // Initial + 3 retries
      expect(retryTimes[1] - retryTimes[0]).toBeGreaterThanOrEqual(100);
      expect(retryTimes[2] - retryTimes[1]).toBeGreaterThanOrEqual(200);
      expect(retryTimes[3] - retryTimes[2]).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Data Consistency', () => {
    it('should maintain ACID properties during complex operations', async () => {
      const { result } = renderHook(() => useOfflineFirst({
        table: 'orders',
        primaryKey: 'id',
        enableTransactions: true
      }));

      // Start transaction
      await act(async () => {
        result.current.beginTransaction();
      });

      // Multiple operations in transaction
      await act(async () => {
        await result.current.create({
          id: 'order-1',
          total: 100,
          status: 'pending'
        });

        await result.current.create({
          id: 'order-item-1',
          order_id: 'order-1',
          product_id: 'product-1',
          quantity: 2
        });

        await result.current.update('product-stock-1', {
          quantity: 8 // Reduce stock
        });
      });

      // Simulate failure during transaction
      mockSupabase.from().insert.mockRejectedValueOnce(new Error('Database error'));

      await act(async () => {
        try {
          await result.current.commitTransaction();
        } catch (error) {
          await result.current.rollbackTransaction();
        }
      });

      // All changes should be rolled back
      expect(result.current.data.find(item => item.id === 'order-1')).toBeUndefined();
    });

    it('should handle eventual consistency correctly', async () => {
      const { result } = renderHook(() => useOfflineFirst({
        table: 'products',
        primaryKey: 'id',
        consistencyLevel: 'eventual'
      }));

      // Create data locally
      await act(async () => {
        await result.current.create({
          id: 'product-1',
          name: 'Local Product',
          price: 100
        });
      });

      // Simulate delayed server response with different data
      setTimeout(async () => {
        await act(async () => {
          result.current.handleServerResponse({
            id: 'product-1',
            name: 'Server Product',
            price: 150,
            version: 2
          });
        });
      }, 500);

      // Should eventually converge to server state
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 1000));
      });

      expect(result.current.data.find(item => item.id === 'product-1')?.name)
        .toBe('Server Product');
    });
  });

  describe('Performance Under Load', () => {
    it('should handle high-frequency realtime updates efficiently', async () => {
      const { result } = renderHook(() => useOfflineFirst({
        table: 'stock_updates',
        primaryKey: 'product_id',
        batchUpdates: true,
        batchSize: 50
      }));

      const startTime = performance.now();
      const updateCount = 1000;

      await act(async () => {
        // Simulate rapid stock updates
        for (let i = 0; i < updateCount; i++) {
          result.current.handleRealtimeUpdate({
            eventType: 'UPDATE',
            new: {
              product_id: `product-${i % 100}`,
              quantity: Math.floor(Math.random() * 100),
              timestamp: Date.now()
            }
          });
        }
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should handle updates efficiently
      expect(duration).toBeLessThan(2000);
      expect(result.current.data.length).toBeLessThanOrEqual(100); // Deduplicated
    });

    it('should maintain performance with large datasets', async () => {
      const { result } = renderHook(() => useOfflineFirst({
        table: 'products',
        primaryKey: 'id',
        virtualizeData: true,
        pageSize: 50
      }));

      // Mock large dataset
      const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
        id: `product-${i}`,
        name: `Product ${i}`,
        price: i * 10
      }));

      mockAppCache.getAll.mockResolvedValue(largeDataset);

      const startTime = performance.now();

      await act(async () => {
        await result.current.readAll();
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should load efficiently with virtualization
      expect(duration).toBeLessThan(1000);
      expect(result.current.virtualizedData).toHaveLength(50); // First page
      expect(result.current.totalCount).toBe(10000);
    });
  });

  describe('Error Recovery', () => {
    it('should recover gracefully from cache corruption', async () => {
      const { result } = renderHook(() => useOfflineFirst({
        table: 'products',
        primaryKey: 'id'
      }));

      // Simulate cache corruption
      mockAppCache.get.mockRejectedValue(new Error('Cache corrupted'));
      mockAppCache.getAll.mockRejectedValue(new Error('Cache corrupted'));

      await act(async () => {
        await result.current.readAll();
      });

      // Should fallback to server and rebuild cache
      expect(result.current.error).toBeNull();
      expect(mockAppCache.clear).toHaveBeenCalled();
    });

    it('should handle quota exceeded errors gracefully', async () => {
      const { result } = renderHook(() => useOfflineFirst({
        table: 'products',
        primaryKey: 'id'
      }));

      // Mock quota exceeded
      mockAppCache.set.mockRejectedValue(new Error('QuotaExceededError'));

      await act(async () => {
        await result.current.create({
          id: 'product-1',
          name: 'Test Product',
          price: 100
        });
      });

      // Should cleanup old data and retry
      expect(mockAppCache.cleanup).toHaveBeenCalled();
      expect(result.current.error).toBeNull();
    });
  });
});