import React, { useMemo, useState } from 'react';
import AdminSidebar from '@/components/AdminSidebar';
import type { ReportFilters as ReportFiltersType } from '@/types/reports';
import { useReports } from '@/hooks/useReports';
import Filters from './components/ReportFilters';
import { KpiCards } from './components/KpiCards';
import { ReportsCharts } from './components/Charts/ReportsCharts';
import { DataTable } from './components/DataTable';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useExport } from '@/hooks/useExport';

const AdminRelatorios: React.FC = () => {
  const defaultRange = useMemo(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 7);
    return { start, end };
  }, []);

  const [filters, setFilters] = useState<ReportFiltersType>({
    dateRange: defaultRange,
    status: ['paid'],
    gateway: [],
  });

  const { data, isLoading } = useReports({ filters });
  const { exporting, exportCSV } = useExport();

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-gray-100">
      <AdminSidebar />
      <div className="flex-1 p-4 sm:p-6 lg:p-8 w-full lg:w-auto pt-20 lg:pt-4">
        <h1 className="text-3xl font-bold mb-6">Relatórios</h1>
        <div className="mb-6">
          <Filters filters={filters} onChange={setFilters} applying={isLoading} onApply={() => setFilters({ ...filters })} />
        </div>
        {isLoading && (
          <Card>
            <CardContent>
              <div className="h-24 flex items-center justify-center">Carregando...</div>
            </CardContent>
          </Card>
        )}
        {!isLoading && data && (
          <>
            <KpiCards kpis={data.kpis} />
            <ReportsCharts charts={data.charts} />
            <div className="mt-4 flex justify-end">
              <Button
                onClick={() => exportCSV(data.table, filters)}
                disabled={exporting}
                className="bg-butterfly-orange text-white hover:bg-butterfly-orange/90"
              >
                {exporting ? 'Exportando...' : 'Exportar CSV'}
              </Button>
            </div>
            <div className="mt-6">
              <DataTable table={data.table} />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminRelatorios;