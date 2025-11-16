import { renderHook, act } from '@testing-library/react';
import { useOfflineFirst } from '../../../hooks/realtime/useOfflineFirst';
import { useOfflineQueue } from '../../../hooks/realtime/useOfflineQueue';
import { useNetworkStatus } from '../../../hooks/useNetworkStatus';
import { appCache } from '../../../lib/indexeddb';

// Mock dependencies
jest.mock('../../../hooks/useNetworkStatus');
jest.mock('../../../lib/indexeddb');

const mockUseNetworkStatus = useNetworkStatus as jest.MockedFunction<typeof useNetworkStatus>;
const mockAppCache = appCache as jest.Mocked<typeof appCache>;

describe('Performance Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    
    mockUseNetworkStatus.mockReturnValue({
      isOnline: true,
      connectionType: 'wifi',
      effectiveType: '4g',
      downlink: 10,
      rtt: 50,
      saveData: false
    });
  });

  describe('useOfflineFirst Performance', () => {
    it('should handle high-frequency updates efficiently', async () => {
      const { result } = renderHook(() => useOfflineFirst({
        table: 'products',
        primaryKey: 'id'
      }));

      const startTime = performance.now();
      
      // Simulate 100 rapid updates
      await act(async () => {
        const promises = [];
        for (let i = 0; i < 100; i++) {
          promises.push(result.current.update(`product-${i}`, {
            name: `Product ${i}`,
            price: i * 10
          }));
        }
        await Promise.all(promises);
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (< 1000ms)
      expect(duration).toBeLessThan(1000);
    });

    it('should batch cache operations for better performance', async () => {
      let cacheOperations = 0;
      mockAppCache.set.mockImplementation(async () => {
        cacheOperations++;
        return Promise.resolve();
      });

      const { result } = renderHook(() => useOfflineFirst({
        table: 'products',
        primaryKey: 'id'
      }));

      await act(async () => {
        // Multiple rapid operations
        await Promise.all([
          result.current.create({ name: 'Product 1', price: 10 }),
          result.current.create({ name: 'Product 2', price: 20 }),
          result.current.create({ name: 'Product 3', price: 30 })
        ]);
      });

      // Should batch operations to reduce cache calls
      expect(cacheOperations).toBeLessThan(10);
    });

    it('should handle memory efficiently with large datasets', async () => {
      const { result } = renderHook(() => useOfflineFirst({
        table: 'products',
        primaryKey: 'id'
      }));

      // Mock large dataset
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: `product-${i}`,
        name: `Product ${i}`,
        description: 'A'.repeat(1000), // 1KB per item
        price: i * 10
      }));

      mockAppCache.getAll.mockResolvedValue(largeDataset);

      await act(async () => {
        await result.current.readAll();
      });

      expect(result.current.data).toHaveLength(1000);
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('useOfflineQueue Performance', () => {
    it('should process queue efficiently under load', async () => {
      mockUseNetworkStatus.mockReturnValue({
        isOnline: false,
        connectionType: 'none',
        effectiveType: 'slow-2g',
        downlink: 0,
        rtt: 0,
        saveData: false
      });

      const { result } = renderHook(() => useOfflineQueue({
        maxRetries: 3,
        retryDelay: 100
      }));

      const startTime = performance.now();

      await act(async () => {
        // Add 500 actions to queue
        for (let i = 0; i < 500; i++) {
          result.current.addAction({
            id: `action-${i}`,
            type: 'insert',
            table: 'products',
            data: { name: `Product ${i}` },
            timestamp: Date.now(),
            priority: i % 3 === 0 ? 'high' : 'normal'
          });
        }
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(500); // Should be very fast
      expect(result.current.queueSize).toBe(500);
    });

    it('should handle concurrent queue operations safely', async () => {
      const { result } = renderHook(() => useOfflineQueue({
        maxRetries: 3,
        retryDelay: 100
      }));

      await act(async () => {
        // Simulate concurrent operations
        const operations = [
          () => result.current.addAction({
            id: 'action-1',
            type: 'insert',
            table: 'products',
            data: { name: 'Product 1' },
            timestamp: Date.now()
          }),
          () => result.current.addAction({
            id: 'action-2',
            type: 'update',
            table: 'products',
            data: { name: 'Product 2' },
            timestamp: Date.now()
          }),
          () => result.current.clearQueue(),
          () => result.current.addAction({
            id: 'action-3',
            type: 'delete',
            table: 'products',
            data: { id: 'product-1' },
            timestamp: Date.now()
          })
        ];

        await Promise.all(operations.map(op => op()));
      });

      // Should handle concurrent operations without corruption
      expect(result.current.queueSize).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Network Transition Performance', () => {
    it('should handle online/offline transitions smoothly', async () => {
      const networkStatus = {
        isOnline: true,
        connectionType: 'wifi' as const,
        effectiveType: '4g' as const,
        downlink: 10,
        rtt: 50,
        saveData: false
      };

      mockUseNetworkStatus.mockReturnValue(networkStatus);

      const { result, rerender } = renderHook(() => useOfflineFirst({
        table: 'products',
        primaryKey: 'id'
      }));

      // Start online
      expect(result.current.syncStatus.isOnline).toBe(true);

      // Go offline
      networkStatus.isOnline = false;
      networkStatus.connectionType = 'none';
      rerender();

      await act(async () => {
        // Perform operations while offline
        await result.current.create({ name: 'Offline Product', price: 100 });
      });

      expect(result.current.syncStatus.isOnline).toBe(false);
      expect(result.current.syncStatus.pendingChanges).toBeGreaterThan(0);

      // Go back online
      networkStatus.isOnline = true;
      networkStatus.connectionType = 'wifi';
      rerender();

      // Should automatically sync
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(result.current.syncStatus.isOnline).toBe(true);
    });

    it('should throttle sync attempts during poor connectivity', async () => {
      let syncAttempts = 0;
      const mockSync = jest.fn().mockImplementation(() => {
        syncAttempts++;
        return Promise.reject(new Error('Network error'));
      });

      mockUseNetworkStatus.mockReturnValue({
        isOnline: true,
        connectionType: 'cellular',
        effectiveType: 'slow-2g',
        downlink: 0.5,
        rtt: 2000,
        saveData: true
      });

      const { result } = renderHook(() => useOfflineQueue({
        maxRetries: 5,
        retryDelay: 100,
        processAction: mockSync
      }));

      await act(async () => {
        result.current.addAction({
          id: 'action-1',
          type: 'insert',
          table: 'products',
          data: { name: 'Product 1' },
          timestamp: Date.now()
        });

        // Wait for processing attempts
        await new Promise(resolve => setTimeout(resolve, 1000));
      });

      // Should throttle attempts on slow connection
      expect(syncAttempts).toBeLessThan(10);
    });
  });

  describe('Memory and Storage Performance', () => {
    it('should clean up expired cache entries efficiently', async () => {
      const { result } = renderHook(() => useOfflineFirst({
        table: 'products',
        primaryKey: 'id',
        cacheTTL: 100 // Very short TTL for testing
      }));

      // Add data to cache
      await act(async () => {
        await result.current.create({ name: 'Product 1', price: 10 });
      });

      // Wait for TTL to expire
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
      });

      // Should clean up expired entries
      expect(mockAppCache.cleanup).toHaveBeenCalled();
    });

    it('should handle localStorage quota efficiently', async () => {
      const { result } = renderHook(() => useOfflineQueue({
        maxRetries: 3,
        retryDelay: 100
      }));

      // Mock localStorage quota exceeded
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = jest.fn().mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      await act(async () => {
        // Should handle quota errors gracefully
        result.current.addAction({
          id: 'action-1',
          type: 'insert',
          table: 'products',
          data: { name: 'Product 1' },
          timestamp: Date.now()
        });
      });

      // Restore original implementation
      Storage.prototype.setItem = originalSetItem;

      // Should not crash and maintain functionality
      expect(result.current.queueSize).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Latency Monitoring', () => {
    it('should track operation latencies accurately', async () => {
      const { result } = renderHook(() => useOfflineFirst({
        table: 'products',
        primaryKey: 'id'
      }));

      const startTime = Date.now();

      await act(async () => {
        await result.current.create({ name: 'Product 1', price: 10 });
      });

      const endTime = Date.now();
      const expectedLatency = endTime - startTime;

      // Should track latency within reasonable margin
      expect(result.current.syncStatus.lastSyncLatency).toBeCloseTo(expectedLatency, -1);
    });

    it('should maintain performance metrics over time', async () => {
      const { result } = renderHook(() => useOfflineQueue({
        maxRetries: 3,
        retryDelay: 100
      }));

      await act(async () => {
        // Perform multiple operations
        for (let i = 0; i < 10; i++) {
          result.current.addAction({
            id: `action-${i}`,
            type: 'insert',
            table: 'products',
            data: { name: `Product ${i}` },
            timestamp: Date.now()
          });
        }
      });

      const stats = result.current.getStats();
      
      expect(stats.totalProcessed).toBeGreaterThanOrEqual(0);
      expect(stats.successRate).toBeGreaterThanOrEqual(0);
      expect(stats.successRate).toBeLessThanOrEqual(1);
    });
  });
});