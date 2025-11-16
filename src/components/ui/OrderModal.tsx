import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "../ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Package, 
  Calendar, 
  DollarSign, 
  CreditCard,
  Shirt,
  Hash,
  Truck,
  CheckCircle
} from 'lucide-react';

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  size?: string;
}

interface Order {
  id: string;
  customer_data: {
    name: string;
    email: string;
    phone?: string;
    address?: string;
  };
  items: OrderItem[];
  total_amount: string;
  status: string;
  payment_status: string;
  payment_method: string;
  shipping_address?: any;
  created_at: string;
  updated_at: string;
}

interface OrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  formatDate: (date: string) => string;
  formatCurrency: (value: number) => string;
  mapStatus: (status: string) => string;
  getStatusBadgeClass: (status: string) => string;
  onProcessOrder: (orderId: string, newStatus: string) => void;
}

const OrderModal: React.FC<OrderModalProps> = ({
  isOpen,
  onClose,
  order,
  formatDate,
  formatCurrency,
  mapStatus,
  getStatusBadgeClass,
  onProcessOrder
}) => {
  
  // Função para formatar endereço de entrega
  const formatShippingAddress = (address: any): string => {
    if (!address) return 'Não informado';
    
    try {
      let addressObj;
      
      // Se for string, tentar fazer parse do JSON
      if (typeof address === 'string') {
        addressObj = JSON.parse(address);
      } else {
        addressObj = address;
      }
      
      // Extrair campos do endereço
      const {
        street = '',
        number = '',
        neighborhood = '',
        city = '',
        state = '',
        zip_code = '',
        country = ''
      } = addressObj;
      
      // Montar endereço formatado
      const parts = [];
      
      if (street && number) {
        parts.push(`${street}, ${number}`);
      } else if (street) {
        parts.push(street);
      }
      
      if (neighborhood) {
        parts.push(neighborhood);
      }
      
      if (city && state) {
        parts.push(`${city} - ${state}`);
      } else if (city) {
        parts.push(city);
      }
      
      if (zip_code) {
        parts.push(`CEP: ${zip_code}`);
      }
      
      if (country && country !== 'BR' && country !== 'Brasil') {
        parts.push(country);
      }
      
      return parts.length > 0 ? parts.join('\n') : 'Endereço incompleto';
      
    } catch (error) {
      // Se não conseguir fazer parse, retornar como string
      return typeof address === 'string' ? address : 'Formato de endereço inválido';
    }
  };
  if (!order) return null;

  const customerName = order.customer_data?.name || 'Nome não informado';
  const customerEmail = order.customer_data?.email || 'Email não informado';
  const customerPhone = order.customer_data?.phone || 'Telefone não informado';
  const orderDate = formatDate(order.created_at);
  const orderTotal = formatCurrency(parseFloat(order.total_amount) / 100);
  const paymentMethod = order.payment_method === 'pix' ? 'PIX' : 
                       order.payment_method === 'credit_card' ? 'Cartão de Crédito' : 
                       order.payment_method || 'Não informado';

  const getNextStatus = (currentStatus: string) => {
    switch (currentStatus) {
      case 'pending': return 'processing';
      case 'processing': return 'shipped';
      case 'shipped': return 'delivered';
      default: return null;
    }
  };

  const getNextStatusLabel = (currentStatus: string) => {
    switch (currentStatus) {
      case 'pending': return 'Processar Pedido';
      case 'processing': return 'Marcar como Enviado';
      case 'shipped': return 'Marcar como Entregue';
      default: return null;
    }
  };

  const nextStatus = getNextStatus(order.status);
  const nextStatusLabel = getNextStatusLabel(order.status);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-xl font-bold text-gray-900">Detalhes do Pedido</DialogTitle>
          <DialogDescription className="text-sm text-gray-500 mt-1">
            Informações completas do pedido de roupas
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Informações do Cliente */}
          <div>
            <h3 className="text-base font-semibold text-gray-900 mb-3">Informações do Cliente</h3>
            <Card className="border border-gray-200 shadow-sm">
              <CardContent className="pt-6 space-y-2.5">
                <p className="text-sm"><span className="font-bold text-gray-900">Nome:</span> <span className="text-gray-900">{customerName}</span></p>
                <p className="text-sm"><span className="font-bold text-gray-900">Email:</span> <span className="text-gray-900">{customerEmail}</span></p>
                <p className="text-sm"><span className="font-bold text-gray-900">Telefone:</span> <span className="text-gray-900">{customerPhone}</span></p>
                {order.shipping_address && (
                  <div className="pt-2">
                    <p className="text-sm"><span className="font-bold text-gray-900">Endereço de Entrega:</span></p>
                    <div className="text-sm text-gray-900 mt-1 whitespace-pre-line">
                      {formatShippingAddress(order.shipping_address)}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Informações do Pedido */}
          <div>
            <h3 className="text-base font-semibold text-gray-900 mb-3">Informações do Pedido</h3>
            <Card className="border border-gray-200 shadow-sm">
              <CardContent className="pt-6 space-y-2.5">
                <p className="text-sm"><span className="font-bold text-gray-900">ID:</span> <span className="text-gray-900 font-mono">{order.id}</span></p>
                <p className="text-sm"><span className="font-bold text-gray-900">Data e Hora:</span> <span className="text-gray-900">{orderDate}</span></p>
                <p className="text-sm"><span className="font-bold text-gray-900">Status:</span> <span className="text-gray-900">{mapStatus(order.status)}</span></p>
                <p className="text-sm"><span className="font-bold text-gray-900">Método de Pagamento:</span> <span className="text-gray-900">{paymentMethod}</span></p>
                <p className="text-sm"><span className="font-bold text-gray-900">Status do Pagamento:</span> <span className="text-gray-900">{order.payment_status === 'paid' ? 'Pago' : 'Pendente'}</span></p>
                <p className="text-sm"><span className="font-bold text-gray-900">Total:</span> <span className="text-gray-900 font-bold">{orderTotal}</span></p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Itens do Pedido */}
        <div>
          <h3 className="text-base font-semibold text-gray-900 mb-3">Itens do Pedido</h3>
          <Card className="border border-gray-200 shadow-sm">
            <CardContent className="pt-6">
              <div className="space-y-0">
                {order.items.map((item, index) => (
                  <div key={index} className={`flex justify-between items-start py-3 ${index < order.items.length - 1 ? 'border-b border-gray-200' : ''}`}>
                    <div className="flex-1">
                      <p className="font-bold text-gray-900 mb-1">{item.name}</p>
                      {item.size && (
                        <p className="text-sm text-gray-600">Tamanho: {item.size}</p>
                      )}
                      {item.category && (
                        <p className="text-sm text-gray-600">Categoria: {item.category}</p>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <p className="text-sm text-gray-900 mb-1">Qtd: {item.quantity}</p>
                      <p className="text-sm text-gray-900 mb-1">{formatCurrency(item.unit_price)} cada</p>
                      <p className="font-bold text-gray-900">Total: {formatCurrency(item.total_price)}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Separator className="my-4" />
              <div className="flex justify-between items-center text-sm text-gray-900">
                <span>Total de Itens:</span>
                <span>{order.items.reduce((sum, item) => sum + item.quantity, 0)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Ações */}
        <div className="flex justify-between items-center pt-4">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          
          <div className="flex gap-2">
            {nextStatus && nextStatusLabel && (
              <Button 
                onClick={() => {
                  onProcessOrder(order.id, nextStatus);
                  onClose();
                }}
                className="flex items-center gap-2"
              >
                {order.status === 'pending' && <Package className="h-4 w-4" />}
                {order.status === 'processing' && <Truck className="h-4 w-4" />}
                {order.status === 'shipped' && <CheckCircle className="h-4 w-4" />}
                {nextStatusLabel}
              </Button>
            )}
            
            {order.status !== 'cancelled' && order.status !== 'delivered' && (
              <Button 
                variant="destructive"
                onClick={() => {
                  onProcessOrder(order.id, 'cancelled');
                  onClose();
                }}
              >
                Cancelar Pedido
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OrderModal;