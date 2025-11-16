import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { User, MapPin, Phone, Mail, Calendar, CreditCard, Edit } from 'lucide-react';

interface UserProfile {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  whatsapp: string | null;
  role: 'user' | 'admin' | 'organizer';
  created_at: string;
  // Campos do checkout
  person_type: 'fisica' | 'juridica' | null;
  cpf: string | null;
  country: string | null;
  zip_code: string | null;
  address: string | null;
  address_number: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
}

interface UserDetailsModalProps {
  user: UserProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (user: UserProfile) => void;
}

const UserDetailsModal: React.FC<UserDetailsModalProps> = ({ user, isOpen, onClose, onEdit }) => {
  if (!user) return null;

  const getRoleBadge = (role: string) => {
    const roleConfig = {
      admin: { label: 'Administrador', variant: 'destructive' as const },
      organizer: { label: 'Organizador', variant: 'default' as const },
      user: { label: 'Usuário', variant: 'secondary' as const }
    };
    
    const config = roleConfig[role as keyof typeof roleConfig] || roleConfig.user;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCPF = (cpf: string | null) => {
    if (!cpf) return 'Não informado';
    if (cpf.length === 11) {
      return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    if (cpf.length === 14) {
      return cpf.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    return cpf;
  };

  const formatZipCode = (zipCode: string | null) => {
    if (!zipCode) return 'Não informado';
    return zipCode.replace(/(\d{5})(\d{3})/, '$1-$2');
  };

  const getFullAddress = () => {
    const parts = [
      user.address,
      user.address_number,
      user.neighborhood,
      user.city,
      user.state
    ].filter(Boolean);
    
    return parts.length > 0 ? parts.join(', ') : 'Endereço não informado';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Detalhes do Usuário
            </DialogTitle>
            {onEdit && (
              <Button
                onClick={() => onEdit(user)}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Edit className="h-4 w-4" />
                Editar
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Informações Básicas */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Informações Básicas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Nome Completo</label>
                <p className="text-sm">
                  {user.full_name || 'Nome não informado'}
                </p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-500">Email</label>
                <p className="text-sm flex items-center gap-2">
                  <Mail className="h-3 w-3" />
                  {user.email}
                </p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-500">Telefone</label>
                <p className="text-sm flex items-center gap-2">
                  <Phone className="h-3 w-3" />
                  {user.phone || 'Não informado'}
                </p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-500">WhatsApp</label>
                <p className="text-sm flex items-center gap-2">
                  <Phone className="h-3 w-3" />
                  {user.whatsapp || 'Não informado'}
                </p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-500">Tipo de Usuário</label>
                <div className="mt-1">
                  {getRoleBadge(user.role)}
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-500">Data de Cadastro</label>
                <p className="text-sm flex items-center gap-2">
                  <Calendar className="h-3 w-3" />
                  {formatDate(user.created_at)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Informações Fiscais */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Informações Fiscais
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Tipo de Pessoa</label>
                <p className="text-sm">
                  {user.person_type === 'fisica' ? 'Pessoa Física' : 
                   user.person_type === 'juridica' ? 'Pessoa Jurídica' : 
                   'Não informado'}
                </p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-500">
                  {user.person_type === 'juridica' ? 'CNPJ' : 'CPF'}
                </label>
                <p className="text-sm">{formatCPF(user.cpf)}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-500">País</label>
                <p className="text-sm">{user.country || 'Não informado'}</p>
              </div>
            </CardContent>
          </Card>

          {/* Endereço */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Endereço
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">CEP</label>
                  <p className="text-sm">{formatZipCode(user.zip_code)}</p>
                </div>
                
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-500">Endereço Completo</label>
                  <p className="text-sm">{getFullAddress()}</p>
                </div>
              </div>
              
              <Separator />
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <label className="text-xs font-medium text-gray-400">Rua/Avenida</label>
                  <p>{user.address || 'Não informado'}</p>
                </div>
                
                <div>
                  <label className="text-xs font-medium text-gray-400">Número</label>
                  <p>{user.address_number || 'Não informado'}</p>
                </div>
                
                <div>
                  <label className="text-xs font-medium text-gray-400">Bairro</label>
                  <p>{user.neighborhood || 'Não informado'}</p>
                </div>
                
                <div>
                  <label className="text-xs font-medium text-gray-400">Cidade</label>
                  <p>{user.city || 'Não informado'}</p>
                </div>
              </div>
              
              <div>
                <label className="text-xs font-medium text-gray-400">Estado</label>
                <p className="text-sm">{user.state || 'Não informado'}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UserDetailsModal;