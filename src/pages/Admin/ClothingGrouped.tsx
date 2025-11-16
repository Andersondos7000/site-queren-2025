import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Search, Eye, Calendar, MapPin, User, Mail, Hash, DollarSign, ChevronDown, ChevronRight, Package, X, Trash2 } from "lucide-react";
import AdminSidebar from '@/components/AdminSidebar';
import { useGroupedClothingDashboard } from '@/hooks/useGroupedClothingDashboard';
import { supabase } from '@/lib/supabase';

// Tipo para o item de roupa selecionado
interface ClothingItem {
  id: string;
  product_id: string;
  order_id: string | null;
  quantity: number;
  price: number;
  total_price: number;
  size: string;
  status: string | null;
  created_at: string | null;
  unit_price?: number;
  name?: string;
  description?: string;
  image_url?: string;
  // ID único para interface (usado apenas para renderização)
  display_id?: string;
  // ID original do banco de dados (sempre preservado)
  original_id?: string;
  products?: {
    id: string;
    name: string;
    category: string;
    image_url: string | null;
  };
  orders?: {
    id: string;
    total_amount: number;
    status: string;
    payment_status: string;
    created_at: string;
    customer_data?: {
      name: string;
      email: string;
      phone?: string;
    };
    customer_name?: string;
    customer_email?: string;
  };
}

