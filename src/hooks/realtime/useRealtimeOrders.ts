import { useCallback, useMemo, useEffect, useState } from 'react';
import { useRealtimeSync } from './useRealtimeSync';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../useAuth';
import { useAdminAuth } from '@/contexts/AdminAuthContext';

// Tipos para pedidos
// DEPRECATED: product_sizes table removed - updated interface
interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  size: string; // Changed from product_size_id to direct size string
  quantity: number;
  price: number;
  total_price: number;
  created_at: string;
  // Dados relacionados
  products?: {
    id: string;
    name: string;
    category: string;
    image_url?: string;
    sizes?: string[]; // Available sizes from products table
  };
  // DEPRECATED: product_sizes table no longer exists
  // Use size field directly instead
}

type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

interface Order {
  id: string;
  user_id: string;
  status: OrderStatus;
  total_amount: number;
  shipping_address: string;
  payment_method: string;
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
  external_id?: string; // AbacatePay ID
  notes?: string;
  created_at: string;
  updated_at: string;
  // Dados relacionados
  order_items?: OrderItem[];
  profiles?: {
    id: string;
    full_name?: string;
    email?: string;
  };
}

interface OrderFilters {
  status?: OrderStatus;
  paymentStatus?: Order['payment_status'];
  dateFrom?: string;
  dateTo?: string;
  userId?: string;
}

interface UseRealtimeOrdersReturn {
  orders: Order[];
  loading: boolean;
  error: Error | null;
  isConnected: boolean;
  refetch: () => void;
  getOrderById: (id: string) => Order | undefined;
  getOrdersByStatus: (status: OrderStatus) => Order[];
  updateOrderStatus: (orderId: string, status: OrderStatus, notes?: string) => Promise<void>;
  cancelOrder: (orderId: string, reason?: string) => Promise<void>;
  createOrder: (orderData: Partial<Order>, items: Omit<OrderItem, 'id' | 'order_id' | 'created_at'>[]) => Promise<string>;
}

/**
 * Hook para sincronização em tempo real de pedidos
 * Suporta filtros e atualizações de status
 */
