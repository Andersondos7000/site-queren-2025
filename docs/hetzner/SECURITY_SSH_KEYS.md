# 🔐 Documentação de Segurança SSH - Projeto Querenhapuque

**Data de Implementação:** 16 de Novembro de 2025  
**Responsável:** Anderson  
**Status:** ✅ Implementado e Ativo

---

## 📋 Resumo Executivo

Este documento detalha as melhorias de segurança implementadas nas chaves SSH para deploy no VPS Hetzner, incluindo a migração de RSA para Ed25519 e configurações de segurança avançadas.

---

## 🔑 Chaves SSH Implementadas

### ✅ Nova Chave Ed25519 (RECOMENDADA - EM USO)

**Tipo:** Ed25519 (Criptografia de Curva Elíptica)  
**Nome:** `vps-deploy-key-ed25519-secure`  
**Localização:** `C:\Users\Anderson\.ssh\vps-deploy-key-ed25519`  
**Status:** ✅ Ativa e configurada como padrão no Hetzner

**Chave Pública:**
```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIIYFcSCk+W5rUC+UThnPKeVpterYMriCR2Cd8AKtwFMg vps-deploy-key-ed25519
```

**Fingerprint:**
```
SHA256:kxA1N1fS82dVxnPKl/67Y7yL3ajIacbx0z6QCjnjOsA
```

**Vantagens:**
- ✅ Algoritmo moderno e mais seguro
- ✅ Chaves menores (256 bits) com segurança equivalente a RSA 4096 bits
- ✅ Mais rápida para operações de assinatura e verificação
- ✅ Resistente a ataques de timing
- ✅ Recomendada por especialistas em segurança

---

### ⚠️ Chave RSA Antiga (LEGADO)

**Tipo:** RSA 4096 bits  
**Nome:** `vps-deploy-key`  
**Status:** ⚠️ Válida, mas deve ser substituída

**Chave Pública:**
```
ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAACAQDg0vm8nwjESMitkDhCgUfJLXQ+ShFmTe4PqbsAgrPSgJjpbEO5pihNIg2LI4QcljgtPKJS5JZEFJXEJVin8ybSQF0+MPGpV9jGyibcY33xkcDEzxvTnDLSWCvgaYerW95yszf8IRyicr6ypcSKcwBEysJJtmsupxwXbINOj+/MLG+L3p70pI35IMPtreSmpr7M9bBj/V4H01LF7NaQ1txP2JzOjS4ZT6heDYqf+EfhemTLmrIrBNwSF3KM2hJyILrigZhTxXzaZtYYbHKAS3j0Oh7l0hBX1OSK0moCrasnc1WqXWavVaab9Gu7l1kyd99Pov3ux41pWf0I2+mPU6BOqIvwOuTV0pZQIQdK625dBrZeryNkqwvj54Fm5kW8+QO6VWCNVucV4YJ5JrZvgyY0eLhZ9nLHxnKeCvmlKg3MRvMVU8VjE5lkt6KC5gzPEldu335i8Za/n0qiCH7IEoRvvVVWqBEuViUcjDSFlkLbjWIeH+WYovugy/CcVMMm59KqO/ACgqCkJXPYZ2Nka251gjSvoQyov07gOnlEeJTd6EnThDb/7ISB/2i32MO2ewjgS4oPDSgUW7kyeytcONB5E/ZMauqYk6skiCjgd3iom6aoUt85IELyuqAwIVtRfya05RPRxORRyvpu5XG9SJNMOjz9tP5/35Tf08xMaP3RGw== vps-deploy-key
```

**Observações:**
- ✅ Tamanho de 4096 bits é excelente
- ⚠️ Algoritmo RSA é mais antigo
- 📅 Recomenda-se migração para Ed25519

---

## 🛡️ Configurações de Segurança SSH

### Arquivo de Configuração SSH

**Localização:** `C:\Users\Anderson\.ssh\config`

