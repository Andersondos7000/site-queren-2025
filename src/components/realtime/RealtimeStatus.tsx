import React, { useState, useEffect } from 'react'
import { useRealtime } from './RealtimeProvider'

interface RealtimeStatusProps {
  showDetails?: boolean
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  className?: string
  style?: React.CSSProperties
  onStatusChange?: (status: string) => void
}

const RealtimeStatus: React.FC<RealtimeStatusProps> = ({
  showDetails = false,
  position = 'top-right',
  className = '',
  style = {},
  onStatusChange
}) => {
  const { 
    isConnected, 
    connectionStatus, 
    syncCount, 
    lastSync, 
    channels,
    getMetrics,
    forceSync
  } = useRealtime()
  
  const [expanded, setExpanded] = useState(false)
  const [metrics, setMetrics] = useState(getMetrics())

  // Atualizar métricas periodicamente
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(getMetrics())
    }, 1000)

    return () => clearInterval(interval)
  }, [getMetrics])

  // Notificar mudanças de status
  useEffect(() => {
    if (onStatusChange) {
      onStatusChange(connectionStatus)
    }
  }, [connectionStatus, onStatusChange])

  // Estilos baseados na posição
  const getPositionStyles = () => {
    const baseStyles = {
      position: 'fixed' as const,
      zIndex: 1000,
      padding: '8px 12px',
      borderRadius: '6px',
      fontSize: '12px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      backdropFilter: 'blur(8px)'
    }

    switch (position) {
      case 'top-left':
        return { ...baseStyles, top: '20px', left: '20px' }
      case 'top-right':
        return { ...baseStyles, top: '20px', right: '20px' }
      case 'bottom-left':
        return { ...baseStyles, bottom: '20px', left: '20px' }
      case 'bottom-right':
        return { ...baseStyles, bottom: '20px', right: '20px' }
      default:
        return { ...baseStyles, top: '20px', right: '20px' }
    }
  }

  // Estilos baseados no status
  const getStatusStyles = () => {
    switch (connectionStatus) {
      case 'connected':
        return {
          backgroundColor: 'rgba(16, 185, 129, 0.9)',
          color: 'white',
          border: '1px solid rgba(16, 185, 129, 0.3)'
        }
      case 'connecting':
        return {
          backgroundColor: 'rgba(245, 158, 11, 0.9)',
          color: 'white',
          border: '1px solid rgba(245, 158, 11, 0.3)'
        }
      case 'disconnected':
        return {
          backgroundColor: 'rgba(107, 114, 128, 0.9)',
          color: 'white',
          border: '1px solid rgba(107, 114, 128, 0.3)'
        }
      case 'error':
        return {
          backgroundColor: 'rgba(239, 68, 68, 0.9)',
          color: 'white',
          border: '1px solid rgba(239, 68, 68, 0.3)'
        }
      default:
        return {
          backgroundColor: 'rgba(107, 114, 128, 0.9)',
          color: 'white',
          border: '1px solid rgba(107, 114, 128, 0.3)'
        }
    }
  }

  // Ícone baseado no status
  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return '🟢'
      case 'connecting':
        return '🟡'
      case 'disconnected':
        return '⚫'
      case 'error':
        return '🔴'
      default:
        return '⚫'
    }
  }

  // Formatação de tempo
  const formatUptime = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    } else {
      return `${seconds}s`
    }
  }

  const handleClick = () => {
    if (showDetails) {
      setExpanded(!expanded)
    }
  }

  const handleForceSync = async (e: React.MouseEvent) => {
    e.stopPropagation()
    await forceSync()
  }

  const combinedStyles = {
    ...getPositionStyles(),
    ...getStatusStyles(),
    ...style
  }

  if (!showDetails || !expanded) {
    return (
      <div 
        className={className}
        style={combinedStyles}
        onClick={handleClick}
        title={`Realtime Status: ${connectionStatus}`}
      >
        {getStatusIcon()} {connectionStatus} ({syncCount})
      </div>
    )
  }

  return (
    <div 
      className={className}
      style={{
        ...combinedStyles,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        color: '#374151',
        border: '1px solid rgba(229, 231, 235, 0.8)',
        padding: '16px',
        minWidth: '280px',
        maxWidth: '320px'
      }}
    >
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '12px',
        borderBottom: '1px solid rgba(229, 231, 235, 0.5)',
        paddingBottom: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px', fontWeight: 'bold' }}>
            {getStatusIcon()} Realtime
          </span>
          <span style={{ 
            fontSize: '10px',
            padding: '2px 6px',
            borderRadius: '10px',
            backgroundColor: getStatusStyles().backgroundColor,
            color: 'white'
          }}>
            {connectionStatus}
          </span>
        </div>
        <button 
          onClick={() => setExpanded(false)}
          style={{ 
            background: 'none', 
            border: 'none', 
            cursor: 'pointer', 
            fontSize: '14px',
            color: '#6b7280'
          }}
        >
          ✕
        </button>
      </div>

      {/* Métricas principais */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ fontSize: '11px', color: '#6b7280' }}>Channels:</span>
          <span style={{ fontSize: '11px', fontWeight: 'bold' }}>{channels.size}</span>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ fontSize: '11px', color: '#6b7280' }}>Total Syncs:</span>
          <span style={{ fontSize: '11px', fontWeight: 'bold' }}>{metrics.totalSyncs}</span>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ fontSize: '11px', color: '#6b7280' }}>Last Sync:</span>
          <span style={{ fontSize: '11px', fontWeight: 'bold' }}>
            {lastSync ? lastSync.toLocaleTimeString() : 'Never'}
          </span>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ fontSize: '11px', color: '#6b7280' }}>Avg Duration:</span>
          <span style={{ fontSize: '11px', fontWeight: 'bold' }}>
            {metrics.averageSyncDuration.toFixed(1)}ms
          </span>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ fontSize: '11px', color: '#6b7280' }}>Errors:</span>
          <span style={{ 
            fontSize: '11px', 
            fontWeight: 'bold',
            color: metrics.errorCount > 0 ? '#ef4444' : '#10b981'
          }}>
            {metrics.errorCount}
          </span>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '11px', color: '#6b7280' }}>Uptime:</span>
          <span style={{ fontSize: '11px', fontWeight: 'bold' }}>
            {formatUptime(metrics.uptime)}
          </span>
        </div>
      </div>

      {/* Canais ativos */}
      {channels.size > 0 && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>
            Active Channels:
          </div>
          <div style={{ 
            maxHeight: '80px', 
            overflowY: 'auto',
            backgroundColor: 'rgba(249, 250, 251, 0.8)',
            borderRadius: '4px',
            padding: '4px 8px'
          }}>
            {Array.from(channels.keys()).map(table => (
              <div key={table} style={{ 
                fontSize: '10px', 
                color: '#374151',
                padding: '2px 0',
                borderBottom: '1px solid rgba(229, 231, 235, 0.3)'
              }}>
                📡 {table}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ações */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={handleForceSync}
          disabled={connectionStatus === 'connecting'}
          style={{
            flex: 1,
            padding: '6px 12px',
            fontSize: '10px',
            border: '1px solid #d1d5db',
            borderRadius: '4px',
            backgroundColor: connectionStatus === 'connecting' ? '#f3f4f6' : '#ffffff',
            color: connectionStatus === 'connecting' ? '#9ca3af' : '#374151',
            cursor: connectionStatus === 'connecting' ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          {connectionStatus === 'connecting' ? 'Syncing...' : '🔄 Force Sync'}
        </button>
      </div>

      {/* Indicador de performance */}
      <div style={{ 
        marginTop: '8px',
        padding: '4px 8px',
        backgroundColor: metrics.averageSyncDuration < 100 ? 'rgba(16, 185, 129, 0.1)' : 
                         metrics.averageSyncDuration < 500 ? 'rgba(245, 158, 11, 0.1)' : 
                         'rgba(239, 68, 68, 0.1)',
        borderRadius: '4px',
        fontSize: '10px',
        textAlign: 'center' as const
      }}>
        Performance: {
          metrics.averageSyncDuration < 100 ? '🟢 Excellent' :
          metrics.averageSyncDuration < 500 ? '🟡 Good' :
          '🔴 Slow'
        }
      </div>
    </div>
  )
}

export default RealtimeStatus