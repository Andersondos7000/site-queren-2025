import { createClient } from '@supabase/supabase-js';

// ✅ SUPABASE EM NUVEM - NUNCA USAR LOCAL
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('❌ Variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórias');
}

const customStorage = {
  getItem: (key: string) => localStorage.getItem(key),
  setItem: (key: string, value: string) => localStorage.setItem(key, value),
  removeItem: (key: string) => localStorage.removeItem(key),
};

const existingClient = typeof window !== 'undefined' ? (window as any).__supabaseClient : undefined;
export const supabase = existingClient || createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: customStorage,
    storageKey: 'supabase.auth.token',
    flowType: 'pkce',
  },
  global: {
    headers: {
      'X-Client-Info': 'borboleta-eventos-loja@1.0.0',
      'Accept': 'application/json',
      'apikey': supabaseAnonKey,
    },
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

if (typeof window !== 'undefined') {
  (window as any).__supabaseClient = supabase;
}

// Função para limpar todos os dados de autenticação
export const clearAuthData = () => {
  try {
    // Limpar localStorage
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('sb-') || key.includes('supabase') || key === 'supabase.auth.token') {
        localStorage.removeItem(key);
      }
    });
    
    // Limpar sessionStorage também
    Object.keys(sessionStorage).forEach(key => {
      if (key.startsWith('sb-') || key.includes('supabase')) {
        sessionStorage.removeItem(key);
      }
    });
    
    console.log('✅ Dados de autenticação limpos com sucesso');
  } catch (error) {
    console.warn('⚠️ Erro ao limpar dados de autenticação:', error);
  }
};

// Função para verificar e renovar token se necessário
export const ensureValidToken = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('❌ Erro ao obter sessão:', error);
      return false;
    }
    
    if (!session) {
      console.warn('⚠️ Nenhuma sessão ativa encontrada');
      return false;
    }
    
    const expiresAt = session.expires_at;
    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = expiresAt ? expiresAt - now : 0;
    
    // Se o token expira em menos de 2 minutos, fazer refresh
    if (timeUntilExpiry < 120) {
      console.log('🔄 Token próximo da expiração, fazendo refresh...');
      const { error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError) {
        console.error('❌ Erro ao fazer refresh do token:', refreshError);
        await handleAuthError(refreshError);
        return false;
      }
      
      console.log('✅ Token renovado com sucesso');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Erro ao verificar token:', error);
    return false;
  }
};

// Função para tratar erros de refresh token
export const handleAuthError = async (error: any) => {
  if (error?.message?.includes('Invalid Refresh Token') || 
      error?.message?.includes('Refresh Token Not Found')) {
    console.warn('🔄 Token de refresh inválido detectado, limpando sessão...');
    
    // Limpar dados de autenticação
    clearAuthData();
    
    // Fazer logout silencioso com scope local
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (signOutError) {
      console.warn('⚠️ Erro durante logout:', signOutError);
    }
    
    // Recarregar a página para resetar o estado
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }
};

// Enhanced error handling for auth state changes
let isRefreshing = false; // Flag para evitar múltiplos refreshes simultâneos

supabase.auth.onAuthStateChange(async (event, session) => {
  console.log('🔐 Auth state change:', event, session ? 'com sessão' : 'sem sessão');
  
  // Não processar eventos durante refresh para evitar loops
  if (isRefreshing && (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN')) {
    console.log('🔄 Ignorando evento durante refresh para evitar loop');
    return;
  }
  
  if (session && event !== 'TOKEN_REFRESHED') {
    // Verificar se o token está próximo da expiração
    const expiresAt = session.expires_at;
    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = expiresAt ? expiresAt - now : 0;
    
    console.log(`⏰ Token expira em ${timeUntilExpiry} segundos`);
    
    // Se o token expira em menos de 2 minutos (reduzido de 5 para evitar refresh prematuro)
    if (timeUntilExpiry < 120 && timeUntilExpiry > 0 && !isRefreshing) {
      console.log('🔄 Token próximo da expiração, tentando refresh...');
      isRefreshing = true;
      
      try {
        const { error } = await supabase.auth.refreshSession();
        if (error) {
          console.error('❌ Erro ao fazer refresh do token:', error);
          await handleAuthError(error);
        } else {
          console.log('✅ Token refreshed com sucesso');
        }
      } catch (error) {
        console.error('❌ Erro durante refresh do token:', error);
        await handleAuthError(error);
      } finally {
        isRefreshing = false;
      }
    }
  }
  
  if (event === 'SIGNED_OUT') {
    clearAuthData();
    isRefreshing = false;
  }
  
  // Tratar erros de token refresh
  if (event === 'TOKEN_REFRESHED' && !session) {
    console.warn('⚠️ Falha no refresh do token, limpando sessão...');
    clearAuthData();
    isRefreshing = false;
  }
  
  // Reset flag quando refresh é bem-sucedido
  if (event === 'TOKEN_REFRESHED' && session) {
    isRefreshing = false;
  }
});

// Interceptar erros globais do Supabase
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason?.message?.includes('Invalid Refresh Token') ||
        event.reason?.message?.includes('Refresh Token Not Found')) {
      event.preventDefault();
      handleAuthError(event.reason);
    }
  });

  // Interceptor para verificar token antes de requisições (otimizado)
  const originalFrom = supabase.from;
  supabase.from = function(table: string) {
    const query = originalFrom.call(this, table);
    
    // Interceptar métodos de query apenas quando necessário
    const originalSelect = query.select;
    const originalInsert = query.insert;
    const originalUpdate = query.update;
    const originalDelete = query.delete;
    
    // Função para verificar token apenas se necessário
    const checkTokenIfNeeded = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const now = Math.floor(Date.now() / 1000);
          const timeUntilExpiry = session.expires_at ? session.expires_at - now : 0;
          
          // Só verificar se o token expira em menos de 1 minuto
          if (timeUntilExpiry < 60 && timeUntilExpiry > 0) {
            await ensureValidToken();
          }
        }
      } catch (error) {
        console.warn('⚠️ Erro ao verificar token:', error);
      }
    };
    
    query.select = function(...args: any[]) {
      checkTokenIfNeeded().catch(console.warn);
      return originalSelect.apply(this, args);
    };
    
    query.insert = function(...args: any[]) {
      checkTokenIfNeeded().catch(console.warn);
      return originalInsert.apply(this, args);
    };
    
    query.update = function(...args: any[]) {
      checkTokenIfNeeded().catch(console.warn);
      return originalUpdate.apply(this, args);
    };
    
    query.delete = function(...args: any[]) {
      checkTokenIfNeeded().catch(console.warn);
      return originalDelete.apply(this, args);
    };
    
    return query;
  };
}

// ⚠️ IMPORTANTE: 
// - Cliente administrativo removido do frontend
// - Use apenas o MCP do Supabase para operações administrativas
// - O frontend deve usar apenas a chave anônima (anon key)
// - ✅ SUPABASE EM NUVEM - NUNCA USAR LOCAL
