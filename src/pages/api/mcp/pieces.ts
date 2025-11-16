import { NextApiRequest, NextApiResponse } from 'next';

interface PiecesResponse {
  success: boolean;
  data?: any;
  error?: string;
}

interface PiecesRequest {
  tool: string;
  params: any;
}

/**
 * API endpoint para comunicação com o Pieces MCP
 * 
 * Suporta as seguintes ferramentas:
 * - ask_pieces_ltm: Consultar contexto histórico
 * - create_pieces_memory: Criar memória para uso futuro
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PiecesResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Método não permitido. Use POST.'
    });
  }

  try {
    const { tool, params }: PiecesRequest = req.body;

    if (!tool) {
      return res.status(400).json({
        success: false,
        error: 'Parâmetro "tool" é obrigatório'
      });
    }

    // Simular comunicação com o Pieces MCP
    // Em uma implementação real, aqui seria feita a comunicação via MCP
    let result;

    switch (tool) {
      case 'ask_pieces_ltm':
        result = await handleAskPiecesLTM(params);
        break;
      
      case 'create_pieces_memory':
        result = await handleCreatePiecesMemory(params);
        break;
      
      default:
        return res.status(400).json({
          success: false,
          error: `Ferramenta "${tool}" não suportada`
        });
    }

    return res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Erro na API do Pieces MCP:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
}

/**
 * Simula consulta ao contexto histórico do Pieces
 */
async function handleAskPiecesLTM(params: { query: string }) {
  const { query } = params;
  
  if (!query) {
    throw new Error('Parâmetro "query" é obrigatório');
  }

  // Simulação de resposta do Pieces LTM
  // Em uma implementação real, aqui seria feita a chamada ao MCP
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

  return {
    query,
    suggestions,
    timestamp: new Date().toISOString(),
    source: 'pieces_ltm_mock'
  };
}

/**
 * Simula criação de memória no Pieces
 */
async function handleCreatePiecesMemory(params: { content: string; tags?: string[] }) {
  const { content, tags = [] } = params;
  
  if (!content) {
    throw new Error('Parâmetro "content" é obrigatório');
  }

  // Simulação de criação de memória
  // Em uma implementação real, aqui seria feita a chamada ao MCP
  const memoryId = `memory_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  return {
    id: memoryId,
    content,
    tags,
    created_at: new Date().toISOString(),
    status: 'created',
    source: 'pieces_memory_mock'
  };
}