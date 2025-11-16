// Cart utility functions
export type CartProduct = {
  id: string;
  product_id: string;
  name: string;
  price: number;
  image: string;
  images: string[];
  category: string;
  size?: string; // Optional size property
  quantity: number;
  unit_price: number;
  total_price: number;
  metadata: Record<string, unknown>;
};

export type CartTicket = {
  id: string;
  ticket_id: string;
  name: string; // Nome gerado baseado no tipo do ingresso
  price: number; // From tickets.price
  quantity: number;
  unit_price: number;
  total_price: number;
  ticket_type?: string; // From tickets.ticket_type ('individual', 'batch', etc.)
  status?: string; // From tickets.status
  image?: string; // From events.cover_image
  event_title?: string; // From events.title
  event_id?: string; // From events.id - para associar ao evento
  customer_id?: string; // From customers.id - para usuários autenticados
};

export type CartItem = CartProduct | CartTicket;

// Helper function to check if item is a product
export const isCartProduct = (item: CartItem): item is CartProduct => {
  return 'product_id' in item && 'category' in item;
};

// Helper function to check if item is a ticket
export const isCartTicket = (item: CartItem): item is CartTicket => {
  return 'ticket_id' in item && !('product_id' in item);
};