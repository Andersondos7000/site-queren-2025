/**
 * Ferramentas de Diagnóstico para Loops Infinitos
 * Detecta, monitora e alerta sobre padrões de loop em tempo real
 */

interface LoopMetrics {
  operationType: string;
  count: number;
  firstOccurrence: number;
  lastOccurrence: number;
  frequency: number; // ops por segundo
  pattern: 'burst' | 'sustained' | 'periodic' | 'normal';
  stackTrace?: string;
}

interface DiagnosticAlert {
  id: string;
  type: 'warning' | 'critical' | 'info';
  message: string;
  timestamp: number;
  metrics: LoopMetrics;
  suggestions: string[];
}

interface DiagnosticConfig {
  maxOperationsPerSecond: number;
  burstThreshold: number;
  sustainedThreshold: number;
  periodicWindowMs: number;
  alertCooldownMs: number;
  enableStackTraces: boolean;
  enableConsoleAlerts: boolean;
  enablePerformanceMarks: boolean;
}

class LoopDiagnostics {
  private metrics: Map<string, LoopMetrics> = new Map();
  private alerts: DiagnosticAlert[] = [];
  private alertCooldowns: Map<string, number> = new Map();
  private observers: Set<(alert: DiagnosticAlert) => void> = new Set();
  
  private config: DiagnosticConfig = {
    maxOperationsPerSecond: 10,
    burstThreshold: 5, // 5 ops em 1 segundo
    sustainedThreshold: 20, // 20 ops em 10 segundos
    periodicWindowMs: 10000, // janela de 10 segundos
    alertCooldownMs: 30000, // 30 segundos entre alertas do mesmo tipo
    enableStackTraces: true,
    enableConsoleAlerts: true,
    enablePerformanceMarks: true
  };

  /**
   * Registra uma operação para monitoramento
   */
  public trackOperation(operationType: string, metadata?: any): void {
    const now = Date.now();
    const key = operationType;

    // Obtém ou cria métricas
    let metrics = this.metrics.get(key);
    if (!metrics) {
      metrics = {
        operationType,
        count: 0,
        firstOccurrence: now,
        lastOccurrence: now,
        frequency: 0,
        pattern: 'normal'
      };
      this.metrics.set(key, metrics);
    }

    // Atualiza métricas
    metrics.count++;
    metrics.lastOccurrence = now;
    
    // Calcula frequência (ops por segundo na janela atual)
    const windowMs = Math.min(now - metrics.firstOccurrence, this.config.periodicWindowMs);
    metrics.frequency = windowMs > 0 ? (metrics.count * 1000) / windowMs : 0;

    // Detecta padrão
    metrics.pattern = this.detectPattern(metrics);

    // Captura stack trace se habilitado
    if (this.config.enableStackTraces && metrics.pattern !== 'normal') {
      metrics.stackTrace = new Error().stack;
    }

    // Performance mark
    if (this.config.enablePerformanceMarks) {
      performance.mark(`loop-diagnostic-${operationType}-${metrics.count}`);
    }

    // Verifica se deve alertar
    this.checkForAlerts(metrics);

    // Limpa métricas antigas
    this.cleanupOldMetrics();
  }

  /**
   * Detecta padrão de execução
   */
  private detectPattern(metrics: LoopMetrics): LoopMetrics['pattern'] {
    const now = Date.now();
    const timeSinceFirst = now - metrics.firstOccurrence;
    const timeSinceLast = now - metrics.lastOccurrence;

    // Burst: muitas operações em pouco tempo
    if (metrics.count >= this.config.burstThreshold && timeSinceFirst < 1000) {
      return 'burst';
    }

    // Sustained: muitas operações mantidas por tempo prolongado
    if (metrics.count >= this.config.sustainedThreshold && 
        metrics.frequency > this.config.maxOperationsPerSecond) {
      return 'sustained';
    }

    // Periodic: padrão regular de repetição
    if (metrics.count > 10 && timeSinceFirst > 5000) {
      const avgInterval = timeSinceFirst / metrics.count;
      if (avgInterval < 1000 && avgInterval > 100) {
        return 'periodic';
      }
    }

    return 'normal';
  }

