
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useCart } from '@/hooks/useCart';
import { isCartProduct, isCartTicket } from '@/lib/cart-utils';
import ProductCartItem from '@/components/cart/ProductCartItem';
import TicketCartItem from '@/components/cart/TicketCartItem';
import { useToast } from '@/hooks/use-toast';
import { enableScrollOnNextNavigation } from '@/hooks/useScrollToTop';

const CartContent = () => {
  const { items, subtotal, shipping, total, isLoading } = useCart();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Separate products and tickets with ID validation
  const products = items.filter(isCartProduct).filter(item => item.id && item.id !== '');
  const tickets = items.filter(isCartTicket).filter(item => item.id && item.id !== '');
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const handleCheckout = () => {
    if (items.length === 0) {
      toast({
        title: "Carrinho vazio",
        description: "Adicione itens ao carrinho antes de finalizar a compra.",
        variant: "destructive"
      });
      return;
    }
    
    console.log("Navigating to checkout with items:", items);
    enableScrollOnNextNavigation();
    navigate('/checkout');
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8 text-center">
        <h2 className="text-xl font-medium mb-4">Carregando seu carrinho...</h2>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-8 text-center">
        <h2 className="text-xl font-medium mb-4">Seu carrinho está vazio</h2>
        <p className="text-gray-600 mb-6">
          Parece que você ainda não adicionou nenhum item ao seu carrinho.
        </p>
        <div className="flex flex-col md:flex-row justify-center gap-4">
          <Button asChild className="bg-butterfly-orange hover:bg-butterfly-orange/90">
            <Link to="/loja">Explorar Loja</Link>
          </Button>
          <Button variant="outline">
            <Link to="/evento" className="text-inherit">Ver Ingressos</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2">
        {products.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm mb-6">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold">Produtos</h2>
            </div>
            
            {products.map((product) => (
              <ProductCartItem key={product.id} item={product} />
            ))}
          </div>
        )}
        
        {tickets.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold">Ingressos</h2>
            </div>
            
            {tickets.map((ticket) => (
              <TicketCartItem key={ticket.id} item={ticket} />
            ))}
          </div>
        )}
      </div>
      
      {/* Resumo */}
      <div className="bg-white rounded-lg shadow-sm p-6 h-fit" data-testid="order-summary">
        <h2 className="text-xl font-bold mb-4 pb-4 border-b border-gray-200">
          Resumo do Pedido
        </h2>
        
        <div className="space-y-3">
          {products.length > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal Produtos</span>
              <span data-testid="subtotal">{formatCurrency(products.reduce((sum, item) => {
                return sum + item.total_price;
              }, 0))}</span>
            </div>
          )}
          
          {tickets.length > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal Ingressos</span>
              <span>{formatCurrency(tickets.reduce((sum, item) => {
                return sum + item.total_price;
              }, 0))}</span>
            </div>
          )}
          
          <div className="border-t border-gray-200 pt-3 mt-3">
            <div className="flex justify-between font-bold text-lg">
              <span>Total</span>
              <span className="text-butterfly-orange" data-testid="total">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>
        
        <Button 
          className="w-full mt-6 bg-butterfly-orange hover:bg-butterfly-orange/90"
          onClick={handleCheckout}
          data-testid="checkout-button"
        >
          Finalizar Compra
        </Button>
        
        <div className="mt-6 text-center">
          <Link 
            to="/loja" 
            className="text-butterfly-orange hover:underline text-sm"
          >
            Continuar Comprando
          </Link>
        </div>
      </div>
    </div>
  );
};

const Carrinho = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <div className="flex-1 bg-gray-50">
        <div className="container mx-auto px-4 py-12">
          <h1 className="font-display text-3xl font-bold mb-8">Seu Carrinho</h1>
          
          <CartContent />
        </div>
      </div>
      
      <Footer />
    </div>
  );
};

export default Carrinho;
