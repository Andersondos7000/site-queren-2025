import React, { useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, LogOut } from 'lucide-react';
import { supabase, clearAuthData } from '@/lib/supabase';

interface AuthErrorNotificationProps {
  error?: Error | null;
  onDismiss?: () => void;
}

const AuthErrorNotification: React.FC<AuthErrorNotificationProps> = ({ 
  error, 
  onDismiss 
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (error?.message?.includes('Invalid Refresh Token') || 
        error?.message?.includes('Refresh Token Not Found')) {
      setIsVisible(true);
    }
  }, [error]);

  const handleRetry = async () => {
    setIsLoading(true);
    try {
      // Tentar obter a sessão atual
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        // Se não há sessão válida, limpar dados e redirecionar
        clearAuthData();
        window.location.href = '/auth';
      } else {
        // Se há sessão válida, recarregar a página
        window.location.reload();
      }
    } catch (err) {
      console.error('Erro ao tentar recuperar sessão:', err);
      clearAuthData();
      window.location.href = '/auth';
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      // Usar scope local para evitar ERR_ABORTED
      await supabase.auth.signOut({ scope: 'local' });
      clearAuthData();
      window.location.href = '/auth';
    } catch (err) {
      console.error('Erro durante logout:', err);
      // Mesmo com erro, limpar dados locais e redirecionar
      clearAuthData();
      window.location.href = '/auth';
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  if (!isVisible) return null;

  return (
    <div className="fixed top-4 right-4 z-50 w-96 animate-in slide-in-from-right-full">
      <Alert className="border-destructive bg-destructive/10">
        <AlertTriangle className="h-4 w-4 text-destructive" />
        <AlertTitle className="text-destructive">
          Sessão Expirada
        </AlertTitle>
        <AlertDescription className="mt-2 space-y-3">
          <p className="text-sm text-muted-foreground">
            Sua sessão de autenticação expirou. Isso pode acontecer após um período 
            de inatividade ou quando os tokens de segurança precisam ser renovados.
          </p>
          
          <div className="flex gap-2">
            <Button 
              size="sm" 
              variant="outline"
              onClick={handleRetry}
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? (
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3 mr-1" />
              )}
              Tentar Novamente
            </Button>
            
            <Button 
              size="sm" 
              variant="destructive"
              onClick={handleLogout}
              disabled={isLoading}
              className="flex-1"
            >
              <LogOut className="h-3 w-3 mr-1" />
              Fazer Login
            </Button>
          </div>
          
          <Button 
            size="sm" 
            variant="ghost"
            onClick={handleDismiss}
            className="w-full text-xs"
          >
            Dispensar
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default AuthErrorNotification;