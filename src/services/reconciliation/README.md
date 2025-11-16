# Agente de Reconciliação AbacatePay <> Supabase

## 📋 Visão Geral

O Agente de Reconciliação é uma ferramenta crítica de backend que garante integridade dos dados de pagamento entre AbacatePay e Supabase. Atua como fallback robusto para Webhooks, corrigindo status de pedidos pendentes e garantindo fidelidade dos dashboards.

## 🎯 Objetivos

- **Integridade:** Eliminar inconsistências onde pedido está 'pending' no Supabase mas 'paid'/'expired' no AbacatePay
- **Fidelidade:** Garantir dashboards de Tickets e Roupas exibam apenas vendas confirmadas
- **Automação:** Disparar fulfillment para pedidos pagos não processados por Webhook
- **Robustez:** Implementar retry, monitoramento e logging para alta disponibilidade

## 🏗️ Arquitetura

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Scheduler     │───▶│ Reconciliation  │───▶│   Supabase      │
│   (Cron Job)    │    │     Agent       │    │   Database      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   AbacatePay    │
                       │      API        │
                       └─────────────────┘
```

## 📁 Estrutura de Arquivos

```
src/services/reconciliation/
├── index.ts          # Classe principal ReconciliationAgent
├── scheduler.ts      # Scheduler com cron job
├── runner.ts         # Script de execução manual
├── config.ts         # Configurações centralizadas
├── types.ts          # Tipos TypeScript
├── test.ts           # Scripts de teste
└── README.md         # Esta documentação
```

## ⚙️ Configuração

### Variáveis de Ambiente

```env
# Supabase
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anonima

# AbacatePay
VITE_ABACATEPAY_API_URL=https://api.abacatepay.com
VITE_ABACATEPAY_API_KEY=sua-chave-api

# Opcional
NODE_ENV=production
```

### Configurações Principais

| Configuração | Valor Padrão | Descrição |
|--------------|--------------|-----------|
| `BATCH_SIZE` | 100 | Máximo de pedidos por execução |
| `TIMEOUT_MS` | 4 minutos | Timeout total da execução |
| `MAX_RETRIES` | 3 | Tentativas de retry para API |
| `PENDING_ORDER_AGE_HOURS` | 1 | Idade mínima de pedidos pendentes |

## 🔄 Algoritmo de Reconciliação

### Passo 1: Busca Pendências
```sql
SELECT * FROM orders 
WHERE status = 'pending' 
  AND created_at < NOW() - INTERVAL '1 hour'
LIMIT 100;
```

### Passo 2: Consulta AbacatePay
- Para cada `charge_id`: consultar status real
- Retry: 3 tentativas com backoff exponencial
- Circuit Breaker: Parar se >50% falhas API
- Throttling: 100ms entre chamadas

### Passo 3: Atualização Transacional
- **Se 'paid':** Atualizar status, criar tickets
- **Se 'expired'/'cancelled':** Atualizar status, liberar estoque
- **Auditoria:** Registrar em `reconciliation_audit`

## 🚀 Uso

### Execução Manual

```bash
# Execução única
npm run reconciliation:run

# Ou usando Node.js diretamente
node src/services/reconciliation/runner.js
```

### Scheduler Automático

```bash
# Iniciar scheduler (executa a cada 5 minutos)
npm run reconciliation:start

# Ou usando Node.js diretamente
node src/services/reconciliation/scheduler.js
```

### Testes

```bash
# Executar todos os testes
npm run reconciliation:test

# Testar apenas conectividade
npm run reconciliation:test connectivity

