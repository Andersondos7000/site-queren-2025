export interface Profile {
  id: string;
  user_id: string;
  
  // Dados pessoais
  name: string;
  email: string;
  phone?: string;
  document_type?: 'cpf' | 'cnpj';
  document_number?: string;
  birth_date?: string;
  
  // Endereço
  address_street?: string;
  address_number?: string;
  address_complement?: string;
  address_neighborhood?: string;
  address_city?: string;
  address_state?: string;
  address_zipcode?: string;
  address_country?: string;
  
  // Metadados
  status: 'active' | 'inactive' | 'blocked';
  customer_type: 'individual' | 'business';
  notes?: string;
  tags?: string[];
  
  // Campos de auditoria
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
  
  // Campos para sincronização realtime
  version: number;
  last_sync_at: string;
  sync_status: 'synced' | 'pending' | 'conflict';
}

export interface ProfileFilters {
  status?: Profile['status'];
  customerType?: Profile['customer_type'];
  userId?: string;
  search?: string;
  tags?: string[];
  createdAfter?: string;
  createdBefore?: string;
}

export interface ProfileSortOptions {
  field: keyof Profile;
  direction: 'asc' | 'desc';
}

export interface ProfileFormData {
  name: string;
  email: string;
  phone?: string;
  document_type?: 'cpf' | 'cnpj';
  document_number?: string;
  birth_date?: string;
  address_street?: string;
  address_number?: string;
  address_complement?: string;
  address_neighborhood?: string;
  address_city?: string;
  address_state?: string;
  address_zipcode?: string;
  address_country?: string;
  status: 'active' | 'inactive' | 'blocked';
  customer_type: 'individual' | 'business';
  notes?: string;
  tags?: string[];
}

export interface ProfileStats {
  total: number;
  active: number;
  inactive: number;
  blocked: number;
  individual: number;
  business: number;
  recentlyCreated: number;
}

export interface ProfileValidationError {
  field: keyof ProfileFormData;
  message: string;
}

export interface ProfileConflict {
  id: string;
  field: keyof Profile;
  localValue: unknown;
  serverValue: unknown;
  timestamp: string;
}

// Utility types
export type ProfileCreateInput = Omit<Profile, 'id' | 'created_at' | 'updated_at' | 'version' | 'last_sync_at' | 'sync_status'>;
export type ProfileUpdateInput = Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at' | 'version' | 'last_sync_at' | 'sync_status'>>;

// Event types for realtime
export interface ProfileRealtimeEvent {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new?: Profile;
  old?: Profile;
  timestamp: string;
}

// Search and pagination
export interface ProfileSearchParams {
  query?: string;
  filters?: ProfileFilters;
  sort?: ProfileSortOptions;
  page?: number;
  limit?: number;
}

export interface ProfileSearchResult {
  profiles: Profile[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// Export/Import types
export interface ProfileExportOptions {
  format: 'csv' | 'xlsx' | 'json';
  fields?: (keyof Profile)[];
  filters?: ProfileFilters;
}

export interface ProfileImportResult {
  success: number;
  errors: Array<{
    row: number;
    field?: string;
    message: string;
    data?: Partial<ProfileFormData>;
  }>;
  duplicates: number;
}

// Address validation
export interface AddressValidation {
  zipcode: string;
  street?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  valid: boolean;
  error?: string;
}

// Document validation
export interface DocumentValidation {
  type: 'cpf' | 'cnpj';
  number: string;
  valid: boolean;
  formatted?: string;
  error?: string;
}