# 🛠️ Comandos Úteis Docker - Querenhapuque

## 🚀 Comandos Básicos

### Iniciar Aplicação

```bash
# Build e iniciar
docker-compose up -d

# Apenas iniciar (sem build)
docker-compose start

# Build sem cache
docker-compose build --no-cache
```

### Parar Aplicação

```bash
# Parar containers
docker-compose stop

# Parar e remover containers
docker-compose down

# Parar, remover containers e volumes
docker-compose down -v
```

### Status e Monitoramento

```bash
# Ver status dos containers
docker-compose ps

# Ver logs em tempo real
docker-compose logs -f

# Ver logs de um serviço específico
docker-compose logs -f querenhapuque

# Ver últimas 100 linhas
docker-compose logs --tail=100

# Ver uso de recursos
docker stats querenhapuque-app
```

## 🔧 Comandos de Manutenção

### Rebuild

```bash
# Rebuild completo
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Reiniciar

```bash
# Reiniciar todos os serviços
docker-compose restart

# Reiniciar serviço específico
docker-compose restart querenhapuque
```

### Atualizar Código

```bash
# Pull do GitHub
git pull origin main

# Rebuild e restart
docker-compose down
docker-compose build
docker-compose up -d
```

## 🐚 Acesso ao Container

### Terminal Interativo

```bash
# Acessar shell do container
docker exec -it querenhapuque-app sh

# Executar comando único
docker exec querenhapuque-app ls -la /usr/share/nginx/html

# Ver processos rodando
docker exec querenhapuque-app ps aux
```

### Comandos Úteis Dentro do Container

```bash
# Verificar arquivos buildados
ls -la /usr/share/nginx/html

# Ver configuração do Nginx
cat /etc/nginx/conf.d/default.conf

# Testar Nginx
nginx -t

# Ver logs do Nginx
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

## 🔍 Diagnóstico

### Verificar Imagens

```bash
# Listar imagens
docker images | grep querenhapuque

# Ver detalhes da imagem
docker inspect querenhapuque-querenhapuque:latest

# Ver histórico de layers
docker history querenhapuque-querenhapuque:latest
```

### Verificar Containers

```bash
# Listar todos os containers
docker ps -a

# Inspecionar container
docker inspect querenhapuque-app

# Ver logs de erro
docker logs querenhapuque-app --tail 50 | grep -i error
```

### Verificar Rede

```bash
# Listar redes
docker network ls

# Inspecionar rede
docker network inspect querenhapuque_querenhapuque-network

# Testar conectividade
docker exec querenhapuque-app ping -c 3 google.com
```

### Health Check

```bash
# Ver status do health check
docker inspect querenhapuque-app | grep -A 10 Health

# Executar health check manualmente
docker exec querenhapuque-app wget --quiet --tries=1 --spider http://localhost/
```

## 🧹 Limpeza

### Remover Containers

```bash
# Remover container parado
docker rm querenhapuque-app

# Forçar remoção (mesmo rodando)
docker rm -f querenhapuque-app
```

### Remover Imagens

```bash
# Remover imagem específica
docker rmi querenhapuque-querenhapuque:latest

# Remover imagens não utilizadas
docker image prune

# Remover todas as imagens não utilizadas
docker image prune -a
```

### Limpeza Geral

```bash
# Remover tudo não utilizado
docker system prune

# Remover tudo (incluindo volumes)
docker system prune -a --volumes

# Ver espaço em disco
docker system df
```

## 📊 Monitoramento Avançado

### Logs Estruturados

```bash
# Logs com timestamp
docker-compose logs -f --timestamps

# Logs desde uma data específica
docker-compose logs --since 2025-11-16T20:00:00

# Logs até uma data específica
docker-compose logs --until 2025-11-16T21:00:00
```

### Métricas

```bash
# Ver uso de CPU e memória
docker stats --no-stream querenhapuque-app

# Ver uso de disco
docker exec querenhapuque-app df -h

# Ver processos
docker top querenhapuque-app
```

## 🔄 Backup e Restore

### Backup da Imagem

```bash
# Salvar imagem em arquivo
docker save querenhapuque-querenhapuque:latest > querenhapuque-backup.tar

# Comprimir backup
docker save querenhapuque-querenhapuque:latest | gzip > querenhapuque-backup.tar.gz
```

### Restore da Imagem

```bash
# Carregar imagem de arquivo
docker load < querenhapuque-backup.tar

# Carregar imagem comprimida
gunzip -c querenhapuque-backup.tar.gz | docker load
```

## 🚀 Deploy Rápido

### Script Completo de Deploy

```bash
#!/bin/bash
# Deploy completo da aplicação

echo "🔄 Atualizando código..."
git pull origin main

echo "🛑 Parando containers..."
docker-compose down

echo "🔨 Fazendo build..."
docker-compose build --no-cache

echo "🚀 Iniciando aplicação..."
docker-compose up -d

echo "📊 Verificando status..."
docker-compose ps

echo "✅ Deploy concluído!"
echo "📱 Aplicação disponível em: http://localhost:3000"
```

### One-liner Deploy

```bash
git pull && docker-compose down && docker-compose build && docker-compose up -d && docker-compose ps
```

## 🐛 Troubleshooting Rápido

### Container não inicia

```bash
# Ver erro específico
docker-compose logs querenhapuque

# Verificar porta em uso
netstat -ano | findstr :3000  # Windows
lsof -i :3000                 # Linux/Mac

# Testar build manualmente
docker build -t test .
```

### Aplicação não responde

```bash
# Verificar se Nginx está rodando
docker exec querenhapuque-app ps aux | grep nginx

# Testar internamente
docker exec querenhapuque-app wget -O- http://localhost

# Verificar arquivos
docker exec querenhapuque-app ls -la /usr/share/nginx/html
```

### Rebuild não funciona

```bash
# Limpar cache do Docker
docker builder prune -a

# Rebuild forçado
docker-compose build --no-cache --pull

# Remover tudo e começar do zero
docker-compose down -v
docker system prune -a
docker-compose up -d --build
```

## 📝 Aliases Úteis (Opcional)

Adicione ao seu `.bashrc` ou `.zshrc`:

```bash
# Docker Compose shortcuts
alias dcu='docker-compose up -d'
alias dcd='docker-compose down'
alias dcr='docker-compose restart'
alias dcl='docker-compose logs -f'
alias dcp='docker-compose ps'
alias dcb='docker-compose build'

# Querenhapuque específico
alias qup='cd ~/querenhapuque && docker-compose up -d'
alias qdown='cd ~/querenhapuque && docker-compose down'
alias qlogs='cd ~/querenhapuque && docker-compose logs -f'
alias qsh='docker exec -it querenhapuque-app sh'
```

---

**Última atualização:** 16/11/2025  
**Status:** ✅ Comandos testados e validados

