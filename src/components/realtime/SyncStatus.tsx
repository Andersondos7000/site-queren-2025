import React from 'react';
import { AlertCircle, CheckCircle, Clock, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useJWTManager } from '../../hooks/useJWTManager';

interface SyncStatusProps {
  status: {
    syncing: boolean;
    lastSync: number | null;
    pendingChanges: number;
    conflictCount: number;
    error: string | null;
    realtimeConnected: boolean;
    realtimeSubscribed: boolean;
  };
  className?: string;
  showDetails?: boolean;
}

/**
 * Componente para exibir status de sincronização em tempo real
 * 
 * Funcionalidades:
 * - Status visual da conexão
 * - Indicador de mudanças pendentes
 * - Alertas de erro
 * - Informações de última sincronização
 * - Contador de conflitos resolvidos
 */

export function SyncStatus({ status, className = '', showDetails = false }: SyncStatusProps) {
  const {
    syncing,
    lastSync,
    pendingChanges,
    conflictCount,
    error,
    realtimeConnected,
    realtimeSubscribed
  } = status;

  // Determinar estado geral
  const getOverallStatus = () => {
    if (error) return 'error';
    if (!realtimeConnected) return 'disconnected';
    if (syncing || pendingChanges > 0) return 'syncing';
    if (realtimeConnected && realtimeSubscribed) return 'connected';
    return 'unknown';
  };

  const overallStatus = getOverallStatus();

  // Configurações visuais por status
  const statusConfig = {
    connected: {
      icon: CheckCircle,
      color: 'text-green-500',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      message: 'Sincronizado'
    },
    syncing: {
      icon: RefreshCw,
      color: 'text-blue-500',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      message: 'Sincronizando...'
    },
    disconnected: {
      icon: WifiOff,
      color: 'text-orange-500',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
      message: 'Desconectado'
    },
    error: {
      icon: AlertCircle,
      color: 'text-red-500',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      message: 'Erro de sincronização'
    },
    unknown: {
      icon: Clock,
      color: 'text-gray-500',
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200',
      message: 'Conectando...'
    }
  };

  const config = statusConfig[overallStatus];
  const Icon = config.icon;

  // Formatar tempo da última sincronização
  const formatLastSync = (timestamp: number | null) => {
    if (!timestamp) return 'Nunca';
    
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'Agora mesmo';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m atrás`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h atrás`;
    
    return new Date(timestamp).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Versão compacta (padrão)
  if (!showDetails) {
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${config.bgColor} ${config.borderColor} ${className}`}>
        <Icon 
          className={`w-4 h-4 ${config.color} ${syncing ? 'animate-spin' : ''}`} 
        />
        <span className={`text-sm font-medium ${config.color}`}>
          {config.message}
        </span>
        
        {pendingChanges > 0 && (
          <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-blue-500 rounded-full">
            {pendingChanges}
          </span>
        )}
        
        {error && (
          <span className="text-xs text-red-600 truncate max-w-32" title={error}>
            {error}
          </span>
        )}
      </div>
    );
  }

  // Versão detalhada
  return (
    <div className={`p-4 rounded-lg border ${config.bgColor} ${config.borderColor} ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon 
            className={`w-5 h-5 ${config.color} ${syncing ? 'animate-spin' : ''}`} 
          />
          <h3 className={`font-semibold ${config.color}`}>
            {config.message}
          </h3>
        </div>
        
        {/* Status da conexão */}
        <div className="flex items-center gap-1">
          <Wifi className={`w-4 h-4 ${realtimeConnected ? 'text-green-500' : 'text-gray-400'}`} />
          <span className="text-xs text-gray-600">
            {realtimeConnected ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Detalhes */}
      <div className="space-y-2 text-sm text-gray-600">
        {/* Última sincronização */}
        <div className="flex justify-between">
          <span>Última sincronização:</span>
          <span className="font-medium">{formatLastSync(lastSync)}</span>
        </div>
        
        {/* Mudanças pendentes */}
        {pendingChanges > 0 && (
          <div className="flex justify-between">
            <span>Mudanças pendentes:</span>
            <span className="font-medium text-blue-600">{pendingChanges}</span>
          </div>
        )}
        
        {/* Conflitos resolvidos */}
        {conflictCount > 0 && (
          <div className="flex justify-between">
            <span>Conflitos resolvidos:</span>
            <span className="font-medium text-orange-600">{conflictCount}</span>
          </div>
        )}
        
        {/* Status da subscrição */}
        <div className="flex justify-between">
          <span>Realtime ativo:</span>
          <span className={`font-medium ${realtimeSubscribed ? 'text-green-600' : 'text-gray-400'}`}>
            {realtimeSubscribed ? 'Sim' : 'Não'}
          </span>
        </div>
      </div>

      {/* Erro detalhado */}
      {error && (
        <div className="mt-3 p-2 bg-red-100 border border-red-200 rounded text-sm text-red-700">
          <strong>Erro:</strong> {error}
        </div>
      )}
      
      {/* Dicas baseadas no status */}
      {overallStatus === 'disconnected' && (
        <div className="mt-3 p-2 bg-orange-100 border border-orange-200 rounded text-sm text-orange-700">
          <strong>Dica:</strong> Verifique sua conexão com a internet. Os dados serão sincronizados quando a conexão for restaurada.
        </div>
      )}
      
      {pendingChanges > 5 && (
        <div className="mt-3 p-2 bg-blue-100 border border-blue-200 rounded text-sm text-blue-700">
          <strong>Info:</strong> Muitas mudanças pendentes. A sincronização pode demorar um pouco mais.
        </div>
      )}
    </div>
  );
  
}

/**
 * Hook para usar o SyncStatus com dados do carrinho
 */
export function useSyncStatusData() {
  // Este hook pode ser expandido para agregar dados de múltiplas fontes
  return {
    // Placeholder - será implementado conforme necessário
    aggregatedStatus: {
      syncing: false,
      lastSync: Date.now(),
      pendingChanges: 0,
      conflictCount: 0,
      error: null,
      realtimeConnected: true,
      realtimeSubscribed: true
    }
  };
}

/**
 * Componente de status global para header/navbar
 */
export function GlobalSyncStatus() {
  const { aggregatedStatus } = useSyncStatusData();
  
  return (
    <SyncStatus 
      status={aggregatedStatus}
      className="ml-auto"
      showDetails={false}
    />
  );
}

/**
 * Componente de status detalhado para páginas específicas
 */
export function DetailedSyncStatus({ className }: { className?: string }) {
  const { aggregatedStatus } = useSyncStatusData();
  
  return (
    <SyncStatus 
      status={aggregatedStatus}
      className={className}
      showDetails={true}
    />
  );
}

export default SyncStatus;