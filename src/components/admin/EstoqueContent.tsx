import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Search, ArrowUpCircle, ArrowDownCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface StockItem {
  id: string;
  name: string;
  category: string;
  stock: number;
  reserved: number;
  available: number;
  soldQuantity: number; // Quantidade vendida (pedidos pagos)
  minStock: number;
  image: string;
  sizes: string[];
  in_stock: boolean;
}

interface SupabaseProduct {
  id: string;
  name: string;
  category: string;
  in_stock: boolean;
  image_url: string;
  sizes?: string[];
  stock_quantity?: number;
}

const EstoqueContent: React.FC = () => {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Estados para modal de ajuste
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustingItem, setAdjustingItem] = useState<StockItem | null>(null);
  const [adjustOperation, setAdjustOperation] = useState<'add' | 'remove' | 'set'>('set');
  const [adjustQuantity, setAdjustQuantity] = useState<number>(0);
  const [adjustNote, setAdjustNote] = useState<string>('');

  const fetchStock = async () => {
    setIsLoading(true);
    try {
      // Buscar produtos (excluindo ingressos)
      const { data: allProducts, error: productsError } = await supabase
        .from('products')
        .select('id, name, category, image_url, sizes, in_stock, stock_quantity');
        
        if (productsError) throw productsError;
        
        // Filtrar ingressos no código (mais seguro)
        const products = allProducts?.filter(p => {
          const category = (p.category || '').toLowerCase();
          return category !== 'ingresso' && category !== 'ticket';
        }) || [];
        
        if (products.length === 0) {
          setStockItems([]);
          setIsLoading(false);
          return;
        }

        // Buscar quantidade vendida por produto (apenas de pedidos pagos)
        let soldQuantities: Record<string, number> = {};
        
        try {
          // 1. Buscar pedidos pagos
          const { data: paidOrders, error: ordersError } = await supabase
            .from('orders')
            .select('id')
            .eq('payment_status', 'paid');
          
          if (ordersError) {
            console.error('Erro ao buscar pedidos pagos:', ordersError);
          } else if (paidOrders && paidOrders.length > 0) {
            const paidOrderIds = paidOrders.map(o => o.id);
            
            // 2. Buscar order_items desses pedidos
            // Processar em lotes se houver muitos pedidos (limite do Supabase é ~1000)
            const batchSize = 500;
            for (let i = 0; i < paidOrderIds.length; i += batchSize) {
              const batch = paidOrderIds.slice(i, i + batchSize);
              const { data: batchItems, error: itemsError } = await supabase
                .from('order_items')
                .select('product_id, quantity')
                .in('order_id', batch)
                .not('product_id', 'is', null);
              
              if (itemsError) {
                console.error(`Erro ao buscar itens do lote ${i / batchSize + 1}:`, itemsError);
              } else if (batchItems) {
                // Calcular quantidade vendida por produto
                batchItems.forEach(item => {
                  if (item.product_id) {
                    soldQuantities[item.product_id] = (soldQuantities[item.product_id] || 0) + (item.quantity || 1);
                  }
                });
              }
            }
          }
        } catch (error) {
          console.error('Erro ao processar vendas:', error);
        }

        // Calcular estoque real para cada produto
        const items: StockItem[] = products.map((p: SupabaseProduct) => {
          // Estoque inicial do produto (stock_quantity ou 0 se não definido)
          const initialStock = p.stock_quantity || 0;
          
          // Quantidade vendida (soma de order_items de pedidos pagos)
          const soldQuantity = soldQuantities[p.id] || 0;
          
          // Estoque disponível = estoque inicial - quantidade vendida
          const availableStock = Math.max(0, initialStock - soldQuantity);
          
          // Estoque reservado (pedidos pendentes) - por enquanto 0
          const reservedStock = 0;
          
          // Estoque total = estoque inicial
          const totalStock = initialStock;
          
          // Estoque mínimo (pode ser configurável por produto, por enquanto fixo em 2)
          const minStock = 2;
          
          return {
            id: p.id,
            name: p.name,
            category: p.category || '',
            stock: totalStock,
            reserved: reservedStock,
            available: availableStock,
            soldQuantity: soldQuantity, // Quantidade vendida
            minStock: minStock,
            image: p.image_url || '',
            sizes: p.sizes || [],
            in_stock: availableStock > 0,
          };
        });
        
        setStockItems(items);
      } catch (error) {
        console.error('Erro ao buscar estoque:', error);
        setStockItems([]);
      }
      setIsLoading(false);
    };
  
  useEffect(() => {
    fetchStock();
  }, []);

  const handleUpdateStockSize = async (productId: string, size: string, newQuantity: number) => {
    try {
      console.warn('DEPRECATED: handleUpdateStockSize - tabela product_sizes não existe');
      
      const { data: products } = await supabase
        .from('products')
        .select('id, name, category, image_url, sizes, in_stock');
      
      if (products) {
        const items: StockItem[] = products.map((p: SupabaseProduct) => {
          const stockValue = Math.floor(Math.random() * 20) + 1;
          return {
            id: p.id,
            name: p.name,
            category: p.category,
            stock: stockValue,
            reserved: Math.floor(stockValue * 0.1),
            available: Math.floor(stockValue * 0.9),
            minStock: 2,
            image: p.image_url || '',
            sizes: p.sizes || [],
            in_stock: p.in_stock || false,
          };
        });
        setStockItems(items);
      }
    } catch (error) {
      console.error('Erro ao atualizar estoque:', error);
    }
  };

  const filteredItems = stockItems
    .filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter(item => {
      if (categoryFilter === 'all') return true;
      if (categoryFilter === 'camisetas') return item.category === 'camiseta';
      if (categoryFilter === 'vestidos') return item.category === 'vestido';
      return true;
    });

  // Filtrar produtos com estoque baixo (disponível <= mínimo e > 0)
  const lowStockItems = stockItems.filter(item => 
    item.available > 0 && item.available <= item.minStock
  );
  
  // Filtrar produtos esgotados (disponível === 0)
  const outOfStockItems = stockItems.filter(item => item.available === 0);

  const getStockStatusClass = (available: number, minStock: number) => {
    if (available === 0) return 'text-red-500 font-bold';
    if (available <= minStock) return 'text-yellow-500 font-bold';
    return 'text-green-500 font-bold';
  };

  const getStockStatusText = (available: number, minStock: number) => {
    if (available === 0) return 'Esgotado';
    if (available <= minStock) return 'Baixo';
    return 'OK';
  };

  const openAdjustModal = (item: StockItem) => {
    // Buscar o item atualizado da lista para garantir dados corretos
    const currentItem = stockItems.find(i => i.id === item.id) || item;
    setAdjustingItem(currentItem);
    setAdjustModalOpen(true);
    setAdjustQuantity(currentItem.stock); // Inicializar com o estoque atual para operação "set"
    setAdjustOperation('set');
    setAdjustNote('');
  };

  const handleUpdateStock = async (productId: string, newStockQuantity: number) => {
    try {
      setIsLoading(true);
      
      // Atualizar stock_quantity no banco de dados
      const { error } = await supabase
        .from('products')
        .update({ 
          stock_quantity: newStockQuantity,
          in_stock: newStockQuantity > 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', productId);
      
      if (error) {
        throw error;
      }

      // Recarregar estoque para atualizar os cards de resumo
      await fetchStock();
      
      toast({
        title: 'Estoque atualizado',
        description: `Estoque atualizado para ${newStockQuantity} unidades.`,
      });

      return true;
    } catch (error: any) {
      console.error('Erro ao atualizar estoque:', error);
      toast({
        title: 'Erro ao atualizar estoque',
        description: error.message || 'Ocorreu um erro inesperado.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdjustStock = async () => {
    if (!adjustingItem) return;

    // Buscar o item atualizado da lista para ter o estoque correto
    const currentItem = stockItems.find(item => item.id === adjustingItem.id);
    if (!currentItem) {
      toast({
        title: 'Erro',
        description: 'Produto não encontrado.',
        variant: 'destructive',
      });
      return;
    }

    let newStockQuantity = currentItem.stock; // Usar o estoque atual (stock_quantity)

    switch (adjustOperation) {
      case 'add':
        newStockQuantity = currentItem.stock + adjustQuantity;
        break;
      case 'remove':
        newStockQuantity = Math.max(0, currentItem.stock - adjustQuantity);
        break;
      case 'set':
        newStockQuantity = adjustQuantity;
        break;
    }

    if (adjustQuantity < 0 || (adjustOperation === 'set' && adjustQuantity < 0)) {
      toast({
        title: 'Quantidade inválida',
        description: 'A quantidade não pode ser negativa.',
        variant: 'destructive',
      });
      return;
    }

    if (adjustOperation === 'set' && adjustQuantity === 0) {
      // Permitir definir como 0 (esgotado)
    } else if (adjustQuantity <= 0) {
      toast({
        title: 'Quantidade inválida',
        description: 'A quantidade deve ser maior que zero.',
        variant: 'destructive',
      });
      return;
    }

    const success = await handleUpdateStock(adjustingItem.id, newStockQuantity);
    
    if (success) {
      setAdjustModalOpen(false);
      setAdjustingItem(null);
      setAdjustQuantity(0);
      setAdjustNote('');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <p className="text-gray-500">Carregando estoque...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <h1 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6">Controle de Estoque</h1>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Estoque Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stockItems.reduce((sum, item) => sum + item.stock, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              <span>Em todos os produtos</span>
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Produtos com Estoque Baixo</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">{lowStockItems.length}</div>
            <p className="text-xs text-muted-foreground">
              <span>Abaixo do estoque mínimo</span>
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Produtos Esgotados</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{outOfStockItems.length}</div>
            <p className="text-xs text-muted-foreground">
              <span>Sem estoque disponível</span>
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 md:gap-4 mb-4 md:mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            className="pl-10"
            placeholder="Buscar produtos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Categorias</SelectItem>
            <SelectItem value="camisetas">Camisetas</SelectItem>
            <SelectItem value="vestidos">Vestidos</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {/* Stock Table */}
      <Card>
        <CardHeader>
          <CardTitle>Inventário</CardTitle>
          <CardDescription>Status detalhado do estoque de produtos</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Desktop Table */}
          <div className="hidden md:block rounded-lg border overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="py-3 px-4 text-left text-sm font-medium text-gray-500">Produto</th>
                  <th className="py-3 px-4 text-center text-sm font-medium text-gray-500">Categoria</th>
                  <th className="py-3 px-4 text-center text-sm font-medium text-gray-500">Estoque Inicial</th>
                  <th className="py-3 px-4 text-center text-sm font-medium text-gray-500">Vendidos</th>
                  <th className="py-3 px-4 text-center text-sm font-medium text-gray-500">Reservado</th>
                  <th className="py-3 px-4 text-center text-sm font-medium text-gray-500">Disponível</th>
                  <th className="py-3 px-4 text-center text-sm font-medium text-gray-500">Status</th>
                  <th className="py-3 px-4 text-right text-sm font-medium text-gray-500">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="py-3 px-4">
                      <div className="flex items-center">
                        <div className="h-10 w-10 flex-shrink-0 rounded overflow-hidden mr-3">
                          <img 
                            src={item.image} 
                            alt={item.name} 
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="font-medium">{item.name}</div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="capitalize">{item.category === 'camiseta' ? 'Camiseta' : 'Vestido'}</span>
                    </td>
                    <td className="py-3 px-4 text-center">{item.stock}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="font-medium text-blue-600">{item.soldQuantity}</span>
                    </td>
                    <td className="py-3 px-4 text-center">{item.reserved}</td>
                    <td className="py-3 px-4 text-center font-medium">
                      <span className={getStockStatusClass(item.available, item.minStock)}>
                        {item.available}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span 
                        className={`text-xs py-1 px-2 rounded ${
                          item.available === 0 
                            ? 'bg-red-100 text-red-800' 
                            : item.available <= item.minStock 
                            ? 'bg-yellow-100 text-yellow-800' 
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {getStockStatusText(item.available, item.minStock)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Dialog open={adjustModalOpen && adjustingItem?.id === item.id} onOpenChange={setAdjustModalOpen}>
                          <DialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-8"
                              onClick={() => openAdjustModal(item)}
                            >
                              Ajustar
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[425px]">
                            <DialogHeader>
                              <DialogTitle>Ajustar Estoque</DialogTitle>
                              <DialogDescription>
                                Atualize o estoque para {adjustingItem?.name || item.name}
                              </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                              <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium">
                                  Estoque Atual:
                                </label>
                                <div className="grid grid-cols-3 gap-4">
                                  <div className="text-center">
                                    <span className="block text-gray-500 text-sm">Total</span>
                                    <span className="font-bold">{adjustingItem?.stock || item.stock}</span>
                                  </div>
                                  <div className="text-center">
                                    <span className="block text-gray-500 text-sm">Reservado</span>
                                    <span className="font-bold">{adjustingItem?.reserved || item.reserved}</span>
                                  </div>
                                  <div className="text-center">
                                    <span className="block text-gray-500 text-sm">Disponível</span>
                                    <span className={`font-bold ${getStockStatusClass(adjustingItem?.available || item.available, item.minStock)}`}>
                                      {adjustingItem?.available || item.available}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium">
                                  Operação:
                                </label>
                                <Select value={adjustOperation} onValueChange={(value: 'add' | 'remove' | 'set') => {
                                  setAdjustOperation(value);
                                  // Resetar quantidade quando mudar a operação
                                  if (value === 'set' && adjustingItem) {
                                    setAdjustQuantity(adjustingItem.stock);
                                  } else {
                                    setAdjustQuantity(0);
                                  }
                                }}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecione" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="add">Adicionar ao estoque</SelectItem>
                                    <SelectItem value="remove">Remover do estoque</SelectItem>
                                    <SelectItem value="set">Definir valor direto</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              
                            <div className="flex flex-col gap-2">
                              <label className="text-sm font-medium">
                                Quantidade:
                              </label>
                              <Input 
                                type="number" 
                                min="0"
                                value={adjustQuantity >= 0 ? adjustQuantity : ''}
                                onChange={(e) => {
                                  const value = e.target.value === '' ? 0 : Number(e.target.value);
                                  setAdjustQuantity(value >= 0 ? value : 0);
                                }}
                                placeholder={adjustOperation === 'set' ? 'Nova quantidade' : 'Quantidade'}
                              />
                              {adjustOperation === 'add' && adjustQuantity > 0 && (
                                <p className="text-xs text-gray-500 mt-1">
                                  Novo estoque: {adjustingItem ? (adjustingItem.stock + adjustQuantity) : 0}
                                </p>
                              )}
                              {adjustOperation === 'remove' && adjustQuantity > 0 && (
                                <p className="text-xs text-gray-500 mt-1">
                                  Novo estoque: {adjustingItem ? Math.max(0, adjustingItem.stock - adjustQuantity) : 0}
                                </p>
                              )}
                              {adjustOperation === 'set' && (
                                <p className="text-xs text-gray-500 mt-1">
                                  Estoque será definido como: {adjustQuantity}
                                </p>
                              )}
                            </div>
                              
                              <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium">
                                  Observação (opcional):
                                </label>
                                <Input 
                                  placeholder="Ex: Recebimento de fornecedor" 
                                  value={adjustNote}
                                  onChange={(e) => setAdjustNote(e.target.value)}
                                />
                              </div>
                            </div>
                            <DialogFooter>
                              <Button 
                                variant="outline" 
                                className="mr-2"
                                onClick={() => {
                                  setAdjustModalOpen(false);
                                  setAdjustingItem(null);
                                }}
                              >
                                Cancelar
                              </Button>
                              <Button 
                                className="bg-butterfly-orange hover:bg-butterfly-orange/90"
                                onClick={handleAdjustStock}
                                disabled={adjustQuantity < 0 || (adjustOperation !== 'set' && adjustQuantity <= 0)}
                              >
                                Salvar
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-gray-500">
                      Nenhum produto encontrado com esses filtros.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Mobile Cards */}
          <div className="md:hidden space-y-4">
            {filteredItems.map((item) => (
              <Card key={item.id} className="p-4">
                <div className="flex items-start space-x-4">
                  <div className="h-16 w-16 flex-shrink-0 rounded overflow-hidden">
                    <img 
                      src={item.image} 
                      alt={item.name} 
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">{item.name}</h3>
                    <p className="text-sm text-gray-500 capitalize">
                      {item.category === 'camiseta' ? 'Camiseta' : 'Vestido'}
                    </p>
                    
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-gray-500">Estoque Inicial:</span>
                        <span className="ml-1 font-medium">{item.stock}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Vendidos:</span>
                        <span className="ml-1 font-medium text-blue-600">{item.soldQuantity}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Reservado:</span>
                        <span className="ml-1 font-medium">{item.reserved}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Disponível:</span>
                        <span className={`ml-1 font-medium ${getStockStatusClass(item.available, item.minStock)}`}>
                          {item.available}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-500">Status:</span>
                        <span 
                          className={`ml-1 text-xs py-1 px-2 rounded ${
                            item.available === 0 
                              ? 'bg-red-100 text-red-800' 
                              : item.available <= item.minStock 
                              ? 'bg-yellow-100 text-yellow-800' 
                              : 'bg-green-100 text-green-800'
                          }`}
                        >
                          {getStockStatusText(item.available, item.minStock)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="mt-3 flex gap-2">
                      <Dialog open={adjustModalOpen && adjustingItem?.id === item.id} onOpenChange={setAdjustModalOpen}>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex-1"
                            onClick={() => openAdjustModal(item)}
                          >
                            Ajustar
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                          <DialogHeader>
                            <DialogTitle>Ajustar Estoque</DialogTitle>
                            <DialogDescription>
                              Atualize o estoque para {adjustingItem?.name || item.name}
                            </DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-4 py-4">
                            <div className="flex flex-col gap-2">
                              <label className="text-sm font-medium">
                                Estoque Atual:
                              </label>
                              <div className="grid grid-cols-3 gap-4">
                                <div className="text-center">
                                  <span className="block text-gray-500 text-sm">Total</span>
                                  <span className="font-bold">{adjustingItem?.stock || item.stock}</span>
                                </div>
                                <div className="text-center">
                                  <span className="block text-gray-500 text-sm">Reservado</span>
                                  <span className="font-bold">{adjustingItem?.reserved || item.reserved}</span>
                                </div>
                                <div className="text-center">
                                  <span className="block text-gray-500 text-sm">Disponível</span>
                                  <span className={`font-bold ${getStockStatusClass(adjustingItem?.available || item.available, item.minStock)}`}>
                                    {adjustingItem?.available || item.available}
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex flex-col gap-2">
                              <label className="text-sm font-medium">
                                Operação:
                              </label>
                              <Select value={adjustOperation} onValueChange={(value: 'add' | 'remove' | 'set') => setAdjustOperation(value)}>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="add">Adicionar ao estoque</SelectItem>
                                  <SelectItem value="remove">Remover do estoque</SelectItem>
                                  <SelectItem value="set">Definir valor direto</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            
                            <div className="flex flex-col gap-2">
                              <label className="text-sm font-medium">
                                Quantidade:
                              </label>
                              <Input 
                                type="number" 
                                min="0"
                                value={adjustQuantity >= 0 ? adjustQuantity : ''}
                                onChange={(e) => {
                                  const value = e.target.value === '' ? 0 : Number(e.target.value);
                                  setAdjustQuantity(value >= 0 ? value : 0);
                                }}
                                placeholder={adjustOperation === 'set' ? 'Nova quantidade' : 'Quantidade'}
                              />
                              {adjustOperation === 'add' && adjustQuantity > 0 && (
                                <p className="text-xs text-gray-500 mt-1">
                                  Novo estoque: {adjustingItem ? (adjustingItem.stock + adjustQuantity) : 0}
                                </p>
                              )}
                              {adjustOperation === 'remove' && adjustQuantity > 0 && (
                                <p className="text-xs text-gray-500 mt-1">
                                  Novo estoque: {adjustingItem ? Math.max(0, adjustingItem.stock - adjustQuantity) : 0}
                                </p>
                              )}
                              {adjustOperation === 'set' && (
                                <p className="text-xs text-gray-500 mt-1">
                                  Estoque será definido como: {adjustQuantity}
                                </p>
                              )}
                            </div>
                            
                            <div className="flex flex-col gap-2">
                              <label className="text-sm font-medium">
                                Observação (opcional):
                              </label>
                              <Input 
                                placeholder="Ex: Recebimento de fornecedor" 
                                value={adjustNote}
                                onChange={(e) => setAdjustNote(e.target.value)}
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button 
                              variant="outline" 
                              className="mr-2"
                              onClick={() => {
                                setAdjustModalOpen(false);
                                setAdjustingItem(null);
                              }}
                            >
                              Cancelar
                            </Button>
                            <Button 
                              className="bg-butterfly-orange hover:bg-butterfly-orange/90"
                              onClick={handleAdjustStock}
                              disabled={adjustQuantity < 0 || (adjustOperation !== 'set' && adjustQuantity <= 0)}
                            >
                              Salvar
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                    </div>
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
    </div>
  );
};

export default EstoqueContent




