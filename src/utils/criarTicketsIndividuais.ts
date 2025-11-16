// 🎫 Criação Automática de Tickets Individuais
// Data: 31 de Janeiro de 2025

import { createClient } from '@supabase/supabase-js';
import { 
  DadosPedido, 
  ItemTicketValido, 
  TicketCriado, 
  ResultadoCriacaoTickets,
  LogCriacaoTicket,
  MetadataTicket
} from '../types/tickets';
import { gerarQRCodeTicket, gerarCodigoValidacao, gerarIdTicket, gerarImagemQRCode } from './qrCodeGenerator';

// Configuração do Supabase (usar service role para operações do webhook)
// Compatível com ambientes Vite (import.meta.env) e Node (process.env)
const supabaseUrl = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) 
  || (typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_URL : undefined);
const supabaseServiceKey = (typeof import.meta !== 'undefined' && (import.meta as any).env?.SUPABASE_SERVICE_ROLE_KEY)
  || (typeof process !== 'undefined' ? process.env?.SUPABASE_SERVICE_ROLE_KEY : undefined);

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Configurações do Supabase não encontradas para criação de tickets');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Função auxiliar para detectar e processar lotes
// Função removida - agora usamos diretamente os dados dos order_items

/**
 * Função principal para criar tickets individuais após confirmação de pagamento
 * @param pedido Dados do pedido pago
 * @returns Resultado da criação dos tickets
 */
