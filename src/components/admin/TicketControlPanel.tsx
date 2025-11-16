import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Search, Ticket, DollarSign, Users, Package, Edit, Trash2, Loader2, Upload, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { useEvents, Event } from '@/hooks/useEvents';

const TicketControlPanel: React.FC = () => {
  const { events, loading: eventsLoading, updateTicketPrice, getGroupPrice, fetchEvents, updateEvent } = useEvents();
  const { toast } = useToast();
  
  // Estados para seleção múltipla de eventos
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
  const [selectAllEvents, setSelectAllEvents] = useState(false);
  const [isDeletingEvents, setIsDeletingEvents] = useState(false);
  
  // Estados para gerenciar eventos
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [editEventPrice, setEditEventPrice] = useState<number>(0);
  const [isEditingEventPrice, setIsEditingEventPrice] = useState(false);
  const [eventSearchQuery, setEventSearchQuery] = useState('');
  
  // Estados para métricas de ingressos
  const [ticketMetrics, setTicketMetrics] = useState({
    grossRevenue: 0,
    nextSeatNumber: '0001',
    ticketsSold: 0,
    ticketsAvailable: 1300,
    isSoldOut: false
  });
  
  // Estados para formulário expandido de edição de eventos
  const [editEventFormData, setEditEventFormData] = useState<{
    name: string;
    description: string;
    date: string;
    location: string;
    ticket_price: number;
    group_price: number;
    max_capacity: number;
    is_active: boolean;
    image_url: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editEventImages, setEditEventImages] = useState<File[]>([]);
  const [editEventImagePreviews, setEditEventImagePreviews] = useState<string[]>([]);
  const [currentEventImages, setCurrentEventImages] = useState<string[]>([]);

  // Carregar métricas de ingressos
  useEffect(() => {
    const loadTicketMetrics = async () => {
      try {
        // Buscar disponibilidade de assentos
        const { data: availability, error: availError } = await supabase
          .rpc('check_seats_availability');
        
        if (availError) {
          console.error('Erro ao carregar disponibilidade:', availError);
        } else if (availability && availability.length > 0) {
          const avail = availability[0];
          setTicketMetrics(prev => ({
            ...prev,
            nextSeatNumber: avail.next_seat_number || 'N/A',
            ticketsSold: avail.tickets_sold || 0,
            ticketsAvailable: avail.tickets_available || 1300,
            isSoldOut: avail.is_sold_out || false
          }));
        }
        
        // Buscar receita bruta
        const { data: revenue, error: revenueError } = await supabase
          .rpc('calculate_gross_revenue');
        
        if (revenueError) {
          console.error('Erro ao calcular receita:', revenueError);
        } else {
          setTicketMetrics(prev => ({
            ...prev,
            grossRevenue: parseFloat(revenue || '0')
          }));
        }
      } catch (error) {
        console.error('Erro ao carregar métricas:', error);
      }
    };
    
    loadTicketMetrics();
    
    // Recarregar métricas a cada 30 segundos
    const interval = setInterval(loadTicketMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  // Funções para seleção múltipla de eventos
  const handleSelectEvent = (eventId: string, checked: boolean) => {
    const newSelected = new Set(selectedEvents);
    
    if (checked) {
      newSelected.add(eventId);
    } else {
      newSelected.delete(eventId);
    }
    
    setSelectedEvents(newSelected);
    
    const allEventIds = filteredEvents.map(event => event.id);
    setSelectAllEvents(allEventIds.length > 0 && allEventIds.every(id => newSelected.has(id)));
  };

  const handleSelectAllEvents = (checked: boolean) => {
    if (checked) {
      const allEventIds = filteredEvents.map(event => event.id);
      setSelectedEvents(new Set(allEventIds));
      setSelectAllEvents(true);
    } else {
      setSelectedEvents(new Set());
      setSelectAllEvents(false);
    }
  };

  const deleteSelectedEvents = async () => {
    if (selectedEvents.size === 0) return;

    setIsDeletingEvents(true);
    
    try {
      const eventsToDelete = Array.from(selectedEvents);
      
      const { error } = await supabase
        .from('events')
        .delete()
        .in('id', eventsToDelete);

      if (error) {
        console.error('Erro ao excluir eventos:', error);
        toast({
          title: 'Erro ao excluir eventos',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }

      setSelectedEvents(new Set());
      setSelectAllEvents(false);
      
      fetchEvents();
      
      toast({
        title: 'Eventos excluídos',
        description: `${eventsToDelete.length} evento(s) excluído(s) com sucesso.`,
      });

    } catch (error) {
      console.error('Erro inesperado ao excluir eventos:', error);
      toast({
        title: 'Erro inesperado',
        description: 'Ocorreu um erro ao excluir os eventos.',
        variant: 'destructive',
      });
    } finally {
      setIsDeletingEvents(false);
    }
  };

  // Funções para gerenciar ingressos
  const handleEditEventPrice = (event: Event) => {
    setEditingEvent(event);
    setEditEventPrice(event.ticket_price);
    
    setEditEventFormData({
      name: event.name || '',
      description: event.description || '',
      date: event.date ? new Date(event.date).toISOString().split('T')[0] : '',
      location: event.location || '',
      max_capacity: event.max_capacity || 0,
      ticket_price: event.ticket_price || 0,
      group_price: event.group_price || 900.00,
      is_active: event.is_active || false,
      image_url: event.image_url || ''
    });
    
    if (event.image_url) {
      setCurrentEventImages([event.image_url]);
    } else {
      setCurrentEventImages([]);
    }
    
    setEditEventImages([]);
    setEditEventImagePreviews([]);
    
    setIsEditingEventPrice(true);
  };

  const uploadEventImages = async (files: File[], eventId: string): Promise<string[]> => {
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    
    if (authError || !session) {
      throw new Error('Usuário não autenticado. Faça login novamente.');
    }
    
    const uploadedUrls: string[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileExt = file.name.split('.').pop();
      const fileName = `${eventId}_${Date.now()}_${i}.${fileExt}`;
      const filePath = `events/${fileName}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('event-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });
      
      if (uploadError) {
        throw new Error(`Erro no upload da imagem ${file.name}: ${uploadError.message}`);
      }
      
      const { data: urlData } = supabase.storage
        .from('event-images')
        .getPublicUrl(filePath);
      
      if (urlData?.publicUrl) {
        uploadedUrls.push(urlData.publicUrl);
      }
    }
    
    return uploadedUrls;
  };

  const handleSaveEventChanges = async () => {
    if (!editingEvent || !editEventFormData) return;

    setIsSaving(true);
    
    try {
      let imageUrl = editingEvent.image_url;
      
      if (editEventImages.length > 0) {
        const uploadedUrls = await uploadEventImages(editEventImages, editingEvent.id);
        if (uploadedUrls.length > 0) {
          imageUrl = uploadedUrls[0];
        }
      }

      const updateData = {
        name: editEventFormData.name,
        description: editEventFormData.description,
        date: editEventFormData.date,
        location: editEventFormData.location,
        max_capacity: editEventFormData.max_capacity,
        ticket_price: editEventFormData.ticket_price,
        group_price: editEventFormData.group_price,
        is_active: editEventFormData.is_active,
        image_url: imageUrl
      };

      await updateEvent(editingEvent.id, updateData);

      setIsEditingEventPrice(false);
      setEditingEvent(null);
      setEditEventPrice(0);
      setEditEventFormData(null);
      setEditEventImages([]);
      setEditEventImagePreviews([]);
      setCurrentEventImages([]);
      
      toast({
        title: 'Evento atualizado',
        description: 'As alterações foram salvas com sucesso.',
      });

    } catch (error) {
      console.error('Erro ao salvar alterações do evento:', error);
      toast({
        title: "Erro ao salvar",
        description: error instanceof Error ? error.message : "Erro desconhecido ao salvar alterações.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEditEventPrice = () => {
    setIsEditingEventPrice(false);
    setEditingEvent(null);
    setEditEventPrice(0);
    setEditEventFormData(null);
    setEditEventImages([]);
    setEditEventImagePreviews([]);
    setCurrentEventImages([]);
  };

  const handleEventImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (files.length === 0) return;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const invalidFiles = files.filter(file => !validTypes.includes(file.type));
    
    if (invalidFiles.length > 0) {
      toast({
        title: "Tipo de arquivo inválido",
        description: "Apenas arquivos JPEG, PNG e WebP são permitidos.",
        variant: "destructive"
      });
      e.target.value = '';
      return;
    }

    const maxSize = 5 * 1024 * 1024;
    const oversizedFiles = files.filter(file => file.size > maxSize);
    
    if (oversizedFiles.length > 0) {
      toast({
        title: "Arquivo muito grande",
        description: "Cada imagem deve ter no máximo 5MB.",
        variant: "destructive"
      });
      e.target.value = '';
      return;
    }
    
    setEditEventImages(files);
    
    const previews: string[] = [];
    let processedCount = 0;
    
    files.forEach((file, index) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        previews[index] = reader.result as string;
        processedCount++;
        
        if (processedCount === files.length) {
          setEditEventImagePreviews(previews);
        }
      };
      reader.readAsDataURL(file);
    });
    
    e.target.value = '';
  };

  const filteredEvents = events.filter(event => 
    event.name.toLowerCase().includes(eventSearchQuery.toLowerCase()) ||
    event.location.toLowerCase().includes(eventSearchQuery.toLowerCase())
  );

  return (
    <div>
      {/* Métricas de Controle de Ingressos - Queren Hapuque VIII */}
      <Card className="mb-6 bg-gradient-to-br from-orange-50 to-white border-2 border-orange-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-800">
            <Ticket className="h-5 w-5" />
            Controle de Ingressos - Queren Hapuque VIII
          </CardTitle>
          <CardDescription>Acompanhamento em tempo real da venda de ingressos</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Receita Bruta Total */}
            <Card className="bg-green-50 border-green-200">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-600 mb-1">Receita Bruta Total</p>
                    <p className="text-2xl font-bold text-green-800">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(ticketMetrics.grossRevenue / 100)}
                    </p>
                  </div>
                  <DollarSign className="h-8 w-8 text-green-600 opacity-50" />
                </div>
              </CardContent>
            </Card>
            
            {/* Próximo Assento */}
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-600 mb-1">Próximo Assento</p>
                    <p className="text-2xl font-bold font-mono text-blue-800">
                      {ticketMetrics.isSoldOut ? 'ESGOTADO' : ticketMetrics.nextSeatNumber}
                    </p>
                  </div>
                  <Ticket className="h-8 w-8 text-blue-600 opacity-50" />
                </div>
              </CardContent>
            </Card>
            
            {/* Ingressos Vendidos */}
            <Card className="bg-purple-50 border-purple-200">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-purple-600 mb-1">Ingressos Vendidos</p>
                    <p className="text-2xl font-bold text-purple-800">
                      {ticketMetrics.ticketsSold} / 1300
                    </p>
                    <p className="text-xs text-purple-600 mt-1">
                      {((ticketMetrics.ticketsSold / 1300) * 100).toFixed(1)}% vendido
                    </p>
                  </div>
                  <Users className="h-8 w-8 text-purple-600 opacity-50" />
                </div>
              </CardContent>
            </Card>
            
            {/* Disponível */}
            <Card className={`${ticketMetrics.isSoldOut ? 'bg-red-50 border-red-200' : 'bg-orange-50 border-orange-200'}`}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm font-medium ${ticketMetrics.isSoldOut ? 'text-red-600' : 'text-orange-600'} mb-1`}>
                      Disponível
                    </p>
                    <p className={`text-2xl font-bold ${ticketMetrics.isSoldOut ? 'text-red-800' : 'text-orange-800'}`}>
                      {ticketMetrics.ticketsAvailable}
                    </p>
                    {ticketMetrics.isSoldOut && (
                      <Badge variant="destructive" className="mt-2">ESGOTADO</Badge>
                    )}
                  </div>
                  <Package className={`h-8 w-8 ${ticketMetrics.isSoldOut ? 'text-red-600' : 'text-orange-600'} opacity-50`} />
                </div>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
      
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Gerenciar Preços de Ingressos</h2>
        
        {selectedEvents.size > 0 && (
          <Dialog>
            <DialogTrigger asChild>
              <Button 
                variant="destructive" 
                className="inline-flex items-center gap-2.5 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold px-6 py-3 rounded-xl shadow-lg shadow-red-500/25 transition-all duration-300 ease-out hover:shadow-xl hover:shadow-red-500/30 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                disabled={isDeletingEvents}
              >
                {isDeletingEvents ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Excluir Selecionados ({selectedEvents.size})
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirmar Exclusão</DialogTitle>
                <DialogDescription>
                  Tem certeza que deseja excluir {selectedEvents.size} evento(s) selecionado(s)? 
                  Esta ação não pode ser desfeita e todos os ingressos relacionados também serão removidos.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline">Cancelar</Button>
                <Button 
                  variant="destructive" 
                  onClick={deleteSelectedEvents}
                  disabled={isDeletingEvents}
                >
                  {isDeletingEvents ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Excluindo...
                    </>
                  ) : (
                    'Confirmar Exclusão'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
      
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            className="pl-10"
            placeholder="Buscar eventos..."
            value={eventSearchQuery}
            onChange={(e) => setEventSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista de Eventos e Preços</CardTitle>
          <CardDescription>Gerencie os preços dos ingressos para cada evento</CardDescription>
        </CardHeader>
        <CardContent>
          {eventsLoading ? (
            <div className="flex justify-center items-center py-8">
              <div className="text-gray-500">Carregando eventos...</div>
            </div>
          ) : (
            <>
              {/* Versão Desktop da Tabela de Eventos */}
              <div className="hidden md:block rounded-lg border overflow-x-auto">
                <table className="w-full min-w-[900px]">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="py-3 px-2 sm:px-4 text-left text-xs sm:text-sm font-medium text-gray-500 w-12">
                        <Checkbox
                          checked={filteredEvents.length > 0 && selectedEvents.size === filteredEvents.length}
                          onCheckedChange={handleSelectAllEvents}
                          aria-label="Selecionar todos os eventos"
                        />
                      </th>
                      <th className="py-3 px-2 sm:px-4 text-left text-xs sm:text-sm font-medium text-gray-500">Evento</th>
                      <th className="py-3 px-2 sm:px-4 text-center text-xs sm:text-sm font-medium text-gray-500">Data</th>
                      <th className="py-3 px-2 sm:px-4 text-center text-xs sm:text-sm font-medium text-gray-500 hidden lg:table-cell">Local</th>
                      <th className="py-3 px-2 sm:px-4 text-right text-xs sm:text-sm font-medium text-gray-500">Preço Individual</th>
                      <th className="py-3 px-2 sm:px-4 text-right text-xs sm:text-sm font-medium text-gray-500 hidden xl:table-cell">Preço Caravana</th>
                      <th className="py-3 px-2 sm:px-4 text-center text-xs sm:text-sm font-medium text-gray-500 hidden xl:table-cell">Status</th>
                      <th className="py-3 px-2 sm:px-4 text-right text-xs sm:text-sm font-medium text-gray-500">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEvents.map((event) => (
                      <tr key={event.id} className="border-b hover:bg-gray-50">
                        <td className="py-3 px-2 sm:px-4">
                          <Checkbox
                            checked={selectedEvents.has(event.id)}
                            onCheckedChange={(checked) => handleSelectEvent(event.id, Boolean(checked))}
                            aria-label={`Selecionar evento ${event.name}`}
                          />
                        </td>
                        <td className="py-3 px-2 sm:px-4">
                          <div className="flex items-center min-w-0">
                            <div className="h-10 w-10 flex-shrink-0 rounded-full bg-butterfly-orange/10 flex items-center justify-center mr-2 sm:mr-3">
                              <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-butterfly-orange" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-sm sm:text-base truncate">{event.name}</div>
                              <div className="text-xs sm:text-sm text-gray-500 truncate max-w-[200px] sm:max-w-xs">
                                {event.description}
                              </div>
                              <div className="lg:hidden mt-1">
                                <span className="text-xs text-gray-600">{event.location}</span>
                              </div>
                              <div className="xl:hidden mt-1 flex items-center gap-2">
                                <span className={`text-xs py-1 px-2 rounded ${
                                  event.is_active 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {event.is_active ? 'Ativo' : 'Inativo'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-2 sm:px-4 text-center">
                          <span className="text-xs sm:text-sm">
                            {new Date(event.date).toLocaleDateString('pt-BR')}
                          </span>
                        </td>
                        <td className="py-3 px-2 sm:px-4 text-center hidden lg:table-cell">
                          <span className="text-xs sm:text-sm">{event.location}</span>
                        </td>
                        <td className="py-3 px-2 sm:px-4 text-right">
                          <span className="font-medium text-sm sm:text-base">
                            R$ {event.ticket_price ? event.ticket_price.toFixed(2) : '0.00'}
                          </span>
                        </td>
                        <td className="py-3 px-2 sm:px-4 text-right hidden xl:table-cell">
                          <span className="font-medium text-sm sm:text-base text-green-600">
                            R$ {event.ticket_price ? getGroupPrice(event.ticket_price, event.group_price).toFixed(2) : '0.00'}
                          </span>
                          <div className="text-xs text-gray-500">Preço da caravana</div>
                        </td>
                        <td className="py-3 px-2 sm:px-4 text-center hidden xl:table-cell">
                          <span className={`text-xs py-1 px-2 rounded ${
                            event.is_active 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {event.is_active ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td className="py-3 px-2 sm:px-4 text-right">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-7 sm:h-8 text-xs sm:text-sm px-2 sm:px-3"
                            onClick={() => handleEditEventPrice(event)}
                          >
                            <span className="hidden sm:inline">Editar Preço</span>
                            <Edit className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-1 sm:ml-0" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Versão Mobile - Cards de Eventos */}
              <div className="block md:hidden space-y-3">
                {filteredEvents.map((event) => (
                  <Card key={event.id} className="p-3 sm:p-4">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedEvents.has(event.id)}
                        onCheckedChange={(checked) => handleSelectEvent(event.id, Boolean(checked))}
                        className="mt-1 flex-shrink-0"
                      />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-3 mb-3">
                          <div className="h-12 w-12 flex-shrink-0 rounded-full bg-butterfly-orange/10 flex items-center justify-center">
                            <Calendar className="h-5 w-5 text-butterfly-orange" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-sm sm:text-base truncate">{event.name}</h3>
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{event.description}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="text-xs text-gray-600">{event.location}</span>
                              <span className={`text-xs py-1 px-2 rounded ${
                                event.is_active 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {event.is_active ? 'Ativo' : 'Inativo'}
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 text-xs sm:text-sm mb-3 pb-3 border-b">
                          <div>
                            <span className="text-gray-500 block mb-1">Preço Individual:</span>
                            <p className="font-semibold text-base">R$ {event.ticket_price ? event.ticket_price.toFixed(2) : '0.00'}</p>
                          </div>
                          <div>
                            <span className="text-gray-500 block mb-1">Preço Caravana:</span>
                            <p className="font-semibold text-base text-green-600">
                              R$ {event.ticket_price ? getGroupPrice(event.ticket_price, event.group_price).toFixed(2) : '0.00'}
                            </p>
                          </div>
                        </div>
                        
                        <div className="text-xs text-gray-500 mb-3">
                          <span>Data: {new Date(event.date).toLocaleDateString('pt-BR')}</span>
                        </div>
                        
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="w-full text-xs sm:text-sm"
                          onClick={() => handleEditEventPrice(event)}
                        >
                          <Edit className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                          Editar Preço
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
      
      {/* Dialog para editar evento completo */}
      <Dialog open={isEditingEventPrice} onOpenChange={setIsEditingEventPrice}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Evento</DialogTitle>
            <DialogDescription>
              Edite as informações do evento "{editingEvent?.name}"
            </DialogDescription>
          </DialogHeader>
          
          {editEventFormData && (
            <div className="grid gap-6 py-4">
              {/* Nome do Evento */}
              <div className="grid gap-2">
                <label htmlFor="event-name" className="text-sm font-medium">
                  Nome do Evento
                </label>
                <Input 
                  id="event-name" 
                  value={editEventFormData.name}
                  onChange={(e) => setEditEventFormData({
                    ...editEventFormData,
                    name: e.target.value
                  })}
                  placeholder="Nome do evento"
                />
              </div>

              {/* Descrição */}
              <div className="grid gap-2">
                <label htmlFor="event-description" className="text-sm font-medium">
                  Descrição
                </label>
                <textarea 
                  id="event-description" 
                  className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={editEventFormData.description}
                  onChange={(e) => setEditEventFormData({
                    ...editEventFormData,
                    description: e.target.value
                  })}
                  placeholder="Descrição do evento"
                />
              </div>

              {/* Data e Local */}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <label htmlFor="event-date" className="text-sm font-medium">
                    Data do Evento
                  </label>
                  <Input 
                    id="event-date" 
                    type="date"
                    value={editEventFormData.date}
                    onChange={(e) => setEditEventFormData({
                      ...editEventFormData,
                      date: e.target.value
                    })}
                  />
                </div>
                <div className="grid gap-2">
                  <label htmlFor="event-location" className="text-sm font-medium">
                    Local
                  </label>
                  <Input 
                    id="event-location" 
                    value={editEventFormData.location}
                    onChange={(e) => setEditEventFormData({
                      ...editEventFormData,
                      location: e.target.value
                    })}
                    placeholder="Local do evento"
                  />
                </div>
              </div>

              {/* Capacidade */}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <label htmlFor="event-capacity" className="text-sm font-medium">
                    Capacidade Máxima
                  </label>
                  <Input 
                    id="event-capacity" 
                    type="number"
                    min="1"
                    value={editEventFormData.max_capacity}
                    onChange={(e) => setEditEventFormData({
                      ...editEventFormData,
                      max_capacity: Number(e.target.value)
                    })}
                  />
                </div>
              </div>

              {/* Preços */}
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <label htmlFor="event-price" className="text-sm font-medium">
                    Preço Individual (R$)
                  </label>
                  <Input 
                    id="event-price" 
                    type="number" 
                    step="0.01"
                    min="0"
                    value={editEventFormData.ticket_price}
                    onChange={(e) => setEditEventFormData({
                      ...editEventFormData,
                      ticket_price: Number(e.target.value)
                    })}
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">
                    Preço Caravana (R$)
                  </label>
                  <Input 
                    id="event-group-price" 
                    type="number" 
                    step="0.01"
                    min="0"
                    value={editEventFormData.group_price}
                    onChange={(e) => setEditEventFormData({
                      ...editEventFormData,
                      group_price: Number(e.target.value)
                    })}
                  />
                </div>
              </div>

              {/* Status */}
              <div className="grid gap-2">
                <label className="text-sm font-medium">Status</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="event-active"
                    checked={editEventFormData.is_active}
                    onChange={(e) => setEditEventFormData({
                      ...editEventFormData,
                      is_active: e.target.checked
                    })}
                    className="rounded border-gray-300"
                  />
                  <label htmlFor="event-active" className="text-sm">
                    Evento ativo
                  </label>
                </div>
              </div>

              {/* Upload de Imagens */}
              <div className="grid gap-4">
                <label className="text-sm font-medium">Imagens do Evento</label>
                
                {currentEventImages.length > 0 && (
                  <div className="grid gap-2">
                    <span className="text-xs text-gray-500">Imagem atual:</span>
                    <div className="flex flex-wrap gap-2">
                      {currentEventImages.map((imageUrl, index) => (
                        <div key={index} className="relative">
                          <img 
                            src={imageUrl} 
                            alt={`Evento ${index + 1}`}
                            className="w-20 h-20 object-cover rounded-md border"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {editEventImagePreviews.length > 0 && (
                  <div className="grid gap-2">
                    <span className="text-xs text-gray-500">Novas imagens:</span>
                    <div className="flex flex-wrap gap-2">
                      {editEventImagePreviews.map((preview, index) => (
                        <div key={index} className="relative">
                          <img 
                            src={preview} 
                            alt={`Nova imagem ${index + 1}`}
                            className="w-20 h-20 object-cover rounded-md border"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('event-image-upload')?.click()}
                  className="w-full"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {editEventImagePreviews.length > 0 ? 'Alterar Imagens' : 'Adicionar Imagens'}
                </Button>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelEditEventPrice}>
              Cancelar
            </Button>
            <Button 
              className="bg-butterfly-orange hover:bg-butterfly-orange/90"
              onClick={handleSaveEventChanges}
              disabled={isSaving}
            >
              {isSaving ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Input de arquivo para upload de imagens */}
      <input
        type="file"
        id="event-image-upload"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleEventImageChange}
      />
    </div>
  );
};

export default TicketControlPanel;







