import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Minus, Plus, MapPin, Calendar, Users, Bus } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { CartTicket } from '@/lib/cart-utils';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { enableScrollOnNextNavigation } from '@/hooks/useScrollToTop';

interface Event {
  id: string;
  title: string;
  description: string;
  start_date: string;
  venue_name: string;
  ticket_price: number;
  group_price?: number; // Adicionar campo group_price
  max_capacity: number;
  current_attendees: number;
  cover_image: string;
}

const Ingressos = () => {
  const [individualQuantity, setIndividualQuantity] = useState(1);
  const [groupQuantity, setGroupQuantity] = useState(10);
  const [activeTab, setActiveTab] = useState("individual");
  const [isLoading, setIsLoading] = useState(false);
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToCart } = useCart();
  const { toast } = useToast();

  useEffect(() => {
    const loadEvents = async () => {
      try {
        setIsLoading(true);
        
        console.log('🔄 Iniciando carregamento de eventos...');
        
        // Carregar eventos reais do banco de dados
        const { data: realEvents, error } = await supabase
          .from('events')
          .select('*')
          .eq('status', 'active')
          .order('event_date', { ascending: true });

        console.log('📊 Resposta do banco:', { realEvents, error });

        if (error) {
          console.error('❌ Erro ao carregar eventos do banco:', error);
          throw error;
        }

        console.log('📋 Eventos encontrados:', realEvents?.length || 0);

        if (realEvents && realEvents.length > 0) {
          // Mapear eventos do banco para o formato esperado pelo componente
          const formattedEvents = realEvents.map(event => ({
            id: event.id,
            title: event.title,
            description: event.description,
            start_date: event.event_date,
            venue_name: event.location,
            ticket_price: parseFloat(event.price) || 90.00,
            group_price: parseFloat(event.group_price) || 900.00, // Incluir group_price do banco
            max_capacity: event.max_capacity,
            current_attendees: event.current_capacity || 0,
            cover_image: event.image_url || '/placeholder.svg'
          }));
          
          setEvents(formattedEvents);
          setSelectedEvent(formattedEvents[0]); // Seleciona o primeiro evento real
          console.log('✅ Eventos reais carregados com sucesso:', formattedEvents.length);
        } else {
          // Fallback para dados mock se não houver eventos no banco
          console.log('⚠️ Nenhum evento encontrado no banco, usando dados mock');
          const mockEvents = [
            {
              id: 'c64adb4c-45a2-4e45-ba8a-1a0d3d010cfb', // ID real do banco
              title: 'Festival de Música Eletrônica',
              description: 'Uma noite inesquecível com os melhores DJs do cenário nacional e internacional.',
              start_date: '2024-02-15T20:00:00Z',
              venue_name: 'Arena Anhembi - São Paulo',
              ticket_price: 120.00,
              max_capacity: 5000,
              current_attendees: 3200,
              cover_image: '/placeholder.svg'
            }
          ];
          
          setEvents(mockEvents);
          setSelectedEvent(mockEvents[0]);
          console.log('✅ Eventos mock carregados com sucesso:', mockEvents.length);
        }
        
      } catch (error) {
        console.error('❌ Erro ao carregar eventos:', error);
        toast({
          title: "Erro ao carregar eventos",
          description: "Erro ao carregar eventos. Tente novamente mais tarde.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadEvents();
  }, [toast]);

  const individualTicketPrice = selectedEvent?.ticket_price || 90.00;
  const groupTicketPrice = selectedEvent?.group_price || 900.00; // Usar group_price do evento ou padrão R$ 900,00
  
  // DEBUG: Log temporário para verificar dados do evento
// Debug logs
  console.log('🔍 DEBUG selectedEvent:', selectedEvent);
  console.log('🔍 DEBUG ALL EVENT FIELDS:', JSON.stringify(selectedEvent, null, 2));
  console.log('🔍 DEBUG group_price:', selectedEvent?.group_price);
  console.log('🔍 DEBUG groupTicketPrice:', groupTicketPrice);

  const handleIndividualIncrement = () => {
    if (individualQuantity < 5) setIndividualQuantity(individualQuantity + 1);
  };

  const handleIndividualDecrement = () => {
    if (individualQuantity > 1) setIndividualQuantity(individualQuantity - 1);
  };

  const handleGroupIncrement = () => {
    setGroupQuantity(groupQuantity + 1);
  };

  const handleGroupDecrement = () => {
    if (groupQuantity > 10) setGroupQuantity(groupQuantity - 1);
  };

  // ✅ REMOVIDO: createTicketInDatabase()
  // Tickets não são mais criados no carrinho
  // Serão criados apenas quando o pedido for PAGO (via trigger)

  const handleAddToCart = async () => {
    try {
      setIsAddingToCart(true);
      
      console.log('Starting add to cart process');
      console.log('Selected event:', selectedEvent);
      console.log('User:', user);
      console.log('Active tab:', activeTab);
      
      // Allow guest users to add tickets to cart
      console.log('User authentication status:', user ? 'authenticated' : 'guest');

      if (!selectedEvent) {
        console.log('No selected event - showing error');
        toast({
          title: "Erro",
          description: "Nenhum evento selecionado.",
          variant: "destructive"
        });
        return;
      }

      const quantity = activeTab === "individual" ? individualQuantity : groupQuantity;
      const price = activeTab === "individual" ? individualTicketPrice : groupTicketPrice;
      const ticketName = selectedEvent.title;
      const isCaravan = activeTab === "group"; // Detectar se é caravana

      console.log('Ticket details:', { 
        quantity, 
        price, 
        ticketName, 
        selectedEventId: selectedEvent.id,
        isCaravan,
        activeTab 
      });
      
      let customerId = null;
      
      if (user) {
        console.log('Getting customer for authenticated user:', user.id);
        let { data: customer, error: customerError } = await supabase
          .from('customers')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (customerError && customerError.code === 'PGRST116') {
          // Customer doesn't exist, create one
          console.log('Customer not found, creating new customer record...');
          const { data: newCustomer, error: createError } = await supabase
            .from('customers')
            .insert({
              user_id: user.id,
              full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Cliente',
              email: user.email || '',
              phone: user.user_metadata?.phone || null
            })
            .select('id')
            .single();
            
          if (createError) {
            console.error('Error creating customer:', createError);
            toast({
              title: "Erro",
              description: "Erro ao criar registro de cliente. Tente novamente.",
              variant: "destructive"
            });
            return;
          }
          
          customerId = newCustomer.id;
          console.log('Customer created successfully:', newCustomer);
        } else if (customerError) {
          console.error('Error getting customer:', customerError);
          toast({
            title: "Erro",
            description: "Erro ao buscar dados do cliente. Tente novamente.",
            variant: "destructive"
          });
          return;
        } else {
          customerId = customer.id;
          console.log('Customer found:', customer);
        }
      }

      // 🔧 NOVA LÓGICA: Criar tickets reais na tabela tickets
      // Para caravanas, calcular preço unitário correto
      let unitPrice = price;
      let totalQuantity = quantity;
      let ticketType = 'individual';
      
      if (isCaravan) {
        // Para caravanas: 10 ingressos com preço dinâmico baseado no group_price do evento
        const caravanPrice = selectedEvent?.group_price || 900.00;
        unitPrice = caravanPrice / 10; // Preço unitário calculado (group_price / 10 ingressos)
        totalQuantity = 10; // Sempre 10 ingressos para caravana
        ticketType = 'batch'; // Tipo lote/caravana
        console.log('Caravana detected:', {
          caravanPrice,
          unitPrice,
          totalQuantity,
          totalPrice: unitPrice * totalQuantity,
          originalPrice: price
        });
      }

      // ✅ SIMPLIFICADO: NÃO criar tickets no banco - apenas armazenar no carrinho
      // Os tickets serão criados apenas quando o pedido for PAGO (via trigger)
      console.log('✅ Adicionando ticket ao carrinho (sem criar no banco ainda)...');
      
      // Add ticket to cart (sem ticket_id - será criado após pagamento)
      const cartTicket: CartTicket = {
        id: Date.now().toString() + Math.random().toString(36).substring(2, 11), // Generate unique ID
        ticket_id: null, // ✅ NÃO criar ticket ainda - será criado após pagamento
        name: isCaravan ? `Caravana - ${ticketName} (10 ingressos)` : `Ingresso - ${ticketName}`,
        price: unitPrice,
        quantity: totalQuantity,
        unit_price: unitPrice,
        total_price: unitPrice * totalQuantity,
        ticket_type: ticketType,
        status: 'active',
        event_id: selectedEvent.id,
        customer_id: customerId
      };

      console.log('✅ Adicionando ao carrinho (tickets serão criados após pagamento):', cartTicket);
      await addToCart(cartTicket);
      
      console.log('Successfully added to cart');
      
      toast({
        title: "Ingresso adicionado!",
        description: `${quantity} ${quantity > 1 ? 'ingressos foram adicionados' : 'ingresso foi adicionado'} ao seu carrinho.`,
      });
      
      enableScrollOnNextNavigation();
      navigate('/carrinho');
    } catch (error: unknown) {
      console.error('Full error details:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      if (error instanceof Error && error.stack) {
        console.error('Error stack:', error.stack);
      }
      toast({
        title: "Erro ao adicionar ingresso",
        description: `Não foi possível adicionar o ingresso ao carrinho: ${errorMessage}`,
        variant: "destructive"
      });
    } finally {
      setIsAddingToCart(false);
    }
  };

  const calculateTotal = () => {
    if (activeTab === "individual") {
      return individualTicketPrice * individualQuantity;
    } else {
      // Para caravanas: group_price já é o preço total para 10 ingressos
      // Não multiplicar por groupQuantity (que é sempre 10)
      return groupTicketPrice;
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-8 text-butterfly-orange">Ingressos para o Evento</h1>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <img 
                src="/ingressos.webp" 
                alt="Layout do Ingresso"
                className="w-full rounded-lg shadow-lg mb-6"
              />
              
              <Card className="mb-6">
                <CardContent className="pt-6">
                  <h2 className="text-xl font-semibold mb-4">Detalhes do Evento</h2>
                   <div className="space-y-4">
                     {selectedEvent ? (
                       <>
                         <div className="flex items-center gap-2">
                           <Calendar className="text-butterfly-orange h-5 w-5" />
                           <span>{new Date(selectedEvent.start_date).toLocaleDateString('pt-BR')}</span>
                         </div>
                         <div className="flex items-center gap-2">
                           <MapPin className="text-butterfly-orange h-5 w-5" />
                           <span>{selectedEvent.venue_name}</span>
                         </div>
                         <div className="flex items-center gap-2">
                           <Users className="text-butterfly-orange h-5 w-5" />
                           <span>{(selectedEvent.max_capacity || 0) - (selectedEvent.current_attendees || 0)} vagas disponíveis</span>
                         </div>
                       </>
                     ) : (
                       <div className="text-center py-4 text-gray-500">
                         Carregando informações do evento...
                       </div>
                     )}
                   </div>
                </CardContent>
              </Card>
            </div>

            <div>
              <Card>
                <CardContent className="pt-6">
                  <h2 className="text-xl font-semibold mb-6">Comprar Ingressos</h2>
                  
                  <Tabs defaultValue="individual" onValueChange={setActiveTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-6">
                      <TabsTrigger value="individual" className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Individual
                      </TabsTrigger>
                      <TabsTrigger value="group" className="flex items-center gap-2">
                        <Bus className="h-4 w-4" />
                        Caravana
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="individual" className="space-y-6">
                      <div>
                        <p className="text-gray-600 mb-2">Preço por ingresso</p>
                        <p className="text-2xl font-bold text-butterfly-orange">
                          R$ {individualTicketPrice.toFixed(2).replace('.', ',')}
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">Quantidade</label>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center border rounded-md">
                            <button 
                              onClick={handleIndividualDecrement}
                              className="px-3 py-2 hover:bg-gray-100"
                              disabled={individualQuantity <= 1}
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <span className="px-4 py-2">{individualQuantity}</span>
                            <button 
                              onClick={handleIndividualIncrement}
                              className="px-3 py-2 hover:bg-gray-100"
                              disabled={individualQuantity >= 5}
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                          <span className="text-sm text-gray-500">
                            (Máximo 5 ingressos por compra)
                          </span>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="group" className="space-y-6">
                      <div>
                        <p className="text-gray-600 mb-2">Preço por ingresso (caravana)</p>
                        <p className="text-2xl font-bold text-butterfly-orange">
                          R$ {groupTicketPrice.toFixed(2).replace('.', ',')}
                        </p>
                        <p className="text-sm text-green-600 mt-1">
                          Preço especial para caravanas - R$ {groupTicketPrice.toFixed(2).replace('.', ',')} por lote de 10 ingressos!
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">Quantidade</label>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center border rounded-md">
                            <button 
                              onClick={handleGroupDecrement}
                              className="px-3 py-2 hover:bg-gray-100"
                              disabled={groupQuantity <= 10}
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <span className="px-4 py-2">{groupQuantity}</span>
                            <button 
                              onClick={handleGroupIncrement}
                              className="px-3 py-2 hover:bg-gray-100"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </div>
                          <span className="text-sm text-gray-500">
                            (Mínimo 10 ingressos)
                          </span>
                        </div>
                      </div>
                    </TabsContent>
                    
                    <div className="border-t pt-4 mt-4">
                      <div className="flex justify-between mb-4">
                        <span className="font-semibold">Total:</span>
                        <span className="text-xl font-bold text-butterfly-orange">
                          R$ {calculateTotal().toFixed(2).replace('.', ',')}
                        </span>
                      </div>
                      <Button 
                        onClick={handleAddToCart}
                        className="w-full bg-butterfly-orange hover:bg-butterfly-orange/90"
                        disabled={isLoading || isAddingToCart}
                      >
                        {isAddingToCart ? 'Adicionando...' : 'Adicionar ao Carrinho'}
                      </Button>
                    </div>
                  </Tabs>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Ingressos;
