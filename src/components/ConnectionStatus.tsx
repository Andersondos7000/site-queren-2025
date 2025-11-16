import React from 'react';
import { Wifi, WifiOff, Activity, Globe, RefreshCw, Settings } from 'lucide-react';

interface ConnectionStatus {
  websocket: 'connected' | 'disconnected' | 'error' | 'trying';
  sse: 'connected' | 'disconnected' | 'error' | 'trying';
  polling: 'active' | 'inactive';
  ultrahook: 'available' | 'unavailable';
}

interface ConnectionStatusProps {
  connectionStatus: ConnectionStatus;
  activeMethod: 'websocket' | 'sse' | 'polling' | 'ultrahook';
  onForceMethod: (method: 'websocket' | 'sse' | 'polling' | 'auto') => void;
  onReconnect: () => void;
  className?: string;
}

const statusColors = {
  connected: 'text-green-500',
  active: 'text-green-500',
  available: 'text-green-500',
  disconnected: 'text-gray-400',
  inactive: 'text-gray-400',
  unavailable: 'text-gray-400',
  error: 'text-red-500',
  trying: 'text-yellow-500'
};

const statusIcons = {
  websocket: Wifi,
  sse: Activity,
  polling: RefreshCw,
  ultrahook: Globe
};

const statusLabels = {
  websocket: 'WebSocket',
  sse: 'Server-Sent Events',
  polling: 'Polling HTTP',
  ultrahook: 'Ultrahook'
};

const methodDescriptions = {
  websocket: 'Conexão em tempo real via WebSocket',
  sse: 'Eventos do servidor via Edge Function',
  polling: 'Consulta periódica ao banco de dados',
  ultrahook: 'Webhooks externos via túnel'
};

export function ConnectionStatus({ 
  connectionStatus, 
  activeMethod, 
  onForceMethod, 
  onReconnect,
  className = '' 
}: ConnectionStatusProps) {
  const [showDetails, setShowDetails] = React.useState(false);

  const getStatusText = (method: keyof ConnectionStatus, status: string) => {
    switch (status) {
      case 'connected':
      case 'active':
      case 'available':
        return 'Ativo';
      case 'trying':
        return 'Conectando...';
      case 'error':
        return 'Erro';
      default:
        return 'Inativo';
    }
  };

  const getOverallStatus = () => {
    if (connectionStatus.websocket === 'connected') return 'excellent';
    if (connectionStatus.sse === 'connected') return 'good';
    if (connectionStatus.polling === 'active') return 'fair';
    if (connectionStatus.ultrahook === 'available') return 'external';
    return 'poor';
  };

  const overallStatus = getOverallStatus();
  const overallStatusConfig = {
    excellent: { color: 'text-green-500', bg: 'bg-green-50', label: 'Excelente', icon: Wifi },
    good: { color: 'text-blue-500', bg: 'bg-blue-50', label: 'Bom', icon: Activity },
    fair: { color: 'text-yellow-500', bg: 'bg-yellow-50', label: 'Regular', icon: RefreshCw },
    external: { color: 'text-purple-500', bg: 'bg-purple-50', label: 'Externo', icon: Globe },
    poor: { color: 'text-red-500', bg: 'bg-red-50', label: 'Ruim', icon: WifiOff }
  };

  const config = overallStatusConfig[overallStatus];
  const StatusIcon = config.icon;

  return (
    <div className={`bg-white rounded-lg border shadow-sm ${className}`}>
      {/* Header compacto */}
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center space-x-2">
          <StatusIcon className={`w-4 h-4 ${config.color}`} />
          <span className="text-sm font-medium text-gray-900">
            Conexão: {config.label}
          </span>
          <span className="text-xs text-gray-500">
            via {statusLabels[activeMethod]}
          </span>
        </div>
        
        <div className="flex items-center space-x-1">
          <button
            onClick={onReconnect}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            title="Reconectar"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            title="Configurações"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Detalhes expandidos */}
      {showDetails && (
        <div className="border-t bg-gray-50 p-3 space-y-3">
          {/* Status de cada método */}
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-gray-700 uppercase tracking-wide">
              Status das Conexões
            </h4>
            
            {Object.entries(connectionStatus).map(([method, status]) => {
              const Icon = statusIcons[method as keyof typeof statusIcons];
              const isActive = activeMethod === method;
              
              return (
                <div 
                  key={method}
                  className={`flex items-center justify-between p-2 rounded ${
                    isActive ? 'bg-blue-50 border border-blue-200' : 'bg-white'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <Icon className={`w-4 h-4 ${statusColors[status]}`} />
                    <div>
                      <span className="text-sm font-medium text-gray-900">
                        {statusLabels[method as keyof typeof statusLabels]}
                      </span>
                      {isActive && (
                        <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                          ATIVO
                        </span>
                      )}
                      <p className="text-xs text-gray-500">
                        {methodDescriptions[method as keyof typeof methodDescriptions]}
                      </p>
                    </div>
                  </div>
                  
                  <span className={`text-xs font-medium ${statusColors[status]}`}>
                    {getStatusText(method as keyof ConnectionStatus, status)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Controles de método */}
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-gray-700 uppercase tracking-wide">
              Forçar Método
            </h4>
            
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onForceMethod('auto')}
                className="px-3 py-2 text-xs bg-gray-100 hover:bg-gray-200 rounded transition-colors"
              >
                🤖 Automático
              </button>
              <button
                onClick={() => onForceMethod('websocket')}
                className="px-3 py-2 text-xs bg-green-100 hover:bg-green-200 text-green-800 rounded transition-colors"
              >
                📡 WebSocket
              </button>
              <button
                onClick={() => onForceMethod('sse')}
                className="px-3 py-2 text-xs bg-blue-100 hover:bg-blue-200 text-blue-800 rounded transition-colors"
              >
                ⚡ SSE
              </button>
              <button
                onClick={() => onForceMethod('polling')}
                className="px-3 py-2 text-xs bg-yellow-100 hover:bg-yellow-200 text-yellow-800 rounded transition-colors"
              >
                🔄 Polling
              </button>
            </div>
          </div>

          {/* Informações adicionais */}
          <div className="text-xs text-gray-500 space-y-1">
            <p>• <strong>Automático:</strong> Tenta WebSocket → SSE → Polling</p>
            <p>• <strong>WebSocket:</strong> Melhor performance, pode falhar em redes restritivas</p>
            <p>• <strong>SSE:</strong> Boa alternativa, funciona via HTTPS</p>
            <p>• <strong>Polling:</strong> Mais confiável, mas menos eficiente</p>
          </div>
        </div>
      )}
    </div>
  );
}