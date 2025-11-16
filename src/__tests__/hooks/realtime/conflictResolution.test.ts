import { renderHook, act } from '@testing-library/react';
import { useOfflineFirst } from '../../../hooks/realtime/useOfflineFirst';
import { useNetworkStatus } from '../../../hooks/useNetworkStatus';
import { ConflictResolutionStrategy, DataConflict } from '../../../types/realtime';
import { appCache } from '../../../lib/indexeddb';

// Mock dependencies
jest.mock('../../../hooks/useNetworkStatus');
jest.mock('../../../lib/indexeddb');

const mockUseNetworkStatus = useNetworkStatus as jest.MockedFunction<typeof useNetworkStatus>;
const mockAppCache = appCache as jest.Mocked<typeof appCache>;

describe('Conflict Resolution Tests', () => {
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

  describe('Conflict Detection', () => {
    it('should detect version conflicts correctly', async () => {
      const { result } = renderHook(() => useOfflineFirst({
        table: 'products',
        primaryKey: 'id',
        conflictResolution: 'manual'
      }));

      // Simulate local data
      const localData = {
        id: 'product-1',
        name: 'Local Product',
        price: 100,
        version: 1,
        lastModified: Date.now() - 1000
      };

      // Simulate server data with different version
      const serverData = {
        id: 'product-1',
        name: 'Server Product',
        price: 150,
        version: 2,
        lastModified: Date.now()
      };

      mockAppCache.get.mockResolvedValue(localData);

      await act(async () => {
        // Simulate server response with conflict
        result.current.handleServerResponse(serverData);
      });

      expect(result.current.conflicts).toHaveLength(1);
      expect(result.current.conflicts[0]).toMatchObject({
        id: 'product-1',
        localData,
        serverData,
        type: 'version_mismatch'
      });
    });

    it('should detect timestamp conflicts', async () => {
      const { result } = renderHook(() => useOfflineFirst({
        table: 'products',
        primaryKey: 'id',
        conflictResolution: 'timestamp'
      }));

      const baseTime = Date.now();
      
      const localData = {
        id: 'product-1',
        name: 'Local Product',
        price: 100,
        lastModified: baseTime + 1000 // Local is newer
      };

      const serverData = {
        id: 'product-1',
        name: 'Server Product',
        price: 150,
        lastModified: baseTime // Server is older
      };

      mockAppCache.get.mockResolvedValue(localData);

      await act(async () => {
        result.current.handleServerResponse(serverData);
      });

      // Should resolve automatically with local data (newer)
      expect(result.current.data.find(item => item.id === 'product-1')?.name)
        .toBe('Local Product');
    });

    it('should detect concurrent modification conflicts', async () => {
      const { result } = renderHook(() => useOfflineFirst({
        table: 'products',
        primaryKey: 'id',
        conflictResolution: 'manual'
      }));

      const baseTime = Date.now();
      
      // Both modified within conflict window (5 seconds)
      const localData = {
        id: 'product-1',
        name: 'Local Product',
        price: 100,
        lastModified: baseTime
      };

      const serverData = {
        id: 'product-1',
        name: 'Server Product',
        price: 150,
        lastModified: baseTime + 2000 // Within conflict window
      };

      mockAppCache.get.mockResolvedValue(localData);

      await act(async () => {
        result.current.handleServerResponse(serverData);
      });

      expect(result.current.conflicts).toHaveLength(1);
      expect(result.current.conflicts[0].type).toBe('concurrent_modification');
    });
  });

  describe('Automatic Resolution Strategies', () => {
    it('should resolve conflicts using server-wins strategy', async () => {
      const { result } = renderHook(() => useOfflineFirst({
        table: 'products',
        primaryKey: 'id',
        conflictResolution: 'server_wins'
      }));

      const localData = {
        id: 'product-1',
        name: 'Local Product',
        price: 100
      };

      const serverData = {
        id: 'product-1',
        name: 'Server Product',
        price: 150
      };

      mockAppCache.get.mockResolvedValue(localData);

      await act(async () => {
        result.current.handleServerResponse(serverData);
      });

      // Should use server data
      expect(result.current.data.find(item => item.id === 'product-1')?.name)
        .toBe('Server Product');
      expect(result.current.conflicts).toHaveLength(0);
    });

    it('should resolve conflicts using client-wins strategy', async () => {
      const { result } = renderHook(() => useOfflineFirst({
        table: 'products',
        primaryKey: 'id',
        conflictResolution: 'client_wins'
      }));

      const localData = {
        id: 'product-1',
        name: 'Local Product',
        price: 100
      };

      const serverData = {
        id: 'product-1',
        name: 'Server Product',
        price: 150
      };

      mockAppCache.get.mockResolvedValue(localData);

      await act(async () => {
        result.current.handleServerResponse(serverData);
      });

      // Should use local data
      expect(result.current.data.find(item => item.id === 'product-1')?.name)
        .toBe('Local Product');
      expect(result.current.conflicts).toHaveLength(0);
    });

    it('should resolve conflicts using merge strategy', async () => {
      const { result } = renderHook(() => useOfflineFirst({
        table: 'products',
        primaryKey: 'id',
        conflictResolution: 'merge',
        mergeStrategy: (local: any, server: any) => ({
          ...server,
          name: local.name, // Keep local name
          price: Math.max(local.price, server.price) // Use higher price
        })
      }));

      const localData = {
        id: 'product-1',
        name: 'Local Product',
        price: 200,
        description: 'Local description'
      };

      const serverData = {
        id: 'product-1',
        name: 'Server Product',
        price: 150,
        category: 'Server category'
      };

      mockAppCache.get.mockResolvedValue(localData);

      await act(async () => {
        result.current.handleServerResponse(serverData);
      });

      const mergedData = result.current.data.find(item => item.id === 'product-1');
      expect(mergedData?.name).toBe('Local Product'); // From local
      expect(mergedData?.price).toBe(200); // Max of both
      expect(mergedData?.category).toBe('Server category'); // From server
    });
  });

  describe('Manual Conflict Resolution', () => {
    it('should allow manual resolution of conflicts', async () => {
      const { result } = renderHook(() => useOfflineFirst({
        table: 'products',
        primaryKey: 'id',
        conflictResolution: 'manual'
      }));

      const localData = {
        id: 'product-1',
        name: 'Local Product',
        price: 100
      };

      const serverData = {
        id: 'product-1',
        name: 'Server Product',
        price: 150
      };

      mockAppCache.get.mockResolvedValue(localData);

      await act(async () => {
        result.current.handleServerResponse(serverData);
      });

      expect(result.current.conflicts).toHaveLength(1);

      // Manually resolve conflict
      await act(async () => {
        result.current.resolveConflict('product-1', {
          id: 'product-1',
          name: 'Manually Resolved Product',
          price: 125 // Average of both
        });
      });

      expect(result.current.conflicts).toHaveLength(0);
      expect(result.current.data.find(item => item.id === 'product-1')?.name)
        .toBe('Manually Resolved Product');
    });

    it('should handle batch conflict resolution', async () => {
      const { result } = renderHook(() => useOfflineFirst({
        table: 'products',
        primaryKey: 'id',
        conflictResolution: 'manual'
      }));

      // Create multiple conflicts
      const conflicts = [
        {
          local: { id: 'product-1', name: 'Local 1', price: 100 },
          server: { id: 'product-1', name: 'Server 1', price: 150 }
        },
        {
          local: { id: 'product-2', name: 'Local 2', price: 200 },
          server: { id: 'product-2', name: 'Server 2', price: 250 }
        }
      ];

      for (const conflict of conflicts) {
        mockAppCache.get.mockResolvedValueOnce(conflict.local);
        await act(async () => {
          result.current.handleServerResponse(conflict.server);
        });
      }

      expect(result.current.conflicts).toHaveLength(2);

      // Resolve all conflicts at once
      await act(async () => {
        result.current.resolveAllConflicts('server_wins');
      });

      expect(result.current.conflicts).toHaveLength(0);
      expect(result.current.data.find(item => item.id === 'product-1')?.name)
        .toBe('Server 1');
      expect(result.current.data.find(item => item.id === 'product-2')?.name)
        .toBe('Server 2');
    });
  });

  describe('Complex Conflict Scenarios', () => {
    it('should handle three-way conflicts (local, server, cache)', async () => {
      const { result } = renderHook(() => useOfflineFirst({
        table: 'products',
        primaryKey: 'id',
        conflictResolution: 'manual'
      }));

      const cacheData = {
        id: 'product-1',
        name: 'Cache Product',
        price: 75,
        lastModified: Date.now() - 2000
      };

      const localData = {
        id: 'product-1',
        name: 'Local Product',
        price: 100,
        lastModified: Date.now() - 1000
      };

      const serverData = {
        id: 'product-1',
        name: 'Server Product',
        price: 150,
        lastModified: Date.now()
      };

      mockAppCache.get.mockResolvedValue(cacheData);

      await act(async () => {
        // Simulate local modification
        await result.current.update('product-1', localData);
        // Then server response
        result.current.handleServerResponse(serverData);
      });

      expect(result.current.conflicts).toHaveLength(1);
      expect(result.current.conflicts[0].type).toBe('three_way_conflict');
    });

    it('should handle field-level conflicts', async () => {
      const { result } = renderHook(() => useOfflineFirst({
        table: 'products',
        primaryKey: 'id',
        conflictResolution: 'field_level',
        fieldConflictStrategy: {
          name: 'client_wins',
          price: 'server_wins',
          description: 'merge'
        }
      }));

      const localData = {
        id: 'product-1',
        name: 'Local Product',
        price: 100,
        description: 'Local description'
      };

      const serverData = {
        id: 'product-1',
        name: 'Server Product',
        price: 150,
        description: 'Server description'
      };

      mockAppCache.get.mockResolvedValue(localData);

      await act(async () => {
        result.current.handleServerResponse(serverData);
      });

      const resolvedData = result.current.data.find(item => item.id === 'product-1');
      expect(resolvedData?.name).toBe('Local Product'); // client_wins
      expect(resolvedData?.price).toBe(150); // server_wins
      expect(resolvedData?.description).toBe('Local description; Server description'); // merged
    });

    it('should handle cascading conflicts', async () => {
      const { result } = renderHook(() => useOfflineFirst({
        table: 'products',
        primaryKey: 'id',
        conflictResolution: 'manual'
      }));

      // Product with category reference
      const localProduct = {
        id: 'product-1',
        name: 'Local Product',
        categoryId: 'category-1',
        price: 100
      };

      const serverProduct = {
        id: 'product-1',
        name: 'Server Product',
        categoryId: 'category-2', // Different category
        price: 150
      };

      mockAppCache.get.mockResolvedValue(localProduct);

      await act(async () => {
        result.current.handleServerResponse(serverProduct);
      });

      expect(result.current.conflicts).toHaveLength(1);
      
      // Resolving should check for cascading effects
      const conflict = result.current.conflicts[0];
      expect(conflict.cascadingFields).toContain('categoryId');
    });
  });

  describe('Conflict Resolution Performance', () => {
    it('should handle large numbers of conflicts efficiently', async () => {
      const { result } = renderHook(() => useOfflineFirst({
        table: 'products',
        primaryKey: 'id',
        conflictResolution: 'manual'
      }));

      const startTime = performance.now();

      // Create 100 conflicts
      await act(async () => {
        for (let i = 0; i < 100; i++) {
          const localData = {
            id: `product-${i}`,
            name: `Local Product ${i}`,
            price: i * 10
          };

          const serverData = {
            id: `product-${i}`,
            name: `Server Product ${i}`,
            price: i * 15
          };

          mockAppCache.get.mockResolvedValueOnce(localData);
          result.current.handleServerResponse(serverData);
        }
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result.current.conflicts).toHaveLength(100);
      expect(duration).toBeLessThan(1000); // Should be fast
    });

    it('should batch conflict resolution operations', async () => {
      let resolutionOperations = 0;
      const mockResolve = jest.fn().mockImplementation(() => {
        resolutionOperations++;
        return Promise.resolve();
      });

      const { result } = renderHook(() => useOfflineFirst({
        table: 'products',
        primaryKey: 'id',
        conflictResolution: 'manual',
        onConflictResolved: mockResolve
      }));

      // Create multiple conflicts
      await act(async () => {
        for (let i = 0; i < 10; i++) {
          const localData = { id: `product-${i}`, name: `Local ${i}` };
          const serverData = { id: `product-${i}`, name: `Server ${i}` };
          
          mockAppCache.get.mockResolvedValueOnce(localData);
          result.current.handleServerResponse(serverData);
        }
      });

      // Resolve all at once
      await act(async () => {
        result.current.resolveAllConflicts('server_wins');
      });

      // Should batch operations
      expect(resolutionOperations).toBeLessThan(5);
    });
  });

  describe('Conflict Resolution Edge Cases', () => {
    it('should handle conflicts during offline mode', async () => {
      mockUseNetworkStatus.mockReturnValue({
        isOnline: false,
        connectionType: 'none',
        effectiveType: 'slow-2g',
        downlink: 0,
        rtt: 0,
        saveData: false
      });

      const { result } = renderHook(() => useOfflineFirst({
        table: 'products',
        primaryKey: 'id',
        conflictResolution: 'manual'
      }));

      await act(async () => {
        // Modify data while offline
        await result.current.update('product-1', {
          name: 'Offline Product',
          price: 100
        });
      });

      // Go back online with conflicting server data
      mockUseNetworkStatus.mockReturnValue({
        isOnline: true,
        connectionType: 'wifi',
        effectiveType: '4g',
        downlink: 10,
        rtt: 50,
        saveData: false
      });

      await act(async () => {
        result.current.handleServerResponse({
          id: 'product-1',
          name: 'Server Product',
          price: 150
        });
      });

      expect(result.current.conflicts).toHaveLength(1);
    });

    it('should handle malformed conflict data gracefully', async () => {
      const { result } = renderHook(() => useOfflineFirst({
        table: 'products',
        primaryKey: 'id',
        conflictResolution: 'manual'
      }));

      await act(async () => {
        // Simulate malformed server response
        result.current.handleServerResponse({
          id: 'product-1',
          // Missing required fields
        });
      });

      // Should not crash and handle gracefully
      expect(result.current.error).toBeNull();
    });
  });
});