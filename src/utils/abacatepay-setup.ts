/**
 * Utilitário para configuração inicial da AbacatePay
 * Execute este arquivo uma vez para configurar o webhook
 */

import { registrarWebhookAbacatePay } from '../api/webhook-abacatepay';

// Configurações da AbacatePay
export const ABACATEPAY_CONFIG = {
  API_KEY: 'abc_dev_fhb5Dh0s24wHQ6XWgFAGdzjc',
  WEBHOOK_SECRET: 'webh_dev_AWChUaMh0HTZKDtTPxsBAWpf',
  WEBHOOK_URL: 'https://borboletaeventos-stripe.ultrahook.com/webhook/abacatepay',
  API_BASE_URL: 'https://api.abacatepay.com/v1'
};

// Função para configurar webhook automaticamente
export async function configurarAbacatePay(): Promise<void> {
  console.log('🚀 Iniciando configuração da AbacatePay...');
  
  try {
    // Registrar webhook
    console.log('📡 Registrando webhook...');
    const resultado = await registrarWebhookAbacatePay(
      ABACATEPAY_CONFIG.WEBHOOK_URL,
      ABACATEPAY_CONFIG.API_KEY
    );
    
    if (resultado.success) {
      console.log('✅ Webhook registrado com sucesso!');
      console.log('📋 Dados do webhook:', resultado.data);
    } else {
      console.error('❌ Erro ao registrar webhook:', resultado.error);
      throw new Error(resultado.error);
    }
    
    // Verificar configuração
    console.log('🔍 Verificando configuração...');
    await verificarConfiguracaoAbacatePay();
    
    console.log('🎉 Configuração da AbacatePay concluída com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro na configuração da AbacatePay:', error);
    throw error;
  }
}

// Função para verificar se a configuração está correta
export async function verificarConfiguracaoAbacatePay(): Promise<boolean> {
  try {
    console.log('🔍 Verificando conexão com a API...');
    
    // Teste simples de conexão com a API
    const response = await fetch(`${ABACATEPAY_CONFIG.API_BASE_URL}/webhooks`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ABACATEPAY_CONFIG.API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const webhooks = await response.json();
      console.log('✅ Conexão com API estabelecida');
      console.log(`📊 Webhooks configurados: ${webhooks.length || 0}`);
      return true;
    } else {
      console.error('❌ Erro na conexão com API:', response.status);
      return false;
    }
  } catch (error) {
    console.error('❌ Erro ao verificar configuração:', error);
    return false;
  }
}

// Função para testar criação de cobrança
export async function testarCriacaoCobranca(): Promise<void> {
  try {
    console.log('🧪 Testando criação de cobrança...');
    
    const cobrancaTeste = {
      valor: 100, // R$ 1,00 em centavos
      descricao: 'Teste de integração AbacatePay',
      cliente: {
        nome: 'Cliente Teste',
        email: 'teste@exemplo.com',
        cpf: '123.456.789-00'
      },
      metodos: ['pix'],
      expires_in: 3600 // 1 hora
    };
    
    const response = await fetch(`${ABACATEPAY_CONFIG.API_BASE_URL}/cobrancas`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ABACATEPAY_CONFIG.API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(cobrancaTeste)
    });
    
    const resultado = await response.json();
    
    if (response.ok) {
      console.log('✅ Cobrança de teste criada com sucesso!');
      console.log('📋 ID da cobrança:', resultado.id);
      console.log('💰 Valor:', `R$ ${resultado.valor / 100}`);
      console.log('🔗 QR Code URL:', resultado.pix?.qr_code_url);
    } else {
      console.error('❌ Erro ao criar cobrança de teste:', resultado);
    }
  } catch (error) {
    console.error('❌ Erro no teste de cobrança:', error);
  }
}

// Função principal para executar toda a configuração
export async function executarConfiguracaoCompleta(): Promise<void> {
  console.log('🎯 Iniciando configuração completa da AbacatePay...\n');
  
  try {
    // Passo 1: Configurar webhook
    await configurarAbacatePay();
    console.log('');
    
    // Passo 2: Testar criação de cobrança
    await testarCriacaoCobranca();
    console.log('');
    
    console.log('🎉 Configuração completa finalizada!');
    console.log('📝 Próximos passos:');
    console.log('   1. Implemente o endpoint de webhook no seu backend');
    console.log('   2. Teste o fluxo completo de pagamento');
    console.log('   3. Configure as variáveis de ambiente para produção');
    
  } catch (error) {
    console.error('❌ Erro na configuração completa:', error);
  }
}

// Executar configuração se este arquivo for executado diretamente
if (require.main === module) {
  executarConfiguracaoCompleta();
}

// Instruções de uso
export const INSTRUCOES_USO = `
🚀 INSTRUÇÕES DE USO - AbacatePay

1. CONFIGURAÇÃO INICIAL (Execute uma vez):
   npm run ts-node src/utils/abacatepay-setup.ts
   
2. IMPLEMENTAR WEBHOOK NO BACKEND:
   - Use o código em src/api/webhook-abacatepay.ts
   - Configure o endpoint POST /api/webhook-abacatepay
   - Valide a assinatura HMAC para segurança
   
3. INTEGRAÇÃO NO FRONTEND:
   - Use o componente AbacatePayCheckout
   - Configure o hook useAbacatePay
   - Integre no fluxo de checkout existente
   
4. VARIÁVEIS DE AMBIENTE (Produção):
   ABACATEPAY_API_KEY=sua_chave_de_producao
   ABACATEPAY_WEBHOOK_SECRET=seu_webhook_secret_de_producao
   ABACATEPAY_WEBHOOK_URL=https://seu-dominio.com/api/webhook-abacatepay
   
5. TESTES:
   - Teste em ambiente de desenvolvimento
   - Valide recebimento de webhooks
   - Confirme atualização de status dos pedidos
`;

console.log(INSTRUCOES_USO);