export type DateRange = { start: Date; end: Date };

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export type PaymentGateway = 'pix' | 'abacatepay' | 'manual';

export type ReportFilters = {
  dateRange: DateRange;
  status: PaymentStatus[];
  gateway: PaymentGateway[];
};

export type KpiData = {
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
};

export type LinePoint = { date: string; orderCount: number; revenue: number };

export type ChartData = {
  salesOverTime: LinePoint[];
};

export type TableRow = {
  id: string;
  created_at: string;
  payment_status: string;
  payment_method?: string | null;
  total_amount: number;
  order_type?: string | null;
};

export type TableData = {
  rows: TableRow[];
};

export type ReportData = {
  kpis: KpiData;
  charts: ChartData;
  table: TableData;
};