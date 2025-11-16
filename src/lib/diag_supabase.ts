import { supabase } from './supabase';

export const runDiagnostics = async () => {
  console.log('🚀 Iniciando diagnóstico do Supabase...');

  try {
    // 1. Verificar a conexão e a existência da tabela 'home_products'
    console.log("1. Tentando acessar a tabela 'home_products'...");
    const { data: products, error: productsError } = await supabase
      .from('home_products')
      .select('*')
      .limit(1);

    if (productsError) {
      console.error("❌ Erro ao acessar 'home_products':", productsError);
    } else {
      console.log("✅ Tabela 'home_products' acessada com sucesso. Dados:", products);
    }

    // 2. Listar todas as tabelas no schema 'public'
    console.log("\n2. Listando todas as tabelas no schema 'public'...");
    const { data: tables, error: tablesError } = await supabase.rpc('get_public_tables');

    if (tablesError) {
        console.error('❌ Erro ao listar tabelas via RPC. Tentando com query direta...');
        // Fallback para uma query que pode ou não funcionar dependendo das permissões
        const { data: manualTables, error: manualError } = await supabase
            .from('pg_catalog.pg_tables')
            .select('tablename')
            .eq('schemaname', 'public');

        if(manualError) {
            console.error('❌ Erro na query manual para listar tabelas:', manualError);
        } else {
            console.log('✅ Tabelas (via query manual):', manualTables?.map(t => t.tablename));
        }

    } else {
      console.log('✅ Tabelas encontradas no schema public (via RPC):', tables);
    }

  } catch (error) {
    console.error('🔥 Erro inesperado durante o diagnóstico:', error);
  } finally {
    console.log('\n🏁 Diagnóstico finalizado.');
  }
};

// Função RPC para listar tabelas (precisa ser criada no Supabase)
/*
  CREATE OR REPLACE FUNCTION get_public_tables()
  RETURNS TABLE(table_name TEXT) AS $$
  BEGIN
    RETURN QUERY
    SELECT c.relname::text
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'r'
      AND n.nspname = 'public';
  END;
  $$ LANGUAGE plpgsql;
*/