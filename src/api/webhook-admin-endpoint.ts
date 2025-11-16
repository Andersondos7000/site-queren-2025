/**
 * Endpoint para receber webhooks do AbacatePay na página de administração
 * 
 * Este módulo processa webhooks do AbacatePay e cria/atualiza pedidos
 * no banco de dados Supabase para exibição na página /admin/pedidos
 */

import { createClient } from '@supabase/supabase-js';
import type { Request, Response } from 'express';
import { criarTicketsIndividuaisAposConfirmacao } from '../utils/criarTicketsIndividuais';
import { criarTicketsIndividuaisAposConfirmacao as criarTicketsV2 } from '../utils/criarTicketsIndividuaisV2';

// Configuração do Supabase usando variáveis de ambiente do Node.js
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente do Supabase não configuradas:');
  console.error('   - VITE_SUPABASE_URL:', !!supabaseUrl);
  console.error('   - SUPABASE_SERVICE_ROLE_KEY:', !!supabaseServiceKey);
  throw new Error('Configuração do Supabase incompleta');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Interface para dados do webhook AbacatePay
export interface AbacatePayWebhookData {
  event: string;
  data: {
    id: string;
    status: string;
    amount: number;
    url: string;
    products: Array<{
      externalId: string;
      name: string;
      description?: string;
      quantity: number;
      price: number;
    }>;
    customer: {
      metadata: {
        name: string;
        email: string;
        cellphone?: string;
        taxId?: string;
      };
    };
    frequency: string;
    methods: string[];
    devMode: boolean;
    created_at: string;
    updated_at: string;
  };
}

// Interface para pedido no banco de dados
interface OrderData {
  id?: string;
  customer_email: string;
  customer_name: string;
  customer_phone?: string;
  customer_tax_id?: string;
  total_amount: number;
  status: string;
  payment_method: string;
  payment_id: string;
  payment_status: string;
  abacatepay_id: string;
  webhook_data: any;
  created_at?: string;
  updated_at?: string;
}

/**
 * Processa webhook do AbacatePay e cria/atualiza pedido
 */
