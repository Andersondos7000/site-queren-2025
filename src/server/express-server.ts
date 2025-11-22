/**
 * Servidor Express.js para AbacatePay
 * 
 * Este arquivo demonstra como configurar um servidor backend completo
 * para integração com AbacatePay, incluindo endpoints de API e webhook.
 * 
 * Para usar em produção:
 * 1. npm install express cors helmet dotenv
 * 2. npm install -D @types/express @types/cors
 * 3. Configure as variáveis de ambiente
 * 4. Execute: npx ts-node src/server/express-server.ts
 */

// Configurar dotenv para carregar variáveis de ambiente
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Obter __dirname em ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carrega .env.backend da raiz do projeto (dois níveis acima)
dotenv.config({ path: path.join(__dirname, '../../.env.backend') });

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { webhookAbacatePayMiddleware } from '../api/webhook-endpoint';
import { criarCobrancaAbacatePay, consultarCobrancaAbacatePay } from '../api/abacatepay';
import type { PedidoAbacatePay } from '../api/abacatepay';
import { startEmailOutboxWorker } from '../workers/emailOutboxWorker'

const app = express();
const PORT = process.env.PORT || 3001;

// Middlewares de segurança
app.use(helmet());
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://localhost:8082',
    'http://localhost:3000'
  ],
  credentials: true
}));

// Middleware para capturar raw body para webhooks
app.use('/api/webhook/abacatepay', (req, res, next) => {
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

// Middleware para parsing JSON (padrão) - deve vir depois do webhook
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'AbacatePay Backend'
  });
});

