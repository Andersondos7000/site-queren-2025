
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { CartItem, CartProduct, CartTicket, isCartProduct, isCartTicket } from '@/lib/cart-utils';
import { CartContext, type CartContextType } from './cart-context';
import { useAuth } from '@/hooks/useAuth';

// Define the structure of the data returned from Supabase
interface CartItemFromSupabase {
  id: string;
  user_id: string;
  product_id?: string;
  ticket_id?: string;
  event_id?: string;
  ticket_type?: string;
  quantity: number;
  unit_price: number;
  total_price?: number;
  size?: string;
  created_at: string;
  products?: {
    id: string;
    name: string;
    price: number;
    image_url?: string;
    category?: string;
  };
  tickets?: {
    id: string;
    event_id: string;
    ticket_type: string;
    unit_price: number;
    status: string;
    events?: {
      id: string;
      title: string;
      cover_image?: string;
    };
  };
  events?: {
    id: string;
    title: string;
    cover_image?: string;
  };
}

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Refs para controle de requisições e debounce
  const abortControllerRef = useRef<AbortController | null>(null);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const localStorageTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isUnmountedRef = useRef(false);
  const isFetchingRef = useRef(false);

  // Função para cancelar requisições pendentes
  const cancelPendingRequests = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
      fetchTimeoutRef.current = null;
    }
    if (localStorageTimeoutRef.current) {
      clearTimeout(localStorageTimeoutRef.current);
      localStorageTimeoutRef.current = null;
    }
    isFetchingRef.current = false;
  }, []);

  // Cleanup ao desmontar componente
  useEffect(() => {
    isUnmountedRef.current = false;
    
    return () => {
      isUnmountedRef.current = true;
      cancelPendingRequests();
    };
  }, [cancelPendingRequests]);

  // Função para migrar itens do localStorage para o Supabase
  const migrateLocalCartToSupabase = useCallback(async () => {
    if (!user) return;

    try {
      const localCart = localStorage.getItem('cart');
      if (!localCart) return;

      const localItems: CartItem[] = JSON.parse(localCart);
      if (localItems.length === 0) return;

      console.log('Migrando carrinho do localStorage para Supabase...', localItems);

      // Migrar cada item do localStorage para o Supabase
      for (const item of localItems) {
        if (isCartProduct(item)) {
          await supabase
            .from('cart_items')
            .insert({
              user_id: user.id,
              product_id: item.product_id,
              quantity: item.quantity,
              unit_price: item.price,
              size: item.size || null,
            });
        } else if (isCartTicket(item)) {
          await supabase
            .from('cart_items')
            .insert({
              user_id: user.id,
              ticket_id: item.ticket_id,
              quantity: item.quantity,
              unit_price: item.price,
            });
        }
      }

      // Limpar localStorage após migração bem-sucedida
      localStorage.removeItem('cart');
      console.log('Migração do carrinho concluída com sucesso');

      toast({
        title: "Carrinho sincronizado",
        description: "Seus itens foram transferidos para sua conta",
      });

    } catch (error) {
      console.error('Erro ao migrar carrinho:', error);
      // Não mostrar toast de erro para não confundir o usuário
    }
  }, [user, toast]);

  // Função para buscar itens do carrinho
  const fetchCartItems = useCallback(async () => {
    // Evitar chamadas simultâneas
    if (isFetchingRef.current) {
      return;
    }

    try {
      isFetchingRef.current = true;
      
      // Verificar se componente foi desmontado
      if (isUnmountedRef.current) {
        return;
      }

      setIsLoading(true);
      
      if (user) {
        // Primeiro, verificar se há itens no localStorage para migrar
        const localCart = localStorage.getItem('cart');
        if (localCart) {
          const localItems: CartItem[] = JSON.parse(localCart);
          if (localItems.length > 0) {
            await migrateLocalCartToSupabase();
          }
        }

        // Buscar dados do Supabase para usuário logado
        console.log('🔍 DEBUG: Buscando carrinho para user.id:', user.id);
        const { data, error } = await supabase
          .from('cart_items')
          .select(`
            id,
            user_id,
            product_id,
            ticket_id,
            event_id,
            ticket_type,
            quantity,
            unit_price,
            size,
            created_at,
            products (
              id,
              name,
              price,
              image_url,
              category
            ),
            tickets (
              id,
              event_id,
              ticket_type,
              price,
              status,
              events (
                id,
                title,
                image_url
              )
            )
          `)
          .eq('user_id', user.id);

        if (error) {
          console.error('Erro ao buscar itens do carrinho:', error);
          throw error;
        }

        // Debug: Log dos dados brutos do Supabase
        console.log('🔍 Dados brutos do Supabase:', data);
        console.log('🔍 Quantidade de itens retornados:', data?.length || 0);

        // Processar itens do carrinho
        const processedItems: CartItem[] = (data as any as CartItemFromSupabase[]).map((item, index) => {
          console.log(`🔍 Processando item ${index + 1}:`, item);
          
          if (item.product_id && item.products) {
            const productItem: CartProduct = {
              id: item.id,
              product_id: item.product_id, // Usar product_id em vez de productId
              name: item.products.name,
              price: item.unit_price,
              image: item.products.image_url,
              images: [item.products.image_url], // Array de imagens
              category: item.products.category,
              size: item.size,
              quantity: item.quantity,
              unit_price: item.unit_price,
              total_price: item.quantity * item.unit_price,
              metadata: {}
            };
            console.log('✅ Item produto processado:', productItem);
            return productItem;
          } else if (item.ticket_id && item.tickets) {
            // Ticket já criado (com ticket_id)
            const ticketItem: CartTicket = {
              id: item.id,
              ticket_id: item.ticket_id,
              name: `${item.tickets.events?.title || 'Evento'} - ${item.tickets.ticket_type}`,
              price: item.unit_price,
              quantity: item.quantity,
              unit_price: item.unit_price,
              total_price: item.quantity * item.unit_price,
              ticket_type: item.tickets.ticket_type,
              status: item.tickets.status,
              image: item.tickets.events?.cover_image,
              event_title: item.tickets.events?.title || 'Evento',
              event_id: item.tickets.event_id
            };
            console.log('✅ Item ingresso processado (ticket existente):', ticketItem);
            return ticketItem;
          } else if (item.event_id && !item.ticket_id) {
            // ✅ Ticket a ser criado (sem ticket_id, apenas event_id)
            const ticketItem: CartTicket = {
              id: item.id,
              ticket_id: null, // Será criado após pagamento
              name: `${item.events?.title || 'Evento'} - ${item.ticket_type || 'Ingresso'}`,
              price: item.unit_price,
              quantity: item.quantity,
              unit_price: item.unit_price,
              total_price: item.quantity * item.unit_price,
              ticket_type: item.ticket_type || 'individual',
              status: 'pending',
              image: item.events?.cover_image,
              event_title: item.events?.title || 'Evento',
              event_id: item.event_id
            };
            console.log('✅ Item ingresso processado (a ser criado):', ticketItem);
            return ticketItem;
          } else {
            console.log('❌ Item não processado (dados incompletos):', {
              product_id: item.product_id,
              products: item.products,
              ticket_id: item.ticket_id,
              tickets: item.tickets,
              event_id: item.event_id,
              ticket_type: item.ticket_type
            });
          }
          return null;
        }).filter(Boolean) as CartItem[];

        console.log('🔍 Itens processados finais:', processedItems);
        console.log('🔍 Quantidade de itens processados:', processedItems.length);

        if (!isUnmountedRef.current) {
          setItems(processedItems);
          console.log('✅ Items definidos no estado:', processedItems);
        }

        // Se não há itens no Supabase mas há no localStorage, mostrar os do localStorage temporariamente
        if (processedItems.length === 0 && localCart) {
          const localItems: CartItem[] = JSON.parse(localCart);
          if (localItems.length > 0) {
            console.log('Exibindo itens do localStorage enquanto migração é processada');
            if (!isUnmountedRef.current) {
              setItems(localItems);
            }
          }
        }
      } else {
        // Usuário não logado - usar localStorage
        const localCart = localStorage.getItem('cart');
        if (localCart) {
          try {
            const parsedCart = JSON.parse(localCart);
            if (!isUnmountedRef.current) {
              setItems(Array.isArray(parsedCart) ? parsedCart : []);
            }
          } catch (error) {
            console.error('Erro ao parsear carrinho do localStorage:', error);
            if (!isUnmountedRef.current) {
              setItems([]);
            }
          }
        } else {
          if (!isUnmountedRef.current) {
            setItems([]);
          }
        }
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Erro ao buscar itens do carrinho:', error);
        if (!isUnmountedRef.current) {
          toast({
            title: "Erro",
            description: "Não foi possível carregar o carrinho",
            variant: "destructive",
          });
        }
      } else {
        // AbortError é esperado quando cancelamos requisições, não é um erro real
        console.log('Requisição do carrinho foi cancelada (AbortError)');
      }
    } finally {
      if (!isUnmountedRef.current) {
        setIsLoading(false);
        isFetchingRef.current = false;
      }
    }
  }, [user, toast, migrateLocalCartToSupabase]);

  // Função para adicionar item ao carrinho
  const addToCart = useCallback(async (item: CartItem) => {
    try {
      if (user) {
        // Usuário logado - usar UPSERT no Supabase para evitar duplicatas
        if (isCartProduct(item)) {
          // Para produtos - primeiro verificar se já existe
          const { data: existingItems } = await supabase
            .from('cart_items')
            .select('id, quantity')
            .eq('user_id', user.id)
            .eq('product_id', item.product_id)
            .eq('size', item.size || (item.metadata?.size as string) || '');

          if (existingItems && existingItems.length > 0) {
            // Item já existe, atualizar quantidade
            const { error } = await supabase
              .from('cart_items')
              .update({
                quantity: existingItems[0].quantity + item.quantity,
                unit_price: item.price,
              })
              .eq('id', existingItems[0].id);

            if (error) throw error;
          } else {
            // Item novo, inserir
            const { error } = await supabase
              .from('cart_items')
              .insert({
                user_id: user.id,
                product_id: item.product_id,
                quantity: item.quantity,
                unit_price: item.price,
                size: item.size || (item.metadata?.size as string) || null,
              });

            if (error) throw error;
          }
        } else if (isCartTicket(item)) {
          // Para tickets - primeiro verificar se já existe
          const { data: existingItems } = await supabase
            .from('cart_items')
            .select('id, quantity')
            .eq('user_id', user.id)
            .eq('ticket_id', item.ticket_id);

          if (existingItems && existingItems.length > 0) {
            // Item já existe, atualizar quantidade
            const { error } = await supabase
              .from('cart_items')
              .update({
                quantity: existingItems[0].quantity + item.quantity,
                unit_price: item.price,
              })
              .eq('id', existingItems[0].id);

            if (error) {
              console.error('Erro ao atualizar ticket no carrinho:', error);
              throw error;
            }
          } else {
            // Item novo, inserir
            // ✅ CORREÇÃO: Incluir event_id e ticket_type quando ticket_id é NULL
            const insertData: any = {
              user_id: user.id,
              ticket_id: item.ticket_id,
              quantity: item.quantity,
              unit_price: item.price,
              total_price: item.price * item.quantity,
            };
            
            // Se ticket_id é NULL, adicionar event_id e ticket_type
            if (!item.ticket_id && item.event_id) {
              insertData.event_id = item.event_id;
              insertData.ticket_type = item.ticket_type || 'individual';
            }
            
            const { error } = await supabase
              .from('cart_items')
              .insert(insertData);

            if (error) {
              console.error('Erro ao adicionar ticket ao carrinho:', error);
              throw error;
            }
          }
        }

        // Recarregar itens do carrinho
        await fetchCartItems();
      } else {
        // Usuário não logado - verificar se item já existe no localStorage
        const existingItemIndex = items.findIndex(existingItem => {
          if (isCartProduct(item) && isCartProduct(existingItem)) {
            // Para produtos, verificar tanto product_id quanto size
            const itemSize = item.size || (item.metadata?.selectedSize as string) || (item.metadata?.size as string);
            const existingSize = existingItem.size || (existingItem.metadata?.selectedSize as string) || (existingItem.metadata?.size as string);
            return existingItem.product_id === item.product_id && existingSize === itemSize;
          }
          if (isCartTicket(item) && isCartTicket(existingItem)) {
            return existingItem.ticket_id === item.ticket_id;
          }
          return false;
        });

        let updatedItems;
        if (existingItemIndex >= 0) {
          // Item já existe, atualizar quantidade
          updatedItems = [...items];
          updatedItems[existingItemIndex] = {
            ...updatedItems[existingItemIndex],
            quantity: updatedItems[existingItemIndex].quantity + item.quantity,
            total_price: (updatedItems[existingItemIndex].quantity + item.quantity) * item.price
          };
        } else {
          // Item novo, adicionar à lista
          // Garantir que o size seja extraído corretamente do metadata
          const itemSize = item.size || (item.metadata?.selectedSize as string) || (item.metadata?.size as string);
          updatedItems = [...items, { 
            ...item, 
            id: Date.now().toString(),
            size: itemSize, // Definir explicitamente o size
            total_price: item.quantity * item.price
          }];
        }
        
        setItems(updatedItems);
        localStorage.setItem('cart', JSON.stringify(updatedItems));
      }

      toast({
        title: "Sucesso",
        description: "Item adicionado ao carrinho",
      });
    } catch (error) {
      console.error('Erro ao adicionar item ao carrinho:', error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar o item ao carrinho",
        variant: "destructive",
      });
    }
  }, [user, items, fetchCartItems, toast]);

  // Função para remover item do carrinho
  const removeFromCart = useCallback(async (itemId: string) => {
    try {
      if (user) {
        // Usuário logado - remover do Supabase
        const { error } = await supabase
          .from('cart_items')
          .delete()
          .eq('id', itemId)
          .eq('user_id', user.id);

        if (error) throw error;

        // Recarregar itens do carrinho
        await fetchCartItems();
      } else {
        // Usuário não logado - remover do localStorage
        const updatedItems = items.filter(item => item.id !== itemId);
        setItems(updatedItems);
        localStorage.setItem('cart', JSON.stringify(updatedItems));
      }

      toast({
        title: "Sucesso",
        description: "Item removido do carrinho",
      });
    } catch (error) {
      console.error('Erro ao remover item do carrinho:', error);
      toast({
        title: "Erro",
        description: "Não foi possível remover o item do carrinho",
        variant: "destructive",
      });
    }
  }, [user, items, fetchCartItems, toast]);

  // Função para atualizar quantidade
  const updateQuantity = useCallback(async (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      await removeFromCart(itemId);
      return;
    }

    try {
      if (user) {
        // Usuário logado - atualizar no Supabase
        const { error } = await supabase
          .from('cart_items')
          .update({ 
            quantity,
            // Removido total_price - é calculado automaticamente pelo banco
          })
          .eq('id', itemId)
          .eq('user_id', user.id);

        if (error) throw error;

        // Atualizar apenas o item específico no estado local (sem recarregar tudo)
        const updatedItems = items.map(item => 
          item.id === itemId 
            ? { 
                ...item, 
                quantity,
                total_price: item.unit_price ? item.unit_price * quantity : item.price * quantity
              }
            : item
        );
        setItems(updatedItems);
      } else {
        // Usuário não logado - atualizar no localStorage
        const updatedItems = items.map(item => 
          item.id === itemId 
            ? { 
                ...item, 
                quantity,
                total_price: item.price * quantity // Calcular total_price corretamente
              }
            : item
        );
        setItems(updatedItems);
        localStorage.setItem('cart', JSON.stringify(updatedItems));
      }
    } catch (error) {
      console.error('Erro ao atualizar quantidade:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a quantidade",
        variant: "destructive",
      });
    }
  }, [user, items, removeFromCart, toast]);

  // Função para atualizar tamanho
  const updateSize = useCallback(async (itemId: string, size: string) => {
    try {
      if (user) {
        // Usuário logado - atualizar no Supabase
        const { error } = await supabase
          .from('cart_items')
          .update({ size })
          .eq('id', itemId)
          .eq('user_id', user.id);

        if (error) throw error;

        // Atualizar apenas o item específico no estado local (sem recarregar tudo)
        const updatedItems = items.map(item => 
          item.id === itemId && isCartProduct(item)
            ? { ...item, size }
            : item
        );
        setItems(updatedItems);
      } else {
        // Usuário não logado - atualizar no localStorage
        const updatedItems = items.map(item => 
          item.id === itemId && isCartProduct(item)
            ? { ...item, size }
            : item
        );
        setItems(updatedItems);
        localStorage.setItem('cart', JSON.stringify(updatedItems));
      }
    } catch (error) {
      console.error('Erro ao atualizar tamanho:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o tamanho",
        variant: "destructive",
      });
    }
  }, [user, items, toast]);

  // Função para limpar carrinho
  const clearCart = useCallback(async (options?: { showToast?: boolean }) => {
    const showToast = options?.showToast !== false; // Padrão: true (mostrar toast)
    
    try {
      if (user) {
        // Usuário logado - limpar do Supabase
        const { error } = await supabase
          .from('cart_items')
          .delete()
          .eq('user_id', user.id);

        if (error) throw error;
      }

      // Limpar estado local e localStorage
      setItems([]);
      localStorage.removeItem('cart');

      // Mostrar toast apenas se showToast for true
      if (showToast) {
        toast({
          title: "Sucesso",
          description: "Carrinho limpo com sucesso",
        });
      }
    } catch (error) {
      console.error('Erro ao limpar carrinho:', error);
      toast({
        title: "Erro",
        description: "Não foi possível limpar o carrinho",
        variant: "destructive",
      });
    }
  }, [user, toast]);

  // Calcular totais
  const subtotal = items.reduce((sum, item) => sum + item.total_price, 0);
  const shipping = 0; // Sem frete
  const total = subtotal; // Total = subtotal (sem frete, sem desconto)

  // Carregar itens do carrinho quando o componente montar ou usuário mudar
  useEffect(() => {
    fetchCartItems();
  }, [fetchCartItems]);

  const contextValue: CartContextType = {
    items,
    isLoading,
    addToCart,
    removeFromCart,
    updateQuantity,
    updateSize,
    clearCart,
    subtotal,
    shipping,
    total,
  };

  return (
    <CartContext.Provider value={contextValue}>
      {children}
    </CartContext.Provider>
  );
};

// Exportar o CartContext para uso em outros arquivos
export { CartContext };

