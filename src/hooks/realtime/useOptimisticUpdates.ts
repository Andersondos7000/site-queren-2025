import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

// Tipos para operações otimistas
export type OptimisticOperation = 'insert' | 'update' | 'delete';

export interface OptimisticItem<T> {
  id: string;
  data: T;
  operation: OptimisticOperation;
  timestamp: number;
  confirmed: boolean;
}

export interface PendingOperation {
  id: string;
  operation: OptimisticOperation;
  promise: Promise<any>;
  rollback: () => void;
}

export interface UseOptimisticUpdatesOptions<T> {
  initialData?: T[];
  autoRollbackTimeout?: number;
  maxRetries?: number;
  onError?: (error: Error, operation: OptimisticOperation) => void;
  onSuccess?: (data: T, operation: OptimisticOperation) => void;
}

export interface UseOptimisticUpdatesReturn<T> {
  // Estado
  optimisticData: T[];
  pendingOperations: PendingOperation[];
  loading: boolean;
  error: Error | null;
  
  // Operações otimistas
  optimisticInsert: (item: Omit<T, 'id'>) => Promise<T>;
  optimisticUpdate: (id: string, updates: Partial<T>) => Promise<T>;
  optimisticDelete: (id: string) => Promise<void>;
  
  // Controle de estado
  rollbackOperation: (operationId: string) => void;
  rollbackAll: () => void;
  syncWithRemote: (remoteData: T[]) => void;
  clearError: () => void;
  
  // Utilitários
  isOperationPending: (id: string) => boolean;
  getOptimisticItem: (id: string) => T | undefined;
}

/**
 * Hook para gerenciar atualizações otimistas com rollback automático
 * 
 * @param tableName Nome da tabela no Supabase
 * @param options Opções de configuração
 * @returns Interface para operações otimistas
 */
