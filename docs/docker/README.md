# 🐳 Documentação Docker - Querenhapuque

## 📁 Índice da Documentação

Esta pasta contém toda a documentação relacionada ao Docker da aplicação Querenhapuque.

### 📄 Arquivos Principais

1. **[SETUP_COMPLETO.md](SETUP_COMPLETO.md)** - Guia completo de configuração Docker
2. **[COMANDOS_UTEIS.md](COMANDOS_UTEIS.md)** - Comandos Docker mais utilizados
3. **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** - Solução de problemas comuns
4. **[DEPLOY_SERVIDOR.md](DEPLOY_SERVIDOR.md)** - Como fazer deploy no servidor Hetzner

### 🎯 Acesso Rápido

**Aplicação Local:**
- URL: http://localhost:3000
- Container: `querenhapuque-app`
- Imagem: `querenhapuque-querenhapuque:latest`

**Arquivos Docker (raiz do projeto):**
- `Dockerfile` - Build multi-stage
- `docker-compose.yml` - Orquestração
- `nginx.conf` - Configuração Nginx
- `.dockerignore` - Arquivos excluídos
- `README-DOCKER.md` - Documentação geral

### 🚀 Início Rápido

```bash
# Build e iniciar
docker-compose up -d

# Ver logs
docker-compose logs -f

# Parar
docker-compose down
```

### 📊 Status Atual

- ✅ Docker configurado e testado localmente
- ✅ Build multi-stage funcionando (Node.js + Nginx)
- ✅ Aplicação rodando em http://localhost:3000
- ✅ Arquivos enviados para GitHub (commit ed9a3d8)
- ⏳ Deploy no servidor: Pendente

### 🔗 Links Relacionados

- **Coolify Admin:** https://coolify-admin.ouvir.online
- **GitHub:** https://github.com/Andersondos7000/site-queren-2025
- **Servidor Produção:** 95.217.7.167

---

**Última atualização:** 16/11/2025  
**Status:** ✅ Documentação completa

