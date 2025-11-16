import React, { useState } from 'react';
import { usePiecesMCP } from '../hooks/mcp';
import { OfflineIndicator } from '../components/realtime/OfflineIndicator';
import { Link } from 'react-router-dom';

export default function TestMCPPage() {
  const { askPiecesLTM, createPiecesMemory, isLoading, error, lastResponse } = usePiecesMCP();
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState<any>(null);
  const [memoryContent, setMemoryContent] = useState('');
  const [memoryTags, setMemoryTags] = useState('');
  const [memoryResponse, setMemoryResponse] = useState<any>(null);

  const handleAskPieces = async () => {
    if (!query.trim()) return;
    
    const result = await askPiecesLTM(query);
    setResponse(result);
  };

  const handleCreateMemory = async () => {
    if (!memoryContent.trim()) return;
    
    const tags = memoryTags.split(',').map(tag => tag.trim()).filter(Boolean);
    const result = await createPiecesMemory(memoryContent, tags);
    setMemoryResponse(result);
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Teste de Integração com Pieces MCP</h1>
        <Link href="/save-memory" className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700">
          Salvar Memória
        </Link>
      </div>
      
      {/* Indicador de status offline */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Status de Conectividade</h2>
        <OfflineIndicator showRetryButton={true} />
      </div>
      
      {/* Consulta ao Pieces LTM */}
      <div className="mb-8 p-4 border rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Consultar Pieces LTM</h2>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Consulta:</label>
          <textarea 
            className="w-full p-2 border rounded" 
            rows={3}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Digite sua consulta para o Pieces LTM"
          />
        </div>
        
        <button 
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          onClick={handleAskPieces}
          disabled={isLoading || !query.trim()}
        >
          {isLoading ? 'Consultando...' : 'Consultar'}
        </button>
        
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700">
            <p className="font-medium">Erro:</p>
            <p>{typeof error === 'string' ? error : error.message || 'Erro desconhecido'}</p>
          </div>
        )}
        
        {response && (
          <div className="mt-4 p-3 bg-gray-50 border rounded">
            <p className="font-medium mb-2">Resposta:</p>
            <pre className="whitespace-pre-wrap text-sm">
              {JSON.stringify(response, null, 2)}
            </pre>
          </div>
        )}
      </div>
      
      {/* Criar memória no Pieces */}
      <div className="mb-8 p-4 border rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Criar Memória no Pieces</h2>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Conteúdo:</label>
          <textarea 
            className="w-full p-2 border rounded" 
            rows={3}
            value={memoryContent}
            onChange={(e) => setMemoryContent(e.target.value)}
            placeholder="Digite o conteúdo para criar uma memória no Pieces"
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Tags (separadas por vírgula):</label>
          <input 
            type="text" 
            className="w-full p-2 border rounded"
            value={memoryTags}
            onChange={(e) => setMemoryTags(e.target.value)}
            placeholder="tag1, tag2, tag3"
          />
        </div>
        
        <button 
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          onClick={handleCreateMemory}
          disabled={isLoading || !memoryContent.trim()}
        >
          {isLoading ? 'Criando...' : 'Criar Memória'}
        </button>
        
        {memoryResponse && (
          <div className="mt-4 p-3 bg-gray-50 border rounded">
            <p className="font-medium mb-2">Resposta:</p>
            <pre className="whitespace-pre-wrap text-sm">
              {JSON.stringify(memoryResponse, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}