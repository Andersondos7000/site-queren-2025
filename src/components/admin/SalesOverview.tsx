import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Line, LineChart, Bar, BarChart, Pie, PieChart, Cell, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { supabase } from '@/lib/supabase';
import { Ticket, Shirt } from 'lucide-react';

interface SalesData {
  date: string;
  ingressos: number;
  roupas: number;
  total: number;
  totalLiquido: number;
  taxas: number;
}

interface SalesByType {
  type: string;
  value: number;
  color: string;
}

const COLORS = ['#f97316', '#3b82f6', '#10b981'];

export const SalesOverview: React.FC = () => {
  const [salesData, setSalesData] = useState<SalesData[]>([]);
  const [salesByType, setSalesByType] = useState<SalesByType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalVendas, setTotalVendas] = useState(0);
  const [totalVendasLiquido, setTotalVendasLiquido] = useState(0);
  const [totalTaxas, setTotalTaxas] = useState(0);

  useEffect(() => {
    const fetchSalesData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Buscar orders pagas dos últimos 30 dias
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: orders, error: ordersError } = await supabase
          .from('orders')
          .select('id, total_amount, payment_data, payment_status, created_at, order_type')
          .eq('payment_status', 'paid')
          .gte('created_at', thirtyDaysAgo.toISOString())
          .order('created_at', { ascending: true });

        if (ordersError) {
          throw ordersError;
        }

        // Buscar tickets relacionados aos pedidos
        const { data: ticketsData, error: ticketsError } = await supabase
          .from('tickets')
          .select('id, total_price, price, quantity, order_id, created_at')
          .gte('created_at', thirtyDaysAgo.toISOString());

        if (ticketsError) {
          console.error('Erro ao buscar tickets:', ticketsError);
        }

        // Buscar order_items (roupas) relacionados aos pedidos
        const { data: itemsData, error: itemsError } = await supabase
          .from('order_items')
          .select('id, total_price, price, quantity, order_id, product_id, created_at')
          .not('product_id', 'is', null)
          .gte('created_at', thirtyDaysAgo.toISOString());

        if (itemsError) {
          console.error('Erro ao buscar itens:', itemsError);
        }

        // Agrupar vendas por dia
        const salesMap: Record<string, SalesData> = {};
        let totalBruto = 0;
        let totalLiquido = 0;
        let totalTaxasAplicadas = 0;
        let totalIngressos = 0;
        let totalRoupas = 0;

        // Processar orders
        orders?.forEach(order => {
          const orderDate = new Date(order.created_at).toISOString().split('T')[0];
          
          if (!salesMap[orderDate]) {
            salesMap[orderDate] = {
              date: orderDate,
              ingressos: 0,
              roupas: 0,
              total: 0,
              totalLiquido: 0,
              taxas: 0
            };
          }

          // Calcular taxa da AbacatePay a partir do payment_data
          let taxa = 0;
          let valorBruto = order.total_amount || 0;
          
          if (order.payment_data && typeof order.payment_data === 'object') {
            const paymentData = order.payment_data as any;
            // Tentar encontrar a taxa no payment_data
            if (paymentData.payment?.fee) {
              const feeCentavos = paymentData.payment.fee;
              taxa = (feeCentavos >= 1 && Number.isInteger(feeCentavos)) 
                ? feeCentavos / 100 
                : feeCentavos;
            } else if (paymentData.data?.payment?.fee) {
              const feeCentavos = paymentData.data.payment.fee;
              taxa = (feeCentavos >= 1 && Number.isInteger(feeCentavos)) 
                ? feeCentavos / 100 
                : feeCentavos;
            } else {
              // Taxa padrão de 5% se não encontrada (baseado na documentação do AbacatePay)
              taxa = valorBruto * 0.05;
            }
          } else {
            // Taxa padrão de 5% se não houver payment_data
            taxa = valorBruto * 0.05;
          }

          const valorLiquido = valorBruto - taxa;

          // Determinar tipo de venda baseado em order_type ou itens
          const isIngresso = order.order_type === 'ticket' || 
            (ticketsData?.some(t => t.order_id === order.id));
          const isRoupa = order.order_type === 'product' || 
            (itemsData?.some(i => i.order_id === order.id && i.product_id));

          if (isIngresso) {
            salesMap[orderDate].ingressos += valorBruto;
            totalIngressos += valorBruto;
          } else if (isRoupa) {
            salesMap[orderDate].roupas += valorBruto;
            totalRoupas += valorBruto;
          } else {
            // Se não conseguir determinar, considerar como misto
            salesMap[orderDate].ingressos += valorBruto * 0.5;
            salesMap[orderDate].roupas += valorBruto * 0.5;
            totalIngressos += valorBruto * 0.5;
            totalRoupas += valorBruto * 0.5;
          }

          salesMap[orderDate].total += valorBruto;
          salesMap[orderDate].totalLiquido += valorLiquido;
          salesMap[orderDate].taxas += taxa;

          totalBruto += valorBruto;
          totalLiquido += valorLiquido;
          totalTaxasAplicadas += taxa;
        });

        // Processar tickets diretamente (caso não tenham order_id)
        ticketsData?.forEach(ticket => {
          if (!ticket.order_id) {
            const ticketDate = new Date(ticket.created_at).toISOString().split('T')[0];
            
            if (!salesMap[ticketDate]) {
              salesMap[ticketDate] = {
                date: ticketDate,
                ingressos: 0,
                roupas: 0,
                total: 0,
                totalLiquido: 0,
                taxas: 0
              };
            }

            const valorBruto = ticket.total_price || ticket.price || 0;
            const taxa = valorBruto * 0.05; // Taxa padrão de 5%
            const valorLiquido = valorBruto - taxa;

            salesMap[ticketDate].ingressos += valorBruto;
            salesMap[ticketDate].total += valorBruto;
            salesMap[ticketDate].totalLiquido += valorLiquido;
            salesMap[ticketDate].taxas += taxa;

            totalIngressos += valorBruto;
            totalBruto += valorBruto;
            totalLiquido += valorLiquido;
            totalTaxasAplicadas += taxa;
          }
        });

        // Processar order_items diretamente (caso não tenham order_id)
        itemsData?.forEach(item => {
          if (!item.order_id && item.product_id) {
            const itemDate = new Date(item.created_at).toISOString().split('T')[0];
            
            if (!salesMap[itemDate]) {
              salesMap[itemDate] = {
                date: itemDate,
                ingressos: 0,
                roupas: 0,
                total: 0,
                totalLiquido: 0,
                taxas: 0
              };
            }

            const valorBruto = item.total_price || (item.price * item.quantity) || 0;
            const taxa = valorBruto * 0.05; // Taxa padrão de 5%
            const valorLiquido = valorBruto - taxa;

            salesMap[itemDate].roupas += valorBruto;
            salesMap[itemDate].total += valorBruto;
            salesMap[itemDate].totalLiquido += valorLiquido;
            salesMap[itemDate].taxas += taxa;

            totalRoupas += valorBruto;
            totalBruto += valorBruto;
            totalLiquido += valorLiquido;
            totalTaxasAplicadas += taxa;
          }
        });

        // Converter para array e ordenar por data
        const salesArray = Object.values(salesMap).sort((a, b) => 
          new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        setSalesData(salesArray);
        setTotalVendas(totalBruto);
        setTotalVendasLiquido(totalLiquido);
        setTotalTaxas(totalTaxasAplicadas);

        // Preparar dados para gráfico de pizza
        setSalesByType([
          {
            type: 'Ingressos',
            value: totalIngressos,
            color: COLORS[0]
          },
          {
            type: 'Roupas',
            value: totalRoupas,
            color: COLORS[1]
          }
        ]);

      } catch (err) {
        console.error('Erro ao buscar dados de vendas:', err);
        setError(err instanceof Error ? err.message : 'Erro desconhecido');
      } finally {
        setLoading(false);
      }
    };

    fetchSalesData();
  }, []);

  const chartConfig = {
    ingressos: {
      label: "Ingressos",
      color: "#f97316",
    },
    roupas: {
      label: "Roupas",
      color: "#3b82f6",
    },
    total: {
      label: "Total Bruto",
      color: "#10b981",
    },
    totalLiquido: {
      label: "Total Líquido",
      color: "#8b5cf6",
    },
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Visão Geral de Vendas</CardTitle>
          <CardDescription>Vendas dos últimos 30 dias (com taxas aplicadas)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex items-center justify-center">
            <p className="text-gray-500">Carregando dados...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Visão Geral de Vendas</CardTitle>
          <CardDescription>Vendas dos últimos 30 dias (com taxas aplicadas)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex items-center justify-center">
            <p className="text-red-500">Erro ao carregar dados: {error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cards de resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Bruto</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              R$ {totalVendas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Líquido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              R$ {totalVendasLiquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Após desconto de taxas AbacatePay
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Taxas Totais</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              R$ {totalTaxas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalVendas > 0 ? ((totalTaxas / totalVendas) * 100).toFixed(2) : '0.00'}% do total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de linha temporal */}
      <Card>
        <CardHeader>
          <CardTitle>Vendas ao Longo do Tempo</CardTitle>
          <CardDescription>Comparação entre ingressos e roupas (últimos 30 dias)</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[400px]">
            <LineChart data={salesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return `${date.getDate()}/${date.getMonth() + 1}`;
                }}
              />
              <YAxis 
                tickFormatter={(value) => `R$ ${value.toLocaleString('pt-BR')}`}
              />
              <ChartTooltip 
                content={<ChartTooltipContent 
                  formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                />}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="ingressos" 
                stroke="#f97316" 
                strokeWidth={2}
                name="Ingressos"
              />
              <Line 
                type="monotone" 
                dataKey="roupas" 
                stroke="#3b82f6" 
                strokeWidth={2}
                name="Roupas"
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Gráfico de barras - Bruto vs Líquido */}
      <Card>
        <CardHeader>
          <CardTitle>Valor Bruto vs Líquido</CardTitle>
          <CardDescription>Comparação entre valor bruto e líquido após taxas</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[400px]">
            <BarChart data={salesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return `${date.getDate()}/${date.getMonth() + 1}`;
                }}
              />
              <YAxis 
                tickFormatter={(value) => `R$ ${value.toLocaleString('pt-BR')}`}
              />
              <ChartTooltip 
                content={<ChartTooltipContent 
                  formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                />}
              />
              <Legend />
              <Bar dataKey="total" fill="#10b981" name="Total Bruto" />
              <Bar dataKey="totalLiquido" fill="#8b5cf6" name="Total Líquido" />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Gráfico de pizza - Distribuição por tipo */}
      {salesByType.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Tipo</CardTitle>
            <CardDescription>Proporção de vendas entre ingressos e roupas</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center">
              <ChartContainer config={chartConfig} className="h-[400px] w-full">
                <PieChart>
                  <Pie
                    data={salesByType}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {salesByType.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip 
                    content={<ChartTooltipContent 
                      formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                    />}
                  />
                  <Legend />
                </PieChart>
              </ChartContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

