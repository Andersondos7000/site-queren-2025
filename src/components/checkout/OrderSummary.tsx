
import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ShoppingCart, ShieldCheck, LifeBuoy, Lock } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

type CartItemBase = {
  id: string;
  name: string;
  price: number;
  quantity: number;
};

type ProductItem = CartItemBase & {
  category?: string;
  size?: string;
  product_id?: string;
  ticket_id?: string;
  image?: string;
  images?: string[];
  unit_price?: number;
  total_price?: number;
  metadata?: Record<string, unknown>;
  ticket_type?: string;
  status?: string;
  event_title?: string;
};

interface OrderSummaryProps {
  cartItems: ProductItem[];
  subtotal: number;
  total: number;
}

const OrderSummary: React.FC<OrderSummaryProps> = ({ cartItems, subtotal, total }) => {
  const [couponCode, setCouponCode] = useState("");
  const { toast } = useToast();

  const applyCoupon = () => {
    if (couponCode.trim()) {
      toast({
        title: "Cupom aplicado!",
        description: "Desconto aplicado ao seu pedido.",
      });
    }
  };

  return (
    <div className="lg:col-span-1">
      <div className="sticky top-24">
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-butterfly-orange" />
              Resumo do Pedido
            </h2>

            <div className="space-y-3 mb-4">
              {cartItems.map((item) => (
                <div key={item.id} className="flex justify-between">
                  <span className="text-gray-600">
                    {item.name} x{item.quantity}
                  </span>
                  <span className="font-medium">
                    {((Number(item.price) || 0) * (Number(item.quantity) || 1)).toLocaleString('pt-BR', { 
                      style: 'currency', 
                      currency: 'BRL' 
                    })}
                  </span>
                </div>
              ))}
            </div>

            <Separator className="my-4" />

            <div className="flex space-x-2 mb-4">
              <Input
                placeholder="Cupom de desconto"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                className="flex-1"
              />
              <Button 
                type="button" 
                onClick={applyCoupon}
                variant="outline"
              >
                Aplicar
              </Button>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{subtotal.toLocaleString('pt-BR', { 
                  style: 'currency', 
                  currency: 'BRL' 
                })}</span>
              </div>
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span className="text-butterfly-orange">{total.toLocaleString('pt-BR', { 
                  style: 'currency', 
                  currency: 'BRL' 
                })}</span>
              </div>
            </div>

            <div className="mt-6 bg-gray-50 rounded-lg p-4">
              <div className="flex items-center space-x-3 mb-3">
                <ShieldCheck className="h-5 w-5 text-butterfly-orange" />
                <span className="font-medium">Garantia de devolução 100%</span>
              </div>
              <p className="text-sm text-gray-600">
                Caso não fique satisfeito com sua compra, garantimos reembolso total dentro de 7 dias após o evento.
              </p>
            </div>

            <div className="mt-4 bg-gray-50 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <LifeBuoy className="h-5 w-5 text-butterfly-orange" />
                <span className="font-medium">Suporte 24/7</span>
              </div>
              <div className="flex items-center mt-3">
                <img 
                  src="/img - suporte.webp" 
                  alt="Anderson Araújo - Suporte" 
                  className="w-12 h-12 rounded-full object-cover mr-3"
                />
                <div>
                  <p className="font-medium">Anderson Araújo </p>
                  <p className="text-sm text-gray-600">Suporte e Atendimento</p>
                </div>
              </div>
            </div>

            <div className="flex justify-center mt-4">
              <Lock className="h-4 w-4 text-gray-500 mr-1" />
              <span className="text-xs text-gray-500">Pagamento seguro com criptografia SSL</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OrderSummary;
