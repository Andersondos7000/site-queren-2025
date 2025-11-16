import React, { useState } from 'react';
import { useGroupedTicketsDashboard } from '../../hooks/useGroupedTicketsDashboard';
import TicketModal from '../../components/ui/TicketModal';
import { supabase } from '../../lib/supabase';

interface TicketFilters {
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export function AdminTicketsGrouped() {
  const [filters, setFilters] = useState<TicketFilters>({});
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedTickets, setSelectedTickets] = useState<Set<string>>(new Set());
  const [selectAllTickets, setSelectAllTickets] = useState(false);

  const {
    ticketGroups,
    stats,
    loading,
    error,
    currentPage,
    totalPages,
    hasNextPage,
    hasPreviousPage,
    setCurrentPage,
    refetch
  } = useGroupedTicketsDashboard(filters, 20);

  // Função para encontrar o ticket completo baseado no ID
  const selectedTicket = selectedTicketId 
    ? ticketGroups.flatMap(group => group.tickets).find(ticket => ticket.id === selectedTicketId)
    : null;

  // Funções de seleção múltipla
  const handleTicketSelection = (ticketId: string) => {
    const newSelected = new Set(selectedTickets);
    if (newSelected.has(ticketId)) {
      newSelected.delete(ticketId);
    } else {
      newSelected.add(ticketId);
    }
    setSelectedTickets(newSelected);
    
    // Atualizar estado do "selecionar todos"
    const allTicketIds = ticketGroups.flatMap(group => group.tickets.map(ticket => ticket.id));
    setSelectAllTickets(allTicketIds.length > 0 && allTicketIds.every(id => newSelected.has(id)));
  };

  const handleSelectAllTickets = () => {
    if (selectAllTickets) {
      setSelectedTickets(new Set());
      setSelectAllTickets(false);
    } else {
      const allTicketIds = ticketGroups.flatMap(group => group.tickets.map(ticket => ticket.id));
      setSelectedTickets(new Set(allTicketIds));
      setSelectAllTickets(true);
    }
  };

  const deleteSelectedTickets = async () => {
    if (selectedTickets.size === 0) {
      alert('Nenhum ingresso selecionado para exclusão.');
      return;
    }

    const confirmDelete = window.confirm(
      `Tem certeza que deseja excluir ${selectedTickets.size} ingresso(s) selecionado(s)? Esta ação não pode ser desfeita.`
    );

    if (!confirmDelete) return;

    try {
      const ticketIdsArray = Array.from(selectedTickets);
      
      const { error } = await supabase
        .from('tickets')
        .delete()
        .in('id', ticketIdsArray);

      if (error) {
        console.error('Erro ao excluir ingressos:', error);
        alert('Erro ao excluir ingressos. Verifique o console para mais detalhes.');
        return;
      }

      // Limpar seleção e atualizar lista
      setSelectedTickets(new Set());
      setSelectAllTickets(false);
      
      // Recarregar dados
      refetch();
      
      alert(`${ticketIdsArray.length} ingresso(s) excluído(s) com sucesso!`);
    } catch (error) {
      console.error('Erro ao excluir ingressos:', error);
      alert('Erro inesperado ao excluir ingressos.');
    }
  };

