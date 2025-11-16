import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Mail, RefreshCw } from 'lucide-react';

interface EmailConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  email: string;
  onResendEmail?: () => void;
  isResending?: boolean;
}

const EmailConfirmationModal: React.FC<EmailConfirmationModalProps> = ({
  isOpen,
  onClose,
  email,
  onResendEmail,
  isResending = false
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md mx-auto bg-white rounded-2xl shadow-2xl border-0 p-0 overflow-hidden">
        <DialogHeader>
          <DialogTitle>Confirmação de E-mail</DialogTitle>
          <DialogDescription className="sr-only">
            Modal para confirmação de e-mail após cadastro
          </DialogDescription>
        </DialogHeader>
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-8 text-center">
          {/* Borboleta Icon */}
          <div className="mb-6 flex justify-center">
            <div className="w-20 h-20 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center shadow-lg">
              <svg 
                viewBox="0 0 100 100" 
                className="w-12 h-12 text-white"
                fill="currentColor"
              >
                <path d="M50 20c-8 0-15 6-15 15 0 5 2 9 5 12-3 3-5 7-5 12 0 9 7 15 15 15s15-6 15-15c0-5-2-9-5-12 3-3 5-7 5-12 0-9-7-15-15-15zm-20 15c-5 0-10 4-10 10s4 10 10 10c3 0 6-1 8-3-2-3-3-6-3-10s1-7 3-10c-2-2-5-3-8-3zm40 0c-3 0-6 1-8 3 2 3 3 6 3 10s-1 7-3 10c2 2 5 3 8 3 5 0 10-4 10-10s-4-10-10-10z"/>
              </svg>
            </div>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-orange-600 mb-2">
            Confirme seu e-mail
          </h2>

          {/* Email Display */}
          <div className="mb-6">
            <p className="text-gray-600 mb-2">
              Enviamos um link de confirmação para:
            </p>
            <div className="bg-white rounded-lg px-4 py-3 border border-orange-200">
              <p className="text-orange-600 font-semibold break-all">
                {email}
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="w-full h-px bg-gradient-to-r from-transparent via-orange-300 to-transparent mb-6"></div>

          {/* Instructions */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-orange-600 mb-3">
              Verifique sua caixa de entrada
            </h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              Clique no link no e-mail que enviamos para confirmar sua conta. 
              Se não encontrar o e-mail, verifique sua pasta de spam.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              variant="outline"
              onClick={onResendEmail}
              disabled={isResending}
              className="border-orange-300 text-orange-600 hover:bg-orange-50 hover:border-orange-400 transition-all duration-200"
            >
              {isResending ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Reenviando...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Reenviar e-mail
                </>
              )}
            </Button>
            
            <Button
              onClick={onClose}
              className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-lg hover:shadow-xl transition-all duration-200"
            >
              Entendi
            </Button>
          </div>
        </div>

        {/* Bottom Accent */}
        <div className="h-2 bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600"></div>
      </DialogContent>
    </Dialog>
  );
};

export default EmailConfirmationModal;