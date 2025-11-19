# 📚 Documentação Técnica - Infraestrutura

## 📁 Estrutura da Documentação

Este diretório contém toda a documentação técnica do projeto Querenhapuque.

### 📂 Subpastas

- **`hetzner/`** - Documentação sobre segurança SSH e configuração do servidor Hetzner
- **`coolify-admin/`** - Documentação completa do Coolify Admin (credenciais, acessos e guias)
- **`docker/`** - Documentação completa sobre Docker e Docker Compose

### 📄 Arquivos na pasta `hetzner/`

| Arquivo | Descrição |
|---------|-----------|
| **README_FINAL.md** | Resumo executivo da implementação SSH |
| **PASSO_FINAL_SIMPLES.md** | Instruções finais simplificadas |
| **SECURITY_SSH_KEYS.md** | Documentação técnica das chaves SSH |
| **INSTRUCOES_ADICIONAR_CHAVE_SSH.md** | Guia passo a passo |
| **COMANDOS_RAPIDOS.md** | Comandos úteis SSH |
| **VPS_LOGIN_INFO.txt** | Informações de acesso ao VPS |
| **RESUMO_IMPLEMENTACAO.txt** | Resumo visual da implementação |
| **CONCLUSAO_IMPLEMENTACAO.md** | Relatório técnico completo |

### 📄 Arquivos na pasta `coolify-admin/`

| Arquivo | Descrição |
|---------|-----------|
| **README.md** | Índice completo da documentação Coolify ⭐ |
| **CREDENCIAIS_ACESSO.md** | 🔐 Todas as senhas, tokens e acessos |
| **CONFIGURACAO_COMPLETA.md** | ✅ Status e resumo da implementação |
| **GUIA_RAPIDO.md** | ⚡ Ações rápidas e comandos essenciais |

### 📄 Arquivos na pasta `docker/`

| Arquivo | Descrição |
|---------|-----------|
| **README.md** | 🐳 Índice da documentação Docker |
| **SETUP_COMPLETO.md** | 🏗️ Configuração detalhada e arquitetura |
| **COMANDOS_UTEIS.md** | 🛠️ Comandos Docker do dia a dia |
| **DEPLOY_SERVIDOR.md** | 🌐 Deploy no servidor Hetzner |
| **TROUBLESHOOTING.md** | 🐛 Solução de problemas comuns |

---

## 🚀 Início Rápido

### 🎯 Acesso ao Coolify Admin

**COMECE AQUI:** `coolify-admin/README.md`

1. **`coolify-admin/CREDENCIAIS_ACESSO.md`** - 🔐 Senhas e acessos
2. **`coolify-admin/GUIA_RAPIDO.md`** - ⚡ Ações imediatas
3. **`coolify-admin/CONFIGURACAO_COMPLETA.md`** - ✅ Status completo

### 🔧 Configuração SSH (Hetzner)

1. **`hetzner/README_FINAL.md`** - Resumo executivo
2. **`hetzner/VPS_LOGIN_INFO.txt`** - Informações de acesso
3. **`hetzner/SECURITY_SSH_KEYS.md`** - Documentação técnica

### 🐳 Docker e Deploy

**COMECE AQUI:** `docker/README.md`

1. **`docker/SETUP_COMPLETO.md`** - 🏗️ Arquitetura e configuração
2. **`docker/COMANDOS_UTEIS.md`** - 🛠️ Comandos do dia a dia
3. **`docker/DEPLOY_SERVIDOR.md`** - 🌐 Deploy no Hetzner
4. **`docker/TROUBLESHOOTING.md`** - 🐛 Solução de problemas

---

## 📖 Guias de Leitura Recomendados

### 🌐 Para Usar o Coolify (Prioridade):
1. **`coolify-admin/README.md`** - Índice completo ⭐
2. **`coolify-admin/CREDENCIAIS_ACESSO.md`** - Senhas e tokens 🔐
3. **`coolify-admin/GUIA_RAPIDO.md`** - Comandos essenciais ⚡
4. **`coolify-admin/CONFIGURACAO_COMPLETA.md`** - Status do sistema ✅

