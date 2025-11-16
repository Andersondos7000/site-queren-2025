/**
 * Tipos Unificados - Resolve inconsistências entre diferentes arquivos
 * Este arquivo centraliza as definições de tipos para garantir consistência
 */

// ===== TIPOS ABACATEPAY =====

export interface AbacatePayCustomer {
  name?: string;
  email?: string;
  phone?: string;
  cellphone?: string;
  document?: string;
  taxId?: string; // CPF - alias para document
}

export interface AbacatePayPixRequest {
  amount: number;
  description: string;
  external_id?: string;
  expiresIn?: number; // Tempo de expiração em segundos
  customer?: AbacatePayCustomer;
  metadata?: Record<string, any>;
}

export interface AbacatePayPixResponse {
  // Propriedades principais
  id: string;
  status: 'pending' | 'paid' | 'cancelled' | 'expired' | 'PENDING' | 'PAID' | 'EXPIRED';
  amount: number;
  description: string;
  external_id?: string;
  
  // Códigos PIX - diferentes formatos suportados
  pix_code?: string;
  pix_qr_code?: string;
  brCode?: string; // Código copia-e-cola
  brCodeBase64?: string; // QR Code em base64
  
  // URLs e dados adicionais
  qr_code?: string;
  qr_code_url?: string;
  url?: string;
  billingUrl?: string;
  
  // Datas
  expires_at?: string;
  expiresAt?: string; // Alias para expires_at
  created_at: string;
  updated_at?: string;
  paid_at?: string;
  
  // Dados do cliente
  customer?: AbacatePayCustomer;
  
  // Metadados e configurações
  metadata?: Record<string, any>;
  devMode?: boolean;
  platformFee?: number;
  
  // Estrutura aninhada para compatibilidade com diferentes APIs
  data?: {
    id?: string;
    amount?: number;
    status?: string;
    brCode?: string;
    brCodeBase64?: string;
    expiresAt?: string;
    createdAt?: string;
    updatedAt?: string;
  };
  
  // Estrutura PIX aninhada para compatibilidade
  pix?: {
    qr_code: string;
    qr_code_url: string;
    expires_at: string;
  };
  
  // Campos de formatação
  valor?: number;
  valorFormatado?: string;
  descricao?: string;
  
  // Tratamento de erros
  error?: any;
}

export interface AbacatePayWebhook {
  id: string;
  status: 'pending' | 'paid' | 'cancelled' | 'expired';
  amount: number;
  external_id?: string;
  paid_at?: string;
  metadata?: Record<string, any>;
}

// ===== TIPOS ORDER =====

export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'paid';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type PaymentMethod = 'pix' | 'credit_card' | 'debit_card';

export interface OrderItem {
  id: string;
  order_id: string;
  product_id?: string;
  ticket_id?: string;
  size?: string;
  quantity: number;
  price: number;
  total_price?: number;
  created_at: string;
  
  // Dados relacionados do produto
  products?: {
    id: string;
    name: string;
    category?: string;
    image_url?: string;
    sizes?: string[];
    description?: string;
  };
  
  // Para compatibilidade com diferentes estruturas
  title?: string;
  unit_price?: number;
}

export interface Order {
  // Propriedades principais
  id: string;
  user_id: string;
  status: OrderStatus;
  total_amount: number;
  total?: number; // Alias para total_amount
  
  // Informações de pagamento
  payment_method?: PaymentMethod;
  payment_status?: PaymentStatus;
  payment_id?: string;
  abacatepay_id?: string;
  external_id?: string; // AbacatePay ID
  
  // Informações do cliente
  customer_name?: string;
  customer_email?: string;
  shipping_address?: string;
  
  // Metadados
  order_type?: string;
  notes?: string;
  
  // Datas
  created_at: string;
  updated_at?: string;
  
  // Relacionamentos
  order_items?: OrderItem[];
  profiles?: {
    id: string;
    full_name?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
  };
}

export interface OrderFilters {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  dateFrom?: string;
  dateTo?: string;
  userId?: string;
  
  // Propriedades de paginação
  page?: number;
  limit?: number;
  
  // Para compatibilidade com diferentes implementações
  category?: string;
  active_only?: boolean;
}

// ===== TIPOS DE INPUT =====

export interface CreateOrderInput {
  user_id: string;
  payment_method?: PaymentMethod;
  customer_name?: string;
  customer_email?: string;
  shipping_address?: string;
  notes?: string;
}

export interface CreatePixQrCodeRequest {
  amount: number; // Valor em centavos
  expiresIn: number; // Tempo de expiração em segundos
  description?: string;
  customer: AbacatePayCustomer;
}

export interface CreateChargeRequest {
  amount: number;
  description: string;
  customer: AbacatePayCustomer;
  external_id?: string;
  metadata?: Record<string, any>;
}

// ===== TIPOS DE RESPOSTA =====

export interface McpResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface OrderSummary {
  orders: Order[];
  count: number;
  total_pages?: number;
  current_page?: number;
}

// ===== TIPOS PARA HOOKS =====

export interface UseAbacatePayReturn {
  createPixPayment: (data: AbacatePayPixRequest) => Promise<AbacatePayPixResponse>;
  getPaymentStatus: (paymentId: string) => Promise<AbacatePayPixResponse>;
  cancelPayment: (paymentId: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}

export interface UseRealtimeOrdersReturn {
  orders: Order[];
  loading: boolean;
  error: Error | null;
  isConnected: boolean;
  refetch: () => void;
  getOrderById: (id: string) => Order | undefined;
  getOrdersByStatus: (status: OrderStatus) => Order[];
  updateOrderStatus: (orderId: string, status: OrderStatus, notes?: string) => Promise<void>;
  cancelOrder: (orderId: string, reason?: string) => Promise<void>;
  createOrder: (orderData: Partial<Order>, items: Omit<OrderItem, 'id' | 'order_id' | 'created_at'>[]) => Promise<string>;
}

// ===== TIPOS PARA COMPONENTES =====

export interface PixPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderData: {
    customer: AbacatePayCustomer;
    amount: number; // valor em reais
    description: string;
    items: Array<{
      title: string;
      quantity: number;
      unit_price: number;
    }>;
  };
  clearCart?: () => Promise<void>;
  onPaymentSuccess?: (paymentData: any) => void;
  onPaymentError?: (error: string) => void;
  onPaymentPending?: (paymentData: any) => void;
}

export interface AbacatePayCheckoutProps {
  orderData: {
    customer: AbacatePayCustomer;
    amount: number;
    description: string;
    items: OrderItem[];
  };
  onSuccess?: (response: AbacatePayPixResponse) => void;
  onError?: (error: string) => void;
}

// ===== EXPORTS PARA COMPATIBILIDADE =====

// Re-exports para manter compatibilidade com código existente
export type AbacatePayResponse = AbacatePayPixResponse;
export type AbacatePayOrder = Order;
export type AbacatePayCharge = AbacatePayPixResponse;
export type AbacatePayItem = OrderItem;