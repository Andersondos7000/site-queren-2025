# APP-QUEREN — Guia de Configuração e Deploy

## Visão Geral

- Objetivo: publicar a aplicação estática (SPA) Queren Hapuque em `https://app.querenhapuque.com/` usando proxy gerenciado pelo Coolify e, preferencialmente, imagem Docker hospedada no GHCR.
- Ambientes e ferramentas:
  - Servidor de produção: `queren-prod-43` (IP `168.119.172.229`)
  - Painel Coolify: `https://coolify.querenhapuque.com/`
  - Proxy: Caddy (via Coolify Proxy)
  - Registro de imagens: GHCR (`ghcr.io`)
- CI/CD: GitHub Actions (`.github/workflows/deploy-coolify.yml`)

## Fluxo Rápido — Local → Produção

- Local: `npm run dev` → `npm run build` → `npm run preview` com `VITE_*` definidos.
- Push: `git push origin main` dispara o workflow de deploy.
- Build: imagem em `ghcr.io/<owner>/borboleta-eventos-loja` (tags `latest` e `SHA`, owner em minúsculas) com `VITE_*` via Secrets.
- Redeploy: webhook `COOLIFY_DEPLOY_URL` (com `Authorization: Bearer COOLIFY_API_TOKEN` se existir).
- Produção: Coolify puxa a imagem e entrega via Caddy em `https://app.querenhapuque.com` com Healthcheck GET `/`.
- Rollback: executar workflow manual com `inputs.tag` (um `SHA`) ou trocar `Tag` no recurso do Coolify.

## Pré‑requisitos

- Chave privada Ed25519 local em `%USERPROFILE%\.ssh\vps-deploy-key-ed25519` com a respectiva chave pública instalada no servidor.
- Acesso ao painel Coolify com permissão de administrador.
- Domínio `app.querenhapuque.com` apontando para o IP público do servidor.
- (Para GHCR) Personal Access Token (PAT) do GitHub com escopo `read:packages` e imagem publicada com a tag utilizada.

## Instalação Local e Build

- Requisitos:
  - Node.js 18+ e npm 10+
  - Variáveis de ambiente para Vite:
    - `VITE_SUPABASE_URL`
    - `VITE_SUPABASE_ANON_KEY`
    - `VITE_APP_NAME`
    - `VITE_APP_VERSION`
- Passos:
  1. Instalar dependências:
     - `npm install`
  2. Desenvolvimento:
     - `npm run dev` e acessar `http://localhost:5173`
  3. Build de produção:
     - `npm run build`
     - Artefatos em `dist/`
  4. Preview local do build:
     - `npm run preview`

## Acesso SSH e Alias

1. Criar/editar `%USERPROFILE%\.ssh\config`:
```
Host queren-prod-43
  HostName 168.119.172.229
  User root
  IdentityFile C:\Users\<seu_usuario>\.ssh\vps-deploy-key-ed25519
  IdentitiesOnly yes
```
2. Testar:
```
ssh queren-prod-43 "whoami && hostname"
```

## Atualização do Domínio do Coolify

- Atualizar referências de `https://coolify-admin.ouvir.online` para `https://coolify.querenhapuque.com/` na documentação interna.
- Verificar em `Settings → Configuration` do Coolify:
  - `Domain`: `https://coolify.querenhapuque.com`
  - `Instance's Public IPv4`: IP público do host

## Migração do Proxy para Caddy

1. Painel `Servers → queren-prod-43 → Proxy`.
2. Parar o proxy existente (Traefik) e acionar `Switch Proxy` para Caddy.
3. Iniciar o proxy Caddy; aguardar estado `Proxy Running`.
4. Observação: o Caddy descobre serviços via rede Docker e labels; garanta que os serviços estejam na mesma rede que o proxy (rede `coolify`).

## Deploy via Docker Compose (fallback)

Uso quando a imagem GHCR não está disponível ou durante migração.

1. Preparar diretório no servidor:
```
ssh queren-prod-43 'mkdir -p /srv/ap-queren-hapuque && chmod 755 /srv/ap-queren-hapuque'
```
2. Copiar artefatos estáticos (build `dist/`):
```
scp -r <caminho_local>/dist queren-prod-43:/srv/ap-queren-hapuque/
```
3. Compose (`/srv/ap-queren-hapuque/docker-compose.yml`):
```
services:
  web:
    image: nginx:alpine
    restart: unless-stopped
    networks:
      - coolify
    volumes:
      - /srv/ap-queren-hapuque/dist:/usr/share/nginx/html:ro
    labels:
      - "caddy=app.querenhapuque.com"
      - "caddy.encode=gzip"
      - "caddy.reverse_proxy={{upstreams 80}}"
      - "caddy.try_files={path} /index.html"
networks:
  coolify:
    external: true
```
4. Subir serviços:
```
ssh queren-prod-43 'cd /srv/ap-queren-hapuque && docker compose up -d && docker compose ps'
```

## Publicar Imagem no GHCR (CI/CD)

- Workflow: `.github/workflows/deploy-coolify.yml`
  - Build e Push:
    - Tags: `ghcr.io/<owner>/borboleta-eventos-loja:${{ github.sha }}` e `:latest` (ou `inputs.tag`)
    - `platforms: linux/amd64`
    - Cache GHA: `cache-from/cache-to`
    - Normalização do owner: `${GITHUB_REPOSITORY_OWNER,,}` para evitar erro de tag com maiúsculas
  - Redeploy: POST em `COOLIFY_DEPLOY_URL`
    - Autorização opcional via `Authorization: Bearer ${{ secrets.COOLIFY_API_TOKEN }}`
  - Healthcheck: usa `APP_HEALTHCHECK_URL` ou `inputs.healthcheck_url`
- Secrets necessários (GitHub):
  - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_NAME`, `VITE_APP_VERSION`
  - `COOLIFY_DEPLOY_URL` (webhook do recurso no Coolify)
  - `APP_HEALTHCHECK_URL` (rota pública de health)
  - `COOLIFY_API_TOKEN` (token de API do Coolify para autenticação do webhook)

### Regras de Build e Variáveis

- Dockerfile exige `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` em build‑time; se ausentes, o build falha.
- `src/lib/config/envConfig.ts` valida as variáveis em tempo de execução do bundle; o erro no console indica falta na fase de build.
- Variáveis VITE_* não são lidas do runtime do container Nginx; devem vir incorporadas no build.

### Publicação em Produção — Passo a Passo

1. Configurar Secrets no repositório (`Settings → Secrets and variables → Actions`):
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_NAME`, `VITE_APP_VERSION`
   - `COOLIFY_DEPLOY_URL`, `APP_HEALTHCHECK_URL`, `COOLIFY_API_TOKEN`
2. Verificar que o workflow usa `platforms: linux/amd64` e publica no `ghcr.io`.
   - Confirmar normalização do owner com `${GITHUB_REPOSITORY_OWNER,,}` nas tags.
3. Executar via push em `main` ou manualmente (`Actions → Deploy to Coolify → Run workflow`), definindo opcionalmente `inputs.tag` e `healthcheck_url`.
4. Acompanhar os passos do workflow:
   - Login no GHCR, build, push das tags e chamada ao webhook do Coolify.
   - Webhook com Bearer quando `COOLIFY_API_TOKEN` estiver presente.
   - Healthcheck: retorna `2xx`/`3xx` para considerar saudável.
5. Validar no Coolify o `Deployment Log` e o status da aplicação.

## Configurar Registry GHCR no Coolify

1. Gerar PAT (classic) no GitHub com `read:packages`.
2. Coolify `Keys & Tokens → Registries → Add Registry`:
   - `Registry`: `ghcr.io`
   - `Username`: seu usuário GitHub
   - `Password/Token`: PAT gerado
3. Salvar e testar conexão.

## Deploy via Docker Image (Coolify)

1. Projetos → “Site Queren Rapuque” → `+ New → Docker Image`.
2. Configurar:
   - `Image`: `ghcr.io/<owner>/borboleta-eventos-loja`
   - `Tag`: `latest` (garanta que a tag exista no GHCR)
   - `Service Port`: `80`
   - `Domain`: `https://app.querenhapuque.com`
3. `Deploy` e acompanhar `Deployment Log`.

### Rollback e Versionamento

- Workflow manual com `inputs.tag`:
  - Use a tag de um commit anterior (por exemplo, o SHA publicado) e rode `workflow_dispatch` para implantar aquela versão.
