import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import MonitoringIntegration from '../../components/monitoring/MonitoringIntegration';
import { RealtimeProvider } from '../../contexts/RealtimeContext';
import type { MonitoringAlert, IntegratedMetrics } from '../../hooks/monitoring/useIntegratedMonitoring';

// Mock do hook useIntegratedMonitoring
const mockUseIntegratedMonitoring = {
  isMonitoring: false,
  healthScore: 85,
  alerts: [] as MonitoringAlert[],
  metrics: {
    realtime: {
      syncCount: 150,
      errorCount: 5,
      latency: 120,
      throughput: 85
    },
    browser: {
      consoleLogs: [],
      consoleErrors: [],
      networkLogs: [],
      networkErrors: [],
      performance: {
        loadTime: 1200,
        firstContentfulPaint: 800,
        largestContentfulPaint: 1500,
        cumulativeLayoutShift: 0.1,
        firstInputDelay: 50
      },
      accessibility: {
        violations: [],
        passes: 12,
        incomplete: 1
      }
    },
    system: {
      memoryUsage: 65,
      cpuUsage: 45,
      networkLatency: 80,
      isOnline: true
    }
  } as IntegratedMetrics,
  config: {
    alertThresholds: {
      errorRate: 0.05,
      latency: 1000,
      memoryUsage: 80
    },
    monitoringInterval: 5000,
    enableBrowserTools: true,
    enablePerformanceMonitoring: true
  },
  startMonitoring: jest.fn(),
  stopMonitoring: jest.fn(),
  updateConfig: jest.fn(),
  addAlert: jest.fn(),
  resolveAlert: jest.fn(),
  clearAlerts: jest.fn(),
  updateMetrics: jest.fn(),
  takeSnapshot: jest.fn(),
  exportMetrics: jest.fn(),
  resetMetrics: jest.fn()
};

jest.mock('../../hooks/monitoring/useIntegratedMonitoring', () => ({
  useIntegratedMonitoring: () => mockUseIntegratedMonitoring
}));

// Mock do hook useBrowserToolsMonitoring
const mockUseBrowserToolsMonitoring = {
  metrics: {
    consoleLogs: [],
    consoleErrors: [],
    networkLogs: [],
    networkErrors: [],
    performance: {
      loadTime: 1200,
      firstContentfulPaint: 800,
      largestContentfulPaint: 1500,
      cumulativeLayoutShift: 0.1,
      firstInputDelay: 50
    },
    accessibility: {
      violations: [],
      passes: 12,
      incomplete: 1
    }
  },
  isMonitoring: false,
  startMonitoring: vi.fn(),
  stopMonitoring: vi.fn(),
  clearLogs: vi.fn(),
  takeScreenshot: vi.fn(),
  collectConsoleLogs: vi.fn(),
  collectConsoleErrors: vi.fn(),
  collectNetworkLogs: vi.fn(),
  collectNetworkErrors: vi.fn(),
  collectPerformanceMetrics: vi.fn(),
  runAccessibilityAudit: vi.fn()
};

vi.mock('../../hooks/monitoring/useBrowserToolsMonitoring', () => ({
  useBrowserToolsMonitoring: () => mockUseBrowserToolsMonitoring
}));

// Mock do RealtimeContext
const mockRealtimeContext = {
  isConnected: true,
  connectionStatus: 'connected' as const,
  syncCount: 150,
  errorCount: 5,
  lastSync: new Date(),
  conflicts: [],
  metrics: {
    latency: 120,
    throughput: 85,
    errorRate: 0.033,
    reconnectCount: 2
  }
};

vi.mock('../../contexts/RealtimeContext', () => ({
  RealtimeProvider: ({ children }: { children: React.ReactNode }) => children,
  useRealtime: () => mockRealtimeContext
}));

// Mock do download de arquivos
const mockCreateObjectURL = vi.fn();
const mockRevokeObjectURL = vi.fn();
Object.defineProperty(URL, 'createObjectURL', { value: mockCreateObjectURL });
Object.defineProperty(URL, 'revokeObjectURL', { value: mockRevokeObjectURL });

// Mock do elemento <a> para download
const mockClick = vi.fn();
const mockAppendChild = vi.fn();
const mockRemoveChild = vi.fn();

Object.defineProperty(document, 'createElement', {
  value: vi.fn().mockImplementation((tagName: string) => {
    if (tagName === 'a') {
      return {
        click: mockClick,
        href: '',
        download: '',
        style: { display: '' }
      };
    }
    return {};
  })
});

