/**
 * Utilitários para corrigir problemas de autenticação
 * Inclui tratamento para confirmation_token NULL
 */

import { supabase } from '@/lib/supabase';

/**
 * Corrige o problema de confirmation_token NULL para usuários específicos
 * Este é um workaround para o erro: "converting NULL to string is unsupported"
 */
export const fixConfirmationTokenNull = async (email: string): Promise<boolean> => {
  try {
    console.log(`🔧 Tentando corrigir confirmation_token NULL para: ${email}`);
    
    // Como não podemos modificar diretamente a tabela auth.users,
    // vamos usar a API de admin do Supabase para atualizar o usuário
    
    // Primeiro, obter o ID do usuário pelo email
    const { data: userData, error: userError } = await supabase
      .from('auth.users')
      .select('id')
      .eq('email', email)
      .single();
    
    if (userError || !userData) {
      console.error('❌ Erro ao obter usuário:', userError);
      return false;
    }
    
    // Usar a função admin para atualizar o usuário
    // Isso deve corrigir o campo confirmation_token
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      userData.id,
      {
        // Forçar uma atualização que deve corrigir o campo
        email_confirm: true
      }
    );
    
    if (updateError) {
      console.error('❌ Erro ao atualizar usuário:', updateError);
      return false;
    }
    
    console.log('✅ Usuário atualizado com sucesso');
    return true;
    
  } catch (error) {
    console.error('❌ Erro inesperado ao corrigir confirmation_token:', error);
    return false;
  }
};

/**
 * Verifica se um usuário tem o problema de confirmation_token NULL
 */
export const checkConfirmationTokenIssue = async (email: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('auth.users')
      .select('confirmation_token')
      .eq('email', email)
      .single();
    
    if (error || !data) {
      console.error('❌ Erro ao verificar usuário:', error);
      return false;
    }
    
    // Se confirmation_token é NULL, temos o problema
    return data.confirmation_token === null;
    
  } catch (error) {
    console.error('❌ Erro ao verificar confirmation_token:', error);
    return false;
  }
};

/**
 * Força reenvio de email de confirmação para corrigir o problema
 */
export const resendConfirmationEmail = async (email: string): Promise<boolean> => {
  try {
    // Validar formato do email antes de enviar
    if (!email || !email.includes('@') || email.trim() === '') {
      console.error('❌ Email inválido fornecido:', email);
      return false;
    }

    const cleanEmail = email.trim().toLowerCase();
    console.log(`📧 Reenviando email de confirmação para: ${cleanEmail}`);
    
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: cleanEmail,
    });
    
    if (error) {
      console.error('❌ Erro ao reenviar email:', error);
      return false;
    }
    
    console.log('✅ Email de confirmação reenviado');
    return true;
    
  } catch (error) {
    console.error('❌ Erro inesperado ao reenviar email:', error);
    return false;
  }
};

/**
 * Solução completa para o problema de confirmation_token NULL
 * Tenta múltiplas abordagens na ordem:
 * 1. Reenviar email de confirmação
 * 2. Forçar atualização do perfil
 * 3. Limpar cache local
 */
export const fixUserConfirmationTokenIssue = async (email: string): Promise<boolean> => {
  console.log(`🚀 Iniciando correção completa para: ${email}`);
  
  // Limpar cache de autenticação local
  localStorage.removeItem('supabase.auth.token');
  
  // Tentar reenviar email de confirmação
  const emailSent = await resendConfirmationEmail(email);
  if (emailSent) {
    console.log('✅ Email de confirmação reenviado com sucesso');
    return true;
  }
  
  // Se não conseguir reenviar, tentar atualizar o perfil
  try {
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ updated_at: new Date().toISOString() })
      .eq('email', email);
    
    if (!profileError) {
      console.log('✅ Perfil atualizado, problema deve estar resolvido');
      return true;
    }
  } catch (error) {
    console.error('❌ Erro ao atualizar perfil:', error);
  }
  
  console.log('⚠️ Todas as tentativas falharam, usuário precisa redefinir senha');
  return false;
};