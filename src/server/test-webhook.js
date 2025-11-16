/**
 * Script para testar o webhook do AbacatePay
 * 
 * Este script simula o envio de eventos do AbacatePay para o webhook
 * Para executar: node test-webhook.js
 */

const crypto = require('crypto');
const axios = require('axios');
require('dotenv').config();

// Configurações
const WEBHOOK_URL = 'http://localhost:3001/api/webhook/abacatepay';
const WEBHOOK_SECRET = process.env.ABACATEPAY_WEBHOOK_SECRET || 'webh_dev_abc123xyz789';

// Exemplos de eventos
const eventExamples = [
  {
    type: 'billing.paid',
    data: {
      id: 'pix_123456789',
      status: 'paid',
      amount: 10000, // R$ 100,00
      created_at: new Date().toISOString(),
      paid_at: new Date().toISOString(),
      customer: {
        name: 'Cliente Teste',
        email: 'cliente@teste.com'
      }
    }
  },
  {
    type: 'withdraw.done',
    data: {
      id: 'withdraw_123456789',
      status: 'completed',
      amount: 5000, // R$ 50,00
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      destination: {
        bank_code: '260',
        agency: '0001',
        account: '12345678',
        account_type: 'checking',
        document: '12345678901'
      }
    }
  },
  {
    type: 'withdraw.failed',
    data: {
      id: 'withdraw_987654321',
      status: 'failed',
      amount: 3000, // R$ 30,00
      created_at: new Date().toISOString(),
      failed_at: new Date().toISOString(),
      reason: 'invalid_account',
      destination: {
        bank_code: '260',
        agency: '0001',
        account: '87654321',
        account_type: 'checking',
        document: '10987654321'
      }
    }
  }
];

// Função para gerar assinatura HMAC
function generateSignature(payload, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

// Função para enviar evento para o webhook
async function sendWebhookEvent(event) {
  try {
    const payload = JSON.stringify(event);
    const signature = generateSignature(payload, WEBHOOK_SECRET);
    
    console.log(`\n🚀 Enviando evento: ${event.type}`);
    console.log('📦 Payload:', JSON.stringify(event, null, 2));
    
    const response = await axios.post(WEBHOOK_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
        'x-abacatepay-signature': signature
      }
    });
    
    console.log(`✅ Resposta (${response.status}):`, response.data);
    return true;
  } catch (error) {
    console.error('❌ Erro ao enviar evento:', error.message);
    if (error.response) {
      console.error('Detalhes:', error.response.data);
    }
    return false;
  }
}

// Função principal para testar todos os eventos
async function testAllEvents() {
  console.log('🧪 Iniciando testes do webhook AbacatePay...');
  
  for (const event of eventExamples) {
    await sendWebhookEvent(event);
    // Aguardar 1 segundo entre os envios
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n🏁 Testes concluídos!');
}

// Executar os testes
testAllEvents();