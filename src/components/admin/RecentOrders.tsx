import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useRecentOrders } from '@/hooks/useRecentOrders';

export const RecentOrders: React.FC = () => {
  const { orders, loading, error } = useRecentOrders(5);

  const getStatusBadgeClass = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pago':
        return 'bg-green-100 text-green-800';
      case 'pendente':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelado':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Últimos Pedidos</CardTitle>
          <CardDescription>Pedidos mais recentes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex justify-between items-center animate-pulse">
                <div>
                  <div className="w-16 h-4 bg-gray-200 rounded mb-1"></div>
                  <div className="w-20 h-3 bg-gray-200 rounded"></div>
                </div>
                <div className="w-16 h-6 bg-gray-200 rounded"></div>
                <div className="w-20 h-4 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Últimos Pedidos</CardTitle>
          <CardDescription>Pedidos mais recentes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-red-500">Erro ao carregar pedidos: {error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Últimos Pedidos</CardTitle>
        <CardDescription>Pedidos mais recentes</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {orders.length > 0 ? (
            orders.map((order) => (
              <div key={order.id} className="flex justify-between items-center">
                <div>
                  <h4 className="font-medium">#{order.orderNumber}</h4>
                  <p className="text-sm text-gray-500">{order.itemsDescription}</p>
                </div>
                <span className={`text-xs py-1 px-2 rounded ${getStatusBadgeClass(order.statusDisplay)}`}>
                  {order.statusDisplay}
                </span>
                <span className="font-semibold">
                  R$ {(order.totalAmount / 100).toFixed(2)}
                </span>
              </div>
            ))
          ) : (
            <div className="text-center py-4">
              <p className="text-gray-500">Nenhum pedido encontrado</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};