### 🔧 Para Administração SSH:
5. **`hetzner/VPS_LOGIN_INFO.txt`** - Credenciais de acesso
6. **`hetzner/SECURITY_SSH_KEYS.md`** - Documentação técnica
7. **`hetzner/COMANDOS_RAPIDOS.md`** - Comandos úteis SSH

---

## 🔐 Informações de Segurança

### Chaves SSH Criadas:

**Chave Privada (NUNCA COMPARTILHE):**
- Localização: `C:\Users\Anderson\.ssh\vps-deploy-key-ed25519`
- Tipo: Ed25519 (256 bits)
- Uso: Autenticação SSH no VPS

**Chave Pública (Pode ser compartilhada):**
- Localização: `C:\Users\Anderson\.ssh\vps-deploy-key-ed25519.pub`
- Fingerprint: `SHA256:kxA1N1fS82dVxnPKl/67Y7yL3ajIacbx0z6QCjnjOsA`

**Configuração SSH:**
- Localização: `C:\Users\Anderson\.ssh\config`
- Alias: `vps-hetzner`
- IP: `49.12.204.185`

---

## 🛡️ Melhorias de Segurança Implementadas

- ✅ **Algoritmo Ed25519** - Mais moderno e seguro que RSA
- ✅ **Chave única ativa** - Removida chave antiga
- ✅ **Cifras modernas** - ChaCha20-Poly1305, AES-GCM
- ✅ **SHA-1 desabilitado** - Apenas SHA-2
- ✅ **Autenticação por chave** - Senha desabilitada
- ✅ **Permissões restritas** - 700 e 600

---

## 📊 Status da Implementação

```
Progresso: 100% Completo ✅

┌─────────────────────────────────────┐
│ ✅ Gerar chave Ed25519              │
│ ✅ Adicionar ao Hetzner Console     │
│ ✅ Remover chave antiga             │
│ ✅ Configurar SSH config            │
│ ✅ Aplicar permissões               │
│ ✅ Adicionar chave ao servidor      │
│ ✅ Configurar Coolify Admin         │
│ ✅ Instalar Docker Engine           │
│ ✅ Validar servidor                 │
│ ✅ Criar documentação completa      │
└─────────────────────────────────────┘

🎉 SISTEMA TOTALMENTE OPERACIONAL
```

---

## 🔧 Troubleshooting

### Problema: "Permission denied (publickey)"

**Solução:** A chave ainda não foi adicionada ao servidor. Siga as instruções em `INSTRUCOES_ADICIONAR_CHAVE_SSH.md`.

### Problema: "Connection refused"

**Solução:** Verifique se o servidor está ligado no Hetzner Console.

### Problema: Não consigo acessar o console web

**Solução:** Use a senha root via SSH:
```bash
ssh root@49.12.204.185
# Senha: TxWf3TUwHkUR
```

---

## 📞 Suporte e Links

### Coolify Admin:
- **Painel:** https://coolify-admin.ouvir.online
- **Servidor VPS:** https://coolify-admin.ouvir.online/server/j8skk40s4ks048coog8gw08c
- **Documentação:** `coolify-admin/README.md`

### Hetzner:
- **Console:** https://console.hetzner.com/projects/12020010/servers/110118995
- **Documentação SSH:** `hetzner/SECURITY_SSH_KEYS.md`

### Recursos Externos:
- **Coolify Docs:** https://coolify.io/docs
- **Hetzner Support:** https://console.hetzner.com/support

---

## ⚠️ Avisos Importantes

### 🔴 NUNCA FAÇA:
- ❌ Compartilhar a chave privada
- ❌ Fazer commit da chave privada no Git
- ❌ Enviar a chave privada por email/chat

### 🟢 SEMPRE FAÇA:
- ✅ Manter a chave privada local e segura
- ✅ Fazer backup em local criptografado
- ✅ Usar apenas a chave pública para compartilhar

---

**Data de Criação:** 16/11/2025  
**Última Atualização:** 16/11/2025 - 18:15  
**Projeto:** Querenhapuque  
**Servidor:** Collify-admin (49.12.204.185)  
**Status:** ✅ Sistema 100% Operacional

