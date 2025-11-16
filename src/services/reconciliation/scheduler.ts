import cron from 'node-cron';
import { ReconciliationAgent } from './index.js';
import winston from 'winston';

// Configuração do logger para o scheduler
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/scheduler.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

class ReconciliationScheduler {
  private task: cron.ScheduledTask | null = null;
  private isRunning = false;

  /**
   * Inicia o scheduler para executar a cada 5 minutos
   */
  start(): void {
    if (this.task) {
      logger.warn('Scheduler já está em execução');
      return;
    }

    // Executar a cada 5 minutos
    this.task = cron.schedule('*/5 * * * *', async () => {
      await this.executeReconciliation();
    }, {
      scheduled: false,
      timezone: 'America/Sao_Paulo'
    });

    this.task.start();
    logger.info('🚀 Scheduler de reconciliação iniciado - execução a cada 5 minutos');
  }

  /**
   * Para o scheduler
   */
  stop(): void {
    if (this.task) {
      this.task.stop();
      this.task = null;
      logger.info('⏹️ Scheduler de reconciliação parado');
    }
  }

  /**
   * Executa uma reconciliação
   */
  private async executeReconciliation(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Reconciliação já em execução, pulando esta iteração');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();

    try {
      logger.info('🔄 Iniciando execução agendada de reconciliação');
      
      const agent = new ReconciliationAgent();
      await agent.execute();
      
      const duration = Date.now() - startTime;
      logger.info('✅ Reconciliação agendada concluída', { 
        durationMs: duration 
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('❌ Erro na reconciliação agendada', {
        error: error instanceof Error ? error.message : String(error),
        durationMs: duration
      });
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Executa uma reconciliação manual (fora do schedule)
   */
  async executeManual(): Promise<void> {
    logger.info('🔧 Executando reconciliação manual');
    await this.executeReconciliation();
  }

  /**
   * Retorna status do scheduler
   */
  getStatus(): { running: boolean; scheduled: boolean } {
    return {
      running: this.task !== null,
      scheduled: this.task !== null && this.task.getStatus() === 'scheduled'
    };
  }
}

// Instância singleton
const scheduler = new ReconciliationScheduler();

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Recebido SIGINT, parando scheduler...');
  scheduler.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Recebido SIGTERM, parando scheduler...');
  scheduler.stop();
  process.exit(0);
});

// Scheduler disponível para importação e uso externo

export { ReconciliationScheduler, scheduler };