const AdminClothingGrouped = () => {
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClothingItem, setSelectedClothingItem] = useState<ClothingItem | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedPackages, setExpandedPackages] = useState<Set<string>>(new Set());
  const [productImage, setProductImage] = useState<string | null>(null);
  const [productImages, setProductImages] = useState<Record<string, string>>({});
  
  // Estados para seleção múltipla
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [selectAllItems, setSelectAllItems] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const {
    clothingGroups,
    loading,
    error,
    stats,
    currentPage,
    totalPages,
    hasNextPage,
    hasPreviousPage,
    setCurrentPage,
    refetch
  } = useGroupedClothingDashboard({
    paymentStatus: statusFilter === 'all' ? undefined : statusFilter,
    search: searchTerm.trim() || undefined
  }, 10);

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleNextPage = () => {
    if (hasNextPage) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePreviousPage = () => {
    if (hasPreviousPage) {
      setCurrentPage(currentPage - 1);
    }
  };

  const toggleGroupExpansion = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const togglePackageExpansion = (packageId: string) => {
    const newExpanded = new Set(expandedPackages);
    if (newExpanded.has(packageId)) {
      newExpanded.delete(packageId);
    } else {
      newExpanded.add(packageId);
    }
    setExpandedPackages(newExpanded);
  };

  const toggleGroupSelection = (group: any, checked: boolean) => {
    if (group.items) {
      group.items.forEach((item: any) => {
        const id = item.display_id || item.id;
        const next = new Set(selectedItems);
        if (checked) {
          next.add(id);
        } else {
          next.delete(id);
        }
        setSelectedItems(next);
      });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const normalizePrice = (price: number): number => {
    if (price > 1000 && Number.isInteger(price)) {
      return price / 100;
    }
    return price;
  };

  const getCustomerName = (clothingItem: any) => {
    return clothingItem.customers?.name || 
           clothingItem.customer_name || 
           clothingItem.orders?.customer_name || 
           'Cliente não identificado';
  };

  const getCustomerEmail = (clothingItem: any) => {
    return clothingItem.customers?.email || 
           clothingItem.customer_email || 
           clothingItem.orders?.customer_email || 
           'Email não disponível';
  };

  // Função para buscar imagem específica de um produto para a lista
  const fetchSpecificProductImage = async (productId: string): Promise<string | null> => {
    try {
      // Primeiro, tentar buscar imagens da tabela product_images
      const { data: productImages, error: productImagesError } = await supabase
        .from('product_images')
        .select('image_url, is_primary, display_order')
        .eq('product_id', productId)
        .order('display_order');

      if (!productImagesError && productImages && productImages.length > 0) {
        // Procurar pela imagem principal ou usar a primeira
        const primaryImage = productImages.find(img => img.is_primary) || productImages[0];
        return primaryImage.image_url;
      }

      // Se não encontrou na product_images, buscar na tabela products
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('image_url')
        .eq('id', productId)
        .single();

      if (!productError && product) {
        return product.image_url;
      }

      return null;
    } catch (error) {
      console.error('Erro ao buscar imagem do produto:', error);
      return null;
    }
  };

  // Efeito para buscar imagens quando os grupos de roupas mudam
  useEffect(() => {
    const fetchImages = async () => {
      if (clothingGroups) {
        const imagePromises: Record<string, Promise<string | null>> = {};
        const newImages: Record<string, string> = {};

        clothingGroups.forEach(group => {
          if (group.items) {
            group.items.forEach(item => {
              if (item.product_id && !productImages[item.product_id]) {
                imagePromises[item.product_id] = fetchSpecificProductImage(item.product_id);
              }
            });
          }
        });

        const productIds = Object.keys(imagePromises);
        if (productIds.length > 0) {
          const results = await Promise.all(Object.values(imagePromises));
          productIds.forEach((productId, index) => {
            if (results[index]) {
              newImages[productId] = results[index] as string;
            }
          });
          setProductImages(prev => ({ ...prev, ...newImages }));
        }
      }
    };

    fetchImages();
  }, [clothingGroups]);

  useEffect(() => {
    const loadModalImage = async () => {
      if (selectedClothingItem?.product_id) {
        const img = await fetchSpecificProductImage(selectedClothingItem.product_id);
        setProductImage(img);
      } else {
        setProductImage(null);
      }
    };
    loadModalImage();
  }, [selectedClothingItem]);

  // Funções para seleção múltipla
  const handleSelectItem = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const handleSelectAll = () => {
    if (selectAllItems) {
      setSelectedItems(new Set());
    } else {
      const allItemIds = new Set<string>();
      clothingGroups.forEach(group => {
        if (group.items) {
          group.items.forEach(item => allItemIds.add(item.id));
        }
      });
      setSelectedItems(allItemIds);
    }
    setSelectAllItems(!selectAllItems);
  };

  // Função para deletar itens selecionados
  const handleDeleteSelected = async () => {
    if (selectedItems.size === 0) return;

    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('clothing_items')
        .delete()
        .in('id', Array.from(selectedItems));

      if (error) {
        throw error;
      }

      // Limpar seleção e recarregar dados
      setSelectedItems(new Set());
      setSelectAllItems(false);
      refetch(); // Função do hook para recarregar os dados

    } catch (error) {
      console.error('Erro ao deletar itens:', error);
      // Adicionar feedback para o usuário aqui (ex: toast de erro)
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-red-500">Erro ao carregar os dados: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-100 dark:bg-gray-900">
      <AdminSidebar />
      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Roupas e Pacotes</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">Lista de roupas individuais e pacotes agrupados por cliente</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Itens</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.pending}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Entregues</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.delivered}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
              </CardContent>
            </Card>
          </div>

          {/* Seção de Filtros e Ações */}
          <div className="flex flex-col sm:flex-row items-center justify-between mb-4 gap-4">
            <div className="flex-1 w-full sm:w-auto">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Buscar por cliente ou email..."
                  value={searchTerm}
                  onChange={handleSearchChange}
                  className="pl-10 w-full"
                />
              </div>
            </div>
            <div className="flex items-center gap-4 w-full sm:w-auto">
              <Select value={statusFilter} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="paid">Pago</SelectItem>
                  <SelectItem value="confirmed">Confirmado</SelectItem>
                  <SelectItem value="shipped">Enviado</SelectItem>
                  <SelectItem value="delivered">Entregue</SelectItem>
                </SelectContent>
              </Select>
              {selectedItems.size > 0 && (
                <Button
                  variant="destructive"
                  onClick={handleDeleteSelected}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Deletar ({selectedItems.size})
                </Button>
              )}
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Grupos de Roupas</CardTitle>
              <CardDescription>Pacotes agrupados por pedido</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              ) : error ? (
                <div className="text-center py-8 text-red-500">Erro ao carregar: {error.message}</div>
              ) : (
                <div className="space-y-2">
                  {clothingGroups.map((group: any) => {
                    const isExpanded = expandedPackages.has(group.id);
                    const allSelected = group.items && group.items.length > 0 && group.items.every((item: any) => selectedItems.has(item.display_id || item.id));
                    const getStatusBadgeClass = (status: string) => {
                      if (status === 'paid' || status === 'confirmed') return 'bg-green-100 text-green-800';
                      if (status === 'pending') return 'bg-yellow-100 text-yellow-800';
                      if (status === 'shipped') return 'bg-blue-100 text-blue-800';
                      if (status === 'delivered') return 'bg-gray-100 text-gray-800';
                      return 'bg-gray-100 text-gray-800';
                    };
                    const getStatusText = (status: string) => {
                      if (status === 'paid') return 'Pago';
                      if (status === 'confirmed') return 'Confirmado';
                      if (status === 'pending') return 'Pendente';
                      if (status === 'shipped') return 'Enviado';
                      if (status === 'delivered') return 'Entregue';
                      return status || 'Pendente';
                    };
                    return (
                      <div key={group.id} className="border rounded-lg overflow-hidden">
                        <div className="flex items-center justify-between p-4">
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <input
                              type="checkbox"
                              checked={allSelected}
                              onChange={(e) => toggleGroupSelection(group, e.target.checked)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div
                              className="flex items-center gap-2 flex-1 cursor-pointer"
                              onClick={() => togglePackageExpansion(group.id)}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-5 w-5 text-gray-400" />
                              ) : (
                                <ChevronRight className="h-5 w-5 text-gray-400" />
                              )}
                              <div className="p-2 rounded bg-blue-100">
                                <Package className="h-5 w-5 text-blue-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-900">{group.customer_name}</p>
                                <p className="text-sm text-gray-500 truncate">{group.customer_email}</p>
                              </div>
                            </div>
                              <div className="flex items-center gap-6">
                                <div className="text-center">
                                  <Badge className={getStatusBadgeClass(group.status)}>{getStatusText(group.status)}</Badge>
                                <p className="text-xs text-gray-500 mt-1">{group.created_at ? formatDate(group.created_at) : '-'}</p>
                                </div>
                                <p className="font-semibold text-lg text-green-600 whitespace-nowrap">{formatCurrency(group.total_value)}</p>
                              </div>
                          </div>
                        </div>
                        {isExpanded && group.items && group.items.length > 0 && (
                          <div className="border-t bg-gray-50 p-4">
                            <div className="space-y-3">
                              {group.items.map((item: any, index: number) => {
                                const itemPrice = normalizePrice(item.total_price || item.price || 0);
                                const unitPrice = item.quantity > 0 ? itemPrice / item.quantity : itemPrice;
                                const productImageUrl = item.product_id ? productImages[item.product_id] : null;
                                return (
                                  <div key={item.display_id || item.id || index} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                      <input
                                        type="checkbox"
                                        checked={selectedItems.has(item.display_id || item.id)}
                                        onChange={(e) => handleSelectItem(item.display_id || item.id)}
                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                      <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                        <span className="text-sm font-bold text-blue-600">{index + 1}</span>
                                      </div>
                                      <div className="w-10 h-10 bg-gray-200 rounded overflow-hidden border">
                                        {productImageUrl ? (
                                          <img
                                            src={productImageUrl}
                                            alt={item.products?.name || 'Produto'}
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                              (e.target as HTMLImageElement).src = '';
                                              (e.target as HTMLImageElement).style.display = 'none';
                                            }}
                                          />
                                        ) : (
                                          <div className="w-full h-full bg-gray-200" />
                                        )}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm text-gray-500">Tamanho: {item.size || 'N/A'} • Qtd: {item.quantity || 1}</p>
                                      </div>
                                    </div>
                                    <div className="text-center mx-4">
                                      <p className="font-semibold text-gray-900">{formatCurrency(unitPrice)}</p>
                                      <p className="text-xs text-gray-500">Preço unitário</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                      <Button variant="outline" size="sm" onClick={() => setSelectedClothingItem(item)}>
                                        <Eye className="h-4 w-4" />
                                        Detalhes
                                      </Button>
                                      <p className="font-semibold text-lg text-green-600 whitespace-nowrap min-w-[100px] text-right">
                                        {formatCurrency(itemPrice)}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {clothingGroups.length === 0 && (
                    <div className="text-center py-12 text-gray-500">Nenhuma roupa ou pacote encontrado.</div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Paginação */}
          <div className="flex items-center justify-end space-x-2 py-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePreviousPage}
              disabled={!hasPreviousPage}
            >
              Anterior
            </Button>
            <span className="text-sm">
              Página {currentPage} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNextPage}
              disabled={!hasNextPage}
            >
              Próximo
            </Button>
          </div>
        </div>
      </main>

      {/* Modal de Detalhes do Item */}
      {selectedClothingItem && (
        <Dialog open={!!selectedClothingItem} onOpenChange={() => setSelectedClothingItem(null)}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Detalhes do Item</DialogTitle>
              <DialogDescription>
                Informações detalhadas sobre o item de roupa e seu pedido associado.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="flex justify-center mb-4">
                {productImage ? (
                  <img src={productImage} alt="Produto" className="w-48 h-48 object-cover rounded-lg" />
                ) : (
                  <div className="w-48 h-48 bg-gray-200 rounded-lg flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                <div className="flex items-center space-x-3">
                  <Package className="h-5 w-5 text-gray-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-600">Produto</p>
                    <p className="font-semibold">{selectedClothingItem.products?.name || 'N/A'}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Hash className="h-5 w-5 text-gray-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-600">ID do Item</p>
                    <p className="font-semibold text-xs">{selectedClothingItem.id}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <DollarSign className="h-5 w-5 text-gray-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-600">Preço</p>
                    <p className="font-semibold">{formatCurrency(normalizePrice(selectedClothingItem.price))}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Badge variant={
                    selectedClothingItem.status === 'sold' ? 'destructive' :
                    selectedClothingItem.status === 'in_package' ? 'secondary' :
                    'default'
                  }>
                    {selectedClothingItem.status || 'N/A'}
                  </Badge>
                </div>
                {selectedClothingItem.order_id && (
                  <>
                    <div className="col-span-2 border-t pt-4 mt-2">
                      <h4 className="font-semibold text-lg mb-2">Informações do Pedido</h4>
                    </div>
                    <div className="flex items-center space-x-3">
                      <User className="h-5 w-5 text-gray-500" />
                      <div>
                        <p className="text-sm font-medium text-gray-600">Cliente</p>
                        <p className="font-semibold">{getCustomerName(selectedClothingItem)}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Mail className="h-5 w-5 text-gray-500" />
                      <div>
                        <p className="text-sm font-medium text-gray-600">Email</p>
                        <p className="font-semibold">{getCustomerEmail(selectedClothingItem)}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Calendar className="h-5 w-5 text-gray-500" />
                      <div>
                        <p className="text-sm font-medium text-gray-600">Data do Pedido</p>
                        <p className="font-semibold">{selectedClothingItem.orders?.created_at ? formatDate(selectedClothingItem.orders.created_at) : 'N/A'}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <MapPin className="h-5 w-5 text-gray-500" />
                      <div>
                        <p className="text-sm font-medium text-gray-600">Status do Pedido</p>
                        <p className="font-semibold">{selectedClothingItem.orders?.status || 'N/A'}</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default AdminClothingGrouped;
