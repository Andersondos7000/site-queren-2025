import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { enableScrollOnNextNavigation } from '@/hooks/useScrollToTop';

interface AdminAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AdminAccessModal: React.FC<AdminAccessModalProps> = ({ isOpen, onClose }) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { loginAsAdmin } = useAdminAuth();

  // Senha administrativa (em produção, isso deveria vir de variáveis de ambiente)
  const ADMIN_PASSWORD = 'Sampa150300$';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Fazer login administrativo através do contexto
      const success = await loginAsAdmin(password);
      
      if (success) {
        // Fechar modal e navegar para o painel admin
        handleClose();
        enableScrollOnNextNavigation();
        navigate('/admin');
      } else {
        setError('Senha administrativa incorreta');
      }
    } catch (err) {
      setError('Erro ao verificar credenciais');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setPassword('');
    setError('');
    setShowPassword(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-butterfly-orange" />
            Acesso Administrativo
          </DialogTitle>
          <DialogDescription>
            Digite a senha administrativa para acessar o painel de controle.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="admin-password">Senha Administrativa</Label>
            <div className="relative">
              <Input
                id="admin-password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                className="w-full pr-10"
                autoFocus
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                onClick={() => setShowPassword(!showPassword)}
                disabled={isLoading}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                ) : (
                  <Eye className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                )}
              </button>
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading || !password}
              className="bg-butterfly-orange hover:bg-butterfly-orange/90"
            >
              {isLoading ? 'Verificando...' : 'Acessar Painel'}
            </Button>
          </div>
        </form>

        <div className="text-center text-sm text-muted-foreground mt-4">
          <p>⚠️ Acesso restrito apenas a administradores autorizados</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminAccessModal;