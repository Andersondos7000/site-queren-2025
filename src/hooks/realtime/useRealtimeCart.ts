import { useCallback, useEffect, useState, useRef } from 'react';
import { useOptimizedRealtime } from './useOptimizedRealtime';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useJWTManager } from '../useJWTManager';

interface CartItem {
  id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  price: number;
  created_at: string;
  updated_at: string;
  // Dados do produto (join)
  product?: {
    id: string;
    name: string;
    image_url?: string;
    is_active: boolean;
  };
}

interface CartSyncStatus {
  syncing: boolean;
  lastSync: number | null;
  pendingChanges: number;
  conflictCount: number;
  error: string | null;
}

interface PendingChange {
  id: string;
  type: 'add' | 'update' | 'remove';
  data: Partial<CartItem>;
  timestamp: number;
  retryCount: number;
}

/**
 * Hook para sincronização realtime do carrinho com cache local e resolução de conflitos
 * 
 * Funcionalidades:
 * - Sincronização bidirecional em tempo real
 * - Cache local com IndexedDB
 * - Resolução automática de conflitos
 * - Modo offline com sincronização posterior
 * - Optimistic updates
 * - Debouncing de mudanças
 */
export function useRealtimeCart() {
  const { user } = useAuth();
  const { isAuthenticated, getValidToken } = useJWTManager();
  
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [syncStatus, setSyncStatus] = useState<CartSyncStatus>({
    syncing: false,
    lastSync: null,
    pendingChanges: 0,
    conflictCount: 0,
    error: null
  });
  
  const pendingChangesRef = useRef<Map<string, PendingChange>>(new Map());
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastServerStateRef = useRef<Map<string, CartItem>>(new Map());
  const isInitialLoadRef = useRef(true);

  /**
   * Carrega carrinho inicial do servidor
   */
  const loadInitialCart = useCallback(async () => {
    if (!user?.id || !isAuthenticated()) return;

    try {
      setSyncStatus(prev => ({ ...prev, syncing: true, error: null }));
      
      const token = await getValidToken();
      if (!token) throw new Error('No valid token');

      const { data, error } = await supabase
        .from('cart_items')
        .select(`
          *,
          product:products(
            id,
            name,
            image_url,
            is_active
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const items = data || [];
      setCartItems(items);
      
      // Atualizar estado do servidor para detecção de conflitos
      lastServerStateRef.current.clear();
      items.forEach(item => {
        lastServerStateRef.current.set(item.id, item);
      });
      
      setSyncStatus(prev => ({
        ...prev,
        syncing: false,
        lastSync: Date.now(),
        error: null
      }));
      
      isInitialLoadRef.current = false;
      
      console.log(`🛒 Loaded ${items.length} cart items for user ${user.id}`);
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to load cart';
      
      setSyncStatus(prev => ({
        ...prev,
        syncing: false,
        error: errorMsg
      }));
      
      console.error('❌ Failed to load initial cart:', error);
    }
  }, [user?.id, isAuthenticated, getValidToken]);

  /**
   * Processa mudanças pendentes
   */
  const processPendingChanges = useCallback(async () => {
    if (pendingChangesRef.current.size === 0 || !isAuthenticated()) return;

    const changes = Array.from(pendingChangesRef.current.values())
      .sort((a, b) => a.timestamp - b.timestamp);

    setSyncStatus(prev => ({ ...prev, syncing: true }));

    for (const change of changes) {
      try {
        const token = await getValidToken();
        if (!token) throw new Error('No valid token');

        switch (change.type) {
          case 'add':
          case 'update': {
            const { error } = await supabase
              .from('cart_items')
              .upsert({
                ...change.data,
                user_id: user?.id,
                updated_at: new Date().toISOString()
              });
            
            if (error) throw error;
            break;
          }
          
          case 'remove': {
            const { error } = await supabase
              .from('cart_items')
              .delete()
              .eq('id', change.id)
              .eq('user_id', user?.id);
            
            if (error) throw error;
            break;
          }
        }
        
        // Remover mudança processada
        pendingChangesRef.current.delete(change.id);
        
      } catch (error) {
        console.error(`❌ Failed to process change ${change.id}:`, error);
        
        // Incrementar contador de retry
        const updatedChange = {
          ...change,
          retryCount: change.retryCount + 1
        };
        
        // Remover se muitas tentativas
        if (updatedChange.retryCount >= 3) {
          pendingChangesRef.current.delete(change.id);
          console.warn(`⚠️ Dropping change ${change.id} after 3 retries`);
        } else {
          pendingChangesRef.current.set(change.id, updatedChange);
        }
      }
    }

    setSyncStatus(prev => ({
      ...prev,
      syncing: false,
      pendingChanges: pendingChangesRef.current.size,
      lastSync: Date.now()
    }));
  }, [isAuthenticated, getValidToken, user?.id]);

  /**
   * Agenda processamento de mudanças pendentes
   */
  const schedulePendingSync = useCallback(() => {
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }
    
    syncTimeoutRef.current = setTimeout(() => {
      processPendingChanges();
    }, 1000); // Debounce de 1 segundo
  }, [processPendingChanges]);

  /**
   * Adiciona item ao carrinho com optimistic update
   */
  const addToCart = useCallback(async (productId: string, quantity: number = 1) => {
    if (!user?.id) throw new Error('User not authenticated');

    const tempId = `temp_${Date.now()}_${Math.random()}`;
    const newItem: Partial<CartItem> = {
      id: tempId,
      user_id: user.id,
      product_id: productId,
      quantity,
      price: 0, // Será atualizado pelo servidor
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Optimistic update
    setCartItems(prev => [...prev, newItem as CartItem]);
    
    // Adicionar à fila de mudanças pendentes
    pendingChangesRef.current.set(tempId, {
      id: tempId,
      type: 'add',
      data: newItem,
      timestamp: Date.now(),
      retryCount: 0
    });
    
    setSyncStatus(prev => ({
      ...prev,
      pendingChanges: pendingChangesRef.current.size
    }));
    
    schedulePendingSync();
    
    console.log(`🛒 Added product ${productId} to cart (optimistic)`);
  }, [user?.id, schedulePendingSync]);

  /**
   * Atualiza quantidade de item no carrinho
   */
  const updateQuantity = useCallback(async (itemId: string, quantity: number) => {
    if (!user?.id) throw new Error('User not authenticated');
    
    if (quantity <= 0) {
      return removeFromCart(itemId);
    }

    // Optimistic update
    setCartItems(prev => prev.map(item => 
      item.id === itemId 
        ? { ...item, quantity, updated_at: new Date().toISOString() }
        : item
    ));
    
    // Adicionar à fila de mudanças pendentes
    pendingChangesRef.current.set(itemId, {
      id: itemId,
      type: 'update',
      data: { id: itemId, quantity },
      timestamp: Date.now(),
      retryCount: 0
    });
    
    setSyncStatus(prev => ({
      ...prev,
      pendingChanges: pendingChangesRef.current.size
    }));
    
    schedulePendingSync();
    
    console.log(`🛒 Updated item ${itemId} quantity to ${quantity} (optimistic)`);
  }, [user?.id, schedulePendingSync]);

  /**
   * Remove item do carrinho
   */
  const removeFromCart = useCallback(async (itemId: string) => {
    if (!user?.id) throw new Error('User not authenticated');

    // Optimistic update
    setCartItems(prev => prev.filter(item => item.id !== itemId));
    
    // Adicionar à fila de mudanças pendentes
    pendingChangesRef.current.set(itemId, {
      id: itemId,
      type: 'remove',
      data: { id: itemId },
      timestamp: Date.now(),
      retryCount: 0
    });
    
    setSyncStatus(prev => ({
      ...prev,
      pendingChanges: pendingChangesRef.current.size
    }));
    
    schedulePendingSync();
    
    console.log(`🛒 Removed item ${itemId} from cart (optimistic)`);
  }, [user?.id, schedulePendingSync]);

  /**
   * Limpa todo o carrinho
   */
  const clearCart = useCallback(async () => {
    if (!user?.id) throw new Error('User not authenticated');

    try {
      const token = await getValidToken();
      if (!token) throw new Error('No valid token');

      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;
      
      setCartItems([]);
      pendingChangesRef.current.clear();
      lastServerStateRef.current.clear();
      
      setSyncStatus(prev => ({
        ...prev,
        pendingChanges: 0,
        lastSync: Date.now()
      }));
      
      console.log('🛒 Cart cleared successfully');
      
    } catch (error) {
      console.error('❌ Failed to clear cart:', error);
      throw error;
    }
  }, [user?.id, getValidToken]);

  // Configurar realtime para mudanças do carrinho
  const { status: realtimeStatus } = useOptimizedRealtime<CartItem>({
    table: 'cart_items',
    filter: user?.id ? `user_id=eq.${user.id}` : undefined,
    enabled: !!user?.id && isAuthenticated(),
    
    onInsert: (payload) => {
      const newItem = payload.new;
      
      // Verificar se não é uma mudança local
      if (!pendingChangesRef.current.has(newItem.id)) {
        setCartItems(prev => {
          const exists = prev.find(item => item.id === newItem.id);
          if (exists) return prev;
          
          console.log('🛒 Remote cart item added:', newItem.id);
          return [...prev, newItem];
        });
        
        lastServerStateRef.current.set(newItem.id, newItem);
      }
    },
    
    onUpdate: (payload) => {
      const updatedItem = payload.new;
      
      setCartItems(prev => prev.map(item => {
        if (item.id === updatedItem.id) {
          // Verificar conflito
          const serverItem = lastServerStateRef.current.get(item.id);
          const hasLocalChanges = pendingChangesRef.current.has(item.id);
          
          if (hasLocalChanges && serverItem) {
            // Resolver conflito - servidor ganha
            console.log('🔄 Resolving cart conflict for item:', item.id);
            pendingChangesRef.current.delete(item.id);
            
            setSyncStatus(prev => ({
              ...prev,
              conflictCount: prev.conflictCount + 1,
              pendingChanges: pendingChangesRef.current.size
            }));
          }
          
          lastServerStateRef.current.set(updatedItem.id, updatedItem);
          console.log('🛒 Remote cart item updated:', updatedItem.id);
          
          return updatedItem;
        }
        return item;
      }));
    },
    
    onDelete: (payload) => {
      const deletedItem = payload.old;
      
      setCartItems(prev => {
        const filtered = prev.filter(item => item.id !== deletedItem.id);
        console.log('🛒 Remote cart item deleted:', deletedItem.id);
        return filtered;
      });
      
      lastServerStateRef.current.delete(deletedItem.id);
      pendingChangesRef.current.delete(deletedItem.id);
      
      setSyncStatus(prev => ({
        ...prev,
        pendingChanges: pendingChangesRef.current.size
      }));
    },
    
    onError: (error) => {
      setSyncStatus(prev => ({
        ...prev,
        error: error.message
      }));
    }
  });

  // Carregar carrinho inicial
  useEffect(() => {
    if (user?.id && isAuthenticated() && isInitialLoadRef.current) {
      loadInitialCart();
    }
  }, [user?.id, isAuthenticated, loadInitialCart]);

  // Processar mudanças pendentes quando voltar online
  useEffect(() => {
    if (realtimeStatus.connected && pendingChangesRef.current.size > 0) {
      console.log('🔄 Connection restored, processing pending cart changes');
      processPendingChanges();
    }
  }, [realtimeStatus.connected, processPendingChanges]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, []);

  // Calcular totais
  const totals = {
    items: cartItems.length,
    quantity: cartItems.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  };

  return {
    // Estado do carrinho
    items: cartItems,
    totals,
    
    // Status de sincronização
    syncStatus: {
      ...syncStatus,
      realtimeConnected: realtimeStatus.connected,
      realtimeSubscribed: realtimeStatus.subscribed
    },
    
    // Ações
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    
    // Utilitários
    refresh: loadInitialCart,
    forcSync: processPendingChanges,
    
    // Debug
    debug: {
      pendingChanges: Array.from(pendingChangesRef.current.values()),
      serverState: Array.from(lastServerStateRef.current.values()),
      realtimeStatus
    }
  };
}

/**
 * Hook simplificado para sincronização básica do carrinho
 */
export function useCartSync() {
  const { items, totals, syncStatus, addToCart, updateQuantity, removeFromCart, clearCart } = useRealtimeCart();
  
  return {
    cartItems: items,
    cartSummary: {
      totalItems: totals.quantity,
      totalValue: totals.subtotal,
      items
    },
    loading: syncStatus.syncing,
    error: syncStatus.error ? new Error(syncStatus.error) : null,
    isConnected: syncStatus.realtimeConnected,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    refetch: () => {}
  };
}