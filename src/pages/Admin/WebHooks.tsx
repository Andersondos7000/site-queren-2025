import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { useRealtimeWebhooks, WebhookData as RealtimeWebhookData } from '@/hooks/realtime/useRealtimeWebhooks';
import { useHybridRealtime } from '@/hooks/useHybridRealtime';
import AdminSidebar from '@/components/AdminSidebar';
import { 
  Search, 
  Filter, 
  Download, 
  RefreshCw, 
  Eye, 
  Calendar,
  DollarSign,
  Users,
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  ExternalLink,
  CreditCard,
  Banknote,
  TrendingUp,
  Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { abacatePayWebhookData, calculateWebhookMetrics } from '../../data/abacatePayWebhookData';
import { AbacatePayWebhookData, WebhookMetrics } from '../../types/webhook';

// Usar a interface do hook diretamente
type WebhookData = RealtimeWebhookData;

export default function WebHooks() {
  // Hook de realtime para sincronização automática (WebSocket)
  const { 
    data: realtimeWebhooks, 
    loading: realtimeLoading, 
    error: realtimeError,
    refetch,
    isConnected,
    connectionStatus
  } = useRealtimeWebhooks();

  // Hook híbrido para fallback automático
  const {
    data: hybridData,
    loading: hybridLoading,
    error: hybridError,
    activeMethod
  } = useHybridRealtime();

  // ⚡ FIX: Sempre usar dados processados do useRealtimeWebhooks
  // (useHybridRealtime retorna dados RAW, não processados)
  const webhooksData = realtimeWebhooks; // SEMPRE usar dados processados
  const isLoading = realtimeLoading;
  const currentError = realtimeError;

  const [webhooks, setWebhooks] = useState<WebhookData[]>([]);
  const [metrics, setMetrics] = useState<WebhookMetrics>({
    totalWebhooks: 0,
    processados: 0,
    erros: 0,
    pendentes: 0,
    receitaBruta: 0,
    taxasTotal: 0,
    receitaLiquida: 0,
    transacoesPix: 0,
    clientesUnicos: 0
  });
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterDateStart, setFilterDateStart] = useState<string>('');
  const [filterDateEnd, setFilterDateEnd] = useState<string>('');
  const [selectedWebhook, setSelectedWebhook] = useState<WebhookData | null>(null);
  
  // Estados para seleção múltipla
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [selectAllItems, setSelectAllItems] = useState(false);
  
  // Estado para sincronização
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // ✅ CORREÇÃO: Função para calcular métricas a partir dos dados processados
  // Corrigido para usar CPF/CNPJ para clientes únicos e PIX IDs únicos para transações
  const calculateMetricsFromProcessedData = (webhooks: WebhookData[]): WebhookMetrics => {
    const processedWebhooks = webhooks.filter(w => w.processed);
    
    // ✅ CORREÇÃO: Calcular receita apenas de webhooks processados
    const totalRevenue = processedWebhooks.reduce((sum, w) => sum + (w.valorBrutoReais || 0), 0);
    const totalFees = processedWebhooks.reduce((sum, w) => sum + (w.taxaReais || 0), 0);
    const netRevenue = processedWebhooks.reduce((sum, w) => sum + (w.valorLiquidoReais || 0), 0);
    
    // ✅ CORREÇÃO: Contar clientes únicos por CPF/CNPJ (não por email)
    // Um cliente pode ter múltiplos emails, mas deve ser contado apenas uma vez
    const uniqueClients = new Set(
      processedWebhooks
        .map(w => w.clienteCpfCnpj || w.customer_document || w.customer_taxId)
        .filter(cpf => cpf && cpf !== 'N/A')
    ).size;
    
    // ✅ CORREÇÃO: Contar transações PIX únicas por PIX ID (não por webhook)
    // Um PIX pode ter múltiplos webhooks (duplicados), mas deve ser contado apenas uma vez
    // IMPORTANTE: Contar TODOS os webhooks que têm PIX ID válido (todos os webhooks do AbacatePay são PIX)
    const uniquePixIds = new Set(
      processedWebhooks
        .map(w => w.pixQrCodeId || w.payment_id)
        .filter(id => id && id !== 'N/A' && id !== undefined)
    ).size;
    
    // ✅ CORREÇÃO: Filtrar webhooks duplicados para contar total único
    // Agrupar por PIX ID e manter apenas o primeiro webhook de cada PIX
    const uniqueWebhooks = processedWebhooks.reduce((acc, webhook) => {
      const pixId = webhook.pixQrCodeId || webhook.payment_id;
      if (pixId && pixId !== 'N/A') {
        if (!acc.has(pixId)) {
          acc.set(pixId, webhook);
        }
      } else {
        // Se não tiver PIX ID, manter o webhook (usar ID do webhook como chave)
        acc.set(webhook.id, webhook);
      }
      return acc;
    }, new Map<string, WebhookData>());
    
    const totalUniqueWebhooks = uniqueWebhooks.size + 
      processedWebhooks.filter(w => !w.pixQrCodeId && !w.payment_id).length;

    return {
      totalWebhooks: webhooks.length, // Total de webhooks (incluindo duplicados)
      processados: processedWebhooks.length,
      erros: webhooks.filter(w => w.error_message).length,
      pendentes: webhooks.filter(w => !w.processed && !w.error_message).length,
      receitaBruta: totalRevenue,
      taxasTotal: totalFees,
      receitaLiquida: netRevenue,
      transacoesPix: uniquePixIds, // ✅ CORRIGIDO: PIX IDs únicos
      clientesUnicos: uniqueClients // ✅ CORRIGIDO: Clientes únicos por CPF/CNPJ
    };
  };

  // ⚡ Sincronizar state com dados do hook
  useEffect(() => {
    if (webhooksData && Array.isArray(webhooksData)) {
      setWebhooks(webhooksData as WebhookData[]);
      const newMetrics = calculateMetricsFromProcessedData(webhooksData as WebhookData[]);
      setMetrics(newMetrics);
    }
  }, [webhooksData]);

  // Função para seleção individual
  const handleItemSelection = (itemId: string, isChecked: boolean) => {
    const newSelected = new Set(selectedItems);
    if (isChecked) {
      newSelected.add(itemId);
    } else {
      newSelected.delete(itemId);
    }
    setSelectedItems(newSelected);
    
    // Atualizar estado do "selecionar todos"
    setSelectAllItems(newSelected.size === filteredWebhooks.length && filteredWebhooks.length > 0);
  };

  // Função para selecionar todos
  const handleSelectAllItems = () => {
    if (selectAllItems) {
      setSelectedItems(new Set());
      setSelectAllItems(false);
    } else {
      const allIds = new Set(filteredWebhooks.map(webhook => webhook.id));
      setSelectedItems(allIds);
      setSelectAllItems(true);
    }
  };

  // Função para exclusão múltipla
  const deleteSelectedItems = async () => {
    if (selectedItems.size === 0) return;
    
    const confirmed = window.confirm(
      `Tem certeza que deseja excluir ${selectedItems.size} webhook(s) selecionado(s)?`
    );
    
    if (!confirmed) return;
    
    try {
      setLoading(true);
      
      const { error } = await supabase
        .from('webhooks')
        .delete()
        .in('id', Array.from(selectedItems));
      
      if (error) throw error;
      
      alert('Webhooks excluídos com sucesso!');
      setSelectedItems(new Set());
      setSelectAllItems(false);
      
      // Recarregar dados (WebSocket atualiza automaticamente, mas forçamos refetch para garantir)
      await refetch();
      
    } catch (error) {
      console.error('Erro ao excluir webhooks:', error);
      alert('Erro ao excluir webhooks. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // ⚡ REMOVIDO: Função loadWebhooks não é mais necessária
  // WebSocket atualiza automaticamente via useRealtimeWebhooks
  // Fallback automático já funciona via useHybridRealtime
  // Para recarregar manualmente, usar refetch() diretamente do hook

  // Função para sincronizar webhooks do AbacatePay
  const syncWebhooksFromAbacatePay = async () => {
    setSyncing(true);
    setSyncMessage(null);
    
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórias');
      }
      
      const url = `${supabaseUrl}/functions/v1/sync-webhooks-abacatepay`;
      
      console.log('🔄 Sincronizando webhooks do AbacatePay...');
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'apikey': supabaseKey
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('✅ Sincronização concluída:', result);
      
      setSyncMessage(
        `Sincronização concluída! ${result.stats?.new_webhooks_created || 0} novos webhooks criados.`
      );
      
      // Recarregar dados após sincronização
      setTimeout(() => {
        refetch();
      }, 1000);
      
    } catch (error) {
      console.error('❌ Erro ao sincronizar webhooks:', error);
      setSyncMessage(
        `Erro ao sincronizar: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      );
    } finally {
      setSyncing(false);
      // Limpar mensagem após 5 segundos
      setTimeout(() => {
        setSyncMessage(null);
      }, 5000);
    }
  };

  // Filtrar webhooks
  const filteredWebhooks = webhooks.filter(webhook => {
    // Filtro por status
    const matchesStatus = 
      filterStatus === 'all' ||
      (filterStatus === 'processed' && webhook.processed) ||
      (filterStatus === 'error' && webhook.error_message) ||
      (filterStatus === 'pending' && !webhook.processed && !webhook.error_message);
    
    // Filtro por data
    let matchesDate = true;
    if (filterDateStart || filterDateEnd) {
      const webhookDate = new Date(webhook.created_at);
      
      if (filterDateStart) {
        const startDate = new Date(filterDateStart);
        startDate.setHours(0, 0, 0, 0);
        matchesDate = matchesDate && webhookDate >= startDate;
      }
      
      if (filterDateEnd) {
        const endDate = new Date(filterDateEnd);
        endDate.setHours(23, 59, 59, 999);
        matchesDate = matchesDate && webhookDate <= endDate;
      }
    }

    // Se não há termo de busca, retorna todos (apenas filtra por status e data)
    if (!searchTerm.trim()) {
      return matchesStatus && matchesDate;
    }

    const searchLower = searchTerm.toLowerCase().trim();
    
    // Buscar em todos os campos relevantes
    const matchesSearch = 
      // ID de pagamento
      (webhook.pixQrCodeId || '').toLowerCase().includes(searchLower) ||
      // Nome do cliente
      (webhook.clienteNome || '').toLowerCase().includes(searchLower) ||
      (webhook.customer_name || '').toLowerCase().includes(searchLower) ||
      // E-mail do cliente
      (webhook.clienteEmail || '').toLowerCase().includes(searchLower) ||
      (webhook.customer_email || '').toLowerCase().includes(searchLower) ||
      // Telefone do cliente
      (webhook.clienteTelefone || '').toLowerCase().includes(searchLower) ||
      // CPF/CNPJ (buscar tanto formatado quanto sem formatação)
      (webhook.clienteCpfCnpj || '').toLowerCase().includes(searchLower) ||
      (webhook.clienteCpfCnpj || '').replace(/\D/g, '').includes(searchLower.replace(/\D/g, '')) ||
      (webhook.customer_document || '').toLowerCase().includes(searchLower) ||
      (webhook.customer_document || '').replace(/\D/g, '').includes(searchLower.replace(/\D/g, '')) ||
      // Evento
      (webhook.evento || '').toLowerCase().includes(searchLower) ||
      (webhook.event_type || '').toLowerCase().includes(searchLower) ||
      // ID do webhook
      (webhook.id || '').toLowerCase().includes(searchLower);

    return matchesSearch && matchesStatus && matchesDate;
  });

  // Função para formatar CPF/CNPJ (mascarar dados sensíveis)
  const formatTaxId = (taxId: string) => {
    if (!taxId || taxId === '') return 'N/A';
    if (taxId.length <= 4) return taxId;
    return `***${taxId.slice(-4)}`;
  };

  // Função para formatar valores monetários
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Função para formatar data
  const formatDate = (dateString: string) => {
    if (!dateString) return 'Data não disponível';
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return 'Data inválida';
    }
    
    return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  // Função para formatar CPF/CNPJ
  const formatCpfCnpj = (value: string) => {
    if (!value || value === 'N/A') return 'N/A';
    // Remove caracteres não numéricos
    const numbers = value.replace(/\D/g, '');
    
    // CPF: 11 dígitos
    if (numbers.length === 11) {
      return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    // CNPJ: 14 dígitos
    if (numbers.length === 14) {
      return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    // Retorna original se não for CPF nem CNPJ
    return value;
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-gray-100">
      <AdminSidebar />
      
      <div className="flex-1 p-4 sm:p-6 lg:p-8 w-full lg:w-auto pt-20 lg:pt-4">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold">WebHooks</h1>
              <p className="text-muted-foreground">
                Monitoramento detalhado dos webhooks do AbacatePay
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Indicador de Status Realtime */}
              <div className="flex items-center gap-2 text-sm">
                <div className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-green-500' : 'bg-red-500'
                }`} />
                <span className={`text-xs ${
                  isConnected ? 'text-green-600' : 'text-red-600'
                }`}>
                  {isConnected ? 'WebSocket Ativo - Atualização Automática' : `Fallback: ${activeMethod || 'Desconectado'}`}
                </span>
              </div>
            </div>
          </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {/* Card Total Webhooks */}
        <Card className="relative overflow-hidden border-0 shadow-lg">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-blue-600/5 to-transparent" />
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-500/20 to-transparent rounded-full -translate-y-16 translate-x-16" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-gray-600">Total Webhooks</CardTitle>
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Activity className="h-5 w-5 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-bold text-gray-900">{metrics.totalWebhooks}</div>
            <p className="text-sm text-gray-500 mt-1">
              {metrics.processados} processados
            </p>
          </CardContent>
        </Card>

        {/* Card Receita Bruta */}
        <Card className="relative overflow-hidden border-0 shadow-lg">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-emerald-600/5 to-transparent" />
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-500/20 to-transparent rounded-full -translate-y-16 translate-x-16" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-gray-600">Receita Bruta</CardTitle>
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <DollarSign className="h-5 w-5 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-bold text-gray-900">{formatCurrency(metrics.receitaBruta)}</div>
            <p className="text-sm text-gray-500 mt-1">
              Líquida: <span className="font-semibold text-emerald-600">{formatCurrency(metrics.receitaLiquida)}</span>
            </p>
          </CardContent>
        </Card>

        {/* Card Clientes Únicos */}
        <Card className="relative overflow-hidden border-0 shadow-lg">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-purple-600/5 to-transparent" />
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/20 to-transparent rounded-full -translate-y-16 translate-x-16" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-gray-600">Clientes Únicos</CardTitle>
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Users className="h-5 w-5 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-bold text-gray-900">{metrics.clientesUnicos}</div>
            <p className="text-sm text-gray-500 mt-1">
              {metrics.transacoesPix} transações PIX
            </p>
          </CardContent>
        </Card>

        {/* Card Transações PIX */}
        <Card className="relative overflow-hidden border-0 shadow-lg">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 via-orange-600/5 to-transparent" />
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-orange-500/20 to-transparent rounded-full -translate-y-16 translate-x-16" />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-sm font-medium text-gray-600">Transações PIX</CardTitle>
            <div className="p-2 bg-orange-500/10 rounded-lg">
              <CreditCard className="h-5 w-5 text-orange-600" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-bold text-gray-900">{metrics.transacoesPix}</div>
            <p className="text-sm text-gray-500 mt-1">
              Taxas: {formatCurrency(metrics.taxasTotal)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg border shadow-sm p-6">
        <div className="flex flex-col gap-4">
          {/* Primeira linha: Barra de pesquisa e ações */}
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            {/* Barra de pesquisa */}
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Pesquisar por ID, nome, e-mail, telefone ou CPF"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 border-gray-200 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Ações */}
            <div className="flex flex-wrap gap-3 items-center">
              <Button 
                variant="outline" 
                size="sm"
                onClick={refetch}
                disabled={isLoading}
                className="border-gray-200 text-gray-600 hover:bg-gray-50"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>

              <Button 
                variant="default" 
                size="sm"
                onClick={syncWebhooksFromAbacatePay}
                disabled={syncing || isLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Sincronizando...' : 'Sincronizar com AbacatePay'}
              </Button>
            </div>
          </div>

          {/* Segunda linha: Filtros por status e data */}
          <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full lg:w-40 border-gray-200">
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="processed">Processados</SelectItem>
                <SelectItem value="error">Com Erro</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-1">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <Input
                  type="date"
                  placeholder="Data inicial"
                  value={filterDateStart}
                  onChange={(e) => setFilterDateStart(e.target.value)}
                  className="border-gray-200 focus:border-blue-500 focus:ring-blue-500 w-full"
                />
              </div>
              
              <span className="text-gray-400 hidden sm:block">até</span>
              
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <Input
                  type="date"
                  placeholder="Data final"
                  value={filterDateEnd}
                  onChange={(e) => setFilterDateEnd(e.target.value)}
                  className="border-gray-200 focus:border-blue-500 focus:ring-blue-500 w-full"
                />
              </div>

              {(filterDateStart || filterDateEnd) && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    setFilterDateStart('');
                    setFilterDateEnd('');
                  }}
                  className="text-gray-600 hover:text-gray-800 whitespace-nowrap"
                >
                  Limpar datas
                </Button>
              )}
            </div>
          </div>
        </div>
        
        {/* Mensagem de sincronização */}
        {syncMessage && (
          <div className={`mt-4 p-3 rounded-lg ${
            syncMessage.includes('Erro') 
              ? 'bg-red-50 text-red-700 border border-red-200' 
              : 'bg-green-50 text-green-700 border border-green-200'
          }`}>
            {syncMessage}
          </div>
        )}
      </div>

      {/* Tabela de Webhooks */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <CardTitle>Webhooks Processados ({filteredWebhooks.length})</CardTitle>
              <CardDescription>
                Dados detalhados dos webhooks conforme estrutura especificada
              </CardDescription>
            </div>
            
            {/* Controles de Seleção Múltipla */}
            {filteredWebhooks.length > 0 && (
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                {/* Checkbox Selecionar Todos */}
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="select-all-webhooks"
                    checked={selectAllItems}
                    onChange={handleSelectAllItems}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="select-all-webhooks" className="text-sm font-medium text-gray-700">
                    Selecionar Todos
                  </label>
                </div>
                
                {/* Contador de Selecionados */}
                {selectedItems.size > 0 && (
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 bg-blue-50 px-2 py-1 rounded-md">
                      {selectedItems.size} selecionado{selectedItems.size !== 1 ? 's' : ''}
                    </span>
                    
                    {/* Botão de Exclusão Múltipla */}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={deleteSelectedItems}
                      disabled={loading}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir Selecionados
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  {/* Coluna de Checkbox */}
                  {filteredWebhooks.length > 0 && (
                    <TableHead className="w-12">
                      <span className="sr-only">Selecionar</span>
                    </TableHead>
                  )}
                  <TableHead className="font-semibold text-gray-700">ID DE PAGAMENTO</TableHead>
                  <TableHead className="font-semibold text-gray-700">STATUS</TableHead>
                  <TableHead className="font-semibold text-gray-700">VALOR</TableHead>
                  <TableHead className="font-semibold text-gray-700">E-MAIL</TableHead>
                  <TableHead className="font-semibold text-gray-700">CPF</TableHead>
                  <TableHead className="font-semibold text-gray-700">Data de criação</TableHead>
                  <TableHead className="font-semibold text-gray-700">AÇÕES</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(realtimeLoading || loading) ? (
                  <TableRow>
                    <TableCell colSpan={filteredWebhooks.length > 0 ? 8 : 7} className="text-center py-8">
                      <div className="flex items-center justify-center">
                        <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                        Carregando webhooks...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredWebhooks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <div className="flex flex-col items-center">
                        <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-muted-foreground">Nenhum webhook encontrado</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredWebhooks.map((webhook) => (
                    <TableRow key={webhook.id} className="hover:bg-gray-50 transition-colors">
                      {/* Checkbox Individual */}
                      <TableCell className="w-12">
                        <input
                          type="checkbox"
                          checked={selectedItems.has(webhook.id)}
                          onChange={(e) => handleItemSelection(webhook.id, e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                      </TableCell>
                      
                      <TableCell className="font-mono text-sm text-blue-600">
                        {webhook.pixQrCodeId || 'N/A'}
                      </TableCell>
                      <TableCell>
                        {webhook.error_message ? (
                          <Badge variant="destructive" className="bg-red-100 text-red-700 border-red-200">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Erro
                          </Badge>
                        ) : webhook.processed ? (
                          <Badge variant="default" className="bg-green-100 text-green-700 border-green-200">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Processado
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 border-yellow-200">
                            <Clock className="h-3 w-3 mr-1" />
                            Pendente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-semibold text-green-600">
                        {formatCurrency(webhook.valorBrutoReais || 0)}
                      </TableCell>
                      <TableCell className="text-gray-600">
                        {webhook.clienteEmail || 'N/A'}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-gray-600">
                        {webhook.clienteCpfCnpj ? formatCpfCnpj(webhook.clienteCpfCnpj) : 'N/A'}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-gray-500">
                        {formatDate(webhook.created_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 sm:gap-2 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedWebhook(webhook)}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 p-1 sm:p-2"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-gray-600 hover:text-gray-700 hover:bg-gray-50 p-1 sm:p-2"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Modal de Detalhes do Webhook */}
      {selectedWebhook && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Detalhes do Webhook</CardTitle>
              <CardDescription>
                ID: {selectedWebhook.id}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Informações Básicas */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold mb-2">Informações do Evento</h3>
                  <div className="space-y-2 text-sm">
                    <p><strong>Evento:</strong> {selectedWebhook.evento || 'N/A'}</p>
                    <p><strong>Ambiente:</strong> {selectedWebhook.ambiente}</p>
                    <p><strong>Data/Hora:</strong> {formatDate(selectedWebhook.created_at)}</p>
                    <p><strong>PIX QR Code ID:</strong> {selectedWebhook.pixQrCodeId || 'N/A'}</p>
                    <p><strong>PIX Tipo:</strong> {selectedWebhook.pixQrCodeTipo}</p>
                    <p><strong>PIX Status:</strong> {selectedWebhook.pixQrCodeStatus}</p>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-semibold mb-2">Informações do Cliente</h3>
                  <div className="space-y-2 text-sm">
                    <p><strong>ID:</strong> {selectedWebhook.clienteId}</p>
                    <p><strong>Nome:</strong> {selectedWebhook.clienteNome || 'N/A'}</p>
                    <p><strong>Email:</strong> {selectedWebhook.clienteEmail || 'N/A'}</p>
                    <p><strong>Telefone:</strong> {selectedWebhook.clienteTelefone || 'N/A'}</p>
                    <p><strong>CPF/CNPJ:</strong> {formatTaxId(selectedWebhook.clienteCpfCnpj)}</p>
                    <p><strong>CEP:</strong> {selectedWebhook.clienteCep || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Informações Financeiras */}
              <div>
                <h3 className="font-semibold mb-2">Informações Financeiras</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-green-50 p-3 rounded-lg">
                    <p className="text-sm text-green-700">Valor Bruto</p>
                    <p className="font-bold text-green-800">{formatCurrency(selectedWebhook.valorBrutoReais || 0)}</p>
                    <p className="text-xs text-green-600">{selectedWebhook.valorBrutoCentavos || 0} centavos</p>
                  </div>
                  <div className="bg-orange-50 p-3 rounded-lg">
                    <p className="text-sm text-orange-700">Taxa</p>
                    <p className="font-bold text-orange-800">{formatCurrency(selectedWebhook.taxaReais || 0)}</p>
                    <p className="text-xs text-orange-600">{selectedWebhook.taxaCentavos || 0} centavos</p>
                  </div>
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-sm text-blue-700">Valor Líquido</p>
                    <p className="font-bold text-blue-800">{formatCurrency(selectedWebhook.valorLiquidoReais || 0)}</p>
                    <p className="text-xs text-blue-600">{Math.round((selectedWebhook.valorLiquidoReais || 0) * 100)} centavos</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-700">% Taxa</p>
                    <p className="font-bold text-gray-800">{selectedWebhook.percentualTaxa ? selectedWebhook.percentualTaxa.toFixed(3) : '0.000'}%</p>
                    <p className="text-xs text-gray-600">Método: {selectedWebhook.metodoPagamento || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Payload Completo */}
              <div>
                <h3 className="font-semibold mb-2">Payload Completo (JSON)</h3>
                <pre className="bg-gray-100 p-4 rounded-lg text-xs overflow-auto max-h-64">
                  {JSON.stringify(selectedWebhook.payload, null, 2)}
                </pre>
              </div>

              {/* Status de Processamento */}
              {selectedWebhook.error_message && (
                <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                  <h3 className="font-semibold text-red-800 mb-2">Erro de Processamento</h3>
                  <p className="text-red-700 text-sm">{selectedWebhook.error_message}</p>
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={() => setSelectedWebhook(null)} className="w-full sm:w-auto">
                  Fechar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
        </div>
      </div>
    </div>
  );
}