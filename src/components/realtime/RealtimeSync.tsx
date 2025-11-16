import React, { useState, useEffect, useCallback } from 'react'
import { useRealtime } from './RealtimeProvider'

interface RealtimeSyncProps {
  tables?: string[]
  autoSync?: boolean
  syncInterval?: number
  onSyncStart?: () => void
  onSyncComplete?: (results: SyncResult[]) => void
  onSyncError?: (error: Error) => void
  showProgress?: boolean
  className?: string
  style?: React.CSSProperties
}

interface SyncResult {
  table: string
  success: boolean
  recordsAffected: number
  duration: number
  error?: string
}

interface SyncProgress {
  table: string
  status: 'pending' | 'syncing' | 'completed' | 'error'
  progress: number
  recordsProcessed: number
  totalRecords: number
  startTime?: number
  endTime?: number
  error?: string
}

const RealtimeSync: React.FC<RealtimeSyncProps> = ({
  tables = ['products', 'orders', 'events', 'cart_items'],
  autoSync = false,
  syncInterval = 30000, // 30 segundos
  onSyncStart,
  onSyncComplete,
  onSyncError,
  showProgress = true,
  className = '',
  style = {}
}) => {
  const { isConnected, forceSync, getMetrics } = useRealtime()
  
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState<Map<string, SyncProgress>>(new Map())
  const [lastSyncResults, setLastSyncResults] = useState<SyncResult[]>([])
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(autoSync)
  const [syncHistory, setSyncHistory] = useState<{ timestamp: Date; results: SyncResult[] }[]>([])

  // Auto sync timer
  useEffect(() => {
    if (!autoSyncEnabled || !isConnected) return

    const interval = setInterval(() => {
      handleSync()
    }, syncInterval)

    return () => clearInterval(interval)
  }, [autoSyncEnabled, isConnected, syncInterval])

  // Simular progresso de sincronização
  const simulateSyncProgress = useCallback((table: string, totalRecords: number) => {
    return new Promise<SyncResult>((resolve) => {
      const startTime = Date.now()
      let processed = 0
      
      setSyncProgress(prev => new Map(prev.set(table, {
        table,
        status: 'syncing',
        progress: 0,
        recordsProcessed: 0,
        totalRecords,
        startTime
      })))

      const progressInterval = setInterval(() => {
        processed += Math.floor(Math.random() * 5) + 1
        const progress = Math.min((processed / totalRecords) * 100, 100)
        
        setSyncProgress(prev => new Map(prev.set(table, {
          table,
          status: progress >= 100 ? 'completed' : 'syncing',
          progress,
          recordsProcessed: Math.min(processed, totalRecords),
          totalRecords,
          startTime
        })))

        if (progress >= 100) {
          clearInterval(progressInterval)
          const endTime = Date.now()
          const duration = endTime - startTime
          
          // Simular possível erro (5% de chance)
          const hasError = Math.random() < 0.05
          
          if (hasError) {
            setSyncProgress(prev => new Map(prev.set(table, {
              table,
              status: 'error',
              progress: 100,
              recordsProcessed: processed,
              totalRecords,
              startTime,
              endTime,
              error: 'Network timeout or data conflict'
            })))
            
            resolve({
              table,
              success: false,
              recordsAffected: 0,
              duration,
              error: 'Network timeout or data conflict'
            })
          } else {
            resolve({
              table,
              success: true,
              recordsAffected: totalRecords,
              duration
            })
          }
        }
      }, 100 + Math.random() * 200) // Velocidade variável
    })
  }, [])

  // Função principal de sincronização
  const handleSync = useCallback(async () => {
    if (isSyncing || !isConnected) return

    setIsSyncing(true)
    onSyncStart?.()

    try {
      // Resetar progresso
      setSyncProgress(new Map())
      
      // Simular contagem de registros para cada tabela
      const tableCounts = {
        products: Math.floor(Math.random() * 100) + 50,
        orders: Math.floor(Math.random() * 200) + 100,
        events: Math.floor(Math.random() * 50) + 20,
        cart_items: Math.floor(Math.random() * 300) + 150
      }

      // Executar sincronização para cada tabela
      const syncPromises = tables.map(table => 
        simulateSyncProgress(table, tableCounts[table as keyof typeof tableCounts] || 50)
      )

      const results = await Promise.all(syncPromises)
      
      setLastSyncResults(results)
      setSyncHistory(prev => [
        { timestamp: new Date(), results },
        ...prev.slice(0, 9) // Manter apenas os últimos 10
      ])
      
      onSyncComplete?.(results)
      
      // Executar força de sincronização real do provider
      await forceSync()
      
    } catch (error) {
      const syncError = error instanceof Error ? error : new Error('Unknown sync error')
      onSyncError?.(syncError)
      
      // Marcar todas as tabelas como erro
      tables.forEach(table => {
        setSyncProgress(prev => new Map(prev.set(table, {
          table,
          status: 'error',
          progress: 0,
          recordsProcessed: 0,
          totalRecords: 0,
          error: syncError.message
        })))
      })
    } finally {
      setIsSyncing(false)
    }
  }, [isSyncing, isConnected, tables, onSyncStart, onSyncComplete, onSyncError, forceSync, simulateSyncProgress])

  // Função para sincronizar tabela específica
  const handleSyncTable = useCallback(async (table: string) => {
    if (isSyncing || !isConnected) return

    setIsSyncing(true)
    
    try {
      const totalRecords = Math.floor(Math.random() * 100) + 50
      const result = await simulateSyncProgress(table, totalRecords)
      
      setLastSyncResults([result])
      onSyncComplete?.([result])
      
    } catch (error) {
      const syncError = error instanceof Error ? error : new Error('Unknown sync error')
      onSyncError?.(syncError)
    } finally {
      setIsSyncing(false)
    }
  }, [isSyncing, isConnected, onSyncComplete, onSyncError, simulateSyncProgress])

  // Calcular estatísticas gerais
  const getOverallStats = () => {
    const totalTables = tables.length
    const completedTables = Array.from(syncProgress.values()).filter(p => p.status === 'completed').length
    const errorTables = Array.from(syncProgress.values()).filter(p => p.status === 'error').length
    const overallProgress = totalTables > 0 ? (completedTables / totalTables) * 100 : 0
    
    return { totalTables, completedTables, errorTables, overallProgress }
  }

  const stats = getOverallStats()
  const metrics = getMetrics()

  return (
    <div className={className} style={{ 
      padding: '16px',
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
      backgroundColor: '#ffffff',
      ...style 
    }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '16px'
      }}>
        <h3 style={{ 
          margin: 0, 
          fontSize: '16px', 
          fontWeight: 'bold',
          color: '#374151'
        }}>
          🔄 Realtime Sync
        </h3>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '4px',
            fontSize: '12px',
            color: '#6b7280'
          }}>
            <input
              type="checkbox"
              checked={autoSyncEnabled}
              onChange={(e) => setAutoSyncEnabled(e.target.checked)}
              disabled={!isConnected}
            />
            Auto Sync
          </label>
          
          <div style={{
            padding: '4px 8px',
            borderRadius: '12px',
            fontSize: '10px',
            fontWeight: 'bold',
            backgroundColor: isConnected ? '#dcfce7' : '#fee2e2',
            color: isConnected ? '#166534' : '#991b1b'
          }}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </div>
        </div>
      </div>

      {/* Controles principais */}
      <div style={{ 
        display: 'flex', 
        gap: '8px', 
        marginBottom: '16px'
      }}>
        <button
          onClick={handleSync}
          disabled={isSyncing || !isConnected}
          style={{
            flex: 1,
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: 'bold',
            border: 'none',
            borderRadius: '6px',
            backgroundColor: isSyncing ? '#f3f4f6' : '#3b82f6',
            color: isSyncing ? '#9ca3af' : 'white',
            cursor: isSyncing || !isConnected ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          {isSyncing ? 'Syncing...' : 'Sync All Tables'}
        </button>
        
        <button
          onClick={() => {
            setSyncProgress(new Map())
            setLastSyncResults([])
          }}
          disabled={isSyncing}
          style={{
            padding: '8px 12px',
            fontSize: '14px',
            border: '1px solid #d1d5db',
            borderRadius: '6px',
            backgroundColor: '#ffffff',
            color: '#374151',
            cursor: isSyncing ? 'not-allowed' : 'pointer'
          }}
        >
          Clear
        </button>
      </div>

      {/* Progresso geral */}
      {isSyncing && showProgress && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '8px'
          }}>
            <span style={{ fontSize: '12px', color: '#6b7280' }}>Overall Progress</span>
            <span style={{ fontSize: '12px', fontWeight: 'bold' }}>
              {stats.completedTables}/{stats.totalTables} tables
            </span>
          </div>
          
          <div style={{
            width: '100%',
            height: '8px',
            backgroundColor: '#f3f4f6',
            borderRadius: '4px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${stats.overallProgress}%`,
              height: '100%',
              backgroundColor: stats.errorTables > 0 ? '#f59e0b' : '#10b981',
              transition: 'width 0.3s ease'
            }} />
          </div>
        </div>
      )}

      {/* Progresso por tabela */}
      {showProgress && syncProgress.size > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <h4 style={{ 
            margin: '0 0 8px 0', 
            fontSize: '14px', 
            color: '#374151' 
          }}>
            Table Progress
          </h4>
          
          {Array.from(syncProgress.entries()).map(([table, progress]) => (
            <div key={table} style={{ marginBottom: '8px' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '4px'
              }}>
                <span style={{ 
                  fontSize: '12px', 
                  fontWeight: 'bold',
                  color: '#374151'
                }}>
                  📊 {table}
                </span>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '10px', color: '#6b7280' }}>
                    {progress.recordsProcessed}/{progress.totalRecords}
                  </span>
                  
                  <span style={{
                    fontSize: '10px',
                    padding: '2px 6px',
                    borderRadius: '10px',
                    backgroundColor: 
                      progress.status === 'completed' ? '#dcfce7' :
                      progress.status === 'error' ? '#fee2e2' :
                      progress.status === 'syncing' ? '#fef3c7' : '#f3f4f6',
                    color:
                      progress.status === 'completed' ? '#166534' :
                      progress.status === 'error' ? '#991b1b' :
                      progress.status === 'syncing' ? '#92400e' : '#6b7280'
                  }}>
                    {progress.status}
                  </span>
                  
                  <button
                    onClick={() => handleSyncTable(table)}
                    disabled={isSyncing || !isConnected}
                    style={{
                      padding: '2px 6px',
                      fontSize: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      backgroundColor: '#ffffff',
                      color: '#374151',
                      cursor: isSyncing || !isConnected ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Sync
                  </button>
                </div>
              </div>
              
              <div style={{
                width: '100%',
                height: '4px',
                backgroundColor: '#f3f4f6',
                borderRadius: '2px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${progress.progress}%`,
                  height: '100%',
                  backgroundColor: 
                    progress.status === 'error' ? '#ef4444' :
                    progress.status === 'completed' ? '#10b981' : '#3b82f6',
                  transition: 'width 0.3s ease'
                }} />
              </div>
              
              {progress.error && (
                <div style={{
                  fontSize: '10px',
                  color: '#ef4444',
                  marginTop: '2px',
                  fontStyle: 'italic'
                }}>
                  Error: {progress.error}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Resultados da última sincronização */}
      {lastSyncResults.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <h4 style={{ 
            margin: '0 0 8px 0', 
            fontSize: '14px', 
            color: '#374151' 
          }}>
            Last Sync Results
          </h4>
          
          <div style={{
            backgroundColor: '#f9fafb',
            borderRadius: '6px',
            padding: '8px',
            fontSize: '11px'
          }}>
            {lastSyncResults.map((result, index) => (
              <div key={`${result.table}-${index}`} style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                padding: '4px 0',
                borderBottom: index < lastSyncResults.length - 1 ? '1px solid #e5e7eb' : 'none'
              }}>
                <span style={{ fontWeight: 'bold' }}>
                  {result.success ? '✅' : '❌'} {result.table}
                </span>
                <span style={{ color: '#6b7280' }}>
                  {result.success ? `${result.recordsAffected} records` : result.error} 
                  ({result.duration}ms)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Estatísticas */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
        gap: '8px',
        fontSize: '11px'
      }}>
        <div style={{
          padding: '8px',
          backgroundColor: '#f0f9ff',
          borderRadius: '4px',
          textAlign: 'center' as const
        }}>
          <div style={{ fontWeight: 'bold', color: '#0369a1' }}>{metrics.totalSyncs}</div>
          <div style={{ color: '#0284c7' }}>Total Syncs</div>
        </div>
        
        <div style={{
          padding: '8px',
          backgroundColor: '#f0fdf4',
          borderRadius: '4px',
          textAlign: 'center' as const
        }}>
          <div style={{ fontWeight: 'bold', color: '#166534' }}>
            {metrics.averageSyncDuration.toFixed(0)}ms
          </div>
          <div style={{ color: '#15803d' }}>Avg Duration</div>
        </div>
        
        <div style={{
          padding: '8px',
          backgroundColor: metrics.errorCount > 0 ? '#fef2f2' : '#f0fdf4',
          borderRadius: '4px',
          textAlign: 'center' as const
        }}>
          <div style={{ 
            fontWeight: 'bold', 
            color: metrics.errorCount > 0 ? '#991b1b' : '#166534' 
          }}>
            {metrics.errorCount}
          </div>
          <div style={{ 
            color: metrics.errorCount > 0 ? '#dc2626' : '#15803d' 
          }}>
            Errors
          </div>
        </div>
        
        <div style={{
          padding: '8px',
          backgroundColor: '#fefce8',
          borderRadius: '4px',
          textAlign: 'center' as const
        }}>
          <div style={{ fontWeight: 'bold', color: '#a16207' }}>
            {Math.floor(metrics.uptime / 1000)}s
          </div>
          <div style={{ color: '#ca8a04' }}>Uptime</div>
        </div>
      </div>
    </div>
  )
}

export default RealtimeSync