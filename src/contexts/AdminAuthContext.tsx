import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

type AdminAuthContextType = {
  isAdminLoggedIn: boolean;
  adminLoginTime: Date | null;
  loginAsAdmin: (password: string) => Promise<boolean>;
  logoutAdmin: () => void;
  checkAdminSession: () => boolean;
  isAdminSessionValid: () => boolean;
};

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

const ADMIN_PASSWORD = 'Sampa150300$';
const ADMIN_SESSION_KEY = 'admin_session';
const SESSION_DURATION = 2 * 60 * 60 * 1000; // 2 horas em milliseconds (aumentado para melhor UX)

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);
  const [adminLoginTime, setAdminLoginTime] = useState<Date | null>(null);

  // Verificar sessão admin existente ao carregar
  useEffect(() => {
    const savedSession = localStorage.getItem(ADMIN_SESSION_KEY);
    if (savedSession) {
      try {
        const sessionData = JSON.parse(savedSession);
        const loginTime = new Date(sessionData.loginTime);
        const now = new Date();
        
        // Verificar se a sessão ainda é válida
        if (now.getTime() - loginTime.getTime() < SESSION_DURATION) {
          setIsAdminLoggedIn(true);
          setAdminLoginTime(loginTime);
          console.log('🔐 Sessão admin restaurada:', {
            loginTime: loginTime.toISOString(),
            remainingTime: Math.round((SESSION_DURATION - (now.getTime() - loginTime.getTime())) / 1000 / 60) + ' minutos'
          });
        } else {
          // Sessão expirada, limpar
          console.log('🔐 Sessão admin expirada, limpando...');
          localStorage.removeItem(ADMIN_SESSION_KEY);
        }
      } catch (error) {
        console.error('Erro ao carregar sessão admin:', error);
        localStorage.removeItem(ADMIN_SESSION_KEY);
      }
    }
  }, []);

  // Auto-logout quando a sessão expira
  useEffect(() => {
    if (isAdminLoggedIn && adminLoginTime) {
      const timeoutId = setTimeout(() => {
        logoutAdmin();
      }, SESSION_DURATION - (new Date().getTime() - adminLoginTime.getTime()));

      return () => clearTimeout(timeoutId);
    }
  }, [isAdminLoggedIn, adminLoginTime]);

  const loginAsAdmin = async (password: string): Promise<boolean> => {
    // Simular verificação de senha
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    if (password === ADMIN_PASSWORD) {
      const loginTime = new Date();
      setIsAdminLoggedIn(true);
      setAdminLoginTime(loginTime);
      
      // Salvar sessão no localStorage
      localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({
        loginTime: loginTime.toISOString(),
        isLoggedIn: true
      }));
      
      // Tentar atualizar role do usuário para 'admin' na tabela profiles (se houver usuário logado)
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          const { error } = await supabase
            .from('profiles')
            .update({ role: 'admin' })
            .eq('id', user.id);
          
          if (error) {
            console.error('Erro ao atualizar role para admin:', error);
            // Não falha o login por causa disso, mas loga o erro
          } else {
            console.log('Role atualizado para admin com sucesso');
          }
        } else {
          console.log('Nenhum usuário Supabase logado - sessão administrativa criada apenas localmente');
        }
      } catch (error) {
        console.error('Erro ao obter usuário atual:', error);
        console.log('Continuando com sessão administrativa local');
      }
      
      return true;
    }
    
    return false;
  };

  const logoutAdmin = async () => {
    // Limpar estado do contexto
    setIsAdminLoggedIn(false);
    setAdminLoginTime(null);
    
    // Remover sessão do localStorage
    localStorage.removeItem(ADMIN_SESSION_KEY);
    
    // Limpar qualquer cache relacionado ao admin
    localStorage.removeItem('admin_cache');
    localStorage.removeItem('admin_preferences');
    
    // Tentar revogar role de admin no banco de dados (se houver usuário logado)
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { error } = await supabase
          .from('profiles')
          .update({ role: 'user' })
          .eq('id', user.id);
        
        if (error) {
          console.error('Erro ao revogar role admin:', error);
        } else {
          console.log('Role revogado para user com sucesso');
        }
      } else {
        console.log('Nenhum usuário Supabase logado - apenas limpando sessão administrativa local');
      }
    } catch (error) {
      console.error('Erro ao obter usuário atual para revogar role:', error);
      console.log('Continuando com limpeza da sessão administrativa local');
    }
    
    // Forçar redirecionamento para página inicial
    if (window.location.pathname.startsWith('/admin')) {
      window.location.href = '/';
    }
    
    // Recarregar a página atual para garantir limpeza completa do estado
    if (window.location.pathname === '/perfil') {
      window.location.reload();
    }
    
    console.log('🔐 Acesso administrativo revogado completamente');
  };

  // Versão read-only para verificação durante renderização
  const isAdminSessionValid = (): boolean => {
    if (!isAdminLoggedIn || !adminLoginTime) {
      return false;
    }
    
    const now = new Date();
    const sessionAge = now.getTime() - adminLoginTime.getTime();
    
    return sessionAge < SESSION_DURATION;
  };

  // Versão com side-effects para uso em useEffect ou handlers
  const checkAdminSession = (): boolean => {
    if (!isAdminLoggedIn || !adminLoginTime) {
      return false;
    }
    
    const now = new Date();
    const sessionAge = now.getTime() - adminLoginTime.getTime();
    
    if (sessionAge >= SESSION_DURATION) {
      console.log('🔐 Sessão admin expirou, fazendo logout automático');
      // Usar setTimeout para evitar setState durante renderização
      setTimeout(() => logoutAdmin(), 0);
      return false;
    }
    
    // Renovar sessão se estiver próxima do vencimento (últimos 30 minutos)
    const timeUntilExpiry = SESSION_DURATION - sessionAge;
    if (timeUntilExpiry < 30 * 60 * 1000) { // 30 minutos
      // Usar setTimeout para evitar setState durante renderização
      setTimeout(() => {
        const newLoginTime = new Date();
        setAdminLoginTime(newLoginTime);
        localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify({
          loginTime: newLoginTime.toISOString(),
          isLoggedIn: true
        }));
        console.log('🔐 Sessão admin renovada automaticamente');
      }, 0);
    }
    
    return true;
  };

  const value = {
    isAdminLoggedIn,
    adminLoginTime,
    loginAsAdmin,
    logoutAdmin,
    checkAdminSession,
    isAdminSessionValid,
  };

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => {
  const context = useContext(AdminAuthContext);
  if (context === undefined) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
};

export default AdminAuthProvider;