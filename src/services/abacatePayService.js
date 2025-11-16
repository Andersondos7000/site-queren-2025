import axios from 'axios';
import crypto from 'crypto';

// Interfaces e tipos (simulados em JavaScript)
class AbacatePayClient {
  constructor(data) {
    this.nome = data.nome;
    this.email = data.email;
    this.cpf = data.cpf;
    this.telefone = data.telefone;
  }
}

class AbacatePayItem {
  constructor(data) {
    this.nome = data.nome;
    this.valor = data.valor;
    this.quantidade = data.quantidade;
  }
}

class AbacatePayCobranca {
  constructor(data) {
    this.cliente = data.cliente;
    this.itens = data.itens;
    this.valor_total = data.valor_total;
    this.descricao = data.descricao;
    this.webhook_url = data.webhook_url;
    this.metodo_pagamento = data.metodo_pagamento;
    this.vencimento = data.vencimento;
    this.referencia_externa = data.referencia_externa;
  }
}

class AbacatePayService {
  constructor(apiKey, webhookSecret, baseUrl = 'https://api.abacatepay.com/v1') {
    this.apiKey = apiKey;
    this.webhookSecret = webhookSecret;
    this.baseUrl = baseUrl;

    // Log da inicialização com dados mascarados
    console.log(`AbacatePayService inicializado com chave: ${apiKey?.substring(0, 10)}...`);
    console.log(`Webhook secret: ${webhookSecret?.substring(0, 10)}...`);
    console.log(`Base URL: ${baseUrl}`);

    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'AbacatePay-Node/1.0'
      },
      timeout: 30000
    });
  }

  async criarCobranca(dadosCobranca) {
    try {
      // CORREÇÃO: AbacatePay espera valor em centavos (inteiro)
      // Converter de reais para centavos e arredondar para evitar problemas de ponto flutuante
      const valorEmCentavos = Math.round(dadosCobranca.valor * 100);
      
      console.log('💰 Conversão de valor:', {
        valorOriginal: dadosCobranca.valor,
        valorEmCentavos: valorEmCentavos
      });
      
      // Convertendo para o formato da API oficial do AbacatePay
      const pixData = {
        amount: valorEmCentavos, // valor em centavos (inteiro)
        description: dadosCobranca.descricao,
        expiresIn: 1800, // 30 minutos em segundos
        customer: {
          name: dadosCobranca.cliente.nome,
          cellphone: dadosCobranca.cliente.telefone,
          email: dadosCobranca.cliente.email,
          taxId: dadosCobranca.cliente.cpf
        },
        metadata: {
          external_id: dadosCobranca.external_id
        }
      };
      
      console.log('🔄 Criando PIX QRCode no AbacatePay:', JSON.stringify(pixData, null, 2));
      
      const response = await this.axiosInstance.post('/pixQrCode/create', pixData);
      
      console.log('✅ PIX QRCode criado com sucesso:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Erro ao criar PIX QRCode:', error.message);
      if (error.response) {
        console.error('Detalhes do erro:', error.response.data);
      }
      throw new Error(`Falha ao criar cobrança: ${error.message}`);
    }
  }

  extrairDadosResposta(resposta) {
    return {
      id: resposta.id,
      status: resposta.status,
      valor: resposta.valor || resposta.valor_total,
      qr_code: resposta.qr_code || resposta.pix?.qr_code,
      qr_code_base64: resposta.qr_code_base64 || resposta.pix?.qr_code_base64,
      pix_copia_cola: resposta.pix_copia_cola || resposta.pix?.codigo_pix,
      link_pagamento: resposta.link_pagamento || resposta.url_pagamento,
      vencimento: resposta.vencimento,
      created_at: resposta.created_at || new Date().toISOString(),
      referencia_externa: resposta.referencia_externa
    };
  }

  async criarCobrancaViaDirect(dadosCobranca) {
    try {
      // O valor já vem em centavos do frontend, não precisa converter novamente
      const valorEmCentavos = dadosCobranca.valor;
      
      // Convertendo para o formato da API oficial do AbacatePay
      const pixData = {
        amount: valorEmCentavos, // valor em centavos
        description: dadosCobranca.descricao,
        expiresIn: 1800, // 30 minutos em segundos
        customer: {
          name: dadosCobranca.cliente.nome,
          cellphone: dadosCobranca.cliente.telefone,
          email: dadosCobranca.cliente.email,
          taxId: dadosCobranca.cliente.cpf
        },
        metadata: {
          external_id: dadosCobranca.external_id
        }
      };
      
      console.log('🔄 Criando PIX QRCode no AbacatePay (Direct):', JSON.stringify(pixData, null, 2));
      
      const response = await this.axiosInstance.post('/pixQrCode/create', pixData);
      
      console.log('✅ PIX QRCode criado com sucesso (Direct):', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Erro ao criar PIX QRCode (Direct):', error.message);
      if (error.response) {
        console.error('Detalhes do erro:', error.response.data);
      }
      throw new Error(`Falha ao criar cobrança: ${error.message}`);
    }
  }

  async consultarCobranca(cobrancaId) {
    try {
      console.log(`🔍 Consultando cobrança ${cobrancaId} no AbacatePay...`);
      
      const response = await this.axiosInstance.get(`/cobrancas/${cobrancaId}`);
      
      console.log('✅ Cobrança consultada:', JSON.stringify(response.data, null, 2));
      
      return this.extrairDadosResposta(response.data);
    } catch (error) {
      console.error('❌ Erro ao consultar cobrança:', error.message);
      throw new Error(`Falha ao consultar cobrança: ${error.message}`);
    }
  }

  validarWebhook(payload, signature) {
    console.log('🔍 INÍCIO validarWebhook');
    console.log('   Payload recebido:', payload);
    console.log('   Signature recebida:', signature);
    
    try {
      // Se payload é string, usar diretamente
      // Se payload é objeto, converter para string
      const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
      
      console.log('🔍 Payload processado:', payloadString);
      console.log('🔍 Webhook secret:', this.webhookSecret);
      
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecret)
        .update(payloadString)
        .digest('hex');
      
      console.log('🔍 Signature esperada:', expectedSignature);
      console.log('🔍 Signature recebida:', signature);
      console.log('🔍 São iguais?:', signature === expectedSignature);
      
      const result = signature === expectedSignature;
      console.log('🔍 FIM validarWebhook - resultado:', result);
      return result;
    } catch (error) {
      console.error('❌ Erro ao validar webhook:', error.message);
      console.error('❌ Stack:', error.stack);
      return false;
    }
  }

  async simularPagamento(cobrancaId) {
    try {
      console.log(`🎭 Simulando pagamento para cobrança ${cobrancaId}...`);
      
      const response = await this.axiosInstance.post(`/cobrancas/${cobrancaId}/simular-pagamento`);
      
      console.log('✅ Pagamento simulado:', response.data);
      
      return response.data;
    } catch (error) {
      console.error('❌ Erro ao simular pagamento:', error.message);
      throw new Error(`Falha ao simular pagamento: ${error.message}`);
    }
  }
}

