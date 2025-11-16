import React, { useEffect } from 'react';
import { CheckCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface PaymentSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  duration?: number; // Duração em milissegundos (padrão: 5000ms = 5 segundos)
}

export const PaymentSuccessModal: React.FC<PaymentSuccessModalProps> = ({
  isOpen,
  onClose,
  duration = 5000, // 0 = manter aberto indefinidamente
}) => {
  // ✅ LOG: Sempre logar quando o componente renderizar
  console.log(`🔍 PaymentSuccessModal renderizado - isOpen: ${isOpen}, duration: ${duration}ms`);
  
  useEffect(() => {
    if (isOpen && duration > 0) {
      console.log(`✅ Modal de sucesso aberto. Fechando automaticamente em ${duration}ms...`);
      console.log(`✅ Modal isOpen: ${isOpen}, duration: ${duration}ms`);
      console.log(`⏰ Timestamp de abertura: ${new Date().toISOString()}`);
      
      // Fechar automaticamente após a duração especificada
      const timer = setTimeout(() => {
        console.log(`⏰ Timestamp de fechamento: ${new Date().toISOString()}`);
        console.log('✅ Fechando modal de sucesso e redirecionando para home...');
        onClose();
      }, duration);

      return () => {
        console.log('🧹 Limpando timer do modal de sucesso');
        clearTimeout(timer);
      };
    } else if (isOpen && duration === 0) {
      console.log('✅ Modal de sucesso aberto indefinidamente (duration = 0)');
    } else {
      console.log(`⏸️ Modal de sucesso fechado (isOpen: ${isOpen})`);
    }
  }, [isOpen, duration, onClose]);

  // ✅ CORREÇÃO: Usar o mesmo padrão do PixPaymentModal com Dialog do @/components/ui/dialog
  // Isso garante consistência e que o Portal funcione corretamente
  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent 
        className={cn("sm:max-w-sm")}
        style={{ zIndex: 10001 }}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-10 w-10 text-green-600" strokeWidth={2.5} />
            </div>
            <div className="space-y-2">
              <DialogTitle className="text-xl font-bold text-gray-900">
                Pagamento realizado com sucesso! ✅
              </DialogTitle>
              <DialogDescription className="text-sm text-gray-600">
                Seu pedido foi processado e confirmado. {duration === 0 ? 'Clique em OK para continuar.' : 'Você será redirecionado em instantes.'}
              </DialogDescription>
              {duration === 0 && (
                <div className="pt-4">
                  <button
                    onClick={onClose}
                    className="w-full inline-flex justify-center rounded-md border border-transparent bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                  >
                    OK
                  </button>
                </div>
              )}
            </div>
          </div>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
};

