import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RealtimeProvider, useRealtimeContext, useConflictMonitor } from '../../contexts/RealtimeContext';

// Mock do navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true
});

// Componente de teste para o contexto
const TestComponent: React.FC = () => {
  const {
    state,
    updateSyncCount,
    addConflict,
    resolveConflict,
    updateMetrics,
    updateSettings,
    resetConflicts,
    hasUnresolvedConflicts,
    isFullyConnected,
    totalSyncCount
  } = useRealtimeContext();

  return (
    <div>
      <div data-testid="online-status">{state.isOnline ? 'online' : 'offline'}</div>
      <div data-testid="sync-count-cart">{state.syncCounts.cart}</div>
      <div data-testid="sync-count-stock">{state.syncCounts.stock}</div>
      <div data-testid="sync-count-orders">{state.syncCounts.orders}</div>
      <div data-testid="conflicts-count">{state.conflicts.length}</div>
      <div data-testid="unresolved-conflicts">{hasUnresolvedConflicts ? 'true' : 'false'}</div>
      <div data-testid="fully-connected">{isFullyConnected ? 'true' : 'false'}</div>
      <div data-testid="total-sync-count">{totalSyncCount}</div>
      <div data-testid="latency">{state.metrics.latency}</div>
      <div data-testid="error-rate">{state.metrics.errorRate}</div>
      <div data-testid="throughput">{state.metrics.throughput}</div>
      
      <button 
        data-testid="update-cart-sync" 
        onClick={() => updateSyncCount('cart')}
      >
        Update Cart Sync
      </button>
      
      <button 
        data-testid="add-conflict" 
        onClick={() => addConflict({
          id: 'test-conflict',
          type: 'data_mismatch',
          table: 'cart_items',
          recordId: '123',
          localData: { quantity: 2 },
          remoteData: { quantity: 3 },
          timestamp: new Date(),
          resolved: false
        })}
      >
        Add Conflict
      </button>
      
      <button 
        data-testid="resolve-conflict" 
        onClick={() => resolveConflict('test-conflict')}
      >
        Resolve Conflict
      </button>
      
      <button 
        data-testid="update-metrics" 
        onClick={() => updateMetrics({ latency: 150, errorRate: 0.02, throughput: 100 })}
      >
        Update Metrics
      </button>
      
      <button 
        data-testid="reset-conflicts" 
        onClick={resetConflicts}
      >
        Reset Conflicts
      </button>
    </div>
  );
};

// Componente de teste para o monitor de conflitos
const ConflictMonitorTestComponent: React.FC = () => {
  const { detectConflict, resolveConflict, conflicts } = useConflictMonitor();

  return (
    <div>
      <div data-testid="monitor-conflicts-count">{conflicts.length}</div>
      
      <button 
        data-testid="detect-conflict" 
        onClick={() => detectConflict({
          table: 'products',
          recordId: '456',
          localData: { price: 100 },
          remoteData: { price: 120 },
          timestamp: new Date()
        })}
      >
        Detect Conflict
      </button>
      
      <button 
        data-testid="resolve-with-latest" 
        onClick={() => resolveConflict('conflict-456', 'latest')}
      >
        Resolve with Latest
      </button>
      
      <button 
        data-testid="resolve-with-server" 
        onClick={() => resolveConflict('conflict-456', 'server_wins')}
      >
        Resolve with Server
      </button>
      
      <button 
        data-testid="resolve-with-local" 
        onClick={() => resolveConflict('conflict-456', 'local_wins')}
      >
        Resolve with Local
      </button>
    </div>
  );
};