- No Coolify:
  - Atualize a `Tag` do recurso Docker Image para a versão desejada e faça `Deploy`.
- Fallback (se necessário):
  - `ssh queren-prod-43 'cd /srv/ap-queren-hapuque && docker compose up -d'` com artefato `dist/` anterior.

## Operação e Observabilidade

- Logs:
  - Coolify exibe logs do serviço e do proxy Caddy.
- Healthcheck:
  - Configure `APP_HEALTHCHECK_URL` para rota pública de verificação.
- Backups:
  - Habilite backups no Coolify (se aplicável) e registre o procedimento de restore.

### Erros comuns

- `denied` ao baixar do GHCR: falta de PAT ou pacote privado sem permissão.
- `manifest unknown`: a tag (ex.: `latest`) não foi publicada; publique via workflow ou defina uma tag existente.
  - Também ocorre se o owner tiver maiúsculas; normalize com `${GITHUB_REPOSITORY_OWNER,,}`.
- Conflito de domínio: se existir um serviço anterior (`Ap-Queren Hapuque`) usando o mesmo domínio, remova ou desligue para evitar rotas conflitantes.
- `404` em rotas SPA (ex.: `/auth`): adicionar label `caddy.try_files={path} /index.html` ou configurar fallback no Nginx para servir `index.html`; também evitar `window.location.href` e usar navegação client-side (`navigate('/auth')`).

## Validação

- DNS:
```
nslookup app.querenhapuque.com
```
- HTTP/HTTPS (servidor):
```
ssh queren-prod-43 'curl -s -o /dev/null -w "%{http_code}\n" https://app.querenhapuque.com/'
```
- Navegador: acessar `https://app.querenhapuque.com/` e verificar carregamento (200).
- Coolify: Healthcheck habilitado (GET `/`) com status `Healthy`.
- Unmanaged: confirmar ausência de recursos não‑gerenciados para este domínio.

## Limpeza (pós‑migração para GHCR)

- Remover fallback via Compose para evitar conflito de domínio:
```
ssh queren-prod-43 'cd /srv/ap-queren-hapuque && docker compose down'
```

## Segurança

- Não versionar chaves privadas ou tokens em repositório.
- PAT apenas com escopo mínimo necessário (`read:packages`).
- Manter senhas desativadas e autenticação por chave pública em SSH.
- Logs e documentos não devem conter segredos.

## Referências Úteis

- Coolify (novo domínio): `https://coolify.querenhapuque.com/`
- Workflow CI: `.github/workflows/deploy-coolify.yml`
- Documentação do servidor: `docs/hetzner/queren-prod-43.md`

## Guia Rápido — Produção

- CI/CD publica imagem no GHCR e aciona redeploy no Coolify.
- Coolify entrega via Caddy no domínio `app.querenhapuque.com`.
- Em caso de falha de imagem/tag, usar fallback Compose servindo `dist/` na rede `coolify` com labels Caddy.
 
## Registro de Execução e Decisões

- Proxy: migrado para Caddy no servidor `queren-prod-43` e validado em estado `Proxy Running`.
- Fallback: publicado via Docker Compose com Nginx servindo `dist/` na rede `coolify` e labels Caddy para `app.querenhapuque.com`.
 - Coolify: removido recurso antigo `ap-queren-hapuque-web-1` para eliminar conflito de domínio; mantido o recurso Docker Image atual.
- GHCR: autenticado com PAT `read:packages`; identificado erro `manifest unknown` devido à ausência da tag `latest` publicada.
- CI: ajustado workflow para publicar `latest`, habilitar cache, `platforms: linux/amd64` e normalização de owner.
- Healthcheck: corrigida condição de execução para usar `github.event.inputs.healthcheck_url` ou `APP_HEALTHCHECK_URL`.
- Webhook: acionado com `Authorization: Bearer ${{ secrets.COOLIFY_API_TOKEN }}` quando disponível.
- Validação: acesso HTTPS confirmado em `https://app.querenhapuque.com` com carregamento da SPA e navegação básica.

### Estado Atual
- `https://app.querenhapuque.com` responde com conteúdo da aplicação e sem erros aparentes.
- Próximo passo recomendado: concluir a publicação da imagem `latest` no GHCR via workflow e, após sucesso, realizar o redeploy no Coolify e desligar o fallback Compose para evitar duplicidade.
