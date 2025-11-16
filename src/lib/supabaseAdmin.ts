import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error('Missing VITE_SUPABASE_URL environment variable');
}

if (!supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_ANON_KEY environment variable');
}

if (!supabaseServiceKey) {
  throw new Error('Missing VITE_SUPABASE_SERVICE_ROLE_KEY environment variable');
}

// Cliente Supabase normal (com RLS)
export const supabaseNormal = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

// Cliente Supabase para operações administrativas que bypassa RLS
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Função helper para verificar se estamos em ambiente de desenvolvimento
export const isDevelopment = () => {
  return import.meta.env.DEV || import.meta.env.MODE === 'development';
};

// Função helper para usar cliente admin apenas em desenvolvimento ou para operações específicas
export const getSupabaseClient = (useAdmin: boolean = false) => {
  if (useAdmin && isDevelopment()) {
    console.warn('🔑 Usando Supabase Admin Client (apenas em desenvolvimento)');
    return supabaseAdmin;
  }
  
  return supabaseNormal;
};