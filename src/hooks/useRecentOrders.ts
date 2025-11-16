import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface RecentOrder {
  id: string;
  orderNumber: string;
  customerEmail: string | null;
  totalAmount: number;
  status: string;
  paymentStatus: string | null;
  createdAt: string;
  itemsCount: number;
  itemsDescription: string;
  statusDisplay: string;
}

export const useRecentOrders = (limit: number = 10) => {
  const [orders, setOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecentOrders = async () => {
      try {
        setLoading(true);
        setError(null);

        // ✅ CORREÇÃO: Buscar também o campo items (JSON) para fallback
        // Muitos pedidos não têm order_items na tabela, mas têm dados no campo items
        const { data: recentOrders, error: ordersError } = await supabase
          .from('orders')
          .select(`
            id,
            customer_email,
            total_amount,
            status,
            payment_status,
            created_at,
            items,
            order_type,
            order_items(
              id,
              product_id,
              ticket_id,
              quantity
            )
          `)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (ordersError) {
          throw ordersError;
        }

        const processedOrders: RecentOrder[] = recentOrders?.map(order => {
          const orderNumber = order.id.split('-')[0]; // Primeiros caracteres do UUID
          
          // ✅ CORREÇÃO: Usar order_items se existir, senão usar campo items (JSON)
          let itemsCount = 0;
          let hasProducts = false;
          let hasTickets = false;
          
          if (order.order_items && order.order_items.length > 0) {
            // Usar order_items da tabela
            itemsCount = order.order_items.length;
            hasProducts = order.order_items.some(item => item.product_id) || false;
            hasTickets = order.order_items.some(item => item.ticket_id) || false;
          } else if (order.items) {
            // ✅ FALLBACK: Usar campo items (JSON) quando não há order_items
            try {
              const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
              const itemsArray = Array.isArray(items) ? items : (items.items || []);
              
              itemsCount = itemsArray.length;
              
              // Verificar tipos de itens no JSON
              itemsArray.forEach((item: any) => {
                if (item.product_id || item.type === 'product' || (order.order_type === 'product' && !item.event_id)) {
                  hasProducts = true;
                }
                if (item.ticket_id || item.event_id || item.ticket_type || (order.order_type === 'ticket' && !item.product_id)) {
                  hasTickets = true;
                }
              });
              
              // Se não conseguiu identificar, usar quantidade total
              if (itemsCount === 0) {
                const totalQuantity = itemsArray.reduce((sum: number, item: any) => {
                  return sum + (item.quantidade || item.quantity || 1);
                }, 0);
                itemsCount = totalQuantity || itemsArray.length;
              }
            } catch (parseError) {
              console.error('Erro ao parsear items JSON:', parseError);
              itemsCount = 0;
            }
          }
          
          let itemsDescription = '';
          if (hasProducts && hasTickets) {
            itemsDescription = `${itemsCount} itens (produtos + ingressos)`;
          } else if (hasProducts) {
            itemsDescription = `${itemsCount} produto${itemsCount > 1 ? 's' : ''}`;
          } else if (hasTickets) {
            itemsDescription = `${itemsCount} ingresso${itemsCount > 1 ? 's' : ''}`;
          } else if (itemsCount > 0) {
            itemsDescription = `${itemsCount} item${itemsCount > 1 ? 's' : ''}`;
          } else {
            itemsDescription = 'Sem itens';
          }
          
          const statusDisplay = order.payment_status === 'paid' ? 'Pago' : 
                               order.status === 'pending' ? 'Pendente' : 
                               order.status || 'Desconhecido';
          
          return {
            id: order.id,
            orderNumber,
            customerEmail: order.customer_email,
            totalAmount: order.total_amount || 0,
            status: order.status || '',
            paymentStatus: order.payment_status,
            createdAt: order.created_at,
            itemsCount,
            itemsDescription,
            statusDisplay
          };
        }) || [];

        setOrders(processedOrders);
      } catch (err) {
        console.error('Erro ao buscar pedidos recentes:', err);
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
      } finally {
        setLoading(false);
      }
    };

    fetchRecentOrders();
    
    // ✅ CORREÇÃO: Atualizar pedidos recentes a cada 30 segundos
    const intervalId = setInterval(() => {
      console.log('🔄 Atualizando pedidos recentes...');
      fetchRecentOrders();
    }, 30000); // 30 segundos
    
    return () => {
      clearInterval(intervalId);
    };
  }, [limit]);

  return { orders, loading, error };
};