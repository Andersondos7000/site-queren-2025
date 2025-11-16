import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

// Interface para item de roupa individual
interface ClothingItem {
  id: string;
  product_id: string;
  order_id: string | null;
  quantity: number;
  price: number;
  total_price: number;
  size: string;
  status: string | null;
  created_at: string | null;
  // ID único para interface (usado apenas para renderização)
  display_id?: string;
  // ID original do banco de dados (sempre preservado)
  original_id?: string;
  // Dados relacionados do produto
  products?: {
    id: string;
    name: string;
    category: string;
    image_url: string | null;
  };
  // Dados do pedido
  orders?: {
    id: string;
    total_amount: number;
    status: string;
    payment_status: string;
    created_at: string;
    customer_data?: {
      name: string;
      email: string;
      phone?: string;
    };
    customer_name?: string;
    customer_email?: string;
  };
}

// Interface para grupo de roupas (pacote)
interface ClothingGroup {
  id: string; // ID do email-grupo ou do item único
  type: 'single' | 'package';
  order_id: string | null; // Pode ser null para grupos por email
  customer_name: string;
  customer_email: string;
  product_name: string;
  item_count: number;
  total_quantity: number;
  unit_price: number;
  total_value: number;
  status: string; // Pode ser 'mixed' para grupos com múltiplos status
  created_at: string;
  items: ClothingItem[]; // Itens individuais do grupo
  // Para compatibilidade com componente existente
  quantity: number;
  price: number;
  customers?: {
    full_name: string;
    email: string;
  };
  products?: {
    name: string;
  };
  // Flag para indicar que tem múltiplos itens
  hasMultipleItems?: boolean;
  // Campos específicos para agrupamento por email
  order_count?: number; // Número de pedidos diferentes no grupo
  unique_orders?: string[]; // IDs dos pedidos únicos
}

interface ClothingFilters {
  status?: string;
  paymentStatus?: string; // Novo filtro para status de pagamento
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  size?: string;
  category?: string;
}

interface UseGroupedClothingDashboardReturn {
  clothingGroups: ClothingGroup[];
  stats: {
    total: number;
    pending: number;
    shipped: number;
    delivered: number;
    cancelled: number;
    totalRevenue: number;
  };
  loading: boolean;
  error: Error | null;
  currentPage: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  setCurrentPage: (page: number) => void;
  refetch: () => void;
}

// Função para normalizar valores (converter centavos para reais quando necessário)
const normalizePrice = (price: number): number => {
  // Se o valor for maior que 1000 e for um número inteiro, provavelmente está em centavos
  if (price > 1000 && Number.isInteger(price)) {
    return price / 100;
  }
  // Se o valor for menor que 1000 ou tiver decimais, provavelmente já está em reais
  return price;
};

