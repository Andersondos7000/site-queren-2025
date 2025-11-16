
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Search, Eye, Calendar, MapPin, User, Mail, Hash, DollarSign, ChevronDown, ChevronRight, Ticket } from "lucide-react";
import AdminSidebar from '@/components/AdminSidebar';
import { useTicketsDashboard } from '@/hooks/useTicketsDashboard';
import TicketModal from '@/components/ui/TicketModal';
import { TicketGroup } from '@/types/ticket';
import TicketControlPanel from '@/components/admin/TicketControlPanel';

// Interface para ticket baseada na estrutura do banco
interface Ticket {
  id: string;
  event_id: string | null;
  customer_id: string | null;
  order_id: string | null;
  ticket_type: string | null;
  quantity: number;
  unit_price: number | null;
  total_price: number | null;
  price: number;
  status: string | null;
  created_at: string | null;
  user_id: string | null;
  qr_code: string | null;
  __originalId?: string; // Propriedade opcional para manter ID original
  __individualId?: string; // Propriedade opcional para ID único
  item_number?: number; // Número do item individual (1, 2, 3, etc.)
  parent_ticket_id?: string; // ID do ticket pai para itens individuais
  events?: {
    id: string;
    name: string;
    event_date: string | null;
    date: string;
    location: string | null;
  };
  customers?: {
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
  };
  orders?: {
    id: string;
    created_at: string;
    customer_name: string | null;
    customer_email: string | null;
    customer_data: any;
    status: string;
    payment_status: string;
  };
}

