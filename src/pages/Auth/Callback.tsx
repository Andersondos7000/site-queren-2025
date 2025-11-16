
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { fixUserConfirmationTokenIssue } from '@/utils/authFixUtils';
import { handleEmailChangeTokenError, isEmailChangeTokenError } from '@/utils/emailChangeTokenFix';

// Função auxiliar para tentar recuperar sessão com retry
const retryGetSession = async (maxRetries = 3, delay = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (data.session && !error) {
        return { data, error: null };
      }
      if (error) {
        console.log(`Tentativa ${i + 1} falhou:`, error.message);
      }
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    } catch (err) {
      console.error(`Erro na tentativa ${i + 1}:`, err);
      if (i === maxRetries - 1) throw err;
    }
  }
  return { data: { session: null }, error: new Error('Não foi possível recuperar a sessão após múltiplas tentativas') };
};

const AuthCallback = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Verificar se há parâmetros de erro na URL
        const urlParams = new URLSearchParams(window.location.hash.substring(1));
        const errorParam = urlParams.get('error');
        const errorDescription = urlParams.get('error_description');
        
        if (errorParam) {
          console.error('Erro OAuth detectado na URL:', { errorParam, errorDescription });
          
          // Tratar erro específico de email_change_token_current
          if (isEmailChangeTokenError(errorDescription)) {
            const email = urlParams.get('email') || undefined;
            console.log(`🚨 Erro de email_change_token_current detectado para: ${email || 'usuário atual'}`);
            
            // Executar correção em background
            handleEmailChangeTokenError(errorDescription, email).then(fixed => {
              if (fixed) {
                console.log('✅ Correção de email_change_token_current aplicada com sucesso');
                setTimeout(() => {
                  window.location.reload();
                }, 2000);
              } else {
                console.log('❌ Correção de email_change_token_current falhou, redirecionando para login');
                setTimeout(() => {
                  navigate('/auth', { replace: true });
                }, 3000);
              }
            });
            
            setError('Corrigindo problema de token de mudança de email... Por favor, aguarde.');
            toast({
              title: "Corrigindo Problema de Token",
              description: "Detectamos um problema com o token de mudança de email. Corrigindo automaticamente...",
              variant: "default"
            });
            return;
          }
          
          // Tratar erro específico de confirmation_token
          if (errorDescription?.includes('confirmation_token') || 
              errorDescription?.includes('converting NULL to string')) {
            
            // Tentar corrigir automaticamente o problema
            const email = urlParams.get('email') || 'usuário';
            console.log(`🚨 Tentando corrigir confirmation_token NULL para: ${email}`);
            
            // Executar correção em background
            fixUserConfirmationTokenIssue(email).then(fixed => {
              if (fixed) {
                console.log('✅ Correção aplicada com sucesso');
                // Tentar login novamente após correção
                setTimeout(() => {
                  window.location.reload();
                }, 2000);
              } else {
                console.log('❌ Correção falhou, redirecionando para login');
              }
            });
            
            setError('Corrigindo problema de autenticação... Por favor, aguarde.');
            toast({
              title: "Corrigindo Problema",
              description: "Detectamos um problema na sua conta. Corrigindo automaticamente...",
              variant: "default"
            });
          } else {
            setError(decodeURIComponent(errorDescription || errorParam));
            toast({
              title: "Erro na autenticação",
              description: decodeURIComponent(errorDescription || errorParam),
              variant: "destructive"
            });
          }
          
          // Aguardar um pouco antes de redirecionar para o usuário ler a mensagem
          setTimeout(() => {
            navigate('/auth', { replace: true });
          }, 3000);
          return;
        }

        // Aguardar um pouco para garantir que o callback foi processado
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const { data, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Erro no callback de autenticação:', sessionError);
          
          // Tratar erro específico de email_change_token_current
          if (isEmailChangeTokenError(sessionError)) {
            // Obter email do usuário atual se possível
            const { data: { user } } = await supabase.auth.getUser();
            const email = user?.email;
            
            console.log(`🚨 Erro de email_change_token_current detectado para: ${email || 'usuário atual'}`);
            
            // Executar correção em background
            handleEmailChangeTokenError(sessionError, email).then(fixed => {
              if (fixed) {
                console.log('✅ Correção de email_change_token_current aplicada com sucesso');
                setTimeout(() => {
                  window.location.reload();
                }, 2000);
              } else {
                console.log('❌ Correção de email_change_token_current falhou, redirecionando para login');
                setTimeout(() => {
                  navigate('/auth', { replace: true });
                }, 3000);
              }
            });
            
            setError('Corrigindo problema de token de mudança de email... Por favor, aguarde.');
            toast({
              title: "Corrigindo Problema de Token",
              description: "Detectamos um problema com o token de mudança de email. Corrigindo automaticamente...",
              variant: "default"
            });
            return;
          }
          
          // Tratar erro específico de confirmation_token
          if (sessionError.message?.includes('confirmation_token') || 
              sessionError.message?.includes('converting NULL to string')) {
            
            // Obter email do usuário atual se possível
            const { data: { user } } = await supabase.auth.getUser();
            const email = user?.email || 'usuário';
            
            console.log(`🚨 Tentando corrigir confirmation_token NULL para: ${email}`);
            
            // Executar correção em background
            fixUserConfirmationTokenIssue(email).then(fixed => {
              if (fixed) {
                console.log('✅ Correção aplicada com sucesso');
                // Tentar login novamente após correção
                setTimeout(() => {
                  window.location.reload();
                }, 2000);
              } else {
                console.log('❌ Correção falhou, redirecionando para login');
              }
            });
            
            setError('Corrigindo problema de autenticação... Por favor, aguarde.');
            toast({
              title: "Corrigindo Problema",
              description: "Detectamos um problema na sua conta. Corrigindo automaticamente...",
              variant: "default"
            });
          } else {
            toast({
              title: "Erro na autenticação",
              description: sessionError.message || "Falha ao processar login com Google",
              variant: "destructive"
            });
          }
          
          setTimeout(() => {
            navigate('/auth', { replace: true });
          }, 3000);
          return;
        }

        if (data.session && data.session.user) {
          console.log('Usuário autenticado com sucesso:', data.session.user.email);
          toast({
            title: "Login realizado com sucesso",
            description: `Bem-vindo, ${data.session.user.email}!`
          });
          
          // Redirecionar para a página inicial
          navigate('/', { replace: true });
        } else {
          console.log('Nenhuma sessão encontrada, redirecionando para login');
          toast({
            title: "Sessão não encontrada",
            description: "Por favor, tente fazer login novamente",
            variant: "destructive"
          });
          setTimeout(() => {
            navigate('/auth', { replace: true });
          }, 2000);
        }
      } catch (error: unknown) {
        console.error('Erro inesperado no callback:', error);
        const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
        
        // Tratar erro específico de confirmation_token
        if (errorMessage.includes('confirmation_token') || 
            errorMessage.includes('converting NULL to string')) {
          
          // Obter email do usuário atual se possível
          const { data: { user } } = await supabase.auth.getUser();
          const email = user?.email || 'usuário';
          
          console.log(`🚨 Tentando corrigir confirmation_token NULL para: ${email}`);
          
          // Executar correção em background
          fixUserConfirmationTokenIssue(email).then(fixed => {
            if (fixed) {
              console.log('✅ Correção aplicada com sucesso');
              // Tentar login novamente após correção
              setTimeout(() => {
                window.location.reload();
              }, 2000);
            } else {
              console.log('❌ Correção falhou, redirecionando para login');
            }
          });
          
          setError('Corrigindo problema de autenticação... Por favor, aguarde.');
          toast({
            title: "Corrigindo Problema",
            description: "Detectamos um problema na sua conta. Corrigindo automaticamente...",
            variant: "default"
          });
        } else {
          toast({
            title: "Erro inesperado",
            description: "Ocorreu um erro durante a autenticação",
            variant: "destructive"
          });
        }
        
        setTimeout(() => {
          navigate('/auth', { replace: true });
        }, 3000);
      } finally {
        setIsProcessing(false);
      }
    };

    handleAuthCallback();
  }, [navigate, toast]);

  if (!isProcessing) {
    return null; // Componente será desmontado após redirecionamento
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center p-8">
        {error ? (
          <div className="max-w-md mx-auto">
            <div className="text-red-600 mb-4">
              <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold mb-2 text-gray-900">Erro na Autenticação</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <p className="text-sm text-gray-500">Redirecionando para a página de login...</p>
          </div>
        ) : (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold mb-2 text-gray-900">Autenticando...</h2>
            <p className="text-gray-600">Por favor, aguarde enquanto completamos o processo de login.</p>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthCallback;
