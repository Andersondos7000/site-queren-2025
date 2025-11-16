import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

// Interface para ticket baseada na estrutura do banco
interface Ticket {
  id: string;
  event_id: string | null;
  customer_id: string | null;
  order_id: string | null;
  ticket_type: string | null;
  quantity: number;
  unit_price: number | null;
  total_price: number | null;
  price: number;
  status: string | null;
  created_at: string | null;
  user_id: string | null;
  qr_code: string | null;
  ticket_number: string | null; // Número lógico do ticket (ex: orderId-item-1)
  seat_number: string | null; // Número sequencial do assento (0001-1300)
  // Dados relacionados do evento
  events?: {
    id: string;
    name: string;
    event_date: string | null;
    date: string;
    location: string | null;
  };
  // Dados do cliente
  customers?: {
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
  };
  // Dados do pedido
  orders?: {
    id: string;
    created_at: string;
    customer_name: string | null;
    customer_email: string | null;
    customer_data: any;
    status: string;
    payment_status: string;
    total_amount: number | null;
  };
}

interface TicketFilters {
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

interface UseTicketsDashboardReturn {
  tickets: Ticket[];
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

export function useTicketsDashboard(
  filters?: TicketFilters,
  itemsPerPage: number = 20
): UseTicketsDashboardReturn {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Função para buscar tickets
  const fetchTickets = async () => {
    try {
      setLoading(true);
      setError(null);

      // Construir query base
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
          customers!customer_id (
            id,
            full_name,
            email,
            phone
          ),
          orders!order_id (
            id,
            created_at,
            customer_name,
            customer_email,
            customer_data,
            status,
            payment_status,
            total_amount
          )
        `, { count: 'exact' });

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

      // 🔧 CORREÇÃO: Buscar TODOS os tickets primeiro (sem paginação)
      // A paginação será aplicada DEPOIS do agrupamento no componente
      // Isso garante que todos os pedidos sejam agrupados corretamente
      query = query
        .limit(10000) // Limite alto para buscar todos os tickets
        .order('created_at', { ascending: false });

      const { data, error: fetchError, count } = await query;

      if (fetchError) {
        throw new Error(`Erro ao buscar tickets: ${fetchError.message}`);
      }

      let filteredData = data || [];

      // Se há busca, filtrar também por ID, email e nome do cliente
      if (filters?.search && data) {
        const searchTerm = filters.search.toLowerCase();
        filteredData = data.filter(ticket => {
          const matchesId = ticket.id?.toLowerCase().includes(searchTerm);
          const matchesTicketType = ticket.ticket_type?.toLowerCase().includes(searchTerm);
          const matchesQrCode = ticket.qr_code?.toLowerCase().includes(searchTerm);
          const matchesEmail = ticket.customers?.email?.toLowerCase().includes(searchTerm);
          const matchesName = ticket.customers?.full_name?.toLowerCase().includes(searchTerm);
          
          return matchesId || matchesTicketType || matchesQrCode || matchesEmail || matchesName;
        });
      }

      setTickets(filteredData);
      setTotalCount(filteredData.length);
    } catch (err) {
      console.error('Erro ao buscar tickets:', err);
      setError(err instanceof Error ? err : new Error('Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  // Buscar dados quando componente monta ou filtros mudam
  useEffect(() => {
    fetchTickets();
    fetchGlobalStats();
  }, [currentPage, filters?.status, filters?.dateFrom, filters?.dateTo, filters?.search]);

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
      // Buscar estatísticas reais do banco de dados
      const { data: tickets, error } = await supabase
        .from('tickets')
        .select('status, total_price, price, quantity');

      if (error) {
        console.error('❌ Erro ao buscar tickets:', error);
        throw error;
      }

      // Calcular estatísticas baseadas nos dados reais
      const stats = {
        // Total de ingressos = soma das quantidades (não número de registros)
        total: tickets?.reduce((sum, ticket) => sum + (ticket.quantity || 0), 0) || 0,
        // Ativos = soma das quantidades dos tickets com status 'active'
        active: tickets?.filter(t => t.status === 'active').reduce((sum, ticket) => sum + (ticket.quantity || 0), 0) || 0,
        // Utilizados = soma das quantidades dos tickets com status 'used'
        used: tickets?.filter(t => t.status === 'used').reduce((sum, ticket) => sum + (ticket.quantity || 0), 0) || 0,
        // Cancelados = soma das quantidades dos tickets com status 'cancelled'
        cancelled: tickets?.filter(t => t.status === 'cancelled').reduce((sum, ticket) => sum + (ticket.quantity || 0), 0) || 0,
        // Receita total = soma dos valores totais (já em centavos, converter para reais)
        totalRevenue: tickets?.reduce((sum, ticket) => {
          // Se tem total_price, usar ele diretamente (já é o valor total)
          // Se não, calcular price * quantity
          const totalValue = ticket.total_price || (ticket.price || 0) * (ticket.quantity || 1);
          // Os valores já estão em reais no banco de dados
          return sum + totalValue;
        }, 0) || 0
      };

      setGlobalStats(stats);

    } catch (error) {
      console.error('❌ Erro em fetchGlobalStats:', error);
      setGlobalStats({
        total: 0,
        active: 0,
        used: 0,
        cancelled: 0,
        totalRevenue: 0
      });
    }
  };

  // useEffect para buscar estatísticas globais
  useEffect(() => {
    fetchGlobalStats();
  }, [filters?.status, filters?.dateFrom, filters?.dateTo]);

  // Calcular estatísticas da página atual (para compatibilidade)
  const stats = useMemo(() => {
    return globalStats;
  }, [globalStats]);

  // Calcular paginação
  const totalPages = Math.ceil(totalCount / itemsPerPage);
  const hasNextPage = currentPage < totalPages;
  const hasPreviousPage = currentPage > 1;

  return {
    tickets,
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