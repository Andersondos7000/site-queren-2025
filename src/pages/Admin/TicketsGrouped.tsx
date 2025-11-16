import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Eye, Calendar, MapPin, User, Mail, Hash, DollarSign, ChevronDown, ChevronRight, Package } from "lucide-react";
import AdminSidebar from '@/components/AdminSidebar';
import { useGroupedTicketsDashboard } from '@/hooks/useGroupedTicketsDashboard';
import { gerarImagemQRCode } from '@/utils/qrCodeGenerator';

const AdminTicketsGrouped = () => {
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [expandedPackages, setExpandedPackages] = useState<Set<string>>(new Set());

  const {
    groupedTickets,
    loading,
    error,
    stats,
    currentPage,
    totalPages,
    hasNextPage,
    hasPreviousPage,
    goToNextPage,
    goToPreviousPage,
    refetch
  } = useGroupedTicketsDashboard({
    statusFilter: statusFilter === 'all' ? undefined : statusFilter,
    searchTerm: searchTerm.trim() || undefined,
    pageSize: 10
  });

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleNextPage = () => {
    if (hasNextPage) {
      goToNextPage();
    }
  };

  const handlePreviousPage = () => {
    if (hasPreviousPage) {
      goToPreviousPage();
    }
  };

  const togglePackageExpansion = (orderId: string) => {
    const newExpanded = new Set(expandedPackages);
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId);
    } else {
      newExpanded.add(orderId);
    }
    setExpandedPackages(newExpanded);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value / 100);
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

  const getCustomerName = (ticket: any) => {
    return ticket.customers?.name || 
           ticket.customer_name || 
           ticket.orders?.customer_name || 
           'Cliente não identificado';
  };

  const getCustomerEmail = (ticket: any) => {
    return ticket.customers?.email || 
           ticket.customer_email || 
           ticket.orders?.customer_email || 
           'Email não disponível';
  };

  const mapStatus = (status: string) => {
    const statusMap: { [key: string]: string } = {
      'active': 'Ativo',
      'used': 'Usado',
      'cancelled': 'Cancelado',
      'pending': 'Pendente',
      'confirmed': 'Confirmado'
    };
    return statusMap[status] || status;
  };

  const getStatusBadgeClass = (status: string) => {
    const statusClasses: { [key: string]: string } = {
      'active': 'bg-green-100 text-green-800 border-green-200',
      'used': 'bg-blue-100 text-blue-800 border-blue-200',
      'cancelled': 'bg-red-100 text-red-800 border-red-200',
      'pending': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'confirmed': 'bg-green-100 text-green-800 border-green-200'
    };
    return statusClasses[status] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50">
        <AdminSidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Carregando tickets...</span>
          </div>
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
            <p className="text-red-600 mb-4">Erro ao carregar tickets: {error}</p>
            <Button onClick={refetch}>Tentar novamente</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <AdminSidebar />
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Gestão de Tickets</h1>
            <p className="text-gray-600">Visualize e gerencie todos os tickets vendidos</p>
          </div>

          {/* Estatísticas */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total de Tickets</p>
                    <p className="text-2xl font-bold">{stats.total}</p>
                  </div>
                  <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <Hash className="h-4 w-4 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Ativos</p>
                    <p className="text-2xl font-bold text-green-600">{stats.active}</p>
                  </div>
                  <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                    <Eye className="h-4 w-4 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Usados</p>
                    <p className="text-2xl font-bold text-blue-600">{stats.used}</p>
                  </div>
                  <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <Calendar className="h-4 w-4 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Receita Total</p>
                    <p className="text-2xl font-bold text-green-600">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.totalRevenue)}</p>
                  </div>
                  <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                    <DollarSign className="h-4 w-4 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filtros */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Filtros</CardTitle>
              <CardDescription>Filtre os tickets por status ou busque por cliente</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Buscar por cliente ou email..."
                      value={searchTerm}
                      onChange={handleSearchChange}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="w-full sm:w-48">
                  <Select value={statusFilter} onValueChange={handleStatusChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filtrar por status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os status</SelectItem>
                      <SelectItem value="active">Ativos</SelectItem>
                      <SelectItem value="used">Usados</SelectItem>
                      <SelectItem value="cancelled">Cancelados</SelectItem>
                      <SelectItem value="pending">Pendentes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lista de Tickets/Pacotes */}
          <Card>
            <CardHeader>
              <CardTitle>Tickets e Pacotes</CardTitle>
              <CardDescription>
                {groupedTickets.length === 0 ? 'Nenhum ticket encontrado' : `${groupedTickets.length} resultado(s) encontrado(s)`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {groupedTickets.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">Nenhum ticket encontrado com os filtros aplicados.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {groupedTickets.map((item) => (
                    <div key={item.isPackage ? `package-${item.orderId}` : `ticket-${item.tickets[0].id}`} className="border rounded-lg">
                      {/* Linha principal */}
                      <div className="p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 flex-1">
                            {/* Indicador de pacote/múltiplos itens e botão expandir */}
                            {(item.isPackage || item.hasMultipleItems) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => togglePackageExpansion(item.isPackage ? item.orderId! : item.id)}
                                className="p-1 h-8 w-8"
                              >
                                {expandedPackages.has(item.isPackage ? item.orderId! : item.id) ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                            
                            {/* Ícone de pacote ou ticket individual */}
                            <div className="flex items-center gap-2">
                              {item.isPackage ? (
                                <Package className="h-5 w-5 text-blue-600" />
                              ) : (
                                <Hash className="h-5 w-5 text-gray-600" />
                              )}
                              <div>
                                <p className="font-medium">
                                  {item.isPackage ? `Pacote (${item.ticketCount} tickets)` : 
                                   item.hasMultipleItems ? `${item.ticket_count} Ingressos` : 'Ticket Individual'}
                                </p>
                                <p className="text-sm text-gray-600">
                                  {item.isPackage ? `Order ID: ${item.orderId}` : 
                                   item.hasMultipleItems ? `Ticket #: ${item.tickets[0].display_id || item.tickets[0].ticket_number || item.tickets[0].parent_ticket_id || item.tickets[0].id}` :
                                   `Ticket #: ${item.tickets[0].display_id || item.tickets[0].ticket_number || item.tickets[0].id}`}
                                </p>
                              </div>
                            </div>

                            {/* Informações do cliente */}
                            <div className="flex-1">
                              <p className="font-medium">{getCustomerName(item.tickets[0])}</p>
                              <p className="text-sm text-gray-600">{getCustomerEmail(item.tickets[0])}</p>
                            </div>

                            {/* Valor total */}
                            <div className="text-right">
                              <p className="font-medium">{formatCurrency(item.totalValue)}</p>
                              <p className="text-sm text-gray-600">
                                {item.isPackage ? `${formatCurrency(item.totalValue / item.ticketCount)} cada` : 'Valor único'}
                              </p>
                            </div>

                            {/* Status */}
                            <div>
                              <Badge className={getStatusBadgeClass(item.tickets[0].status)}>
                                {mapStatus(item.tickets[0].status)}
                              </Badge>
                            </div>

                            {/* Data */}
                            <div className="text-right">
                              <p className="text-sm text-gray-600">{item.tickets[0].orders?.created_at ? formatDate(item.tickets[0].orders.created_at) : (item.tickets[0].created_at ? formatDate(item.tickets[0].created_at) : '-')}</p>
                            </div>

                            {/* Ações */}
                            <div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedTicket(item.tickets[0])}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Detalhes expandidos do pacote ou múltiplos itens */}
                      {((item.isPackage && expandedPackages.has(item.orderId!)) || 
                        (item.hasMultipleItems && expandedPackages.has(item.id))) && (
                        <div className="border-t bg-gray-50">
                          <div className="p-4">
                            <h4 className="font-medium mb-3 text-gray-700">
                              {item.isPackage ? 'Tickets do Pacote:' : 'Ingressos Individuais:'}
                            </h4>
                            <div className="space-y-2">
                              {item.tickets.map((ticket, index) => (
                                <div key={ticket.id} className="flex items-center justify-between bg-white p-3 rounded border w-full">
                                  <div className="flex items-center space-x-4 flex-1">
                                    <div className="text-sm text-gray-500 min-w-[60px]">
                                      #{index + 1}
                                    </div>
                                    <div className="text-sm font-medium flex-1 truncate">
                                      #{ticket.display_id || ticket.ticket_number || ticket.id.substring(0, 8) + '...'}
                                    </div>
                                    <div className="text-sm text-gray-500 min-w-[60px] text-center">
                                      Qtd: {ticket.quantity || 1}
                                    </div>
                                    <div className="text-sm text-gray-500 min-w-[80px] text-right">
                                      {formatCurrency(ticket.price || 0)}
                                    </div>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setSelectedTicket(ticket)}
                                      className="min-w-[40px]"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                    <div className="text-sm font-medium min-w-[80px] text-right">
                                      {formatCurrency((ticket.price || 0) * (ticket.quantity || 1))}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Paginação */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t">
                  <div className="text-sm text-gray-600">
                    Página {currentPage} de {totalPages}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePreviousPage}
                      disabled={!hasPreviousPage}
                    >
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleNextPage}
                      disabled={!hasNextPage}
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Modal de Detalhes do Ticket */}
          <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Detalhes do Ticket</DialogTitle>
                <DialogDescription>
                  Informações completas sobre o ticket selecionado
                </DialogDescription>
              </DialogHeader>
              
              {selectedTicket && (
                <div className="space-y-6">
                  {/* Informações do Cliente */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                        <User className="h-4 w-4" />
                        Cliente
                      </div>
                      <p className="text-sm">{getCustomerName(selectedTicket)}</p>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                        <Mail className="h-4 w-4" />
                        E-mail
                      </div>
                      <p className="text-sm">{getCustomerEmail(selectedTicket)}</p>
                    </div>
                  </div>

                  {/* Informações do Ticket */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                        <Hash className="h-4 w-4" />
                        ID do Ticket
                      </div>
                      <p className="text-sm font-mono">{selectedTicket.id}</p>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                        <Calendar className="h-4 w-4" />
                        Data da Compra
                      </div>
                      <p className="text-sm">{selectedTicket.orders?.created_at ? formatDate(selectedTicket.orders.created_at) : (selectedTicket.created_at ? formatDate(selectedTicket.created_at) : '-')}</p>
                    </div>
                  </div>

                  {/* Status e Valor */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-gray-700">Status</div>
                      <Badge className={getStatusBadgeClass(selectedTicket.status)}>
                        {mapStatus(selectedTicket.status)}
                      </Badge>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                        <DollarSign className="h-4 w-4" />
                        Valor
                      </div>
                      <p className="text-sm font-medium">{formatCurrency(selectedTicket.total_price || selectedTicket.price || 0)}</p>
                    </div>
                  </div>

                  {/* QR Code - sempre disponível */}
                  <div className="space-y-4">
                    <div className="text-sm font-medium text-gray-700">QR Code para Validação</div>
                    <div className="flex flex-col items-center p-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                      {/* QR Code Visual */}
                      <div className="mb-4 flex justify-center">
                        <div className="relative">
                          {(() => {
                            // Debug: Log dos dados do ticket
                            console.log('🔍 DEBUG QR Code - selectedTicket:', selectedTicket);
                            console.log('🔍 DEBUG QR Code - qr_code value:', selectedTicket.qr_code);
                            console.log('🔍 DEBUG QR Code - qr_code type:', typeof selectedTicket.qr_code);
                            
                            let qrUrl = '';
                            
                            // Se o qrCode já é uma URL, usar diretamente
                            if (selectedTicket.qr_code && selectedTicket.qr_code.startsWith('http')) {
                              qrUrl = selectedTicket.qr_code;
                              console.log('🔍 DEBUG QR Code - Usando URL direta:', qrUrl);
                            }
                            // Se é texto (ex: TICKET-1761349687177-8zy087t4u), gerar URL da imagem QR
                            else if (selectedTicket.qr_code) {
                              qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(selectedTicket.qr_code)}`;
                              console.log('🔍 DEBUG QR Code - Gerando URL do texto:', qrUrl);
                            }
                            // Se não há qr_code, gerar dados estruturados automaticamente
                            else {
                              const qrData = JSON.stringify({
                                ticket_id: selectedTicket.id,
                                event_id: selectedTicket.event_id,
                                customer_id: selectedTicket.customer_id,
                                timestamp: selectedTicket.created_at,
                                validation_url: `${window.location.origin}/validate-ticket/${selectedTicket.id}`
                              });
                              qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(qrData)}`;
                              console.log('🔍 DEBUG QR Code - Gerando dados estruturados:', qrData);
                              console.log('🔍 DEBUG QR Code - URL final:', qrUrl);
                            }
                            
                            return (
                              <img 
                                src={qrUrl}
                                alt={`QR Code do ticket ${selectedTicket.id}`}
                                className="w-24 h-24 border border-gray-200 rounded-lg bg-white p-1"
                                onLoad={() => {
                                  console.log('✅ QR Code carregado com sucesso!');
                                }}
                                onError={(e) => {
                                  console.error('❌ Erro ao carregar QR Code:', e);
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                  const fallback = target.nextElementSibling as HTMLElement;
                                  if (fallback) fallback.style.display = 'block';
                                }}
                              />
                            );
                          })()}
                          <div 
                            className="w-24 h-24 border border-gray-200 rounded-lg bg-white p-2 flex items-center justify-center text-center hidden absolute top-0 left-0"
                          >
                            <div>
                              <div className="text-gray-400 text-xs mb-1">📱</div>
                              <div className="text-xs text-gray-500">QR indisponível</div>
                            </div>
                          </div>
                        </div>
                      </div>
                        
                        <div className="text-center space-y-2">
                          <p className="text-sm font-medium text-gray-700">
                            📱 Escaneie este QR Code no dia do evento
                          </p>
                          <div className="mt-3 p-2 bg-blue-50 rounded border border-blue-200">
                            <p className="text-xs text-blue-700">
                              <strong>ID do Ticket:</strong> {selectedTicket.id}
                            </p>
                            <p className="text-xs text-blue-700">
                              <strong>Evento:</strong> {selectedTicket.events?.name || 'N/A'}
                            </p>
                          </div>
                        </div>
                        
                        <div className="mt-4 flex gap-2 justify-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              // Gerar dados estruturados para o QR Code
                              let qrData = selectedTicket.qr_code;
                              
                              // Se não há qr_code ou é uma URL, gerar dados estruturados
                              if (!qrData || qrData.startsWith('http')) {
                                qrData = JSON.stringify({
                                  ticket_id: selectedTicket.id,
                                  event_id: selectedTicket.event_id,
                                  customer_id: selectedTicket.customer_id,
                                  timestamp: selectedTicket.created_at,
                                  validation_url: `${window.location.origin}/validate-ticket/${selectedTicket.id}`
                                });
                              }
                              
                              window.open(gerarImagemQRCode(qrData, '300x300'), '_blank');
                            }}
                            className="text-xs"
                          >
                            🖨️ Abrir para Imprimir
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              // Gerar dados para copiar
                              let qrData = selectedTicket.qr_code;
                              
                              // Se não há qr_code ou é uma URL, gerar dados estruturados
                              if (!qrData || qrData.startsWith('http')) {
                                qrData = JSON.stringify({
                                  ticket_id: selectedTicket.id,
                                  event_id: selectedTicket.event_id,
                                  customer_id: selectedTicket.customer_id,
                                  timestamp: selectedTicket.created_at,
                                  validation_url: `${window.location.origin}/validate-ticket/${selectedTicket.id}`
                                });
                              }
                              
                              navigator.clipboard.writeText(qrData);
                            }}
                            className="text-xs"
                          >
                            📋 Copiar Dados
                          </Button>
                        </div>
                      </div>
                    </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
};

export default AdminTicketsGrouped;