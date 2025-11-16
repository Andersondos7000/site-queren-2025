import React, { useState } from 'react';
import { useProfileForm } from '../../hooks/profiles/useProfileForm';
import { SyncStatus } from '../realtime/SyncStatus';
import { CEPInput } from '../ui/CEPInput';
import type { Profile } from '../../types/profile';
import type { AddressData } from '../../hooks/useCEP';

interface ProfileFormProps {
  profileId?: string;
  onSuccess?: (profile: Profile) => void;
  onCancel?: () => void;
  className?: string;
}

export const ProfileForm: React.FC<ProfileFormProps> = ({
  profileId,
  onSuccess,
  onCancel,
  className = ''
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const {
    formData,
    isDirty,
    isValid,
    errors,
    loading,
    saving,
    setField,
    resetForm,
    submitForm,
    autoSaveStatus,
    lastSaved,
    isOffline,
    queuedOperations
  } = useProfileForm({
    profileId,
    onSuccess,
    autoSave: true,
    autoSaveDelay: 2000
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitForm();
  };

  const formatDocument = (value: string, type: 'cpf' | 'cnpj') => {
    const numbers = value.replace(/\D/g, '');
    if (type === 'cpf') {
      return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    } else {
      return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 10) {
      return numbers.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    } else {
      return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
  };

  const formatZipcode = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.replace(/(\d{5})(\d{3})/, '$1-$2');
  };

  const handleAddressFound = (address: AddressData) => {
    // Preenche automaticamente os campos de endereço
    setField('address_zipcode', address.cep);
    setField('address_street', address.logradouro);
    setField('address_neighborhood', address.bairro);
    setField('address_city', address.cidade);
    setField('address_state', address.estado);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Carregando...</span>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
      {/* Header com status de sincronização */}
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          {profileId ? 'Editar Cliente' : 'Novo Cliente'}
        </h2>
        <div className="flex items-center space-x-4">
          {profileId && (
            <SyncStatus
              status={{
                syncing: autoSaveStatus === 'saving',
                lastSync: lastSaved,
                pendingChanges: queuedOperations,
                conflictCount: 0,
                error: null,
                realtimeConnected: !isOffline,
                realtimeSubscribed: !isOffline
              }}
              className="text-sm"
            />
          )}
          {autoSaveStatus === 'saving' && (
            <span className="text-sm text-blue-600 flex items-center">
              <div className="animate-spin rounded-full h-3 w-3 border-b border-blue-600 mr-1"></div>
              Salvando...
            </span>
          )}
          {autoSaveStatus === 'saved' && (
            <span className="text-sm text-green-600">✓ Salvo automaticamente</span>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Dados básicos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nome *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setField('name', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.name ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="Nome completo"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email *
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setField('email', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.email ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="email@exemplo.com"
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-600">{errors.email}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Telefone
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setField('phone', formatPhone(e.target.value))}
              className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.phone ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="(11) 99999-9999"
            />
            {errors.phone && (
              <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de Cliente
            </label>
            <select
              value={formData.customer_type}
              onChange={(e) => setField('customer_type', e.target.value as 'individual' | 'business')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="individual">Pessoa Física</option>
              <option value="business">Pessoa Jurídica</option>
            </select>
          </div>
        </div>

        {/* Documento */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de Documento
            </label>
            <select
               value={formData.document_type}
               onChange={(e) => {
                 setField('document_type', e.target.value as 'cpf' | 'cnpj' | '');
                 setField('document_number', ''); // Limpar número ao trocar tipo
               }}
               className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
             >
              <option value="">Selecione...</option>
              <option value="cpf">CPF</option>
              <option value="cnpj">CNPJ</option>
            </select>
          </div>

          {formData.document_type && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {formData.document_type === 'cpf' ? 'CPF' : 'CNPJ'}
              </label>
              <input
                type="text"
                value={formData.document_number}
                onChange={(e) => {
                  if (formData.document_type && formData.document_type !== '') {
                    const formatted = formatDocument(e.target.value, formData.document_type as 'cpf' | 'cnpj');
                    setField('document_number', formatted);
                  }
                }}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.document_number ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder={formData.document_type === 'cpf' ? '000.000.000-00' : '00.000.000/0000-00'}
                maxLength={formData.document_type === 'cpf' ? 14 : 18}
              />
              {errors.document_number && (
                <p className="mt-1 text-sm text-red-600">{errors.document_number}</p>
              )}
            </div>
          )}
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Status
          </label>
          <select
            value={formData.status}
            onChange={(e) => setField('status', e.target.value as 'active' | 'inactive' | 'blocked')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
            <option value="blocked">Bloqueado</option>
          </select>
        </div>

        {/* Seção avançada */}
        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            {showAdvanced ? '▼' : '▶'} Informações Adicionais
          </button>
        </div>

        {showAdvanced && (
          <div className="space-y-6 border-t pt-6">
            {/* Data de nascimento */}
            {formData.customer_type === 'individual' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Data de Nascimento
                </label>
                <input
                  type="date"
                  value={formData.birth_date}
                  onChange={(e) => setField('birth_date', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {/* Endereço */}
            <div className="space-y-4">
              <h3 className="text-md font-medium text-gray-900">Endereço</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rua
                  </label>
                  <input
                    type="text"
                    value={formData.address_street}
                    onChange={(e) => setField('address_street', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nome da rua"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Número
                  </label>
                  <input
                    type="text"
                    value={formData.address_number}
                    onChange={(e) => setField('address_number', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="123"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Complemento
                  </label>
                  <input
                    type="text"
                    value={formData.address_complement}
                    onChange={(e) => setField('address_complement', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Apto, sala, etc."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bairro
                  </label>
                  <input
                    type="text"
                    value={formData.address_neighborhood}
                    onChange={(e) => setField('address_neighborhood', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nome do bairro"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <CEPInput
                    value={formData.address_zipcode}
                    onChange={(value) => setField('address_zipcode', value)}
                    onAddressFound={handleAddressFound}
                    label="CEP"
                    placeholder="00000-000"
                    error={errors.address_zipcode}
                    className="w-full"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cidade
                  </label>
                  <input
                    type="text"
                    value={formData.address_city}
                    onChange={(e) => setField('address_city', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Nome da cidade"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estado
                  </label>
                  <input
                    type="text"
                    value={formData.address_state}
                    onChange={(e) => setField('address_state', e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="SP"
                    maxLength={2}
                  />
                </div>
              </div>
            </div>

            {/* Observações */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Observações
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setField('notes', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Observações adicionais sobre o cliente..."
              />
            </div>
          </div>
        )}

        {/* Botões */}
        <div className="flex items-center justify-end space-x-4 pt-6 border-t">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Cancelar
            </button>
          )}
          
          {isDirty && (
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Resetar
            </button>
          )}
          
          <button
            type="submit"
            disabled={!isValid || saving}
            className={`px-4 py-2 text-sm font-medium text-white rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              !isValid || saving
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {saving ? (
              <span className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b border-white mr-2"></div>
                Salvando...
              </span>
            ) : (
              profileId ? 'Atualizar' : 'Criar Cliente'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

// ProfileForm já foi exportado acima