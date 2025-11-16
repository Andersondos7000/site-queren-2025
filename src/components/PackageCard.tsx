import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ShoppingCart, Package, Star } from 'lucide-react';
import OptimizedImage from './OptimizedImage';
import { useCart } from '@/hooks/useCart';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

export interface PackageItem {
  id: string;
  name: string;
  price: number;
  image: string;
  category: 'camiseta' | 'vestido' | 'inscricao';
  sizes?: string[];
}

export interface PackageProps {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice: number;
  items: PackageItem[];
  image: string;
  inStock: boolean;
  category: 'pacote';
  discount?: number;
}

const PackageCard: React.FC<{ package: PackageProps }> = ({ package: pkg }) => {
  const { addToCart } = useCart();
  const { toast } = useToast();
  const [selectedSizes, setSelectedSizes] = useState<Record<string, string>>({});
  const [isHovered, setIsHovered] = useState(false);

  const formattedPrice = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(pkg.price);

  const formattedOriginalPrice = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(pkg.originalPrice);

  const savings = pkg.originalPrice - pkg.price;
  const formattedSavings = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(savings);

  const discountPercentage = Math.round((savings / pkg.originalPrice) * 100);

  const handleSizeChange = (itemId: string, size: string) => {
    setSelectedSizes(prev => ({
      ...prev,
      [itemId]: size
    }));
  };

  const handleAddToCart = () => {
    if (!pkg.inStock) {
      toast({
        title: "Pacote indisponível",
        description: "Este pacote está esgotado no momento.",
        variant: "destructive"
      });
      return;
    }

    // Verificar se todos os itens que precisam de tamanho têm tamanho selecionado
    const itemsNeedingSize = pkg.items.filter(item => 
      item.category !== 'inscricao' && item.sizes && item.sizes.length > 0
    );

    const missingSizes = itemsNeedingSize.filter(item => 
      !selectedSizes[item.id]
    );

    if (missingSizes.length > 0) {
      toast({
        title: "Selecione os tamanhos",
        description: `Por favor, selecione o tamanho para: ${missingSizes.map(item => item.name).join(', ')}`,
        variant: "destructive"
      });
      return;
    }

    // Adicionar o pacote como um único item no carrinho
    addToCart({
      id: '', // Will be set by CartContext
      product_id: pkg.id,
      name: pkg.name,
      price: pkg.price,
      image: pkg.image,
      images: [pkg.image],
      category: pkg.category,
      quantity: 1,
      unit_price: pkg.price,
      total_price: pkg.price,
      metadata: { 
        type: 'package',
        items: pkg.items.map(item => ({
          ...item,
          selectedSize: selectedSizes[item.id]
        })),
        selectedSizes
      }
    });

    toast({
      title: "Pacote adicionado!",
      description: `${pkg.name} foi adicionado ao carrinho.`,
      variant: "default"
    });
  };

  return (
    <div 
      className="bg-white rounded-xl shadow-lg overflow-hidden transition-all duration-300 hover:shadow-xl hover:scale-105 border border-gray-100 group relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Badge de desconto */}
      {discountPercentage > 0 && (
        <div className="absolute top-3 left-3 z-10">
          <Badge className="bg-red-500 text-white font-bold">
            -{discountPercentage}%
          </Badge>
        </div>
      )}

      {/* Badge de pacote */}
      <div className="absolute top-3 right-3 z-10">
        <Badge className="bg-butterfly-orange text-white font-bold flex items-center gap-1">
          <Package className="h-3 w-3" />
          PACOTE
        </Badge>
      </div>

      <div className="relative aspect-square overflow-hidden cursor-pointer bg-gray-50">
        <OptimizedImage 
          src={pkg.image} 
          alt={pkg.name} 
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
          fallbackSrc="/placeholder.svg"
          square={true}
        />
        {!pkg.inStock && (
          <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center">
            <span className="bg-red-500 text-white px-6 py-3 rounded-full font-bold text-sm uppercase tracking-wide">
              Esgotado
            </span>
          </div>
        )}
      </div>
      
      <div className="p-5">
        <div className="flex items-center gap-2 mb-2">
          <Star className="h-4 w-4 text-yellow-500 fill-current" />
          <span className="text-sm font-medium text-gray-600">Oferta Especial</span>
        </div>
        
        <h3 className="font-semibold text-lg text-gray-900 mb-2 line-clamp-2 leading-tight">{pkg.name}</h3>
        <p className="text-sm text-gray-600 mb-4 line-clamp-2">{pkg.description}</p>
        
        {/* Itens inclusos */}
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Inclui:</h4>
          <div className="space-y-2">
            {pkg.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">• {item.name}</span>
                {item.category !== 'inscricao' && item.sizes && item.sizes.length > 0 && (
                  <select
                    value={selectedSizes[item.id] || ''}
                    onChange={(e) => handleSizeChange(item.id, e.target.value)}
                    className="text-xs border rounded px-2 py-1 ml-2"
                  >
                    <option value="">Tamanho</option>
                    {item.sizes.map(size => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                )}
              </div>
            ))}
          </div>
        </div>
        
        {/* Preços */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-gray-900">{formattedPrice}</span>
              {discountPercentage > 0 && (
                <span className="text-sm text-gray-500 line-through">{formattedOriginalPrice}</span>
              )}
            </div>
            {savings > 0 && (
              <span className="text-sm text-green-600 font-medium">
                Economize {formattedSavings}
              </span>
            )}
          </div>
        </div>
        
        <Button 
          variant={pkg.inStock ? "default" : "secondary"}
          size="lg" 
          className={`w-full flex items-center justify-center font-semibold transition-all duration-200 ${
            pkg.inStock 
              ? 'bg-butterfly-orange hover:bg-butterfly-orange/90 text-white shadow-md hover:shadow-lg' 
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
          disabled={!pkg.inStock}
          onClick={handleAddToCart}
        >
          <ShoppingCart className="mr-2 h-5 w-5" /> 
          {pkg.inStock ? 'Adicionar Pacote ao Carrinho' : 'Pacote Esgotado'}
        </Button>
      </div>
    </div>
  );
};

export default PackageCard;