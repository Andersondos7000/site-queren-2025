import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useRealtimeContext } from '../../contexts/RealtimeContext';
import { useNotification } from '../useNotification';
import type { 
  ConflictData, 
  ConflictResolutionStrategy, 
  ConflictMonitorConfig,
  ConflictStats,
  UseConflictMonitorReturn 
} from '../../types/realtime';

interface ConflictMonitorOptions {
  autoResolve?: boolean;
  strategy?: ConflictResolutionStrategy;
  checkInterval?: number;
  maxConflicts?: number;
  maxAutoResolve?: number;
  maxRetries?: number;
  ignoreFields?: string[];
  criticalFields?: string[];
  autoCleanup?: boolean;
  cleanupInterval?: number;
  maxAge?: number;
  ignoreOwnChanges?: boolean;
  customResolver?: (localData: any, remoteData: any, conflictFields: string[]) => any;
}

const DEFAULT_OPTIONS: Required<Omit<ConflictMonitorOptions, 'customResolver'>> = {
  autoResolve: false,
  strategy: 'manual',
  checkInterval: 3000,
  maxConflicts: 100,
  maxAutoResolve: 10,
  maxRetries: 3,
  ignoreFields: ['created_at', 'updated_at'],
  criticalFields: [],
  autoCleanup: true,
  cleanupInterval: 60000, // 1 minuto
  maxAge: 300000, // 5 minutos
  ignoreOwnChanges: false
};

