# Portal AAFAB

Aplicação web para cadastro dos associados, com frontend React/Vite e API Express/Prisma.

## Desenvolvimento local

1. Instale as dependências com `npm install` e `npm --prefix server install`.
2. Copie `server/.env.example` para `server/.env` e preencha as variáveis reais.
3. Execute `npm run dev:all`.
4. Abra `http://localhost:3000`. A porta `3001` é exclusiva da API; por isso, acessar sua raiz diretamente exibe apenas uma resposta de rota inexistente.

O backend se recusa a iniciar quando `DATABASE_URL`, `ADMIN_PASSWORD` ou `JWT_SECRET` estão ausentes ou fracos. O frontend usa `VITE_API_URL` quando configurado e usa `http://localhost:3001/api` no desenvolvimento local.

## Acesso ao primeiro cadastro

O CPF precisa existir na tabela `Member`. Pelo painel administrativo, o responsável libera esse CPF e recebe um código de oito dígitos, válido por 24 horas e uma única utilização. O associado usa CPF e código para iniciar o cadastro.

A base de CPFs não é publicada no frontend. Cadastros existentes também não podem ser consultados ou alterados por uma rota pública.

## Verificação

```bash
npm run typecheck
npm run build
npm --prefix server run typecheck
npm --prefix server run test:security
```

O teste de segurança cria e remove um schema temporário no PostgreSQL configurado em `server/.env`; não altera as tabelas da aplicação.

## Publicação

O frontend é publicado pelo workflow `.github/workflows/deploy.yml`. A API é publicada pelo Render usando `render.yaml`. Migrações e alterações de variáveis devem ser concluídas antes de publicar uma versão que dependa delas.