// Singleton para o serviço
let abacatePayServiceInstance = null;

function getAbacatePayService() {
  if (!abacatePayServiceInstance) {
    const apiKey = process.env.ABACATEPAY_API_KEY;
    const webhookSecret = process.env.ABACATEPAY_WEBHOOK_SECRET;
    const baseUrl = process.env.ABACATEPAY_BASE_URL || 'https://api.abacatepay.com/v1';

    if (!apiKey) {
      throw new Error('ABACATEPAY_API_KEY não configurada');
    }

    if (!webhookSecret) {
      throw new Error('ABACATEPAY_WEBHOOK_SECRET não configurada');
    }

    abacatePayServiceInstance = new AbacatePayService(apiKey, webhookSecret, baseUrl);
  }

  return abacatePayServiceInstance;
}

// Utilitários
class AbacatePayUtils {
  static formatarValor(valor) {
    if (typeof valor === 'string') {
      return parseFloat(valor.replace(',', '.'));
    }
    return parseFloat(valor);
  }

  static converterParaCentavos(valor) {
    return Math.round(this.formatarValor(valor) * 100);
  }

  static converterDecentavos(centavos) {
    return (centavos / 100).toFixed(2);
  }

  static centavosParaReais(centavos) {
    return centavos / 100;
  }

  static reaisParaCentavos(reais) {
    return Math.round(reais * 100);
  }

  static validarCPF(cpf) {
    if (!cpf) return false;
    
    cpf = cpf.replace(/[^\d]/g, '');
    
    if (cpf.length !== 11) return false;
    
    if (/^(\d)\1{10}$/.test(cpf)) return false;
    
    let soma = 0;
    for (let i = 0; i < 9; i++) {
      soma += parseInt(cpf.charAt(i)) * (10 - i);
    }
    let resto = 11 - (soma % 11);
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf.charAt(9))) return false;
    
    soma = 0;
    for (let i = 0; i < 10; i++) {
      soma += parseInt(cpf.charAt(i)) * (11 - i);
    }
    resto = 11 - (soma % 11);
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf.charAt(10))) return false;
    
    return true;
  }

  static formatarCPF(cpf) {
    if (!cpf) return '';
    cpf = cpf.replace(/[^\d]/g, '');
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  static formatarTelefone(telefone) {
    if (!telefone) return '';
    telefone = telefone.replace(/[^\d]/g, '');
    if (telefone.length === 11) {
      return telefone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    } else if (telefone.length === 10) {
      return telefone.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    }
    return telefone;
  }

  static limparCPF(cpf) {
    if (!cpf) return '';
    return cpf.replace(/[^\d]/g, '');
  }
}

export {
  AbacatePayService,
  AbacatePayClient,
  AbacatePayItem,
  AbacatePayCobranca,
  getAbacatePayService,
  AbacatePayUtils
};