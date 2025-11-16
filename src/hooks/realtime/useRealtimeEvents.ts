import { useCallback, useMemo } from 'react';
import { useRealtimeSync } from './useRealtimeSync';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../useAuth';

// Tipos para eventos e ingressos
interface Ticket {
  id: string;
  event_id: string;
  user_id: string;
  ticket_type: 'standard' | 'vip' | 'premium';
  price: number;
  status: 'active' | 'used' | 'cancelled' | 'expired';
  purchase_date: string;
  qr_code?: string;
  seat_number?: string;
  created_at: string;
  updated_at: string;
  // Dados relacionados
  events?: Event;
  profiles?: {
    id: string;
    full_name?: string;
    email?: string;
  };
}

interface Event {
  id: string;
  name: string;
  description?: string;
  date: string;
  location: string;
  max_capacity: number;
  current_capacity: number;
  price: number;
  vip_price?: number;
  premium_price?: number;
  image_url?: string;
  is_active: boolean;
  registration_deadline?: string;
  created_at: string;
  updated_at: string;
  // Dados relacionados
  tickets?: Ticket[];
}

interface EventFilters {
  isActive?: boolean;
  dateFrom?: string;
  dateTo?: string;
  location?: string;
  hasAvailableTickets?: boolean;
}

interface UseRealtimeEventsReturn {
  events: Event[];
  loading: boolean;
  error: Error | null;
  isConnected: boolean;
  refetch: () => void;
  getEventById: (id: string) => Event | undefined;
  getAvailableTickets: (eventId: string) => number;
  isEventAvailable: (eventId: string) => boolean;
  getEventsByDate: (date: string) => Event[];
  getUpcomingEvents: () => Event[];
}

/**
 * Hook para sincronização em tempo real de eventos
 * Inclui controle de capacidade e disponibilidade
 */
export function useRealtimeEvents(filters?: EventFilters): UseRealtimeEventsReturn {
  // Construir filtro baseado nos parâmetros
  const filter = useMemo(() => {
    const conditions: string[] = [];
    
    if (filters?.isActive !== undefined) {
      conditions.push(`is_active=eq.${filters.isActive}`);
    }
    
    if (filters?.dateFrom) {
      conditions.push(`event_date=gte.${filters.dateFrom}`);
    }
    
    if (filters?.dateTo) {
      conditions.push(`event_date=lte.${filters.dateTo}`);
    }
    
    if (filters?.location) {
      conditions.push(`location=ilike.%${filters.location}%`);
    }
    
    return conditions.length > 0 ? conditions.join(',') : undefined;
  }, [filters]);

  // Hook de sincronização com joins
  const {
    data: events,
    loading,
    error,
    isConnected,
    refetch
  } = useRealtimeSync<Event>({
    table: 'events',
    filter,
    select: `
      *,
      tickets (
        id,
        event_id,
        user_id,
        ticket_type,
        price,
        status,
        purchase_date,
        seat_number
      )
    `,
    orderBy: 'event_date:asc',
    enableOptimistic: false,
    onUpdate: (updatedEvent) => {
      console.log('Evento atualizado:', updatedEvent.title);
      
      // Notificar quando evento está próximo da capacidade máxima
      const availableTickets = updatedEvent.max_capacity - updatedEvent.current_capacity;
      if (availableTickets <= 10 && availableTickets > 0) {
        console.log(`Atenção: Apenas ${availableTickets} ingressos restantes para ${updatedEvent.title}`);
      }
    },
    onError: (error) => {
      console.error('Erro no eventos realtime:', error);
    }
  });

  // Filtrar eventos com ingressos disponíveis (client-side)
  const filteredEvents = useMemo(() => {
    if (!filters?.hasAvailableTickets) return events;
    
    return events.filter(event => {
      const availableTickets = event.max_capacity - event.current_capacity;
      return availableTickets > 0 && event.is_active;
    });
  }, [events, filters?.hasAvailableTickets]);

  // Buscar evento por ID
  const getEventById = useCallback((id: string): Event | undefined => {
    return filteredEvents.find(event => event.id === id);
  }, [filteredEvents]);

  // Obter número de ingressos disponíveis
  const getAvailableTickets = useCallback((eventId: string): number => {
    const event = getEventById(eventId);
    if (!event) return 0;
    
    return Math.max(0, event.max_capacity - event.current_capacity);
  }, [getEventById]);

  // Verificar se evento está disponível para compra
  const isEventAvailable = useCallback((eventId: string): boolean => {
    const event = getEventById(eventId);
    if (!event || !event.is_active) return false;
    
    // Verificar se ainda há ingressos
    const availableTickets = getAvailableTickets(eventId);
    if (availableTickets <= 0) return false;
    
    // Verificar se não passou do prazo de inscrição
    if (event.registration_deadline) {
      const deadline = new Date(event.registration_deadline);
      if (new Date() > deadline) return false;
    }
    
    // Verificar se evento não já aconteceu
    const eventDate = new Date(event.event_date);
    if (new Date() > eventDate) return false;
    
    return true;
  }, [getEventById, getAvailableTickets]);

  // Obter eventos por data específica
  const getEventsByDate = useCallback((date: string): Event[] => {
    const targetDate = new Date(date).toDateString();
    return filteredEvents.filter(event => {
      const eventDate = new Date(event.event_date).toDateString();
      return eventDate === targetDate;
    });
  }, [filteredEvents]);

  // Obter eventos futuros
  const getUpcomingEvents = useCallback((): Event[] => {
    const now = new Date();
    return filteredEvents.filter(event => {
      const eventDate = new Date(event.event_date);
      return eventDate > now;
    });
  }, [filteredEvents]);

  return {
    events: filteredEvents,
    loading,
    error,
    isConnected,
    refetch,
    getEventById,
    getAvailableTickets,
    isEventAvailable,
    getEventsByDate,
    getUpcomingEvents
  };
}

