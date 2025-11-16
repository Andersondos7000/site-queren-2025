import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart, Line, BarChart, Bar, CartesianGrid, XAxis, YAxis, Legend } from 'recharts';
import { ChartData } from '@/types/reports';

type Props = {
  charts: ChartData;
};

export const ReportsCharts: React.FC<Props> = ({ charts }) => {
  const data = charts.salesOverTime.map(d => ({
    date: d.date,
    pedidos: d.orderCount,
    receita: d.revenue,
  }));

  const chartConfig = {
    pedidos: { label: 'Pedidos', color: '#3b82f6' },
    receita: { label: 'Receita', color: '#f97316' },
  } as const;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Pedidos e Receita ao longo do tempo</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[360px]">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis tickFormatter={(v) => `R$ ${v.toLocaleString('pt-BR')}`} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend />
              <Line type="monotone" dataKey="receita" stroke="#f97316" name="Receita" strokeWidth={2} />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Pedidos por dia</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[360px]">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Legend />
              <Bar dataKey="pedidos" fill="#3b82f6" name="Pedidos" />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
};