import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { Loader2, CheckCircle, XCircle, ShieldAlert } from 'lucide-react';
import { validarCpf, formatarCpf, limparCpf } from "@/utils/cpfValidator";
import { useAuth } from '@/hooks/useAuth';

interface UserProfile {
  id: string;
  full_name: string | null;
  email: string;
  role: 'user' | 'admin' | 'organizer';
  phone: string | null;
  username: string | null;
  whatsapp: string | null;
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

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserUpdated: () => void;
  user: UserProfile | null;
}

interface UserFormData {
  full_name: string;
  email: string;
  role: 'user' | 'admin' | 'organizer';
  phone: string;
  username: string;
  whatsapp: string;
  person_type: 'fisica' | 'juridica' | '' | null;
  cpf: string;
  country: string;
  zip_code: string;
  address: string;
  address_number: string;
  neighborhood: string;
  city: string;
  state: string;
}

interface FormErrors {
  full_name?: string;
  email?: string;
  role?: string;
  phone?: string;
  username?: string;
  whatsapp?: string;
  person_type?: string;
  cpf?: string;
  country?: string;
  zip_code?: string;
  address?: string;
  address_number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
}

const EditUserModal: React.FC<EditUserModalProps> = ({ isOpen, onClose, onUserUpdated, user }) => {
  const [formData, setFormData] = useState<UserFormData>({
    full_name: '',
    email: '',
    role: 'user',
    phone: '',
    username: '',
    whatsapp: '',
    person_type: '',
    cpf: '',
    country: '',
    zip_code: '',
    address: '',
    address_number: '',
    neighborhood: '',
    city: '',
    state: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [cpfStatus, setCpfStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [isCurrentUserAdmin, setIsCurrentUserAdmin] = useState(false);
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  // Verificar se o usuário atual é administrador
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (currentUser) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', currentUser.id)
          .single();
        
        setIsCurrentUserAdmin(profile?.role === 'admin');
      }
    };
    
    checkAdminStatus();
  }, [currentUser]);

  // Preencher formulário quando usuário for selecionado
  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.full_name || '',
        email: user.email || '',
        role: user.role || 'user',
        phone: user.phone || '',
        username: user.username || '',
        whatsapp: user.whatsapp || '',
        person_type: user.person_type || '',
        cpf: user.cpf || '',
        country: user.country || '',
        zip_code: user.zip_code || '',
        address: user.address || '',
        address_number: user.address_number || '',
        neighborhood: user.neighborhood || '',
        city: user.city || '',
        state: user.state || ''
      });
    }
  }, [user]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.full_name.trim()) {
      newErrors.full_name = 'Nome é obrigatório';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email é obrigatório';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email inválido';
    }

    if (!formData.role) {
      newErrors.role = 'Tipo de usuário é obrigatório';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm() || !user) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Atualizar perfil do usuário
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: formData.full_name.trim(),
          email: formData.email.trim(),
          role: formData.role,
          phone: formData.phone.trim() || null,
          username: formData.username.trim() || null,
          whatsapp: formData.whatsapp.trim() || null,
          person_type: formData.person_type || null,
          cpf: formData.cpf.trim() || null,
          country: formData.country.trim() || null,
          zip_code: formData.zip_code.trim() || null,
          address: formData.address.trim() || null,
          address_number: formData.address_number.trim() || null,
          neighborhood: formData.neighborhood.trim() || null,
          city: formData.city.trim() || null,
          state: formData.state.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (profileError) {
        throw profileError;
      }

      // Se o email foi alterado, atualizar também no auth.users
      if (formData.email !== user.email) {
        const { error: authError } = await supabase.auth.admin.updateUserById(
          user.id,
          { email: formData.email.trim() }
        );

        if (authError) {
          console.warn('Erro ao atualizar email no auth:', authError);
          // Não falhar a operação por isso, apenas avisar
        }
      }

      toast({
        title: "Usuário atualizado com sucesso!",
        description: `Os dados de ${formData.full_name} foram atualizados.`,
        variant: "default",
      });

      onUserUpdated();
      onClose();

    } catch (error: unknown) {
      console.error('Erro ao atualizar usuário:', error);
      const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro inesperado. Tente novamente.';
      toast({
        title: "Erro ao atualizar usuário",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof UserFormData, value: string) => {
    // Formatação especial para CPF
    if (field === 'cpf') {
      const cpfFormatado = formatarCpf(value);
      setFormData(prev => ({ ...prev, [field]: cpfFormatado }));
      
      // Validar CPF em tempo real
      if (value.trim() === '') {
        setCpfStatus('idle');
      } else if (limparCpf(value).length >= 11) {
        const isValid = validarCpf(value);
        setCpfStatus(isValid ? 'valid' : 'invalid');
      } else {
        setCpfStatus('idle');
      }
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setErrors({});
      onClose();
    }
  };

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Usuário</DialogTitle>
          <DialogDescription>
            Edite os dados do usuário {user.full_name || user.email}.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Alerta para não-administradores */}
          {!isCurrentUserAdmin && (
            <Alert variant="destructive">
              <ShieldAlert className="h-4 w-4" />
              <AlertDescription>
                Você não possui permissão de administrador. Algumas funcionalidades estarão restritas.
              </AlertDescription>
            </Alert>
          )}

          {/* Informações Básicas */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Informações Básicas</h3>
            
            <div className="space-y-2">
              <Label htmlFor="full_name">Nome Completo *</Label>
              <Input
                id="full_name"
                type="text"
                placeholder="Nome completo"
                value={formData.full_name}
                onChange={(e) => handleInputChange('full_name', e.target.value)}
                disabled={isSubmitting}
                className={errors.full_name ? 'border-red-500' : ''}
              />
              {errors.full_name && (
                <p className="text-sm text-red-600">{errors.full_name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="usuario@exemplo.com"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                disabled={isSubmitting}
                className={errors.email ? 'border-red-500' : ''}
              />
              {errors.email && (
                <p className="text-sm text-red-600">{errors.email}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="role" className="flex items-center gap-2">
                  Tipo de Usuário *
                  {!isCurrentUserAdmin && (
                    <ShieldAlert className="h-4 w-4 text-amber-500" />
                  )}
                </Label>
                <Select 
                  value={formData.role} 
                  onValueChange={(value: 'user' | 'admin') => handleInputChange('role', value)}
                  disabled={isSubmitting || !isCurrentUserAdmin}
                >
                  <SelectTrigger className={errors.role ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Selecione o tipo de usuário" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Usuário Comum</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
                {!isCurrentUserAdmin && (
                  <p className="text-xs text-amber-600">Apenas administradores podem alterar este campo</p>
                )}
                {errors.role && (
                  <p className="text-sm text-red-600">{errors.role}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">Nome de Usuário</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="@usuario"
                  value={formData.username}
                  onChange={(e) => handleInputChange('username', e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          {/* Informações de Contato */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Informações de Contato</h3>
            
            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input
                id="whatsapp"
                type="tel"
                placeholder="(11) 99999-9999"
                value={formData.whatsapp}
                onChange={(e) => handleInputChange('whatsapp', e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="(11) 99999-9999"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="person_type">Tipo de Pessoa</Label>
                <Select 
                  value={formData.person_type ?? 'not_informed'} 
                  onValueChange={(value: 'fisica' | 'juridica' | 'not_informed') => {
                    const newValue = value === 'not_informed' ? '' : value;
                    handleInputChange('person_type', newValue);
                  }}
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_informed">Não informado</SelectItem>
                    <SelectItem value="fisica">Pessoa Física</SelectItem>
                    <SelectItem value="juridica">Pessoa Jurídica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cpf" className="flex items-center gap-2">
                CPF/CNPJ
                {cpfStatus === 'valid' && (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                )}
                {cpfStatus === 'invalid' && (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
              </Label>
              <Input
                id="cpf"
                type="text"
                placeholder="000.000.000-00"
                value={formData.cpf}
                onChange={(e) => handleInputChange('cpf', e.target.value)}
                disabled={isSubmitting}
                className={`${
                  cpfStatus === 'valid' ? 'border-green-500 focus:border-green-500' :
                  cpfStatus === 'invalid' ? 'border-red-500 focus:border-red-500' :
                  ''
                }`}
              />
              {cpfStatus === 'valid' && (
                <p className="text-sm text-green-600 mt-1">✓ CPF válido</p>
              )}
              {cpfStatus === 'invalid' && (
                <p className="text-sm text-red-600 mt-1">✗ CPF inválido</p>
              )}
            </div>
          </div>

          {/* Endereço */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Endereço</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="zip_code">CEP</Label>
                <Input
                  id="zip_code"
                  type="text"
                  placeholder="00000-000"
                  value={formData.zip_code}
                  onChange={(e) => handleInputChange('zip_code', e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="country">País</Label>
                <Input
                  id="country"
                  type="text"
                  placeholder="Brasil"
                  value={formData.country}
                  onChange={(e) => handleInputChange('country', e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="address">Endereço</Label>
                <Input
                  id="address"
                  type="text"
                  placeholder="Rua, Avenida..."
                  value={formData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address_number">Número</Label>
                <Input
                  id="address_number"
                  type="text"
                  placeholder="123"
                  value={formData.address_number}
                  onChange={(e) => handleInputChange('address_number', e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="neighborhood">Bairro</Label>
                <Input
                  id="neighborhood"
                  type="text"
                  placeholder="Centro"
                  value={formData.neighborhood}
                  onChange={(e) => handleInputChange('neighborhood', e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">Cidade</Label>
                <Input
                  id="city"
                  type="text"
                  placeholder="São Paulo"
                  value={formData.city}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="state">Estado</Label>
                <Input
                  id="state"
                  type="text"
                  placeholder="SP"
                  value={formData.state}
                  onChange={(e) => handleInputChange('state', e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>
          
          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-butterfly-orange hover:bg-butterfly-orange/90"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar Alterações'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditUserModal;