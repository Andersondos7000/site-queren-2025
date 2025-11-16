import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useOfflineSync } from '../../hooks/realtime/useOfflineSync';
import type { OfflineAction, SyncStatus } from '../../types/realtime';

// Mock do Supabase
const mockSupabaseClient = {
  from: vi.fn(() => ({
    select: vi.fn().mockResolvedValue({ data: [], error: null }),
    insert: vi.fn().mockResolvedValue({ data: [{ id: 'new-id' }], error: null }),
    update: vi.fn().mockResolvedValue({ data: [{ id: 'updated-id' }], error: null }),
    delete: vi.fn().mockResolvedValue({ data: [], error: null }),
    upsert: vi.fn().mockResolvedValue({ data: [], error: null }),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis()
  })),
  channel: vi.fn(() => ({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockResolvedValue({ status: 'SUBSCRIBED' }),
    unsubscribe: vi.fn().mockResolvedValue({ status: 'CLOSED' })
  }))
};

vi.mock('../../lib/supabase', () => ({
  supabase: mockSupabaseClient
}));

// Mock do RealtimeContext
const mockRealtimeContext = {
  isOnline: true,
  syncStatus: 'idle' as SyncStatus,
  offlineQueue: [],
  addToOfflineQueue: vi.fn(),
  processOfflineQueue: vi.fn(),
  clearOfflineQueue: vi.fn(),
  syncMetrics: {
    lastSyncAt: null,
    pendingActions: 0,
    syncErrors: 0,
    successfulSyncs: 0
  },
  updateSyncMetrics: vi.fn()
};

vi.mock('../../contexts/RealtimeContext', () => ({
  useRealtimeContext: () => mockRealtimeContext
}));

// Mock do useOfflineQueue
const mockOfflineQueue = {
  queue: [],
  addAction: vi.fn(),
  processQueue: vi.fn(),
  clearQueue: vi.fn(),
  removeAction: vi.fn(),
  getActionsByTable: vi.fn(() => []),
  isProcessing: false,
  lastProcessedAt: null
};

vi.mock('../../hooks/realtime/useOfflineQueue', () => ({
  useOfflineQueue: () => mockOfflineQueue
}));

// Mock de notificações
const mockShowNotification = vi.fn();
vi.mock('../../hooks/useNotification', () => ({
  useNotification: () => ({
    showNotification: mockShowNotification
  })
}));

// Mock do localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

// Mock de dados de teste
const mockProductData = {
  id: 'prod-123',
  name: 'Produto Teste',
  price: 29.99,
  category_id: 'cat-1',
  created_at: '2024-01-15T10:00:00Z',
  updated_at: '2024-01-15T10:00:00Z'
};

const mockOfflineAction: OfflineAction = {
  id: 'action-1',
  type: 'INSERT',
  table: 'products',
  data: mockProductData,
  timestamp: new Date('2024-01-15T10:05:00Z'),
  status: 'pending',
  retryCount: 0,
  priority: 1
};

// Mock do navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true
});

// Mock de eventos de rede
const mockAddEventListener = vi.fn();
const mockRemoveEventListener = vi.fn();
Object.defineProperty(window, 'addEventListener', {
  value: mockAddEventListener
});
Object.defineProperty(window, 'removeEventListener', {
  value: mockRemoveEventListener
});

