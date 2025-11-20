# 🌐 Deploy no Servidor - Querenhapuque Docker

## 📋 Visão Geral

Este guia mostra como fazer o deploy da aplicação Querenhapuque no servidor Hetzner usando Docker.

## 🎯 Informações do Servidor

**Servidor de Produção:**
- **IP:** 95.217.7.167
- **Provedor:** Hetzner Cloud
- **Nome:** Querenhapuque-Production
- **Usuário:** root
- **Senha:** (Não fornecida pela Hetzner)

**Servidor Coolify Admin:**
- **IP:** 49.12.204.185
- **URL:** https://coolify.querenhapuque.com/
- **Usuário:** fotosartdesign@gmail.com
- **Senha:** Sampa1503001$

## 🚀 Opção 1: Deploy via Coolify (Recomendado)

### Passo 1: Acessar Coolify Admin

1. Acesse: https://coolify.querenhapuque.com/
2. Faça login com as credenciais acima

### Passo 2: Configurar Build Type

1. Vá para **Projetos** > **Querenhapuque**
2. Clique na aplicação **doninha-de-olhos-grandes-l4gkcc80wgs880g8k0w880sg**
3. Vá para **Configuração**
4. Em **"Pacote de Construção"**, selecione **"Dockerfile"**
5. Clique em **"Salvar"**

### Passo 3: Configurar Porta

1. Na mesma página de Configuração
2. Em **"Portas expõem"**, altere para: `80`
3. Clique em **"Salvar"**

### Passo 4: Deploy

1. Clique no botão **"Reimplante"** (Redeploy)
2. Aguarde o build completar (~3-5 minutos)
3. Verifique os logs em tempo real

### Passo 5: Verificar

1. Acesse a URL da aplicação (fornecida pelo Coolify)
2. Verifique se a aplicação React está carregando
3. Teste as rotas principais

## 🔧 Opção 2: Deploy via SSH Manual

### Pré-requisitos

- Acesso SSH ao servidor
- Docker e Docker Compose instalados no servidor
- Repositório Git configurado

### Passo 1: Conectar ao Servidor

```bash
# Via senha (se disponível)
ssh root@95.217.7.167

# Via chave SSH
ssh -i ~/.ssh/vps-deploy-key-ed25519 root@95.217.7.167
```

### Passo 2: Preparar Ambiente

```bash
# Atualizar sistema
apt update && apt upgrade -y

# Instalar Docker (se necessário)
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Instalar Docker Compose (se necessário)
apt install docker-compose-plugin -y

# Verificar instalação
docker --version
docker compose version
```

### Passo 3: Clonar Repositório

```bash
# Criar diretório
mkdir -p /var/www
cd /var/www

# Clonar repositório
git clone https://github.com/Andersondos7000/site-queren-2025.git querenhapuque
cd querenhapuque

# Verificar branch
git branch
```

### Passo 4: Configurar Variáveis de Ambiente (Opcional)

```bash
# Criar arquivo .env
nano .env

# Adicionar variáveis (se necessário)
NODE_ENV=production
VITE_SUPABASE_URL=sua_url
VITE_SUPABASE_ANON_KEY=sua_chave
```

### Passo 5: Build e Deploy

```bash
# Build da imagem
docker compose build

# Iniciar aplicação
docker compose up -d

# Verificar status
docker compose ps

# Ver logs
docker compose logs -f
```

### Passo 6: Configurar Nginx Reverso (Opcional)

Se quiser usar um domínio próprio:

```bash
# Instalar Nginx
apt install nginx -y

# Criar configuração
nano /etc/nginx/sites-available/querenhapuque

# Adicionar configuração:
server {
    listen 80;
    server_name seu-dominio.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# Ativar site
ln -s /etc/nginx/sites-available/querenhapuque /etc/nginx/sites-enabled/

# Testar configuração
nginx -t

# Recarregar Nginx
systemctl reload nginx
```

### Passo 7: Configurar SSL (Opcional)

```bash
# Instalar Certbot
apt install certbot python3-certbot-nginx -y

# Obter certificado
certbot --nginx -d seu-dominio.com

# Renovação automática já está configurada
```

## 🔄 Atualização da Aplicação

### Via Coolify

1. Faça push das alterações para o GitHub
2. No Coolify, clique em **"Reimplante"**
3. Aguarde o build completar

### Via SSH Manual

```bash
# Conectar ao servidor
ssh root@95.217.7.167

# Ir para o diretório
cd /var/www/querenhapuque

# Atualizar código
git pull origin main

# Rebuild e restart
docker compose down
docker compose build
docker compose up -d

# Verificar
docker compose ps
docker compose logs -f
```

## 📊 Monitoramento

### Verificar Status

```bash
# Status dos containers
docker compose ps

# Logs em tempo real
docker compose logs -f

# Uso de recursos
docker stats querenhapuque-app
```

### Health Check

```bash
# Verificar se a aplicação está respondendo
curl -I http://localhost:3000

# Verificar dentro do container
docker exec querenhapuque-app wget -O- http://localhost
```

## 🐛 Troubleshooting

### Aplicação não inicia

```bash
# Ver logs detalhados
docker compose logs querenhapuque

# Verificar se a porta está em uso
netstat -tulpn | grep :3000

# Verificar Docker
docker ps -a
docker images
```

### Erro de permissão

```bash
# Verificar permissões do diretório
ls -la /var/www/querenhapuque

# Ajustar permissões (se necessário)
chown -R root:root /var/www/querenhapuque
chmod -R 755 /var/www/querenhapuque
```

### Rebuild completo

```bash
# Parar e remover tudo
docker compose down -v

# Limpar cache do Docker
docker system prune -a

# Rebuild do zero
docker compose build --no-cache
docker compose up -d
```

## 🔐 Segurança

### Firewall

```bash
# Permitir apenas portas necessárias
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
ufw enable

# Verificar status
ufw status
```

### Atualizar Sistema

```bash
# Atualizar pacotes
apt update && apt upgrade -y

# Atualizar Docker
apt update && apt install docker-ce docker-ce-cli containerd.io
```

### Backup

```bash
# Backup da aplicação
tar -czf querenhapuque-backup-$(date +%Y%m%d).tar.gz /var/www/querenhapuque

# Backup da imagem Docker
docker save querenhapuque-querenhapuque:latest | gzip > querenhapuque-image-$(date +%Y%m%d).tar.gz
```

## 📝 Checklist de Deploy

- [ ] Servidor preparado (Docker instalado)
- [ ] Repositório clonado
- [ ] Variáveis de ambiente configuradas (se necessário)
- [ ] Build da imagem concluído
- [ ] Container iniciado
- [ ] Aplicação acessível
- [ ] Logs verificados
- [ ] Firewall configurado
- [ ] SSL configurado (se usando domínio)
- [ ] Backup configurado

## 🆘 Suporte

### Logs Importantes

```bash
# Logs da aplicação
docker compose logs -f

# Logs do Nginx (se usando reverso)
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# Logs do sistema
journalctl -u docker -f
```

### Comandos de Emergência

```bash
# Parar tudo
docker compose down

# Reiniciar Docker
systemctl restart docker

# Verificar espaço em disco
df -h

# Limpar espaço
docker system prune -a --volumes
```

## 📚 Recursos Adicionais

- **Documentação Coolify:** https://coolify.io/docs
- **Documentação Docker:** https://docs.docker.com
- **Documentação Nginx:** https://nginx.org/en/docs
- **Hetzner Cloud Docs:** https://docs.hetzner.com

---

**Última atualização:** 16/11/2025  
**Status:** ✅ Guia completo de deploy  
**Servidor:** Hetzner Cloud (95.217.7.167)

