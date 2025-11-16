// Carregar variáveis de ambiente
import { config } from 'dotenv';
config();

import * as cron from 'node-cron';
import { ReconciliationAgent } from './reconciliation-agent';

export class ReconciliationScheduler {
  private isRunning = false;
  private cronJob: cron.ScheduledTask | null = null;

  /**
   * Inicia o agendamento automático a cada 5 minutos
   */
  start(): void {
    if (this.isRunning) {
      console.log('Reconciliation Scheduler já está rodando');
      return;
    }

    // Executa a cada 5 minutos
    this.cronJob = cron.schedule('*/5 * * * *', async () => {
      await this.executeReconciliation();
    }, {
      scheduled: false,
      timezone: 'America/Sao_Paulo'
    });

    this.cronJob.start();
    this.isRunning = true;

    console.log('🤖 Reconciliation Scheduler iniciado - execução a cada 5 minutos');
    
    // Executar uma vez imediatamente
    this.executeReconciliation();
  }

  /**
   * Para o agendamento
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    this.isRunning = false;
    console.log('🛑 Reconciliation Scheduler parado');
  }

  /**
   * Executa o agente de reconciliação
   */
  private async executeReconciliation(): Promise<void> {
    const startTime = Date.now();
    console.log(`\n🔄 [${new Date().toISOString()}] Iniciando reconciliação automática...`);

    try {
      const agent = new ReconciliationAgent();
      const result = await agent.execute();

      const duration = Date.now() - startTime;
      
      if (result.success) {
        console.log(`✅ Reconciliação concluída em ${duration}ms`);
        console.log(`📊 Processados: ${result.processed} | Corrigidos: ${result.corrected}`);
        
        if (result.corrected > 0) {
          console.log(`🔧 ${result.corrected} inconsistências corrigidas automaticamente`);
        }
      } else {
        console.error(`❌ Reconciliação falhou em ${duration}ms`);
        console.error(`🚨 Erros: ${result.errors.join(', ')}`);
      }

      // Alertar se muitos erros
      if (result.errors.length > result.processed * 0.1) {
        console.warn(`⚠️  Taxa de erro alta: ${result.errors.length}/${result.processed}`);
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`💥 Erro crítico na reconciliação (${duration}ms):`, error);
    }
  }

  /**
   * Status do scheduler
   */
  getStatus(): { running: boolean; nextExecution?: Date } {
    return {
      running: this.isRunning,
      nextExecution: this.cronJob ? new Date(Date.now() + 5 * 60 * 1000) : undefined
    };
  }
}

// Instância singleton
export const reconciliationScheduler = new ReconciliationScheduler();