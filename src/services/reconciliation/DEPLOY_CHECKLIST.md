# ✅ Checklist de Deploy - Agente de Reconciliação

## 📋 Pré-Deploy

### Ambiente e Dependências
- [ ] **Servidor de produção configurado** (Linux/Ubuntu recomendado)
- [ ] **Node.js v18+** instalado
- [ ] **PM2** instalado globalmente (`npm install -g pm2`)
- [ ] **Git** configurado com acesso ao repositório
- [ ] **Usuário de aplicação** criado (`useradd -m -s /bin/bash app`)
- [ ] **Diretórios criados** com permissões corretas:
  ```bash
  sudo mkdir -p /opt/querenhapuque
  sudo mkdir -p /opt/backups/querenhapuque
  sudo mkdir -p /var/log/reconciliation
  sudo chown -R app:app /opt/querenhapuque
  sudo chown -R app:app /opt/backups/querenhapuque
  ```

### Credenciais e Configuração
- [ ] **Supabase produção** configurado e acessível
- [ ] **AbacatePay produção** configurado e acessível
- [ ] **Arquivo .env** criado a partir do `.env.production.example`
- [ ] **Variáveis obrigatórias** configuradas:
  - [ ] `VITE_SUPABASE_URL`
  - [ ] `VITE_SUPABASE_ANON_KEY`
  - [ ] `ABACATEPAY_API_KEY`
- [ ] **Teste de conectividade** realizado:
  ```bash
  npm run reconciliation:test
  ```

### Banco de Dados
- [ ] **Tabelas criadas** no Supabase:
  - [ ] `reconciliation_audit`
  - [ ] `reconciliation_locks`
  - [ ] `reconciliation_metrics`
- [ ] **Índices criados** para performance:
  ```sql
  CREATE INDEX CONCURRENTLY idx_orders_pending_reconciliation 
  ON orders(status, created_at) WHERE status = 'pending';
  
  CREATE INDEX CONCURRENTLY idx_reconciliation_audit_execution 
  ON reconciliation_audit(execution_id, reconciled_at);
  
  CREATE INDEX CONCURRENTLY idx_reconciliation_metrics_timestamp 
  ON reconciliation_metrics(timestamp DESC);
  ```
- [ ] **Permissões RLS** configuradas adequadamente

## 🚀 Deploy

### Código e Dependências
- [ ] **Código clonado** no servidor:
  ```bash
  cd /opt/querenhapuque
  git clone https://github.com/seu-usuario/querenhapuque.git .
  ```
- [ ] **Dependências instaladas**:
  ```bash
  npm ci --production
  ```
- [ ] **Arquivo .env** copiado e configurado
- [ ] **Teste de execução única** realizado:
  ```bash
  npm run reconciliation:run
  ```

### PM2 Configuration
- [ ] **Arquivo ecosystem.config.js** configurado
- [ ] **Processo iniciado** com PM2:
  ```bash
  pm2 start ecosystem.config.js --env production
  ```
- [ ] **Configuração salva**:
  ```bash
  pm2 save
  pm2 startup
  ```
- [ ] **Status verificado**:
  ```bash
  pm2 status
  pm2 logs reconciliation-agent
  ```

### Alternativa Systemd (Opcional)
- [ ] **Service file** copiado:
  ```bash
  sudo cp scripts/reconciliation-agent.service /etc/systemd/system/
  ```
- [ ] **Service habilitado**:
  ```bash
  sudo systemctl daemon-reload
  sudo systemctl enable reconciliation-agent
  sudo systemctl start reconciliation-agent
  ```

## 🔍 Pós-Deploy

### Verificação Funcional
- [ ] **Processo rodando** sem erros:
  ```bash
  pm2 status reconciliation-agent
  ```
- [ ] **Logs sem erros críticos**:
  ```bash
  pm2 logs reconciliation-agent --lines 50
  ```
