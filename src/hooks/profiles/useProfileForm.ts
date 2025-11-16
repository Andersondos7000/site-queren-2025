import { useState, useCallback, useEffect } from 'react';
import { z } from 'zod';
import { supabase } from '../../lib/supabase';
import { useOfflineQueue } from '../realtime/useOfflineQueue';
import { useNetworkStatus } from '../useNetworkStatus';
import type { Profile } from '../../types/profile';

// Schema de validação Zod para perfis
const profileSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(255, 'Nome muito longo'),
  email: z.string().email('Email inválido').max(255, 'Email muito longo'),
  phone: z.string().optional().refine(
    (val) => !val || /^\(?\d{2}\)?[\s-]?\d{4,5}[\s-]?\d{4}$/.test(val),
    'Formato de telefone inválido'
  ),
  document_type: z.enum(['cpf', 'cnpj']).optional(),
  document_number: z.string().optional().refine(
    (val: string) => {
      if (!val) return true;
      const digits = val.replace(/\D/g, '');
      const docType = digits.length === 11 ? 'cpf' : digits.length === 14 ? 'cnpj' : undefined;
      if (docType === 'cpf') {
        return /^\d{11}$/.test(digits);
      }
      if (docType === 'cnpj') {
        return /^\d{14}$/.test(digits);
      }
      return false;
    },
    'Formato de documento inválido'
  ),
  birth_date: z.string().optional().refine(
    (val) => !val || !isNaN(Date.parse(val)),
    'Data de nascimento inválida'
  ),
  address_street: z.string().max(255, 'Endereço muito longo').optional(),
  address_number: z.string().max(20, 'Número muito longo').optional(),
  address_complement: z.string().max(100, 'Complemento muito longo').optional(),
  address_neighborhood: z.string().max(100, 'Bairro muito longo').optional(),
  address_city: z.string().max(100, 'Cidade muito longa').optional(),
  address_state: z.string().length(2, 'Estado deve ter 2 caracteres').optional(),
  address_zipcode: z.string().optional().refine(
    (val) => !val || /^\d{5}-?\d{3}$/.test(val),
    'CEP inválido'
  ),
  address_country: z.string().max(50, 'País muito longo').optional().default('Brasil'),
  status: z.enum(['active', 'inactive', 'blocked']).default('active'),
  customer_type: z.enum(['individual', 'business']).default('individual'),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional().default([])
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface UseProfileFormOptions {
  profileId?: string;
  onSuccess?: (profile: Profile) => void;
  onError?: (error: string) => void;
  autoSave?: boolean;
  autoSaveDelay?: number;
}

interface UseProfileFormReturn {
  // Form state
  formData: ProfileFormData;
  originalData: ProfileFormData | null;
  isDirty: boolean;
  isValid: boolean;
  errors: Record<string, string>;
  
  // Loading states
  loading: boolean;
  saving: boolean;
  
  // Actions
  setField: <K extends keyof ProfileFormData>(field: K, value: ProfileFormData[K]) => void;
  setFormData: (data: Partial<ProfileFormData>) => void;
  resetForm: () => void;
  validateForm: () => boolean;
  submitForm: () => Promise<Profile | null>;
  
  // Auto-save
  autoSaveStatus: 'idle' | 'saving' | 'saved' | 'error';
  lastSaved: Date | null;
  
  // Offline support
  isOffline: boolean;
  queuedOperations: number;
}

const defaultFormData: ProfileFormData = {
  name: '',
  email: '',
  phone: '',
  document_type: '',
  document_number: '',
  birth_date: '',
  address_street: '',
  address_number: '',
  address_complement: '',
  address_neighborhood: '',
  address_city: '',
  address_state: '',
  address_zipcode: '',
  address_country: 'Brasil',
  status: 'active',
  customer_type: 'individual',
  notes: '',
  tags: []
};

