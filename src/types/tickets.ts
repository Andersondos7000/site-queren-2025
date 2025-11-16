// 🎫 Tipos para Sistema de Tickets Automáticos
// Data: 31 de Janeiro de 2025

export interface ItemPedido {
  type: 'ticket' | 'product';
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  metadata: Record<string, any>;
}

export interface DadosCliente {
  name: string;
  email: string;
  phone?: string;
  document?: string;
}

export interface DadosPedido {
  id: string;
  items: ItemPedido[];
  customer_data: DadosCliente;
  payment_id: string;
  total_amount: number;
  status: string;
}

export interface TicketCriado {
  id: string;
  event_id: string;
  ticket_type: string;
  price: number;
  status: 'active' | 'used' | 'cancelled';
  qr_code: string;
  user_id?: string;
  customer_id?: string;
  order_id: string;
  seat_number?: string | null;
  ticket_number?: string;
  created_at: string;
  updated_at?: string;
}

export interface MetadataTicket {
  event_id: string;
  ticket_type: string;
  event_date?: string;
  event_name?: string;
  seat_number?: string;
  section?: string;
}

export interface ResultadoCriacaoTickets {
  success: boolean;
  tickets_criados: TicketCriado[];
  erros: string[];
  total_tickets: number;
}

export interface ConfiguracaoQRCode {
  size: string;
  format: 'PNG' | 'SVG';
  error_correction: 'L' | 'M' | 'Q' | 'H';
}

// Tipos para validação de items
export interface ItemTicketValido extends ItemPedido {
  type: 'ticket';
  metadata: MetadataTicket;
}

// Status possíveis para tickets
export type StatusTicket = 'active' | 'used' | 'cancelled' | 'expired';

// Tipos para logs e auditoria
export interface LogCriacaoTicket {
  order_id: string;
  ticket_id: string;
  action: 'created' | 'failed' | 'duplicate_skipped';
  timestamp: string;
  details?: string;
}