export function useOptimisticUpdates<T extends { id: string }>(
  tableName: string,
  options: UseOptimisticUpdatesOptions<T> = {}
): UseOptimisticUpdatesReturn<T> {
  const {
    initialData = [],
    autoRollbackTimeout = 5000,
    maxRetries = 3,
    onError,
    onSuccess
  } = options;

  // Estado principal
  const [optimisticData, setOptimisticData] = useState<T[]>(initialData);
  const [pendingOperations, setPendingOperations] = useState<PendingOperation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Refs para controle de timeouts e operações
  const timeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const retryCountRef = useRef<Map<string, number>>(new Map());

  // Limpar timeouts ao desmontar
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(timeout => clearTimeout(timeout));
      timeoutsRef.current.clear();
    };
  }, []);

  // Gerar ID único para operações otimistas
  const generateOptimisticId = useCallback(() => {
    return `temp-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }, []);

  // Aplicar mudança otimista no estado local
  const applyOptimisticChange = useCallback((item: T, operation: OptimisticOperation) => {
    setOptimisticData(currentData => {
      switch (operation) {
        case 'insert':
          return [...currentData, item];
          
        case 'update':
          return currentData.map(existingItem => 
            existingItem.id === item.id ? { ...existingItem, ...item } : existingItem
          );
          
        case 'delete':
          return currentData.filter(existingItem => existingItem.id !== item.id);
          
        default:
          return currentData;
      }
    });
  }, []);

  // Rollback de operação específica
  const rollbackOperation = useCallback((operationId: string) => {
    // Limpar timeout se existir
    const timeout = timeoutsRef.current.get(operationId);
    if (timeout) {
      clearTimeout(timeout);
      timeoutsRef.current.delete(operationId);
    }

    // Remover da lista de operações pendentes
    setPendingOperations(current => 
      current.filter(op => op.id !== operationId)
    );

    // Limpar contador de retry
    retryCountRef.current.delete(operationId);

    // Recarregar dados do servidor para garantir consistência
    syncWithServer();
  }, []);

  // Rollback de todas as operações pendentes
  const rollbackAll = useCallback(() => {
    // Limpar todos os timeouts
    timeoutsRef.current.forEach(timeout => clearTimeout(timeout));
    timeoutsRef.current.clear();

    // Limpar operações pendentes
    setPendingOperations([]);

    // Limpar contadores de retry
    retryCountRef.current.clear();

    // Recarregar dados do servidor
    syncWithServer();
  }, []);

  // Sincronizar com dados remotos
  const syncWithRemote = useCallback((remoteData: T[]) => {
    setOptimisticData(remoteData);
  }, []);

  // Sincronizar com servidor (buscar dados atuais)
  const syncWithServer = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*');

      if (error) {
        console.error('Erro ao sincronizar com servidor:', error);
        return;
      }

      if (data) {
        syncWithRemote(data as T[]);
      }
    } catch (err) {
      console.error('Erro ao buscar dados do servidor:', err);
    }
  }, [tableName, syncWithRemote]);

  // Configurar rollback automático
  const setupAutoRollback = useCallback((operationId: string) => {
    const timeout = setTimeout(() => {
      console.warn(`Rollback automático para operação ${operationId}`);
      rollbackOperation(operationId);
    }, autoRollbackTimeout);

    timeoutsRef.current.set(operationId, timeout);
  }, [autoRollbackTimeout, rollbackOperation]);

  // Insert otimista
  const optimisticInsert = useCallback(async (item: Omit<T, 'id'>): Promise<T> => {
    const optimisticId = generateOptimisticId();
    const optimisticItem = { ...item, id: optimisticId } as T;

    try {
      setLoading(true);
      setError(null);

      // Aplicar mudança otimista imediatamente
      applyOptimisticChange(optimisticItem, 'insert');

      // Configurar rollback automático
      setupAutoRollback(optimisticId);

      // Executar operação no servidor
      const serverPromise = supabase
        .from(tableName)
        .insert(item)
        .select()
        .single();

      // Adicionar à lista de operações pendentes
      const pendingOp: PendingOperation = {
        id: optimisticId,
        operation: 'insert',
        promise: serverPromise,
        rollback: () => rollbackOperation(optimisticId)
      };

      setPendingOperations(current => [...current, pendingOp]);

      // Aguardar resposta do servidor
      const { data, error } = await serverPromise;

      if (error) {
        rollbackOperation(optimisticId);
        const errorObj = new Error(`Erro ao inserir: ${error.message}`);
        setError(errorObj);
        onError?.(errorObj, 'insert');
        throw errorObj;
      }

      // Sucesso: atualizar com dados reais do servidor
      const serverItem = data as T;
      
      // Limpar timeout
      const timeout = timeoutsRef.current.get(optimisticId);
      if (timeout) {
        clearTimeout(timeout);
        timeoutsRef.current.delete(optimisticId);
      }

      // Remover da lista de pendentes
      setPendingOperations(current => 
        current.filter(op => op.id !== optimisticId)
      );

      // Atualizar com dados reais
      setOptimisticData(current => 
        current.map(existingItem => 
          existingItem.id === optimisticId ? serverItem : existingItem
        )
      );

      onSuccess?.(serverItem, 'insert');
      return serverItem;

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Erro desconhecido');
      setError(error);
      onError?.(error, 'insert');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [tableName, generateOptimisticId, applyOptimisticChange, setupAutoRollback, rollbackOperation, onError, onSuccess]);

  // Update otimista
  const optimisticUpdate = useCallback(async (id: string, updates: Partial<T>): Promise<T> => {
    const operationId = `update-${id}-${Date.now()}`;

    try {
      setLoading(true);
      setError(null);

      // Encontrar item atual
      const currentItem = optimisticData.find(item => item.id === id);
      if (!currentItem) {
        throw new Error(`Item com ID ${id} não encontrado`);
      }

      // Criar item otimista
      const optimisticItem = { ...currentItem, ...updates } as T;

      // Aplicar mudança otimista imediatamente
      applyOptimisticChange(optimisticItem, 'update');

      // Configurar rollback automático
      setupAutoRollback(operationId);

      // Executar operação no servidor
      const serverPromise = supabase
        .from(tableName)
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      // Adicionar à lista de operações pendentes
      const pendingOp: PendingOperation = {
        id: operationId,
        operation: 'update',
        promise: serverPromise,
        rollback: () => rollbackOperation(operationId)
      };

      setPendingOperations(current => [...current, pendingOp]);

      // Aguardar resposta do servidor
      const { data, error } = await serverPromise;

      if (error) {
        rollbackOperation(operationId);
        const errorObj = new Error(`Erro ao atualizar: ${error.message}`);
        setError(errorObj);
        onError?.(errorObj, 'update');
        throw errorObj;
      }

      // Sucesso: atualizar com dados reais do servidor
      const serverItem = data as T;
      
      // Limpar timeout
      const timeout = timeoutsRef.current.get(operationId);
      if (timeout) {
        clearTimeout(timeout);
        timeoutsRef.current.delete(operationId);
      }

      // Remover da lista de pendentes
      setPendingOperations(current => 
        current.filter(op => op.id !== operationId)
      );

      // Atualizar com dados reais
      setOptimisticData(current => 
        current.map(existingItem => 
          existingItem.id === id ? serverItem : existingItem
        )
      );

      onSuccess?.(serverItem, 'update');
      return serverItem;

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Erro desconhecido');
      setError(error);
      onError?.(error, 'update');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [tableName, optimisticData, applyOptimisticChange, setupAutoRollback, rollbackOperation, onError, onSuccess]);

  // Delete otimista
  const optimisticDelete = useCallback(async (id: string): Promise<void> => {
    const operationId = `delete-${id}-${Date.now()}`;

    try {
      setLoading(true);
      setError(null);

      // Encontrar item atual
      const currentItem = optimisticData.find(item => item.id === id);
      if (!currentItem) {
        throw new Error(`Item com ID ${id} não encontrado`);
      }

      // Aplicar mudança otimista imediatamente
      applyOptimisticChange(currentItem, 'delete');

      // Configurar rollback automático
      setupAutoRollback(operationId);

      // Executar operação no servidor
      const serverPromise = supabase
        .from(tableName)
        .delete()
        .eq('id', id);

      // Adicionar à lista de operações pendentes
      const pendingOp: PendingOperation = {
        id: operationId,
        operation: 'delete',
        promise: serverPromise,
        rollback: () => rollbackOperation(operationId)
      };

      setPendingOperations(current => [...current, pendingOp]);

      // Aguardar resposta do servidor
      const { error } = await serverPromise;

      if (error) {
        rollbackOperation(operationId);
        const errorObj = new Error(`Erro ao deletar: ${error.message}`);
        setError(errorObj);
        onError?.(errorObj, 'delete');
        throw errorObj;
      }

      // Sucesso: limpar timeout e operação pendente
      const timeout = timeoutsRef.current.get(operationId);
      if (timeout) {
        clearTimeout(timeout);
        timeoutsRef.current.delete(operationId);
      }

      setPendingOperations(current => 
        current.filter(op => op.id !== operationId)
      );

      onSuccess?.(currentItem, 'delete');

    } catch (err) {
      const error = err instanceof Error ? err : new Error('Erro desconhecido');
      setError(error);
      onError?.(error, 'delete');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [tableName, optimisticData, applyOptimisticChange, setupAutoRollback, rollbackOperation, onError, onSuccess]);

  // Verificar se operação está pendente
  const isOperationPending = useCallback((id: string): boolean => {
    return pendingOperations.some(op => op.id === id);
  }, [pendingOperations]);

  // Obter item otimista
  const getOptimisticItem = useCallback((id: string): T | undefined => {
    return optimisticData.find(item => item.id === id);
  }, [optimisticData]);

  // Limpar erro
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // Estado
    optimisticData,
    pendingOperations,
    loading,
    error,
    
    // Operações otimistas
    optimisticInsert,
    optimisticUpdate,
    optimisticDelete,
    
    // Controle de estado
    rollbackOperation,
    rollbackAll,
    syncWithRemote,
    clearError,
    
    // Utilitários
    isOperationPending,
    getOptimisticItem
  };
}

export default useOptimisticUpdates;