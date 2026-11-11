# Gestor Pro - Sistema de Gestão Empresarial (CRM + Financeiro)

Sistema web completo de ERP empresarial para pequenas e médias empresas brasileiras, integrando CRM com Funil Kanban, Gestão Financeira Completa (Contas a Pagar/Receber, Fluxo de Caixa, DRE Simplificado), Cadastro de Clientes e Fornecedores com ViaCEP, Catálogo de Produtos e Serviços, Emissão de Orçamentos e Vendas com baixa de estoque, Agenda de Tarefas e Relatórios Gerenciais com impressão e exportação em PDF e Excel.

---

## 🚀 Tecnologias Utilizadas

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS v4
- **Banco de Dados & Autenticação:** Google Firebase (Cloud Firestore, Firebase Authentication)
- **Gráficos & Dashboards:** Recharts
- **Kanban Interativo:** @dnd-kit/core e @dnd-kit/sortable
- **Manipulação de Datas:** date-fns (localizado em pt-BR)
- **Ícones:** Lucide React
- **Geração de Documentos:** jsPDF (Orçamentos, Fichas e Recibos com valor por extenso em Português)
- **Hospedagem Recomendada:** Cloudflare Pages (SPA estático com `public/_redirects`)

---

## 📋 Passo a Passo de Configuração

### 1. Criar o Projeto no Firebase
1. Acesse o [Firebase Console](https://console.firebase.google.com/) com sua conta Google.
2. Clique em **"Adicionar projeto"** e defina o nome (ex: `gestor-pro-minhaempresa`).
3. O Google Analytics é opcional. Clique em **"Criar projeto"**.

### 2. Ativar os Serviços no Firebase

#### A. Firebase Authentication
1. No menu lateral, acesse **Build > Authentication**.
2. Clique em **"Vamos começar"**.
3. Na aba **Sign-in method**, ative o provedor **"E-mail/senha"** (ative a primeira opção "Permitir que os usuários façam login com o endereço de e-mail e a senha").
4. Salve a configuração.

#### B. Cloud Firestore
1. No menu lateral, acesse **Build > Firestore Database**.
2. Clique em **"Criar banco de dados"**.
3. Escolha a região mais próxima (ex: `southamerica-east1` em São Paulo/SP ou `us-east1`).
4. Inicie em modo de produção (as regras de segurança serão publicadas no passo 4).

#### C. Firebase Storage (Opcional para comprovantes)
1. No menu lateral, acesse **Build > Storage**.
2. Clique em **"Começar"** e selecione a região padrão.

---

### 3. Obter as Chaves e Preencher o `.env`
1. No Console do Firebase, clique no ícone de engrenagem ⚙️ no topo esquerdo > **Configurações do projeto**.
2. Na aba **Geral**, desça até a seção **"Seus aplicativos"** e clique no ícone Web (`</>`).
3. Registre o app com o nome `Gestor Pro Web`.
4. Copie os valores do objeto `firebaseConfig` e crie um arquivo `.env` na raiz do projeto (baseado no `.env.example`):

```env
VITE_FIREBASE_API_KEY="AIzaSy..."
VITE_FIREBASE_AUTH_DOMAIN="seu-projeto.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="seu-projeto"
VITE_FIREBASE_STORAGE_BUCKET="seu-projeto.appspot.com"
VITE_FIREBASE_MESSAGING_SENDER_ID="1234567890"
VITE_FIREBASE_APP_ID="1:1234567890:web:abcdef123456"
```

---

### 4. Publicar as Regras de Segurança (`firestore.rules`)
No Firebase Console, acesse **Firestore Database > Regras** e cole o conteúdo do arquivo `firestore.rules` deste repositório:

- Apenas usuários autenticados podem ler e registrar lançamentos.
- Apenas usuários com perfil **Admin** (`role: 'admin'`) podem excluir lançamentos e gerenciar usuários.
- Usuários comuns (funcionários) não conseguem alterar seus próprios privilégios nem acessar a aba de Configurações.

---

### 5. Criar o Primeiro Usuário Administrador
1. Inicie a aplicação localmente com `npm run dev` ou acesse a URL do deploy.
2. Na tela de login, clique em **"Cadastrar / Entrar"** ou use o botão de demonstração.
3. Ao cadastrar o primeiro e-mail com a palavra `admin` ou seu e-mail configurado em `firestore.rules`, o sistema concederá automaticamente o perfil de **Administrador**.
4. Acesse a aba **Configurações > Gestão de Usuários** para convidar outros colaboradores e definir perfis.
5. Na aba **Configurações > Dados de Demonstração**, você pode clicar em **"Carregar Dados de Demonstração"** para popular instantaneamente 6 meses de histórico financeiro, funil de vendas e produtos.

---

### 6. Publicação no Cloudflare Pages
O projeto já inclui o arquivo `public/_redirects` contendo `/* /index.html 200`, garantindo suporte perfeito ao roteamento SPA.

1. Acesse o painel do [Cloudflare Dashboard](https://dash.cloudflare.com/) > **Workers & Pages**.
2. Clique em **Create application > Pages > Connect to Git**.
3. Selecione seu repositório GitHub / GitLab.
4. Defina os parâmetros de compilação:
   - **Framework preset:** `Vite`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Node.js version:** `20` ou superior (adicione a variável de ambiente `NODE_VERSION=20` se necessário)
5. Na seção **Environment variables (Variáveis de ambiente)**, adicione todas as chaves `VITE_FIREBASE_*` configuradas no seu `.env`.
6. Clique em **Save and Deploy**. O sistema estará online em um domínio seguro com SSL gratuito e CDN global!

---

## 🔒 Auditoria e Permissões (RBAC)

| Módulo | Administrador | Funcionário |
| :--- | :---: | :---: |
| **Dashboard & Indicadores** | Visualiza e Filtra | Visualiza e Filtra |
| **CRM Funil de Vendas** | Criar, Editar, Excluir | Criar, Editar (Sem excluir) |
| **Financeiro & Contas** | Acesso Total + Exclusão | Lançar, Baixar, Visualizar |
| **Clientes & Fornecedores** | Total + Fichas | Total + Fichas (Sem excluir) |
| **Orçamentos & Vendas** | Total + Aprovar Venda | Emitir, Imprimir e Enviar |
| **Tarefas & Agenda** | Total | Total |
| **Relatórios & DRE** | Visualizar e Imprimir | Visualizar e Imprimir |
| **Configurações da Empresa** | ✅ Acesso Permitido | ❌ Bloqueado |
| **Gestão de Usuários** | ✅ Acesso Permitido | ❌ Bloqueado |
| **Backup / Importação JSON** | ✅ Acesso Permitido | ❌ Bloqueado |

---

## 📄 Licença e Suporte
Desenvolvido para uso empresarial interno com padrão de alta disponibilidade e conformidade fiscal/operacional brasileira.
