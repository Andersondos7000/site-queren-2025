import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Session } from '@supabase/supabase-js';

/**
 * Hook otimizado para gestão de tokens JWT baseado na documentação do Supabase
 * 
 * Funcionalidades:
 * - Auto-refresh automático de tokens
 * - Cache em memória para evitar requests desnecessários
 * - Validação de expiração local
 * - Recuperação automática de falhas de refresh
 * - Sincronização eficiente entre abas
 */
export function useJWTManager() {
  const tokenCacheRef = useRef<{
    accessToken: string | null;
    expiresAt: number | null;
    lastRefresh: number;
  }>({ 
    accessToken: null, 
    expiresAt: null, 
    lastRefresh: 0 
  });

  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);

  /**
   * Verifica se o token atual ainda é válido
   * Adiciona buffer de 30 segundos para evitar tokens expirando durante requests
   */
  const isTokenValid = useCallback((): boolean => {
    const { accessToken, expiresAt } = tokenCacheRef.current;
    
    if (!accessToken || !expiresAt) return false;
    
    const now = Math.floor(Date.now() / 1000);
    const bufferTime = 30; // 30 segundos de buffer
    
    return expiresAt > (now + bufferTime);
  }, []);

  /**
   * Extrai informações de expiração do JWT sem validação completa
   * Usado apenas para cache local - a validação real é feita pelo servidor
   */
  const extractTokenExpiry = useCallback((token: string): number | null => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp || null;
    } catch {
      return null;
    }
  }, []);

  /**
   * Atualiza o cache local com nova sessão
   */
  const updateTokenCache = useCallback((session: Session | null) => {
    if (session?.access_token) {
      const expiresAt = extractTokenExpiry(session.access_token);
      tokenCacheRef.current = {
        accessToken: session.access_token,
        expiresAt,
        lastRefresh: Math.floor(Date.now() / 1000)
      };
    } else {
      tokenCacheRef.current = {
        accessToken: null,
        expiresAt: null,
        lastRefresh: 0
      };
    }
  }, [extractTokenExpiry]);

  /**
   * Força refresh do token se necessário
   * Implementa debouncing para evitar múltiplos refreshes simultâneos
   */
  const refreshToken = useCallback(async (): Promise<string | null> => {
    // Se já existe um refresh em andamento, aguarda o resultado
    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    // Se o token ainda é válido, retorna o atual
    if (isTokenValid()) {
      return tokenCacheRef.current.accessToken;
    }

    // Inicia novo refresh
    refreshPromiseRef.current = (async () => {
      try {
        console.log('🔄 Refreshing JWT token...');
        
        const { data: { session }, error } = await supabase.auth.refreshSession();
        
        if (error) {
          console.error('❌ Token refresh failed:', error.message);
          
          // Se refresh falhar, tenta obter sessão atual
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          
          if (currentSession) {
            updateTokenCache(currentSession);
            return currentSession.access_token;
          }
          
          return null;
        }
        
        if (session) {
          updateTokenCache(session);
          console.log('✅ JWT token refreshed successfully');
          return session.access_token;
        }
        
        return null;
      } catch (error) {
        console.error('❌ Unexpected error during token refresh:', error);
        return null;
      } finally {
        // Limpa a promise de refresh
        refreshPromiseRef.current = null;
      }
    })();

    return refreshPromiseRef.current;
  }, [isTokenValid, updateTokenCache]);

  /**
   * Obtém token válido - refresh automático se necessário
   * Esta é a função principal que deve ser usada pela aplicação
   */
  const getValidToken = useCallback(async (): Promise<string | null> => {
    // Se token em cache é válido, retorna imediatamente
    if (isTokenValid()) {
      return tokenCacheRef.current.accessToken;
    }

    // Caso contrário, força refresh
    return refreshToken();
  }, [isTokenValid, refreshToken]);

  /**
   * Obtém headers de autorização prontos para uso
   */
  const getAuthHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const token = await getValidToken();
    
    if (!token) {
      return {};
    }

    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }, [getValidToken]);

  /**
   * Verifica se usuário está autenticado com token válido
   */
  const isAuthenticated = useCallback((): boolean => {
    return isTokenValid();
  }, [isTokenValid]);

  /**
   * Obtém informações do usuário do token atual (sem request ao servidor)
   */
  const getTokenClaims = useCallback((): Record<string, any> | null => {
    const { accessToken } = tokenCacheRef.current;
    
    if (!accessToken) return null;
    
    try {
      const payload = JSON.parse(atob(accessToken.split('.')[1]));
      return payload;
    } catch {
      return null;
    }
  }, []);

  // Configurar listeners para mudanças de autenticação
  useEffect(() => {
    // Listener para mudanças de estado de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔐 Auth state change:', event);
        
        switch (event) {
          case 'SIGNED_IN':
          case 'TOKEN_REFRESHED':
            updateTokenCache(session);
            break;
            
          case 'SIGNED_OUT':
            updateTokenCache(null);
            break;
            
          case 'USER_UPDATED':
            // Força refresh para obter claims atualizados
            if (session) {
              updateTokenCache(session);
            }
            break;
        }
      }
    );

    // Inicializar cache com sessão atual
    const initializeCache = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        updateTokenCache(session);
      } catch (error) {
        console.error('Failed to initialize JWT cache:', error);
      }
    };

    initializeCache();

    return () => {
      subscription.unsubscribe();
    };
  }, [updateTokenCache]);

  // Auto-refresh proativo baseado na expiração
  useEffect(() => {
    const setupAutoRefresh = () => {
      const { expiresAt } = tokenCacheRef.current;
      
      if (!expiresAt) return;
      
      const now = Math.floor(Date.now() / 1000);
      const timeUntilExpiry = expiresAt - now;
      
      // Refresh 2 minutos antes da expiração
      const refreshTime = Math.max(0, (timeUntilExpiry - 120) * 1000);
      
      if (refreshTime > 0) {
        const timeoutId = setTimeout(() => {
          console.log('🕐 Proactive token refresh triggered');
          refreshToken();
        }, refreshTime);
        
        return () => clearTimeout(timeoutId);
      }
    };

    return setupAutoRefresh();
  }, [refreshToken]);

  return {
    getValidToken,
    getAuthHeaders,
    isAuthenticated,
    getTokenClaims,
    refreshToken,
    
    // Informações de debug
    tokenInfo: {
      hasToken: !!tokenCacheRef.current.accessToken,
      expiresAt: tokenCacheRef.current.expiresAt,
      isValid: isTokenValid(),
      lastRefresh: tokenCacheRef.current.lastRefresh
    }
  };
}

/**
 * Hook simplificado para obter headers de autorização
 * Uso: const headers = useAuthHeaders();
 */
export function useAuthHeaders() {
  const { getAuthHeaders } = useJWTManager();
  return getAuthHeaders;
}

/**
 * Hook para verificar status de autenticação
 * Uso: const isAuth = useAuthStatus();
 */
export function useAuthStatus() {
  const { isAuthenticated } = useJWTManager();
  return isAuthenticated();
}