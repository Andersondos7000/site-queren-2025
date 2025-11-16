import React from 'react';
import { useAuth } from '../../hooks/useAuth';

/**
 * Componente simples para testar a correção do confirmation_token nulo
 */
export const AuthTestComponent: React.FC = () => {
  const { user, signInWithGoogle } = useAuth();

  const handleTestLogin = async () => {
    console.log('🧪 Iniciando teste de login com Google...');
    try {
      await signInWithGoogle();
      console.log('✅ Login iniciado, aguardando callback...');
    } catch (error) {
      console.error('❌ Erro no teste de login:', error);
    }
  };

  return (
    <div className="p-4 bg-blue-50 rounded border border-blue-200">
      <h4 className="font-semibold text-blue-900 mb-2">🧪 Teste de Correção</h4>
      <p className="text-sm text-blue-700 mb-3">
        {user ? `Logado como: ${user.email}` : 'Nenhum usuário logado'}
      </p>
      <button
        onClick={handleTestLogin}
        className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
      >
        Testar Login Google
      </button>
      <p className="text-xs text-blue-600 mt-2">
        Use este botão para testar se o erro de confirmation_token foi resolvido
      </p>
    </div>
  );
};