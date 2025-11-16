/**
 * Servidor standalone para receber webhooks do AbacatePay
 * 
 * Este servidor carrega as variáveis de ambiente diretamente e
 * processa webhooks do AbacatePay para a página /admin/pedidos
 */

import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';

// Carregar variáveis de ambiente
dotenv.config({ path: '.env.webhook' });
dotenv.config(); // Fallback para .env padrão

const app = express();
const PORT = process.env.WEBHOOK_PORT || 8083;

// Configuração do Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('🔧 Verificando variáveis de ambiente:');
console.log('   - VITE_SUPABASE_URL:', !!supabaseUrl);
console.log('   - SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
console.log('   - WEBHOOK_PORT:', PORT);

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente do Supabase não configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Interfaces
interface WebhookAbacatePay {
  event: string;
  data: {
    id: string;
    status: string;
    amount: number;
    currency: string;
    customer: {
      name: string;
      email: string;
      phone?: string;
    };
    metadata?: Record<string, any>;
    created_at: string;
    updated_at: string;
  };
}

interface OrderData {
  id: string;
  customer_id?: string;
  total_amount: number;
  status: string;
  payment_method: string;
  payment_status: string;
  external_id: string;
}

// Configurar CORS
app.use(cors({
  origin: [
    'http://localhost:8082',
    'http://localhost:5173',
    'https://recebimento-webh-dev-abacatepay.ultrahook.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-abacate-signature']
}));

// Middleware para capturar raw body para validação de assinatura
app.use('/admin/pedidos/webhook', (req, res, next) => {
  console.log('🔧 Middleware de raw body executado para:', req.path);
  let data = '';
  req.setEncoding('utf8');
  req.on('data', (chunk) => {
    data += chunk;
  });
  req.on('end', () => {
    console.log('📥 Raw body capturado:', data);
    (req as any).rawBody = data;
    // Parse do JSON manualmente para o req.body
    try {
      req.body = JSON.parse(data);
      console.log('✅ JSON parseado com sucesso:', req.body);
    } catch (error) {
      console.error('❌ Erro ao fazer parse do JSON:', error);
      req.body = {};
    }
    next();
  });
});

// Middleware para JSON (apenas para outras rotas)
app.use((req, res, next) => {
  if (req.path.startsWith('/admin/pedidos/webhook')) {
    return next(); // Pular o express.json() para webhooks
  }
  express.json()(req, res, next);
});

// Função para processar webhook
async function processarWebhook(webhookData: WebhookAbacatePay) {
  console.log('📨 Processando webhook:', webhookData.event);
  
  if (webhookData.event === 'billing.paid') {
    console.log('💰 Processando pagamento aprovado...');
    
    const orderData: OrderData = {
      id: crypto.randomUUID(), // Gerar UUID válido para o ID
      total_amount: webhookData.data.amount,
      status: webhookData.data.status === 'paid' ? 'confirmed' : 'pending',
      payment_method: 'pix',
      payment_status: webhookData.data.status,
      external_id: webhookData.data.id // Usar o ID do AbacatePay como external_id
    };

    try {
      console.log('🔍 Verificando se pedido já existe...');
      const { data: existingOrder, error: selectError } = await supabase
        .from('orders')
        .select('*')
        .eq('external_id', orderData.external_id)
        .single();

      console.log('📊 Resultado da consulta:', { existingOrder, selectError });

      if (selectError && selectError.code !== 'PGRST116') {
        console.error('❌ Erro na consulta:', selectError);
        throw selectError;
      }

      if (existingOrder) {
        console.log('🔄 Atualizando pedido existente...');
        // Atualizar pedido existente
        const { error: updateError } = await supabase
          .from('orders')
          .update({
            status: orderData.status,
            total_amount: orderData.total_amount,
            payment_status: orderData.payment_status,
            updated_at: new Date().toISOString()
          })
          .eq('external_id', orderData.external_id);

        if (updateError) {
          console.error('❌ Erro ao atualizar:', updateError);
          throw updateError;
        }
        console.log('✅ Pedido atualizado:', orderData.external_id);
      } else {
        console.log('➕ Criando novo pedido...');
        // Criar novo pedido
        const { error: insertError } = await supabase
          .from('orders')
          .insert([{
            ...orderData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }]);

        if (insertError) {
          console.error('❌ Erro ao inserir:', insertError);
          throw insertError;
        }
        console.log('✅ Novo pedido criado:', orderData.abacatepay_id);
      }

      return { success: true, orderId: orderData.id };
    } catch (error) {
      console.error('❌ Erro ao processar pedido:', error);
      throw error;
    }
  } else {
    console.log('ℹ️ Evento ignorado:', webhookData.event);
    return { success: true, message: 'Evento ignorado' };
  }
}

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'webhook-admin-server'
  });
});

