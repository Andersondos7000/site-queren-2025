import { useState } from 'react';
import { useAuth } from './useAuth';

interface UseEmailConfirmationReturn {
  isResending: boolean;
  resendConfirmationEmail: (email: string) => Promise<void>;
  error: string | null;
}

export const useEmailConfirmation = (): UseEmailConfirmationReturn => {
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { supabase } = useAuth();

  const resendConfirmationEmail = async (email: string): Promise<void> => {
    if (isResending) return;
    
    setIsResending(true);
    setError(null);
    
    try {
      // Validar formato do email
      if (!email || !email.includes('@') || email.trim() === '') {
        throw new Error('Email inválido fornecido');
      }

      const cleanEmail = email.trim().toLowerCase();
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: cleanEmail,
      });
      
      if (error) {
        throw error;
      }
      
      console.log('✅ Email de confirmação reenviado com sucesso');
      
    } catch (err: any) {
      console.error('Erro ao reenviar email de confirmação:', err);
      setError(err.message || 'Erro ao reenviar email de confirmação');
      throw err;
    } finally {
      setIsResending(false);
    }
  };

  return {
    isResending,
    resendConfirmationEmail,
    error
  };
};