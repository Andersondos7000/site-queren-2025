import React, { useState, useMemo } from 'react';
import { useProfiles } from '../../hooks/profiles/useProfiles';
import { ProfileCard } from './ProfileCard';
import { SyncStatus } from '../realtime/SyncStatus';
import { ConflictResolver } from '../realtime/ConflictResolver';
import type { ProfileFilters, ProfileSortOptions, Profile } from '../../types/profile';

interface ProfileListProps {
  onSelectProfile?: (profile: Profile) => void;
  onEditProfile?: (profile: Profile) => void;
  onDeleteProfile?: (profile: Profile) => void;
  selectable?: boolean;
  className?: string;
}

export const ProfileList: React.FC<ProfileListProps> = ({
  onSelectProfile,
  onEditProfile,
  onDeleteProfile,
  selectable = false,
  className = ''
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<ProfileFilters>({
    status: undefined,
    customerType: undefined
  });
  const [sortOptions, setSortOptions] = useState<ProfileSortOptions>({
    field: 'name',
    direction: 'asc'
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedProfiles, setSelectedProfiles] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  const {
    profiles,
    loading,
    error,
    hasMore,
    refetch,
    deleteProfile,
    isOffline,
    isSyncing,
    lastSyncAt,
    queueSize,
    pendingActions
  } = useProfiles({
    filters: {
      ...filters,
      search: searchTerm || undefined
    },
    sortOptions,
    pagination: {
      page: currentPage,
      limit: pageSize
    }
  });

  // Filtros locais adicionais
  const filteredProfiles = useMemo(() => {
    if (!searchTerm) return profiles;
    
    const term = searchTerm.toLowerCase();
    return profiles.filter(profile => 
      profile.name.toLowerCase().includes(term) ||
      profile.email.toLowerCase().includes(term) ||
      (profile.phone && profile.phone.includes(term)) ||
      (profile.document_number && profile.document_number.includes(term))
    );
  }, [profiles, searchTerm]);

  const handleSelectProfile = (profile: Profile) => {
    if (!selectable) return;
    const newSelected = new Set(selectedProfiles);
    if (newSelected.has(profile.id)) {
      newSelected.delete(profile.id);
    } else {
      newSelected.add(profile.id);
    }
    setSelectedProfiles(newSelected);
    
    onSelectProfile?.(profile);
  };

  const handleSelectAll = () => {
    if (selectedProfiles.size === filteredProfiles.length) {
      setSelectedProfiles(new Set());
    } else {
      setSelectedProfiles(new Set(filteredProfiles.map(c => c.id)));
    }
  };

  const handleDeleteProfile = async (profile: Profile) => {
    if (window.confirm(`Tem certeza que deseja excluir o perfil "${profile.name}"?`)) {
      try {
        await deleteProfile(profile.id);
        onDeleteProfile?.(profile);
      } catch (error) {
        console.error('Erro ao excluir perfil:', error);
      }
    }
  };

  const handleBulkDelete = async () => {
    if (selectedProfiles.size === 0) return;
    
    if (window.confirm(`Tem certeza que deseja excluir ${selectedProfiles.size} perfil(s)?`)) {
      try {
        await Promise.all(
          Array.from(selectedProfiles).map(id => deleteProfile(id))
        );
        setSelectedProfiles(new Set());
      } catch (error) {
        console.error('Erro ao excluir perfis:', error);
      }
    }
  };

  const handleExport = () => {
    const profilesToExport = selectedProfiles.size > 0 
      ? filteredProfiles.filter(c => selectedProfiles.has(c.id))
      : filteredProfiles;
    
    const csv = [
      'Nome,Email,Telefone,Tipo,Status,Documento,Criado em',
      ...profilesToExport.map(profile => [
        profile.name,
        profile.email,
        profile.phone || '',
        profile.customer_type === 'individual' ? 'Pessoa Física' : 'Pessoa Jurídica',
        profile.status === 'active' ? 'Ativo' : profile.status === 'inactive' ? 'Inativo' : 'Bloqueado',
        profile.document_number || '',
        new Date(profile.created_at).toLocaleDateString('pt-BR')
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `perfis_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <div className="text-red-600 mr-2">⚠️</div>
          <div>
            <h3 className="text-red-800 font-medium">Erro ao carregar clientes</h3>
            <p className="text-red-600 text-sm mt-1">{error}</p>
            <button
              onClick={refetch}
              className="mt-2 text-sm text-red-600 hover:text-red-700 underline"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
      {/* Header com controles */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg font-semibold text-gray-900">Clientes</h2>
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <span>Total: {profiles.length}</span>
              <span>Carregando: {loading ? 'Sim' : 'Não'}</span>
              <span>Offline: {isOffline ? 'Sim' : 'Não'}</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <SyncStatus
              status={isOffline ? 'offline' : (isSyncing ? 'syncing' : 'synced')}
              lastSync={lastSyncAt}
              queuedOperations={queueSize}
              size="sm"
            />
            
            <button
              onClick={refetch}
              disabled={loading}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md"
              title="Atualizar lista"
            >
              <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </div>

        {/* Barra de busca e filtros */}
        <div className="flex items-center space-x-4">
          <div className="flex-1 relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome, email, telefone ou documento..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-2 text-sm font-medium rounded-md border ${
              showFilters 
                ? 'bg-blue-50 text-blue-700 border-blue-300' 
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            Filtros
          </button>
          
          {selectedProfiles.size > 0 && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">
                {selectedProfiles.size} selecionado(s)
              </span>
              <button
                onClick={handleBulkDelete}
                className="px-3 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-300 rounded-md hover:bg-red-100"
              >
                Excluir
              </button>
              <button
                onClick={handleExport}
                className="px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-300 rounded-md hover:bg-blue-100"
              >
                Exportar
              </button>
            </div>
          )}
        </div>

        {/* Painel de filtros */}
        {showFilters && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={filters.status ?? ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value as any || undefined }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="">Todos</option>
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                  <option value="blocked">Bloqueado</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo
                </label>
                <select
                  value={filters.customer_type ?? ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, customerType: e.target.value as any || undefined }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="">Todos</option>
                  <option value="individual">Pessoa Física</option>
                  <option value="business">Pessoa Jurídica</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ordenar por
                </label>
                <select
                  value={sortOptions.field}
                  onChange={(e) => setSortOptions(prev => ({ ...prev, field: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="name">Nome</option>
                  <option value="email">Email</option>
                  <option value="created_at">Data de Criação</option>
                  <option value="updated_at">Última Atualização</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Direção
                </label>
                <select
                  value={sortOptions.direction}
                  onChange={(e) => setSortOptions(prev => ({ ...prev, direction: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="asc">Crescente</option>
                  <option value="desc">Decrescente</option>
                </select>
              </div>
            </div>
            
            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={() => {
                  setFilters({ status: undefined, customerType: undefined, has_document: undefined });
                  setSortOptions({ field: 'name', direction: 'asc' });
                  setSearchTerm('');
                }}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Limpar filtros
              </button>
              
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Itens por página:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 border border-gray-300 rounded text-sm"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Resolução de conflitos */}
        {pendingActions > 0 && (
          <div className="px-6 py-4 border-b border-gray-200">
            <ConflictResolver
              conflicts={[]}
              onResolve={(conflictId, resolution) => {
              // Implementar resolução de conflitos
              console.log('Resolvendo conflito:', conflictId, resolution);
            }}
          />
        </div>
      )}

      {/* Lista de clientes */}
      <div className="p-6">
        {loading && filteredProfiles.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Carregando clientes...</span>
          </div>
        ) : filteredProfiles.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm || Object.values(filters).some(Boolean) ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
            </h3>
            <p className="text-gray-600 mb-4">
              {searchTerm || Object.values(filters).some(Boolean) 
                ? 'Tente ajustar os filtros de busca.'
                : 'Comece cadastrando seu primeiro cliente.'
              }
            </p>
          </div>
        ) : (
          <>
            {/* Cabeçalho da lista com seleção */}
            {selectable && (
              <div className="flex items-center mb-4 pb-2 border-b border-gray-200">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedProfiles.size === filteredProfiles.length && filteredProfiles.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">
                    Selecionar todos ({filteredProfiles.length})
                  </span>
                </label>
              </div>
            )}
            
            {/* Grid de clientes */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProfiles.map((profile) => (
                <ProfileCard
                  key={profile.id}
                  profile={profile}
                  selected={selectedProfiles.has(profile.id)}
                  selectable={selectable}
                  onSelect={() => handleSelectProfile(profile)}
                  onEdit={onEditProfile ? () => onEditProfile(profile) : undefined}
                  onDelete={onDeleteProfile ? () => handleDeleteProfile(profile) : undefined}
                />
              ))}
            </div>
            
            {/* Paginação */}
            {hasMore && (
              <div className="mt-6 flex justify-center">
                <button
                  onClick={() => setCurrentPage(prev => prev + 1)}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-blue-600 bg-white border border-blue-300 rounded-md hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Carregando...' : 'Carregar mais'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};