import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OfflineIndicator } from '../../components/realtime/OfflineIndicator';
import { RealtimeProvider } from '../../contexts/RealtimeContext';

// Mock do navigator.onLine
Object.defineProperty(window.navigator, 'onLine', {
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

// Mock do RealtimeContext
const mockRealtimeContext = {
  isConnected: true,
  connectionStatus: 'connected' as const,
  syncCount: 150,
  errorCount: 5,
  lastSync: new Date('2024-01-15T10:30:00Z'),
  conflicts: [],
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

// Mock do hook useNetworkStatus
const mockUseNetworkStatus = {
  isOnline: true,
  isOffline: false,
  connectionType: 'wifi' as const,
  effectiveType: '4g' as const,
  downlink: 10,
  rtt: 50,
  saveData: false,
  lastOnlineAt: new Date('2024-01-15T10:30:00Z'),
  lastOfflineAt: null as Date | null,
  offlineDuration: 0,
  reconnectAttempts: 0
};

vi.mock('../../hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => mockUseNetworkStatus
}));

// Mock do hook useOfflineQueue
const mockUseOfflineQueue = {
  queuedActions: [],
  queueSize: 0,
  addToQueue: vi.fn(),
  processQueue: vi.fn(),
  clearQueue: vi.fn(),
  retryFailedActions: vi.fn(),
  getQueuedActionsByType: vi.fn(),
  isProcessing: false,
  lastProcessedAt: null as Date | null
};

vi.mock('../../hooks/useOfflineQueue', () => ({
  useOfflineQueue: () => mockUseOfflineQueue
}));

// Mock de formatação de tempo
vi.mock('../../utils/dateUtils', () => ({
  formatRelativeTime: vi.fn((date: Date) => {
    const now = new Date('2024-01-15T10:35:00Z');
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    return `${minutes} minutos atrás`;
  }),
  formatDuration: vi.fn((ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
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

describe('OfflineIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.navigator.onLine = true;
    mockRealtimeContext.isConnected = true;
    mockRealtimeContext.connectionStatus = 'connected';
    mockUseNetworkStatus.isOnline = true;
    mockUseNetworkStatus.isOffline = false;
    mockUseNetworkStatus.lastOfflineAt = null;
    mockUseNetworkStatus.offlineDuration = 0;
    mockUseOfflineQueue.queuedActions = [];
    mockUseOfflineQueue.queueSize = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Estado Online', () => {
    it('deve renderizar indicador online quando conectado', () => {
      render(<OfflineIndicator />, { wrapper });

      expect(screen.getByTestId('online-indicator')).toBeInTheDocument();
      expect(screen.getByText('Online')).toBeInTheDocument();
      expect(screen.getByTestId('connection-status-icon')).toHaveClass('online');
    });

    it('deve exibir informações de conexão quando online', () => {
      render(<OfflineIndicator showDetails />, { wrapper });

      expect(screen.getByText('WiFi - 4G')).toBeInTheDocument();
      expect(screen.getByText('Latência: 50ms')).toBeInTheDocument();
      expect(screen.getByText('Velocidade: 10 Mbps')).toBeInTheDocument();
    });

    it('deve ocultar indicador quando online e hideWhenOnline=true', () => {
      render(<OfflineIndicator hideWhenOnline />, { wrapper });

      expect(screen.queryByTestId('offline-indicator')).not.toBeInTheDocument();
      expect(screen.queryByTestId('online-indicator')).not.toBeInTheDocument();
    });

    it('deve mostrar último sync quando conectado', () => {
      render(<OfflineIndicator showLastSync />, { wrapper });

      expect(screen.getByText('Último sync: 5 minutos atrás')).toBeInTheDocument();
    });
  });

  describe('Estado Offline', () => {
    beforeEach(() => {
      window.navigator.onLine = false;
      mockRealtimeContext.isConnected = false;
      mockRealtimeContext.connectionStatus = 'disconnected';
      mockUseNetworkStatus.isOnline = false;
      mockUseNetworkStatus.isOffline = true;
      mockUseNetworkStatus.lastOfflineAt = new Date('2024-01-15T10:25:00Z');
      mockUseNetworkStatus.offlineDuration = 300000; // 5 minutos
    });

    it('deve renderizar indicador offline quando desconectado', () => {
      render(<OfflineIndicator />, { wrapper });

      expect(screen.getByTestId('offline-indicator')).toBeInTheDocument();
      expect(screen.getByText('Offline')).toBeInTheDocument();
      expect(screen.getByTestId('connection-status-icon')).toHaveClass('offline');
    });

    it('deve exibir duração offline', () => {
      render(<OfflineIndicator showDetails />, { wrapper });

      expect(screen.getByText('Offline há 5m 0s')).toBeInTheDocument();
    });

    it('deve exibir ações em fila quando offline', () => {
      mockUseOfflineQueue.queuedActions = [
        { id: '1', type: 'update', table: 'products', data: {} },
        { id: '2', type: 'insert', table: 'orders', data: {} },
        { id: '3', type: 'delete', table: 'inventory', data: {} }
      ];
      mockUseOfflineQueue.queueSize = 3;

      render(<OfflineIndicator showQueueInfo />, { wrapper });

      expect(screen.getByText('3 ações em fila')).toBeInTheDocument();
      expect(screen.getByTestId('queue-counter')).toBeInTheDocument();
    });

    it('deve mostrar botão de reconexão quando offline', () => {
      render(<OfflineIndicator showReconnectButton />, { wrapper });

      const reconnectButton = screen.getByText('Tentar Reconectar');
      expect(reconnectButton).toBeInTheDocument();

      fireEvent.click(reconnectButton);
      expect(mockRealtimeContext.connect).toHaveBeenCalled();
    });

    it('deve exibir aviso de funcionalidade limitada', () => {
      render(<OfflineIndicator showWarning />, { wrapper });

      expect(screen.getByText('Funcionalidade limitada offline')).toBeInTheDocument();
      expect(screen.getByTestId('offline-warning')).toBeInTheDocument();
    });
  });

  describe('Estados de Transição', () => {
    it('deve exibir estado de reconectando', () => {
      mockRealtimeContext.connectionStatus = 'reconnecting';
      mockUseNetworkStatus.reconnectAttempts = 2;

      render(<OfflineIndicator />, { wrapper });

      expect(screen.getByText('Reconectando...')).toBeInTheDocument();
      expect(screen.getByText('Tentativa 2')).toBeInTheDocument();
      expect(screen.getByTestId('reconnecting-spinner')).toBeInTheDocument();
    });

    it('deve exibir estado de erro de conexão', () => {
      mockRealtimeContext.connectionStatus = 'error';

      render(<OfflineIndicator />, { wrapper });

      expect(screen.getByText('Erro de Conexão')).toBeInTheDocument();
      expect(screen.getByTestId('connection-error-icon')).toBeInTheDocument();
    });

    it('deve animar transição de offline para online', async () => {
      const { rerender } = render(<OfflineIndicator />, { wrapper });

      // Iniciar offline
      mockRealtimeContext.isConnected = false;
      mockRealtimeContext.connectionStatus = 'disconnected';
      mockUseNetworkStatus.isOnline = false;
      mockUseNetworkStatus.isOffline = true;

      rerender(<OfflineIndicator />);
      expect(screen.getByTestId('offline-indicator')).toBeInTheDocument();

      // Transição para online
      mockRealtimeContext.isConnected = true;
      mockRealtimeContext.connectionStatus = 'connected';
      mockUseNetworkStatus.isOnline = true;
      mockUseNetworkStatus.isOffline = false;

      rerender(<OfflineIndicator />);

      await waitFor(() => {
        expect(screen.getByTestId('online-indicator')).toBeInTheDocument();
        expect(screen.getByTestId('connection-restored-animation')).toBeInTheDocument();
      });
    });
  });

  describe('Fila de Ações Offline', () => {
    beforeEach(() => {
      mockUseOfflineQueue.queuedActions = [
        {
          id: '1',
          type: 'update',
          table: 'products',
          data: { id: 'prod-1', price: 29.99 },
          timestamp: new Date('2024-01-15T10:20:00Z'),
          retryCount: 0
        },
        {
          id: '2',
          type: 'insert',
          table: 'orders',
          data: { customer_id: 'cust-1', total: 59.98 },
          timestamp: new Date('2024-01-15T10:22:00Z'),
          retryCount: 1
        },
        {
          id: '3',
          type: 'delete',
          table: 'inventory',
          data: { id: 'inv-1' },
          timestamp: new Date('2024-01-15T10:25:00Z'),
          retryCount: 0
        }
      ];
      mockUseOfflineQueue.queueSize = 3;
    });

    it('deve exibir detalhes da fila quando expandida', () => {
      render(<OfflineIndicator showQueueDetails />, { wrapper });

      const expandButton = screen.getByLabelText('Expandir fila de ações');
      fireEvent.click(expandButton);

      expect(screen.getByText('Atualizar products')).toBeInTheDocument();
      expect(screen.getByText('Inserir orders')).toBeInTheDocument();
      expect(screen.getByText('Excluir inventory')).toBeInTheDocument();
    });

    it('deve mostrar tentativas de retry para ações falhadas', () => {
      render(<OfflineIndicator showQueueDetails />, { wrapper });

      const expandButton = screen.getByLabelText('Expandir fila de ações');
      fireEvent.click(expandButton);

      expect(screen.getByText('1 tentativa')).toBeInTheDocument(); // Para a ação com retryCount: 1
    });

    it('deve permitir limpar fila de ações', () => {
      render(<OfflineIndicator showQueueDetails allowClearQueue />, { wrapper });

      const expandButton = screen.getByLabelText('Expandir fila de ações');
      fireEvent.click(expandButton);

      const clearButton = screen.getByText('Limpar Fila');
      fireEvent.click(clearButton);

      // Deve mostrar confirmação
      expect(screen.getByText('Confirmar limpeza da fila')).toBeInTheDocument();

      const confirmButton = screen.getByText('Confirmar');
      fireEvent.click(confirmButton);

      expect(mockUseOfflineQueue.clearQueue).toHaveBeenCalled();
    });

    it('deve permitir tentar processar fila manualmente', () => {
      render(<OfflineIndicator showQueueDetails />, { wrapper });

      const expandButton = screen.getByLabelText('Expandir fila de ações');
      fireEvent.click(expandButton);

      const processButton = screen.getByText('Processar Agora');
      fireEvent.click(processButton);

      expect(mockUseOfflineQueue.processQueue).toHaveBeenCalled();
    });

    it('deve exibir progresso de processamento da fila', () => {
      mockUseOfflineQueue.isProcessing = true;

      render(<OfflineIndicator showQueueDetails />, { wrapper });

      expect(screen.getByText('Processando fila...')).toBeInTheDocument();
      expect(screen.getByTestId('queue-processing-spinner')).toBeInTheDocument();
    });
  });

  describe('Configurações de Exibição', () => {
    it('deve renderizar em modo compacto', () => {
      render(<OfflineIndicator compact />, { wrapper });

      expect(screen.getByTestId('offline-indicator-compact')).toBeInTheDocument();
      expect(screen.queryByText('Online')).not.toBeInTheDocument();
    });

    it('deve exibir apenas ícone em modo minimal', () => {
      render(<OfflineIndicator minimal />, { wrapper });

      expect(screen.getByTestId('connection-status-icon')).toBeInTheDocument();
      expect(screen.queryByText('Online')).not.toBeInTheDocument();
    });

    it('deve permitir posicionamento customizado', () => {
      render(<OfflineIndicator position="top-left" />, { wrapper });

      const indicator = screen.getByTestId('offline-indicator-container');
      expect(indicator).toHaveClass('position-top-left');
    });

    it('deve suportar tema customizado', () => {
      render(<OfflineIndicator theme="dark" />, { wrapper });

      const indicator = screen.getByTestId('offline-indicator-container');
      expect(indicator).toHaveClass('theme-dark');
    });
  });

  describe('Notificações', () => {
    it('deve notificar quando fica offline', () => {
      const { rerender } = render(<OfflineIndicator notifyStatusChange />, { wrapper });

      // Simular mudança para offline
      mockRealtimeContext.isConnected = false;
      mockRealtimeContext.connectionStatus = 'disconnected';
      mockUseNetworkStatus.isOnline = false;
      mockUseNetworkStatus.isOffline = true;

      rerender(<OfflineIndicator notifyStatusChange />);

      expect(mockShowNotification).toHaveBeenCalledWith({
        type: 'warning',
        message: 'Conexão perdida. Trabalhando offline.',
        duration: 4000
      });
    });

    it('deve notificar quando volta online', () => {
      // Iniciar offline
      mockRealtimeContext.isConnected = false;
      mockUseNetworkStatus.isOnline = false;
      mockUseNetworkStatus.isOffline = true;

      const { rerender } = render(<OfflineIndicator notifyStatusChange />, { wrapper });

      // Simular mudança para online
      mockRealtimeContext.isConnected = true;
      mockRealtimeContext.connectionStatus = 'connected';
      mockUseNetworkStatus.isOnline = true;
      mockUseNetworkStatus.isOffline = false;

      rerender(<OfflineIndicator notifyStatusChange />);

      expect(mockShowNotification).toHaveBeenCalledWith({
        type: 'success',
        message: 'Conexão restaurada. Sincronizando dados...',
        duration: 3000
      });
    });

    it('deve notificar sobre processamento da fila', async () => {
      mockUseOfflineQueue.queueSize = 5;
      mockUseOfflineQueue.isProcessing = true;

      render(<OfflineIndicator notifyQueueProcessing />, { wrapper });

      // Simular conclusão do processamento
      mockUseOfflineQueue.isProcessing = false;
      mockUseOfflineQueue.queueSize = 0;
      mockUseOfflineQueue.lastProcessedAt = new Date();

      await waitFor(() => {
        expect(mockShowNotification).toHaveBeenCalledWith({
          type: 'info',
          message: '5 ações processadas com sucesso',
          duration: 3000
        });
      });
    });
  });

  describe('Eventos de Rede', () => {
    it('deve registrar listeners de eventos de rede', () => {
      render(<OfflineIndicator />, { wrapper });

      expect(mockAddEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(mockAddEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
    });

    it('deve remover listeners ao desmontar', () => {
      const { unmount } = render(<OfflineIndicator />, { wrapper });

      unmount();

      expect(mockRemoveEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(mockRemoveEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
    });

    it('deve reagir a eventos de mudança de rede', () => {
      render(<OfflineIndicator />, { wrapper });

      // Simular evento offline
      const offlineEvent = new Event('offline');
      window.dispatchEvent(offlineEvent);

      // Verificar se o estado foi atualizado
      expect(screen.getByTestId('offline-indicator')).toBeInTheDocument();
    });
  });

  describe('Acessibilidade', () => {
    it('deve ter labels apropriados para screen readers', () => {
      render(<OfflineIndicator />, { wrapper });

      expect(screen.getByLabelText('Status da conexão: Online')).toBeInTheDocument();
    });

    it('deve anunciar mudanças de status', () => {
      const { rerender } = render(<OfflineIndicator />, { wrapper });

      mockRealtimeContext.isConnected = false;
      mockUseNetworkStatus.isOnline = false;
      mockUseNetworkStatus.isOffline = true;

      rerender(<OfflineIndicator />);

      expect(screen.getByRole('status')).toHaveTextContent('Offline');
    });

    it('deve suportar navegação por teclado', () => {
      render(<OfflineIndicator showReconnectButton />, { wrapper });

      mockRealtimeContext.isConnected = false;
      mockUseNetworkStatus.isOnline = false;

      const reconnectButton = screen.getByText('Tentar Reconectar');
      reconnectButton.focus();
      expect(reconnectButton).toHaveFocus();

      fireEvent.keyDown(reconnectButton, { key: 'Enter' });
      expect(mockRealtimeContext.connect).toHaveBeenCalled();
    });

    it('deve ter contraste adequado para diferentes estados', () => {
      const { rerender } = render(<OfflineIndicator />, { wrapper });

      // Estado online
      let statusIcon = screen.getByTestId('connection-status-icon');
      expect(statusIcon).toHaveClass('online');

      // Estado offline
      mockRealtimeContext.isConnected = false;
      mockUseNetworkStatus.isOnline = false;
      mockUseNetworkStatus.isOffline = true;

      rerender(<OfflineIndicator />);

      statusIcon = screen.getByTestId('connection-status-icon');
      expect(statusIcon).toHaveClass('offline');
    });
  });

  describe('Performance', () => {
    it('deve evitar re-renders desnecessários', () => {
      const renderSpy = vi.fn();
      const TestComponent = () => {
        renderSpy();
        return <OfflineIndicator />;
      };

      const { rerender } = render(<TestComponent />, { wrapper });

      // Múltiplas atualizações com mesmo estado
      rerender(<TestComponent />);
      rerender(<TestComponent />);
      rerender(<TestComponent />);

      expect(renderSpy).toHaveBeenCalledTimes(1); // Apenas render inicial
    });

    it('deve debounce atualizações de status de rede', async () => {
      render(<OfflineIndicator />, { wrapper });

      // Múltiplas mudanças rápidas de status
      mockUseNetworkStatus.isOnline = false;
      mockUseNetworkStatus.isOnline = true;
      mockUseNetworkStatus.isOnline = false;
      mockUseNetworkStatus.isOnline = true;

      // Deve aguardar debounce antes de atualizar UI
      await waitFor(() => {
        expect(screen.getByTestId('online-indicator')).toBeInTheDocument();
      }, { timeout: 500 });
    });

    it('deve limitar frequência de atualizações de métricas', () => {
      const { rerender } = render(<OfflineIndicator showDetails />, { wrapper });

      // Múltiplas atualizações de métricas
      for (let i = 0; i < 10; i++) {
        mockUseNetworkStatus.rtt = 50 + i;
        mockUseNetworkStatus.downlink = 10 + i;
        rerender(<OfflineIndicator showDetails />);
      }

      // Deve mostrar apenas a última atualização
      expect(screen.getByText('Latência: 59ms')).toBeInTheDocument();
      expect(screen.getByText('Velocidade: 19 Mbps')).toBeInTheDocument();
    });
  });
});