export function useConflictMonitor(
  table: string,
  options: ConflictMonitorOptions = {}
): UseConflictMonitorReturn {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const { showNotification } = useNotification();
  const { conflicts, addConflict, resolveConflict: contextResolveConflict, clearConflicts } = useRealtimeContext();
  
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [resolutionStrategy, setResolutionStrategy] = useState<ConflictResolutionStrategy>(config.strategy);
  const [autoResolveCount, setAutoResolveCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [lastConflictAt, setLastConflictAt] = useState<Date | null>(null);
  
  const channelRef = useRef<any>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const cleanupIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Filtrar conflitos por tabela
  const tableConflicts = conflicts.filter(c => c.table === table);
  const conflictCount = tableConflicts.length;
  const hasUnresolvedConflicts = tableConflicts.some(c => c.status === 'pending');
  
  // Detectar conflito entre dados locais e remotos
  const detectConflict = useCallback(async (
    localData: any,
    remoteData: any
  ): Promise<ConflictData | null> => {
    try {
      // Verificar se os dados são diferentes
      const localStr = JSON.stringify(localData);
      const remoteStr = JSON.stringify(remoteData);
      
      if (localStr === remoteStr) {
        return null; // Sem conflito
      }
      
      // Identificar campos em conflito
      const conflictFields: string[] = [];
      const allKeys = new Set([...Object.keys(localData), ...Object.keys(remoteData)]);
      
      for (const key of allKeys) {
        if (config.ignoreFields.includes(key)) continue;
        
        if (localData[key] !== remoteData[key]) {
          conflictFields.push(key);
        }
      }
      
      if (conflictFields.length === 0) {
        return null; // Sem conflitos relevantes
      }
      
      // Determinar prioridade baseada em campos críticos
      const hasCriticalConflict = conflictFields.some(field => 
        config.criticalFields.includes(field)
      );
      
      const priority = hasCriticalConflict ? 'high' : 'medium';
      
      // Verificar timestamps para determinar tipo de conflito
      const localTime = new Date(localData.updated_at || localData.created_at);
      const remoteTime = new Date(remoteData.updated_at || remoteData.created_at);
      const timeDiff = Math.abs(localTime.getTime() - remoteTime.getTime());
      
      const conflictType = timeDiff < 5000 ? 'update_conflict' : 'version_conflict';
      
      const conflict: ConflictData = {
        id: `conflict_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        table,
        recordId: localData.id || remoteData.id,
        type: conflictType,
        localData,
        remoteData,
        conflictFields,
        timestamp: new Date(),
        priority,
        status: 'pending',
        metadata: {
          localUser: 'current_user', // TODO: Obter usuário atual
          remoteUser: 'unknown',
          conflictReason: 'concurrent_update'
        }
      };
      
      // Adicionar conflito ao contexto
      addConflict(conflict);
      setLastConflictAt(new Date());
      
      // Auto-resolver se configurado
      if (config.autoResolve && autoResolveCount < config.maxAutoResolve && errorCount < config.maxRetries) {
        setTimeout(() => {
          resolveConflict(conflict.id, resolutionStrategy);
        }, 1000);
      }
      
      return conflict;
    } catch (error) {
      console.error('Erro ao detectar conflito:', error);
      setErrorCount(prev => prev + 1);
      return null;
    }
  }, [table, config, addConflict, autoResolveCount, errorCount, resolutionStrategy]);
  
  // Resolver conflito específico
  const resolveConflict = useCallback(async (
    conflictId: string,
    strategy: ConflictResolutionStrategy
  ): Promise<boolean> => {
    try {
      const conflict = tableConflicts.find(c => c.id === conflictId);
      if (!conflict || conflict.status !== 'pending') {
        return false;
      }
      
      let resolvedData: any;
      
      switch (strategy) {
        case 'local_wins':
        case 'local':
          resolvedData = conflict.localData;
          break;
        case 'remote_wins':
        case 'server':
          resolvedData = conflict.remoteData;
          break;
        case 'timestamp_wins':
        case 'latest':
          const localTime = new Date(conflict.localData.updated_at || conflict.localData.created_at);
          const remoteTime = new Date(conflict.remoteData.updated_at || conflict.remoteData.created_at);
          resolvedData = localTime > remoteTime ? conflict.localData : conflict.remoteData;
          break;
        case 'merge':
          resolvedData = { ...conflict.remoteData, ...conflict.localData };
          break;
        case 'custom':
          if (config.customResolver) {
            resolvedData = config.customResolver(
              conflict.localData,
              conflict.remoteData,
              conflict.conflictFields
            );
          } else {
            resolvedData = conflict.remoteData; // Fallback
          }
          break;
        default:
          return false;
      }
      
      // Atualizar no banco de dados
      const { error } = await supabase
        .from(table)
        .update(resolvedData)
        .eq('id', conflict.recordId);
      
      if (error) {
        throw error;
      }
      
      // Marcar como resolvido no contexto
      contextResolveConflict(conflictId, strategy === 'local' || strategy === 'local_wins' ? 'local' : 'server');
      
      if (config.autoResolve) {
        setAutoResolveCount(prev => prev + 1);
      }
      
      showNotification(`Conflito resolvido usando estratégia: ${strategy}`, {
        type: 'success',
        duration: 3000
      });
      
      return true;
    } catch (error) {
      console.error('Erro ao resolver conflito:', error);
      setErrorCount(prev => prev + 1);
      
      showNotification(`Erro ao resolver conflito: ${error instanceof Error ? error.message : 'Erro desconhecido'}`, {
        type: 'error',
        duration: 5000
      });
      
      // Pausar auto-resolução se muitos erros
      if (errorCount >= config.maxRetries) {
        showNotification('Resolução automática pausada devido a muitos erros', {
          type: 'warning',
          duration: 8000
        });
      }
      
      return false;
    }
  }, [tableConflicts, table, contextResolveConflict, config, showNotification, errorCount]);
  
  // Resolver todos os conflitos
  const resolveAllConflicts = useCallback(async (
    strategy: ConflictResolutionStrategy
  ): Promise<number> => {
    const pendingConflicts = tableConflicts.filter(c => c.status === 'pending');
    let resolvedCount = 0;
    
    for (const conflict of pendingConflicts) {
      const success = await resolveConflict(conflict.id, strategy);
      if (success) {
        resolvedCount++;
      }
    }
    
    return resolvedCount;
  }, [tableConflicts, resolveConflict]);
  
  // Obter conflitos por tipo
  const getConflictsByType = useCallback((type: string) => {
    return tableConflicts.filter(c => c.type === type);
  }, [tableConflicts]);
  
  // Obter estatísticas de conflitos
  const getConflictStats = useCallback((): ConflictStats => {
    const stats: ConflictStats = {
      total: tableConflicts.length,
      pending: tableConflicts.filter(c => c.status === 'pending').length,
      resolved: tableConflicts.filter(c => c.status === 'resolved').length,
      byType: {},
      byPriority: { high: 0, medium: 0, low: 0 },
      averageResolutionTime: 0
    };
    
    // Contar por tipo
    tableConflicts.forEach(conflict => {
      stats.byType[conflict.type] = (stats.byType[conflict.type] || 0) + 1;
      stats.byPriority[conflict.priority]++;
    });
    
    // Calcular tempo médio de resolução
    const resolvedConflicts = tableConflicts.filter(c => c.status === 'resolved' && c.resolvedAt);
    if (resolvedConflicts.length > 0) {
      const totalTime = resolvedConflicts.reduce((sum, conflict) => {
        const resolutionTime = conflict.resolvedAt!.getTime() - conflict.timestamp.getTime();
        return sum + resolutionTime;
      }, 0);
      stats.averageResolutionTime = totalTime / resolvedConflicts.length;
    }
    
    return stats;
  }, [tableConflicts]);
  
  // Iniciar monitoramento
  const startMonitoring = useCallback(async () => {
    if (isMonitoring) return;
    
    try {
      // Configurar canal Supabase Realtime
      channelRef.current = supabase
        .channel(`conflict_monitor_${table}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table
          },
          (payload) => {
            // Detectar conflitos em mudanças realtime
            if (payload.eventType === 'UPDATE' && payload.new && payload.old) {
              // Verificar se há mudanças locais pendentes
              // Esta lógica seria mais complexa em uma implementação real
              console.log('Mudança realtime detectada:', payload);
            }
          }
        )
        .subscribe();
      
      setIsMonitoring(true);
      
      // Configurar limpeza automática
      if (config.autoCleanup) {
        cleanupIntervalRef.current = setInterval(() => {
          cleanupOldConflicts();
        }, config.cleanupInterval);
      }
      
    } catch (error) {
      console.error('Erro ao iniciar monitoramento:', error);
      setErrorCount(prev => prev + 1);
    }
  }, [isMonitoring, table, config]);
  
  // Parar monitoramento
  const stopMonitoring = useCallback(async () => {
    if (!isMonitoring) return;
    
    try {
      if (channelRef.current) {
        await channelRef.current.unsubscribe();
        channelRef.current = null;
      }
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      
      if (cleanupIntervalRef.current) {
        clearInterval(cleanupIntervalRef.current);
        cleanupIntervalRef.current = null;
      }
      
      setIsMonitoring(false);
    } catch (error) {
      console.error('Erro ao parar monitoramento:', error);
    }
  }, [isMonitoring]);
  
  // Limpar conflitos antigos
  const cleanupOldConflicts = useCallback(() => {
    const now = Date.now();
    const oldConflicts = tableConflicts.filter(conflict => {
      const age = now - conflict.timestamp.getTime();
      return age > config.maxAge || (conflict.status === 'resolved' && conflict.resolvedAt && (now - conflict.resolvedAt.getTime()) > 60000);
    });
    
    if (oldConflicts.length > 0) {
      clearConflicts();
    }
  }, [tableConflicts, config.maxAge, clearConflicts]);
  
  // Calcular taxa de sucesso de resolução
  const resolutionSuccessRate = tableConflicts.length > 0 
    ? (tableConflicts.filter(c => c.status === 'resolved').length / tableConflicts.length) * 100
    : 100;
  
  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      stopMonitoring();
    };
  }, [stopMonitoring]);
  
  return {
    // Estado
    isMonitoring,
    conflictCount,
    lastConflictAt,
    resolutionStrategy,
    hasUnresolvedConflicts,
    resolutionSuccessRate,
    
    // Conflitos
    conflicts: tableConflicts,
    
    // Ações
    detectConflict,
    resolveConflict,
    resolveAllConflicts,
    setResolutionStrategy,
    
    // Monitoramento
    startMonitoring,
    stopMonitoring,
    
    // Utilitários
    getConflictsByType,
    getConflictStats,
    cleanupOldConflicts
  };
}

export default useConflictMonitor;