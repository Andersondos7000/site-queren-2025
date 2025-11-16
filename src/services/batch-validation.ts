// Carregar variáveis de ambiente
import { config } from 'dotenv';
config();

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface BatchValidationResult {
  isValid: boolean;
  errors: string[];
  corrections: BatchCorrection[];
}

interface BatchCorrection {
  order_item_id: string;
  field: 'unit_price' | 'total_price' | 'quantity';
  current_value: number;
  expected_value: number;
  reason: string;
}

export class BatchValidationService {
  
  /**
   * Valida automaticamente compras em lote vs tickets individuais
   */
  async validateBatchPurchases(orderId: string): Promise<BatchValidationResult> {
    const result: BatchValidationResult = {
      isValid: true,
      errors: [],
      corrections: []
    };

    try {
      // Buscar todos os itens do pedido
      const { data: orderItems, error } = await supabase
        .from('order_items')
        .select(`
          id,
          order_id,
          ticket_id,
          quantity,
          unit_price,
          total_price,
          tickets!inner(price, event_id, events(title))
        `)
        .eq('order_id', orderId)
        .not('ticket_id', 'is', null);

      if (error) {
        result.errors.push(`Erro ao buscar itens: ${error.message}`);
        result.isValid = false;
        return result;
      }

      if (!orderItems || orderItems.length === 0) {
        return result; // Sem tickets para validar
      }

      // Agrupar por evento para detectar compras em lote
      const eventGroups = this.groupByEvent(orderItems);

      // Validar cada grupo
      for (const [eventId, items] of eventGroups.entries()) {
        const groupValidation = await this.validateEventGroup(eventId, items);
        
        result.corrections.push(...groupValidation.corrections);
        result.errors.push(...groupValidation.errors);
        
        if (!groupValidation.isValid) {
          result.isValid = false;
        }
      }

      // Validar consistência de preços dentro do mesmo evento
      for (const [eventId, items] of eventGroups.entries()) {
        const priceValidation = this.validatePriceConsistency(items);
        
        result.corrections.push(...priceValidation.corrections);
        result.errors.push(...priceValidation.errors);
        
        if (!priceValidation.isValid) {
          result.isValid = false;
        }
      }

    } catch (error) {
      result.errors.push(`Erro na validação: ${error}`);
      result.isValid = false;
    }

    return result;
  }

  /**
   * Agrupa itens por evento
   */
  private groupByEvent(items: any[]): Map<string, any[]> {
    const groups = new Map<string, any[]>();
    
    for (const item of items) {
      const eventId = item.tickets.event_id;
      if (!groups.has(eventId)) {
        groups.set(eventId, []);
      }
      groups.get(eventId)!.push(item);
    }
    
    return groups;
  }

  /**
   * Valida um grupo de itens do mesmo evento
   */
  private async validateEventGroup(eventId: string, items: any[]): Promise<BatchValidationResult> {
    const result: BatchValidationResult = {
      isValid: true,
      errors: [],
      corrections: []
    };

    // Buscar preço oficial do evento
    const { data: eventData, error } = await supabase
      .from('events')
      .select('ticket_price')
      .eq('id', eventId)
      .single();

    if (error || !eventData) {
      result.errors.push(`Erro ao buscar preço do evento ${eventId}`);
      result.isValid = false;
      return result;
    }

    const officialPrice = parseFloat(eventData.ticket_price);

    // Validar cada item
    for (const item of items) {
      const currentUnitPrice = parseFloat(item.unit_price);
      const currentTotalPrice = parseFloat(item.total_price);
      const quantity = item.quantity;
      const expectedTotalPrice = officialPrice * quantity;

      // Validar preço unitário
      if (Math.abs(currentUnitPrice - officialPrice) > 0.01) {
        result.corrections.push({
          order_item_id: item.id,
          field: 'unit_price',
          current_value: currentUnitPrice,
          expected_value: officialPrice,
          reason: `Preço unitário incorreto. Oficial: R$ ${officialPrice.toFixed(2)}`
        });
        result.isValid = false;
      }

      // Validar total
      if (Math.abs(currentTotalPrice - expectedTotalPrice) > 0.01) {
        result.corrections.push({
          order_item_id: item.id,
          field: 'total_price',
          current_value: currentTotalPrice,
          expected_value: expectedTotalPrice,
          reason: `Total incorreto para ${quantity} ingressos. Esperado: R$ ${expectedTotalPrice.toFixed(2)}`
        });
        result.isValid = false;
      }

      // Validar lógica de lote vs individual
      if (quantity > 1) {
        // Compra em lote - verificar se não há duplicação
        const duplicateCheck = await this.checkForDuplicateTickets(item.order_id, eventId, quantity);
        if (duplicateCheck.hasDuplicates) {
          result.errors.push(
            `Possível duplicação: ${quantity} ingressos em lote + ${duplicateCheck.individualCount} individuais para o mesmo evento`
          );
          result.isValid = false;
        }
      }
    }

    return result;
  }

