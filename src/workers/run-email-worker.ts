import { startEmailOutboxWorker } from './emailOutboxWorker'

console.log('[email-worker] iniciando processamento de outbox...')
startEmailOutboxWorker()
console.log('[email-worker] worker ativo: processamento a cada 15s')

setInterval(() => {
  // manter processo vivo
}, 60_000)