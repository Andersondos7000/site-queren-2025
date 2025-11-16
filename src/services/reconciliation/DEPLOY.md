# 🚀 Guia de Deploy - Agente de Reconciliação

## 📋 Pré-requisitos

### Ambiente de Produção
- **Node.js:** v18+ ou v20+
- **PM2:** Para gerenciamento de processos
- **Servidor:** Linux/Ubuntu recomendado
- **Memória:** Mínimo 512MB RAM
- **CPU:** 1 vCore suficiente

### Credenciais Necessárias
- **Supabase:** URL e chave anônima do projeto de produção
- **AbacatePay:** Chave API de produção
- **Logs:** Diretório com permissões de escrita

## 🔧 Configuração do Ambiente

### 1. Variáveis de Ambiente (.env.production)

```env
# Ambiente
NODE_ENV=production
LOG_LEVEL=info

# Supabase (PRODUÇÃO)
VITE_SUPABASE_URL=https://seu-projeto-prod.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anonima-prod

# AbacatePay (PRODUÇÃO)
ABACATEPAY_API_KEY=abc_prod_sua-chave-producao
ABACATEPAY_BASE_URL=https://api.abacatepay.com/v1

# Configurações de Performance
RECONCILIATION_BATCH_SIZE=50
RECONCILIATION_TIMEOUT_MS=240000
RECONCILIATION_MAX_RETRIES=3
```

### 2. Estrutura de Diretórios

```bash
/opt/querenhapuque/
├── src/services/reconciliation/
├── logs/
├── .env.production
├── package.json
└── ecosystem.config.js
```

## 📦 Instalação

### 1. Clonar e Instalar Dependências

```bash
# Clonar repositório
git clone https://github.com/seu-usuario/querenhapuque.git
cd querenhapuque

# Instalar dependências
npm ci --production

# Instalar PM2 globalmente
npm install -g pm2
```

### 2. Configurar PM2

Criar arquivo `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'reconciliation-agent',
    script: 'src/services/reconciliation/scheduler.ts',
    interpreter: 'tsx',
    env: {
      NODE_ENV: 'production'
    },
    env_production: {
      NODE_ENV: 'production'
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    error_file: './logs/reconciliation-error.log',
    out_file: './logs/reconciliation-out.log',
    log_file: './logs/reconciliation-combined.log',
    time: true,
    merge_logs: true,
    cron_restart: '0 4 * * *' // Restart diário às 4h
  }]
};
```

## 🚀 Deploy

### 1. Deploy Inicial

```bash
# Copiar arquivo de ambiente
cp .env.production .env

# Testar configuração
npm run reconciliation:test

# Executar uma vez para validar
npm run reconciliation:run

# Iniciar com PM2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

### 2. Verificar Status

```bash
# Status do processo
pm2 status

# Logs em tempo real
pm2 logs reconciliation-agent

# Monitoramento
pm2 monit
```

## 📊 Monitoramento

### 1. Logs de Sistema

```bash
# Logs do agente
tail -f /opt/querenhapuque/logs/reconciliation-combined.log

# Logs de erro
tail -f /opt/querenhapuque/logs/reconciliation-error.log
```

### 2. Métricas no Banco

```sql
-- Últimas execuções
SELECT 
  execution_id,
  timestamp,
  duration_ms,
  orders_processed,
  orders_corrected,
  errors_count,
  api_success_rate
FROM reconciliation_metrics 
ORDER BY timestamp DESC 
LIMIT 10;

-- Performance nas últimas 24h
SELECT 
  DATE_TRUNC('hour', timestamp) as hour,
  COUNT(*) as executions,
  AVG(duration_ms) as avg_duration,
  SUM(orders_processed) as total_processed,
  SUM(orders_corrected) as total_corrected,
  AVG(api_success_rate) as avg_success_rate
FROM reconciliation_metrics 
WHERE timestamp > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;
```

### 3. Alertas Recomendados

Configure alertas para:
- **Processo parado:** PM2 não está rodando
- **Execução falhando:** >15 minutos sem execução
- **Alta taxa de erro:** >10% falhas API
- **Memória alta:** >80% uso de RAM
- **Pedidos pendentes crescendo:** Backlog aumentando

## 🔄 Atualizações

### 1. Deploy de Nova Versão

```bash
# Backup do código atual
cp -r /opt/querenhapuque /opt/querenhapuque.backup.$(date +%Y%m%d)

# Atualizar código
git pull origin main
npm ci --production

