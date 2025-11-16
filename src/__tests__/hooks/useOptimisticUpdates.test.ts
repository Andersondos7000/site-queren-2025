import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useOptimisticUpdates } from '../../hooks/realtime/useOptimisticUpdates';
import { createClient } from '@supabase/supabase-js';

// Mock do Supabase
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn()
      }))
    })),
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn()
      }))
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn()
        }))
      }))
    })),
    delete: vi.fn(() => ({
      eq: vi.fn()
    }))
  }))
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase)
}));

// Mock do console para capturar logs
const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

interface TestItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

describe('useOptimisticUpdates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy.mockClear();
    consoleWarnSpy.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Inicialização', () => {
    it('deve inicializar com estado vazio', () => {
      const { result } = renderHook(() => 
        useOptimisticUpdates<TestItem>('test_table')
      );

      expect(result.current.optimisticData).toEqual([]);
      expect(result.current.pendingOperations).toEqual([]);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('deve inicializar com dados iniciais', () => {
      const initialData: TestItem[] = [
        { id: '1', name: 'Item 1', quantity: 2, price: 10.99 },
        { id: '2', name: 'Item 2', quantity: 1, price: 5.50 }
      ];

      const { result } = renderHook(() => 
        useOptimisticUpdates<TestItem>('test_table', { initialData })
      );

      expect(result.current.optimisticData).toEqual(initialData);
    });
  });

  describe('Operações Otimistas - Insert', () => {
    it('deve aplicar insert otimista imediatamente', async () => {
      const { result } = renderHook(() => 
        useOptimisticUpdates<TestItem>('test_table')
      );

      const newItem: Omit<TestItem, 'id'> = {
        name: 'New Item',
        quantity: 3,
        price: 15.99
      };

      // Mock da resposta bem-sucedida
      const mockResponse = { 
        data: { id: 'new-id', ...newItem }, 
        error: null 
      };
      mockSupabase.from().insert().select().single.mockResolvedValue(mockResponse);

      await act(async () => {
        await result.current.optimisticInsert(newItem);
      });

      // Deve aplicar a mudança otimista imediatamente
      expect(result.current.optimisticData).toHaveLength(1);
      expect(result.current.optimisticData[0]).toMatchObject(newItem);
      expect(result.current.optimisticData[0].id).toMatch(/^temp-/);
    });

    it('deve confirmar insert após resposta do servidor', async () => {
      const { result } = renderHook(() => 
        useOptimisticUpdates<TestItem>('test_table')
      );

      const newItem: Omit<TestItem, 'id'> = {
        name: 'New Item',
        quantity: 3,
        price: 15.99
      };

      const mockResponse = { 
        data: { id: 'server-id', ...newItem }, 
        error: null 
      };
      mockSupabase.from().insert().select().single.mockResolvedValue(mockResponse);

      await act(async () => {
        await result.current.optimisticInsert(newItem);
      });

      await waitFor(() => {
        expect(result.current.optimisticData[0].id).toBe('server-id');
        expect(result.current.pendingOperations).toHaveLength(0);
      });
    });

    it('deve fazer rollback em caso de erro no insert', async () => {
      const { result } = renderHook(() => 
        useOptimisticUpdates<TestItem>('test_table')
      );

      const newItem: Omit<TestItem, 'id'> = {
        name: 'New Item',
        quantity: 3,
        price: 15.99
      };

      // Mock de erro
      const mockError = { 
        data: null, 
        error: { message: 'Insert failed', code: '23505' } 
      };
      mockSupabase.from().insert().select().single.mockResolvedValue(mockError);

      await act(async () => {
        await result.current.optimisticInsert(newItem);
      });

      await waitFor(() => {
        expect(result.current.optimisticData).toHaveLength(0);
        expect(result.current.error).toBeTruthy();
        expect(result.current.pendingOperations).toHaveLength(0);
      });
    });
  });

  describe('Operações Otimistas - Update', () => {
    it('deve aplicar update otimista imediatamente', async () => {
      const initialData: TestItem[] = [
        { id: '1', name: 'Item 1', quantity: 2, price: 10.99 }
      ];

      const { result } = renderHook(() => 
        useOptimisticUpdates<TestItem>('test_table', { initialData })
      );

      const updates = { quantity: 5, price: 12.99 };

      const mockResponse = { 
        data: [{ id: '1', name: 'Item 1', ...updates }], 
        error: null 
      };
      mockSupabase.from().update().eq().select().single.mockResolvedValue(mockResponse);

      await act(async () => {
        await result.current.optimisticUpdate('1', updates);
      });

      // Deve aplicar a mudança otimista imediatamente
      expect(result.current.optimisticData[0]).toMatchObject({
        id: '1',
        name: 'Item 1',
        quantity: 5,
        price: 12.99
      });
    });

    it('deve fazer rollback em caso de erro no update', async () => {
      const initialData: TestItem[] = [
        { id: '1', name: 'Item 1', quantity: 2, price: 10.99 }
      ];

      const { result } = renderHook(() => 
        useOptimisticUpdates<TestItem>('test_table', { initialData })
      );

      const updates = { quantity: 5 };

      // Mock de erro
      const mockError = { 
        data: null, 
        error: { message: 'Update failed', code: '23503' } 
      };
      mockSupabase.from().update().eq().select().single.mockResolvedValue(mockError);

      await act(async () => {
        await result.current.optimisticUpdate('1', updates);
      });

      await waitFor(() => {
        // Deve voltar ao estado original
        expect(result.current.optimisticData[0]).toMatchObject({
          id: '1',
          name: 'Item 1',
          quantity: 2,
          price: 10.99
        });
        expect(result.current.error).toBeTruthy();
      });
    });

    it('deve lidar com update de item inexistente', async () => {
      const { result } = renderHook(() => 
        useOptimisticUpdates<TestItem>('test_table')
      );

      const updates = { quantity: 5 };

      await act(async () => {
        await result.current.optimisticUpdate('nonexistent', updates);
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Tentativa de atualizar item inexistente:', 'nonexistent'
      );
      expect(result.current.optimisticData).toHaveLength(0);
    });
  });

  describe('Operações Otimistas - Delete', () => {
    it('deve aplicar delete otimista imediatamente', async () => {
      const initialData: TestItem[] = [
        { id: '1', name: 'Item 1', quantity: 2, price: 10.99 },
        { id: '2', name: 'Item 2', quantity: 1, price: 5.50 }
      ];

      const { result } = renderHook(() => 
        useOptimisticUpdates<TestItem>('test_table', { initialData })
      );

      const mockResponse = { data: null, error: null };
      mockSupabase.from().delete().eq.mockResolvedValue(mockResponse);

      await act(async () => {
        await result.current.optimisticDelete('1');
      });

      // Deve remover o item imediatamente
      expect(result.current.optimisticData).toHaveLength(1);
      expect(result.current.optimisticData[0].id).toBe('2');
    });

    it('deve fazer rollback em caso de erro no delete', async () => {
      const initialData: TestItem[] = [
        { id: '1', name: 'Item 1', quantity: 2, price: 10.99 }
      ];

      const { result } = renderHook(() => 
        useOptimisticUpdates<TestItem>('test_table', { initialData })
      );

      // Mock de erro
      const mockError = { 
        data: null, 
        error: { message: 'Delete failed', code: '23503' } 
      };
      mockSupabase.from().delete().eq.mockResolvedValue(mockError);

      await act(async () => {
        await result.current.optimisticDelete('1');
      });

      await waitFor(() => {
        // Deve restaurar o item
        expect(result.current.optimisticData).toHaveLength(1);
        expect(result.current.optimisticData[0].id).toBe('1');
        expect(result.current.error).toBeTruthy();
      });
    });

    it('deve lidar com delete de item inexistente', async () => {
      const { result } = renderHook(() => 
        useOptimisticUpdates<TestItem>('test_table')
      );

      await act(async () => {
        await result.current.optimisticDelete('nonexistent');
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Tentativa de deletar item inexistente:', 'nonexistent'
      );
    });
  });

  describe('Operações Múltiplas Simultâneas', () => {
    it('deve lidar com múltiplas operações pendentes', async () => {
      const initialData: TestItem[] = [
        { id: '1', name: 'Item 1', quantity: 2, price: 10.99 }
      ];

      const { result } = renderHook(() => 
        useOptimisticUpdates<TestItem>('test_table', { initialData })
      );

      // Mock de respostas lentas
      const slowResponse = new Promise(resolve => 
        setTimeout(() => resolve({ data: null, error: null }), 100)
      );
      
      mockSupabase.from().update().eq().select().single.mockReturnValue(slowResponse);
      mockSupabase.from().insert().select().single.mockReturnValue(slowResponse);

      // Executar múltiplas operações
      act(() => {
        result.current.optimisticUpdate('1', { quantity: 5 });
        result.current.optimisticInsert({ name: 'New Item', quantity: 1, price: 7.99 });
      });

      // Deve ter 2 operações pendentes
      expect(result.current.pendingOperations).toHaveLength(2);
      expect(result.current.isLoading).toBe(true);

      // Aguardar conclusão
      await waitFor(() => {
        expect(result.current.pendingOperations).toHaveLength(0);
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 200 });
    });

    it('deve manter ordem das operações', async () => {
      const { result } = renderHook(() => 
        useOptimisticUpdates<TestItem>('test_table')
      );

      const operations: Array<() => Promise<void>> = [];

      // Simular operações sequenciais
      for (let i = 1; i <= 3; i++) {
        operations.push(() => 
          result.current.optimisticInsert({
            name: `Item ${i}`,
            quantity: i,
            price: i * 10
          })
        );
      }

      // Mock de respostas bem-sucedidas
      mockSupabase.from().insert().select().single.mockImplementation(
        (data) => Promise.resolve({ 
          data: { id: `server-${Date.now()}`, ...data }, 
          error: null 
        })
      );

      // Executar operações
      await act(async () => {
        for (const operation of operations) {
          await operation();
        }
      });

      expect(result.current.optimisticData).toHaveLength(3);
      expect(result.current.optimisticData[0].name).toBe('Item 1');
      expect(result.current.optimisticData[1].name).toBe('Item 2');
      expect(result.current.optimisticData[2].name).toBe('Item 3');
    });
  });

  describe('Sincronização com Dados Remotos', () => {
    it('deve sincronizar com dados remotos', async () => {
      const initialData: TestItem[] = [
        { id: '1', name: 'Item 1', quantity: 2, price: 10.99 }
      ];

      const { result } = renderHook(() => 
        useOptimisticUpdates<TestItem>('test_table', { initialData })
      );

      const remoteData: TestItem[] = [
        { id: '1', name: 'Item 1 Updated', quantity: 3, price: 12.99 },
        { id: '2', name: 'Item 2', quantity: 1, price: 5.50 }
      ];

      act(() => {
        result.current.syncWithRemote(remoteData);
      });

      expect(result.current.optimisticData).toEqual(remoteData);
    });

    it('deve preservar mudanças otimistas durante sincronização', async () => {
      const initialData: TestItem[] = [
        { id: '1', name: 'Item 1', quantity: 2, price: 10.99 }
      ];

      const { result } = renderHook(() => 
        useOptimisticUpdates<TestItem>('test_table', { initialData })
      );

      // Fazer uma mudança otimista pendente
      const slowResponse = new Promise(resolve => 
        setTimeout(() => resolve({ 
          data: [{ id: '1', name: 'Item 1', quantity: 5, price: 10.99 }], 
          error: null 
        }), 100)
      );
      mockSupabase.from().update().eq().select().single.mockReturnValue(slowResponse);

      act(() => {
        result.current.optimisticUpdate('1', { quantity: 5 });
      });

      // Sincronizar com dados remotos
      const remoteData: TestItem[] = [
        { id: '1', name: 'Item 1 Remote', quantity: 2, price: 10.99 }
      ];

      act(() => {
        result.current.syncWithRemote(remoteData);
      });

      // Deve manter a mudança otimista
      expect(result.current.optimisticData[0].quantity).toBe(5);
      expect(result.current.optimisticData[0].name).toBe('Item 1 Remote');
    });
  });

  describe('Limpeza e Reset', () => {
    it('deve limpar erros', async () => {
      const { result } = renderHook(() => 
        useOptimisticUpdates<TestItem>('test_table')
      );

      // Simular erro
      const mockError = { 
        data: null, 
        error: { message: 'Test error' } 
      };
      mockSupabase.from().insert().select().single.mockResolvedValue(mockError);

      await act(async () => {
        await result.current.optimisticInsert({ name: 'Test', quantity: 1, price: 1 });
      });

      expect(result.current.error).toBeTruthy();

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });

    it('deve cancelar operações pendentes', async () => {
      const { result } = renderHook(() => 
        useOptimisticUpdates<TestItem>('test_table')
      );

      // Mock de operação lenta
      const slowResponse = new Promise(resolve => 
        setTimeout(() => resolve({ data: null, error: null }), 1000)
      );
      mockSupabase.from().insert().select().single.mockReturnValue(slowResponse);

      act(() => {
        result.current.optimisticInsert({ name: 'Test', quantity: 1, price: 1 });
      });

      expect(result.current.pendingOperations).toHaveLength(1);

      act(() => {
        result.current.cancelPendingOperations();
      });

      expect(result.current.pendingOperations).toHaveLength(0);
      expect(result.current.isLoading).toBe(false);
    });
  });
});