import { supabase, clearAuthData } from '../lib/supabase';

/**
 * Utilitários para testar o tratamento de erros de autenticação
 */

/**
 * Simula um erro de refresh token inválido
 */
export const simulateInvalidRefreshToken = () => {
  // Corromper o token no localStorage
  const corruptedToken = {
    access_token: 'invalid_token',
    refresh_token: 'invalid_refresh_token',
    expires_at: Date.now() - 1000, // Token expirado
    token_type: 'bearer',
    user: null
  };
  
  localStorage.setItem('supabase.auth.token', JSON.stringify(corruptedToken));
  
  console.log('🧪 Token corrompido inserido no localStorage');
  console.log('🔄 Tente fazer uma operação que requer autenticação para ver o erro');
};

/**
 * Força um erro de refresh token fazendo uma requisição com token inválido
 */
export const forceRefreshTokenError = async () => {
  try {
    // Primeiro, corromper o token
    simulateInvalidRefreshToken();
    
    // Tentar fazer uma operação que requer autenticação
    const { data, error } = await supabase.auth.getUser();
    
    if (error) {
      console.log('✅ Erro de refresh token simulado com sucesso:', error.message);
      return error;
    }
    
    console.log('⚠️ Erro não foi gerado como esperado');
    return null;
  } catch (error) {
    console.log('✅ Erro capturado:', error);
    return error;
  }
};

/**
 * Limpa todos os dados de autenticação para teste
 */
export const clearAllAuthData = () => {
  clearAuthData();
  console.log('🧹 Todos os dados de autenticação foram limpos');
};

/**
 * Verifica o estado atual da autenticação
 */
export const checkAuthState = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    console.log('🔍 Estado da autenticação:');
    console.log('- Sessão:', session ? 'Ativa' : 'Inativa');
    console.log('- Erro:', error?.message || 'Nenhum');
    
    if (session) {
      console.log('- Usuário:', session.user?.email);
      console.log('- Expira em:', new Date(session.expires_at! * 1000));
    }
    
    return { session, error };
  } catch (error) {
    console.error('❌ Erro ao verificar estado da autenticação:', error);
    return { session: null, error };
  }
};

/**
 * Testa o fluxo completo de tratamento de erro
 */
export const testAuthErrorFlow = async () => {
  console.log('🧪 Iniciando teste do fluxo de erro de autenticação...');
  
  // 1. Verificar estado inicial
  console.log('\n1. Estado inicial:');
  await checkAuthState();
  
  // 2. Simular erro
  console.log('\n2. Simulando erro de refresh token...');
  await forceRefreshTokenError();
  
  // 3. Verificar estado após erro
  console.log('\n3. Estado após erro:');
  await checkAuthState();
  
  console.log('\n✅ Teste concluído. Verifique o console e a UI para ver o tratamento do erro.');
};

// Expor funções globalmente para teste no console do navegador
if (typeof window !== 'undefined') {
  (window as unknown as { authTestUtils: Record<string, unknown> }).authTestUtils = {
    simulateInvalidRefreshToken,
    forceRefreshTokenError,
    clearAllAuthData,
    checkAuthState,
    testAuthErrorFlow,
  };
  
  console.log('🔧 Utilitários de teste de autenticação disponíveis em window.authTestUtils');
}