# Usar script de teste diretamente
node src/services/reconciliation/test.js
```

## 📊 Monitoramento

### Métricas Coletadas

- **Tempo de execução:** Duração total do processo
- **Pedidos processados:** Quantidade de pedidos verificados
- **Taxa de sucesso API:** Percentual de chamadas bem-sucedidas
- **Atualizações realizadas:** Pedidos com status corrigido

### Logging

```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "level": "info",
  "message": "Reconciliação concluída",
  "executionId": "uuid-123",
  "ordersProcessed": 45,
  "ordersUpdated": 3,
  "duration": 2500
}
```

### Alertas

- **Execução falhando >15min:** Problema crítico
- **Erro API >10%:** Instabilidade AbacatePay
- **Pedidos pendentes crescendo:** Possível problema sistêmico

## 🗄️ Estrutura de Dados

### Tabela `reconciliation_audit`

```sql
CREATE TABLE reconciliation_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id),
    charge_id TEXT,
    old_status TEXT,
    new_status TEXT,
    reconciled_at TIMESTAMP DEFAULT NOW(),
    execution_id UUID
);
```

### Tabela `reconciliation_locks`

```sql
CREATE TABLE reconciliation_locks (
    id TEXT PRIMARY KEY DEFAULT 'singleton',
    locked_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP
);
```

### Tabela `reconciliation_metrics`

```sql
CREATE TABLE reconciliation_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID,
    timestamp TIMESTAMP DEFAULT NOW(),
    duration_ms INTEGER,
    orders_processed INTEGER,
    orders_corrected INTEGER,
    errors_count INTEGER,
    api_calls_count INTEGER,
    api_success_rate NUMERIC,
    metadata JSONB
);
```

## 🔧 Desenvolvimento

### Adicionando Nova Funcionalidade

1. **Atualizar tipos** em `types.ts`
2. **Modificar configuração** em `config.ts`
3. **Implementar lógica** em `index.ts`
4. **Adicionar testes** em `test.ts`
5. **Atualizar documentação**

### Debugging

```bash
# Executar com logs detalhados
NODE_ENV=development node src/services/reconciliation/test.js

# Verificar logs
tail -f logs/reconciliation.log
```

## 🚨 Troubleshooting

### Problemas Comuns

| Problema | Causa | Solução |
|----------|-------|---------|
| Lock timeout | Execução anterior travou | Limpar tabela `reconciliation_locks` |
| API rate limit | Muitas chamadas simultâneas | Aumentar `API_THROTTLE_MS` |
| Circuit breaker aberto | Alta taxa de erro API | Verificar conectividade AbacatePay |

### Comandos Úteis

```sql
-- Verificar locks ativos
SELECT * FROM reconciliation_locks;

-- Limpar locks expirados
DELETE FROM reconciliation_locks WHERE expires_at < NOW();

-- Verificar últimas execuções
SELECT * FROM reconciliation_metrics ORDER BY timestamp DESC LIMIT 10;

-- Verificar auditoria recente
SELECT * FROM reconciliation_audit ORDER BY reconciled_at DESC LIMIT 20;
```

## 📈 Métricas de Sucesso

- **Taxa Reconciliação:** 100% pedidos >1h pendentes corrigidos
- **Tempo Execução:** <3 minutos
- **Taxa Erro:** <5% falhas API
- **Disponibilidade:** >99.5% execuções bem-sucedidas

## 🔒 Segurança

- **Credenciais:** Armazenadas em variáveis de ambiente
- **Logs:** Não expõem dados sensíveis
- **API Keys:** Nunca logadas ou expostas
- **Transações:** Atômicas para garantir consistência

## 📝 Changelog

### v2.1 (Atual)
- ✅ Implementação completa do agente
- ✅ Circuit breaker para APIs
- ✅ Logging estruturado
- ✅ Métricas detalhadas
- ✅ Testes automatizados

### Próximas Versões
- 🔄 Dashboard de monitoramento
- 🔄 Alertas via email/Slack
- 🔄 Métricas em tempo real
- 🔄 Auto-scaling baseado em carga

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature
3. Implemente com testes
4. Atualize documentação
5. Submeta Pull Request

## 📞 Suporte

Para dúvidas ou problemas:
- 📧 Email: suporte@querenhapuque.com
- 📱 Slack: #backend-reconciliation
- 🐛 Issues: GitHub Issues