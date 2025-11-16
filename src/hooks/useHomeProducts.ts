import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// Dados mock para fallback quando o Supabase falhar
const MOCK_PRODUCTS: HomeProduct[] = [
  {
    id: 'mock-1',
    title: 'Camiseta Premium',
    description: 'Produto de alta qualidade com design exclusivo. Confeccionado com materiais premium para garantir durabilidade e conforto.',
    price: '79.90',
    image_url: '/yupp-generated-image-144120.webp',
    button_text: 'Ver Produto',
    button_link: '/loja',
    display_order: 1,
    position: 1,
    is_featured: true,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'mock-2',
    title: 'Camiseta Preta Conferência',
    description: 'Camiseta oficial da VII Conferência de Mulheres Queren Hapuque. Design exclusivo e material de qualidade superior.',
    price: '69.90',
    image_url: '/Camiseta Preto/Generated Image September 06, 2025 - 12_28AM.jpeg',
    button_text: 'Ver Produto',
    button_link: '/loja',
    display_order: 2,
    position: 2,
    is_featured: false,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'mock-3',
    title: 'Camiseta Rosa Conferência',
    description: 'Camiseta rosa oficial do evento. Peça única com design especial para celebrar o empoderamento feminino.',
    price: '69.90',
    image_url: '/Camiseta Rosa/yupp-generated-image-203029.jpg',
    button_text: 'Ver Produto',
    button_link: '/loja',
    display_order: 3,
    position: 3,
    is_featured: false,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

export interface HomeProduct {
  id: string;
  product_id?: string;
  title: string;
  description: string;
  price: string; // O banco retorna como string (numeric)
  image_url: string;
  button_text: string;
  button_link: string;
  display_order: number;
  position: number;
  is_featured: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UseHomeProductsReturn {
  homeProducts: HomeProduct[];
  loading: boolean;
  error: string | null;
  isUsingFallback: boolean;
  retry: () => void;
}

export const useHomeProducts = (): UseHomeProductsReturn => {
  const [homeProducts, setHomeProducts] = useState<HomeProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUsingFallback, setIsUsingFallback] = useState(false);

  const fetchHomeProducts = async () => {
    try {
      setLoading(true);
      setError(null);
      setIsUsingFallback(false);

      const { data, error: fetchError } = await supabase
        .from('home_products')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (fetchError) {
        throw fetchError;
      }

      if (!data || data.length === 0) {
        console.warn('Nenhum produto ativo encontrado, usando dados de fallback');
        setHomeProducts(MOCK_PRODUCTS);
        setIsUsingFallback(true);
      } else {
        setHomeProducts(data);
      }
    } catch (err) {
      console.error('Erro ao buscar produtos da home:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);
      
      // Usar dados mock como fallback em caso de erro
      setHomeProducts(MOCK_PRODUCTS);
      setIsUsingFallback(true);
      
      // Log adicional para debugging
      console.warn('Usando produtos de fallback devido ao erro:', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHomeProducts();
  }, []);

  return {
    homeProducts,
    loading,
    error,
    isUsingFallback,
    retry: fetchHomeProducts
  };
};