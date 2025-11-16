import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import AbacatePayCheckout from '@/components/payment/AbacatePayCheckout';
import type { PixPaymentModalProps } from '@/types/unified-types';

const PixPaymentModal: React.FC<PixPaymentModalProps> = ({
  isOpen,
  onClose,
  orderData,
  clearCart,
  onPaymentSuccess,
  onPaymentError,
  onPaymentPending,
}) => {
  const handlePaymentSuccess = async (paymentData: any) => {
    // ✅ CORREÇÃO: Apenas passar o callback para o componente pai
    // O componente pai (Checkout.tsx) é responsável por:
    // 1. Fechar o modal de pagamento
    // 2. Limpar o carrinho
    // 3. Mostrar o modal de sucesso
    // NÃO fechar o modal aqui - deixar o componente pai controlar
    onPaymentSuccess?.(paymentData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-[95vw] sm:max-w-[440px] p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
        {/* Header customizado seguindo design do HTML */}
        <div className="mb-4 pb-3 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900 mb-1">Pagamento PIX</h2>
          <p className="text-sm text-gray-600">
            Escaneie o QR Code ou copie o código para concluir o pagamento.
          </p>
        </div>

        <AbacatePayCheckout
          orderData={orderData}
          clearCart={clearCart}
          onPaymentSuccess={handlePaymentSuccess}
          onPaymentError={(error) => onPaymentError?.(error)}
          onPaymentPending={(data) => onPaymentPending?.(data)}
        />
      </DialogContent>
    </Dialog>
  );
};

export default PixPaymentModal;
