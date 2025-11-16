import { useMemo } from 'react';
import { useRealtimeOrders } from './realtime/useRealtimeOrders';

export interface ClothingItem {
  id: string;
  product_id: string;
  name: string;
  size: string;
  quantity: number;
  price: number;
  total_price: number;
  category?: string;
  image_url?: string;
}

export interface ClothingOrder {
  id: string;
  user_id: string;
  customer_name: string;
  customer_email: string;
  total_amount: number;
  status: string;
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
  shipping_address: string;
  payment_method: string;
  external_id?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  clothing_items: ClothingItem[];
  order_type: 'product' | 'mixed';
}

export interface ClothingOrderStats {
  totalOrders: number;
  totalRevenue: number;
  pendingOrders: number;
  paidOrders: number;
  shippedOrders: number;
  pendingShipments: number;
  sizeDistribution: Record<string, number>;
  categoryDistribution: Record<string, number>;
  averageOrderValue: number;
  topSellingProducts: Array<{
    name: string;
    quantity: number;
    revenue: number;
  }>;
}

export function useClothingOrders() {
  const { orders, loading, error, updateOrderStatus } = useRealtimeOrders();

  // Filtrar apenas pedidos com roupas (products)
  const clothingOrders = useMemo((): ClothingOrder[] => {
    // Definir categorias que são consideradas roupas
    const clothingCategories = ['camiseta', 'vestido', 'calca', 'blusa', 'camisa', 'short', 'saia', 'jaqueta', 'casaco'];
    
    return orders
      .map(order => {
        // Filtrar apenas os itens que são produtos de roupas
        const clothing_items: ClothingItem[] = order.order_items
          ?.filter(item => {
            // Deve ter product_id (não é ticket)
            if (!item.product_id || !item.products) return false;
            
            // Verificar se a categoria do produto é uma categoria de roupa
            const productCategory = item.products.category?.toLowerCase();
            return productCategory && clothingCategories.includes(productCategory);
          })
          .map(item => ({
            id: item.id,
            product_id: item.product_id,
            name: item.products?.name || 'Produto sem nome',
            size: item.size || 'Sem tamanho',
            quantity: item.quantity,
            price: item.price,
            total_price: item.total_price,
            category: item.products?.category || 'Roupa',
            image_url: item.products?.image_url
          })) || [];

        // Determinar order_type baseado nos itens
        const hasTickets = order.order_items?.some(item => item.ticket_id);
        const hasProducts = clothing_items.length > 0;
        const order_type = hasTickets && hasProducts ? 'mixed' : 'product';

        return {
          id: order.id,
          user_id: order.user_id,
          customer_name: order.profiles?.full_name || 'Cliente sem nome',
          customer_email: order.profiles?.email || 'Email não informado',
          total_amount: order.total_amount,
          status: order.status,
          payment_status: order.payment_status,
          shipping_address: order.shipping_address,
          payment_method: order.payment_method,
          external_id: order.external_id,
          notes: order.notes,
          created_at: order.created_at,
          updated_at: order.updated_at,
          clothing_items,
          order_type
        };
      })
      // Filtrar apenas pedidos que realmente têm itens de roupa
      .filter(order => order.clothing_items.length > 0);
  }, [orders]);

  // Calcular estatísticas específicas para roupas
  const stats = useMemo((): ClothingOrderStats => {
    const totalOrders = clothingOrders.length;
    const totalRevenue = clothingOrders.reduce((sum, order) => sum + order.total_amount, 0);
    const pendingOrders = clothingOrders.filter(o => o.status === 'pending').length;
    const paidOrders = clothingOrders.filter(o => o.payment_status === 'paid').length;
    const shippedOrders = clothingOrders.filter(o => o.status === 'shipped').length;
    const pendingShipments = clothingOrders.filter(o => 
      o.payment_status === 'paid' && o.status !== 'shipped' && o.status !== 'delivered'
    ).length;

    // Análise por tamanhos
    const sizeDistribution = clothingOrders.reduce((acc, order) => {
      order.clothing_items.forEach(item => {
        if (item.size && item.size !== 'Sem tamanho') {
          acc[item.size] = (acc[item.size] || 0) + item.quantity;
        }
      });
      return acc;
    }, {} as Record<string, number>);

    // Análise por categorias
    const categoryDistribution = clothingOrders.reduce((acc, order) => {
      order.clothing_items.forEach(item => {
        const category = item.category || 'Sem categoria';
        acc[category] = (acc[category] || 0) + item.quantity;
      });
      return acc;
    }, {} as Record<string, number>);

    // Produtos mais vendidos
    const productSales = clothingOrders.reduce((acc, order) => {
      order.clothing_items.forEach(item => {
        if (!acc[item.name]) {
          acc[item.name] = { quantity: 0, revenue: 0 };
        }
        acc[item.name].quantity += item.quantity;
        acc[item.name].revenue += item.total_price;
      });
      return acc;
    }, {} as Record<string, { quantity: number; revenue: number }>);

    const topSellingProducts = Object.entries(productSales)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    return {
      totalOrders,
      totalRevenue,
      pendingOrders,
      paidOrders,
      shippedOrders,
      pendingShipments,
      sizeDistribution,
      categoryDistribution,
      averageOrderValue,
      topSellingProducts
    };
  }, [clothingOrders]);

  return {
    clothingOrders,
    stats,
    loading,
    error,
    updateOrderStatus
  };
}