import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from './useAuth';
import { useAdminAuth } from '@/contexts/AdminAuthContext';

export interface UserTicket {
  id: string;
  ticket_type: string;
  price: number;
  total_price?: number;
  unit_price?: number;
  quantity: number;
  status: 'active' | 'used' | 'cancelled';
  qr_code: string;
  seat_number?: string | null;
  ticket_number?: string | null;
  created_at: string;
  updated_at: string;
  event_id: string;
  customer_id: string | null;
  user_id?: string | null;
  order_id?: string | null;
  events?: {
    id: string;
    name: string;
    event_date?: string;
    date?: string;
    location?: string;
  } | null;
  customers?: {
    id: string;
    full_name: string;
    email: string;
    phone?: string;
  } | null;
  orders?: {
    id: string;
    total_amount: number;
    status: string;
    payment_status: string;
    created_at: string;
    customer_data?: any;
    customer_name?: string;
    customer_email?: string;
  } | null;
}

export interface UserTicketFilters {
  status?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface TicketGroup {
  id: string;
  type: 'package' | 'single';
  order_id: string | null;
  customer_name: string;
  customer_email: string;
  event_name: string;
  ticket_count: number;
  total_quantity: number;
  unit_price: number;
  total_value: number;
  status: string;
  created_at: string;
  purchase_date: string;
  tickets: UserTicket[];
}

export interface UserTicketStats {
  total: number;
  active: number;
  used: number;
  cancelled: number;
  totalValue: number;
}

export interface UseUserTicketsReturn {
  tickets: UserTicket[];
  ticketGroups: TicketGroup[];
  stats: UserTicketStats;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useUserTickets(filters?: UserTicketFilters): UseUserTicketsReturn {
  const { user } = useAuth();
  const { isAdminLoggedIn, isAdminSessionValid } = useAdminAuth();
  const [tickets, setTickets] = useState<UserTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Verificar se é admin autenticado
  const isAdmin = isAdminLoggedIn && isAdminSessionValid();

  // Função para buscar tickets do usuário
  const fetchTickets = async () => {
    // Se não é admin e não tem usuário, retornar vazio
    if (!isAdmin && !user) {
      setTickets([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      console.log('[useUserTickets] Buscando tickets:', {
        userId: user?.id,
        isAdmin,
        filters
      });

      // Construir query base (incluindo seat_number explicitamente)
      let query = supabase
        .from('tickets')
        .select(`
          id,
          order_id,
          user_id,
          event_id,
          customer_id,
          ticket_type,
          price,
          unit_price,
          total_price,
          quantity,
          status,
          qr_code,
          seat_number,
          ticket_number,
          created_at,
          updated_at,
          events (
            id,
            name,
            event_date,
            date,
            location
          ),
          customers!customer_id (
            id,
            full_name,
            email,
            phone
          ),
          orders!order_id (
            id,
            total_amount,
            status,
            payment_status,
            created_at,
            customer_data,
            customer_name,
            customer_email
          )
        `);

      // Se não é admin, filtrar apenas tickets do usuário
      // ✅ CORREÇÃO: Buscar também por customer_email do pedido quando user_id é NULL
      if (!isAdmin && user) {
        // Tentar buscar primeiro por user_id
        query = query.eq('user_id', user.id);
      }
      // Se é admin, não filtrar - mostrar todos os tickets

      // Aplicar filtros
      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters?.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }

      if (filters?.dateTo) {
        query = query.lte('created_at', filters.dateTo);
      }

      // Ordenar por data de criação (mais recente primeiro)
      query = query.order('created_at', { ascending: false });

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw new Error(`Erro ao buscar tickets: ${fetchError.message}`);
      }

      let ticketsData = data || [];

      // ✅ CORREÇÃO: Buscar também por customer_email do pedido quando user_id é NULL
      // Isso é necessário porque muitos tickets são criados sem user_id, apenas com order_id
      // 🔧 CORREÇÃO: Buscar também por emails similares (normalizar email para busca flexível)
      // 🔧 CORREÇÃO: Sempre buscar por email, mesmo se já encontrou tickets por user_id
      if (!isAdmin && user) {
        // Sempre buscar também por email do pedido (não apenas quando ticketsData.length === 0)
        // Isso garante que tickets criados sem user_id sejam encontrados
        console.log('[useUserTickets] Buscando tickets por email do pedido...');
        
        // Normalizar email para busca flexível (remover pontos, converter para minúsculas)
        // Buscar por emails exatos e também por variações comuns
        const normalizeEmail = (email: string) => {
          if (!email) return '';
          return email.toLowerCase().trim().replace(/\./g, '');
        };
        
        const userEmailNormalized = normalizeEmail(user.email);
        const userEmailParts = user.email.toLowerCase().split('@');
        const userEmailLocal = userEmailParts[0] || '';
        const userEmailDomain = userEmailParts[1] || '';
        
        // Buscar todos os pedidos pagos e filtrar por email
        const { data: allPaidOrders } = await supabase
          .from('orders')
          .select('id, customer_email, customer_data')
          .eq('status', 'paid');
        
        if (allPaidOrders && allPaidOrders.length > 0) {
          // Função auxiliar para encontrar prefixo comum
          function getCommonPrefix(str1: string, str2: string): string {
            let prefix = '';
            const minLength = Math.min(str1.length, str2.length);
            for (let i = 0; i < minLength; i++) {
              if (str1[i] === str2[i]) {
                prefix += str1[i];
              } else {
                break;
              }
            }
            return prefix;
          }
          
          // Filtrar pedidos onde o email corresponde (exato ou normalizado)
          const matchingOrders = allPaidOrders.filter(order => {
            const orderEmail = order.customer_email || order.customer_data?.email || '';
            if (!orderEmail) return false;
            
            // Comparação exata (case-insensitive)
            if (orderEmail.toLowerCase() === user.email.toLowerCase()) {
              return true;
            }
            
            // Comparação normalizada (sem pontos)
            const orderEmailNormalized = normalizeEmail(orderEmail);
            if (orderEmailNormalized === userEmailNormalized) {
              return true;
            }
            
            // Comparação por prefixo e domínio (para capturar variações como design/desig)
            // Ex: fotosartdesign@gmail.com vs fotosartdesig@gmail.com
            const orderEmailParts = orderEmail.toLowerCase().split('@');
            const orderEmailLocal = orderEmailParts[0] || '';
            const orderEmailDomain = orderEmailParts[1] || '';
            
            // Se o domínio é o mesmo
            if (orderEmailDomain === userEmailDomain) {
              // Verificar se a parte local é similar (mesmo prefixo significativo)
              // Ex: "fotosartdesign" vs "fotosartdesig" - ambos começam com "fotosart"
              const minLength = Math.min(orderEmailLocal.length, userEmailLocal.length);
              const commonPrefix = getCommonPrefix(orderEmailLocal, userEmailLocal);
              
              // Se o prefixo comum é significativo (pelo menos 8 caracteres ou 80% do menor)
              const prefixThreshold = Math.max(8, minLength * 0.8);
              if (commonPrefix.length >= prefixThreshold) {
                // Verificar se a diferença de tamanho é pequena (até 3 caracteres)
                const lengthDiff = Math.abs(orderEmailLocal.length - userEmailLocal.length);
                if (lengthDiff <= 3) {
                  return true;
                }
              }
            }
            
            return false;
          });
          
          if (matchingOrders.length > 0) {
            const orderIds = matchingOrders.map(o => o.id);
            console.log('[useUserTickets] Encontrados pedidos pelo email (normalizado):', orderIds.length);
            
            // Buscar tickets desses pedidos
            const { data: ticketsByOrder } = await supabase
              .from('tickets')
              .select(`
                id,
                order_id,
                user_id,
                event_id,
                customer_id,
                ticket_type,
                price,
                unit_price,
                total_price,
                quantity,
                status,
                qr_code,
                seat_number,
                ticket_number,
                created_at,
                updated_at,
                events (
                  id,
                  name,
                  event_date,
                  date,
                  location
                ),
                customers!customer_id (
                  id,
                  full_name,
                  email,
                  phone
                ),
                orders!order_id (
                  id,
                  total_amount,
                  status,
                  payment_status,
                  created_at,
                  customer_data,
                  customer_name,
                  customer_email
                )
              `)
              .in('order_id', orderIds)
              .order('created_at', { ascending: false });
            
            if (ticketsByOrder && ticketsByOrder.length > 0) {
              // ✅ CORREÇÃO: Atualizar tickets e pedidos com user_id quando encontrado
              const ticketsToUpdate = ticketsByOrder.filter(t => !t.user_id);
              const ordersToUpdate = matchingOrders.filter(o => {
                const orderId = (o as any).id;
                const hasUserId = (o as any).user_id;
                const hasTicketWithUserId = ticketsByOrder.find(t => t.order_id === orderId && t.user_id);
                return !hasUserId || !hasTicketWithUserId;
              });
              
              if (ticketsToUpdate.length > 0 || ordersToUpdate.length > 0) {
                console.log(`[useUserTickets] Atualizando ${ticketsToUpdate.length} tickets e ${ordersToUpdate.length} pedidos com user_id`);
                
                // Atualizar tickets sem user_id
                if (ticketsToUpdate.length > 0) {
                  const ticketIds = ticketsToUpdate.map(t => t.id);
                  try {
                    await supabase
                      .from('tickets')
                      .update({ user_id: user.id })
                      .in('id', ticketIds);
                    console.log(`[useUserTickets] ${ticketIds.length} tickets atualizados com user_id`);
                  } catch (err) {
                    console.warn(`[useUserTickets] Erro ao atualizar tickets:`, err);
                  }
                }
                
                // Atualizar pedidos sem user_id (apenas os que têm tickets)
                if (ordersToUpdate.length > 0) {
                  const orderIds = ordersToUpdate.map(o => (o as any).id);
                  try {
                    await supabase
                      .from('orders')
                      .update({ user_id: user.id })
                      .in('id', orderIds);
                    console.log(`[useUserTickets] ${orderIds.length} pedidos atualizados com user_id`);
                  } catch (err) {
                    console.warn(`[useUserTickets] Erro ao atualizar pedidos:`, err);
                  }
                }
              }
              
              // Combinar tickets encontrados (remover duplicatas por ID)
              const existingIds = new Set(ticketsData.map(t => t.id));
              const newTickets = ticketsByOrder
                .filter(t => !existingIds.has(t.id))
                .map(t => ({
                  ...t,
                  // ✅ CORREÇÃO: Atualizar user_id localmente se foi atualizado
                  user_id: t.user_id || user.id
                }));
              ticketsData = [...ticketsData, ...newTickets];
              console.log('[useUserTickets] Tickets encontrados por email do pedido (normalizado):', newTickets.length);
            }
          }
        }
      }

      // Normalizar dados ANTES de aplicar filtros (garantir que relações sejam objetos únicos, não arrays)
      let normalizedTickets = ticketsData.map(t => {
        const normalized: UserTicket = {
          ...t,
          events: Array.isArray(t.events) ? t.events[0] : (t.events || null),
          customers: Array.isArray(t.customers) ? t.customers[0] : (t.customers || null),
          orders: Array.isArray(t.orders) ? t.orders[0] : (t.orders || null),
        };
        return normalized;
      });

      // Aplicar filtro de busca se necessário (após normalização)
      if (filters?.search) {
        const searchTerm = filters.search.toLowerCase();
        normalizedTickets = normalizedTickets.filter(ticket => {
          const matchesId = ticket.id.toLowerCase().includes(searchTerm);
          const matchesType = ticket.ticket_type?.toLowerCase().includes(searchTerm);
          const matchesQrCode = ticket.qr_code?.toLowerCase().includes(searchTerm);
          const matchesEmail = ticket.customers?.email?.toLowerCase().includes(searchTerm);
          const matchesName = ticket.customers?.full_name?.toLowerCase().includes(searchTerm);
          const matchesEventName = ticket.events?.name?.toLowerCase().includes(searchTerm);
          
          return matchesId || matchesType || matchesQrCode || matchesEmail || matchesName || matchesEventName;
        });
      }
      
      setTickets(normalizedTickets);
      console.log('[useUserTickets] Tickets encontrados:', normalizedTickets.length);
      console.log('[useUserTickets] Tickets com seat_number:', normalizedTickets.map(t => ({
        id: t.id,
        order_id: t.order_id,
        seat_number: t.seat_number,
        ticket_number: t.ticket_number,
        ticket_type: t.ticket_type
      })));
    } catch (err) {
      console.error('Erro ao buscar tickets do usuário:', err);
      setError(err instanceof Error ? err : new Error('Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  // Função para agrupar tickets por order_id
  const groupTicketsByOrder = (tickets: UserTicket[]): TicketGroup[] => {
    const orderGroups = new Map<string, UserTicket[]>();
    const singleTickets: UserTicket[] = [];

    // Separar tickets por order_id
    tickets.forEach(ticket => {
      if (ticket.order_id) {
        if (!orderGroups.has(ticket.order_id)) {
          orderGroups.set(ticket.order_id, []);
        }
        orderGroups.get(ticket.order_id)!.push(ticket);
      } else {
        singleTickets.push(ticket);
      }
    });

    const groups: TicketGroup[] = [];

    // Processar grupos de pedidos (pacotes)
    orderGroups.forEach((orderTickets, orderId) => {
      const firstTicket = orderTickets[0];
      const totalQuantity = orderTickets.reduce((sum, t) => sum + (t.quantity || 1), 0);
      // Corrigir cálculo: usar total_price se disponível, senão price * quantity
      // ✅ CORREÇÃO: Converter valores para número (vêm como string do Supabase)
      const totalValue = orderTickets.reduce((sum, t) => {
        const price = typeof t.price === 'string' ? parseFloat(t.price) : (t.price || 0);
        const totalPrice = typeof t.total_price === 'string' ? parseFloat(t.total_price) : t.total_price;
        const ticketValue = totalPrice || price * (t.quantity || 1);
        return sum + ticketValue;
      }, 0);

      // Determinar tipo: 'package' se há múltiplos tickets OU se algum ticket tem quantity > 1
      const hasMultipleTickets = orderTickets.length > 1;
      const hasQuantityGreaterThanOne = orderTickets.some(t => (t.quantity || 1) > 1);
      const groupType = (hasMultipleTickets || hasQuantityGreaterThanOne) ? 'package' : 'single';

      // Se é um ticket com quantity > 1, criar itens virtuais com assentos sequenciais
      // ✅ Cada item virtual deve ter seu próprio assento sequencial baseado no seat_number original
      let ticketsToShow = orderTickets;
      if (orderTickets.length === 1 && (orderTickets[0].quantity || 1) > 1) {
        const ticket = orderTickets[0];
        const quantity = ticket.quantity || 1;
        const unitPrice = ticket.price || 0;
        const baseSeatNumber = ticket.seat_number;
        
        // ✅ Gerar assentos sequenciais a partir do seat_number base
        // Se o ticket tem seat_number = "0109", os itens serão: 0109, 0110, 0111, etc.
        ticketsToShow = Array.from({ length: quantity }, (_, index) => {
          let seatNumber: string | null = null;
          
          if (baseSeatNumber) {
            // Converter seat_number para número, adicionar índice e voltar para string formatada
            try {
              const baseNum = parseInt(baseSeatNumber, 10);
              const newSeatNum = baseNum + index;
              // Formatar com zeros à esquerda (ex: 0109, 0110, etc.)
              seatNumber = newSeatNum.toString().padStart(4, '0');
            } catch (e) {
              // Se falhar na conversão, usar o base + índice como string
              seatNumber = `${baseSeatNumber}-${index + 1}`;
            }
          }
          
          return {
          ...ticket,
          id: `${ticket.id}-item-${index + 1}`,
          display_id: ticket.ticket_number,
          quantity: 1,
          price: unitPrice,
          total_price: unitPrice,
          item_number: index + 1,
            parent_ticket_id: ticket.id,
            // ✅ Cada item virtual tem seu próprio assento sequencial
            seat_number: seatNumber
          };
        });
      }

      groups.push({
        id: orderId,
        type: groupType,
        order_id: orderId,
        customer_name: firstTicket.customers?.full_name || 'Cliente',
        customer_email: firstTicket.customers?.email || '',
        event_name: firstTicket.events?.name || 'Evento não encontrado',
        ticket_count: totalQuantity, // Usar totalQuantity ao invés de orderTickets.length
        total_quantity: totalQuantity,
        unit_price: firstTicket.price || 0,
        total_value: totalValue,
        status: firstTicket.status || 'unknown',
        created_at: firstTicket.created_at || '',
        purchase_date: firstTicket.orders?.created_at || firstTicket.created_at,
        tickets: ticketsToShow // Usar ticketsToShow que pode incluir itens virtuais
      });
    });

    // Processar tickets individuais (sem order_id)
    singleTickets.forEach(ticket => {
      const quantity = ticket.quantity || 1;
      // ✅ CORREÇÃO: Converter valores para número (vêm como string do Supabase)
      const unitPrice = typeof ticket.price === 'string' ? parseFloat(ticket.price) : (ticket.price || 0);
      const totalPriceRaw = typeof ticket.total_price === 'string' ? parseFloat(ticket.total_price) : ticket.total_price;
      // Corrigir cálculo: usar total_price se disponível, senão price * quantity
      const totalValue = totalPriceRaw || unitPrice * quantity;
      
      // Se quantity > 1, criar itens individuais virtuais para cada quantidade (como na admin)
      // ✅ Cada item virtual deve ter seu próprio assento sequencial baseado no seat_number original
      if (quantity > 1) {
        const baseSeatNumber = ticket.seat_number;
        
        // 🔧 CORREÇÃO: Gerar número base mesmo quando seat_number é NULL
        // Usar hash do ID do ticket para gerar um número base único
        let baseNum: number;
        if (baseSeatNumber) {
          // Se tem seat_number, usar ele como base
          try {
            baseNum = parseInt(baseSeatNumber, 10);
          } catch (e) {
            // Se falhar na conversão, gerar número base do ID
            baseNum = Math.abs(ticket.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % 1000 + 1;
          }
        } else {
          // Se não tem seat_number, gerar número base do ID do ticket
          // Usar hash simples do ID para gerar um número entre 1 e 999
          baseNum = Math.abs(ticket.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % 1000 + 1;
        }
        
        // Criar tickets individuais virtuais para cada quantidade com assentos sequenciais
        const individualTickets = Array.from({ length: quantity }, (_, index) => {
          // Calcular número do assento: baseNum + index
          const newSeatNum = baseNum + index;
          // Formatar com zeros à esquerda (ex: 0001, 0002, etc.)
          const seatNumber = newSeatNum.toString().padStart(4, '0');
          
          return {
          ...ticket,
          id: `${ticket.id}-item-${index + 1}`, // ID único para cada item (mantido para compatibilidade)
          display_id: ticket.ticket_number, // 🎯 CORRIGIDO: Usar sempre o ticket_number aleatório do banco
          quantity: 1, // Cada item individual tem quantidade 1
          price: unitPrice,
          total_price: unitPrice,
          item_number: index + 1, // Número do item (1, 2, 3, etc.)
            parent_ticket_id: ticket.id, // Referência ao ticket original
            // ✅ Cada item virtual tem seu próprio assento sequencial
            seat_number: seatNumber
          };
        });
        
        groups.push({
          id: ticket.id,
          type: 'package', // Mudança: tickets com quantity > 1 são tratados como pacotes
          order_id: null,
          customer_name: ticket.customers?.full_name || 'Cliente',
          customer_email: ticket.customers?.email || '',
          event_name: ticket.events?.name || 'Evento não encontrado',
          ticket_count: quantity,
          total_quantity: quantity,
          unit_price: unitPrice,
          total_value: totalValue,
          status: ticket.status || 'unknown',
          created_at: ticket.created_at || '',
          purchase_date: ticket.orders?.created_at || ticket.created_at,
          tickets: individualTickets // Array com todos os itens individuais
        });
      } else {
        // Ticket individual simples
        // Garantir que o ticket único também tenha display_id
        const ticketWithDisplayId = {
          ...ticket,
          display_id: ticket.ticket_number // 🎯 CORRIGIDO: Usar sempre o ticket_number aleatório do banco
        };
        
        groups.push({
          id: ticket.id,
          type: 'single',
          order_id: null,
          customer_name: ticket.customers?.full_name || 'Cliente',
          customer_email: ticket.customers?.email || '',
          event_name: ticket.events?.name || 'Evento não encontrado',
          ticket_count: quantity,
          total_quantity: quantity,
          unit_price: unitPrice,
          total_value: totalValue,
          status: ticket.status || 'unknown',
          created_at: ticket.created_at || '',
          purchase_date: ticket.orders?.created_at || ticket.created_at,
          tickets: [ticketWithDisplayId] // 🎯 CORRIGIDO: Usar ticket com display_id
        });
      }
    });

    // Ordenar por data de criação (mais recente primeira)
    return groups.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  };

  // Calcular estatísticas dos tickets
  const stats = useMemo((): UserTicketStats => {
    const totalTickets = tickets.reduce((sum, ticket) => sum + (ticket.quantity || 1), 0);
    const activeTickets = tickets.filter(t => t.status === 'active').reduce((sum, ticket) => sum + (ticket.quantity || 1), 0);
    const usedTickets = tickets.filter(t => t.status === 'used').reduce((sum, ticket) => sum + (ticket.quantity || 1), 0);
    const cancelledTickets = tickets.filter(t => t.status === 'cancelled').reduce((sum, ticket) => sum + (ticket.quantity || 1), 0);
    // Corrigir cálculo: usar total_price se disponível, senão price * quantity
    // ✅ CORREÇÃO: Converter valores para número (vêm como string do Supabase)
    const totalValue = tickets.reduce((sum, ticket) => {
      const price = typeof ticket.price === 'string' ? parseFloat(ticket.price) : (ticket.price || 0);
      const totalPrice = typeof ticket.total_price === 'string' ? parseFloat(ticket.total_price) : ticket.total_price;
      const ticketValue = totalPrice || price * (ticket.quantity || 1);
      return sum + ticketValue;
    }, 0);

    return {
      total: totalTickets,
      active: activeTickets,
      used: usedTickets,
      cancelled: cancelledTickets,
      totalValue: totalValue
    };
  }, [tickets]);

  // Agrupar tickets
  const ticketGroups = useMemo(() => {
    return groupTicketsByOrder(tickets);
  }, [tickets]);

  // Buscar tickets quando o usuário, admin status ou filtros mudarem
  useEffect(() => {
    console.log('[useUserTickets] useEffect disparado:', {
      userId: user?.id,
      isAdmin,
      hasFilters: !!filters
    });
    fetchTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isAdmin, filters?.status, filters?.search, filters?.dateFrom, filters?.dateTo]);

  return {
    tickets,
    ticketGroups,
    stats,
    loading,
    error,
    refetch: fetchTickets
  };
}