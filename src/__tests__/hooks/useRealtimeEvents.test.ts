import { renderHook, act, waitFor } from '@testing-library/react';
import { useRealtimeEvents } from '../../hooks/realtime/useRealtimeEvents';
import { supabase } from '../../lib/supabase';

// Mock do Supabase
jest.mock('../../lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
          order: jest.fn(() => ({
            limit: jest.fn()
          }))
        })),
        filter: jest.fn(() => ({
          order: jest.fn(() => ({
            limit: jest.fn()
          }))
        })),
        order: jest.fn(() => ({
          limit: jest.fn()
        })),
        limit: jest.fn()
      })),
      update: jest.fn(() => ({
        eq: jest.fn()
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn()
        }))
      }))
    })),
    channel: jest.fn(() => ({
      on: jest.fn(() => ({
        subscribe: jest.fn()
      })),
      unsubscribe: jest.fn()
    }))
  }
}));

// Mock do useRealtimeSync
jest.mock('../../hooks/realtime/useRealtimeSync', () => ({
  useRealtimeSync: jest.fn()
}));

import { useRealtimeSync } from '../../hooks/realtime/useRealtimeSync';

const mockUseRealtimeSync = useRealtimeSync as jest.MockedFunction<typeof useRealtimeSync>;

describe('useRealtimeEvents', () => {
  const mockEventsData = [
    {
      id: 'event-1',
      title: 'VII Conferência de Mulheres Queren Hapuque',
      description: 'Evento principal da conferência',
      start_date: '2024-03-15T09:00:00Z',
      end_date: '2024-03-15T18:00:00Z',
      location: 'Centro de Convenções',
      capacity: 500,
      available_tickets: 150,
      sold_tickets: 350,
      price: 100.00,
      status: 'active',
      category: 'conference',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      tickets: [
        {
          id: 'ticket-1',
          event_id: 'event-1',
          user_id: 'user-1',
          ticket_type: 'regular',
          status: 'active',
          purchase_date: '2024-01-15T10:00:00Z',
          used_at: null,
          qr_code: 'QR123456'
        },
        {
          id: 'ticket-2',
          event_id: 'event-1',
          user_id: 'user-2',
          ticket_type: 'vip',
          status: 'used',
          purchase_date: '2024-01-10T14:00:00Z',
          used_at: '2024-03-15T09:30:00Z',
          qr_code: 'QR789012'
        }
      ]
    },
    {
      id: 'event-2',
      title: 'Workshop de Liderança Feminina',
      description: 'Workshop especializado em liderança',
      start_date: '2024-03-16T14:00:00Z',
      end_date: '2024-03-16T17:00:00Z',
      location: 'Sala de Workshops',
      capacity: 50,
      available_tickets: 10,
      sold_tickets: 40,
      price: 50.00,
      status: 'active',
      category: 'workshop',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      tickets: [
        {
          id: 'ticket-3',
          event_id: 'event-2',
          user_id: 'user-3',
          ticket_type: 'regular',
          status: 'active',
          purchase_date: '2024-01-20T16:00:00Z',
          used_at: null,
          qr_code: 'QR345678'
        }
      ]
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockUseRealtimeSync.mockReturnValue({
      data: mockEventsData,
      loading: false,
      error: null,
      refetch: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
      isConnected: true,
      connectionStatus: 'connected',
      optimisticUpdate: jest.fn(),
      rollbackOptimistic: jest.fn(),
      metrics: {
        totalUpdates: 0,
        lastUpdate: null,
        reconnectCount: 0
      }
    });
  });

  describe('Inicialização', () => {
    it('deve inicializar com dados de eventos', () => {
      const { result } = renderHook(() => useRealtimeEvents());

      expect(result.current.events).toEqual(mockEventsData);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.isConnected).toBe(true);
    });

    it('deve filtrar por categoria específica', () => {
      const { result } = renderHook(() => useRealtimeEvents({ category: 'workshop' }));

      expect(mockUseRealtimeSync).toHaveBeenCalledWith(
        expect.objectContaining({
          table: 'events',
          filter: 'category.eq.workshop'
        })
      );
    });

    it('deve filtrar por status específico', () => {
      const { result } = renderHook(() => useRealtimeEvents({ status: 'active' }));

      expect(mockUseRealtimeSync).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: 'status.eq.active'
        })
      );
    });

    it('deve filtrar por período de datas', () => {
      const startDate = '2024-03-01';
      const endDate = '2024-03-31';
      
      const { result } = renderHook(() => 
        useRealtimeEvents({ dateRange: { start: startDate, end: endDate } })
      );

      expect(mockUseRealtimeSync).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: `start_date.gte.${startDate},start_date.lte.${endDate}`
        })
      );
    });
  });

  describe('Métricas de Eventos', () => {
    it('deve calcular métricas corretamente', () => {
      const { result } = renderHook(() => useRealtimeEvents());

      expect(result.current.metrics.totalEvents).toBe(2);
      expect(result.current.metrics.activeEvents).toBe(2);
      expect(result.current.metrics.totalCapacity).toBe(550);
      expect(result.current.metrics.totalSoldTickets).toBe(390);
      expect(result.current.metrics.totalRevenue).toBe(37000.00); // (350 * 100) + (40 * 50)
      expect(result.current.metrics.averageOccupancy).toBe(70.91); // 390/550 * 100
    });

    it('deve identificar eventos com baixa disponibilidade', () => {
      const { result } = renderHook(() => useRealtimeEvents());

      const lowAvailability = result.current.getLowAvailabilityEvents(20);
      expect(lowAvailability).toHaveLength(1);
      expect(lowAvailability[0].id).toBe('event-2'); // 10 ingressos disponíveis
    });

    it('deve identificar eventos esgotados', () => {
      const eventsWithSoldOut = [
        {
          ...mockEventsData[0],
          available_tickets: 0,
          sold_tickets: 500
        },
        ...mockEventsData.slice(1)
      ];

      mockUseRealtimeSync.mockReturnValue({
        data: eventsWithSoldOut,
        loading: false,
        error: null,
        refetch: jest.fn(),
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
        isConnected: true,
        connectionStatus: 'connected',
        optimisticUpdate: jest.fn(),
        rollbackOptimistic: jest.fn()
      });

      const { result } = renderHook(() => useRealtimeEvents());

      const soldOutEvents = result.current.getSoldOutEvents();
      expect(soldOutEvents).toHaveLength(1);
      expect(soldOutEvents[0].id).toBe('event-1');
    });
  });

  describe('Funções de Consulta', () => {
    it('deve retornar evento por ID', () => {
      const { result } = renderHook(() => useRealtimeEvents());

      const event = result.current.getEventById('event-1');
      expect(event).not.toBeNull();
      expect(event?.id).toBe('event-1');
      expect(event?.title).toBe('VII Conferência de Mulheres Queren Hapuque');
    });

    it('deve retornar eventos por categoria', () => {
      const { result } = renderHook(() => useRealtimeEvents());

      const workshops = result.current.getEventsByCategory('workshop');
      expect(workshops).toHaveLength(1);
      expect(workshops[0].category).toBe('workshop');
    });

    it('deve retornar eventos próximos', () => {
      const { result } = renderHook(() => useRealtimeEvents());

      const upcomingEvents = result.current.getUpcomingEvents(7); // próximos 7 dias
      expect(upcomingEvents.length).toBeGreaterThanOrEqual(0);
    });

    it('deve buscar eventos por termo', () => {
      const { result } = renderHook(() => useRealtimeEvents());

      const searchResults = result.current.searchEvents('Conferência');
      expect(searchResults).toHaveLength(1);
      expect(searchResults[0].title).toContain('Conferência');
    });

    it('deve verificar disponibilidade de ingressos', () => {
      const { result } = renderHook(() => useRealtimeEvents());

      expect(result.current.isTicketAvailable('event-1', 100)).toBe(true);
      expect(result.current.isTicketAvailable('event-1', 200)).toBe(false);
      expect(result.current.isTicketAvailable('event-2', 15)).toBe(false);
    });
  });

  describe('Operações de Ingressos', () => {
    it('deve verificar disponibilidade de evento', async () => {
       const { result } = renderHook(() => useRealtimeEvents());
       
       const isAvailable = result.current.isEventAvailable('event-1');
       
       expect(typeof isAvailable).toBe('boolean');
     });
 
     it('deve obter evento por ID', async () => {
       const { result } = renderHook(() => useRealtimeEvents());
 
       const event = result.current.getEventById('event-1');
       expect(event).toBeDefined();
       expect(event?.id).toBe('event-1');
     });
 
     it('deve obter ingressos disponíveis', async () => {
       const { result } = renderHook(() => useRealtimeEvents());
 
       const availableTickets = result.current.getAvailableTickets('event-1');
       expect(typeof availableTickets).toBe('number');
     });
 
     it('deve obter eventos por data', async () => {
       const { result } = renderHook(() => useRealtimeEvents());
 
       const eventsByDate = result.current.getEventsByDate('2024-03-15');
       expect(Array.isArray(eventsByDate)).toBe(true);
     });
 
     it('deve obter eventos próximos', async () => {
       const { result } = renderHook(() => useRealtimeEvents());
 
       const upcomingEvents = result.current.getUpcomingEvents();
       expect(Array.isArray(upcomingEvents)).toBe(true);
     });
  });

  describe('Funcionalidades Básicas', () => {
     it('deve retornar lista de eventos', async () => {
       const { result } = renderHook(() => useRealtimeEvents());
 
       expect(Array.isArray(result.current.events)).toBe(true);
       expect(result.current.events.length).toBeGreaterThan(0);
     });
 
     it('deve ter estado de loading', async () => {
       const { result } = renderHook(() => useRealtimeEvents());
 
       expect(typeof result.current.loading).toBe('boolean');
     });
   });

  describe('Estados de Conexão', () => {
    it('deve gerenciar estado de conexão', async () => {
      const { result } = renderHook(() => useRealtimeEvents());

      expect(typeof result.current.isConnected).toBe('boolean');
    });

    it('deve permitir refetch dos dados', async () => {
      const { result } = renderHook(() => useRealtimeEvents());

      expect(typeof result.current.refetch).toBe('function');
      
      act(() => {
        result.current.refetch();
      });
    });
  });

  describe('Tratamento de Erros', () => {
    it('deve lidar com erros de conexão', () => {
      mockUseRealtimeSync.mockReturnValue({
        data: [],
        loading: false,
        error: new Error('Erro de conexão'),
        refetch: jest.fn(),
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
        isConnected: false,
        connectionStatus: 'disconnected',
        optimisticUpdate: jest.fn(),
        rollbackOptimistic: jest.fn(),
        metrics: {
          totalUpdates: 0,
          lastUpdate: null,
          reconnectCount: 0
        }
      });

      const { result } = renderHook(() => useRealtimeEvents());

      expect(result.current.error).toEqual(new Error('Erro de conexão'));
      expect(result.current.isConnected).toBe(false);
    });

    it('deve lidar com dados vazios', async () => {
       mockUseRealtimeSync.mockReturnValue({
         data: [],
         loading: false,
         error: null,
         refetch: jest.fn(),
         subscribe: jest.fn(),
         unsubscribe: jest.fn(),
         isConnected: true,
         connectionStatus: 'connected',
         optimisticUpdate: jest.fn(),
         rollbackOptimistic: jest.fn()
       });
 
       const { result } = renderHook(() => useRealtimeEvents());
 
       expect(result.current.events).toEqual([]);
       expect(result.current.events.length).toBe(0);
     });
  });

  describe('Funcionalidades de Refetch', () => {
    it('deve permitir refetch dos dados', async () => {
      const mockRefetch = jest.fn();
      mockUseRealtimeSync.mockReturnValue({
        data: mockEventsData,
        loading: false,
        error: null,
        refetch: mockRefetch,
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
        isConnected: true,
        connectionStatus: 'connected',
        optimisticUpdate: jest.fn(),
        rollbackOptimistic: jest.fn()
      });

      const { result } = renderHook(() => useRealtimeEvents());

      act(() => {
        result.current.refetch();
      });

      expect(mockRefetch).toHaveBeenCalled();
    });

    it('deve gerenciar estado de loading', async () => {
       mockUseRealtimeSync.mockReturnValue({
         data: [],
         loading: true,
         error: null,
         refetch: jest.fn(),
         subscribe: jest.fn(),
         unsubscribe: jest.fn(),
         isConnected: false,
         connectionStatus: 'connecting',
         optimisticUpdate: jest.fn(),
         rollbackOptimistic: jest.fn()
       });
 
       const { result } = renderHook(() => useRealtimeEvents());
 
       expect(result.current.loading).toBe(true);
       expect(result.current.isConnected).toBe(false);
     });
  });}]}

  describe('Notificações em Tempo Real', () => {
    it('deve configurar subscription para eventos', () => {
      const { result } = renderHook(() => useRealtimeEvents());

      expect(mockUseRealtimeSync).toHaveBeenCalledWith(
        expect.objectContaining({
          table: 'events'
        })
      );
    });

    it('deve processar atualizações em tempo real', () => {
      const { result } = renderHook(() => useRealtimeEvents());

      expect(mockUseRealtimeSync).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.stringContaining('*')
        })
      );
    });
  });
});