import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { useRealtimeSync, useConnectionStatus } from '../../hooks/realtime'

// Tipos para o contexto
interface RealtimeContextType {
  supabase: SupabaseClient | null
  isConnected: boolean
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error'
  lastSync: Date | null
  syncCount: number
  channels: Map<string, RealtimeChannel>
  subscribe: (table: string, callback: (payload: any) => void) => () => void
  unsubscribe: (table: string) => void
  forceSync: () => Promise<void>
  getMetrics: () => RealtimeMetrics
}

interface RealtimeMetrics {
  totalSyncs: number
  lastSyncDuration: number
  averageSyncDuration: number
  errorCount: number
  uptime: number
}

interface RealtimeProviderProps {
  children: ReactNode
  supabaseUrl?: string
  supabaseKey?: string
  enableDebug?: boolean
  autoReconnect?: boolean
  maxReconnectAttempts?: number
  config?: {
    supabaseUrl?: string
    supabaseAnonKey?: string
    enableOptimisticUpdates?: boolean
    enableRetry?: boolean
    maxRetries?: number
    retryDelay?: number
    enableConflictResolution?: boolean
  }
}

// Contexto
const RealtimeContext = createContext<RealtimeContextType | null>(null)

// Hook para usar o contexto
export const useRealtime = () => {
  const context = useContext(RealtimeContext)
  if (!context) {
    throw new Error('useRealtime must be used within a RealtimeProvider')
  }
  return context
}

