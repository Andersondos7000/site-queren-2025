import { useEffect, useCallback, useState } from 'react';
import { supabase, clearAuthData, handleAuthError } from '../lib/supabase';
import { useToast } from './use-toast';

/**
 * Hook para gerenciar erros de autenticação do Supabase
 * Trata especificamente o erro "Invalid Refresh Token: Refresh Token Not Found"
 */
export const useAuthErrorHandler = () => {
  const { toast } = useToast();
  const [authError, setAuthError] = useState<Error | null>(null);

  const showAuthError = useCallback((message: string) => {
    toast({
      title: "Erro de Autenticação",
      description: message,
      variant: "destructive",
    });
  }, [toast]);

  const forceLogout = useCallback(async () => {
    try {
      console.log('🔄 Forçando logout devido a erro de autenticação...');
      
      // Limpar dados locais
      clearAuthData();
      
      // Fazer logout no Supabase
      await supabase.auth.signOut({ scope: 'local' });
      
      // Mostrar notificação
      showAuthError('Sua sessão expirou. Faça login novamente.');
      
      // Redirecionar para página de login após um delay
      setTimeout(() => {
        window.location.href = '/auth';
      }, 2000);
      
    } catch (error) {
      console.error('❌ Erro durante logout forçado:', error);
      // Em caso de erro, recarregar a página
      window.location.reload();
    }
  }, [showAuthError]);

  const handleSupabaseError = useCallback(async (error: unknown) => {
    const errorMessage = error?.message || '';
    
    // Verificar se é erro de refresh token
    if (errorMessage.includes('Invalid Refresh Token') || 
        errorMessage.includes('Refresh Token Not Found') ||
        errorMessage.includes('JWT expired')) {
      
      console.warn('🚨 Erro de token detectado:', errorMessage);
      setAuthError(error);
      await handleAuthError(error);
      return true; // Indica que o erro foi tratado
    }
    
    // Outros erros de autenticação
    if (errorMessage.includes('Invalid login credentials') ||
        errorMessage.includes('Email not confirmed') ||
        errorMessage.includes('User not found')) {
      
      showAuthError(errorMessage);
      return true;
    }
    
    return false; // Erro não tratado
  }, [showAuthError]);

  // Configurar listeners para erros globais
  useEffect(() => {
    // Listener para erros não capturados
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (event.reason?.message) {
        const handled = handleSupabaseError(event.reason);
        if (handled) {
          event.preventDefault();
        }
      }
    };

    // Listener para erros JavaScript
    const handleError = (event: ErrorEvent) => {
      if (event.error?.message) {
        handleSupabaseError(event.error);
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, [handleSupabaseError]);

  // Monitorar mudanças de estado de autenticação
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔐 Auth state change:', event);
        
        if (event === 'SIGNED_OUT') {
          clearAuthData();
        }
        
        // Se houve falha no refresh e não há sessão
        if (event === 'TOKEN_REFRESHED' && !session) {
          console.warn('⚠️ Token refresh falhou, forçando logout...');
          await forceLogout();
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [forceLogout]);

  return {
    handleSupabaseError,
    forceLogout,
    clearAuthData,
    authError,
    clearAuthError: () => setAuthError(null),
  };
};

export default useAuthErrorHandler;