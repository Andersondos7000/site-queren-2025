import { renderHook, act, waitFor } from '@testing-library/react';
import { useOfflineQueue } from '../../../hooks/realtime/useOfflineQueue';
import { useNetworkStatus } from '../../../hooks/useNetworkStatus';
import type { OfflineAction, QueuedAction } from '../../../types/realtime';

// Mock dependencies
jest.mock('../../../hooks/useNetworkStatus');

const mockUseNetworkStatus = useNetworkStatus as jest.MockedFunction<typeof useNetworkStatus>;

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

// Mock fetch for API calls
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('useOfflineQueue', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    mockUseNetworkStatus.mockReturnValue({
      isOnline: true,
      connectionType: 'wifi',
      effectiveType: '4g',
      downlink: 10,
      rtt: 50,
      saveData: false
    });

    mockLocalStorage.getItem.mockReturnValue(null);
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true })
    } as Response);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Queue Management', () => {
    it('should initialize with empty queue', () => {
      const { result } = renderHook(() => useOfflineQueue());
      
      expect(result.current.queueSize).toBe(0);
      expect(result.current.isProcessing).toBe(false);
      expect(result.current.lastProcessedAt).toBeNull();
    });

    it('should add actions to queue', async () => {
      const { result } = renderHook(() => useOfflineQueue());
      
      const action: OfflineAction = {
        type: 'create',
        table: 'products',
        data: { id: '1', name: 'Test Product' },
        priority: 'high'
      };

      await act(async () => {
        await result.current.addAction(action);
      });

      expect(result.current.queueSize).toBe(1);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'offline_queue',
        expect.stringContaining('"type":"create"')
      );
    });

    it('should persist queue to localStorage', async () => {
      const { result } = renderHook(() => useOfflineQueue());
      
      const actions: OfflineAction[] = [
        { type: 'create', table: 'products', data: { id: '1' }, priority: 'high' },
        { type: 'update', table: 'products', id: '2', data: { name: 'Updated' }, priority: 'medium' }
      ];

      await act(async () => {
        for (const action of actions) {
          await result.current.addAction(action);
        }
      });

      expect(result.current.queueSize).toBe(2);
      expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(2);
    });

    it('should load queue from localStorage on initialization', () => {
      const savedQueue: QueuedAction[] = [
        {
          id: '1',
          action: { type: 'create', table: 'products', data: { id: '1' }, priority: 'high' },
          status: 'pending',
          createdAt: new Date(),
          attempts: 0
        }
      ];

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(savedQueue));

      const { result } = renderHook(() => useOfflineQueue());
      
      expect(result.current.queueSize).toBe(1);
    });
  });

  describe('Queue Processing', () => {
    it('should process queue when online', async () => {
      const { result } = renderHook(() => useOfflineQueue());
      
      const action: OfflineAction = {
        type: 'create',
        table: 'products',
        data: { id: '1', name: 'Test Product' },
        priority: 'high'
      };

      await act(async () => {
        await result.current.addAction(action);
      });

      await act(async () => {
        await result.current.processQueue();
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/products'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: expect.stringContaining('"id":"1"')
        })
      );
    });

    it('should not process queue when offline', async () => {
      mockUseNetworkStatus.mockReturnValue({
        isOnline: false,
        connectionType: 'none',
        effectiveType: 'slow-2g',
        downlink: 0,
        rtt: 0,
        saveData: true
      });

      const { result } = renderHook(() => useOfflineQueue());
      
      const action: OfflineAction = {
        type: 'create',
        table: 'products',
        data: { id: '1' },
        priority: 'high'
      };

      await act(async () => {
        await result.current.addAction(action);
        await result.current.processQueue();
      });

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result.current.queueSize).toBe(1);
    });

    it('should handle successful processing', async () => {
      const { result } = renderHook(() => useOfflineQueue());
      
      const action: OfflineAction = {
        type: 'update',
        table: 'products',
        id: '1',
        data: { name: 'Updated Product' },
        priority: 'medium'
      };

      await act(async () => {
        await result.current.addAction(action);
        await result.current.processQueue();
      });

      expect(result.current.queueSize).toBe(0);
      expect(result.current.lastProcessedAt).toBeInstanceOf(Date);
    });
  });

  describe('Retry Logic', () => {
    it('should retry failed actions with exponential backoff', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      
      const { result } = renderHook(() => useOfflineQueue());
      
      const action: OfflineAction = {
        type: 'create',
        table: 'products',
        data: { id: '1' },
        priority: 'high'
      };

      await act(async () => {
        await result.current.addAction(action);
        await result.current.processQueue();
      });

      // Should still have the action in queue after first failure
      expect(result.current.queueSize).toBe(1);
      
      const failedActions = result.current.getQueuedActionsByStatus('failed');
      expect(failedActions).toHaveLength(1);
      expect(failedActions[0].attempts).toBe(1);
    });

    it('should implement exponential backoff delays', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      
      const { result } = renderHook(() => useOfflineQueue());
      
      const action: OfflineAction = {
        type: 'create',
        table: 'products',
        data: { id: '1' },
        priority: 'high'
      };

      await act(async () => {
        await result.current.addAction(action);
      });

      // First attempt
      await act(async () => {
        await result.current.processQueue();
      });

      // Fast forward 1 second (base delay)
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      // Second attempt should happen after 2 seconds (exponential backoff)
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });
    });

    it('should give up after max retry attempts', async () => {
      mockFetch.mockRejectedValue(new Error('Persistent error'));
      
      const { result } = renderHook(() => useOfflineQueue({
        maxRetries: 2,
        baseDelay: 100
      }));
      
      const action: OfflineAction = {
        type: 'create',
        table: 'products',
        data: { id: '1' },
        priority: 'high'
      };

      await act(async () => {
        await result.current.addAction(action);
      });

      // Process multiple times to exceed max retries
      for (let i = 0; i < 3; i++) {
        await act(async () => {
          await result.current.processQueue();
        });
        
        act(() => {
          jest.advanceTimersByTime(1000 * Math.pow(2, i));
        });
      }

      const failedActions = result.current.getQueuedActionsByStatus('failed');
      expect(failedActions).toHaveLength(1);
      expect(failedActions[0].attempts).toBe(3);
    });
  });

  describe('Priority Handling', () => {
    it('should process high priority actions first', async () => {
      const { result } = renderHook(() => useOfflineQueue());
      
      const actions: OfflineAction[] = [
        { type: 'create', table: 'products', data: { id: '1' }, priority: 'low' },
        { type: 'create', table: 'products', data: { id: '2' }, priority: 'high' },
        { type: 'create', table: 'products', data: { id: '3' }, priority: 'medium' }
      ];

      await act(async () => {
        for (const action of actions) {
          await result.current.addAction(action);
        }
      });

      await act(async () => {
        await result.current.processQueue();
      });

      // Verify that high priority action was processed first
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining('"id":"2"')
        })
      );
    });
  });

  describe('Queue Filtering and Management', () => {
    it('should filter actions by status', async () => {
      const { result } = renderHook(() => useOfflineQueue());
      
      const actions: OfflineAction[] = [
        { type: 'create', table: 'products', data: { id: '1' }, priority: 'high' },
        { type: 'create', table: 'products', data: { id: '2' }, priority: 'medium' }
      ];

      await act(async () => {
        for (const action of actions) {
          await result.current.addAction(action);
        }
      });

      const pendingActions = result.current.getQueuedActionsByStatus('pending');
      expect(pendingActions).toHaveLength(2);

      const completedActions = result.current.getQueuedActionsByStatus('completed');
      expect(completedActions).toHaveLength(0);
    });

    it('should clear completed actions from queue', async () => {
      const { result } = renderHook(() => useOfflineQueue());
      
      const action: OfflineAction = {
        type: 'create',
        table: 'products',
        data: { id: '1' },
        priority: 'high'
      };

      await act(async () => {
        await result.current.addAction(action);
        await result.current.processQueue();
      });

      // Action should be processed and removed from queue
      expect(result.current.queueSize).toBe(0);
    });

    it('should clear entire queue when requested', async () => {
      const { result } = renderHook(() => useOfflineQueue());
      
      const actions: OfflineAction[] = [
        { type: 'create', table: 'products', data: { id: '1' }, priority: 'high' },
        { type: 'update', table: 'products', id: '2', data: { name: 'Test' }, priority: 'medium' }
      ];

      await act(async () => {
        for (const action of actions) {
          await result.current.addAction(action);
        }
      });

      expect(result.current.queueSize).toBe(2);

      await act(async () => {
        await result.current.clearQueue();
      });

      expect(result.current.queueSize).toBe(0);
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('offline_queue');
    });
  });

  describe('Processing Statistics', () => {
    it('should track processing statistics', async () => {
      const { result } = renderHook(() => useOfflineQueue());
      
      const actions: OfflineAction[] = [
        { type: 'create', table: 'products', data: { id: '1' }, priority: 'high' },
        { type: 'create', table: 'products', data: { id: '2' }, priority: 'medium' }
      ];

      await act(async () => {
        for (const action of actions) {
          await result.current.addAction(action);
        }
        await result.current.processQueue();
      });

      const stats = result.current.getProcessingStats();
      expect(stats.totalProcessed).toBe(2);
      expect(stats.successCount).toBe(2);
      expect(stats.errorCount).toBe(0);
      expect(stats.averageProcessingTime).toBeGreaterThan(0);
    });

    it('should track error statistics', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      
      const { result } = renderHook(() => useOfflineQueue({
        maxRetries: 1
      }));
      
      const action: OfflineAction = {
        type: 'create',
        table: 'products',
        data: { id: '1' },
        priority: 'high'
      };

      await act(async () => {
        await result.current.addAction(action);
        await result.current.processQueue();
      });

      // Advance time to trigger retry
      act(() => {
        jest.advanceTimersByTime(2000);
      });

      await act(async () => {
        await result.current.processQueue();
      });

      const stats = result.current.getProcessingStats();
      expect(stats.errorCount).toBeGreaterThan(0);
    });
  });

  describe('Network State Integration', () => {
    it('should automatically process queue when coming online', async () => {
      // Start offline
      mockUseNetworkStatus.mockReturnValue({
        isOnline: false,
        connectionType: 'none',
        effectiveType: 'slow-2g',
        downlink: 0,
        rtt: 0,
        saveData: true
      });

      const { result, rerender } = renderHook(() => useOfflineQueue());
      
      const action: OfflineAction = {
        type: 'create',
        table: 'products',
        data: { id: '1' },
        priority: 'high'
      };

      await act(async () => {
        await result.current.addAction(action);
      });

      expect(result.current.queueSize).toBe(1);
      expect(mockFetch).not.toHaveBeenCalled();

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
        expect(mockFetch).toHaveBeenCalled();
      });
    });
  });
});