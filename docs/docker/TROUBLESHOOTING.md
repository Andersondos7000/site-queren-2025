# 🐛 Troubleshooting Docker - Querenhapuque

## 📋 Problemas Comuns e Soluções

### 1. Container não inicia

#### Sintomas
```bash
docker-compose ps
# STATUS: Exit (1) ou Restarting
```

#### Diagnóstico
```bash
# Ver logs de erro
docker-compose logs querenhapuque

# Ver últimas 50 linhas
docker-compose logs --tail=50 querenhapuque

# Verificar se há erros no build
docker-compose build
```

#### Soluções

**A. Porta já em uso**
```bash
# Windows
netstat -ano | findstr :3000

# Linux/Mac
lsof -i :3000

# Matar processo
kill -9 <PID>

# Ou alterar porta no docker-compose.yml
ports:
  - "8080:80"  # Usa porta 8080 em vez de 3000
```

**B. Erro no Dockerfile**
```bash
# Rebuild sem cache
docker-compose build --no-cache

# Verificar sintaxe do Dockerfile
docker build -t test .
```

**C. Falta de recursos**
```bash
# Verificar espaço em disco
docker system df

# Limpar recursos não utilizados
docker system prune -a
```

---

### 2. Aplicação mostra página em branco

#### Sintomas
- Container rodando
- HTTP 200 OK
- Página em branco no navegador

#### Diagnóstico
```bash
# Verificar arquivos buildados
docker exec querenhapuque-app ls -la /usr/share/nginx/html

# Verificar se index.html existe
docker exec querenhapuque-app cat /usr/share/nginx/html/index.html

# Verificar logs do Nginx
docker exec querenhapuque-app tail -f /var/log/nginx/error.log
```

#### Soluções

**A. Build incompleto**
```bash
# Rebuild completo
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

**B. Arquivos não copiados**
```bash
# Verificar Dockerfile
# Linha: COPY --from=builder /app/dist /usr/share/nginx/html

# Verificar se /app/dist existe no stage builder
docker build --target builder -t test-builder .
docker run --rm test-builder ls -la /app/dist
```

**C. Erro no build do Vite**
```bash
# Ver logs do build
docker-compose logs | grep "vite build"

# Testar build localmente
npm run build
ls -la dist/
```

---

### 3. Erro 404 em rotas do React

#### Sintomas
- Página inicial carrega
- Rotas como `/admin`, `/profile` retornam 404

#### Diagnóstico
```bash
# Verificar configuração do Nginx
docker exec querenhapuque-app cat /etc/nginx/conf.d/default.conf

# Procurar por try_files
docker exec querenhapuque-app grep "try_files" /etc/nginx/conf.d/default.conf
```

#### Solução

**Verificar nginx.conf**
```nginx
# Deve conter:
location / {
    try_files $uri $uri/ /index.html;
}
```

**Se estiver incorreto:**
```bash
# Editar nginx.conf local
nano nginx.conf

# Rebuild
docker-compose down
docker-compose build
docker-compose up -d
```

---

### 4. Health check "unhealthy"

#### Sintomas
```bash
docker-compose ps
# STATUS: Up X minutes (unhealthy)
```

#### Diagnóstico
```bash
# Ver detalhes do health check
docker inspect querenhapuque-app | grep -A 10 Health

# Executar health check manualmente
docker exec querenhapuque-app wget --quiet --tries=1 --spider http://localhost/
echo $?  # 0 = sucesso, 1 = falha
```

#### Soluções

**A. wget não instalado**
```bash
# Verificar se wget existe
docker exec querenhapuque-app which wget

# Se não existir, adicionar ao Dockerfile:
RUN apk add --no-cache wget
```

**B. Nginx não respondendo**
```bash
# Verificar se Nginx está rodando
docker exec querenhapuque-app ps aux | grep nginx

# Reiniciar Nginx
docker exec querenhapuque-app nginx -s reload
```

**C. Timeout muito curto**
```yaml
# Aumentar timeout no docker-compose.yml
healthcheck:
  timeout: 10s  # Era 3s
  interval: 60s  # Era 30s
```

---

### 5. Erro de permissão

#### Sintomas
```
Error: EACCES: permission denied
```

#### Diagnóstico
```bash
# Verificar permissões no container
docker exec querenhapuque-app ls -la /usr/share/nginx/html

# Verificar usuário rodando
docker exec querenhapuque-app whoami
```

#### Soluções

**A. Permissões incorretas**
```bash
# Ajustar permissões no Dockerfile
RUN chmod -R 755 /usr/share/nginx/html
```

**B. Volumes com permissões erradas**
```bash
# Se usando volumes, verificar permissões no host
ls -la ./logs

# Ajustar
chmod -R 755 ./logs
```

---

### 6. Build muito lento

#### Sintomas
- Build demora mais de 10 minutos
- npm install trava

#### Diagnóstico
```bash
# Ver progresso do build
docker-compose build --progress=plain

