import React from 'react';
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface EmailConfirmationModalNewProps {
  isOpen: boolean;
  onClose: () => void;
  email: string;
  onResendEmail?: () => void;
  isResending?: boolean;
}

const EmailConfirmationModalNew: React.FC<EmailConfirmationModalNewProps> = ({
  isOpen,
  onClose,
  email,
  onResendEmail,
  isResending = false
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md mx-auto bg-transparent border-0 p-0 shadow-none">
        <DialogHeader>
          <DialogTitle>Confirmação de E-mail</DialogTitle>
          <DialogDescription className="sr-only">
            Modal para confirmação de e-mail após cadastro
          </DialogDescription>
        </DialogHeader>
        <div className="modal-container bg-white rounded-[20px] p-8 max-w-[450px] w-full text-center shadow-[0_20px_40px_rgba(0,0,0,0.15)] relative">
          {/* Butterfly Icon */}
          <div className="butterfly-icon w-20 h-20 mx-auto mb-8 flex items-center justify-center relative">
            <img 
              className="butterfly-svg w-[80px] h-[80px] object-contain transform -rotate-[35deg]" 
              src="/borboleta-modal-email.svg" 
              alt="Borboleta"
            />
          </div>
          
          <h2 className="modal-title text-[28px] font-semibold text-[#ff6b35] mb-5">
            Confirme seu e-mail
          </h2>
          
          <p className="modal-subtitle text-base text-[#666] mb-2">
            Enviamos um link de confirmação para:
          </p>
          <p className="email-address text-lg text-[#ff6b35] font-medium mb-8">
            {email}
          </p>
          
          <div className="divider h-px bg-gradient-to-r from-transparent via-[#ddd] to-transparent my-8"></div>
          
          <h3 className="verification-title text-[22px] text-[#ff6b35] font-semibold mb-4">
            Verifique sua caixa de entrada
          </h3>
          
          <p className="verification-text text-sm text-[#666] leading-relaxed mb-8">
            Clique no link no e-mail que enviamos para confirmar sua conta. Se não encontrar o email, verifique sua pasta de spam.
          </p>
          
          <div className="button-container flex gap-4 justify-center flex-wrap">
            <Button
              variant="outline"
              onClick={onResendEmail}
              disabled={isResending}
              className="btn btn-resend px-6 py-3 rounded-[25px] text-base font-medium cursor-pointer transition-all duration-300 border-2 border-[#ff6b35] min-w-[140px] bg-transparent text-[#ff6b35] hover:bg-[#ff6b35] hover:text-white hover:-translate-y-0.5 hover:shadow-[0_5px_15px_rgba(255,107,53,0.3)]"
            >
              {isResending ? 'Reenviando...' : 'Reenviar e-mail'}
            </Button>
            
            <Button
              onClick={onClose}
              className="btn btn-understand px-6 py-3 rounded-[25px] text-base font-medium cursor-pointer transition-all duration-300 border-2 border-[#ff6b35] min-w-[140px] bg-[#ff6b35] text-white hover:bg-[#e55a2b] hover:-translate-y-0.5 hover:shadow-[0_5px_15px_rgba(255,107,53,0.4)]"
            >
              Entendi
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EmailConfirmationModalNew;

// Estilos CSS adicionais que podem ser necessários no global.css ou index.css:
/*
@keyframes modalAppear {
  from {
    opacity: 0;
    transform: scale(0.9) translateY(-20px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.modal-container {
  animation: modalAppear 0.3s ease-out;
}

@media (max-width: 480px) {
  .modal-container {
    padding: 30px 20px;
    margin: 10px;
  }
  
  .button-container {
    flex-direction: column;
  }
  
  .btn {
    width: 100%;
  }
}
*/