# Testar nova versão
npm run reconciliation:test

# Restart com zero downtime
pm2 reload reconciliation-agent
```

### 2. Rollback

```bash
# Parar processo atual
pm2 stop reconciliation-agent

# Restaurar backup
rm -rf /opt/querenhapuque
mv /opt/querenhapuque.backup.YYYYMMDD /opt/querenhapuque

# Reiniciar
pm2 start reconciliation-agent
```

## 🛠️ Troubleshooting

### Problemas Comuns

| Problema | Sintoma | Solução |
|----------|---------|---------|
| Processo não inicia | PM2 status "errored" | Verificar logs de erro, variáveis de ambiente |
| Lock timeout | Execuções travando | Limpar tabela `reconciliation_locks` |
| API rate limit | Muitos erros 429 | Aumentar `API_THROTTLE_MS` |
| Memória alta | Processo reiniciando | Reduzir `BATCH_SIZE` |

### Comandos de Diagnóstico

```bash
# Verificar conectividade Supabase
npm run reconciliation:test connectivity

# Limpar locks expirados
npm run reconciliation:test cleanup

# Verificar últimas métricas
npm run reconciliation:test metrics

# Teste completo
npm run reconciliation:test full
```

### Limpeza Manual

```sql
-- Limpar locks expirados
DELETE FROM reconciliation_locks WHERE expires_at < NOW();

-- Verificar pedidos órfãos
SELECT COUNT(*) FROM orders 
WHERE status = 'pending' 
  AND created_at < NOW() - INTERVAL '2 hours'
  AND id NOT IN (SELECT order_id FROM abacatepay_charges);
```

## 📈 Otimizações de Performance

### 1. Configurações Recomendadas por Ambiente

**Desenvolvimento:**
```env
RECONCILIATION_BATCH_SIZE=10
RECONCILIATION_TIMEOUT_MS=60000
API_THROTTLE_MS=500
```

**Produção (Baixo Volume):**
```env
RECONCILIATION_BATCH_SIZE=50
RECONCILIATION_TIMEOUT_MS=240000
API_THROTTLE_MS=100
```

**Produção (Alto Volume):**
```env
RECONCILIATION_BATCH_SIZE=100
RECONCILIATION_TIMEOUT_MS=300000
API_THROTTLE_MS=50
```

### 2. Índices de Banco Recomendados

```sql
-- Índice para busca de pedidos pendentes
CREATE INDEX CONCURRENTLY idx_orders_pending_reconciliation 
ON orders(status, created_at) 
WHERE status = 'pending';

-- Índice para auditoria
CREATE INDEX CONCURRENTLY idx_reconciliation_audit_execution 
ON reconciliation_audit(execution_id, reconciled_at);

-- Índice para métricas
CREATE INDEX CONCURRENTLY idx_reconciliation_metrics_timestamp 
ON reconciliation_metrics(timestamp DESC);
```

## 🔒 Segurança

### 1. Permissões de Arquivo

```bash
# Definir permissões corretas
chmod 600 .env.production
chmod 755 src/services/reconciliation/
chmod 755 logs/
chown -R app:app /opt/querenhapuque
```

### 2. Firewall

```bash
# Permitir apenas conexões necessárias
ufw allow ssh
ufw allow from 10.0.0.0/8 to any port 3000  # Se houver API interna
ufw enable
```

### 3. Backup de Configuração

```bash
# Backup diário das configurações
0 2 * * * tar -czf /backup/reconciliation-config-$(date +\%Y\%m\%d).tar.gz /opt/querenhapuque/.env.production /opt/querenhapuque/ecosystem.config.js
```

## 📞 Suporte

### Contatos de Emergência
- **DevOps:** devops@querenhapuque.com
- **Backend:** backend@querenhapuque.com
- **Slack:** #reconciliation-alerts

### Documentação Adicional
- [README.md](./README.md) - Documentação técnica
- [Monitoring Guide](../../docs/MONITORING.md) - Guia de monitoramento
- [API Documentation](./API.md) - Documentação da API

---

**✅ Checklist de Deploy:**

- [ ] Variáveis de ambiente configuradas
- [ ] Dependências instaladas
- [ ] PM2 configurado
- [ ] Teste de conectividade passou
- [ ] Processo iniciado com PM2
- [ ] Logs sendo gerados
- [ ] Métricas sendo salvas
- [ ] Alertas configurados
- [ ] Backup configurado
- [ ] Documentação atualizada