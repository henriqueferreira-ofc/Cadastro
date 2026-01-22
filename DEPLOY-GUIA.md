# 🚀 GUIA DE DEPLOY - BACKEND EM PRODUÇÃO

## PASSO 1: Deploy do Backend em Render.com

### 1.1) Criar conta no Render

1. Acesse: https://render.com
2. Clique em "Sign up"
3. Conecte com GitHub (selecione sua conta)
4. Autorize a integração

### 1.2) Criar novo Web Service

1. No dashboard do Render, clique em "+ New"
2. Selecione "Web Service"
3. Selecione o repositório: `henriqueferreira-ofc/Cadastro`
4. Clique em "Connect"

### 1.3) Configurar o serviço

Na página de configuração, preencha:

**Name:** `cadastro-api` (ou qualquer nome)

**Environment:** Node

**Build Command:**

```
cd server && npm install && npm run build
```

**Start Command:**

```
cd server && npm start
```

**Pricing Plan:** Free (gratuito)

### 1.4) Adicionar variáveis de ambiente

Clique em "Add Secret File" ou "Environment" e adicione:

```
DATABASE_URL=postgresql://neondb_owner:npg_BLDNS9Cbi2Zn@ep-green-forest-ah16jo77-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require

ADMIN_PASSWORD=AAFAB@2026#Secure!

JWT_SECRET=aafab_jwt_ultra_secret_key_2024_change_in_production

PORT=3001
```

⚠️ IMPORTANTE: Copie os valores exatos do arquivo `/server/.env`

### 1.5) Deploy

Clique em "Create Web Service"

Aguarde 5-10 minutos. Você verá uma URL como:

```
https://cadastro-api-xxxxx.onrender.com
```

✅ Seu backend está deployado!

---

## PASSO 2: Atualizar URL em Produção

### 2.1) Atualizar .env.production

Edite o arquivo `.env.production`:

```bash
VITE_API_URL=https://cadastro-api-xxxxx.onrender.com/api
```

Substitua `cadastro-api-xxxxx` pela URL real do seu serviço.

### 2.2) Fazer commit e push

```bash
cd /Users/henriquecesararaujoferreira/Desktop/Cadastro
git add .env.production
git commit -m "Update: API URL para produção no Render"
git push origin main
```

Aguarde o GitHub Pages fazer deploy automaticamente (~2 minutos).

---

## PASSO 3: Configurar Domínio na GoDaddy (OPCIONAL)

Se quiser usar um subdomínio como `api.aafab.com.br`:

### 3.1) Acessar DNS da GoDaddy

1. Vá para https://godaddy.com
2. Faça login
3. Acesse "My Products" → "Domains"
4. Selecione `aafab.com.br`
5. Clique em "Manage DNS"

### 3.2) Adicionar registro CNAME

Procure pela seção "Records" e clique em "Add"

- **Type:** CNAME
- **Name:** api (para criar api.aafab.com.br)
- **Value:** cadastro-api-xxxxx.onrender.com (copie de Render)
- **TTL:** 1 hour

Clique em "Save"

### 3.3) Configurar SSL no Render

1. Volte ao dashboard do Render
2. Vá para seu serviço
3. Em "Custom Domain", clique em "Add"
4. Digite: `api.aafab.com.br`
5. Siga as instruções para validar o domínio

---

## PASSO 4: Testar

### 4.1) Teste local (desenvolvimento)

```bash
# Terminal 1
cd server && npm run dev

# Terminal 2
curl http://localhost:3001/health
# Deve retornar: {"status":"ok","timestamp":"..."}
```

### 4.2) Teste em produção

```bash
curl https://cadastro-api-xxxxx.onrender.com/health
# Deve retornar o mesmo
```

### 4.3) Testar painel admin

1. Abra https://aafab.com.br no computador
2. Clique em "Admin" → Digite senha
3. Deve ver TODOS os cadastros do banco de dados

---

## ❓ DÚVIDAS COMUNS

**P: Quanto custa?**
R: Render grátis tem limite de 750h/mês (suficiente para produção)

**P: Meus dados estão seguros?**
R: Sim! Usa a mesma conexão com Neon que você já tem

**P: Preciso fazer algo mais?**
R: Não! Tudo é automático via GitHub

**P: E se eu quiser usar outro serviço?**
R: Veja as alternativas abaixo

---

## 📌 ALTERNATIVAS DE DEPLOY

### Render.com (Recomendado)

- ✅ Gratuito
- ✅ Integração com GitHub automática
- ✅ HTTPS automático
- ✅ Suporte a Node.js direto

### Railway.app

- ✅ Também gratuito
- ✅ Deploy automático com GitHub
- ✅ Interface mais simples

### Vercel

- ✅ Focado em Next.js, mas suporta Node
- ⚠️ Pode ser mais caro

### Azure/AWS/Google Cloud

- ✅ Muito confiável
- ❌ Mais caro (não recomendado para este projeto)

---

**⏱️ Tempo estimado:** 15-20 minutos
**Dificuldade:** ⭐ Fácil

Qualquer dúvida, avisa! 🚀