describe('RealtimeContext', () => {
  beforeEach(() => {
    // Reset navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true
    });
    
    // Clear all timers
    vi.clearAllTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Estado Inicial', () => {
    it('deve inicializar com estado padrão', () => {
      render(
        <RealtimeProvider>
          <TestComponent />
        </RealtimeProvider>
      );

      expect(screen.getByTestId('online-status')).toHaveTextContent('online');
      expect(screen.getByTestId('sync-count-cart')).toHaveTextContent('0');
      expect(screen.getByTestId('sync-count-stock')).toHaveTextContent('0');
      expect(screen.getByTestId('sync-count-orders')).toHaveTextContent('0');
      expect(screen.getByTestId('conflicts-count')).toHaveTextContent('0');
      expect(screen.getByTestId('unresolved-conflicts')).toHaveTextContent('false');
      expect(screen.getByTestId('fully-connected')).toHaveTextContent('true');
      expect(screen.getByTestId('total-sync-count')).toHaveTextContent('0');
      expect(screen.getByTestId('latency')).toHaveTextContent('0');
      expect(screen.getByTestId('error-rate')).toHaveTextContent('0');
      expect(screen.getByTestId('throughput')).toHaveTextContent('0');
    });
  });

  describe('Detecção de Status Online/Offline', () => {
    it('deve detectar quando fica offline', async () => {
      render(
        <RealtimeProvider>
          <TestComponent />
        </RealtimeProvider>
      );

      expect(screen.getByTestId('online-status')).toHaveTextContent('online');

      // Simular perda de conexão
      act(() => {
        Object.defineProperty(navigator, 'onLine', {
          writable: true,
          value: false
        });
        
        // Disparar evento offline
        window.dispatchEvent(new Event('offline'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('online-status')).toHaveTextContent('offline');
        expect(screen.getByTestId('fully-connected')).toHaveTextContent('false');
      });
    });

    it('deve detectar quando volta online', async () => {
      // Começar offline
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false
      });

      render(
        <RealtimeProvider>
          <TestComponent />
        </RealtimeProvider>
      );

      expect(screen.getByTestId('online-status')).toHaveTextContent('offline');

      // Simular volta da conexão
      act(() => {
        Object.defineProperty(navigator, 'onLine', {
          writable: true,
          value: true
        });
        
        // Disparar evento online
        window.dispatchEvent(new Event('online'));
      });

      await waitFor(() => {
        expect(screen.getByTestId('online-status')).toHaveTextContent('online');
        expect(screen.getByTestId('fully-connected')).toHaveTextContent('true');
      });
    });
  });

  describe('Contadores de Sincronização', () => {
    it('deve atualizar contador de sincronização do carrinho', async () => {
      render(
        <RealtimeProvider>
          <TestComponent />
        </RealtimeProvider>
      );

      const button = screen.getByTestId('update-cart-sync');
      
      act(() => {
        button.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('sync-count-cart')).toHaveTextContent('1');
        expect(screen.getByTestId('total-sync-count')).toHaveTextContent('1');
      });
    });

    it('deve calcular total de sincronizações corretamente', async () => {
      render(
        <RealtimeProvider>
          <TestComponent />
        </RealtimeProvider>
      );

      const cartButton = screen.getByTestId('update-cart-sync');
      
      // Simular múltiplas sincronizações
      act(() => {
        cartButton.click();
        cartButton.click();
        cartButton.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('sync-count-cart')).toHaveTextContent('3');
        expect(screen.getByTestId('total-sync-count')).toHaveTextContent('3');
      });
    });
  });

  describe('Gestão de Conflitos', () => {
    it('deve adicionar conflito corretamente', async () => {
      render(
        <RealtimeProvider>
          <TestComponent />
        </RealtimeProvider>
      );

      const addButton = screen.getByTestId('add-conflict');
      
      act(() => {
        addButton.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('conflicts-count')).toHaveTextContent('1');
        expect(screen.getByTestId('unresolved-conflicts')).toHaveTextContent('true');
      });
    });

    it('deve resolver conflito corretamente', async () => {
      render(
        <RealtimeProvider>
          <TestComponent />
        </RealtimeProvider>
      );

      const addButton = screen.getByTestId('add-conflict');
      const resolveButton = screen.getByTestId('resolve-conflict');
      
      // Adicionar conflito
      act(() => {
        addButton.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('unresolved-conflicts')).toHaveTextContent('true');
      });

      // Resolver conflito
      act(() => {
        resolveButton.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('unresolved-conflicts')).toHaveTextContent('false');
      });
    });

    it('deve resetar todos os conflitos', async () => {
      render(
        <RealtimeProvider>
          <TestComponent />
        </RealtimeProvider>
      );

      const addButton = screen.getByTestId('add-conflict');
      const resetButton = screen.getByTestId('reset-conflicts');
      
      // Adicionar conflito
      act(() => {
        addButton.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('conflicts-count')).toHaveTextContent('1');
      });

      // Resetar conflitos
      act(() => {
        resetButton.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('conflicts-count')).toHaveTextContent('0');
        expect(screen.getByTestId('unresolved-conflicts')).toHaveTextContent('false');
      });
    });
  });

  describe('Métricas de Performance', () => {
    it('deve atualizar métricas corretamente', async () => {
      render(
        <RealtimeProvider>
          <TestComponent />
        </RealtimeProvider>
      );

      const updateButton = screen.getByTestId('update-metrics');
      
      act(() => {
        updateButton.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('latency')).toHaveTextContent('150');
        expect(screen.getByTestId('error-rate')).toHaveTextContent('0.02');
        expect(screen.getByTestId('throughput')).toHaveTextContent('100');
      });
    });
  });
});

