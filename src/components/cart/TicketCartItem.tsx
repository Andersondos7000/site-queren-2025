
import React from 'react';
import { Trash2 } from 'lucide-react';
import { useCart } from '@/hooks/useCart';
import { CartTicket } from '@/lib/cart-utils';

interface TicketCartItemProps {
  item: CartTicket;
}

const TicketCartItem: React.FC<TicketCartItemProps> = ({ item }) => {
  const { updateQuantity, removeFromCart } = useCart();
  
  const handleQuantityChange = (newQuantity: number) => {
    console.log('🔍 TicketCartItem handleQuantityChange:', { newQuantity, currentQuantity: item.quantity, itemId: item.id });
    console.log('📊 Nova quantidade recebida:', newQuantity);
    
    if (newQuantity >= 1) {
      console.log('✅ Chamando updateQuantity com:', { itemId: item.id, newQuantity });
      updateQuantity(item.id, newQuantity);
    } else {
      console.log('❌ Quantidade inválida, não atualizando');
    }
  };
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };
  
  return (
    <div className="p-6 flex flex-wrap md:flex-nowrap gap-4 border-b border-gray-200 last:border-b-0">
      {/* Miniatura do evento */}
      <div className="w-24 h-24 rounded-md overflow-hidden flex-shrink-0">
        <img 
          src={item.image || '/ingressos.webp'} 
          alt={item.event_title || item.name} 
          className="w-full h-full object-cover" 
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.src = '/ingressos.webp';
            target.onerror = null;
          }}
        />
      </div>
      
      <div className="flex-1">
        <h3 className="font-medium text-lg">{item.name}</h3>
        <p className="text-gray-500">18 e 19 de Abril de 2026</p>
        <p className="text-sm mt-1">Ingresso: {formatCurrency(item.price)} (cada)</p>
        
        <div className="flex flex-wrap justify-between items-center mt-2">
          <div className="flex items-center gap-4">
            <div className="flex items-center">
              <label className="mr-2 text-sm">Qtd:</label>
              <div className="flex border border-gray-300 rounded-md">
                <button 
                  onClick={() => handleQuantityChange(item.quantity - 1)} 
                  className="px-2 py-1 border-r border-gray-300"
                  aria-label="Diminuir quantidade"
                  disabled={item.quantity <= 1}
                >
                  -
                </button>
                <span className="px-4 py-1" data-testid="ticket-quantity">{item.quantity}</span>
                <button 
                  onClick={() => handleQuantityChange(item.quantity + 1)} 
                  className="px-2 py-1 border-l border-gray-300"
                  aria-label="Aumentar quantidade"
                >
                  +
                </button>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="font-bold">{formatCurrency(item.total_price)}</div>
            <button 
              onClick={() => removeFromCart(item.id)} 
              className="text-red-500 hover:text-red-700"
              aria-label="Remover ingresso"
            >
              <Trash2 className="h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TicketCartItem;
