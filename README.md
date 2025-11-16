# 🦋 Querenhapuque - Plataforma de Eventos e E-commerce

Uma plataforma moderna e escalável para venda e gerenciamento de ingressos e produtos, construída com React, TypeScript, Supabase e Tailwind CSS.

## 📋 Índice

- [Sobre o Projeto](#sobre-o-projeto)
- [Tecnologias](#tecnologias)
- [Pré-requisitos](#pré-requisitos)
- [Instalação](#instalação)
- [Configuração](#configuração)
- [Uso](#uso)
- [Scripts Disponíveis](#scripts-disponíveis)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Funcionalidades](#funcionalidades)
- [Deploy](#deploy)
- [Contribuindo](#contribuindo)
- [Licença](#licença)

## 🎯 Sobre o Projeto

Querenhapuque é uma plataforma completa que integra:

- **Sistema de Ingressos**: Venda e gerenciamento de ingressos para eventos
- **E-commerce**: Loja online para produtos (roupas, acessórios, etc.)
- **Pagamentos**: Integração com AbacatePay e Mercado Pago
- **Dashboard Admin**: Painel administrativo completo
- **Sistema de Webhooks**: Processamento em tempo real de pagamentos
- **Monitoramento**: Sistema de logs e métricas

## 🚀 Tecnologias

### Frontend
- **React 18** - Biblioteca UI
- **TypeScript** - Tipagem estática
- **Vite** - Build tool e dev server
- **Tailwind CSS** - Framework CSS
- **Radix UI** - Componentes acessíveis
- **React Router** - Roteamento
- **React Query** - Gerenciamento de estado servidor
- **Framer Motion** - Animações

### Backend & Infraestrutura
- **Supabase** - Backend as a Service (PostgreSQL, Auth, Storage)
- **Express** - Servidor de webhooks
- **Node.js** - Runtime
- **AbacatePay SDK** - Pagamentos PIX
- **Brevo** - E-mail transacional

### Ferramentas de Desenvolvimento
- **ESLint** - Linting
- **Jest** - Testes
- **TypeScript** - Type checking
- **Git** - Controle de versão

## 📦 Pré-requisitos

- Node.js 18+ 
- npm ou yarn
- Conta Supabase
- Conta AbacatePay (para pagamentos)
- Conta Brevo (para e-mails)

## 🔧 Instalação

1. Clone o repositório:
```bash
git clone https://github.com/Andersondos7000/site-queren-2025.git
cd querenhapuque
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente (veja [Configuração](#configuração))

## ⚙️ Configuração

Crie um arquivo `.env.local` na raiz do projeto com as seguintes variáveis:

```env
# Supabase
VITE_SUPABASE_URL=sua_url_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_anonima

# AbacatePay
VITE_ABACATEPAY_API_KEY=sua_chave_api
VITE_ABACATEPAY_WEBHOOK_SECRET=seu_webhook_secret

# Brevo
VITE_BREVO_API_KEY=sua_chave_brevo

# Outras configurações
VITE_APP_URL=http://localhost:8082
```

## 🎮 Uso

### Desenvolvimento

Inicie o servidor de desenvolvimento:
```bash
npm run dev
```

A aplicação estará disponível em `http://localhost:8082`

### Desenvolvimento Completo (com webhooks)

Para rodar a aplicação com todos os serviços:
```bash
npm run dev:full
```

Isso iniciará:
- Frontend (Vite)
- Servidor de webhooks
- Webhook AbacatePay

## 📜 Scripts Disponíveis

```bash
# Desenvolvimento
npm run dev              # Inicia servidor de desenvolvimento
npm run dev:webhook      # Inicia servidor de webhooks
npm run dev:full         # Inicia todos os serviços

# Build
npm run build            # Build de produção

# Preview
npm run preview          # Preview do build

# Testes
npm run test             # Executa testes
npm run test:watch       # Testes em modo watch
npm run test:coverage    # Cobertura de testes

# Linting
npm run lint             # Executa ESLint

# Reconciliação
npm run reconciliation:start   # Inicia serviço de reconciliação
npm run reconciliation:run     # Executa reconciliação
npm run reconciliation:test    # Testa reconciliação
```

## 📁 Estrutura do Projeto

```
querenhapuque/
├── src/
│   ├── api/              # APIs e integrações
│   ├── components/       # Componentes React
│   │   ├── admin/       # Componentes admin
│   │   ├── auth/        # Componentes de autenticação
│   │   ├── cart/        # Carrinho de compras
│   │   ├── checkout/    # Processo de checkout
│   │   ├── payment/     # Componentes de pagamento
│   │   └── ui/          # Componentes UI reutilizáveis
│   ├── contexts/        # Contextos React
│   ├── hooks/           # Custom hooks
│   ├── lib/             # Bibliotecas e utilitários
│   ├── pages/           # Páginas da aplicação
│   ├── services/        # Serviços e lógica de negócio
│   ├── types/           # Definições TypeScript
│   └── utils/           # Funções utilitárias
├── public/              # Arquivos estáticos
├── supabase/            # Configurações Supabase
│   ├── functions/       # Edge Functions
│   └── migrations/      # Migrações SQL
├── docs/                # Documentação
└── monitoring/          # Scripts de monitoramento
```

## ✨ Funcionalidades

### Para Usuários
- ✅ Navegação intuitiva e responsiva
- ✅ Catálogo de produtos e ingressos
- ✅ Carrinho de compras
- ✅ Checkout seguro
- ✅ Pagamento via PIX (AbacatePay)
- ✅ Perfil de usuário
- ✅ Histórico de pedidos
- ✅ Tickets digitais com QR Code

### Para Administradores
- ✅ Dashboard com métricas em tempo real
- ✅ Gerenciamento de produtos
- ✅ Gerenciamento de ingressos
- ✅ Gerenciamento de pedidos
- ✅ Gerenciamento de usuários
- ✅ Monitoramento de webhooks
- ✅ Relatórios e exportações
- ✅ Sistema de logs

### Técnicas
- ✅ Autenticação JWT
- ✅ RLS (Row Level Security) no Supabase
- ✅ Webhooks em tempo real
- ✅ Sistema de reconciliação de pagamentos
- ✅ Anti-duplicação de pedidos
- ✅ Rate limiting
- ✅ Monitoramento de performance
- ✅ Sistema de alertas

## 🚀 Deploy

### Vercel (Recomendado para Frontend)

1. Conecte seu repositório ao Vercel
2. Configure as variáveis de ambiente
3. Deploy automático a cada push

### VPS (Para Backend/Webhooks)

Documentação completa em `docs/deployment/`

```bash
# Build
npm run build

# Inicie o servidor
npm run preview
```

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença ISC.

## 👥 Autores

- **Anderson** - [GitHub](https://github.com/Andersondos7000)

## 🙏 Agradecimentos

- Equipe Supabase
- Comunidade React
- AbacatePay
- Todos os contribuidores

## 📞 Suporte

Para suporte, envie um email para [seu-email] ou abra uma issue no GitHub.

---

**Desenvolvido com ❤️ para eventos incríveis! 🦋**