// Endpoint principal do webhook
app.post('/admin/pedidos/webhook', async (req, res) => {
  try {
    console.log('📨 Webhook recebido - Headers:', req.headers);
    console.log('📨 Webhook recebido - Body:', req.body);
    console.log('📨 Webhook recebido - Raw Body:', (req as any).rawBody);
    
    // Verificar se temos dados válidos
    if (!req.body || typeof req.body !== 'object') {
      console.error('❌ Body do webhook inválido:', req.body);
      return res.status(400).json({
        success: false,
        message: 'Body do webhook inválido'
      });
    }

    // Verificar se tem a propriedade event
    if (!req.body.event) {
      console.error('❌ Propriedade event não encontrada no webhook:', req.body);
      return res.status(400).json({
        success: false,
        message: 'Propriedade event não encontrada no webhook'
      });
    }
    
    const result = await processarWebhook(req.body);
    
    res.json({
      success: true,
      message: 'Webhook processado com sucesso',
      data: result
    });
  } catch (error) {
    console.error('❌ Erro no webhook:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao processar webhook',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// Endpoint de teste
app.post('/admin/pedidos/webhook/test', async (req, res) => {
  const testWebhook: WebhookAbacatePay = {
    event: 'billing.paid',
    data: {
      id: `test-${Date.now()}`,
      status: 'paid',
      amount: 2500, // R$ 25,00 em centavos
      currency: 'BRL',
      customer: {
        name: 'Cliente Teste',
        email: 'teste@exemplo.com',
        phone: '11999999999'
      },
      metadata: {
        test: true,
        source: 'webhook-test'
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  };

  try {
    const result = await processarWebhook(testWebhook);
    res.json({
      success: true,
      message: 'Teste de webhook executado com sucesso',
      testData: testWebhook,
      result
    });
  } catch (error) {
    console.error('❌ Erro no teste:', error);
    res.status(500).json({
      success: false,
      message: 'Erro no teste de webhook',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// Endpoint para listar pedidos recentes
app.get('/admin/pedidos/recent', async (req, res) => {
  try {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;

    res.json({
      success: true,
      orders: orders || []
    });
  } catch (error) {
    console.error('❌ Erro ao buscar pedidos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar pedidos',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint não encontrado',
    availableEndpoints: [
      'GET /health',
      'POST /admin/pedidos/webhook',
      'POST /admin/pedidos/webhook/test',
      'GET /admin/pedidos/recent'
    ]
  });
});

// Iniciar servidor
const server = app.listen(PORT, () => {
  console.log('🚀 Servidor de Webhook Admin iniciado!');
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`🔗 Health Check: http://localhost:${PORT}/health`);
  console.log(`📨 Webhook AbacatePay: http://localhost:${PORT}/admin/pedidos/webhook`);
  console.log(`🧪 Teste Webhook: http://localhost:${PORT}/admin/pedidos/webhook/test`);
  console.log(`📋 Pedidos Recentes: http://localhost:${PORT}/admin/pedidos/recent`);
  console.log('');
  console.log('⚠️  IMPORTANTE: Configure o UltraHook para apontar para:');
  console.log(`   http://localhost:${PORT}/admin/pedidos/webhook`);
  console.log('');
  console.log('🔄 Servidor mantido em execução... (Ctrl+C para parar)');
});

// Tratamento de erros
process.on('uncaughtException', (error) => {
  console.error('❌ Erro não capturado:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promise rejeitada não tratada:', reason);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Recebido SIGTERM, encerrando servidor...');
  server.close(() => {
    console.log('✅ Servidor encerrado com sucesso');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 Recebido SIGINT, encerrando servidor...');
  server.close(() => {
    console.log('✅ Servidor encerrado com sucesso');
    process.exit(0);
  });
});

// Manter o processo vivo
setInterval(() => {
  // Heartbeat silencioso a cada 30 segundos
}, 30000);