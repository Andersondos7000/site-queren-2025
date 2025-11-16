import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useOfflineQueue } from '../../hooks/realtime/useOfflineQueue';
import type { OfflineAction, QueuedAction } from '../../types/realtime';

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

// Mock do Supabase
const mockSupabaseClient = {
  from: vi.fn(() => ({
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    update: vi.fn().mockResolvedValue({ data: null, error: null }),
    delete: vi.fn().mockResolvedValue({ data: null, error: null }),
    upsert: vi.fn().mockResolvedValue({ data: null, error: null })
  })),
  rpc: vi.fn().mockResolvedValue({ data: null, error: null })
};

vi.mock('../../lib/supabase', () => ({
  supabase: mockSupabaseClient
}));

// Mock do hook useNetworkStatus
const mockUseNetworkStatus = {
  isOnline: true,
  isOffline: false,
  connectionType: 'wifi' as const,
  effectiveType: '4g' as const,
  downlink: 10,
  rtt: 50,
  saveData: false
};

vi.mock('../../hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => mockUseNetworkStatus
}));

// Mock de notificações
const mockShowNotification = vi.fn();
vi.mock('../../hooks/useNotification', () => ({
  useNotification: () => ({
    showNotification: mockShowNotification
  })
}));

// Mock de dados de teste
const mockQueuedActions: QueuedAction[] = [
  {
    id: 'action-1',
    type: 'insert',
    table: 'products',
    data: {
      name: 'Produto Teste',
      price: 29.99,
      category_id: 'cat-1'
    },
    timestamp: new Date('2024-01-15T10:20:00Z'),
    retryCount: 0,
    maxRetries: 3,
    priority: 'normal',
    status: 'pending'
  },
  {
    id: 'action-2',
    type: 'update',
    table: 'inventory',
    data: {
      id: 'inv-1',
      quantity: 15
    },
    filter: { id: 'inv-1' },
    timestamp: new Date('2024-01-15T10:22:00Z'),
    retryCount: 1,
    maxRetries: 3,
    priority: 'high',
    status: 'pending'
  },
  {
    id: 'action-3',
    type: 'delete',
    table: 'orders',
    filter: { id: 'order-1' },
    timestamp: new Date('2024-01-15T10:25:00Z'),
    retryCount: 0,
    maxRetries: 3,
    priority: 'normal',
    status: 'pending'
  }
];

