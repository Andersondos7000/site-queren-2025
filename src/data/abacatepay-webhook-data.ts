/**
 * 🥑 Dados simulados do AbacatePay baseados na estrutura real
 * Baseado na documentação e estrutura de webhooks do AbacatePay
 */

export interface AbacatePayWebhookData {
  id: string;
  created_at: string;
  processed: boolean;
  error_message?: string;
  source: string;
  event_type: string;
  payload: any;
  
  // Dados processados do payload (mapeados do AbacatePay)
  evento: string;
  ambiente: 'dev' | 'prod';
  pixQrCodeId: string;
  pixQrCodeTipo: string;
  pixQrCodeStatus: string;
  clienteId: string;
  clienteNome: string;
  clienteTelefone: string;
  clienteCpfCnpj: string;
  clienteEmail: string;
  clienteCep: string;
  valorBrutoCentavos: number;
  valorBrutoReais: number;
  taxaCentavos: number;
  taxaReais: number;
  valorLiquidoReais: number;
  percentualTaxa: number;
  metodoPagamento: string;
  processedAt?: string;
}

// Dados simulados baseados na estrutura real do AbacatePay
export const abacatePayWebhookData: AbacatePayWebhookData[] = [
  {
    id: 'webhook_001',
    created_at: '2024-11-01T10:30:00Z',
    processed: true,
    source: 'abacatepay',
    event_type: 'billing.paid',
    payload: {
      event: 'billing.paid',
      data: {
        id: 'bill_abc123def456',
        status: 'paid',
        amount: 2500,
        customer: {
          name: 'João Silva Santos',
          email: 'joao.silva@email.com',
          cpf: '12345678901'
        }
      }
    },
    evento: 'cobranca.paga',
    ambiente: 'prod',
    pixQrCodeId: 'PIX_001_2024',
    pixQrCodeTipo: 'dinamico',
    pixQrCodeStatus: 'pago',
    clienteId: 'cliente_001',
    clienteNome: 'João Silva Santos',
    clienteTelefone: '(11) 99999-1234',
    clienteCpfCnpj: '123.456.789-01',
    clienteEmail: 'joao.silva@email.com',
    clienteCep: '01234-567',
    valorBrutoCentavos: 2500,
    valorBrutoReais: 25.00,
    taxaCentavos: 125,
    taxaReais: 1.25,
    valorLiquidoReais: 23.75,
    percentualTaxa: 5.0,
    metodoPagamento: 'PIX',
    processedAt: '2024-11-01T10:30:15Z'
  },
  {
    id: 'webhook_002',
    created_at: '2024-11-01T11:15:00Z',
    processed: true,
    source: 'abacatepay',
    event_type: 'billing.paid',
    payload: {
      event: 'billing.paid',
      data: {
        id: 'bill_xyz789abc123',
        status: 'paid',
        amount: 5000,
        customer: {
          name: 'Maria Oliveira Costa',
          email: 'maria.oliveira@empresa.com.br',
          cpf: '98765432100'
        }
      }
    },
    evento: 'cobranca.paga',
    ambiente: 'prod',
    pixQrCodeId: 'PIX_002_2024',
    pixQrCodeTipo: 'dinamico',
    pixQrCodeStatus: 'pago',
    clienteId: 'cliente_002',
    clienteNome: 'Maria Oliveira Costa',
    clienteTelefone: '(21) 98888-5678',
    clienteCpfCnpj: '987.654.321-00',
    clienteEmail: 'maria.oliveira@empresa.com.br',
    clienteCep: '20000-123',
    valorBrutoCentavos: 5000,
    valorBrutoReais: 50.00,
    taxaCentavos: 250,
    taxaReais: 2.50,
    valorLiquidoReais: 47.50,
    percentualTaxa: 5.0,
    metodoPagamento: 'PIX',
    processedAt: '2024-11-01T11:15:22Z'
  },
  {
    id: 'webhook_003',
    created_at: '2024-11-01T12:45:00Z',
    processed: false,
    error_message: 'Erro na validação do CPF',
    source: 'abacatepay',
    event_type: 'billing.paid',
    payload: {
      event: 'billing.paid',
      data: {
        id: 'bill_error123',
        status: 'paid',
        amount: 1500,
        customer: {
          name: 'Carlos Pereira',
          email: 'carlos.pereira@teste.com',
          cpf: '00000000000'
        }
      }
    },
    evento: 'cobranca.paga',
    ambiente: 'dev',
    pixQrCodeId: 'PIX_003_2024',
    pixQrCodeTipo: 'dinamico',
    pixQrCodeStatus: 'erro',
    clienteId: 'cliente_003',
    clienteNome: 'Carlos Pereira',
    clienteTelefone: '(31) 97777-9999',
    clienteCpfCnpj: '000.000.000-00',
    clienteEmail: 'carlos.pereira@teste.com',
    clienteCep: '30000-456',
    valorBrutoCentavos: 1500,
    valorBrutoReais: 15.00,
    taxaCentavos: 75,
    taxaReais: 0.75,
    valorLiquidoReais: 14.25,
    percentualTaxa: 5.0,
    metodoPagamento: 'PIX'
  },
  {
    id: 'webhook_004',
    created_at: '2024-11-01T14:20:00Z',
    processed: true,
    source: 'abacatepay',
    event_type: 'billing.paid',
    payload: {
      event: 'billing.paid',
      data: {
        id: 'bill_premium456',
        status: 'paid',
        amount: 12000,
        customer: {
          name: 'Ana Paula Rodrigues',
          email: 'ana.paula@premium.com',
          cpf: '11122233344'
        }
      }
    },
    evento: 'cobranca.paga',
    ambiente: 'prod',
    pixQrCodeId: 'PIX_004_2024',
    pixQrCodeTipo: 'dinamico',
    pixQrCodeStatus: 'pago',
    clienteId: 'cliente_004',
    clienteNome: 'Ana Paula Rodrigues',
    clienteTelefone: '(41) 96666-1111',
    clienteCpfCnpj: '111.222.333-44',
    clienteEmail: 'ana.paula@premium.com',
    clienteCep: '80000-789',
    valorBrutoCentavos: 12000,
    valorBrutoReais: 120.00,
    taxaCentavos: 600,
    taxaReais: 6.00,
    valorLiquidoReais: 114.00,
    percentualTaxa: 5.0,
    metodoPagamento: 'PIX',
    processedAt: '2024-11-01T14:20:18Z'
  },
  {
    id: 'webhook_005',
    created_at: '2024-11-01T15:30:00Z',
    processed: true,
    source: 'abacatepay',
    event_type: 'billing.paid',
    payload: {
      event: 'billing.paid',
      data: {
        id: 'bill_vip789',
        status: 'paid',
        amount: 8500,
        customer: {
          name: 'Roberto Almeida Silva',
          email: 'roberto.almeida@vip.com.br',
          cpf: '55566677788'
        }
      }
    },
    evento: 'cobranca.paga',
    ambiente: 'prod',
    pixQrCodeId: 'PIX_005_2024',
    pixQrCodeTipo: 'dinamico',
    pixQrCodeStatus: 'pago',
    clienteId: 'cliente_005',
    clienteNome: 'Roberto Almeida Silva',
    clienteTelefone: '(51) 95555-2222',
    clienteCpfCnpj: '555.666.777-88',
    clienteEmail: 'roberto.almeida@vip.com.br',
    clienteCep: '90000-012',
    valorBrutoCentavos: 8500,
    valorBrutoReais: 85.00,
    taxaCentavos: 425,
    taxaReais: 4.25,
    valorLiquidoReais: 80.75,
    percentualTaxa: 5.0,
    metodoPagamento: 'PIX',
    processedAt: '2024-11-01T15:30:25Z'
  },
  {
    id: 'webhook_006',
    created_at: '2024-11-01T16:45:00Z',
    processed: true,
    source: 'abacatepay',
    event_type: 'billing.paid',
    payload: {
      event: 'billing.paid',
      data: {
        id: 'bill_standard321',
        status: 'paid',
        amount: 3500,
        customer: {
          name: 'Fernanda Lima Santos',
          email: 'fernanda.lima@standard.com',
          cpf: '99988877766'
        }
      }
    },
    evento: 'cobranca.paga',
    ambiente: 'dev',
    pixQrCodeId: 'PIX_006_2024',
    pixQrCodeTipo: 'dinamico',
    pixQrCodeStatus: 'pago',
    clienteId: 'cliente_006',
    clienteNome: 'Fernanda Lima Santos',
    clienteTelefone: '(61) 94444-3333',
    clienteCpfCnpj: '999.888.777-66',
    clienteEmail: 'fernanda.lima@standard.com',
    clienteCep: '70000-345',
    valorBrutoCentavos: 3500,
    valorBrutoReais: 35.00,
    taxaCentavos: 175,
    taxaReais: 1.75,
    valorLiquidoReais: 33.25,
    percentualTaxa: 5.0,
    metodoPagamento: 'PIX',
    processedAt: '2024-11-01T16:45:12Z'
  },
  {
    id: 'webhook_007',
    created_at: '2024-11-01T17:15:00Z',
    processed: true,
    source: 'abacatepay',
    event_type: 'billing.paid',
    payload: {
      event: 'billing.paid',
      data: {
        id: 'bill_express654',
        status: 'paid',
        amount: 7500,
        customer: {
          name: 'Pedro Henrique Costa',
          email: 'pedro.henrique@express.net',
          cpf: '44455566677'
        }
      }
    },
    evento: 'cobranca.paga',
    ambiente: 'prod',
    pixQrCodeId: 'PIX_007_2024',
    pixQrCodeTipo: 'dinamico',
    pixQrCodeStatus: 'pago',
    clienteId: 'cliente_007',
    clienteNome: 'Pedro Henrique Costa',
    clienteTelefone: '(71) 93333-4444',
    clienteCpfCnpj: '444.555.666-77',
    clienteEmail: 'pedro.henrique@express.net',
    clienteCep: '40000-678',
    valorBrutoCentavos: 7500,
    valorBrutoReais: 75.00,
    taxaCentavos: 375,
    taxaReais: 3.75,
    valorLiquidoReais: 71.25,
    percentualTaxa: 5.0,
    metodoPagamento: 'PIX',
    processedAt: '2024-11-01T17:15:30Z'
  },
  {
    id: 'webhook_008',
    created_at: '2024-11-01T18:00:00Z',
    processed: false,
    error_message: 'Timeout na conexão com o banco',
    source: 'abacatepay',
    event_type: 'billing.paid',
    payload: {
      event: 'billing.paid',
      data: {
        id: 'bill_timeout987',
        status: 'paid',
        amount: 4200,
        customer: {
          name: 'Juliana Martins',
          email: 'juliana.martins@timeout.com',
          cpf: '22233344455'
        }
      }
    },
    evento: 'cobranca.paga',
    ambiente: 'dev',
    pixQrCodeId: 'PIX_008_2024',
    pixQrCodeTipo: 'dinamico',
    pixQrCodeStatus: 'pendente',
    clienteId: 'cliente_008',
    clienteNome: 'Juliana Martins',
    clienteTelefone: '(85) 92222-5555',
    clienteCpfCnpj: '222.333.444-55',
    clienteEmail: 'juliana.martins@timeout.com',
    clienteCep: '60000-901',
    valorBrutoCentavos: 4200,
    valorBrutoReais: 42.00,
    taxaCentavos: 210,
    taxaReais: 2.10,
    valorLiquidoReais: 39.90,
    percentualTaxa: 5.0,
    metodoPagamento: 'PIX'
  }
];

// Função para calcular métricas baseadas nos dados
export function calculateWebhookMetrics(webhooks: AbacatePayWebhookData[]) {
  const processedWebhooks = webhooks.filter(w => w.processed);
  const errorWebhooks = webhooks.filter(w => !w.processed);
  const uniqueClients = new Set(webhooks.map(w => w.clienteEmail)).size;
  
  const totalRevenue = processedWebhooks.reduce((sum, w) => sum + w.valorBrutoReais, 0);
  const totalFees = processedWebhooks.reduce((sum, w) => sum + w.taxaReais, 0);
  const netRevenue = processedWebhooks.reduce((sum, w) => sum + w.valorLiquidoReais, 0);
  
  return {
    totalWebhooks: webhooks.length,
    webhooksProcessados: processedWebhooks.length,
    webhooksComErro: errorWebhooks.length,
    receitaBruta: totalRevenue,
    taxasTotal: totalFees,
    receitaLiquida: netRevenue,
    transacoesPix: webhooks.filter(w => w.metodoPagamento === 'PIX').length,
    clientesUnicos: uniqueClients
  };
}