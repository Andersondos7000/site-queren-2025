/**
 * Servidor para receber webhooks do AbacatePay na página de administração
 * 
 * Este servidor roda em paralelo ao Vite e processa webhooks do AbacatePay
 * especificamente para a página /admin/pedidos
 */

import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';

// Carregar variáveis de ambiente ANTES de importar outros módulos
dotenv.config({ path: '.env.webhook' });
dotenv.config(); // Fallback para .env padrão

// Verificar se as variáveis foram carregadas
console.log('🔧 Verificando variáveis de ambiente:');
console.log('   - VITE_SUPABASE_URL:', !!process.env.VITE_SUPABASE_URL);
console.log('   - SUPABASE_SERVICE_ROLE_KEY:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
console.log('   - WEBHOOK_PORT:', process.env.WEBHOOK_PORT || '8083');

// Importar módulos que dependem das variáveis de ambiente
import { webhookAdminMiddleware, testarWebhookAdmin } from '../api/webhook-admin-endpoint';

const app = express();
const PORT = process.env.WEBHOOK_PORT || 8083;

// Configurar CORS para permitir requisições do frontend
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

// Middleware para capturar raw body (necessário para validação de assinatura)
app.use('/admin/pedidos/webhook', (req, res, next) => {
  let rawBody = '';
  req.on('data', chunk => {
    rawBody += chunk.toString();
  });
  req.on('end', () => {
    (req as any).rawBody = rawBody;
    try {
      req.body = JSON.parse(rawBody);
    } catch (e) {
      req.body = {};
    }
    next();
  });
});

// Middleware padrão para outras rotas
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'Admin Webhook Server',
    port: PORT
  });
});

// Endpoint principal para webhooks do AbacatePay
app.post('/admin/pedidos/webhook', async (req, res) => {
  console.log('📨 Webhook recebido em /admin/pedidos/webhook');
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  
  try {
    await webhookAdminMiddleware(req, res);
  } catch (error) {
    console.error('💥 Erro no processamento do webhook:', error);
    res.status(500).json({
      error: 'Erro interno do servidor',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// Endpoint para testar o webhook localmente
app.post('/admin/pedidos/webhook/test', async (req, res) => {
  console.log('🧪 Executando teste do webhook...');
  
  try {
    const resultado = await testarWebhookAdmin();
    res.json({
      success: true,
      message: 'Teste executado com sucesso',
      data: resultado
    });
  } catch (error) {
    console.error('❌ Erro no teste:', error);
    res.status(500).json({
      error: 'Erro no teste',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// Endpoint para listar pedidos recentes (para debug)
app.get('/admin/pedidos/recent', async (req, res) => {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Variáveis de ambiente do Supabase não configuradas');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (*)
      `)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) {
      throw error;
    }
    
    res.json({
      success: true,
      orders: orders || []
    });
    
  } catch (error) {
    console.error('❌ Erro ao buscar pedidos:', error);
    res.status(500).json({
      error: 'Erro ao buscar pedidos',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// Middleware para rotas não encontradas
app.use((req, res) => {
  res.status(404).json({
    error: 'Rota não encontrada',
    path: req.path,
    availableRoutes: [
      'GET /health',
      'POST /admin/pedidos/webhook',
      'POST /admin/pedidos/webhook/test',
      'GET /admin/pedidos/recent'
    ]
  });
});

// Middleware para tratamento de erros
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('❌ Erro não tratado:', err);
  
  res.status(500).json({
    error: 'Erro interno do servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Erro interno'
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
  console.log('🔧 Variáveis de ambiente necessárias:');
  console.log('   - VITE_SUPABASE_URL');
  console.log('   - SUPABASE_SERVICE_ROLE_KEY');
  console.log('   - ABACATEPAY_WEBHOOK_SECRET (opcional)');
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

export default app;