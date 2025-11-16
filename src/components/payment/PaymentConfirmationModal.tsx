import React from 'react';
import { AlertCircle, CheckCircle, Clock, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface PaymentConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  paymentStatus?: 'pending' | 'paid' | 'expired' | 'cancelled' | 'success'; // Adicionado 'success'
  isLoading?: boolean;
}

export const PaymentConfirmationModal: React.FC<PaymentConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  paymentStatus = 'pending',
  isLoading = false,
}) => {
  console.log(`🔍 PaymentConfirmationModal renderizado - isOpen: ${isOpen}, status: ${paymentStatus}`);

  const getStatusConfig = () => {
    switch (paymentStatus) {
      case 'success':
        return {
          icon: <CheckCircle className="h-10 w-10 text-green-600" />,
          title: 'Pagamento Confirmado!',
          description: 'Seu pagamento foi recebido com sucesso. Você receberá um e-mail em breve.',
          confirmText: 'Fechar',
          confirmVariant: 'default' as const,
          confirmAction: onClose, // Ação de confirmação fecha o modal
          showCancel: false, // Não mostrar o botão de cancelar
        };
      case 'paid':
        return {
          icon: <CheckCircle className="h-10 w-10 text-green-500" />,
          title: 'Pagamento já confirmado',
          description: 'Este pagamento já foi processado anteriormente. Deseja verificar o status novamente?',
          confirmText: 'Verificar Novamente',
          confirmVariant: 'outline' as const,
          confirmAction: onConfirm,
          showCancel: true,
        };
      case 'expired':
        return {
          icon: <AlertCircle className="h-10 w-10 text-red-600" />,
          title: 'PIX Expirado',
          description: 'O tempo para pagamento deste PIX expirou. Deseja verificar o status mesmo assim?',
          confirmText: 'Verificar Status',
          confirmVariant: 'outline' as const,
          confirmAction: onConfirm,
          showCancel: true,
        };
      case 'cancelled':
        return {
          icon: <AlertCircle className="h-10 w-10 text-red-600" />,
          title: 'Pagamento Cancelado',
          description: 'Este pagamento foi cancelado. Deseja verificar o status mesmo assim?',
          confirmText: 'Verificar Status',
          confirmVariant: 'outline' as const,
          confirmAction: onConfirm,
          showCancel: true,
        };
      default: // pending
        return {
          icon: <Clock className="h-10 w-10 text-orange-600" />,
          title: 'Confirmar Verificação',
          description: 'Deseja verificar o status deste pagamento PIX?',
          confirmText: 'Confirmar Verificação',
          confirmVariant: 'default' as const,
          confirmAction: onConfirm,
          showCancel: true,
        };
    }
  };

  const config = getStatusConfig();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className={cn("sm:max-w-md")}
        style={{ zIndex: 10002 }}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-50">
              {config.icon}
            </div>
            <div className="space-y-2">
              <DialogTitle className="text-xl font-bold text-gray-900">
                {config.title}
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-600">
                {config.description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex flex-col gap-3 pt-4">
          <Button
            onClick={config.confirmAction}
            disabled={isLoading}
            variant={config.confirmVariant}
            className={cn("w-full", {
              "bg-green-600 hover:bg-green-700": paymentStatus === 'success',
            })}
            size="default"
          >
            {isLoading && paymentStatus !== 'success' ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Verificando...
              </>
            ) : (
              config.confirmText
            )}
          </Button>
          
          {config.showCancel && (
            <Button
              onClick={onClose}
              variant="outline"
              className="w-full"
              size="default"
              disabled={isLoading}
            >
              Cancelar
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};