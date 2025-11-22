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
**URL:** https://coolify.querenhapuque.com/
- Credenciais: consulte `CREDENCIAIS_ACESSO.md`

### 🖥️ Acesso SSH
```bash
ssh -i C:\Users\Anderson\.ssh\vps-deploy-key-ed25519 root@49.12.204.185
```
Observação: autenticação por chave pública ativa; senhas desativadas.

## 🔐 Acesso via SSH — Guia Completo

### Direto (chave pública)
- Pré-requisito: chave privada em `C:\Users\Anderson\.ssh\vps-deploy-key-ed25519` e chave pública correspondente no servidor (`~/.ssh/authorized_keys`).
- Conexão:
```bash
ssh -i C:\Users\Anderson\.ssh\vps-deploy-key-ed25519 root@49.12.204.185
```
- Verificações úteis:
```bash
whoami && hostname
fail2ban-client status sshd
```

### Por dentro do Coolify (Terminal Web)
- Caminho: `Servers → VPS-Hetzner-Production → Terminal → Connect`.
- Executa comandos no host via SSH usando a chave do Coolify.
- Exemplos:
```bash
tail -n 5 ~/.ssh/authorized_keys
grep -E '^PubkeyAuthentication|^PasswordAuthentication' /etc/ssh/sshd_config
```

### Configuração opcional de SSH (Windows OpenSSH)
Arquivo: `C:\Users\Anderson\.ssh\config`
```
Host vps-hetzner
  HostName 49.12.204.185
  User root
  IdentityFile C:\Users\Anderson\.ssh\vps-deploy-key-ed25519
  IdentitiesOnly yes
```
Uso:
```bash
ssh vps-hetzner
```

### Troubleshooting
- `Permission denied (publickey)`: verifique se sua chave pública está em `~/.ssh/authorized_keys` e permissões (dir `700`, arquivo `600`).
- Bloqueio por `fail2ban`: confira `fail2ban-client status sshd`; se necessário, desbanir seu IP com `fail2ban-client unban <SEU_IP>`.
- Checar logs: `tail -n 50 /var/log/auth.log`.

### 🔗 Links Principais
- **Dashboard:** https://coolify.querenhapuque.com/
- **Servidor VPS:** https://coolify.querenhapuque.com/server/j8skk40s4ks048coog8gw08c
- **Projetos:** https://coolify.querenhapuque.com/projects
- **Hetzner Console:** https://console.hetzner.com/projects/12020010/servers/110118995

## 📊 Informações do Servidor

- **Nome:** VPS-Hetzner-Production (Collify-admin)
- **IP:** 49.12.204.185
- **Localização:** Nuremberg, Germany
- **Tipo:** cx32 (4 vCPU, 8 GB RAM, 80 GB Disk)
- **Status:** ✅ Operacional

### Segurança SSH e Fail2Ban
- Chaves ativas em `~/.ssh/authorized_keys`:
  - `ssh-ed25519 ... coolify`
  - `ssh-ed25519 ... hetzner-server-access`
  - `ssh-ed25519 ... vps-deploy-key-ed25519`
- `fail2ban` instalado e ativo com jail `sshd`.
- Verificação rápida:
  - `fail2ban-client status sshd`
  - `tail -n 50 /var/log/auth.log`

## 🔧 Serviços Ativos

- ✅ **Docker Engine** - Gerenciamento de containers
- ✅ **Coolify** - Plataforma de deploy
- ✅ **Proxy** - Configurado e gerenciável via Coolify
- ✅ **Sentinel** - Monitoramento e métricas

## 🚀 Funcionalidades

### Deploy de Aplicações
- Docker Compose
- Repositórios Git
- Imagens Docker
- Builds customizados

### 🚀 Deploy da APP‑QUEREN (GHCR + Coolify)

- Local: `npm run dev` → `npm run build` → `npm run preview` com `VITE_*` definidos.
- Push: `git push origin main` dispara `/.github/workflows/deploy-coolify.yml`.
- Build: imagem publicada em `ghcr.io/<owner>/borboleta-eventos-loja` com tags `latest` e `${SHA}`;
  - owner normalizado em minúsculas no workflow.
- Redeploy: Coolify aciona via webhook `COOLIFY_DEPLOY_URL` (Authorization Bearer opcional com `COOLIFY_API_TOKEN`).
- Produção: aplicação Docker Image no projeto “Site Queren Rapuque” entrega via proxy em `https://app.querenhapuque.com`.
- Healthcheck: habilitado (GET `/`) no recurso; aguardar status `Healthy`.
- Rollback: rodar o workflow manual com `inputs.tag` (SHA) ou trocar a `Tag` no recurso Docker Image e redeploy.

Referências detalhadas:
- `docs/app-queren/README.md` — Guia completo do fluxo Local → Produção
- `docs/app-queren/CHECKLIST.md` — Checklist operacional e validação

### Gerenciamento
- Banco de dados (PostgreSQL, MySQL, MongoDB, etc.)
- Volumes persistentes
- Backups automáticos
- Logs centralizados
- Métricas e monitoramento

### Acesso Hetzner via Coolify
- Navegue até: `Servers → VPS-Hetzner-Production → Terminal`.
- O terminal web conecta no servidor e permite comandos administrativos.

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
- Prefira autenticação por chave pública (Ed25519)
- Fail2Ban ativo protegendo o SSH

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
**Status:** ✅ Documentação atualizada com acesso por chave e endurecimento de SSH