const AdminTickets = () => {
  const [activeTab, setActiveTab] = useState<'gestao' | 'controle'>('gestao');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  
  // Estados para seleção múltipla - REIMPLEMENTADO
  const [selectedTickets, setSelectedTickets] = useState<Set<string>>(new Set());
  const [selectAllTickets, setSelectAllTickets] = useState(false);
  
  // Usar dados reais do Supabase
  const { 
    tickets, 
    stats, 
    loading, 
    error, 
    currentPage,
    totalPages,
    hasNextPage,
    hasPreviousPage,
    setCurrentPage
  } = useTicketsDashboard({
    status: statusFilter,
    search: searchQuery
  }, 20);
  
  // Agrupar tickets por order_id e expandir itens individuais
  const adminTicketGroups = useMemo(() => {
    if (!tickets || tickets.length === 0) return [];
  
    const orderGroups = new Map<string, Ticket[]>();
    const singleTickets: Ticket[] = [];
  
    // Separar tickets por order_id
    tickets.forEach((ticket: Ticket) => {
      if (ticket.order_id) {
        if (!orderGroups.has(ticket.order_id)) {
          orderGroups.set(ticket.order_id, []);
        }
        orderGroups.get(ticket.order_id)!.push(ticket);
      } else {
        singleTickets.push(ticket);
      }
    });
  
    const groups: TicketGroup[] = [];
  
    // Processar grupos de pedidos (pacotes)
    orderGroups.forEach((orderTickets: Ticket[], orderId: string) => {
      // Sempre agrupar por pedido, mesmo com um único registro
      const firstTicket = orderTickets[0];
      const totalQuantity = orderTickets.reduce((sum: number, t: Ticket) => sum + (t.quantity || 1), 0);
      const totalValue = orderTickets.reduce((sum: number, t: Ticket) => sum + ((t.price || 0) * (t.quantity || 1)), 0);
      const unitPrice = firstTicket.price || 0;
  
      const uniqueEvents = Array.from(new Set(orderTickets.map(t => t.events?.name).filter(Boolean)));
      const eventName = uniqueEvents.length > 1 ? 'Múltiplos eventos' : (uniqueEvents[0] || 'Evento não encontrado');
  
      groups.push({
        id: orderId,
        type: 'package',
        order_id: orderId,
        customer_name: firstTicket.customers?.full_name || firstTicket.orders?.customer_name || 'Cliente não encontrado',
        customer_email: firstTicket.customers?.email || firstTicket.orders?.customer_email || '',
        event_name: eventName,
        ticket_count: totalQuantity,
        total_quantity: totalQuantity,
        unit_price: unitPrice,
        total_value: totalValue,
        status: firstTicket.status || 'unknown',
        created_at: firstTicket.created_at || '',
        purchase_date: firstTicket.orders?.created_at || firstTicket.created_at || null,
        tickets: orderTickets
      });
    });
  
    // Agrupar tickets sem order_id por usuário e dia
    const singlesByUserDay = new Map<string, Ticket[]>();
    singleTickets.forEach((ticket: Ticket) => {
      const userKey = ticket.customers?.id || ticket.customers?.email || 'desconhecido';
      const day = ticket.created_at ? new Date(ticket.created_at).toISOString().slice(0, 10) : 'sem_data';
      const key = `${userKey}_${day}`;
      if (!singlesByUserDay.has(key)) singlesByUserDay.set(key, []);
      singlesByUserDay.get(key)!.push(ticket);
    });
  
    singlesByUserDay.forEach((ticketsForKey: Ticket[], key: string) => {
      const first = ticketsForKey[0];
      const totalQuantity = ticketsForKey.reduce((sum: number, t: Ticket) => sum + (t.quantity || 1), 0);
      const totalValue = ticketsForKey.reduce((sum: number, t: Ticket) => sum + ((t.price || 0) * (t.quantity || 1)), 0);
  
      const uniqueEvents = Array.from(new Set(ticketsForKey.map((t: Ticket) => t.events?.name).filter(Boolean)));
      const eventName = uniqueEvents.length > 1 ? 'Múltiplos eventos' : (uniqueEvents[0] || 'Evento não encontrado');
  
      groups.push({
        id: `grp_${key}`,
        type: 'package',
        order_id: null,
        customer_name: first.customers?.full_name || 'Cliente não encontrado',
        customer_email: first.customers?.email || '',
        event_name: eventName,
        ticket_count: totalQuantity,
        total_quantity: totalQuantity,
        unit_price: first.price || 0,
        total_value: totalValue,
        status: first.status || 'unknown',
        created_at: first.created_at || '',
        purchase_date: first.created_at || null,
        tickets: ticketsForKey
      });
    });
  
    // Ordenar por data de criação (mais recente primeiro)
    const sortedGroups = groups.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    return sortedGroups;
  }, [tickets]);

  // 🔧 CORREÇÃO: Aplicar paginação nos GRUPOS, não nos tickets individuais
  const itemsPerPage = 20;
  const [groupPage, setGroupPage] = useState(1);
  const totalGroupPages = Math.ceil(adminTicketGroups.length / itemsPerPage);
  const paginatedGroups = useMemo(() => {
    const from = (groupPage - 1) * itemsPerPage;
    const to = from + itemsPerPage;
    return adminTicketGroups.slice(from, to);
  }, [adminTicketGroups, groupPage]);

  // Funções auxiliares
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'used':
        return 'bg-blue-100 text-blue-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const mapStatus = (status: string) => {
    switch (status) {
      case 'active':
        return 'Ativo';
      case 'used':
        return 'Usado';
      case 'cancelled':
        return 'Cancelado';
      default:
        return 'Desconhecido';
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value / 100); // ✅ Valores estão em centavos no banco, dividir por 100 para exibir em reais
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

  const toggleGroupExpansion = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  // ========== FUNÇÕES DE SELEÇÃO MÚLTIPLA - REIMPLEMENTADO ==========
  
  // Obter todos os IDs de tickets disponíveis (apenas IDs reais do banco)
  const getAllTicketIds = useMemo(() => {
    return tickets.map((ticket: Ticket) => ticket.id);
  }, [tickets]);

  // Função para seleção individual
  const handleTicketSelection = (ticketId: string, isChecked: boolean) => {
    console.log('🔄 handleTicketSelection chamado:', { ticketId: ticketId.slice(0, 13), isChecked });
    
    setSelectedTickets(prevSelected => {
      const newSelected = new Set(prevSelected);
      
      if (isChecked) {
        newSelected.add(ticketId);
        console.log('✅ Ticket adicionado:', ticketId.slice(0, 13));
      } else {
        const wasDeleted = newSelected.delete(ticketId);
        console.log('❌ Ticket removido:', ticketId.slice(0, 13), 'Sucesso:', wasDeleted);
      }
      
      console.log('📊 Total selecionados:', newSelected.size);
      
      // Atualizar estado do "selecionar todos"
      setSelectAllTickets(newSelected.size === getAllTicketIds.length && getAllTicketIds.length > 0);
      
      return newSelected;
    });
  };

  // Função para selecionar todos
  const handleSelectAllTickets = () => {
    if (selectAllTickets) {
      // Desselecionar todos
      setSelectedTickets(new Set());
      setSelectAllTickets(false);
    } else {
      // Selecionar todos
      setSelectedTickets(new Set(getAllTicketIds));
      setSelectAllTickets(true);
    }
  };

  // Função para exclusão múltipla
  const deleteSelectedTickets = async () => {
    if (selectedTickets.size === 0) return;
    
    const confirmed = window.confirm(
      `Tem certeza que deseja excluir ${selectedTickets.size} ticket(s) selecionado(s)? Esta ação não pode ser desfeita.`
    );
    
    if (!confirmed) return;
    
    try {
      const { supabase } = await import('@/lib/supabase');
      
      const { error } = await supabase
        .from('tickets')
        .delete()
        .in('id', Array.from(selectedTickets));
      
      if (error) throw error;
      
      alert(`${selectedTickets.size} ticket(s) excluído(s) com sucesso!`);
      
      // Limpar seleções
      setSelectedTickets(new Set());
      setSelectAllTickets(false);
      
      // Recarregar dados
      window.location.reload();
      
    } catch (error) {
      console.error('Erro ao excluir tickets:', error);
      alert('Erro ao excluir tickets. Tente novamente.');
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <AdminSidebar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen bg-gray-50">
        <AdminSidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-600 mb-4">Erro ao carregar dados: {error.message}</p>
            <Button onClick={() => window.location.reload()}>Tentar novamente</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <AdminSidebar />
      
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Ingressos</h1>
            <p className="text-gray-600">Gerencie ingressos e controle de vendas</p>
          </div>

          {/* Seletor de Abas */}
          <div className="mb-6 flex gap-2 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('gestao')}
              className={`px-6 py-3 font-medium text-sm transition-colors ${
                activeTab === 'gestao'
                  ? 'border-b-2 border-butterfly-orange text-butterfly-orange'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Gestão de Ingressos
            </button>
            <button
              onClick={() => setActiveTab('controle')}
              className={`px-6 py-3 font-medium text-sm transition-colors ${
                activeTab === 'controle'
                  ? 'border-b-2 border-butterfly-orange text-butterfly-orange'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Controle de Ingressos - Queren Hapuque VIII
            </button>
          </div>

          {/* Conteúdo da Aba "Gestão de Ingressos" */}
          {activeTab === 'gestao' && (
            <>

          {/* Estatísticas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Ingressos</CardTitle>
                <Hash className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ativos</CardTitle>
                <div className="h-2 w-2 bg-green-500 rounded-full"></div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{stats.active}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Utilizados</CardTitle>
                <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">{stats.used}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cancelados</CardTitle>
                <div className="h-2 w-2 bg-red-500 rounded-full"></div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{stats.cancelled}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalRevenue)}</div>
              </CardContent>
            </Card>
          </div>

          {/* Filtros */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Filtros</CardTitle>
              <CardDescription>Filtre os ingressos por status ou busque por cliente</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Buscar por cliente ou email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Status</SelectItem>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="used">Usado</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Controles de Seleção Múltipla */}
          {/* Cabeçalho de Seleção Múltipla - REIMPLEMENTADO */}
          {tickets.length > 0 && (
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectAllTickets}
                        onChange={handleSelectAllTickets}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <span className="text-sm font-medium">
                        Selecionar todos ({tickets.length} tickets)
                      </span>
                    </label>
                    {selectedTickets.size > 0 && (
                      <span className="text-sm text-gray-600">
                        {selectedTickets.size} ticket(s) selecionado(s)
                      </span>
                    )}
                  </div>
                  {selectedTickets.size > 0 && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={deleteSelectedTickets}
                      className="w-full sm:w-auto"
                    >
                      Excluir Selecionados ({selectedTickets.size})
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabela de Ingressos Agrupados */}
          <Card>
            <CardHeader>
              <CardTitle>Ingressos e Pacotes ({adminTicketGroups.length})</CardTitle>
              <CardDescription>
                Lista de ingressos individuais e pacotes agrupados por pedido
                {totalGroupPages > 1 && ` - Página ${groupPage} de ${totalGroupPages}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {paginatedGroups.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">Nenhum ingresso encontrado</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {paginatedGroups.map((group) => {
                    // Verificar se algum ticket do grupo está selecionado
                    const groupTicketIds = group.tickets.map(t => t.id);
                    const selectedInGroup = groupTicketIds.filter(id => selectedTickets.has(id)).length;
                    const isGroupFullySelected = selectedInGroup === groupTicketIds.length;
                    const isGroupPartiallySelected = selectedInGroup > 0 && selectedInGroup < groupTicketIds.length;
                    
                    return (
                      <div 
                        key={group.id} 
                        className={`border rounded-lg p-4 transition-colors ${
                          isGroupFullySelected ? 'bg-blue-50 border-blue-300 border-l-4 border-l-blue-500' : 
                          isGroupPartiallySelected ? 'bg-blue-25 border-blue-200' : 
                          'hover:bg-gray-50'
                        }`}
                      >
                        {/* Linha principal do grupo */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full gap-4">
                          <div className="flex items-center space-x-2 flex-1">
                            <input
                              type="checkbox"
                              checked={isGroupFullySelected}
                              ref={(input) => {
                                if (input) input.indeterminate = isGroupPartiallySelected;
                              }}
                              onChange={(e) => {
                                e.stopPropagation();
                                const isChecked = e.target.checked;
                                console.log('📦 Checkbox do GRUPO:', { 
                                  groupId: group.id, 
                                  isChecked, 
                                  ticketsCount: group.tickets.length 
                                });
                                
                                // Atualizar todos os tickets do grupo de uma vez
                                setSelectedTickets(prevSelected => {
                                  const newSelected = new Set(prevSelected);
                                  
                                  group.tickets.forEach(ticket => {
                                    if (isChecked) {
                                      newSelected.add(ticket.id);
                                    } else {
                                      newSelected.delete(ticket.id);
                                    }
                                  });
                                  
                                  // Atualizar "selecionar todos"
                                  setSelectAllTickets(newSelected.size === getAllTicketIds.length && getAllTicketIds.length > 0);
                                  
                                  return newSelected;
                                });
                              }}
                              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                          {group.type === 'package' && (
                            <span
                              className="cursor-pointer p-1 hover:bg-gray-100 rounded"
                              onClick={() => toggleGroupExpansion(group.id)}
                            >
                              {expandedGroups.has(group.id) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </span>
                          )}
                          <div className="flex items-center space-x-2">
                            <span className="font-medium">{group.customer_name}</span>
                            {group.type === 'single' && (
                              <Badge variant="outline" className="text-xs">
                                Item #{group.id}
                              </Badge>
                            )}
                            {group.type === 'package' && (
                              <Badge variant="outline" className="text-xs">
                                Pacote ({group.ticket_count} ingressos)
                              </Badge>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">
                            {group.customer_email} • {group.event_name}
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <div className="font-medium">{formatCurrency(group.total_value)}</div>
                            <div className="text-sm text-gray-500">
                              {group.total_quantity} ingresso{group.total_quantity > 1 ? 's' : ''}
                            </div>
                          </div>
                          <Badge className={getStatusBadgeClass(group.status)}>
                            {mapStatus(group.status)}
                          </Badge>
                          <span
                            className="cursor-pointer p-2 hover:bg-gray-100 rounded"
                            onClick={() => {
                              // Sempre passa o primeiro ticket do grupo, que contém as informações do pedido completo
                              setSelectedTicket(group.tickets[0]);
                            }}
                            title="Ver detalhes do pedido"
                          >
                            <Eye className="h-4 w-4" />
                          </span>
                        </div>
                      </div>

                      {/* Tickets expandidos (apenas para pacotes) - SIMPLIFICADO */}
                      {group.type === 'package' && expandedGroups.has(group.id) && (
                        <div className="mt-4 border-t pt-4 bg-gray-50 rounded-b-lg">
                          <div className="text-xs font-medium text-gray-500 mb-2 ml-8">
                            Tickets individuais (selecione por checkbox acima para selecionar todos):
                          </div>
                          {group.tickets.map((ticket, index) => {
                            const isSelected = selectedTickets.has(ticket.id);
                            return (
                              <div 
                                key={ticket.id} 
                                className={`p-4 border-b last:border-b-0 ml-8 transition-colors ${
                                  isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'hover:bg-gray-100'
                                }`}
                              >
                                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full gap-4">
                                  <div className="flex items-center space-x-4 flex-1">
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        const newCheckedState = e.target.checked;
                                        console.log('🎯 Checkbox onChange:', { 
                                          ticketId: ticket.id.slice(0, 13), 
                                          isSelected, 
                                          newCheckedState 
                                        });
                                        handleTicketSelection(ticket.id, newCheckedState);
                                      }}
                                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                    />
                                    <div className={`font-medium min-w-[120px] ${isSelected ? 'text-blue-700' : ''}`}>
                                      Ticket #{index + 1}
                                    </div>
                                    <div className="text-sm text-gray-500 flex-1 truncate">
                                      ID: {ticket.id.slice(0, 13)}
                                    </div>
                                    <div className="text-sm text-gray-500 min-w-[60px] text-center">
                                      Qtd: {ticket.quantity || 1}
                                    </div>
                                    <div className="text-sm text-gray-500 min-w-[100px] text-right">
                                      {formatCurrency(ticket.price || 0)} / unidade
                                    </div>
                                    <span
                                      className="cursor-pointer p-2 hover:bg-gray-200 rounded min-w-[40px] flex items-center justify-center"
                                      onClick={() => setSelectedTicket(ticket)}
                                    >
                                      <Eye className="h-4 w-4" />
                                    </span>
                                    <div className={`font-medium min-w-[100px] text-right ${isSelected ? 'text-blue-700' : ''}`}>
                                      Total: {formatCurrency((ticket.price || 0) * (ticket.quantity || 1))}
                                    </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Paginação de Grupos */}
              {totalGroupPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between mt-6 gap-4">
                  <div className="text-sm text-gray-500">
                    Página {groupPage} de {totalGroupPages} (Total: {adminTicketGroups.length} grupos)
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setGroupPage(groupPage - 1)}
                      disabled={groupPage <= 1}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setGroupPage(groupPage + 1)}
                      disabled={groupPage >= totalGroupPages}
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
            </>
          )}

          {/* Conteúdo da Aba "Controle de Ingressos" */}
          {activeTab === 'controle' && (
            <TicketControlPanel />
          )}
        </div>
      </div>

      {/* Modal de Detalhes do Ticket */}
      <TicketModal
        isOpen={!!selectedTicket}
        onClose={() => setSelectedTicket(null)}
        ticket={selectedTicket}
        formatDate={formatDate}
        formatCurrency={formatCurrency}
        mapStatus={mapStatus}
        getStatusBadgeClass={getStatusBadgeClass}
      />
    </div>
  );
};

export default AdminTickets;
