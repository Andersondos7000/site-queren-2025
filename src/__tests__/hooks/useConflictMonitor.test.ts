import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useConflictMonitor } from '../../hooks/realtime/useConflictMonitor';
import type { ConflictData, ConflictResolutionStrategy } from '../../types/realtime';

// Mock do Supabase
const mockSupabaseClient = {
  from: vi.fn(() => ({
    select: vi.fn().mockResolvedValue({ data: [], error: null }),
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    update: vi.fn().mockResolvedValue({ data: null, error: null }),
    delete: vi.fn().mockResolvedValue({ data: null, error: null }),
    eq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
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
  conflicts: [],
  addConflict: vi.fn(),
  resolveConflict: vi.fn(),
  clearConflicts: vi.fn(),
  syncMetrics: {
    conflictCount: 0,
    lastConflictAt: null,
    resolutionSuccessRate: 100
  }
};

vi.mock('../../contexts/RealtimeContext', () => ({
  useRealtimeContext: () => mockRealtimeContext
}));

// Mock de notificações
const mockShowNotification = vi.fn();
vi.mock('../../hooks/useNotification', () => ({
  useNotification: () => ({
    showNotification: mockShowNotification
  })
}));

// Mock de dados de teste
const mockConflictData: ConflictData = {
  id: 'conflict-1',
  table: 'products',
  recordId: 'prod-123',
  type: 'update_conflict',
  localData: {
    id: 'prod-123',
    name: 'Produto Local',
    price: 29.99,
    updated_at: '2024-01-15T10:20:00Z'
  },
  remoteData: {
    id: 'prod-123',
    name: 'Produto Remoto',
    price: 39.99,
    updated_at: '2024-01-15T10:22:00Z'
  },
  conflictFields: ['name', 'price'],
  timestamp: new Date('2024-01-15T10:25:00Z'),
  priority: 'medium',
  status: 'pending',
  metadata: {
    localUser: 'user-1',
    remoteUser: 'user-2',
    conflictReason: 'concurrent_update'
  }
};

const mockProductData = {
  id: 'prod-123',
  name: 'Produto Teste',
  price: 25.99,
  category_id: 'cat-1',
  updated_at: '2024-01-15T10:15:00Z',
  version: 1
};

describe('useConflictMonitor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRealtimeContext.conflicts = [];
    mockRealtimeContext.syncMetrics.conflictCount = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Inicialização', () => {
    it('deve inicializar com configuração padrão', () => {
      const { result } = renderHook(() => useConflictMonitor('products'));

      expect(result.current.isMonitoring).toBe(false);
      expect(result.current.conflictCount).toBe(0);
      expect(result.current.lastConflictAt).toBeNull();
      expect(result.current.resolutionStrategy).toBe('manual');
    });

    it('deve inicializar com configuração customizada', () => {
      const config = {
        autoResolve: true,
        strategy: 'remote_wins' as ConflictResolutionStrategy,
        checkInterval: 5000,
        maxConflicts: 50
      };

      const { result } = renderHook(() => useConflictMonitor('products', config));

      expect(result.current.resolutionStrategy).toBe('remote_wins');
    });

    it('deve configurar canal de monitoramento', () => {
      renderHook(() => useConflictMonitor('products'));

      expect(mockSupabaseClient.channel).toHaveBeenCalledWith('conflict_monitor_products');
    });
  });

  describe('Detecção de Conflitos', () => {
    it('deve detectar conflito de atualização concorrente', async () => {
      const { result } = renderHook(() => useConflictMonitor('products'));

      const localData = {
        id: 'prod-123',
        name: 'Nome Local',
        price: 29.99,
        updated_at: '2024-01-15T10:20:00Z'
      };

      const remoteData = {
        id: 'prod-123',
        name: 'Nome Remoto',
        price: 39.99,
        updated_at: '2024-01-15T10:22:00Z'
      };

      await act(async () => {
        const conflict = await result.current.detectConflict(localData, remoteData);
        expect(conflict).toBeTruthy();
        expect(conflict?.conflictFields).toContain('name');
        expect(conflict?.conflictFields).toContain('price');
      });
    });

    it('deve detectar conflito de versão', async () => {
      const { result } = renderHook(() => useConflictMonitor('products'));

      const localData = {
        id: 'prod-123',
        name: 'Produto',
        version: 2,
        updated_at: '2024-01-15T10:20:00Z'
      };

      const remoteData = {
        id: 'prod-123',
        name: 'Produto',
        version: 3,
        updated_at: '2024-01-15T10:18:00Z'
      };

      await act(async () => {
        const conflict = await result.current.detectConflict(localData, remoteData);
        expect(conflict).toBeTruthy();
        expect(conflict?.type).toBe('version_conflict');
      });
    });

    it('deve detectar conflito de timestamp', async () => {
      const { result } = renderHook(() => useConflictMonitor('products'));

      const localData = {
        id: 'prod-123',
        name: 'Nome Diferente',
        updated_at: '2024-01-15T10:25:00Z'
      };

      const remoteData = {
        id: 'prod-123',
        name: 'Outro Nome',
        updated_at: '2024-01-15T10:20:00Z'
      };

      await act(async () => {
        const conflict = await result.current.detectConflict(localData, remoteData);
        expect(conflict).toBeTruthy();
        expect(conflict?.type).toBe('timestamp_conflict');
      });
    });

    it('deve ignorar campos não conflitantes', async () => {
      const { result } = renderHook(() => useConflictMonitor('products'));

      const localData = {
        id: 'prod-123',
        name: 'Produto',
        price: 29.99,
        created_at: '2024-01-15T09:00:00Z', // Campo ignorado
        updated_at: '2024-01-15T10:20:00Z'
      };

      const remoteData = {
        id: 'prod-123',
        name: 'Produto',
        price: 29.99,
        created_at: '2024-01-15T09:00:00Z',
        updated_at: '2024-01-15T10:20:00Z'
      };

      await act(async () => {
        const conflict = await result.current.detectConflict(localData, remoteData);
        expect(conflict).toBeNull();
      });
    });

    it('deve detectar conflito de exclusão', async () => {
      const { result } = renderHook(() => useConflictMonitor('products'));

      const localData = {
        id: 'prod-123',
        name: 'Produto Atualizado',
        updated_at: '2024-01-15T10:25:00Z'
      };

      await act(async () => {
        const conflict = await result.current.detectConflict(localData, null);
        expect(conflict).toBeTruthy();
        expect(conflict?.type).toBe('delete_conflict');
      });
    });

    it('deve priorizar conflitos críticos', async () => {
      const { result } = renderHook(() => useConflictMonitor('orders'));

      const localData = {
        id: 'order-123',
        status: 'paid',
        total: 100.00,
        updated_at: '2024-01-15T10:20:00Z'
      };

      const remoteData = {
        id: 'order-123',
        status: 'cancelled',
        total: 100.00,
        updated_at: '2024-01-15T10:22:00Z'
      };

      await act(async () => {
        const conflict = await result.current.detectConflict(localData, remoteData);
        expect(conflict?.priority).toBe('high');
      });
    });
  });

  describe('Estratégias de Resolução', () => {
    beforeEach(() => {
      mockRealtimeContext.conflicts = [mockConflictData];
    });

    it('deve resolver conflito com estratégia local_wins', async () => {
      const { result } = renderHook(() => 
        useConflictMonitor('products', { strategy: 'local_wins' })
      );

      await act(async () => {
        await result.current.resolveConflict('conflict-1', 'local_wins');
      });

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('products');
      expect(mockSupabaseClient.from().update).toHaveBeenCalledWith(mockConflictData.localData);
      expect(mockRealtimeContext.resolveConflict).toHaveBeenCalledWith('conflict-1');
    });

    it('deve resolver conflito com estratégia remote_wins', async () => {
      const { result } = renderHook(() => 
        useConflictMonitor('products', { strategy: 'remote_wins' })
      );

      await act(async () => {
        await result.current.resolveConflict('conflict-1', 'remote_wins');
      });

      expect(mockSupabaseClient.from().update).toHaveBeenCalledWith(mockConflictData.remoteData);
      expect(mockRealtimeContext.resolveConflict).toHaveBeenCalledWith('conflict-1');
    });

    it('deve resolver conflito com estratégia timestamp_wins', async () => {
      const { result } = renderHook(() => 
        useConflictMonitor('products', { strategy: 'timestamp_wins' })
      );

      await act(async () => {
        await result.current.resolveConflict('conflict-1', 'timestamp_wins');
      });

      // Remote data tem timestamp mais recente
      expect(mockSupabaseClient.from().update).toHaveBeenCalledWith(mockConflictData.remoteData);
    });

    it('deve resolver conflito com estratégia merge', async () => {
      const { result } = renderHook(() => 
        useConflictMonitor('products', { strategy: 'merge' })
      );

      await act(async () => {
        await result.current.resolveConflict('conflict-1', 'merge');
      });

      const expectedMergedData = {
        ...mockConflictData.localData,
        ...mockConflictData.remoteData,
        updated_at: mockConflictData.remoteData.updated_at // Timestamp mais recente
      };

      expect(mockSupabaseClient.from().update).toHaveBeenCalledWith(expectedMergedData);
    });

    it('deve resolver conflito com estratégia custom', async () => {
      const customResolver = vi.fn().mockResolvedValue({
        id: 'prod-123',
        name: 'Nome Customizado',
        price: 34.99
      });

      const { result } = renderHook(() => 
        useConflictMonitor('products', { 
          strategy: 'custom',
          customResolver
        })
      );

      await act(async () => {
        await result.current.resolveConflict('conflict-1', 'custom');
      });

      expect(customResolver).toHaveBeenCalledWith(
        mockConflictData.localData,
        mockConflictData.remoteData,
        mockConflictData.conflictFields
      );
    });

    it('deve lidar com erro na resolução de conflito', async () => {
      mockSupabaseClient.from.mockReturnValue({
        update: vi.fn().mockRejectedValue(new Error('Update failed')),
        eq: vi.fn().mockReturnThis()
      });

      const { result } = renderHook(() => useConflictMonitor('products'));

      await act(async () => {
        await result.current.resolveConflict('conflict-1', 'local_wins');
      });

      expect(mockShowNotification).toHaveBeenCalledWith({
        type: 'error',
        message: 'Erro ao resolver conflito: Update failed',
        duration: 5000
      });
    });
  });

  describe('Resolução Automática', () => {
    it('deve resolver automaticamente com estratégia configurada', async () => {
      const { result } = renderHook(() => 
        useConflictMonitor('products', { 
          autoResolve: true,
          strategy: 'remote_wins'
        })
      );

      await act(async () => {
        result.current.startMonitoring();
      });

      // Simular detecção de conflito
      await act(async () => {
        const conflict = await result.current.detectConflict(
          mockConflictData.localData,
          mockConflictData.remoteData
        );
        
        if (conflict) {
          mockRealtimeContext.addConflict(conflict);
        }
      });

      await waitFor(() => {
        expect(mockSupabaseClient.from().update).toHaveBeenCalled();
      });
    });

    it('deve respeitar limite de resolução automática', async () => {
      const { result } = renderHook(() => 
        useConflictMonitor('products', { 
          autoResolve: true,
          strategy: 'local_wins',
          maxAutoResolve: 2
        })
      );

      await act(async () => {
        result.current.startMonitoring();
      });

      // Simular múltiplos conflitos
      for (let i = 0; i < 5; i++) {
        await act(async () => {
          const conflict = {
            ...mockConflictData,
            id: `conflict-${i}`,
            recordId: `prod-${i}`
          };
          mockRealtimeContext.addConflict(conflict);
        });
      }

      await waitFor(() => {
        // Apenas 2 devem ser resolvidos automaticamente
        expect(mockSupabaseClient.from().update).toHaveBeenCalledTimes(2);
      });
    });

    it('deve pausar resolução automática após muitos erros', async () => {
      mockSupabaseClient.from.mockReturnValue({
        update: vi.fn().mockRejectedValue(new Error('Persistent error')),
        eq: vi.fn().mockReturnThis()
      });

      const { result } = renderHook(() => 
        useConflictMonitor('products', { 
          autoResolve: true,
          strategy: 'local_wins',
          maxRetries: 2
        })
      );

      await act(async () => {
        result.current.startMonitoring();
      });

      // Simular múltiplos conflitos que falham
      for (let i = 0; i < 5; i++) {
        await act(async () => {
          const conflict = {
            ...mockConflictData,
            id: `conflict-${i}`
          };
          mockRealtimeContext.addConflict(conflict);
        });
      }

      await waitFor(() => {
        expect(mockShowNotification).toHaveBeenCalledWith({
          type: 'warning',
          message: 'Resolução automática pausada devido a muitos erros',
          duration: 8000
        });
      });
    });
  });

  describe('Monitoramento de Mudanças', () => {
    it('deve iniciar monitoramento de mudanças realtime', async () => {
      const { result } = renderHook(() => useConflictMonitor('products'));

      await act(async () => {
        result.current.startMonitoring();
      });

      expect(result.current.isMonitoring).toBe(true);
      expect(mockSupabaseClient.channel).toHaveBeenCalled();
      expect(mockSupabaseClient.channel().on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          event: '*',
          schema: 'public',
          table: 'products'
        }),
        expect.any(Function)
      );
    });

    it('deve parar monitoramento', async () => {
      const { result } = renderHook(() => useConflictMonitor('products'));

      await act(async () => {
        result.current.startMonitoring();
        result.current.stopMonitoring();
      });

      expect(result.current.isMonitoring).toBe(false);
      expect(mockSupabaseClient.channel().unsubscribe).toHaveBeenCalled();
    });

    it('deve detectar mudanças concorrentes via realtime', async () => {
      const { result } = renderHook(() => useConflictMonitor('products'));
      let realtimeCallback: Function;

      mockSupabaseClient.channel.mockReturnValue({
        on: vi.fn().mockImplementation((event, config, callback) => {
          realtimeCallback = callback;
          return mockSupabaseClient.channel();
        }),
        subscribe: vi.fn().mockResolvedValue({ status: 'SUBSCRIBED' }),
        unsubscribe: vi.fn().mockResolvedValue({ status: 'CLOSED' })
      });

      await act(async () => {
        result.current.startMonitoring();
      });

      // Simular mudança realtime
      const realtimePayload = {
        eventType: 'UPDATE',
        new: {
          id: 'prod-123',
          name: 'Produto Atualizado Remotamente',
          price: 45.99,
          updated_at: '2024-01-15T10:30:00Z'
        },
        old: mockProductData
      };

      await act(async () => {
        realtimeCallback(realtimePayload);
      });

      // Deve detectar conflito se houver mudança local pendente
      expect(mockRealtimeContext.addConflict).toHaveBeenCalled();
    });

    it('deve filtrar mudanças do próprio usuário', async () => {
      const { result } = renderHook(() => 
        useConflictMonitor('products', { ignoreOwnChanges: true })
      );
      let realtimeCallback: Function;

      mockSupabaseClient.channel.mockReturnValue({
        on: vi.fn().mockImplementation((event, config, callback) => {
          realtimeCallback = callback;
          return mockSupabaseClient.channel();
        }),
        subscribe: vi.fn().mockResolvedValue({ status: 'SUBSCRIBED' }),
        unsubscribe: vi.fn().mockResolvedValue({ status: 'CLOSED' })
      });

      await act(async () => {
        result.current.startMonitoring();
      });

      // Simular mudança do próprio usuário
      const ownChangePayload = {
        eventType: 'UPDATE',
        new: {
          id: 'prod-123',
          name: 'Minha Mudança',
          updated_by: 'current-user-id'
        }
      };

      await act(async () => {
        realtimeCallback(ownChangePayload);
      });

      // Não deve detectar conflito para próprias mudanças
      expect(mockRealtimeContext.addConflict).not.toHaveBeenCalled();
    });
  });

  describe('Métricas e Estatísticas', () => {
    beforeEach(() => {
      mockRealtimeContext.conflicts = [mockConflictData];
      mockRealtimeContext.syncMetrics.conflictCount = 5;
      mockRealtimeContext.syncMetrics.lastConflictAt = new Date('2024-01-15T10:25:00Z');
      mockRealtimeContext.syncMetrics.resolutionSuccessRate = 85;
    });

    it('deve retornar métricas de conflito', () => {
      const { result } = renderHook(() => useConflictMonitor('products'));

      expect(result.current.conflictCount).toBe(5);
      expect(result.current.lastConflictAt).toEqual(new Date('2024-01-15T10:25:00Z'));
      expect(result.current.resolutionSuccessRate).toBe(85);
    });

    it('deve calcular estatísticas de conflito por tipo', () => {
      const conflicts = [
        { ...mockConflictData, type: 'update_conflict' },
        { ...mockConflictData, id: 'conflict-2', type: 'version_conflict' },
        { ...mockConflictData, id: 'conflict-3', type: 'update_conflict' }
      ];
      mockRealtimeContext.conflicts = conflicts;

      const { result } = renderHook(() => useConflictMonitor('products'));

      const stats = result.current.getConflictStats();
      expect(stats.byType.update_conflict).toBe(2);
      expect(stats.byType.version_conflict).toBe(1);
      expect(stats.total).toBe(3);
    });

    it('deve calcular estatísticas de conflito por prioridade', () => {
      const conflicts = [
        { ...mockConflictData, priority: 'high' },
        { ...mockConflictData, id: 'conflict-2', priority: 'medium' },
        { ...mockConflictData, id: 'conflict-3', priority: 'high' }
      ];
      mockRealtimeContext.conflicts = conflicts;

      const { result } = renderHook(() => useConflictMonitor('products'));

      const stats = result.current.getConflictStats();
      expect(stats.byPriority.high).toBe(2);
      expect(stats.byPriority.medium).toBe(1);
    });

    it('deve rastrear tempo médio de resolução', () => {
      const resolvedConflicts = [
        {
          ...mockConflictData,
          status: 'resolved',
          resolvedAt: new Date('2024-01-15T10:30:00Z')
        }
      ];
      mockRealtimeContext.conflicts = resolvedConflicts;

      const { result } = renderHook(() => useConflictMonitor('products'));

      const stats = result.current.getConflictStats();
      expect(stats.averageResolutionTime).toBeGreaterThan(0);
    });
  });

  describe('Configuração e Customização', () => {
    it('deve permitir configurar campos ignorados', async () => {
      const { result } = renderHook(() => 
        useConflictMonitor('products', {
          ignoreFields: ['created_at', 'view_count']
        })
      );

      const localData = {
        id: 'prod-123',
        name: 'Produto',
        view_count: 100,
        updated_at: '2024-01-15T10:20:00Z'
      };

      const remoteData = {
        id: 'prod-123',
        name: 'Produto',
        view_count: 150, // Campo ignorado
        updated_at: '2024-01-15T10:20:00Z'
      };

      await act(async () => {
        const conflict = await result.current.detectConflict(localData, remoteData);
        expect(conflict).toBeNull();
      });
    });

    it('deve permitir configurar campos críticos', async () => {
      const { result } = renderHook(() => 
        useConflictMonitor('orders', {
          criticalFields: ['status', 'payment_status']
        })
      );

      const localData = {
        id: 'order-123',
        status: 'pending',
        payment_status: 'paid',
        updated_at: '2024-01-15T10:20:00Z'
      };

      const remoteData = {
        id: 'order-123',
        status: 'cancelled',
        payment_status: 'paid',
        updated_at: '2024-01-15T10:22:00Z'
      };

      await act(async () => {
        const conflict = await result.current.detectConflict(localData, remoteData);
        expect(conflict?.priority).toBe('high');
      });
    });

    it('deve permitir configurar intervalo de verificação', async () => {
      const { result } = renderHook(() => 
        useConflictMonitor('products', {
          checkInterval: 2000
        })
      );

      await act(async () => {
        result.current.startMonitoring();
      });

      expect(result.current.isMonitoring).toBe(true);
      // Verificar se o intervalo foi configurado corretamente
    });

    it('deve permitir configurar limite máximo de conflitos', async () => {
      const { result } = renderHook(() => 
        useConflictMonitor('products', {
          maxConflicts: 3
        })
      );

      // Simular adição de muitos conflitos
      for (let i = 0; i < 5; i++) {
        await act(async () => {
          const conflict = {
            ...mockConflictData,
            id: `conflict-${i}`
          };
          mockRealtimeContext.addConflict(conflict);
        });
      }

      // Deve limitar o número de conflitos mantidos
      expect(mockRealtimeContext.conflicts.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Limpeza e Cleanup', () => {
    it('deve limpar recursos ao desmontar', () => {
      const { unmount } = renderHook(() => useConflictMonitor('products'));

      unmount();

      expect(mockSupabaseClient.channel().unsubscribe).toHaveBeenCalled();
    });

    it('deve limpar conflitos resolvidos automaticamente', async () => {
      const { result } = renderHook(() => 
        useConflictMonitor('products', {
          autoCleanup: true,
          cleanupInterval: 1000
        })
      );

      const resolvedConflicts = [
        {
          ...mockConflictData,
          status: 'resolved',
          resolvedAt: new Date(Date.now() - 2000) // Resolvido há 2 segundos
        }
      ];
      mockRealtimeContext.conflicts = resolvedConflicts;

      await act(async () => {
        result.current.startMonitoring();
      });

      await waitFor(() => {
        expect(mockRealtimeContext.clearConflicts).toHaveBeenCalled();
      }, { timeout: 2000 });
    });

    it('deve limpar conflitos antigos não resolvidos', async () => {
      const { result } = renderHook(() => 
        useConflictMonitor('products', {
          maxAge: 60000 // 1 minuto
        })
      );

      const oldConflicts = [
        {
          ...mockConflictData,
          timestamp: new Date(Date.now() - 120000) // 2 minutos atrás
        }
      ];
      mockRealtimeContext.conflicts = oldConflicts;

      await act(async () => {
        result.current.cleanupOldConflicts();
      });

      expect(mockRealtimeContext.clearConflicts).toHaveBeenCalled();
    });
  });
});