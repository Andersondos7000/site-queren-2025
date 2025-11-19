# Coolify Config — Domínio e Correções

## Objetivo
- Documentar os passos para configurar o domínio `teste.querenhapuque.com` e aplicar correções no proxy do servidor de produção (Coolify) para que a aplicação responda corretamente em HTTPS.

## Pré-requisitos
- Acesso à Área do Cliente da SuperDomínios para o domínio `querenhapuque.com`.
- Acesso ao Coolify Admin (`https://coolify-admin.ouvir.online/`) com permissões de edição.

## Passo 1 — DNS (SuperDomínios)
- Abra “Meus Domínios” → selecione `querenhapuque.com` → “Gerenciar Domínio”.
- Aba “Endereços de DNS”:
  - Defina “Utilizar DNS padrão da SuperDomínios”.
- “Gerenciar DNS” (Editor de Zona):
  - Confirme/crie o registro `A` para o subdomínio:
    - Nome: `teste`
    - Tipo: `A`
    - Valor: `95.217.7.167`
    - TTL: `3600` (recomendado)
- Valide a propagação (pode levar alguns minutos). O domínio deve resolver para `95.217.7.167` globalmente.

## Passo 2 — Proxy no Coolify (Servidor 95.217.7.167)
- Menu “Servers” → “Querenhapuque-Production” → “Proxy”.
- Pare o proxy atual (botão “Stop Proxy”).
- Clique em “Switch Proxy” e selecione `Caddy`.
- Salve as alterações (botão “Save”) e aguarde o status “Proxy Running”.
- Motivo técnico: havia incompatibilidade entre o Traefik e a API do Docker no host (erro de versão do cliente), causando falhas de descoberta.

## Passo 3 — Aplicação (Projeto Querenhapuque)
- Menu “Projects” → Projeto “Querenhapuque” → ambiente `production` → aplicação.
- Aba “Configuration”:
  - “Domains”: defina `https://teste.querenhapuque.com`.
  - “Network”:
    - Ports Exposes: `3000`
    - Ports Mappings (se necessário): `3000:3000`
  - “Container Labels”: manter os labels padrão gerados pelo Coolify.
- Salve e faça “Redeploy” da aplicação.

## Validação
- Acesse `https://teste.querenhapuque.com/`:
  - Deve abrir a aplicação em HTTPS.
  - HTTP deve redirecionar para HTTPS automaticamente.

## Reversão para Traefik (opcional)
- Atualize o Docker Engine do host para suportar API recente (>= 1.44).
- No Coolify → servidor “Querenhapuque-Production” → “Proxy”:
  - “Stop Proxy” → “Switch Proxy” → selecione `Traefik` → “Save” → “Start Proxy”.

## Troubleshooting
- 503 “no available server”:
  - Verifique se a aplicação está “Running” no Coolify e se o domínio está definido nas “Domains”.
  - Confirme “Ports Exposes” e “Ports Mappings” conforme a porta interna (`3000`).
- Certificado inválido:
  - Aguarde emissão automática pelo proxy e confirme que o Host do domínio está correto.
- DNS não resolve (NXDOMAIN):
  - Revise o registro `A` para `teste` → `95.217.7.167` e os nameservers padrão.

## Segurança
- Não versionar segredos (chaves de API, tokens). Use “Shared Variables/Secrets” no Coolify.
- Evite expor segredos em logs ou documentação.