import { useState, useCallback, useEffect } from 'react';

interface PiecesMCPResponse {
  success: boolean;
  data?: any;
  error?: string;
}

interface UsePiecesMCPOptions {
  enableCache?: boolean;
  cacheExpiration?: number; // em milissegundos
}

/**
 * Hook para integração com o Pieces MCP
 * 
 * Permite acessar o contexto histórico e memória de longo prazo do Pieces
 * para melhorar a experiência do usuário, especialmente em cenários offline
 */
export function usePiecesMCP(options: UsePiecesMCPOptions = {}) {
  const { enableCache = true, cacheExpiration = 1000 * 60 * 30 } = options; // 30 minutos padrão
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<any | null>(null);
  
  // Cache local para armazenar respostas do Pieces MCP
  const [cache, setCache] = useState<Record<string, { data: any; timestamp: number }>>({});

  // Limpar cache expirado
  useEffect(() => {
    if (!enableCache) return;
    
    const interval = setInterval(() => {
      const now = Date.now();
      const newCache = { ...cache };
      let hasChanges = false;
      
      Object.keys(newCache).forEach(key => {
        if (now - newCache[key].timestamp > cacheExpiration) {
          delete newCache[key];
          hasChanges = true;
        }
      });
      
      if (hasChanges) {
        setCache(newCache);
      }
    }, 60000); // Verificar a cada minuto
    
    return () => clearInterval(interval);
  }, [cache, cacheExpiration, enableCache]);

  /**
   * Consulta o contexto histórico do Pieces
   */
  const askPiecesLTM = useCallback(async (query: string): Promise<PiecesMCPResponse> => {
    setIsLoading(true);
    setError(null);
    
    // Verificar cache primeiro
    const cacheKey = `ltm:${query}`;
    if (enableCache && cache[cacheKey] && Date.now() - cache[cacheKey].timestamp < cacheExpiration) {
      setLastResponse(cache[cacheKey].data);
      setIsLoading(false);
      return { success: true, data: cache[cacheKey].data };
    }
    
    try {
      // Simulação da chamada ao MCP do Pieces (sem API backend)
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simular delay
      
      const mockResponses = {
        'conectividade': [
          'Verifique sua conexão com a internet',
          'Tente reiniciar o roteador',
          'Verifique se não há bloqueios de firewall'
        ],
        'problemas': [
          'Consulte os logs do sistema',
          'Verifique se todos os serviços estão rodando',
          'Tente limpar o cache do navegador'
        ],
        'default': [
          'Consulte a documentação do projeto',
          'Verifique os logs para mais detalhes',
          'Entre em contato com o suporte técnico'
        ]
      };

      const queryLower = query.toLowerCase();
      let suggestions = mockResponses.default;

      if (queryLower.includes('conectividade') || queryLower.includes('conexão')) {
        suggestions = mockResponses.conectividade;
      } else if (queryLower.includes('problema') || queryLower.includes('erro')) {
        suggestions = mockResponses.problemas;
      }

      const data = {
        query,
        suggestions,
        timestamp: new Date().toISOString(),
        source: 'pieces_ltm_mock'
      };
      
      // Atualizar cache
      if (enableCache) {
        setCache(prev => ({
          ...prev,
          [cacheKey]: { data, timestamp: Date.now() }
        }));
      }
      
      setLastResponse(data);
      setIsLoading(false);
      return { success: true, data };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);
      setIsLoading(false);
      return { success: false, error: errorMessage };
    }
  }, [cache, cacheExpiration, enableCache]);

  /**
   * Cria uma memória no Pieces para uso futuro
   */
  const createPiecesMemory = useCallback(async (content: string, tags: string[] = []): Promise<PiecesMCPResponse> => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Simulação da criação de memória no Pieces (sem API backend)
      await new Promise(resolve => setTimeout(resolve, 800)); // Simular delay
      
      const data = {
        id: `memory_${Date.now()}`,
        content,
        tags: tags || [],
        created_at: new Date().toISOString(),
        status: 'created',
        source: 'pieces_memory_mock'
      };
      setLastResponse(data);
      setIsLoading(false);
      return { success: true, data };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);
      setIsLoading(false);
      return { success: false, error: errorMessage };
    }
  }, []);

  /**
   * Registra eventos de conectividade para análise futura
   */
  const logConnectivityEvent = useCallback(async (event: {
    type: 'offline' | 'online' | 'poor_connection' | 'reconnect_attempt' | 'reconnect_success' | 'reconnect_failure';
    details?: Record<string, any>;
  }): Promise<void> => {
    try {
      // Registrar evento no Pieces para análise futura
      await createPiecesMemory(
        JSON.stringify({
          event_type: 'connectivity',
          timestamp: new Date().toISOString(),
          ...event
        }),
        ['connectivity', `type:${event.type}`, 'realtime']
      );
    } catch (err) {
      console.error('Falha ao registrar evento de conectividade:', err);
      // Não propagar erro para não interromper o fluxo principal
    }
  }, [createPiecesMemory]);

  /**
   * Obtém sugestões para resolução de problemas de conectividade
   */
  const getConnectivityTroubleshooting = useCallback(async (issueType: string): Promise<string[]> => {
    try {
      const response = await askPiecesLTM(
        `Sugestões para resolver problemas de conectividade do tipo: ${issueType}. Forneça 3-5 dicas práticas.`
      );
      
      if (response.success && response.data) {
        // Processar resposta para extrair dicas
        const tips = response.data.suggestions || 
                    response.data.tips || 
                    (typeof response.data === 'string' ? response.data.split('\n').filter(Boolean) : []);
        
        return Array.isArray(tips) ? tips : [tips];
      }
      
      return [
        'Verifique sua conexão com a internet',
        'Tente atualizar a página',
        'Limpe o cache do navegador'
      ];
    } catch (err) {
      console.error('Erro ao obter sugestões de resolução:', err);
      return [
        'Verifique sua conexão com a internet',
        'Tente atualizar a página',
        'Limpe o cache do navegador'
      ];
    }
  }, [askPiecesLTM]);

  return {
    askPiecesLTM,
    createPiecesMemory,
    logConnectivityEvent,
    getConnectivityTroubleshooting,
    isLoading,
    error,
    lastResponse
  };
}