describe('useOfflineQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
    mockUseNetworkStatus.isOnline = true;
    mockUseNetworkStatus.isOffline = false;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Inicialização', () => {
    it('deve inicializar com fila vazia', () => {
      const { result } = renderHook(() => useOfflineQueue());

      expect(result.current.queuedActions).toEqual([]);
      expect(result.current.queueSize).toBe(0);
      expect(result.current.isProcessing).toBe(false);
      expect(result.current.lastProcessedAt).toBeNull();
    });

    it('deve carregar fila do localStorage na inicialização', () => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockQueuedActions));

      const { result } = renderHook(() => useOfflineQueue());

      expect(result.current.queuedActions).toHaveLength(3);
      expect(result.current.queueSize).toBe(3);
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('offline_queue');
    });

    it('deve lidar com dados corrompidos no localStorage', () => {
      mockLocalStorage.getItem.mockReturnValue('dados_inválidos');

      const { result } = renderHook(() => useOfflineQueue());

      expect(result.current.queuedActions).toEqual([]);
      expect(result.current.queueSize).toBe(0);
    });

    it('deve configurar processamento automático quando online', () => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockQueuedActions));
      mockUseNetworkStatus.isOnline = true;

      const { result } = renderHook(() => useOfflineQueue({ autoProcess: true }));

      expect(result.current.queuedActions).toHaveLength(3);
      // Deve iniciar processamento automático
    });
  });

  describe('Adição de Ações à Fila', () => {
    it('deve adicionar ação INSERT à fila', async () => {
      const { result } = renderHook(() => useOfflineQueue());

      const insertAction: OfflineAction = {
        type: 'insert',
        table: 'products',
        data: {
          name: 'Novo Produto',
          price: 39.99
        }
      };

      await act(async () => {
        await result.current.addToQueue(insertAction);
      });

      expect(result.current.queuedActions).toHaveLength(1);
      expect(result.current.queuedActions[0].type).toBe('insert');
      expect(result.current.queuedActions[0].table).toBe('products');
      expect(result.current.queuedActions[0].status).toBe('pending');
    });

    it('deve adicionar ação UPDATE à fila', async () => {
      const { result } = renderHook(() => useOfflineQueue());

      const updateAction: OfflineAction = {
        type: 'update',
        table: 'products',
        data: { price: 49.99 },
        filter: { id: 'prod-1' }
      };

      await act(async () => {
        await result.current.addToQueue(updateAction);
      });

      expect(result.current.queuedActions).toHaveLength(1);
      expect(result.current.queuedActions[0].type).toBe('update');
      expect(result.current.queuedActions[0].filter).toEqual({ id: 'prod-1' });
    });

    it('deve adicionar ação DELETE à fila', async () => {
      const { result } = renderHook(() => useOfflineQueue());

      const deleteAction: OfflineAction = {
        type: 'delete',
        table: 'products',
        filter: { id: 'prod-1' }
      };

      await act(async () => {
        await result.current.addToQueue(deleteAction);
      });

      expect(result.current.queuedActions).toHaveLength(1);
      expect(result.current.queuedActions[0].type).toBe('delete');
      expect(result.current.queuedActions[0].filter).toEqual({ id: 'prod-1' });
    });

    it('deve gerar ID único para cada ação', async () => {
      const { result } = renderHook(() => useOfflineQueue());

      const action: OfflineAction = {
        type: 'insert',
        table: 'products',
        data: { name: 'Produto' }
      };

      await act(async () => {
        await result.current.addToQueue(action);
        await result.current.addToQueue(action);
      });

      expect(result.current.queuedActions).toHaveLength(2);
      expect(result.current.queuedActions[0].id).not.toBe(result.current.queuedActions[1].id);
    });

    it('deve definir prioridade baseada no tipo de ação', async () => {
      const { result } = renderHook(() => useOfflineQueue());

      const deleteAction: OfflineAction = {
        type: 'delete',
        table: 'products',
        filter: { id: 'prod-1' }
      };

      const insertAction: OfflineAction = {
        type: 'insert',
        table: 'products',
        data: { name: 'Produto' }
      };

      await act(async () => {
        await result.current.addToQueue(deleteAction);
        await result.current.addToQueue(insertAction);
      });

      // DELETE deve ter prioridade alta, INSERT normal
      expect(result.current.queuedActions[0].priority).toBe('high');
      expect(result.current.queuedActions[1].priority).toBe('normal');
    });

    it('deve persistir fila no localStorage', async () => {
      const { result } = renderHook(() => useOfflineQueue());

      const action: OfflineAction = {
        type: 'insert',
        table: 'products',
        data: { name: 'Produto' }
      };

      await act(async () => {
        await result.current.addToQueue(action);
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'offline_queue',
        expect.stringContaining('"type":"insert"')
      );
    });
  });

  describe('Processamento da Fila', () => {
    beforeEach(() => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockQueuedActions));
    });

    it('deve processar ações na ordem de prioridade', async () => {
      const { result } = renderHook(() => useOfflineQueue());

      await act(async () => {
        await result.current.processQueue();
      });

      // Ação com prioridade alta deve ser processada primeiro
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('inventory');
    });

    it('deve processar ação INSERT corretamente', async () => {
      const insertAction = {
        ...mockQueuedActions[0],
        type: 'insert' as const
      };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify([insertAction]));

      const { result } = renderHook(() => useOfflineQueue());

      await act(async () => {
        await result.current.processQueue();
      });

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('products');
      expect(mockSupabaseClient.from().insert).toHaveBeenCalledWith(insertAction.data);
    });

    it('deve processar ação UPDATE corretamente', async () => {
      const updateAction = {
        ...mockQueuedActions[1],
        type: 'update' as const
      };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify([updateAction]));

      const { result } = renderHook(() => useOfflineQueue());

      await act(async () => {
        await result.current.processQueue();
      });

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('inventory');
      expect(mockSupabaseClient.from().update).toHaveBeenCalledWith(updateAction.data);
    });

    it('deve processar ação DELETE corretamente', async () => {
      const deleteAction = {
        ...mockQueuedActions[2],
        type: 'delete' as const
      };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify([deleteAction]));

      const { result } = renderHook(() => useOfflineQueue());

      await act(async () => {
        await result.current.processQueue();
      });

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('orders');
      expect(mockSupabaseClient.from().delete).toHaveBeenCalled();
    });

    it('deve remover ações processadas com sucesso da fila', async () => {
      const { result } = renderHook(() => useOfflineQueue());

      await act(async () => {
        await result.current.processQueue();
      });

      expect(result.current.queuedActions).toHaveLength(0);
      expect(result.current.queueSize).toBe(0);
    });

    it('deve incrementar retryCount para ações falhadas', async () => {
      mockSupabaseClient.from.mockReturnValue({
        insert: vi.fn().mockRejectedValue(new Error('Erro de rede')),
        update: vi.fn().mockRejectedValue(new Error('Erro de rede')),
        delete: vi.fn().mockRejectedValue(new Error('Erro de rede'))
      });

      const { result } = renderHook(() => useOfflineQueue());

      await act(async () => {
        await result.current.processQueue();
      });

      // Ações devem permanecer na fila com retryCount incrementado
      expect(result.current.queuedActions).toHaveLength(3);
      expect(result.current.queuedActions[0].retryCount).toBe(1);
    });

    it('deve remover ações que excederam maxRetries', async () => {
      const failedAction = {
        ...mockQueuedActions[0],
        retryCount: 3,
        maxRetries: 3
      };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify([failedAction]));
      mockSupabaseClient.from.mockReturnValue({
        insert: vi.fn().mockRejectedValue(new Error('Erro persistente'))
      });

      const { result } = renderHook(() => useOfflineQueue());

      await act(async () => {
        await result.current.processQueue();
      });

      expect(result.current.queuedActions).toHaveLength(0);
      expect(mockShowNotification).toHaveBeenCalledWith({
        type: 'error',
        message: 'Ação falhou após 3 tentativas e foi removida da fila',
        duration: 5000
      });
    });

    it('deve atualizar lastProcessedAt após processamento', async () => {
      const { result } = renderHook(() => useOfflineQueue());

      const beforeProcess = new Date();

      await act(async () => {
        await result.current.processQueue();
      });

      expect(result.current.lastProcessedAt).toBeInstanceOf(Date);
      expect(result.current.lastProcessedAt!.getTime()).toBeGreaterThanOrEqual(beforeProcess.getTime());
    });

    it('deve definir isProcessing durante o processamento', async () => {
      let processingState = false;
      const { result } = renderHook(() => {
        const queue = useOfflineQueue();
        if (queue.isProcessing) {
          processingState = true;
        }
        return queue;
      });

      await act(async () => {
        const processPromise = result.current.processQueue();
        expect(result.current.isProcessing).toBe(true);
        await processPromise;
      });

      expect(result.current.isProcessing).toBe(false);
    });
  });

  describe('Retry de Ações Falhadas', () => {
    it('deve tentar novamente ações falhadas', async () => {
      const failedActions = mockQueuedActions.map(action => ({
        ...action,
        status: 'failed' as const,
        retryCount: 1
      }));
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(failedActions));

      const { result } = renderHook(() => useOfflineQueue());

      await act(async () => {
        await result.current.retryFailedActions();
      });

      expect(mockSupabaseClient.from).toHaveBeenCalledTimes(3);
    });

    it('deve resetar status de ações falhadas para pending', async () => {
      const failedAction = {
        ...mockQueuedActions[0],
        status: 'failed' as const,
        retryCount: 1
      };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify([failedAction]));

      const { result } = renderHook(() => useOfflineQueue());

      await act(async () => {
        await result.current.retryFailedActions();
      });

      expect(result.current.queuedActions[0].status).toBe('pending');
    });

    it('deve aplicar backoff exponencial para retries', async () => {
      const failedAction = {
        ...mockQueuedActions[0],
        status: 'failed' as const,
        retryCount: 2
      };
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify([failedAction]));
      mockSupabaseClient.from.mockReturnValue({
        insert: vi.fn().mockRejectedValue(new Error('Ainda falhando'))
      });

      const { result } = renderHook(() => useOfflineQueue());

      const startTime = Date.now();
      await act(async () => {
        await result.current.retryFailedActions();
      });
      const endTime = Date.now();

      // Deve ter aplicado delay (backoff exponencial)
      expect(endTime - startTime).toBeGreaterThan(1000); // Pelo menos 1 segundo de delay
    });
  });

  describe('Filtragem e Consulta', () => {
    beforeEach(() => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockQueuedActions));
    });

    it('deve filtrar ações por tipo', () => {
      const { result } = renderHook(() => useOfflineQueue());

      const insertActions = result.current.getQueuedActionsByType('insert');
      const updateActions = result.current.getQueuedActionsByType('update');
      const deleteActions = result.current.getQueuedActionsByType('delete');

      expect(insertActions).toHaveLength(1);
      expect(updateActions).toHaveLength(1);
      expect(deleteActions).toHaveLength(1);
    });

    it('deve filtrar ações por tabela', () => {
      const { result } = renderHook(() => useOfflineQueue());

      const productActions = result.current.getQueuedActionsByTable('products');
      const inventoryActions = result.current.getQueuedActionsByTable('inventory');
      const orderActions = result.current.getQueuedActionsByTable('orders');

      expect(productActions).toHaveLength(1);
      expect(inventoryActions).toHaveLength(1);
      expect(orderActions).toHaveLength(1);
    });

    it('deve filtrar ações por status', () => {
      const mixedActions = [
        { ...mockQueuedActions[0], status: 'pending' as const },
        { ...mockQueuedActions[1], status: 'processing' as const },
        { ...mockQueuedActions[2], status: 'failed' as const }
      ];
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mixedActions));

      const { result } = renderHook(() => useOfflineQueue());

      const pendingActions = result.current.getQueuedActionsByStatus('pending');
      const processingActions = result.current.getQueuedActionsByStatus('processing');
      const failedActions = result.current.getQueuedActionsByStatus('failed');

      expect(pendingActions).toHaveLength(1);
      expect(processingActions).toHaveLength(1);
      expect(failedActions).toHaveLength(1);
    });

    it('deve filtrar ações por prioridade', () => {
      const { result } = renderHook(() => useOfflineQueue());

      const highPriorityActions = result.current.getQueuedActionsByPriority('high');
      const normalPriorityActions = result.current.getQueuedActionsByPriority('normal');

      expect(highPriorityActions).toHaveLength(1);
      expect(normalPriorityActions).toHaveLength(2);
    });
  });

  describe('Limpeza da Fila', () => {
    beforeEach(() => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockQueuedActions));
    });

    it('deve limpar toda a fila', async () => {
      const { result } = renderHook(() => useOfflineQueue());

      await act(async () => {
        await result.current.clearQueue();
      });

      expect(result.current.queuedActions).toHaveLength(0);
      expect(result.current.queueSize).toBe(0);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('offline_queue', '[]');
    });

    it('deve limpar apenas ações processadas com sucesso', async () => {
      const mixedActions = [
        { ...mockQueuedActions[0], status: 'completed' as const },
        { ...mockQueuedActions[1], status: 'pending' as const },
        { ...mockQueuedActions[2], status: 'failed' as const }
      ];
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mixedActions));

      const { result } = renderHook(() => useOfflineQueue());

      await act(async () => {
        await result.current.clearQueue('completed');
      });

      expect(result.current.queuedActions).toHaveLength(2);
      expect(result.current.queuedActions.every(action => action.status !== 'completed')).toBe(true);
    });

    it('deve limpar ações por tabela específica', async () => {
      const { result } = renderHook(() => useOfflineQueue());

      await act(async () => {
        await result.current.clearQueue('all', 'products');
      });

      expect(result.current.queuedActions).toHaveLength(2);
      expect(result.current.queuedActions.every(action => action.table !== 'products')).toBe(true);
    });
  });

  describe('Processamento Automático', () => {
    it('deve processar automaticamente quando volta online', async () => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockQueuedActions));
      mockUseNetworkStatus.isOnline = false;

      const { result, rerender } = renderHook(() => useOfflineQueue({ autoProcess: true }));

      expect(result.current.queuedActions).toHaveLength(3);

      // Simular volta online
      mockUseNetworkStatus.isOnline = true;
      mockUseNetworkStatus.isOffline = false;

      await act(async () => {
        rerender();
        await waitFor(() => {
          expect(result.current.queueSize).toBe(0);
        });
      });
    });

    it('deve respeitar intervalo de processamento automático', async () => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockQueuedActions));

      const { result } = renderHook(() => 
        useOfflineQueue({ 
          autoProcess: true, 
          processInterval: 1000 
        })
      );

      expect(result.current.queuedActions).toHaveLength(3);

      // Aguardar intervalo de processamento
      await waitFor(() => {
        expect(result.current.queueSize).toBe(0);
      }, { timeout: 2000 });
    });

    it('deve parar processamento automático quando offline', async () => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockQueuedActions));
      const processSpy = vi.spyOn(mockSupabaseClient, 'from');

      const { rerender } = renderHook(() => useOfflineQueue({ autoProcess: true }));

      // Simular ficar offline
      mockUseNetworkStatus.isOnline = false;
      mockUseNetworkStatus.isOffline = true;

      rerender();

      // Aguardar um tempo e verificar que não processou
      await new Promise(resolve => setTimeout(resolve, 1500));
      expect(processSpy).not.toHaveBeenCalled();
    });
  });

  describe('Persistência e Recuperação', () => {
    it('deve persistir estado da fila no localStorage', async () => {
      const { result } = renderHook(() => useOfflineQueue());

      const action: OfflineAction = {
        type: 'insert',
        table: 'products',
        data: { name: 'Produto' }
      };

      await act(async () => {
        await result.current.addToQueue(action);
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'offline_queue',
        expect.stringMatching(/"table":"products"/)
      );
    });

    it('deve recuperar estado da fila após reinicialização', () => {
      const savedActions = JSON.stringify(mockQueuedActions);
      mockLocalStorage.getItem.mockReturnValue(savedActions);

      const { result } = renderHook(() => useOfflineQueue());

      expect(result.current.queuedActions).toHaveLength(3);
      expect(result.current.queuedActions[0].table).toBe('products');
      expect(result.current.queuedActions[1].table).toBe('inventory');
      expect(result.current.queuedActions[2].table).toBe('orders');
    });

    it('deve migrar formato antigo da fila se necessário', () => {
      const oldFormatActions = mockQueuedActions.map(action => ({
        ...action,
        // Simular formato antigo sem algumas propriedades
        priority: undefined,
        status: undefined
      }));
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(oldFormatActions));

      const { result } = renderHook(() => useOfflineQueue());

      expect(result.current.queuedActions).toHaveLength(3);
      expect(result.current.queuedActions[0].priority).toBeDefined();
      expect(result.current.queuedActions[0].status).toBeDefined();
    });
  });

  describe('Tratamento de Erros', () => {
    it('deve lidar com erros de rede durante processamento', async () => {
      mockSupabaseClient.from.mockReturnValue({
        insert: vi.fn().mockRejectedValue(new Error('Network error'))
      });
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify([mockQueuedActions[0]]));

      const { result } = renderHook(() => useOfflineQueue());

      await act(async () => {
        await result.current.processQueue();
      });

      expect(result.current.queuedActions[0].status).toBe('failed');
      expect(result.current.queuedActions[0].retryCount).toBe(1);
    });

    it('deve lidar com erros de validação do Supabase', async () => {
      mockSupabaseClient.from.mockReturnValue({
        insert: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Validation error', code: '23505' }
        })
      });
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify([mockQueuedActions[0]]));

      const { result } = renderHook(() => useOfflineQueue());

      await act(async () => {
        await result.current.processQueue();
      });

      expect(result.current.queuedActions[0].status).toBe('failed');
      expect(mockShowNotification).toHaveBeenCalledWith({
        type: 'error',
        message: 'Erro de validação: Validation error',
        duration: 5000
      });
    });

    it('deve lidar com localStorage indisponível', async () => {
      mockLocalStorage.setItem.mockImplementation(() => {
        throw new Error('localStorage not available');
      });

      const { result } = renderHook(() => useOfflineQueue());

      const action: OfflineAction = {
        type: 'insert',
        table: 'products',
        data: { name: 'Produto' }
      };

      await act(async () => {
        await result.current.addToQueue(action);
      });

      // Deve continuar funcionando mesmo sem persistência
      expect(result.current.queuedActions).toHaveLength(1);
    });
  });
});