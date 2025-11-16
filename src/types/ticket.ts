// Tipos compartilhados para tickets
export interface TicketGroup {
  id: string;
  type: 'single' | 'package';
  order_id: string | null;
  customer_name: string;
  customer_email: string;
  event_name: string;
  ticket_count: number;
  total_quantity: number;
  unit_price: number;
  total_value: number;
  status: string;
  created_at: string;
  purchase_date: string | null;
  tickets: any[];
  // Propriedades opcionais para compatibilidade com Admin
  total_amount?: number;
  payment_method?: string;
  payment_status?: string;
  event_date?: string;
  event_location?: string;
  qr_code?: string;
  is_used?: boolean;
  used_at?: string;
}

export interface Ticket {
  id: string;
  event_id: string | null;
  customer_id: string | null;
  ticket_type: string | null;
  quantity: number;
  unit_price: number | null;
  total_price: number | null;
  price: number;
  status: string | null;
  created_at: string | null;
  user_id: string | null;
  qr_code: string | null;
  order_id: string | null;
  ticket_number: string | null; // Número lógico do ticket (ex: orderId-item-1)
  seat_number: string | null; // Número sequencial do assento (0001-1300)
  // Dados relacionados do evento
  events?: {
    id: string;
    name: string;
    event_date: string | null;
    date: string;
    location: string | null;
  };
  // Dados do cliente
  customers?: {
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
  };
  // Dados do pedido
  orders?: {
    id: string;
    total_amount: number;
    status: string;
    payment_status: string;
    created_at: string;
  };
  // Propriedades adicionais para compatibilidade
  updated_at?: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  is_used?: boolean;
  used_at?: string;
  event_name?: string;
  event_date?: string;
  event_location?: string;
}

export interface TicketFilters {
  status?: string;
  event_id?: string;
  customer_email?: string;
  date_range?: {
    start: string;
    end: string;
  };
}

export interface TicketStats {
  total: number;
  active: number;
  used: number;
  cancelled: number;
  revenue: number;
}