export function useRealtimeOrders(filters?: OrderFilters): UseRealtimeOrdersReturn {
  const { user } = useAuth();
  const { isAdminLoggedIn, isAdminSessionValid } = useAdminAuth();
  
  // Verificar se é admin autenticado
  const isAdmin = isAdminLoggedIn && isAdminSessionValid();
  
  // Construir filtros para query do Supabase com paginação
  const filter = useMemo(() => {
    const conditions: string[] = [];
    
    // Se é admin, não filtrar por user_id (mostrar todos os pedidos)
    // Se não é admin, filtrar apenas pedidos do usuário
    if (!isAdmin) {
      if (!filters?.userId && user) {
        // ✅ CORREÇÃO: Buscar por user_id OU customer_email
        // Isso garante que pedidos sem user_id mas com o mesmo email apareçam
        conditions.push(`user_id=eq.${user.id}`);
        // Nota: A busca por email será feita após a query principal
        // devido a limitações do Supabase em fazer OR com campos diferentes
      } else if (filters?.userId) {
        conditions.push(`user_id=eq.${filters.userId}`);
      }
    } else if (filters?.userId) {
      // Se é admin mas quer filtrar por um userId específico
      conditions.push(`user_id=eq.${filters.userId}`);
    }
    
    if (filters?.status) {
      conditions.push(`status=eq.${filters.status}`);
    }
    
    if (filters?.paymentStatus) {
      conditions.push(`payment_status=eq.${filters.paymentStatus}`);
    }
    
    if (filters?.dateFrom) {
      conditions.push(`created_at=gte.${filters.dateFrom}`);
    }
    
    if (filters?.dateTo) {
      conditions.push(`created_at=lte.${filters.dateTo}`);
    }
    
    return conditions.length > 0 ? conditions.join(',') : undefined;
  }, [filters, isAdmin, user]);

  // Configurar paginação (removido - não usado)
  // const paginationConfig = useMemo(() => {
  //   if (filters?.page && filters?.limit) {
  //     return {
  //       limit: filters.limit,
  //       orderBy: 'created_at:desc'
  //     };
  //   }
  //   return {
  //     orderBy: 'created_at:desc'
  //   };
  // }, [filters?.page, filters?.limit]);

  // Hook de sincronização com joins completos
  const {
    data: ordersByUserId,
    loading: loadingByUserId,
    error: errorByUserId,
    isConnected,
    refetch,
    optimisticUpdate,
    rollbackOptimistic
  } = useRealtimeSync<Order>({
    table: 'orders',
    filter,
    select: `
      *,
      order_items (
        *,
        products:product_id (
          id,
          name,
          category,
          image_url,
          sizes
        )
      )
    `,
    orderBy: 'created_at:desc',
    enableOptimistic: true,
    onUpdate: (updatedOrder) => {
      console.log('Pedido atualizado:', updatedOrder.id, updatedOrder.status);
      
      // Notificar mudanças importantes
      if (updatedOrder.status === 'shipped') {
        console.log('Pedido enviado:', updatedOrder.id);
      } else if (updatedOrder.status === 'delivered') {
        console.log('Pedido entregue:', updatedOrder.id);
      }
    },
    onError: (error) => {
      console.error('Erro no pedidos realtime:', error);
    }
  });

  // ✅ CORREÇÃO: Buscar pedidos adicionais por email quando user_id não está disponível
  const [ordersByEmail, setOrdersByEmail] = useState<Order[]>([]);
  const [loadingByEmail, setLoadingByEmail] = useState(false);
  const [errorByEmail, setErrorByEmail] = useState<Error | null>(null);

  useEffect(() => {
    // Se não é admin e tem usuário, buscar também por email
    if (!isAdmin && user?.email) {
      setLoadingByEmail(true);
      setErrorByEmail(null);
      
      const fetchOrdersByEmail = async () => {
        try {
          // Buscar pedidos onde customer_email corresponde ao email do usuário
          // mas user_id é NULL (pedidos criados antes da correção)
          const { data, error } = await supabase
            .from('orders')
            .select(`
              *,
              order_items (
                *,
                products:product_id (
                  id,
                  name,
                  category,
                  image_url,
                  sizes
                )
              )
            `)
            .eq('customer_email', user.email)
            .is('user_id', null)
            .order('created_at', { ascending: false });

          if (error) {
            throw error;
          }

          setOrdersByEmail(data || []);
          console.log(`[useRealtimeOrders] Encontrados ${data?.length || 0} pedidos por email`);
        } catch (err) {
          console.error('[useRealtimeOrders] Erro ao buscar pedidos por email:', err);
          setErrorByEmail(err instanceof Error ? err : new Error('Erro desconhecido'));
        } finally {
          setLoadingByEmail(false);
        }
      };

      fetchOrdersByEmail();
    } else {
      setOrdersByEmail([]);
    }
  }, [isAdmin, user?.email]);

  // Combinar pedidos de user_id e email, removendo duplicatas
  const orders = useMemo(() => {
    const allOrders = [...ordersByUserId];
    const orderIds = new Set(allOrders.map(o => o.id));
    
    // Adicionar pedidos por email que não estão na lista por user_id
    ordersByEmail.forEach(order => {
      if (!orderIds.has(order.id)) {
        allOrders.push(order);
        orderIds.add(order.id);
      }
    });
    
    // Ordenar por data de criação (mais recente primeiro)
    return allOrders.sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [ordersByUserId, ordersByEmail]);

  const loading = loadingByUserId || loadingByEmail;
  const error = errorByUserId || errorByEmail;

  // Buscar pedido por ID
  const getOrderById = useCallback((id: string): Order | undefined => {
    return orders.find(order => order.id === id);
  }, [orders]);

  // Filtrar pedidos por status
  const getOrdersByStatus = useCallback((status: OrderStatus): Order[] => {
    return orders.filter(order => order.status === status);
  }, [orders]);

  // Atualizar status do pedido com atualizações otimistas
  const updateOrderStatus = useCallback(async (orderId: string, status: OrderStatus, notes?: string) => {
    if (!user) {
      throw new Error('Usuário não autenticado');
    }

    try {
      // Buscar pedido atual
      const currentOrder = getOrderById(orderId);
      if (!currentOrder) {
        throw new Error('Pedido não encontrado');
      }

      // Criar versão otimista
      const optimisticId = `optimistic_${Date.now()}_${Math.random()}`;
      const optimisticOrder: Order = {
        ...currentOrder,
        id: optimisticId,
        status,
        updated_at: new Date().toISOString(),
        notes: notes || currentOrder.notes
      };

      // Aplicar atualização otimista
      optimisticUpdate(optimisticOrder, 'update');

      // Preparar dados para atualização
      const updateData: Partial<Order> = {
        status,
        updated_at: new Date().toISOString()
      };

      if (notes) {
        updateData.notes = notes;
      }

      // Rollback automático após 5 segundos se não confirmado
      const rollbackTimer = setTimeout(() => {
        rollbackOptimistic(optimisticId);
        console.warn('Rollback automático: atualização de status não confirmada');
      }, 5000);

      // Executar atualização no servidor
      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', orderId);

      if (error) {
        clearTimeout(rollbackTimer);
        rollbackOptimistic(optimisticId);
        throw new Error(`Erro ao atualizar status do pedido: ${error.message}`);
      }

      // Limpar timer se sucesso
      clearTimeout(rollbackTimer);
      console.log(`Status do pedido ${orderId} alterado para: ${status}`);
    } catch (error) {
      console.error('Erro ao atualizar status do pedido:', error);
      throw error;
    }
  }, [user, getOrderById]);

  // Cancelar pedido
  const cancelOrder = useCallback(async (orderId: string, reason?: string) => {
    if (!user) {
      throw new Error('Usuário não autenticado');
    }

    try {
      const order = getOrderById(orderId);
      if (!order) {
        throw new Error('Pedido não encontrado');
      }

      // Verificar se pedido pode ser cancelado
      if (['shipped', 'delivered'].includes(order.status)) {
        throw new Error('Pedido não pode ser cancelado neste status');
      }

      const notes = reason ? `Cancelado: ${reason}` : 'Pedido cancelado pelo usuário';
      
      await updateOrderStatus(orderId, 'cancelled', notes);

      // TODO: Implementar liberação de estoque reservado
      console.log('Pedido cancelado, estoque deve ser liberado');
    } catch (error) {
      console.error('Erro ao cancelar pedido:', error);
      throw error;
    }
  }, [user, getOrderById, updateOrderStatus]);

  // Criar novo pedido com atualizações otimistas
  const createOrder = useCallback(async (
    orderData: Partial<Order>, 
    items: Omit<OrderItem, 'id' | 'order_id' | 'created_at'>[]
  ): Promise<string> => {
    if (!user) {
      throw new Error('Usuário não autenticado');
    }

    if (!items.length) {
      throw new Error('Pedido deve conter pelo menos um item');
    }

    try {
      // Calcular total do pedido
      const totalAmount = items.reduce((sum, item) => sum + item.total_price, 0);
      
      // Criar ID otimista
      const optimisticId = `optimistic_${Date.now()}_${Math.random()}`;
      const now = new Date().toISOString();
      
      // Criar pedido otimista
      const optimisticOrder: Order = {
        id: optimisticId,
        user_id: user.id,
        status: 'pending',
        total_amount: totalAmount,
        payment_status: 'pending',
        created_at: now,
        updated_at: now,
        shipping_address: '',
        payment_method: '',
        ...orderData,
        order_items: items.map((item, index) => ({
          id: `optimistic_item_${index}`,
          order_id: optimisticId,
          created_at: now,
          ...item
        }))
      };

      // Aplicar atualização otimista
      optimisticUpdate(optimisticOrder, 'insert');

      // Rollback automático após 5 segundos se não confirmado
      const rollbackTimer = setTimeout(() => {
        rollbackOptimistic(optimisticId);
        console.warn('Rollback automático: criação de pedido não confirmada');
      }, 5000);

      // Criar pedido no servidor
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          status: 'pending',
          total_amount: totalAmount,
          payment_status: 'pending',
          ...orderData
        })
        .select('id')
        .single();

      if (orderError || !order) {
        clearTimeout(rollbackTimer);
        rollbackOptimistic(optimisticId);
        throw new Error(`Erro ao criar pedido: ${orderError?.message}`);
      }

      // Criar itens do pedido
      const orderItems = items.map(item => ({
        ...item,
        order_id: order.id
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) {
        clearTimeout(rollbackTimer);
        rollbackOptimistic(optimisticId);
        // Rollback: deletar pedido se falhou ao criar itens
        await supabase.from('orders').delete().eq('id', order.id);
        throw new Error(`Erro ao criar itens do pedido: ${itemsError.message}`);
      }

      // Limpar timer se sucesso
      clearTimeout(rollbackTimer);
      console.log('Pedido criado com sucesso:', order.id);
      return order.id;
    } catch (error) {
      console.error('Erro ao criar pedido:', error);
      throw error;
    }
  }, [user]);

  return {
    orders,
    loading,
    error,
    isConnected,
    refetch,
    getOrderById,
    getOrdersByStatus,
    updateOrderStatus,
    cancelOrder,
    createOrder
  };
}

/**
 * Hook para dashboard administrativo com estatísticas
 * Usado na página de administração de pedidos
 */
export function useOrdersDashboard(filters?: OrderFilters) {
  const { user } = useAuth();
  
  // Carregar todos os pedidos para estatísticas
  const { orders, loading, error, isConnected } = useRealtimeOrders(filters);

  // Estatísticas calculadas
  const stats = useMemo(() => {
    const total = orders.length;
    const pending = orders.filter(order => order.status === 'pending').length;
    const paid = orders.filter(order => order.payment_status === 'paid').length;
    const shipped = orders.filter(order => order.status === 'shipped').length;
    const delivered = orders.filter(order => order.status === 'delivered').length;
    
    const totalRevenue = orders
      .filter(order => order.payment_status === 'paid')
      .reduce((sum, order) => sum + (order.total_amount || 0), 0);

    return {
      total,
      pending,
      paid,
      shipped,
      delivered,
      totalRevenue
    };
  }, [orders]);

  // Pedidos recentes (últimos 10)
  const recentOrders = useMemo(() => {
    return orders
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10);
  }, [orders]);

  // Pedidos que precisam de atenção
  const alertOrders = useMemo(() => {
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    
    return orders.filter(order => {
      const orderDate = new Date(order.created_at);
      
      if (order.status === 'pending' && orderDate < twoDaysAgo) {
        return true;
      }
      
      if (order.payment_status === 'paid' && order.status === 'pending') {
        const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
        return orderDate < twoHoursAgo;
      }
      
      return false;
    });
  }, [orders]);

  return {
    orders,
    stats,
    recentOrders,
    alertOrders,
    loading,
    error,
    isConnected
  };
}

