import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AlertsPanel } from '../../components/monitoring/AlertsPanel';
import type { MonitoringAlert } from '../../hooks/monitoring/useIntegratedMonitoring';

// Mock do áudio
const mockAudio = {
  play: vi.fn().mockResolvedValue(undefined),
  pause: vi.fn(),
  currentTime: 0,
  volume: 1
};

Object.defineProperty(window, 'Audio', {
  writable: true,
  value: vi.fn().mockImplementation(() => mockAudio)
});

// Mock alerts para testes
const mockAlerts: MonitoringAlert[] = [
  {
    id: 'alert-1',
    type: 'error',
    source: 'realtime',
    message: 'Erro de sincronização com o servidor',
    timestamp: new Date('2024-01-15T10:00:00Z'),
    resolved: false,
    metadata: {
      errorCode: 'SYNC_ERROR',
      details: 'Falha na conexão WebSocket'
    }
  },
  {
    id: 'alert-2',
    type: 'warning',
    source: 'browser',
    message: 'Performance degradada detectada',
    timestamp: new Date('2024-01-15T10:05:00Z'),
    resolved: false,
    metadata: {
      metric: 'loadTime',
      value: 3500,
      threshold: 3000
    }
  },
  {
    id: 'alert-3',
    type: 'info',
    source: 'system',
    message: 'Sistema voltou online',
    timestamp: new Date('2024-01-15T10:10:00Z'),
    resolved: true,
    metadata: {
      previousStatus: 'offline',
      currentStatus: 'online'
    }
  },
  {
    id: 'alert-4',
    type: 'error',
    source: 'browser',
    message: 'Erro JavaScript detectado',
    timestamp: new Date('2024-01-15T10:15:00Z'),
    resolved: false,
    metadata: {
      error: 'TypeError: Cannot read property of undefined',
      stack: 'at Component.render (app.js:123)'
    }
  }
];

const defaultProps = {
  alerts: mockAlerts,
  onResolveAlert: vi.fn(),
  onClearAlerts: vi.fn(),
  onExportAlerts: vi.fn()
};

