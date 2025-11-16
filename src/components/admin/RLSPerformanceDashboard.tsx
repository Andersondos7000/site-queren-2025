import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { useRLSStats } from '../../hooks/useRLSPerformanceMonitor'
import { Activity, Clock, Database, TrendingUp } from 'lucide-react'
import { cn } from '../../lib/utils'

interface RLSPerformanceDashboardProps {
  className?: string
}

export const RLSPerformanceDashboard: React.FC<RLSPerformanceDashboardProps> = ({ className }) => {
  const { stats, loading, refreshStats } = useRLSStats()

  if (loading && !stats) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <p className="text-gray-500">Nenhuma métrica de performance disponível</p>
        <button 
          onClick={refreshStats}
          className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Tentar Novamente
        </button>
      </div>
    )
  }

  const formatDuration = (ms: number) => {
    if (ms < 1) return `${(ms * 1000).toFixed(0)}μs`
    if (ms < 1000) return `${ms.toFixed(1)}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  const getPerformanceColor = (avgMs: number) => {
    if (avgMs < 50) return 'text-green-600'
    if (avgMs < 100) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getPerformanceBadge = (avgMs: number) => {
    if (avgMs < 50) return <Badge variant="default" className="bg-green-100 text-green-800">Excelente</Badge>
    if (avgMs < 100) return <Badge variant="default" className="bg-yellow-100 text-yellow-800">Bom</Badge>
    return <Badge variant="destructive">Lento</Badge>
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-gray-900">Performance RLS</h2>
        <button 
          onClick={refreshStats}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-2"
          disabled={loading}
        >
          <Activity className="w-4 h-4" />
          {loading ? 'Atualizando...' : 'Atualizar'}
        </button>
      </div>

      {/* Métricas Gerais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Queries</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_queries.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Últimas 24 horas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Latência Média</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getPerformanceColor(stats.avg_duration_ms)}`}>
              {formatDuration(stats.avg_duration_ms)}
            </div>
            <div className="flex items-center gap-2 mt-1">
              {getPerformanceBadge(stats.avg_duration_ms)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pico de Latência</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getPerformanceColor(stats.max_duration_ms)}`}>
              {formatDuration(stats.max_duration_ms)}
            </div>
            <p className="text-xs text-muted-foreground">Maior tempo registrado</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Melhor Tempo</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatDuration(stats.min_duration_ms)}
            </div>
            <p className="text-xs text-muted-foreground">Menor tempo registrado</p>
          </CardContent>
        </Card>
      </div>

      {/* Performance por Tabela */}
      <Card>
        <CardHeader>
          <CardTitle>Performance por Tabela</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(stats.by_table)
              .sort(([,a], [,b]) => b.avg_duration - a.avg_duration)
              .map(([tableName, tableStats]) => (
                <div key={tableName} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Database className="w-5 h-5 text-gray-500" />
                    <div>
                      <p className="font-medium">{tableName}</p>
                      <p className="text-sm text-gray-500">{tableStats.count} queries</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-bold ${getPerformanceColor(tableStats.avg_duration)}`}>
                      {formatDuration(tableStats.avg_duration)}
                    </div>
                    {getPerformanceBadge(tableStats.avg_duration)}
                  </div>
                </div>
              ))
            }
          </div>
        </CardContent>
      </Card>

      {/* Performance por Tipo de Query */}
      <Card>
        <CardHeader>
          <CardTitle>Performance por Tipo de Query</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(stats.by_query_type).map(([queryType, queryStats]) => (
              <div key={queryType} className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">{queryType}</h4>
                  <Badge variant="outline">{queryStats.count}</Badge>
                </div>
                <div className={`text-lg font-bold ${getPerformanceColor(queryStats.avg_duration)}`}>
                  {formatDuration(queryStats.avg_duration)}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Total: {formatDuration(queryStats.total_duration)}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Alertas de Performance */}
      {stats.avg_duration_ms > 100 && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800">⚠️ Alerta de Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-700">
              A latência média das queries RLS está acima de 100ms ({formatDuration(stats.avg_duration_ms)}). 
              Considere otimizar as políticas RLS ou revisar os índices do banco de dados.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}