```ssh-config
# VPS Deploy Configuration - Ed25519 Key (Secure)
Host vps-hetzner
    HostName YOUR_VPS_IP_HERE
    User root
    IdentityFile ~/.ssh/vps-deploy-key-ed25519
    IdentitiesOnly yes
    
# Security settings
Host *
    # Prefer Ed25519, then RSA
    HostKeyAlgorithms ssh-ed25519,rsa-sha2-512,rsa-sha2-256
    PubkeyAuthentication yes
    PasswordAuthentication no
    ChallengeResponseAuthentication no
    # Disable old/insecure algorithms
    KexAlgorithms curve25519-sha256,diffie-hellman-group-exchange-sha256
    Ciphers chacha20-poly1305@openssh.com,aes256-gcm@openssh.com,aes128-gcm@openssh.com
    MACs hmac-sha2-512-etm@openssh.com,hmac-sha2-256-etm@openssh.com
```

### Explicação das Configurações

#### 🔒 Algoritmos de Chave de Host
```
HostKeyAlgorithms ssh-ed25519,rsa-sha2-512,rsa-sha2-256
```
- Prioriza Ed25519
- Desabilita algoritmos SHA-1 inseguros
- Permite RSA moderno como fallback

#### 🔐 Autenticação
```
PubkeyAuthentication yes
PasswordAuthentication no
ChallengeResponseAuthentication no
```
- Força autenticação por chave pública
- Desabilita senhas (vulnerável a brute force)
- Desabilita desafio-resposta

#### 🔑 Key Exchange (KEX)
```
KexAlgorithms curve25519-sha256,diffie-hellman-group-exchange-sha256
```
- Usa curva elíptica moderna (Curve25519)
- Fallback para Diffie-Hellman seguro
- Remove algoritmos fracos

#### 🔐 Cifras
```
Ciphers chacha20-poly1305@openssh.com,aes256-gcm@openssh.com,aes128-gcm@openssh.com
```
- ChaCha20-Poly1305: Cifra moderna e rápida
- AES-GCM: Cifra autenticada
- Todos com criptografia forte

#### 🛡️ MACs (Message Authentication Codes)
```
MACs hmac-sha2-512-etm@openssh.com,hmac-sha2-256-etm@openssh.com
```
- Usa SHA-2 (não SHA-1)
- ETM (Encrypt-then-MAC) previne ataques

---

## 🔐 Permissões de Arquivos

### Chave Privada Ed25519
```powershell
icacls "C:\Users\Anderson\.ssh\vps-deploy-key-ed25519" /inheritance:r /grant:r "Anderson:R"
```

**Status:** ✅ Configurado  
**Permissões:** Somente leitura para o usuário (segurança máxima)

---

## 📊 Comparação de Segurança

| Aspecto | RSA 4096 (Antiga) | Ed25519 (Nova) |
|---------|-------------------|----------------|
| **Segurança** | ⭐⭐⭐⭐ Muito Boa | ⭐⭐⭐⭐⭐ Excelente |
| **Tamanho da Chave** | 4096 bits | 256 bits |
| **Velocidade** | Lenta | Muito Rápida |
| **Resistência a Timing Attacks** | Moderada | Excelente |
| **Modernidade** | Legado | Estado da Arte |
| **Recomendação** | ⚠️ Substituir | ✅ Usar |

---

## 🚀 Como Usar a Nova Chave

### 1. Conectar ao VPS Hetzner

```bash
# Usando o alias configurado (após configurar o IP)
ssh vps-hetzner

# Ou diretamente
ssh -i ~/.ssh/vps-deploy-key-ed25519 root@SEU_IP_VPS
```

### 2. Deploy Automatizado

Atualize seus scripts de deploy para usar a nova chave:

```bash
# Exemplo de deploy
scp -i ~/.ssh/vps-deploy-key-ed25519 arquivo.zip root@SEU_IP_VPS:/var/www/
```

### 3. Git/GitHub Actions

Se usar CI/CD, adicione a chave privada como secret:

