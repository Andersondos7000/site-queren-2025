import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ShoppingCart, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import OptimizedImage from './OptimizedImage';
import { useCart } from '@/hooks/useCart';
import { useToast } from '@/hooks/use-toast';
import { HomeProduct } from '@/hooks/useHomeProducts';

interface HomeProductCardProps {
  product: HomeProduct;
  enableDirectCart?: boolean; // Flag para habilitar adicionar ao carrinho diretamente
  priority?: boolean; // Nova prop para imagens prioritárias
}

const HomeProductCard: React.FC<HomeProductCardProps> = ({ 
  product, 
  enableDirectCart = false,
  priority = false
}) => {
  const { addToCart } = useCart();
  const { toast } = useToast();
  const [isAddingToCart, setIsAddingToCart] = useState(false);

  const handleAddToCart = async () => {
    if (!enableDirectCart || product.price <= 0) return;
    
    setIsAddingToCart(true);
    try {
      await addToCart({
        id: '', // Will be set by CartContext
        product_id: product.id,
        name: product.title,
        price: product.price,
        image: product.image_url,
        images: [product.image_url],
        category: 'home_product',
        quantity: 1,
        unit_price: product.price,
        total_price: product.price,
        metadata: { source: 'home_products' }
      });

      toast({
        title: "Produto adicionado!",
        description: `${product.title} foi adicionado ao carrinho.`,
        variant: "default"
      });
    } catch (error) {
      console.error('Erro ao adicionar produto ao carrinho:', error);
      toast({
        title: "Erro ao adicionar ao carrinho",
        description: "Não foi possível adicionar o produto ao carrinho.",
        variant: "destructive"
      });
    } finally {
      setIsAddingToCart(false);
    }
  };

  const isSpecialCard = product.price === 0; // Cards sem preço são especiais (como "Visite Nossa Loja")

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden transition-all duration-300 hover:shadow-xl hover:scale-105 border border-gray-100 group">
      <div className="relative aspect-square overflow-hidden cursor-pointer bg-gray-50">
        <OptimizedImage
          src={product.image_url}
          alt={product.title}
          className="w-full h-48 object-cover"
          square={true}
          priority={priority}
        />
      </div>
      <div className="p-6">
        <h3 className="font-medium text-xl mb-2">{product.title}</h3>
        <p className="text-gray-600 mb-4">{product.description}</p>
        
        <div className="flex justify-between items-center gap-3">
          {Number(product.price) > 0 && (
            <div className="text-butterfly-orange font-bold text-xl">
              R$ {Number(product.price || 0).toFixed(2).replace('.', ',')}
            </div>
          )}
          
          <div className={`flex gap-2 ${Number(product.price) === 0 ? 'w-full' : 'flex-1 justify-end'}`}>
            {/* Botão de adicionar ao carrinho (apenas para produtos com preço e se habilitado) */}
            {enableDirectCart && Number(product.price) > 0 && (
              <Button
                onClick={handleAddToCart}
                disabled={isAddingToCart}
                className="bg-butterfly-orange hover:bg-butterfly-orange/90 text-white"
                size="sm"
              >
                <ShoppingCart className="h-4 w-4 mr-1" />
                {isAddingToCart ? 'Adicionando...' : 'Carrinho'}
              </Button>
            )}
            
            {/* Botão principal (link) */}
            <Button 
              variant={isSpecialCard ? "default" : "outline"} 
              className={`${
                isSpecialCard 
                  ? "flex-1 bg-butterfly-orange hover:bg-butterfly-orange/90" 
                  : "border-butterfly-orange text-butterfly-orange hover:bg-butterfly-orange hover:text-white"
              }`}
              asChild
            >
              <Link to={product.button_link} className="text-inherit flex items-center">
                {product.button_text}
                {!isSpecialCard && <ExternalLink className="h-4 w-4 ml-1" />}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomeProductCard;