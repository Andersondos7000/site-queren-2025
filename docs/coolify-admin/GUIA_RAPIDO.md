# ⚡ GUIA RÁPIDO - COOLIFY ADMIN

## 🚀 ACESSO IMEDIATO

### Login Web
1. Acesse: https://coolify-admin.ouvir.online
2. Credenciais: consulte `CREDENCIAIS_ACESSO.md`

### SSH Direto (chave pública)
```bash
ssh -i C:\Users\Anderson\.ssh\vps-deploy-key-ed25519 root@49.12.204.185
```

---

## 📱 AÇÕES RÁPIDAS

### 1. Ver Projetos Existentes
1. Login no Coolify
2. Menu lateral → **"Projects"**
3. Selecione **"N8N-ADM"**

### 2. Fazer Deploy de Nova Aplicação
1. **Projects** → **+ New**
2. Escolha o tipo:
   - Git Repository
   - Docker Image
   - Docker Compose
3. Configure e clique em **"Deploy"**

### 3. Iniciar o Proxy (Se Necessário)
1. **Servers** → **VPS-Hetzner-Production**
2. Clique em **"Start Proxy"**
3. Aguarde ativação

### 4. Acessar Terminal do Servidor
1. **Servers** → **VPS-Hetzner-Production**
2. Aba **"Terminal"**
3. Terminal web disponível
4. Recomendações:
   - Adicione chaves públicas em `~/.ssh/authorized_keys`
   - Evite uso de senha; mantenha `PasswordAuthentication no`

### 5. Ver Métricas e Logs
1. **Servers** → **VPS-Hetzner-Production**
2. Aba **"Metrics"** para métricas
3. Aba **"Resources"** para ver aplicações rodando

---

## 💾 BANCOS DE DADOS

### Criar Novo Banco de Dados
1. **Databases** → **+ New Database**
2. Escolha o tipo:
   - PostgreSQL
   - MySQL
   - MariaDB
   - MongoDB
   - Redis
3. Configure credenciais
4. **Deploy**

---

## 🔧 COMANDOS SSH ÚTEIS

### Ver Containers Rodando
```bash
docker ps
```

### Ver Logs de Um Container
```bash
docker logs <container-name>
```

### Ver Uso de Disco
```bash
df -h
```

### Ver Uso de Memória
```bash
free -h
```

### Limpar Recursos Docker
```bash
docker system prune -a
```

### Reiniciar Docker
```bash
systemctl restart docker
```

---

## 📊 MONITORAMENTO

### Ver Status do Servidor
**URL:** https://coolify-admin.ouvir.online/server/j8skk40s4ks048coog8gw08c

Informações disponíveis:
- ✅ Status da conexão
- 📊 Uso de CPU
- 💾 Uso de RAM
- 💿 Uso de Disco
- 🌐 Tráfego de rede

### Verificar Logs do Sentinel
1. **Servers** → **VPS-Hetzner-Production**
2. Seção **"Sentinel"**
3. Clique em **"Logs"**

---

## 🔐 SEGURANÇA

### Chaves SSH no servidor
- Local: `~/.ssh/authorized_keys`
- Ativas: `coolify`, `hetzner-server-access`, `vps-deploy-key-ed25519`

### Fail2Ban
- Status da jail `sshd`:
```bash
sudo fail2ban-client status sshd
```
- Logs:
```bash
sudo tail -n 50 /var/log/auth.log
```
### Ver Tokens de API
**URL:** https://coolify-admin.ouvir.online/security/api-tokens

### Criar Novo Token de API
1. **Security** → **API Tokens**
2. **+ Add**
3. Defina nome e permissões
4. **Save** e copie o token

---

## 🌐 DOMÍNIOS E SSL

### Configurar Domínio para Aplicação
1. Acesse a aplicação no Coolify
2. Aba **"Domains"**
3. Adicione o domínio (ex: `app.ouvir.online`)
4. **Save**
5. SSL é configurado automaticamente

### Configurar Wildcard Domain
1. **Servers** → **VPS-Hetzner-Production**
2. Campo **"Wildcard Domain"**
3. Digite: `*.ouvir.online`
4. **Save**

---

## 🔄 BACKUPS

### Configurar Backup Automático
1. Acesse a aplicação/banco de dados
2. Aba **"Backups"**
3. **+ Schedule Backup**
4. Configure frequência
5. **Save**

### Fazer Backup Manual
1. Acesse a aplicação/banco de dados
2. Aba **"Backups"**
3. **Backup Now**

---

## 🛠️ TROUBLESHOOTING

### Aplicação não inicia
```bash
# Via SSH
docker logs <container-name>

# Via Coolify
Application → Logs
```

### Sem espaço em disco
```bash
# Limpar Docker
docker system prune -a -f

# Via Coolify
Server → Docker Cleanup → Run Cleanup
```

### Proxy não funciona
1. **Servers** → **VPS-Hetzner-Production**
2. Aba **"Proxy"**
3. **Restart Proxy**

### Sentinel desconectado
1. **Servers** → **VPS-Hetzner-Production**
2. Seção **"Sentinel"**
3. **Restart**

---

## 📞 LINKS ÚTEIS

| Recurso | URL |
|---------|-----|
| Dashboard | https://coolify-admin.ouvir.online |
| Servidor VPS | https://coolify-admin.ouvir.online/server/j8skk40s4ks048coog8gw08c |
| Projetos | https://coolify-admin.ouvir.online/projects |
| Servidores | https://coolify-admin.ouvir.online/servers |
| Segurança | https://coolify-admin.ouvir.online/security |
| Hetzner Console | https://console.hetzner.com/projects/12020010/servers/110118995 |

---

## 🎯 WORKFLOWS COMUNS

### Deploy de Aplicação Node.js
1. **Projects** → **+ New Project**
2. **Git Source** → Cole URL do repositório
3. **Build Pack:** Node.js
4. Configure variáveis de ambiente
5. **Deploy**

### Deploy com Docker Compose
1. **Projects** → **+ New Resource**
2. **Docker Compose**
3. Cole seu `docker-compose.yml`
4. **Deploy**

### Criar API REST
1. **Databases** → **+ New Database** (PostgreSQL)
2. **Projects** → **+ New Project** (Backend)
3. Configure conexão com banco
4. **Deploy**

---

**Dica:** Salve esta página nos favoritos para acesso rápido!

