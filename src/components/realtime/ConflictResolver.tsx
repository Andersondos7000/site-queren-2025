import React, { useState, useEffect } from 'react';
import { useConflictMonitor } from '../../hooks/realtime/useConflictMonitor';
import type { RealtimeConflict } from '../../types/realtime';

interface ConflictResolverProps {
  className?: string;
  autoResolve?: boolean;
  autoResolveStrategy?: 'latest' | 'server_wins' | 'local_wins';
}

export function ConflictResolver({ 
  className = '', 
  autoResolve = false, 
  autoResolveStrategy = 'latest' 
}: ConflictResolverProps) {
  const { 
    conflicts, 
    conflictCount, 
    resolveConflict, 
    resolutionStrategy,
    isMonitoring,
    startMonitoring 
  } = useConflictMonitor('products'); // Especificar tabela
  
  const [selectedConflict, setSelectedConflict] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  
  const unresolvedConflicts = conflicts.filter(c => c.status === 'pending');
  const resolvedConflicts = conflicts.filter(c => c.status === 'resolved');
  const hasUnresolvedConflicts = unresolvedConflicts.length > 0;
  
  // Iniciar monitoramento se não estiver ativo
  useEffect(() => {
    if (!isMonitoring) {
      startMonitoring();
    }
  }, [isMonitoring, startMonitoring]);
  
  // Auto-resolver conflitos se habilitado
  useEffect(() => {
    if (autoResolve && unresolvedConflicts.length > 0) {
      unresolvedConflicts.forEach(conflict => {
        const strategy = autoResolveStrategy === 'latest' ? 'timestamp_wins' : 
                        autoResolveStrategy === 'server_wins' ? 'remote_wins' : 'local_wins';
        resolveConflict(conflict.id, strategy);
      });
    }
  }, [autoResolve, autoResolveStrategy, unresolvedConflicts.length, resolveConflict]);
  
  if (!hasUnresolvedConflicts && !showResolved) {
    return null;
  }
  
  return (
    <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-900">
            Conflitos de Sincronização
            {unresolvedConflicts.length > 0 && (
              <span className="ml-2 bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">
                {unresolvedConflicts.length} pendente{unresolvedConflicts.length !== 1 ? 's' : ''}
              </span>
            )}
          </h3>
          
          <div className="flex items-center space-x-2">
            {resolvedConflicts.length > 0 && (
              <button
                onClick={() => setShowResolved(!showResolved)}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                {showResolved ? 'Ocultar' : 'Mostrar'} resolvidos ({resolvedConflicts.length})
              </button>
            )}
            
            {unresolvedConflicts.length > 0 && (
              <button
                onClick={() => {
                  unresolvedConflicts.forEach(conflict => {
                    const strategy = autoResolveStrategy === 'latest' ? 'timestamp_wins' : 
                                    autoResolveStrategy === 'server_wins' ? 'remote_wins' : 'local_wins';
                    resolveConflict(conflict.id, strategy);
                  });
                }}
                className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
              >
                Resolver Todos
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Lista de conflitos */}
      <div className="max-h-96 overflow-y-auto">
        {/* Conflitos não resolvidos */}
        {unresolvedConflicts.map(conflict => (
          <ConflictItem
            key={conflict.id}
            conflict={conflict}
            isSelected={selectedConflict === conflict.id}
            onSelect={() => setSelectedConflict(
              selectedConflict === conflict.id ? null : conflict.id
            )}
            onResolve={(resolution) => {
              const strategy = resolution === 'local' ? 'local_wins' : 
                              resolution === 'server' ? 'remote_wins' : 'merge';
              resolveConflict(conflict.id, strategy);
              setSelectedConflict(null);
            }}
          />
        ))}
        
        {/* Conflitos resolvidos */}
        {showResolved && resolvedConflicts.map(conflict => (
          <ConflictItem
            key={conflict.id}
            conflict={conflict}
            isSelected={false}
            onSelect={() => {}}
            onResolve={() => {}}
            isResolved
          />
        ))}
        
        {/* Estado vazio */}
        {unresolvedConflicts.length === 0 && !showResolved && (
          <div className="p-4 text-center text-gray-500 text-sm">
            ✅ Nenhum conflito pendente
          </div>
        )}
      </div>
    </div>
  );
}

interface ConflictItemProps {
  conflict: RealtimeConflict;
  isSelected: boolean;
  onSelect: () => void;
  onResolve: (resolution: 'local' | 'server' | 'merge') => void;
  isResolved?: boolean;
}

function ConflictItem({ conflict, isSelected, onSelect, onResolve, isResolved = false }: ConflictItemProps) {
  const typeConfig = {
    cart: { icon: '🛒', label: 'Carrinho', color: 'text-blue-600' },
    stock: { icon: '📊', label: 'Estoque', color: 'text-green-600' },
    order: { icon: '📋', label: 'Pedido', color: 'text-orange-600' },
    product: { icon: '📦', label: 'Produto', color: 'text-orange-600' }
  };
  
  const config = typeConfig[conflict.type];
  
  return (
    <div className={`border-b border-gray-100 ${isResolved ? 'opacity-60' : ''}`}>
      {/* Header do conflito */}
      <div 
        className="px-4 py-3 cursor-pointer hover:bg-gray-50"
        onClick={onSelect}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="text-lg">{config.icon}</span>
            <div>
              <div className="flex items-center space-x-2">
                <span className={`text-sm font-medium ${config.color}`}>
                  {config.label}
                </span>
                <div className="flex items-center gap-2 bg-gray-50 px-2 py-1 rounded-md border">
                  <span className="text-xs text-gray-600 font-medium">
                    ID: {conflict.entityId.substring(0, 8)}...
                  </span>
                </div>
                {isResolved && (
                  <span className="text-xs bg-green-100 text-green-800 px-1 rounded">
                    ✓ {conflict.resolution}
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-500">
                {formatTimestamp(conflict.timestamp)}
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {!isResolved && (
              <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                Conflito
              </span>
            )}
            <span className="text-xs text-gray-400">
              {isSelected ? '▼' : '▶'}
            </span>
          </div>
        </div>
      </div>
      
      {/* Detalhes expandidos */}
      {isSelected && !isResolved && (
        <div className="px-4 pb-4 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Dados locais */}
            <div className="bg-blue-50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-blue-900">Versão Local</h4>
                <button
                  onClick={() => onResolve('local')}
                  className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700"
                >
                  Usar Esta
                </button>
              </div>
              <pre className="text-xs text-blue-800 bg-blue-100 p-2 rounded overflow-x-auto">
                {JSON.stringify(conflict.localData, null, 2)}
              </pre>
            </div>
            
            {/* Dados do servidor */}
            <div className="bg-green-50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-green-900">Versão Servidor</h4>
                <button
                  onClick={() => onResolve('server')}
                  className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700"
                >
                  Usar Esta
                </button>
              </div>
              <pre className="text-xs text-green-800 bg-green-100 p-2 rounded overflow-x-auto">
                {JSON.stringify(conflict.serverData, null, 2)}
              </pre>
            </div>
          </div>
          
          {/* Ações de resolução */}
          <div className="mt-4 flex items-center justify-between">
            <div className="text-xs text-gray-600">
              <strong>Dica:</strong> A versão do servidor geralmente é mais confiável.
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={() => onResolve('merge')}
                className="text-xs bg-orange-600 text-white px-3 py-1 rounded hover:bg-orange-700"
                title="Tentar mesclar automaticamente"
              >
                🔀 Mesclar
              </button>
              
              <button
                onClick={() => {
                  const localTime = new Date(conflict.localData.updated_at || conflict.localData.created_at);
                  const serverTime = new Date(conflict.serverData.updated_at || conflict.serverData.created_at);
                  const resolution = localTime > serverTime ? 'local' : 'server';
                  onResolve(resolution);
                }}
                className="text-xs bg-gray-600 text-white px-3 py-1 rounded hover:bg-gray-700"
                title="Usar a versão mais recente"
              >
                ⏰ Mais Recente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Componente compacto para mostrar apenas o contador de conflitos
export function ConflictCounter({ className = '' }: { className?: string }) {
  const { hasUnresolvedConflicts, conflicts } = useConflictMonitor();
  
  if (!hasUnresolvedConflicts) {
    return null;
  }
  
  const unresolvedCount = conflicts.filter(c => !c.resolved).length;
  
  return (
    <div className={`inline-flex items-center space-x-1 ${className}`}>
      <span className="text-xs text-red-600">⚠️</span>
      <span className="text-xs text-red-600 font-medium">
        {unresolvedCount} conflito{unresolvedCount !== 1 ? 's' : ''}
      </span>
    </div>
  );
}

// Hook para resolução automática de conflitos
export function useAutoConflictResolution(strategy: 'latest' | 'server_wins' | 'local_wins' = 'latest') {
  const { conflicts, autoResolveConflict } = useConflictMonitor();
  
  React.useEffect(() => {
    const unresolvedConflicts = conflicts.filter(c => !c.resolved);
    
    // Auto-resolver conflitos após 30 segundos
    const timeouts = unresolvedConflicts.map(conflict => {
      return setTimeout(() => {
        autoResolveConflict(conflict.id, strategy);
      }, 30000);
    });
    
    return () => {
      timeouts.forEach(timeout => clearTimeout(timeout));
    };
  }, [conflicts, strategy, autoResolveConflict]);
}

// Utilitário para formatar timestamp
function formatTimestamp(date: Date): string {
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

export default ConflictResolver;