/**
 * API Routes para AbacatePay
 * 
 * ⚠️ IMPORTANTE: Estes endpoints devem rodar no BACKEND, nunca no frontend!
 * Em produção, mova este arquivo para seu servidor backend (Node.js, Python, etc.)
 */

import { getAbacatePayService, AbacatePayUtils, type AbacatePayCobranca } from '../services/abacatePayService';

/**
 * Interface para dados do pedido
 */
export interface PedidoAbacatePay {
  valor: number; // em reais
  descricao: string;
  cliente: {
    nome: string;
    email: string;
    cpf: string;
    telefone?: string;
  };
  items: Array<{
    nome: string;
    quantidade: number;
    preco: number;
  }>;
  external_id?: string;
}

/**
 * Cria uma cobrança PIX via AbacatePay
 * 
 * POST /api/abacatepay/criar-cobranca
 */
export async function criarCobrancaAbacatePay(pedido: PedidoAbacatePay) {
  try {
    // Validações básicas
    if (!pedido.valor || pedido.valor <= 0) {
      throw new Error('Valor do pedido deve ser maior que zero');
    }

    if (!pedido.cliente.nome || !pedido.cliente.email || !pedido.cliente.cpf) {
      throw new Error('Dados do cliente são obrigatórios (nome, email, cpf)');
    }

    if (!AbacatePayUtils.validarCPF(pedido.cliente.cpf)) {
      throw new Error('CPF inválido');
    }

    // Preparar dados para AbacatePay
    // CORREÇÃO: AbacatePay espera valores em reais, não em centavos
    const valorEmReais = pedido.valor;
    const cpfLimpo = AbacatePayUtils.limparCPF(pedido.cliente.cpf);

    const dadosCobranca: AbacatePayCobranca = {
      valor: valorEmReais,
      descricao: pedido.descricao,
      cliente: {
        nome: pedido.cliente.nome,
        email: pedido.cliente.email,
        cpf: cpfLimpo,
        telefone: pedido.cliente.telefone
      },
      metodos: ['pix'],
      expires_in: 3600, // 1 hora
      external_id: pedido.external_id || `pedido_${Date.now()}`
    };

    // Criar cobrança via AbacatePay
    const abacatePayService = getAbacatePayService();
    const cobranca = await abacatePayService.criarCobranca(dadosCobranca);

    return {
      success: true,
      data: {
        id: cobranca.id,
        status: cobranca.status,
        valor: cobranca.valor,
        valorFormatado: AbacatePayUtils.formatarValor(cobranca.valor),
        descricao: cobranca.descricao,
        url: (cobranca as any).url, // URL de pagamento
        pix: cobranca.pix ? {
          qr_code: cobranca.pix.qr_code,
          qr_code_url: cobranca.pix.qr_code_url,
          expires_at: cobranca.pix.expires_at
        } : null,
        created_at: cobranca.created_at
      }
    };
  } catch (error) {
    console.error('Erro ao criar cobrança AbacatePay:', error);
    
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Erro interno do servidor',
        code: 'ABACATEPAY_ERROR'
      }
    };
  }
}

/**
 * Consulta status de uma cobrança
 * 
 * GET /api/abacatepay/consultar-cobranca/:id
 */
export async function consultarCobrancaAbacatePay(id: string) {
  try {
    if (!id) {
      throw new Error('ID da cobrança é obrigatório');
    }

    const abacatePayService = getAbacatePayService();
    const cobranca = await abacatePayService.consultarCobranca(id);

    return {
      success: true,
      data: {
        id: cobranca.id,
        status: cobranca.status,
        valor: AbacatePayUtils.centavosParaReais(cobranca.valor),
        valorFormatado: AbacatePayUtils.formatarValor(AbacatePayUtils.centavosParaReais(cobranca.valor)),
        descricao: cobranca.descricao,
        cliente: cobranca.cliente,
        pix: cobranca.pix ? {
          qr_code: cobranca.pix.qr_code,
          qr_code_url: cobranca.pix.qr_code_url,
          expires_at: cobranca.pix.expires_at
        } : null,
        created_at: cobranca.created_at,
        updated_at: cobranca.updated_at
      }
    };
  } catch (error) {
    console.error('Erro ao consultar cobrança AbacatePay:', error);
    
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Erro interno do servidor',
        code: 'ABACATEPAY_QUERY_ERROR'
      }
    };
  }
}

/**
 * Processa webhook do AbacatePay
 * 
 * POST /api/abacatepay/webhook
 */