export async function processarWebhookAdmin(webhookData: AbacatePayWebhookData) {
  console.log('🎯 Processando webhook na página de administração:', {
    event: webhookData.event,
    billingId: webhookData.data.id,
    status: webhookData.data.status,
    amount: webhookData.data.amount
  });

  try {
    // Verificar se é um evento de pagamento
    if (webhookData.event !== 'billing.paid') {
      console.log('⚠️ Evento não é billing.paid, ignorando:', webhookData.event);
      return { success: true, message: 'Evento ignorado' };
    }

    const { data: billing } = webhookData;

    // Verificar se o pedido já existe
    const { data: existingOrder, error: searchError } = await supabase
      .from('orders')
      .select('*')
      .eq('abacatepay_id', billing.id)
      .single();

    if (searchError && searchError.code !== 'PGRST116') {
      console.error('❌ Erro ao buscar pedido existente:', searchError);
      throw searchError;
    }

    // Preparar dados do pedido
    const orderData: OrderData = {
      customer_email: billing.customer.metadata.email,
      customer_name: billing.customer.metadata.name,
      customer_phone: billing.customer.metadata.cellphone,
      customer_tax_id: billing.customer.metadata.taxId,
      total_amount: billing.amount, // AbacatePay já envia em centavos
      status: 'confirmed',
      payment_method: billing.methods[0] || 'PIX',
      payment_id: billing.id,
      payment_status: 'paid',
      abacatepay_id: billing.id,
      webhook_data: webhookData,
      updated_at: new Date().toISOString()
    };

    let result;

    if (existingOrder) {
      // Atualizar pedido existente
      console.log('🔄 Atualizando pedido existente:', existingOrder.id);
      
      const { data, error } = await supabase
        .from('orders')
        .update(orderData)
        .eq('id', existingOrder.id)
        .select()
        .single();

      if (error) {
        console.error('❌ Erro ao atualizar pedido:', error);
        throw error;
      }

      result = { success: true, action: 'updated', order: data };
    } else {
      // Criar novo pedido
      console.log('➕ Criando novo pedido');
      
      orderData.created_at = new Date().toISOString();
      
      const { data, error } = await supabase
        .from('orders')
        .insert(orderData)
        .select()
        .single();

      if (error) {
        console.error('❌ Erro ao criar pedido:', error);
        throw error;
      }

      result = { success: true, action: 'created', order: data };
    }

    // Criar itens do pedido se não existirem
    if (billing.products && billing.products.length > 0) {
      await processarItensDosPedidos(result.order.id, billing.products);
    }

    // 🎫 CRIAR TICKETS AUTOMATICAMENTE APÓS CONFIRMAÇÃO DO PAGAMENTO
    try {
      // ✅ Sistema V2 Atômico - ATIVO POR PADRÃO
      // Use USE_ATOMIC_TICKETS=false para desativar ou ATOMIC_TICKETS_PERCENTAGE=0
      const useAtomicSystem = process.env.USE_ATOMIC_TICKETS !== 'false'; // true por padrão
      const atomicPercentage = parseInt(process.env.ATOMIC_TICKETS_PERCENTAGE || '100', 10);
      
      // Decidir qual versão usar baseado em feature flag ou percentual
      let shouldUseV2 = useAtomicSystem;
      if (!shouldUseV2 && atomicPercentage > 0) {
        // Teste A/B: usar hash do order_id para distribuir uniformemente
        const hash = result.order.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        shouldUseV2 = (hash % 100) < atomicPercentage;
      }
      
      console.log(`🎫 Iniciando criação automática de tickets [${shouldUseV2 ? 'V2-ATOMIC ✅' : 'V1-LEGACY'}] para pedido:`, result.order.id);
      
      const resultadoTickets = shouldUseV2 
        ? await criarTicketsV2(result.order)
        : await criarTicketsIndividuaisAposConfirmacao(result.order);
      
      if (resultadoTickets.success) {
        console.log('✅ Tickets criados automaticamente:', {
          orderId: result.order.id,
          ticketsCriados: resultadoTickets.total_tickets,
          tickets: resultadoTickets.tickets_criados.map(t => t.id)
        });
      } else {
        console.warn('⚠️ Falha na criação automática de tickets:', {
          orderId: result.order.id,
          erros: resultadoTickets.erros
        });
        
        // ⭐ NOVO: Verificar se é erro de ingressos esgotados
        const soldOutError = resultadoTickets.erros.find(err => 
          err.includes('esgotado') || err.includes('sold_out') || err.includes('1300')
        );
        
        if (soldOutError) {
          // Marcar pedido como "reembolso necessário"
          await supabase
            .from('orders')
            .update({
              status: 'refund_required',
              payment_status: 'refund_required',
              customer_data: {
                ...result.order.customer_data,
                refund_reason: 'Ingressos esgotados - limite de 1300 atingido'
              }
            })
            .eq('id', result.order.id);
          
          console.error('🚫 INGRESSOS ESGOTADOS - Pedido marcado para reembolso:', result.order.id);
          throw new Error('Ingressos esgotados - a compra não pode ser concluída. O valor será estornado.');
        }
      }
    } catch (ticketError) {
      console.error('❌ Erro na criação automática de tickets:', {
        orderId: result.order.id,
        error: ticketError
      });
      
      // ⭐ NOVO: Se for erro de esgotamento, re-lançar para webhook handler
      if (ticketError instanceof Error && ticketError.message.includes('esgotado')) {
        throw ticketError;
      }
      // Para outros erros, apenas logar sem falhar o webhook
    }

    console.log('✅ Webhook processado com sucesso:', {
      action: result.action,
      orderId: result.order.id,
      customerEmail: result.order.customer_email
    });

    return result;

  } catch (error) {
    console.error('💥 Erro ao processar webhook:', error);
    throw error;
  }
}

/**
 * Processa itens dos pedidos
 */
