# Assistente Financeiro - Setup & Configuração

## 🚀 Quick Start Local

### 1. Instalar Dependências
```bash
npm install
```

### 2. Variáveis de Ambiente
Crie um arquivo `.env.local` na raiz do projeto:

```env
# Supabase (Required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Supabase (Scripts / Admin)
SUPABASE_DB_URL=postgresql://USER:PASSWORD@HOST:PORT/postgres

# Meta WhatsApp (Opcional - para depois)
META_VERIFY_TOKEN=seu-token-qualquer-coisa
META_ACCESS_TOKEN=seu-access-token-da-meta
META_PHONE_NUMBER_ID=your_phone_number_id

# OpenAI (Opcional - para IA)
OPENAI_API_KEY=sua-chave-openai
```

### 3. Rodar Servidor Dev
```bash
npm run dev
```

Acesse `http://localhost:3000`

### 4. Build para Produção
```bash
npm run build
npm start
```

---

## 🚀 Deploy no Vercel

### Pré-requisitos
- Conta Vercel (vercel.com)
- GitHub conectado
- Variáveis de ambiente prontas

### Passos

1. **Ir para Vercel Dashboard**
   - [vercel.com](https://vercel.com)

2. **Criar Novo Projeto**
   - Clique em "New Project"
   - Selecione seu repositório GitHub `assistente-financeiro`
   - Autorize o Vercel

3. **Configurar Environment Variables**
   - Vá para **Settings** → **Environment Variables**
   - Adicione as 2 variáveis Supabase:
     - `NEXT_PUBLIC_SUPABASE_URL=...`
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY=...`

4. **Deploy**
   - Clique em **Deploy**
   - Aguarde ~2 minutos
   - Você receberá uma URL: `https://seu-projeto.vercel.app`

5. **Testar**
   - Acesse a URL
   - Faça login com Supabase Auth
   - Teste CRUD de transações, contas, lembretes, etc.

### Adicionar Variáveis Later (WhatsApp + OpenAI)
Quando quiser ativar WhatsApp:
1. Volte ao Vercel → Settings → Environment Variables
2. Adicione as 4 variáveis Meta + OpenAI
3. Redeploye clicando em "Redeploy"

---

## 📋 Funcionalidades

### ✅ Web (Implementado)
- **Transações**: Adicionar, editar, excluir receitas e despesas
- **Contas**: Gerenciar contas a pagar/receber com suporte a recorrência
- **Lembretes**: Criar, editar, marcar como concluído
- **Metas Financeiras**: Adicionar, editar, acompanhar progresso
- **Dashboard**: Resumo financeiro com gráficos
- **Relatórios**: Análise de despesas e receitas

### 🚀 WhatsApp Bot (Conectado a Meta Cloud API)
- Receber mensagens via WhatsApp
- Processar com OpenAI (extrair dados financeiros)
- Responder inteligentemente
- Salvar transações automaticamente
- *(Setup after web deployment)*

### 🎨 Design
- Interface premium com paleta: Preto, Dourado, Grafite
- Responsivo (desktop, tablet, mobile)
- Dark mode por padrão
- Componentes shadcn/ui

---

## 🗄️ Banco de Dados (Supabase)

### Tabelas Obrigatórias
```sql
-- Usuários
CREATE TABLE users (...)

-- Transações
CREATE TABLE transactions (...)

-- Contas a Pagar/Receber
CREATE TABLE accounts_payable (...)
CREATE TABLE accounts_receivable (...)

-- Lembretes
CREATE TABLE reminders (...)

-- Metas Financeiras
CREATE TABLE financial_goals (...)

-- Categorias
CREATE TABLE categories (...)
```

Execute as migrações:
```bash
node apply-migration.js
```

---

## 📁 Estrutura do Projeto

```
src/
├── app/
│   ├── layout.tsx          # Layout principal
│   ├── page.tsx            # Dashboard
│   ├── transactions/       # Gerenciar transações
│   ├── bills/              # Contas a pagar/receber
│   ├── reminders/          # Lembretes
│   ├── goals/              # Metas financeiras
│   ├── reports/            # Relatórios
│   └── api/
│       └── whatsapp/webhook/   # Webhook Twilio
├── components/
│   ├── Dashboard.tsx       # Componente Dashboard
│   ├── Navigation.tsx      # Navegação
│   └── ui/                 # Componentes shadcn
├── lib/
│   ├── supabase.ts        # Cliente Supabase
│   └── utils.ts           # Utilitários
└── hooks/
    └── use-toast.ts       # Toast notifications
```

---

## 🔐 Segurança

- **Row-Level Security (RLS)**: Habilitado no Supabase
- **Autenticação**: Supabase Auth (JWT)
- **Variáveis Secretas**: Nunca commit `.env.local`

---

## 🐛 Troubleshooting

### Erro: "Supabase não está configurado"
Verifique se `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` estão no `.env.local`

### Erro: "Twilio não está configurado"
Twilio é opcional. Se não usar WhatsApp, deixe as vars vazias.

### Erro de compilação TypeScript
```bash
npm run build
```

### Limpar cache Next.js
```bash
rm -rf .next
npm run dev
```

---

## 📞 Contato & Suporte

Para dúvidas, abra uma issue no repositório.

---

## 📄 Licença

MIT License - Veja LICENSE.md
