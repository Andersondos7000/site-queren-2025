// Carregar variáveis de ambiente
import { config } from 'dotenv';
config();

import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { BatchValidationService } from './batch-validation';
import { getEnvironmentConfig, validateConfig } from '../config/reconciliation.config';
import winston from 'winston';
import { MonitoringService, MetricData } from './monitoring';

// Configuração do Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface PriceInconsistency {
  order_id: string;
  order_item_id: string;
  ticket_id?: string;
  inconsistency_type: 'price_mismatch' | 'quantity_mismatch' | 'batch_error';
  expected_value: number;
  actual_value: number;
}

interface OrphanOrder {
  order_id: string;
  customer_email: string;
  total_amount: number;
  created_at: string;
  items_count: number;
  has_tickets: boolean;
}

interface ReconciliationResult {
  success: boolean;
  processed: number;
  corrected: number;
  inconsistenciesFound: number;
  orphanTicketsProcessed: number;
  orphanTicketsCorrected: number;
  orphanOrdersFound: number;
  orphanOrdersReported: number;
  batchCorrections: number;
  errors: string[];
  executionTime: number;
  executionId: string;
}

export class ReconciliationAgent {
  private readonly config = getEnvironmentConfig();
  private readonly logger: winston.Logger;
  private readonly executionId: string;
  private readonly batchValidator: BatchValidationService;
  private readonly monitoring: MonitoringService;
  private readonly startTime: number;
  private apiCallsCount: number = 0;
  private apiSuccessCount: number = 0;

  constructor() {
    // Validar configuração
    validateConfig(this.config);
    
    // Inicializar logger
    this.logger = winston.createLogger({
      level: this.config.LOG_LEVEL,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      ]
    });
    
    this.executionId = uuidv4();
    this.batchValidator = new BatchValidationService();
    this.monitoring = new MonitoringService();
    this.startTime = Date.now();
    
