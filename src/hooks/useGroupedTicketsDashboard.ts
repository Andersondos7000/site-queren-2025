import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { TicketGroup, Ticket, TicketFilters } from '../types/ticket';

interface UseGroupedTicketsDashboardReturn {
  ticketGroups: TicketGroup[];
  stats: {
    total: number;
    active: number;
    used: number;
    cancelled: number;
    totalRevenue: number;
  };
  loading: boolean;
  error: Error | null;
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  setCurrentPage: (page: number) => void;
  refetch: () => void;
}

export function useGroupedTicketsDashboard(
  filters?: TicketFilters,
  itemsPerPage: number = 20
): UseGroupedTicketsDashboardReturn {
  const { user } = useAuth();
  const [ticketGroups, setTicketGroups] = useState<TicketGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Função para buscar tickets e agrupar por order_id
  const fetchTickets = async () => {
    try {
      setLoading(true);
      setError(null);

      // Buscar todos os tickets com dados relacionados
      let query = supabase
        .from('tickets')
        .select(`
          *,
          events (
            id,
            name,
            event_date,
            date,
            location
          ),
          orders!order_id (
            id,
            total_amount,
            status,
            payment_status,
            created_at,
            customer_data,
            customer_name,
            customer_email,
            customer_phone
          )
        `);

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

      query = query.order('created_at', { ascending: false });

      const { data, error: fetchError } = await query;

      if (fetchError) {
        throw new Error(`Erro ao buscar tickets: ${fetchError.message}`);
      }

      let tickets = data || [];

      // Aplicar filtro de busca se necessário
      if (filters?.search) {
        const searchTerm = filters.search.toLowerCase();
        tickets = tickets.filter(ticket => {
          const matchesId = ticket.id?.toLowerCase().includes(searchTerm);
          const matchesTicketType = ticket.ticket_type?.toLowerCase().includes(searchTerm);
          const matchesQrCode = ticket.qr_code?.toLowerCase().includes(searchTerm);
          const matchesEmail = ticket.customers?.email?.toLowerCase().includes(searchTerm);
          const matchesName = ticket.customers?.full_name?.toLowerCase().includes(searchTerm);
          
          return matchesId || matchesTicketType || matchesQrCode || matchesEmail || matchesName;
        });
      }

      // Agrupar tickets por order_id
      const groupedTickets = groupTicketsByOrder(tickets);

      // Aplicar paginação aos grupos
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage;
      const paginatedGroups = groupedTickets.slice(from, to);

      setTicketGroups(paginatedGroups);
      setTotalCount(groupedTickets.length);
    } catch (err) {
      console.error('Erro ao buscar tickets:', err);
      setError(err instanceof Error ? err : new Error('Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  // Função para agrupar tickets por order_id
  const groupTicketsByOrder = (tickets: Ticket[]): TicketGroup[] => {
    const orderGroups = new Map<string, Ticket[]>();
    const singleTickets: Ticket[] = [];

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
      if (orderTickets.length > 1) {
        // É um pacote - agrupar
        const firstTicket = orderTickets[0];
        const totalQuantity = orderTickets.reduce((sum, t) => sum + t.quantity, 0);
        const totalValue = orderTickets.reduce((sum, t) => sum + ((t.price || 0) * t.quantity), 0);

        groups.push({
          id: orderId,
          type: 'package',
          order_id: orderId,
          customer_name: firstTicket.orders?.customer_data?.name || firstTicket.orders?.customer_name || 'Cliente não encontrado',
          customer_email: firstTicket.orders?.customer_data?.email || firstTicket.orders?.customer_email || '',
          event_name: firstTicket.events?.name || 'Evento não encontrado',
          ticket_count: orderTickets.length,
          total_quantity: totalQuantity,
          unit_price: firstTicket.price || 0,
          total_value: totalValue,
          status: firstTicket.status || 'unknown',
          created_at: firstTicket.orders?.created_at || firstTicket.created_at || '',
          tickets: orderTickets,
          // Para compatibilidade
          quantity: totalQuantity,
          price: totalValue,
          customers: {
            full_name: firstTicket.orders?.customer_data?.name || firstTicket.orders?.customer_name || '',
            email: firstTicket.orders?.customer_data?.email || firstTicket.orders?.customer_email || ''
          },
          events: {
            name: firstTicket.events?.name || ''
          }
        });
      } else {
        // Apenas 1 ticket no pedido - tratar como individual
        singleTickets.push(...orderTickets);
      }
    });

    // Processar tickets individuais
    singleTickets.forEach(ticket => {
      const quantity = ticket.quantity || 1;
      // Usar unit_price se disponível, senão calcular a partir do price total
      const unitPrice = ticket.unit_price || (ticket.price ? ticket.price / quantity : 0);
      
      // Se quantity > 1, criar itens individuais para cada quantidade
      if (quantity > 1) {
        // Criar um grupo principal para o ticket com múltiplas quantidades
        const totalValue = unitPrice * quantity;
        
        // Criar tickets individuais virtuais para cada quantidade
        const individualTickets = Array.from({ length: quantity }, (_, index) => ({
          ...ticket,
          id: `${ticket.id}-item-${index + 1}`, // ID único para cada item (mantido para compatibilidade)
          display_id: ticket.ticket_number, // 🎯 CORRIGIDO: Usar sempre o ticket_number aleatório do banco
          quantity: 1, // Cada item individual tem quantidade 1
          price: unitPrice,
          item_number: index + 1, // Número do item (1, 2, 3, etc.)
          parent_ticket_id: ticket.id // Referência ao ticket original
        }));
        
        groups.push({
          id: ticket.id,
          type: 'package', // Mudança: tickets com quantity > 1 são pacotes
          order_id: ticket.order_id,
          customer_name: ticket.orders?.customer_data?.name || ticket.orders?.customer_name || 'Cliente não encontrado',
          customer_email: ticket.orders?.customer_data?.email || ticket.orders?.customer_email || '',
          event_name: ticket.events?.name || 'Evento não encontrado',
          ticket_count: quantity, // Número total de itens
          total_quantity: quantity,
          unit_price: unitPrice,
          total_value: totalValue,
          status: ticket.status || 'unknown',
          created_at: ticket.orders?.created_at || ticket.created_at || '',
          tickets: individualTickets, // Array com todos os itens individuais
          // Para compatibilidade
          quantity: quantity,
          price: totalValue, // Usar valor total
          customers: {
            full_name: ticket.orders?.customer_data?.name || ticket.orders?.customer_name || '',
            email: ticket.orders?.customer_data?.email || ticket.orders?.customer_email || ''
          },
          events: {
            name: ticket.events?.name || ''
          },
          // Flag para indicar que tem múltiplos itens
          hasMultipleItems: true
        });
      } else {
        // Ticket com quantidade 1 - comportamento normal
        // Garantir que o ticket único também tenha display_id
        const ticketWithDisplayId = {
          ...ticket,
          display_id: ticket.ticket_number // 🎯 CORRIGIDO: Usar sempre o ticket_number aleatório do banco
        };
        
        groups.push({
          id: ticket.id,
          type: 'single',
          order_id: ticket.order_id,
          customer_name: ticket.orders?.customer_data?.name || ticket.orders?.customer_name || 'Cliente não encontrado',
          customer_email: ticket.orders?.customer_data?.email || ticket.orders?.customer_email || '',
          event_name: ticket.events?.name || 'Evento não encontrado',
          ticket_count: 1,
          total_quantity: 1,
          unit_price: unitPrice,
          total_value: unitPrice,
          status: ticket.status || 'unknown',
          created_at: ticket.orders?.created_at || ticket.created_at || '',
          tickets: [ticketWithDisplayId], // 🎯 CORRIGIDO: Usar ticket com display_id
          // Para compatibilidade
          quantity: 1,
          price: unitPrice,
          customers: {
            full_name: ticket.orders?.customer_data?.name || ticket.orders?.customer_name || '',
            email: ticket.orders?.customer_data?.email || ticket.orders?.customer_email || ''
          },
          events: {
            name: ticket.events?.name || ''
          },
          hasMultipleItems: false
        });
      }
    });

    // Ordenar por data de criação (mais recente primeiro)
    return groups.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  };

  // Estado para estatísticas globais
  const [globalStats, setGlobalStats] = useState({
    total: 0,
    active: 0,
    used: 0,
    cancelled: 0,
    totalRevenue: 0
  });

  // Função para buscar estatísticas globais
  const fetchGlobalStats = async () => {
    try {
      // Construir query base para estatísticas
      let statsQuery = supabase
        .from('tickets')
        .select('status, quantity, total_price, price');

      // Aplicar os mesmos filtros das estatísticas
      if (filters?.status && filters.status !== 'all') {
        statsQuery = statsQuery.eq('status', filters.status);
      }

      if (filters?.dateFrom) {
        statsQuery = statsQuery.gte('created_at', filters.dateFrom);
      }

      if (filters?.dateTo) {
        statsQuery = statsQuery.lte('created_at', filters.dateTo);
      }

      const { data: allTickets, error: statsError } = await statsQuery;

      if (statsError) {
        throw new Error(`Erro ao buscar estatísticas: ${statsError.message}`);
      }

      if (allTickets) {
        const total = allTickets.reduce((sum, ticket) => sum + ticket.quantity, 0);
        const active = allTickets.filter(ticket => ticket.status === 'active').reduce((sum, ticket) => sum + ticket.quantity, 0);
        const used = allTickets.filter(ticket => ticket.status === 'used').reduce((sum, ticket) => sum + ticket.quantity, 0);
        const cancelled = allTickets.filter(ticket => ticket.status === 'cancelled').reduce((sum, ticket) => sum + ticket.quantity, 0);
        
        const totalRevenue = allTickets
          .filter(ticket => ticket.status === 'active' || ticket.status === 'used')
          .reduce((sum, ticket) => {
            const ticketValue = ticket.total_price || (ticket.price || 0) * ticket.quantity;
            // Os valores já estão em reais no banco de dados
            return sum + ticketValue;
          }, 0);

        setGlobalStats({
          total,
          active,
          used,
          cancelled,
          totalRevenue
        });
      }
    } catch (err) {
      console.error('Erro ao buscar estatísticas globais:', err);
    }
  };

  // Buscar dados quando componente monta ou filtros mudam
  useEffect(() => {
    fetchTickets();
    fetchGlobalStats();
  }, [currentPage, filters?.status, filters?.dateFrom, filters?.dateTo, filters?.search]);

  // Calcular estatísticas (usar estatísticas globais)
  const stats = useMemo(() => {
    return globalStats;
  }, [globalStats]);

  // Calcular paginação
  const totalPages = Math.ceil(totalCount / itemsPerPage);
  const hasNextPage = currentPage < totalPages;
  const hasPreviousPage = currentPage > 1;

  return {
    ticketGroups,
    stats,
    loading,
    error,
    currentPage,
    totalPages,
    hasNextPage,
    hasPreviousPage,
    setCurrentPage,
    refetch: fetchTickets
  };
}