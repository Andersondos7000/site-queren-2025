import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

interface PerformanceMetric {
  table_name: string
  policy_name: string
  query_duration_ms: number
  query_type: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE'
  user_id?: string
}

interface PerformanceStats {
  total_queries: number
  avg_duration_ms: number
  max_duration_ms: number
  min_duration_ms: number
  by_table: Record<string, {
    count: number
    avg_duration: number
    total_duration: number
  }>
  by_query_type: Record<string, {
    count: number
    avg_duration: number
    total_duration: number
  }>
}

export const useRLSPerformanceMonitor = () => {
  const metricsBuffer = useRef<PerformanceMetric[]>([])
  const flushInterval = useRef<NodeJS.Timeout | null>(null)

  // Função para registrar uma métrica de performance
  const recordMetric = useCallback(async (metric: PerformanceMetric) => {
    // Adicionar ao buffer local
    metricsBuffer.current.push(metric)

    // Se o buffer estiver cheio, fazer flush imediatamente
    if (metricsBuffer.current.length >= 10) {
      await flushMetrics()
    }
  }, [])

  // Função para fazer flush das métricas para o servidor
  const flushMetrics = useCallback(async () => {
    if (metricsBuffer.current.length === 0) return

    const metricsToSend = [...metricsBuffer.current]
    metricsBuffer.current = []

    try {
      // Enviar métricas em batch para a Edge Function
      for (const metric of metricsToSend) {
        await supabase.functions.invoke('rls-performance-monitor', {
          body: metric
        })
      }
    } catch (error) {
      console.warn('Erro ao enviar métricas de performance:', error)
      // Em caso de erro, recolocar as métricas no buffer
      metricsBuffer.current.unshift(...metricsToSend)
    }
  }, [])

  // Função para obter estatísticas de performance
  const getPerformanceStats = useCallback(async (table?: string, hours = 24): Promise<PerformanceStats | null> => {
    try {
      const params = new URLSearchParams()
      if (table) params.append('table', table)
      params.append('hours', hours.toString())

      const { data, error } = await supabase.functions.invoke('rls-performance-monitor', {
        method: 'GET',
        body: null
      })

      if (error) throw error

      return data.stats
    } catch (error) {
      console.error('Erro ao obter estatísticas de performance:', error)
      return null
    }
  }, [])

  // Wrapper para queries com monitoramento automático
  const monitoredQuery = useCallback(async <T>(
    queryFn: () => Promise<T>,
    tableName: string,
    queryType: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE',
    policyName = 'unknown'
  ): Promise<T> => {
    const startTime = performance.now()
    
    try {
      const result = await queryFn()
      const endTime = performance.now()
      const duration = endTime - startTime

      // Registrar métrica de sucesso
      await recordMetric({
        table_name: tableName,
        policy_name: policyName,
        query_duration_ms: duration,
        query_type: queryType,
        user_id: (await supabase.auth.getUser()).data.user?.id
      })

      return result
    } catch (error) {
      const endTime = performance.now()
      const duration = endTime - startTime

      // Registrar métrica de erro (com duração até o erro)
      await recordMetric({
        table_name: tableName,
        policy_name: `${policyName}_ERROR`,
        query_duration_ms: duration,
        query_type: queryType,
        user_id: (await supabase.auth.getUser()).data.user?.id
      })

      throw error
    }
  }, [recordMetric])

  // Configurar flush automático a cada 30 segundos
  useEffect(() => {
    flushInterval.current = setInterval(flushMetrics, 30000)

    // Flush ao desmontar o componente
    return () => {
      if (flushInterval.current) {
        clearInterval(flushInterval.current)
      }
      flushMetrics()
    }
  }, [flushMetrics])

  // Flush ao sair da página
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Usar sendBeacon para envio assíncrono ao sair da página
      if (metricsBuffer.current.length > 0) {
        navigator.sendBeacon(
          '/api/rls-metrics',
          JSON.stringify(metricsBuffer.current)
        )
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  return {
    recordMetric,
    getPerformanceStats,
    monitoredQuery,
    flushMetrics
  }
}

// Hook para componentes que precisam de estatísticas em tempo real
export const useRLSStats = (tableName?: string, refreshInterval = 60000) => {
  const { getPerformanceStats } = useRLSPerformanceMonitor()
  const [stats, setStats] = useState<PerformanceStats | null>(null)
  const [loading, setLoading] = useState(false)

  const refreshStats = useCallback(async () => {
    setLoading(true)
    try {
      const newStats = await getPerformanceStats(tableName)
      setStats(newStats)
    } catch (error) {
      console.error('Erro ao atualizar estatísticas:', error)
    } finally {
      setLoading(false)
    }
  }, [getPerformanceStats, tableName])

  useEffect(() => {
    refreshStats()
    const interval = setInterval(refreshStats, refreshInterval)
    return () => clearInterval(interval)
  }, [refreshStats, refreshInterval])

  return { stats, loading, refreshStats }
}