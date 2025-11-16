# 🔧 Guia de Configuração - Querenhapuque

## 📋 Variáveis de Ambiente Necessárias

Para rodar a aplicação, você precisa configurar as seguintes variáveis de ambiente.

### Como Configurar

1. Crie um arquivo `.env.local` na raiz do projeto
2. Copie o template abaixo e preencha com suas credenciais
3. **NUNCA** commite este arquivo no Git!

### Template de Configuração

```env
# ========================================
# SUPABASE
# ========================================
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_anonima_aqui

# ========================================
# ABACATEPAY (Pagamentos PIX)
# ========================================
VITE_ABACATEPAY_API_KEY=sua_chave_api_abacatepay
VITE_ABACATEPAY_WEBHOOK_SECRET=seu_webhook_secret

# ========================================
# BREVO (Serviço de E-mail)
# ========================================
VITE_BREVO_API_KEY=sua_chave_brevo

# ========================================
# URLs DA APLICAÇÃO
# ========================================
VITE_APP_URL=http://localhost:8082
VITE_WEBHOOK_URL=http://localhost:3001

# ========================================
# AMBIENTE
# ========================================
NODE_ENV=development
```

## 🔐 Onde Obter as Credenciais

### Supabase

1. Acesse [supabase.com](https://supabase.com)
2. Crie um projeto ou acesse um existente
3. Vá em **Settings** > **API**
4. Copie:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon/public key** → `VITE_SUPABASE_ANON_KEY`

### AbacatePay

1. Acesse [abacatepay.com](https://abacatepay.com)
2. Faça login na sua conta
3. Vá em **Configurações** > **API**
4. Copie:
   - **API Key** → `VITE_ABACATEPAY_API_KEY`
   - **Webhook Secret** → `VITE_ABACATEPAY_WEBHOOK_SECRET`

### Brevo (antigo Sendinblue)

1. Acesse [brevo.com](https://brevo.com)
2. Faça login na sua conta
3. Vá em **SMTP & API** > **API Keys**
4. Crie uma nova chave ou use uma existente
5. Copie → `VITE_BREVO_API_KEY`

## ✅ Verificação da Configuração

Após configurar, execute:

```bash
npm run dev
```

Se tudo estiver correto, você verá:
- ✅ Servidor rodando em `http://localhost:8082`
- ✅ Sem erros de variáveis de ambiente no console

## ⚠️ Problemas Comuns

### Erro: "Variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórias"

**Solução:** Certifique-se de que o arquivo `.env.local` existe e contém as variáveis corretas.

### Erro: "Failed to fetch"

**Solução:** Verifique se as URLs do Supabase estão corretas e se o projeto está ativo.

### Webhooks não funcionam

**Solução:** 
1. Certifique-se de que `VITE_WEBHOOK_URL` está configurado
2. Para desenvolvimento local, use uma ferramenta como ngrok para expor localhost
3. Configure o webhook no painel do AbacatePay

## 🔒 Segurança

### ⚠️ IMPORTANTE

- ❌ **NUNCA** commite arquivos `.env` ou `.env.local` no Git
- ❌ **NUNCA** compartilhe suas chaves de API publicamente
- ❌ **NUNCA** use chaves de produção em desenvolvimento
- ✅ Use variáveis de ambiente diferentes para cada ambiente
- ✅ Mantenha backups seguros das suas credenciais
- ✅ Rotacione suas chaves periodicamente

## 📚 Documentação Adicional

- [Documentação Supabase](https://supabase.com/docs)
- [Documentação AbacatePay](https://docs.abacatepay.com)
- [Documentação Brevo](https://developers.brevo.com)

## 🆘 Suporte

Se você encontrar problemas:

1. Verifique se todas as variáveis estão configuradas
2. Verifique se as credenciais estão corretas
3. Consulte a documentação oficial dos serviços
4. Abra uma issue no GitHub se o problema persistir