describe('useConflictMonitor', () => {
  beforeEach(() => {
    vi.clearAllTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Detecção de Conflitos', () => {
    it('deve detectar conflito de dados', async () => {
      render(
        <RealtimeProvider>
          <ConflictMonitorTestComponent />
        </RealtimeProvider>
      );

      const detectButton = screen.getByTestId('detect-conflict');
      
      act(() => {
        detectButton.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('monitor-conflicts-count')).toHaveTextContent('1');
      });
    });
  });

  describe('Resolução de Conflitos', () => {
    it('deve resolver conflito com estratégia latest', async () => {
      render(
        <RealtimeProvider>
          <ConflictMonitorTestComponent />
        </RealtimeProvider>
      );

      const detectButton = screen.getByTestId('detect-conflict');
      const resolveButton = screen.getByTestId('resolve-with-latest');
      
      // Detectar conflito
      act(() => {
        detectButton.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('monitor-conflicts-count')).toHaveTextContent('1');
      });

      // Resolver com estratégia latest
      act(() => {
        resolveButton.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('monitor-conflicts-count')).toHaveTextContent('0');
      });
    });

    it('deve resolver conflito com estratégia server_wins', async () => {
      render(
        <RealtimeProvider>
          <ConflictMonitorTestComponent />
        </RealtimeProvider>
      );

      const detectButton = screen.getByTestId('detect-conflict');
      const resolveButton = screen.getByTestId('resolve-with-server');
      
      // Detectar conflito
      act(() => {
        detectButton.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('monitor-conflicts-count')).toHaveTextContent('1');
      });

      // Resolver com estratégia server_wins
      act(() => {
        resolveButton.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('monitor-conflicts-count')).toHaveTextContent('0');
      });
    });

    it('deve resolver conflito com estratégia local_wins', async () => {
      render(
        <RealtimeProvider>
          <ConflictMonitorTestComponent />
        </RealtimeProvider>
      );

      const detectButton = screen.getByTestId('detect-conflict');
      const resolveButton = screen.getByTestId('resolve-with-local');
      
      // Detectar conflito
      act(() => {
        detectButton.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('monitor-conflicts-count')).toHaveTextContent('1');
      });

      // Resolver com estratégia local_wins
      act(() => {
        resolveButton.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId('monitor-conflicts-count')).toHaveTextContent('0');
      });
    });
  });
});