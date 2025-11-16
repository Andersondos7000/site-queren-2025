import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { useRealtimeSync } from '../realtime/useRealtimeSync';
import { useOfflineFirst } from '../realtime/useOfflineFirst';
import type { Profile, ProfileFilters, ProfileSortOptions } from '../../types/profile';

interface UseProfilesOptions {
  filters?: ProfileFilters;
  sortBy?: ProfileSortOptions;
  limit?: number;
  realtime?: boolean;
}

interface UseProfilesReturn {
  profiles: Profile[];
  loading: boolean;
  error: string | null;
  totalCount: number;
  hasMore: boolean;
  // Operações
  refetch: () => Promise<void>;
  loadMore: () => Promise<void>;
  createProfile: (data: Omit<Profile, 'id' | 'created_at' | 'updated_at'>) => Promise<Profile>;
  updateProfile: (id: string, data: Partial<Profile>) => Promise<Profile>;
  deleteProfile: (id: string) => Promise<void>;
  // Status de sincronização
  isOffline: boolean;
  isSyncing: boolean;
  lastSyncAt: Date | null;
  queueSize: number;
  pendingActions: number;
}

export const useProfiles = ({
  filters = {},
  sortBy = { field: 'created_at', direction: 'desc' },
  limit = 50,
  realtime = true
}: UseProfilesOptions = {}): UseProfilesReturn => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [offset, setOffset] = useState(0);

  // Offline-first hook para cache e sincronização
  const { 
    data: cachedProfiles,
    isLoading: cacheLoading,
    isOffline,
    isSyncing,
    lastSyncAt,
    error: cacheError,
    create: createCached,
    update: updateCached,
    delete: deleteCached,
    refresh: refreshCache,
    clearCache,
    queueSize,
    pendingActions
  } = useOfflineFirst<Profile>({
    table: 'profiles',
    cacheKey: `profiles_${JSON.stringify({ filters, sortBy })}`,
    cacheTTL: 24 * 60 * 60 * 1000, // 24 horas
    enableOptimisticUpdates: true,
    syncOnReconnect: true,
    retryFailedActions: true
  });

  // Handler para atualizações realtime
  const handleRealtimeUpdate = useCallback((payload: any) => {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    setProfiles(current => {
      switch (eventType) {
        case 'INSERT':
          return [...current, newRecord];
        case 'UPDATE':
          return current.map(profile => 
            profile.id === newRecord.id ? newRecord : profile
          );
        case 'DELETE':
          return current.filter(profile => profile.id !== oldRecord.id);
        default:
          return current;
      }
    });
  }, []);

  // Construir filtro para realtime
  function buildRealtimeFilter(filters: ProfileFilters): string {
    const conditions: string[] = [];
    
    if (filters.status) {
      conditions.push(`status=eq.${filters.status}`);
    }
    if (filters.customerType) {
      conditions.push(`customer_type=eq.${filters.customerType}`);
    }
    if (filters.userId) {
      conditions.push(`user_id=eq.${filters.userId}`);
    }
    
    return conditions.join('&');
  }

  // Realtime sync para atualizações em tempo real
  const { isConnected } = useRealtimeSync({
    table: 'profiles',
    filter: buildRealtimeFilter(filters),
    onUpdate: handleRealtimeUpdate,
    onError: (err) => setError(err.message),
    enabled: realtime
  });

  // Buscar clientes do servidor
  const fetchProfiles = useCallback(async (reset = false) => {
    try {
      setLoading(true);
      setError(null);
      
      const currentOffset = reset ? 0 : offset;
      
      let query = supabase
        .from('profiles')
        .select('*', { count: 'exact' })
        .range(currentOffset, currentOffset + limit - 1)
        .order(sortBy.field, { ascending: sortBy.direction === 'asc' });
      
      // Aplicar filtros
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.customerType) {
        query = query.eq('customer_type', filters.customerType);
      }
      if (filters.userId) {
        query = query.eq('user_id', filters.userId);
      }
      if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
      }
      
      const { data, error: fetchError, count } = await query;
      
      if (fetchError) throw fetchError;
      
      if (reset) {
        setProfiles(data || []);
        setOffset(limit);
      } else {
        setProfiles(current => [...current, ...(data || [])]);
        setOffset(current => current + limit);
      }
      
      setTotalCount(count || 0);
      
      // Atualizar cache
      refreshCache();
      
    } catch (err) {
      console.error('Erro ao buscar clientes:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      
      // Em caso de erro, usar dados do cache se disponível
      if (cachedProfiles.length > 0) {
      setProfiles(cachedProfiles);
      }
    } finally {
      setLoading(false);
    }
  }, [filters, sortBy, limit, offset, refreshCache, cachedProfiles]);

  // Refetch (reset)
  const refetch = useCallback(async () => {
    setOffset(0);
    await fetchProfiles(true);
  }, [fetchProfiles]);

  // Load more
  const loadMore = useCallback(async () => {
    if (!loading && hasMore) {
      await fetchProfiles(false);
    }
  }, [fetchProfiles, loading]);

  // Criar cliente
  const createProfile = useCallback(async (data: Omit<Profile, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data: newProfile, error: createError } = await supabase
      .from('profiles')
        .insert([{
          ...data,
          user_id: data.user_id || (await supabase.auth.getUser()).data.user?.id
        }])
        .select()
        .single();
      
      if (createError) throw createError;
      
      return newProfile;
    } catch (err) {
      console.error('Erro ao criar cliente:', err);
      throw err;
    }
  }, []);

  // Atualizar cliente
  const updateProfile = useCallback(async (id: string, data: Partial<Profile>) => {
    try {
      const { data: updatedProfile, error: updateError } = await supabase
      .from('profiles')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      
      if (updateError) throw updateError;
      
      return updatedProfile;
    } catch (err) {
      console.error('Erro ao atualizar cliente:', err);
      throw err;
    }
  }, []);

  // Deletar cliente
  const deleteProfile = useCallback(async (id: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', id);
      
      if (deleteError) throw deleteError;
    } catch (err) {
      console.error('Erro ao deletar cliente:', err);
      throw err;
    }
  }, []);

  // Calcular se há mais dados
  const hasMore = profiles.length < totalCount;

  // Carregar dados iniciais
  useEffect(() => {
    fetchProfiles(true);
  }, [filters, sortBy]);

  // Usar dados do cache quando offline
  useEffect(() => {
    if (!isConnected && cachedProfiles.length > 0) {
      setProfiles(cachedProfiles);
    }
  }, [isConnected, cachedProfiles]);

  return {
    profiles,
    loading,
    error,
    totalCount,
    hasMore,
    refetch,
    loadMore,
    createProfile,
    updateProfile,
    deleteProfile,
    isOffline,
    isSyncing,
    lastSyncAt,
    queueSize,
    pendingActions
  };
};