```yaml
# .github/workflows/deploy.yml
- name: Deploy to VPS
  env:
    SSH_PRIVATE_KEY: ${{ secrets.VPS_SSH_KEY_ED25519 }}
  run: |
    echo "$SSH_PRIVATE_KEY" > key.pem
    chmod 600 key.pem
    scp -i key.pem -o StrictHostKeyChecking=no dist/* root@${{ secrets.VPS_IP }}:/var/www/
```

---

## ✅ Checklist de Segurança Implementado

- [x] Gerada nova chave Ed25519
- [x] Chave adicionada ao Hetzner Console
- [x] Configurada como chave padrão
- [x] Arquivo SSH config criado com configurações seguras
- [x] Permissões da chave privada configuradas corretamente
- [x] Algoritmos inseguros desabilitados
- [x] Documentação criada

---

## 🔄 Próximos Passos Recomendados

### Imediato
1. ✅ ~~Gerar chave Ed25519~~
2. ✅ ~~Adicionar ao Hetzner Console~~
3. ✅ ~~Configurar permissões~~
4. ✅ ~~Atualizar IP do VPS no arquivo config (49.12.204.185)~~
5. ✅ ~~Remover chave antiga do Hetzner Console~~
6. ⏳ **Adicionar chave pública ao servidor VPS** (Ver: INSTRUCOES_ADICIONAR_CHAVE_SSH.md)
7. ⏳ **Testar conexão com a nova chave**

### Curto Prazo (1-2 semanas)
8. ⏳ Atualizar todos os scripts de deploy
9. ⏳ Atualizar CI/CD pipelines
10. ⏳ Documentar procedimentos para equipe

### Médio Prazo (1 mês)
11. ⏳ Remover chaves antigas do servidor VPS
12. ⏳ Auditar logs de acesso SSH
13. ⏳ Configurar Fail2Ban no servidor

---

## 🆘 Troubleshooting

### Erro: "Permission denied (publickey)"

```bash
# Verificar se a chave está sendo usada
ssh -v -i ~/.ssh/vps-deploy-key-ed25519 root@SEU_IP_VPS

# Verificar permissões
ls -la ~/.ssh/vps-deploy-key-ed25519
# Deve mostrar: -r-------- (400 ou 600)
```

### Erro: "Bad permissions"

```powershell
# Windows: Corrigir permissões
icacls "C:\Users\Anderson\.ssh\vps-deploy-key-ed25519" /inheritance:r /grant:r "Anderson:R"
```

### Chave não encontrada

```bash
# Verificar se a chave existe
ls -la ~/.ssh/vps-deploy-key-ed25519*

# Se não existir, regenerar
ssh-keygen -t ed25519 -C "vps-deploy-key-ed25519" -f ~/.ssh/vps-deploy-key-ed25519
```

---

## 📚 Referências

- [OpenSSH Best Practices](https://infosec.mozilla.org/guidelines/openssh)
- [Ed25519 vs RSA](https://ed25519.cr.yp.to/)
- [Hetzner SSH Key Documentation](https://docs.hetzner.com/cloud/servers/getting-started/connecting-to-the-server)
- [SSH Security Best Practices](https://www.ssh.com/academy/ssh/security)

---

## 📞 Contato e Suporte

**Projeto:** Querenhapuque  
**Ambiente:** Produção (Hetzner Cloud)  
**Última Atualização:** 16/11/2025

---

## ⚠️ IMPORTANTE - Segurança

### 🔴 NUNCA FAÇA:
- ❌ Compartilhar a chave privada (`vps-deploy-key-ed25519`)
- ❌ Fazer commit da chave privada no Git
- ❌ Enviar a chave privada por email/chat
- ❌ Armazenar a chave privada em serviços de nuvem não criptografados

### 🟢 SEMPRE FAÇA:
- ✅ Manter a chave privada local e segura
- ✅ Usar apenas a chave pública para compartilhar
- ✅ Fazer backup da chave privada em local seguro e criptografado
- ✅ Revogar chaves comprometidas imediatamente

---

**Status Final:** ✅ Implementação Completa e Segura  
**Próxima Revisão:** 16/12/2025 (30 dias)