// Endpoint para criar cobrança PIX
app.post('/api/abacatepay/criar-cobranca', async (req, res) => {
  try {
    console.log('📝 Criando cobrança AbacatePay:', {
      valor: req.body.valor,
      cliente: req.body.cliente?.nome,
      items: req.body.items?.length
    });

    const pedido: PedidoAbacatePay = req.body;
    const resultado = await criarCobrancaAbacatePay(pedido);

    if (resultado.success) {
      console.log('✅ Cobrança criada com sucesso:', resultado.data?.id);
      res.json(resultado.data);
    } else {
      console.error('❌ Erro ao criar cobrança:', resultado.error);
      res.status(400).json(resultado.error);
    }

  } catch (error) {
    console.error('❌ Erro interno ao criar cobrança:', error);
    res.status(500).json({ 
      message: 'Erro interno do servidor',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// Endpoint para consultar cobrança
app.get('/api/abacatepay/consultar-cobranca/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🔍 Consultando cobrança:', id);

    const resultado = await consultarCobrancaAbacatePay(id);

    if (resultado.success) {
      console.log('✅ Cobrança consultada:', resultado.data?.status);
      res.json(resultado.data);
    } else {
      console.error('❌ Erro ao consultar cobrança:', resultado.error);
      res.status(400).json(resultado.error);
    }

  } catch (error) {
    console.error('❌ Erro interno ao consultar cobrança:', error);
    res.status(500).json({ 
      message: 'Erro interno do servidor',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// Endpoint para simular pagamento via MCP AbacatePay
app.post('/api/mcp/abacatepay/simulate-payment', async (req, res) => {
  try {
    const { id, paymentId, apiKey } = req.body;
    const billingId = id || paymentId;
    
    console.log('🧪 Simulando pagamento via MCP AbacatePay para ID:', billingId);

    if (!billingId) {
      return res.status(400).json({
        success: false,
        error: 'ID da cobrança é obrigatório'
      });
    }

    // Simular resposta de pagamento bem-sucedido
    const simulationResponse = {
      success: true,
      status: 'PAID',
      data: {
        id: billingId,
        status: 'PAID',
        amount: 2500, // Valor simulado
        paid_at: new Date().toISOString(),
        payment_method: 'PIX',
        simulation: true
      },
      message: 'Pagamento simulado com sucesso via MCP AbacatePay'
    };

    console.log('✅ Simulação de pagamento realizada:', simulationResponse);
    res.json(simulationResponse);

  } catch (error) {
    console.error('❌ Erro ao simular pagamento via MCP:', error);
    res.status(500).json({ 
      success: false,
      error: 'Erro interno do servidor',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// Endpoint para comunicação com MCP AbacatePay
app.post('/api/abacatepay/list-billings', async (req, res) => {
  try {
    console.log('📋 Listando cobranças via MCP AbacatePay');

    // Simular comunicação com MCP (em produção, seria uma chamada real ao MCP)
    // Por enquanto, vamos retornar dados simulados que seguem a estrutura do MCP
    const mockMCPResponse = {
      billings: [
        {
          id: '01JJA8WNQHQHQHQHQHQHQHQHQE',
          status: 'PAID',
          amount: 2500,
          url: 'https://pay.abacatepay.com/01JJA8WNQHQHQHQHQHQHQHQHQE',
          products: [
            {
              externalId: 'prod-001',
              name: 'Camiseta Premium',
              description: 'Camiseta de algodão premium',
              quantity: 1,
              price: 2500
            }
          ],
          customer: {
            metadata: {
              name: 'João Silva',
              email: 'joao.silva@email.com',
              cellphone: '(11) 99999-8888',
              taxId: '123.456.789-01'
            }
          },
          frequency: 'ONE_TIME',
          methods: ['PIX'],
          devMode: true,
          created_at: '2025-01-14T14:15:00Z',
          updated_at: '2025-01-14T14:20:00Z'
        },
        {
          id: '01JJA8WNQHQHQHQHQHQHQHQHQF',
          status: 'PAID',
          amount: 5000,
          url: 'https://pay.abacatepay.com/01JJA8WNQHQHQHQHQHQHQHQHQF',
          products: [
            {
              externalId: 'prod-002',
              name: 'Kit Completo',
              description: 'Kit com 2 camisetas',
              quantity: 2,
              price: 2500
            }
          ],
          customer: {
            metadata: {
              name: 'Maria Santos',
              email: 'maria.santos@email.com',
              cellphone: '(11) 88888-7777',
              taxId: '987.654.321-00'
            }
          },
          frequency: 'ONE_TIME',
          methods: ['PIX'],
          devMode: true,
          created_at: '2025-01-14T15:20:00Z',
          updated_at: '2025-01-14T15:25:00Z'
        },
        {
          id: '01JJA8WNQHQHQHQHQHQHQHQHQG',
          status: 'PAID',
          amount: 7500,
          url: 'https://pay.abacatepay.com/01JJA8WNQHQHQHQHQHQHQHQHQG',
          products: [
            {
              externalId: 'prod-003',
              name: 'Produto Premium',
              description: 'Produto de alta qualidade',
              quantity: 3,
              price: 2500
            }
          ],
          customer: {
            metadata: {
              name: 'Carlos Oliveira',
              email: 'carlos.oliveira@email.com',
              cellphone: '(11) 77777-6666',
              taxId: '111.222.333-44'
            }
          },
          frequency: 'ONE_TIME',
          methods: ['PIX'],
          devMode: true,
          created_at: '2025-01-14T16:45:00Z',
          updated_at: '2025-01-14T16:50:00Z'
        },
        {
          id: '01JJA8WNQHQHQHQHQHQHQHQHQH',
          status: 'PENDING',
          amount: 3000,
          url: 'https://pay.abacatepay.com/01JJA8WNQHQHQHQHQHQHQHQHQH',
          products: [
            {
              externalId: 'prod-004',
              name: 'Produto Deluxe',
              description: 'Produto deluxe com todos os recursos',
              quantity: 1,
              price: 3000
            }
          ],
          customer: {
            metadata: {
              name: 'Ana Costa',
              email: 'ana.costa@email.com',
              cellphone: '(11) 66666-5555',
              taxId: '456.789.123-45'
            }
          },
          frequency: 'ONE_TIME',
          methods: ['PIX'],
          devMode: true,
          created_at: '2025-01-14T17:15:00Z'
        }
      ]
    };

    console.log('✅ Cobranças listadas via MCP:', mockMCPResponse.billings.length);
    res.json(mockMCPResponse);

  } catch (error) {
    console.error('❌ Erro ao listar cobranças via MCP:', error);
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// Webhook endpoint
app.post('/api/webhook/abacatepay', webhookAbacatePayMiddleware);

// Webhook Resend: recebe eventos de envio/entrega/erro
app.post('/api/webhook/resend', async (req, res) => {
  try {
    const event = req.body as any
    console.log('📬 Webhook Resend recebido:', {
      type: event?.type,
      created_at: event?.created_at,
      data_summary: event?.data ? Object.keys(event.data) : []
    })
    res.status(200).json({ ok: true })
  } catch (e: any) {
    console.error('Erro no webhook Resend:', e?.message || String(e))
    res.status(500).json({ error: 'internal_error' })
  }
});

// Endpoint para testar conectividade
app.get('/api/abacatepay/test', async (req, res) => {
  try {
    // Teste simples de conectividade
    const testData: PedidoAbacatePay = {
      valor: 100, // R$ 1,00 para teste (mínimo 100 centavos)
      descricao: 'Teste de conectividade AbacatePay',
      cliente: {
        nome: 'Teste Cliente',
        email: 'teste@exemplo.com',
        cpf: '11144477735'
      },
      items: [{
        nome: 'Item de Teste',
        quantidade: 1,
        preco: 0.01
      }],
      external_id: `test_${Date.now()}`
    };

    const resultado = await criarCobrancaAbacatePay(testData);
    
    if (resultado.success) {
      res.json({
        status: 'OK',
        message: 'Conectividade com AbacatePay funcionando',
        test_charge_id: resultado.data?.id
      });
    } else {
      res.status(400).json({
        status: 'ERROR',
        message: 'Falha na conectividade com AbacatePay',
        error: resultado.error
      });
    }

  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      message: 'Erro ao testar conectividade',
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// Middleware de tratamento de erros
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('❌ Erro não tratado:', err);
  
  res.status(500).json({
    message: 'Erro interno do servidor',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Erro interno'
  });
});

// Middleware para rotas não encontradas
app.use((req, res) => {
  res.status(404).json({
    erro: 'Rota não encontrada',
    path: req.path
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log('🚀 Servidor AbacatePay iniciado!');
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`🔗 Health Check: http://localhost:${PORT}/health`);
  console.log(`💰 Criar Cobrança: POST http://localhost:${PORT}/api/abacatepay/criar-cobranca`);
  console.log(`🔍 Consultar Cobrança: GET http://localhost:${PORT}/api/abacatepay/consultar-cobranca/:id`);
  console.log(`📨 Webhook: POST http://localhost:${PORT}/api/webhook/abacatepay`);
  console.log(`📨 Webhook Resend: POST http://localhost:${PORT}/api/webhook/resend`);
  console.log(`🧪 Teste: GET http://localhost:${PORT}/api/abacatepay/test`);
  console.log('');
  console.log('⚠️  IMPORTANTE: Configure as variáveis de ambiente:');
  console.log('   - ABACATEPAY_API_KEY=sk_test_...');
  console.log('   - ABACATEPAY_WEBHOOK_SECRET=webh_dev_...');
  console.log('   - FRONTEND_URL=http://localhost:5173');
  startEmailOutboxWorker()
});

export default app;