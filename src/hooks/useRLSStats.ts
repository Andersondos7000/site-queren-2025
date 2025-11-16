import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface RLSStats {
  totalQueries: number;
  averageLatency: number;
  slowQueries: number;
  errorRate: number;
  tableStats: Array<{
    table_name: string;
    avg_duration: number;
    query_count: number;
    error_count: number;
  }>;
  queryTypeStats: Array<{
    query_type: string;
    avg_duration: number;
    query_count: number;
  }>;
  recentSlowQueries: Array<{
    table_name: string;
    policy_name: string;
    query_duration_ms: number;
    query_type: string;
    created_at: string;
  }>;
}

export const useRLSStats = () => {
  const [stats, setStats] = useState<RLSStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);

      // Buscar estatísticas gerais
      const { data: generalStats, error: generalError } = await supabase
        .from('rls_performance_metrics')
        .select('query_duration_ms, query_type')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (generalError) throw generalError;

      // Buscar estatísticas por tabela usando RPC
      const { data: tableStats, error: tableError } = await supabase
        .rpc('get_rls_table_stats');

      if (tableError) {
        console.warn('Erro ao buscar estatísticas por tabela:', tableError);
      }

      // Buscar estatísticas por tipo de query usando RPC
      const { data: queryTypeStats, error: queryTypeError } = await supabase
        .rpc('get_rls_query_type_stats');

      if (queryTypeError) {
        console.warn('Erro ao buscar estatísticas por tipo de query:', queryTypeError);
      }
      // Buscar queries lentas recentes
      const { data: slowQueries, error: slowError } = await supabase
        .from('rls_performance_metrics')
        .select('table_name, policy_name, query_duration_ms, query_type, created_at')
        .gt('query_duration_ms', 100)
        .order('created_at', { ascending: false })
        .limit(10);

      if (slowError) {
        console.warn('Erro ao buscar queries lentas:', slowError);
      }

      // Compilar estatísticas finais
      setStats({
        totalQueries: generalStats?.length || 0,
        averageLatency: generalStats?.length ? 
          generalStats.reduce((acc, curr) => acc + curr.query_duration_ms, 0) / generalStats.length : 0,
        slowQueries: generalStats?.filter(q => q.query_duration_ms > 100).length || 0,
        errorRate: 0, // Implementar quando tivermos métricas de erro
        tableStats: tableStats || [],
        queryTypeStats: queryTypeStats || [],
        recentSlowQueries: slowQueries || []
      });
    } catch (err) {
      console.error('Erro ao buscar estatísticas RLS:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    
    // Atualizar a cada 30 segundos
    const interval = setInterval(fetchStats, 30000);
    
    return () => clearInterval(interval);
  }, []);

  return {
    stats,
    loading,
    error,
    refetch: fetchStats
  };
};