import React, { useState, useEffect } from 'react';
import { WifiOff, AlertTriangle, RefreshCw, Brain } from 'lucide-react';
import { useJWTManager } from '../../hooks/useJWTManager';
import { useConnectivityDetection } from '../../hooks/realtime/useConnectivityDetection';
import { useRealtimeContext } from '../../contexts/RealtimeContext';
import { usePiecesMCP } from '../../hooks/mcp/usePiecesMCP';

interface OfflineIndicatorProps {
  className?: string;
  showRetryButton?: boolean;
  onRetry?: () => void;
}

/**
 * Componente para indicar quando o usuário está offline
 * 
 * Funcionalidades:
 * - Detecção automática de status offline
 * - Botão de retry para tentar reconectar
 * - Informações sobre dados em cache
 * - Alertas sobre limitações offline
 */
export function OfflineIndicator({ 
  className = '', 
  showRetryButton = true, 
  onRetry 
}: OfflineIndicatorProps) {
  const { isAuthenticated, tokenStatus } = useJWTManager();
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);
  const [retrying, setRetrying] = React.useState(false);
  const [showTips, setShowTips] = useState(false);
  const [troubleshootingTips, setTroubleshootingTips] = useState<string[]>([]);
  const { connectionQuality } = useConnectivityDetection();
  const { logConnectivityEvent, getConnectivityTroubleshooting } = usePiecesMCP();

  // Monitorar status de conexão
  React.useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Registrar evento de conexão no Pieces MCP
      logConnectivityEvent({
        type: 'online',
        details: { timestamp: new Date().toISOString() }
      });
    };
    
    const handleOffline = () => {
      setIsOnline(false);
      // Registrar evento de desconexão no Pieces MCP
      logConnectivityEvent({
        type: 'offline',
        details: { timestamp: new Date().toISOString() }
      });
      
      // Carregar dicas de solução de problemas do Pieces MCP
      getConnectivityTroubleshooting('offline')
        .then(tips => {
          setTroubleshootingTips(tips);
          setShowTips(true);
        })
        .catch(err => console.error('Erro ao obter dicas:', err));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Verificar status inicial
    if (!navigator.onLine) {
      handleOffline();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [logConnectivityEvent, getConnectivityTroubleshooting]);

  // Função de retry
  const handleRetry = async () => {
    if (retrying) return;
    
    setRetrying(true);
    
    // Registrar tentativa de reconexão no Pieces MCP
    logConnectivityEvent({
      type: 'reconnect_attempt',
      details: { timestamp: new Date().toISOString() }
    });
    
    try {
      // Tentar fazer uma requisição simples para verificar conectividade
      const response = await fetch('/api/health', {
        method: 'HEAD',
        cache: 'no-cache'
      });
      
      if (response.ok) {
        setIsOnline(true);
        onRetry?.();
        
        // Registrar reconexão bem-sucedida no Pieces MCP
        logConnectivityEvent({
          type: 'reconnect_success',
          details: { timestamp: new Date().toISOString() }
        });
        
        // Esconder dicas após reconexão bem-sucedida
        setShowTips(false);
      }
    } catch (error) {
      console.warn('Retry failed:', error);
      
      // Registrar falha de reconexão no Pieces MCP
      logConnectivityEvent({
        type: 'reconnect_failure',
        details: { 
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Erro desconhecido'
        }
      });
      
      // Carregar novas dicas de solução de problemas após falha
      getConnectivityTroubleshooting('reconnect_failure')
        .then(tips => {
          setTroubleshootingTips(tips);
          setShowTips(true);
        })
        .catch(err => console.error('Erro ao obter dicas:', err));
    } finally {
      setRetrying(false);
    }
  };

  // Determinar se deve mostrar o indicador
  const shouldShow = !isOnline || tokenStatus === 'expired' || !isAuthenticated;

  if (!shouldShow) {
    return null;
  }

  // Determinar tipo de problema
  const getIssueType = () => {
    if (!isOnline) return 'offline';
    if (tokenStatus === 'expired') return 'token_expired';
    if (!isAuthenticated) return 'not_authenticated';
    return 'unknown';
  };

  const issueType = getIssueType();

  // Configurações por tipo de problema
  const issueConfig = {
    offline: {
      icon: WifiOff,
      title: 'Você está offline',
      description: 'Verifique sua conexão com a internet',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
      textColor: 'text-orange-800',
      iconColor: 'text-orange-600'
    },
    token_expired: {
      icon: AlertTriangle,
      title: 'Sessão expirada',
      description: 'Sua sessão expirou. Faça login novamente.',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      textColor: 'text-red-800',
      iconColor: 'text-red-600'
    },
    not_authenticated: {
      icon: AlertTriangle,
      title: 'Não autenticado',
      description: 'Você precisa fazer login para continuar.',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
      textColor: 'text-yellow-800',
      iconColor: 'text-yellow-600'
    },
    unknown: {
      icon: AlertTriangle,
      title: 'Problema de conexão',
      description: 'Ocorreu um problema inesperado.',
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200',
      textColor: 'text-gray-800',
      iconColor: 'text-gray-600'
    }
  };

  const config = issueConfig[issueType];
  const Icon = config.icon;

  return (
    <div className={`fixed top-4 right-4 z-50 max-w-sm ${className}`}>
      <div className={`p-4 rounded-lg border shadow-lg ${config.bgColor} ${config.borderColor}`}>
        <div className="flex items-start gap-3">
          <Icon className={`w-5 h-5 mt-0.5 ${config.iconColor}`} />
          
          <div className="flex-1 min-w-0">
            <h3 className={`font-semibold text-sm ${config.textColor}`}>
              {config.title}
            </h3>
            <p className={`text-sm mt-1 ${config.textColor} opacity-90`}>
              {config.description}
            </p>
            
            {/* Informações adicionais para modo offline */}
            {issueType === 'offline' && (
              <div className="mt-2 text-xs text-orange-700 space-y-1">
                <p>• Suas alterações serão salvas localmente</p>
                <p>• Os dados serão sincronizados quando voltar online</p>
                
                {/* Botão para mostrar/esconder dicas inteligentes do Pieces MCP */}
                <button 
                  onClick={() => setShowTips(!showTips)}
                  className="flex items-center gap-1 mt-1 text-orange-800 hover:text-orange-900 transition-colors"
                >
                  <Brain size={12} />
                  <span>{showTips ? 'Esconder dicas' : 'Mostrar dicas inteligentes'}</span>
                </button>
                
                {/* Dicas inteligentes do Pieces MCP */}
                {showTips && troubleshootingTips.length > 0 && (
                  <div className="mt-2 p-2 bg-orange-100 rounded border border-orange-200">
                    <h4 className="font-medium text-orange-800 flex items-center gap-1">
                      <Brain size={12} />
                      <span>Dicas inteligentes:</span>
                    </h4>
                    <ul className="mt-1 space-y-1 list-disc list-inside">
                      {troubleshootingTips.map((tip, index) => (
                        <li key={`tip-${tip.slice(0, 20)}-${index}`} className="text-orange-700">{tip}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            
            {/* Botão de retry */}
            {showRetryButton && issueType === 'offline' && (
              <button
                onClick={handleRetry}
                disabled={retrying}
                className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-orange-800 bg-orange-100 border border-orange-300 rounded hover:bg-orange-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${retrying ? 'animate-spin' : ''}`} />
                {retrying ? 'Tentando...' : 'Tentar novamente'}
              </button>
            )}
            
            {/* Botão de login para problemas de autenticação */}
            {(issueType === 'token_expired' || issueType === 'not_authenticated') && (
              <button
                onClick={() => window.location.href = '/auth/login'}
                className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 border border-blue-600 rounded hover:bg-blue-700 transition-colors"
              >
                Fazer Login
              </button>
            )}
          </div>
          
          {/* Botão de fechar */}
          <button
            onClick={() => setIsOnline(true)} // Temporariamente esconder
            className={`text-lg leading-none ${config.textColor} opacity-60 hover:opacity-100 transition-opacity`}
            title="Fechar"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}

// Ícone animado para status offline/online
function OfflineIcon({ isOffline }: { isOffline: boolean }) {
  return (
    <div className="relative">
      {isOffline ? (
        <div className="flex items-center">
          <span className="text-lg">📱</span>
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
        </div>
      ) : (
        <div className="flex items-center">
          <span className="text-lg">📶</span>
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse" />
        </div>
      )}
    </div>
  );
}

// Detalhes do status offline
function OfflineDetails({ isOffline }: { isOffline: boolean }) {
  const { state, totalSyncCount } = useRealtimeContext();
  const { isOnline, connectionType, effectiveType } = useNetworkStatus();
  const { 
    queueSize, 
    isProcessing, 
    lastProcessedAt,
    getQueuedActionsByStatus,
    getProcessingStats 
  } = useOfflineQueue();
  
  const pendingActions = getQueuedActionsByStatus('pending').length;
  const failedActions = getQueuedActionsByStatus('failed').length;
  const completedActions = getQueuedActionsByStatus('completed').length;
  const stats = getProcessingStats();
  
  if (isOffline) {
    return (
      <div className="text-xs opacity-90 space-y-1">
        <div>• Fila offline: {queueSize} ações</div>
        <div>• Pendentes: {pendingActions} | Falharam: {failedActions}</div>
        <div>• Última sincronização: {state.lastSync ? formatTime(state.lastSync) : 'Nunca'}</div>
        <div>• Alterações serão enviadas automaticamente</div>
        {stats.totalProcessed > 0 && (
          <div>• Taxa de sucesso: {Math.round((stats.successCount / stats.totalProcessed) * 100)}%</div>
        )}
      </div>
    );
  }
  
  return (
    <div className="text-xs opacity-90 space-y-1">
      {isProcessing && (
        <div>• Sincronizando {queueSize} alteração{queueSize > 1 ? 'ões' : ''}...</div>
      )}
      {pendingActions > 0 && (
        <div>• Pendentes: {pendingActions} | Concluídas: {completedActions}</div>
      )}
      <div>• Conexão: {connectionType} ({effectiveType})</div>
      <div>• Status: {state.connectionStatus}</div>
      {lastProcessedAt && (
        <div>• Última ação: {formatTime(lastProcessedAt)}</div>
      )}
      {stats.totalProcessed > 0 && (
        <div>• Taxa de sucesso: {Math.round((stats.successCount / stats.totalProcessed) * 100)}%</div>
      )}
    </div>
  );
}

// Componente para mostrar indicador de dados pendentes
export function PendingChangesIndicator({ className = '' }: { className?: string }) {
  const { state } = useRealtimeContext();
  const [pendingCount, setPendingCount] = useState(0);
  
  // Simular contagem de alterações pendentes
  // Em uma implementação real, isso viria do estado de sincronização
  useEffect(() => {
    if (!state.isOnline) {
      // Incrementar contador quando offline (simulação)
      const interval = setInterval(() => {
        setPendingCount(prev => prev + Math.floor(Math.random() * 3));
      }, 5000);
      return () => clearInterval(interval);
    } else {
      // Reset quando online
      setPendingCount(0);
    }
  }, [state.isOnline]);
  
  if (pendingCount === 0) {
    return null;
  }
  
  return (
    <div className={`inline-flex items-center space-x-1 bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs ${className}`}>
      <span className="animate-pulse">⏳</span>
      <span>{pendingCount} alterações pendentes</span>
    </div>
  );
}



// Componente de qualidade de conexão
export function ConnectionQualityIndicator({ className = '' }: { className?: string }) {
  const { connectionQuality } = useConnectivityDetection();
  
  const qualityConfig = {
    good: { color: 'text-green-600', icon: '📶', label: 'Boa' },
    poor: { color: 'text-yellow-600', icon: '📶', label: 'Lenta' },
    offline: { color: 'text-red-600', icon: '📵', label: 'Offline' }
  };
  
  const config = qualityConfig[connectionQuality];
  
  return (
    <div className={`flex items-center space-x-1 ${className}`}>
      <div className="text-sm">{config.icon}</div>
      <div className={`text-xs ${config.color}`}>
        {config.label}
      </div>
    </div>
  );
}

// Componente de toast para mudanças de conectividade
export function ConnectivityToast() {
  const { state } = useRealtimeContext();
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'warning' | 'error'>('success');
  
  useEffect(() => {
    if (!state.isOnline) {
      setToastMessage('Conexão perdida. Trabalhando offline.');
      setToastType('warning');
      setShowToast(true);
    } else if (state.connectionStatus === 'connected') {
      setToastMessage('Conexão restabelecida!');
      setToastType('success');
      setShowToast(true);
      
      // Auto-hide após 3 segundos
      const timer = setTimeout(() => setShowToast(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [state.isOnline, state.connectionStatus]);
  
  if (!showToast) {
    return null;
  }
  
  const typeConfig = {
    success: { bg: 'bg-green-600', icon: '✅' },
    warning: { bg: 'bg-yellow-600', icon: '⚠️' },
    error: { bg: 'bg-red-600', icon: '❌' }
  };
  
  const config = typeConfig[toastType];
  
  return (
    <div className="fixed top-4 right-4 z-50 animate-slide-in-right">
      <div className={`${config.bg} text-white px-4 py-3 rounded-lg shadow-lg flex items-center space-x-2`}>
        <span>{config.icon}</span>
        <span className="text-sm font-medium">{toastMessage}</span>
        <button
          onClick={() => setShowToast(false)}
          className="ml-2 text-white hover:text-gray-200"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// Utilitário para formatar tempo
function formatTime(date: Date): string {
  return date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

export default OfflineIndicator;