# Verificar cache
docker builder ls
```

#### Soluções

**A. Usar cache do Docker**
```bash
# Remover --no-cache
docker-compose build  # Sem --no-cache
```

**B. Otimizar .dockerignore**
```
# Adicionar mais exclusões
node_modules
dist
.git
*.log
```

**C. Usar npm ci em vez de npm install**
```dockerfile
# Se tiver package-lock.json
RUN npm ci --only=production
```

**D. Multi-stage build otimizado**
```dockerfile
# Copiar apenas package.json primeiro
COPY package*.json ./
RUN npm install
# Depois copiar resto do código
COPY . .
```

---

### 7. Erro de memória

#### Sintomas
```
JavaScript heap out of memory
```

#### Diagnóstico
```bash
# Ver uso de memória
docker stats querenhapuque-app
```

#### Soluções

**A. Aumentar memória do Node**
```dockerfile
# No Dockerfile, antes do build
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build
```

**B. Limitar recursos do container**
```yaml
# docker-compose.yml
services:
  querenhapuque:
    deploy:
      resources:
        limits:
          memory: 2G
        reservations:
          memory: 1G
```

---

### 8. Variáveis de ambiente não funcionam

#### Sintomas
- Aplicação não conecta ao Supabase
- Variáveis undefined

#### Diagnóstico
```bash
# Verificar variáveis no container
docker exec querenhapuque-app env

# Verificar se foram passadas no build
docker inspect querenhapuque-app | grep -A 20 Env
```

#### Soluções

**A. Variáveis em tempo de build**
```dockerfile
# Para variáveis do Vite (VITE_*)
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
```

**B. Passar variáveis no build**
```bash
docker-compose build --build-arg VITE_SUPABASE_URL=sua_url
```

**C. Usar arquivo .env**
```yaml
# docker-compose.yml
services:
  querenhapuque:
    env_file:
      - .env
```

---

### 9. Imagem muito grande

#### Sintomas
```bash
docker images
# querenhapuque-querenhapuque   latest   1.2GB
```

#### Diagnóstico
```bash
# Ver layers da imagem
docker history querenhapuque-querenhapuque:latest

# Ver o que está ocupando espaço
docker run --rm querenhapuque-querenhapuque:latest du -sh /*
```

#### Soluções

**A. Usar Alpine**
```dockerfile
FROM node:20-alpine AS builder
FROM nginx:alpine
```

**B. Limpar cache do npm**
```dockerfile
RUN npm install && npm cache clean --force
```

**C. Remover arquivos desnecessários**
```dockerfile
RUN rm -rf /app/node_modules
RUN rm -rf /app/.git
```

**D. Multi-stage build**
```dockerfile
# Já implementado - apenas copiar /dist
COPY --from=builder /app/dist /usr/share/nginx/html
```

---

### 10. Logs não aparecem

#### Sintomas
```bash
docker-compose logs
# Sem output
```

#### Diagnóstico
```bash
# Verificar se container está rodando
docker-compose ps

# Verificar logs do Docker
journalctl -u docker -f
```

#### Soluções

**A. Logs em arquivo**
```bash
# Verificar logs do Nginx
docker exec querenhapuque-app tail -f /var/log/nginx/access.log
docker exec querenhapuque-app tail -f /var/log/nginx/error.log
```

**B. Configurar logging**
```yaml
# docker-compose.yml
services:
  querenhapuque:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

---

## 🆘 Comandos de Emergência

### Reset Completo

```bash
# ATENÇÃO: Isso remove TUDO!

# 1. Parar e remover containers
docker-compose down -v

# 2. Remover imagens
docker rmi querenhapuque-querenhapuque:latest

# 3. Limpar sistema
docker system prune -a --volumes

# 4. Rebuild do zero
docker-compose build --no-cache
docker-compose up -d
```

### Backup antes de Reset

```bash
# Backup da imagem
docker save querenhapuque-querenhapuque:latest > backup.tar

# Backup dos volumes (se houver)
docker run --rm -v querenhapuque_data:/data -v $(pwd):/backup alpine tar czf /backup/volumes-backup.tar.gz /data
```

### Restore

```bash
# Restore da imagem
docker load < backup.tar

# Restore dos volumes
docker run --rm -v querenhapuque_data:/data -v $(pwd):/backup alpine tar xzf /backup/volumes-backup.tar.gz -C /
```

---

## 📞 Suporte

Se nenhuma solução funcionar:

1. **Coletar informações:**
```bash
docker-compose ps > debug.txt
docker-compose logs >> debug.txt
docker inspect querenhapuque-app >> debug.txt
docker system df >> debug.txt
```

2. **Verificar documentação:**
- `docs/docker/README.md`
- `docs/docker/SETUP_COMPLETO.md`
- `README-DOCKER.md` (raiz do projeto)

3. **Logs importantes:**
- Logs da aplicação: `docker-compose logs`
- Logs do sistema: `journalctl -u docker`
- Logs do Nginx: `/var/log/nginx/`

---

**Última atualização:** 16/11/2025  
**Status:** ✅ Guia completo de troubleshooting

