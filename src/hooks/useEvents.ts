import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useToast } from './use-toast';

export interface Event {
  id: string;
  name: string;
  description?: string;
  date: string;
  location: string;
  max_capacity: number;
  current_capacity: number;
  ticket_price: number;
  group_price?: number; // Preço da caravana
  image_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EventFormData {
  name: string;
  description?: string;
  date: string;
  location: string;
  max_capacity: number;
  ticket_price: number;
  group_price?: number; // Preço da caravana
  image_url?: string;
  is_active: boolean;
}

export function useEvents() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Buscar todos os eventos
  const fetchEvents = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Erro ao buscar eventos:', error);
        throw error;
      }

      console.log('✅ Eventos reais carregados com sucesso:', data?.length || 0);
      console.log('🔍 DEBUG: Dados brutos dos eventos do Supabase:', JSON.stringify(data, null, 2));
      
      // Log específico para verificar group_price
      if (data && data.length > 0) {
        data.forEach((event, index) => {
          console.log(`🔍 DEBUG: Evento ${index + 1} - group_price:`, event.group_price);
          console.log(`🔍 DEBUG: Evento ${index + 1} - Todos os campos:`, Object.keys(event));
        });
      }
      
      setEvents(data || []);
    } catch (err) {
      console.error('❌ Erro na busca de eventos:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar eventos';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Atualizar evento
  const updateEvent = async (id: string, updates: Partial<EventFormData>) => {
    try {
      const { data, error } = await supabase
        .from('events')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Atualizar estado local
      setEvents(prev => prev.map(event => 
        event.id === id ? { ...event, ...data } : event
      ));

      toast({
        title: "Sucesso",
        description: "Evento atualizado com sucesso!",
      });

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar evento';
      setError(errorMessage);
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
      throw err;
    }
  };

  // Atualizar apenas o preço do ingresso
  const updateTicketPrice = async (eventId: string, newPrice: number) => {
    try {
      const { data, error } = await supabase
        .from('events')
        .update({
          ticket_price: newPrice,
          updated_at: new Date().toISOString()
        })
        .eq('id', eventId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Atualizar estado local
      setEvents(prev => prev.map(event => 
        event.id === eventId ? { ...event, ticket_price: newPrice } : event
      ));

      toast({
        title: "Sucesso",
        description: "Preço do ingresso atualizado com sucesso!",
      });

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar preço do ingresso';
      setError(errorMessage);
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
      throw err;
    }
  };

  // Criar novo evento
  const createEvent = async (eventData: EventFormData) => {
    try {
      const { data, error } = await supabase
        .from('events')
        .insert([{
          ...eventData,
          current_capacity: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Atualizar estado local
      setEvents(prev => [data, ...prev]);

      toast({
        title: "Sucesso",
        description: "Evento criado com sucesso!",
      });

      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar evento';
      setError(errorMessage);
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
      throw err;
    }
  };

  // Deletar evento
  const deleteEvent = async (id: string) => {
    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', id);

      if (error) {
        throw error;
      }

      // Atualizar estado local
      setEvents(prev => prev.filter(event => event.id !== id));

      toast({
        title: "Sucesso",
        description: "Evento removido com sucesso!",
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao remover evento';
      setError(errorMessage);
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
      throw err;
    }
  };

  // Buscar evento por ID
  const getEventById = (id: string): Event | undefined => {
    return events.find(event => event.id === id);
  };

  // Preço da caravana - usar o preço específico do evento ou padrão R$ 900,00
  const getGroupPrice = (individualPrice: number, eventGroupPrice?: number): number => {
    return eventGroupPrice || 900.00;
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  return {
    events,
    loading,
    error,
    fetchEvents,
    updateEvent,
    updateTicketPrice,
    createEvent,
    deleteEvent,
    getEventById,
    getGroupPrice
  };
}