async function processarItensDosPedidos(orderId: string, products: any[]) {
  console.log('📦 Processando itens do pedido:', orderId);

  try {
    // Verificar se já existem itens para este pedido
    const { data: existingItems } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId);

    if (existingItems && existingItems.length > 0) {
      console.log('⚠️ Itens do pedido já existem, pulando criação');
      return;
    }

    // Buscar produtos existentes para mapear product_id
    const { data: existingProducts } = await supabase
      .from('products')
      .select('id, name, category');

    // Criar itens do pedido com product_id mapeado
    const orderItems = await Promise.all(products.map(async (product) => {
      let productId = null;
      
      // Tentar mapear produto por nome (case-insensitive)
      // Tentar mapear produto por nome (case-insensitive)
      const matchingProduct = existingProducts?.find(p => 
        p.name.toLowerCase() === product.name.toLowerCase()
      );
      
      if (matchingProduct) {
        productId = matchingProduct.id;
        console.log(`✅ Produto mapeado: ${product.name} -> ${productId}`);
      } else {
        // Criar produto se não existir
        console.log(`📝 Criando produto: ${product.name}`);
        
        // Inferir categoria baseada no nome
        let category = 'clothing'; // default
        const name = product.name.toLowerCase();
        if (name.includes('camiseta') || name.includes('camisa') || name.includes('blusa')) {
          category = 'camiseta';
        } else if (name.includes('ingresso') || name.includes('ticket') || name.includes('entrada')) {
          category = 'ticket';
        }
        
        const { data: newProduct, error: productError } = await supabase
          .from('products')
          .insert({
            name: product.name,
            price: product.price,
            category: category,
            in_stock: true,
            stock_quantity: 100 // default
          })
          .select('id')
          .single();
          
        if (productError) {
          console.error('❌ Erro ao criar produto:', productError);
        } else {
          productId = newProduct.id;
          console.log(`✅ Produto criado: ${product.name} -> ${productId}`);
        }
      }

      // Determinar se é um ingresso e buscar event_id
      let eventId = null;
      const name = product.name.toLowerCase();
      if (name.includes('ingresso') || name.includes('ticket') || name.includes('entrada') || 
          name.includes('conferência') || name.includes('evento')) {
        // Buscar o evento ativo
        const { data: evento } = await supabase
          .from('events')
          .select('id')
          .eq('status', 'active')
          .limit(1)
          .single();
        
        if (evento) {
          eventId = evento.id;
          console.log(`🎫 Ingresso detectado: ${product.name} -> evento: ${eventId}`);
        }
      }

      return {
        order_id: orderId,
        product_id: productId,
        event_id: eventId,
        name: product.name,
        quantity: product.quantity,
        price: product.price,
        unit_price: product.price,
        total_price: product.price * product.quantity,
        created_at: new Date().toISOString()
      };
    }));

    const { error } = await supabase
      .from('order_items')
      .insert(orderItems);

    if (error) {
      console.error('❌ Erro ao criar itens do pedido:', error);
      throw error;
    }

    console.log('✅ Itens do pedido criados:', orderItems.length);

  } catch (error) {
    console.error('💥 Erro ao processar itens do pedido:', error);
    throw error;
  }
}

/**
 * Middleware para Express/Vite que processa webhooks
 */
export function webhookAdminMiddleware(req: any, res: any) {
  return new Promise(async (resolve, reject) => {
    try {
      console.log('📨 Recebendo webhook na administração:', {
        method: req.method,
        url: req.url,
        headers: req.headers
      });

      // Verificar método
      if (req.method !== 'POST') {
        res.status(405).json({ error: 'Método não permitido' });
        return resolve(false);
      }

      // Verificar se é uma requisição de webhook
      if (!req.url.includes('/admin/pedidos/webhook')) {
        return resolve(false); // Não é para nós, deixar passar
      }

      // Processar body
      let body = req.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch (e) {
          res.status(400).json({ error: 'JSON inválido' });
          return resolve(true);
        }
      }

      // Validar estrutura do webhook
      if (!body.event || !body.data) {
        res.status(400).json({ error: 'Estrutura de webhook inválida' });
        return resolve(true);
      }

      // Processar webhook
      const resultado = await processarWebhookAdmin(body);

      // Responder sucesso
      res.status(200).json({
        success: true,
        message: 'Webhook processado com sucesso',
        data: resultado
      });

      resolve(true);

    } catch (error) {
      console.error('💥 Erro no middleware de webhook:', error);
      
      res.status(500).json({
        error: 'Erro interno do servidor',
        message: error instanceof Error ? error.message : 'Erro desconhecido'
      });

      resolve(true);
    }
  });
}

/**
 * Função para testar o webhook localmente
 */
export async function testarWebhookAdmin() {
  const webhookTeste: AbacatePayWebhookData = {
    event: 'billing.paid',
    data: {
      id: 'test_' + Date.now(),
      status: 'PAID',
      amount: 9000, // R$ 90,00 em centavos
      url: 'https://pay.abacatepay.com/test',
      products: [
        {
          externalId: 'TICKET-1',
          name: 'Ingresso Conferência',
          description: 'Ingresso para conferência de tecnologia',
          quantity: 1,
          price: 9000
        }
      ],
      customer: {
        metadata: {
          name: 'João Teste',
          email: 'joao.teste@example.com',
          cellphone: '(11) 99999-9999',
          taxId: '123.456.789-01'
        }
      },
      frequency: 'ONE_TIME',
      methods: ['PIX'],
      devMode: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  };

  console.log('🧪 Testando webhook admin...');
  
  try {
    const resultado = await processarWebhookAdmin(webhookTeste);
    console.log('✅ Teste concluído:', resultado);
    return resultado;
  } catch (error) {
    console.error('❌ Erro no teste:', error);
    throw error;
  }
}
