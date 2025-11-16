import { useContext, useCallback } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { rateLimitClient } from '@/lib/rateLimitClient';

/**
 * Hook para acessar o contexto de autenticação
 * Separado em arquivo próprio para compatibilidade com Fast Refresh
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

/**
 * Hook auxiliar para verificar e prevenir problemas de confirmation_token nulo
 * Deve ser usado após login com Google para garantir integridade dos dados
 * Inclui rate limiting para prevenir loops infinitos
 */
export const useAuthValidation = () => {
  const validateUserData = useCallback(async (userId: string) => {
    try {
      // Verificar rate limit antes de prosseguir
      const rateLimitResult = await rateLimitClient.checkRateLimit(userId, 'login');
      
      if (!rateLimitResult.allowed) {
        console.warn('🚫 Rate limit atingido para validação de usuário:', {
          userId,
          remaining: rateLimitResult.remaining,
          resetTime: new Date(rateLimitResult.resetTime).toISOString()
        });
        
        // Retornar erro específico para rate limit
        return {
          success: false,
          error: 'RATE_LIMIT_EXCEEDED',
          resetTime: rateLimitResult.resetTime,
          message: 'Muitas tentativas de validação. Tente novamente em alguns minutos.'
        };
      }

      // Como não temos acesso direto à tabela auth.users, vamos usar uma abordagem alternativa
      // Verificar se o usuário está com problemas através do próprio auth
      
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        console.warn('Erro ao verificar dados do usuário:', error);
        
        // Registrar tentativa falha no rate limiting
        await rateLimitClient.recordFailedAttempt(userId, 'login');
        
        return {
          success: false,
          error: 'USER_FETCH_ERROR',
          message: 'Erro ao verificar dados do usuário'
        };
      }

      // Se o email já está confirmado, não há problema
      if (user.email_confirmed_at) {
        console.log('✅ Email já confirmado, sem problemas de confirmation_token');
        
        // Reset rate limit em caso de sucesso
        await rateLimitClient.resetAttempts(userId, 'login');
        
        return {
          success: true,
          message: 'Usuário validado com sucesso'
        };
      }

      // Se chegou aqui, o email não está confirmado
      console.log('🚨 Email não confirmado detectado, tentando corrigir...');
      
      // Tentativa 1: Reenviar email de confirmação
      try {
        // Validar email antes de enviar
        if (!user.email || !user.email.includes('@') || user.email.trim() === '') {
          console.error('❌ Email do usuário inválido:', user.email);
          
          await rateLimitClient.recordFailedAttempt(userId, 'login');
          
          return {
            success: false,
            error: 'INVALID_EMAIL',
            message: 'Email do usuário é inválido'
          };
        }

        const cleanEmail = user.email.trim().toLowerCase();
        const { error: resendError } = await supabase.auth.resend({
          type: 'signup',
          email: cleanEmail,
        });

        if (!resendError) {
          console.log('✅ Email de confirmação reenviado com sucesso');
          
          // Reset rate limit em caso de sucesso
          await rateLimitClient.resetAttempts(userId, 'login');
          
          return {
            success: true,
            message: 'Email de confirmação reenviado com sucesso'
          };
        }
      } catch (resendError) {
        console.warn('Erro ao reenviar email:', resendError);
        await rateLimitClient.recordFailedAttempt(userId, 'login');
      }

      // Tentativa 2: Forçar atualização do perfil para disparar triggers
      try {
        const { error: updateError } = await supabase.auth.updateUser({
          data: { last_validation_check: new Date().toISOString() }
        });

        if (!updateError) {
          console.log('✅ Perfil atualizado, pode ter corrigido o problema');
          
          // Reset rate limit em caso de sucesso
          await rateLimitClient.resetAttempts(userId, 'login');
          
          return {
            success: true,
            message: 'Perfil atualizado com sucesso'
          };
        }
      } catch (updateError) {
        console.warn('Erro ao atualizar perfil:', updateError);
        await rateLimitClient.recordFailedAttempt(userId, 'login');
      }

      // Tentativa 3: Fazer logout e login novamente com scope local
      console.log('🔄 Tentando logout e login novamente...');
      await supabase.auth.signOut({ scope: 'local' });
      
      // Registrar tentativa falha antes do logout
      await rateLimitClient.recordFailedAttempt(userId, 'login');
      
      return {
        success: false,
        error: 'LOGOUT_REQUIRED',
        message: 'Necessário fazer login novamente'
      };
    } catch (error) {
      console.error('Erro na validação de dados do usuário:', error);
      
      // Registrar tentativa falha em caso de erro geral
      await rateLimitClient.recordFailedAttempt(userId, 'login');
      
      return {
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Erro interno na validação do usuário'
      };
    }
  }, []); // Array vazio de dependências para memoizar a função

  return { validateUserData };
};