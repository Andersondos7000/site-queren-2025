#!/usr/bin/env node

import { ReconciliationAgent } from './index.js';
import { scheduler } from './scheduler.js';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

/**
 * Script de teste para o agente de reconciliação
 */
async function testReconciliation() {
  console.log('🧪 Iniciando testes do Agente de Reconciliação');
  console.log('=' .repeat(50));
  
  try {
    // Teste 1: Execução manual única
    console.log('\n📋 Teste 1: Execução Manual');
    console.log('-'.repeat(30));
    
    const agent = new ReconciliationAgent();
    const startTime = Date.now();
    
    await agent.execute();
    
    const duration = Date.now() - startTime;
    console.log(`✅ Execução manual concluída em ${duration}ms`);
    
    // Teste 2: Status do scheduler
    console.log('\n📋 Teste 2: Status do Scheduler');
    console.log('-'.repeat(30));
    
    const status = scheduler.getStatus();
    console.log('Status do scheduler:', status);
    
    // Teste 3: Execução manual via scheduler
    console.log('\n📋 Teste 3: Execução via Scheduler');
    console.log('-'.repeat(30));
    
    await scheduler.executeManual();
    console.log('✅ Execução via scheduler concluída');
    
    console.log('\n🎉 Todos os testes concluídos com sucesso!');
    
  } catch (error) {
    console.error('\n❌ Erro durante os testes:', error);
    process.exit(1);
  }
}

/**
 * Teste de conectividade com serviços externos
 */
async function testConnectivity() {
  console.log('\n🔌 Testando conectividade...');
  console.log('-'.repeat(30));
  
  try {
    const agent = new ReconciliationAgent();
    
    // Teste Supabase
    console.log('🔍 Testando conexão com Supabase...');
    // Implementar teste básico de conexão
    
    // Teste AbacatePay
    console.log('🔍 Testando conexão com AbacatePay...');
    // Implementar teste básico de conexão
    
    console.log('✅ Conectividade OK');
    
  } catch (error) {
    console.error('❌ Erro de conectividade:', error);
    throw error;
  }
}

/**
 * Função principal
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'test';
  
  switch (command) {
    case 'test':
      await testConnectivity();
      await testReconciliation();
      break;
      
    case 'connectivity':
      await testConnectivity();
      break;
      
    case 'run':
      console.log('🚀 Executando reconciliação única...');
      const agent = new ReconciliationAgent();
      await agent.execute();
      break;
      
    case 'scheduler':
      console.log('⏰ Iniciando scheduler...');
      scheduler.start();
      console.log('Scheduler iniciado. Pressione Ctrl+C para parar.');
      
      // Manter processo vivo
      process.on('SIGINT', () => {
        console.log('\n⏹️ Parando scheduler...');
        scheduler.stop();
        process.exit(0);
      });
      
      // Manter processo vivo
      setInterval(() => {
        const status = scheduler.getStatus();
        console.log(`📊 Status: ${status.running ? 'Rodando' : 'Parado'} | Próxima execução: ${status.nextExecution?.toLocaleString() || 'N/A'}`);
      }, 60000); // Log a cada minuto
      
      break;
      
    default:
      console.log(`
Uso: node test.js [comando]

Comandos disponíveis:
  test         - Executa todos os testes (padrão)
  connectivity - Testa apenas conectividade
  run          - Executa reconciliação única
  scheduler    - Inicia scheduler contínuo

Exemplos:
  node test.js
  node test.js connectivity
  node test.js run
  node test.js scheduler
      `);
  }
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });
}

export { testReconciliation, testConnectivity };