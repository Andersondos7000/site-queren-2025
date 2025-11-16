import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, jest as vi, beforeEach, afterEach } from '@jest/globals';
import { ConflictResolver } from '../../components/realtime/ConflictResolver';
import { RealtimeProvider } from '../../contexts/RealtimeContext';
import type { DataConflict, ConflictResolutionStrategy } from '../../types/realtime';

// Mock de conflitos de teste
const mockConflicts: DataConflict[] = [
  {
    id: 'conflict-1',
    table: 'products',
    recordId: 'prod-123',
    field: 'price',
    localValue: 29.99,
    remoteValue: 34.99,
    timestamp: new Date('2024-01-15T10:30:00Z'),
    type: 'update_conflict',
    status: 'pending',
    metadata: {
      localTimestamp: new Date('2024-01-15T10:29:00Z'),
      remoteTimestamp: new Date('2024-01-15T10:31:00Z'),
      userId: 'user-123'
    }
  },
  {
    id: 'conflict-2',
    table: 'inventory',
    recordId: 'inv-456',
    field: 'quantity',
    localValue: 15,
    remoteValue: 12,
    timestamp: new Date('2024-01-15T10:25:00Z'),
    type: 'concurrent_update',
    status: 'pending',
    metadata: {
      localTimestamp: new Date('2024-01-15T10:24:00Z'),
      remoteTimestamp: new Date('2024-01-15T10:26:00Z'),
      userId: 'user-456'
    }
  },
  {
    id: 'conflict-3',
    table: 'orders',
    recordId: 'order-789',
    field: 'status',
    localValue: 'processing',
    remoteValue: 'cancelled',
    timestamp: new Date('2024-01-15T10:20:00Z'),
    type: 'state_conflict',
    metadata: {
      localTimestamp: new Date('2024-01-15T10:19:00Z'),
      remoteTimestamp: new Date('2024-01-15T10:21:00Z'),
      userId: 'user-789'
    }
  }
];

// Mock do RealtimeContext
const mockRealtimeContext = {
  isConnected: true,
  connectionStatus: 'connected' as const,
  syncCount: 150,
  errorCount: 5,
  lastSync: new Date(),
  conflicts: mockConflicts,
  metrics: {
    latency: 120,
    throughput: 85,
    errorRate: 0.033,
    reconnectCount: 2
  },
  connect: vi.fn(),
  disconnect: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  addConflict: vi.fn(),
  resolveConflict: vi.fn(),
  resetConflicts: vi.fn(),
  updateMetrics: vi.fn()
};

vi.mock('../../contexts/RealtimeContext', () => ({
  RealtimeProvider: ({ children }: { children: React.ReactNode }) => children,
  useRealtime: () => mockRealtimeContext
}));

// Mock do hook useConflictMonitor
const mockUseConflictMonitor = {
  conflicts: mockConflicts,
  conflictCount: mockConflicts.length,
  resolveConflict: vi.fn(),
  resolveAllConflicts: vi.fn(),
  getConflictsByTable: vi.fn(),
  getConflictsByType: vi.fn(),
  autoResolveConflicts: vi.fn(),
  setResolutionStrategy: vi.fn()
};

vi.mock('../../hooks/realtime/useConflictMonitor', () => ({
  useConflictMonitor: () => mockUseConflictMonitor
}));

// Mock de formatação de tempo
vi.mock('../../utils/dateUtils', () => ({
  formatRelativeTime: vi.fn((date: Date) => {
    const now = new Date('2024-01-15T10:35:00Z');
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    return `${minutes} minutos atrás`;
  }),
  formatDateTime: vi.fn((date: Date) => {
    return date.toLocaleString('pt-BR');
  })
}));

