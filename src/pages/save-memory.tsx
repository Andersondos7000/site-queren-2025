import React, { useState, useEffect } from 'react';
import { usePiecesMCP } from '../hooks/mcp';
import { Link } from 'react-router-dom';

export default function SaveMemoryPage() {
  const { createPiecesMemory, isLoading, error } = usePiecesMCP();
  const [memoryContent, setMemoryContent] = useState(
    'Implementação da integração do Pieces MCP no Trae AI, incluindo o hook usePiecesMCP para consulta de memória de longo prazo, registro de eventos de conectividade e obtenção de dicas de solução de problemas, além da integração com o componente OfflineIndicator para exibir dicas inteligentes de solução de problemas de conectividade.'
  );
  const [memoryTitle, setMemoryTitle] = useState('Integração Pieces MCP - Trae AI');
  const [memoryTags, setMemoryTags] = useState('pieces, mcp, integração, trae, ai, conectividade');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [saveResult, setSaveResult] = useState<any>(null);
  
  // Salvar automaticamente ao carregar a página
  useEffect(() => {
    handleSaveMemory();
  }, []);

  const handleSaveMemory = async () => {
    if (!memoryContent.trim()) return;
    
    setSaveStatus('saving');
    
    try {
      const tags = [
        ...memoryTags.split(',').map(tag => tag.trim()).filter(Boolean),
        `title:${memoryTitle}`
      ];
      
      const result = await createPiecesMemory(memoryContent, tags);
      setSaveResult(result);
      setSaveStatus(result.success ? 'success' : 'error');
    } catch (err) {
      console.error('Erro ao salvar memória:', err);
      setSaveStatus('error');
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Salvar Memória no Pieces MCP</h1>
        <Link to="/test-mcp" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Voltar para Testes
        </Link>
      </div>
      
      <div className="mb-8 p-4 border rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Detalhes da Memória</h2>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Título:</label>
          <input
            type="text"
            className="w-full p-2 border rounded"
            value={memoryTitle}
            onChange={(e) => setMemoryTitle(e.target.value)}
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Conteúdo:</label>
          <textarea 
            className="w-full p-2 border rounded" 
            rows={6}
            value={memoryContent}
            onChange={(e) => setMemoryContent(e.target.value)}
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Tags (separadas por vírgula):</label>
          <input 
            type="text" 
            className="w-full p-2 border rounded"
            value={memoryTags}
            onChange={(e) => setMemoryTags(e.target.value)}
          />
        </div>
        
        <button 
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          onClick={handleSaveMemory}
          disabled={isLoading || !memoryContent.trim() || saveStatus === 'saving'}
        >
          {saveStatus === 'saving' ? 'Salvando...' : 'Salvar Memória'}
        </button>
        
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700">
            <p className="font-medium">Erro:</p>
            <p>{typeof error === 'string' ? error : error.message || 'Erro desconhecido'}</p>
          </div>
        )}
        
        {saveStatus === 'success' && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded text-green-700">
            <p className="font-medium">Memória salva com sucesso!</p>
            {saveResult && (
              <pre className="mt-2 whitespace-pre-wrap text-sm">
                {JSON.stringify(saveResult, null, 2)}
              </pre>
            )}
          </div>
        )}
        
        {saveStatus === 'error' && !error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-700">
            <p className="font-medium">Erro ao salvar memória.</p>
            {saveResult && (
              <pre className="mt-2 whitespace-pre-wrap text-sm">
                {JSON.stringify(saveResult, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}