Object.defineProperty(document.body, 'appendChild', { value: mockAppendChild });
Object.defineProperty(document.body, 'removeChild', { value: mockRemoveChild });

const wrapper = ({ children }: { children: React.ReactNode }) => (
  React.createElement(RealtimeProvider, {}, children)
);

describe('MonitoringIntegration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseIntegratedMonitoring.isMonitoring = false;
    mockUseIntegratedMonitoring.alerts = [];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Renderização Básica', () => {
    it('deve renderizar o componente corretamente', () => {
      render(<MonitoringIntegration />, { wrapper });

      expect(screen.getByText('Monitoramento Integrado')).toBeInTheDocument();
      expect(screen.getByText('Health Score')).toBeInTheDocument();
      expect(screen.getByText('85%')).toBeInTheDocument();
    });

    it('deve exibir todas as abas de navegação', () => {
      render(<MonitoringIntegration />, { wrapper });

      expect(screen.getByText('Visão Geral')).toBeInTheDocument();
      expect(screen.getByText('Tempo Real')).toBeInTheDocument();
      expect(screen.getByText('Performance')).toBeInTheDocument();
      expect(screen.getByText('Browser Tools')).toBeInTheDocument();
      expect(screen.getByText('Alertas')).toBeInTheDocument();
      expect(screen.getByText('Completo')).toBeInTheDocument();
    });

    it('deve exibir status de conexão', () => {
      render(<MonitoringIntegration />, { wrapper });

      expect(screen.getByText('Conectado')).toBeInTheDocument();
    });

    it('deve exibir botões de controle', () => {
      render(<MonitoringIntegration />, { wrapper });

      expect(screen.getByText('Iniciar Monitoramento')).toBeInTheDocument();
      expect(screen.getByText('Snapshot')).toBeInTheDocument();
      expect(screen.getByText('Exportar')).toBeInTheDocument();
    });
  });

  describe('Controle de Monitoramento', () => {
    it('deve iniciar monitoramento quando clicado', async () => {
      render(<MonitoringIntegration />, { wrapper });

      const startButton = screen.getByText('Iniciar Monitoramento');
      fireEvent.click(startButton);

      expect(mockUseIntegratedMonitoring.startMonitoring).toHaveBeenCalled();
    });

    it('deve parar monitoramento quando já está ativo', async () => {
      mockUseIntegratedMonitoring.isMonitoring = true;
      render(<MonitoringIntegration />, { wrapper });

      const stopButton = screen.getByText('Parar Monitoramento');
      fireEvent.click(stopButton);

      expect(mockUseIntegratedMonitoring.stopMonitoring).toHaveBeenCalled();
    });

    it('deve alterar texto do botão baseado no status', () => {
      const { rerender } = render(<MonitoringIntegration />, { wrapper });
      expect(screen.getByText('Iniciar Monitoramento')).toBeInTheDocument();

      mockUseIntegratedMonitoring.isMonitoring = true;
      rerender(<MonitoringIntegration />);
      expect(screen.getByText('Parar Monitoramento')).toBeInTheDocument();
    });
  });

  describe('Navegação entre Abas', () => {
    it('deve alternar para aba Tempo Real', () => {
      render(<MonitoringIntegration />, { wrapper });

      const realtimeTab = screen.getByText('Tempo Real');
      fireEvent.click(realtimeTab);

      expect(screen.getByText('Monitoramento Realtime')).toBeInTheDocument();
      expect(screen.getByText('Sincronizações: 150')).toBeInTheDocument();
      expect(screen.getByText('Erros: 5')).toBeInTheDocument();
    });

    it('deve alternar para aba Performance', () => {
      render(<MonitoringIntegration />, { wrapper });

      const performanceTab = screen.getByText('Performance');
      fireEvent.click(performanceTab);

      expect(screen.getByText('Métricas de Performance')).toBeInTheDocument();
      expect(screen.getByText('Load Time: 1200ms')).toBeInTheDocument();
      expect(screen.getByText('FCP: 800ms')).toBeInTheDocument();
    });

    it('deve alternar para aba Browser Tools', () => {
      render(<MonitoringIntegration />, { wrapper });

      const browserTab = screen.getByText('Browser Tools');
      fireEvent.click(browserTab);

      expect(screen.getByText('Ferramentas do Navegador')).toBeInTheDocument();
    });

    it('deve alternar para aba Alertas', () => {
      mockUseIntegratedMonitoring.alerts = [
        {
          id: 'test-alert',
          type: 'warning',
          source: 'browser',
          message: 'Teste de alerta',
          timestamp: new Date(),
          resolved: false
        }
      ];

      render(<MonitoringIntegration />, { wrapper });

      const alertsTab = screen.getByText('Alertas');
      fireEvent.click(alertsTab);

      expect(screen.getByText('Teste de alerta')).toBeInTheDocument();
    });

    it('deve alternar para aba Completo', () => {
      render(<MonitoringIntegration />, { wrapper });

      const completeTab = screen.getByText('Completo');
      fireEvent.click(completeTab);

      expect(screen.getByText('Visão Completa do Sistema')).toBeInTheDocument();
    });
  });

  describe('Exibição de Métricas', () => {
    it('deve exibir métricas realtime na visão geral', () => {
      render(<MonitoringIntegration />, { wrapper });

      expect(screen.getByText('Realtime')).toBeInTheDocument();
      expect(screen.getByText('Sync: 150')).toBeInTheDocument();
      expect(screen.getByText('Erros: 5')).toBeInTheDocument();
      expect(screen.getByText('Latência: 120ms')).toBeInTheDocument();
    });

    it('deve exibir métricas do sistema na visão geral', () => {
      render(<MonitoringIntegration />, { wrapper });

      expect(screen.getByText('Sistema')).toBeInTheDocument();
      expect(screen.getByText('CPU: 45%')).toBeInTheDocument();
      expect(screen.getByText('Memória: 65%')).toBeInTheDocument();
      expect(screen.getByText('Rede: 80ms')).toBeInTheDocument();
    });

    it('deve exibir métricas de performance na visão geral', () => {
      render(<MonitoringIntegration />, { wrapper });

      expect(screen.getByText('Performance')).toBeInTheDocument();
      expect(screen.getByText('Load: 1200ms')).toBeInTheDocument();
      expect(screen.getByText('FCP: 800ms')).toBeInTheDocument();
      expect(screen.getByText('LCP: 1500ms')).toBeInTheDocument();
    });
  });

  describe('Health Score', () => {
    it('deve exibir health score com cor apropriada', () => {
      render(<MonitoringIntegration />, { wrapper });

      const healthScore = screen.getByText('85%');
      expect(healthScore).toBeInTheDocument();
      expect(healthScore.closest('.health-score')).toHaveClass('good'); // 85% é considerado bom
    });

    it('deve exibir health score baixo com cor de aviso', () => {
      mockUseIntegratedMonitoring.healthScore = 45;
      render(<MonitoringIntegration />, { wrapper });

      const healthScore = screen.getByText('45%');
      expect(healthScore.closest('.health-score')).toHaveClass('warning');
    });

    it('deve exibir health score crítico com cor de erro', () => {
      mockUseIntegratedMonitoring.healthScore = 25;
      render(<MonitoringIntegration />, { wrapper });

      const healthScore = screen.getByText('25%');
      expect(healthScore.closest('.health-score')).toHaveClass('critical');
    });
  });

  describe('Status de Conexão', () => {
    it('deve exibir status conectado', () => {
      render(<MonitoringIntegration />, { wrapper });

      expect(screen.getByText('Conectado')).toBeInTheDocument();
      expect(screen.getByTestId('connection-indicator')).toHaveClass('connected');
    });

    it('deve exibir status desconectado', () => {
      mockRealtimeContext.isConnected = false;
      mockRealtimeContext.connectionStatus = 'disconnected';
      
      render(<MonitoringIntegration />, { wrapper });

      expect(screen.getByText('Desconectado')).toBeInTheDocument();
      expect(screen.getByTestId('connection-indicator')).toHaveClass('disconnected');
    });

    it('deve exibir status reconectando', () => {
      mockRealtimeContext.isConnected = false;
      mockRealtimeContext.connectionStatus = 'reconnecting';
      
      render(<MonitoringIntegration />, { wrapper });

      expect(screen.getByText('Reconectando...')).toBeInTheDocument();
      expect(screen.getByTestId('connection-indicator')).toHaveClass('reconnecting');
    });
  });

  describe('Funcionalidades de Snapshot e Exportação', () => {
    it('deve tirar snapshot quando clicado', () => {
      render(<MonitoringIntegration />, { wrapper });

      const snapshotButton = screen.getByText('Snapshot');
      fireEvent.click(snapshotButton);

      expect(mockUseIntegratedMonitoring.takeSnapshot).toHaveBeenCalled();
    });

    it('deve exportar métricas quando clicado', async () => {
      mockUseIntegratedMonitoring.exportMetrics.mockReturnValue(
        JSON.stringify({ test: 'data' })
      );
      mockCreateObjectURL.mockReturnValue('blob:test-url');

      render(<MonitoringIntegration />, { wrapper });

      const exportButton = screen.getByText('Exportar');
      fireEvent.click(exportButton);

      expect(mockUseIntegratedMonitoring.exportMetrics).toHaveBeenCalled();
      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(mockClick).toHaveBeenCalled();
    });
  });

  describe('Indicadores de Status dos Subsistemas', () => {
    it('deve exibir status dos subsistemas', () => {
      render(<MonitoringIntegration />, { wrapper });

      expect(screen.getByText('Realtime')).toBeInTheDocument();
      expect(screen.getByText('Browser Tools')).toBeInTheDocument();
      expect(screen.getByText('Performance')).toBeInTheDocument();
    });

    it('deve indicar subsistema com problemas', () => {
      mockUseIntegratedMonitoring.metrics.realtime.errorCount = 25; // Alta taxa de erro
      
      render(<MonitoringIntegration />, { wrapper });

      const realtimeStatus = screen.getByTestId('realtime-status');
      expect(realtimeStatus).toHaveClass('warning');
    });

    it('deve indicar subsistema saudável', () => {
      mockUseIntegratedMonitoring.metrics.realtime.errorCount = 2; // Baixa taxa de erro
      
      render(<MonitoringIntegration />, { wrapper });

      const realtimeStatus = screen.getByTestId('realtime-status');
      expect(realtimeStatus).toHaveClass('healthy');
    });
  });

  describe('Responsividade', () => {
    it('deve adaptar layout para telas pequenas', () => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768
      });

      render(<MonitoringIntegration />, { wrapper });

      const container = screen.getByTestId('monitoring-integration');
      expect(container).toHaveClass('responsive');
    });
  });

  describe('Integração com Alertas', () => {
    it('deve exibir contador de alertas não resolvidos', () => {
      mockUseIntegratedMonitoring.alerts = [
        {
          id: 'alert-1',
          type: 'error',
          source: 'realtime',
          message: 'Erro 1',
          timestamp: new Date(),
          resolved: false
        },
        {
          id: 'alert-2',
          type: 'warning',
          source: 'browser',
          message: 'Aviso 1',
          timestamp: new Date(),
          resolved: false
        },
        {
          id: 'alert-3',
          type: 'info',
          source: 'system',
          message: 'Info 1',
          timestamp: new Date(),
          resolved: true
        }
      ];

      render(<MonitoringIntegration />, { wrapper });

      expect(screen.getByText('2')).toBeInTheDocument(); // 2 alertas não resolvidos
    });

    it('deve resolver alerta através do painel', async () => {
      mockUseIntegratedMonitoring.alerts = [
        {
          id: 'alert-1',
          type: 'error',
          source: 'realtime',
          message: 'Erro para resolver',
          timestamp: new Date(),
          resolved: false
        }
      ];

      render(<MonitoringIntegration />, { wrapper });

      // Ir para aba de alertas
      const alertsTab = screen.getByText('Alertas');
      fireEvent.click(alertsTab);

      // Resolver alerta
      const resolveButton = screen.getByRole('button', { name: /resolver/i });
      fireEvent.click(resolveButton);

      expect(mockUseIntegratedMonitoring.resolveAlert).toHaveBeenCalledWith('alert-1');
    });
  });

  describe('Acessibilidade', () => {
    it('deve ter labels apropriados para screen readers', () => {
      render(<MonitoringIntegration />, { wrapper });

      expect(screen.getByLabelText('Painel de monitoramento integrado')).toBeInTheDocument();
      expect(screen.getByLabelText('Navegação entre abas de monitoramento')).toBeInTheDocument();
    });

    it('deve suportar navegação por teclado', () => {
      render(<MonitoringIntegration />, { wrapper });

      const firstTab = screen.getByText('Visão Geral');
      const secondTab = screen.getByText('Tempo Real');

      firstTab.focus();
      expect(firstTab).toHaveFocus();

      fireEvent.keyDown(firstTab, { key: 'ArrowRight' });
      expect(secondTab).toHaveFocus();
    });
  });
});