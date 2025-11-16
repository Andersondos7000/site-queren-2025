import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SyncStatus } from '../../components/realtime/SyncStatus';
import { RealtimeProvider } from '../../contexts/RealtimeContext';
import type { ConnectionStatus } from '../../types/realtime';

// Mock do RealtimeContext
const mockRealtimeContext = {
  isConnected: true,
  connectionStatus: 'connected' as ConnectionStatus,
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

// Mock do hook useConnectionStatus
const mockUseConnectionStatus = {
  status: 'connected' as ConnectionStatus,
  isOnline: true,
  lastConnected: new Date('2024-01-15T10:30:00Z'),
  reconnectAttempts: 0,
  connect: vi.fn(),
  disconnect: vi.fn()
};

vi.mock('../../hooks/realtime/useConnectionStatus', () => ({
  useConnectionStatus: () => mockUseConnectionStatus
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
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  })
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  React.createElement(RealtimeProvider, {}, children)
);

describe('SyncStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRealtimeContext.isConnected = true;
    mockRealtimeContext.connectionStatus = 'connected';
    mockRealtimeContext.syncCount = 150;
    mockRealtimeContext.errorCount = 5;
    mockUseConnectionStatus.status = 'connected';
    mockUseConnectionStatus.isOnline = true;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Renderização Básica', () => {
    it('deve renderizar o componente corretamente', () => {
      render(<SyncStatus />, { wrapper });

      expect(screen.getByText('Status de Sincronização')).toBeInTheDocument();
      expect(screen.getByText('Conectado')).toBeInTheDocument();
    });

    it('deve exibir métricas de sincronização', () => {
      render(<SyncStatus />, { wrapper });

      expect(screen.getByText('150')).toBeInTheDocument(); // syncCount
      expect(screen.getByText('5')).toBeInTheDocument(); // errorCount
      expect(screen.getByText('120ms')).toBeInTheDocument(); // latency
      expect(screen.getByText('85/min')).toBeInTheDocument(); // throughput
    });

    it('deve exibir último sync formatado', () => {
      render(<SyncStatus />, { wrapper });

      expect(screen.getByText('5 minutos atrás')).toBeInTheDocument();
    });
  });

  describe('Estados de Conexão', () => {
    it('deve exibir status conectado', () => {
      render(<SyncStatus />, { wrapper });

      expect(screen.getByText('Conectado')).toBeInTheDocument();
      expect(screen.getByTestId('connection-indicator')).toHaveClass('connected');
      expect(screen.getByTestId('status-icon')).toHaveClass('success');
    });

    it('deve exibir status desconectado', () => {
      mockRealtimeContext.isConnected = false;
      mockRealtimeContext.connectionStatus = 'disconnected';
      mockUseConnectionStatus.status = 'disconnected';
      mockUseConnectionStatus.isOnline = false;

      render(<SyncStatus />, { wrapper });

      expect(screen.getByText('Desconectado')).toBeInTheDocument();
      expect(screen.getByTestId('connection-indicator')).toHaveClass('disconnected');
      expect(screen.getByTestId('status-icon')).toHaveClass('error');
    });

    it('deve exibir status reconectando', () => {
      mockRealtimeContext.isConnected = false;
      mockRealtimeContext.connectionStatus = 'reconnecting';
      mockUseConnectionStatus.status = 'reconnecting';
      mockUseConnectionStatus.reconnectAttempts = 3;

      render(<SyncStatus />, { wrapper });

      expect(screen.getByText('Reconectando...')).toBeInTheDocument();
      expect(screen.getByText('Tentativa 3')).toBeInTheDocument();
      expect(screen.getByTestId('connection-indicator')).toHaveClass('reconnecting');
      expect(screen.getByTestId('status-icon')).toHaveClass('warning');
    });

    it('deve exibir status de erro', () => {
      mockRealtimeContext.connectionStatus = 'error';
      mockUseConnectionStatus.status = 'error';

      render(<SyncStatus />, { wrapper });

      expect(screen.getByText('Erro de Conexão')).toBeInTheDocument();
      expect(screen.getByTestId('connection-indicator')).toHaveClass('error');
      expect(screen.getByTestId('status-icon')).toHaveClass('error');
    });
  });

  describe('Indicadores Visuais', () => {
    it('deve exibir indicador pulsante quando conectado', () => {
      render(<SyncStatus />, { wrapper });

      const indicator = screen.getByTestId('connection-indicator');
      expect(indicator).toHaveClass('pulse');
    });

    it('deve exibir spinner quando reconectando', () => {
      mockRealtimeContext.connectionStatus = 'reconnecting';
      mockUseConnectionStatus.status = 'reconnecting';

      render(<SyncStatus />, { wrapper });

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    });

    it('deve exibir ícone de aviso para alta taxa de erro', () => {
      mockRealtimeContext.errorCount = 50; // Alta taxa de erro
      mockRealtimeContext.syncCount = 100;

      render(<SyncStatus />, { wrapper });

      expect(screen.getByTestId('error-warning')).toBeInTheDocument();
      expect(screen.getByText('Taxa de erro elevada')).toBeInTheDocument();
    });

    it('deve exibir ícone de latência alta', () => {
      mockRealtimeContext.metrics.latency = 2000; // Latência alta

      render(<SyncStatus />, { wrapper });

      expect(screen.getByTestId('latency-warning')).toBeInTheDocument();
      expect(screen.getByText('Latência elevada')).toBeInTheDocument();
    });
  });

  describe('Métricas Detalhadas', () => {
    it('deve exibir taxa de erro calculada', () => {
      render(<SyncStatus />, { wrapper });

      // errorRate = errorCount / syncCount = 5 / 150 = 0.033 = 3.3%
      expect(screen.getByText('3.3%')).toBeInTheDocument();
    });

    it('deve exibir número de reconexões', () => {
      render(<SyncStatus />, { wrapper });

      expect(screen.getByText('2 reconexões')).toBeInTheDocument();
    });

    it('deve exibir throughput formatado', () => {
      render(<SyncStatus />, { wrapper });

      expect(screen.getByText('85/min')).toBeInTheDocument();
    });

    it('deve calcular uptime baseado na última conexão', () => {
      render(<SyncStatus />, { wrapper });

      expect(screen.getByText('Uptime: 5 minutos')).toBeInTheDocument();
    });
  });

  describe('Interações do Usuário', () => {
    it('deve permitir reconectar manualmente', async () => {
      mockRealtimeContext.isConnected = false;
      mockRealtimeContext.connectionStatus = 'disconnected';

      render(<SyncStatus />, { wrapper });

      const reconnectButton = screen.getByText('Reconectar');
      fireEvent.click(reconnectButton);

      expect(mockUseConnectionStatus.connect).toHaveBeenCalled();
    });

    it('deve permitir desconectar manualmente', async () => {
      render(<SyncStatus />, { wrapper });

      const disconnectButton = screen.getByText('Desconectar');
      fireEvent.click(disconnectButton);

      expect(mockUseConnectionStatus.disconnect).toHaveBeenCalled();
    });

    it('deve expandir/colapsar detalhes', () => {
      render(<SyncStatus />, { wrapper });

      const expandButton = screen.getByLabelText('Expandir detalhes');
      fireEvent.click(expandButton);

      expect(screen.getByTestId('detailed-metrics')).toBeVisible();

      fireEvent.click(expandButton);
      expect(screen.getByTestId('detailed-metrics')).not.toBeVisible();
    });

    it('deve mostrar tooltip com informações adicionais', async () => {
      render(<SyncStatus />, { wrapper });

      const statusIcon = screen.getByTestId('status-icon');
      fireEvent.mouseEnter(statusIcon);

      await waitFor(() => {
        expect(screen.getByText('Conexão estável')).toBeInTheDocument();
      });
    });
  });

  describe('Modo Compacto', () => {
    it('deve renderizar em modo compacto', () => {
      render(<SyncStatus compact />, { wrapper });

      expect(screen.getByTestId('sync-status-compact')).toBeInTheDocument();
      expect(screen.queryByText('Status de Sincronização')).not.toBeInTheDocument();
    });

    it('deve exibir apenas métricas essenciais em modo compacto', () => {
      render(<SyncStatus compact />, { wrapper });

      expect(screen.getByText('150')).toBeInTheDocument(); // syncCount
      expect(screen.getByText('120ms')).toBeInTheDocument(); // latency
      expect(screen.queryByText('85/min')).not.toBeInTheDocument(); // throughput oculto
    });
  });

  describe('Atualização em Tempo Real', () => {
    it('deve atualizar métricas quando contexto muda', () => {
      const { rerender } = render(<SyncStatus />, { wrapper });

      expect(screen.getByText('150')).toBeInTheDocument();

      // Simular mudança no contexto
      mockRealtimeContext.syncCount = 175;
      rerender(<SyncStatus />);

      expect(screen.getByText('175')).toBeInTheDocument();
    });

    it('deve atualizar status de conexão em tempo real', () => {
      const { rerender } = render(<SyncStatus />, { wrapper });

      expect(screen.getByText('Conectado')).toBeInTheDocument();

      // Simular desconexão
      mockRealtimeContext.isConnected = false;
      mockRealtimeContext.connectionStatus = 'disconnected';
      rerender(<SyncStatus />);

      expect(screen.getByText('Desconectado')).toBeInTheDocument();
    });
  });

  describe('Tratamento de Erros', () => {
    it('deve exibir mensagem de erro quando contexto não está disponível', () => {
      // Mock do contexto retornando null
      vi.mocked(require('../../contexts/RealtimeContext').useRealtime).mockReturnValue(null);

      render(<SyncStatus />);

      expect(screen.getByText('Erro: Contexto de realtime não disponível')).toBeInTheDocument();
    });

    it('deve lidar com métricas inválidas graciosamente', () => {
      mockRealtimeContext.metrics = null as any;

      render(<SyncStatus />, { wrapper });

      expect(screen.getByText('--')).toBeInTheDocument(); // Placeholder para métricas indisponíveis
    });
  });

  describe('Responsividade', () => {
    it('deve adaptar layout para telas pequenas', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 480
      });

      render(<SyncStatus />, { wrapper });

      const container = screen.getByTestId('sync-status');
      expect(container).toHaveClass('mobile-layout');
    });

    it('deve empilhar métricas verticalmente em telas pequenas', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 480
      });

      render(<SyncStatus />, { wrapper });

      const metricsContainer = screen.getByTestId('metrics-container');
      expect(metricsContainer).toHaveClass('vertical-stack');
    });
  });

  describe('Acessibilidade', () => {
    it('deve ter labels apropriados para screen readers', () => {
      render(<SyncStatus />, { wrapper });

      expect(screen.getByLabelText('Status de sincronização em tempo real')).toBeInTheDocument();
      expect(screen.getByLabelText('Métricas de conexão')).toBeInTheDocument();
    });

    it('deve anunciar mudanças de status para screen readers', () => {
      const { rerender } = render(<SyncStatus />, { wrapper });

      // Simular mudança de status
      mockRealtimeContext.connectionStatus = 'disconnected';
      rerender(<SyncStatus />);

      expect(screen.getByRole('status')).toHaveTextContent('Status alterado para: Desconectado');
    });

    it('deve suportar navegação por teclado', () => {
      render(<SyncStatus />, { wrapper });

      const reconnectButton = screen.getByText('Reconectar');
      reconnectButton.focus();
      expect(reconnectButton).toHaveFocus();

      fireEvent.keyDown(reconnectButton, { key: 'Enter' });
      expect(mockUseConnectionStatus.connect).toHaveBeenCalled();
    });

    it('deve ter contraste adequado para indicadores de status', () => {
      render(<SyncStatus />, { wrapper });

      const indicator = screen.getByTestId('connection-indicator');
      const styles = getComputedStyle(indicator);
      
      // Verificar se tem cor de fundo definida
      expect(styles.backgroundColor).toBeTruthy();
    });
  });

  describe('Performance', () => {
    it('deve evitar re-renders desnecessários', () => {
      const renderSpy = vi.fn();
      const TestComponent = () => {
        renderSpy();
        return <SyncStatus />;
      };

      const { rerender } = render(<TestComponent />, { wrapper });
      
      expect(renderSpy).toHaveBeenCalledTimes(1);

      // Re-render com as mesmas props não deve causar novo render
      rerender(<TestComponent />);
      expect(renderSpy).toHaveBeenCalledTimes(1);
    });

    it('deve debounce atualizações de métricas', async () => {
      render(<SyncStatus />, { wrapper });

      // Simular múltiplas atualizações rápidas
      mockRealtimeContext.syncCount = 151;
      mockRealtimeContext.syncCount = 152;
      mockRealtimeContext.syncCount = 153;

      // Deve aguardar debounce antes de atualizar
      await waitFor(() => {
        expect(screen.getByText('153')).toBeInTheDocument();
      }, { timeout: 1000 });
    });
  });
});