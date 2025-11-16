import { createContext } from 'react';
import { CartItem } from '@/lib/cart-utils';

interface CartContextType {
  items: CartItem[];
  isLoading: boolean;
  addToCart: (item: CartItem) => Promise<void>;
  removeFromCart: (itemId: string) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  updateSize: (itemId: string, size: string) => Promise<void>;
  clearCart: () => Promise<void>;

  subtotal: number;
  shipping: number;
  total: number;
}

export const CartContext = createContext<CartContextType | undefined>(undefined);
export type { CartContextType };