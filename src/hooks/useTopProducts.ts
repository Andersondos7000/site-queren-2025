import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface TopProduct {
  id: string;
  name: string;
  price: number;
  totalQuantity: number;
  totalRevenue: number;
}

export const useTopProducts = (limit: number = 5) => {
  const [products, setProducts] = useState<TopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTopProducts = async () => {
      try {
        setLoading(true);
        setError(null);

        // Buscar todos os itens de pedidos com produtos
        const { data: orderItems, error: orderItemsError } = await supabase
          .from('order_items')
          .select(`
            product_id,
            products!inner(name, price),
            quantity,
            total_price
          `)
          .not('product_id', 'is', null);

        if (orderItemsError) {
          throw orderItemsError;
        }

        // Agrupar por produto e calcular estatísticas
        const productStats: Record<string, TopProduct> = {};
        
        orderItems?.forEach(item => {
          const productId = item.product_id;
          const productName = item.products.name;
          const productPrice = item.products.price;
          
          if (!productStats[productId]) {
            productStats[productId] = {
              id: productId,
              name: productName,
              price: productPrice,
              totalQuantity: 0,
              totalRevenue: 0
            };
          }
          
          productStats[productId].totalQuantity += item.quantity || 0;
          productStats[productId].totalRevenue += (item.total_price || 0);
        });
        
        // Ordenar por quantidade vendida e limitar
        const sortedProducts = Object.values(productStats)
          .sort((a, b) => b.totalQuantity - a.totalQuantity)
          .slice(0, limit);
        
        setProducts(sortedProducts);
      } catch (err) {
        console.error('Erro ao buscar produtos mais vendidos:', err);
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
      } finally {
        setLoading(false);
      }
    };

    fetchTopProducts();
  }, [limit]);

  return { products, loading, error };
};