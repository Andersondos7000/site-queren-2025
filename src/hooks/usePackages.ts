import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { PackageProps, PackageItem } from '@/components/PackageCard';

export const usePackages = () => {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: fetchError } = await supabase
          .from('products')
          .select('*')
          .in('category', ['inscricao', 'camiseta', 'vestido', 'pacote'])
          .eq('in_stock', true)
          .order('name');

        if (fetchError) {
          throw fetchError;
        }

        setProducts(data || []);
      } catch (err) {
        console.error('Erro ao buscar produtos:', err);
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  // Criar pacotes baseados nos produtos do banco
  const packages = useMemo((): PackageProps[] => {
    if (!products.length) return [];

    const inscricao = products.find(p => p.category === 'inscricao');
    const camiseta = products.find(p => p.category === 'camiseta');
    const vestido = products.find(p => p.category === 'vestido');

    const packageProducts = products.filter(p => p.category === 'pacote');

    const generatedPackages: PackageProps[] = [];

    // Mapear produtos do banco que já são pacotes
    packageProducts.forEach(pkg => {
      let items: PackageItem[] = [];
      let originalPrice = 0;

      // Determinar itens baseado no nome do pacote
      if (pkg.name.includes('Inscrição + Camiseta')) {
        if (inscricao && camiseta) {
          items = [
            {
              id: inscricao.id,
              name: inscricao.name || inscricao.description,
              price: inscricao.price,
              image: inscricao.image_url || '/placeholder.svg',
              category: 'inscricao'
            },
            {
              id: camiseta.id,
              name: camiseta.name || camiseta.description,
              price: camiseta.price,
              image: camiseta.image_url || '/placeholder.svg',
              category: 'camiseta',
              sizes: camiseta.sizes || ['P', 'M', 'G', 'GG']
            }
          ];
          originalPrice = inscricao.price + camiseta.price;
        }
      } else if (pkg.name.includes('Inscrição + Vestido')) {
        if (inscricao && vestido) {
          items = [
            {
              id: inscricao.id,
              name: inscricao.name || inscricao.description,
              price: inscricao.price,
              image: inscricao.image_url || '/placeholder.svg',
              category: 'inscricao'
            },
            {
              id: vestido.id,
              name: vestido.name || vestido.description,
              price: vestido.price,
              image: vestido.image_url || '/placeholder.svg',
              category: 'vestido',
              sizes: vestido.sizes || ['P', 'M', 'G', 'GG']
            }
          ];
          originalPrice = inscricao.price + vestido.price;
        }
      } else if (pkg.name.includes('Completo')) {
        if (inscricao && camiseta && vestido) {
          items = [
            {
              id: inscricao.id,
              name: inscricao.name || inscricao.description,
              price: inscricao.price,
              image: inscricao.image_url || '/placeholder.svg',
              category: 'inscricao'
            },
            {
              id: camiseta.id,
              name: camiseta.name || camiseta.description,
              price: camiseta.price,
              image: camiseta.image_url || '/placeholder.svg',
              category: 'camiseta',
              sizes: camiseta.sizes || ['P', 'M', 'G', 'GG']
            },
            {
              id: vestido.id,
              name: vestido.name || vestido.description,
              price: vestido.price,
              image: vestido.image_url || '/placeholder.svg',
              category: 'vestido',
              sizes: vestido.sizes || ['P', 'M', 'G', 'GG']
            }
          ];
          originalPrice = inscricao.price + camiseta.price + vestido.price;
        }
      }

      if (items.length > 0) {
        generatedPackages.push({
          id: pkg.id,
          name: pkg.name || pkg.description,
          description: pkg.description || `Pacote especial com desconto exclusivo`,
          price: pkg.price,
          originalPrice,
          items,
          image: pkg.image_url || items[0]?.image || '/placeholder.svg',
          inStock: pkg.in_stock,
          category: 'pacote',
          discount: originalPrice > pkg.price ? Math.round(((originalPrice - pkg.price) / originalPrice) * 100) : 0
        });
      }
    });

    return generatedPackages;
  }, [products]);

  // Produtos individuais (não pacotes)
  const individualProducts = useMemo(() => {
    return products.filter(p => p.category !== 'pacote').map(product => ({
      id: product.id,
      name: product.name || product.description,
      price: product.price,
      image: product.image_url || '/placeholder.svg',
      category: product.category as 'camiseta' | 'vestido' | 'inscricao',
      sizes: product.sizes || (product.category !== 'inscricao' ? ['P', 'M', 'G', 'GG'] : []),
      inStock: product.in_stock,
      stock: product.stock_quantity || 0
    }));
  }, [products]);

  return {
    packages,
    individualProducts,
    loading,
    error,
    refetch: () => {
      setLoading(true);
      // Re-trigger useEffect
      setProducts([]);
    }
  };
};