- [ ] **Primeira execução bem-sucedida** (aguardar 5 minutos)
- [ ] **Métricas sendo salvas** no banco:
  ```sql
  SELECT * FROM reconciliation_metrics ORDER BY timestamp DESC LIMIT 5;
  ```
- [ ] **Auditoria funcionando** (se houver pedidos para reconciliar):
  ```sql
  SELECT * FROM reconciliation_audit ORDER BY reconciled_at DESC LIMIT 5;
  ```

### Monitoramento
- [ ] **Script de monitoramento** testado:
  ```bash
  bash scripts/monitor-reconciliation.sh check
  ```
- [ ] **Alertas configurados** (Slack/email)
- [ ] **Logs estruturados** sendo gerados
- [ ] **Métricas de performance** coletadas

### Segurança
- [ ] **Permissões de arquivo** verificadas:
  ```bash
  chmod 600 .env
  chmod 755 src/services/reconciliation/
  ```
- [ ] **Firewall configurado** (se necessário)
- [ ] **Backup automático** configurado:
  ```bash
  # Adicionar ao crontab
  0 2 * * * tar -czf /opt/backups/reconciliation-config-$(date +\%Y\%m\%d).tar.gz /opt/querenhapuque/.env /opt/querenhapuque/ecosystem.config.js
  ```

## 📊 Validação Final

### Testes de Integração
- [ ] **Conectividade Supabase** OK
- [ ] **Conectividade AbacatePay** OK
- [ ] **Busca de pedidos pendentes** funcionando
- [ ] **Atualização de status** funcionando
- [ ] **Logging e métricas** funcionando

### Performance
- [ ] **Tempo de execução** < 3 minutos
- [ ] **Uso de memória** < 512MB
- [ ] **CPU usage** < 50%
- [ ] **Taxa de sucesso API** > 85%

### Alertas e Monitoramento
- [ ] **Alerta de processo parado** configurado
- [ ] **Alerta de execução falhando** configurado
- [ ] **Alerta de alta taxa de erro** configurado
- [ ] **Dashboard de métricas** (opcional)

## 🔧 Comandos Úteis

### Gerenciamento
```bash
# Status
pm2 status
pm2 logs reconciliation-agent
pm2 monit

# Restart
pm2 restart reconciliation-agent

# Stop/Start
pm2 stop reconciliation-agent
pm2 start reconciliation-agent

# Reload (zero downtime)
pm2 reload reconciliation-agent
```

### Troubleshooting
```bash
# Teste manual
npm run reconciliation:run

# Verificar configuração
npm run reconciliation:test

# Monitoramento
bash scripts/monitor-reconciliation.sh check

# Logs detalhados
pm2 logs reconciliation-agent --lines 100
```

### Backup e Rollback
```bash
# Deploy com backup automático
bash scripts/deploy-reconciliation.sh deploy

# Rollback para versão anterior
bash scripts/deploy-reconciliation.sh rollback

# Verificar saúde
bash scripts/deploy-reconciliation.sh health
```

## 🚨 Troubleshooting Comum

| Problema | Sintoma | Solução |
|----------|---------|---------|
| Processo não inicia | PM2 status "errored" | Verificar logs, variáveis de ambiente |
| Lock timeout | Execuções travando | Limpar `reconciliation_locks` |
| API rate limit | Muitos erros 429 | Aumentar `API_THROTTLE_MS` |
| Memória alta | Processo reiniciando | Reduzir `BATCH_SIZE` |
| Conectividade | Erros de rede | Verificar firewall, DNS |

## 📞 Contatos de Emergência

- **DevOps:** devops@querenhapuque.com
- **Backend:** backend@querenhapuque.com
- **Slack:** #reconciliation-alerts
- **Documentação:** [README.md](./README.md)

---

**✅ Deploy Concluído com Sucesso!**

Após completar todos os itens deste checklist, o Agente de Reconciliação estará rodando em produção com alta disponibilidade e monitoramento adequado.