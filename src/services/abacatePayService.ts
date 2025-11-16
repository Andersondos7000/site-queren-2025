/**
 * Serviço para integração com AbacatePay
 * Utiliza o SDK oficial da AbacatePay para Node.js
 * 
 * IMPORTANTE: Este serviço deve ser usado APENAS no backend.
 * Nunca exponha a chave secreta no frontend!
 */

import AbacatePayModule from 'abacatepay-nodejs-sdk';
import crypto from 'crypto';

// Extraindo o construtor correto do SDK
const AbacatePaySDK = (AbacatePayModule as any).default;

export interface AbacatePayCustomer {
  nome: string;
  email: string;
  cpf: string;
  telefone?: string;
  endereco?: {
    endereco?: string;
    numero?: string;
    bairro?: string;
    cidade?: string;
    estado?: string;
    cep?: string;
  };
}

export interface AbacatePayItem {
  nome: string;
  quantidade: number;
  valor: number; // em centavos
}

export interface AbacatePayCobranca {
  valor: number; // em centavos (ex: 2990 = R$29,90)
  descricao: string;
  cliente: AbacatePayCustomer;
  metodos: string[];
  expires_in?: number; // em segundos
  webhook_url?: string;
  external_id?: string;
}

export interface AbacatePayResponse {
  id: string;
  status: 'pending' | 'paid' | 'expired' | 'cancelled';
  valor: number;
  descricao: string;
  url?: string; // URL de pagamento
  cliente: AbacatePayCustomer;
  pix?: {
    qr_code: string;
    qr_code_url: string;
    expires_at: string;
  };
  created_at: string;
  updated_at: string;
}

export interface AbacatePayWebhookData {
  evento: 'cobranca.paga' | 'cobranca.expirada' | 'cobranca.cancelada';
  dados: AbacatePayResponse;
}

/**
 * Classe para integração com AbacatePay
 * 
 * ⚠️ ATENÇÃO: Esta classe deve ser usada APENAS no backend!
 */
export class AbacatePayService {
  private readonly abacatePay: any;
  private readonly webhookSecret: string;
  private readonly apiKey: string;

  constructor(apiKey?: string, webhookSecret?: string) {
    // Usando chave API das variáveis de ambiente
    this.apiKey = apiKey || process.env.ABACATEPAY_API_KEY || process.env.VITE_ABACATE_PAY_API_KEY || 'abc_dev_fhb5Dh0s24wHQ6XWgFAGdzjc';
    this.webhookSecret = webhookSecret || process.env.ABACATEPAY_WEBHOOK_SECRET || 'webh_dev_abc123xyz789';
    
    // Instanciando o SDK corretamente
    this.abacatePay = new AbacatePaySDK(this.apiKey);
    console.log('AbacatePayService inicializado com chave:', this.apiKey.substring(0, 10) + '...');
  }

