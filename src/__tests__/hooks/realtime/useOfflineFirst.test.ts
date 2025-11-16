import { renderHook, act, waitFor } from '@testing-library/react';
import { useOfflineFirst } from '../../../hooks/realtime/useOfflineFirst';
import { useNetworkStatus } from '../../../hooks/useNetworkStatus';
import { useOfflineQueue } from '../../../hooks/realtime/useOfflineQueue';
import { appCache, apiCache } from '../../../lib/indexeddb';

// Mock dependencies
jest.mock('../../../hooks/useNetworkStatus');
jest.mock('../../../hooks/realtime/useOfflineQueue');
jest.mock('../../../lib/indexeddb');

const mockUseNetworkStatus = useNetworkStatus as jest.MockedFunction<typeof useNetworkStatus>;
const mockUseOfflineQueue = useOfflineQueue as jest.MockedFunction<typeof useOfflineQueue>;
const mockAppCache = appCache as jest.Mocked<typeof appCache>;
const mockApiCache = apiCache as jest.Mocked<typeof apiCache>;

describe('useOfflineFirst', () => {
  const mockAddAction = jest.fn();
  const mockProcessQueue = jest.fn();
  const mockClearQueue = jest.fn();
  const mockGetQueuedActionsByStatus = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockUseNetworkStatus.mockReturnValue({
      isOnline: true,
      connectionType: 'wifi',
      effectiveType: '4g',
      downlink: 10,
      rtt: 50,
      saveData: false
    });

    mockUseOfflineQueue.mockReturnValue({
      queueSize: 0,
      isProcessing: false,
      lastProcessedAt: null,
      addAction: mockAddAction,
      processQueue: mockProcessQueue,
      clearQueue: mockClearQueue,
      getQueuedActionsByStatus: mockGetQueuedActionsByStatus,
      getProcessingStats: jest.fn().mockReturnValue({
        totalProcessed: 0,
        successCount: 0,
        errorCount: 0,
        averageProcessingTime: 0
      })
    });

    mockAppCache.get.mockResolvedValue(null);
    mockAppCache.set.mockResolvedValue(undefined);
    mockApiCache.get.mockResolvedValue(null);
    mockApiCache.set.mockResolvedValue(undefined);
  });

  describe('Online Behavior', () => {
    it('should create data directly when online', async () => {
      const { result } = renderHook(() => useOfflineFirst('products'));

      const testData = { id: '1', name: 'Test Product', price: 100 };
      
      await act(async () => {
        await result.current.create(testData);
      });

      expect(mockAppCache.set).toHaveBeenCalledWith(
        'products:1',
        expect.objectContaining(testData)
      );
      expect(mockAddAction).toHaveBeenCalledWith({
        type: 'create',
        table: 'products',
        data: testData,
        priority: 'high'
      });
    });

    it('should update data with optimistic updates when online', async () => {
      const existingData = { id: '1', name: 'Old Product', price: 50 };
      mockAppCache.get.mockResolvedValue(existingData);

      const { result } = renderHook(() => useOfflineFirst('products'));

      const updateData = { name: 'Updated Product', price: 150 };
      
      await act(async () => {
        await result.current.update('1', updateData);
      });

      expect(mockAppCache.set).toHaveBeenCalledWith(
        'products:1',
        expect.objectContaining({
          ...existingData,
          ...updateData,
          _lastModified: expect.any(Date),
          _syncStatus: 'pending'
        })
      );
    });

    it('should delete data with optimistic updates when online', async () => {
      const { result } = renderHook(() => useOfflineFirst('products'));
      
      await act(async () => {
        await result.current.delete('1');
      });

      expect(mockAppCache.delete).toHaveBeenCalledWith('products:1');
      expect(mockAddAction).toHaveBeenCalledWith({
        type: 'delete',
        table: 'products',
        id: '1',
        priority: 'high'
      });
    });
  });

  describe('Offline Behavior', () => {
    beforeEach(() => {
      mockUseNetworkStatus.mockReturnValue({
        isOnline: false,
        connectionType: 'none',
        effectiveType: 'slow-2g',
        downlink: 0,
        rtt: 0,
        saveData: true
      });
    });

    it('should queue actions when offline', async () => {
      const { result } = renderHook(() => useOfflineFirst('products'));

      const testData = { id: '1', name: 'Offline Product', price: 200 };
      
      await act(async () => {
        await result.current.create(testData);
      });

      expect(mockAddAction).toHaveBeenCalledWith({
        type: 'create',
        table: 'products',
        data: testData,
        priority: 'high'
      });
      
      // Should still update local cache
      expect(mockAppCache.set).toHaveBeenCalledWith(
        'products:1',
        expect.objectContaining({
          ...testData,
          _syncStatus: 'pending'
        })
      );
    });

    it('should handle offline updates correctly', async () => {
      const existingData = { id: '1', name: 'Existing Product', price: 100 };
      mockAppCache.get.mockResolvedValue(existingData);

      const { result } = renderHook(() => useOfflineFirst('products'));

      const updateData = { price: 250 };
      
      await act(async () => {
        await result.current.update('1', updateData);
      });

      expect(mockAddAction).toHaveBeenCalledWith({
        type: 'update',
        table: 'products',
        id: '1',
        data: updateData,
        priority: 'high'
      });
    });
  });

  describe('Cache Management', () => {
    it('should read from cache first', async () => {
      const cachedData = { id: '1', name: 'Cached Product', price: 300 };
      mockAppCache.get.mockResolvedValue(cachedData);

      const { result } = renderHook(() => useOfflineFirst('products'));
      
      await act(async () => {
        const data = await result.current.read('1');
        expect(data).toEqual(cachedData);
      });

      expect(mockAppCache.get).toHaveBeenCalledWith('products:1');
    });

    it('should handle cache misses gracefully', async () => {
      mockAppCache.get.mockResolvedValue(null);

      const { result } = renderHook(() => useOfflineFirst('products'));
      
      await act(async () => {
        const data = await result.current.read('nonexistent');
        expect(data).toBeNull();
      });
    });

    it('should clear cache when requested', async () => {
      const { result } = renderHook(() => useOfflineFirst('products'));
      
      await act(async () => {
        await result.current.clearCache();
      });

      expect(mockAppCache.clear).toHaveBeenCalled();
    });
  });

  describe('Sync Status', () => {
    it('should track sync status correctly', async () => {
      mockGetQueuedActionsByStatus.mockReturnValue([
        { id: '1', type: 'create', status: 'pending' },
        { id: '2', type: 'update', status: 'pending' }
      ]);

      const { result } = renderHook(() => useOfflineFirst('products'));
      
      expect(result.current.syncStatus.pendingActions).toBe(2);
      expect(result.current.syncStatus.hasPendingChanges).toBe(true);
    });

    it('should indicate when sync is in progress', () => {
      mockUseOfflineQueue.mockReturnValue({
        queueSize: 5,
        isProcessing: true,
        lastProcessedAt: new Date(),
        addAction: mockAddAction,
        processQueue: mockProcessQueue,
        clearQueue: mockClearQueue,
        getQueuedActionsByStatus: mockGetQueuedActionsByStatus,
        getProcessingStats: jest.fn().mockReturnValue({
          totalProcessed: 10,
          successCount: 8,
          errorCount: 2,
          averageProcessingTime: 150
        })
      });

      const { result } = renderHook(() => useOfflineFirst('products'));
      
      expect(result.current.syncStatus.isProcessing).toBe(true);
      expect(result.current.syncStatus.queueSize).toBe(5);
    });
  });

  describe('Error Handling', () => {
    it('should handle cache errors gracefully', async () => {
      const cacheError = new Error('Cache error');
      mockAppCache.get.mockRejectedValue(cacheError);

      const { result } = renderHook(() => useOfflineFirst('products'));
      
      await act(async () => {
        const data = await result.current.read('1');
        expect(data).toBeNull();
      });

      expect(result.current.error).toEqual(cacheError);
    });

    it('should handle queue errors gracefully', async () => {
      const queueError = new Error('Queue error');
      mockAddAction.mockRejectedValue(queueError);

      const { result } = renderHook(() => useOfflineFirst('products'));
      
      await act(async () => {
        await result.current.create({ id: '1', name: 'Test' });
      });

      expect(result.current.error).toEqual(queueError);
    });
  });

  describe('Network State Changes', () => {
    it('should trigger sync when coming back online', async () => {
      // Start offline
      mockUseNetworkStatus.mockReturnValue({
        isOnline: false,
        connectionType: 'none',
        effectiveType: 'slow-2g',
        downlink: 0,
        rtt: 0,
        saveData: true
      });

      const { result, rerender } = renderHook(() => useOfflineFirst('products'));

      // Add some offline actions
      await act(async () => {
        await result.current.create({ id: '1', name: 'Offline Product' });
      });

      // Come back online
      mockUseNetworkStatus.mockReturnValue({
        isOnline: true,
        connectionType: 'wifi',
        effectiveType: '4g',
        downlink: 10,
        rtt: 50,
        saveData: false
      });

      rerender();

      await waitFor(() => {
        expect(mockProcessQueue).toHaveBeenCalled();
      });
    });
  });

  describe('Data Consistency', () => {
    it('should maintain data consistency during concurrent operations', async () => {
      const { result } = renderHook(() => useOfflineFirst('products'));

      const operations = [
        result.current.create({ id: '1', name: 'Product 1', price: 100 }),
        result.current.create({ id: '2', name: 'Product 2', price: 200 }),
        result.current.update('1', { price: 150 })
      ];

      await act(async () => {
        await Promise.all(operations);
      });

      expect(mockAddAction).toHaveBeenCalledTimes(3);
      expect(mockAppCache.set).toHaveBeenCalledTimes(3);
    });
  });
});