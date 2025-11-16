import React, { useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { useAuthValidation } from '@/hooks/useAuth';
import { AuthContext } from './AuthContext';
import { fixReauthTokenIssueComplete, checkReauthTokenIssue } from '@/utils/reauthTokenFix';
import { rateLimitClient } from '@/lib/rateLimitClient';
import { authGuards } from '@/utils/authGuards';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { validateUserData } = useAuthValidation();
  
  // Usar a instância singleton dos guards para prevenir reentrância

  // Função para tratar erros de autenticação, incluindo reauthentication_token
  const handleAuthError = async (error: any, context: string = '') => {
    // Usar guard para prevenir múltiplas execuções simultâneas
    return authGuards.startOperation('validate', async () => {
      console.error(`❌ Erro de autenticação${context ? ` em ${context}` : ''}:`, error);
      
      // Verificar se é erro relacionado ao reauthentication_token
      if (error?.message?.includes('reauthentication_token') || 
          error?.message?.includes('converting NULL to string')) {
        
        console.log('🔧 Erro de reauthentication_token detectado, aplicando correção...');
        
        try {
          const result = await fixReauthTokenIssueComplete();
          
          if (result.success) {
            if (result.requiresReauth) {
              toast({
                title: "Sessão expirada",
                description: "Sua sessão expirou. Por favor, faça login novamente.",
                variant: "destructive",
              });
              
              // Limpar estado local
              setUser(null);
              setSession(null);
              
              // Redirecionar para login após um breve delay
              setTimeout(() => {
                window.location.href = '/auth/login?reason=session_expired';
              }, 2000);
            } else {
              toast({
                title: "Sessão restaurada",
                description: "Problema de sessão corrigido automaticamente.",
              });
            }
            
            return true; // Erro tratado
          }
        } catch (fixError) {
          console.error('❌ Erro ao corrigir reauthentication_token:', fixError);
        }
      }
      
      return false; // Erro não tratado
    });
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event, session);
        
        try {
          if (session?.user) {
            setUser(session.user);
            setSession(session);
            
            // Validate user data when they sign in (only if email is not confirmed)
            if (event === 'SIGNED_IN' && session.user && !session.user.email_confirmed_at) {
              console.log('🔄 Usuário fez login com email não confirmado, validando dados...');
              try {
                // Usar setTimeout para evitar loop infinito
                setTimeout(async () => {
                  try {
                    await validateUserData(session.user.id);
                  } catch (error) {
                    console.error('❌ Erro na validação dos dados do usuário:', error);
                    await handleAuthError(error, 'validação de dados');
                  }
                }, 1000);
              } catch (error) {
                console.error('❌ Erro ao agendar validação:', error);
              }
            }
          } else {
            setUser(null);
            setSession(null);
          }
        } catch (error) {
          console.error('❌ Erro no listener de mudança de estado:', error);
          await handleAuthError(error, 'mudança de estado');
        }
        
        setLoading(false);
      }
    );

    // Verificar problemas de reauthentication_token na inicialização
    const checkInitialAuthState = async () => {
      try {
        const hasReauthIssue = await checkReauthTokenIssue();
        if (hasReauthIssue) {
          console.log('🔧 Problema de reauthentication_token detectado na inicialização');
          await handleAuthError({ message: 'reauthentication_token issue detected' }, 'inicialização');
        }
      } catch (error) {
        console.error('❌ Erro ao verificar estado inicial de autenticação:', error);
      }
    };

    checkInitialAuthState();

    return () => {
      subscription.unsubscribe();
    };
  }, []); // Removendo validateUserData das dependências para evitar loop infinito

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      
      // Verificar rate limiting antes da tentativa de login
      const rateLimitCheck = await rateLimitClient.checkRateLimit(email, 'login');
      
      if (!rateLimitCheck.allowed) {
        const waitTime = Math.ceil(rateLimitCheck.resetTime / 1000 / 60); // em minutos
        toast({
          title: "Muitas tentativas de login",
          description: `Aguarde ${waitTime} minutos antes de tentar novamente.`,
          variant: "destructive",
        });
        return { data: null, error: { message: 'Rate limit exceeded' } };
      }
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Erro no login:', error);
        
        // Registrar tentativa falhada no rate limiting
        await rateLimitClient.recordFailedAttempt(email, 'login');
        
        toast({
          title: "Erro no login",
          description: error.message,
          variant: "destructive",
        });
        return { data: null, error };
      }

      // Login bem-sucedido - resetar contador de tentativas
      await rateLimitClient.resetAttempts(email, 'login');

      toast({
        title: "Login realizado",
        description: "Bem-vindo de volta!",
      });

      return { data, error: null };
    } catch (error: any) {
      console.error('Erro inesperado no login:', error);
      
      // Registrar tentativa falhada em caso de erro inesperado
      try {
        await rateLimitClient.recordFailedAttempt(email, 'login');
      } catch (rateLimitError) {
        console.error('Erro ao registrar tentativa falhada:', rateLimitError);
      }
      
      toast({
        title: "Erro inesperado",
        description: "Ocorreu um erro durante o login. Tente novamente.",
        variant: "destructive",
      });
      return { data: null, error };
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, userData?: any) => {
    try {
      setLoading(true);
      
      // Verificar rate limiting para signup
      const rateLimitResult = await rateLimitClient.checkRateLimit(email, 'signup');
      if (!rateLimitResult.allowed) {
        const waitTime = Math.ceil(rateLimitResult.resetTime / 60000);
        toast({
          title: "Muitas tentativas de cadastro",
          description: `Aguarde ${waitTime} minutos antes de tentar novamente.`,
          variant: "destructive",
        });
        return { data: null, error: { message: 'Rate limit exceeded' } };
      }
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: userData
        }
      });

      if (error) {
        console.error('Erro no signup:', error);
        
        // Registrar tentativa falhada no rate limiting
        await rateLimitClient.recordFailedAttempt(email, 'signup');
        
        toast({
          title: "Erro no cadastro",
          description: error.message,
          variant: "destructive",
        });
        return { data: null, error };
      }

      // Signup bem-sucedido - resetar contador de tentativas
      await rateLimitClient.resetAttempts(email, 'signup');

      if (data.user && !data.user.email_confirmed_at) {
        toast({
          title: "Verifique seu email",
          description: "Enviamos um link de confirmação para seu email.",
        });
      }

      return { data, error: null };
    } catch (error: any) {
      console.error('Erro inesperado no signup:', error);
      
      // Registrar tentativa falhada em caso de erro inesperado
      try {
        await rateLimitClient.recordFailedAttempt(email, 'signup');
      } catch (rateLimitError) {
        console.error('Erro ao registrar tentativa falhada:', rateLimitError);
      }
      
      toast({
        title: "Erro inesperado",
        description: "Ocorreu um erro durante o cadastro. Tente novamente.",
        variant: "destructive",
      });
      return { data: null, error };
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      
      // Para Google OAuth, usar IP como identificador para rate limiting
      const userIdentifier = 'google_oauth_' + (window.navigator.userAgent || 'unknown');
      
      // Verificar rate limiting para Google OAuth
      const rateLimitResult = await rateLimitClient.checkRateLimit(userIdentifier, 'google_oauth');
      if (!rateLimitResult.allowed) {
        const waitTime = Math.ceil(rateLimitResult.resetTime / 60000);
        toast({
          title: "Muitas tentativas de login com Google",
          description: `Aguarde ${waitTime} minutos antes de tentar novamente.`,
          variant: "destructive",
        });
        return { data: null, error: { message: 'Rate limit exceeded' } };
      }
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      });

      if (error) {
        console.error('Erro no login com Google:', error);
        
        // Registrar tentativa falhada no rate limiting
        await rateLimitClient.recordFailedAttempt(userIdentifier, 'google_oauth');
        
        toast({
          title: "Erro no login",
          description: error.message,
          variant: "destructive",
        });
        return { data: null, error };
      }

      // Login com Google bem-sucedido - resetar contador de tentativas
      await rateLimitClient.resetAttempts(userIdentifier, 'google_oauth');

      return { data, error: null };
    } catch (error: any) {
      console.error('Erro inesperado no login com Google:', error);
      
      // Registrar tentativa falhada em caso de erro inesperado
      const userIdentifier = 'google_oauth_' + (window.navigator.userAgent || 'unknown');
      try {
        await rateLimitClient.recordFailedAttempt(userIdentifier, 'google_oauth');
      } catch (rateLimitError) {
        console.error('Erro ao registrar tentativa falhada:', rateLimitError);
      }
      
      toast({
        title: "Erro inesperado",
        description: "Ocorreu um erro durante o login. Tente novamente.",
        variant: "destructive",
      });
      return { data: null, error };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      
      // Usar scope local para evitar ERR_ABORTED e problemas de CORS
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      
      if (error) {
        console.error('Erro no logout:', error);
        toast({
          title: "Erro no logout",
          description: error.message,
          variant: "destructive",
        });
        return { error };
      }

      // Clear local state
      setUser(null);
      setSession(null);
      
      // Limpar dados de autenticação do localStorage/sessionStorage
      try {
        localStorage.removeItem('supabase.auth.token');
        sessionStorage.removeItem('supabase.auth.token');
        localStorage.removeItem('sb-ojxmfxbflbfinodkhixk-auth-token');
        sessionStorage.removeItem('sb-ojxmfxbflbfinodkhixk-auth-token');
      } catch (storageError) {
        console.warn('Aviso ao limpar storage:', storageError);
      }
      
      toast({
        title: "Logout realizado",
        description: "Você foi desconectado com sucesso.",
      });

      return { error: null };
    } catch (error: any) {
      console.error('Erro inesperado no logout:', error);
      
      // Em caso de erro, forçar limpeza local
      try {
        setUser(null);
        setSession(null);
        localStorage.removeItem('supabase.auth.token');
        sessionStorage.removeItem('supabase.auth.token');
        localStorage.removeItem('sb-ojxmfxbflbfinodkhixk-auth-token');
        sessionStorage.removeItem('sb-ojxmfxbflbfinodkhixk-auth-token');
      } catch (cleanupError) {
        console.warn('Erro na limpeza forçada:', cleanupError);
      }
      
      toast({
        title: "Logout realizado",
        description: "Sessão encerrada localmente.",
        variant: "default",
      });
      
      return { error: null }; // Retornar sucesso mesmo com erro, pois limpamos localmente
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    try {
      setLoading(true);
      
      // Verificar rate limiting para reset de senha
      const rateLimitResult = await rateLimitClient.checkRateLimit(email, 'reset_password');
      if (!rateLimitResult.allowed) {
        const waitTime = Math.ceil(rateLimitResult.resetTime / 60000);
        toast({
          title: "Muitas tentativas de reset",
          description: `Aguarde ${waitTime} minutos antes de tentar novamente.`,
          variant: "destructive",
        });
        return { data: null, error: { message: 'Rate limit exceeded' } };
      }
      
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        console.error('Erro no reset de senha:', error);
        
        // Registrar tentativa falhada no rate limiting
        await rateLimitClient.recordFailedAttempt(email, 'reset_password');
        
        toast({
          title: "Erro ao redefinir senha",
          description: error.message,
          variant: "destructive",
        });
        return { data: null, error };
      }

      // Reset de senha bem-sucedido - resetar contador de tentativas
      await rateLimitClient.resetAttempts(email, 'reset_password');

      toast({
        title: "Email enviado",
        description: "Verifique seu email para redefinir a senha.",
      });

      return { data, error: null };
    } catch (error: any) {
      console.error('Erro inesperado no reset de senha:', error);
      
      // Registrar tentativa falhada em caso de erro inesperado
      try {
        await rateLimitClient.recordFailedAttempt(email, 'reset_password');
      } catch (rateLimitError) {
        console.error('Erro ao registrar tentativa falhada:', rateLimitError);
      }
      
      toast({
        title: "Erro inesperado",
        description: "Ocorreu um erro ao tentar redefinir a senha.",
        variant: "destructive",
      });
      return { data: null, error };
    } finally {
      setLoading(false);
    }
  };

  const updatePassword = async (password: string) => {
    try {
      setLoading(true);
      
      // Para update de senha, usar o ID do usuário atual como identificador
      const userIdentifier = user?.id || 'anonymous';
      
      // Verificar rate limiting para atualização de senha
      const rateLimitResult = await rateLimitClient.checkRateLimit(userIdentifier, 'update_password');
      if (!rateLimitResult.allowed) {
        const waitTime = Math.ceil(rateLimitResult.resetTime / 60000);
        toast({
          title: "Muitas tentativas de atualização",
          description: `Aguarde ${waitTime} minutos antes de tentar novamente.`,
          variant: "destructive",
        });
        return { data: null, error: { message: 'Rate limit exceeded' } };
      }
      
      const { data, error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        console.error('Erro ao atualizar senha:', error);
        
        // Registrar tentativa falhada no rate limiting
        await rateLimitClient.recordFailedAttempt(userIdentifier, 'update_password');
        
        toast({
          title: "Erro ao atualizar senha",
          description: error.message,
          variant: "destructive",
        });
        return { data: null, error };
      }

      // Atualização de senha bem-sucedida - resetar contador de tentativas
      await rateLimitClient.resetAttempts(userIdentifier, 'update_password');

      toast({
        title: "Senha atualizada",
        description: "Sua senha foi atualizada com sucesso.",
      });

      return { data, error: null };
    } catch (error: any) {
      console.error('Erro inesperado ao atualizar senha:', error);
      
      // Registrar tentativa falhada em caso de erro inesperado
      const userIdentifier = user?.id || 'anonymous';
      try {
        await rateLimitClient.recordFailedAttempt(userIdentifier, 'update_password');
      } catch (rateLimitError) {
        console.error('Erro ao registrar tentativa falhada:', rateLimitError);
      }
      
      toast({
        title: "Erro inesperado",
        description: "Ocorreu um erro ao atualizar a senha.",
        variant: "destructive",
      });
      return { data: null, error };
    } finally {
      setLoading(false);
    }
  };

  const updateUserRole = async (userId: string, role: string) => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('user_roles')
        .upsert({ 
          user_id: userId, 
          role: role,
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Erro ao atualizar role do usuário:', error);
        toast({
          title: "Erro ao atualizar permissões",
          description: error.message,
          variant: "destructive",
        });
        return { data: null, error };
      }

      toast({
        title: "Permissões atualizadas",
        description: `Usuário agora tem o papel: ${role}`,
      });

      return { data, error: null };
    } catch (error: any) {
      console.error('Erro inesperado ao atualizar role:', error);
      toast({
        title: "Erro inesperado",
        description: "Ocorreu um erro ao atualizar as permissões.",
        variant: "destructive",
      });
      return { data: null, error };
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = () => {
    if (!user?.user_metadata) return false;
    return user.user_metadata.role === 'admin' || user.user_metadata.is_admin === true;
  };

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    resetPassword,
    updatePassword,
    updateUserRole,
    isAdmin,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};