describe('AlertsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T10:20:00Z'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Renderização Básica', () => {
    it('deve renderizar o painel de alertas corretamente', () => {
      render(<AlertsPanel {...defaultProps} />);

      expect(screen.getByText('Alertas')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument(); // Total de alertas
      expect(screen.getByText('3')).toBeInTheDocument(); // Alertas não resolvidos
    });

    it('deve exibir estatísticas corretas', () => {
      render(<AlertsPanel {...defaultProps} />);

      // Verificar estatísticas rápidas
      expect(screen.getByText('2')).toBeInTheDocument(); // Erros
      expect(screen.getByText('1')).toBeInTheDocument(); // Avisos
      expect(screen.getByText('1')).toBeInTheDocument(); // Info
    });

    it('deve renderizar todos os alertas por padrão', () => {
      render(<AlertsPanel {...defaultProps} />);

      expect(screen.getByText('Erro de sincronização com o servidor')).toBeInTheDocument();
      expect(screen.getByText('Performance degradada detectada')).toBeInTheDocument();
      expect(screen.getByText('Sistema voltou online')).toBeInTheDocument();
      expect(screen.getByText('Erro JavaScript detectado')).toBeInTheDocument();
    });

    it('deve exibir mensagem quando não há alertas', () => {
      render(<AlertsPanel {...defaultProps} alerts={[]} />);

      expect(screen.getByText('Nenhum alerta encontrado')).toBeInTheDocument();
      expect(screen.getByText('Tudo funcionando perfeitamente! 🎉')).toBeInTheDocument();
    });
  });

  describe('Filtragem de Alertas', () => {
    it('deve filtrar alertas por status (não resolvidos)', async () => {
      render(<AlertsPanel {...defaultProps} />);

      // Abrir menu de filtros
      const filterButton = screen.getByRole('button', { name: /filtros/i });
      fireEvent.click(filterButton);

      // Selecionar "Não Resolvidos"
      const unresolvedFilter = screen.getByText('Não Resolvidos');
      fireEvent.click(unresolvedFilter);

      await waitFor(() => {
        expect(screen.getByText('Erro de sincronização com o servidor')).toBeInTheDocument();
        expect(screen.getByText('Performance degradada detectada')).toBeInTheDocument();
        expect(screen.getByText('Erro JavaScript detectado')).toBeInTheDocument();
        expect(screen.queryByText('Sistema voltou online')).not.toBeInTheDocument();
      });
    });

    it('deve filtrar alertas por tipo (erros)', async () => {
      render(<AlertsPanel {...defaultProps} />);

      // Abrir menu de filtros
      const filterButton = screen.getByRole('button', { name: /filtros/i });
      fireEvent.click(filterButton);

      // Selecionar "Erros"
      const errorFilter = screen.getByText('Erros');
      fireEvent.click(errorFilter);

      await waitFor(() => {
        expect(screen.getByText('Erro de sincronização com o servidor')).toBeInTheDocument();
        expect(screen.getByText('Erro JavaScript detectado')).toBeInTheDocument();
        expect(screen.queryByText('Performance degradada detectada')).not.toBeInTheDocument();
        expect(screen.queryByText('Sistema voltou online')).not.toBeInTheDocument();
      });
    });

    it('deve filtrar alertas por fonte (realtime)', async () => {
      render(<AlertsPanel {...defaultProps} />);

      // Abrir menu de filtros
      const filterButton = screen.getByRole('button', { name: /filtros/i });
      fireEvent.click(filterButton);

      // Selecionar "Realtime"
      const realtimeFilter = screen.getByText('Realtime');
      fireEvent.click(realtimeFilter);

      await waitFor(() => {
        expect(screen.getByText('Erro de sincronização com o servidor')).toBeInTheDocument();
        expect(screen.queryByText('Performance degradada detectada')).not.toBeInTheDocument();
        expect(screen.queryByText('Sistema voltou online')).not.toBeInTheDocument();
        expect(screen.queryByText('Erro JavaScript detectado')).not.toBeInTheDocument();
      });
    });

    it('deve combinar múltiplos filtros', async () => {
      render(<AlertsPanel {...defaultProps} />);

      // Abrir menu de filtros
      const filterButton = screen.getByRole('button', { name: /filtros/i });
      fireEvent.click(filterButton);

      // Selecionar "Não Resolvidos" e "Erros"
      fireEvent.click(screen.getByText('Não Resolvidos'));
      fireEvent.click(screen.getByText('Erros'));

      await waitFor(() => {
        expect(screen.getByText('Erro de sincronização com o servidor')).toBeInTheDocument();
        expect(screen.getByText('Erro JavaScript detectado')).toBeInTheDocument();
        expect(screen.queryByText('Performance degradada detectada')).not.toBeInTheDocument();
        expect(screen.queryByText('Sistema voltou online')).not.toBeInTheDocument();
      });
    });
  });

  describe('Ações de Alerta', () => {
    it('deve resolver um alerta individual', async () => {
      const onResolveAlert = vi.fn();
      render(<AlertsPanel {...defaultProps} onResolveAlert={onResolveAlert} />);

      // Encontrar botão de resolver do primeiro alerta não resolvido
      const resolveButtons = screen.getAllByRole('button', { name: /resolver/i });
      fireEvent.click(resolveButtons[0]);

      expect(onResolveAlert).toHaveBeenCalledWith('alert-1');
    });

    it('deve limpar todos os alertas', async () => {
      const onClearAlerts = vi.fn();
      render(<AlertsPanel {...defaultProps} onClearAlerts={onClearAlerts} />);

      // Abrir menu de configurações
      const settingsButton = screen.getByRole('button', { name: /configurações/i });
      fireEvent.click(settingsButton);

      // Clicar em "Limpar Todos"
      const clearButton = screen.getByText('Limpar Todos');
      fireEvent.click(clearButton);

      expect(onClearAlerts).toHaveBeenCalled();
    });

    it('deve exportar alertas', async () => {
      const onExportAlerts = vi.fn();
      render(<AlertsPanel {...defaultProps} onExportAlerts={onExportAlerts} />);

      // Abrir menu de configurações
      const settingsButton = screen.getByRole('button', { name: /configurações/i });
      fireEvent.click(settingsButton);

      // Clicar em "Exportar"
      const exportButton = screen.getByText('Exportar');
      fireEvent.click(exportButton);

      expect(onExportAlerts).toHaveBeenCalled();
    });
  });

  describe('Notificações Sonoras', () => {
    it('deve reproduzir som para novos alertas de erro', async () => {
      const { rerender } = render(<AlertsPanel {...defaultProps} />);

      // Adicionar novo alerta de erro
      const newAlert: MonitoringAlert = {
        id: 'new-error',
        type: 'error',
        source: 'realtime',
        message: 'Novo erro crítico',
        timestamp: new Date(),
        resolved: false
      };

      rerender(
        <AlertsPanel 
          {...defaultProps} 
          alerts={[...mockAlerts, newAlert]} 
        />
      );

      await waitFor(() => {
        expect(mockAudio.play).toHaveBeenCalled();
      });
    });

    it('deve reproduzir som para novos alertas de aviso', async () => {
      const { rerender } = render(<AlertsPanel {...defaultProps} />);

      // Adicionar novo alerta de aviso
      const newAlert: MonitoringAlert = {
        id: 'new-warning',
        type: 'warning',
        source: 'browser',
        message: 'Novo aviso de performance',
        timestamp: new Date(),
        resolved: false
      };

      rerender(
        <AlertsPanel 
          {...defaultProps} 
          alerts={[...mockAlerts, newAlert]} 
        />
      );

      await waitFor(() => {
        expect(mockAudio.play).toHaveBeenCalled();
      });
    });

    it('não deve reproduzir som para alertas de info', async () => {
      const { rerender } = render(<AlertsPanel {...defaultProps} />);

      // Adicionar novo alerta de info
      const newAlert: MonitoringAlert = {
        id: 'new-info',
        type: 'info',
        source: 'system',
        message: 'Nova informação',
        timestamp: new Date(),
        resolved: false
      };

      rerender(
        <AlertsPanel 
          {...defaultProps} 
          alerts={[...mockAlerts, newAlert]} 
        />
      );

      // Aguardar um pouco para garantir que o som não foi reproduzido
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(mockAudio.play).not.toHaveBeenCalled();
    });

    it('deve permitir desativar notificações sonoras', async () => {
      render(<AlertsPanel {...defaultProps} />);

      // Abrir menu de configurações
      const settingsButton = screen.getByRole('button', { name: /configurações/i });
      fireEvent.click(settingsButton);

      // Desativar notificações sonoras
      const soundToggle = screen.getByRole('checkbox');
      fireEvent.click(soundToggle);

      // Fechar menu
      fireEvent.click(settingsButton);

      // Adicionar novo alerta de erro
      const { rerender } = render(<AlertsPanel {...defaultProps} />);
      const newAlert: MonitoringAlert = {
        id: 'new-error-silent',
        type: 'error',
        source: 'realtime',
        message: 'Erro silencioso',
        timestamp: new Date(),
        resolved: false
      };

      rerender(
        <AlertsPanel 
          {...defaultProps} 
          alerts={[...mockAlerts, newAlert]} 
        />
      );

      // Som não deve ser reproduzido
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(mockAudio.play).not.toHaveBeenCalled();
    });
  });

  describe('Formatação de Tempo', () => {
    it('deve formatar tempo relativo corretamente', () => {
      render(<AlertsPanel {...defaultProps} />);

      // Verificar formatação de tempo (baseado no tempo atual mockado)
      expect(screen.getByText('há 20 min')).toBeInTheDocument(); // alert-1: 10:00 -> 10:20 = 20min
      expect(screen.getByText('há 15 min')).toBeInTheDocument(); // alert-2: 10:05 -> 10:20 = 15min
      expect(screen.getByText('há 10 min')).toBeInTheDocument(); // alert-3: 10:10 -> 10:20 = 10min
      expect(screen.getByText('há 5 min')).toBeInTheDocument();  // alert-4: 10:15 -> 10:20 = 5min
    });
  });

  describe('Ícones e Badges', () => {
    it('deve exibir ícones corretos para cada tipo de alerta', () => {
      render(<AlertsPanel {...defaultProps} />);

      // Verificar se os ícones estão presentes (usando data-testid ou classes)
      const errorIcons = screen.getAllByTestId('error-icon');
      const warningIcons = screen.getAllByTestId('warning-icon');
      const infoIcons = screen.getAllByTestId('info-icon');

      expect(errorIcons).toHaveLength(2); // 2 alertas de erro
      expect(warningIcons).toHaveLength(1); // 1 alerta de aviso
      expect(infoIcons).toHaveLength(1); // 1 alerta de info
    });

    it('deve exibir badges corretos para cada fonte', () => {
      render(<AlertsPanel {...defaultProps} />);

      expect(screen.getByText('Realtime')).toBeInTheDocument();
      expect(screen.getAllByText('Browser')).toHaveLength(2);
      expect(screen.getByText('Sistema')).toBeInTheDocument();
    });

    it('deve exibir indicador de alerta resolvido', () => {
      render(<AlertsPanel {...defaultProps} />);

      // Verificar se há indicador de resolvido para o alert-3
      const resolvedIndicators = screen.getAllByTestId('resolved-icon');
      expect(resolvedIndicators).toHaveLength(1);
    });
  });

  describe('Metadados de Alerta', () => {
    it('deve exibir metadados quando disponíveis', () => {
      render(<AlertsPanel {...defaultProps} />);

      // Verificar se metadados são exibidos
      expect(screen.getByText('SYNC_ERROR')).toBeInTheDocument();
      expect(screen.getByText('Falha na conexão WebSocket')).toBeInTheDocument();
      expect(screen.getByText('loadTime: 3500 (limite: 3000)')).toBeInTheDocument();
    });

    it('deve lidar com alertas sem metadados', () => {
      const alertWithoutMetadata: MonitoringAlert = {
        id: 'no-metadata',
        type: 'info',
        source: 'system',
        message: 'Alerta sem metadados',
        timestamp: new Date(),
        resolved: false
      };

      render(
        <AlertsPanel 
          {...defaultProps} 
          alerts={[alertWithoutMetadata]} 
        />
      );

      expect(screen.getByText('Alerta sem metadados')).toBeInTheDocument();
      // Não deve quebrar sem metadados
    });
  });

  describe('Responsividade', () => {
    it('deve adaptar layout para telas pequenas', () => {
      // Mock window.innerWidth
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 480
      });

      render(<AlertsPanel {...defaultProps} />);

      // Verificar se o layout se adapta (pode verificar classes CSS específicas)
      const panel = screen.getByTestId('alerts-panel');
      expect(panel).toHaveClass('responsive-layout');
    });
  });

  describe('Acessibilidade', () => {
    it('deve ter labels apropriados para screen readers', () => {
      render(<AlertsPanel {...defaultProps} />);

      expect(screen.getByLabelText('Painel de alertas')).toBeInTheDocument();
      expect(screen.getByLabelText('Filtrar alertas')).toBeInTheDocument();
      expect(screen.getByLabelText('Configurações de alertas')).toBeInTheDocument();
    });

    it('deve suportar navegação por teclado', () => {
      render(<AlertsPanel {...defaultProps} />);

      const filterButton = screen.getByRole('button', { name: /filtros/i });
      
      // Testar foco
      filterButton.focus();
      expect(filterButton).toHaveFocus();

      // Testar ativação por teclado
      fireEvent.keyDown(filterButton, { key: 'Enter' });
      expect(screen.getByText('Todos')).toBeInTheDocument();
    });
  });
});