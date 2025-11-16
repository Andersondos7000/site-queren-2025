import { AbacatePayWebhookData } from '../types/webhook';

// Função auxiliar para gerar propriedades calculadas
function generateCalculatedProperties(webhook: Partial<AbacatePayWebhookData>): AbacatePayWebhookData {
  const base = webhook as AbacatePayWebhookData;
  
  return {
    ...base,
    // Propriedades calculadas
    valorBrutoReais: base.valor / 100,
    valorLiquidoReais: base.financeiro.valorLiquidoCentavos / 100,
    taxaReais: base.financeiro.taxaCentavos / 100,
    
    // Propriedades do cliente expandidas
    clienteId: `cliente_${base.id}`,
    clienteNome: base.cliente.nome,
    clienteEmail: base.email,
    clienteTelefone: base.cliente.telefone,
    clienteCpfCnpj: base.cliente.cpf,
    clienteCep: '00000-000', // Valor padrão
    
    // Propriedades PIX
    pixQrCodeId: base.tipoPagamento === 'pix' ? `qr_${base.idPagamento}` : '',
    pixQrCodeTipo: base.tipoPagamento === 'pix' ? 'dinamico' : '',
    pixQrCodeStatus: base.tipoPagamento === 'pix' ? base.status : '',
    
    // Propriedades de controle
    processed: base.status === 'processado',
    error_message: base.status === 'erro' ? 'Erro no processamento do pagamento' : undefined,
    created_at: base.dataCriacao,
    metodoPagamento: base.tipoPagamento,
    valorBrutoCentavos: base.valor,
    processedAt: base.status === 'processado' ? base.dataCriacao : undefined,
  };
}

// Função para calcular métricas dos webhooks
export function calculateWebhookMetrics(webhooks: AbacatePayWebhookData[]) {
  const totalWebhooks = webhooks.length;
  const processados = webhooks.filter(w => w.status === 'processado').length;
  const erros = webhooks.filter(w => w.status === 'erro').length;
  const pendentes = webhooks.filter(w => w.status === 'pendente').length;
  
  // Calcular receita bruta (soma de todos os valores processados)
  const receitaBruta = webhooks
    .filter(w => w.status === 'processado')
    .reduce((total, w) => total + w.valor, 0);
  
  // Calcular taxas totais
  const taxasTotal = webhooks
    .filter(w => w.status === 'processado')
    .reduce((total, w) => total + w.financeiro.taxaCentavos, 0);
  
  // Calcular receita líquida
  const receitaLiquida = webhooks
    .filter(w => w.status === 'processado')
    .reduce((total, w) => total + w.financeiro.valorLiquidoCentavos, 0);
  
  // Contar transações PIX
  const transacoesPix = webhooks.filter(w => w.tipoPagamento === 'pix').length;
  
  // Contar clientes únicos
  const clientesUnicos = new Set(webhooks.map(w => w.email)).size;
  
  return {
    totalWebhooks,
    processados,
    erros,
    pendentes,
    receitaBruta,
    taxasTotal,
    receitaLiquida,
    transacoesPix,
    clientesUnicos
  };
}

