#!/usr/bin/env node

import { config } from 'dotenv';
config();

import { MonitoringService } from '../services/monitoring';

async function main() {
  console.log('🏥 Health Check - Agente de Reconciliação');
  console.log('==========================================\n');

  const monitoring = new MonitoringService();

  try {
    // Health check geral
    const health = await monitoring.healthCheck();
    
    console.log(`🔍 Status Geral: ${getStatusEmoji(health.status)} ${health.status.toUpperCase()}\n`);

    // Detalhes dos checks
    console.log('📋 Verificações:');
    for (const check of health.checks) {
      const emoji = check.status ? '✅' : '❌';
      console.log(`  ${emoji} ${check.name}: ${check.message || (check.status ? 'OK' : 'FALHA')}`);
    }

    // Estatísticas das últimas 24h
    console.log('\n📊 Estatísticas (últimas 24h):');
    const stats = await monitoring.getExecutionStats(24);
    
    if (stats) {
      console.log(`  🔄 Execuções: ${stats.totalExecutions}`);
      console.log(`  ⏱️  Duração média: ${Math.round(stats.avgDuration / 1000)}s`);
      console.log(`  📈 Pedidos processados: ${stats.totalProcessed}`);
      console.log(`  🔧 Pedidos corrigidos: ${stats.totalCorrected}`);
      console.log(`  📡 Taxa sucesso API: ${(stats.avgSuccessRate * 100).toFixed(1)}%`);
      console.log(`  ⚠️  Execuções com erro: ${stats.recentErrors}`);
      
      if (stats.lastExecution) {
        const lastExec = new Date(stats.lastExecution);
        const timeSince = Math.round((Date.now() - lastExec.getTime()) / (1000 * 60));
        console.log(`  🕐 Última execução: ${timeSince} minutos atrás`);
      }
    } else {
      console.log('  ❌ Não foi possível obter estatísticas');
    }

    // Exit code baseado no status
    const exitCode = health.status === 'critical' ? 1 : 0;
    process.exit(exitCode);

  } catch (error) {
    console.error('❌ Erro no health check:', error);
    process.exit(1);
  }
}

function getStatusEmoji(status: string): string {
  switch (status) {
    case 'healthy': return '🟢';
    case 'warning': return '🟡';
    case 'critical': return '🔴';
    default: return '⚪';
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}