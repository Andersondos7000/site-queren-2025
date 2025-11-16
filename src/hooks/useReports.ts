import { useQuery } from '@tanstack/react-query';
import { ReportFilters, ReportData } from '@/types/reports';
import { fetchReportData, useReportParamsKey } from './useReportData';

type UseReportsProps = {
  filters: ReportFilters;
};

export const useReports = ({ filters }: UseReportsProps) => {
  const key = useReportParamsKey(filters);

  const query = useQuery<ReportData>({
    queryKey: ['reports', key],
    queryFn: () => fetchReportData({ filters }),
    staleTime: 1000 * 60 * 5,
  });

  return query;
};