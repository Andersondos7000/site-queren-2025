import crypto from 'crypto';

// Configurações do webhook
const WEBHOOK_SECRET = 'webh_dev_AWChUaMh0HTZKDtTPxsBAWpf';

// Interface para os dados do webhook
interface WebhookAbacatePayData {
  evento: 'cobranca.paga' | 'cobranca.expirada' | 'cobranca.cancelada';
  dados: {
    id: string;
    valor: number;
    status: 'paga' | 'expirada' | 'cancelada' | 'pendente';
    descricao: string;
    cliente: {
      nome: string;
      email: string;
      cpf: string;
    };
    pix?: {
      qr_code: string;
      qr_code_url: string;
      expires_at: string;
    };
    created_at: string;
    updated_at: string;
  };
}

// Função para validar assinatura HMAC
export function validarAssinaturaWebhook(
  payload: string,
  signature: string
): boolean {
  try {
    const expectedSignature = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');
    
    return signature === expectedSignature;
  } catch (error) {
    console.error('Erro ao validar assinatura do webhook:', error);
    return false;
  }
}

// Função para processar webhook da AbacatePay
export async function processarWebhookAbacatePay(
  payload: WebhookAbacatePayData
): Promise<{ success: boolean; message: string }> {
  try {
    const { evento, dados } = payload;
    
    console.log(`📨 Webhook recebido - Evento: ${evento}, ID: ${dados.id}`);
    
    switch (evento) {
      case 'cobranca.paga':
        console.log('✅ Pagamento confirmado:', {
          id: dados.id,
          valor: dados.valor / 100, // Converter de centavos para reais
          cliente: dados.cliente.nome,
          email: dados.cliente.email
        });
        
        // Aqui você deve atualizar o status do pedido no seu banco de dados
        // Exemplo com Supabase:
        /*
        const { error } = await supabase
          .from('pedidos')
          .update({ 
            status: 'pago',
            payment_id: dados.id,
            paid_at: new Date().toISOString()
          })
          .eq('abacatepay_charge_id', dados.id);
        
        if (error) {
          throw new Error(`Erro ao atualizar pedido: ${error.message}`);
        }
        */
        
        // Enviar email de confirmação para o cliente
        // await enviarEmailConfirmacao(dados.cliente.email, dados);
        
        return {
          success: true,
          message: 'Pagamento processado com sucesso'
        };
        
      case 'cobranca.expirada':
        console.log('⏰ Cobrança expirada:', dados.id);
        
        // Atualizar status para expirado
        /*
        const { error } = await supabase
          .from('pedidos')
          .update({ 
            status: 'expirado',
            expired_at: new Date().toISOString()
          })
          .eq('abacatepay_charge_id', dados.id);
        */
        
        return {
          success: true,
          message: 'Cobrança expirada processada'
        };
        
      case 'cobranca.cancelada':
        console.log('❌ Cobrança cancelada:', dados.id);
        
        // Atualizar status para cancelado
        /*
        const { error } = await supabase
          .from('pedidos')
          .update({ 
            status: 'cancelado',
            cancelled_at: new Date().toISOString()
          })
          .eq('abacatepay_charge_id', dados.id);
        */
        
        return {
          success: true,
          message: 'Cobrança cancelada processada'
        };
        
      default:
        console.warn('⚠️ Evento não reconhecido:', evento);
        return {
          success: false,
          message: `Evento não reconhecido: ${evento}`
        };
    }
  } catch (error) {
    console.error('❌ Erro ao processar webhook:', error);
    return {
      success: false,
      message: `Erro interno: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    };
  }
}

// Exemplo de implementação para Express.js
export const exemploExpressWebhook = `
// POST /api/webhook-abacatepay
app.post('/api/webhook-abacatepay', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['x-abacate-signature'] as string;
    const payload = req.body.toString();
    
    // Validar assinatura HMAC
    if (!validarAssinaturaWebhook(payload, signature)) {
      console.error('❌ Assinatura inválida do webhook');
      return res.status(401).json({ erro: 'Assinatura inválida' });
    }
    
    // Processar webhook
    const webhookData = JSON.parse(payload);
    const resultado = await processarWebhookAbacatePay(webhookData);
    
    if (resultado.success) {
      res.status(200).json({ message: resultado.message });
    } else {
      res.status(400).json({ erro: resultado.message });
    }
  } catch (error) {
    console.error('❌ Erro no endpoint webhook:', error);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
});
`;

// Exemplo de implementação para Next.js API Routes
export const exemploNextJSWebhook = `
// pages/api/webhook-abacatepay.ts ou app/api/webhook-abacatepay/route.ts
// import { NextApiRequest, NextApiResponse } from 'next';
import { validarAssinaturaWebhook, processarWebhookAbacatePay } from '@/api/webhook-abacatepay';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ erro: 'Método não permitido' });
  }
  
  try {
    const signature = req.headers['x-abacate-signature'] as string;
    const payload = JSON.stringify(req.body);
    
    // Validar assinatura HMAC
    if (!validarAssinaturaWebhook(payload, signature)) {
      return res.status(401).json({ erro: 'Assinatura inválida' });
    }
    
    // Processar webhook
    const resultado = await processarWebhookAbacatePay(req.body);
    
    if (resultado.success) {
      res.status(200).json({ message: resultado.message });
    } else {
      res.status(400).json({ erro: resultado.message });
    }
  } catch (error) {
    console.error('❌ Erro no webhook:', error);
    res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}
`;

// Função para registrar webhook na AbacatePay (executar uma vez)
export async function registrarWebhookAbacatePay(
  webhookUrl: string,
  apiKey: string = 'abc_dev_fhb5Dh0s24wHQ6XWgFAGdzjc'
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const response = await fetch('https://api.abacatepay.com/v1/webhooks', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: webhookUrl,
        eventos: ['cobranca.paga', 'cobranca.expirada', 'cobranca.cancelada']
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.mensagem || `Erro HTTP: ${response.status}`);
    }

    console.log('✅ Webhook registrado com sucesso:', data);
    return { success: true, data };
  } catch (error) {
    console.error('❌ Erro ao registrar webhook:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
}

// Exemplo de uso para registrar o webhook
export const exemploRegistroWebhook = `
// Execute este código uma vez para registrar o webhook
import { registrarWebhookAbacatePay } from '@/api/webhook-abacatepay';

async function configurarWebhook() {
  const webhookUrl = 'https://borboletaeventos-stripe.ultrahook.com/webhook/abacatepay';
  const resultado = await registrarWebhookAbacatePay(webhookUrl);
  
  if (resultado.success) {
    console.log('✅ Webhook configurado com sucesso!');
  } else {
    console.error('❌ Erro ao configurar webhook:', resultado.error);
  }
}

configurarWebhook();
`;