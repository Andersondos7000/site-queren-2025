import React, { useEffect } from 'react';
import { useRLSPerformanceMonitor } from '../hooks/useRLSPerformanceMonitor';
import { supabase } from '../lib/supabase';

/**
 * Exemplo de como usar o hook de monitoramento de performance RLS
 * Este componente demonstra como integrar o monitoramento em operações existentes
 */
export const RLSPerformanceExample: React.FC = () => {
  const { recordMetric, wrapQuery, sendBatch } = useRLSPerformanceMonitor();

  // Exemplo 1: Monitoramento manual de uma query
  const fetchProductsManual = async () => {
    const startTime = performance.now();
    
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('active', true);
      
      const duration = performance.now() - startTime;
      
      // Registrar métrica manualmente
      recordMetric({
        table_name: 'products',
        policy_name: 'products_select_policy',
        query_duration_ms: duration,
        query_type: 'SELECT',
        user_id: (await supabase.auth.getUser()).data.user?.id || 'anonymous'
      });
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Erro ao buscar produtos:', error);
      throw error;
    }
  };

  // Exemplo 2: Usando wrapQuery para monitoramento automático
  const fetchProductsAutomatic = async () => {
    return wrapQuery(
      () => supabase
        .from('products')
        .select('*')
        .eq('active', true),
      {
        table_name: 'products',
        policy_name: 'products_select_policy',
        query_type: 'SELECT'
      }
    );
  };

  // Exemplo 3: Monitoramento de operação complexa com múltiplas queries
  const fetchOrderWithItems = async (orderId: string) => {
    const startTime = performance.now();
    
    try {
      // Query 1: Buscar pedido
      const orderResult = await wrapQuery(
        () => supabase
          .from('orders')
          .select('*')
          .eq('id', orderId)
          .single(),
        {
          table_name: 'orders',
          policy_name: 'orders_select_policy',
          query_type: 'SELECT'
        }
      );

      // Query 2: Buscar itens do pedido
      const itemsResult = await wrapQuery(
        () => supabase
          .from('order_items')
          .select(`
            *,
            products (
              name,
              price
            )
          `)
          .eq('order_id', orderId),
        {
          table_name: 'order_items',
          policy_name: 'order_items_select_policy',
          query_type: 'SELECT'
        }
      );

      const totalDuration = performance.now() - startTime;
      
      // Registrar métrica da operação completa
      recordMetric({
        table_name: 'orders_with_items',
        policy_name: 'complex_order_query',
        query_duration_ms: totalDuration,
        query_type: 'COMPLEX_SELECT',
        user_id: (await supabase.auth.getUser()).data.user?.id || 'anonymous'
      });

      return {
        order: orderResult.data,
        items: itemsResult.data
      };
    } catch (error) {
      console.error('Erro ao buscar pedido com itens:', error);
      throw error;
    }
  };

  // Exemplo 4: Monitoramento de operações de escrita
  const createProduct = async (productData: any) => {
    return wrapQuery(
      () => supabase
        .from('products')
        .insert(productData)
        .select()
        .single(),
      {
        table_name: 'products',
        policy_name: 'products_insert_policy',
        query_type: 'INSERT'
      }
    );
  };

  // Exemplo 5: Monitoramento de operações em lote
  const updateMultipleProducts = async (updates: Array<{id: string, data: any}>) => {
    const startTime = performance.now();
    const results = [];
    
    for (const update of updates) {
      const result = await wrapQuery(
        () => supabase
          .from('products')
          .update(update.data)
          .eq('id', update.id)
          .select()
          .single(),
        {
          table_name: 'products',
          policy_name: 'products_update_policy',
          query_type: 'UPDATE'
        }
      );
      results.push(result);
    }
    
    const totalDuration = performance.now() - startTime;
    
    // Registrar métrica da operação em lote
    recordMetric({
      table_name: 'products',
      policy_name: 'products_batch_update',
      query_duration_ms: totalDuration,
      query_type: 'BATCH_UPDATE',
      user_id: (await supabase.auth.getUser()).data.user?.id || 'anonymous'
    });
    
    return results;
  };

  // Enviar métricas em lote periodicamente
  useEffect(() => {
    const interval = setInterval(() => {
      sendBatch();
    }, 30000); // Enviar a cada 30 segundos
    
    return () => clearInterval(interval);
  }, [sendBatch]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Exemplos de Monitoramento RLS</h1>
      
      <div className="space-y-4">
        <div className="bg-gray-50 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">1. Monitoramento Manual</h2>
          <p className="text-sm text-gray-600 mb-3">
            Use quando precisar de controle total sobre as métricas registradas.
          </p>
          <button 
            onClick={fetchProductsManual}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Buscar Produtos (Manual)
          </button>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">2. Monitoramento Automático</h2>
          <p className="text-sm text-gray-600 mb-3">
            Use wrapQuery para monitoramento automático de queries simples.
          </p>
          <button 
            onClick={fetchProductsAutomatic}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
          >
            Buscar Produtos (Automático)
          </button>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">3. Operação Complexa</h2>
          <p className="text-sm text-gray-600 mb-3">
            Monitore operações que envolvem múltiplas queries relacionadas.
          </p>
          <button 
            onClick={() => fetchOrderWithItems('example-order-id')}
            className="bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600"
          >
            Buscar Pedido Completo
          </button>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">4. Operação de Escrita</h2>
          <p className="text-sm text-gray-600 mb-3">
            Monitore operações INSERT, UPDATE e DELETE.
          </p>
          <button 
            onClick={() => createProduct({ name: 'Produto Teste', price: 99.99 })}
            className="bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600"
          >
            Criar Produto
          </button>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">5. Operação em Lote</h2>
          <p className="text-sm text-gray-600 mb-3">
            Monitore operações que processam múltiplos registros.
          </p>
          <button 
            onClick={() => updateMultipleProducts([
              { id: '1', data: { price: 89.99 } },
              { id: '2', data: { price: 79.99 } }
            ])}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Atualizar Múltiplos Produtos
          </button>
        </div>
      </div>

      <div className="mt-8 p-4 bg-blue-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-2">💡 Dicas de Uso</h3>
        <ul className="text-sm space-y-1 text-gray-700">
          <li>• Use <code>wrapQuery</code> para queries simples</li>
          <li>• Use <code>recordMetric</code> para controle manual</li>
          <li>• Defina <code>policy_name</code> específicos para melhor rastreamento</li>
          <li>• Agrupe operações relacionadas com <code>query_type</code> customizados</li>
          <li>• As métricas são enviadas automaticamente em lote</li>
        </ul>
      </div>
    </div>
  );
};

export default RLSPerformanceExample;