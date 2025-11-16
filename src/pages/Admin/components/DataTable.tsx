import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableData } from '@/types/reports';

type Props = {
  table: TableData;
};

export const DataTable: React.FC<Props> = ({ table }) => {
  const rows = table.rows;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Detalhamento de Pedidos</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Método</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Tipo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.id}</TableCell>
                <TableCell>{new Date(r.created_at).toLocaleString('pt-BR')}</TableCell>
                <TableCell>{r.payment_status}</TableCell>
                <TableCell>{r.payment_method || '-'}</TableCell>
                <TableCell>
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(r.total_amount)}
                </TableCell>
                <TableCell>{r.order_type || '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          {rows.length === 0 && (
            <TableCaption>Nenhum registro encontrado para os filtros selecionados</TableCaption>
          )}
        </Table>
      </CardContent>
    </Card>
  );
};