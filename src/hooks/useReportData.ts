import { useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { ReportFilters, ReportData, KpiData, ChartData, TableData, LinePoint } from '@/types/reports';

type FetchParams = {
  filters: ReportFilters;
};

export const fetchReportData = async ({ filters }: FetchParams): Promise<ReportData> => {
  const startISO = filters.dateRange.start.toISOString();
  const endISO = filters.dateRange.end.toISOString();

  let query = supabase
    .from('orders')
    .select('id, created_at, total_amount, payment_status, payment_method, order_type')
    .gte('created_at', startISO)
    .lte('created_at', endISO)
    .order('created_at', { ascending: true });

  if (filters.status && filters.status.length > 0) {
    query = query.in('payment_status', filters.status);
  }

  if (filters.gateway && filters.gateway.length > 0) {
    const hasPix = filters.gateway.includes('pix');
    const hasAbacate = filters.gateway.includes('abacatepay');
    const hasManual = filters.gateway.includes('manual');

    if (hasPix && !hasAbacate && !hasManual) {
      query = query.eq('payment_method', 'pix');
    }
    if (hasAbacate && !hasPix && !hasManual) {
      query = query.not('abacatepay_id', 'is', null);
    }
    if (hasManual && !hasPix && !hasAbacate) {
      query = query.eq('payment_method', null);
    }
  }

  const { data: orders, error } = await query;
  if (error) {
    const empty: ReportData = {
      kpis: { totalOrders: 0, totalRevenue: 0, avgOrderValue: 0 },
      charts: { salesOverTime: [] },
      table: { rows: [] },
    };
    return empty;
  }

  const totalOrders = orders?.length || 0;
  const totalRevenue = (orders || []).reduce((sum, o: any) => sum + (o.total_amount || 0), 0);
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const kpis: KpiData = { totalOrders, totalRevenue, avgOrderValue };

  const map: Record<string, { count: number; revenue: number }> = {};
  (orders || []).forEach((o: any) => {
    const key = new Date(o.created_at).toISOString().split('T')[0];
    if (!map[key]) map[key] = { count: 0, revenue: 0 };
    map[key].count += 1;
    map[key].revenue += o.total_amount || 0;
  });

  const salesOverTime: LinePoint[] = Object.entries(map)
    .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
    .map(([date, v]) => ({ date, orderCount: v.count, revenue: v.revenue }));

  const charts: ChartData = { salesOverTime };

  const rows: TableData['rows'] = (orders || []).map((o: any) => ({
    id: String(o.id),
    created_at: o.created_at,
    payment_status: o.payment_status,
    payment_method: o.payment_method,
    total_amount: Number(o.total_amount || 0),
    order_type: o.order_type || null,
  }));

  const table: TableData = { rows };

  return { kpis, charts, table };
};

export const useReportParamsKey = (filters: ReportFilters) => {
  return useMemo(() => {
    return [
      filters.dateRange.start.toISOString(),
      filters.dateRange.end.toISOString(),
      (filters.status || []).join(','),
      (filters.gateway || []).join(','),
    ].join('|');
  }, [filters]);
};