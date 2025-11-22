# Acesso SSH ao VPS 49.12.204.185 (Hetzner)

## Objetivo
Guia prático para habilitar e usar acesso SSH seguro ao servidor `49.12.204.185` via chave `ed25519`, padronizando procedimentos, validações e comandos úteis.

## Pré-requisitos
- Host: `49.12.204.185`
- Usuário: `root`
- Chave privada local: `C:\Users\Anderson\.ssh\vps-deploy-key-ed25519`
- Chave pública correspondente: `vps-deploy-key-ed25519.pub` (referência em `docs/hetzner/VPS_LOGIN_INFO.txt`)

## Autorizar a chave no servidor (via Console Hetzner)
1. Entrar no console do servidor (Hetzner) com usuário `root`.
2. Executar:
   - `mkdir -p ~/.ssh && chmod 700 ~/.ssh`
   - `echo 'ssh-ed25519 <CONTEUDO_DA_CHAVE_PUBLICA> vps-deploy-key-ed25519' >> ~/.ssh/authorized_keys`
   - `chmod 600 ~/.ssh/authorized_keys`
3. Observação: o `<CONTEUDO_DA_CHAVE_PUBLICA>` está em `docs/hetzner/VPS_LOGIN_INFO.txt`.

## Acesso SSH
### Windows (PowerShell)
- `ssh -i "$env:USERPROFILE\.ssh\vps-deploy-key-ed25519" root@49.12.204.185`
- Teste não interativo:
  - `ssh -i "$env:USERPROFILE\.ssh\vps-deploy-key-ed25519" -o BatchMode=yes root@49.12.204.185 "echo OK && hostname && whoami"`

### Linux/Mac
- `ssh -i ~/.ssh/vps-deploy-key-ed25519 root@49.12.204.185`
- Teste:
  - `ssh -i ~/.ssh/vps-deploy-key-ed25519 -o BatchMode=yes root@49.12.204.185 "echo OK && hostname && whoami"`

## Validações úteis no servidor
- Rede e portas:
  - `ss -tlnp | grep -E ':80|:443|:22'`
  - `ip -4 addr show | grep -E 'inet '`
- DNS do domínio do n8n:
  - `dig +short aut.querenhapuque.com @1.1.1.1`
- Proxy e containers:
  - `docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'`
  - `docker logs coolify-proxy --tail 200 | grep -Ei 'aut\\.querenhapuque\\.com|acme|certificate|tls|error'`

## Comandos operacionais frequentes
- Reiniciar proxy Coolify (Traefik/Caddy):
  - `docker restart coolify-proxy`
- Atualizar stack do n8n:
  - `cd /data/coolify/services/z0k00g84cog4o8skc4s8o84k && docker compose up -d`
- Verificar HTTP/HTTPS:
  - `curl -I http://aut.querenhapuque.com`
  - `curl -I https://aut.querenhapuque.com`

## Problemas comuns e soluções
- `Permission denied (publickey,password)`:
  - Confirme `~/.ssh/authorized_keys` contém a chave pública correta e permissões `600`.
  - Pasta `~/.ssh` com `700`.
- Erro de certificado em HTTPS (self-signed):
  - Verifique resolver ACME/Let’s Encrypt no proxy.
  - Labels esperados no serviço n8n (Traefik):
    - `traefik.http.routers.n8n.rule=Host('aut.querenhapuque.com')`
    - `traefik.http.routers.n8n.entryPoints=https`
    - `traefik.http.routers.n8n.tls=true`
    - `traefik.http.services.n8n.loadbalancer.server.port=5678`
    - HTTP→HTTPS: `traefik.http.routers.n8n-http.entryPoints=http`, `traefik.http.routers.n8n-http.rule=Host('aut.querenhapuque.com')`, `traefik.http.routers.n8n-http.middlewares=redirect-to-https`
- 404 em HTTP:
  - Confirme router HTTP com redirect configurado.
  - Verifique que o container n8n está `Up` e porta `5678/tcp`.

## Boas práticas de segurança
- Nunca compartilhar a chave privada `vps-deploy-key-ed25519`.
- Manter permissões: `600` (arquivo) e `700` (pasta).
- Validar fingerprint local:
  - Windows: `ssh-keygen -lf "$env:USERPROFILE\.ssh\vps-deploy-key-ed25519"`
  - Linux/Mac: `ssh-keygen -lf ~/.ssh/vps-deploy-key-ed25519`
- Habilitar `BatchMode=yes` em automações para evitar prompts.

## Referências
- `docs/hetzner/VPS_LOGIN_INFO.txt`
- `docs/hetzner/SECURITY_SSH_KEYS.md`