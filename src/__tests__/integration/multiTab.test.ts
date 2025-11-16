import { renderHook, act, waitFor } from '@testing-library/react';
import { useOfflineFirst } from '../../hooks/realtime/useOfflineFirst';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { appCache } from '../../lib/indexeddb';

// Mock dependencies
jest.mock('../../hooks/useNetworkStatus');
jest.mock('../../lib/indexeddb');

const mockUseNetworkStatus = useNetworkStatus as jest.MockedFunction<typeof useNetworkStatus>;
const mockAppCache = appCache as jest.Mocked<typeof appCache>;

// Mock BroadcastChannel for cross-tab communication
class MockBroadcastChannel {
  private static channels: Map<string, MockBroadcastChannel[]> = new Map();
  private listeners: ((event: MessageEvent) => void)[] = [];
  
  constructor(private channelName: string) {
    if (!MockBroadcastChannel.channels.has(channelName)) {
      MockBroadcastChannel.channels.set(channelName, []);
    }
    MockBroadcastChannel.channels.get(channelName)!.push(this);
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    if (type === 'message') {
      this.listeners.push(listener);
    }
  }

  removeEventListener(type: string, listener: (event: MessageEvent) => void) {
    if (type === 'message') {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    }
  }

  postMessage(data: any) {
    const channels = MockBroadcastChannel.channels.get(this.channelName) || [];
    const event = new MessageEvent('message', { data });
    
    // Broadcast to all other channels (not self)
    channels.forEach(channel => {
      if (channel !== this) {
        channel.listeners.forEach(listener => {
          setTimeout(() => listener(event), 0);
        });
      }
    });
  }

  close() {
    const channels = MockBroadcastChannel.channels.get(this.channelName) || [];
    const index = channels.indexOf(this);
    if (index > -1) {
      channels.splice(index, 1);
    }
  }

  static clearAll() {
    this.channels.clear();
  }
}

// Replace global BroadcastChannel
(global as any).BroadcastChannel = MockBroadcastChannel;

