## Linhas de Pensamento (compac)

### Objetivo
- Sincronizar aplicação local e produção com fluxo CI/CD via GHCR e Coolify, garantindo validade de variáveis VITE_*, healthcheck e domínio único.

### Decisões Tomadas
- Usar Docker Image gerenciada no Coolify em `queren-prod-43` com domínio `https://app.querenhapuque.com`.
- Publicar imagens no GHCR com tags `latest` e por `SHA`, normalizando owner `${GITHUB_REPOSITORY_OWNER,,}`.
- Exigir `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` no build (Dockerfile) para evitar falhas em runtime.
- Remover recurso Unmanaged `ap-queren-hapuque-web-1` para eliminar conflito de domínio.
- Acionar redeploy via webhook `COOLIFY_DEPLOY_URL` com `Authorization: Bearer ${{ secrets.COOLIFY_API_TOKEN }}` quando disponível.

### Fluxo CI/CD Atual
- GitHub Actions: build com `platforms: linux/amd64`, push para `ghcr.io/<owner>/borboleta-eventos-loja`.
- Tags: `latest` e `${{ github.sha }}`; owner em minúsculas.
- Secrets: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_NAME`, `VITE_APP_VERSION`, `COOLIFY_DEPLOY_URL`, `APP_HEALTHCHECK_URL`, `COOLIFY_API_TOKEN`.
- Healthcheck: GET `/` configurado no Coolify; monitoramento externo opcional com `APP_HEALTHCHECK_URL`.

### Validação
- DNS aponta para `168.119.172.229`.
- Coolify mostra aplicação “running” e health `Healthy`.
- Navegador em `https://app.querenhapuque.com/` carrega sem erros de variáveis.
- Verificar ausência de Unmanaged com o mesmo domínio.

### Rollback
- Executar workflow manual com `inputs.tag` para um `SHA` anterior.
- No Coolify, ajustar `Tag` do recurso Docker Image e redeploy.

### Segurança
- Não armazenar tokens/chaves em repositório ou logs.
- Usar PAT com escopo mínimo `read:packages` para GHCR.
- Variáveis VITE_* vêm do build; não expor em runtime.

### Próximos Ajustes
- Documentar claramente o uso de `COOLIFY_API_TOKEN` e a necessidade de owner lowercase.
- Manter healthcheck e observabilidade; validar TLS e proxy Caddy periodicamente.