/**
 * Hook para rastreamento de pedido específico
 * Usado na página de acompanhamento do cliente
 */
export function useOrderTracking(orderId: string) {
  const filter = useMemo(() => `id=eq.${orderId}`, [orderId]);
  
  const {
    data: orders,
    loading,
    error,
    isConnected
  } = useRealtimeSync<Order>({
    table: 'orders',
    filter,
    select: `
      *,
      order_items (
        *,
        products:product_id (
          id,
          name,
          image_url
        ),
        // DEPRECATED: product_sizes table removed - size is now stored directly in order_items
      )
    `,
    enableOptimistic: false,
    onUpdate: (updatedOrder) => {
      // Notificar cliente sobre mudanças no pedido
      console.log('Status do seu pedido foi atualizado:', updatedOrder.status);
    }
  });

  const order = orders[0];

  // Timeline do pedido
  const timeline = useMemo(() => {
    if (!order) return [];
    
    const steps = [
      { status: 'pending', label: 'Pedido Recebido', completed: true },
      { status: 'confirmed', label: 'Pedido Confirmado', completed: false },
      { status: 'processing', label: 'Preparando Pedido', completed: false },
      { status: 'shipped', label: 'Pedido Enviado', completed: false },
      { status: 'delivered', label: 'Pedido Entregue', completed: false }
    ];

    const statusOrder = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];
    const currentIndex = statusOrder.indexOf(order.status);
    
    return steps.map((step, index) => ({
      ...step,
      completed: index <= currentIndex && order.status !== 'cancelled',
      current: step.status === order.status
    }));
  }, [order]);

  return {
    order,
    timeline,
    loading,
    error,
    isConnected
  };
}