describe('useOfflineSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRealtimeContext.isOnline = true;
    mockRealtimeContext.syncStatus = 'idle';
    mockRealtimeContext.offlineQueue = [];
    mockOfflineQueue.queue = [];
    mockOfflineQueue.isProcessing = false;
    navigator.onLine = true;
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Inicialização', () => {
    it('deve inicializar com configuração padrão', () => {
      const { result } = renderHook(() => useOfflineSync('products'));

      expect(result.current.isOnline).toBe(true);
      expect(result.current.syncStatus).toBe('idle');
      expect(result.current.pendingActions).toBe(0);
      expect(result.current.lastSyncAt).toBeNull();
    });

    it('deve inicializar com configuração customizada', () => {
      const config = {
        syncInterval: 10000,
        maxRetries: 5,
        batchSize: 20,
        enableAutoSync: false
      };

      const { result } = renderHook(() => useOfflineSync('products', config));

      expect(result.current.isOnline).toBe(true);
      expect(result.current.syncStatus).toBe('idle');
    });

    it('deve detectar status offline inicial', () => {
      navigator.onLine = false;
      mockRealtimeContext.isOnline = false;

      const { result } = renderHook(() => useOfflineSync('products'));

      expect(result.current.isOnline).toBe(false);
    });

    it('deve carregar dados do localStorage na inicialização', () => {
      const savedData = JSON.stringify([mockProductData]);
      mockLocalStorage.getItem.mockReturnValue(savedData);

      const { result } = renderHook(() => useOfflineSync('products'));

      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('offline_sync_products');
      expect(result.current.localData).toEqual([mockProductData]);
    });

    it('deve configurar listeners de eventos de rede', () => {
      renderHook(() => useOfflineSync('products'));

      expect(mockAddEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(mockAddEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
    });
  });

  describe('Detecção de Conectividade', () => {
    it('deve detectar mudança para offline', async () => {
      const { result } = renderHook(() => useOfflineSync('products'));
      
      // Simular mudança para offline
      await act(async () => {
        navigator.onLine = false;
        mockRealtimeContext.isOnline = false;
        
        // Simular evento offline
        const offlineHandler = mockAddEventListener.mock.calls.find(
          call => call[0] === 'offline'
        )?.[1];
        if (offlineHandler) offlineHandler();
      });

      expect(result.current.isOnline).toBe(false);
      expect(mockShowNotification).toHaveBeenCalledWith({
        type: 'warning',
        message: 'Você está offline. As alterações serão sincronizadas quando a conexão for restaurada.',
        duration: 5000
      });
    });

    it('deve detectar mudança para online', async () => {
      // Iniciar offline
      navigator.onLine = false;
      mockRealtimeContext.isOnline = false;
      
      const { result } = renderHook(() => useOfflineSync('products'));

      // Simular mudança para online
      await act(async () => {
        navigator.onLine = true;
        mockRealtimeContext.isOnline = true;
        
        // Simular evento online
        const onlineHandler = mockAddEventListener.mock.calls.find(
          call => call[0] === 'online'
        )?.[1];
        if (onlineHandler) onlineHandler();
      });

      expect(result.current.isOnline).toBe(true);
      expect(mockOfflineQueue.processQueue).toHaveBeenCalled();
      expect(mockShowNotification).toHaveBeenCalledWith({
        type: 'success',
        message: 'Conexão restaurada. Sincronizando dados...',
        duration: 3000
      });
    });

    it('deve verificar conectividade periodicamente', async () => {
      const { result } = renderHook(() => 
        useOfflineSync('products', { 
          enableConnectivityCheck: true,
          connectivityCheckInterval: 1000
        })
      );

      await act(async () => {
        result.current.startSync();
      });

      // Verificar se a verificação periódica foi configurada
      expect(result.current.isOnline).toBeDefined();
    });

    it('deve lidar com falha na verificação de conectividade', async () => {
      // Mock fetch para simular falha de rede
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => 
        useOfflineSync('products', { enableConnectivityCheck: true })
      );

      await act(async () => {
        await result.current.checkConnectivity();
      });

      expect(result.current.isOnline).toBe(false);
    });
  });

  describe('Sincronização de Dados', () => {
    it('deve sincronizar dados quando online', async () => {
      mockSupabaseClient.from().select.mockResolvedValue({
        data: [mockProductData],
        error: null
      });

      const { result } = renderHook(() => useOfflineSync('products'));

      await act(async () => {
        await result.current.syncData();
      });

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('products');
      expect(mockSupabaseClient.from().select).toHaveBeenCalled();
      expect(result.current.localData).toEqual([mockProductData]);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'offline_sync_products',
        JSON.stringify([mockProductData])
      );
    });

    it('deve lidar com erro na sincronização', async () => {
      mockSupabaseClient.from().select.mockResolvedValue({
        data: null,
        error: { message: 'Sync failed' }
      });

      const { result } = renderHook(() => useOfflineSync('products'));

      await act(async () => {
        await result.current.syncData();
      });

      expect(mockShowNotification).toHaveBeenCalledWith({
        type: 'error',
        message: 'Erro na sincronização: Sync failed',
        duration: 5000
      });
    });

    it('deve sincronizar automaticamente em intervalos', async () => {
      const { result } = renderHook(() => 
        useOfflineSync('products', { 
          enableAutoSync: true,
          syncInterval: 1000
        })
      );

      await act(async () => {
        result.current.startSync();
      });

      expect(result.current.isAutoSyncEnabled).toBe(true);
      
      // Aguardar pelo menos um ciclo de sincronização
      await waitFor(() => {
        expect(mockSupabaseClient.from().select).toHaveBeenCalled();
      }, { timeout: 2000 });
    });

    it('deve parar sincronização automática', async () => {
      const { result } = renderHook(() => 
        useOfflineSync('products', { enableAutoSync: true })
      );

      await act(async () => {
        result.current.startSync();
        result.current.stopSync();
      });

      expect(result.current.isAutoSyncEnabled).toBe(false);
    });

    it('deve sincronizar apenas quando online', async () => {
      mockRealtimeContext.isOnline = false;
      
      const { result } = renderHook(() => useOfflineSync('products'));

      await act(async () => {
        await result.current.syncData();
      });

      expect(mockSupabaseClient.from().select).not.toHaveBeenCalled();
      expect(mockShowNotification).toHaveBeenCalledWith({
        type: 'info',
        message: 'Sincronização adiada - você está offline',
        duration: 3000
      });
    });
  });

  describe('Operações Offline', () => {
    beforeEach(() => {
      mockRealtimeContext.isOnline = false;
    });

    it('deve adicionar ação INSERT à fila offline', async () => {
      const { result } = renderHook(() => useOfflineSync('products'));

      const newProduct = {
        name: 'Novo Produto',
        price: 39.99,
        category_id: 'cat-2'
      };

      await act(async () => {
        await result.current.insert(newProduct);
      });

      expect(mockOfflineQueue.addAction).toHaveBeenCalledWith({
        type: 'INSERT',
        table: 'products',
        data: newProduct,
        timestamp: expect.any(Date),
        status: 'pending',
        retryCount: 0,
        priority: 1
      });

      expect(mockShowNotification).toHaveBeenCalledWith({
        type: 'info',
        message: 'Ação adicionada à fila offline',
        duration: 3000
      });
    });

    it('deve adicionar ação UPDATE à fila offline', async () => {
      const { result } = renderHook(() => useOfflineSync('products'));

      const updatedProduct = {
        id: 'prod-123',
        name: 'Produto Atualizado',
        price: 34.99
      };

      await act(async () => {
        await result.current.update('prod-123', updatedProduct);
      });

      expect(mockOfflineQueue.addAction).toHaveBeenCalledWith({
        type: 'UPDATE',
        table: 'products',
        data: updatedProduct,
        recordId: 'prod-123',
        timestamp: expect.any(Date),
        status: 'pending',
        retryCount: 0,
        priority: 2
      });
    });

    it('deve adicionar ação DELETE à fila offline', async () => {
      const { result } = renderHook(() => useOfflineSync('products'));

      await act(async () => {
        await result.current.delete('prod-123');
      });

      expect(mockOfflineQueue.addAction).toHaveBeenCalledWith({
        type: 'DELETE',
        table: 'products',
        recordId: 'prod-123',
        timestamp: expect.any(Date),
        status: 'pending',
        retryCount: 0,
        priority: 3
      });
    });

    it('deve executar operações diretamente quando online', async () => {
      mockRealtimeContext.isOnline = true;
      
      const { result } = renderHook(() => useOfflineSync('products'));

      const newProduct = {
        name: 'Produto Online',
        price: 49.99
      };

      await act(async () => {
        await result.current.insert(newProduct);
      });

      expect(mockSupabaseClient.from().insert).toHaveBeenCalledWith(newProduct);
      expect(mockOfflineQueue.addAction).not.toHaveBeenCalled();
    });

    it('deve atualizar dados locais para operações offline', async () => {
      const { result } = renderHook(() => useOfflineSync('products'));
      
      // Configurar dados locais iniciais
      await act(async () => {
        result.current.setLocalData([mockProductData]);
      });

      const newProduct = {
        name: 'Produto Offline',
        price: 19.99,
        category_id: 'cat-1'
      };

      await act(async () => {
        await result.current.insert(newProduct);
      });

      // Verificar se o produto foi adicionado aos dados locais
      expect(result.current.localData).toHaveLength(2);
      expect(result.current.localData[1]).toMatchObject(newProduct);
    });

    it('deve aplicar updates otimistas aos dados locais', async () => {
      const { result } = renderHook(() => useOfflineSync('products'));
      
      // Configurar dados locais iniciais
      await act(async () => {
        result.current.setLocalData([mockProductData]);
      });

      const updatedData = {
        name: 'Nome Atualizado',
        price: 35.99
      };

      await act(async () => {
        await result.current.update('prod-123', updatedData);
      });

      // Verificar se os dados locais foram atualizados
      expect(result.current.localData[0]).toMatchObject({
        ...mockProductData,
        ...updatedData
      });
    });

    it('deve remover itens dos dados locais para deletes', async () => {
      const { result } = renderHook(() => useOfflineSync('products'));
      
      // Configurar dados locais iniciais
      await act(async () => {
        result.current.setLocalData([mockProductData]);
      });

      await act(async () => {
        await result.current.delete('prod-123');
      });

      // Verificar se o item foi removido dos dados locais
      expect(result.current.localData).toHaveLength(0);
    });
  });

  describe('Processamento da Fila Offline', () => {
    it('deve processar fila quando voltar online', async () => {
      const { result } = renderHook(() => useOfflineSync('products'));
      
      // Configurar fila com ações pendentes
      mockOfflineQueue.queue = [mockOfflineAction];
      mockRealtimeContext.offlineQueue = [mockOfflineAction];

      await act(async () => {
        // Simular volta online
        mockRealtimeContext.isOnline = true;
        await result.current.processOfflineQueue();
      });

      expect(mockOfflineQueue.processQueue).toHaveBeenCalled();
    });

    it('deve processar ações em lotes', async () => {
      const { result } = renderHook(() => 
        useOfflineSync('products', { batchSize: 2 })
      );
      
      const actions = [
        { ...mockOfflineAction, id: 'action-1' },
        { ...mockOfflineAction, id: 'action-2' },
        { ...mockOfflineAction, id: 'action-3' }
      ];
      
      mockOfflineQueue.queue = actions;

      await act(async () => {
        await result.current.processOfflineQueue();
      });

      // Verificar se as ações foram processadas em lotes
      expect(mockOfflineQueue.processQueue).toHaveBeenCalled();
    });

    it('deve lidar com falhas no processamento', async () => {
      mockOfflineQueue.processQueue.mockRejectedValue(new Error('Process failed'));
      
      const { result } = renderHook(() => useOfflineSync('products'));

      await act(async () => {
        await result.current.processOfflineQueue();
      });

      expect(mockShowNotification).toHaveBeenCalledWith({
        type: 'error',
        message: 'Erro ao processar fila offline: Process failed',
        duration: 5000
      });
    });

    it('deve atualizar métricas de sincronização', async () => {
      const { result } = renderHook(() => useOfflineSync('products'));
      
      mockOfflineQueue.queue = [mockOfflineAction];

      await act(async () => {
        await result.current.processOfflineQueue();
      });

      expect(mockRealtimeContext.updateSyncMetrics).toHaveBeenCalledWith({
        lastSyncAt: expect.any(Date),
        successfulSyncs: expect.any(Number)
      });
    });

    it('deve processar automaticamente quando configurado', async () => {
      const { result } = renderHook(() => 
        useOfflineSync('products', { 
          enableAutoProcess: true,
          processInterval: 1000
        })
      );

      mockOfflineQueue.queue = [mockOfflineAction];
      mockRealtimeContext.isOnline = true;

      await act(async () => {
        result.current.startSync();
      });

      await waitFor(() => {
        expect(mockOfflineQueue.processQueue).toHaveBeenCalled();
      }, { timeout: 2000 });
    });
  });

  describe('Resolução de Conflitos', () => {
    it('deve detectar conflitos durante sincronização', async () => {
      const remoteData = {
        ...mockProductData,
        name: 'Nome Remoto',
        updated_at: '2024-01-15T10:30:00Z'
      };

      const localData = {
        ...mockProductData,
        name: 'Nome Local',
        updated_at: '2024-01-15T10:25:00Z'
      };

      mockSupabaseClient.from().select.mockResolvedValue({
        data: [remoteData],
        error: null
      });

      const { result } = renderHook(() => useOfflineSync('products'));
      
      // Configurar dados locais com conflito
      await act(async () => {
        result.current.setLocalData([localData]);
        await result.current.syncData();
      });

      expect(mockRealtimeContext.addConflict).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'sync_conflict',
          localData,
          remoteData
        })
      );
    });

    it('deve resolver conflitos automaticamente quando configurado', async () => {
      const { result } = renderHook(() => 
        useOfflineSync('products', { 
          conflictResolution: 'remote_wins'
        })
      );

      const remoteData = {
        ...mockProductData,
        name: 'Nome Remoto',
        updated_at: '2024-01-15T10:30:00Z'
      };

      const localData = {
        ...mockProductData,
        name: 'Nome Local',
        updated_at: '2024-01-15T10:25:00Z'
      };

      mockSupabaseClient.from().select.mockResolvedValue({
        data: [remoteData],
        error: null
      });

      await act(async () => {
        result.current.setLocalData([localData]);
        await result.current.syncData();
      });

      // Verificar se os dados locais foram atualizados com dados remotos
      expect(result.current.localData[0]).toEqual(remoteData);
    });

    it('deve manter conflitos para resolução manual', async () => {
      const { result } = renderHook(() => 
        useOfflineSync('products', { 
          conflictResolution: 'manual'
        })
      );

      const remoteData = {
        ...mockProductData,
        name: 'Nome Remoto'
      };

      const localData = {
        ...mockProductData,
        name: 'Nome Local'
      };

      mockSupabaseClient.from().select.mockResolvedValue({
        data: [remoteData],
        error: null
      });

      await act(async () => {
        result.current.setLocalData([localData]);
        await result.current.syncData();
      });

      expect(mockRealtimeContext.addConflict).toHaveBeenCalled();
      // Dados locais devem permanecer inalterados
      expect(result.current.localData[0]).toEqual(localData);
    });
  });

  describe('Persistência Local', () => {
    it('deve salvar dados no localStorage', async () => {
      const { result } = renderHook(() => useOfflineSync('products'));

      const testData = [mockProductData];

      await act(async () => {
        result.current.setLocalData(testData);
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'offline_sync_products',
        JSON.stringify(testData)
      );
    });

    it('deve carregar dados do localStorage', () => {
      const savedData = [mockProductData];
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(savedData));

      const { result } = renderHook(() => useOfflineSync('products'));

      expect(result.current.localData).toEqual(savedData);
    });

    it('deve lidar com dados corrompidos no localStorage', () => {
      mockLocalStorage.getItem.mockReturnValue('invalid json');

      const { result } = renderHook(() => useOfflineSync('products'));

      expect(result.current.localData).toEqual([]);
      expect(mockShowNotification).toHaveBeenCalledWith({
        type: 'warning',
        message: 'Dados locais corrompidos foram limpos',
        duration: 3000
      });
    });

    it('deve limpar dados locais', async () => {
      const { result } = renderHook(() => useOfflineSync('products'));

      await act(async () => {
        result.current.clearLocalData();
      });

      expect(result.current.localData).toEqual([]);
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('offline_sync_products');
    });

    it('deve exportar dados locais', () => {
      const testData = [mockProductData];
      const { result } = renderHook(() => useOfflineSync('products'));

      act(() => {
        result.current.setLocalData(testData);
      });

      const exportedData = result.current.exportLocalData();
      expect(exportedData).toEqual(testData);
    });
  });

  describe('Métricas e Status', () => {
    it('deve rastrear métricas de sincronização', async () => {
      const { result } = renderHook(() => useOfflineSync('products'));

      await act(async () => {
        await result.current.syncData();
      });

      expect(result.current.lastSyncAt).toBeInstanceOf(Date);
      expect(mockRealtimeContext.updateSyncMetrics).toHaveBeenCalled();
    });

    it('deve contar ações pendentes', () => {
      mockOfflineQueue.queue = [mockOfflineAction, { ...mockOfflineAction, id: 'action-2' }];
      
      const { result } = renderHook(() => useOfflineSync('products'));

      expect(result.current.pendingActions).toBe(2);
    });

    it('deve rastrear status de sincronização', async () => {
      const { result } = renderHook(() => useOfflineSync('products'));

      expect(result.current.syncStatus).toBe('idle');

      await act(async () => {
        const syncPromise = result.current.syncData();
        expect(result.current.syncStatus).toBe('syncing');
        await syncPromise;
      });

      expect(result.current.syncStatus).toBe('idle');
    });

    it('deve fornecer estatísticas detalhadas', () => {
      mockRealtimeContext.syncMetrics = {
        lastSyncAt: new Date('2024-01-15T10:30:00Z'),
        pendingActions: 3,
        syncErrors: 1,
        successfulSyncs: 10
      };

      const { result } = renderHook(() => useOfflineSync('products'));

      const stats = result.current.getSyncStats();
      expect(stats.totalSyncs).toBe(11); // successfulSyncs + syncErrors
      expect(stats.successRate).toBe(90.91); // (10/11) * 100
      expect(stats.pendingActions).toBe(3);
    });
  });

  describe('Limpeza e Cleanup', () => {
    it('deve limpar recursos ao desmontar', () => {
      const { unmount } = renderHook(() => useOfflineSync('products'));

      unmount();

      expect(mockRemoveEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(mockRemoveEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
    });

    it('deve parar sincronização automática ao desmontar', () => {
      const { result, unmount } = renderHook(() => 
        useOfflineSync('products', { enableAutoSync: true })
      );

      act(() => {
        result.current.startSync();
      });

      unmount();

      expect(result.current.isAutoSyncEnabled).toBe(false);
    });

    it('deve limpar timers e intervalos', () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

      const { result, unmount } = renderHook(() => 
        useOfflineSync('products', { 
          enableAutoSync: true,
          enableAutoProcess: true
        })
      );

      act(() => {
        result.current.startSync();
      });

      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
  });
});