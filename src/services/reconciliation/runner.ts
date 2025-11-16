#!/usr/bin/env node

import { ReconciliationAgent } from './index.js';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

/**
 * Script para executar o agente de reconciliação
 * Pode ser executado manualmente ou via cron job
 */
async function runReconciliation() {
  console.log('🔄 Iniciando Agente de Reconciliação AbacatePay <> Supabase');
  console.log('⏰ Timestamp:', new Date().toISOString());
  
  const agent = new ReconciliationAgent();
  
  try {
    await agent.execute();
    console.log('✅ Reconciliação concluída com sucesso');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro durante reconciliação:', error);
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
  runReconciliation();
}

export { runReconciliation };