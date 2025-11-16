
import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Shirt, ShoppingCart, Users, ArrowDown, ArrowUp, Database } from 'lucide-react';
import AdminSidebar from '@/components/AdminSidebar';
import { supabase } from '@/lib/supabase';
import { TopProducts } from '@/components/admin/TopProducts';
import { RecentOrders } from '@/components/admin/RecentOrders';
import { SalesOverview } from '@/components/admin/SalesOverview';

// Função para normalizar valores (converter centavos para reais quando necessário)
const normalizeAmount = (value: number | null | undefined) => {
  if (!value || isNaN(Number(value))) return 0;
  const n = Number(value);
  return n >= 1000 ? n / 100 : n;
};

// Função para formatar moeda
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

const AdminDashboard = () => {
  const [totalVendas, setTotalVendas] = useState(0);
  const [produtosVendidos, setProdutosVendidos] = useState(0);
  const [itensEstoque, setItensEstoque] = useState(0);
  const [ingressosVendidos, setIngressosVendidos] = useState(0);

  useEffect(() => {
    // Buscar todas as métricas de uma vez usando queries otimizadas
    const fetchAllMetrics = async () => {
      try {
        console.log('🔍 Buscando todas as métricas do dashboard...');

        // 1. Buscar pedidos pagos primeiro (com items para fallback)
        const { data: paidOrders, error: ordersError } = await supabase
          .from('orders')
          .select('id, total_amount, payment_status, items, order_type, total')
          .eq('payment_status', 'paid');

        if (ordersError) {
          console.error('❌ Erro ao buscar pedidos pagos:', ordersError);
          setTotalVendas(0);
          setProdutosVendidos(0);
          setIngressosVendidos(0);
          return;
        }

        const paidOrderIds = paidOrders?.map(order => order.id) || [];
        console.log(`✅ Encontrados ${paidOrderIds.length} pedidos pagos`);
        console.log('📋 IDs dos pedidos pagos (primeiros 5):', paidOrderIds.slice(0, 5));

        // 🔍 DEBUG: Verificar se existem tickets no banco (independente de order_id)
        const { data: allTickets, error: allTicketsError } = await supabase
          .from('tickets')
          .select('id, order_id, quantity, status, created_at')
          .limit(10);
        
        console.log('🔍 DEBUG: Total de tickets no banco (primeiros 10):', allTickets?.length || 0);
        if (allTickets && allTickets.length > 0) {
          console.log('🔍 DEBUG: Amostra de tickets:', allTickets.map(t => ({
            id: t.id,
            order_id: t.order_id,
            quantity: t.quantity,
            status: t.status
          })));
          
          // Verificar quantos tickets têm order_id que corresponde aos pedidos pagos
          const ticketsComOrderIdPago = allTickets.filter(t => 
            t.order_id && paidOrderIds.includes(t.order_id)
          );
          console.log(`🔍 DEBUG: Tickets com order_id nos pedidos pagos: ${ticketsComOrderIdPago.length}`);
        } else {
          console.log('⚠️ DEBUG: Nenhum ticket encontrado no banco de dados');
        }

        if (paidOrderIds.length === 0) {
          console.log('⚠️ Nenhum pedido pago encontrado');
          setTotalVendas(0);
          setProdutosVendidos(0);
          setIngressosVendidos(0);
          // Continuar para buscar estoque mesmo sem pedidos pagos
        } else {
          // 2. Buscar tickets de pedidos pagos
          // IMPORTANTE: Se houver muitos pedidos, pode ser necessário fazer queries em lotes
          // PostgREST tem limite de ~1000 valores em .in(), mas geralmente funciona bem
          let ticketsData: any[] = [];
          let ticketsError: any = null;

          // Tentar buscar todos os tickets de uma vez
          try {
            const result = await supabase
              .from('tickets')
              .select('id, quantity, total_price, price, order_id')
              .in('order_id', paidOrderIds)
              .not('order_id', 'is', null);
            
            ticketsData = result.data || [];
            ticketsError = result.error;
          } catch (error) {
            console.error('❌ Erro ao buscar tickets (tentativa única):', error);
            // Se falhar, pode ser por muitos IDs - tentar em lotes
            if (paidOrderIds.length > 500) {
              console.log('⚠️ Muitos pedidos, tentando buscar em lotes...');
              const batchSize = 500;
              for (let i = 0; i < paidOrderIds.length; i += batchSize) {
                const batch = paidOrderIds.slice(i, i + batchSize);
                try {
                  const batchResult = await supabase
                    .from('tickets')
                    .select('id, quantity, total_price, price, order_id')
                    .in('order_id', batch)
                    .not('order_id', 'is', null);

                  if (batchResult.data) {
                    ticketsData = [...ticketsData, ...batchResult.data];
                  }
                  if (batchResult.error) {
                    console.error(`❌ Erro no lote ${i / batchSize + 1}:`, batchResult.error);
                  }
                } catch (batchError) {
                  console.error(`❌ Erro no lote ${i / batchSize + 1}:`, batchError);
                }
              }
            }
          }

          // Processar tickets encontrados
          let totalTicketsValue = 0;
          
          if (ticketsError && ticketsData.length === 0) {
            // Erro e nenhum dado encontrado
            console.error('❌ Erro ao buscar tickets e nenhum dado encontrado:', ticketsError);
            setIngressosVendidos(0);
            totalTicketsValue = 0;
          } else {
            // Tem dados (mesmo que parcial) ou não há erro
            if (ticketsError) {
              console.warn('⚠️ Erro ao buscar alguns tickets, mas continuando com dados encontrados:', ticketsError);
            }
            
            console.log(`🎫 Tickets encontrados: ${ticketsData.length}`);
            if (ticketsData.length > 0) {
              console.log('🎫 Amostra de tickets:', ticketsData.slice(0, 3).map(t => ({
                id: t.id,
                order_id: t.order_id,
                quantity: t.quantity,
                price: t.price,
                total_price: t.total_price
              })));
              
              // Contar ingressos vendidos (soma de quantidades)
              // IMPORTANTE: Cada ticket pode ter quantity > 1
              const totalIngressos = ticketsData.reduce((sum, ticket) => {
                // Se quantity não existir ou for 0, considerar como 1 ingresso
                const qty = ticket.quantity && ticket.quantity > 0 ? ticket.quantity : 1;
                return sum + qty;
              }, 0);
              
              console.log(`🎫 Total de ingressos vendidos: ${totalIngressos}`);
              setIngressosVendidos(totalIngressos);

              // Calcular valor total de tickets
              totalTicketsValue = ticketsData.reduce((sum, ticket) => {
                // Preferir total_price, depois price, depois 0
                const ticketValue = ticket.total_price || ticket.price || 0;
                return sum + ticketValue;
              }, 0);

              console.log(`💰 Valor total de tickets: R$ ${totalTicketsValue.toFixed(2)}`);
            } else {
              console.log('⚠️ Nenhum ticket encontrado para os pedidos pagos');
              console.log('🔄 Tentando calcular ingressos a partir dos dados dos pedidos...');
              
              // FALLBACK: Calcular ingressos a partir dos items dos pedidos
              let totalIngressosFallback = 0;
              let totalTicketsValueFallback = 0;
              
              if (paidOrders && paidOrders.length > 0) {
                paidOrders.forEach((order: any) => {
                  // Verificar se o pedido tem items (JSON)
                  if (order.items && typeof order.items === 'object') {
                    const items = Array.isArray(order.items) ? order.items : (order.items.items || []);
                    
                    items.forEach((item: any) => {
                      // Se for um item de ticket
                      if (item.type === 'ticket' || item.ticket_id || (order.order_type === 'ticket' && !item.product_id)) {
                        const quantity = item.quantity || 1;
                        const price = item.price || item.unit_price || 0;
                        
                        totalIngressosFallback += quantity;
                        totalTicketsValueFallback += price * quantity;
                      }
                    });
                  }
                  
                  // Se o pedido é do tipo 'ticket' e não tem items estruturados,
                  // assumir que todo o valor é de ingressos
                  if (order.order_type === 'ticket' && (!order.items || (typeof order.items === 'object' && Object.keys(order.items).length === 0))) {
                    // Tentar calcular baseado no total_amount
                    const orderTotal = order.total_amount || order.total || 0;
                    // Assumir preço médio de R$ 90 por ingresso (baseado no evento)
                    const precoMedioIngresso = 90;
                    const quantidadeEstimada = Math.round(orderTotal / precoMedioIngresso);
                    
                    if (quantidadeEstimada > 0) {
                      totalIngressosFallback += quantidadeEstimada;
                      totalTicketsValueFallback += orderTotal;
                    }
                  }
                });
                
                if (totalIngressosFallback > 0) {
                  console.log(`✅ Fallback: Calculados ${totalIngressosFallback} ingressos a partir dos pedidos`);
                  console.log(`💰 Fallback: Valor total de ingressos: R$ ${totalTicketsValueFallback.toFixed(2)}`);
                  setIngressosVendidos(totalIngressosFallback);
                  totalTicketsValue = totalTicketsValueFallback;
                } else {
                  setIngressosVendidos(0);
                  totalTicketsValue = 0;
                }
              } else {
                setIngressosVendidos(0);
                totalTicketsValue = 0;
              }
            }
          }

          // 3. Buscar order_items de pedidos pagos (roupas/produtos)
          // E também usar items dos pedidos como fallback
      const { data: itemsData, error: itemsError } = await supabase
        .from('order_items')
            .select('id, quantity, total_price, price, order_id, product_id')
            .in('order_id', paidOrderIds)
        .not('product_id', 'is', null)
            .not('order_id', 'is', null);
          
          // FALLBACK: Se não houver order_items, calcular a partir dos items dos pedidos
          let itemsDataFallback: any[] = [];
          if ((!itemsData || itemsData.length === 0) && paidOrders) {
            console.log('🔄 Fallback: Calculando produtos a partir dos items dos pedidos...');
            paidOrders.forEach((order: any) => {
              if (order.items && typeof order.items === 'object') {
                const items = Array.isArray(order.items) ? order.items : (order.items.items || []);
                
                items.forEach((item: any) => {
                  // Se for um produto (não ticket)
                  if (item.type === 'product' || item.product_id || (order.order_type === 'product' && item.product_id)) {
                    itemsDataFallback.push({
                      quantity: item.quantity || 1,
                      total_price: item.price * (item.quantity || 1),
                      price: item.price || item.unit_price || 0,
                      product_id: item.product_id
                    });
                  }
                });
              }
            });
            
            if (itemsDataFallback.length > 0) {
              console.log(`✅ Fallback: Encontrados ${itemsDataFallback.length} produtos nos pedidos`);
            }
          }
          
          const finalItemsData = itemsData && itemsData.length > 0 ? itemsData : itemsDataFallback;

        if (itemsError) {
            console.error('❌ Erro ao buscar order_items:', itemsError);
            console.error('Detalhes do erro:', JSON.stringify(itemsError, null, 2));
            // Mesmo com erro, usar valor dos tickets se disponível
            setTotalVendas(totalTicketsValue);
          } else {
            console.log(`👕 Order items encontrados: ${finalItemsData?.length || 0}`);
        
            // Contar produtos vendidos (soma de quantidades)
            const totalProdutos = finalItemsData?.reduce((sum, item) => {
              const qty = item.quantity && item.quantity > 0 ? item.quantity : 1;
              return sum + qty;
        }, 0) || 0;

            console.log(`📦 Total de produtos vendidos: ${totalProdutos}`);
            setProdutosVendidos(totalProdutos);

            // Calcular valor total de produtos
            const totalItemsValue = finalItemsData?.reduce((sum, item) => {
              // Preferir total_price, depois calcular price * quantity
              const itemValue = item.total_price || (item.price * (item.quantity || 1)) || 0;
              return sum + itemValue;
        }, 0) || 0;

            console.log(`💰 Valor total de produtos: R$ ${totalItemsValue.toFixed(2)}`);

            // Calcular total de vendas
            // Se não temos tickets mas temos pedidos, usar total_amount dos pedidos como fallback
            let totalVendasValue = totalTicketsValue + totalItemsValue;
            
            if (totalVendasValue === 0 && paidOrders && paidOrders.length > 0) {
              // Fallback final: usar total_amount dos pedidos
              totalVendasValue = paidOrders.reduce((sum: number, order: any) => {
                return sum + (order.total_amount || order.total || 0);
              }, 0);
              console.log(`💰 Fallback: Total de vendas calculado a partir dos pedidos: R$ ${totalVendasValue.toFixed(2)}`);
            }
            
            console.log(`💰 Total de vendas: R$ ${totalVendasValue.toFixed(2)}`);
            setTotalVendas(totalVendasValue);
      }
        }

        // 4. Buscar itens em estoque (independente de pedidos)
        const { data: productsData, error: productsError } = await supabase
          .from('products')
          .select('id')
          .eq('in_stock', true);

        if (productsError) {
          console.error('❌ Erro ao buscar estoque:', productsError);
          setItensEstoque(0);
        } else {
          const totalEstoque = productsData?.length || 0;
          console.log(`📦 Itens em estoque: ${totalEstoque}`);
          setItensEstoque(totalEstoque);
        }
        
      } catch (error) {
        console.error('❌ Erro ao buscar métricas:', error);
        setTotalVendas(0);
        setProdutosVendidos(0);
        setIngressosVendidos(0);
        setItensEstoque(0);
      }
    };

    fetchAllMetrics();
    
    // ✅ CORREÇÃO: Atualizar métricas a cada 30 segundos para mostrar pedidos recentes
    const intervalId = setInterval(() => {
      console.log('🔄 Atualizando métricas do dashboard...');
      fetchAllMetrics();
    }, 30000); // 30 segundos
    
    return () => {
      clearInterval(intervalId);
    };
  }, []);

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-gray-100">
      <AdminSidebar />
      
      <div className="flex-1 p-4 sm:p-6 lg:p-8 w-full lg:w-auto pt-20 lg:pt-4">
        <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total de Vendas</CardTitle>
              <ShoppingCart className="h-4 w-4 text-butterfly-orange" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(normalizeAmount(totalVendas))}</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-green-500 flex items-center">
                  <ArrowUp className="h-3 w-3 mr-1" /> +12% comparado ao mês anterior
                </span>
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Ingressos Vendidos</CardTitle>
              <Ticket className="h-4 w-4 text-butterfly-orange" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{ingressosVendidos}</div>
              <p className="text-xs text-muted-foreground">
                <span className="flex items-center">
                  de 1300 disponíveis (19%)
                </span>
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Produtos Vendidos</CardTitle>
              <Shirt className="h-4 w-4 text-butterfly-orange" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{produtosVendidos}</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-green-500 flex items-center">
                  <ArrowUp className="h-3 w-3 mr-1" /> +25% comparado à semana anterior
                </span>
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Itens em Estoque</CardTitle>
              <Database className="h-4 w-4 text-butterfly-orange" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{itensEstoque}</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-red-500 flex items-center">
                  <ArrowDown className="h-3 w-3 mr-1" /> 2 produtos com estoque baixo
                </span>
              </p>
            </CardContent>
          </Card>
        </div>
        
        <Tabs defaultValue="sales" className="w-full">
          <TabsList className="overflow-x-auto whitespace-nowrap">
            <TabsTrigger value="sales">Vendas</TabsTrigger>
          </TabsList>
          
          <TabsContent value="sales" className="mt-6">
            <SalesOverview />
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              <TopProducts />
              
              <RecentOrders />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

function Ticket(props: { className: string }) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
      <path d="M13 5v2" />
      <path d="M13 17v2" />
      <path d="M13 11v2" />
    </svg>
  );
}

export default AdminDashboard;
