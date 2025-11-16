import { ReactNode, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAuth?: boolean;
  requireAdmin?: boolean;
}

export const ProtectedRoute = ({ children, requireAuth = true, requireAdmin = false }: ProtectedRouteProps) => {
  const { user, loading, isAdmin } = useAuth();
  const { isAdminLoggedIn, checkAdminSession, isAdminSessionValid } = useAdminAuth();
  const location = useLocation();
  const [adminLoading, setAdminLoading] = useState(requireAdmin);
  const [isUserAdmin, setIsUserAdmin] = useState(false);
  // Verificar se o usuário tem acesso de administrador válido (sem side-effects)
  const hasValidAdminSession = isAdminLoggedIn && isAdminSessionValid();

  // Verificar se usuário é admin quando necessário
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (requireAdmin) {
        // Se não há usuário ou ainda está carregando, não fazer nada
        if (!user || loading) {
          return;
        }

        try {
          // Verificar tanto o role no banco quanto a sessão admin ativa
          const hasAdminRole = await isAdmin();
          const hasActiveAdminSession = isAdminSessionValid();
          
          // Usuário precisa ter role admin E sessão admin ativa
          const isValidAdmin = hasAdminRole && hasActiveAdminSession;
          setIsUserAdmin(isValidAdmin);
          
          console.log('🔍 Verificação admin:', {
            hasAdminRole,
            hasActiveAdminSession,
            isValidAdmin
          });
        } catch (error) {
          console.error('Erro ao verificar status admin:', error);
          setIsUserAdmin(false);
        } finally {
          setAdminLoading(false);
        }
      } else if (!requireAdmin && !loading) {
        // Se não requer admin, parar o loading
        setAdminLoading(false);
      }
    };

    checkAdminStatus();
  }, [requireAdmin, user, loading, isAdmin, isAdminLoggedIn, checkAdminSession]);

  // Mostrar loading enquanto verifica autenticação ou permissões admin
  if (loading || adminLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">
            {loading ? 'Verificando autenticação...' : 'Verificando permissões...'}
          </p>
        </div>
      </div>
    );
  }

  // Se requer autenticação e usuário não está logado, redirecionar para login
  if (requireAuth && !user) {
    // Se é uma rota admin, redirecionar para login admin
    const loginPath = location.pathname.startsWith('/admin') ? '/admin/login' : '/auth';
    return (
      <Navigate 
        to={loginPath} 
        state={{ from: location.pathname }} 
        replace 
      />
    );
  }

  // Verificar se é uma rota que requer admin
  if (requireAdmin) {
    console.log('🔐 Verificação de admin:', {
      hasValidAdminSession,
      currentPath: location.pathname
    });
    
    // Para acesso administrativo, apenas a sessão administrativa é necessária
    if (!hasValidAdminSession) {
      console.log('❌ Acesso negado - redirecionando para /admin/login');
      return <Navigate to="/admin/login" replace />;
    }
  }

  // Se não requer autenticação ou usuário está logado (e é admin se necessário), renderizar children
  return <>{children}</>;
};

export default ProtectedRoute;