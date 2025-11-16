import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config({ path: '.env.backend' });
dotenv.config({ path: '.env.local' });

// Configuração do Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://ojxmfxbflbfinodkhixk.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qeG1meGJmbGJmaW5vZGtoaXhrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDkyNTA4MCwiZXhwIjoyMDcwNTAxMDgwfQ.otn_yr7CqJpg9B_z9XaONVxqHSlNsCro67bVstt5JmQ';

// Cliente Supabase com service role para operações administrativas
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

/**
 * Serviço para integração com Supabase
 */
export class SupabaseService {
  /**
   * Salva uma cobrança do AbacatePay no banco de dados
   * @param {Object} cobrancaData - Dados da cobrança
   * @param {string} orderId - ID da ordem relacionada
   * @returns {Promise<Object>} - Resultado da operação
   */
  static async salvarCobrancaAbacatePay(cobrancaData) {
    try {
      console.log('💾 Salvando cobrança do AbacatePay no Supabase...', {
        chargeId: cobrancaData.chargeId,
        orderId: cobrancaData.orderId,
        amount: cobrancaData.amount
      });

      // Preparar dados para inserção
      const dadosInsercao = {
        order_id: cobrancaData.orderId,
        charge_id: cobrancaData.chargeId,
        amount: cobrancaData.amount, // Valor em centavos
        currency: cobrancaData.currency || 'BRL',
        status: this.mapearStatusAbacatePay(cobrancaData.status),
        payment_method: cobrancaData.paymentMethod || 'pix',
        customer_name: cobrancaData.customerName,
        customer_email: cobrancaData.customerEmail,
        customer_document: cobrancaData.customerDocument,
        description: cobrancaData.description || 'Cobrança PIX',
        qr_code: cobrancaData.qrCode,
        qr_code_url: cobrancaData.qrCodeUrl,
        expires_at: cobrancaData.expiresAt ? new Date(cobrancaData.expiresAt).toISOString() : null,
        metadata: {
          abacatepay_response: cobrancaData.originalResponse,
          external_id: cobrancaData.externalId,
          url: cobrancaData.paymentUrl
        }
      };

      // Inserir na tabela abacatepay_charges
      const { data, error } = await supabase
        .from('abacatepay_charges')
        .insert(dadosInsercao)
        .select()
        .single();

      if (error) {
        console.error('❌ Erro ao salvar cobrança no Supabase:', error);
        throw error;
      }

      console.log('✅ Cobrança salva com sucesso no Supabase:', data.id);
      return { success: true, data };

    } catch (error) {
      console.error('❌ Erro no serviço Supabase:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Atualiza o status de uma cobrança
   * @param {string} chargeId - ID da cobrança no AbacatePay
   * @param {Object} updateData - Dados para atualização
   * @returns {Promise<Object>} - Resultado da operação
   */
  static async atualizarCobrancaAbacatePay(chargeId, updateData) {
    try {
      console.log('🔄 Atualizando cobrança no Supabase...', { chargeId, updateData });

      const dadosAtualizacao = {
        status: this.mapearStatusAbacatePay(updateData.status),
        updated_at: new Date().toISOString()
      };

      // Se foi pago, adicionar data de pagamento
      if (updateData.status === 'paid' || updateData.status === 'confirmed') {
        dadosAtualizacao.paid_at = new Date().toISOString();
      }

      // Atualizar metadata se fornecida
      if (updateData.metadata) {
        dadosAtualizacao.metadata = updateData.metadata;
      }

      const { data, error } = await supabase
        .from('abacatepay_charges')
        .update(dadosAtualizacao)
        .eq('charge_id', chargeId)
        .select()
        .single();

      if (error) {
        console.error('❌ Erro ao atualizar cobrança no Supabase:', error);
        throw error;
      }

      console.log('✅ Cobrança atualizada com sucesso no Supabase:', data.id);
      return { success: true, data };

    } catch (error) {
      console.error('❌ Erro ao atualizar cobrança:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Busca uma cobrança pelo ID do AbacatePay
   * @param {string} chargeId - ID da cobrança no AbacatePay
   * @returns {Promise<Object>} - Dados da cobrança
   */
  static async buscarCobrancaAbacatePay(chargeId) {
    try {
      console.log('🔍 Buscando cobrança no Supabase...', { chargeId });

      const { data, error } = await supabase
        .from('abacatepay_charges')
        .select(`
          *,
          orders (
            id,
            total_amount,
            status,
            customer_data,
            items
          )
        `)
        .eq('charge_id', chargeId)
        .single();

      if (error) {
        console.error('❌ Erro ao buscar cobrança no Supabase:', error);
        throw error;
      }

      console.log('✅ Cobrança encontrada no Supabase:', data.id);
      return { success: true, data };

    } catch (error) {
      console.error('❌ Erro ao buscar cobrança:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Lista cobranças com filtros
   * @param {Object} filtros - Filtros para a consulta
   * @returns {Promise<Object>} - Lista de cobranças
   */
  static async listarCobrancasAbacatePay(filtros = {}) {
    try {
      console.log('📋 Listando cobranças no Supabase...', filtros);

      let query = supabase
        .from('abacatepay_charges')
        .select(`
          *,
          orders (
            id,
            total_amount,
            status,
            customer_data,
            items
          )
        `)
        .order('created_at', { ascending: false });

      // Aplicar filtros
      if (filtros.status) {
        query = query.eq('status', filtros.status);
      }

      if (filtros.customer_email) {
        query = query.eq('customer_email', filtros.customer_email);
      }

      if (filtros.limit) {
        query = query.limit(filtros.limit);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ Erro ao listar cobranças no Supabase:', error);
        throw error;
      }

      console.log(`✅ ${data.length} cobranças encontradas no Supabase`);
      return { success: true, data };

    } catch (error) {
      console.error('❌ Erro ao listar cobranças:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Mapeia status do AbacatePay para status interno
   * @param {string} statusAbacatePay - Status do AbacatePay
   * @returns {string} - Status mapeado
   */
  static mapearStatusAbacatePay(statusAbacatePay) {
    const mapeamento = {
      'pending': 'pending',
      'awaiting_payment': 'pending',
      'paid': 'paid',
      'confirmed': 'paid',
      'cancelled': 'cancelled',
      'expired': 'expired',
      'refunded': 'cancelled'
    };

    return mapeamento[statusAbacatePay] || 'pending';
  }

  /**
   * Busca ordem por ID para associar com cobrança
   * @param {Object} customerData - Dados do cliente
   * @param {number} totalAmount - Valor total
   * @returns {Promise<string|null>} - ID da ordem encontrada
   */
  static async buscarOrdemPorDados(customerData, totalAmount) {
    try {
      console.log('🔍 Buscando ordem por dados do cliente...', {
        email: customerData.email,
        totalAmount
      });

      const { data, error } = await supabase
        .from('orders')
        .select('id')
        .eq('payment_method', 'pix')
        .eq('payment_status', 'pending')
        .eq('total_amount', totalAmount)
        .ilike('customer_data->>email', customerData.email)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        console.log('⚠️ Nenhuma ordem encontrada para associar:', error.message);
        return null;
      }

      console.log('✅ Ordem encontrada para associar:', data.id);
      return data.id;

    } catch (error) {
      console.error('❌ Erro ao buscar ordem:', error);
      return null;
    }
  }
}

export default SupabaseService;