// Provider principal
export const RealtimeProvider: React.FC<RealtimeProviderProps> = ({
  children,
  enableDebug = process.env.NODE_ENV === 'development',
  autoReconnect = true,
  maxReconnectAttempts = 5,
  config
}) => {
  // Estados - usar a instância principal do Supabase
  const [supabaseClient] = useState<SupabaseClient>(supabase)
  
  const [channels, setChannels] = useState<Map<string, RealtimeChannel>>(new Map())
  const [syncCount, setSyncCount] = useState(0)
  const [lastSync, setLastSync] = useState<Date | null>(null)
  const [metrics, setMetrics] = useState<RealtimeMetrics>({
    totalSyncs: 0,
    lastSyncDuration: 0,
    averageSyncDuration: 0,
    errorCount: 0,
    uptime: 0
  })
  const [startTime] = useState(new Date())

  // Hooks de conexão - usar a instância principal
  const { isConnected, connectionStatus } = useConnectionStatus(supabaseClient)

  // Inicialização - não criar nova instância, apenas configurar
  useEffect(() => {
    if (enableDebug) {
      console.log('🔄 Supabase Realtime Provider initialized with main instance')
    }

    return () => {
      // Cleanup: remover todos os canais
      channels.forEach(channel => {
        supabaseClient.removeChannel(channel)
      })
    }
  }, [enableDebug, supabaseClient, channels])

  // Função para inscrever em uma tabela
  const subscribe = (table: string, callback: (payload: any) => void) => {
    if (!supabaseClient) {
      console.warn('Supabase not initialized')
      return () => {}
    }

    // Verificar se já existe um canal para esta tabela
    if (channels.has(table)) {
      console.warn(`Already subscribed to table: ${table}`)
      return () => {}
    }

    const channel = supabaseClient
      .channel(`realtime:${table}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table
        },
        (payload) => {
          const syncStart = performance.now()
          
          try {
            callback(payload)
            
            // Atualizar métricas
            const syncDuration = performance.now() - syncStart
            setSyncCount(prev => prev + 1)
            setLastSync(new Date())
            
            setMetrics(prev => ({
              ...prev,
              totalSyncs: prev.totalSyncs + 1,
              lastSyncDuration: syncDuration,
              averageSyncDuration: (prev.averageSyncDuration * prev.totalSyncs + syncDuration) / (prev.totalSyncs + 1),
              uptime: Date.now() - startTime.getTime()
            }))

            if (enableDebug) {
              console.log(`📡 Realtime update from ${table}:`, payload)
            }
          } catch (error) {
            console.error(`Error processing realtime update from ${table}:`, error)
            setMetrics(prev => ({
              ...prev,
              errorCount: prev.errorCount + 1
            }))
          }
        }
      )
      .subscribe((status) => {
        if (enableDebug) {
          console.log(`📡 Subscription status for ${table}:`, status)
        }
      })

    // Adicionar canal ao mapa
    setChannels(prev => new Map(prev).set(table, channel))

    // Retornar função de cleanup
    return () => {
      supabaseClient.removeChannel(channel)
      setChannels(prev => {
        const newChannels = new Map(prev)
        newChannels.delete(table)
        return newChannels
      })
    }
  }

  // Função para cancelar inscrição
  const unsubscribe = (table: string) => {
    if (!supabaseClient) return

    const channel = channels.get(table)
    if (channel) {
      supabaseClient.removeChannel(channel)
      setChannels(prev => {
        const newChannels = new Map(prev)
        newChannels.delete(table)
        return newChannels
      })

      if (enableDebug) {
        console.log(`🔌 Unsubscribed from ${table}`)
      }
    }
  }

  // Função para forçar sincronização
  const forceSync = async () => {
    if (!supabaseClient) return

    try {
      const syncStart = performance.now()
      
      // Reconectar todos os canais
      const channelEntries = Array.from(channels.entries())
      
      for (const [table, channel] of channelEntries) {
        await supabase.removeChannel(channel)
        // Recriar canal seria necessário ter o callback original
        // Por simplicidade, apenas removemos e o componente deve recriar
      }
      
      setChannels(new Map())
      
      const syncDuration = performance.now() - syncStart
      setLastSync(new Date())
      
      setMetrics(prev => ({
        ...prev,
        lastSyncDuration: syncDuration
      }))

      if (enableDebug) {
        console.log('🔄 Force sync completed')
      }
    } catch (error) {
      console.error('Error during force sync:', error)
      setMetrics(prev => ({
        ...prev,
        errorCount: prev.errorCount + 1
      }))
    }
  }

  // Função para obter métricas
  const getMetrics = (): RealtimeMetrics => ({
    ...metrics,
    uptime: Date.now() - startTime.getTime()
  })

  // Valor do contexto
  const contextValue: RealtimeContextType = {
    supabase: supabaseClient,
    isConnected,
    connectionStatus,
    lastSync,
    syncCount,
    channels,
    subscribe,
    unsubscribe,
    forceSync,
    getMetrics
  }

  return (
    <RealtimeContext.Provider value={contextValue}>
      {children}
      {enableDebug && <RealtimeDebugPanel />}
    </RealtimeContext.Provider>
  )
}

// Componente de debug (opcional)
const RealtimeDebugPanel: React.FC = () => {
  const { 
    isConnected, 
    connectionStatus, 
    syncCount, 
    lastSync, 
    channels, 
    getMetrics 
  } = useRealtime()
  
  const [showPanel, setShowPanel] = useState(false)
  const [metrics, setMetrics] = useState(getMetrics())

  // Atualizar métricas a cada segundo
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(getMetrics())
    }, 1000)

    return () => clearInterval(interval)
  }, [getMetrics])

  if (!showPanel) {
    return (
      <div 
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 9999,
          backgroundColor: isConnected ? '#10b981' : '#ef4444',
          color: 'white',
          padding: '8px 12px',
          borderRadius: '6px',
          fontSize: '12px',
          cursor: 'pointer',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
        }}
        onClick={() => setShowPanel(true)}
      >
        📡 {connectionStatus} ({syncCount})
      </div>
    )
  }

  return (
    <div 
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 9999,
        backgroundColor: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        padding: '16px',
        fontSize: '12px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
        minWidth: '300px',
        maxHeight: '400px',
        overflow: 'auto'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold' }}>Realtime Debug</h3>
        <button 
          onClick={() => setShowPanel(false)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}
        >
          ✕
        </button>
      </div>
      
      <div style={{ marginBottom: '8px' }}>
        <strong>Status:</strong> 
        <span style={{ 
          color: isConnected ? '#10b981' : '#ef4444',
          marginLeft: '8px'
        }}>
          {connectionStatus}
        </span>
      </div>
      
      <div style={{ marginBottom: '8px' }}>
        <strong>Channels:</strong> {channels.size}
      </div>
      
      <div style={{ marginBottom: '8px' }}>
        <strong>Total Syncs:</strong> {metrics.totalSyncs}
      </div>
      
      <div style={{ marginBottom: '8px' }}>
        <strong>Last Sync:</strong> {lastSync ? lastSync.toLocaleTimeString() : 'Never'}
      </div>
      
      <div style={{ marginBottom: '8px' }}>
        <strong>Avg Duration:</strong> {metrics.averageSyncDuration.toFixed(2)}ms
      </div>
      
      <div style={{ marginBottom: '8px' }}>
        <strong>Errors:</strong> {metrics.errorCount}
      </div>
      
      <div style={{ marginBottom: '12px' }}>
        <strong>Uptime:</strong> {Math.floor(metrics.uptime / 1000)}s
      </div>
      
      {channels.size > 0 && (
        <div>
          <strong>Active Channels:</strong>
          <ul style={{ margin: '4px 0', paddingLeft: '16px' }}>
            {Array.from(channels.keys()).map(table => (
              <li key={table} style={{ fontSize: '11px' }}>{table}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default RealtimeProvider