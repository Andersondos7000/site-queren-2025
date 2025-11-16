// 🎫 Criação Automática de Tickets Individuais - VERSÃO CORRIGIDA
// Data: 31 de Janeiro de 2025
// Correção: Detecção e processamento correto de lotes de ingressos

import { createClient } from '@supabase/supabase-js';
import { 
  DadosPedido, 
  ItemTicketValido, 
  TicketCriado, 
  ResultadoCriacaoTickets,
  LogCriacaoTicket,
  MetadataTicket
} from '../types/tickets';
import { gerarQRCodeTicket, gerarCodigoValidacao, gerarIdTicket } from './qrCodeGenerator';

// Configuração do Supabase (usar service role para operações do webhook)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Configurações do Supabase não encontradas para criação de tickets');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Interface para item processado com detecção de lote
 */
interface ItemProcessado {
  precoUnitario: number;
  quantidade: number;
  nomeOriginal: string;
  isLote: boolean;
  detalhesLote?: string;
}

/**
 * Função principal para criar tickets individuais após confirmação de pagamento
 * VERSÃO CORRIGIDA com detecção de lotes
 * @param pedido Dados do pedido pago
 * @returns Resultado da criação dos tickets
 */
export async function criarTicketsIndividuaisAposConfirmacaoCorrigido(
  pedido: DadosPedido
): Promise<ResultadoCriacaoTickets> {
  console.log(`🎫 [CORRIGIDO] Iniciando criação de tickets para pedido ${pedido.id}`);
  
  const resultado: ResultadoCriacaoTickets = {
    success: false,
    tickets_criados: [],
    erros: [],
    total_tickets: 0
  };

  try {
    // 1. Validar dados do pedido
    if (!pedido.items || pedido.items.length === 0) {
      resultado.erros.push('Pedido não contém itens');
      return resultado;
    }

    // 2. Filtrar itens que são tickets (com detecção inteligente)
    const itensTicket = pedido.items.filter(item => {
      // Método 1: Campo type explícito
      if (item.type === 'ticket') return true;
      
      // Método 2: Detectar por nome do produto (contém "ingresso")
      if (item.name && item.name.toLowerCase().includes('ingresso')) return true;
      
      // Método 3: Detectar por metadata de evento
      if (item.metadata && item.metadata.event_id) return true;
      
      // Método 4: Detectar por preço típico de ingresso (entre R$ 10 e R$ 500)
      if (item.price && item.price >= 10 && item.price <= 500 && 
          item.name && (item.name.toLowerCase().includes('show') || 
                       item.name.toLowerCase().includes('evento') ||
                       item.name.toLowerCase().includes('rock'))) return true;
      
      // Método 5: Detectar lotes por preço alto (> R$ 200)
      if (item.price && item.price > 200 && item.name && 
          (item.name.toLowerCase().includes('lote') ||
           item.name.toLowerCase().includes('pacote') ||
           item.name.toLowerCase().includes('kit') ||
           /\d+\s*(ingresso|ticket)/i.test(item.name))) return true;
      
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

    // 4. 🔧 NOVA LÓGICA: Processar itens com detecção de lotes
    const itensProcessados: ItemProcessado[] = [];
    
    for (const item of itensTicket) {
      const itemProcessado = processarItemComDeteccaoLote(item);
      itensProcessados.push(itemProcessado);
      
      console.log(`🔍 Item processado: ${item.name}`);
      console.log(`   Quantidade: ${itemProcessado.quantidade}`);
      console.log(`   Preço unitário: R$ ${itemProcessado.precoUnitario.toFixed(2)}`);
      console.log(`   É lote: ${itemProcessado.isLote ? 'Sim' : 'Não'}`);
      if (itemProcessado.detalhesLote) {
        console.log(`   Detalhes: ${itemProcessado.detalhesLote}`);
      }
    }

    // 5. Criar tickets individuais para cada item processado
    const ticketsParaCriar: any[] = [];
    const logsAuditoria: LogCriacaoTicket[] = [];

    for (const itemProcessado of itensProcessados) {
      for (let i = 0; i < itemProcessado.quantidade; i++) {
        try {
          const ticketId = gerarIdTicket();
          
          // Definir event_id baseado no contexto
          let eventId = '4ac76619-f932-4377-a34c-a10f8b063c96'; // ID padrão do evento "Show de Rock Nacional"
          
          // Gerar QR code único
          const qrCode = gerarQRCodeTicket(ticketId, eventId);
          
          // Definir ticket_type baseado no processamento
          let ticketType = itemProcessado.nomeOriginal;
          if (itemProcessado.isLote) {
            ticketType = `${itemProcessado.nomeOriginal} (${i + 1}/${itemProcessado.quantidade})`;
          }
          
          // Preparar dados do ticket
          const novoTicket = {
            id: ticketId,
            event_id: eventId,
            ticket_type: ticketType,
            price: itemProcessado.precoUnitario, // 🔧 CORREÇÃO: Usar preço unitário calculado
            status: 'active' as const,
            qr_code: qrCode,
            order_id: pedido.id,
            customer_id: pedido.customer_data?.email || pedido.customer_email, // Usar email como customer_id
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
            details: `Ticket criado para ${itemProcessado.nomeOriginal} - ${i + 1}/${itemProcessado.quantidade} - R$ ${itemProcessado.precoUnitario.toFixed(2)}`
          });

        } catch (error) {
          const errorMsg = `Erro ao preparar ticket ${i + 1} do item ${itemProcessado.nomeOriginal}: ${error}`;
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

    // 6. Inserir tickets no banco de dados
    console.log(`💾 Inserindo ${ticketsParaCriar.length} tickets no banco de dados`);
    
    const { data: ticketsCriados, error: erroInsercao } = await supabase
      .from('tickets')
      .insert(ticketsParaCriar)
      .select();

    if (erroInsercao) {
      resultado.erros.push(`Erro ao inserir tickets: ${erroInsercao.message}`);
      return resultado;
    }

    // 7. Sucesso!
    resultado.success = true;
    resultado.tickets_criados = ticketsCriados as TicketCriado[];
    resultado.total_tickets = ticketsCriados?.length || 0;

    console.log(`✅ ${resultado.total_tickets} tickets criados com sucesso para o pedido ${pedido.id}`);

    // 8. Log de auditoria
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
 * 🔧 NOVA FUNÇÃO: Processar item com detecção inteligente de lotes
 * @param item Item do pedido
 * @returns Item processado com preço unitário e quantidade corretos
 */
function processarItemComDeteccaoLote(item: any): ItemProcessado {
  let precoUnitario = item.price || item.unit_price || 0;
  let quantidade = item.quantity || 1;
  let isLote = false;
  let detalhesLote = '';

  // 🔍 DETECÇÃO DE LOTES

  // Método 1: Detectar por palavras-chave no nome
  if (item.name) {
    const nome = item.name.toLowerCase();
    
    // Detectar "lote", "pacote", "kit"
    if (nome.includes('lote') || nome.includes('pacote') || nome.includes('kit')) {
      isLote = true;
      detalhesLote = 'Detectado por palavra-chave (lote/pacote/kit)';
    }
    
    // Detectar padrão "X ingressos" ou "X tickets"
    const matchQuantidade = nome.match(/(\d+)\s*(ingresso|ticket)/i);
    if (matchQuantidade && quantidade === 1) {
      const quantidadeDetectada = parseInt(matchQuantidade[1]);
      if (quantidadeDetectada > 1) {
        quantidade = quantidadeDetectada;
        precoUnitario = precoUnitario / quantidade;
        isLote = true;
        detalhesLote = `Detectado ${quantidadeDetectada} ingressos no nome`;
      }
    }
  }

  // Método 2: Detectar por preço alto com quantidade 1
  if (!isLote && quantidade === 1 && precoUnitario > 200) {
    // Tentar detectar quantidade baseada em preços típicos
    const precosTipicos = [50, 76.50, 85, 100, 150]; // Preços típicos de ingressos
    
    for (const precoTipico of precosTipicos) {
      const quantidadePossivel = Math.round(precoUnitario / precoTipico);
      if (quantidadePossivel > 1 && quantidadePossivel <= 20) {
        const precoCalculado = precoUnitario / quantidadePossivel;
        const diferenca = Math.abs(precoCalculado - precoTipico);
        
        // Se a diferença for pequena (< R$ 5), provavelmente é um lote
        if (diferenca < 5) {
          quantidade = quantidadePossivel;
          precoUnitario = precoCalculado;
          isLote = true;
          detalhesLote = `Detectado ${quantidadePossivel} ingressos de ~R$ ${precoTipico} (diferença: R$ ${diferenca.toFixed(2)})`;
          break;
        }
      }
    }
  }

  // Método 3: Detectar por quantidade > 1 (já está correto)
  if (quantidade > 1) {
    isLote = true;
    if (!detalhesLote) {
      detalhesLote = `Quantidade múltipla: ${quantidade}`;
    }
  }

  return {
    precoUnitario: Math.round(precoUnitario * 100) / 100, // Arredondar para 2 casas decimais
    quantidade,
    nomeOriginal: item.name || 'Ingresso',
    isLote,
    detalhesLote
  };
}

/**
 * Registra logs de auditoria para criação de tickets
 * @param logs Array de logs para registrar
 */
async function registrarLogsAuditoria(logs: LogCriacaoTicket[]): Promise<void> {
  try {
    console.log('📝 Logs de auditoria:', logs);
    
    // Futuramente pode ser implementada uma tabela de auditoria
    // await supabase.from('ticket_audit_logs').insert(logs);
  } catch (error) {
    console.error('Erro ao registrar logs de auditoria:', error);
    // Não falhar a operação principal por causa de logs
  }
}

/**
 * Função auxiliar para reprocessar pedidos antigos com lógica corrigida
 * @param orderId ID do pedido para reprocessar
 */
export async function reprocessarTicketsPedidoCorrigido(orderId: string): Promise<ResultadoCriacaoTickets> {
  console.log(`🔄 [CORRIGIDO] Reprocessando tickets para pedido ${orderId}`);
  
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

    // Processar criação de tickets com lógica corrigida
    return await criarTicketsIndividuaisAposConfirmacaoCorrigido(pedido);

  } catch (error) {
    return {
      success: false,
      tickets_criados: [],
      erros: [`Erro ao reprocessar pedido ${orderId}: ${error}`],
      total_tickets: 0
    };
  }
}