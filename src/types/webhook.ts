// Tipos para o sistema de webhooks do AbacatePay

export interface AbacatePayWebhookData {
  id: string;
  idPagamento: string;
  status: 'processado' | 'erro' | 'pendente';
  valor: number; // Valor em centavos
  email: string;
  dataCriacao: string;
  evento: string;
  cliente: {
    nome: string;
    cpf: string;
    telefone: string;
  };
  financeiro: {
    taxaCentavos: number;
    valorLiquidoCentavos: number;
    percentualTaxa: number;
  };
  ambiente: 'producao' | 'desenvolvimento';
  tipoPagamento: 'pix' | 'boleto' | 'cartao';
  payload: any;
  
  // Propriedades calculadas
  valorBrutoReais: number;
  valorLiquidoReais: number;
  taxaReais: number;
  
  // Propriedades do cliente expandidas
  clienteId: string;
  clienteNome: string;
  clienteEmail: string;
  clienteTelefone: string;
  clienteCpfCnpj: string;
  clienteCep: string;
  
  // Propriedades PIX
  pixQrCodeId: string;
  pixQrCodeTipo: string;
  pixQrCodeStatus: string;
  
  // Propriedades de controle
  processed: boolean;
  error_message?: string;
  created_at: string;
  metodoPagamento: string;
  valorBrutoCentavos: number;
  processedAt?: string;
}

export interface WebhookMetrics {
  totalWebhooks: number;
  processados: number;
  erros: number;
  pendentes: number;
  receitaBruta: number;
  taxasTotal: number;
  receitaLiquida: number;
  transacoesPix: number;
  clientesUnicos: number;
}

export interface WebhookData extends AbacatePayWebhookData {
  // Interface que estende AbacatePayWebhookData para compatibilidade
}

export interface WebhookFilters {
  status?: string;
  ambiente?: string;
  tipoPagamento?: string;
  dataInicio?: string;
  dataFim?: string;
}

export interface WebhookTableProps {
  webhooks: WebhookData[];
  loading: boolean;
  onWebhookClick: (webhook: WebhookData) => void;
}

export interface WebhookModalProps {
  webhook: WebhookData | null;
  isOpen: boolean;
  onClose: () => void;
}