export const abacatePayWebhookData: AbacatePayWebhookData[] = [
  generateCalculatedProperties({
    id: 'wh_001',
    idPagamento: 'pay_abc123def456',
    status: 'processado',
    valor: 15000, // R$ 150,00 em centavos
    email: 'cliente1@exemplo.com',
    dataCriacao: '2024-11-01T10:30:00Z',
    evento: 'payment.approved',
    cliente: {
      nome: 'Maria Silva',
      cpf: '123.456.789-01',
      telefone: '(11) 99999-1111'
    },
    financeiro: {
      taxaCentavos: 450, // R$ 4,50 em centavos
      valorLiquidoCentavos: 14550, // R$ 145,50 em centavos
      percentualTaxa: 3.0
    },
    ambiente: 'producao',
    tipoPagamento: 'pix',
    payload: {
      transaction_id: 'pay_abc123def456',
      amount: 15000,
      status: 'approved',
      customer: {
        name: 'Maria Silva',
        email: 'cliente1@exemplo.com'
      }
    }
  }),
  generateCalculatedProperties({
    id: 'wh_002',
    idPagamento: 'pay_def456ghi789',
    status: 'processado',
    valor: 8500, // R$ 85,00 em centavos
    email: 'cliente2@exemplo.com',
    dataCriacao: '2024-11-01T11:15:00Z',
    evento: 'payment.approved',
    cliente: {
      nome: 'João Santos',
      cpf: '987.654.321-09',
      telefone: '(11) 88888-2222'
    },
    financeiro: {
      taxaCentavos: 255, // R$ 2,55 em centavos
      valorLiquidoCentavos: 8245, // R$ 82,45 em centavos
      percentualTaxa: 3.0
    },
    ambiente: 'producao',
    tipoPagamento: 'pix',
    payload: {
      transaction_id: 'pay_def456ghi789',
      amount: 8500,
      status: 'approved',
      customer: {
        name: 'João Santos',
        email: 'cliente2@exemplo.com'
      }
    }
  }),
  generateCalculatedProperties({
    id: 'wh_003',
    idPagamento: 'pay_ghi789jkl012',
    status: 'erro',
    valor: 12000, // R$ 120,00 em centavos
    email: 'cliente3@exemplo.com',
    dataCriacao: '2024-11-01T12:00:00Z',
    evento: 'payment.failed',
    cliente: {
      nome: 'Ana Costa',
      cpf: '456.789.123-45',
      telefone: '(11) 77777-3333'
    },
    financeiro: {
      taxaCentavos: 0, // Sem taxa para pagamento falhado
      valorLiquidoCentavos: 0,
      percentualTaxa: 0
    },
    ambiente: 'producao',
    tipoPagamento: 'cartao',
    payload: {
      transaction_id: 'pay_ghi789jkl012',
      amount: 12000,
      status: 'failed',
      customer: {
        name: 'Ana Costa',
        email: 'cliente3@exemplo.com'
      }
    }
  }),
  generateCalculatedProperties({
    id: 'wh_004',
    idPagamento: 'pay_jkl012mno345',
    status: 'processado',
    valor: 25000, // R$ 250,00 em centavos
    email: 'cliente4@exemplo.com',
    dataCriacao: '2024-11-01T13:30:00Z',
    evento: 'payment.approved',
    cliente: {
      nome: 'Carlos Oliveira',
      cpf: '789.123.456-78',
      telefone: '(11) 66666-4444'
    },
    financeiro: {
      taxaCentavos: 750, // R$ 7,50 em centavos
      valorLiquidoCentavos: 24250, // R$ 242,50 em centavos
      percentualTaxa: 3.0
    },
    ambiente: 'desenvolvimento',
    tipoPagamento: 'pix',
    payload: {
      transaction_id: 'pay_jkl012mno345',
      amount: 25000,
      status: 'approved',
      customer: {
        name: 'Carlos Oliveira',
        email: 'cliente4@exemplo.com'
      }
    }
  }),
  generateCalculatedProperties({
    id: 'wh_005',
    idPagamento: 'pay_mno345pqr678',
    status: 'processado',
    valor: 18000, // R$ 180,00 em centavos
    email: 'cliente5@exemplo.com',
    dataCriacao: '2024-11-01T14:45:00Z',
    evento: 'payment.approved',
    cliente: {
      nome: 'Fernanda Lima',
      cpf: '321.654.987-32',
      telefone: '(11) 55555-5555'
    },
    financeiro: {
      taxaCentavos: 540, // R$ 5,40 em centavos
      valorLiquidoCentavos: 17460, // R$ 174,60 em centavos
      percentualTaxa: 3.0
    },
    ambiente: 'producao',
    tipoPagamento: 'pix',
    payload: {
      transaction_id: 'pay_mno345pqr678',
      amount: 18000,
      status: 'approved',
      customer: {
        name: 'Fernanda Lima',
        email: 'cliente5@exemplo.com'
      }
    }
  }),
  generateCalculatedProperties({
    id: 'wh_006',
    idPagamento: 'pay_pqr678stu901',
    status: 'pendente',
    valor: 9500, // R$ 95,00 em centavos
    email: 'cliente6@exemplo.com',
    dataCriacao: '2024-11-01T15:20:00Z',
    evento: 'payment.pending',
    cliente: {
      nome: 'Roberto Ferreira',
      cpf: '654.987.321-65',
      telefone: '(11) 44444-6666'
    },
    financeiro: {
      taxaCentavos: 0, // Sem taxa para pagamento pendente
      valorLiquidoCentavos: 0,
      percentualTaxa: 0
    },
    ambiente: 'producao',
    tipoPagamento: 'boleto',
    payload: {
      transaction_id: 'pay_pqr678stu901',
      amount: 9500,
      status: 'pending',
      customer: {
        name: 'Roberto Ferreira',
        email: 'cliente6@exemplo.com'
      }
    }
  }),
  generateCalculatedProperties({
    id: 'wh_007',
    idPagamento: 'pay_stu901vwx234',
    status: 'processado',
    valor: 32000, // R$ 320,00 em centavos
    email: 'cliente7@exemplo.com',
    dataCriacao: '2024-11-01T16:10:00Z',
    evento: 'payment.approved',
    cliente: {
      nome: 'Patrícia Alves',
      cpf: '147.258.369-14',
      telefone: '(11) 33333-7777'
    },
    financeiro: {
      taxaCentavos: 960, // R$ 9,60 em centavos
      valorLiquidoCentavos: 31040, // R$ 310,40 em centavos
      percentualTaxa: 3.0
    },
    ambiente: 'producao',
    tipoPagamento: 'pix',
    payload: {
      transaction_id: 'pay_stu901vwx234',
      amount: 32000,
      status: 'approved',
      customer: {
        name: 'Patrícia Alves',
        email: 'cliente7@exemplo.com'
      }
    }
  }),
  generateCalculatedProperties({
    id: 'wh_008',
    idPagamento: 'pay_vwx234yza567',
    status: 'processado',
    valor: 7500, // R$ 75,00 em centavos
    email: 'cliente8@exemplo.com',
    dataCriacao: '2024-11-01T17:00:00Z',
    evento: 'payment.approved',
    cliente: {
      nome: 'Eduardo Rocha',
      cpf: '258.369.147-25',
      telefone: '(11) 22222-8888'
    },
    financeiro: {
      taxaCentavos: 225, // R$ 2,25 em centavos
      valorLiquidoCentavos: 7275, // R$ 72,75 em centavos
      percentualTaxa: 3.0
    },
    ambiente: 'desenvolvimento',
    tipoPagamento: 'pix',
    payload: {
      transaction_id: 'pay_vwx234yza567',
      amount: 7500,
      status: 'approved',
      customer: {
        name: 'Eduardo Rocha',
        email: 'cliente8@exemplo.com'
      }
    }
  }),
  generateCalculatedProperties({
    id: 'wh_009',
    idPagamento: 'pay_yza567bcd890',
    status: 'processado',
    valor: 14500, // R$ 145,00 em centavos
    email: 'cliente9@exemplo.com',
    dataCriacao: '2024-11-01T18:30:00Z',
    evento: 'payment.approved',
    cliente: {
      nome: 'Luciana Martins',
      cpf: '369.147.258-36',
      telefone: '(11) 11111-9999'
    },
    financeiro: {
      taxaCentavos: 435, // R$ 4,35 em centavos
      valorLiquidoCentavos: 14065, // R$ 140,65 em centavos
      percentualTaxa: 3.0
    },
    ambiente: 'producao',
    tipoPagamento: 'pix',
    payload: {
      transaction_id: 'pay_yza567bcd890',
      amount: 14500,
      status: 'approved',
      customer: {
        name: 'Luciana Martins',
        email: 'cliente9@exemplo.com'
      }
    }
  }),
  generateCalculatedProperties({
    id: 'wh_010',
    idPagamento: 'pay_bcd890efg123',
    status: 'erro',
    valor: 22000, // R$ 220,00 em centavos
    email: 'cliente10@exemplo.com',
    dataCriacao: '2024-11-01T19:15:00Z',
    evento: 'payment.failed',
    cliente: {
      nome: 'Marcos Pereira',
      cpf: '741.852.963-74',
      telefone: '(11) 99999-0000'
    },
    financeiro: {
      taxaCentavos: 0, // Sem taxa para pagamento falhado
      valorLiquidoCentavos: 0,
      percentualTaxa: 0
    },
    ambiente: 'producao',
    tipoPagamento: 'cartao',
    payload: {
      transaction_id: 'pay_bcd890efg123',
      amount: 22000,
      status: 'failed',
      customer: {
        name: 'Marcos Pereira',
        email: 'cliente10@exemplo.com'
      }
    }
  }),
  generateCalculatedProperties({
    id: 'wh_011',
    idPagamento: 'pay_efg123hij456',
    status: 'processado',
    valor: 28500, // R$ 285,00 em centavos
    email: 'cliente11@exemplo.com',
    dataCriacao: '2024-11-01T20:00:00Z',
    evento: 'payment.approved',
    cliente: {
      nome: 'Gabriela Souza',
      cpf: '852.963.741-85',
      telefone: '(11) 88888-1111'
    },
    financeiro: {
      taxaCentavos: 855, // R$ 8,55 em centavos
      valorLiquidoCentavos: 27645, // R$ 276,45 em centavos
      percentualTaxa: 3.0
    },
    ambiente: 'producao',
    tipoPagamento: 'pix',
    payload: {
      transaction_id: 'pay_efg123hij456',
      amount: 28500,
      status: 'approved',
      customer: {
        name: 'Gabriela Souza',
        email: 'cliente11@exemplo.com'
      }
    }
  }),
  generateCalculatedProperties({
    id: 'wh_012',
    idPagamento: 'pay_hij456klm789',
    status: 'processado',
    valor: 11000, // R$ 110,00 em centavos
    email: 'cliente12@exemplo.com',
    dataCriacao: '2024-11-01T21:30:00Z',
    evento: 'payment.approved',
    cliente: {
      nome: 'Rafael Barbosa',
      cpf: '963.741.852-96',
      telefone: '(11) 77777-2222'
    },
    financeiro: {
      taxaCentavos: 330, // R$ 3,30 em centavos
      valorLiquidoCentavos: 10670, // R$ 106,70 em centavos
      percentualTaxa: 3.0
    },
    ambiente: 'desenvolvimento',
    tipoPagamento: 'pix',
    payload: {
      transaction_id: 'pay_hij456klm789',
      amount: 11000,
      status: 'approved',
      customer: {
        name: 'Rafael Barbosa',
        email: 'cliente12@exemplo.com'
      }
    }
  }),
  generateCalculatedProperties({
    id: 'wh_013',
    idPagamento: 'pay_klm789nop012',
    status: 'processado',
    valor: 19500, // R$ 195,00 em centavos
    email: 'cliente13@exemplo.com',
    dataCriacao: '2024-11-01T22:15:00Z',
    evento: 'payment.approved',
    cliente: {
      nome: 'Camila Rodrigues',
      cpf: '159.753.486-15',
      telefone: '(11) 66666-3333'
    },
    financeiro: {
      taxaCentavos: 585, // R$ 5,85 em centavos
      valorLiquidoCentavos: 18915, // R$ 189,15 em centavos
      percentualTaxa: 3.0
    },
    ambiente: 'producao',
    tipoPagamento: 'pix',
    payload: {
      transaction_id: 'pay_klm789nop012',
      amount: 19500,
      status: 'approved',
      customer: {
        name: 'Camila Rodrigues',
        email: 'cliente13@exemplo.com'
      }
    }
  }),
  generateCalculatedProperties({
    id: 'wh_014',
    idPagamento: 'pay_nop012qrs345',
    status: 'pendente',
    valor: 16000, // R$ 160,00 em centavos
    email: 'cliente14@exemplo.com',
    dataCriacao: '2024-11-01T23:00:00Z',
    evento: 'payment.pending',
    cliente: {
      nome: 'Thiago Nascimento',
      cpf: '753.486.159-75',
      telefone: '(11) 55555-4444'
    },
    financeiro: {
      taxaCentavos: 0, // Sem taxa para pagamento pendente
      valorLiquidoCentavos: 0,
      percentualTaxa: 0
    },
    ambiente: 'producao',
    tipoPagamento: 'boleto',
    payload: {
      transaction_id: 'pay_nop012qrs345',
      amount: 16000,
      status: 'pending',
      customer: {
        name: 'Thiago Nascimento',
        email: 'cliente14@exemplo.com'
      }
    }
  }),
  generateCalculatedProperties({
    id: 'wh_015',
    idPagamento: 'pay_qrs345tuv678',
    status: 'processado',
    valor: 35000, // R$ 350,00 em centavos
    email: 'cliente15@exemplo.com',
    dataCriacao: '2024-11-01T23:45:00Z',
    evento: 'payment.approved',
    cliente: {
      nome: 'Juliana Carvalho',
      cpf: '486.159.753-48',
      telefone: '(11) 44444-5555'
    },
    financeiro: {
      taxaCentavos: 1050, // R$ 10,50 em centavos
      valorLiquidoCentavos: 33950, // R$ 339,50 em centavos
      percentualTaxa: 3.0
    },
    ambiente: 'producao',
    tipoPagamento: 'pix',
    payload: {
      transaction_id: 'pay_qrs345tuv678',
      amount: 35000,
      status: 'approved',
      customer: {
        name: 'Juliana Carvalho',
        email: 'cliente15@exemplo.com'
      }
    }
  })
];