/**
 * Hook para sincronização de ingressos do usuário
 */
export function useRealtimeTickets(eventId?: string) {
  const { user } = useAuth();
  
  // Construir filtro para ingressos do usuário
  const filter = useMemo(() => {
    const conditions: string[] = [];
    
    if (user) {
      conditions.push(`user_id=eq.${user.id}`);
    }
    
    if (eventId) {
      conditions.push(`event_id=eq.${eventId}`);
    }
    
    return conditions.length > 0 ? conditions.join(',') : undefined;
  }, [user?.id, eventId]);

  const {
    data: tickets,
    loading,
    error,
    isConnected,
    refetch
  } = useRealtimeSync<Ticket>({
    table: 'tickets',
    filter,
    select: `
      *,
      events:event_id (
        id,
        title,
        event_date,
        location,
        image_url
      ),
      profiles:id (
        id,
        full_name,
        email
      )
    `,
    orderBy: 'purchase_date:desc',
    enableOptimistic: true,
    onUpdate: (updatedTicket) => {
      console.log('Ingresso atualizado:', updatedTicket.id, updatedTicket.status);
      
      if (updatedTicket.status === 'used') {
        console.log('Ingresso utilizado:', updatedTicket.id);
      }
    }
  });

  // Comprar ingresso
  const purchaseTicket = useCallback(async (
    eventId: string, 
    ticketType: Ticket['ticket_type'] = 'standard',
    seatNumber?: string
  ): Promise<string> => {
    if (!user) {
      throw new Error('Usuário não autenticado');
    }

    try {
      // Verificar disponibilidade do evento
      const { data: event, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (eventError || !event) {
        throw new Error('Evento não encontrado');
      }

      if (!event.is_active) {
        throw new Error('Evento não está ativo');
      }

      if (event.current_capacity >= event.max_capacity) {
        throw new Error('Evento esgotado');
      }

      // Determinar preço baseado no tipo de ingresso
      let price = event.ticket_price;
      if (ticketType === 'vip' && event.vip_price) {
        price = event.vip_price;
      } else if (ticketType === 'premium' && event.premium_price) {
        price = event.premium_price;
      }

      // Criar ingresso
      const { data: ticket, error: ticketError } = await supabase
        .from('tickets')
        .insert({
          event_id: eventId,
          user_id: user.id,
          ticket_type: ticketType,
          price,
          status: 'active',
          purchase_date: new Date().toISOString(),
          seat_number: seatNumber
        })
        .select('id')
        .single();

      if (ticketError || !ticket) {
        throw new Error(`Erro ao criar ingresso: ${ticketError?.message}`);
      }

      // Atualizar capacidade do evento
      const { error: updateError } = await supabase
        .from('events')
        .update({ 
          current_capacity: event.current_capacity + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', eventId);

      if (updateError) {
        // Rollback: deletar ingresso se falhou ao atualizar evento
        await supabase.from('tickets').delete().eq('id', ticket.id);
        throw new Error(`Erro ao atualizar capacidade do evento: ${updateError.message}`);
      }

      console.log('Ingresso comprado com sucesso:', ticket.id);
      return ticket.id;
    } catch (error) {
      console.error('Erro ao comprar ingresso:', error);
      throw error;
    }
  }, [user]);

  // Cancelar ingresso
  const cancelTicket = useCallback(async (ticketId: string): Promise<void> => {
    if (!user) {
      throw new Error('Usuário não autenticado');
    }

    try {
      const ticket = tickets.find(t => t.id === ticketId);
      if (!ticket) {
        throw new Error('Ingresso não encontrado');
      }

      if (ticket.status !== 'active') {
        throw new Error('Ingresso não pode ser cancelado');
      }

      // Verificar se evento ainda não aconteceu
      if (ticket.events) {
        const eventDate = new Date(ticket.events.event_date);
        const now = new Date();
        const hoursUntilEvent = (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60);
        
        if (hoursUntilEvent < 24) {
          throw new Error('Não é possível cancelar ingresso com menos de 24h do evento');
        }
      }

      // Cancelar ingresso
      const { error: ticketError } = await supabase
        .from('tickets')
        .update({ 
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', ticketId)
        .eq('user_id', user.id); // Segurança adicional

      if (ticketError) {
        throw new Error(`Erro ao cancelar ingresso: ${ticketError.message}`);
      }

      // Atualizar capacidade do evento
      if (ticket.event_id) {
        const { error: updateError } = await supabase
          .rpc('decrement_event_capacity', { event_id: ticket.event_id });

        if (updateError) {
          console.warn('Erro ao atualizar capacidade do evento:', updateError);
        }
      }

      console.log('Ingresso cancelado com sucesso:', ticketId);
    } catch (error) {
      console.error('Erro ao cancelar ingresso:', error);
      throw error;
    }
  }, [user, tickets]);

  // Usar ingresso (check-in)
  const useTicket = useCallback(async (ticketId: string): Promise<void> => {
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ 
          status: 'used',
          updated_at: new Date().toISOString()
        })
        .eq('id', ticketId);

      if (error) {
        throw new Error(`Erro ao usar ingresso: ${error.message}`);
      }

      console.log('Check-in realizado:', ticketId);
    } catch (error) {
      console.error('Erro no check-in:', error);
      throw error;
    }
  }, []);

  return {
    tickets,
    loading,
    error,
    isConnected,
    refetch,
    purchaseTicket,
    cancelTicket,
    useTicket
  };
}

/**
 * Hook para dashboard de eventos (admin)
 */
export function useEventsDashboard() {
  const { events, loading, error, isConnected } = useRealtimeEvents();
  const { tickets } = useRealtimeTickets();

  // Estatísticas dos eventos
  const stats = useMemo(() => {
    const totalEvents = events.length;
    const activeEvents = events.filter(e => e.is_active).length;
    const upcomingEvents = events.filter(e => new Date(e.event_date) > new Date()).length;
    const totalCapacity = events.reduce((sum, e) => sum + e.max_capacity, 0);
    const totalSold = events.reduce((sum, e) => sum + e.current_capacity, 0);
    const totalRevenue = tickets
      .filter(t => t.status === 'active' || t.status === 'used')
      .reduce((sum, t) => sum + t.price, 0);

    return {
      totalEvents,
      activeEvents,
      upcomingEvents,
      totalCapacity,
      totalSold,
      occupancyRate: totalCapacity > 0 ? (totalSold / totalCapacity) * 100 : 0,
      totalRevenue
    };
  }, [events, tickets]);

  // Eventos que precisam de atenção
  const alertEvents = useMemo(() => {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    return events.filter(event => {
      const eventDate = new Date(event.event_date);
      const availableTickets = event.max_capacity - event.current_capacity;
      
      // Eventos amanhã com baixa ocupação
      return eventDate <= tomorrow && eventDate > now && availableTickets > event.max_capacity * 0.5;
    });
  }, [events]);

  return {
    events,
    stats,
    alertEvents,
    loading,
    error,
    isConnected
  };
}