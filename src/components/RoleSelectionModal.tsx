import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface RoleSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRoleSelect?: (role: string) => void;
}

const RoleSelectionModal: React.FC<RoleSelectionModalProps> = ({ isOpen, onClose, onRoleSelect }) => {
  const [selectedRole, setSelectedRole] = useState<string>('user');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { updateUserRole } = useAuth();

  const handleSubmit = async () => {
    if (!selectedRole) return;
    
    setIsSubmitting(true);
    try {
      if (onRoleSelect) {
        // Para cadastro com Google - chama a função de callback
        await onRoleSelect(selectedRole);
      } else {
        // Para atualização de perfil existente
        await updateUserRole(selectedRole);
        onClose();
      }
    } catch (error) {
      console.error('Erro ao processar role:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Selecione seu tipo de usuário</DialogTitle>
          <DialogDescription>
            Para completar seu cadastro, selecione qual tipo de usuário você é.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">
              Tipo de usuário
            </label>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo de usuário" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Usuário Comum</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
                <SelectItem value="organizer">Organizador</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !selectedRole}
              className="bg-butterfly-orange hover:bg-butterfly-orange/90"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Confirmar'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RoleSelectionModal;