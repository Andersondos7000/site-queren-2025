/**
 * Endpoint de Webhook para AbacatePay
 * 
 * ⚠️ IMPORTANTE: Este arquivo deve ser usado no BACKEND (Express.js, Fastify, etc.)
 * Nunca execute webhooks no frontend por questões de segurança!
 */

import { Request, Response } from 'express';
import { getAbacatePayService } from '../services/abacatePayService';
import { supabase } from '../lib/supabase';

/**
 * Interface para dados do webhook AbacatePay
 */
export interface WebhookAbacatePayData {
  event: string;
  data: {
    id: string;
    status: string;
    amount: number;
    description: string;
    customer: {
      name: string;
      email: string;
      cpf: string;
    };
    pix?: {
      qr_code: string;
      qr_code_url: string;
      expires_at: string;
    };
    created_at: string;
    updated_at: string;
    external_id?: string;
  };
}

/**
 * Processa webhook da AbacatePay
 * 
 * POST /api/webhook/abacatepay
 */
export async function processarWebhookAbacatePay(req: Request, res: Response) {
  try {
    // Obter assinatura do header
  const signature = req.headers['x-webhook-signature'] as string;
    
    console.log('🔍 Debug webhook recebido:');
    console.log('   Headers:', req.headers);
    console.log('   Body type:', typeof req.body);
    console.log('   Body:', req.body);
    console.log('   RawBody type:', typeof (req as any).rawBody);
    console.log('   RawBody:', (req as any).rawBody);
    
    if (!signature) {
      console.error('❌ Webhook rejeitado: Assinatura ausente');
      return res.status(401).json({ 
        error: 'Assinatura do webhook ausente' 
      });
    }

    // Obter payload bruto - req.rawBody deve ser usado para webhooks
    // Se não tiver rawBody, usar o body atual (já é objeto)
    const payload = (req as any).rawBody || req.body;
    
    console.log('🔍 Payload que será usado para validação:', payload);
    console.log('🔍 Tipo do payload:', typeof payload);
    console.log('🔍 Signature recebida:', signature);
    
    // Validar assinatura usando o serviço
    const abacatePayService = getAbacatePayService();
    console.log('🔍 Chamando validarWebhook...');
    const isValid = abacatePayService.validarWebhook(payload, signature);
    console.log('🔍 Resultado da validação:', isValid);
    
    if (!isValid) {
      console.error('❌ Webhook rejeitado: Assinatura inválida');
      return res.status(401).json({ 
        error: 'Assinatura do webhook inválida' 
      });
    }

    // Parse dos dados do webhook
    const webhookData: WebhookAbacatePayData = req.body;
    
    console.log('✅ Webhook AbacatePay recebido:', {
      event: webhookData.event,
      cobrancaId: webhookData.data.id,
      status: webhookData.data.status,
      amount: webhookData.data.amount
    });

    // Processar diferentes tipos de eventos
    switch (webhookData.event) {
      case 'billing.paid':
        await processarPagamentoConfirmado(webhookData.data);
        break;
        
      case 'billing.expired':
        await processarPagamentoExpirado(webhookData.data);
        break;
        
      case 'billing.cancelled':
        await processarPagamentoCancelado(webhookData.data);
        break;
        
      default:
        console.log(`ℹ️ Evento não processado: ${webhookData.event}`);
    }

    // Responder com sucesso
    res.status(200).json({ 
      message: 'Webhook processado com sucesso',
      event: webhookData.event,
      cobrancaId: webhookData.data.id
    });

  } catch (error) {
    console.error('❌ Erro ao processar webhook AbacatePay:', error);
    
    res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}

/**
 * Processa pagamento confirmado
 */
async function processarPagamentoConfirmado(dados: WebhookAbacatePayData['data']) {
  try {
    console.log('💰 Pagamento confirmado:', {
      id: dados.id,
      amount: dados.amount,
      customer: dados.customer.name,
      external_id: dados.external_id
    });

    // Verificar se já existe um pedido com este payment_id
    const { data: existingOrder, error: checkError } = await supabase
      .from('orders')
      .select('id, status')
      .eq('payment_id', dados.id)
      .single();
    
    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('❌ Erro ao verificar pedido existente:', checkError);
      throw checkError;
    }
    
    if (existingOrder) {
      console.log('📋 Pedido já existe, atualizando status:', existingOrder.id);
      
      // Atualizar pedido existente
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          status: 'paid',
          payment_status: 'paid',
          customer_data: {
            ...existingOrder.customer_data,
            payment_data: dados
          },
          updated_at: new Date().toISOString()
        })
        .eq('payment_id', dados.id);
      
      if (updateError) {
        console.error('❌ Erro ao atualizar pedido:', updateError);
        throw updateError;
      }
      
      console.log('✅ Pedido atualizado com sucesso:', existingOrder.id);
    } else {
      console.log('📝 Criando novo pedido para payment_id:', dados.id);
      
      // Criar novo pedido
      const orderData = {
        payment_id: dados.id,
        payment_method: 'pix',
        payment_status: 'paid',
        status: 'paid',
        total: dados.amount, // ✅ CORREÇÃO: Manter em centavos (padrão do sistema)
        total_amount: dados.amount, // ✅ CORREÇÃO: Manter em centavos (padrão do sistema)
        customer_data: {
          name: dados.customer?.name || 'Cliente AbacatePay',
          email: dados.customer?.email || null,
          cpf: dados.customer?.cpf || null,
          payment_data: dados // Movendo payment_data para dentro de customer_data
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        idempotency_key: dados.id
      };
      
      const { data: newOrder, error: insertError } = await supabase
        .from('orders')
        .insert(orderData)
        .select()
        .single();
      
      if (insertError) {
        console.error('❌ Erro ao criar pedido:', insertError);
        throw insertError;
      }
      
      console.log('✅ Novo pedido criado com sucesso:', newOrder.id);
    }
    
    // Registrar evento do webhook
    const { error: webhookError } = await supabase
      .from('webhook_events')
      .insert({
        event_id: dados.id,
        event_type: 'billing.paid',
        provider: 'abacatepay',
        charge_id: dados.id,
        payload: dados,
        processed_at: new Date().toISOString()
      });
    
    if (webhookError) {
      console.error('⚠️ Erro ao registrar evento do webhook (não crítico):', webhookError);
    }
    
    console.log('🎉 Processamento do pagamento concluído com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro ao processar pagamento confirmado:', error);
    throw error;
  }
}

