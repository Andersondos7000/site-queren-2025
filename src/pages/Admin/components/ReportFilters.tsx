import React from 'react';
import type { ReportFilters as ReportFiltersType, PaymentStatus, PaymentGateway } from '@/types/reports';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

type Props = {
  filters: ReportFiltersType;
  onChange: (next: ReportFiltersType) => void;
  onApply?: () => void;
  applying?: boolean;
};

const STATUS_OPTIONS: PaymentStatus[] = ['pending', 'paid', 'failed', 'refunded'];
const GATEWAY_OPTIONS: PaymentGateway[] = ['pix', 'abacatepay', 'manual'];

const ReportsFilter: React.FC<Props> = ({ filters, onChange, onApply, applying }) => {
  const setDate = (key: 'start' | 'end', value: string) => {
    const date = value ? new Date(value) : new Date();
    onChange({
      ...filters,
      dateRange: { ...filters.dateRange, [key]: date },
    });
  };

  const setStatus = (value: string) => {
    const v = value as PaymentStatus;
    onChange({ ...filters, status: v === 'all' ? [] : [v] });
  };

  const setGateway = (value: string) => {
    const v = value as PaymentGateway;
    onChange({ ...filters, gateway: v === 'all' ? [] : [v] });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
      <div>
        <label className="block text-sm font-medium mb-1">Data inicial</label>
        <input
          type="date"
          value={filters.dateRange.start.toISOString().split('T')[0]}
          onChange={(e) => setDate('start', e.target.value)}
          className="w-full rounded-md border px-3 py-2"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Data final</label>
        <input
          type="date"
          value={filters.dateRange.end.toISOString().split('T')[0]}
          onChange={(e) => setDate('end', e.target.value)}
          className="w-full rounded-md border px-3 py-2"
        />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Status</label>
        <Select value={(filters.status[0] as string) || 'all'} onValueChange={setStatus}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecione status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {STATUS_OPTIONS.map(s => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Gateway</label>
        <Select value={(filters.gateway[0] as string) || 'all'} onValueChange={setGateway}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecione gateway" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {GATEWAY_OPTIONS.map(g => (
              <SelectItem key={g} value={g}>{g}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="md:col-span-4">
        <Button onClick={onApply} disabled={applying} className="bg-butterfly-orange text-white hover:bg-butterfly-orange/90">
          {applying ? 'Aplicando...' : 'Aplicar filtros'}
        </Button>
      </div>
    </div>
  );
};

export default ReportsFilter;