  /**
   * Cria uma nova cobrança na AbacatePay
   */
  async criarCobranca(dados: AbacatePayCobranca): Promise<AbacatePayResponse> {
    try {
      // Payload baseado na documentação oficial do SDK AbacatePay
      const payload = {
        frequency: 'ONE_TIME',
        methods: ['PIX'], // Valor correto em maiúsculas
        amount: dados.valor, // Valor total em centavos
        products: [
          {
            externalId: dados.external_id || 'PRODUTO-PADRAO',
            name: dados.descricao,
            description: dados.descricao,
            quantity: 1,
            price: dados.valor // valor em centavos
          }
        ],
        returnUrl: 'http://localhost:8082/checkout/success',
        completionUrl: 'http://localhost:8082/checkout/completion',
        customer: {
          name: dados.cliente.nome,
          email: dados.cliente.email,
          cellphone: dados.cliente.telefone || '+5511999999999',
          taxId: dados.cliente.cpf?.replace(/\D/g, ''), // Remove formatação do CPF
          address: {
            street: dados.cliente.endereco?.endereco || 'Rua Exemplo',
            number: dados.cliente.endereco?.numero || '123',
            neighborhood: dados.cliente.endereco?.bairro || '',
            city: dados.cliente.endereco?.cidade || 'Araguaína',
            state: dados.cliente.endereco?.estado || 'TO',
            zipCode: dados.cliente.endereco?.cep?.replace(/\D/g, '') || '01310100',
            country: 'BR'
          }
        }
      };

      console.log('Enviando payload para AbacatePay:', JSON.stringify(payload, null, 2));
      
      // Tentar usar o SDK primeiro
      let response = await this.abacatePay.billing.create(payload);
      console.log('Resposta do SDK AbacatePay:', JSON.stringify(response, null, 2));
      console.log('Verificando condições de fallback:');
      console.log('- !response:', !response);
      console.log('- Object.keys(response).length:', Object.keys(response).length);
      console.log('- response.error !== undefined:', response.error !== undefined);

      // Se o SDK retornar resposta vazia ou inválida, usar API REST direta
      if (!response || 
          Object.keys(response).length === 0 || 
          response.error !== undefined ||
          (!response.id && !response.data?.id) ||
          (!response.url && !response.data?.url)) {
        console.log('SDK retornou resposta vazia ou inválida, tentando API REST direta...');
        response = await this.criarCobrancaViaDirect(payload);
        console.log('Resposta do fallback:', JSON.stringify(response, null, 2));
      } else if (response.data) {
        // Se o SDK retornou dados dentro de response.data, extrair para o nível principal
        console.log('SDK retornou dados em response.data, extraindo...');
        response = response.data;
      }
      
      // Verificar se a resposta é válida
      if (!response || (!response.id && !response.data?.id)) {
        console.error('Resposta inválida da API AbacatePay:', response);
        throw new Error('API AbacatePay retornou resposta inválida ou vazia. Verifique suas credenciais.');
      }
      
      // A resposta pode vir em diferentes formatos dependendo do método usado
      const billingData = response.data.data || response.data;
      
      console.log('Dados da cobrança extraídos:', JSON.stringify(billingData, null, 2));
      
      return {
        id: billingData.id,
        status: billingData.status?.toLowerCase() || 'pending',
        valor: billingData.amount,
        descricao: billingData.products?.[0]?.name || dados.descricao,
        url: billingData.url, // URL de pagamento
        cliente: {
          nome: billingData.customer?.metadata?.name || dados.cliente.nome,
          email: billingData.customer?.metadata?.email || dados.cliente.email,
          cpf: billingData.customer?.metadata?.taxId || dados.cliente.cpf,
          telefone: billingData.customer?.metadata?.cellphone || dados.cliente.telefone
        },
        pix: billingData.url ? {
          qr_code: billingData.url,
          qr_code_url: billingData.url,
          expires_at: new Date(Date.now() + 3600000).toISOString() // 1 hora a partir de agora
        } : undefined,
        created_at: billingData.createdAt,
        updated_at: billingData.updatedAt
      };
    } catch (error: any) {
      console.error('Erro ao criar cobrança AbacatePay:', error);
      throw new Error(`Falha ao criar cobrança: ${error.message || 'Erro desconhecido'}`);
    }
  }

