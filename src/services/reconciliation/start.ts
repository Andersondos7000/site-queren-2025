import { scheduler } from './scheduler.js';
import winston from 'winston';

// Configuração do logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Iniciar o scheduler
scheduler.start();
logger.info('🎯 Agente de Reconciliação ativado em modo contínuo');
logger.info('⏰ Execução programada a cada 5 minutos');
logger.info('🔄 Para parar o agente, use Ctrl+C');

// Manter o processo vivo
const keepAlive = setInterval(() => {
  // Heartbeat silencioso para manter o processo ativo
}, 30000);

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('🛑 Parando agente de reconciliação...');
  scheduler.stop();
  clearInterval(keepAlive);
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('🛑 Parando agente de reconciliação...');
  scheduler.stop();
  clearInterval(keepAlive);
  process.exit(0);
});

// Log do status inicial
const status = scheduler.getStatus();
logger.info(`📊 Status: ${status.running ? 'Ativo' : 'Inativo'} | Agendado: ${status.scheduled ? 'Sim' : 'Não'}`);