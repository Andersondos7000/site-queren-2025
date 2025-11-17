# 🐳 Deploy Docker - Querenhapuque

## 📋 Arquivos Docker

Este projeto agora suporta deploy via Docker e Docker Compose:

- **`Dockerfile`** - Build multi-stage (Node.js + Nginx)
- **`docker-compose.yml`** - Orquestração de containers
- **`nginx.conf`** - Configuração Nginx otimizada para SPA
- **`.dockerignore`** - Arquivos excluídos do build
- **`docker-deploy.sh`** - Script auxiliar de deploy (Linux/Mac)

## 🚀 Deploy Local

### Pré-requisitos

- Docker Desktop instalado
- Docker Compose v2+

### Comandos Rápidos

```bash
# Build da imagem
docker-compose build

# Iniciar aplicação
docker-compose up -d

# Ver logs
docker-compose logs -f

# Parar aplicação
docker-compose down

# Reiniciar
docker-compose restart

# Ver status
docker-compose ps
```

### Acesso

Após iniciar, a aplicação estará disponível em:
- **URL:** http://localhost:3000

## 🌐 Deploy no Servidor (Hetzner)

### Opção 1: Via SSH Manual

```bash
# 1. Conectar ao servidor
ssh root@95.217.7.167

# 2. Clonar repositório (se ainda não existe)
git clone git@github.com:Andersondos7000/site-queren-2025.git
cd site-queren-2025

# 3. Fazer pull das últimas alterações
git pull origin main

# 4. Build e iniciar
docker-compose build
docker-compose up -d

# 5. Verificar status
docker-compose ps
docker-compose logs -f
```

### Opção 2: Via Coolify (Recomendado)

1. Acesse o Coolify Admin: https://coolify-admin.ouvir.online
2. Vá para a aplicação Querenhapuque
3. Em "Configuração" > "Pacote de Construção", selecione **"Dockerfile"**
4. Salve e faça um novo deploy

O Coolify detectará automaticamente o `Dockerfile` e fará o build.

## 🔧 Configurações

### Portas

- **Container:** Porta 80 (Nginx)
- **Host:** Porta 3000 (mapeada)

Para alterar a porta do host, edite `docker-compose.yml`:

```yaml
ports:
  - "8080:80"  # Altera para porta 8080
```

### Variáveis de Ambiente

Para adicionar variáveis de ambiente, edite `docker-compose.yml`:

```yaml
environment:
  - NODE_ENV=production
  - VITE_SUPABASE_URL=sua_url
  - VITE_SUPABASE_ANON_KEY=sua_chave
```

### Health Checks

O container possui health checks configurados:
- **Intervalo:** 30s
- **Timeout:** 3s
- **Retries:** 3
- **Start Period:** 5s

## 📊 Monitoramento

### Ver logs em tempo real

```bash
docker-compose logs -f querenhapuque
```

### Ver uso de recursos

```bash
docker stats querenhapuque-app
```

### Inspecionar container

```bash
docker inspect querenhapuque-app
```

## 🔍 Troubleshooting

### Container não inicia

```bash
# Ver logs detalhados
docker-compose logs querenhapuque

# Verificar se a porta está em uso
netstat -an | grep 3000

# Reiniciar container
docker-compose restart
```

### Aplicação não carrega

```bash
# Verificar se o Nginx está rodando
docker exec querenhapuque-app ps aux | grep nginx

# Verificar arquivos buildados
docker exec querenhapuque-app ls -la /usr/share/nginx/html

# Testar internamente
docker exec querenhapuque-app wget -O- http://localhost
```

### Rebuild completo

```bash
# Parar e remover containers
docker-compose down

# Remover imagem antiga
docker rmi querenhapuque-querenhapuque

# Build sem cache
docker-compose build --no-cache

# Iniciar novamente
docker-compose up -d
```

## 🎯 Otimizações

### Build Multi-Stage

O Dockerfile usa build multi-stage para reduzir o tamanho da imagem final:

- **Stage 1 (builder):** Node.js 20 Alpine - Build da aplicação
- **Stage 2 (production):** Nginx Alpine - Servidor de produção

**Resultado:** Imagem final ~50MB (vs ~1GB com Node.js completo)

### Nginx Otimizado

- ✅ Compressão gzip ativa
- ✅ Cache de assets estáticos (1 ano)
- ✅ SPA routing (`try_files`)
- ✅ Headers de segurança
- ✅ Logs estruturados

## 📝 Notas

- A aplicação é servida via Nginx na porta 80 do container
- O build Vite gera arquivos em `/app/dist`
- Os arquivos são copiados para `/usr/share/nginx/html`
- O Nginx está configurado para SPA (todas as rotas vão para `index.html`)

## 🔐 Segurança

Headers de segurança configurados no Nginx:

- `X-Frame-Options: SAMEORIGIN`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`

## 📚 Recursos

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [Vite Documentation](https://vitejs.dev/)

---

**Última atualização:** 16/11/2025
**Status:** ✅ Testado e funcionando

