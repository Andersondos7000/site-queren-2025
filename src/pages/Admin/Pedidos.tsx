
import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Loader2, AlertCircle, RefreshCw, Trash2 } from 'lucide-react';
import { Input } from "@/components/ui/input";
import AdminSidebar from '@/components/AdminSidebar';
import OptimizedImage from '@/components/OptimizedImage';
import { useOrdersDashboard } from '@/hooks/realtime/useRealtimeOrders';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import Filters from './components/ReportFilters';
import type { ReportFilters as ReportFiltersType, PaymentGateway, PaymentStatus } from '@/types/reports';
import { useExport } from '@/hooks/useExport';

interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  size?: string;
  image?: string;
  isTicket?: boolean;
}

interface Order {
  id: string;
  customer: {
    name: string;
    email: string;
    phone?: string;
  };
  items: OrderItem[];
  total: number;
  status: 'Pendente' | 'Pago' | 'Enviado' | 'Entregue' | 'Cancelado';
  date: string;
  shippingAddress?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
  };
  hasTickets: boolean;
  hasProducts: boolean;
}

const AdminPedidos = () => {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const defaultRange = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 7);
    return { start, end };
  }, []);
  const [reportFilters, setReportFilters] = useState<ReportFiltersType>({
    dateRange: defaultRange,
    status: [] as PaymentStatus[],
    gateway: [] as PaymentGateway[],
  });
  const { exporting, exportCSV, exportCSVExcelBR } = useExport();
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  
  // Estados para seleção múltipla
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [selectAllOrders, setSelectAllOrders] = useState(false);
  
  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Hook para dados dos pedidos
  const { 
    orders, 
    stats, 
    recentOrders, 
    alertOrders, 
    loading, 
    error, 
    isConnected,
    totalOrders,
    totalPages,
    hasNextPage,
    hasPreviousPage
  } = useOrdersDashboard(currentPage, itemsPerPage);

  // Função para formatar telefone
  const formatPhone = (phone: string) => {
    if (!phone || phone === 'N/A') return phone;
    const numbers = phone.replace(/\D/g, '');
    if (numbers.length === 11) {
      return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    } else if (numbers.length === 10) {
      return numbers.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    }
    return phone;
  };

  // Função para formatar CPF
  const formatDocument = (document: string) => {
    if (!document || document === 'N/A') return document;
    const numbers = document.replace(/\D/g, '');
    if (numbers.length === 11) {
      return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    return document;
  };

  const findNestedValue = (obj: any, keys: string[]) => {
    if (!obj || typeof obj !== 'object') return undefined;
    const stack = [obj];
    while (stack.length) {
      const cur: any = stack.pop();
      for (const k of keys) {
        const v = cur?.[k];
        if (typeof v === 'string' && v.trim() !== '') return v;
      }
      for (const v of Object.values(cur)) {
        if (v && typeof v === 'object') stack.push(v as any);
      }
    }
    return undefined;
  };

  // Função para extrair dados do cliente
  const getCustomerData = (order: any) => {
    if (order.customer_data) {
      try {
        const customerData = typeof order.customer_data === 'string' 
          ? JSON.parse(order.customer_data) 
          : order.customer_data;
        
        return {
          name: customerData.name || customerData.full_name || findNestedValue(customerData, ['name','full_name']) || 'N/A',
          email: customerData.email || findNestedValue(customerData, ['email']) || 'N/A',
          phone: customerData.phone || customerData.phone_number || findNestedValue(customerData, ['phone','phone_number']) || 'N/A',
          document: customerData.document || customerData.cpf || findNestedValue(customerData, ['document','cpf']) || 'N/A'
        };
      } catch (e) {
        console.error('Erro ao parsear customer_data:', e);
        return {
          name: 'N/A',
          email: 'N/A', 
          phone: 'N/A',
          document: 'N/A'
        };
      }
    }
    
    const name = order.customer_name || order.profiles?.full_name || findNestedValue(order.payment_data, ['name','full_name']) || findNestedValue(order.webhook_data, ['name','full_name']) || 'N/A';
    const email = order.customer_email || order.profiles?.email || findNestedValue(order.payment_data, ['email']) || findNestedValue(order.webhook_data, ['email']) || 'N/A';
    const phone = order.customer_phone || findNestedValue(order.payment_data, ['phone','phone_number']) || findNestedValue(order.webhook_data, ['phone','phone_number']) || 'N/A';
    const document = order.customer_document || findNestedValue(order.payment_data, ['document','cpf']) || findNestedValue(order.webhook_data, ['document','cpf']) || 'N/A';
    return { name, email, phone, document };
  };

  const handlePreviousPage = () => {
    if (hasPreviousPage) {
      setCurrentPage(prev => prev - 1);
    }
  };

  const handleNextPage = () => {
    if (hasNextPage) {
      setCurrentPage(prev => prev + 1);
    }
  };

  // Função para mapear status
  const mapStatus = (status: string) => {
    const statusMap: { [key: string]: string } = {
      'pending': 'Pendente',
      'paid': 'Pago',
      'processing': 'Processando',
      'shipped': 'Enviado',
      'delivered': 'Entregue',
      'cancelled': 'Cancelado',
      'expired': 'Expirado'
    };
    
    return statusMap[status] || status;
  };

  const filteredOrders = orders
    .filter(order => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      const customerData = getCustomerData(order);
      return (
        order.id.toLowerCase().includes(query) ||
        (order.payment_id && order.payment_id.toLowerCase().includes(query)) ||
        (order.abacatepay_id && order.abacatepay_id.toLowerCase().includes(query)) ||
        customerData.name.toLowerCase().includes(query) ||
        customerData.email.toLowerCase().includes(query)
      );
    })
    .filter(order => {
      if (statusFilter === 'all') return true;
      return (order.payment_status || order.status) === statusFilter;
    })
    .filter(order => {
      const created = new Date(order.created_at).getTime();
      const start = reportFilters.dateRange.start.getTime();
      const end = reportFilters.dateRange.end.getTime();
      return created >= start && created <= end;
    })
    .filter(order => {
      if (!reportFilters.status || reportFilters.status.length === 0) return true;
      return reportFilters.status.includes((order.payment_status || 'pending') as PaymentStatus);
    })
    .filter(order => {
      if (!reportFilters.gateway || reportFilters.gateway.length === 0) return true;
      const isPix = order.payment_method === 'pix';
      const isAbacate = Boolean(order.abacatepay_id);
      const isManual = order.payment_method == null;
      return (
        (reportFilters.gateway.includes('pix') && isPix) ||
        (reportFilters.gateway.includes('abacatepay') && isAbacate) ||
        (reportFilters.gateway.includes('manual') && isManual)
      );
    });

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'paid':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'processing':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'shipped':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'delivered':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'expired':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const openOrderDetails = (order: any) => {
    setSelectedOrder(order);
  };

  const verificarPagamento = async () => {
    if (!selectedOrder) return;
    
    setIsSimulating(true);
    
    try {
      const paymentId = selectedOrder.payment_id || selectedOrder.abacatepay_id;
      
      if (!paymentId) {
        toast({
          title: "Erro",
          description: "ID de pagamento não encontrado",
          variant: "destructive",
        });
        return;
      }

      const res = await fetch(`/api/abacatepay/consultar-cobranca/${paymentId}`);
      if (!res.ok) {
        throw new Error('Falha ao consultar cobrança');
      }
      const data = await res.json();
      const status = data?.status || 'pending';
      toast({
        title: 'Consulta realizada',
        description: status === 'paid' ? 'Cobrança está paga' : `Status atual: ${status}`
      });
    } catch (error) {
      console.error('Erro na verificação:', error);
      toast({
        title: "Erro",
        description: "Erro ao consultar cobrança",
        variant: "destructive",
      });
    } finally {
      setIsSimulating(false);
    }
  };

  // Funções para seleção múltipla
  const handleOrderSelection = (orderId: string, checked: boolean) => {
    if (checked) {
      setSelectedOrders(prev => [...prev, orderId]);
    } else {
      setSelectedOrders(prev => prev.filter(id => id !== orderId));
    }
  };

  const handleSelectAllOrders = (checked: boolean) => {
    setSelectAllOrders(checked);
    if (checked) {
      setSelectedOrders(filteredOrders.map(order => order.id));
    } else {
      setSelectedOrders([]);
    }
  };

  // Função para excluir pedidos selecionados
  const deleteSelectedOrders = async () => {
    if (selectedOrders.length === 0) return;

    const confirmDelete = window.confirm(
      `Tem certeza que deseja excluir ${selectedOrders.length} pedido(s)? Esta ação não pode ser desfeita.`
    );

    if (!confirmDelete) return;

    try {
      const { error } = await supabase
        .from('orders')
        .delete()
        .in('id', selectedOrders);

      if (error) {
        console.error('Erro ao excluir pedidos:', error);
        toast({
          title: "Erro",
          description: "Erro ao excluir pedidos selecionados",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Sucesso",
          description: `${selectedOrders.length} pedido(s) excluído(s) com sucesso!`,
        });
        
        // Limpar seleção
        setSelectedOrders([]);
        setSelectAllOrders(false);
      }
    } catch (error) {
      console.error('Erro ao excluir pedidos:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado ao excluir pedidos",
        variant: "destructive",
      });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const normalizeAmount = (value: number | null | undefined) => {
    if (!value || isNaN(Number(value))) return 0;
    const n = Number(value);
    return n >= 1000 ? n / 100 : n;
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

  const resolveOrderItems = (order: any) => {
    let items: any[] = [];
    if (order.order_items && order.order_items.length > 0) {
      items = order.order_items;
    } else if (order.items) {
      try {
        const itemsData = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
        items = Array.isArray(itemsData) ? itemsData : [];
      } catch (e) {
        items = [];
      }
    }
    return items;
  };

  const downloadOrderPDF = (order: any) => {
    const customer = getCustomerData(order);
    const items = resolveOrderItems(order);
    const idDisplay = (order.payment_id && order.payment_id.startsWith('pix_char_')) 
      ? order.payment_id 
      : (order.external_id || order.abacatepay_id || order.id);
    const totalFmt = formatCurrency(normalizeAmount(order.total_amount ?? order.total));
    const statusFmt = mapStatus(order.payment_status || order.status);
    const createdFmt = formatDate(order.created_at);
    const updatedFmt = order.updated_at ? new Date(order.updated_at).toLocaleString('pt-BR') : 'N/A';
    const address = order.shippingAddress || {};
    const addressLines = [address.street, address.city, address.state, address.zipCode].filter(Boolean).join(', ');

    const itemsHtml = items.map((item: any, index: number) => {
      const itemName = item.products?.name || item.product_name || item.nome || item.title || item.name || `Item ${index + 1}`;
      const itemSize = item.size || item.tamanho;
      const itemQuantity = item.quantity || item.quantidade || 1;
      const itemPriceRaw = item.price || item.unit_price || item.preco || item.preco_unitario || 0;
      const itemTotalRaw = item.total_price || item.total || (itemPriceRaw * itemQuantity);
      const itemPrice = formatCurrency(normalizeAmount(itemPriceRaw));
      const itemTotal = formatCurrency(normalizeAmount(itemTotalRaw));
      return `
        <div class="flex justify-between items-start py-3 ${index < items.length - 1 ? 'border-b border-gray-200' : ''}">
          <div class="flex-1">
            <p class="font-bold text-gray-900 mb-1">${itemName}</p>
            ${itemSize ? `<p class="text-sm text-gray-600">Tamanho: ${itemSize}</p>` : ''}
          </div>
          <div class="text-right ml-4">
            <p class="text-sm text-gray-900 mb-1">Qtd: ${itemQuantity}</p>
            <p class="text-sm text-gray-900 mb-1">${itemPrice} cada</p>
            <p class="font-bold text-gray-900">Total: ${itemTotal}</p>
          </div>
        </div>
      `;
    }).join('');

    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Pedido ${order.id}</title>
          <link rel="stylesheet" href="/src/index.css" />
          <style>
            @page { size: A4; margin: 16mm; }
            body { background: #fff; }
          </style>
        </head>
        <body>
          <div class="max-w-3xl mx-auto space-y-6">
            <div class="border border-gray-200 rounded-lg p-4 shadow-sm">
              <h1 class="text-xl font-bold text-gray-900">Cabeçalho do Pedido</h1>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 text-sm">
                <p><span class="font-bold text-gray-900">ID:</span> <span class="font-mono">${order.id}</span></p>
                <p><span class="font-bold text-gray-900">Transação:</span> <span class="font-mono">${idDisplay}</span></p>
                <p><span class="font-bold text-gray-900">Status:</span> ${statusFmt}</p>
                <p><span class="font-bold text-gray-900">Total:</span> ${totalFmt}</p>
                <p><span class="font-bold text-gray-900">Criado em:</span> ${createdFmt}</p>
                <p><span class="font-bold text-gray-900">Atualizado em:</span> ${updatedFmt}</p>
              </div>
            </div>

            <div>
              <h2 class="text-base font-semibold text-gray-900 mb-3">Informações do Cliente</h2>
              <div class="bg-white border border-gray-200 rounded-lg p-4 shadow-sm space-y-2.5 text-sm">
                <p><span class="font-bold text-gray-900">Nome:</span> <span class="text-gray-900">${customer.name}</span></p>
                <p><span class="font-bold text-gray-900">Email:</span> <span class="text-gray-900">${customer.email}</span></p>
                <p><span class="font-bold text-gray-900">Telefone:</span> <span class="text-gray-900">${formatPhone(customer.phone)}</span></p>
                <p><span class="font-bold text-gray-900">Documento:</span> <span class="text-gray-900">${formatDocument(customer.document)}</span></p>
                <p><span class="font-bold text-gray-900">Entrega:</span> <span class="text-gray-900">${addressLines || 'N/A'}</span></p>
              </div>
            </div>

            <div>
              <h2 class="text-base font-semibold text-gray-900 mb-3">Detalhes dos Itens</h2>
              <div class="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                ${itemsHtml}
                <div class="mt-4 pt-3 border-t border-gray-300 text-sm">
                  <div class="flex justify-between items-center">
                    <span>Total de Itens:</span>
                    <span>${items.reduce((sum: number, it: any) => sum + (it.quantity || it.quantidade || 0), 0)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div class="text-xs text-gray-500">Gerado em ${new Date().toLocaleString('pt-BR')}</div>
          </div>
          <script>
            window.onload = () => setTimeout(() => window.print(), 300);
          </script>
        </body>
      </html>
    `;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
  };

  const downloadOrderCSV = (order: any) => {
    const customer = getCustomerData(order);
    const items = resolveOrderItems(order);
    const idDisplay = (order.payment_id && order.payment_id.startsWith('pix_char_')) 
      ? order.payment_id 
      : (order.external_id || order.abacatepay_id || order.id);
    const totalFmt = formatCurrency(normalizeAmount(order.total_amount ?? order.total));
    const statusFmt = mapStatus(order.payment_status || order.status);
    const createdFmt = formatDate(order.created_at);
    const updatedFmt = order.updated_at ? new Date(order.updated_at).toLocaleString('pt-BR') : 'N/A';
    const address = order.shippingAddress || {};
    const addressLines = [address.street, address.city, address.state, address.zipCode].filter(Boolean).join(', ');

    const lines: string[] = [];
    lines.push('Cabeçalho do Pedido');
    lines.push(['ID', String(order.id)].join(','));
    lines.push(['Transação', String(idDisplay)].join(','));
    lines.push(['Status', String(statusFmt)].join(','));
    lines.push(['Total', String(totalFmt)].join(','));
    lines.push(['Criado em', String(createdFmt)].join(','));
    lines.push(['Atualizado em', String(updatedFmt)].join(','));
    lines.push('');
    lines.push('Informações do Cliente');
    lines.push(['Nome', String(customer.name)].join(','));
    lines.push(['Email', String(customer.email)].join(','));
    lines.push(['Telefone', String(formatPhone(customer.phone))].join(','));
    lines.push(['Documento', String(formatDocument(customer.document))].join(','));
    lines.push(['Entrega', String(addressLines || 'N/A')].join(','));
    lines.push('');
    lines.push('Detalhes dos Itens');
    lines.push(['Nome','Tamanho','Qtd','Preço Unitário','Total'].join(','));
    items.forEach((item: any, index: number) => {
      const itemName = item.products?.name || item.product_name || item.nome || item.title || item.name || `Item ${index + 1}`;
      const itemSize = item.size || item.tamanho || '';
      const itemQuantity = item.quantity || item.quantidade || 1;
      const itemPriceRaw = item.price || item.unit_price || item.preco || item.preco_unitario || 0;
      const itemTotalRaw = item.total_price || item.total || (itemPriceRaw * itemQuantity);
      const itemPrice = normalizeAmount(itemPriceRaw);
      const itemTotal = normalizeAmount(itemTotalRaw);
      lines.push([
        String(itemName),
        String(itemSize),
        String(itemQuantity),
        String(itemPrice),
        String(itemTotal)
      ].join(','));
    });
    lines.push(['Total de Itens', String(items.reduce((sum: number, it: any) => sum + (it.quantity || it.quantidade || 0), 0))].join(','));
    const instructions = [
      '==================================================',
      'PRD: Instruções para Abrir Corretamente o Relatório no Excel (Brasil)',
      `Arquivo: pedido_${order.id}_${ts}.csv`,
      '==================================================',
      '',
      'PROBLEMA:',
      'Ao abrir o arquivo CSV diretamente no Microsoft Excel (especialmente versões em português do Brasil),',
      'os caracteres acentuados (como "ç", "ã", "é") aparecem corrompidos (ex: "CabeÃ§alho").',
      'Isso ocorre porque o Excel, por padrão, abre arquivos .csv usando a codificação ANSI/Windows-1252,',
      'enquanto o arquivo original está em UTF-8 SEM BOM (Byte Order Mark).',
      '',
      'SOLUÇÃO RECOMENDADA:',
      'Para visualizar corretamente os dados com acentuação, datas e valores monetários no Excel,',
      'siga um dos métodos abaixo:',
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      'MÉTODO 1: Usar a ferramenta de importação do Excel (RECOMENDADO)',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '',
      '1. Abra o Microsoft Excel (em branco).',
      '2. Vá em:   DADOS  →  Obter Dados  →  Do Texto/CSV.',
      `3. Selecione o arquivo "pedido_${order.id}_${ts}.csv".`,
      '4. Na janela de visualização:',
      '   - Certifique-se de que "Codificação" está como: 65001: Unicode (UTF-8)',
      '   - Delimitador: Vírgula',
      '5. Clique em "Carregar".',
      '6. Pronto! Os dados aparecerão com acentos, datas e números corretos.',
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      'MÉTODO 2: Salvar o CSV com UTF-8 com BOM (para abertura direta)',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '',
      'Se desejar abrir o arquivo com duplo clique e já ver os dados corretos:',
      '',
      '1. Abra o arquivo CSV em um editor que suporte codificação (ex: Notepad++, VS Code).',
      '2. Salve-o novamente com a opção: UTF-8 com BOM.',
      '   - No Bloco de Notas (Windows 10/11): Salvar como → Codificação: UTF-8 (já inclui BOM).',
      '   - No Notepad++: Codificação → UTF-8-BOM → Salvar.',
      '3. Agora, ao abrir com duplo clique no Excel, os acentos estarão corretos.',
      '',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      'OBSERVAÇÕES IMPORTANTES:',
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
      '',
      '• O campo "total_amount" está em CENTAVOS (ex: 45000 = R$ 450,00).',
      '• A data/hora está em UTC (ex: 2025-11-15T02:56:30Z).',
      '  → Para converter para horário de Brasília, subtraia 3 horas.',
      '• Pedidos com "payment_status" = "pending" ainda não foram pagos.',
      '',
      '==================================================',
      'Suporte: equipe@seudominio.com.br',
      '',
    ].join('\n');
    const csv = instructions + '\n' + lines.join('\n');
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `pedido_${order.id}_${ts}.csv`;
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadOrderCSVExcelBR = (order: any) => {
    const customer = getCustomerData(order);
    const items = resolveOrderItems(order);
    const idDisplay = (order.payment_id && order.payment_id.startsWith('pix_char_')) 
      ? order.payment_id 
      : (order.external_id || order.abacatepay_id || order.id);
    const valor = Number(order.total_amount ?? order.total ?? 0);
    const brlTotal = valor >= 1000 ? valor / 100 : valor;
    const statusFmt = mapStatus(order.payment_status || order.status);
    const createdBRT = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }).format(new Date(order.created_at));
    const updatedBRT = order.updated_at ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }).format(new Date(order.updated_at)) : '';
    const address = order.shippingAddress || {};
    const addressLines = [address.street, address.city, address.state, address.zipCode].filter(Boolean).join(', ');

    const quote = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const formatBRL = (n: number) => new Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' }).format(n);

    const header = [
      'Pedido ID','Transação','Status','Total (R$)','Criado (Brasília)','Atualizado (Brasília)','Cliente','Email','Telefone','Documento','Entrega'
    ];
    const orderRow = [
      quote(String(order.id)),
      quote(String(idDisplay)),
      quote(String(statusFmt)),
      quote(formatBRL(brlTotal)),
      quote(String(createdBRT)),
      quote(String(updatedBRT || '')),
      quote(String(customer.name)),
      quote(String(customer.email)),
      quote(String(formatPhone(customer.phone))),
      quote(String(formatDocument(customer.document))),
      quote(String(addressLines || '')),
    ].join(',');

    const itemHeader = ['Item','Tamanho','Qtd','Preço Unitário (R$)','Total (R$)'];
    const itemRows = items.map((item: any, index: number) => {
      const itemName = item.products?.name || item.product_name || item.nome || item.title || item.name || `Item ${index + 1}`;
      const itemSize = item.size || item.tamanho || '';
      const qty = item.quantity || item.quantidade || 1;
      const pRaw = item.price || item.unit_price || item.preco || item.preco_unitario || 0;
      const tRaw = item.total_price || item.total || (pRaw * qty);
      const p = (Number(pRaw) >= 1000 ? Number(pRaw)/100 : Number(pRaw));
      const t = (Number(tRaw) >= 1000 ? Number(tRaw)/100 : Number(tRaw));
      return [quote(String(itemName)), quote(String(itemSize)), quote(String(qty)), quote(formatBRL(p)), quote(formatBRL(t))].join(',');
    });

    const totalItems = items.reduce((sum: number, it: any) => sum + (it.quantity || it.quantidade || 0), 0);
    const lines = [header.join(','), orderRow, '', itemHeader.join(','), ...itemRows, ['', quote('Total de Itens'), quote(String(totalItems))].join(',')];
    const csv = lines.join('\n');
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `pedido_excel_br_${order.id}_${ts}.csv`;
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex flex-col lg:flex-row min-h-screen bg-gray-100">
        <AdminSidebar />
        <div className="flex-1 flex items-center justify-center w-full lg:w-auto pt-20 lg:pt-4">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Carregando pedidos...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col lg:flex-row min-h-screen bg-gray-100">
        <AdminSidebar />
        <div className="flex-1 flex items-center justify-center w-full lg:w-auto pt-20 lg:pt-4">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-4" />
            <p>Erro ao carregar pedidos: {error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-gray-100">
      <AdminSidebar />

      <div className="flex-1 p-4 sm:p-6 lg:p-8 w-full lg:w-auto pt-20 lg:pt-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Pedidos</h1>
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm text-gray-600">
              {isConnected ? 'Conectado' : 'Desconectado'}
            </span>
          </div>
        </div>

        {/* Cards de estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total de Pedidos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">
                <span>Desde o início das vendas</span>
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Pedidos Recentes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{recentOrders.length}</div>
              <p className="text-xs text-muted-foreground">
                <span>Nas últimas 24 horas</span>
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(normalizeAmount(stats.totalRevenue))}</div>
              <p className="text-xs text-muted-foreground">
                <span>Pedidos pagos</span>
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Aguardando Atenção</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{alertOrders.length}</div>
              <p className="text-xs text-muted-foreground">
                <span className="text-yellow-500">Pedidos pendentes há 2+ dias</span>
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              className="pl-10"
              placeholder="Buscar por ID, nome, email ou ID AbacatePay..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Status</SelectItem>
              <SelectItem value="pending">Pendente</SelectItem>
              <SelectItem value="paid">Pago</SelectItem>
              <SelectItem value="processing">Processando</SelectItem>
              <SelectItem value="shipped">Enviado</SelectItem>
              <SelectItem value="delivered">Entregue</SelectItem>
              <SelectItem value="cancelled">Cancelado</SelectItem>
              <SelectItem value="expired">Expirado</SelectItem>
            </SelectContent>
          </Select>

          {/* Indicador de conexão */}
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-md">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
            <span className="text-sm text-gray-600">
              {isConnected ? 'Tempo Real Ativo' : 'Desconectado'}
            </span>
          </div>
        </div>

        <div className="mb-6">
          <Filters filters={reportFilters} onChange={setReportFilters} applying={exporting} onApply={() => setReportFilters({ ...reportFilters })} />
        </div>

        {/* Lista de pedidos */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Lista de Pedidos</CardTitle>
              <CardDescription>
                Gerencie todos os pedidos em um só lugar • Atualizações automáticas em tempo real
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Button
                onClick={() => exportCSV({ rows: filteredOrders.map(o => ({
                  id: String(o.id),
                  created_at: o.created_at,
                  payment_status: o.payment_status || o.status,
                  payment_method: o.payment_method ?? null,
                  total_amount: Number(o.total_amount ?? o.total ?? 0),
                  order_type: o.order_type ?? null,
                })) }, reportFilters)}
                disabled={exporting}
                className="bg-butterfly-orange text-white hover:bg-butterfly-orange/90"
              >
                {exporting ? 'Exportando...' : 'Exportar CSV'}
              </Button>
              <Button
                onClick={() => exportCSVExcelBR({ rows: filteredOrders.map(o => ({
                  id: String(o.id),
                  created_at: o.created_at,
                  payment_status: o.payment_status || o.status,
                  payment_method: o.payment_method ?? null,
                  total_amount: Number(o.total_amount ?? o.total ?? 0),
                  order_type: o.order_type ?? null,
                })) }, reportFilters)}
                disabled={exporting}
                className="bg-butterfly-orange text-white hover:bg-butterfly-orange/90"
              >
                {exporting ? 'Exportando...' : 'Exportar CSV (Excel BR)'}
              </Button>
              {loading && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando...
              </div>
              )}
            </div>
          </CardHeader>
          
          <CardContent>
            {filteredOrders.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">Nenhum pedido encontrado</p>
              </div>
            ) : (
              <>
                {/* Controles de seleção múltipla */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-gray-50 rounded-lg mb-4 gap-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="select-all-orders"
                      checked={selectAllOrders}
                      onCheckedChange={handleSelectAllOrders}
                    />
                    <label htmlFor="select-all-orders" className="text-sm font-medium">
                      Selecionar todos ({filteredOrders.length})
                    </label>
                  </div>
                  {selectedOrders.length > 0 && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={deleteSelectedOrders}
                      className="flex items-center gap-2 w-full sm:w-auto"
                    >
                      <Trash2 className="h-4 w-4" />
                      Excluir ({selectedOrders.length})
                    </Button>
                  )}
                </div>
                
                {/* Visualização Desktop - Tabela */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full min-w-[1200px]">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-4 font-medium w-12"></th>
                        <th className="text-left p-4 font-medium whitespace-nowrap">ID</th>
                        <th className="text-left p-4 font-medium min-w-[180px]">Cliente</th>
                        <th className="text-left p-4 font-medium whitespace-nowrap">Data</th>
                        <th className="text-left p-4 font-medium whitespace-nowrap">Tipo</th>
                        <th className="text-left p-4 font-medium whitespace-nowrap">Itens</th>
                        <th className="text-left p-4 font-medium whitespace-nowrap">Total</th>
                        <th className="text-left p-4 font-medium whitespace-nowrap">Status</th>
                        <th className="text-left p-4 font-medium whitespace-nowrap">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.map((order) => (
                        <tr key={order.id} className="border-b hover:bg-gray-50">
                          <td className="p-4">
                            <Checkbox
                              checked={selectedOrders.includes(order.id)}
                              onCheckedChange={(checked) => handleOrderSelection(order.id, checked as boolean)}
                            />
                          </td>
                          <td className="p-4">
                            <div className="font-mono text-sm whitespace-nowrap">
                              {(order.payment_id && order.payment_id.startsWith('pix_char_')) 
                                ? order.payment_id.slice(0, 15) 
                                : (order.abacatepay_id || order.id).slice(0, 8)}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="min-w-[180px]">
                              <div className="font-medium text-sm truncate">
                                {getCustomerData(order).name}
                              </div>
                              <div className="text-sm text-gray-500 truncate">
                                {getCustomerData(order).email}
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-sm whitespace-nowrap">
                            {formatDate(order.created_at)}
                          </td>
                          <td className="p-4">
                            <div className="text-sm whitespace-nowrap">
                              {order.order_type === 'ticket' ? 'Ingresso' : 
                               order.order_type === 'product' ? 'Produto' : 
                               'Misto'}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="text-sm whitespace-nowrap">
                              <span className="font-medium">
                                {order.order_items?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || 0} itens
                              </span>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="font-medium text-sm whitespace-nowrap">
                              {formatCurrency(normalizeAmount(order.total_amount ?? order.total))}
                            </div>
                          </td>
                          <td className="p-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap ${getStatusBadgeClass(order.payment_status || order.status)}`}>
                              {mapStatus(order.payment_status || order.status)}
                            </span>
                          </td>
                          <td className="p-4">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => openOrderDetails(order)}
                                >
                                  Detalhes
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                                <DialogHeader className="pb-4">
                                  <DialogTitle className="text-xl font-bold text-gray-900">Detalhes do Pedido</DialogTitle>
                                  <DialogDescription className="text-sm text-gray-500 mt-1">
                                    {selectedOrder && (
                                      <>Informações completas do pedido {
                                        (selectedOrder.payment_id && selectedOrder.payment_id.startsWith('pix_char_')) 
                                          ? selectedOrder.payment_id 
                                          : (selectedOrder.external_id || selectedOrder.abacatepay_id || `pedido_${selectedOrder.id.slice(0, 13)}`)
                                      }</>
                                    )}
                                  </DialogDescription>
                                </DialogHeader>
                                
                                {selectedOrder && (
                                  <div className="space-y-6">
                                    {/* Informações do Cliente */}
                                    <div>
                                      <h3 className="text-base font-semibold text-gray-900 mb-3">Informações do Cliente</h3>
                                      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm space-y-2.5">
                                        <p className="text-sm"><span className="font-bold text-gray-900">Nome:</span> <span className="text-gray-900">{getCustomerData(selectedOrder).name}</span></p>
                                        <p className="text-sm"><span className="font-bold text-gray-900">Email:</span> <span className="text-gray-900">{getCustomerData(selectedOrder).email}</span></p>
                                        <p className="text-sm"><span className="font-bold text-gray-900">Telefone:</span> <span className="text-gray-900">{formatPhone(getCustomerData(selectedOrder).phone)}</span></p>
                                        <p className="text-sm"><span className="font-bold text-gray-900">Documento:</span> <span className="text-gray-900">{formatDocument(getCustomerData(selectedOrder).document)}</span></p>
                                      </div>
                                    </div>

                                    {/* Informações do Pedido */}
                                    <div>
                                      <h3 className="text-base font-semibold text-gray-900 mb-3">Informações do Pedido</h3>
                                      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm space-y-2.5">
                                        <p className="text-sm"><span className="font-bold text-gray-900">ID:</span> <span className="text-gray-900 font-mono">{selectedOrder.id}</span></p>
                                        <p className="text-sm"><span className="font-bold text-gray-900">AbacatePay ID:</span> <span className="text-gray-900">{
                                          selectedOrder.payment_id || selectedOrder.external_id || selectedOrder.abacatepay_id || 'N/A'
                                        }</span></p>
                                        <p className="text-sm"><span className="font-bold text-gray-900">Total:</span> <span className="text-gray-900">{formatCurrency(normalizeAmount(selectedOrder.total_amount ?? selectedOrder.total))}</span></p>
                                        <p className="text-sm"><span className="font-bold text-gray-900">Status:</span> <span className="text-gray-900">{mapStatus(selectedOrder.payment_status || selectedOrder.status)}</span></p>
                                        <p className="text-sm"><span className="font-bold text-gray-900">Data e Hora:</span> <span className="text-gray-900">{formatDate(selectedOrder.created_at)}</span></p>
                                        {selectedOrder.updated_at && (
                                          <p className="text-sm"><span className="font-bold text-gray-900">Atualizado em:</span> <span className="text-gray-900">{new Date(selectedOrder.updated_at).toLocaleString('pt-BR')}</span></p>
                                        )}
                                        {selectedOrder.additional_notes && (
                                          <p className="text-sm"><span className="font-bold text-gray-900">Observações:</span> <span className="text-gray-900">{selectedOrder.additional_notes}</span></p>
                                        )}
                                      </div>
                                    </div>

                                    {/* Itens do Pedido */}
                                    {(() => {
                                      // Tentar obter itens de order_items ou do campo items (JSON)
                                      let items: any[] = [];
                                      if (selectedOrder.order_items && selectedOrder.order_items.length > 0) {
                                        items = selectedOrder.order_items;
                                      } else if (selectedOrder.items) {
                                        // Se order_items não existe, tentar usar o campo items (JSON)
                                        try {
                                          const itemsData = typeof selectedOrder.items === 'string' 
                                            ? JSON.parse(selectedOrder.items) 
                                            : selectedOrder.items;
                                          items = Array.isArray(itemsData) ? itemsData : [];
                                        } catch (e) {
                                          console.error('Erro ao parsear items:', e);
                                          items = [];
                                        }
                                      }

                                      if (items.length > 0) {
                                        return (
                                          <div>
                                            <h3 className="text-base font-semibold text-gray-900 mb-3">Itens do Pedido</h3>
                                            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                                              <div className="space-y-0">
                                                {(() => {
                                                  return items.map((item: any, index: number) => {
                                                      // Normalizar dados do item
                                                      const itemName = item.products?.name || item.product_name || item.nome || item.title || item.name || `Item ${index + 1}`;
                                                      const itemSize = item.size || item.tamanho;
                                                      const itemCategory = item.products?.category || item.category || item.categoria;
                                                      const itemQuantity = item.quantity || item.quantidade || 1;
                                                      const itemPriceRaw = item.price || item.unit_price || item.preco || item.preco_unitario || 0;
                                                      const itemTotalRaw = item.total_price || item.total || (itemPriceRaw * itemQuantity);
                                                      const itemPrice = normalizeAmount(itemPriceRaw);
                                                      const itemTotal = normalizeAmount(itemTotalRaw);

                                                      return (
                                                        <div key={item.id || item.product_id || index} className={`flex justify-between items-start py-3 ${index < items.length - 1 ? 'border-b border-gray-200' : ''}`}>
                                                          <div className="flex-1">
                                                            <p className="font-bold text-gray-900 mb-1">
                                                              {itemName}
                                                            </p>
                                                            {itemSize && (
                                                              <p className="text-sm text-gray-600">Tamanho: {itemSize}</p>
                                                            )}
                                                            {itemCategory && (
                                                              <p className="text-sm text-gray-600">Categoria: {itemCategory}</p>
                                                            )}
                                                          </div>
                                                          <div className="text-right ml-4">
                                                            <p className="text-sm text-gray-900 mb-1">Qtd: {itemQuantity}</p>
                                                            <p className="text-sm text-gray-900 mb-1">
                                                              {formatCurrency(itemPrice)} cada
                                                            </p>
                                                            <p className="font-bold text-gray-900">
                                                              Total: {formatCurrency(itemTotal)}
                                                            </p>
                                                          </div>
                                                        </div>
                                                      );
                                                    });
                                                })()}
                                              </div>
                                              <div className="mt-4 pt-3 border-t border-gray-300">
                                                <div className="flex justify-between items-center text-sm text-gray-900">
                                                  <span>Total de Itens:</span>
                                                  <span>{items.reduce((sum: number, item: any) => sum + (item.quantity || item.quantidade || 0), 0)}</span>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      }
                                      return null;
                                    })()}

                                    {/* Dados do Webhook */}
                                    {selectedOrder.webhook_data && (
                                      <div>
                                        <h3 className="text-base font-semibold text-gray-900 mb-3">Dados do Webhook</h3>
                                        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                                          <pre className="text-xs overflow-auto max-h-40 text-gray-900">
                                            {JSON.stringify(selectedOrder.webhook_data, null, 2)}
                                          </pre>
                                        </div>
                                      </div>
                                    )}

                                    {/* Botão Verificar Status */}
                                    <div className="flex items-center justify-between pt-4">
                                      <div className="flex items-center gap-2">
                                        <Button onClick={() => selectedOrder && downloadOrderCSV(selectedOrder)} className="bg-butterfly-orange text-white hover:bg-butterfly-orange/90">Baixar CSV</Button>
                                        <Button onClick={() => selectedOrder && downloadOrderCSVExcelBR(selectedOrder)} className="bg-butterfly-orange text-white hover:bg-butterfly-orange/90">Baixar CSV (Excel BR)</Button>
                                        <Button
                                          onClick={() => selectedOrder && downloadOrderPDF(selectedOrder)}
                                          className="bg-butterfly-orange text-white hover:bg-butterfly-orange/90"
                                        >
                                          Baixar PDF
                                        </Button>
                                      </div>
                                      {((selectedOrder.payment_id && selectedOrder.payment_id.startsWith('pix_char_')) || selectedOrder.abacatepay_id) && 
                                       (selectedOrder.payment_status === 'pending' || selectedOrder.status === 'pending') && (
                                        <Button
                                          onClick={verificarPagamento}
                                          disabled={isSimulating}
                                          className="bg-green-600 hover:bg-green-700 text-white font-medium flex items-center gap-2"
                                        >
                                          {isSimulating ? (
                                            <>
                                              <RefreshCw className="h-4 w-4 animate-spin" />
                                              Verificando...
                                            </>
                                          ) : (
                                            <>
                                              <RefreshCw className="h-4 w-4" />
                                              Verificar Status
                                            </>
                                          )}
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </DialogContent>
                            </Dialog>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Visualização Mobile - Cards */}
                <div className="lg:hidden space-y-4">
                  {filteredOrders.map((order) => (
                    <div key={order.id} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-start gap-3 flex-1">
                          <Checkbox
                            checked={selectedOrders.includes(order.id)}
                            onCheckedChange={(checked) => handleOrderSelection(order.id, checked as boolean)}
                            className="mt-1"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm text-gray-900 truncate">
                              {getCustomerData(order).name}
                            </div>
                            <div className="text-xs text-gray-500 truncate">
                              {getCustomerData(order).email}
                            </div>
                            <div className="font-mono text-xs text-gray-400 mt-1">
                              {(order.payment_id && order.payment_id.startsWith('pix_char_')) 
                                ? order.payment_id.slice(0, 15) 
                                : (order.abacatepay_id || order.id).slice(0, 8)}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                        <div>
                          <span className="text-gray-500 text-xs">Data:</span>
                          <div className="text-gray-900 text-xs">
                            {new Date(order.created_at).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: '2-digit'
                            })}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-500 text-xs">Tipo:</span>
                          <div className="text-gray-900 text-xs">
                            {order.order_type === 'ticket' ? 'Ingresso' : 
                             order.order_type === 'product' ? 'Produto' : 
                             'Misto'}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-500 text-xs">Itens:</span>
                          <div className="text-gray-900 text-xs font-medium">
                            {order.order_items?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || 0}
                          </div>
                        </div>
                        <div>
                          <span className="text-gray-500 text-xs">Total:</span>
                          <div className="text-gray-900 text-xs font-medium">
                            {formatCurrency(normalizeAmount(order.total_amount ?? order.total))}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-3 border-t border-gray-100">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusBadgeClass(order.payment_status || order.status)}`}>
                          {mapStatus(order.payment_status || order.status)}
                        </span>
                        
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => openOrderDetails(order)}
                              className="text-xs"
                            >
                              Ver Detalhes
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader className="pb-4">
                              <DialogTitle className="text-xl font-bold text-gray-900">Detalhes do Pedido</DialogTitle>
                              <DialogDescription className="text-sm text-gray-500 mt-1">
                                {selectedOrder && (
                                  <>Informações completas do pedido {
                                    (selectedOrder.payment_id && selectedOrder.payment_id.startsWith('pix_char_')) 
                                      ? selectedOrder.payment_id 
                                      : (selectedOrder.external_id || selectedOrder.abacatepay_id || `pedido_${selectedOrder.id.slice(0, 13)}`)
                                  }</>
                                )}
                              </DialogDescription>
                            </DialogHeader>
                            
                            {selectedOrder && (
                              <div className="space-y-6">
                                {/* Informações do Cliente */}
                                <div>
                                  <h3 className="text-base font-semibold text-gray-900 mb-3">Informações do Cliente</h3>
                                  <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm space-y-2.5">
                                    <p className="text-sm"><span className="font-bold text-gray-900">Nome:</span> <span className="text-gray-900">{getCustomerData(selectedOrder).name}</span></p>
                                    <p className="text-sm"><span className="font-bold text-gray-900">Email:</span> <span className="text-gray-900">{getCustomerData(selectedOrder).email}</span></p>
                                    <p className="text-sm"><span className="font-bold text-gray-900">Telefone:</span> <span className="text-gray-900">{formatPhone(getCustomerData(selectedOrder).phone)}</span></p>
                                    <p className="text-sm"><span className="font-bold text-gray-900">Documento:</span> <span className="text-gray-900">{formatDocument(getCustomerData(selectedOrder).document)}</span></p>
                                  </div>
                                </div>

                                {/* Informações do Pedido */}
                                <div>
                                  <h3 className="text-base font-semibold text-gray-900 mb-3">Informações do Pedido</h3>
                                  <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm space-y-2.5">
                                    <p className="text-sm"><span className="font-bold text-gray-900">ID:</span> <span className="text-gray-900 font-mono text-xs break-all">{selectedOrder.id}</span></p>
                                    <p className="text-sm"><span className="font-bold text-gray-900">AbacatePay ID:</span> <span className="text-gray-900 break-all text-xs">{
                                      selectedOrder.payment_id || selectedOrder.external_id || selectedOrder.abacatepay_id || 'N/A'
                                    }</span></p>
                                    <p className="text-sm"><span className="font-bold text-gray-900">Total:</span> <span className="text-gray-900">{formatCurrency(normalizeAmount(selectedOrder.total_amount ?? selectedOrder.total))}</span></p>
                                    <p className="text-sm"><span className="font-bold text-gray-900">Status:</span> <span className="text-gray-900">{mapStatus(selectedOrder.payment_status || selectedOrder.status)}</span></p>
                                    <p className="text-sm"><span className="font-bold text-gray-900">Data e Hora:</span> <span className="text-gray-900">{formatDate(selectedOrder.created_at)}</span></p>
                                    {selectedOrder.updated_at && (
                                      <p className="text-sm"><span className="font-bold text-gray-900">Atualizado em:</span> <span className="text-gray-900">{new Date(selectedOrder.updated_at).toLocaleString('pt-BR')}</span></p>
                                    )}
                                    {selectedOrder.additional_notes && (
                                      <p className="text-sm"><span className="font-bold text-gray-900">Observações:</span> <span className="text-gray-900">{selectedOrder.additional_notes}</span></p>
                                    )}
                                  </div>
                                </div>

                                {/* Itens do Pedido */}
                                {(() => {
                                  // Tentar obter itens de order_items ou do campo items (JSON)
                                  let items: any[] = [];
                                  if (selectedOrder.order_items && selectedOrder.order_items.length > 0) {
                                    items = selectedOrder.order_items;
                                  } else if (selectedOrder.items) {
                                    // Se order_items não existe, tentar usar o campo items (JSON)
                                    try {
                                      const itemsData = typeof selectedOrder.items === 'string' 
                                        ? JSON.parse(selectedOrder.items) 
                                        : selectedOrder.items;
                                      items = Array.isArray(itemsData) ? itemsData : [];
                                    } catch (e) {
                                      console.error('Erro ao parsear items:', e);
                                      items = [];
                                    }
                                  }

                                  if (items.length > 0) {
                                    return (
                                      <div>
                                        <h3 className="text-base font-semibold text-gray-900 mb-3">Itens do Pedido</h3>
                                        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                                          <div className="space-y-0">
                                            {(() => {
                                              return items.map((item: any, index: number) => {
                                                  // Normalizar dados do item
                                                  const itemName = item.products?.name || item.product_name || item.nome || item.title || item.name || `Item ${index + 1}`;
                                                  const itemSize = item.size || item.tamanho;
                                                  const itemCategory = item.products?.category || item.category || item.categoria;
                                                  const itemQuantity = item.quantity || item.quantidade || 1;
                                                  const itemPriceRaw = item.price || item.unit_price || item.preco || item.preco_unitario || 0;
                                                  const itemTotalRaw = item.total_price || item.total || (itemPriceRaw * itemQuantity);
                                                  const itemPrice = normalizeAmount(itemPriceRaw);
                                                  const itemTotal = normalizeAmount(itemTotalRaw);

                                                  return (
                                                    <div key={item.id || item.product_id || index} className={`flex justify-between items-start py-3 ${index < items.length - 1 ? 'border-b border-gray-200' : ''}`}>
                                                      <div className="flex-1">
                                                        <p className="font-bold text-gray-900 mb-1">
                                                          {itemName}
                                                        </p>
                                                        {itemSize && (
                                                          <p className="text-sm text-gray-600">Tamanho: {itemSize}</p>
                                                        )}
                                                        {itemCategory && (
                                                          <p className="text-sm text-gray-600">Categoria: {itemCategory}</p>
                                                        )}
                                                      </div>
                                                      <div className="text-right ml-4">
                                                        <p className="text-sm text-gray-900 mb-1">Qtd: {itemQuantity}</p>
                                                        <p className="text-sm text-gray-900 mb-1">
                                                          {formatCurrency(itemPrice)} cada
                                                        </p>
                                                        <p className="font-bold text-gray-900">
                                                          Total: {formatCurrency(itemTotal)}
                                                        </p>
                                                      </div>
                                                    </div>
                                                  );
                                                });
                                            })()}
                                          </div>
                                          <div className="mt-4 pt-3 border-t border-gray-300">
                                            <div className="flex justify-between items-center text-sm text-gray-900">
                                              <span>Total de Itens:</span>
                                              <span>{items.reduce((sum: number, item: any) => sum + (item.quantity || item.quantidade || 0), 0)}</span>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  }
                                  return null;
                                })()}

                                {/* Dados do Webhook */}
                                {selectedOrder.webhook_data && (
                                  <div>
                                    <h3 className="text-base font-semibold text-gray-900 mb-3">Dados do Webhook</h3>
                                    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                                      <pre className="text-xs overflow-auto max-h-40 text-gray-900">
                                        {JSON.stringify(selectedOrder.webhook_data, null, 2)}
                                      </pre>
                                    </div>
                                  </div>
                                )}

                                {/* Botão Verificar Status */}
                                {((selectedOrder.payment_id && selectedOrder.payment_id.startsWith('pix_char_')) || selectedOrder.abacatepay_id) && 
                                 (selectedOrder.payment_status === 'pending' || selectedOrder.status === 'pending') && (
                                  <div className="flex justify-end pt-4">
                                    <Button
                                      onClick={verificarPagamento}
                                      disabled={isSimulating}
                                      className="bg-green-600 hover:bg-green-700 text-white font-medium flex items-center gap-2 w-full sm:w-auto"
                                    >
                                      {isSimulating ? (
                                        <>
                                          <RefreshCw className="h-4 w-4 animate-spin" />
                                          Verificando...
                                        </>
                                      ) : (
                                        <>
                                          <RefreshCw className="h-4 w-4" />
                                          Verificar Status
                                        </>
                                      )}
                                    </Button>
                                  </div>
                                )}
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            
            {/* Rodapé de Paginação */}
            <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
              <div className="text-sm text-gray-600">
                {totalOrders} Resultados - Página {currentPage} de {totalPages}
              </div>
              <div className="flex items-center space-x-2">
                <Button
                   variant="outline"
                   size="sm"
                   onClick={handlePreviousPage}
                   disabled={!hasPreviousPage || loading}
                 >
                   {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Voltar'}
                 </Button>
                 <Button
                   variant="outline"
                   size="sm"
                   onClick={handleNextPage}
                   disabled={!hasNextPage || loading}
                 >
                   {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Próximo'}
                 </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminPedidos;
