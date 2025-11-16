# 📖 Documentação Coolify Admin

Documentação completa do servidor Coolify Admin na Hetzner Cloud.

## 📋 Índice

### 🔐 Credenciais e Acessos
- **[CREDENCIAIS_ACESSO.md](CREDENCIAIS_ACESSO.md)** - Todas as senhas, tokens e acessos
  - Login web do Coolify
  - Acesso SSH ao servidor
  - Tokens de API (Hetzner e Coolify)
  - Chaves SSH configuradas
  - URLs de gerenciamento

### ✅ Configuração Completa
- **[CONFIGURACAO_COMPLETA.md](CONFIGURACAO_COMPLETA.md)** - Resumo da implementação
  - Status da configuração
  - Funcionalidades disponíveis
  - Próximos passos
  - Links úteis

## 🎯 Acesso Rápido

### 🌐 Painel Web
**URL:** https://coolify-admin.ouvir.online
- Email: `fotosartdesign@gmail.com`
- Senha: `Sampa1503001$`

### 🖥️ Acesso SSH
```bash
ssh root@49.12.204.185
# Senha: TxWf3TUwHkUR
```

### 🔗 Links Principais
- **Dashboard:** https://coolify-admin.ouvir.online
- **Servidor VPS:** https://coolify-admin.ouvir.online/server/j8skk40s4ks048coog8gw08c
- **Projetos:** https://coolify-admin.ouvir.online/projects
- **Hetzner Console:** https://console.hetzner.com/projects/12020010/servers/110118995

## 📊 Informações do Servidor

- **Nome:** VPS-Hetzner-Production (Collify-admin)
- **IP:** 49.12.204.185
- **Localização:** Nuremberg, Germany
- **Tipo:** cx32 (4 vCPU, 8 GB RAM, 80 GB Disk)
- **Status:** ✅ Operacional

## 🔧 Serviços Ativos

- ✅ **Docker Engine** - Gerenciamento de containers
- ✅ **Coolify** - Plataforma de deploy
- ✅ **Traefik Proxy** - Proxy reverso (configurado)
- ✅ **Sentinel** - Monitoramento e métricas

## 🚀 Funcionalidades

### Deploy de Aplicações
- Docker Compose
- Repositórios Git
- Imagens Docker
- Builds customizados

### Gerenciamento
- Banco de dados (PostgreSQL, MySQL, MongoDB, etc.)
- Volumes persistentes
- Backups automáticos
- Logs centralizados
- Métricas e monitoramento

### Rede
- Proxy reverso automático
- Certificados SSL/TLS (Let's Encrypt)
- Domínios customizados
- Load balancing

## 📚 Documentação Adicional

### Hetzner
Toda a documentação relacionada ao servidor Hetzner está em: `../hetzner/`
- Configurações SSH
- Comandos rápidos
- Informações de login

### Coolify Oficial
- **Documentação:** https://coolify.io/docs
- **API Reference:** https://coolify.io/docs/api
- **Knowledge Base:** https://coolify.io/docs/knowledge-base

## ⚠️ Segurança

🔒 **IMPORTANTE:**
- Arquivo `CREDENCIAIS_ACESSO.md` contém informações sensíveis
- **NÃO compartilhe** em repositórios públicos
- Mantenha backups em local seguro
- Altere senhas periodicamente
- Use autenticação de dois fatores quando possível

## 🆘 Suporte

### Problemas Comuns

1. **Não consigo fazer login no Coolify**
   - Verifique as credenciais em `CREDENCIAIS_ACESSO.md`
   - Limpe o cache do navegador
   - Tente em modo anônimo

2. **Servidor não responde**
   - Verifique status no Hetzner Console
   - Teste conectividade: `ping 49.12.204.185`
   - Acesse via console web da Hetzner

3. **Deploy falhando**
   - Verifique logs no Coolify
   - Confirme que o Docker está rodando
   - Verifique espaço em disco

### Contatos

- **Hetzner Support:** https://console.hetzner.com/support
- **Coolify Discord:** https://coollabs.io/discord
- **Coolify GitHub:** https://github.com/coollabsio/coolify

---

**Última Atualização:** 16/11/2025
**Versão:** 1.0
**Status:** ✅ Documentação Completa

