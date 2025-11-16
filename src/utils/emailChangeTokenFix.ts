/**
 * Utilitários para corrigir problemas específicos com email_change_token_current
 * Este é um workaround para o erro: "converting NULL to string is unsupported" 
 * relacionado ao campo email_change_token_current na tabela auth.users
 */

import { supabase } from '@/lib/supabase';

/**
 * Corrige o problema de email_change_token_current NULL
 * Este erro ocorre quando o campo email_change_token_current está NULL
 * mas o sistema tenta convertê-lo para string
 */
export const fixEmailChangeTokenNull = async (email?: string): Promise<boolean> => {
  try {
    console.log(`🔧 Tentando corrigir email_change_token_current NULL para: ${email || 'usuário atual'}`);
    
    // Primeiro, tentar obter o usuário atual
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error('❌ Erro ao obter usuário atual:', userError);
      return false;
    }
    
    const targetEmail = email || user.email;
    if (!targetEmail) {
      console.error('❌ Email não disponível para correção');
      return false;
    }
    
    // Tentar forçar uma atualização do perfil do usuário
    // Isso pode ajudar a limpar campos NULL problemáticos
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          // Forçar uma pequena atualização que pode limpar o estado
          last_fix_attempt: new Date().toISOString()
        }
      });
      
      if (updateError) {
        console.error('❌ Erro ao atualizar dados do usuário:', updateError);
      } else {
        console.log('✅ Dados do usuário atualizados com sucesso');
        return true;
      }
    } catch (updateErr) {
      console.error('❌ Erro inesperado ao atualizar usuário:', updateErr);
    }
    
    // Se a atualização falhar, tentar limpar a sessão e reautenticar
    console.log('🔄 Tentando limpar sessão e reautenticar...');
    
    // Limpar dados de autenticação local
    localStorage.removeItem('supabase.auth.token');
    sessionStorage.clear();
    
    // Fazer logout para limpar o estado
    await supabase.auth.signOut();
    
    console.log('✅ Sessão limpa, usuário precisa fazer login novamente');
    return true;
    
  } catch (error) {
    console.error('❌ Erro inesperado ao corrigir email_change_token_current:', error);
    return false;
  }
};

/**
 * Verifica se o erro atual está relacionado ao email_change_token_current
 */
export const isEmailChangeTokenError = (error: any): boolean => {
  if (!error) return false;
  
  const errorMessage = typeof error === 'string' ? error : error.message || '';
  
  return errorMessage.includes('email_change_token_current') ||
         (errorMessage.includes('converting NULL to string') && 
          errorMessage.includes('email_change'));
};

/**
 * Solução completa para problemas relacionados ao email_change_token_current
 * Tenta múltiplas abordagens:
 * 1. Atualizar dados do usuário para limpar estado NULL
 * 2. Limpar cache local de autenticação
 * 3. Forçar logout e reautenticação
 */
export const fixEmailChangeTokenIssue = async (email?: string): Promise<boolean> => {
  console.log(`🚀 Iniciando correção completa para email_change_token_current: ${email || 'usuário atual'}`);
  
  // Tentar a correção principal
  const fixed = await fixEmailChangeTokenNull(email);
  
  if (fixed) {
    console.log('✅ Problema de email_change_token_current corrigido');
    return true;
  }
  
  console.log('⚠️ Não foi possível corrigir automaticamente, usuário precisa fazer login novamente');
  return false;
};

/**
 * Middleware para interceptar e tratar erros de email_change_token_current
 */
export const handleEmailChangeTokenError = async (error: any, email?: string): Promise<boolean> => {
  if (!isEmailChangeTokenError(error)) {
    return false; // Não é um erro que podemos tratar
  }
  
  console.log('🚨 Erro de email_change_token_current detectado, aplicando correção...');
  
  const fixed = await fixEmailChangeTokenIssue(email);
  
  if (fixed) {
    // Aguardar um pouco antes de tentar novamente
    await new Promise(resolve => setTimeout(resolve, 1000));
    return true;
  }
  
  return false;
};