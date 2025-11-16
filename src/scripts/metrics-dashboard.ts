#!/usr/bin/env node

import { config } from 'dotenv';
config();

import { MonitoringService } from '../services/monitoring';
import { supabase } from '../lib/supabase';

async function main() {
  const hours = parseInt(process.argv[2]) || 24;
  
  console.log(`📊 Dashboard de Métricas - Últimas ${hours}h`);
  console.log('='.repeat(50));

  const monitoring = new MonitoringService();

  try {
    // Estatísticas gerais
    const stats = await monitoring.getExecutionStats(hours);
    
    if (!stats) {
      console.log('❌ Não foi possível obter estatísticas');
      return;
    }

    console.log('\n🔍 Resumo Geral:');
    console.log(`  📊 Total de execuções: ${stats.totalExecutions}`);
    console.log(`  ⏱️  Duração média: ${Math.round(stats.avgDuration / 1000)}s`);
    console.log(`  📈 Pedidos processados: ${stats.totalProcessed}`);
    console.log(`  🔧 Pedidos corrigidos: ${stats.totalCorrected}`);
    console.log(`  📡 Taxa sucesso API: ${(stats.avgSuccessRate * 100).toFixed(1)}%`);
    console.log(`  ⚠️  Execuções com erro: ${stats.recentErrors}`);

    // Taxa de correção
    const correctionRate = stats.totalProcessed > 0 
      ? (stats.totalCorrected / stats.totalProcessed * 100).toFixed(1)
      : '0.0';
    console.log(`  🎯 Taxa de correção: ${correctionRate}%`);

    // Últimas execuções
    console.log('\n📋 Últimas Execuções:');
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const { data: recentMetrics } = await supabase
      .from('reconciliation_metrics')
      .select('*')
      .gte('timestamp', since.toISOString())
      .order('timestamp', { ascending: false })
      .limit(10);

    if (recentMetrics && recentMetrics.length > 0) {
      for (const metric of recentMetrics) {
        const timestamp = new Date(metric.timestamp).toLocaleString('pt-BR');
        const duration = Math.round(metric.duration_ms / 1000);
        const successRate = (metric.api_success_rate * 100).toFixed(1);
        
        const status = metric.errors_count > 0 ? '❌' : '✅';
        
        console.log(`  ${status} ${timestamp} | ${duration}s | ${metric.orders_processed}/${metric.orders_corrected} | API: ${successRate}%`);
      }
    } else {
      console.log('  📭 Nenhuma execução encontrada');
    }

    // Alertas recentes
    console.log('\n🚨 Alertas Recentes:');
    const { data: recentAlerts } = await supabase
      .from('reconciliation_alerts')
      .select('*')
      .gte('triggered_at', since.toISOString())
      .order('triggered_at', { ascending: false })
      .limit(10);

    if (recentAlerts && recentAlerts.length > 0) {
      for (const alert of recentAlerts) {
        const timestamp = new Date(alert.triggered_at).toLocaleString('pt-BR');
        const severityEmoji = getSeverityEmoji(alert.severity);
        
        console.log(`  ${severityEmoji} ${timestamp} | ${alert.metric} | ${alert.description}`);
      }
    } else {
      console.log('  🎉 Nenhum alerta recente');
    }

    // Tendências
    console.log('\n📈 Tendências:');
    await showTrends(hours);

  } catch (error) {
    console.error('❌ Erro ao gerar dashboard:', error);
    process.exit(1);
  }
}

async function showTrends(hours: number) {
  try {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    // Média de duração por hora
    const { data: hourlyStats } = await supabase
      .from('reconciliation_metrics')
      .select('timestamp, duration_ms, orders_processed, orders_corrected')
      .gte('timestamp', since.toISOString())
      .order('timestamp', { ascending: true });

    if (!hourlyStats || hourlyStats.length === 0) {
      console.log('  📭 Dados insuficientes para tendências');
      return;
    }

    // Agrupar por hora
    const hourlyGroups = new Map<string, any[]>();
    
    for (const stat of hourlyStats) {
      const hour = new Date(stat.timestamp).toISOString().slice(0, 13); // YYYY-MM-DDTHH
      
      if (!hourlyGroups.has(hour)) {
        hourlyGroups.set(hour, []);
      }
      hourlyGroups.get(hour)!.push(stat);
    }

    // Calcular médias por hora
    const hourlyAverages = Array.from(hourlyGroups.entries()).map(([hour, stats]) => {
      const avgDuration = stats.reduce((sum, s) => sum + s.duration_ms, 0) / stats.length;
      const totalProcessed = stats.reduce((sum, s) => sum + s.orders_processed, 0);
      const totalCorrected = stats.reduce((sum, s) => sum + s.orders_corrected, 0);
      
      return {
        hour,
        avgDuration: Math.round(avgDuration / 1000),
        totalProcessed,
        totalCorrected,
        executions: stats.length
      };
    });

    // Mostrar últimas 6 horas
    const recent = hourlyAverages.slice(-6);
    
    console.log('  🕐 Últimas horas (duração média):');
    for (const hourData of recent) {
      const hourLabel = new Date(hourData.hour + ':00:00Z').toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      console.log(`    ${hourLabel}: ${hourData.avgDuration}s (${hourData.executions} exec, ${hourData.totalProcessed}/${hourData.totalCorrected})`);
    }

  } catch (error) {
    console.log('  ❌ Erro ao calcular tendências:', error);
  }
}

function getSeverityEmoji(severity: string): string {
  switch (severity) {
    case 'low': return '🟡';
    case 'medium': return '🟠';
    case 'high': return '🔴';
    case 'critical': return '💀';
    default: return '⚪';
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}