  /**
   * Verifica se deve gerar alertas
   */
  private checkForAlerts(metrics: LoopMetrics): void {
    const now = Date.now();
    const alertKey = `${metrics.operationType}-${metrics.pattern}`;

    // Verifica cooldown
    const lastAlert = this.alertCooldowns.get(alertKey);
    if (lastAlert && (now - lastAlert) < this.config.alertCooldownMs) {
      return;
    }

    let shouldAlert = false;
    let alertType: DiagnosticAlert['type'] = 'info';
    let message = '';
    let suggestions: string[] = [];

    switch (metrics.pattern) {
      case 'burst':
        shouldAlert = true;
        alertType = 'warning';
        message = `Burst detectado: ${metrics.count} operações "${metrics.operationType}" em ${now - metrics.firstOccurrence}ms`;
        suggestions = [
          'Implementar debounce ou throttle',
          'Verificar se há useEffect sem dependências corretas',
          'Adicionar guards para prevenir reentrância'
        ];
        break;

      case 'sustained':
        shouldAlert = true;
        alertType = 'critical';
        message = `Loop sustentado: ${metrics.count} operações "${metrics.operationType}" (${metrics.frequency.toFixed(1)} ops/s)`;
        suggestions = [
          'Verificar condições de parada em loops',
          'Implementar circuit breaker',
          'Revisar lógica de retry e backoff',
          'Verificar se há recursão infinita'
        ];
        break;

      case 'periodic':
        shouldAlert = true;
        alertType = 'warning';
        message = `Padrão periódico: ${metrics.count} operações "${metrics.operationType}" em intervalos regulares`;
        suggestions = [
          'Verificar timers ou intervals desnecessários',
          'Revisar polling de APIs',
          'Implementar cache para reduzir chamadas'
        ];
        break;
    }

    if (shouldAlert) {
      const alert: DiagnosticAlert = {
        id: `alert_${now}_${Math.random().toString(36).substr(2, 9)}`,
        type: alertType,
        message,
        timestamp: now,
        metrics: { ...metrics },
        suggestions
      };

      this.alerts.push(alert);
      this.alertCooldowns.set(alertKey, now);

      // Notifica observers
      this.notifyObservers(alert);

      // Console alert se habilitado
      if (this.config.enableConsoleAlerts) {
        this.logAlert(alert);
      }

      // Limita histórico de alertas
      if (this.alerts.length > 100) {
        this.alerts = this.alerts.slice(-50);
      }
    }
  }

  /**
   * Log do alerta no console
   */
  private logAlert(alert: DiagnosticAlert): void {
    const emoji = alert.type === 'critical' ? '🚨' : alert.type === 'warning' ? '⚠️' : 'ℹ️';
    const style = alert.type === 'critical' ? 'color: red; font-weight: bold' : 
                  alert.type === 'warning' ? 'color: orange; font-weight: bold' : 
                  'color: blue';

    console.group(`%c${emoji} [LoopDiagnostics] ${alert.message}`, style);
    console.log('Métricas:', alert.metrics);
    console.log('Sugestões:', alert.suggestions);
    
    if (alert.metrics.stackTrace) {
      console.log('Stack Trace:', alert.metrics.stackTrace);
    }
    
    console.groupEnd();
  }

  /**
   * Notifica observers sobre alertas
   */
  private notifyObservers(alert: DiagnosticAlert): void {
    this.observers.forEach(observer => {
      try {
        observer(alert);
      } catch (error) {
        console.error('[LoopDiagnostics] Erro ao notificar observer:', error);
      }
    });
  }

  /**
   * Limpa métricas antigas
   */
  private cleanupOldMetrics(): void {
    const now = Date.now();
    const maxAge = this.config.periodicWindowMs * 2;

    for (const [key, metrics] of this.metrics.entries()) {
      if (now - metrics.lastOccurrence > maxAge) {
        this.metrics.delete(key);
      }
    }
  }

  /**
   * Adiciona observer para alertas
   */
  public addAlertObserver(observer: (alert: DiagnosticAlert) => void): () => void {
    this.observers.add(observer);
    return () => this.observers.delete(observer);
  }

  /**
   * Obtém métricas atuais
   */
  public getMetrics(): LoopMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Obtém alertas recentes
   */
  public getRecentAlerts(maxAge: number = 300000): DiagnosticAlert[] {
    const cutoff = Date.now() - maxAge;
    return this.alerts.filter(alert => alert.timestamp > cutoff);
  }