export async function criarTicketsIndividuaisAposConfirmacao(
  pedido: DadosPedido
): Promise<ResultadoCriacaoTickets> {
  console.log(`🎫 Iniciando criação de tickets para pedido ${pedido.id}`);
  
  const resultado: ResultadoCriacaoTickets = {
    success: false,
    tickets_criados: [],
    erros: [],
    total_tickets: 0
  };

  try {
    // 🔧 Buscar dados completos do pedido para obter user_id
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('user_id, customer_email')
      .eq('id', pedido.id)
      .single();

    if (orderError) {
      resultado.erros.push(`Erro ao buscar dados do pedido: ${orderError.message}`);
      return resultado;
    }

    const userId = (pedido as any).user_id || orderData?.user_id || null;
    console.log(`👤 User ID do pedido: ${userId || 'não encontrado'}`);

    // 🔧 NOVA LÓGICA: Buscar order_items do banco de dados
    const { data: orderItems, error: orderItemsError } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', pedido.id);

    if (orderItemsError) {
      resultado.erros.push(`Erro ao buscar order_items: ${orderItemsError.message}`);
      return resultado;
    }

    if (!orderItems || orderItems.length === 0) {
      resultado.erros.push('Pedido não contém order_items');
      return resultado;
    }

    console.log(`📦 Encontrados ${orderItems.length} order_items no pedido`);

    // 2. Filtrar itens que são tickets (usando informações dos order_items)
    const itensTicket = orderItems.filter(item => {
      // Método 1: Tem ticket_id (foi criado como ticket)
      if (item.ticket_id) return true;
      
      // Método 2: Tem ticket_type definido
      if (item.ticket_type) return true;
      
      // Método 3: Tem event_id definido
      if (item.event_id) return true;
      
      // Método 4: Detectar por nome do produto (contém "ingresso")
      if (item.name && item.name.toLowerCase().includes('ingresso')) return true;
      
      // Método 5: Detectar por preço típico de ingresso (entre R$ 10 e R$ 500)
      if (item.price && item.price >= 10 && item.price <= 500 && 
          item.name && (item.name.toLowerCase().includes('show') || 
                       item.name.toLowerCase().includes('evento') ||
                       item.name.toLowerCase().includes('rock') ||
                       item.name.toLowerCase().includes('festival'))) return true;
      
      return false;
    }) as ItemTicketValido[];
    
    if (itensTicket.length === 0) {
      console.log(`ℹ️ Pedido ${pedido.id} não contém tickets, apenas produtos físicos`);
      resultado.success = true;
      return resultado;
    }

    console.log(`📋 Encontrados ${itensTicket.length} tipos de ticket no pedido`);

    // 3. Verificar se tickets já existem para este pedido (idempotência)
    const { data: ticketsExistentes, error: erroVerificacao } = await supabase
      .from('tickets')
      .select('id, order_id')
      .eq('order_id', pedido.id);

    if (erroVerificacao) {
      resultado.erros.push(`Erro ao verificar tickets existentes: ${erroVerificacao.message}`);
      return resultado;
    }

    if (ticketsExistentes && ticketsExistentes.length > 0) {
      console.log(`⚠️ Tickets já existem para o pedido ${pedido.id}, pulando criação`);
      resultado.success = true;
      resultado.tickets_criados = ticketsExistentes as TicketCriado[];
      return resultado;
    }

    // 4. Criar tickets individuais para cada item e quantidade com detecção de lotes
    const ticketsParaCriar: any[] = [];
  const logsAuditoria: LogCriacaoTicket[] = [];
    // Índice global para ticket_number sequencial por pedido
    let nextTicketIndex = 1;

    for (const item of itensTicket) {
      // Cast para 'any' para acessar campos dinâmicos do order_item do banco
      const orderItem = item as any;
      
      console.log(`🔄 Processando order_item: ${orderItem.name || 'Sem nome'} - Qtd: ${orderItem.quantity || 1} - Preço: R$ ${orderItem.price || orderItem.unit_price || 0}`);
      console.log(`   - ticket_type: ${orderItem.ticket_type || 'não definido'}`);
      console.log(`   - event_id: ${orderItem.event_id || 'não definido'}`);
      
      // 🎯 USAR INFORMAÇÕES DOS ORDER_ITEMS: Não precisamos detectar lotes, já temos as informações corretas
      const quantidade = orderItem.quantity || 1;
      const precoUnitario = orderItem.unit_price || orderItem.price || 0;
      const ticketType = orderItem.ticket_type || 'individual';
      
      console.log(`📊 Informações do order_item:`);
      console.log(`   - Quantidade: ${quantidade}`);
      console.log(`   - Preço unitário: R$ ${precoUnitario}`);
      console.log(`   - Tipo de ticket: ${ticketType}`);
      
      for (let i = 0; i < quantidade; i++) {
        try {
          const ticketId = gerarIdTicket();
          
          // Usar event_id do order_item ou padrão
          let eventId = orderItem.event_id;
          if (!eventId) {
            // Usar ID padrão do evento "Show de Rock Nacional"
            eventId = '4ac76619-f932-4377-a34c-a10f8b063c96';
            console.log(`⚠️ Order_item ${orderItem.name} sem event_id, usando evento padrão: ${eventId}`);
          }

          // Gerar QR code único com dados estruturados
          const customerId = (pedido as any).customer_id || pedido.customer_data?.email;
          const qrCodeData = gerarQRCodeTicket(ticketId, eventId, customerId);
          const qrCodeUrl = gerarImagemQRCode(qrCodeData);
          
          // Usar ticket_type do order_item ou definir baseado no nome
          let finalTicketType = ticketType;
          if (!finalTicketType || finalTicketType === 'individual') {
            if (orderItem.name && orderItem.name.toLowerCase().includes('ingresso')) {
              finalTicketType = orderItem.name;
            } else {
              finalTicketType = 'Ingresso Padrão';
            }
          }
          
          // ⭐ NOVO: Alocar número sequencial de assento (0001-1300)
          const { data: seatNumber, error: seatNumberError } = await supabase
            .rpc('get_next_seat_number');

          if (seatNumberError) {
            // Verificar se é erro de ingressos esgotados
            if (seatNumberError.message && seatNumberError.message.includes('esgotado')) {
              throw new Error('Ingressos esgotados - a compra não pode ser concluída. O valor será estornado. Entre em contato com o suporte.');
            }
            throw new Error(`Erro ao alocar assento: ${seatNumberError.message}`);
          }

          // Número lógico do ticket dentro do pedido (item-1, item-2, ...)
          const ticketNumber = `${pedido.id}-item-${nextTicketIndex}`;
          nextTicketIndex++;

          // Preparar dados do ticket
          const novoTicket = {
            id: ticketId,
            event_id: eventId,
            ticket_type: finalTicketType,
            price: precoUnitario, // 🎯 CORREÇÃO: Usar preço unitário dos order_items
            unit_price: precoUnitario, // Preço unitário
            total_price: precoUnitario, // Para ticket individual, total = unitário
            quantity: 1, // Cada ticket individual tem quantidade 1
            status: 'active' as const,
            qr_code: qrCodeUrl,
            order_id: pedido.id,
            customer_id: customerId, // Usar customer_id do order_item ou fallback
            user_id: userId, // 🎯 CORREÇÃO: Adicionar user_id do pedido
            ticket_number: ticketNumber, // Ex.: <orderId>-item-1
            seat_number: seatNumber, // Número sequencial de assento (0001-1300)
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };

          ticketsParaCriar.push(novoTicket);

          // Log de auditoria
          logsAuditoria.push({
            order_id: pedido.id,
            ticket_id: ticketId,
            action: 'created',
            timestamp: new Date().toISOString(),
            details: `Ticket criado para ${orderItem.name} - Quantidade ${i + 1}/${quantidade} - Preço unitário: R$ ${precoUnitario} - Tipo: ${ticketType}`
          });

        } catch (error) {
          const errorMsg = `Erro ao preparar ticket ${i + 1} do item ${orderItem.name}: ${error}`;
          resultado.erros.push(errorMsg);
          
          logsAuditoria.push({
            order_id: pedido.id,
            ticket_id: 'unknown',
            action: 'failed',
            timestamp: new Date().toISOString(),
            details: errorMsg
          });
        }
      }
    }

    if (ticketsParaCriar.length === 0) {
      resultado.erros.push('Nenhum ticket válido pôde ser preparado');
      return resultado;
    }

    // 5. Inserir tickets no banco de dados
    console.log(`💾 Inserindo ${ticketsParaCriar.length} tickets no banco de dados`);
    
    const { data: ticketsCriados, error: erroInsercao } = await supabase
      .from('tickets')
      .insert(ticketsParaCriar)
      .select();

    if (erroInsercao) {
      resultado.erros.push(`Erro ao inserir tickets: ${erroInsercao.message}`);
      return resultado;
    }

    // 6. Sucesso!
    resultado.success = true;
    resultado.tickets_criados = ticketsCriados as TicketCriado[];
    resultado.total_tickets = ticketsCriados?.length || 0;

    console.log(`✅ ${resultado.total_tickets} tickets criados com sucesso para o pedido ${pedido.id}`);

    // 7. Log de auditoria (opcional - pode ser implementado depois)
    await registrarLogsAuditoria(logsAuditoria);

    return resultado;

  } catch (error) {
    const errorMsg = `Erro geral na criação de tickets: ${error}`;
    console.error('❌', errorMsg);
    resultado.erros.push(errorMsg);
    return resultado;
  }
}

