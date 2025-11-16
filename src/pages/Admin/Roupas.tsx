import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ShoppingCart, 
  Package, 
  Truck, 
  DollarSign, 
  Search, 
  Filter,
  Eye,
  Download,
  Shirt
} from 'lucide-react';
import { useClothingOrders, ClothingOrder } from '@/hooks/useClothingOrders';
import AdminSidebar from '@/components/AdminSidebar';

const RoupasAdmin = () => {
  const { clothingOrders, stats, loading, error } = useClothingOrders();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sizeFilter, setSizeFilter] = useState<string>('all');

  // Filtros aplicados
  const filteredOrders = useMemo(() => {
    return clothingOrders.filter(order => {
      const matchesSearch = 
        order.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.customer_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.id.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = statusFilter === 'all' || order.payment_status === statusFilter;
      
      const matchesSize = sizeFilter === 'all' || 
        order.clothing_items.some(item => item.size === sizeFilter);

      return matchesSearch && matchesStatus && matchesSize;
    });
  }, [clothingOrders, searchTerm, statusFilter, sizeFilter]);

  // Obter tamanhos únicos para o filtro
  const availableSizes = useMemo(() => {
    const sizes = new Set<string>();
    clothingOrders.forEach(order => {
      order.clothing_items.forEach(item => {
        if (item.size && item.size !== 'Sem tamanho') {
          sizes.add(item.size);
        }
      });
    });
    return Array.from(sizes).sort();
  }, [clothingOrders]);

  const getStatusBadgeVariant = (paymentStatus: string, orderStatus: string) => {
    if (paymentStatus === 'paid' && orderStatus === 'shipped') return 'default';
    if (paymentStatus === 'paid') return 'secondary';
    if (paymentStatus === 'failed') return 'destructive';
    return 'outline';
  };

  const getStatusText = (paymentStatus: string, orderStatus: string) => {
    if (paymentStatus === 'paid' && orderStatus === 'shipped') return 'Enviado';
    if (paymentStatus === 'paid' && orderStatus === 'delivered') return 'Entregue';
    if (paymentStatus === 'paid') return 'Pago';
    if (paymentStatus === 'failed') return 'Falhou';
    return 'Pendente';
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-gray-100">
        <AdminSidebar />
        <div className="flex-1 p-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-lg">Carregando pedidos de roupas...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen bg-gray-100">
        <AdminSidebar />
        <div className="flex-1 p-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-lg text-red-600">Erro ao carregar pedidos: {error.message}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-gray-100">
      <AdminSidebar />
      
      <div className="flex-1 p-4 md:p-8 w-full lg:w-auto pt-20 lg:pt-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div className="flex items-center gap-3">
            <Shirt className="h-6 w-6 md:h-8 md:w-8 text-butterfly-orange" />
            <h1 className="text-2xl md:text-3xl font-bold">Pedidos de Roupas</h1>
          </div>
          <Button variant="outline" className="flex items-center gap-2 w-full sm:w-auto">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Exportar Relatório</span>
            <span className="sm:hidden">Exportar</span>
          </Button>
        </div>

        {/* Cards de Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total de Pedidos</CardTitle>
              <ShoppingCart className="h-4 w-4 text-butterfly-orange" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalOrders}</div>
              <p className="text-xs text-muted-foreground">
                Pedidos com roupas
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
              <DollarSign className="h-4 w-4 text-butterfly-orange" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                R$ {(stats.totalRevenue / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
              <p className="text-xs text-muted-foreground">
                Ticket médio: R$ {(stats.averageOrderValue / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pagos</CardTitle>
              <Package className="h-4 w-4 text-butterfly-orange" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.paidOrders}</div>
              <p className="text-xs text-muted-foreground">
                {stats.pendingOrders} pendentes
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pendentes de Envio</CardTitle>
              <Truck className="h-4 w-4 text-butterfly-orange" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.pendingShipments}</div>
              <p className="text-xs text-muted-foreground">
                {stats.shippedOrders} já enviados
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Análise por Tamanhos */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Distribuição por Tamanhos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.sizeDistribution)
                .sort(([a], [b]) => {
                  // Ordenar tamanhos: PP, P, M, G, GG, XG, etc.
                  const sizeOrder = ['PP', 'P', 'M', 'G', 'GG', 'XG', 'XXG'];
                  const indexA = sizeOrder.indexOf(a);
                  const indexB = sizeOrder.indexOf(b);
                  if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                  if (indexA !== -1) return -1;
                  if (indexB !== -1) return 1;
                  return a.localeCompare(b);
                })
                .map(([size, quantity]) => (
                  <Badge key={size} variant="secondary" className="text-sm">
                    {size}: {quantity} unidades
                  </Badge>
                ))}
            </div>
          </CardContent>
        </Card>

        {/* Produtos Mais Vendidos */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Produtos Mais Vendidos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.topSellingProducts.map((product, index) => (
                <div key={product.name} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-butterfly-orange text-white rounded-full flex items-center justify-center text-sm font-bold">
                      {index + 1}
                    </div>
                    <div>
                      <h4 className="font-medium">{product.name}</h4>
                      <p className="text-sm text-gray-500">{product.quantity} unidades vendidas</p>
                    </div>
                  </div>
                  <span className="font-semibold">
                    R$ {(product.revenue / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Filtros */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 min-w-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Buscar por cliente, email ou ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Status do pagamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os status</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="paid">Pago</SelectItem>
                    <SelectItem value="failed">Falhou</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={sizeFilter} onValueChange={setSizeFilter}>
                  <SelectTrigger className="w-full sm:w-[150px]">
                    <SelectValue placeholder="Tamanho" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os tamanhos</SelectItem>
                    {availableSizes.map(size => (
                      <SelectItem key={size} value={size}>{size}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabela de Pedidos */}
        <Card>
          <CardHeader>
            <CardTitle>Pedidos de Roupas ({filteredOrders.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-4 font-medium">ID</th>
                    <th className="text-left p-4 font-medium">Cliente</th>
                    <th className="text-left p-4 font-medium">Itens</th>
                    <th className="text-left p-4 font-medium">Total</th>
                    <th className="text-left p-4 font-medium">Status</th>
                    <th className="text-left p-4 font-medium">Data</th>
                    <th className="text-left p-4 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => (
                    <tr key={order.id} className="border-b hover:bg-gray-50">
                      <td className="p-4 font-mono text-sm">
                        {order.id.slice(0, 8)}...
                      </td>
                      <td className="p-4">
                        <div>
                          <div className="font-medium">{order.customer_name}</div>
                          <div className="text-sm text-gray-500">{order.customer_email}</div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="space-y-1">
                          {order.clothing_items.slice(0, 2).map((item, idx) => (
                            <div key={idx} className="text-sm">
                              <span className="font-medium">{item.name}</span>
                              <span className="text-gray-500"> - {item.size} (x{item.quantity})</span>
                            </div>
                          ))}
                          {order.clothing_items.length > 2 && (
                            <div className="text-sm text-gray-500">
                              +{order.clothing_items.length - 2} itens
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-4 font-medium">
                        R$ {(order.total_amount / 100).toFixed(2)}
                      </td>
                      <td className="p-4">
                        <Badge variant={getStatusBadgeVariant(order.payment_status, order.status)}>
                          {getStatusText(order.payment_status, order.status)}
                        </Badge>
                        {order.order_type === 'mixed' && (
                          <Badge variant="outline" className="ml-1 text-xs">
                            Misto
                          </Badge>
                        )}
                      </td>
                      <td className="p-4 text-sm text-gray-500">
                        {new Date(order.created_at).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="p-4">
                        <Button variant="outline" size="sm" className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          Detalhes
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {filteredOrders.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  {searchTerm || statusFilter !== 'all' || sizeFilter !== 'all' 
                    ? 'Nenhum pedido encontrado com os filtros aplicados.'
                    : 'Nenhum pedido de roupas encontrado.'
                  }
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RoupasAdmin;