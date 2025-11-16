
import React, { useState, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Search, Filter, Grid, List, ChevronDown, Star, Heart, Package } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ProductCard, { ProductProps } from '@/components/ProductCard';
import PackageCard from '@/components/PackageCard';
import ProductModal from '@/components/ProductModal';
import OptimizedImage from '@/components/OptimizedImage';
import SizeChart from '@/components/SizeChart';
import { useRealtimeProducts } from '@/hooks/realtime/useRealtimeProducts';
import { usePackages } from '@/hooks/usePackages';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';

const Loja = () => {
  const [activeCategory, setActiveCategory] = useState('all');
  const [priceRange, setPriceRange] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedProduct, setSelectedProduct] = useState<ProductProps | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { 
    products, 
    loading: isLoadingProducts, 
    error: productsError 
  } = useRealtimeProducts();
  const { packages, loading: isLoadingPackages, error: packagesError } = usePackages();
  const { toast } = useToast();

  // Mapear produtos do hook para ProductProps e aplicar filtros
  const filteredProducts = useMemo(() => {
    // Primeiro mapear os produtos para o formato esperado pelo ProductProps
    const mappedProducts: ProductProps[] = products.map(product => ({
      id: product.id,
      name: product.description || 'Produto sem nome', // description é o campo principal
      price: product.price || 0,
      image: product.image_url || '', // mapear image_url para image
      category: product.category as 'camiseta' | 'vestido' | 'acessorio',
      sizes: product.sizes || [],
      inStock: product.in_stock || false,
      stock: product.stock_quantity || 0
    }));

    // Aplicar filtros
    let filtered = mappedProducts.filter(product => {
      const matchesCategory = activeCategory === 'all' || product.category === activeCategory;
      const matchesSearch = searchQuery === '' || 
        product.name.toLowerCase().includes(searchQuery.toLowerCase());
      
      let matchesPrice = true;
      if (priceRange !== 'all') {
        const price = product.price || 0;
        switch (priceRange) {
          case 'under-50':
            matchesPrice = price < 50;
            break;
          case '50-100':
            matchesPrice = price >= 50 && price <= 100;
            break;
          case 'over-100':
            matchesPrice = price > 100;
            break;
        }
      }
      
      return matchesCategory && matchesSearch && matchesPrice;
    });

    // Ordenação
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'price-low':
          return (a.price || 0) - (b.price || 0);
        case 'price-high':
          return (b.price || 0) - (a.price || 0);
        case 'name':
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return filtered;
  }, [products, activeCategory, priceRange, searchQuery, sortBy]);

  const categories = [
    { value: 'all', label: 'Todas as categorias' },
    { value: 'camiseta', label: 'Camisetas' },
    { value: 'vestido', label: 'Vestidos' },
    { value: 'acessorio', label: 'Acessórios' }
  ];

  const priceRanges = [
    { value: 'all', label: 'Todos os preços' },
    { value: 'under-50', label: 'Até R$ 50' },
    { value: '50-100', label: 'R$ 50 - R$ 100' },
    { value: 'over-100', label: 'Acima de R$ 100' }
  ];

  const sortOptions = [
    { value: 'name', label: 'Nome A-Z' },
    { value: 'price-low', label: 'Menor preço' },
    { value: 'price-high', label: 'Maior preço' }
  ];

  const handleProductClick = (product: ProductProps) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      {/* Breadcrumb */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/">Início</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Loja</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </div>

      {/* Hero Section */}
      <section className="bg-gradient-to-r from-butterfly-orange to-butterfly-pink text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <h1 className="font-display text-4xl md:text-5xl font-bold mb-4">
            Loja Oficial
          </h1>
          <p className="text-xl mb-8 max-w-2xl mx-auto">
            Produtos exclusivos do Querenhapuque Conference 2024. 
            Camisetas, vestidos e acessórios únicos para você levar uma lembrança especial do evento.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <Tabs defaultValue="produtos" className="w-full">
            <TabsList className="grid w-full grid-cols-1 mb-8">
              <TabsTrigger value="produtos">Produtos Individuais</TabsTrigger>
            </TabsList>

            {/* Aba de Produtos */}
            <TabsContent value="produtos" className="space-y-6">
              {/* Filtros */}
              <div className="bg-white p-6 rounded-lg shadow-sm">
                <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
                  <div className="flex flex-col sm:flex-row gap-4 flex-1">
                    {/* Busca */}
                    <div className="relative flex-1 max-w-md">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        placeholder="Buscar produtos..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>

                    {/* Filtros */}
                    <div className="flex gap-2">
                      <Select value={activeCategory} onValueChange={setActiveCategory}>
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map(category => (
                            <SelectItem key={category.value} value={category.value}>
                              {category.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select value={priceRange} onValueChange={setPriceRange}>
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Preço" />
                        </SelectTrigger>
                        <SelectContent>
                          {priceRanges.map(range => (
                            <SelectItem key={range.value} value={range.value}>
                              {range.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex gap-2 items-center">
                    {/* Ordenação */}
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {sortOptions.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Toggle de visualização */}
                    <div className="flex border rounded-md">
                      <Button
                        variant={viewMode === 'grid' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('grid')}
                        className="rounded-r-none"
                      >
                        <Grid className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={viewMode === 'list' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('list')}
                        className="rounded-l-none"
                      >
                        <List className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Contador de resultados e filtros ativos */}
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="text-sm text-gray-600">
                    {filteredProducts.length} produto{filteredProducts.length !== 1 ? 's' : ''} encontrado{filteredProducts.length !== 1 ? 's' : ''}
                  </span>
                  
                  {/* Badges de filtros ativos */}
                  <div className="flex flex-wrap gap-2">
                    {activeCategory !== 'all' && (
                      <Badge variant="secondary" className="cursor-pointer" onClick={() => setActiveCategory('all')}>
                        {categories.find(c => c.value === activeCategory)?.label} ×
                      </Badge>
                    )}
                    {priceRange !== 'all' && (
                      <Badge variant="secondary" className="cursor-pointer" onClick={() => setPriceRange('all')}>
                        {priceRanges.find(p => p.value === priceRange)?.label} ×
                      </Badge>
                    )}
                    {searchQuery && (
                      <Badge variant="secondary" className="cursor-pointer" onClick={() => setSearchQuery('')}>
                        "{searchQuery}" ×
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Lista de Produtos */}
              <div className="space-y-6">

                {isLoadingProducts && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {[...Array(8)].map((_, i) => (
                      <div key={i} className="bg-white rounded-lg shadow-md p-4 animate-pulse">
                        <div className="bg-gray-300 h-48 rounded mb-4"></div>
                        <div className="bg-gray-300 h-4 rounded mb-2"></div>
                        <div className="bg-gray-300 h-4 rounded w-2/3 mb-2"></div>
                        <div className="bg-gray-300 h-4 rounded w-1/2"></div>
                      </div>
                    ))}
                  </div>
                )}
                
                {productsError && (
                  <div className="text-center py-12">
                    <div className="text-red-500 mb-4">
                      <Package className="h-16 w-16 mx-auto" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Erro ao carregar produtos</h3>
                    <p className="text-gray-500">{String(productsError)}</p>
                  </div>
                )}
                
                {!isLoadingProducts && !productsError && filteredProducts.length === 0 && (
                  <div className="text-center py-12">
                    <div className="max-w-md mx-auto">
                      <div className="text-gray-400 mb-4">
                        <Search className="h-16 w-16 mx-auto" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum produto encontrado</h3>
                      <p className="text-gray-500 mb-4">
                        Não encontramos produtos que correspondam aos seus critérios de busca.
                      </p>
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setSearchQuery('');
                          setActiveCategory('all');
                          setPriceRange('all');
                        }}
                      >
                        Limpar filtros
                      </Button>
                    </div>
                  </div>
                )}
                
                {!isLoadingProducts && !productsError && filteredProducts.length > 0 && (
                  <div className={viewMode === 'grid' 
                    ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                    : "space-y-4"
                  }>
                    {viewMode === 'grid' ? (
                      filteredProducts.map((product) => (
                        <ProductCard key={product.id} product={product} />
                      ))
                    ) : (
                      filteredProducts.map((product) => (
                        <div key={product.id} className="bg-white rounded-lg shadow-md p-4 flex gap-4 hover:shadow-lg transition-shadow">
                           <ProductModal product={product} onSelectSize={() => {}}>
                             <div className="w-32 flex-shrink-0 cursor-pointer">
                               <OptimizedImage 
                                 src={product.image} 
                                 alt={product.name}
                                 className="w-full h-full object-cover rounded-lg"
                                 fallbackSrc="/placeholder.svg"
                                 square={true}
                               />
                             </div>
                           </ProductModal>
                           <div className="flex-1 flex flex-col justify-between">
                             <div>
                               <h3 className="font-semibold text-lg mb-2">{product.name}</h3>
                               <div className="flex items-center gap-2 mb-2">
                                 <div className="flex items-center">
                                   {[...Array(5)].map((_, i) => (
                                     <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                                   ))}
                                 </div>
                                 <span className="text-sm text-gray-500">(4.8)</span>
                               </div>
                             </div>
                             <div className="flex items-center justify-between">
                                 <div className="flex items-center gap-2">
                                   <span className="text-2xl font-bold text-butterfly-orange">
                                     R$ {(product.price || 0).toFixed(2)}
                                   </span>
                                   <Badge variant="secondary" className="text-xs">
                                     {product.category}
                                   </Badge>
                                 </div>
                                 <div className="flex gap-2">
                                   <Button 
                                     size="sm" 
                                     variant="outline"
                                     onClick={(e) => {
                                       e.stopPropagation();
                                       toast({
                                         title: "Produto favoritado",
                                         description: `${product.name} foi adicionado aos favoritos.`
                                       });
                                     }}
                                   >
                                     <Heart className="h-4 w-4" />
                                   </Button>
                                   <ProductModal product={product} onSelectSize={() => {}}>
                                     <Button size="sm">
                                       Ver Detalhes
                                     </Button>
                                   </ProductModal>
                                 </div>
                             </div>
                           </div>
                         </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </TabsContent>

            
          </Tabs>
        </div>
      </section>

      {/* Size Charts */}
      <section className="bg-white py-16">
        <div className="container mx-auto px-4">
          <h2 className="font-display text-3xl font-bold mb-10 text-center">
            Tabelas de Medidas
          </h2>
          
          <div className="grid md:grid-cols-2 gap-12">
            <Dialog>
              <DialogTrigger asChild>
                <div className="bg-gray-50 p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                  <h3 className="font-display text-xl font-bold mb-4 text-butterfly-orange">
                    Tabela de Medidas - Camisetas
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Consulte as medidas de busto, cintura e quadril para cada tamanho de camiseta, 
                    desde o PP até o EXGG.
                  </p>
                  <Button variant="outline" className="mt-2">Ver Tabela</Button>
                </div>
              </DialogTrigger>
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Tabela de Medidas - Camisetas</DialogTitle>
                  <DialogDescription>
                    Medidas em centímetros. Para melhor ajuste, meça sempre sobre a roupa íntima.
                  </DialogDescription>
                </DialogHeader>
                <SizeChart type="camiseta" />
              </DialogContent>
            </Dialog>

            <Dialog>
              <DialogTrigger asChild>
                <div className="bg-gray-50 p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                  <h3 className="font-display text-xl font-bold mb-4 text-butterfly-pink">
                    Tabela de Medidas - Vestidos
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Consulte as medidas de busto, cintura e quadril para cada tamanho de vestido, 
                    desde o PP até o EXGG.
                  </p>
                  <Button variant="outline" className="mt-2">Ver Tabela</Button>
                </div>
              </DialogTrigger>
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>Tabela de Medidas - Vestidos</DialogTitle>
                  <DialogDescription>
                    Medidas em centímetros. Para melhor ajuste, meça sempre sobre a roupa íntima.
                  </DialogDescription>
                </DialogHeader>
                <SizeChart type="vestido" />
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </section>

      {/* Newsletter Section */}
      <section className="bg-gray-100 py-16">
        <div className="container mx-auto px-4 text-center">
          <h2 className="font-display text-3xl font-bold mb-4">
            Fique por dentro das novidades
          </h2>
          <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
            Cadastre-se para receber informações sobre novos produtos, promoções exclusivas 
            e atualizações sobre o Querenhapuque Conference 2024.
          </p>
          <div className="max-w-md mx-auto flex gap-2">
            <Input 
              type="email" 
              placeholder="Seu melhor e-mail" 
              className="flex-1"
            />
            <Button>Cadastrar</Button>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-butterfly-orange text-white py-12">
        <div className="container mx-auto px-4 text-center">
          <h2 className="font-display text-2xl md:text-3xl font-bold mb-4">
            Não perca os produtos oficiais do evento!
          </h2>
          <p className="text-lg mb-8">
            Garante já suas peças exclusivas e esteja preparada para a conferência.
          </p>
          <Button 
            variant="outline" 
            size="lg" 
            className="border-white text-white hover:bg-white hover:text-butterfly-orange"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            Ver Produtos
          </Button>
        </div>
      </section>
      
      <Footer />
    </div>
  );
};

export default Loja;