  /**
   * Obtém estatísticas gerais
   */
  public getStats() {
    const metrics = this.getMetrics();
    const alerts = this.getRecentAlerts();

    return {
      totalOperations: metrics.reduce((sum, m) => sum + m.count, 0),
      activePatterns: metrics.filter(m => m.pattern !== 'normal').length,
      criticalAlerts: alerts.filter(a => a.type === 'critical').length,
      warningAlerts: alerts.filter(a => a.type === 'warning').length,
      topOperations: metrics
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 5)
        .map(m => ({ type: m.operationType, frequency: m.frequency, pattern: m.pattern }))
    };
  }

  /**
   * Reset completo
   */
  public reset(): void {
    this.metrics.clear();
    this.alerts = [];
    this.alertCooldowns.clear();
    console.log('[LoopDiagnostics] Estado resetado');
  }

  /**
   * Configura parâmetros de diagnóstico
   */
  public configure(config: Partial<DiagnosticConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('[LoopDiagnostics] Configuração atualizada:', this.config);
  }

  /**
   * Força verificação de todas as métricas
   */
  public forceCheck(): DiagnosticAlert[] {
    const newAlerts: DiagnosticAlert[] = [];
    
    for (const metrics of this.metrics.values()) {
      const oldAlertsCount = this.alerts.length;
      this.checkForAlerts(metrics);
      
      // Adiciona novos alertas à lista de retorno
      if (this.alerts.length > oldAlertsCount) {
        newAlerts.push(...this.alerts.slice(oldAlertsCount));
      }
    }
    
    return newAlerts;
  }

  /**
   * Gera relatório detalhado
   */
  public generateReport(): string {
    const stats = this.getStats();
    const metrics = this.getMetrics();
    const alerts = this.getRecentAlerts();

    let report = '📊 Relatório de Diagnóstico de Loops\n';
    report += '=====================================\n\n';

    report += `📈 Estatísticas Gerais:\n`;
    report += `- Total de operações: ${stats.totalOperations}\n`;
    report += `- Padrões ativos: ${stats.activePatterns}\n`;
    report += `- Alertas críticos: ${stats.criticalAlerts}\n`;
    report += `- Alertas de warning: ${stats.warningAlerts}\n\n`;

    if (stats.topOperations.length > 0) {
      report += `🔥 Top Operações por Frequência:\n`;
      stats.topOperations.forEach((op, i) => {
        report += `${i + 1}. ${op.type}: ${op.frequency.toFixed(1)} ops/s (${op.pattern})\n`;
      });
      report += '\n';
    }

    if (alerts.length > 0) {
      report += `🚨 Alertas Recentes:\n`;
      alerts.slice(-10).forEach(alert => {
        const time = new Date(alert.timestamp).toLocaleTimeString();
        report += `[${time}] ${alert.type.toUpperCase()}: ${alert.message}\n`;
      });
    }

    return report;
  }
}

// Singleton instance
export const loopDiagnostics = new LoopDiagnostics();

// Wrapper para tracking automático
export function trackOperation(operationType: string, metadata?: any) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]) {
      loopDiagnostics.trackOperation(`${target.constructor.name}.${propertyKey}`, metadata);
      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

// Hook para React
export const useLoopDiagnostics = () => {
  const [alerts, setAlerts] = React.useState<DiagnosticAlert[]>([]);
  const [stats, setStats] = React.useState(loopDiagnostics.getStats());

  React.useEffect(() => {
    const unsubscribe = loopDiagnostics.addAlertObserver((alert) => {
      setAlerts(prev => [...prev.slice(-9), alert]); // Mantém últimos 10
    });

    const interval = setInterval(() => {
      setStats(loopDiagnostics.getStats());
    }, 5000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  return {
    alerts,
    stats,
    trackOperation: loopDiagnostics.trackOperation.bind(loopDiagnostics),
    getReport: loopDiagnostics.generateReport.bind(loopDiagnostics),
    reset: loopDiagnostics.reset.bind(loopDiagnostics)
  };
};

// Utilitários
export const DiagnosticUtils = {
  /**
   * Monitora função específica
   */
  monitor: <T extends (...args: any[]) => any>(
    fn: T,
    operationType: string
  ): T => {
    return ((...args: any[]) => {
      loopDiagnostics.trackOperation(operationType);
      return fn(...args);
    }) as T;
  },

  /**
   * Monitora Promise
   */
  monitorAsync: async <T>(
    promise: Promise<T>,
    operationType: string
  ): Promise<T> => {
    loopDiagnostics.trackOperation(operationType);
    return promise;
  },

  /**
   * Cria monitor para useEffect
   */
  monitorEffect: (operationType: string, deps?: React.DependencyList) => {
    return React.useCallback(() => {
      loopDiagnostics.trackOperation(`useEffect:${operationType}`);
    }, deps);
  }
};

// Auto-inicialização com configuração padrão
if (typeof window !== 'undefined') {
  // Monitora eventos globais que podem indicar loops
  let lastEventCount = 0;
  let eventBurstStart = 0;

  const monitorGlobalEvents = () => {
    const eventCount = performance.getEntriesByType('navigation').length +
                      performance.getEntriesByType('reload').length;
    
    if (eventCount > lastEventCount) {
      const now = Date.now();
      if (now - eventBurstStart < 5000) {
        loopDiagnostics.trackOperation('global:page-reload-burst');
      } else {
        eventBurstStart = now;
      }
      lastEventCount = eventCount;
    }
  };

  setInterval(monitorGlobalEvents, 1000);
}