/**
 * Processa pagamento expirado
 */
async function processarPagamentoExpirado(dados: WebhookAbacatePayData['data']) {
  try {
    console.log('⏰ Pagamento expirado:', {
      id: dados.id,
      external_id: dados.external_id
    });

    // TODO: Implementar lógica específica do seu sistema
    // Exemplos:
    
    // 1. Atualizar status do pedido
    // await updateOrderStatus(dados.external_id, 'expired');
    
    // 2. Liberar itens do carrinho/estoque
    // await releaseCartItems(dados.external_id);
    
    // 3. Enviar email de expiração
    // await sendExpirationEmail(dados.customer.email, dados);

    console.log('✅ Expiração processada:', dados.id);
    
  } catch (error) {
    console.error('❌ Erro ao processar pagamento expirado:', error);
    throw error;
  }
}

/**
 * Processa pagamento cancelado
 */
async function processarPagamentoCancelado(dados: WebhookAbacatePayData['data']) {
  try {
    console.log('❌ Pagamento cancelado:', {
      id: dados.id,
      external_id: dados.external_id
    });

    // TODO: Implementar lógica específica do seu sistema
    // Exemplos:
    
    // 1. Atualizar status do pedido
    // await updateOrderStatus(dados.external_id, 'cancelled');
    
    // 2. Liberar itens do carrinho/estoque
    // await releaseCartItems(dados.external_id);

    console.log('✅ Cancelamento processado:', dados.id);
    
  } catch (error) {
    console.error('❌ Erro ao processar pagamento cancelado:', error);
    throw error;
  }
}

/**
 * Middleware para Express.js
 * 
 * Exemplo de uso:
 * 
 * ```typescript
 * import express from 'express';
 * import { webhookAbacatePayMiddleware } from './api/webhook-endpoint';
 * 
 * const app = express();
 * 
 * // Importante: usar raw middleware para webhooks
 * app.use('/api/webhook/abacatepay', express.raw({ type: 'application/json' }));
 * app.post('/api/webhook/abacatepay', webhookAbacatePayMiddleware);
 * ```
 */
export const webhookAbacatePayMiddleware = (req: Request, res: Response) => {
  // Converter raw buffer para JSON se necessário
  if (Buffer.isBuffer(req.body)) {
    try {
      req.body = JSON.parse(req.body.toString());
    } catch (error) {
      return res.status(400).json({ 
        error: 'Payload JSON inválido' 
      });
    }
  }
  
  return processarWebhookAbacatePay(req, res);
};

/**
 * Exemplo de configuração completa para Express.js
 */
export const exemploExpressCompleto = `
// server.js ou app.js
import express from 'express';
import { webhookAbacatePayMiddleware } from './src/api/webhook-endpoint';

const app = express();

// Middleware padrão para outras rotas
app.use(express.json());

// Middleware específico para webhook (raw body)
app.use('/api/webhook/abacatepay', express.raw({ type: 'application/json' }));

// Endpoint do webhook
app.post('/api/webhook/abacatepay', webhookAbacatePayMiddleware);

// Outras rotas...
app.use('/api', otherRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(\`🚀 Servidor rodando na porta \${PORT}\`);
  console.log(\`📡 Webhook AbacatePay: http://localhost:\${PORT}/api/webhook/abacatepay\`);
});
`;

/**
 * Exemplo de configuração para Next.js API Routes
 */
export const exemploNextJS = `
// pages/api/webhook/abacatepay.ts ou app/api/webhook/abacatepay/route.ts
// import { NextApiRequest, NextApiResponse } from 'next';
import { processarWebhookAbacatePay } from '../../../src/api/webhook-endpoint';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }
  
  return processarWebhookAbacatePay(req as any, res as any);
}

// Para Next.js 13+ (App Router)
export async function POST(request: Request) {
  const body = await request.json();
  const signature = request.headers.get('x-abacate-signature');
  
  // Simular req/res do Express
  const req = { body, headers: { 'x-abacate-signature': signature } };
  const res = {
    status: (code: number) => ({
      json: (data: any) => new Response(JSON.stringify(data), { status: code })
    })
  };
  
  return processarWebhookAbacatePay(req as any, res as any);
}
`;