  private async criarCobrancaViaDirect(payload: any): Promise<any> {
    try {
      const response = await fetch('https://api.abacatepay.com/v1/billing/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API REST falhou: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('Resposta da API REST direta:', JSON.stringify(data, null, 2));
      
      return { data };
    } catch (error) {
      console.error('Erro na API REST direta:', error);
      throw error;
    }
  }

  /**
   * Consulta uma cobrança existente
   */
  async consultarCobranca(id: string): Promise<AbacatePayResponse> {
    try {
      const response = await this.abacatePay.billing.get(id);

      return {
        id: response.id,
        status: response.status,
        valor: response.amount,
        descricao: response.description,
        cliente: {
          nome: response.customer.name,
          email: response.customer.email,
          cpf: response.customer.document,
          telefone: response.customer.phone
        },
        pix: response.pix ? {
          qr_code: response.pix.qrCode,
          qr_code_url: response.pix.qrCodeUrl,
          expires_at: response.pix.expiresAt
        } : undefined,
        created_at: response.createdAt,
        updated_at: response.updatedAt
      };
    } catch (error: any) {
      console.error('Erro ao consultar cobrança AbacatePay:', error);
      throw new Error(`Falha ao consultar cobrança: ${error.message || 'Erro desconhecido'}`);
    }
  }

  /**
   * Valida a assinatura do webhook
   * Para desenvolvimento: usa a chave secreta configurada
   * Para produção: usa a chave pública oficial do AbacatePay
   */
  validarWebhook(payload: string, signature: string): boolean {
    try {
      // Em desenvolvimento, usar nossa chave secreta
      // Em produção, usar a chave pública oficial do AbacatePay
      const isDev = process.env.NODE_ENV !== 'production';
      
      if (isDev) {
        // Validação para desenvolvimento usando nossa chave secreta
        const expectedSignature = crypto
          .createHmac('sha256', this.webhookSecret)
          .update(payload)
          .digest('hex');

        return signature === expectedSignature;
      } else {
        // Validação para produção usando chave pública oficial
        const ABACATEPAY_PUBLIC_KEY = "t9dXRhHHo3yDEj5pVDYz0frf7q6bMKyMRmxxCPIPp3RCplBfXRxqlC6ZpiWmOqj4L63qEaeUOtrCI8P0VMUgo6iIga2ri9ogaHFs0WIIywSMg0q7RmBfybe1E5XJcfC4IW3alNqym0tXoAKkzvfEjZxV6bE0oG2zJrNNYmUCKZyV0KZ3JS8Votf9EAWWYdiDkMkpbMdPggfh1EqHlVkMiTady6jOR3hyzGEHrIz2Ret0xHKMbiqkr9HS1JhNHDX9";
        
        const bodyBuffer = Buffer.from(payload, "utf8");
        
        const expectedSig = crypto
          .createHmac("sha256", ABACATEPAY_PUBLIC_KEY)
          .update(bodyBuffer)
          .digest("base64");

        const A = Buffer.from(expectedSig);
        const B = Buffer.from(signature);

        return A.length === B.length && crypto.timingSafeEqual(A, B);
      }
    } catch (error) {
      console.error('Erro ao validar webhook:', error);
      return false;
    }
  }

  /**
   * Simula um pagamento (apenas para ambiente de teste)
   */
  async simularPagamento(billingId: string): Promise<any> {
    try {
      return await this.abacatePay.billing.simulate(billingId);
    } catch (error: any) {
      console.error('Erro ao simular pagamento:', error);
      throw new Error(`Falha ao simular pagamento: ${error.message || 'Erro desconhecido'}`);
    }
  }
}

/**
 * Instância singleton do serviço AbacatePay
 */
let abacatePayInstance: AbacatePayService | null = null;

/**
 * Obtém a instância do serviço AbacatePay
 * Usa as credenciais de teste por padrão
 */
export function getAbacatePayService(): AbacatePayService {
  if (!abacatePayInstance) {
    const apiKey = process.env.ABACATEPAY_API_KEY || 'abc_dev_fhb5Dh0s24wHQ6XWgFAGdzjc';
    const webhookSecret = process.env.ABACATEPAY_WEBHOOK_SECRET || 'webh_dev_AWChUaMh0HTZKDtTPxsBAWpf';
    
    abacatePayInstance = new AbacatePayService(apiKey, webhookSecret);
  }
  
  return abacatePayInstance;
}

/**
 * Utilitários para conversão de valores
 */
export const AbacatePayUtils = {
  /**
   * Converte valor em reais para centavos
   */
  reaisParaCentavos(valor: number): number {
    return Math.round(valor * 100);
  },

  /**
   * Converte valor em centavos para reais
   */
  centavosParaReais(valor: number): number {
    return valor / 100;
  },

  /**
   * Formata valor em reais
   */
  formatarValor(valor: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(valor);
  },

  /**
   * Valida CPF (formato básico)
   */
  validarCPF(cpf: string): boolean {
    const cleanCPF = cpf.replace(/\D/g, '');
    return cleanCPF.length === 11 && /^\d{11}$/.test(cleanCPF);
  },

  /**
   * Limpa CPF removendo caracteres especiais
   */
  limparCPF(cpf: string): string {
    return cpf.replace(/\D/g, '');
  }
};