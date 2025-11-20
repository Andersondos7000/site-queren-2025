# Checklist de Operação — APP-QUEREN

## Pré‑Deploy
- Validar SSH: `ssh queren-prod-43 "whoami && hostname"`
- Confirmar domínio: `nslookup app.querenhapuque.com` → IP do servidor
- Painel: acessar `https://coolify.querenhapuque.com/`
- Proxy: servidor `queren-prod-43` com Caddy em estado `Proxy Running`
- Rede: serviços na rede Docker `coolify`

## Deploy via GHCR
- Publicar imagem pelo CI (`.github/workflows/deploy-coolify.yml`):
  - Tags: `ghcr.io/<owner>/borboleta-eventos-loja:<sha>` e `:latest`
  - `platforms: linux/amd64` e cache GHA ativado
- Coolify → Keys & Tokens → Registries:
  - Adicionar `ghcr.io` com usuário GitHub e PAT `read:packages`
- Aplicação Docker Image:
  - `Image`: `ghcr.io/<owner>/borboleta-eventos-loja`
  - `Tag`: `latest` (existente)
  - `Service Port`: `80`
  - `Domain`: `https://app.querenhapuque.com`
- Deploy e acompanhar `Deployment Log`

## Fallback via Compose
- Diretório: `/srv/ap-queren-hapuque`
- Copiar `dist/` para o servidor
- Compose na rede `coolify` com labels Caddy:
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
networks:
  coolify:
    external: true
```
- Subir: `docker compose up -d`

## Validação
- Servidor: `curl -s -o /dev/null -w "%{http_code}\n" https://app.querenhapuque.com/` → `200`
- Navegador: acessar `https://app.querenhapuque.com/`
- Coolify Logs: sem erros em proxy e aplicação

## Limpeza
- Após migrar para GHCR, remover fallback:
  - `ssh queren-prod-43 'cd /srv/ap-queren-hapuque && docker compose down'`
- Evitar dois recursos no mesmo domínio

## Troubleshooting
- `denied` no GHCR: configurar Registry com PAT ou tornar imagem pública
- `manifest unknown`: publicar a tag usada (`latest` ou específica)
- Domínio em conflito: desligar serviço antigo em `Site Queren Rapuque/production/Ap-Queren Hapuque`
- TLS falhando: aguardar emissão/renovação pelo Caddy e revisar labels/rede

## Segurança
- Não versionar chaves/tokens
- PAT com escopo mínimo (`read:packages`)
- Somente chave pública no servidor; senhas desativadas