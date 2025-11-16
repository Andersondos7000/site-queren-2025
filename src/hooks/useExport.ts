import { useState } from 'react';
import { TableData, ReportFilters } from '@/types/reports';

const toCSV = (rows: TableData['rows']) => {
  const header = ['id', 'created_at', 'payment_status', 'payment_method', 'total_amount', 'order_type'];
  const lines = rows.map(r => [
    r.id,
    r.created_at,
    r.payment_status,
    r.payment_method ?? '',
    String(r.total_amount),
    r.order_type ?? '',
  ].join(','));
  return [header.join(','), ...lines].join('\n');
};

const buildExcelInstructions = (filename: string) => {
  const lines: string[] = [];
  lines.push('==================================================');
  lines.push('PRD: Instruções para Abrir Corretamente o Relatório no Excel (Brasil)');
  lines.push(`Arquivo: ${filename}`);
  lines.push('==================================================');
  lines.push('');
  lines.push('PROBLEMA:');
  lines.push('Ao abrir o arquivo CSV diretamente no Microsoft Excel (especialmente versões em português do Brasil),');
  lines.push('os caracteres acentuados (como "ç", "ã", "é") aparecem corrompidos (ex: "CabeÃ§alho").');
  lines.push('Isso ocorre porque o Excel, por padrão, abre arquivos .csv usando a codificação ANSI/Windows-1252,');
  lines.push('enquanto o arquivo original está em UTF-8 SEM BOM (Byte Order Mark).');
  lines.push('');
  lines.push('SOLUÇÃO RECOMENDADA:');
  lines.push('Para visualizar corretamente os dados com acentuação, datas e valores monetários no Excel,');
  lines.push('siga um dos métodos abaixo:');
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('MÉTODO 1: Usar a ferramenta de importação do Excel (RECOMENDADO)');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('');
  lines.push('1. Abra o Microsoft Excel (em branco).');
  lines.push('2. Vá em:   DADOS  →  Obter Dados  →  Do Texto/CSV.');
  lines.push(`3. Selecione o arquivo "${filename}".`);
  lines.push('4. Na janela de visualização:');
  lines.push('   - Certifique-se de que "Codificação" está como: 65001: Unicode (UTF-8)');
  lines.push('   - Delimitador: Vírgula');
  lines.push('5. Clique em "Carregar".');
  lines.push('6. Pronto! Os dados aparecerão com acentos, datas e números corretos.');
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('MÉTODO 2: Salvar o CSV com UTF-8 com BOM (para abertura direta)');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('');
  lines.push('Se desejar abrir o arquivo com duplo clique e já ver os dados corretos:');
  lines.push('');
  lines.push('1. Abra o arquivo CSV em um editor que suporte codificação (ex: Notepad++, VS Code).');
  lines.push('2. Salve-o novamente com a opção: UTF-8 com BOM.');
  lines.push('   - No Bloco de Notas (Windows 10/11): Salvar como → Codificação: UTF-8 (já inclui BOM).');
  lines.push('   - No Notepad++: Codificação → UTF-8-BOM → Salvar.');
  lines.push('3. Agora, ao abrir com duplo clique no Excel, os acentos estarão corretos.');
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('OBSERVAÇÕES IMPORTANTES:');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('');
  lines.push('• O campo "total_amount" está em CENTAVOS (ex: 45000 = R$ 450,00).');
  lines.push('• A data/hora está em UTC (ex: 2025-11-15T02:56:30Z).');
  lines.push('  → Para converter para horário de Brasília, subtraia 3 horas.');
  lines.push('• Pedidos com "payment_status" = "pending" ainda não foram pagos.');
  lines.push('');
  lines.push('Se precisar de um relatório já formatado (com R$, datas em horário de Brasília e cabeçalhos em português),');
  lines.push('solicite a conversão para um novo CSV compatível com Excel BR.');
  lines.push('');
  lines.push('==================================================');
  lines.push('Suporte: equipe@seudominio.com.br');
  lines.push('');
  return lines.join('\n');
};

const fileName = (filters: ReportFilters) => {
  const start = filters.dateRange.start.toISOString().split('T')[0];
  const end = filters.dateRange.end.toISOString().split('T')[0];
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  return `relatorios_${start}_a_${end}_${ts}.csv`;
};

export const useExport = () => {
  const [exporting, setExporting] = useState(false);

  const exportCSV = async (table: TableData, filters: ReportFilters) => {
    setExporting(true);
    try {
      const filename = fileName(filters);
      const instructions = buildExcelInstructions(filename);
      const csvData = toCSV(table.rows);
      const csv = instructions + '\n' + csvData;
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const csvQuote = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const formatBRT = (iso: string) => new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
  }).format(new Date(iso));
  const formatBRLCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const exportCSVExcelBR = async (table: TableData, filters: ReportFilters) => {
    setExporting(true);
    try {
      const filename = fileName(filters).replace('relatorios_', 'relatorios_excel_br_');
      const header = ['ID', 'Data (Brasília)', 'Status', 'Método', 'Valor (R$)', 'Tipo'];
      const rows = table.rows.map(r => {
        const valor = Number(r.total_amount || 0);
        const brl = valor >= 1000 ? valor / 100 : valor;
        return [
          csvQuote(r.id),
          csvQuote(formatBRT(r.created_at)),
          csvQuote(r.payment_status),
          csvQuote(r.payment_method ?? ''),
          csvQuote(formatBRLCurrency(brl)),
          csvQuote(r.order_type ?? ''),
        ].join(',');
      });
      const csv = [header.join(','), ...rows].join('\n');
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return { exporting, exportCSV, exportCSVExcelBR };
};