// Mock de notificações
const mockShowNotification = vi.fn();
vi.mock('../../hooks/useNotification', () => ({
  useNotification: () => ({
    showNotification: mockShowNotification
  })
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  React.createElement(RealtimeProvider, {}, children)
);

describe('ConflictResolver', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRealtimeContext.conflicts = mockConflicts;
    mockUseConflictMonitor.conflicts = mockConflicts;
    mockUseConflictMonitor.conflictCount = mockConflicts.length;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Renderização Básica', () => {
    it('deve renderizar o componente corretamente', () => {
      render(<ConflictResolver />, { wrapper });

      expect(screen.getByText('Resolução de Conflitos')).toBeInTheDocument();
      expect(screen.getByText('3 conflitos detectados')).toBeInTheDocument();
    });

    it('deve exibir mensagem quando não há conflitos', () => {
      mockRealtimeContext.conflicts = [];
      mockUseConflictMonitor.conflicts = [];
      mockUseConflictMonitor.conflictCount = 0;

      render(<ConflictResolver />, { wrapper });

      expect(screen.getByText('Nenhum conflito detectado')).toBeInTheDocument();
      expect(screen.getByText('Todos os dados estão sincronizados')).toBeInTheDocument();
    });

    it('deve exibir lista de conflitos', () => {
      render(<ConflictResolver />, { wrapper });

      expect(screen.getByText('products.price')).toBeInTheDocument();
      expect(screen.getByText('inventory.quantity')).toBeInTheDocument();
      expect(screen.getByText('orders.status')).toBeInTheDocument();
    });
  });

  describe('Exibição de Conflitos', () => {
    it('deve exibir detalhes do conflito', () => {
      render(<ConflictResolver />, { wrapper });

      // Primeiro conflito
      expect(screen.getByText('Local: R$ 29,99')).toBeInTheDocument();
      expect(screen.getByText('Remoto: R$ 34,99')).toBeInTheDocument();
      expect(screen.getByText('5 minutos atrás')).toBeInTheDocument();
    });

    it('deve exibir tipos de conflito com ícones apropriados', () => {
      render(<ConflictResolver />, { wrapper });

      expect(screen.getByTestId('conflict-type-update_conflict')).toBeInTheDocument();
      expect(screen.getByTestId('conflict-type-concurrent_update')).toBeInTheDocument();
      expect(screen.getByTestId('conflict-type-state_conflict')).toBeInTheDocument();
    });

    it('deve exibir metadados do conflito', () => {
      render(<ConflictResolver />, { wrapper });

      // Expandir detalhes do primeiro conflito
      const expandButton = screen.getAllByLabelText('Expandir detalhes')[0];
      fireEvent.click(expandButton);

      expect(screen.getByText('Usuário: user-123')).toBeInTheDocument();
      expect(screen.getByText('Tabela: products')).toBeInTheDocument();
      expect(screen.getByText('Campo: price')).toBeInTheDocument();
    });

    it('deve destacar conflitos críticos', () => {
      // Adicionar conflito crítico
      const criticalConflict = {
        ...mockConflicts[0],
        id: 'critical-conflict',
        type: 'state_conflict' as const,
        field: 'status',
        localValue: 'paid',
        remoteValue: 'cancelled'
      };

      mockRealtimeContext.conflicts = [criticalConflict, ...mockConflicts];
      mockUseConflictMonitor.conflicts = [criticalConflict, ...mockConflicts];

      render(<ConflictResolver />, { wrapper });

      const conflictItem = screen.getByTestId('conflict-critical-conflict');
      expect(conflictItem).toHaveClass('critical');
    });
  });

  describe('Resolução de Conflitos', () => {
    it('deve resolver conflito com valor local', async () => {
      render(<ConflictResolver />, { wrapper });

      const useLocalButton = screen.getAllByText('Usar Local')[0];
      fireEvent.click(useLocalButton);

      expect(mockUseConflictMonitor.resolveConflict).toHaveBeenCalledWith(
        'conflict-1',
        'use_local'
      );
    });

    it('deve resolver conflito com valor remoto', async () => {
      render(<ConflictResolver />, { wrapper });

      const useRemoteButton = screen.getAllByText('Usar Remoto')[0];
      fireEvent.click(useRemoteButton);

      expect(mockUseConflictMonitor.resolveConflict).toHaveBeenCalledWith(
        'conflict-1',
        'use_remote'
      );
    });

    it('deve permitir resolução manual com valor customizado', async () => {
      render(<ConflictResolver />, { wrapper });

      const manualButton = screen.getAllByText('Manual')[0];
      fireEvent.click(manualButton);

      const customInput = screen.getByPlaceholderText('Digite o valor...');
      fireEvent.change(customInput, { target: { value: '32.99' } });

      const confirmButton = screen.getByText('Confirmar');
      fireEvent.click(confirmButton);

      expect(mockUseConflictMonitor.resolveConflict).toHaveBeenCalledWith(
        'conflict-1',
        'manual',
        '32.99'
      );
    });

    it('deve resolver todos os conflitos automaticamente', async () => {
      render(<ConflictResolver />, { wrapper });

      const resolveAllButton = screen.getByText('Resolver Todos');
      fireEvent.click(resolveAllButton);

      // Deve abrir modal de confirmação
      expect(screen.getByText('Confirmar Resolução Automática')).toBeInTheDocument();

      const confirmButton = screen.getByText('Confirmar Resolução');
      fireEvent.click(confirmButton);

      expect(mockUseConflictMonitor.resolveAllConflicts).toHaveBeenCalledWith('use_remote');
    });

    it('deve permitir escolher estratégia de resolução automática', async () => {
      render(<ConflictResolver />, { wrapper });

      const strategySelect = screen.getByLabelText('Estratégia de resolução');
      fireEvent.change(strategySelect, { target: { value: 'use_latest' } });

      expect(mockUseConflictMonitor.setResolutionStrategy).toHaveBeenCalledWith('use_latest');
    });
  });

  describe('Filtragem e Ordenação', () => {
    it('deve filtrar conflitos por tabela', () => {
      render(<ConflictResolver />, { wrapper });

      const tableFilter = screen.getByLabelText('Filtrar por tabela');
      fireEvent.change(tableFilter, { target: { value: 'products' } });

      expect(screen.getByText('products.price')).toBeInTheDocument();
      expect(screen.queryByText('inventory.quantity')).not.toBeInTheDocument();
    });

    it('deve filtrar conflitos por tipo', () => {
      render(<ConflictResolver />, { wrapper });

      const typeFilter = screen.getByLabelText('Filtrar por tipo');
      fireEvent.change(typeFilter, { target: { value: 'update_conflict' } });

      expect(mockUseConflictMonitor.getConflictsByType).toHaveBeenCalledWith('update_conflict');
    });

    it('deve ordenar conflitos por timestamp', () => {
      render(<ConflictResolver />, { wrapper });

      const sortSelect = screen.getByLabelText('Ordenar por');
      fireEvent.change(sortSelect, { target: { value: 'timestamp_desc' } });

      // Verificar se os conflitos estão ordenados corretamente
      const conflictItems = screen.getAllByTestId(/^conflict-/);
      expect(conflictItems[0]).toHaveAttribute('data-testid', 'conflict-conflict-1'); // Mais recente
    });

    it('deve ordenar conflitos por prioridade', () => {
      render(<ConflictResolver />, { wrapper });

      const sortSelect = screen.getByLabelText('Ordenar por');
      fireEvent.change(sortSelect, { target: { value: 'priority' } });

      // Conflitos de estado devem aparecer primeiro (maior prioridade)
      const conflictItems = screen.getAllByTestId(/^conflict-/);
      expect(conflictItems[0]).toHaveAttribute('data-testid', 'conflict-conflict-3');
    });
  });

  describe('Modo Compacto', () => {
    it('deve renderizar em modo compacto', () => {
      render(<ConflictResolver compact />, { wrapper });

      expect(screen.getByTestId('conflict-resolver-compact')).toBeInTheDocument();
      expect(screen.queryByText('Resolução de Conflitos')).not.toBeInTheDocument();
    });

    it('deve exibir apenas contador em modo compacto', () => {
      render(<ConflictResolver compact />, { wrapper });

      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByTestId('conflict-counter')).toBeInTheDocument();
    });

    it('deve expandir ao clicar no contador compacto', () => {
      render(<ConflictResolver compact />, { wrapper });

      const counter = screen.getByTestId('conflict-counter');
      fireEvent.click(counter);

      expect(screen.getByText('Resolução de Conflitos')).toBeInTheDocument();
    });
  });

  describe('Notificações', () => {
    it('deve notificar quando conflito é resolvido', async () => {
      mockUseConflictMonitor.resolveConflict.mockResolvedValue(true);

      render(<ConflictResolver />, { wrapper });

      const useLocalButton = screen.getAllByText('Usar Local')[0];
      fireEvent.click(useLocalButton);

      await waitFor(() => {
        expect(mockShowNotification).toHaveBeenCalledWith({
          type: 'success',
          message: 'Conflito resolvido com sucesso',
          duration: 3000
        });
      });
    });

    it('deve notificar quando resolução falha', async () => {
      mockUseConflictMonitor.resolveConflict.mockRejectedValue(new Error('Erro de rede'));

      render(<ConflictResolver />, { wrapper });

      const useLocalButton = screen.getAllByText('Usar Local')[0];
      fireEvent.click(useLocalButton);

      await waitFor(() => {
        expect(mockShowNotification).toHaveBeenCalledWith({
          type: 'error',
          message: 'Erro ao resolver conflito: Erro de rede',
          duration: 5000
        });
      });
    });

    it('deve notificar sobre novos conflitos', () => {
      const { rerender } = render(<ConflictResolver />, { wrapper });

      // Adicionar novo conflito
      const newConflict = {
        id: 'new-conflict',
        table: 'users',
        recordId: 'user-999',
        field: 'email',
        localValue: 'old@email.com',
        remoteValue: 'new@email.com',
        timestamp: new Date(),
        type: 'update_conflict' as const,
        metadata: {}
      };

      mockRealtimeContext.conflicts = [...mockConflicts, newConflict];
      mockUseConflictMonitor.conflicts = [...mockConflicts, newConflict];
      mockUseConflictMonitor.conflictCount = 4;

      rerender(<ConflictResolver />);

      expect(mockShowNotification).toHaveBeenCalledWith({
        type: 'warning',
        message: 'Novo conflito detectado em users.email',
        duration: 4000
      });
    });
  });

  describe('Validação de Dados', () => {
    it('deve validar valor customizado antes de resolver', async () => {
      render(<ConflictResolver />, { wrapper });

      const manualButton = screen.getAllByText('Manual')[0];
      fireEvent.click(manualButton);

      const customInput = screen.getByPlaceholderText('Digite o valor...');
      fireEvent.change(customInput, { target: { value: 'valor_inválido' } });

      const confirmButton = screen.getByText('Confirmar');
      fireEvent.click(confirmButton);

      expect(screen.getByText('Valor inválido para o tipo de campo')).toBeInTheDocument();
      expect(mockUseConflictMonitor.resolveConflict).not.toHaveBeenCalled();
    });

    it('deve aceitar valor customizado válido', async () => {
      render(<ConflictResolver />, { wrapper });

      const manualButton = screen.getAllByText('Manual')[0];
      fireEvent.click(manualButton);

      const customInput = screen.getByPlaceholderText('Digite o valor...');
      fireEvent.change(customInput, { target: { value: '25.50' } });

      const confirmButton = screen.getByText('Confirmar');
      fireEvent.click(confirmButton);

      expect(mockUseConflictMonitor.resolveConflict).toHaveBeenCalledWith(
        'conflict-1',
        'manual',
        '25.50'
      );
    });
  });

  describe('Acessibilidade', () => {
    it('deve ter labels apropriados para screen readers', () => {
      render(<ConflictResolver />, { wrapper });

      expect(screen.getByLabelText('Lista de conflitos de dados')).toBeInTheDocument();
      expect(screen.getByLabelText('Estratégia de resolução')).toBeInTheDocument();
    });

    it('deve anunciar mudanças no número de conflitos', () => {
      const { rerender } = render(<ConflictResolver />, { wrapper });

      mockRealtimeContext.conflicts = mockConflicts.slice(0, 2);
      mockUseConflictMonitor.conflicts = mockConflicts.slice(0, 2);
      mockUseConflictMonitor.conflictCount = 2;

      rerender(<ConflictResolver />);

      expect(screen.getByRole('status')).toHaveTextContent('2 conflitos detectados');
    });

    it('deve suportar navegação por teclado', () => {
      render(<ConflictResolver />, { wrapper });

      const firstResolveButton = screen.getAllByText('Usar Local')[0];
      firstResolveButton.focus();
      expect(firstResolveButton).toHaveFocus();

      fireEvent.keyDown(firstResolveButton, { key: 'Enter' });
      expect(mockUseConflictMonitor.resolveConflict).toHaveBeenCalled();
    });
  });

  describe('Performance', () => {
    it('deve virtualizar lista de conflitos para grandes volumes', () => {
      // Simular muitos conflitos
      const manyConflicts = Array.from({ length: 1000 }, (_, i) => ({
        ...mockConflicts[0],
        id: `conflict-${i}`,
        recordId: `record-${i}`
      }));

      mockRealtimeContext.conflicts = manyConflicts;
      mockUseConflictMonitor.conflicts = manyConflicts;
      mockUseConflictMonitor.conflictCount = 1000;

      render(<ConflictResolver />, { wrapper });

      // Deve renderizar apenas conflitos visíveis
      const renderedConflicts = screen.getAllByTestId(/^conflict-/);
      expect(renderedConflicts.length).toBeLessThan(50); // Apenas os visíveis
    });

    it('deve debounce filtros para evitar re-renders excessivos', async () => {
      const renderSpy = vi.fn();
      const TestComponent = () => {
        renderSpy();
        return <ConflictResolver />;
      };

      render(<TestComponent />, { wrapper });
      
      const tableFilter = screen.getByLabelText('Filtrar por tabela');
      
      // Múltiplas mudanças rápidas
      fireEvent.change(tableFilter, { target: { value: 'p' } });
      fireEvent.change(tableFilter, { target: { value: 'pr' } });
      fireEvent.change(tableFilter, { target: { value: 'pro' } });
      fireEvent.change(tableFilter, { target: { value: 'products' } });

      // Deve aguardar debounce
      await waitFor(() => {
        expect(renderSpy).toHaveBeenCalledTimes(2); // Render inicial + após debounce
      }, { timeout: 1000 });
    });
  });
});