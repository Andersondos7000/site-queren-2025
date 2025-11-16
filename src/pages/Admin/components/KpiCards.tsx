import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KpiData } from '@/types/reports';
import { ShoppingCart, ArrowUpRight, ArrowDownRight } from 'lucide-react';

type Props = {
  kpis: KpiData;
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export const KpiCards: React.FC<Props> = ({ kpis }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Total de Pedidos</CardTitle>
          <ShoppingCart className="h-4 w-4 text-butterfly-orange" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{kpis.totalOrders}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
          <ArrowUpRight className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(kpis.totalRevenue)}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
          <ArrowDownRight className="h-4 w-4 text-indigo-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(kpis.avgOrderValue)}</div>
        </CardContent>
      </Card>
    </div>
  );
};