/**
 * Registra logs de auditoria para criação de tickets
 * @param logs Array de logs para registrar
 */
async function registrarLogsAuditoria(logs: LogCriacaoTicket[]): Promise<void> {
  try {
    // Por enquanto, apenas log no console
    // Futuramente pode ser implementada uma tabela de auditoria
    console.log('📝 Logs de auditoria:', logs);
    
    // Exemplo de implementação futura:
    // await supabase.from('ticket_audit_logs').insert(logs);
  } catch (error) {
    console.error('Erro ao registrar logs de auditoria:', error);
    // Não falhar a operação principal por causa de logs
  }
}

/**
 * Valida se um item é um ticket válido
 * @param item Item do pedido
 * @returns true se é um ticket válido
 */
function validarItemTicket(item: any): item is ItemTicketValido {
  // Verificações básicas obrigatórias
  if (typeof item.price !== 'number' || typeof item.quantity !== 'number' || item.quantity <= 0) {
    return false;
  }

  // Verificar se é um ticket por diferentes métodos
  const isTicket = (
    item.type === 'ticket' ||
    (item.name && item.name.toLowerCase().includes('ingresso')) ||
    (item.metadata && item.metadata.event_id) ||
    (item.price >= 10 && item.price <= 500 && item.name && 
     (item.name.toLowerCase().includes('show') || 
      item.name.toLowerCase().includes('evento') ||
      item.name.toLowerCase().includes('rock')))
  );

  return isTicket;
}

/**
 * Função auxiliar para reprocessar pedidos antigos (uso administrativo)
 * @param orderId ID do pedido para reprocessar
 */
export async function reprocessarTicketsPedido(orderId: string): Promise<ResultadoCriacaoTickets> {
  console.log(`🔄 Reprocessando tickets para pedido ${orderId}`);
  
  try {
    // Buscar dados do pedido
    const { data: pedido, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (error || !pedido) {
      return {
        success: false,
        tickets_criados: [],
        erros: [`Pedido ${orderId} não encontrado: ${error?.message}`],
        total_tickets: 0
      };
    }

    // Verificar se pedido está pago
    if (pedido.status !== 'paid') {
      return {
        success: false,
        tickets_criados: [],
        erros: [`Pedido ${orderId} não está com status 'paid'`],
        total_tickets: 0
      };
    }

    // Processar criação de tickets
    return await criarTicketsIndividuaisAposConfirmacao(pedido);

  } catch (error) {
    return {
      success: false,
      tickets_criados: [],
      erros: [`Erro ao reprocessar pedido ${orderId}: ${error}`],
      total_tickets: 0
    };
  }
}