  const toggleGroupExpansion = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const handleFilterChange = (newFilters: Partial<TicketFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-100';
      case 'used': return 'text-blue-600 bg-blue-100';
      case 'cancelled': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-red-800">Erro ao carregar ingressos: {error.message}</p>
        <button 
          onClick={refetch}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Total</h3>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Ativos</h3>
          <p className="text-2xl font-bold text-green-600">{stats.active}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Utilizados</h3>
          <p className="text-2xl font-bold text-blue-600">{stats.used}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Cancelados</h3>
          <p className="text-2xl font-bold text-red-600">{stats.cancelled}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Receita Total</h3>
          <p className="text-2xl font-bold text-gray-900">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.totalRevenue)}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={filters.status || ''}
              onChange={(e) => handleFilterChange({ status: e.target.value || undefined })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            >
              <option value="">Todos</option>
              <option value="active">Ativo</option>
              <option value="used">Utilizado</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data Inicial
            </label>
            <input
              type="date"
              value={filters.dateFrom || ''}
              onChange={(e) => handleFilterChange({ dateFrom: e.target.value || undefined })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Data Final
            </label>
            <input
              type="date"
              value={filters.dateTo || ''}
              onChange={(e) => handleFilterChange({ dateTo: e.target.value || undefined })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Buscar
            </label>
            <input
              type="text"
              placeholder="Cliente ou email..."
              value={filters.search || ''}
              onChange={(e) => handleFilterChange({ search: e.target.value || undefined })}
              className="w-full border border-gray-300 rounded-md px-3 py-2"
            />
          </div>
        </div>
      </div>

      {/* Controles de seleção múltipla */}
      {ticketGroups.length > 0 && (
        <div className="bg-white p-4 rounded-lg shadow border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={selectAllTickets}
                  onChange={handleSelectAllTickets}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm font-medium text-gray-700">
                  Selecionar todos os ingressos
                </span>
              </label>
              {selectedTickets.size > 0 && (
                <span className="text-sm text-gray-600">
                  {selectedTickets.size} ingresso(s) selecionado(s)
                </span>
              )}
            </div>
            {selectedTickets.size > 0 && (
              <button
                onClick={deleteSelectedTickets}
                className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                Excluir Selecionados ({selectedTickets.size})
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tabela de ingressos agrupados */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <input
                  type="checkbox"
                  checked={selectAllTickets}
                  onChange={handleSelectAllTickets}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Cliente
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Evento
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Tipo
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Quantidade
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Valor Total
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Data de Compra
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {ticketGroups.map((group) => (
              <React.Fragment key={group.id}>
                {/* Linha principal do grupo */}
                <tr className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={group.tickets.every(ticket => selectedTickets.has(ticket.id))}
                      onChange={() => {
                        const allGroupTicketsSelected = group.tickets.every(ticket => selectedTickets.has(ticket.id));
                        const newSelected = new Set(selectedTickets);
                        
                        if (allGroupTicketsSelected) {
                          // Desmarcar todos os tickets do grupo
                          group.tickets.forEach(ticket => newSelected.delete(ticket.id));
                        } else {
                          // Marcar todos os tickets do grupo
                          group.tickets.forEach(ticket => newSelected.add(ticket.id));
                        }
                        
                        setSelectedTickets(newSelected);
                        
                        // Atualizar estado do "selecionar todos"
                        const allTicketIds = ticketGroups.flatMap(g => g.tickets.map(t => t.id));
                        setSelectAllTickets(allTicketIds.length > 0 && allTicketIds.every(id => newSelected.has(id)));
                      }}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {group.customer_name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {group.customer_email}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {group.event_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      group.type === 'package' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {group.type === 'package' ? 'Pacote' : 'Individual'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {group.ticket_count} {group.ticket_count > 1 ? 'ingressos' : 'ingresso'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatCurrency(group.total_value)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(group.status)}`}>
                      {group.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(group.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {group.type === 'package' && (
                      <button
                        onClick={() => toggleGroupExpansion(group.id)}
                        className="text-blue-600 hover:text-blue-900 mr-2"
                      >
                        {expandedGroups.has(group.id) ? 'Recolher' : 'Expandir'}
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedTicketId(group.tickets[0]?.id)}
                      className="text-green-600 hover:text-green-900"
                    >
                      Ver Detalhes
                    </button>
                  </td>
                </tr>

                {/* Linhas expandidas para pacotes */}
                {group.type === 'package' && expandedGroups.has(group.id) && (
                  <>
                    {group.tickets.map((ticket, index) => (
                      <tr key={ticket.id} className="bg-gray-50">
                        <td className="px-6 py-2 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={selectedTickets.has(ticket.id)}
                            onChange={() => handleTicketSelection(ticket.id)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                        </td>
                        <td className="px-6 py-2 whitespace-nowrap">
                          <div className="pl-4 text-sm text-gray-600">
                            ↳ Ingresso #{index + 1}
                          </div>
                        </td>
                        <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-600">
                          {ticket.events?.name}
                        </td>
                        <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-600">
                          {ticket.ticket_type || 'Padrão'}
                        </td>
                        <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-600">
                          1
                        </td>
                        <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-600">
                          {formatCurrency(ticket.price)}
                        </td>
                        <td className="px-6 py-2 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(ticket.status || 'active')}`}>
                            {ticket.status || 'active'}
                          </span>
                        </td>
                        <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-600">
                          {ticket.orders?.created_at ? formatDate(ticket.orders.created_at) : (ticket.created_at ? formatDate(ticket.created_at) : '-')}
                        </td>
                        <td className="px-6 py-2 whitespace-nowrap text-sm font-medium">
                          <button
                            onClick={() => setSelectedTicketId(ticket.id)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            QR Code
                          </button>
                        </td>
                      </tr>
                    ))}
                  </>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>

        {ticketGroups.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500">Nenhum ingresso encontrado</p>
          </div>
        )}
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Página {currentPage} de {totalPages}
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={!hasPreviousPage}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <button
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={!hasNextPage}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Próxima
            </button>
          </div>
        </div>
      )}

      {/* Modal de detalhes do ingresso */}
      {selectedTicket && (
        <TicketModal
          ticket={selectedTicket}
          isOpen={!!selectedTicket}
          onClose={() => setSelectedTicketId(null)}
        />
      )}
    </div>
  );
}