import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useIntegratedMonitoring } from '../../hooks/monitoring/useIntegratedMonitoring';
import { RealtimeProvider } from '../../contexts/RealtimeContext';
import React from 'react';

// Mock do navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true
});

// Mock do Browser Tools MCP
const mockBrowserToolsMCP = {
  getConsoleLogs: vi.fn(),
  getConsoleErrors: vi.fn(),
  getNetworkLogs: vi.fn(),
  getNetworkErrors: vi.fn(),
  takeScreenshot: vi.fn(),
  runAccessibilityAudit: vi.fn(),
  wipeLogs: vi.fn()
};

// Mock do hook useBrowserToolsMonitoring
vi.mock('../../hooks/monitoring/useBrowserToolsMonitoring', () => ({
  useBrowserToolsMonitoring: () => ({
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
        passes: 10,
        incomplete: 0
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
  })
}));

// Wrapper para o RealtimeProvider
const wrapper = ({ children }: { children: React.ReactNode }) => (
  React.createElement(RealtimeProvider, {}, children)
);

describe('useIntegratedMonitoring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    // Reset navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Inicialização', () => {
    it('deve inicializar com estado padrão', () => {
      const { result } = renderHook(() => useIntegratedMonitoring(), { wrapper });

      expect(result.current.isMonitoring).toBe(false);
      expect(result.current.healthScore).toBe(100);
      expect(result.current.alerts).toEqual([]);
      expect(result.current.metrics).toBeDefined();
      expect(result.current.metrics.realtime).toBeDefined();
      expect(result.current.metrics.browser).toBeDefined();
      expect(result.current.metrics.system).toBeDefined();
    });

    it('deve inicializar com configuração customizada', () => {
      const customConfig = {
        alertThresholds: {
          errorRate: 0.1,
          latency: 2000,
          memoryUsage: 90
        },
        monitoringInterval: 10000,
        enableBrowserTools: false,
        enablePerformanceMonitoring: false
      };

      const { result } = renderHook(() => 
        useIntegratedMonitoring(customConfig), 
        { wrapper }
      );

      expect(result.current.config.alertThresholds.errorRate).toBe(0.1);
      expect(result.current.config.monitoringInterval).toBe(10000);
      expect(result.current.config.enableBrowserTools).toBe(false);
    });
  });

  describe('Controle de Monitoramento', () => {
    it('deve iniciar monitoramento corretamente', async () => {
      const { result } = renderHook(() => useIntegratedMonitoring(), { wrapper });

      await act(async () => {
        await result.current.startMonitoring();
      });

      expect(result.current.isMonitoring).toBe(true);
    });

    it('deve parar monitoramento corretamente', async () => {
      const { result } = renderHook(() => useIntegratedMonitoring(), { wrapper });

      // Iniciar monitoramento
      await act(async () => {
        await result.current.startMonitoring();
      });

      expect(result.current.isMonitoring).toBe(true);

      // Parar monitoramento
      act(() => {
        result.current.stopMonitoring();
      });

      expect(result.current.isMonitoring).toBe(false);
    });

    it('deve atualizar configuração dinamicamente', () => {
      const { result } = renderHook(() => useIntegratedMonitoring(), { wrapper });

      const newConfig = {
        alertThresholds: {
          errorRate: 0.15,
          latency: 3000,
          memoryUsage: 85
        }
      };

      act(() => {
        result.current.updateConfig(newConfig);
      });

      expect(result.current.config.alertThresholds.errorRate).toBe(0.15);
      expect(result.current.config.alertThresholds.latency).toBe(3000);
      expect(result.current.config.alertThresholds.memoryUsage).toBe(85);
    });
  });

  describe('Gestão de Alertas', () => {
    it('deve adicionar alerta corretamente', () => {
      const { result } = renderHook(() => useIntegratedMonitoring(), { wrapper });

      const alert = {
        id: 'test-alert',
        type: 'error' as const,
        source: 'realtime' as const,
        message: 'Teste de alerta',
        timestamp: new Date(),
        resolved: false
      };

      act(() => {
        result.current.addAlert(alert);
      });

      expect(result.current.alerts).toHaveLength(1);
      expect(result.current.alerts[0]).toEqual(alert);
    });

    it('deve resolver alerta corretamente', () => {
      const { result } = renderHook(() => useIntegratedMonitoring(), { wrapper });

      const alert = {
        id: 'test-alert',
        type: 'error' as const,
        source: 'realtime' as const,
        message: 'Teste de alerta',
        timestamp: new Date(),
        resolved: false
      };

      act(() => {
        result.current.addAlert(alert);
      });

      expect(result.current.alerts[0].resolved).toBe(false);

      act(() => {
        result.current.resolveAlert('test-alert');
      });

      expect(result.current.alerts[0].resolved).toBe(true);
    });

    it('deve limpar todos os alertas', () => {
      const { result } = renderHook(() => useIntegratedMonitoring(), { wrapper });

      // Adicionar múltiplos alertas
      const alerts = [
        {
          id: 'alert-1',
          type: 'error' as const,
          source: 'realtime' as const,
          message: 'Alerta 1',
          timestamp: new Date(),
          resolved: false
        },
        {
          id: 'alert-2',
          type: 'warning' as const,
          source: 'browser' as const,
          message: 'Alerta 2',
          timestamp: new Date(),
          resolved: false
        }
      ];

      act(() => {
        alerts.forEach(alert => result.current.addAlert(alert));
      });

      expect(result.current.alerts).toHaveLength(2);

      act(() => {
        result.current.clearAlerts();
      });

      expect(result.current.alerts).toHaveLength(0);
    });

    it('deve detectar alertas automaticamente baseado em thresholds', async () => {
      const { result } = renderHook(() => useIntegratedMonitoring({
        alertThresholds: {
          errorRate: 0.05, // 5%
          latency: 1000,   // 1s
          memoryUsage: 80  // 80%
        }
      }), { wrapper });

      // Simular métricas que excedem os thresholds
      act(() => {
        result.current.updateMetrics({
          realtime: {
            syncCount: 100,
            errorCount: 10, // 10% error rate
            latency: 1500,  // 1.5s latency
            throughput: 50
          }
        });
      });

      await waitFor(() => {
        expect(result.current.alerts.length).toBeGreaterThan(0);
        
        const errorRateAlert = result.current.alerts.find(
          alert => alert.message.includes('Taxa de erro')
        );
        const latencyAlert = result.current.alerts.find(
          alert => alert.message.includes('Latência')
        );
        
        expect(errorRateAlert).toBeDefined();
        expect(latencyAlert).toBeDefined();
      });
    });
  });

  describe('Cálculo de Health Score', () => {
    it('deve calcular health score baseado nas métricas', () => {
      const { result } = renderHook(() => useIntegratedMonitoring(), { wrapper });

      // Métricas perfeitas
      act(() => {
        result.current.updateMetrics({
          realtime: {
            syncCount: 100,
            errorCount: 0,
            latency: 50,
            throughput: 100
          },
          browser: {
            consoleLogs: [],
            consoleErrors: [],
            networkLogs: [],
            networkErrors: [],
            performance: {
              loadTime: 800,
              firstContentfulPaint: 500,
              largestContentfulPaint: 1000,
              cumulativeLayoutShift: 0.05,
              firstInputDelay: 20
            },
            accessibility: {
              violations: [],
              passes: 15,
              incomplete: 0
            }
          },
          system: {
            memoryUsage: 45,
            cpuUsage: 30,
            networkLatency: 50,
            isOnline: true
          }
        });
      });

      expect(result.current.healthScore).toBe(100);
    });

    it('deve reduzir health score com métricas ruins', () => {
      const { result } = renderHook(() => useIntegratedMonitoring(), { wrapper });

      // Métricas ruins
      act(() => {
        result.current.updateMetrics({
          realtime: {
            syncCount: 100,
            errorCount: 20, // 20% error rate
            latency: 2000,  // 2s latency
            throughput: 10  // baixo throughput
          },
          browser: {
            consoleLogs: [],
            consoleErrors: Array(10).fill({}), // 10 erros
            networkLogs: [],
            networkErrors: Array(5).fill({}),  // 5 erros de rede
            performance: {
              loadTime: 5000,  // 5s load time
              firstContentfulPaint: 3000,
              largestContentfulPaint: 6000,
              cumulativeLayoutShift: 0.5, // alto CLS
              firstInputDelay: 300 // alto FID
            },
            accessibility: {
              violations: Array(5).fill({}), // 5 violações
              passes: 5,
              incomplete: 3
            }
          },
          system: {
            memoryUsage: 95, // 95% memory usage
            cpuUsage: 90,    // 90% CPU usage
            networkLatency: 500,
            isOnline: true
          }
        });
      });

      expect(result.current.healthScore).toBeLessThan(50);
    });
  });

  describe('Snapshots e Exportação', () => {
    it('deve tirar snapshot das métricas atuais', () => {
      const { result } = renderHook(() => useIntegratedMonitoring(), { wrapper });

      const snapshot = result.current.takeSnapshot();

      expect(snapshot).toHaveProperty('timestamp');
      expect(snapshot).toHaveProperty('metrics');
      expect(snapshot).toHaveProperty('alerts');
      expect(snapshot).toHaveProperty('healthScore');
      expect(snapshot).toHaveProperty('config');
    });

    it('deve exportar métricas em formato JSON', () => {
      const { result } = renderHook(() => useIntegratedMonitoring(), { wrapper });

      // Adicionar alguns dados
      act(() => {
        result.current.addAlert({
          id: 'test-alert',
          type: 'warning',
          source: 'browser',
          message: 'Teste',
          timestamp: new Date(),
          resolved: false
        });
      });

      const exportedData = result.current.exportMetrics();
      const parsedData = JSON.parse(exportedData);

      expect(parsedData).toHaveProperty('timestamp');
      expect(parsedData).toHaveProperty('metrics');
      expect(parsedData).toHaveProperty('alerts');
      expect(parsedData.alerts).toHaveLength(1);
    });

    it('deve resetar todas as métricas', () => {
      const { result } = renderHook(() => useIntegratedMonitoring(), { wrapper });

      // Adicionar dados
      act(() => {
        result.current.addAlert({
          id: 'test-alert',
          type: 'error',
          source: 'realtime',
          message: 'Teste',
          timestamp: new Date(),
          resolved: false
        });
        
        result.current.updateMetrics({
          realtime: {
            syncCount: 50,
            errorCount: 5,
            latency: 200,
            throughput: 75
          }
        });
      });

      expect(result.current.alerts).toHaveLength(1);
      expect(result.current.metrics.realtime.syncCount).toBe(50);

      act(() => {
        result.current.resetMetrics();
      });

      expect(result.current.alerts).toHaveLength(0);
      expect(result.current.metrics.realtime.syncCount).toBe(0);
      expect(result.current.healthScore).toBe(100);
    });
  });

  describe('Monitoramento Automático', () => {
    it('deve executar coleta automática de métricas quando ativo', async () => {
      const { result } = renderHook(() => useIntegratedMonitoring({
        monitoringInterval: 1000 // 1 segundo
      }), { wrapper });

      await act(async () => {
        await result.current.startMonitoring();
      });

      expect(result.current.isMonitoring).toBe(true);

      // Avançar timer
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Verificar se as métricas foram atualizadas
      await waitFor(() => {
        expect(result.current.metrics).toBeDefined();
      });
    });

    it('deve parar coleta automática quando desativado', async () => {
      const { result } = renderHook(() => useIntegratedMonitoring({
        monitoringInterval: 1000
      }), { wrapper });

      await act(async () => {
        await result.current.startMonitoring();
      });

      expect(result.current.isMonitoring).toBe(true);

      act(() => {
        result.current.stopMonitoring();
      });

      expect(result.current.isMonitoring).toBe(false);

      // Avançar timer - não deve coletar métricas
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // As métricas não devem ter sido atualizadas
      expect(result.current.isMonitoring).toBe(false);
    });
  });

  describe('Integração com Contextos', () => {
    it('deve integrar com RealtimeContext corretamente', () => {
      const { result } = renderHook(() => useIntegratedMonitoring(), { wrapper });

      // As métricas realtime devem estar disponíveis
      expect(result.current.metrics.realtime).toBeDefined();
      expect(result.current.metrics.realtime.syncCount).toBeDefined();
      expect(result.current.metrics.realtime.errorCount).toBeDefined();
    });

    it('deve detectar mudanças no status de conexão', async () => {
      const { result } = renderHook(() => useIntegratedMonitoring(), { wrapper });

      // Simular perda de conexão
      act(() => {
        Object.defineProperty(navigator, 'onLine', {
          writable: true,
          value: false
        });
        
        window.dispatchEvent(new Event('offline'));
      });

      await waitFor(() => {
        expect(result.current.metrics.system.isOnline).toBe(false);
        expect(result.current.healthScore).toBeLessThan(100);
      });
    });
  });
});