    this.logger.info('ReconciliationAgent inicializado', {
      executionId: this.executionId,
      config: this.config
    });
  }

  /**
   * Execução principal do agente de reconciliação
   */
  async execute(): Promise<ReconciliationResult> {
    const result: ReconciliationResult = {
      success: false,
      processed: 0,
      corrected: 0,
      inconsistenciesFound: 0,
      orphanTicketsProcessed: 0,
      orphanTicketsCorrected: 0,
      orphanOrdersFound: 0,
      orphanOrdersReported: 0,
      batchCorrections: 0,
      errors: [],
      executionTime: 0,
      executionId: this.executionId
    };

    try {
      // 1. Adquirir lock
      const lockAcquired = await this.acquireLock();
      if (!lockAcquired) {
        result.errors.push('Não foi possível adquirir lock - outra execução em andamento');
        return result;
      }

      this.logger.info('Iniciando reconciliação automática', { executionId: this.executionId });

      // 2. Detectar e corrigir tickets órfãos
      const orphanCorrections = await this.detectAndCorrectOrphanTickets();
      result.orphanTicketsProcessed = orphanCorrections.processed;
      result.orphanTicketsCorrected = orphanCorrections.corrected;
      result.processed += orphanCorrections.processed;
      result.corrected += orphanCorrections.corrected;
      result.errors.push(...orphanCorrections.errors);

      // 3. Detectar pedidos órfãos (sem cobrança AbacatePay)
      const orphanOrders = await this.detectOrphanOrders();
      result.orphanOrdersFound = orphanOrders.length;
      result.orphanOrdersReported = orphanOrders.length;
      result.processed += orphanOrders.length;

      console.log(`[${this.executionId}] Detectados ${orphanOrders.length} pedidos órfãos`);

      // 4. Detectar inconsistências
      const inconsistencies = await this.detectInconsistencies();
      result.inconsistenciesFound = inconsistencies.length;
      result.processed += inconsistencies.length;

      console.log(`[${this.executionId}] Detectadas ${inconsistencies.length} inconsistências`);

      // 5. Validar e corrigir compras em lote
      const batchCorrections = await this.validateAndCorrectBatches();
      result.batchCorrections = batchCorrections.corrected;
      result.processed += batchCorrections.processed;
      result.corrected += batchCorrections.corrected;
      result.errors.push(...batchCorrections.errors);

      // 6. Corrigir inconsistências individuais
      for (const inconsistency of inconsistencies) {
        try {
          await this.correctInconsistency(inconsistency);
          result.corrected++;
        } catch (error) {
          const errorMsg = `Erro ao corrigir ${inconsistency.order_id}: ${error}`;
          result.errors.push(errorMsg);
          console.error(`[${this.executionId}] ${errorMsg}`);
        }
      }

      result.success = result.errors.length === 0;
      console.log(`[${this.executionId}] Reconciliação concluída: ${result.corrected}/${result.processed} corrigidas`);

    } catch (error) {
      result.errors.push(`Erro geral: ${error}`);
      console.error(`[${this.executionId}] Erro geral:`, error);
    } finally {
      // 4. Registrar métricas
      await this.recordExecutionMetrics(result);
      
      // 5. Liberar lock
      await this.releaseLock();
    }

    return result;
  }

  /**
   * Detecta e corrige tickets órfãos (sem order_id)
   */
  private async detectAndCorrectOrphanTickets(): Promise<{processed: number, corrected: number, errors: string[]}> {
    const result = { processed: 0, corrected: 0, errors: [] };

    try {
      this.logger.info('Detectando tickets órfãos', { executionId: this.executionId });

      // Buscar tickets órfãos criados nas últimas 24h
      const { data: orphanTickets, error } = await supabase
        .from('tickets')
        .select(`
          id,
          price,
          quantity,
          created_at,
          event_id,
          events!inner(title, ticket_price)
        `)
        .is('order_id', null)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(this.config.BATCH_SIZE);

      if (error) {
        result.errors.push(`Erro ao buscar tickets órfãos: ${error.message}`);
        return result;
      }

      if (!orphanTickets || orphanTickets.length === 0) {
        this.logger.info('Nenhum ticket órfão encontrado', { executionId: this.executionId });
        return result;
      }

      result.processed = orphanTickets.length;
      this.logger.info(`Encontrados ${orphanTickets.length} tickets órfãos`, { executionId: this.executionId });

      // Para cada ticket órfão, tentar encontrar o pedido correspondente
      for (const ticket of orphanTickets) {
        try {
          const correction = await this.findAndLinkOrphanTicket(ticket);
          if (correction.success) {
            result.corrected++;
            this.logger.info('Ticket órfão corrigido', {
              executionId: this.executionId,
              ticketId: ticket.id,
              orderId: correction.orderId,
              quantity: correction.quantity
            });
          } else {
            result.errors.push(`Ticket ${ticket.id}: ${correction.error}`);
          }
        } catch (error) {
          result.errors.push(`Erro ao processar ticket órfão ${ticket.id}: ${error}`);
        }
      }

    } catch (error) {
      result.errors.push(`Erro geral na detecção de tickets órfãos: ${error}`);
    }

    return result;
  }

  /**
   * Encontra e vincula um ticket órfão ao pedido correto
   */
  private async findAndLinkOrphanTicket(ticket: any): Promise<{success: boolean, orderId?: string, quantity?: number, error?: string}> {
    try {
      // Buscar order_items que referenciam este ticket mas o ticket não tem order_id
      const { data: orderItems, error } = await supabase
        .from('order_items')
        .select(`
          id,
          order_id,
          quantity,
          created_at,
          orders!inner(status, customer_email, created_at)
        `)
        .eq('ticket_id', ticket.id)
        .gte('created_at', new Date(ticket.created_at).getTime() - 5 * 60 * 1000) // 5 minutos antes
        .lte('created_at', new Date(ticket.created_at).getTime() + 5 * 60 * 1000) // 5 minutos depois
        .limit(5);

      if (error) {
        return { success: false, error: `Erro ao buscar order_items: ${error.message}` };
      }

      if (!orderItems || orderItems.length === 0) {
        return { success: false, error: 'Nenhum order_item correspondente encontrado' };
      }

      // Se encontrou apenas um, é provável que seja o correto
      if (orderItems.length === 1) {
        const orderItem = orderItems[0];
        return await this.linkTicketToOrder(ticket, orderItem.order_id, orderItem.quantity);
      }

      // Se encontrou múltiplos, escolher o mais provável baseado na quantidade e timing
      const bestMatch = orderItems.reduce((best, current) => {
        const timeDiff = Math.abs(new Date(current.created_at).getTime() - new Date(ticket.created_at).getTime());
        const bestTimeDiff = Math.abs(new Date(best.created_at).getTime() - new Date(ticket.created_at).getTime());
        
        return timeDiff < bestTimeDiff ? current : best;
      });

      return await this.linkTicketToOrder(ticket, bestMatch.order_id, bestMatch.quantity);

    } catch (error) {
      return { success: false, error: `Exceção: ${error}` };
    }
  }

  /**
   * Vincula um ticket órfão a um pedido
   */
  private async linkTicketToOrder(ticket: any, orderId: string, quantity: number): Promise<{success: boolean, orderId?: string, quantity?: number, error?: string}> {
    try {
      // Determinar tipo do ticket baseado na quantidade
      const ticketType = quantity > 1 ? 'batch' : 'individual';
      const type = quantity > 1 ? 'batch' : 'individual';

      // Atualizar o ticket
      const { error: updateError } = await supabase
        .from('tickets')
        .update({
          order_id: orderId,
          quantity: quantity,
          ticket_type: ticketType,
          type: type,
          updated_at: new Date().toISOString()
        })
        .eq('id', ticket.id);

      if (updateError) {
        return { success: false, error: `Erro ao atualizar ticket: ${updateError.message}` };
      }

      // Registrar na auditoria
      await supabase.from('reconciliation_audit').insert({
        order_id: orderId,
        ticket_id: ticket.id,
        old_status: 'orphan',
        new_status: 'linked',
        old_values: { order_id: null, quantity: ticket.quantity, ticket_type: ticket.ticket_type },
        new_values: { order_id: orderId, quantity: quantity, ticket_type: ticketType },
        reconciliation_type: 'orphan_ticket_correction',
        execution_id: this.executionId
      });

      return { success: true, orderId, quantity };

    } catch (error) {
      return { success: false, error: `Exceção na vinculação: ${error}` };
    }
  }

  /**
   * Detecta pedidos órfãos (sem cobrança no AbacatePay)
   */
  private async detectOrphanOrders(): Promise<OrphanOrder[]> {
    const orphanOrders: OrphanOrder[] = [];

    try {
      // Buscar pedidos pendentes criados há mais de 1 hora sem cobrança AbacatePay
      const { data: ordersWithoutCharges, error } = await supabase
        .from('orders')
        .select(`
          id,
          customer_email,
          total_amount,
          created_at,
          order_items!inner(id, ticket_id)
        `)
        .eq('status', 'pending')
        .lt('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // mais de 1 hora
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // últimos 7 dias
        .limit(this.config.BATCH_SIZE);

      if (error) {
        throw new Error(`Erro ao buscar pedidos: ${error.message}`);
      }

      // Para cada pedido, verificar se existe cobrança no AbacatePay
      for (const order of ordersWithoutCharges || []) {
        const { data: charge, error: chargeError } = await supabase
          .from('abacatepay_charges')
          .select('id')
          .eq('order_id', order.id)
          .single();

        if (chargeError && chargeError.code === 'PGRST116') {
          // Não encontrou cobrança - é um pedido órfão
          const hasTickets = order.order_items.some((item: any) => item.ticket_id);
          
          const orphanOrder: OrphanOrder = {
            order_id: order.id,
            customer_email: order.customer_email || 'N/A',
            total_amount: parseFloat(order.total_amount) || 0,
            created_at: order.created_at,
            items_count: order.order_items.length,
            has_tickets: hasTickets
          };

          orphanOrders.push(orphanOrder);

          // Log do pedido órfão encontrado
          this.logger.warn('Pedido órfão detectado', {
            executionId: this.executionId,
            orderId: order.id,
            customerEmail: order.customer_email,
            totalAmount: order.total_amount,
            createdAt: order.created_at,
            hasTickets,
            itemsCount: order.order_items.length
          });
        }
      }

      // Registrar pedidos órfãos na auditoria
      if (orphanOrders.length > 0) {
        await this.logOrphanOrders(orphanOrders);
      }

    } catch (error) {
      this.logger.error('Erro ao detectar pedidos órfãos', {
        executionId: this.executionId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }

    return orphanOrders;
  }

  /**
   * Detecta inconsistências automáticas em preços e quantidades
   */
  private async detectInconsistencies(): Promise<PriceInconsistency[]> {
    const inconsistencies: PriceInconsistency[] = [];

    // Query para detectar inconsistências de preços em tickets
    const { data: priceIssues, error } = await supabase
      .from('order_items')
      .select(`
        id,
        order_id,
        ticket_id,
        quantity,
        unit_price,
        total_price,
        tickets!inner(price, event_id),
        orders!inner(status, created_at)
      `)
      .eq('orders.status', 'pending')
      .gte('orders.created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // últimas 24h
      .not('ticket_id', 'is', null)
      .limit(this.config.BATCH_SIZE);

    if (error) {
      throw new Error(`Erro ao buscar inconsistências: ${error.message}`);
    }

    // Analisar cada item
    for (const item of priceIssues || []) {
      const expectedPrice = item.tickets.price;
      const actualPrice = parseFloat(item.unit_price);
      const expectedTotal = expectedPrice * item.quantity;
      const actualTotal = parseFloat(item.total_price);

      // Detectar inconsistência de preço unitário
      if (Math.abs(expectedPrice - actualPrice) > 0.01) {
        inconsistencies.push({
          order_id: item.order_id,
          order_item_id: item.id,
          ticket_id: item.ticket_id,
          inconsistency_type: 'price_mismatch',
          expected_value: expectedPrice,
          actual_value: actualPrice
        });
      }

      // Detectar inconsistência de total
      if (Math.abs(expectedTotal - actualTotal) > 0.01) {
        inconsistencies.push({
          order_id: item.order_id,
          order_item_id: item.id,
          ticket_id: item.ticket_id,
          inconsistency_type: 'batch_error',
          expected_value: expectedTotal,
          actual_value: actualTotal
        });
      }
    }

    // Registrar inconsistências detectadas
    if (inconsistencies.length > 0) {
      await this.logInconsistencies(inconsistencies);
    }

    return inconsistencies;
  }

  /**
   * Corrige uma inconsistência específica
   */
  private async correctInconsistency(inconsistency: PriceInconsistency): Promise<void> {
    const { data: orderItem, error: fetchError } = await supabase
      .from('order_items')
      .select('*, tickets(price), orders(total_amount)')
      .eq('id', inconsistency.order_item_id)
      .single();

    if (fetchError || !orderItem) {
      throw new Error(`Item não encontrado: ${fetchError?.message}`);
    }

    const correctPrice = inconsistency.expected_value;
    const quantity = orderItem.quantity;
    const newTotal = correctPrice * quantity;
    const oldTotal = parseFloat(orderItem.total_price);
    const priceDifference = newTotal - oldTotal;

    // Iniciar transação
    const { error: transactionError } = await supabase.rpc('correct_price_inconsistency', {
      p_order_item_id: inconsistency.order_item_id,
      p_order_id: inconsistency.order_id,
      p_new_unit_price: correctPrice,
      p_new_total_price: newTotal,
      p_price_difference: priceDifference,
      p_execution_id: this.executionId
    });

    if (transactionError) {
      throw new Error(`Erro na correção: ${transactionError.message}`);
    }

    // Registrar auditoria
    await this.logCorrection(inconsistency, orderItem, {
      unit_price: correctPrice,
      total_price: newTotal
    });

    console.log(`[${this.executionId}] Corrigido item ${inconsistency.order_item_id}: ${oldTotal} → ${newTotal}`);
  }

  /**
   * Registra pedidos órfãos na auditoria
   */
  private async logOrphanOrders(orphanOrders: OrphanOrder[]): Promise<void> {
    try {
      const auditRecords = orphanOrders.map(order => ({
        order_id: order.order_id,
        charge_id: null,
        old_status: 'pending',
        new_status: 'orphan_detected',
        execution_id: this.executionId,
        reconciled_at: new Date().toISOString(),
        metadata: {
          customer_email: order.customer_email,
          total_amount: order.total_amount,
          items_count: order.items_count,
          has_tickets: order.has_tickets,
          created_at: order.created_at,
          detection_reason: 'no_abacatepay_charge'
        }
      }));

      const { error } = await supabase
        .from('reconciliation_audit')
        .insert(auditRecords);

      if (error) {
        this.logger.error('Erro ao registrar pedidos órfãos na auditoria', {
          executionId: this.executionId,
          error: error.message,
          orphanOrdersCount: orphanOrders.length
        });
      } else {
        this.logger.info('Pedidos órfãos registrados na auditoria', {
          executionId: this.executionId,
          orphanOrdersCount: orphanOrders.length
        });
      }
    } catch (error) {
      this.logger.error('Erro ao processar log de pedidos órfãos', {
        executionId: this.executionId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Registra inconsistências detectadas na auditoria
   */
  private async logInconsistencies(inconsistencies: PriceInconsistency[]): Promise<void> {
    const records = inconsistencies.map(inc => ({
      order_id: inc.order_id,
      order_item_id: inc.order_item_id,
      ticket_id: inc.ticket_id,
      inconsistency_type: inc.inconsistency_type,
      expected_value: inc.expected_value,
      actual_value: inc.actual_value
    }));

    await supabase.from('price_inconsistencies').insert(records);
  }

  /**
   * Registra correção na auditoria
   */
  private async logCorrection(
    inconsistency: PriceInconsistency,
    oldValues: any,
    newValues: any
  ): Promise<void> {
    await supabase.from('reconciliation_audit').insert({
      order_id: inconsistency.order_id,
      old_status: 'pending',
      new_status: 'pending',
      old_values: {
        unit_price: oldValues.unit_price,
        total_price: oldValues.total_price
      },
      new_values: newValues,
      reconciliation_type: inconsistency.inconsistency_type,
      execution_id: this.executionId
    });

    // Marcar inconsistência como resolvida
    await supabase
      .from('price_inconsistencies')
      .update({
        resolved_at: new Date().toISOString(),
        resolution_method: 'automatic_correction'
      })
      .eq('order_id', inconsistency.order_id)
      .eq('order_item_id', inconsistency.order_item_id)
      .is('resolved_at', null);
  }

  /**
   * Valida e corrige compras em lote
   */
  private async validateAndCorrectBatches(): Promise<{processed: number, corrected: number, errors: string[]}> {
    const result = { processed: 0, corrected: 0, errors: [] };

    try {
      // Buscar pedidos com múltiplos itens de ticket (possíveis lotes)
      const { data: batchOrders, error } = await supabase
        .from('orders')
        .select(`
          id,
          status,
          order_items!inner(id, ticket_id, quantity)
        `)
        .eq('status', 'pending')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .not('order_items.ticket_id', 'is', null)
        .limit(this.config.BATCH_SIZE);

      if (error) {
        result.errors.push(`Erro ao buscar pedidos em lote: ${error.message}`);
        return result;
      }

      // Filtrar pedidos que realmente têm compras em lote ou múltiplos tickets
      const ordersToValidate = (batchOrders || []).filter(order => 
        order.order_items.length > 1 || 
        order.order_items.some(item => item.quantity > 1)
      );

      result.processed = ordersToValidate.length;

      this.logger.info('Validando pedidos com compras em lote', { 
        executionId: this.executionId, 
        count: ordersToValidate.length 
      });

      // Validar cada pedido
      for (const order of ordersToValidate) {
        try {
          const validation = await this.batchValidator.validateBatchPurchases(order.id);
          
          if (!validation.isValid && validation.corrections.length > 0) {
            await this.batchValidator.applyCorrections(validation.corrections, this.executionId);
            result.corrected++;
            
            this.logger.info('Lote corrigido', {
              executionId: this.executionId,
              orderId: order.id,
              corrections: validation.corrections.length
            });
          }

          if (validation.errors.length > 0) {
            result.errors.push(...validation.errors.map(err => `Pedido ${order.id}: ${err}`));
          }

        } catch (error) {
          result.errors.push(`Erro na validação do pedido ${order.id}: ${error}`);
        }
      }

    } catch (error) {
      result.errors.push(`Erro geral na validação de lotes: ${error}`);
    }

    return result;
  }

  /**
   * Adquire lock para execução exclusiva
   */
  private async acquireLock(): Promise<boolean> {
    const now = new Date();
    const expiresAt = new Date(Date.now() + this.config.LOCK_TIMEOUT);

    try {
      // Primeiro, verificar se existe um lock ativo
      const { data: existingLock } = await supabase
        .from('reconciliation_locks')
        .select('*')
        .eq('id', 'singleton')
        .single();

      // Se existe um lock e não expirou, não pode adquirir
      if (existingLock && new Date(existingLock.expires_at) > now) {
        this.logger.warn('Lock já existe e não expirou', {
          executionId: this.executionId,
          existingLock: existingLock.execution_id,
          expiresAt: existingLock.expires_at
        });
        return false;
      }

      // Se não existe lock ou expirou, tentar adquirir
      const { error } = await supabase
        .from('reconciliation_locks')
        .upsert({
          id: 'singleton',
          locked_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
          execution_id: this.executionId,
          process_info: {
            pid: process.pid,
            started_at: now.toISOString()
          }
        });

      if (error) {
        this.logger.error('Erro ao adquirir lock', { 
          executionId: this.executionId, 
          error: error.message 
        });
        return false;
      }

      this.logger.info('Lock adquirido com sucesso', {
        executionId: this.executionId,
        expiresAt: expiresAt.toISOString()
      });

      return true;

    } catch (error) {
      this.logger.error('Exceção ao adquirir lock', { 
        executionId: this.executionId, 
        error: error 
      });
      return false;
    }
  }

  /**
   * Registra métricas da execução
   */
  private async recordExecutionMetrics(result: ReconciliationResult): Promise<void> {
    try {
      const duration = Date.now() - this.startTime;
      const apiSuccessRate = this.apiCallsCount > 0 ? this.apiSuccessCount / this.apiCallsCount : 1;

      const metrics: MetricData = {
        executionId: this.executionId,
        timestamp: new Date(),
        duration,
        ordersProcessed: result.processed,
        ordersCorrected: result.corrected,
        errorsCount: result.errors.length,
        apiCallsCount: this.apiCallsCount,
        apiSuccessRate,
        batchCorrections: result.batchCorrections || 0
      };

      await this.monitoring.recordMetrics(metrics);

    } catch (error) {
      this.logger.error('Erro ao registrar métricas', { 
        executionId: this.executionId, 
        error 
      });
    }
  }

  /**
   * Registra chamada de API para métricas
   */
  private recordApiCall(success: boolean): void {
    this.apiCallsCount++;
    if (success) {
      this.apiSuccessCount++;
    }
  }

  /**
   * Libera lock
   */
  private async releaseLock(): Promise<void> {
    await supabase
      .from('reconciliation_locks')
      .delete()
      .eq('execution_id', this.executionId);
  }
}