export function useGroupedClothingDashboard(
  filters?: ClothingFilters,
  itemsPerPage: number = 20
): UseGroupedClothingDashboardReturn {
  const { user } = useAuth();
  const [clothingGroups, setClothingGroups] = useState<ClothingGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Função para buscar itens de roupas e agrupar por order_id
  const fetchClothingItems = async () => {
    try {
      setLoading(true);
      setError(null);

      // Definir palavras-chave que identificam roupas (inclui variações e plurais)
      const clothingKeywords = [
        'camiseta','camisa','blusa','calca','calça','short','bermuda','saia','vestido','jaqueta','casaco',
        'moletom','cardigan','top','regata'
      ];



      // Buscar todos os order_items com produtos de roupas
      // ✅ CORREÇÃO: Buscar todos os itens e filtrar por payment_status no código
      let query = supabase
        .from('order_items')
        .select(`
          *,
          products!product_id (
            id,
            name,
            category,
            image_url,
            sizes
          ),
          orders!order_id (
            id,
            total_amount,
            status,
            payment_status,
            created_at,
            customer_data,
            customer_name,
            customer_email,
            customer_phone
          )
        `)
        .not('product_id', 'is', null) // Apenas itens com produtos (não tickets)
        .is('ticket_id', null); // Excluir itens com ticket_id (ingressos)

      // Aplicar filtros
      // Nota: Não aplicar filtro de status aqui, pois vamos filtrar por payment_status no código
      // para ter mais controle sobre quais pedidos mostrar

      if (filters?.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }

      if (filters?.dateTo) {
        query = query.lte('created_at', filters.dateTo);
      }

      if (filters?.size) {
        query = query.eq('size', filters.size);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error: fetchError } = await query;

      if (fetchError) {
        console.error('Erro ao buscar order_items:', fetchError);
        // Tentar sem o filtro de payment_status se falhar (pode ser limitação do Supabase)
        throw new Error(`Erro ao buscar itens de roupas: ${fetchError.message}`);
      }

      let clothingItems = (data || []).filter(item => {
        // ✅ CORREÇÃO: Identificar roupas por múltiplos sinais, não apenas category
        const productCategory = (item.products?.category || '').toLowerCase();
        const productName = (item.products?.name || '').toLowerCase();
        const sizes = item.products?.sizes || [];
        const hasSizes = Array.isArray(sizes) && sizes.length > 0;

        const isClothingByCategory = clothingKeywords.some(k => productCategory.includes(k));
        const isClothingByName = clothingKeywords.some(k => productName.includes(k));
        const isClothing = isClothingByCategory || isClothingByName || hasSizes;

        if (!isClothing) return false;

        // Aplicar filtro de payment_status se fornecido
        if (filters?.paymentStatus && filters.paymentStatus !== 'all') {
          const filterValue = filters.paymentStatus.toLowerCase();
          const paymentStatus = (item.orders?.payment_status || 'pending').toLowerCase();
          const orderStatus = (item.orders?.status || '').toLowerCase();

          // Mapear valores do filtro para os campos corretos
          // Valores de payment_status: pending, paid, failed, refunded, confirmed
          // Valores de orders.status: pending, confirmed, shipped, delivered, cancelled
          
          // Verificar payment_status primeiro
          if (filterValue === 'pending' || filterValue === 'paid' || filterValue === 'failed' || filterValue === 'refunded') {
            return paymentStatus === filterValue;
          }
          
          // Verificar orders.status para valores como confirmed, shipped, delivered
          if (filterValue === 'confirmed' || filterValue === 'shipped' || filterValue === 'delivered') {
            // "confirmed" pode estar em payment_status ou orders.status
            if (filterValue === 'confirmed') {
              return paymentStatus === 'confirmed' || orderStatus === 'confirmed';
            }
            return orderStatus === filterValue;
          }
          
          // Se não corresponder a nenhum, retornar false
          return false;
        }

        // Se não houver filtro, mostrar todos os pedidos de roupas
        // (paid, pending, confirmed, shipped, delivered)
        // Excluir apenas 'failed' e 'refunded' por padrão
        const paymentStatus = (item.orders?.payment_status || 'pending').toLowerCase();
        const excludedStatuses = ['failed', 'refunded'];
        return !excludedStatuses.includes(paymentStatus);
      });

      // Aplicar filtro de categoria se necessário
      if (filters?.category) {
        const normalizedFilter = filters.category.toLowerCase();
        clothingItems = clothingItems.filter(item => {
          const category = (item.products?.category || '').toLowerCase();
          const name = (item.products?.name || '').toLowerCase();
          return category.includes(normalizedFilter) || name.includes(normalizedFilter);
        });
      }

      // Aplicar filtro de busca se necessário
      if (filters?.search) {
        const searchTerm = filters.search.toLowerCase();
        clothingItems = clothingItems.filter(item => {
          const matchesId = item.id?.toLowerCase().includes(searchTerm);
          const matchesProductName = item.products?.name?.toLowerCase().includes(searchTerm);
          const matchesSize = item.size?.toLowerCase().includes(searchTerm);
          const matchesEmail = item.orders?.customer_data?.email?.toLowerCase().includes(searchTerm) ||
                              item.orders?.customer_email?.toLowerCase().includes(searchTerm);
          const matchesName = item.orders?.customer_data?.name?.toLowerCase().includes(searchTerm) ||
                             item.orders?.customer_name?.toLowerCase().includes(searchTerm);
          
          return matchesId || matchesProductName || matchesSize || matchesEmail || matchesName;
        });
      }

      // Agrupar itens por order_id
      const groupedItems = groupClothingItemsByOrder(clothingItems);

      // Aplicar paginação aos grupos
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage;
      const paginatedGroups = groupedItems.slice(from, to);

      setClothingGroups(paginatedGroups);
      setTotalCount(groupedItems.length);
    } catch (err) {
      console.error('Erro ao buscar itens de roupas:', err);
      setError(err instanceof Error ? err : new Error('Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  // Função para expandir itens com quantidade > 1 em múltiplas linhas individuais
  const expandClothingItems = (items: ClothingItem[]): ClothingItem[] => {
    const expandedItems: ClothingItem[] = [];
    
    items.forEach((item) => {
      const quantity = item.quantity || 1;
      
      // Se a quantidade é 1, adiciona o item como está
      if (quantity === 1) {
        expandedItems.push({
          ...item,
          display_id: item.id, // ID para renderização é o mesmo
          original_id: item.id  // Preserva o ID original
        });
      } else {
        // Se a quantidade é > 1, cria múltiplas linhas individuais
        // Calcular preço unitário
        const totalPrice = item.total_price || item.price || 0;
        const unitPrice = totalPrice / quantity;
        
        for (let i = 0; i < quantity; i++) {
          expandedItems.push({
            ...item,
            id: item.id, // MANTÉM o ID original do banco de dados
            display_id: `${item.id}-${i + 1}`, // ID único apenas para renderização
            original_id: item.id, // Preserva o ID original
            quantity: 1, // Cada linha tem quantidade 1
            price: unitPrice, // Preço unitário
            total_price: unitPrice, // Para itens individuais, total_price = price
          });
        }
      }
    });
    
    return expandedItems;
  };

  // Função para agrupar itens por pedido (após expansão)
  const groupClothingItemsByOrder = (items: ClothingItem[]): ClothingGroup[] => {
    // Primeiro expande os itens
    const expandedItems = expandClothingItems(items);
    
    // ✅ CORREÇÃO: Agrupar por order_id em vez de por email
    const orderGroups = new Map<string, ClothingItem[]>();

    // Agrupar por order_id (pedido)
    expandedItems.forEach(item => {
      const orderId = item.order_id;
      
      // Se não tem order_id, criar um grupo único para cada item
      if (!orderId) {
        const uniqueKey = `no-order-${item.id}`;
        if (!orderGroups.has(uniqueKey)) {
          orderGroups.set(uniqueKey, []);
        }
        orderGroups.get(uniqueKey)!.push(item);
      } else {
        if (!orderGroups.has(orderId)) {
          orderGroups.set(orderId, []);
        }
        orderGroups.get(orderId)!.push(item);
      }
    });

    const groups: ClothingGroup[] = [];

    // Processar cada grupo de pedido
    orderGroups.forEach((orderItems, orderId) => {
      // Calcular valores totais (agora cada item tem quantidade 1)
      const totalValue = orderItems.reduce((sum, item) => {
        const price = normalizePrice(item.total_price || item.price || 0);
        return sum + price;
      }, 0);
      const totalQuantity = orderItems.length; // Cada item expandido tem quantidade 1
      
      // Determinar status do grupo (priorizar payment_status, depois orders.status)
      const statuses = Array.from(new Set(orderItems.map(item => {
        // Priorizar payment_status, mas usar orders.status como fallback
        return item.orders?.payment_status || item.orders?.status || 'pending';
      })));
      const groupStatus = statuses.length === 1 ? statuses[0] : 'mixed';
      
      // Determinar nome do produto
      const uniqueProducts = Array.from(new Set(orderItems.map(item => item.products?.name).filter(Boolean)));
      const productName = uniqueProducts.length > 1 ? 'Múltiplos produtos' : (uniqueProducts[0] || 'Produto não encontrado');

      // Usar o primeiro item para informações básicas
      const firstItem = orderItems[0];
      
      // Obter email do cliente do pedido
      const customerEmail = firstItem.orders?.customer_data?.email || firstItem.orders?.customer_email || 'Cliente sem email';
      const customerName = firstItem.orders?.customer_data?.name || firstItem.orders?.customer_name || 'Cliente não encontrado';

      // Criar grupo (sempre como package para permitir expansão)
      const group: ClothingGroup = {
        id: orderId.startsWith('no-order-') ? orderId : `order-${orderId}`,
        type: 'package',
        order_id: orderId.startsWith('no-order-') ? null : orderId, // ✅ CORREÇÃO: Usar order_id real
        customer_name: customerName,
        customer_email: customerEmail,
        product_name: productName,
        item_count: totalQuantity,
        total_quantity: totalQuantity,
        unit_price: orderItems.length === 1 ? normalizePrice(firstItem.price || 0) : 0,
        total_value: totalValue,
        status: groupStatus,
        created_at: firstItem.orders?.created_at || firstItem.created_at || '',
        items: orderItems, // Itens expandidos
        // Para compatibilidade
        quantity: totalQuantity,
        price: totalValue,
        customers: {
          full_name: customerName,
          email: customerEmail
        },
        products: {
          name: productName
        },
        hasMultipleItems: orderItems.length > 1,
        order_count: 1, // ✅ CORREÇÃO: Cada grupo representa um pedido
        unique_orders: orderId.startsWith('no-order-') ? [] : [orderId]
      };

      groups.push(group);
    });

    // Ordenar por data de criação (mais recente primeiro)
    return groups.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  };

  // Estado para estatísticas globais
  const [globalStats, setGlobalStats] = useState({
    total: 0,
    pending: 0,
    shipped: 0,
    delivered: 0,
    cancelled: 0,
    totalRevenue: 0
  });

  // Função para buscar estatísticas globais
  const fetchGlobalStats = async () => {
    try {
      // Definir categorias que são consideradas roupas
      const clothingCategories = ['camiseta', 'vestido', 'calca', 'blusa', 'camisa', 'short', 'saia', 'jaqueta', 'casaco'];

      // Construir query base para estatísticas
      let statsQuery = supabase
        .from('order_items')
        .select(`
          quantity, 
          total_price, 
          price,
          products!product_id (category),
          orders!order_id (status)
        `)
        .not('product_id', 'is', null)
        .is('ticket_id', null); // Excluir itens com ticket_id (ingressos)

      // Aplicar os mesmos filtros das estatísticas
      if (filters?.status && filters.status !== 'all') {
        statsQuery = statsQuery.eq('orders.status', filters.status);
      }

      if (filters?.dateFrom) {
        statsQuery = statsQuery.gte('created_at', filters.dateFrom);
      }

      if (filters?.dateTo) {
        statsQuery = statsQuery.lte('created_at', filters.dateTo);
      }

      const { data: allItems, error: statsError } = await statsQuery;

      if (statsError) {
        throw new Error(`Erro ao buscar estatísticas: ${statsError.message}`);
      }

      if (allItems) {
        // Filtrar apenas itens de roupas
        const clothingItems = allItems.filter((item: any) => {
          const productCategory = item.products?.category?.toLowerCase();
          return productCategory && clothingCategories.includes(productCategory);
        });

        const total = clothingItems.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
        const pending = clothingItems.filter((item: any) => item.orders?.status === 'pending').reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
        const shipped = clothingItems.filter((item: any) => item.orders?.status === 'shipped').reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
        const delivered = clothingItems.filter((item: any) => item.orders?.status === 'delivered').reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
        const cancelled = clothingItems.filter((item: any) => item.orders?.status === 'cancelled').reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
        
        const totalRevenue = clothingItems
          .filter((item: any) => 
            item.orders?.status === 'shipped' || 
            item.orders?.status === 'delivered' || 
            item.orders?.status === 'confirmed' ||
            item.orders?.status === 'pending'
          )
          .reduce((sum: number, item: any) => {
            const price = normalizePrice(item.total_price || 0);
            return sum + price;
          }, 0);

        setGlobalStats({
          total,
          pending,
          shipped,
          delivered,
          cancelled,
          totalRevenue
        });
      }
    } catch (err) {
      console.error('Erro ao buscar estatísticas globais:', err);
    }
  };

  // Buscar dados quando componente monta ou filtros mudam
  useEffect(() => {
    fetchClothingItems();
    fetchGlobalStats();
  }, [currentPage, filters?.status, filters?.dateFrom, filters?.dateTo, filters?.search, filters?.size, filters?.category]);

  // Calcular estatísticas (usar estatísticas globais)
  const stats = useMemo(() => {
    return globalStats;
  }, [globalStats]);

  // Calcular paginação
  const totalPages = Math.ceil(totalCount / itemsPerPage);
  const hasNextPage = currentPage < totalPages;
  const hasPreviousPage = currentPage > 1;

  return {
    clothingGroups,
    stats,
    loading,
    error,
    currentPage,
    totalPages,
    hasNextPage,
    hasPreviousPage,
    setCurrentPage,
    refetch: fetchClothingItems
  };
}