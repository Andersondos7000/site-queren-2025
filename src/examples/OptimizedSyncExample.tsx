import React from 'react';
import { useJWTManager } from '../hooks/useJWTManager';
import { useOptimizedRealtime } from '../hooks/realtime/useOptimizedRealtime';
import { useRealtimeCart } from '../hooks/realtime/useRealtimeCart';
import { SyncStatus } from '../components/realtime/SyncStatus';
import { OfflineIndicator } from '../components/realtime/OfflineIndicator';

/**
 * Exemplo de uso dos hooks otimizados para sincronização JWT
 * 
 * Este componente demonstra:
 * - Gestão automática de tokens JWT
 * - Sincronização em tempo real otimizada
 * - Carrinho com cache local e resolução de conflitos
 * - Indicadores visuais de status
 * - Tratamento de cenários offline
 */
export function OptimizedSyncExample() {
  const {
    isAuthenticated,
    tokenStatus,
    getValidToken,
    getAuthHeaders,
    refreshToken
  } = useJWTManager();

  const {
    isConnected,
    isSubscribed,
    connectionStatus,
    lastHeartbeat,
    reconnect
  } = useOptimizedRealtime({
    table: 'products',
    filter: 'status=eq.active',
    onUpdate: (payload) => {
      console.log('Produto atualizado:', payload);
    },
    onError: (error) => {
      console.error('Erro na sincronização:', error);
    }
  });

  const {
    items: cartItems,
    summary: cartSummary,
    syncStatus,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart
  } = useRealtimeCart();

  // Exemplo de uso das funções do carrinho
  const handleAddProduct = async (productId: string, sizeId: string) => {
    try {
      await addToCart({
        product_id: productId,
        size_id: sizeId,
        quantity: 1
      });
      console.log('Produto adicionado ao carrinho');
    } catch (error) {
      console.error('Erro ao adicionar produto:', error);
    }
  };

  const handleUpdateQuantity = async (itemId: string, newQuantity: number) => {
    try {
      await updateQuantity(itemId, newQuantity);
      console.log('Quantidade atualizada');
    } catch (error) {
      console.error('Erro ao atualizar quantidade:', error);
    }
  };

  // Exemplo de uso do token JWT
  const makeAuthenticatedRequest = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch('/api/protected-endpoint', {
        method: 'GET',
        headers
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Dados protegidos:', data);
      }
    } catch (error) {
      console.error('Erro na requisição autenticada:', error);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Indicadores de Status */}
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold mb-4">Status da Sincronização</h2>
        
        {/* Status JWT */}
        <div className="mb-4">
          <h3 className="font-medium mb-2">Autenticação JWT</h3>
          <div className="flex items-center gap-4 text-sm">
            <span className={`px-2 py-1 rounded ${
              isAuthenticated ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {isAuthenticated ? 'Autenticado' : 'Não autenticado'}
            </span>
            <span className={`px-2 py-1 rounded ${
              tokenStatus === 'valid' ? 'bg-green-100 text-green-800' :
              tokenStatus === 'refreshing' ? 'bg-yellow-100 text-yellow-800' :
              'bg-red-100 text-red-800'
            }`}>
              Token: {tokenStatus}
            </span>
            <button
              onClick={refreshToken}
              className="px-3 py-1 bg-blue-100 text-blue-800 rounded hover:bg-blue-200 transition-colors"
            >
              Renovar Token
            </button>
          </div>
        </div>

        {/* Status Realtime */}
        <div className="mb-4">
          <h3 className="font-medium mb-2">Conexão Realtime</h3>
          <div className="flex items-center gap-4 text-sm">
            <span className={`px-2 py-1 rounded ${
              isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {isConnected ? 'Conectado' : 'Desconectado'}
            </span>
            <span className={`px-2 py-1 rounded ${
              isSubscribed ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
            }`}>
              {isSubscribed ? 'Inscrito' : 'Não inscrito'}
            </span>
            <span className="text-gray-600">
              Status: {connectionStatus}
            </span>
            {lastHeartbeat && (
              <span className="text-gray-600">
                Último heartbeat: {new Date(lastHeartbeat).toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={reconnect}
              className="px-3 py-1 bg-blue-100 text-blue-800 rounded hover:bg-blue-200 transition-colors"
            >
              Reconectar
            </button>
          </div>
        </div>

        {/* Componente de Status Integrado */}
        <SyncStatus
          status={{
            syncing: syncStatus.syncing,
            lastSync: syncStatus.lastSync,
            pendingChanges: syncStatus.pendingChanges,
            conflictCount: syncStatus.conflictCount,
            error: syncStatus.error,
            realtimeConnected: isConnected,
            realtimeSubscribed: isSubscribed
          }}
        />
      </div>

      {/* Carrinho de Compras */}
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold mb-4">Carrinho de Compras</h2>
        
        {/* Resumo do Carrinho */}
        <div className="mb-4 p-3 bg-gray-50 rounded">
          <div className="flex justify-between items-center">
            <span>Total de itens: {cartSummary.totalItems}</span>
            <span className="font-semibold">Total: R$ {cartSummary.totalPrice.toFixed(2)}</span>
          </div>
          <div className="text-sm text-gray-600 mt-1">
            Status: {syncStatus.syncing ? 'Sincronizando...' : 'Sincronizado'}
            {syncStatus.pendingChanges > 0 && (
              <span className="ml-2 text-orange-600">
                ({syncStatus.pendingChanges} alterações pendentes)
              </span>
            )}
          </div>
        </div>

        {/* Lista de Itens */}
        <div className="space-y-2 mb-4">
          {cartItems.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-2 border rounded">
              <div>
                <span className="font-medium">{item.product?.name || 'Produto'}</span>
                <span className="text-sm text-gray-600 ml-2">
                  Tamanho: {item.size?.name || 'N/A'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleUpdateQuantity(item.id, Math.max(1, item.quantity - 1))}
                  className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
                >
                  -
                </button>
                <span className="px-2">{item.quantity}</span>
                <button
                  onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                  className="px-2 py-1 bg-gray-200 rounded hover:bg-gray-300"
                >
                  +
                </button>
                <button
                  onClick={() => removeFromCart(item.id)}
                  className="px-2 py-1 bg-red-100 text-red-800 rounded hover:bg-red-200"
                >
                  Remover
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Ações do Carrinho */}
        <div className="flex gap-2">
          <button
            onClick={() => handleAddProduct('example-product-id', 'example-size-id')}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Adicionar Produto Exemplo
          </button>
          <button
            onClick={clearCart}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Limpar Carrinho
          </button>
        </div>
      </div>

      {/* Testes de API */}
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold mb-4">Testes de API</h2>
        
        <div className="space-y-2">
          <button
            onClick={makeAuthenticatedRequest}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
          >
            Fazer Requisição Autenticada
          </button>
          
          <button
            onClick={async () => {
              const token = await getValidToken();
              console.log('Token atual:', token ? 'Válido' : 'Inválido');
            }}
            className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors ml-2"
          >
            Verificar Token
          </button>
        </div>
      </div>

      {/* Indicador Offline */}
      <OfflineIndicator
        onRetry={() => {
          console.log('Tentando reconectar...');
          reconnect();
        }}
      />
    </div>
  );
}

export default OptimizedSyncExample;