import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shirt } from 'lucide-react';
import { useTopProducts } from '@/hooks/useTopProducts';

// Função para normalizar valores (converter centavos para reais quando necessário)
const normalizeAmount = (value: number | null | undefined) => {
  if (!value || isNaN(Number(value))) return 0;
  const n = Number(value);
  return n >= 1000 ? n / 100 : n;
};

// Função para formatar moeda
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

export const TopProducts: React.FC = () => {
  const { products, loading, error } = useTopProducts(5);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Produtos Mais Vendidos</CardTitle>
          <CardDescription>Top produtos por quantidade vendida</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex justify-between items-center animate-pulse">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gray-200 rounded"></div>
                  <div>
                    <div className="w-24 h-4 bg-gray-200 rounded mb-1"></div>
                    <div className="w-16 h-3 bg-gray-200 rounded"></div>
                  </div>
                </div>
                <div className="w-16 h-4 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Produtos Mais Vendidos</CardTitle>
          <CardDescription>Top produtos por quantidade vendida</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-red-500">Erro ao carregar produtos: {error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Produtos Mais Vendidos</CardTitle>
        <CardDescription>Top produtos por quantidade vendida</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {products.length > 0 ? (
            products.map((product, index) => (
              <div key={product.id} className="flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <Shirt className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-medium">{product.name}</h4>
                    <p className="text-sm text-gray-500">{product.totalQuantity} unid.</p>
                  </div>
                </div>
                <span className="font-semibold">
                  {formatCurrency(normalizeAmount(product.totalRevenue))}
                </span>
              </div>
            ))
          ) : (
            <div className="text-center py-4">
              <p className="text-gray-500">Nenhum produto vendido ainda</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};