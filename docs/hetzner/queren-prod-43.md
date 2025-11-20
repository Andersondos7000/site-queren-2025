# queren-prod-43 — Chaves SSH

Servidor: queren-prod-43
IP: 168.119.172.229
Local: nbg1-dc3

## Chaves Públicas (do projeto)

### vps-deploy-key-ed25519
```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIIYFcSCk+W5rUC+UThnPKeVpterYMriCR2Cd8AKtwFMg vps-deploy-key-ed25519
```

### vps-deploy-key (RSA legado)
```
ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQDg0vm8nwjESMitkDhCgUfJLXQ+ShFmTe4PqbsAgrPSgJjpbEO5pihNIg2LI4QcljgtPKJS5JZEFJXEJVin8ybSQF0+MPGpV9jGyibcY33xkcDEzxvTnDLSWCvgaYerW95yszf8IRyicr6ypcSKcwBEysJJtmsupxwXbINOj+/MLG+L3p70pI35IMPtreSmpr7M9bBj/V4H01LF7NaQ1txP2JzOjS4ZT6heDYqf+EfhemTLmrIrBNwSF3KM2hJyILrigZhTxXzaZtYYbHKAS3j0Oh7l0hBX1OSK0moCrasnc1WqXWavVaab9Gu7l1kyd99Pov3ux41pWf0I2+mPU6BOqIvwOuTV0pZQIQdK625dBrZeryNkqwvj54Fm5kW8+QO6VWCNVucV4YJ5JrZvgyY0eLhZ9nLHxnKeCvmlKg3MRvMVU8VjE5lkt6KC5gzPEldu335i8Za/n0qiCH7IEoRvvVVWqBEuViUcjDSFlkLbjWIeH+WYovugy/CcVMMm59KqO/ACgqCkJXPYZ2Nka251gjSvoQyov07gOnlEeJTd6EnThDb/7ISB/2i32MO2ewjgS4oPDSgUW7kyeytcONB5E/ZMauqYk6skiCjgd3iom6aoUt85IELyuqAwIVtRfya05RPRxORRyvpu5XG9SJNMOjz9tP5/35Tf08xMaP3RGw== vps-deploy-key
```

Observação: somente chaves públicas. Não armazenar chaves privadas neste repositório.

## Acesso Validado e Procedimentos (19/11/2025)

- Validação de conectividade SSH ao host `queren-prod-43` (`168.119.172.229`).
- Autenticação realizada com chave privada local `id_ed25519` (`vps-deploy-key-ed25519`).
- Presença da chave pública Ed25519 confirmada em `~/.ssh/authorized_keys` no servidor.

### Comandos executados

- `ssh -i %USERPROFILE%\.ssh\vps-deploy-key-ed25519 root@168.119.172.229 "whoami && hostname"`
- `ssh -i %USERPROFILE%\.ssh\vps-deploy-key-ed25519 root@168.119.172.229 "uname -a"`
- `ssh -i %USERPROFILE%\.ssh\vps-deploy-key-ed25519 root@168.119.172.229 "ls -ld ~/.ssh ~/.ssh/authorized_keys"`
- `ssh -i %USERPROFILE%\.ssh\vps-deploy-key-ed25519 root@168.119.172.229 "tail -n 5 ~/.ssh/authorized_keys"`

### Resultados

- Identidade e host:
  - `root`
  - `queren-prod-43`
- Sistema:
  - Kernel/Distro: `Linux queren-prod-43 5.15.x Ubuntu x86_64`
- Permissões:
  - `~/.ssh` → `drwx------`
  - `~/.ssh/authorized_keys` → `-rw-------`
- Chave pública presente em `authorized_keys`:
  - `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIIYFcSCk+W5rUC+UThnPKeVpterYMriCR2Cd8AKtwFMg vps-deploy-key-ed25519`

### Como acessar

- Acesso direto:
  - `ssh -i %USERPROFILE%\.ssh\vps-deploy-key-ed25519 root@168.119.172.229`
- Alias opcional (Windows OpenSSH) em `C:\Users\<seu_usuario>\.ssh\config`:
  - `Host queren-prod-43`
  - `  HostName 168.119.172.229`
  - `  User root`
  - `  IdentityFile C:\Users\<seu_usuario>\.ssh\vps-deploy-key-ed25519`
  - `  IdentitiesOnly yes`
- Com alias:
  - `ssh queren-prod-43`

### Boas práticas

- Não versionar chaves privadas no repositório.
- Usar sempre autenticação por chave pública (senhas desativadas).
- Manter permissões restritivas (`700` em `~/.ssh`, `600` em `authorized_keys`).

### Alias configurado localmente

- Arquivo: `C:\Users\<seu_usuario>\.ssh\config`
- Bloco aplicado:
```
Host queren-prod-43
  HostName 168.119.172.229
  User root
  IdentityFile C:\Users\<seu_usuario>\.ssh\vps-deploy-key-ed25519
  IdentitiesOnly yes
```
- Teste:
  - `ssh -o StrictHostKeyChecking=accept-new queren-prod-43 "whoami && hostname"`

## Limpeza da aplicação Ap-Queren Hapuque (via SSH)

- Objetivo: remover definição atual e containers para preparar deploy via `docker compose`.
- Container removido:
  - `querenhapuque-hk8gk00wgkg0owg4oocss4oc`
- Proxy mantido:
  - `coolify-proxy` (Traefik) permanece ativo.

### Comandos executados

```
ssh queren-prod-43 'docker ps -a'
ssh queren-prod-43 "docker rm -f querenhapuque-hk8gk00wgkg0owg4oocss4oc || true"
ssh queren-prod-43 'docker ps -a'
ssh queren-prod-43 'mkdir -p /srv/ap-queren-hapuque && chmod 755 /srv/ap-queren-hapuque'
```

### Resultado

- `docker ps -a` agora lista apenas `coolify-proxy`.
- Diretório `/srv/ap-queren-hapuque` criado para receber `docker-compose.yml`.

### Próximo passo (deploy com Compose)

- Copie seu `docker-compose.yml` para o servidor em `/srv/ap-queren-hapuque`.
- Execute:
  - `ssh queren-prod-43 'cd /srv/ap-queren-hapuque && docker compose up -d'`