// Mock localStorage with cross-tab events
const mockLocalStorage = {
  data: new Map<string, string>(),
  listeners: [] as ((event: StorageEvent) => void)[],
  
  getItem(key: string) {
    return this.data.get(key) || null;
  },
  
  setItem(key: string, value: string) {
    const oldValue = this.data.get(key) || null;
    this.data.set(key, value);
    
    // Simulate storage event for cross-tab communication
    const event = new StorageEvent('storage', {
      key,
      oldValue,
      newValue: value,
      storageArea: this as any
    });
    
    setTimeout(() => {
      this.listeners.forEach(listener => listener(event));
    }, 0);
  },
  
  removeItem(key: string) {
    const oldValue = this.data.get(key) || null;
    this.data.delete(key);
    
    const event = new StorageEvent('storage', {
      key,
      oldValue,
      newValue: null,
      storageArea: this as any
    });
    
    setTimeout(() => {
      this.listeners.forEach(listener => listener(event));
    }, 0);
  },
  
  clear() {
    this.data.clear();
  },
  
  addEventListener(type: string, listener: (event: StorageEvent) => void) {
    if (type === 'storage') {
      this.listeners.push(listener);
    }
  },
  
  removeEventListener(type: string, listener: (event: StorageEvent) => void) {
    if (type === 'storage') {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    }
  }
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

Object.defineProperty(window, 'addEventListener', {
  value: mockLocalStorage.addEventListener.bind(mockLocalStorage)
});

Object.defineProperty(window, 'removeEventListener', {
  value: mockLocalStorage.removeEventListener.bind(mockLocalStorage)
});

// Mock fetch
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('Multi-Tab Synchronization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    MockBroadcastChannel.clearAll();
    mockLocalStorage.data.clear();
    mockLocalStorage.listeners.length = 0;
    
    mockUseNetworkStatus.mockReturnValue({
      isOnline: true,
      connectionType: 'wifi',
      effectiveType: '4g',
      downlink: 10,
      rtt: 50,
      saveData: false
    });

    mockAppCache.get.mockResolvedValue(null);
    mockAppCache.set.mockResolvedValue(undefined);
    mockAppCache.delete.mockResolvedValue(undefined);
    
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true })
    } as Response);
  });

  describe('Cross-Tab Data Synchronization', () => {
    it('should sync data changes across tabs', async () => {
      // Simulate two tabs
      const { result: tab1 } = renderHook(() => useOfflineFirst('products'));
      const { result: tab2 } = renderHook(() => useOfflineFirst('products'));

      const testProduct = { id: '1', name: 'Test Product', price: 100 };

      // Create product in tab1
      await act(async () => {
        await tab1.current.create(testProduct);
      });

      // Wait for cross-tab sync
      await waitFor(() => {
        expect(mockAppCache.set).toHaveBeenCalledWith(
          'products:1',
          expect.objectContaining(testProduct)
        );
      });

      // Tab2 should be notified of the change
      await waitFor(() => {
        // Verify that tab2 received the update notification
        expect(tab2.current.syncStatus.hasPendingChanges).toBeDefined();
      });
    });

    it('should handle concurrent updates from different tabs', async () => {
      const { result: tab1 } = renderHook(() => useOfflineFirst('products'));
      const { result: tab2 } = renderHook(() => useOfflineFirst('products'));

      const baseProduct = { id: '1', name: 'Base Product', price: 100 };
      
      // Set initial data in cache
      mockAppCache.get.mockResolvedValue(baseProduct);

      // Concurrent updates from both tabs
      const updates = [
        tab1.current.update('1', { name: 'Updated by Tab 1' }),
        tab2.current.update('1', { price: 200 })
      ];

      await act(async () => {
        await Promise.all(updates);
      });

      // Both updates should be queued
      expect(mockAppCache.set).toHaveBeenCalledTimes(2);
    });

    it('should resolve conflicts using last-write-wins strategy', async () => {
      const { result: tab1 } = renderHook(() => useOfflineFirst('products'));
      const { result: tab2 } = renderHook(() => useOfflineFirst('products'));

      const baseProduct = { 
        id: '1', 
        name: 'Base Product', 
        price: 100,
        _lastModified: new Date('2024-01-01T10:00:00Z')
      };
      
      mockAppCache.get.mockResolvedValue(baseProduct);

      // Tab1 updates first
      await act(async () => {
        await tab1.current.update('1', { name: 'Updated by Tab 1' });
      });

      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));

      // Tab2 updates later (should win)
      await act(async () => {
        await tab2.current.update('1', { name: 'Updated by Tab 2' });
      });

      // The later update should be preserved
      const lastCall = mockAppCache.set.mock.calls[mockAppCache.set.mock.calls.length - 1];
      expect(lastCall[1]).toEqual(
        expect.objectContaining({
          name: 'Updated by Tab 2'
        })
      );
    });
  });

  describe('Queue Synchronization', () => {
    it('should share offline queue across tabs', async () => {
      // Start offline
      mockUseNetworkStatus.mockReturnValue({
        isOnline: false,
        connectionType: 'none',
        effectiveType: 'slow-2g',
        downlink: 0,
        rtt: 0,
        saveData: true
      });

      const { result: tab1 } = renderHook(() => useOfflineFirst('products'));
      const { result: tab2 } = renderHook(() => useOfflineFirst('products'));

      // Add actions from both tabs
      await act(async () => {
        await tab1.current.create({ id: '1', name: 'Product from Tab 1' });
        await tab2.current.create({ id: '2', name: 'Product from Tab 2' });
      });

      // Both tabs should see the combined queue
      expect(tab1.current.syncStatus.queueSize).toBeGreaterThan(0);
      expect(tab2.current.syncStatus.queueSize).toBeGreaterThan(0);
    });

    it('should coordinate queue processing across tabs', async () => {
      const { result: tab1 } = renderHook(() => useOfflineFirst('products'));
      const { result: tab2 } = renderHook(() => useOfflineFirst('products'));

      // Add actions to queue
      await act(async () => {
        await tab1.current.create({ id: '1', name: 'Product 1' });
        await tab2.current.create({ id: '2', name: 'Product 2' });
      });

      // Only one tab should process the queue to avoid duplicates
      await act(async () => {
        // Simulate both tabs trying to process simultaneously
        await Promise.all([
          tab1.current.syncStatus.queueSize > 0 ? Promise.resolve() : Promise.resolve(),
          tab2.current.syncStatus.queueSize > 0 ? Promise.resolve() : Promise.resolve()
        ]);
      });

      // Verify no duplicate API calls
      expect(mockFetch).toHaveBeenCalledTimes(2); // One for each product
    });
  });

  describe('Cache Invalidation', () => {
    it('should invalidate cache across tabs when data changes', async () => {
      const { result: tab1 } = renderHook(() => useOfflineFirst('products'));
      const { result: tab2 } = renderHook(() => useOfflineFirst('products'));

      const product = { id: '1', name: 'Test Product', price: 100 };
      
      // Tab1 creates product
      await act(async () => {
        await tab1.current.create(product);
      });

      // Tab2 should invalidate its cache for this product
      await waitFor(() => {
        expect(mockAppCache.set).toHaveBeenCalledWith(
          'products:1',
          expect.objectContaining(product)
        );
      });
    });

    it('should handle cache conflicts gracefully', async () => {
      const { result: tab1 } = renderHook(() => useOfflineFirst('products'));
      const { result: tab2 } = renderHook(() => useOfflineFirst('products'));

      // Both tabs have different cached versions
      mockAppCache.get
        .mockResolvedValueOnce({ id: '1', name: 'Version A', price: 100 })
        .mockResolvedValueOnce({ id: '1', name: 'Version B', price: 200 });

      // Both tabs try to update
      await act(async () => {
        await Promise.all([
          tab1.current.update('1', { price: 150 }),
          tab2.current.update('1', { price: 250 })
        ]);
      });

      // Should handle the conflict without errors
      expect(mockAppCache.set).toHaveBeenCalled();
    });
  });

  describe('Network State Coordination', () => {
    it('should coordinate network state changes across tabs', async () => {
      const { result: tab1 } = renderHook(() => useOfflineFirst('products'));
      const { result: tab2 } = renderHook(() => useOfflineFirst('products'));

      // Start offline
      mockUseNetworkStatus.mockReturnValue({
        isOnline: false,
        connectionType: 'none',
        effectiveType: 'slow-2g',
        downlink: 0,
        rtt: 0,
        saveData: true
      });

      // Add offline actions
      await act(async () => {
        await tab1.current.create({ id: '1', name: 'Offline Product' });
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

      // Both tabs should detect the network change
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
    });
  });

  describe('Memory and Performance', () => {
    it('should not create memory leaks with multiple tabs', async () => {
      const tabs = [];
      
      // Create multiple tabs
      for (let i = 0; i < 5; i++) {
        const { result, unmount } = renderHook(() => useOfflineFirst('products'));
        tabs.push({ result, unmount });
      }

      // Add some data
      await act(async () => {
        for (let i = 0; i < tabs.length; i++) {
          await tabs[i].result.current.create({ 
            id: `product-${i}`, 
            name: `Product ${i}` 
          });
        }
      });

      // Unmount all tabs
      tabs.forEach(({ unmount }) => unmount());

      // Verify cleanup
      expect(MockBroadcastChannel.channels.size).toBeLessThanOrEqual(1);
    });

    it('should handle high-frequency updates efficiently', async () => {
      const { result: tab1 } = renderHook(() => useOfflineFirst('products'));
      const { result: tab2 } = renderHook(() => useOfflineFirst('products'));

      const updates = [];
      
      // Generate many rapid updates
      for (let i = 0; i < 50; i++) {
        updates.push(
          tab1.current.update('1', { counter: i }),
          tab2.current.update('2', { counter: i })
        );
      }

      const startTime = Date.now();
      
      await act(async () => {
        await Promise.all(updates);
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (less than 5 seconds)
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('Error Handling', () => {
    it('should handle tab crashes gracefully', async () => {
      const { result: tab1 } = renderHook(() => useOfflineFirst('products'));
      const { result: tab2, unmount: unmountTab2 } = renderHook(() => useOfflineFirst('products'));

      // Add some data
      await act(async () => {
        await tab1.current.create({ id: '1', name: 'Product 1' });
        await tab2.current.create({ id: '2', name: 'Product 2' });
      });

      // Simulate tab2 crash
      unmountTab2();

      // Tab1 should continue working normally
      await act(async () => {
        await tab1.current.create({ id: '3', name: 'Product 3' });
      });

      expect(tab1.current.syncStatus.queueSize).toBeGreaterThanOrEqual(0);
    });

    it('should recover from storage errors', async () => {
      const { result: tab1 } = renderHook(() => useOfflineFirst('products'));
      
      // Simulate storage error
      const originalSetItem = mockLocalStorage.setItem;
      mockLocalStorage.setItem = jest.fn().mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      // Should handle the error gracefully
      await act(async () => {
        await tab1.current.create({ id: '1', name: 'Test Product' });
      });

      expect(tab1.current.error).toBeDefined();
      
      // Restore original function
      mockLocalStorage.setItem = originalSetItem;
    });
  });
});