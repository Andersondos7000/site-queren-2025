import React, { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { QRCode } from '@/components/ui/qr-code';
import { useAbacatePay } from '@/hooks/abacatepay/useAbacatePay';
import { Clock, Copy, RefreshCw } from 'lucide-react';
import type { AbacatePayCheckoutProps } from '@/types/unified-types';

type ExtendedProps = AbacatePayCheckoutProps & {
  clearCart?: () => Promise<void>;
  onPaymentSuccess?: (paymentData: any) => void;
  onPaymentError?: (error: string) => void;
  onPaymentPending?: (paymentData: any) => void;
};

const AbacatePayCheckout: React.FC<ExtendedProps> = ({
  orderData,
  clearCart,
  onPaymentSuccess,
  onPaymentError,
  onPaymentPending,
}) => {
  const {
    charge,
    isLoading,
    error,
    timeLeft,
    createCharge,
    checkPaymentStatus,
    copyPixCode,
    simulatePayment,
    reset,
    formatTime,
    formatCurrency,
  } = useAbacatePay();

  // ✅ CORREÇÃO: Ref para garantir que só crie a cobrança uma única vez
  // React StrictMode em desenvolvimento executa useEffect 2x para detectar bugs
  // Esta ref previne a criação duplicada de cobranças PIX
  const chargeCreatedRef = useRef(false);

  useEffect(() => {
    // Prevenir duplicação: só criar se ainda não foi criado
    if (chargeCreatedRef.current) {
      console.log('⚠️ Tentativa de criar cobrança duplicada bloqueada');
      return;
    }

    console.log('🔄 Criando cobrança PIX única...');
    chargeCreatedRef.current = true;

    createCharge({
      customer: orderData.customer,
      amount: orderData.amount,
      description: orderData.description,
      // ✅ CORREÇÃO: Passar todos os campos dos items para criar o pedido corretamente
      items: orderData.items.map((i: any) => ({
        title: i.title,
        quantity: i.quantity,
        unit_price: i.unit_price,
        product_id: i.product_id,
        size: i.size,
        event_id: i.event_id,
        ticket_type: i.ticket_type,
      })),
    }).catch((e: any) => {
      console.error('❌ Erro ao criar cobrança:', e);
      onPaymentError?.(e?.message || 'Erro ao criar cobrança');
      // Reset da ref em caso de erro para permitir retry
      chargeCreatedRef.current = false;
    });

    // Limpeza ao desmontar
    return () => {
      console.log('🧹 Limpando componente AbacatePayCheckout');
      reset();
    };
  }, []);

  useEffect(() => {
    let interval: any;
    if (charge?.status === 'pending' && charge.id) {
      interval = setInterval(async () => {
        const result = await checkPaymentStatus(charge.id);
        if (result) {
          onPaymentPending?.(result);
          if (result.status === 'paid') {
            clearInterval(interval);
            onPaymentSuccess?.(result);
            if (clearCart) await clearCart();
          }
          if (result.status === 'expired') {
            onPaymentError?.('Pagamento expirado');
          }
        }
      }, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [charge?.status, charge?.id]);

  const handleCopy = () => copyPixCode();
  const retryCreate = () => {
    createCharge({
      customer: orderData.customer,
      amount: orderData.amount,
      description: orderData.description,
      // ✅ CORREÇÃO: Passar todos os campos dos items para criar o pedido corretamente
      items: orderData.items.map((i: any) => ({
        title: i.title,
        quantity: i.quantity,
        unit_price: i.unit_price,
        product_id: i.product_id,
        size: i.size,
        event_id: i.event_id,
        ticket_type: i.ticket_type,
      })),
    }).catch(() => {});
  };

  if (!orderData) {
    return (
      <div className="p-4">
        <div className="text-sm text-gray-600">Dados do pedido indisponíveis.</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status Bar */}
      <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-start gap-2">
        <Clock className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-orange-900 leading-snug">
            Aguardando confirmação do pagamento...
          </p>
          <p className="text-xs text-orange-700 mt-1">
            Tempo restante: <strong>{formatTime(timeLeft)}</strong>
          </p>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex flex-col items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mb-2"></div>
          <div className="text-sm text-gray-600">Gerando PIX...</div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="text-sm text-red-600 text-center">{error}</div>
          <Button onClick={retryCreate} className="bg-green-600 hover:bg-green-700 w-full">
            Tentar novamente
          </Button>
        </div>
      )}

      {/* QR Code and Payment Info */}
      {charge?.pix?.qr_code || charge?.pix?.qr_code_base64 ? (
        <div className="space-y-4">
          {/* QR Code */}
          <div className="flex flex-col items-center gap-2.5">
            <div className="bg-white p-2.5 rounded-lg border border-gray-300 shadow-sm">
              {charge?.pix?.qr_code_base64 ? (
                <img 
                  src={charge.pix.qr_code_base64} 
                  alt="QR Code PIX" 
                  className="w-[180px] h-[180px] rounded"
                />
              ) : (
                <div className="w-[180px] h-[180px]">
                  <QRCode value={charge.pix.qr_code} size={180} level="M" includeMargin />
                </div>
              )}
            </div>
            <p className="text-xs text-gray-700 text-center px-1 leading-snug">
              Escaneie o QR Code com seu app do banco ou copie o código PIX
            </p>
          </div>

          {/* Copy Section */}
          <div className="space-y-2">
            <label className="text-[13px] font-medium text-gray-800 block">
              Copiar código PIX:
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <textarea 
                className="flex-1 p-2.5 border border-gray-300 rounded-lg bg-gray-50 font-mono text-[10px] resize-none min-h-[60px] max-h-[80px] leading-tight break-all overflow-auto"
                readOnly 
                value={charge.pix.qr_code}
                rows={3}
              />
              <Button 
                variant="outline" 
                className="border-gray-300 flex-shrink-0 h-10 gap-2 sm:w-auto w-full"
                onClick={handleCopy}
              >
                <Copy className="w-4 h-4" />
                <span>Copiar</span>
              </Button>
            </div>
          </div>

          {/* Payment Info */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-gray-200">
              <span className="text-[13px] font-medium text-gray-700">Valor:</span>
              <span className="text-sm font-bold text-gray-900">
                {formatCurrency(orderData.amount / 100)}
              </span>
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-[13px] font-medium text-gray-700">Status:</span>
              <span className="text-xs font-semibold text-orange-700">
                Aguardando Pagamento
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2.5 pt-1">
            <Button 
              variant="outline" 
              className="w-full flex items-center justify-center gap-2 border-2"
              onClick={() => charge?.id && checkPaymentStatus(charge.id)}
            >
              <RefreshCw className="w-4 h-4" />
              Verificar Pagamento
            </Button>
            <Button 
              className="w-full bg-green-600 hover:bg-green-700"
              onClick={() => charge?.id && simulatePayment(charge.id)}
            >
              🧪 Simular Pagamento (Teste)
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AbacatePayCheckout;