  /**
   * Valida consistência de preços entre itens do mesmo evento
   */
  private validatePriceConsistency(items: any[]): BatchValidationResult {
    const result: BatchValidationResult = {
      isValid: true,
      errors: [],
      corrections: []
    };

    if (items.length <= 1) return result;

    // Agrupar por preço unitário
    const priceGroups = new Map<number, any[]>();
    for (const item of items) {
      const price = parseFloat(item.unit_price);
      if (!priceGroups.has(price)) {
        priceGroups.set(price, []);
      }
      priceGroups.get(price)!.push(item);
    }

    // Se há mais de um preço para o mesmo evento, há inconsistência
    if (priceGroups.size > 1) {
      const prices = Array.from(priceGroups.keys()).sort((a, b) => b - a);
      const correctPrice = prices[0]; // Assumir o maior como correto
      const eventTitle = items[0].tickets.events.title;

      result.errors.push(
        `Inconsistência de preços no evento "${eventTitle}": ${prices.map(p => `R$ ${p.toFixed(2)}`).join(', ')}`
      );

      // Corrigir itens com preço menor
      for (const [price, priceItems] of priceGroups.entries()) {
        if (price < correctPrice) {
          for (const item of priceItems) {
            result.corrections.push({
              order_item_id: item.id,
              field: 'unit_price',
              current_value: price,
              expected_value: correctPrice,
              reason: `Padronização de preço para R$ ${correctPrice.toFixed(2)}`
            });

            const newTotal = correctPrice * item.quantity;
            result.corrections.push({
              order_item_id: item.id,
              field: 'total_price',
              current_value: parseFloat(item.total_price),
              expected_value: newTotal,
              reason: `Recálculo do total: ${item.quantity} × R$ ${correctPrice.toFixed(2)}`
            });
          }
          result.isValid = false;
        }
      }
    }

    return result;
  }

  /**
   * Verifica duplicação de tickets para o mesmo evento
   */
  private async checkForDuplicateTickets(orderId: string, eventId: string, batchQuantity: number) {
    const { data: allItems, error } = await supabase
      .from('order_items')
      .select(`
        id,
        quantity,
        tickets!inner(event_id)
      `)
      .eq('order_id', orderId)
      .eq('tickets.event_id', eventId);

    if (error || !allItems) {
      return { hasDuplicates: false, individualCount: 0 };
    }

    const totalQuantity = allItems.reduce((sum, item) => sum + item.quantity, 0);
    const individualCount = totalQuantity - batchQuantity;

    return {
      hasDuplicates: allItems.length > 1 && individualCount > 0,
      individualCount
    };
  }

  /**
   * Aplica correções automaticamente
   */
  async applyCorrections(corrections: BatchCorrection[], executionId: string): Promise<void> {
    for (const correction of corrections) {
      try {
        // Atualizar o campo específico
        const updateData: any = {};
        updateData[correction.field] = correction.expected_value;
        updateData.updated_at = new Date().toISOString();

        await supabase
          .from('order_items')
          .update(updateData)
          .eq('id', correction.order_item_id);

        // Registrar na auditoria
        await supabase.from('reconciliation_audit').insert({
          order_id: (await supabase
            .from('order_items')
            .select('order_id')
            .eq('id', correction.order_item_id)
            .single()).data?.order_id,
          old_values: { [correction.field]: correction.current_value },
          new_values: { [correction.field]: correction.expected_value },
          reconciliation_type: 'batch_validation',
          execution_id: executionId
        });

        console.log(`✅ Corrigido ${correction.field} do item ${correction.order_item_id}: ${correction.current_value} → ${correction.expected_value}`);

      } catch (error) {
        console.error(`❌ Erro ao corrigir item ${correction.order_item_id}:`, error);
        throw error;
      }
    }
  }
}