export async function processarWebhookAbacatePay(
  payload: string, 
  signature: string,
  onPaymentConfirmed?: (cobrancaId: string, dados: any) => Promise<void>
) {
  try {
    if (!signature) {
      throw new Error('Assinatura do webhook não fornecida');
    }

    const abacatePayService = getAbacatePayService();
    
    // Validar assinatura
    if (!abacatePayService.validarWebhook(payload, signature)) {
      throw new Error('Assinatura do webhook inválida');
    }

    // Processar dados do webhook
    const webhookData = JSON.parse(payload);
    const { evento, dados } = webhookData;

    console.log(`Webhook AbacatePay recebido: ${evento}`, dados);

    // Processar eventos
    switch (evento) {
      case 'cobranca.paga':
        console.log('✅ Pagamento confirmado:', dados.id);
        
        // Callback personalizado para atualizar banco de dados
        if (onPaymentConfirmed) {
          await onPaymentConfirmed(dados.id, dados);
        }
        
        break;

      case 'cobranca.expirada':
        console.log('⏰ Cobrança expirada:', dados.id);
        // Implementar lógica para cobrança expirada
        break;

      case 'cobranca.cancelada':
        console.log('❌ Cobrança cancelada:', dados.id);
        // Implementar lógica para cobrança cancelada
        break;

      default:
        console.log('Evento não reconhecido:', evento);
    }

    return {
      success: true,
      message: 'Webhook processado com sucesso'
    };
  } catch (error) {
    console.error('Erro ao processar webhook AbacatePay:', error);
    
    return {
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Erro interno do servidor',
        code: 'WEBHOOK_ERROR'
      }
    };
  }
}

/**
 * Exemplo de implementação para Express.js
 * 
 * Copie este código para seu servidor backend:
 */
export const exemploExpressRoutes = `
// Exemplo para Express.js - COPIE PARA SEU BACKEND

import express from 'express';
import { criarCobrancaAbacatePay, consultarCobrancaAbacatePay, processarWebhookAbacatePay } from './api/abacatepay';

const router = express.Router();

// POST /api/abacatepay/criar-cobranca
router.post('/criar-cobranca', async (req, res) => {
  try {
    const resultado = await criarCobrancaAbacatePay(req.body);
    
    if (resultado.success) {
      res.json(resultado.data);
    } else {
      res.status(400).json(resultado.error);
    }
  } catch (error) {
    res.status(500).json({ 
      message: 'Erro interno do servidor',
      error: error.message 
    });
  }
});

// GET /api/abacatepay/consultar-cobranca/:id
router.get('/consultar-cobranca/:id', async (req, res) => {
  try {
    const resultado = await consultarCobrancaAbacatePay(req.params.id);
    
    if (resultado.success) {
      res.json(resultado.data);
    } else {
      res.status(400).json(resultado.error);
    }
  } catch (error) {
    res.status(500).json({ 
      message: 'Erro interno do servidor',
      error: error.message 
    });
  }
});

// POST /api/abacatepay/webhook
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['x-abacate-signature'] as string;
    const payload = req.body.toString();
    
    const resultado = await processarWebhookAbacatePay(
      payload, 
      signature,
      async (cobrancaId, dados) => {
        // Implementar lógica para atualizar banco de dados
        console.log('Atualizando pedido no banco:', cobrancaId);
        
        // Exemplo: atualizar status no Supabase
        // await supabase
        //   .from('orders')
        //   .update({ 
        //     payment_status: 'paid',
        //     abacatepay_payment_id: cobrancaId,
        //     paid_at: new Date().toISOString()
        //   })
        //   .eq('external_id', dados.external_id);
      }
    );
    
    if (resultado.success) {
      res.status(200).send('OK');
    } else {
      res.status(400).json(resultado.error);
    }
  } catch (error) {
    res.status(500).json({ 
      message: 'Erro interno do servidor',
      error: error.message 
    });
  }
});

export default router;
`;

/**
 * Exemplo de uso no frontend React
 */
export const exemploReactUsage = `
// Exemplo de uso no React - FRONTEND

import { useState } from 'react';

export function usarAbacatePay() {
  const [loading, setLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);

  const criarPagamentoPix = async (dadosPedido) => {
    setLoading(true);
    try {
      const response = await fetch('/api/abacatepay/criar-cobranca', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dadosPedido)
      });

      const data = await response.json();
      
      if (response.ok && data.pix?.qr_code_url) {
        setQrCode(data.pix.qr_code_url);
        return data;
      } else {
        throw new Error(data.message || 'Erro ao criar pagamento');
      }
    } catch (error) {
      console.error('Erro:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return { criarPagamentoPix, loading, qrCode };
}
`;