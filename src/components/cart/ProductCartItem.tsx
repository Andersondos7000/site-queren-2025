
import React from 'react';
import { Trash2 } from 'lucide-react';
import { useCart } from '@/hooks/useCart';
import { CartProduct } from '@/lib/cart-utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ProductCartItemProps {
  item: CartProduct;
}

const sizesMap: Record<string, string[]> = {
  camiseta: ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG'],
  vestido: ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG'],
  default: ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG'] // Fallback para categorias não mapeadas
};

const ProductCartItem: React.FC<ProductCartItemProps> = ({ item }) => {
  const { updateQuantity, updateSize, removeFromCart } = useCart();
  
  const handleQuantityChange = (newQuantity: number) => {
    if (newQuantity >= 1) {
      updateQuantity(item.id, newQuantity);
    }
  };
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };
  
  return (
    <div className="p-6 border-b border-gray-100 flex flex-wrap md:flex-nowrap gap-4" data-testid="cart-item">
      <div className="w-24 h-24 rounded-md overflow-hidden flex-shrink-0">
        <img 
          src={item.image} 
          alt={item.name} 
          className="w-full h-full object-cover" 
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = '/placeholder.svg';
            target.onerror = null; // Prevent infinite loops
          }}
        />
      </div>
      
      <div className="flex-1">
        <h3 className="font-medium text-lg" data-testid="item-name">{item.name}</h3>
        <div className="flex flex-wrap justify-between items-center mt-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-4">
              <Select
                value={item.size ?? ''}
                onValueChange={(value) => updateSize(item.id, value)}
              >
                <SelectTrigger className="w-24">
                  <SelectValue placeholder="Tamanho" />
                </SelectTrigger>
                <SelectContent>
                  {(sizesMap[item.category] || sizesMap.default).map((size) => (
                    <SelectItem key={size} value={size}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <div className="flex items-center">
                <label className="mr-2 text-sm">Qtd:</label>
                <div className="flex border border-gray-300 rounded-md">
                  <button 
                    onClick={() => handleQuantityChange(item.quantity - 1)} 
                    className="px-2 py-1 border-r border-gray-300"
                    aria-label="Diminuir quantidade"
                    disabled={item.quantity <= 1}
                    data-testid="decrease-quantity"
                  >
                    -
                  </button>
                  <span className="px-4 py-1" data-testid="item-quantity">{item.quantity}</span>
                  <button 
                    onClick={() => handleQuantityChange(item.quantity + 1)} 
                    className="px-2 py-1 border-l border-gray-300"
                    aria-label="Aumentar quantidade"
                    data-testid="increase-quantity"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="font-bold" data-testid="item-price">{formatCurrency(item.total_price)}</div>
            <button 
              onClick={() => removeFromCart(item.id)} 
              className="text-red-500 hover:text-red-700"
              aria-label="Remover item"
              data-testid="remove-item"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductCartItem;
