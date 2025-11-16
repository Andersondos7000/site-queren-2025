
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ShoppingCart, ChevronLeft, ChevronRight } from 'lucide-react';
import ProductModal from './ProductModal';
import OptimizedImage from './OptimizedImage';
import { useCart } from '@/hooks/useCart';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';

export interface ProductProps {
  id: string;
  name: string;
  price: number;
  image: string;
  category: 'camiseta' | 'vestido' | 'acessorio';
  sizes: string[];
  inStock: boolean;
  stock?: number;
}

const ProductCardContent: React.FC<{ product: ProductProps }> = ({ product }) => {
  const { addToCart } = useCart();
  const { toast } = useToast();
  const [selectedSize, setSelectedSize] = useState(product.sizes[0] || '');
  const [isHovered, setIsHovered] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [productImages, setProductImages] = useState<string[]>([product.image]);
  const [isLoadingImages, setIsLoadingImages] = useState(false);
  
  // Carregar imagens do produto
  useEffect(() => {
    const loadProductImages = async () => {
      try {
        // Primeiro, verificar se o produto existe na tabela home_products
        const { data: homeProduct, error: homeProductError } = await supabase
          .from('home_products')
          .select('id, image_url')
          .eq('id', product.id)
          .single();

        if (homeProductError || !homeProduct) {
          console.log('Produto não encontrado em home_products, usando imagem padrão');
          setProductImages([product.image]);
          return;
        }

        // Buscar imagens adicionais na tabela product_images
        const { data: images, error } = await supabase
          .from('product_images')
          .select('image_url')
          .eq('product_id', product.id)
          .order('display_order');

        if (error) {
          console.error('Erro ao carregar imagens do produto:', error);
          // Fallback para imagem do home_products
          setProductImages([homeProduct.image_url || product.image]);
        } else if (images && images.length > 0) {
          setProductImages(images.map(img => img.image_url));
        } else {
          // Se não há imagens na tabela product_images, usar a imagem do home_products
          setProductImages([homeProduct.image_url || product.image]);
        }
      } catch (error) {
        console.error('Erro ao buscar imagens:', error);
        setProductImages([product.image]);
      }
    };

    loadProductImages();
  }, [product.id, product.image]);
  
  const relatedImages = productImages;

  const formattedPrice = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(product.price);

  const handleAddToCart = () => {
    if (!product.inStock) {
      toast({
        title: "Produto indisponível",
        description: "Este produto está esgotado no momento.",
        variant: "destructive"
      });
      return;
    }

    if (!selectedSize) {
      toast({
        title: "Selecione um tamanho",
        description: "Por favor, selecione um tamanho antes de adicionar ao carrinho.",
        variant: "destructive"
      });
      return;
    }

    addToCart({
      id: '', // Will be set by CartContext
      product_id: product.id,
      name: product.name,
      price: product.price,
      image: product.image,
      images: relatedImages, // Adicionando todas as imagens relacionadas
      category: product.category,
      quantity: 1,
      unit_price: product.price,
      total_price: product.price,
      metadata: { size: selectedSize }
    });

    toast({
      title: "Produto adicionado!",
      description: `${product.name} foi adicionado ao carrinho.`,
      variant: "default"
    });
  };

  const handleSelectSize = (size: string) => {
    setSelectedSize(size);
  };
  
  const nextImage = () => {
    setCurrentImageIndex((prevIndex) => 
      prevIndex === relatedImages.length - 1 ? 0 : prevIndex + 1
    );
  };
  
  const prevImage = () => {
    setCurrentImageIndex((prevIndex) => 
      prevIndex === 0 ? relatedImages.length - 1 : prevIndex - 1
    );
  };

  return (
    <div 
      data-testid="product-card"
      className="bg-white rounded-xl shadow-lg overflow-hidden transition-all duration-300 hover:shadow-xl hover:scale-105 border border-gray-100 group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <ProductModal product={{...product, image: relatedImages[currentImageIndex]}} onSelectSize={handleSelectSize}>
        <div className="relative aspect-square overflow-hidden cursor-pointer bg-gray-50">
          <OptimizedImage 
            src={relatedImages[currentImageIndex]} 
            alt={product.name} 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
            fallbackSrc="/placeholder.svg"
            square={true}
          />
          {!product.inStock && (
            <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center">
              <span className="bg-red-500 text-white px-6 py-3 rounded-full font-bold text-sm uppercase tracking-wide">
                Esgotado
              </span>
            </div>
          )}
          
          {/* Navegação de imagens */}
          {isHovered && relatedImages.length > 1 && (
            <>
              <button 
                onClick={(e) => { e.stopPropagation(); prevImage(); }} 
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 rounded-full p-1 shadow-md hover:bg-white"
                aria-label="Imagem anterior"
              >
                <ChevronLeft className="h-5 w-5 text-gray-700" />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); nextImage(); }} 
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 rounded-full p-1 shadow-md hover:bg-white"
                aria-label="Próxima imagem"
              >
                <ChevronRight className="h-5 w-5 text-gray-700" />
              </button>
              
              {/* Indicadores de imagem */}
              <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
                {relatedImages.map((_, index) => (
                  <button 
                    key={`${product.id}-image-${index}`}
                    onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(index); }}
                    className={`h-2 w-2 rounded-full ${currentImageIndex === index ? 'bg-butterfly-orange' : 'bg-gray-300'}`}
                    aria-label={`Ver imagem ${index + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </ProductModal>
      
      <div className="p-5">
        <h3 className="font-semibold text-lg text-gray-900 mb-2 line-clamp-2 leading-tight">{product.name}</h3>
        
        <div className="flex items-center justify-between mb-4">
          <div className="flex flex-col">
            <span data-testid="product-price" className="text-2xl font-bold text-gray-900">{formattedPrice}</span>
            <span className="text-sm text-gray-500 capitalize">{product.category}</span>
          </div>
          
          <div className="text-right">
            <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Tamanhos</div>
            <div className="text-sm text-gray-600 font-medium">
              {product.sizes.slice(0, 3).join(' • ')}
              {product.sizes.length > 3 && ' • +'}
            </div>
          </div>
        </div>
        
        <Button 
          variant={product.inStock ? "default" : "secondary"}
          size="lg" 
          className={`w-full flex items-center justify-center font-semibold transition-all duration-200 ${
            product.inStock 
              ? 'bg-butterfly-orange hover:bg-butterfly-orange/90 text-white shadow-md hover:shadow-lg' 
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
          disabled={!product.inStock}
          onClick={handleAddToCart}
        >
          <ShoppingCart className="mr-2 h-5 w-5" /> 
          {product.inStock ? 'Adicionar ao Carrinho' : 'Produto Esgotado'}
        </Button>
      </div>
    </div>
  );
};

const ProductCard: React.FC<{ product: ProductProps }> = ({ product }) => {
  return <ProductCardContent product={product} />;
};

export default ProductCard;
