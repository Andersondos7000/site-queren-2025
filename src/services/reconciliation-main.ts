#!/usr/bin/env node

// Carregar variáveis de ambiente primeiro
import { config } from 'dotenv';
config();

import { reconciliationScheduler } from './reconciliation-scheduler';
import { ReconciliationAgent } from './reconciliation-agent';

/**
 * Arquivo principal para execução do Agente de Reconciliação
 * 
 * Uso:
 * - `npm run reconciliation:start` - Inicia o agendador automático
 * - `npm run reconciliation:once` - Executa uma vez
 * - `npm run reconciliation:stop` - Para o agendador
 */

const command = process.argv[2];

async function main() {
  console.log('🤖 Agente de Reconciliação AbacatePay <> Supabase');
  console.log('================================================');

  switch (command) {
    case 'start':
      console.log('🚀 Iniciando agendador automático (a cada 5 minutos)...');
      reconciliationScheduler.start();
      
      // Manter processo vivo
      process.on('SIGINT', () => {
        console.log('\n🛑 Parando agendador...');
        reconciliationScheduler.stop();
        process.exit(0);
      });
      
      // Não sair do processo
      setInterval(() => {
        const status = reconciliationScheduler.getStatus();
        if (status.running) {
          console.log(`⏰ Próxima execução: ${status.nextExecution?.toLocaleString('pt-BR')}`);
        }
      }, 60000); // Log a cada minuto
      
      break;

    case 'once':
      console.log('🔄 Executando reconciliação única...');
      const agent = new ReconciliationAgent();
      const result = await agent.execute();
      
      console.log('\n📊 Resultado da Execução:');
      console.log(`✅ Sucesso: ${result.success}`);
      console.log(`📈 Processados: ${result.processed}`);
      console.log(`🔧 Corrigidos: ${result.corrected}`);
      console.log(`🆔 Execution ID: ${result.execution_id}`);
      
      if (result.errors.length > 0) {
        console.log('\n❌ Erros:');
        result.errors.forEach(error => console.log(`  - ${error}`));
      }
      
      process.exit(result.success ? 0 : 1);

    case 'stop':
      console.log('🛑 Parando agendador...');
      reconciliationScheduler.stop();
      process.exit(0);

    case 'status':
      const status = reconciliationScheduler.getStatus();
      console.log(`📊 Status: ${status.running ? '🟢 Rodando' : '🔴 Parado'}`);
      if (status.nextExecution) {
        console.log(`⏰ Próxima execução: ${status.nextExecution.toLocaleString('pt-BR')}`);
      }
      process.exit(0);

    default:
      console.log('❓ Uso:');
      console.log('  npm run reconciliation:start  - Inicia agendador automático');
      console.log('  npm run reconciliation:once   - Executa uma vez');
      console.log('  npm run reconciliation:stop   - Para agendador');
      console.log('  npm run reconciliation:status - Mostra status');
      process.exit(1);
  }
}

// Tratamento de erros não capturados
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Erro não tratado:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('💥 Exceção não capturada:', error);
  process.exit(1);
});

main().catch(error => {
  console.error('💥 Erro na execução principal:', error);
  process.exit(1);
});