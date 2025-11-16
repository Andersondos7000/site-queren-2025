/**
 * Utilitários para corrigir problemas específicos com reauthentication_token
 * Este é um workaround para o erro: "converting NULL to string is unsupported" 
 * relacionado ao campo reauthentication_token na tabela auth.sessions
 */

import { supabase } from '@/lib/supabase';

/**
 * Corrige o problema de reauthentication_token NULL
 * Este erro ocorre quando o campo reauthentication_token está NULL
 * mas o sistema tenta convertê-lo para string durante operações de sessão
 */
export const fixReauthTokenNull = async (): Promise<boolean> => {
  try {
    console.log('🔧 Tentando corrigir reauthentication_token NULL');
    
    // Primeiro, obter o usuário atual
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('❌ Erro ao obter usuário atual:', userError);
      return false;
    }
    
    console.log(`🔍 Corrigindo para usuário: ${user.email}`);
    
    // Estratégia 1: Forçar refresh da sessão
    try {
      const { data: sessionData, error: refreshError } = await supabase.auth.refreshSession();
      
      if (!refreshError && sessionData?.session) {
        console.log('✅ Sessão atualizada com sucesso via refresh');
        return true;
      } else {
        console.warn('⚠️ Refresh da sessão não resolveu o problema:', refreshError);
      }
    } catch (refreshErr) {
      console.error('❌ Erro ao fazer refresh da sessão:', refreshErr);
    }
    
    // Estratégia 2: Limpar dados locais e forçar nova autenticação
    try {
      // Limpar storage local relacionado à autenticação
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const keysToRemove = [
        'supabase.auth.token',
        'sb-' + supabaseUrl.split('//')[1].split('.')[0] + '-auth-token'
      ];
      
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      });
      
      console.log('🧹 Cache de autenticação limpo');
      
      // Forçar uma nova sessão com scope local
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
      if (signOutError) {
        console.warn('⚠️ Erro ao fazer signOut:', signOutError);
      }
      
      console.log('✅ Usuário deslogado, nova autenticação necessária');
      return true;
      
    } catch (cleanupErr) {
      console.error('❌ Erro ao limpar dados de autenticação:', cleanupErr);
    }
    
    return false;
    
  } catch (error) {
    console.error('❌ Erro inesperado ao corrigir reauthentication_token:', error);
    return false;
  }
};

/**
 * Verifica se o usuário atual tem problemas de sessão relacionados ao reauthentication_token
 */
export const checkReauthTokenIssue = async (): Promise<boolean> => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      // Se há erro ao obter a sessão, pode ser o problema do reauthentication_token
      const errorMessage = error.message.toLowerCase();
      return errorMessage.includes('reauthentication_token') || 
             errorMessage.includes('converting null to string');
    }
    
    return false;
    
  } catch (error) {
    console.error('❌ Erro ao verificar problema de reauthentication_token:', error);
    return true; // Assumir que há problema se não conseguir verificar
  }
};

/**
 * Solução completa para problemas de reauthentication_token
 * Tenta múltiplas estratégias na ordem:
 * 1. Refresh da sessão atual
 * 2. Limpeza de cache e nova autenticação
 * 3. Reset completo do estado de autenticação
 */
export const fixReauthTokenIssueComplete = async (): Promise<{
  success: boolean;
  action: string;
  requiresReauth: boolean;
}> => {
  console.log('🚀 Iniciando correção completa do reauthentication_token');
  
  // Verificar se há problema
  const hasIssue = await checkReauthTokenIssue();
  if (!hasIssue) {
    return {
      success: true,
      action: 'no_issue_detected',
      requiresReauth: false
    };
  }
  
  // Tentar correção simples primeiro
  const simpleFixWorked = await fixReauthTokenNull();
  if (simpleFixWorked) {
    return {
      success: true,
      action: 'session_refreshed',
      requiresReauth: false
    };
  }
  
  // Se chegou aqui, precisa de nova autenticação
  try {
    // Limpar completamente o estado de autenticação
    await supabase.auth.signOut({ scope: 'local' });
    
    // Limpar todos os dados relacionados
    if (typeof window !== 'undefined') {
      localStorage.clear();
      sessionStorage.clear();
    }
    
    console.log('🔄 Estado de autenticação resetado completamente');
    
    return {
      success: true,
      action: 'full_reset',
      requiresReauth: true
    };
    
  } catch (error) {
    console.error('❌ Erro ao resetar estado de autenticação:', error);
    return {
      success: false,
      action: 'reset_failed',
      requiresReauth: true
    };
  }
};

/**
 * Hook para usar em componentes React para lidar automaticamente com o erro
 */
export const useReauthTokenFix = () => {
  const handleReauthError = async (error: any) => {
    if (error?.message?.includes('reauthentication_token') || 
        error?.message?.includes('converting NULL to string')) {
      
      console.log('🔧 Erro de reauthentication_token detectado, aplicando correção...');
      
      const result = await fixReauthTokenIssueComplete();
      
      if (result.requiresReauth) {
        // Redirecionar para página de login ou mostrar modal
        window.location.href = '/auth/login?reason=session_expired';
      }
      
      return result;
    }
    
    return null;
  };
  
  return { handleReauthError };
};