export const useProfileForm = ({
  profileId,
  onSuccess,
  onError,
  autoSave = false,
  autoSaveDelay = 2000
}: UseProfileFormOptions = {}): UseProfileFormReturn => {
  const [formData, setFormDataState] = useState<ProfileFormData>(defaultFormData);
  const [originalData, setOriginalData] = useState<ProfileFormData | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [autoSaveTimeout, setAutoSaveTimeout] = useState<NodeJS.Timeout | null>(null);

  // Offline queue para operações quando offline
  const {
    addToQueue,
    queueSize
  } = useOfflineQueue();
  
  // Status da rede
  const { isOffline } = useNetworkStatus();

  // Verificar se o formulário foi modificado
  const isDirty = JSON.stringify(formData) !== JSON.stringify(originalData);

  // Validar formulário
  const validateForm = useCallback(() => {
    try {
      profileSchema.parse(formData);
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          const path = err.path.join('.');
          newErrors[path] = err.message;
        });
        setErrors(newErrors);
      }
      return false;
    }
  }, [formData]);

  // Verificar se o formulário é válido
  const isValid = Object.keys(errors).length === 0 && formData.name.trim() !== '' && formData.email.trim() !== '';

  // Carregar dados do perfil existente
  const loadProfile = useCallback(async () => {
    if (!profileId) return;
    
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', profileId)
        .single();
      
      if (error) throw error;
      
      const profileData: ProfileFormData = {
        name: data.name || '',
        email: data.email || '',
        phone: data.phone || '',
        document_type: data.document_type,
        document_number: data.document_number || '',
        birth_date: data.birth_date || '',
        address_street: data.address_street || '',
        address_number: data.address_number || '',
        address_complement: data.address_complement || '',
        address_neighborhood: data.address_neighborhood || '',
        address_city: data.address_city || '',
        address_state: data.address_state || '',
        address_zipcode: data.address_zipcode || '',
        address_country: data.address_country || 'Brasil',
        status: data.status || 'active',
        customer_type: data.customer_type || 'individual',
        notes: data.notes || '',
        tags: data.tags || []
      };
      
      setFormDataState(profileData);
      setOriginalData(profileData);
      
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
      onError?.(error instanceof Error ? error.message : 'Erro ao carregar perfil');
    } finally {
      setLoading(false);
    }
  }, [profileId, onError]);

  // Definir campo específico
  const setField = useCallback(<K extends keyof ProfileFormData>(
    field: K,
    value: ProfileFormData[K]
  ) => {
    setFormDataState(current => ({
      ...current,
      [field]: value
    }));
    
    // Limpar erro do campo se existir
    if (errors[field]) {
      setErrors(current => {
        const newErrors = { ...current };
        delete newErrors[field];
        return newErrors;
      });
    }
    
    // Configurar auto-save
    if (autoSave && !saving) {
      if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout);
      }
      
      const timeout = setTimeout(() => {
        handleAutoSave();
      }, autoSaveDelay);
      
      setAutoSaveTimeout(timeout);
    }
  }, [errors, autoSave, saving, autoSaveDelay, autoSaveTimeout]);

  // Definir dados do formulário
  const setFormData = useCallback((data: Partial<ProfileFormData>) => {
    setFormDataState(current => ({ ...current, ...data }));
  }, []);

  // Resetar formulário
  const resetForm = useCallback(() => {
    if (originalData) {
      setFormDataState(originalData);
    } else {
      setFormDataState(defaultFormData);
    }
    setErrors({});
  }, [originalData]);

  // Auto-save
  const handleAutoSave = useCallback(async () => {
    if (!profileId || !isDirty || !isValid) return;
    
    try {
      setAutoSaveStatus('saving');
      
      const { error } = await supabase
        .from('profiles')
        .update(formData)
        .eq('user_id', profileId);
      
      if (error) throw error;
      
      setAutoSaveStatus('saved');
      setLastSaved(new Date());
      setOriginalData(formData);
      
      // Limpar status após 3 segundos
      setTimeout(() => {
        setAutoSaveStatus('idle');
      }, 3000);
      
    } catch (error) {
      console.error('Erro no auto-save:', error);
      setAutoSaveStatus('error');
      
      // Adicionar à fila offline se necessário
      if (isOffline) {
        await addToQueue({
          type: 'update',
          table: 'profiles',
          data: formData,
          filter: { id: profileId }
        });
      }
    }
  }, [profileId, isDirty, isValid, formData, isOffline, addToQueue]);

  // Submeter formulário
  const submitForm = useCallback(async (): Promise<Profile | null> => {
    if (!validateForm()) {
      return null;
    }
    
    try {
      setSaving(true);
      
      let result;
      
      if (profileId) {
        // Atualizar perfil existente
        const { data, error } = await supabase
          .from('profiles')
          .update(formData)
          .eq('user_id', profileId)
          .select()
          .single();
        
        if (error) throw error;
        result = data;
      } else {
        // Criar novo perfil
        const { data, error } = await supabase
          .from('profiles')
          .insert([{
            ...formData,
            user_id: (await supabase.auth.getUser()).data.user?.id
          }])
          .select()
          .single();
        
        if (error) throw error;
        result = data;
      }
      
      setOriginalData(formData);
      setLastSaved(new Date());
      onSuccess?.(result);
      
      return result;
      
    } catch (error) {
      console.error('Erro ao salvar perfil:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao salvar perfil';
      onError?.(errorMessage);
      
      // Adicionar à fila offline se necessário
      if (isOffline) {
        await addToQueue({
          type: profileId ? 'update' : 'insert',
          table: 'profiles',
          data: formData,
          filter: profileId ? { id: profileId } : undefined
        });
      }
      
      return null;
    } finally {
      setSaving(false);
    }
  }, [validateForm, profileId, formData, onSuccess, onError, isOffline, addToQueue]);

  // Carregar dados iniciais
  useEffect(() => {
    if (profileId) {
      loadProfile();
    } else {
      setOriginalData(defaultFormData);
    }
  }, [profileId, loadProfile]);

  // Validar formulário quando dados mudarem
  useEffect(() => {
    validateForm();
  }, [validateForm]);

  // Cleanup do timeout
  useEffect(() => {
    return () => {
      if (autoSaveTimeout) {
        clearTimeout(autoSaveTimeout);
      }
    };
  }, [autoSaveTimeout]);

  return {
    formData,
    originalData,
    isDirty,
    isValid,
    errors,
    loading,
    saving,
    setField,
    setFormData,
    resetForm,
    validateForm,
    submitForm,
    autoSaveStatus,
    lastSaved,
    isOffline,
    queuedOperations: queueSize
  };
};