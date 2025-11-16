import React from 'react';
import type { Profile } from '../../types/profile';

interface ProfileCardProps {
  profile: Profile;
  selected?: boolean;
  selectable?: boolean;
  onSelect?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  className?: string;
}

export const ProfileCard: React.FC<ProfileCardProps> = ({
  profile,
  selected = false,
  selectable = false,
  onSelect,
  onEdit,
  onDelete,
  className = ''
}) => {
  const getStatusColor = (status: Profile['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      case 'blocked':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: Profile['status']) => {
    switch (status) {
      case 'active':
        return 'Ativo';
      case 'inactive':
        return 'Inativo';
      case 'blocked':
        return 'Bloqueado';
      default:
        return 'Desconhecido';
    }
  };

  const getProfileTypeText = (type: Profile['customer_type']) => {
    return type === 'individual' ? 'Pessoa Física' : 'Pessoa Jurídica';
  };

  const formatDocument = (number: string, type: 'cpf' | 'cnpj') => {
    if (type === 'cpf') {
      return number.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    } else {
      return number.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
  };

  const formatPhone = (phone: string) => {
    const numbers = phone.replace(/\D/g, '');
    if (numbers.length <= 10) {
      return numbers.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    } else {
      return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
  };

  const getSyncStatusIcon = () => {
    if (profile.sync_status === 'synced') {
      return (
        <div className="w-2 h-2 bg-green-500 rounded-full" title="Sincronizado" />
      );
    } else if (profile.sync_status === 'pending') {
      return (
        <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" title="Sincronizando" />
      );
    } else if (profile.sync_status === 'conflict') {
      return (
        <div className="w-2 h-2 bg-red-500 rounded-full" title="Conflito na sincronização" />
      );
    }
    return null;
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Evitar trigger quando clicar em botões
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }
    
    if (selectable && onSelect) {
      onSelect();
    }
  };

  return (
    <div
      className={`
        relative bg-white border rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200
        ${selected ? 'ring-2 ring-blue-500 border-blue-300' : 'border-gray-200'}
        ${selectable ? 'cursor-pointer' : ''}
        ${className}
      `}
      onClick={handleCardClick}
    >
      {/* Checkbox de seleção */}
      {selectable && (
        <div className="absolute top-3 left-3 z-10">
          <input
            type="checkbox"
            checked={selected}
            onChange={onSelect}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Status de sincronização */}
      <div className="absolute top-3 right-3">
        {getSyncStatusIcon()}
      </div>

      <div className={`p-4 ${selectable ? 'pl-10' : ''}`}>
        {/* Header com nome e status */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 truncate">
              {profile.name}
            </h3>
            <p className="text-sm text-gray-600 truncate">
              {profile.email}
            </p>
          </div>
          
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(profile.status)}`}>
            {getStatusText(profile.status)}
          </span>
        </div>

        {/* Informações principais */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center text-sm text-gray-600">
            <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span>{getProfileTypeText(profile.customer_type)}</span>
          </div>

          {profile.phone && (
            <div className="flex items-center text-sm text-gray-600">
              <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <span>{formatPhone(profile.phone)}</span>
            </div>
          )}

          {profile.document_number && profile.document_type && (
            <div className="flex items-center text-sm text-gray-600">
              <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>
                {profile.document_type.toUpperCase()}: {formatDocument(profile.document_number, profile.document_type)}
              </span>
            </div>
          )}

          {/* Endereço resumido */}
          {(profile.address_city || profile.address_state) && (
            <div className="flex items-center text-sm text-gray-600">
              <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="truncate">
                {[profile.address_city, profile.address_state].filter(Boolean).join(', ')}
              </span>
            </div>
          )}
        </div>

        {/* Metadados */}
        <div className="flex items-center justify-between text-xs text-gray-500 mb-4">
          <span>
            Criado em {new Date(profile.created_at).toLocaleDateString('pt-BR')}
          </span>
          {profile.updated_at !== profile.created_at && (
            <span>
              Atualizado em {new Date(profile.updated_at).toLocaleDateString('pt-BR')}
            </span>
          )}
        </div>

        {/* Observações (se houver) */}
        {profile.notes && (
          <div className="mb-4">
            <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded border-l-4 border-blue-200">
              <span className="font-medium">Obs:</span> {profile.notes && profile.notes.length > 100 ? `${profile.notes.substring(0, 100)}...` : profile.notes || ''}
            </p>
          </div>
        )}

        {/* Ações */}
        {(onEdit || onDelete) && (
          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-gray-100">
            {onEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-300 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Editar
              </button>
            )}
            
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-red-700 bg-red-50 border border-red-300 rounded-md hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Excluir
              </button>
            )}
          </div>
        )}
      </div>

      {/* Indicador de versão/conflito */}
      {profile.version && profile.version > 1 && (
        <div className="absolute bottom-2 left-2">
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
            v{profile.version}
          </span>
        </div>
      )}
    </div>
  );
};